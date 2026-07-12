# pulse — Integration Guide

This guide is for developers adding visitor tracking to a `kanaksan.com` subdomain.
You do not need access to Firebase, Firestore, or the dashboard to integrate.

---

## What it does

`tracker.js` silently records **one visit per visitor per app per day** into the pulse analytics dashboard at `https://pulse.kanaksan.com`.

It captures:
- Geographic location (lat/lng) — if the visitor grants browser permission
- Browser user agent
- Referrer URL
- Timestamp

It does **not** capture:
- Page views or navigation events
- Clicks, scroll depth, or session duration
- Any personally identifiable information (PII)
- Anything if the visitor has already been tracked today

---

## Integration — one line

Add this `<script>` tag before `</body>` in your HTML:

```html
<script src="https://pulse.kanaksan.com/tracker.js" data-app="YOUR_APP_ID" defer></script>
```

Replace `YOUR_APP_ID` with your subdomain's full ID (see table below).

---

## App IDs

Use the exact value matching your subdomain:

| Subdomain | `data-app` value |
|---|---|
| `learn.kanaksan.com` | `learn.kanaksan.com` |
| `vote.kanaksan.com` | `vote.kanaksan.com` |
| `calendar.kanaksan.com` | `calendar.kanaksan.com` |
| `author.kanaksan.com` | `author.kanaksan.com` |
| `pulse.kanaksan.com` | `pulse.kanaksan.com` |

> If your subdomain is not listed, ask the pulse admin to add it to Firestore. No code change or deploy is needed on the pulse side.

---

## Examples per subdomain

```html
<!-- learn.kanaksan.com — add before </body> -->
<script src="https://pulse.kanaksan.com/tracker.js" data-app="learn.kanaksan.com" defer></script>

<!-- vote.kanaksan.com — add before </body> -->
<script src="https://pulse.kanaksan.com/tracker.js" data-app="vote.kanaksan.com" defer></script>

<!-- calendar.kanaksan.com — add before </body> -->
<script src="https://pulse.kanaksan.com/tracker.js" data-app="calendar.kanaksan.com" defer></script>

<!-- author.kanaksan.com — add before </body> -->
<script src="https://pulse.kanaksan.com/tracker.js" data-app="author.kanaksan.com" defer></script>
```

---

## How it works (briefly)

1. On page load, checks `localStorage` for a dedup key (`pulse_visited_{app}_{YYYY-MM-DD}`)
2. If the key exists → **stops immediately**, no network call, no Firebase load
3. If not seen today → loads Firebase SDK, signs in anonymously, requests geolocation
4. Writes one `visits` document to Firestore
5. Sets the dedup key in `localStorage` — visitor will not be tracked again today

The script runs **after** `DOMContentLoaded` and never blocks page render.

---

## Geolocation prompt

The tracker calls `navigator.geolocation.getCurrentPosition()`. This triggers the browser's native location permission prompt.

| Visitor action | Result |
|---|---|
| Allows location | Visit recorded with `lat` / `lng` |
| Denies location | Visit still recorded with `lat: null`, `lng: null` |
| Ignores / times out (8s) | Visit still recorded with `lat: null`, `lng: null` |

The visit is **always recorded** regardless of location permission. Denying location does not suppress tracking.

---

## Verifying the integration

### Option A — Browser DevTools
1. Open your subdomain in a browser
2. Open DevTools → **Application** tab → **Local Storage**
3. Look for a key like `pulse_visited_learn.kanaksan.com_2026-07-12`
4. If it exists with value `1` — the tracker fired successfully

### Option B — Firestore Console
1. Go to [Firestore Console](https://console.firebase.google.com/project/pulse-kanaksan/firestore)
2. Open the `visits` collection
3. Look for a recent document with `app: "your.subdomain.com"`

### Option C — pulse dashboard
1. Open `https://pulse.kanaksan.com`
2. Select your app from the dropdown
3. Your visit should appear in the stats

---

## Testing dedup behaviour

To force the tracker to fire again on the same day (e.g. during testing):

1. Open DevTools → **Application** → **Local Storage**
2. Delete the key `pulse_visited_{app}_{YYYY-MM-DD}`
3. Reload the page — the tracker will fire again

---

## What not to do

| ❌ Don't | ✅ Do instead |
|---|---|
| Use a generic `data-app="app"` | Use the full subdomain: `data-app="learn.kanaksan.com"` |
| Add the script in `<head>` without `defer` | Always use `defer` or place before `</body>` |
| Add multiple script tags on the same page | One tag per page is enough |
| Modify `tracker.js` locally | The script is served from `pulse.kanaksan.com` — no local copy needed |
| Worry about errors | The tracker fails silently — it will never throw into your app |

---

## Performance impact

- **Zero impact on repeat visits** — the dedup check runs before any network call or SDK load
- **First visit only** — Firebase SDK (~50 KB) loads asynchronously after page is interactive
- **Cached** — `tracker.js` is served with `Cache-Control: public, max-age=3600` (1 hour browser cache)
- **Non-blocking** — runs after `DOMContentLoaded`, never delays page render or other scripts

---

## Privacy notes

- No cookies are used — dedup is via `localStorage` only
- No PII is collected — only anonymous Firebase UID, user agent, referrer, and optional location
- Location is browser-native — no paid geocoding API is called
- Visit records are automatically deleted after **60 days** via Firestore TTL policy
- Anonymous Firebase Auth is used — no login required from the visitor

---

## Support

For issues or to add a new subdomain to the dashboard dropdown, contact the pulse admin (`mars@kanaksan.com`) or add a document directly to the `apps` collection in Firestore.