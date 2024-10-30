import { useStore } from '@nanostores/react';
import type { LinksFunction } from '@remix-run/cloudflare';
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react';
import tailwindReset from '@unocss/reset/tailwind-compat.css?url';
import { themeStore } from './lib/stores/theme';
import { stripIndents } from './utils/stripIndent';
import { createHead } from 'remix-island';
import { useEffect } from 'react';

import reactToastifyStyles from 'react-toastify/dist/ReactToastify.css?url';
import globalStyles from './styles/index.scss?url';
import xtermStyles from '@xterm/xterm/css/xterm.css?url';

import 'virtual:uno.css';

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: '/favicon.svg',
    type: 'image/svg+xml',
  },
  { rel: 'stylesheet', href: reactToastifyStyles },
  { rel: 'stylesheet', href: tailwindReset },
  { rel: 'stylesheet', href: globalStyles },
  { rel: 'stylesheet', href: xtermStyles },
  {
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com',
  },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
];

const inlineThemeCode = stripIndents`
  setTutorialKitTheme();

  function setTutorialKitTheme() {
    let theme = localStorage.getItem('bolt_theme');

    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.querySelector('html')?.setAttribute('data-theme', theme);
  }

  // Initialize IndexedDB early
  if (typeof window !== 'undefined' && window.indexedDB) {
    window.__BOLT_PERSISTENCE_AVAILABLE__ = false;

    // Check if we're in Chrome
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);

    if (isChrome) {
      // For Chrome, we need to be more careful with initialization
      const testRequest = window.indexedDB.open('test', 1);
      testRequest.onerror = () => {
        window.__BOLT_PERSISTENCE_AVAILABLE__ = false;
      };

      testRequest.onsuccess = () => {
        // Close and delete test database
        const testDb = testRequest.result;
        testDb.close();
        const deleteRequest = window.indexedDB.deleteDatabase('test');
        
        deleteRequest.onsuccess = () => {
          // Now try to open the actual database
          const request = window.indexedDB.open('boltHistory', 1);
          
          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('chats')) {
              const store = db.createObjectStore('chats', { keyPath: 'id' });
              store.createIndex('id', 'id', { unique: true });
              store.createIndex('urlId', 'urlId', { unique: true });
            }
          };

          request.onsuccess = (event) => {
            const db = event.target.result;
            
            // Test if we can actually use the database
            try {
              const transaction = db.transaction(['chats'], 'readonly');
              transaction.oncomplete = () => {
                window.__BOLT_PERSISTENCE_AVAILABLE__ = true;
              };
              transaction.onerror = () => {
                window.__BOLT_PERSISTENCE_AVAILABLE__ = false;
              };
            } catch (error) {
              window.__BOLT_PERSISTENCE_AVAILABLE__ = false;
            }
          };

          request.onerror = () => {
            window.__BOLT_PERSISTENCE_AVAILABLE__ = false;
          };
        };

        deleteRequest.onerror = () => {
          window.__BOLT_PERSISTENCE_AVAILABLE__ = false;
        };
      };
    } else {
      // For other browsers, use the standard approach
      const request = window.indexedDB.open('boltHistory', 1);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('chats')) {
          const store = db.createObjectStore('chats', { keyPath: 'id' });
          store.createIndex('id', 'id', { unique: true });
          store.createIndex('urlId', 'urlId', { unique: true });
        }
      };
      request.onsuccess = () => {
        window.__BOLT_PERSISTENCE_AVAILABLE__ = true;
      };
      request.onerror = () => {
        window.__BOLT_PERSISTENCE_AVAILABLE__ = false;
      };
    }
  }
`;

export const Head = createHead(() => (
  <>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <Meta />
    <Links />
    <script dangerouslySetInnerHTML={{ __html: inlineThemeCode }} />
  </>
));

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useStore(themeStore);

  useEffect(() => {
    document.querySelector('html')?.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      {children}
      <ScrollRestoration />
      <Scripts />
    </>
  );
}

export default function App() {
  return <Outlet />;
}

// Add type declaration
declare global {
  interface Window {
    __BOLT_PERSISTENCE_AVAILABLE__: boolean;
  }
}
