# Canon Reading feature — setup & local testing

## What's in this bundle

Drop these files into your repo at the matching paths (all under the repo root):

```
.env.example                       (updated — new optional var documented)
.gitignore                         (updated — ignores functions/node_modules, functions/.secret.local)
firebase.json                      (updated — registers the functions codebase)
firestore.rules                    (updated — new canonReadings rule)
functions/package.json             (NEW — Cloud Function dependencies)
functions/index.js                 (NEW — the findCanonReading callable function)
src/App.tsx                        (updated — new /admin/canon route)
src/admin/AdminDashboard.tsx       (updated — new dashboard tile)
src/admin/CanonReadingAdmin.tsx    (NEW — admin UI)
src/components/CanonReadingNotice.tsx (NEW — public display, under Services)
src/lib/canonReadingTemplate.ts    (NEW — deterministic announcement templating)
src/lib/firebase.ts                (updated — exports `functions`)
src/lib/firestore.ts               (updated — CanonReading types + CRUD helpers)
src/pages/SectionPage.tsx          (updated — renders the notice under Services)
```

Everything compiled clean against your current repo (`tsc -b` and `npm run build` both pass) before I handed it over.

## How it works, in one paragraph

The admin types an approximate canon description (e.g. "канон Николаю Чудотворцу") and clicks **Search with AI**. That calls a Cloud Function (`findCanonReading`), which asks Gemini — with Google Search grounding — to find one specific page with that canon's text, preferring azbyka.ru / православный-молитвослов.рф / pravoslavie.ru. The admin must open the link and tick "I confirmed it's correct" (or type a link in manually) before **Generate announcement text** is enabled. That generation step is *not* AI — it's plain string templating in `canonReadingTemplate.ts`, using the same wording pattern as your example message. The result lands in an editable textarea with a live preview, and only becomes visible on the public Services page once saved as "Published".

## One-time setup

### 1. Get a Gemini API key
Go to https://aistudio.google.com/apikey and create a key. Usage here is tiny (one search a week), so you'll likely stay in the free tier; even the paid rate is fractions of a cent per call.

### 2. Install function dependencies
```bash
cd functions
npm install
```

### 3. Set the key for local testing
Create `functions/.secret.local` (already gitignored) with:
```
GEMINI_API_KEY=your-key-here
```
The Functions emulator picks this up automatically because `index.js` uses `defineSecret('GEMINI_API_KEY')`.

### 4. Set the key for production (do this before your first real deploy)
```bash
firebase functions:secrets:set GEMINI_API_KEY
```
It'll prompt you to paste the key and stores it in Secret Manager — never in your code or repo.

## Testing locally

You're already on Blaze, so this uses the **functions emulator only** — Auth, Firestore, and Hosting keep working against your live project exactly like `npm run dev` always has. Only the AI search call gets routed locally.

`firebase.json` includes an `emulators.functions.port: 5001` block so the CLI knows this emulator exists — without it you'll get `Error: No emulators to start`.

**Terminal 1:**
```bash
cd functions
npm install   # if you haven't already
cd ..
firebase emulators:start --only functions
```
Leave this running — it starts the function on `http://127.0.0.1:5001`.

**Terminal 2:**
```bash
# add this one line to your .env.local:
echo "VITE_USE_FUNCTIONS_EMULATOR=true" >> .env.local
npm run dev
```

Now sign in as an admin, go to **Dashboard → Canon Reading**, click **+ New Canon Reading**, and try a search. Function logs (including any Gemini API errors) print in Terminal 1.

When you're done testing, remove or set `VITE_USE_FUNCTIONS_EMULATOR=false` in `.env.local` so normal `npm run dev` goes back to hitting the deployed function once you deploy it.

## Deploying

```bash
npm run build
firebase deploy --only functions,firestore:rules,hosting
```
(`firebase deploy` alone also works — it just also touches Storage rules, which are unchanged.)

## Notes / things worth knowing

- **Settings tab access**: the Zoom links, Wikipedia link, reconciliation-prayer link, and default priest name/location live in `settings/canonReading`, which the *existing* `settings/{docId}` Firestore rule already covers — write access is **superadmin only**, same as Site Settings and the Template Switcher. If you want a delegated "services" admin to edit these too, that rule would need a small change — just say the word.
- **Grammar note**: Russian needs the canon's dedication in dative case after "чтение канона" (e.g. "святителю Николаю", not "святитель Николай"). Rather than trying to auto-inflect this, the admin field just asks for it already in dative case — the label says so directly.
- **The AI never publishes anything by itself.** It only returns a candidate title + URL; the admin has to confirm the link (or override it) before the "Generate" button unlocks, and nothing appears publicly until "Save & Publish" is clicked.
- **Model name**: `functions/index.js` hardcodes `gemini-2.5-flash`. If Google renames or retires it, that's a one-line change at the top of the file.
- The public notice shows the **nearest upcoming published entry**, falling back to the most recent past one if none is upcoming — so you don't need to manually "expire" old announcements, but you do want to publish next week's before the old one goes stale.
