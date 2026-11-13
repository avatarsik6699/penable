import ts from "typescript";
import { visit } from "./ast.mjs";
import { isTest } from "./policy.mjs";

// Symbols, rather than identifier text, distinguish native globals from model fields,
// imported ports and lexical shadows. Standard cancellation is deliberately portable.
const portable = new Set([
  "AbortController",
  "AbortSignal",
  "DOMException",
  "console",
  "structuredClone",
  "TextEncoder",
  "TextDecoder",
  "atob",
  "btoa",
]);

export function capability(name) {
  if (portable.has(name)) return undefined;

  if (
    /^(?:setTimeout|clearTimeout|setInterval|clearInterval|queueMicrotask|TimerHandler|scheduler|Scheduler)$/.test(
      name,
    )
  )
    return "timers";

  if (
    /^(?:requestAnimationFrame|cancelAnimationFrame|FrameRequestCallback)$/.test(
      name,
    )
  )
    return "frames";

  if (
    /^(?:Path2D|Canvas.*|OffscreenCanvas.*|ImageData|ImageBitmap.*|createImageBitmap)$/.test(
      name,
    )
  )
    return "canvas";

  if (
    /^(?:IDB.*|indexedDB|Storage|storage|localStorage|sessionStorage|CacheStorage|caches)$/.test(
      name,
    )
  )
    return "storage";

  if (
    /^(?:locks|Lock|LockManager|LockMode|LockOptions|LockGrantedCallback)$/.test(
      name,
    )
  )
    return "locks";

  if (/^(?:clipboard|Clipboard.*)$/.test(name)) return "clipboard";

  if (/^(?:Blob.*|File.*)$/.test(name)) return "files";

  if (/^(?:URL|URLSearchParams)$/.test(name)) return "url";

  if (/^(?:Worker|WorkerOptions|SharedWorker)$/.test(name)) return "worker";

  if (
    /^(?:DedicatedWorkerGlobalScope|WorkerGlobalScope|self|postMessage|importScripts|close)$/.test(
      name,
    )
  )
    return "worker-scope";

  if (/^(?:Message.*|Transferable|StructuredSerializeOptions)$/.test(name))
    return "messaging";

  if (/^(?:performance|Performance.*)$/.test(name)) return "clock";

  return "dom";
}

function isReference(node) {
  const parent = node.parent;

  if (
    (ts.isPropertyAccessExpression(parent) || ts.isQualifiedName(parent)) &&
    parent.name === node
  )
    return false;

  if (
    (ts.isPropertyAssignment(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isMethodSignature(parent)) &&
    parent.name === node &&
    !ts.isComputedPropertyName(parent.name)
  )
    return false;

  if (
    (ts.isVariableDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isFunctionDeclaration(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isTypeAliasDeclaration(parent) ||
      ts.isInterfaceDeclaration(parent) ||
      ts.isBindingElement(parent)) &&
    parent.name === node
  )
    return false;

  if (
    ts.isImportSpecifier(parent) ||
    ts.isExportSpecifier(parent) ||
    ts.isImportClause(parent) ||
    ts.isNamespaceImport(parent)
  )
    return false;

  return true;
}

const isAccess = (node) =>
  ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node);

const memberName = (node) =>
  ts.isPropertyAccessExpression(node)
    ? node.name.text
    : ts.isElementAccessExpression(node) &&
        node.argumentExpression &&
        ts.isStringLiteralLike(node.argumentExpression)
      ? node.argumentExpression.text
      : undefined;

const memberNode = (node) =>
  ts.isPropertyAccessExpression(node) ? node.name : node.argumentExpression;

const browserSymbol = (symbol) =>
  symbol?.declarations?.some((declaration) =>
    /\/lib\.(?:dom|webworker)(?:\.[\w-]+)?\.d\.ts$/.test(
      declaration.getSourceFile().fileName.replaceAll("\\", "/"),
    ),
  );

const namespaceMembers = [
  "window",
  "self",
  "document",
  "navigator",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "caches",
  "clipboard",
  "locks",
  "storage",
];

const browserNamespace = (type) =>
  namespaceMembers.some((name) => browserSymbol(type.getProperty(name)));

const unwrap = (expression) => {
  while (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  )
    expression = expression.expression;

  return expression;
};

function bindingName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;

  if (
    ts.isComputedPropertyName(node) &&
    ts.isStringLiteralLike(node.expression)
  )
    return node.expression.text;

  return undefined;
}

export function checkPlatform(
  context,
  owners,
  workerFiles,
  entityFiles,
  report,
  workerCanvasFiles = new Set(),
) {
  for (const [file, source] of context.sources) {
    if (!file.startsWith("src/") || isTest(file) || file.endsWith(".d.ts"))
      continue;

    const allowed = new Set(owners[file] ?? []);
    const emitted = new Set();

    const check = (name, node) => {
      let required = capability(name);

      // Navigator only exposes the purpose owned by this adapter. Other DOM use
      // still requires dom; a lock adapter cannot silently acquire clipboard access.
      if (name === "navigator") {
        const access =
          isAccess(node.parent) && memberNode(node.parent) === node
            ? node.parent
            : node;

        const member =
          isAccess(access.parent) && access.parent.expression === access
            ? memberName(access.parent)
            : undefined;

        // Static binding elements are checked individually below, including aliases
        // and nested patterns; acquiring a clipboard binding needs only clipboard.
        if (
          ts.isVariableDeclaration(access.parent) &&
          access.parent.initializer === access &&
          ts.isObjectBindingPattern(access.parent.name)
        )
          return;

        required =
          member === "locks"
            ? "locks"
            : member === "clipboard"
              ? "clipboard"
              : "dom";
      }

      if (!required) return;

      const key = `${node.pos}:${required}`;

      if (emitted.has(key)) return;

      emitted.add(key);

      if (
        workerFiles.has(file) &&
        ["dom", "canvas", "frames", "clipboard", "worker"].includes(required) &&
        !(required === "canvas" && workerCanvasFiles.has(file))
      )
        report(
          file,
          node,
          "worker-platform",
          `Worker graph cannot reference ${name} (${required}).`,
        );

      if (entityFiles.has(file))
        report(
          file,
          node,
          "entity-platform",
          `Entities must be browser-free: ${name}.`,
        );
      else if (
        (file.endsWith(".tsx") && file !== "src/main.tsx") ||
        file.includes("/hooks/") ||
        !allowed.has(required)
      )
        report(
          file,
          node,
          "platform-owner",
          `${name} requires the exact owning ${required} adapter.`,
        );
    };

    const checkBinding = (binding, type) => {
      for (const element of binding.elements) {
        const name = bindingName(element.propertyName ?? element.name);

        if (element.dotDotDotToken || !name) {
          if (browserNamespace(type))
            report(
              file,
              element,
              "global-escape",
              "Use explicit native capability bindings instead of namespace rest or computed bindings.",
            );

          continue;
        }

        const property = type.getProperty(name);

        if (!property) continue;

        if (
          browserSymbol(property) &&
          (browserNamespace(type) || namespaceMembers.includes(name))
        )
          check(name, element.propertyName ?? element.name);

        if (ts.isObjectBindingPattern(element.name))
          checkBinding(
            element.name,
            context.checker.getTypeOfSymbolAtLocation(property, element),
          );
      }
    };

    visit(source, (node) => {
      if (ts.isObjectBindingPattern(node)) {
        const declaration = node.parent;

        if (ts.isVariableDeclaration(declaration) && declaration.initializer)
          checkBinding(
            node,
            context.checker.getTypeAtLocation(unwrap(declaration.initializer)),
          );
        else if (ts.isParameter(declaration))
          checkBinding(node, context.checker.getTypeAtLocation(declaration));
      }

      if (isAccess(node)) {
        const base = unwrap(node.expression);
        const type = context.checker.getTypeAtLocation(base);
        const name = memberName(node);

        if (!name) {
          if (browserNamespace(type))
            report(
              file,
              node,
              "global-escape",
              "Native capability access must use a static property name.",
            );
        } else {
          const property = type.getProperty(name);

          if (
            browserSymbol(property) &&
            (browserNamespace(type) || namespaceMembers.includes(name))
          )
            check(name, memberNode(node));
        }
      }

      if (
        (ts.isSpreadAssignment(node) &&
          browserNamespace(
            context.checker.getTypeAtLocation(unwrap(node.expression)),
          )) ||
        (ts.isBinaryExpression(node) &&
          node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          ts.isObjectLiteralExpression(unwrap(node.left)) &&
          browserNamespace(
            context.checker.getTypeAtLocation(unwrap(node.right)),
          ))
      )
        report(
          file,
          node,
          "global-escape",
          "Do not spread or assign browser namespaces through an implicit capability binding.",
        );

      if (!ts.isIdentifier(node)) return;

      if (!isReference(node)) return;

      const symbol = ts.isShorthandPropertyAssignment(node.parent)
        ? context.checker.getShorthandAssignmentValueSymbol(node.parent)
        : context.checker.getSymbolAtLocation(node);

      const declarations = symbol?.declarations ?? [];

      const browserGlobal = declarations.some((declaration) =>
        /\/lib\.(?:dom|webworker)(?:\.[\w-]+)?\.d\.ts$/.test(
          declaration.getSourceFile().fileName.replaceAll("\\", "/"),
        ),
      );

      if (browserGlobal) check(node.text, node);

      // Access through globalThis must not bypass normal identifier ownership.
      if (
        node.text === "globalThis" &&
        (!symbol || declarations.length === 0)
      ) {
        if (ts.isPropertyAccessExpression(node.parent)) {
          const name = node.parent.name.text;
          const member = context.checker.getSymbolAtLocation(node.parent.name);

          if (
            member?.declarations?.some((declaration) =>
              /\/lib\.(?:dom|webworker).*\.d\.ts$/.test(
                declaration.getSourceFile().fileName,
              ),
            )
          )
            check(name, node.parent.name);
        } else if (
          ts.isElementAccessExpression(node.parent) &&
          node.parent.argumentExpression &&
          ts.isStringLiteralLike(node.parent.argumentExpression)
        ) {
          const name = node.parent.argumentExpression.text;

          const member = context.checker
            .getTypeAtLocation(node)
            .getProperty(name);

          if (
            member?.declarations?.some((declaration) =>
              /\/lib\.(?:dom|webworker).*\.d\.ts$/.test(
                declaration.getSourceFile().fileName,
              ),
            )
          )
            check(name, node.parent.argumentExpression);
        } else
          report(
            file,
            node,
            "global-escape",
            "Do not pass or destructure the browser global namespace.",
          );
      }
    });
  }
}
