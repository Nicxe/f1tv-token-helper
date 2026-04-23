import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const distUrl = new URL("../dist/", import.meta.url);
const zipUrl = new URL("f1tv-token-helper.zip", distUrl);

await rm(zipUrl, { force: true });

const result = spawnSync(
  "zip",
  [
    "-qr",
    "f1tv-token-helper.zip",
    "manifest.json",
    "popup.html",
    "popup.css",
    "popup.js",
    "token.js",
  ],
  {
    cwd: distUrl,
    encoding: "utf8",
  },
);

if (result.status !== 0) {
  throw new Error(result.stderr || "Failed to create extension zip");
}
