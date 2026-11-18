import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

declare global {
  interface Window {
    __WB_MANIFEST?: Array<PrecacheEntry | string>;
  }
}

interface SwPushEvent extends Event {
  data?: {
    json(): unknown;
    text(): string;
  } | null;
  waitUntil(promise: Promise<unknown>): void;
}

interface SwNotificationClickEvent extends Event {
  notification: Notification;
  waitUntil(promise: Promise<unknown>): void;
}

interface SwClient {
  url: string;
  focus(): Promise<SwClient>;
  navigate?(url: string): Promise<SwClient | null>;
}

interface SwExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

interface SwGlobalScope {
  skipWaiting(): Promise<void>;
  registration: ServiceWorkerRegistration;
  clients: {
    matchAll(options?: {
      type?: 'window' | 'worker' | 'sharedworker' | 'all';
      includeUncontrolled?: boolean;
    }): Promise<SwClient[]>;
    openWindow(url: string): Promise<SwClient | null>;
  };
  addEventListener(type: 'install', listener: (event: SwExtendableEvent) => void): void;
  addEventListener(type: 'push', listener: (event: SwPushEvent) => void): void;
  addEventListener(
    type: 'notificationclick',
    listener: (event: SwNotificationClickEvent) => void,
  ): void;
}

const swSelf = self as unknown as SwGlobalScope;

cleanupOutdatedCaches();
clientsClaim();

// Keep literal `self.__WB_MANIFEST` intact for Workbox injectManifest replacement
const manifestEntries = self.__WB_MANIFEST || [];
precacheAndRoute(manifestEntries);

// Never cache private API endpoints or private progress photos in Service Worker cache
registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly());

// SPA navigation fallback (only when index.html is precached in production build)
if (manifestEntries.length > 0) {
  registerRoute(
    new NavigationRoute(createHandlerBoundToURL('/index.html'), {
      denylist: [/^\/api\//],
    }),
  );
}

swSelf.addEventListener('install', (event) => {
  event.waitUntil(swSelf.skipWaiting());
});

interface PushPayload {
  title?: string;
  body?: string;
  tag?: string;
  url?: string;
  routineId?: string;
}

swSelf.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload: PushPayload = {};
  try {
    payload = event.data.json() as PushPayload;
  } catch {
    payload = {
      title: 'Personal Care Tracker',
      body: event.data.text(),
    };
  }

  const title = payload.title || 'Pengingat Rutinitas';
  const options: NotificationOptions & { renotify?: boolean } = {
    body: payload.body || 'Waktunya menjalankan rutinitas perawatan Anda.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: payload.tag || 'pct-routine-reminder',
    renotify: true,
    data: {
      url: payload.url || '/#/routine',
      routineId: payload.routineId ?? null,
    },
  };

  event.waitUntil(swSelf.registration.showNotification(title, options));
});

swSelf.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data as { url?: string } | null;
  const targetUrl = notifData?.url || '/#/routine';

  event.waitUntil(
    swSelf.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            void client.focus();
            if (typeof client.navigate === 'function') {
              return client.navigate(targetUrl);
            }
            return client;
          }
        }
        return swSelf.clients.openWindow(targetUrl);
      }),
  );
});
