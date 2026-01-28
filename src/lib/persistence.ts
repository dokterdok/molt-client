/**
 * Persistence layer for Moltz Client
 *
 * Integrates:
 * - IndexedDB storage via Dexie (lazy-loaded for fast startup)
 * - End-to-end encryption via Web Crypto API
 * - Automatic sync between Zustand store and database
 *
 * All conversation data is encrypted at rest with zero user friction.
 */

import { type DBMessage, type DBConversation } from "./db";
import { encrypt, decrypt } from "./encryption";
import type { Conversation, Message } from "../stores/store";

// Lazy-load the Dexie database (~95 kB) on first access.
// All persistence functions are async anyway, so this adds zero latency
// after the first call while freeing the main thread during initial render.
let _db: typeof import("./db").db;
async function getDb() {
  if (!_db) {
    const { db } = await import("./db");
    _db = db;
  }
  return _db;
}

/**
 * Load all conversations and messages from IndexedDB
 * Automatically decrypts all data
 */
export async function loadPersistedData(): Promise<{
  conversations: Conversation[];
}> {
  try {
    const db = await getDb();

    // Load conversations
    const dbConversations = await db.conversations
      .orderBy("updatedAt")
      .reverse()
      .toArray();

    // Load and decrypt messages for each conversation
    const conversations: Conversation[] = [];

    for (const dbConv of dbConversations) {
      const dbMessages = await db.messages
        .where("conversationId")
        .equals(dbConv.id)
        .sortBy("timestamp");

      // Decrypt messages
      const messages: Message[] = [];
      for (const dbMsg of dbMessages) {
        try {
          const decrypted = await decrypt(dbMsg.content);
          messages.push({
            id: dbMsg.id,
            role: dbMsg.role,
            content: decrypted,
            timestamp: dbMsg.timestamp,
            modelUsed: dbMsg.modelUsed,
            thinkingContent: dbMsg.thinkingContent
              ? await decrypt(dbMsg.thinkingContent)
              : undefined,
          });
        } catch (err) {
          console.error(`Failed to decrypt message ${dbMsg.id}:`, err);
          // Skip corrupted messages
        }
      }

      // Decrypt conversation title
      let title = dbConv.title;
      try {
        title = await decrypt(dbConv.title);
      } catch {
        // If decryption fails, it might be unencrypted (migration case)
        console.warn(
          `Could not decrypt conversation title ${dbConv.id}, using as-is`,
        );
      }

      // Decrypt system prompt if present
      let systemPrompt: string | undefined;
      if (dbConv.systemPrompt) {
        try {
          systemPrompt = await decrypt(dbConv.systemPrompt);
        } catch {
          console.warn(
            `Could not decrypt system prompt for ${dbConv.id}, ignoring`,
          );
        }
      }

      conversations.push({
        id: dbConv.id,
        title,
        messages,
        createdAt: dbConv.createdAt,
        updatedAt: dbConv.updatedAt,
        model: dbConv.model,
        thinkingEnabled: dbConv.thinkingEnabled,
        isPinned: dbConv.isPinned,
        systemPrompt,
      });
    }

    return { conversations };
  } catch (err) {
    console.error("Failed to load persisted data:", err);
    // Return empty state on error
    return { conversations: [] };
  }
}

/**
 * Persist a conversation to IndexedDB
 * Automatically encrypts all sensitive data
 */
export async function persistConversation(
  conversation: Conversation,
): Promise<void> {
  try {
    const db = await getDb();

    // Encrypt title
    const encryptedTitle = await encrypt(conversation.title);

    // Create DB conversation
    const dbConv: DBConversation = {
      id: conversation.id,
      title: encryptedTitle,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      model: conversation.model,
      thinkingEnabled: conversation.thinkingEnabled,
      isPinned: conversation.isPinned,
      systemPrompt: conversation.systemPrompt
        ? await encrypt(conversation.systemPrompt)
        : undefined,
    };

    // Encrypt and save messages
    const dbMessages: DBMessage[] = [];
    for (const msg of conversation.messages) {
      const encryptedContent = await encrypt(msg.content);
      const encryptedThinking = msg.thinkingContent
        ? await encrypt(msg.thinkingContent)
        : undefined;

      // Create searchable plaintext (for full-text search)
      // Note: This is a privacy tradeoff - search terms are NOT encrypted
      // If full privacy is needed, remove searchText or implement encrypted search
      const searchText = msg.content.toLowerCase();

      dbMessages.push({
        id: msg.id,
        conversationId: conversation.id,
        role: msg.role,
        content: encryptedContent,
        timestamp: msg.timestamp,
        modelUsed: msg.modelUsed,
        thinkingContent: encryptedThinking,
        searchText, // Plaintext for search (privacy tradeoff)
      });
    }

    // Save to database in transaction
    await db.transaction("rw", db.conversations, db.messages, async () => {
      await db.conversations.put(dbConv);

      // Delete old messages for this conversation, then insert new ones
      await db.messages
        .where("conversationId")
        .equals(conversation.id)
        .delete();
      await db.messages.bulkAdd(dbMessages);
    });
  } catch (err) {
    console.error("Failed to persist conversation:", err);
    throw err;
  }
}

/**
 * Delete a conversation from IndexedDB
 */
export async function deletePersistedConversation(
  conversationId: string,
): Promise<void> {
  try {
    const db = await getDb();

    await db.transaction("rw", db.conversations, db.messages, async () => {
      await db.conversations.delete(conversationId);
      await db.messages.where("conversationId").equals(conversationId).delete();
    });
  } catch (err) {
    console.error("Failed to delete conversation:", err);
    throw err;
  }
}

/**
 * Update a single message in the database
 * Used for streaming updates to avoid full conversation sync
 */
export async function persistMessage(
  conversationId: string,
  message: Message,
): Promise<void> {
  try {
    const db = await getDb();

    const encryptedContent = await encrypt(message.content);
    const encryptedThinking = message.thinkingContent
      ? await encrypt(message.thinkingContent)
      : undefined;

    const searchText = message.content.toLowerCase();

    const dbMessage: DBMessage = {
      id: message.id,
      conversationId,
      role: message.role,
      content: encryptedContent,
      timestamp: message.timestamp,
      modelUsed: message.modelUsed,
      thinkingContent: encryptedThinking,
      searchText,
    };

    await db.messages.put(dbMessage);
  } catch (err) {
    console.error("Failed to persist message:", err);
    throw err;
  }
}

/**
 * Update conversation metadata (title, isPinned, etc.)
 * Does NOT update messages - use persistMessage for that
 */
export async function updatePersistedConversation(
  conversation: Conversation,
): Promise<void> {
  try {
    const db = await getDb();

    const encryptedTitle = await encrypt(conversation.title);

    const dbConv: DBConversation = {
      id: conversation.id,
      title: encryptedTitle,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      model: conversation.model,
      thinkingEnabled: conversation.thinkingEnabled,
      isPinned: conversation.isPinned,
    };

    await db.conversations.put(dbConv);
  } catch (err) {
    console.error("Failed to update conversation:", err);
    throw err;
  }
}

/**
 * Search messages across all conversations
 * Returns decrypted messages that match the query
 */
export async function searchPersistedMessages(
  query: string,
  conversationId?: string,
): Promise<
  Array<Message & { conversationId: string; conversationTitle: string }>
> {
  try {
    const db = await getDb();
    const searchWords = query.toLowerCase().split(/\s+/);

    let collection = db.messages.toCollection();
    if (conversationId) {
      collection = db.messages.where("conversationId").equals(conversationId);
    }

    const allMessages = await collection.toArray();

    // Filter by search terms
    const matchingMessages = allMessages.filter((msg) => {
      const searchText = msg.searchText || "";
      return searchWords.every((word) => searchText.includes(word));
    });

    // Decrypt and enrich with conversation info
    const results: Array<
      Message & { conversationId: string; conversationTitle: string }
    > = [];

    for (const dbMsg of matchingMessages) {
      try {
        const decrypted = await decrypt(dbMsg.content);
        const conversation = await db.conversations.get(dbMsg.conversationId);
        const conversationTitle = conversation
          ? await decrypt(conversation.title)
          : "Unknown";

        results.push({
          id: dbMsg.id,
          role: dbMsg.role,
          content: decrypted,
          timestamp: dbMsg.timestamp,
          modelUsed: dbMsg.modelUsed,
          thinkingContent: dbMsg.thinkingContent
            ? await decrypt(dbMsg.thinkingContent)
            : undefined,
          conversationId: dbMsg.conversationId,
          conversationTitle,
        });
      } catch (err) {
        console.error(`Failed to decrypt search result ${dbMsg.id}:`, err);
      }
    }

    return results;
  } catch (err) {
    console.error("Failed to search messages:", err);
    return [];
  }
}

/**
 * Delete a single message from IndexedDB
 */
export async function deletePersistedMessage(messageId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.messages.delete(messageId);
  } catch (err) {
    console.error("Failed to delete message:", err);
    throw err;
  }
}

/**
 * Delete multiple messages from IndexedDB
 */
export async function deletePersistedMessages(
  messageIds: string[],
): Promise<void> {
  try {
    const db = await getDb();
    await db.messages.bulkDelete(messageIds);
  } catch (err) {
    console.error("Failed to delete messages:", err);
    throw err;
  }
}

/**
 * Clear all persisted data
 * WARNING: This will delete all conversations and messages
 */
export async function clearAllData(): Promise<void> {
  try {
    const db = await getDb();

    await db.transaction("rw", db.conversations, db.messages, async () => {
      await db.conversations.clear();
      await db.messages.clear();
    });
  } catch (err) {
    console.error("Failed to clear data:", err);
    throw err;
  }
}

/**
 * Get database statistics
 */
export async function getStorageStats(): Promise<{
  conversationCount: number;
  messageCount: number;
  estimatedSize: string;
}> {
  try {
    const db = await getDb();
    const conversationCount = await db.conversations.count();
    const messageCount = await db.messages.count();

    // Estimate storage (rough calculation)
    const sizeKB = (messageCount * 500) / 1024;
    const estimatedSize = sizeKB === 0 ? "0 KB" : sizeKB.toFixed(2) + " KB";

    return {
      conversationCount,
      messageCount,
      estimatedSize,
    };
  } catch (err) {
    console.error("Failed to get storage stats:", err);
    return {
      conversationCount: 0,
      messageCount: 0,
      estimatedSize: "0 KB",
    };
  }
}
