import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { resolveTarget } from "./targets.mjs";

export const DEFAULT_FIREFOX_EXTENSION_ID = "f1tv-token-helper@nicxe.github.io";
export const FIREFOX_MIN_VERSION = "140.0";

export function toFirefoxManifest(
  chromeManifest,
  { id = DEFAULT_FIREFOX_EXTENSION_ID } = {},
) {
  return {
    ...chromeManifest,
    // Private windows stay off; users cannot enable them in about:addons.
    incognito: "not_allowed",
    // Firefox's default MV3 policy adds upgrade-insecure-requests, which turns
    // a local http://host:8123 callback into https:// and breaks LAN pairing.
    // pairing.ts only accepts plain HTTP for local hosts.
    content_security_policy: {
      extension_pages: "script-src 'self';",
    },
    browser_specific_settings: {
      gecko: {
        id,
        strict_min_version: FIREFOX_MIN_VERSION,
        // The token is sent to the user's own Home Assistant, on request.
        data_collection_permissions: {
          required: ["authenticationInfo"],
        },
      },
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { root, extension } = resolveTarget("firefox");
  const source = JSON.parse(
    await readFile(new URL("src/manifest.json", root), "utf8"),
  );
  const manifest = toFirefoxManifest(source, {
    id: process.env.FIREFOX_EXTENSION_ID || undefined,
  });
  await writeFile(
    new URL("manifest.json", extension),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}
