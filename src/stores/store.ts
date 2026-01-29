/**
 * Global State Management for Moltz Client
 *
 * Uses Zustand for lightweight, performant state management.
 * All state updates automatically persist to IndexedDB via the persistence layer.
 *
 * State structure:
 * - Connection: Gateway connection status and available models
 * - Conversations: All chat conversations with messages
 * - Settings: User preferences and configuration
 * - UI: Sidebar visibility and other UI state
 */

import { create } from "zustand";
import {
  persistConversation,
  deletePersistedConversation,
  updatePersistedConversation,
  persistMessage,
  deletePersistedMessage,
  deletePersistedMessages,
} from "../lib/persistence";
import { tryGetGatewayToken, setGatewayToken } from "../lib/keychain";

/**
 * Token usage statistics for a message
 */
export interface TokenUsage {
  input?: number;
  output?: number;
  totalTokens?: number;
}

/**
 * Message send status for user feedback
 */
export type MessageSendStatus =
  | "sending" // Being sent to Gateway
  | "sent" // Confirmed by Gateway
  | "queued" // Queued for retry (disconnected)
  | "failed"; // Failed to send

/**
 * Single message in a conversation
 */
export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  isPending?: boolean; // User message waiting for Gateway confirmation
  attachments?: Attachment[];
  sources?: Source[];
  thinkingContent?: string;
  modelUsed?: string;
  /** Token usage for this message (assistant messages only) */
  usage?: TokenUsage;
  /** Send status for user feedback (user messages only) */
  sendStatus?: MessageSendStatus;
  /** Retry count for queued messages */
  retryCount?: number;
  /** Error message if send failed */
  sendError?: string;
}

/**
 * File attachment for a message
 */
export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  data?: string; // base64
  url?: string;
}

/**
 * Source citation for a message (e.g., from web search)
 */
export interface Source {
  title: string;
  url?: string;
  snippet?: string;
}

/**
 * Complete conversation with all messages
 */
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  model?: string;
  thinkingEnabled: boolean;
  isPinned: boolean;
  /** Custom system prompt for this conversation (overrides default) */
  systemPrompt?: string;
}

/**
 * Information about an available AI model
 */
export interface ModelInfo {
  id: string; // e.g., "anthropic/claude-sonnet-4-5"
  name: string; // e.g., "Claude Sonnet 4.5"
  provider: string; // e.g., "anthropic"
  isDefault?: boolean;
}

/**
 * User settings and preferences
 */
export interface Settings {
  gatewayUrl: string;
  gatewayToken: string;
  defaultModel: string;
  thinkingDefault: boolean;
  theme: "light" | "dark" | "system";
  /** Default system prompt for new conversations */
  defaultSystemPrompt: string;
}

/**
 * Main application store
 * Contains all global state and actions
 */
interface Store {
  // Connection state
  /** Is the Gateway WebSocket connection active? */
  connected: boolean;
  /** Update connection status */
  setConnected: (connected: boolean) => void;

  // Available models from Gateway
  availableModels: ModelInfo[];
  modelsLoading: boolean;
  setAvailableModels: (models: ModelInfo[]) => void;
  setModelsLoading: (loading: boolean) => void;

  // Conversations
  conversations: Conversation[];
  conversationsLoading: boolean;
  currentConversationId: string | null;
  currentConversation: Conversation | null;

  setConversationsLoading: (loading: boolean) => void;
  createConversation: () => Conversation;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  pinConversation: (id: string) => void;

  // Messages
  addMessage: (
    conversationId: string,
    message: Omit<Message, "id" | "timestamp">,
  ) => Message;
  updateMessage: (
    conversationId: string,
    messageId: string,
    content: string,
  ) => void;
  markMessageSent: (conversationId: string, messageId: string) => void;
  markMessageFailed: (
    conversationId: string,
    messageId: string,
    error: string,
  ) => void;
  markMessageQueued: (conversationId: string, messageId: string) => void;
  retryQueuedMessages: () => Promise<void>;
  getQueuedMessagesCount: () => number;
  deleteMessage: (conversationId: string, messageId: string) => void;
  deleteMessagesAfter: (conversationId: string, messageId: string) => void;
  appendToCurrentMessage: (content: string) => void;
  completeCurrentMessage: (usage?: TokenUsage) => void;
  currentStreamingMessageId: string | null;

  // Settings
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
  loadSettings: () => Promise<void>;
}

const generateId = () => crypto.randomUUID();

/**
 * Debounced persistence helper
 * Prevents excessive database writes during rapid updates (e.g., streaming)
 */
let persistTimer: number | undefined;
const debouncedPersist = (fn: () => void, delay = 500) => {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    persistTimer = undefined; // Clear ref after execution
    fn();
  }, delay);
};

// CRITICAL-6: Clear timer on page unload to prevent memory leak
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = undefined;
    }
  });
}

/**
 * Persistence queue - serializes write operations per conversation
 * to avoid race conditions between create and immediate updates.
 */
const persistenceQueue: Map<string, Promise<void>> = new Map();

function enqueuePersistence(convId: string, op: () => Promise<void>): void {
  const prev = persistenceQueue.get(convId) ?? Promise.resolve();
  const next = prev.then(op).catch(() => {
    // errors already logged inside the operation
  });
  persistenceQueue.set(convId, next);
  next.finally(() => {
    // only delete if this is still the latest operation
    if (persistenceQueue.get(convId) === next) {
      persistenceQueue.delete(convId);
    }
  });
}

export const useStore = create<Store>()((set, get) => ({
  // Connection
  connected: false,
  setConnected: (connected) => set({ connected }),

  // Available models
  availableModels: [],
  modelsLoading: false,
  setAvailableModels: (models) => set({ availableModels: models }),
  setModelsLoading: (loading) => set({ modelsLoading: loading }),

  // Conversations
  conversations: [],
  conversationsLoading: false,
  currentConversationId: null,
  currentStreamingMessageId: null,

  get currentConversation() {
    const state = get();
    return (
      state.conversations.find((c) => c.id === state.currentConversationId) ||
      null
    );
  },

  setConversationsLoading: (loading) => set({ conversationsLoading: loading }),

  createConversation: () => {
    const conversation: Conversation = {
      id: generateId(),
      title: "New Chat",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      thinkingEnabled: get().settings.thinkingDefault,
      isPinned: false,
    };

    set((state) => ({
      conversations: [conversation, ...state.conversations],
      currentConversationId: conversation.id,
    }));

    // Persist to IndexedDB (queued to prevent race with subsequent updates)
    enqueuePersistence(conversation.id, () =>
      persistConversation(conversation).catch((err) => {
        console.error("Failed to persist new conversation:", err);
      }),
    );

    return conversation;
  },

  selectConversation: (id) => {
    set({ currentConversationId: id });
  },

  deleteConversation: (id) => {
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      currentConversationId:
        state.currentConversationId === id ? null : state.currentConversationId,
    }));

    // Delete from IndexedDB (queued after any pending create)
    enqueuePersistence(id, () =>
      deletePersistedConversation(id).catch((err) => {
        console.error("Failed to delete conversation from DB:", err);
      }),
    );
  },

  updateConversation: (id, updates) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c,
      ),
    }));

    // Persist to IndexedDB (queued after any pending create)
    enqueuePersistence(id, () => {
      const conversation = get().conversations.find((c) => c.id === id);
      if (conversation) {
        return updatePersistedConversation(conversation).catch((err) => {
          console.error("Failed to update conversation in DB:", err);
        });
      }
      return Promise.resolve();
    });
  },

  pinConversation: (id) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, isPinned: !c.isPinned } : c,
      ),
    }));

    // Persist to IndexedDB (queued after any pending create)
    enqueuePersistence(id, () => {
      const conversation = get().conversations.find((c) => c.id === id);
      if (conversation) {
        return updatePersistedConversation(conversation).catch((err) => {
          console.error("Failed to persist pin status:", err);
        });
      }
      return Promise.resolve();
    });
  },

  // Messages
  addMessage: (conversationId, messageData) => {
    const message: Message = {
      ...messageData,
      id: generateId(),
      timestamp: new Date(),
      // Initialize sendStatus for user messages
      sendStatus:
        messageData.role === "user" && messageData.isPending
          ? "sending"
          : messageData.sendStatus,
    };

    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: [...c.messages, message],
              updatedAt: new Date(),
              // Auto-generate title from first user message
              title:
                c.messages.length === 0 && messageData.role === "user"
                  ? messageData.content.slice(0, 40) +
                    (messageData.content.length > 40 ? "..." : "")
                  : c.title,
            }
          : c,
      ),
      currentStreamingMessageId: message.isStreaming ? message.id : null,
    }));

    // Persist message to IndexedDB (queued after any pending create, debounced for streaming)
    if (message.isStreaming) {
      debouncedPersist(() => {
        enqueuePersistence(conversationId, () =>
          persistMessage(conversationId, message).catch((err) => {
            console.error("Failed to persist streaming message:", err);
          }),
        );
      }, 1000);
    } else {
      enqueuePersistence(conversationId, () =>
        persistMessage(conversationId, message).catch((err) => {
          console.error("Failed to persist message:", err);
        }),
      );
    }

    return message;
  },

  updateMessage: (conversationId, messageId, content) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, content } : m,
              ),
              updatedAt: new Date(),
            }
          : c,
      ),
    }));

    // Persist the updated message (queued after any pending create)
    enqueuePersistence(conversationId, () => {
      const conversation = get().conversations.find(
        (c) => c.id === conversationId,
      );
      const message = conversation?.messages.find((m) => m.id === messageId);
      if (message) {
        return persistMessage(conversationId, message).catch((err) => {
          console.error("Failed to persist updated message:", err);
        });
      }
      return Promise.resolve();
    });
  },

  markMessageSent: (conversationId, messageId) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      isPending: false,
                      sendStatus: "sent" as MessageSendStatus,
                      sendError: undefined,
                    }
                  : m,
              ),
            }
          : c,
      ),
    }));

    // Persist the updated message (queued after any pending create)
    enqueuePersistence(conversationId, () => {
      const conversation = get().conversations.find(
        (c) => c.id === conversationId,
      );
      const message = conversation?.messages.find((m) => m.id === messageId);
      if (message) {
        return persistMessage(conversationId, {
          ...message,
          isPending: false,
          sendStatus: "sent",
          sendError: undefined,
        }).catch((err) => {
          console.error("Failed to persist message sent status:", err);
        });
      }
      return Promise.resolve();
    });
  },

  markMessageFailed: (conversationId, messageId, error) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      isPending: false,
                      sendStatus: "failed" as MessageSendStatus,
                      sendError: error,
                    }
                  : m,
              ),
            }
          : c,
      ),
    }));

    // Persist error state
    enqueuePersistence(conversationId, () => {
      const conversation = get().conversations.find(
        (c) => c.id === conversationId,
      );
      const message = conversation?.messages.find((m) => m.id === messageId);
      if (message) {
        return persistMessage(conversationId, message).catch((err) => {
          console.error("Failed to persist message error state:", err);
        });
      }
      return Promise.resolve();
    });
  },

  markMessageQueued: (conversationId, messageId) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      sendStatus: "queued" as MessageSendStatus,
                      retryCount: (m.retryCount || 0) + 1,
                      sendError: undefined,
                    }
                  : m,
              ),
            }
          : c,
      ),
    }));
  },

  retryQueuedMessages: async () => {
    const { conversations, connected } = get();

    if (!connected) {
      // Not connected yet - will retry when connection established
      return;
    }

    // Find all queued messages across all conversations
    for (const conv of conversations) {
      const queuedMessages = conv.messages.filter(
        (m) => m.sendStatus === "queued" && m.role === "user",
      );

      for (const msg of queuedMessages) {
        // Skip if too many retries (max 3)
        if ((msg.retryCount || 0) > 3) {
          get().markMessageFailed(conv.id, msg.id, "Max retries exceeded");
          continue;
        }

        try {
          // Mark as sending
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === conv.id
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === msg.id
                        ? { ...m, sendStatus: "sending" as MessageSendStatus }
                        : m,
                    ),
                  }
                : c,
            ),
          }));

          // Retry sending (using the same invoke as ChatView)
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("send_message", {
            params: {
              message: msg.content,
              session_key: conv.id,
              model: conv.model || get().settings.defaultModel,
              thinking: conv.thinkingEnabled ? "low" : null,
              attachments:
                msg.attachments?.map((a) => ({
                  id: a.id,
                  filename: a.filename,
                  mimeType: a.mimeType,
                  data: a.data,
                })) || [],
            },
          });

          // Success - mark as sent
          get().markMessageSent(conv.id, msg.id);
        } catch (err) {
          console.error("Failed to retry queued message:", err);
          // Mark as queued again for next retry
          get().markMessageQueued(conv.id, msg.id);
        }
      }
    }
  },

  getQueuedMessagesCount: () => {
    const { conversations } = get();
    return conversations.reduce((count, conv) => {
      return (
        count + conv.messages.filter((m) => m.sendStatus === "queued").length
      );
    }, 0);
  },

  deleteMessage: (conversationId, messageId) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: c.messages.filter((m) => m.id !== messageId),
              updatedAt: new Date(),
            }
          : c,
      ),
    }));

    // Delete from IndexedDB (queued after any pending create)
    enqueuePersistence(conversationId, () =>
      deletePersistedMessage(messageId).catch((err: Error) => {
        console.error("Failed to delete message from DB:", err);
      }),
    );
  },

  deleteMessagesAfter: (conversationId, messageId) => {
    const conversation = get().conversations.find(
      (c) => c.id === conversationId,
    );
    if (!conversation) return;

    const messageIndex = conversation.messages.findIndex(
      (m) => m.id === messageId,
    );
    if (messageIndex === -1) return;

    const messagesToDelete = conversation.messages.slice(messageIndex + 1);

    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: c.messages.slice(0, messageIndex + 1),
              updatedAt: new Date(),
            }
          : c,
      ),
    }));

    // Delete from IndexedDB (queued after any pending create)
    const messageIds = messagesToDelete.map((m) => m.id);
    enqueuePersistence(conversationId, () =>
      deletePersistedMessages(messageIds).catch((err: Error) => {
        console.error("Failed to delete messages from DB:", err);
      }),
    );
  },

  appendToCurrentMessage: (content) => {
    const { currentConversationId, currentStreamingMessageId } = get();
    if (!currentConversationId || !currentStreamingMessageId) return;

    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === currentConversationId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === currentStreamingMessageId
                  ? { ...m, content: m.content + content }
                  : m,
              ),
            }
          : c,
      ),
    }));

    // Debounced persistence for streaming (every 1s)
    const conversation = get().conversations.find(
      (c) => c.id === currentConversationId,
    );
    const message = conversation?.messages.find(
      (m) => m.id === currentStreamingMessageId,
    );
    if (message) {
      debouncedPersist(() => {
        persistMessage(currentConversationId, message).catch((err) => {
          console.error("Failed to persist streaming update:", err);
        });
      }, 1000);
    }
  },

  completeCurrentMessage: (usage?: TokenUsage) => {
    const { currentConversationId, currentStreamingMessageId } = get();
    if (!currentConversationId || !currentStreamingMessageId) return;

    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === currentConversationId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === currentStreamingMessageId
                  ? { ...m, isStreaming: false, usage }
                  : m,
              ),
            }
          : c,
      ),
      currentStreamingMessageId: null,
    }));

    // Final persistence after streaming completes
    const conversation = get().conversations.find(
      (c) => c.id === currentConversationId,
    );
    const message = conversation?.messages.find(
      (m) => m.id === currentStreamingMessageId,
    );
    if (message) {
      persistMessage(currentConversationId, {
        ...message,
        isStreaming: false,
        usage,
      }).catch((err) => {
        console.error("Failed to persist completed message:", err);
      });
    }
  },

  // Settings
  settings: {
    gatewayUrl: "", // Empty by default - forces onboarding
    gatewayToken: "",
    defaultModel: "anthropic/claude-sonnet-4-5",
    thinkingDefault: false,
    theme: "system",
    defaultSystemPrompt: "", // Empty by default
  },

  updateSettings: async (updates) => {
    set((state) => ({
      settings: { ...state.settings, ...updates },
    }));

    // Persist settings to localStorage (excluding token - stored in keychain)
    if (typeof window !== "undefined") {
      const currentSettings = get().settings;
      const settingsToSave = { ...currentSettings, ...updates };

      // Save token to OS keychain (secure)
      // Let errors propagate so callers can handle them
      if (updates.gatewayToken !== undefined) {
        await setGatewayToken(updates.gatewayToken);
      }

      // Save other settings to localStorage (token excluded)
      const { gatewayToken: _gatewayToken, ...settingsWithoutToken } =
        settingsToSave;
      localStorage.setItem(
        "moltz-settings",
        JSON.stringify(settingsWithoutToken),
      );
    }
  },

  loadSettings: async () => {
    if (typeof window === "undefined") return;

    try {
      // Load settings from localStorage
      const savedSettings = localStorage.getItem("moltz-settings");
      let settings = get().settings;

      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);

        // MIGRATION: If token is still in localStorage, move it to keychain
        if (parsed.gatewayToken) {
          try {
            await setGatewayToken(parsed.gatewayToken);
            // Remove token from localStorage after migration
            delete parsed.gatewayToken;
            localStorage.setItem("moltz-settings", JSON.stringify(parsed));
            // Successfully migrated gateway token to OS keychain
          } catch (err) {
            console.error("Failed to migrate token to keychain:", err);
          }
        }

        settings = { ...settings, ...parsed };
      }

      // Load token from OS keychain (secure)
      // Uses tryGetGatewayToken which returns empty string on failure
      const token = await tryGetGatewayToken();
      const tokenStatus = token
        ? `loaded (${token.length} chars)`
        : "empty/not found";
      console.log(`[settings] Gateway token from keychain: ${tokenStatus}`);
      settings = { ...settings, gatewayToken: token };

      set({ settings });
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  },
}));
