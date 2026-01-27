/**
 * IndexedDB database for Moltzer Client
 * Uses Dexie for easy IndexedDB interaction and full-text search
 */

import Dexie, { type Table } from 'dexie';

export interface DBMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  modelUsed?: string;
  thinkingContent?: string;
  // Searchable text (content + any attachments text)
  searchText: string;
}

export interface DBConversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  model?: string;
  thinkingEnabled: boolean;
  isPinned: boolean;
}

export interface DBSettings {
  key: string;
  value: string;
}

export class MoltzerDB extends Dexie {
  messages!: Table<DBMessage>;
  conversations!: Table<DBConversation>;
  settings!: Table<DBSettings>;

  constructor() {
    super('MoltzerDB');
    
    this.version(1).stores({
      messages: 'id, conversationId, timestamp, *searchWords',
      conversations: 'id, updatedAt, isPinned',
      settings: 'key'
    });

    // Add computed property for full-text search
    this.messages.hook('creating', function (_primKey, obj) {
      // Create searchable words from content
      if (obj.content) {
        (obj as any).searchWords = extractSearchWords(obj.content);
      }
    });

    this.messages.hook('updating', function (modifications: any, _primKey, _obj) {
      if (modifications.content) {
        return { ...modifications, searchWords: extractSearchWords(modifications.content) };
      }
    });
  }
}

/**
 * Extract searchable words from text
 * Tokenizes and normalizes text for full-text search
 */
function extractSearchWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Remove punctuation
    .split(/\s+/)               // Split on whitespace
    .filter(word => word.length >= 2)  // Filter short words
    .filter((word, index, arr) => arr.indexOf(word) === index);  // Unique words
}

export const db = new MoltzerDB();

/**
 * Search messages by content
 */
export async function searchMessages(
  query: string,
  conversationId?: string
): Promise<DBMessage[]> {
  const words = extractSearchWords(query);
  if (words.length === 0) return [];

  let collection = db.messages.orderBy('timestamp').reverse();
  
  // Filter by conversation if specified
  if (conversationId) {
    collection = db.messages
      .where('conversationId')
      .equals(conversationId)
      .reverse();
  }

  // Get all messages and filter client-side for full-text search
  // (Dexie's multiEntry indexes work best for exact word matches)
  const allMessages = await collection.toArray();
  
  return allMessages.filter(msg => {
    const msgWords = (msg as any).searchWords as string[] || [];
    // All query words must be present in message
    return words.every(word => 
      msgWords.some(msgWord => msgWord.includes(word))
    );
  });
}

/**
 * Sync Zustand store to IndexedDB
 */
export async function syncConversationToDB(conversation: DBConversation, messages: DBMessage[]) {
  await db.transaction('rw', db.conversations, db.messages, async () => {
    await db.conversations.put(conversation);
    await db.messages.bulkPut(messages);
  });
}

/**
 * Delete conversation and its messages
 */
export async function deleteConversationFromDB(conversationId: string) {
  await db.transaction('rw', db.conversations, db.messages, async () => {
    await db.conversations.delete(conversationId);
    await db.messages.where('conversationId').equals(conversationId).delete();
  });
}

/**
 * Load all conversations from DB
 */
export async function loadConversationsFromDB(): Promise<{
  conversations: DBConversation[];
  messagesByConversation: Map<string, DBMessage[]>;
}> {
  const conversations = await db.conversations
    .orderBy('updatedAt')
    .reverse()
    .toArray();

  const messagesByConversation = new Map<string, DBMessage[]>();
  
  for (const conv of conversations) {
    const messages = await db.messages
      .where('conversationId')
      .equals(conv.id)
      .sortBy('timestamp');
    messagesByConversation.set(conv.id, messages);
  }

  return { conversations, messagesByConversation };
}
