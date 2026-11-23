import { cp, mkdir } from "node:fs/promises";

import { resolveTarget } from "./targets.mjs";

const { root, extension: dist } = resolveTarget();

await mkdir(dist, { recursive: true });

for (const asset of ["manifest.json", "popup.html", "popup.css"]) {
  await cp(new URL(`src/${asset}`, root), new URL(asset, dist));
}

await cp(new URL("src/icons/", root), new URL("icons/", dist), {
  recursive: true,
});
