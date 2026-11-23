import { rm } from "node:fs/promises";

import { resolveTarget } from "./targets.mjs";

await rm(resolveTarget().clean, { force: true, recursive: true });
