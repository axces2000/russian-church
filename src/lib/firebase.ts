// src/lib/firebase.ts

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import type { Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

export const db      = getFirestore(app);
export const auth    = getAuth(app);
export const storage = getStorage(app);

// Analytics is optional: the site works fine without VITE_FIREBASE_MEASUREMENT_ID
// set (e.g. in local dev). isSupported() also guards against browser
// environments where Analytics would silently fail (tracking protection,
// no IndexedDB, etc.), so this promise can resolve to null in those cases too.
// Loaded dynamically (not imported at the top of this file) so the whole
// analytics module — and every other file that touches it — stays out of
// the main bundle entirely when no measurement ID is configured.
let analyticsPromise: Promise<Analytics | null> = Promise.resolve(null);
if (firebaseConfig.measurementId) {
  analyticsPromise = import('firebase/analytics').then(({ getAnalytics, isSupported }) =>
    isSupported().then(ok => (ok ? getAnalytics(app) : null))
  );
}
export function getAnalyticsInstance(): Promise<Analytics | null> {
  return analyticsPromise;
}
