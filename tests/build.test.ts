import { readFile, readdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_FIREFOX_EXTENSION_ID,
  FIREFOX_MIN_VERSION,
  toFirefoxManifest,
} from "../scripts/firefox-manifest.mjs";

const root = new URL("../", import.meta.url);

async function readSourceManifest(): Promise<Record<string, unknown>> {
  return JSON.parse(
    await readFile(new URL("src/manifest.json", root), "utf8"),
  ) as Record<string, unknown>;
}

describe("Firefox manifest", () => {
  it("adds Gecko settings without touching the Chrome manifest", async () => {
    const chromeManifest = await readSourceManifest();
    const before = structuredClone(chromeManifest);

    const manifest = toFirefoxManifest(chromeManifest);

    expect(chromeManifest).toEqual(before);
    expect(chromeManifest).not.toHaveProperty("browser_specific_settings");
    expect(manifest).toEqual({
      ...chromeManifest,
      browser_specific_settings: {
        gecko: {
          id: DEFAULT_FIREFOX_EXTENSION_ID,
          strict_min_version: FIREFOX_MIN_VERSION,
          data_collection_permissions: { required: ["authenticationInfo"] },
        },
      },
    });
  });

  it("supports ESR 128 and a custom add-on id", async () => {
    const manifest = toFirefoxManifest(await readSourceManifest(), {
      id: "helper@example.com",
    });

    expect(manifest.browser_specific_settings.gecko).toMatchObject({
      id: "helper@example.com",
      strict_min_version: "128.0",
    });
  });

  it("has no background service worker to convert", async () => {
    expect(await readSourceManifest()).not.toHaveProperty("background");
  });
});

describe("Chrome release zip", () => {
  it("includes every compiled module", async () => {
    const zipScript = await readFile(
      new URL("scripts/zip-dist.mjs", root),
      "utf8",
    );
    const modules = (await readdir(new URL("src/", root)))
      .filter((file) => file.endsWith(".ts"))
      .map((file) => file.replace(/\.ts$/, ".js"));

    for (const module of modules) {
      expect(zipScript).toContain(`"${module}"`);
    }
  });
});
