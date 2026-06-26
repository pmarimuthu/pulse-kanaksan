# pulse.kanaksan.com

Real-time visitor analytics dashboard for the kanaksan.com product family.

---

## Setup

### 1. Create Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com) → **Add project** → name it `pulse-kanaksan`.
2. Enable **Firestore Database** (production mode).
3. Enable **Authentication** → Sign-in methods → turn on **Anonymous** and **Email/Password**.
4. Enable **Hosting**.

### 2. Get Firebase web config

In Firebase Console → Project Settings → Your apps → Web app → copy the config object.

Replace `REPLACE_WITH_FIREBASE_API_KEY`, `REPLACE_WITH_SENDER_ID`, and `REPLACE_WITH_APP_ID` in:
- `public/tracker.js`
- `public/login.html`
- `public/dashboard.js`

### 3. Create admin user

Firebase Console → Authentication → Users → **Add user**
- Email: `mars@kanaksan.com`
- Set a strong password

This email must match `ADMIN_EMAIL` in `dashboard.js` and the email in `firestore.rules`.

### 4. Get Google Maps API key

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → **Create credentials → API key**.
2. Restrict to: HTTP referrers → `pulse.kanaksan.com/*`; API restriction → **Maps JavaScript API** only.
3. Replace `REPLACE_WITH_GOOGLE_MAPS_API_KEY` in `public/dashboard.js`.

### 5. Enable Firestore TTL

Firestore Console → **Data** tab → select `visits` collection → **Fields** tab →
**Configure TTL policy** → field name: `ttl` → Save.

This auto-deletes documents 60 days after creation at no cost.

### 6. Install Firebase CLI & deploy

```bash
npm install -g firebase-tools
firebase login
firebase use pulse-kanaksan
firebase deploy
```

Or deploy individually:

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only hosting
firebase deploy --only functions   # optional cleanup function
```

### 7. Add custom domain

Firebase Console → Hosting → **Add custom domain** → `pulse.kanaksan.com`.
Add the provided DNS records to your domain registrar. Wait for SSL provisioning (~24h).

### 8. Embed tracker in kanaksan subdomains

Add before `</body>` in each subdomain:

```html
<!-- vote.kanaksan.com -->
<script src="https://pulse.kanaksan.com/tracker.js" data-app="vote" defer></script>

<!-- learn.kanaksan.com -->
<script src="https://pulse.kanaksan.com/tracker.js" data-app="learn" defer></script>

<!-- author.kanaksan.com -->
<script src="https://pulse.kanaksan.com/tracker.js" data-app="author" defer></script>
```

---

## Acceptance test

1. Open `vote.kanaksan.com` in a browser → allow location → check Firestore Console: one `visits` doc should appear.
2. Reload the same page the same day → confirm **no second doc** is written (check `localStorage` key `pulse_visited_vote_YYYY-MM-DD`).
3. Open `https://pulse.kanaksan.com/` → log in as `mars@kanaksan.com` → the map pin should appear clustered and the visit should appear in **Recent Visitors** with the stat counters updated.

---

## Architecture

- **Zero backend.** Firebase Hosting + Firestore + Auth only.
- **Cost controls:** localStorage dedup prevents repeat writes; `limit(500)` on every query; Maps JS loads only on the dashboard; TTL handles deletion natively.
- **Security:** Firestore rules allow anonymous users to `create` only their own docs; only the admin email can `read`.

---

## File structure

```
public/
  index.html      — Auth-gated admin dashboard
  login.html      — Admin login
  dashboard.js    — Map, stats, filters, recent list logic
  app.css         — Shared styles (Geist font, design tokens)
  tracker.js      — Embeddable 1-visit-per-day tracker
functions/
  index.js        — Optional weekly cleanup (belt-and-suspenders)
  package.json
firestore.rules
firestore.indexes.json
firebase.json
.firebaserc
```
