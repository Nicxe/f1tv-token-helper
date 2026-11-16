# F1TV Token Helper

F1TV Token Helper is a small Chrome, Chromium or Firefox Manifest V3 extension that sends your own F1TV live timing token to Home Assistant through a short-lived F1 Sensor pairing flow.

It does not sign in for you, does not store your token permanently, does not send your token to a project server, and does not write anything to Home Assistant unless you explicitly select `Send to Home Assistant`.

## Current Status

The extension is published as an unlisted beta in the Chrome Web Store:

```text
https://chromewebstore.google.com/detail/f1tv-token-helper-beta/bbpgdcjohdjcechlffloekhpgdbjoafh
```

The Home Assistant pairing flow requires F1 Sensor `v4.3.0-beta.3` or later.
Older beta builds may support only the manual token fallback.

## Normal Beta Flow

1. Install **F1TV Token Helper BETA** from the [Chrome Web Store](https://chromewebstore.google.com/detail/f1tv-token-helper-beta/bbpgdcjohdjcechlffloekhpgdbjoafh).
2. In Home Assistant, open F1 Sensor and select `Configure`.
3. Select `Connect F1TV access with Token Helper`.
4. When Home Assistant opens the pairing page, keep that tab active and open the extension popup.
5. Select `Sign in` if you are not already signed in to Formula 1 in this browser.
6. Return to the extension and select `Fetch`.
7. Select `Send to Home Assistant`.

Home Assistant stores only the live timing authorization value it needs.
Public live timing continues to work without F1TV access and if the token later expires.

## Developer Install

Use this only when working on the extension locally or when you need to test a build that is not published in the Chrome Web Store.

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

## Firefox

A Firefox build is produced from the same source.
It is not published on addons.mozilla.org (AMO).
It needs Firefox 128 or later, including ESR 128, and also works in Firefox-based browsers such as Zen.

### Install for testing

```bash
npm ci
npm run build:firefox
```

This lints the build with `web-ext` and writes the package to `dist-firefox/f1tv-token-helper-firefox.zip`.

1. Open `about:debugging#/runtime/this-firefox`.
2. Select `Load Temporary Add-on...`.
3. Select `dist-firefox/f1tv-token-helper-firefox.zip` (or `dist-firefox/extension/manifest.json`).

Temporary add-ons are removed when Firefox restarts.
`npm run start:firefox` opens a clean Firefox profile with the extension loaded.
For a permanent install the package must be signed. See [FIREFOX_SIGNING.md](FIREFOX_SIGNING.md).

### Site access

Firefox lets you choose which sites an extension may use.
Access to formula1.com is offered at install, but it can be switched off later under `about:addons` > F1TV Token Helper > `Permissions`.

When access is missing, the popup shows a `Firefox site access` panel listing what is needed:

- Formula 1 (formula1.com), to read your sign-in
- Your Home Assistant host, to send the token, once a pairing is active

Select `Allow access` and accept the Firefox prompt.
Firefox may close the popup while it asks.
Open it again afterwards: the pairing is kept, and the token is fetched automatically.

The Home Assistant permission covers the host on every port, for example `http://192.168.1.10/*` for `http://192.168.1.10:8123`, because Firefox does not match permission patterns that include a port.

### Pairing flow in Firefox

The flow is the same as in Chrome:

1. In Home Assistant, open F1 Sensor, select `Configure`, then `Connect F1TV access with Token Helper`.
2. Keep the pairing page as the active tab and open the extension popup.
3. If the site access panel appears, select `Allow access` and reopen the popup if it closed.
4. Select `Sign in` if needed, return to the popup, and select `Fetch`.
5. Select `Send to Home Assistant`.

If you use Firefox containers, sign in to Formula 1 in a tab of the container you want, and open the popup from a tab in that same container.
To use the extension in private windows, enable `Run in Private Windows` for it in `about:addons`.

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
Use pairing whenever F1 Sensor `v4.3.0-beta.3` or later is available.

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
npm run build:firefox
```

The build output is written to `dist/`, and the Firefox build to `dist-firefox/`.
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
