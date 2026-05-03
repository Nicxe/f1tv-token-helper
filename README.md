# F1TV Token Helper

F1TV Token Helper is a small Chrome or Chromium Manifest V3 extension that sends your own F1TV live timing token to Home Assistant through a short-lived pairing flow.

It does not sign in for you, does not store your token permanently, does not send your token to a project server, and does not write anything to Home Assistant unless you explicitly select `Send to Home Assistant`.

## Normal Use

1. Install the extension from the browser store when the beta listing is available. Until then, use the signed GitHub release zip as the advanced fallback.
2. In Home Assistant, open F1 Sensor and select `Configure`.
3. Select `Connect F1TV access with Token Helper`.
4. When Home Assistant opens the pairing page, keep that tab active and open the extension popup. The extension reads the pairing link from the active tab. If it does not, paste the full pairing link into the popup and select `Connect`.
5. Select `Sign in` if you are not already signed in to Formula 1 in this browser.
6. Select `Send to Home Assistant`.

Home Assistant stores only the live timing authorization value it needs. Public live timing continues to work without F1TV access and if the token later expires.

## Advanced Manual Export

Manual export is a fallback for development and troubleshooting.

The Home Assistant paste value is:

```text
Bearer <JWT>
```

The TXT export contains exactly one line:

```text
Authorization: Bearer <JWT>
```

Use the copied `Bearer <JWT>` value in the F1 Sensor live timing authorization field. Do not paste the `Authorization:` prefix into that field.

## Developer Install

Use this only when working on the extension locally.

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
6. Click Load unpacked.
7. Select the local `dist/` folder in this repository.

## Validation

Run the local checks from the repository root:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The build output is written to `dist/`. The release zip is written to:

```text
dist/f1tv-token-helper.zip
```

## Privacy and Security

The extension reads the `login-session` cookie from allowlisted Formula 1 domains and extracts `data.subscriptionToken` locally. Tokens are kept only in popup memory and are cleared when the popup closes, after a successful send, or when you select `Clear`.

The extension requests access to your Home Assistant URL only when you send a token to a pairing callback. It does not collect telemetry, does not contact a project backend, does not automate bot protection, and does not handle F1TV usernames or passwords.
