import path from "node:path";
import ts from "typescript";

export const normalized = (file) => file.replaceAll("\\", "/");
export const visit = (node, callback) => {
  callback(node);
  ts.forEachChild(node, (child) => visit(child, callback));
};
export const hasJsx = (node) => {
  let found = false;
  visit(node, (child) => {
    if (
      ts.isJsxElement(child) ||
      ts.isJsxSelfClosingElement(child) ||
      ts.isJsxFragment(child)
    )
      found = true;
  });
  return found;
};

export function sourceProgram(files, root) {
  const sources = new Map(
    Object.entries(files).map(([file, text]) => [
      normalized(path.resolve(root, file)),
      text,
    ]),
  );
  const options = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    skipLibCheck: true,
    allowJs: true,
    noEmit: true,
    types: [],
    paths: { "~/*": [normalized(path.resolve(root, "src/*"))] },
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
  };
  const host = ts.createCompilerHost(options);
  const original = {
    readFile: host.readFile.bind(host),
    fileExists: host.fileExists.bind(host),
    getSourceFile: host.getSourceFile.bind(host),
  };
  host.readFile = (file) =>
    sources.get(normalized(file)) ?? original.readFile(file);
  host.fileExists = (file) =>
    sources.has(normalized(file)) || original.fileExists(file);
  host.directoryExists = (dir) =>
    [...sources.keys()].some((file) =>
      file.startsWith(`${normalized(dir)}/`),
    ) || ts.sys.directoryExists(dir);
  host.getSourceFile = (file, languageVersion, onError, fresh) => {
    const text = sources.get(normalized(file));
    return text === undefined
      ? original.getSourceFile(file, languageVersion, onError, fresh)
      : ts.createSourceFile(file, text, languageVersion, true);
  };
  const program = ts.createProgram([...sources.keys()], options, host);
  return { program, checker: program.getTypeChecker(), options, host };
}

export function imports(source) {
  const entries = [];
  visit(source, (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    ) {
      entries.push({ node, argument: node.moduleSpecifier, kind: "import" });
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      entries.push({
        node,
        argument: node.moduleReference.expression,
        kind: "import",
      });
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument)
    ) {
      entries.push({ node, argument: node.argument.literal, kind: "import" });
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      entries.push({ node, argument: node.arguments[0], kind: "import" });
    } else if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "URL" &&
      node.arguments?.[1]?.getText(source) === "import.meta.url" &&
      (!node.arguments[0] ||
        !ts.isStringLiteralLike(node.arguments[0]) ||
        /\.[cm]?[jt]sx?$/.test(node.arguments[0].text))
    ) {
      // URL entrypoints are execution edges, never ordinary public-API imports.
      entries.push({ node, argument: node.arguments[0], kind: "worker" });
    }
  });
  return entries;
}

export function resolveImport(specifier, file, context, files, root) {
  if (!specifier.startsWith(".") && !specifier.startsWith("~/"))
    return undefined;
  const resolved = ts.resolveModuleName(
    specifier,
    path.resolve(root, file),
    context.options,
    context.host,
  ).resolvedModule;
  if (resolved)
    return normalized(path.relative(root, resolved.resolvedFileName));
  const base = normalized(
    specifier.startsWith("~/")
      ? `src/${specifier.slice(2)}`
      : path.join(path.dirname(file), specifier),
  );
  return [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    base.replace(/\.js$/, ".ts"),
  ].find((candidate) => Object.hasOwn(files, candidate));
}
