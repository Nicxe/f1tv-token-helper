import process from "node:process";

const root = new URL("../", import.meta.url);

const targets = {
  chrome: { clean: "dist/", extension: "dist/" },
  firefox: { clean: "dist-firefox/", extension: "dist-firefox/extension/" },
};

export function resolveTarget(name = process.argv[2] ?? "chrome") {
  const target = targets[name];
  if (!target) {
    throw new Error(`Unknown build target: ${name}`);
  }
  return {
    name,
    root,
    clean: new URL(target.clean, root),
    extension: new URL(target.extension, root),
  };
}
