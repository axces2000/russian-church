// src/lib/firebaseAdmin.ts
// Auth, Storage, and Cloud Functions — used only by the admin panel.
// Deliberately kept out of ./firebase.ts (which the public site also
// imports, for Firestore): an ES module runs its entire top level the
// moment anything imports from it, so if these three SDKs lived in the
// same file as `db`, they'd load for every public visitor too. This file
// is only ever imported from admin-only code (see src/admin/AdminApp.tsx
// and its lazy-loaded pages), so Vite code-splits it into the admin chunk.

import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { app } from './firebase';

export const auth    = getAuth(app);
export const storage = getStorage(app);

// Cloud Functions — region must match firestore/hosting region.
// Set VITE_USE_FUNCTIONS_EMULATOR=true in .env.local to point this at a
// locally-running `firebase emulators:start --only functions` instance
// instead of the deployed (production) functions. Everything else (auth,
// firestore, storage) keeps hitting the live project as usual, matching
// how `npm run dev` already works for the rest of the app.
export const functions = getFunctions(app, 'australia-southeast1');
if (import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true') {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}
