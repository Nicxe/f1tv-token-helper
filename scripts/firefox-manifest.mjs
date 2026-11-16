import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { resolveTarget } from "./targets.mjs";

export const DEFAULT_FIREFOX_EXTENSION_ID =
  "f1tv-token-helper@wannesmarynen.github.io";
export const FIREFOX_MIN_VERSION = "128.0";

export function toFirefoxManifest(
  chromeManifest,
  { id = DEFAULT_FIREFOX_EXTENSION_ID } = {},
) {
  return {
    ...chromeManifest,
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
