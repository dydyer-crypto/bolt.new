import { RemixBrowser } from '@remix-run/react';
import { startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('Client');

function isChrome(): boolean {
  return /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
}

// Initialize IndexedDB before hydration
async function initIndexedDB() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    logger.debug('IndexedDB not available');
    window.__BOLT_PERSISTENCE_AVAILABLE__ = false;
    return false;
  }

  return new Promise<boolean>((resolve) => {
    try {
      // For Chrome, we need to be more careful with initialization
      if (isChrome()) {
        // First, try to open a test database
        const testRequest = window.indexedDB.open('test', 1);
        testRequest.onerror = () => {
          logger.error('Test database failed');
          window.__BOLT_PERSISTENCE_AVAILABLE__ = false;
          resolve(false);
        };

        testRequest.onsuccess = () => {
          // Close and delete test database
          const testDb = testRequest.result;
          testDb.close();
          const deleteRequest = window.indexedDB.deleteDatabase('test');
          
          deleteRequest.onsuccess = () => {
            // Now try to open the actual database
            const request = window.indexedDB.open('boltHistory', 1);
            
            request.onerror = () => {
              logger.error('Failed to open database');
              window.__BOLT_PERSISTENCE_AVAILABLE__ = false;
              resolve(false);
            };

            request.onupgradeneeded = (event) => {
              const db = (event.target as IDBOpenDBRequest).result;
              if (!db.objectStoreNames.contains('chats')) {
                const store = db.createObjectStore('chats', { keyPath: 'id' });
                store.createIndex('id', 'id', { unique: true });
                store.createIndex('urlId', 'urlId', { unique: true });
              }
            };

            request.onsuccess = (event) => {
              const db = (event.target as IDBOpenDBRequest).result;
              
              // Test if we can actually use the database
              try {
                const transaction = db.transaction(['chats'], 'readonly');
                transaction.oncomplete = () => {
                  logger.debug('Database test successful');
                  window.__BOLT_PERSISTENCE_AVAILABLE__ = true;
                  resolve(true);
                };
                transaction.onerror = () => {
                  logger.error('Database test failed');
                  window.__BOLT_PERSISTENCE_AVAILABLE__ = false;
                  resolve(false);
                };
              } catch (error) {
                logger.error('Error testing database:', error);
                window.__BOLT_PERSISTENCE_AVAILABLE__ = false;
                resolve(false);
              }
            };
          };

          deleteRequest.onerror = () => {
            logger.error('Failed to delete test database');
            window.__BOLT_PERSISTENCE_AVAILABLE__ = false;
            resolve(false);
          };
        };
      } else {
        // For other browsers, use the standard approach
        const request = window.indexedDB.open('boltHistory', 1);
        request.onerror = () => {
          logger.error('Failed to open database');
          window.__BOLT_PERSISTENCE_AVAILABLE__ = false;
          resolve(false);
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('chats')) {
            const store = db.createObjectStore('chats', { keyPath: 'id' });
            store.createIndex('id', 'id', { unique: true });
            store.createIndex('urlId', 'urlId', { unique: true });
          }
        };

        request.onsuccess = () => {
          logger.debug('Database initialized');
          window.__BOLT_PERSISTENCE_AVAILABLE__ = true;
          resolve(true);
        };
      }
    } catch (error) {
      logger.error('Error initializing database:', error);
      window.__BOLT_PERSISTENCE_AVAILABLE__ = false;
      resolve(false);
    }
  });
}

// Set initial persistence state
window.__BOLT_PERSISTENCE_AVAILABLE__ = false;

// Initialize IndexedDB before hydrating the app
initIndexedDB().then(() => {
  startTransition(() => {
    hydrateRoot(document.getElementById('root')!, <RemixBrowser />);
  });
});

// Add type declaration
declare global {
  interface Window {
    __BOLT_PERSISTENCE_AVAILABLE__: boolean;
  }
}
