import { useRef, useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../stores/store";
import { useShallow } from "zustand/react/shallow";
import { ChatInput, PreparedAttachment } from "./ChatInput";
import { MessageBubble } from "./MessageBubble";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { MessageSkeleton } from "./ui/skeleton";
import { translateError, logError } from "../lib/errors";
import {
  ArrowDown,
  AlertTriangle,
  X,
  MessageSquare,
  StopCircle,
  RotateCcw,
} from "lucide-react";
import { Button } from "./ui/button";

export function ChatView() {
  // PERF: Use selective subscriptions with shallow equality to prevent unnecessary re-renders
  const {
    currentConversationId,
    conversations,
    addMessage,
    updateMessage,
    deleteMessagesAfter,
    deleteMessage,
    connected,
    settings,
    completeCurrentMessage,
    currentStreamingMessageId,
    markMessageSent,
    markMessageFailed,
    markMessageQueued,
  } = useStore(
    useShallow((state) => ({
      currentConversationId: state.currentConversationId,
      conversations: state.conversations,
      addMessage: state.addMessage,
      updateMessage: state.updateMessage,
      deleteMessagesAfter: state.deleteMessagesAfter,
      deleteMessage: state.deleteMessage,
      connected: state.connected,
      settings: state.settings,
      completeCurrentMessage: state.completeCurrentMessage,
      currentStreamingMessageId: state.currentStreamingMessageId,
      markMessageSent: state.markMessageSent,
      markMessageFailed: state.markMessageFailed,
      markMessageQueued: state.markMessageQueued,
    })),
  );
  
  // Derive currentConversation from id + conversations (getter doesn't trigger re-renders with useShallow)
  const currentConversation = currentConversationId 
    ? conversations.find(c => c.id === currentConversationId) || null 
    : null;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState<{
    content: string;
    attachments: PreparedAttachment[];
  } | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const lastConversationIdRef = useRef<string | null>(null);

  // Edit confirmation state
  const [pendingEdit, setPendingEdit] = useState<{
    messageId: string;
    newContent: string;
    subsequentCount: number;
  } | null>(null);

  // Show loading state when switching conversations
  useEffect(() => {
    if (
      currentConversation &&
      lastConversationIdRef.current !== currentConversation.id
    ) {
      setMessagesLoading(true);
      lastConversationIdRef.current = currentConversation.id;
      // Brief delay to simulate loading (messages load from memory instantly, but we want the skeleton for visual feedback)
      const timer = setTimeout(() => setMessagesLoading(false), 150);
      return () => clearTimeout(timer);
    }
  }, [currentConversation]);

  // P1: Auto-scroll to bottom on new messages (only if already near bottom)
  // Separate effect for streaming vs. new messages for optimal UX
  const prevMessagesLengthRef = useRef(0);

  useEffect(() => {
    if (!currentConversation) return;

    const messagesLength = currentConversation.messages.length;
    const isNewMessage = messagesLength > prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messagesLength;

    if (isNearBottom && isNewMessage) {
      // Smooth scroll for new messages
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversation?.messages.length, isNearBottom]);

  // P1: Instant scroll during streaming for responsiveness
  useEffect(() => {
    if (!currentConversation || !currentStreamingMessageId) return;

    const streamingMessage = currentConversation.messages.find(
      (m) => m.id === currentStreamingMessageId,
    );

    if (streamingMessage && isNearBottom) {
      // Use instant scroll during streaming for zero jank
      // RAF ensures it happens after DOM update
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          const { scrollHeight, clientHeight } = scrollContainerRef.current;
          scrollContainerRef.current.scrollTop = scrollHeight - clientHeight;
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversation?.messages, currentStreamingMessageId, isNearBottom]);

  // Track scroll position
  // P1: Use RAF for buttery smooth 60fps scroll tracking
  const scrollRafRef = useRef<number | null>(null);
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;

    // Cancel pending RAF to debounce
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
    }

    scrollRafRef.current = requestAnimationFrame(() => {
      if (!scrollContainerRef.current) return;

      const { scrollTop, scrollHeight, clientHeight } =
        scrollContainerRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      setIsNearBottom(distanceFromBottom < 100);

      scrollRafRef.current = null;
    });
  }, []);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  // Global keyboard shortcut: Cmd/Ctrl+/ to focus input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        chatInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // P1: Instant stop with immediate visual feedback
  const handleStopGenerating = () => {
    if (currentStreamingMessageId) {
      // Instant state update for zero-jank UX
      setIsSending(false);
      completeCurrentMessage();
    }
  };

  const handleRetry = () => {
    if (lastFailedMessage) {
      handleSendMessage(
        lastFailedMessage.content,
        lastFailedMessage.attachments,
      );
      setLastFailedMessage(null);
    }
  };

  // Actually execute the edit (after confirmation if needed)
  const executeEdit = useCallback(
    async (messageId: string, newContent: string) => {
      if (!currentConversation) return;

      // Delete all messages after this one (including any assistant response)
      deleteMessagesAfter(currentConversation.id, messageId);

      // Update the message content
      updateMessage(currentConversation.id, messageId, newContent);

      setError(null);
      setIsSending(true);
      setPendingEdit(null);

      try {
        // Add placeholder for assistant response
        addMessage(currentConversation.id, {
          role: "assistant",
          content: "",
          isStreaming: true,
        });

        // Send to gateway with updated message
        await invoke("send_message", {
          params: {
            message: newContent,
            session_key: currentConversation.id,
            model: currentConversation.model || settings.defaultModel,
            thinking: currentConversation.thinkingEnabled ? "low" : null,
          },
        });
      } catch (err: unknown) {
        console.error("Failed to send edited message:", err);
        const friendly = translateError(
          err instanceof Error ? err : String(err),
        );
        setError(
          `${friendly.title}: ${friendly.message}${friendly.suggestion ? "\n" + friendly.suggestion : ""}`,
        );
        setTimeout(() => setError(null), 15000);
      } finally {
        setIsSending(false);
      }
    },
    [
      currentConversation,
      settings.defaultModel,
      deleteMessagesAfter,
      updateMessage,
      addMessage,
    ],
  );

  // Handle editing a user message - checks for subsequent messages and shows confirmation
  const handleEditMessage = useCallback(
    (messageId: string, newContent: string) => {
      if (!currentConversation || isSending || currentStreamingMessageId)
        return;

      // Find the message index
      const messageIndex = currentConversation.messages.findIndex(
        (m) => m.id === messageId,
      );
      if (messageIndex === -1) return;

      // Check for subsequent messages
      const subsequentCount =
        currentConversation.messages.length - messageIndex - 1;

      if (subsequentCount > 0) {
        // Show confirmation dialog
        setPendingEdit({ messageId, newContent, subsequentCount });
      } else {
        // No subsequent messages, proceed directly
        executeEdit(messageId, newContent);
      }
    },
    [currentConversation, isSending, currentStreamingMessageId, executeEdit],
  );

  const handleConfirmEdit = useCallback(() => {
    if (pendingEdit) {
      executeEdit(pendingEdit.messageId, pendingEdit.newContent);
    }
  }, [pendingEdit, executeEdit]);

  const handleCancelEdit = useCallback(() => {
    setPendingEdit(null);
  }, []);

  // Handle regenerating an assistant response
  const handleRegenerate = useCallback(
    async (messageId: string) => {
      if (!currentConversation || isSending || currentStreamingMessageId)
        return;

      // Find the assistant message
      const messageIndex = currentConversation.messages.findIndex(
        (m) => m.id === messageId,
      );
      if (messageIndex === -1) return;

      // Find the preceding user message
      const precedingUserMessage = currentConversation.messages
        .slice(0, messageIndex)
        .reverse()
        .find((m) => m.role === "user");

      if (!precedingUserMessage) return;

      // Delete the assistant message we're regenerating
      deleteMessage(currentConversation.id, messageId);

      setError(null);
      setIsSending(true);

      try {
        // Add placeholder for new assistant response
        addMessage(currentConversation.id, {
          role: "assistant",
          content: "",
          isStreaming: true,
        });

        // Resend the preceding user message
        await invoke("send_message", {
          params: {
            message: precedingUserMessage.content,
            session_key: currentConversation.id,
            model: currentConversation.model || settings.defaultModel,
            thinking: currentConversation.thinkingEnabled ? "low" : null,
          },
        });
      } catch (err: unknown) {
        console.error("Failed to regenerate response:", err);
        const friendly = translateError(
          err instanceof Error ? err : String(err),
        );
        setError(
          `${friendly.title}: ${friendly.message}${friendly.suggestion ? "\n" + friendly.suggestion : ""}`,
        );
        setTimeout(() => setError(null), 15000);
      } finally {
        setIsSending(false);
      }
    },
    [
      currentConversation,
      isSending,
      currentStreamingMessageId,
      settings.defaultModel,
      deleteMessage,
      addMessage,
    ],
  );

  const handleSendMessage = async (
    content: string,
    attachments: PreparedAttachment[],
  ) => {
    if (!currentConversation || isSending) return;
    setError(null);
    setLastFailedMessage(null);
    setIsSending(true);

    // Add user message with pending state (optimistic update)
    const userMessage = addMessage(currentConversation.id, {
      role: "user",
      content,
      isPending: true, // Mark as pending until Gateway confirms
      attachments: attachments.map((a) => ({
        id: a.id,
        filename: a.filename,
        mimeType: a.mimeType,
        data: a.previewUrl ? a.data : undefined, // Only store base64 for images (for preview)
      })),
    });

    // If not connected, queue the message immediately
    if (!connected) {
      markMessageQueued(currentConversation.id, userMessage.id);
      setIsSending(false);
      setError("Not connected - message will be sent when reconnected");
      setTimeout(() => setError(null), 5000);
      return;
    }

    try {
      // Add placeholder for assistant response
      addMessage(currentConversation.id, {
        role: "assistant",
        content: "",
        isStreaming: true,
      });

      // Send to gateway with attachments
      await invoke("send_message", {
        params: {
          message: content,
          session_key: currentConversation.id,
          model: currentConversation.model || settings.defaultModel,
          thinking: currentConversation.thinkingEnabled ? "low" : null,
          attachments: attachments.map((a) => ({
            id: a.id,
            filename: a.filename,
            mimeType: a.mimeType,
            data: a.data,
          })),
        },
      });

      // Mark user message as sent (no longer pending)
      markMessageSent(currentConversation.id, userMessage.id);
    } catch (err: unknown) {
      logError(
        err instanceof Error ? err : String(err),
        "ChatView.handleSendMessage",
        {
          conversationId: currentConversation.id,
          hasAttachments: attachments.length > 0,
        },
      );
      const friendly = translateError(err instanceof Error ? err : String(err));
      const errorMsg = String(err).replace("Error: ", "");

      // Check if it's a connection error - queue for retry
      if (
        errorMsg.toLowerCase().includes("connection") ||
        errorMsg.toLowerCase().includes("network") ||
        errorMsg.toLowerCase().includes("disconnected")
      ) {
        markMessageQueued(currentConversation.id, userMessage.id);
        setError(
          `${friendly.title}: ${friendly.message}${friendly.suggestion ? "\n" + friendly.suggestion : ""}`,
        );
      } else {
        // Hard error - mark as failed
        markMessageFailed(currentConversation.id, userMessage.id, errorMsg);
        setError(
          `${friendly.title}: ${friendly.message}${friendly.suggestion ? "\n" + friendly.suggestion : ""}`,
        );
        setLastFailedMessage({ content, attachments });
      }

      // Auto-dismiss error after 10 seconds
      setTimeout(() => setError(null), 10000);
    } finally {
      setIsSending(false);
    }
  };

  if (!currentConversation) {
    return null;
  }

  const hasMessages = currentConversation.messages.length > 0;

  // Find the last assistant message for regenerate button
  const lastAssistantMessageId = currentConversation.messages
    .filter((m) => m.role === "assistant" && !m.isStreaming)
    .slice(-1)[0]?.id;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Edit confirmation dialog */}
      <ConfirmDialog
        open={!!pendingEdit}
        onClose={handleCancelEdit}
        onConfirm={handleConfirmEdit}
        title="Edit message?"
        description={`This will delete ${pendingEdit?.subsequentCount} message${pendingEdit?.subsequentCount === 1 ? "" : "s"} after this one and regenerate a new response.`}
        confirmText="Edit & Regenerate"
        confirmVariant="destructive"
      />

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        <div className="max-w-3xl mx-auto px-4 py-6">
          {messagesLoading ? (
            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <MessageSkeleton key={i} isUser={i % 2 === 0} />
              ))}
            </div>
          ) : !hasMessages ? (
            <EmptyConversation />
          ) : (
            <div className="space-y-6">
              {currentConversation.messages.map((message, index) => (
                <div
                  key={message.id}
                  className="animate-message-in"
                  style={{
                    animationDelay: `${Math.min(index * 50, 500)}ms`,
                    animationFillMode: "backwards",
                  }}
                >
                  <MessageBubble
                    message={message}
                    onEdit={handleEditMessage}
                    onRegenerate={handleRegenerate}
                    isLastAssistantMessage={
                      message.id === lastAssistantMessageId
                    }
                  />
                </div>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Stop generating button - P1: instant feedback */}
      {currentStreamingMessageId && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Button
            onClick={handleStopGenerating}
            variant="destructive"
            size="sm"
            className="shadow-lg hover:shadow-xl transition-all duration-150 active:scale-95 active:shadow-md"
            leftIcon={<StopCircle className="w-4 h-4" />}
            aria-label="Stop generating response"
          >
            Stop generating
          </Button>
        </div>
      )}

      {/* Scroll to bottom button */}
      {!isNearBottom && hasMessages && !currentStreamingMessageId && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Button
            onClick={scrollToBottom}
            variant="outline"
            size="sm"
            className="shadow-lg hover:shadow-xl hover:scale-105"
            leftIcon={<ArrowDown className="w-4 h-4" />}
            aria-label="Scroll to bottom of conversation"
          >
            Jump to bottom
          </Button>
        </div>
      )}

      {/* Error banner (P0: improved visual hierarchy) */}
      {error && (
        <div
          className="px-4 py-3 bg-destructive/10 border-t-2 border-destructive/40 animate-in slide-in-from-bottom duration-200"
          role="alert"
          aria-live="assertive"
        >
          <div className="max-w-3xl mx-auto flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center mt-0.5">
                <AlertTriangle
                  className="w-4 h-4 text-destructive"
                  strokeWidth={2.5}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-destructive mb-1">
                  Message Send Failed
                </p>
                <p className="text-xs text-destructive/80 break-words leading-relaxed whitespace-pre-line">
                  {error}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {lastFailedMessage && (
                <Button
                  onClick={handleRetry}
                  variant="destructive"
                  size="sm"
                  leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                  aria-label="Retry sending message"
                >
                  Retry
                </Button>
              )}
              <button
                onClick={() => {
                  setError(null);
                  setLastFailedMessage(null);
                }}
                className="flex-shrink-0 p-1.5 text-destructive hover:text-destructive/80 hover:bg-destructive/20 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-destructive/50"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connection warning */}
      {!connected && (
        <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 animate-in slide-in-from-bottom duration-200">
          <div className="max-w-3xl mx-auto flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Not connected to Gateway. Messages won't be sent.</span>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border/50 bg-background/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            onSend={handleSendMessage}
            disabled={!connected || isSending}
            isSending={isSending}
            inputRef={chatInputRef}
          />
        </div>
      </div>
    </div>
  );
}

function EmptyConversation() {
  const suggestions = [
    { label: "Write code", prompt: "Help me write a function that " },
    { label: "Explain concept", prompt: "Explain to me how " },
    { label: "Brainstorm ideas", prompt: "Help me brainstorm ideas for " },
    { label: "Debug error", prompt: "I'm getting this error: " },
  ];

  const handleSuggestion = (prompt: string) => {
    // Dispatch to fill the chat input
    window.dispatchEvent(
      new CustomEvent("quickinput:setmessage", { detail: { message: prompt } }),
    );
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-in fade-in duration-500">
      <div
        className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-400/10 to-red-500/10 mb-6 shadow-sm animate-in zoom-in-95 duration-500"
        style={{ animationDelay: "100ms" }}
      >
        <MessageSquare className="w-10 h-10 text-primary" strokeWidth={1.5} />
      </div>
      <h2
        className="text-xl font-semibold mb-2 animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationDelay: "200ms" }}
      >
        Start your conversation
      </h2>
      <p
        className="text-muted-foreground max-w-md text-sm sm:text-base leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationDelay: "300ms" }}
      >
        Type a message below to begin chatting. I can help with coding, writing,
        analysis, and much more.
      </p>

      {/* Quick action suggestions — clickable to fill input */}
      <div
        className="flex flex-wrap gap-2 mt-8 justify-center max-w-lg animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={{ animationDelay: "400ms" }}
      >
        {suggestions.map((action, i) => (
          <button
            key={action.label}
            onClick={() => handleSuggestion(action.prompt)}
            className="px-3 py-1.5 text-sm bg-muted/50 hover:bg-primary/8 rounded-full text-muted-foreground hover:text-primary transition-colors border border-transparent hover:border-primary/20 cursor-pointer"
            style={{ animationDelay: `${400 + i * 50}ms` }}
            aria-label={`Start with: ${action.label}`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
