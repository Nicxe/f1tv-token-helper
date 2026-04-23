import { cp, mkdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);

await mkdir(dist, { recursive: true });

for (const asset of ["manifest.json", "popup.html", "popup.css"]) {
  await cp(new URL(`src/${asset}`, root), new URL(asset, dist));
}
