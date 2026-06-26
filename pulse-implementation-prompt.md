# Implementation Task: Build `pulse.kanaksan.com` — Real-Time Visitor Analytics

You are implementing a **complete, deployable web application** from scratch. Build every file, follow the architecture exactly, and produce production-ready code. Do not stub or skip files. When a decision is ambiguous, prefer the **cheapest, simplest, Firebase-native** option and note your choice in a code comment.

---

## 1. What you are building

`pulse.kanaksan.com` is a **real-time visitor analytics dashboard** that tracks visitor locations across the `kanaksan.com` product family (`vote.`, `learn.`, `author.`, etc.) and plots them as clustered pins on a Google Map in a private admin dashboard.

**Three deliverables:**
1. `tracker.js` — a lightweight, self-contained script embedded in any kanaksan subdomain that records one visit per visitor per app per day.
2. An admin **dashboard** (`index.html`) — auth-gated map + stats + recent-visitor list.
3. An admin **login** page (`login.html`).

**Hard constraints (do not violate):**
- **Zero backend server.** Firebase-native only (Hosting + Firestore + Auth). The only Cloud Function allowed is an optional cleanup safety-net.
- **Cost-optimal.** Minimize Firestore reads/writes and Google Maps API loads (see §8).
- **Vanilla HTML + JS.** No framework, no bundler, no npm front-end deps. Firebase + Maps load from CDN.

---

## 2. Tech stack

| Layer | Technology |
|---|---|
| Hosting | Firebase Hosting |
| Database | Cloud Firestore |
| Auth | Firebase Anonymous Auth (visitors) + Email/Password Auth (admin) |
| Geolocation | Browser `navigator.geolocation` |
| Map | Google Maps JavaScript SDK v3 + `@googlemaps/markerclusterer` (CDN) |
| Front end | Vanilla HTML + JS |
| Functions | Firebase Cloud Functions (Node.js) — optional cleanup only |

---

## 3. Repository structure

```
pulse-kanaksan/
├── public/
│   ├── index.html          # Admin dashboard (auth-gated)
│   ├── login.html          # Admin login
│   ├── tracker.js          # Embeddable visitor tracker
│   ├── app.css             # Shared dashboard + login styles
│   └── dashboard.js        # Dashboard logic (map, stats, filters, list)
├── functions/
│   ├── index.js            # Optional scheduled cleanup
│   └── package.json
├── firestore.rules
├── firestore.indexes.json
├── firebase.json
├── .firebaserc
└── README.md               # Setup + deploy + custom-domain steps
```

---

## 4. Firestore data model

### Collection: `visits/{visitId}` (auto-ID)

| Field | Type | Notes |
|---|---|---|
| `uid` | string | Firebase anonymous UID — **must equal `request.auth.uid`** |
| `app` | string | Source app id, e.g. `"vote"`, `"learn"`, `"author"` |
| `lat` | number \| null | `null` if geolocation denied — **keep the record** |
| `lng` | number \| null | `null` if denied |
| `city` | string \| null | Best-effort; may be null (no paid geocoding at capture) |
| `country` | string \| null | Best-effort |
| `userAgent` | string | `navigator.userAgent` |
| `referrer` | string | `document.referrer` |
| `timestamp` | Timestamp | **Must equal `request.time`** (set via `serverTimestamp()`) |
| `ttl` | Timestamp | `timestamp + 60 days` — drives native Firestore TTL deletion |

**TTL:** Enable a native Firestore TTL policy on the `ttl` field via Console (free, no function needed for deletion).

**Indexes (`firestore.indexes.json`):**
- Composite: `app ASC, timestamp DESC`
- Single-field `timestamp DESC` is automatic; add a composite only if a query needs it.

---

## 5. Module A — `tracker.js` (embeddable)

### Embed contract
```html
<script src="https://pulse.kanaksan.com/tracker.js" data-app="vote"></script>
```

### Required behaviour (in order)
1. Read `data-app` from the script's own tag (`document.currentScript`). Default to `"unknown"` if missing.
2. **Dedup gate first** (before any network): if `localStorage["pulse_visited_{app}_{YYYY-MM-DD}"]` exists, **stop** — no Firebase init, no write. This is the primary cost control.
3. Lazily load the Firebase **compat or modular** SDK from CDN (modular preferred), init with the hardcoded pulse web config.
4. `signInAnonymously()`.
5. Call `navigator.geolocation.getCurrentPosition()` with a short timeout (e.g. `{ timeout: 8000, maximumAge: 600000 }`).
   - **On success:** write a `visits` doc with `lat`/`lng`.
   - **On denial/error/timeout:** write a `visits` doc with `lat: null, lng: null` (a partial record — **do not drop it**).
6. Set `timestamp` and `ttl` using `serverTimestamp()` / a 60-day computed Timestamp. `uid` = the anonymous UID.
7. On a successful write, set the `localStorage` dedup key.
8. Wrap everything in try/catch and fail **silently** — the tracker must never throw into the host app or block its render. Run after `DOMContentLoaded` / defer.

### Constraints
- Self-contained, no app-level dependencies, no Maps SDK (Maps loads only on the dashboard).
- Hardcode the Firebase web config (it is public by design; Firestore Rules are the security boundary — see §7).
- One Firestore write per unique visitor per app per day, max.

---

## 6. Module B — Admin dashboard (`index.html` + `dashboard.js`)

### Auth gate
- On load, observe `onAuthStateChanged`.
- If no user **or** `user.email !== ADMIN_EMAIL`, redirect to `login.html`.
- `ADMIN_EMAIL` is a single hardcoded constant (`mars@kanaksan.com` — make it a clearly-marked top-of-file const).

### Data loading (cost-aware)
- Query `visits` ordered by `timestamp DESC`, **`limit(500)`**.
- Apply the app filter with a `where("app","==",…)` clause when not "All".
- Apply the date filter with `where("timestamp",">=",cutoff)`.
- Initialize the Google Map **once**. On filter change: **clear markers → re-query → re-plot** (never re-create the map).
- Derive stats client-side from the loaded set: Total visits, Unique visitors (distinct `uid`), Today.

### Map
- Center India `{ lat: 20.5937, lng: 78.9629 }`, zoom `5`.
- Cluster with `@googlemaps/markerclusterer` (CDN).
- Skip records where `lat`/`lng` is `null` for plotting (still count them in stats).
- Info window on marker click: `city`, `app`, formatted `timestamp`.
- Load the Maps script with `loading=async` and `&libraries=marker` as needed.

### Filters
- **App:** `All | vote | learn | author | …` — populate dynamically from distinct `app` values in the loaded set.
- **Date range:** `Last 7 days | Last 30 days | All time`.

### UI / design spec
Match the approved design (clean Linear/Vercel-minimal, **Geist** font, neutral grayscale + a single emerald `#10b981` "pulse/live" accent). Layout:

```
┌──────────────────────────────────────────────────────────────┐
│ ● pulse / kanaksan.com        [All apps ▾][Last 30 days ▾] M  │  56px top bar
├───────────────────────────────────────┬──────────────────────┤
│                                        │ OVERVIEW        ●Live │
│            Google Map                  │ ┌──────────────────┐ │
│      (clustered green pins,            │ │ Total visits     │ │
│       info window on click)            │ │ 1,243   +8.2%    │ │
│                                        │ └──────────────────┘ │
│                                        │ [Unique 891][Today 34│
│                                        ├──────────────────────┤
│                                        │ RECENT VISITORS 500  │
│                                        │ ▢ City  Country  app │
│                                        │ ▢ …            time  │
└────────────────────────────────────────┴──────────────────────┘
                          344px fixed side panel
```
- Top bar 56px, white, 1px bottom border `#ededf0`.
- Side panel 344px fixed; map fills remaining width.
- Stat cards: rounded 11px, 1px `#ededf0` border, tabular-nums numerals.
- Recent list: country-code chip, city + country, app pill, time-ago; rows hover `#f7f7f8`.
- Live dot uses a subtle pulse animation in the emerald accent.

> A finished HTML/CSS reference of this exact look exists as `Pulse Dashboard.dc.html` — replicate its visual styling (colors, spacing, type, components). Wire it to live Firestore data instead of the mock arrays.

### Login (`login.html`)
- Centered card, `pulse` wordmark, "Admin access" heading, email + password fields, dark "Sign in" button (emerald accent on the live dot).
- On submit: `signInWithEmailAndPassword`. On success → `index.html`. On failure → inline error. Same minimal styling as the dashboard.

---

## 7. Module C — Firestore security rules (`firestore.rules`)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /visits/{visitId} {
      allow create: if request.auth != null
                    && request.resource.data.uid == request.auth.uid
                    && request.resource.data.timestamp == request.time;
      allow read:   if request.auth != null
                    && request.auth.token.email == 'mars@kanaksan.com';
      allow update, delete: if false;
    }
  }
}
```
- Replace `mars@kanaksan.com` with the real admin email in **one** place and keep it consistent with `ADMIN_EMAIL` in `dashboard.js`.
- Validate `lat`/`lng` are `number` **or** `null`; `app` is a string with a sane length cap.

---

## 8. Cost-control checklist (treat as acceptance criteria)

- [ ] `localStorage` dedup runs **before** Firebase init in `tracker.js` (no SDK load on repeat visits).
- [ ] ≤ 1 Firestore write per visitor per app per day.
- [ ] No paid Geocoding API call at capture time (browser geolocation only).
- [ ] Maps JS loads **only** on the auth-gated dashboard, `loading=async`.
- [ ] Every dashboard query uses `limit(500)`.
- [ ] Native Firestore TTL handles deletion (Cloud Function cleanup is optional belt-and-suspenders).
- [ ] `tracker.js` served with `Cache-Control: public, max-age=3600`.

---

## 9. Module D — `firebase.json`

```json
{
  "hosting": {
    "public": "public",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }],
    "headers": [
      { "source": "/tracker.js",
        "headers": [
          { "key": "Access-Control-Allow-Origin", "value": "*.kanaksan.com" },
          { "key": "Cache-Control", "value": "public, max-age=3600" }
        ] }
    ]
  },
  "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
  "functions": { "source": "functions" }
}
```

## 10. Module E — optional cleanup (`functions/index.js`)
Scheduled weekly; deletes `visits` older than 60 days as a safety net only. Native TTL is primary. Keep it small and idempotent (batched deletes, `limit` per run).

---

## 11. Secrets & config

- **Firebase web config:** hardcode in `tracker.js` and the dashboard — it is public by design, protected by Rules. Do **not** treat it as a secret.
- **Google Maps API key:** restrict in Google Cloud Console to HTTP referrer `pulse.kanaksan.com/*` and to the **Maps JavaScript API only**. Reference it only on the dashboard.

---

## 12. Out of scope — do not build
- No server-side rendering, no page-view event tracking (unique daily visit only), no heatmaps, no third-party analytics SDKs (no GTM/Mixpanel), no mobile app.

---

## 13. Build & verify order

1. Scaffold the repo structure and `firebase.json` / `.firebaserc` / `firestore.rules` / `firestore.indexes.json`.
2. Implement `tracker.js` (dedup → anon auth → geolocation → write).
3. Implement `login.html` + auth.
4. Implement `index.html` + `dashboard.js` + `app.css` (map, stats, filters, recent list) to the design spec.
5. Write the optional cleanup function.
6. Provide a `README.md` documenting: create Firebase project → enable Firestore + Anonymous + Email/Password Auth + Hosting → enable TTL on `ttl` → deploy rules/indexes → `firebase deploy` → add custom domain `pulse.kanaksan.com` → add the embed `<script>` to `vote.`/`learn.`/`author.`.

### Acceptance test (describe in README)
Visit a tracked app → confirm exactly one `visits` doc is written (and none on a same-day re-visit) → log in as admin → confirm the pin appears clustered on the map and the visit shows in Recent Visitors and the totals.

---

## 14. Deliverables checklist
- [ ] `https://pulse.kanaksan.com/tracker.js` — public, CORS-enabled, cached
- [ ] `https://pulse.kanaksan.com/login.html` — admin login
- [ ] `https://pulse.kanaksan.com/` — dashboard with live clustered map
- [ ] `visits` collection receiving docs from embeds
- [ ] Security rules deployed and tested (admin-only read, owner-only create, no update/delete)
- [ ] TTL policy enabled
- [ ] `vote.kanaksan.com` embed added and verified

**Output:** the complete file tree with every file fully written, plus the `README.md`. Use clear comments where a constant must be edited (admin email, Firebase config, Maps key).
