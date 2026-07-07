# Russian Church — Website

React + Vite + Firebase website for the Church of Christ the Saviour, Wellington.

## Setup

1. Clone the repo
2. Copy `.env.example` to `.env.local` and fill in your Firebase config values
3. `npm install`
4. `npm run dev`

## Environment variables

See `.env.example` for the required variables. Never commit `.env.local`.

## Folder structure

```
src/
  admin/          Admin-only pages (login, dashboard, content editor, etc.)
  components/     Shared components (SiteLayout, AuthGuard, LangToggle, etc.)
  contexts/       React contexts (Auth, Lang, Theme)
  hooks/          Custom hooks
  lib/            Firebase init, Firestore helpers, seed script
  pages/          Public-facing page components
  themes/         Theme definitions (one object per design template)
```

## Creating the first superadmin

After Firebase Auth is set up:

1. Go to Firebase Console → Authentication → Add user → enter email + password
2. Copy the UID shown for that user
3. Go to Firestore → Create document at `admins/{uid}` with these fields:
   ```
   uid:      <the UID>
   email:    <the email>
   role:     superadmin
   sections: all
   ```
4. Sign in at `/admin/login` — you should land on the dashboard with full access

## Seeding

The app auto-seeds Firestore with the 6 initial sections and placeholder pages
on first load (the `seedFirestore()` call in App.tsx is idempotent — safe to
leave in place, it skips documents that already exist).

## Deploying

```bash
npm run build
firebase deploy
```

Requires Firebase CLI login (`firebase login`) and the project to be initialised
(`firebase init` — select Hosting, Firestore, Storage).
