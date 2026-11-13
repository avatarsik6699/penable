import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { normalized, sourceProgram } from "./ast.mjs";
import { checkE2e } from "./e2e.mjs";
import { checkGraph } from "./graph.mjs";
import { checkPlatform } from "./platform.mjs";
import { platformOwners } from "./policy.mjs";
import { checkShape } from "./shape.mjs";

/** Check in-memory, repository-relative sources with the same policies as the CLI. */
export function checkFiles(
  input,
  { root = process.cwd(), owners = platformOwners } = {},
) {
  const files = Object.fromEntries(
    Object.entries(input).map(([file, text]) => [normalized(file), text]),
  );
  const context = sourceProgram(files, root);
  context.sources = new Map(
    Object.keys(files).map((file) => [
      file,
      context.program.getSourceFile(path.resolve(root, file)),
    ]),
  );
  const diagnostics = [];
  const report = (file, node, rule, message) => {
    const source = context.sources.get(file);
    const { line, character } = source.getLineAndCharacterOfPosition(
      node.getStart(source),
    );
    diagnostics.push({
      file,
      line: line + 1,
      column: character + 1,
      rule,
      message,
    });
  };
  for (const [file, source] of context.sources) {
    for (const diagnostic of context.program.getSyntacticDiagnostics(source)) {
      const position = source.getLineAndCharacterOfPosition(
        diagnostic.start ?? 0,
      );
      diagnostics.push({
        file,
        line: position.line + 1,
        column: position.character + 1,
        rule: "syntax",
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      });
    }
  }
  const { workerFiles, entityFiles } = checkGraph(context, files, root, report);
  checkPlatform(context, owners, workerFiles, entityFiles, report);
  checkShape(context, files, report);
  checkE2e(context, report);
  return diagnostics.sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.line - right.line ||
      left.column - right.column ||
      left.rule.localeCompare(right.rule),
  );
}

export function readSources(root) {
  const files = {};
  const walk = (directory) => {
    if (!fs.existsSync(path.join(root, directory))) return;
    for (const entry of fs
      .readdirSync(path.join(root, directory), { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && /\.[cm]?[jt]sx?$/.test(file))
        files[file] = fs.readFileSync(path.join(root, file), "utf8");
    }
  };
  walk("src");
  walk("e2e");
  return files;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const files = readSources(process.cwd());
  const diagnostics = checkFiles(files);
  for (const diagnostic of diagnostics)
    console.error(
      `${diagnostic.file}:${diagnostic.line}:${diagnostic.column} [${diagnostic.rule}] ${diagnostic.message}`,
    );
  if (Object.keys(files).length === 0) {
    console.error(
      "Architecture check found no source files. Run it from the repository root.",
    );
    process.exitCode = 1;
  } else if (diagnostics.length) {
    console.error(
      `Architecture check failed: ${diagnostics.length} violation(s).`,
    );
    process.exitCode = 1;
  } else
    console.log(
      `Architecture check passed (${Object.keys(files).length} source files).`,
    );
}
