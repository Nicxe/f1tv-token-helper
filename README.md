# F1TV Token Helper

F1TV Token Helper is a small Chrome or Chromium Manifest V3 extension that sends your own F1TV live timing token to Home Assistant through a short-lived F1 Sensor pairing flow.

It does not sign in for you, does not store your token permanently, does not send your token to a project server, and does not write anything to Home Assistant unless you explicitly select `Send to Home Assistant`.

## Current Status

The extension has been submitted to the Chrome Web Store as an unlisted beta and is waiting for review.
Until that review is approved, testers must use the developer install flow below.

The Home Assistant pairing flow requires F1 Sensor `v4.3.0-beta.2` or later.
Older beta builds support only the manual token fallback.

## Normal Beta Flow

Use this flow after the Chrome Web Store unlisted beta is approved.

1. Install **F1TV Token Helper BETA** from the Chrome Web Store link.
2. In Home Assistant, open F1 Sensor and select `Configure`.
3. Select `Connect F1TV access with Token Helper`.
4. When Home Assistant opens the pairing page, keep that tab active and open the extension popup.
5. Select `Sign in` if you are not already signed in to Formula 1 in this browser.
6. Return to the extension and select `Fetch`.
7. Select `Send to Home Assistant`.

Home Assistant stores only the live timing authorization value it needs.
Public live timing continues to work without F1TV access and if the token later expires.

## Developer Install

Use this while the Chrome Web Store unlisted beta is under review, or when working on the extension locally.

1. Install Node.js 22 or newer.
2. Clone or unpack this repository locally.
3. Install dependencies:

```bash
npm ci
```

4. Build the extension:

```bash
npm run build
```

5. Open Chrome and go to `chrome://extensions`.
6. Click `Load unpacked`.
7. Select the local `dist/` folder in this repository.

After loading or reloading the unpacked extension, use the same Home Assistant pairing flow described above.

## Pairing Details

Home Assistant opens a short-lived pairing page when you start `Connect F1TV access with Token Helper`.
The extension reads the pairing link from the active browser tab.

If pairing is not detected automatically:

1. Copy the full pairing page URL from the browser address bar.
2. Open `Pairing link` in the extension.
3. Paste the URL.
4. Select `Connect`.

The extension keeps only the Home Assistant pairing data in Chrome session storage while you sign in to Formula 1.
The F1TV token itself is kept only in popup memory and is cleared after success, clear, or popup close.

## Advanced Manual Export

Manual export is a fallback for development and troubleshooting.
Use pairing whenever F1 Sensor `v4.3.0-beta.2` or later is available.

The Home Assistant paste value is:

```text
Bearer <JWT>
```

The TXT export contains exactly one line:

```text
Authorization: Bearer <JWT>
```

Use the copied `Bearer <JWT>` value in the F1 Sensor live timing authorization field.
Do not paste the `Authorization:` prefix into that field.

## Validation

Run the local checks from the repository root:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The build output is written to `dist/`.
The release zip is written to:

```text
dist/f1tv-token-helper.zip
```

## Privacy and Security

The extension reads the `login-session` cookie from allowlisted Formula 1 domains and extracts `data.subscriptionToken` locally.
Tokens are kept only in popup memory and are cleared when the popup closes, after a successful send, or when you select `Clear`.

The extension requests access to your Home Assistant URL only when you send a token to a pairing callback.
It does not collect telemetry, does not contact a project backend, does not automate bot protection, and does not handle F1TV usernames or passwords.

Privacy policy:

```text
https://nicxe.github.io/f1_sensor/help/f1tv-token-helper-privacy
```
