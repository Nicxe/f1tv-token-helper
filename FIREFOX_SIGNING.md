# Firefox Signing (Unlisted on AMO)

Release Firefox only installs signed add-ons permanently.
An **unlisted** add-on is signed by Mozilla but not shown on addons.mozilla.org (AMO); you distribute the signed `.xpi` yourself.

Nothing in this repository uploads to AMO automatically.

## 1. Choose the add-on ID

The Firefox build sets `browser_specific_settings.gecko.id` to `f1tv-token-helper@wannesmarynen.github.io` by default.
An ID belongs to the AMO account that first signs it, so whoever signs should use an ID they own:

```bash
FIREFOX_EXTENSION_ID="f1tv-token-helper@your-domain.example" npm run build:firefox
```

Keep the same ID for every later version, or Firefox treats it as a different add-on.

## 2. Bump the version

AMO rejects a version it has already signed.
Raise `version` in `src/manifest.json` before each upload.

## 3. Build and lint

```bash
npm ci
npm test
npm run build:firefox
```

`web-ext lint` is expected to report 0 errors and 2 warnings.
Both warnings say `data_collection_permissions` needs Firefox 140 (Android 142).
Older Firefox versions ignore the key; AMO requires new add-ons to declare it.
The build declares `authenticationInfo` because the F1TV token is sent to the user's own Home Assistant.

## 4. Prepare the source archive

The extension is compiled from TypeScript, so AMO can ask for the source code and build steps.

```bash
git archive --format=zip -o dist-firefox/source.zip HEAD
```

Build instructions for the reviewer: Node.js 22 or later, `npm ci`, then `npm run build:firefox`. The output is in `dist-firefox/extension/`.

## 5a. Sign in the AMO web UI

1. Sign in at <https://addons.mozilla.org/developers/> (two-factor authentication is required).
2. Select `Submit a New Add-on`, then `On your own` (unlisted).
3. Upload `dist-firefox/f1tv-token-helper-firefox.zip`.
4. Answer that the code is compiled, upload `dist-firefox/source.zip`, and paste the build instructions.
5. Reuse the reviewer notes and permission justifications in [STORE_SUBMISSION.md](STORE_SUBMISSION.md).
6. Download the signed `.xpi` when signing finishes.

## 5b. Sign with web-ext

Create API credentials at <https://addons.mozilla.org/developers/addon/api/key/>.
Keep them out of the repository and out of shell history files.

```bash
npx web-ext sign \
  --channel=unlisted \
  --source-dir dist-firefox/extension \
  --upload-source-code dist-firefox/source.zip \
  --api-key "$AMO_JWT_ISSUER" \
  --api-secret "$AMO_JWT_SECRET"
```

The signed `.xpi` is written to `web-ext-artifacts/`.

## 6. Install the signed add-on

Open `about:addons`, select the gear menu, then `Install Add-on From File...`, and choose the signed `.xpi`.
Unlisted add-ons do not update automatically unless the manifest has an `update_url`; install each new signed version the same way.
