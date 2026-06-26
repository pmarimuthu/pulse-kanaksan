# Milestone 01 — Project Foundation

**Date:** 2026-06-25
**Status:** ✅ Complete

---

## What was built

Complete repo scaffold for `pulse.kanaksan.com` — a zero-backend, Firebase-native real-time visitor analytics dashboard.

---

## File tree

```
pulse.kanaksan.com/
├── .firebaserc                   Firebase project alias (pulse-kanaksan)
├── firebase.json                 Hosting, Firestore, Functions config
├── firestore.rules               Security rules — anon create, admin read only
├── firestore.indexes.json        Composite index: app ASC + timestamp DESC
├── README.md                     Full setup, deploy, and embed guide
├── functions/
│   ├── index.js                  Weekly cleanup Cloud Function (optional)
│   └── package.json              firebase-admin + firebase-functions v5
└── public/
    ├── index.html                Auth-gated admin dashboard shell
    ├── login.html                Admin login page
    ├── dashboard.js              Map, stats, filters, recent visitors logic
    ├── app.css                   Shared styles — Geist font, emerald accent
    └── tracker.js                Embeddable 1-visit-per-day tracker script
```

---

## Key design decisions

| Decision | Choice | Reason |
|---|---|---|
| Auth for visitors | Firebase Anonymous Auth | Zero friction; UID ties visits to one user without PII |
| Dedup strategy | `localStorage` key checked before Firebase init | Prevents SDK load and Firestore write on repeat visits — primary cost control |
| Geolocation | Browser `navigator.geolocation` only | Free; no paid Geocoding API at capture time |
| Map clustering | `@googlemaps/markerclusterer` via CDN | No bundler; loads only on auth-gated dashboard |
| Data retention | Native Firestore TTL on `ttl` field (60 days) | Free deletion; no Cloud Function needed as primary mechanism |
| Backend | None | Firebase Hosting + Firestore + Auth only |

---

## Firestore data model

Collection: `visits/{auto-id}`

| Field | Type | Notes |
|---|---|---|
| `uid` | string | Anonymous Firebase UID |
| `app` | string | Source app — `vote`, `learn`, `author`, etc. |
| `lat` / `lng` | number \| null | Null if geolocation denied |
| `city` / `country` | string \| null | Best-effort, not populated at capture |
| `userAgent` | string | `navigator.userAgent` |
| `referrer` | string | `document.referrer` |
| `timestamp` | Timestamp | `serverTimestamp()` |
| `ttl` | Timestamp | `timestamp + 60 days` |

---

## Security rules summary

- `create` — allowed if `request.auth != null`, `uid == request.auth.uid`, `timestamp == request.time`, lat/lng are number or null, app is string ≤ 64 chars
- `read` — allowed only if `request.auth.token.email == 'mars@kanaksan.com'`
- `update` / `delete` — always denied

---

## Placeholders requiring replacement

These must be filled before `firebase deploy`:

| Placeholder | File(s) |
|---|---|
| `REPLACE_WITH_FIREBASE_API_KEY` | `tracker.js`, `login.html`, `dashboard.js` |
| `REPLACE_WITH_SENDER_ID` | `tracker.js`, `login.html`, `dashboard.js` |
| `REPLACE_WITH_APP_ID` | `tracker.js`, `login.html`, `dashboard.js` |
| `REPLACE_WITH_GOOGLE_MAPS_API_KEY` | `dashboard.js` |

---

## What's next

- [ ] Milestone 02 — Firebase project provisioning (Console setup, config, admin user)
- [ ] Milestone 03 — Config wired + local verification
- [ ] Milestone 04 — Deploy to Firebase Hosting + custom domain
- [ ] Milestone 05 — Embed tracker in subdomains + end-to-end acceptance test
