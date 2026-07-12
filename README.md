# pulse.kanaksan.com

Real-time visitor analytics dashboard for the kanaksan.com product family.

---

## What it does

- **Tracks visitors** across all kanaksan subdomains via a lightweight embeddable script (`tracker.js`)
- **Plots visits** on a Google Map with clustered pins on an auth-gated admin dashboard
- **Shows stats** — Total visits, Unique visitors, Today's count, ratings, issues
- **Zero backend** — Firebase Hosting + Firestore + Auth only

---

## Setup

### 1. Create Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com) → **Add project** → name it `pulse-kanaksan`.
2. Enable **Firestore Database** (production mode).
3. Enable **Authentication** → Sign-in methods → turn on **Anonymous** and **Email/Password**.
4. Enable **Hosting**.

### 2. Configure `config.js`

Copy `config_template.js` to `config.js` and fill in your Firebase web config:

```js
export const FIREBASE_CONFIG = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'pulse-kanaksan.firebaseapp.com',
  projectId: 'pulse-kanaksan',
  storageBucket: 'pulse-kanaksan.firebasestorage.app',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
}

export const REFRESH_MS = 0   // set to e.g. 60000 for auto-refresh every 60s
```

> Firebase web config is public by design — Firestore Rules are the security boundary.

### 3. Create admin user

Firebase Console → Authentication → Users → **Add user**
- Email: `mars@kanaksan.com`
- Set a strong password

This email must match `ADMIN_EMAIL` in `dashboard.js` and the email in `firestore.rules`.

### 4. Populate the `apps` collection in Firestore

The dashboard dropdown loads subdomains **dynamically from Firestore** — no code changes needed to add new apps.

In Firestore Console → **`apps` collection** → add one document per subdomain:

| Document ID | `label` | `order` | `active` |
|---|---|---|---|
| `learn.kanaksan.com` | `learn.kanaksan.com` | `1` | `true` |
| `vote.kanaksan.com` | `vote.kanaksan.com` | `2` | `true` |
| `calendar.kanaksan.com` | `calendar.kanaksan.com` | `3` | `true` |
| `author.kanaksan.com` | `author.kanaksan.com` | `4` | `true` |
| `pulse.kanaksan.com` | `pulse.kanaksan.com` | `5` | `true` |

**To add a new subdomain in future:** just add a new doc to the `apps` collection — no deploy needed.

### 5. Create Firestore composite index

The `apps` query (`where active == true, orderBy order`) requires a composite index.

Go to Firestore Console → **Indexes** → **Add index**:

| Collection | Fields | Order |
|---|---|---|
| `apps` | `active` | Ascending |
| | `order` | Ascending |

Or click the auto-generated link from the browser console error on first run — it pre-fills everything. Wait for status to show **Enabled** (~2 minutes).

### 6. Enable Firestore TTL

Firestore Console → **Data** tab → select `visits` collection → **Fields** tab →
**Configure TTL policy** → field name: `ttl` → Save.

This auto-deletes visitor documents 60 days after creation at no cost.

### 7. Install Firebase CLI & run locally

```bash
# Install Firebase CLI (one-time)
npm install -g firebase-tools

# Login and select project
firebase login
firebase use pulse-kanaksan

# Serve locally at http://localhost:5000
firebase serve --only hosting
```

### 8. Deploy to production

```bash
# Deploy everything
firebase deploy

# Or deploy individually
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only hosting
firebase deploy --only functions   # optional cleanup function
```

### 9. Add custom domain

Firebase Console → Hosting → **Add custom domain** → `pulse.kanaksan.com`.
Add the provided DNS records to your domain registrar. Wait for SSL provisioning (~24h).

### 10. Embed tracker in kanaksan subdomains

Add before `</body>` in each subdomain's HTML:

```html
<!-- learn.kanaksan.com -->
<script src="https://pulse.kanaksan.com/tracker.js" data-app="learn.kanaksan.com" defer></script>

<!-- vote.kanaksan.com -->
<script src="https://pulse.kanaksan.com/tracker.js" data-app="vote.kanaksan.com" defer></script>

<!-- calendar.kanaksan.com -->
<script src="https://pulse.kanaksan.com/tracker.js" data-app="calendar.kanaksan.com" defer></script>

<!-- author.kanaksan.com -->
<script src="https://pulse.kanaksan.com/tracker.js" data-app="author.kanaksan.com" defer></script>

<!-- pulse.kanaksan.com -->
<script src="https://pulse.kanaksan.com/tracker.js" data-app="pulse.kanaksan.com" defer></script>
```

---

## User preferences (localStorage)

The dashboard persists two preferences in `localStorage` automatically:

| Key | Default | Description |
|---|---|---|
| `pulse_selected_project` | first app in list | Last selected app in the dropdown |
| `pulse_theme` | `dark` | UI theme — `dark` or `light` |

No configuration needed — these are saved and restored automatically on every visit.

---

## Acceptance test

1. Open any tracked subdomain in a browser → allow location → check Firestore Console: one `visits` doc should appear under the `visits` collection.
2. Reload the same page the same day → confirm **no second doc** is written (check `localStorage` key `pulse_visited_{app}_{YYYY-MM-DD}`).
3. Open `https://pulse.kanaksan.com/` → log in as `mars@kanaksan.com` → confirm:
   - The apps dropdown is populated from Firestore
   - Stats, top pages, ratings and issues load for the selected app
   - Switching apps updates all data
   - Selected app is remembered on page refresh
   - Dark/light mode toggle works and is remembered on refresh

---

## Architecture

- **Zero backend** — Firebase Hosting + Firestore + Auth only, no server
- **Dynamic app list** — subdomains managed in Firestore `apps` collection, not in code
- **Cost controls** — localStorage dedup prevents repeat tracker writes; `limit(500)` on dashboard queries; TTL handles deletion natively
- **User preferences** — last selected app and dark/light theme persisted in `localStorage`
- **Security** — Firestore rules enforce admin-only reads on sensitive collections; anonymous users can only write their own visit docs

---

## Firestore collections

| Collection | Purpose |
|---|---|
| `apps` | Dynamic list of subdomains shown in the dashboard dropdown |
| `visits` | One doc per visitor per app per day (written by `tracker.js`) |
| `projects/{id}/stats` | Aggregated visit stats per project |
| `projects/{id}/pages` | Per-page visit counts |
| `projects/{id}/ratings` | User understanding ratings |
| `projects/{id}/issues` | User-reported issues |
| `visitors` | Fingerprint-based visitor dedup records |

---

## File structure

```
public/
  index.html        — Auth-gated admin dashboard
  login.html        — Admin login (Google Auth)
  dashboard.js      — Dropdown, stats, filters, theme toggle, localStorage
  data.js           — Firestore fetch helpers incl. fetchApps()
  render.js         — DOM rendering for metrics, pages, ratings, issues
  app.css           — Shared styles with CSS custom properties for dark/light mode
  tracker.js        — Embeddable 1-visit-per-day tracker
  config.js         — Firebase config + REFRESH_MS (gitignored)
  config_template.js — Safe-to-commit config template
functions/
  index.js          — Optional weekly cleanup (belt-and-suspenders TTL)
  package.json
firestore.rules
firestore.indexes.json
firebase.json
.firebaserc
README.md
```