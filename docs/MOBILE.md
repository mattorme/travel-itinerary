# iOS and Android, from one codebase

## The short version

The apps are a **Capacitor** shell around the deployed web app. `capacitor.config.ts`
points `server.url` at production, so the native app loads the same site you
already have.

That means:

- **One repo, one UI, one deploy.** `git push` updates the website, the iOS app
  and the Android app at the same moment.
- **No App Store review for changes.** Copy, pricing, a new page, a redesign —
  all ship instantly. Only changes to the *shell* (new plugins, permissions,
  icons, app name) need a store submission, which is rare.
- **No second codebase.** Not React Native, not a rewrite. The `components/`
  directory is the app.

## Why not React Native / Expo

Expo gives a better native feel, but React Native does not render HTML: every
screen would be rebuilt in `<View>`/`<Text>` primitives. That is a second UI
codebase, which is precisely what you asked to avoid — and every change would
then need doing twice and shipping through review.

Capacitor is the right trade for this product because the app is
content-first: an itinerary is a document, and a document renders perfectly in a
webview.

## The catch, stated plainly

**Apple rejects apps that are "simply a repackaged website"** — App Store Review
Guideline 4.2, Minimum Functionality. This is a real and common rejection, and a
naked webview will get caught.

So the shell has to earn its place. It does four things a browser cannot:

| Capability | Why it matters here |
|---|---|
| **Offline itineraries** | The strongest one. A traveller in a foreign city with roaming off still has their whole plan, including addresses and map links. |
| **Native share sheet** | Sharing is the growth loop; in the app it uses the real OS sheet. |
| **Universal / app links** | A shared `/t/<slug>` opens the app on the right page instead of bouncing to Safari. |
| **Haptics, status bar, safe areas, splash** | The difference between "an app" and "a website in a box". |

Push notifications are wired but not yet sending — see *Not done yet*.

Submit with the offline feature working and demonstrable. If review pushes back,
the answer is the offline itinerary: it is genuinely impossible in mobile Safari
at parity, and it is the reason a traveller installs this.

Google Play is considerably more permissive, but the same native layer satisfies
its webview policy too.

## How offline works

This is the only non-obvious part of the architecture, and it is worth
understanding before changing it.

The app loads the live site from `server.url`. The offline fallback page is
**bundled with the app** (`mobile/public/index.html`) and served from a
different origin. So the two sides **cannot share web storage** — localStorage
and IndexedDB are per-origin, and they are not the same origin.

Trips are therefore stored through **Capacitor Preferences**, which goes across
the native bridge and is visible to both:

```
live site  ──save──▶  Preferences (native)  ◀──read──  bundled offline page
```

When the device cannot reach the server, Capacitor shows `errorPath`, and that
page renders whatever the traveller saved. It is dependency-free on purpose: no
framework, no fonts, no network — a page that needed a request would defeat the
point.

The snapshot format (`lib/native/offline-format.ts`) is versioned. It is flat
and self-contained: no place references to hydrate, no cache to consult. A
snapshot from a newer build is refused rather than half-rendered.

## Setup

Everything below is one-time. You need Xcode (iOS) and Android Studio (Android),
neither of which is required to work on the web app.

```bash
npm install
npx cap add ios
npx cap add android
npx cap sync
```

Then set the production URL in `capacitor.config.ts` (or `CAP_SERVER_URL`) and:

```bash
npm run mobile:ios      # opens Xcode
npm run mobile:android  # opens Android Studio
```

### Developing against a local server

`localhost` inside the app means the phone, not your laptop:

```bash
npm run mobile:dev
```

That resolves your LAN address and syncs the shell to point at it. Your dev
server must be reachable from the phone on the same network.

### Deep links

The association files are served by the web app so they deploy with everything
else — `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`.

Set these environment variables before shipping:

| Variable | Value |
|---|---|
| `APPLE_APP_ID` | `<TEAMID>.app.wayfare.mobile` |
| `ANDROID_PACKAGE` | `app.wayfare.mobile` |
| `ANDROID_CERT_SHA256` | SHA-256 of the **Play App Signing** certificate, not your upload key |

Using the upload key fingerprint is the usual reason Android app links silently
fall back to the browser.

## What ships when

| Change | Web | iOS / Android |
|---|---|---|
| Any page, component, copy, style | instant | **instant** |
| New API route, database migration | instant | **instant** |
| New Capacitor plugin or permission | n/a | store submission |
| App icon, name, splash | n/a | store submission |

## Not done yet

- **Push notifications.** The plugin is installed and configured; there is no
  device-token table, no APNs/FCM credentials and no sending path. The natural
  first two are "your trip starts tomorrow" and "someone copied your trip".
- **Native projects are not generated.** `ios/` and `android/` do not exist in
  the repo yet — run `npx cap add ios && npx cap add android`. They were left
  out because generating them needs Xcode and Android Studio, and half-built
  platform folders are worse than none.
- **App icons and splash screens.** Generate with `@capacitor/assets` once you
  have artwork.
- **Nothing has been run on a device.** No Xcode, CocoaPods, Java or Android SDK
  was available in the environment this was built in. The web side is fully
  tested; the shell is not.
