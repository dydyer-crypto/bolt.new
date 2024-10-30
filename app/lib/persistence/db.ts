import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import type { ChatHistoryItem } from './useChatHistory';

const logger = createScopedLogger('ChatHistory');

let dbInitAttempted = false;
let dbInitializing = false;

function isBrowserEnvironment(): boolean {
  try {
    return typeof window !== 'undefined' && 
           typeof window.indexedDB !== 'undefined' && 
           typeof window.IDBDatabase !== 'undefined' &&
           typeof window.IDBTransaction !== 'undefined';
  } catch (error) {
    logger.error('Error checking browser environment:', error);
    return false;
  }
}

export async function openDatabase(): Promise<IDBDatabase | undefined> {
  if (dbInitAttempted || dbInitializing) {
    logger.debug('Database initialization already attempted or in progress');
    return undefined;
  }

  dbInitializing = true;

  return new Promise((resolve) => {
    try {
      if (!isBrowserEnvironment()) {
        logger.debug('Not in browser environment or IndexedDB not available');
        dbInitAttempted = true;
        dbInitializing = false;
        resolve(undefined);
        return;
      }

      // Test if we can actually open IndexedDB
      const testRequest = window.indexedDB.open('test');
      testRequest.onerror = () => {
        logger.error('IndexedDB test failed');
        dbInitAttempted = true;
        dbInitializing = false;
        resolve(undefined);
      };

      testRequest.onsuccess = () => {
        // Close and delete test database
        const db = testRequest.result;
        db.close();
        window.indexedDB.deleteDatabase('test');

        // Now open the actual database
        const request = window.indexedDB.open('boltHistory', 1);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;
          logger.debug('Upgrading database');

          if (!db.objectStoreNames.contains('chats')) {
            const store = db.createObjectStore('chats', { keyPath: 'id' });
            store.createIndex('id', 'id', { unique: true });
            store.createIndex('urlId', 'urlId', { unique: true });
            logger.debug('Created chats store');
          }
        };

        request.onsuccess = (event: Event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          logger.debug('Successfully opened database');
          
          // Test if we can actually use the database
          try {
            const transaction = db.transaction(['chats'], 'readonly');
            transaction.oncomplete = () => {
              logger.debug('Database test successful');
              dbInitAttempted = true;
              dbInitializing = false;
              resolve(db);
            };
            transaction.onerror = () => {
              logger.error('Database test failed');
              dbInitAttempted = true;
              dbInitializing = false;
              resolve(undefined);
            };
          } catch (error) {
            logger.error('Error testing database:', error);
            dbInitAttempted = true;
            dbInitializing = false;
            resolve(undefined);
          }
        };

        request.onerror = (event: Event) => {
          const error = (event.target as IDBOpenDBRequest).error;
          logger.error('Failed to open database:', error?.message || 'Unknown error');
          dbInitAttempted = true;
          dbInitializing = false;
          resolve(undefined);
        };

        request.onblocked = () => {
          logger.error('Database blocked');
          dbInitAttempted = true;
          dbInitializing = false;
          resolve(undefined);
        };
      };
    } catch (error) {
      logger.error('Error initializing database:', error);
      dbInitAttempted = true;
      dbInitializing = false;
      resolve(undefined);
    }
  });
}

export async function getAll(db: IDBDatabase): Promise<ChatHistoryItem[]> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('chats', 'readonly');
      const store = transaction.objectStore('chats');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as ChatHistoryItem[]);
      request.onerror = () => {
        logger.error('Failed to get all chats:', request.error);
        reject(request.error);
      };
    } catch (error) {
      logger.error('Error getting all chats:', error);
      reject(error);
    }
  });
}

export async function setMessages(
  db: IDBDatabase,
  id: string,
  messages: Message[],
  urlId?: string,
  description?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('chats', 'readwrite');
      const store = transaction.objectStore('chats');

      const request = store.put({
        id,
        messages,
        urlId,
        description,
        timestamp: new Date().toISOString(),
      });

      request.onsuccess = () => {
        logger.debug('Successfully stored messages');
        resolve();
      };
      request.onerror = () => {
        logger.error('Failed to store messages:', request.error);
        reject(request.error);
      };
    } catch (error) {
      logger.error('Error storing messages:', error);
      reject(error);
    }
  });
}

export async function getMessages(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return (await getMessagesById(db, id)) || (await getMessagesByUrlId(db, id));
}

export async function getMessagesByUrlId(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('chats', 'readonly');
      const store = transaction.objectStore('chats');
      const index = store.index('urlId');
      const request = index.get(id);

      request.onsuccess = () => resolve(request.result as ChatHistoryItem);
      request.onerror = () => {
        logger.error('Failed to get messages by URL ID:', request.error);
        reject(request.error);
      };
    } catch (error) {
      logger.error('Error getting messages by URL ID:', error);
      reject(error);
    }
  });
}

export async function getMessagesById(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('chats', 'readonly');
      const store = transaction.objectStore('chats');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result as ChatHistoryItem);
      request.onerror = () => {
        logger.error('Failed to get messages by ID:', request.error);
        reject(request.error);
      };
    } catch (error) {
      logger.error('Error getting messages by ID:', error);
      reject(error);
    }
  });
}

export async function deleteById(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('chats', 'readwrite');
      const store = transaction.objectStore('chats');
      const request = store.delete(id);

      request.onsuccess = () => resolve(undefined);
      request.onerror = () => {
        logger.error('Failed to delete chat:', request.error);
        reject(request.error);
      };
    } catch (error) {
      logger.error('Error deleting chat:', error);
      reject(error);
    }
  });
}

export async function getNextId(db: IDBDatabase): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('chats', 'readonly');
      const store = transaction.objectStore('chats');
      const request = store.getAllKeys();

      request.onsuccess = () => {
        const highestId = request.result.reduce((cur, acc) => Math.max(+cur, +acc), 0);
        resolve(String(+highestId + 1));
      };
      request.onerror = () => {
        logger.error('Failed to get next ID:', request.error);
        reject(request.error);
      };
    } catch (error) {
      logger.error('Error getting next ID:', error);
      reject(error);
    }
  });
}

export async function getUrlId(db: IDBDatabase, id: string): Promise<string> {
  const idList = await getUrlIds(db);

  if (!idList.includes(id)) {
    return id;
  } else {
    let i = 2;
    while (idList.includes(`${id}-${i}`)) {
      i++;
    }
    return `${id}-${i}`;
  }
}

async function getUrlIds(db: IDBDatabase): Promise<string[]> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('chats', 'readonly');
      const store = transaction.objectStore('chats');
      const idList: string[] = [];

      const request = store.openCursor();

      request.onsuccess = (event: Event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          if (cursor.value.urlId) {
            idList.push(cursor.value.urlId);
          }
          cursor.continue();
        } else {
          resolve(idList);
        }
      };

      request.onerror = () => {
        logger.error('Failed to get URL IDs:', request.error);
        reject(request.error);
      };
    } catch (error) {
      logger.error('Error getting URL IDs:', error);
      reject(error);
    }
  });
}
