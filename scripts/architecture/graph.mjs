import ts from "typescript";
import { imports, resolveImport, visit } from "./ast.mjs";
import { isolatedLayers, isTest, layers } from "./policy.mjs";

export function owner(file) {
  const parts = file.split("/");

  if (parts[0] !== "src") return undefined;

  if (parts[1] === "app") return "src/app";

  if (parts[1] === "shared") return parts.slice(0, 4).join("/");

  if (isolatedLayers.has(parts[1])) return parts.slice(0, 3).join("/");

  return undefined;
}

export function checkGraph(context, files, root, report) {
  const graph = new Map(Object.keys(files).map((file) => [file, []]));
  const workerRoots = [];

  for (const [file, source] of context.sources) {
    visit(source, (node) => {
      if (
        !ts.isNewExpression(node) ||
        !ts.isIdentifier(node.expression) ||
        node.expression.text !== "Worker"
      )
        return;

      const symbol = context.checker.getSymbolAtLocation(node.expression);

      if (
        symbol?.declarations?.some(
          (declaration) => !declaration.getSourceFile().isDeclarationFile,
        )
      )
        return;

      const entry = node.arguments?.[0];

      if (
        !entry ||
        !ts.isNewExpression(entry) ||
        !ts.isIdentifier(entry.expression) ||
        entry.expression.text !== "URL" ||
        entry.arguments?.[1]?.getText(source) !== "import.meta.url"
      )
        report(
          file,
          node,
          "worker-entry",
          "Create module Workers from an inspectable new URL(string, import.meta.url) execution entry.",
        );
    });

    if (
      file.startsWith("src/") &&
      !owner(file) &&
      file !== "src/main.tsx" &&
      !file.endsWith(".d.ts")
    ) {
      report(
        file,
        source,
        "layer",
        "Production source must belong to a declared frontend layer.",
      );
    }

    for (const entry of imports(source)) {
      if (entry.kind === "worker") {
        const symbol = context.checker.getSymbolAtLocation(
          entry.node.expression,
        );

        if (
          symbol?.declarations?.some(
            (declaration) => !declaration.getSourceFile().isDeclarationFile,
          )
        )
          continue;
      }

      if (
        ts.isCallExpression(entry.node) &&
        ts.isIdentifier(entry.node.expression) &&
        entry.node.expression.text === "require"
      ) {
        const symbol = context.checker.getSymbolAtLocation(
          entry.node.expression,
        );

        if (
          symbol?.declarations?.some(
            (declaration) => !declaration.getSourceFile().isDeclarationFile,
          )
        )
          continue;
      }

      if (!entry.argument || !ts.isStringLiteralLike(entry.argument)) {
        report(
          file,
          entry.node,
          "dynamic-module",
          "Module entrypoints must use a static string literal.",
        );

        continue;
      }

      const specifier = entry.argument.text;

      if (specifier.startsWith("/"))
        report(
          file,
          entry.node,
          "absolute-module",
          "Use relative internal imports or ~/ public roots.",
        );

      if (/\.css$/.test(specifier)) continue;

      if (ts.isExportDeclaration(entry.node) && !entry.node.exportClause)
        report(
          file,
          entry.node,
          "wildcard-export",
          "Export named public symbols explicitly.",
        );

      if (
        file.startsWith("src/entities/") &&
        /^(?:react(?:-dom)?(?:\/|$)|.*(?:protocol|indexeddb|repository|codec)(?:[./]|$))/.test(
          specifier,
        )
      ) {
        report(
          file,
          entry.node,
          "entity-dependency",
          "Entities cannot depend on React, persistence, DTO codecs or protocols.",
        );
      }

      const target = resolveImport(specifier, file, context, files, root);

      if (!target) {
        if (specifier.startsWith(".") || specifier.startsWith("~/"))
          report(
            file,
            entry.node,
            "unresolved-module",
            `Cannot resolve local module ${specifier}.`,
          );

        continue;
      }

      if (!graph.has(target)) continue; // CSS and generated/external declarations are not source graph nodes.

      if (entry.kind === "worker") {
        workerRoots.push({ file, target, node: entry.node });
        continue;
      }

      graph.get(file).push({ target, node: entry.node });

      const fromOwner = owner(file);
      const toOwner = owner(target);

      if (!fromOwner || !toOwner) continue;

      const fromLayer = file.split("/")[1];
      const toLayer = target.split("/")[1];

      if (layers.indexOf(toLayer) < layers.indexOf(fromLayer))
        report(
          file,
          entry.node,
          "upward-import",
          `Cannot import upward from ${fromLayer} to ${toLayer}.`,
        );

      if (fromOwner === toOwner) {
        if (target === `${fromOwner}/index.ts`)
          report(
            file,
            entry.node,
            "own-barrel",
            "Internal modules cannot import their own public barrel.",
          );

        if (specifier.startsWith("~/"))
          report(
            file,
            entry.node,
            "internal-alias",
            "Internal imports must be relative.",
          );
      } else {
        if (fromLayer === toLayer && isolatedLayers.has(fromLayer))
          report(
            file,
            entry.node,
            "sibling-import",
            "Compose independent slices in the layer above.",
          );

        if (target !== `${toOwner}/index.ts`)
          report(
            file,
            entry.node,
            "private-import",
            `Cross-owner imports must use ${toOwner}/index.ts.`,
          );

        if (!specifier.startsWith("~/"))
          report(
            file,
            entry.node,
            "cross-owner-alias",
            "Cross-owner imports must use the ~/ public root alias.",
          );
      }
    }
  }

  const active = new Set();
  const visited = new Set();

  const walk = (file) => {
    if (visited.has(file)) return;

    active.add(file);

    for (const edge of graph.get(file) ?? []) {
      if (active.has(edge.target))
        report(
          file,
          edge.node,
          "cycle",
          `Dependency cycle reaches ${edge.target}.`,
        );
      else walk(edge.target);
    }

    active.delete(file);
    visited.add(file);
  };

  for (const file of graph.keys()) walk(file);

  const workerFiles = new Set();

  for (const worker of workerRoots) {
    const reachable = new Set();

    const traverse = (file) => {
      if (reachable.has(file)) return;

      reachable.add(file);
      workerFiles.add(file);

      if (/(?:\/ui\/|\/native\/)/.test(file) || file.endsWith(".tsx"))
        report(
          worker.file,
          worker.node,
          "worker-ui",
          `Worker graph contains UI/native source ${file}.`,
        );

      const source = context.sources.get(file);

      for (const entry of source ? imports(source) : []) {
        if (
          entry.argument &&
          ts.isStringLiteralLike(entry.argument) &&
          /^react(?:-dom)?(?:\/|$)/.test(entry.argument.text)
        )
          report(
            file,
            entry.node,
            "worker-react",
            "Worker graph cannot load React.",
          );
      }

      for (const edge of graph.get(file) ?? []) {
        if (!isTest(edge.target)) traverse(edge.target);
      }
    };

    traverse(worker.target);
  }

  const entityFiles = new Set();

  const visitEntityDependency = (file) => {
    if (entityFiles.has(file) || isTest(file)) return;

    entityFiles.add(file);

    const source = context.sources.get(file);

    if (/(?:\/ui\/|\/native\/)/.test(file) || file.endsWith(".tsx"))
      report(
        file,
        source,
        "entity-dependency",
        "Entity dependencies must remain browser-free and UI-free.",
      );

    for (const entry of source ? imports(source) : []) {
      if (
        entry.argument &&
        ts.isStringLiteralLike(entry.argument) &&
        /^react(?:-dom)?(?:\/|$)/.test(entry.argument.text)
      )
        report(
          file,
          entry.node,
          "entity-dependency",
          "Entity dependencies cannot load React.",
        );
    }

    for (const edge of graph.get(file) ?? [])
      visitEntityDependency(edge.target);
  };

  for (const file of graph.keys())
    if (file.startsWith("src/entities/")) visitEntityDependency(file);

  return { graph, workerFiles, entityFiles };
}
