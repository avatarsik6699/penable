import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const callable = (node) =>
  ts.isFunctionDeclaration(node) ||
  (ts.isVariableStatement(node) &&
    node.declarationList.declarations.some(
      (declaration) =>
        declaration.initializer &&
        (ts.isArrowFunction(declaration.initializer) ||
          ts.isFunctionExpression(declaration.initializer)),
    )) ||
  ts.isMethodDeclaration(node) ||
  ts.isConstructorDeclaration(node) ||
  ts.isGetAccessorDeclaration(node) ||
  ts.isSetAccessorDeclaration(node) ||
  ((ts.isPropertyDeclaration(node) || ts.isPropertyAssignment(node)) &&
    node.initializer &&
    (ts.isArrowFunction(node.initializer) ||
      ts.isFunctionExpression(node.initializer)));

const control = (node) =>
  ts.isIfStatement(node) ||
  ts.isIterationStatement(node, false) ||
  ts.isSwitchStatement(node) ||
  ts.isTryStatement(node);

const overloadPair = (previous, next, source) =>
  (ts.isFunctionDeclaration(previous) ||
    ts.isMethodDeclaration(previous) ||
    ts.isConstructorDeclaration(previous)) &&
  !previous.body &&
  previous.kind === next.kind &&
  previous.name?.getText(source) === next.name?.getText(source);

/** Insert only inter-node whitespace; never print or rewrite tokens/literals. */
export function spaceCode(text, file = "source.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);

  if (source.parseDiagnostics.length)
    throw new Error(`Cannot format invalid syntax: ${file}`);

  const line = (offset) => source.getLineAndCharacterOfPosition(offset).line;

  const multiline = (node) => line(node.getStart(source)) < line(node.end);

  const edits = new Map();

  const separate = (previous, next) => {
    const leading = ts.getLeadingCommentRanges(text, next.pos);
    const anchor = leading?.[0]?.pos ?? next.getStart(source);
    const trailing = ts.getTrailingCommentRanges(text, previous.end);
    const end = trailing?.at(-1)?.end ?? previous.end;

    if (/\r?\n[\t ]*\r?\n/.test(text.slice(end, anchor))) return;

    // An own-line comment belongs to the next block; inline comments stay put.
    const lineStart = text.lastIndexOf("\n", anchor - 1) + 1;
    const position = lineStart >= end ? lineStart : anchor;
    const newline = text.includes("\r\n") ? "\r\n" : "\n";

    edits.set(position, lineStart >= end ? newline : newline.repeat(2));
  };

  const sequence = (nodes, kind) => {
    for (let index = 1; index < nodes.length; index++) {
      const previous = nodes[index - 1];
      const next = nodes[index];

      if (overloadPair(previous, next, source)) continue;

      if (kind === "members" || kind === "object") {
        const needsGap = (member) =>
          kind === "members"
            ? callable(member)
            : ts.isMethodDeclaration(member) ||
              (ts.isPropertyAssignment(member) &&
                member.initializer &&
                (ts.isArrowFunction(member.initializer) ||
                  ts.isFunctionExpression(member.initializer)) &&
                ts.isBlock(member.initializer.body));

        if (needsGap(previous) || needsGap(next)) separate(previous, next);

        continue;
      }

      if (kind === "module") {
        if (
          (ts.isImportDeclaration(previous) && ts.isImportDeclaration(next)) ||
          (ts.isExportDeclaration(previous) && ts.isExportDeclaration(next)) ||
          (ts.isVariableStatement(previous) &&
            ts.isVariableStatement(next) &&
            !multiline(previous) &&
            !multiline(next) &&
            !callable(previous) &&
            !callable(next))
        )
          continue;

        separate(previous, next);
        continue;
      }

      if (
        control(previous) ||
        control(next) ||
        callable(previous) ||
        callable(next) ||
        ts.isReturnStatement(next) ||
        ts.isThrowStatement(next) ||
        ts.isVariableStatement(previous) !== ts.isVariableStatement(next) ||
        multiline(previous) ||
        multiline(next)
      )
        separate(previous, next);
    }
  };

  const visit = (node) => {
    if (ts.isSourceFile(node) || ts.isModuleBlock(node))
      sequence(node.statements, "module");
    else if (ts.isBlock(node)) sequence(node.statements, "block");
    else if (ts.isClassDeclaration(node) || ts.isClassExpression(node))
      sequence(node.members, "members");
    else if (ts.isObjectLiteralExpression(node))
      sequence(node.properties, "object");

    ts.forEachChild(node, visit);
  };

  visit(source);

  let result = text;

  for (const [position, insertion] of [...edits].sort(([a], [b]) => b - a))
    result = result.slice(0, position) + insertion + result.slice(position);

  return result;
}

export function codeFiles(targets) {
  const files = [];

  const visit = (target) => {
    if (fs.statSync(target).isDirectory()) {
      for (const child of fs.readdirSync(target).sort())
        visit(path.join(target, child));
    } else if (/\.[cm]?[jt]sx?$/.test(target)) files.push(target);
  };

  for (const target of targets) visit(target);

  return files;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const write = process.argv.includes("--write");

  const targets = process.argv
    .slice(2)
    .filter((argument) => argument !== "--write");

  const files = codeFiles(
    targets.length
      ? targets
      : [
          "src",
          "scripts",
          "e2e",
          "vite.config.ts",
          "playwright.config.ts",
          "prettier.config.mjs",
        ],
  );

  let changed = 0;

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const formatted = spaceCode(text, file);

    if (formatted === text) continue;

    changed++;

    if (write) fs.writeFileSync(file, formatted);
    else
      console.error(
        `${file}: separate meaningful code blocks (npm run format)`,
      );
  }

  console.log(
    `Code spacing: ${changed} ${write ? "updated" : "unformatted"} / ${files.length} files.`,
  );

  if (!write && changed) process.exitCode = 1;
}
