import {
  fetchPushStatus,
  removePushSubscription,
  savePushSubscription,
} from '../api/repository';
import type { PushSubscriptionInput, PushSubscriptionSummary } from '../../types/database';

export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getReadyServiceWorker(timeoutMs = 8000): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Browser ini tidak mendukung Service Worker.');
  }

  const readyPromise = navigator.serviceWorker.ready;
  const timeoutPromise = new Promise<never>((_, reject) => {
    window.setTimeout(
      () => reject(new Error('Service Worker belum siap. Muat ulang halaman lalu coba lagi.')),
      timeoutMs,
    );
  });

  return Promise.race([readyPromise, timeoutPromise]);
}

export async function getCurrentDevicePushSubscription(): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) return null;
  try {
    const reg = await getReadyServiceWorker(4000);
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function subscribeCurrentDeviceToWebPush(): Promise<PushSubscriptionSummary> {
  if (!isWebPushSupported()) {
    throw new Error('Browser atau perangkat ini belum mendukung Web Push.');
  }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

  if (permission !== 'granted') {
    throw new Error(
      'Izin notifikasi tidak diberikan. Aktifkan izin notifikasi di pengaturan browser terlebih dahulu.',
    );
  }

  const status = await fetchPushStatus();
  if (!status.publicKey) {
    throw new Error('Kunci publik VAPID server belum tersedia.');
  }

  const registration = await getReadyServiceWorker();
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(status.publicKey),
    });
  }

  const rawJson = subscription.toJSON();
  const payload: PushSubscriptionInput = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: rawJson.keys?.p256dh ?? '',
      auth: rawJson.keys?.auth ?? '',
    },
  };

  if (!payload.endpoint || !payload.keys.p256dh || !payload.keys.auth) {
    throw new Error('Browser gagal membuat kunci enkripsi langganan push.');
  }

  return savePushSubscription(payload, navigator.userAgent);
}

export async function unsubscribeCurrentDeviceFromWebPush(): Promise<void> {
  const existing = await getCurrentDevicePushSubscription();
  if (existing) {
    const endpoint = existing.endpoint;
    await existing.unsubscribe().catch(() => false);
    await removePushSubscription(endpoint);
  } else {
    await removePushSubscription();
  }
}
