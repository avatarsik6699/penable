import path from "node:path";

/** Only authored index.ts files establish recursive module boundaries. */
export function moduleRoots(files) {
  return Object.keys(files)
    .filter((file) => file.startsWith("src/") && file.endsWith("/index.ts"))
    .map((file) => path.posix.dirname(file))
    .sort((left, right) => right.length - left.length);
}

const contains = (root, file) => file.startsWith(`${root}/`);

export function checkModuleImport(file, target, node, roots, report) {
  for (const root of roots) {
    if (!contains(root, target)) continue;

    const barrel = `${root}/index.ts`;

    if (contains(root, file)) {
      if (target === barrel) {
        const ownRoot = roots.find((candidate) => contains(candidate, file));

        report(
          file,
          node,
          ownRoot === root ? "own-barrel" : "ancestor-barrel",
          "Module internals cannot import their own or an ancestor index.ts barrel.",
        );
      }
    } else if (target !== barrel)
      report(
        file,
        node,
        "child-private",
        `Consumers outside ${root} must use its public index.ts.`,
      );
  }
}

export const isLegacyUi = (file) =>
  file.includes("/ui/") && !file.startsWith("src/shared/ui/");

export const isUiExecution = (file) =>
  file.endsWith(".tsx") || /\/(?:components|hooks|native|ui)\//.test(file);

export function isComponentLocation(file, files) {
  if (file === "src/main.tsx" || file.startsWith("src/app/")) return true;

  const directory = path.posix.dirname(file);
  const parts = directory.split("/");

  const outerComponent =
    (["features", "widgets"].includes(parts[1]) && parts.length === 3) ||
    (parts[1] === "shared" && parts[2] === "ui" && parts.length === 4);

  const childComponent = parts.at(-2) === "components";

  return (
    (outerComponent || childComponent) &&
    path.posix.basename(file, ".tsx") === path.posix.basename(directory) &&
    Object.hasOwn(files, `${directory}/index.ts`)
  );
}

export const hookFilename = (name) =>
  name
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
