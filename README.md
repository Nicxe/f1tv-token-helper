# F1TV Token Helper

F1TV Token Helper is a small Chrome or Chromium Manifest V3 extension for manually extracting your own F1TV live timing authorization value from your current browser session.

It does not sign in for you, does not store your token permanently, does not send your token to a project server, and does not write anything directly to Home Assistant.

## What It Exports

The Home Assistant paste value is:

```text
Bearer <JWT>
```

The TXT export contains exactly one line:

```text
Authorization: Bearer <JWT>
```

Use the copied `Bearer <JWT>` value in the F1 Sensor live timing authorization field. Do not paste the `Authorization:` prefix into that field.

## First-Time Setup

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
6. Enable Developer mode.
7. Click Load unpacked and select the `dist/` folder in this repository.

After that, the helper is installed in the browser and ready to use.

## First Use

1. Open the official Formula 1 account sign-in page from the extension popup, or sign in manually in the browser first.
2. Open the F1TV Token Helper popup.
3. Click `Fetch`.
4. If a token is found, the popup will show the token status and expiry.
5. Click `Copy HA value` to copy `Bearer <JWT>` for Home Assistant.
6. Paste that value into the F1 Sensor authorization field.
7. If you want the full header as a file, click `Download TXT`.

If the popup does not find a token, sign in to Formula 1 again in the browser and click `Fetch` again.

## When You Need a New Token

The F1TV subscription token is short-lived. When it expires or is no longer usable, the helper does not update Home Assistant automatically.

Use the same flow as the first use:

1. Make sure you are signed in to Formula 1 in the browser.
2. Open the helper popup.
3. Click `Fetch` again.
4. If a new token is available, click `Copy HA value`.
5. Replace the old value in F1 Sensor with the new copied value.

If the popup shows that the token is expired or near expiry, sign in again before fetching a fresh token.

## Daily Use

For normal reuse, you usually only need to do this:

1. Open the helper popup.
2. Click `Fetch`.
3. Click `Copy HA value`.
4. Paste the copied value into F1 Sensor if the token has changed.

You only need to rebuild and reload the extension if you change the code in this repository. You do not need to reinstall it every time you need a new token.

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

The extension reads the `login-session` cookie from allowlisted Formula 1 domains and extracts `data.subscriptionToken` locally. Tokens are kept only in popup memory and are cleared when the popup closes or when you select `Clear`.

The extension does not collect telemetry, does not contact a project backend, does not automate bot protection, and does not handle F1TV usernames or passwords.
