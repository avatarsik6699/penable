import ts from "typescript";
import { imports, visit } from "./ast.mjs";

const driverMethods = new Set([
  "goto",
  "locator",
  "getByRole",
  "getByLabel",
  "getByText",
  "getByTestId",
  "getByPlaceholder",
  "getByAltText",
  "getByTitle",
  "evaluate",
  "evaluateHandle",
  "addInitScript",
  "newContext",
  "newPage",
  "route",
  "unroute",
  "waitForTimeout",
  "waitForSelector",
  "waitForFunction",
  "waitForURL",
  "waitForResponse",
  "waitForEvent",
  "waitForLoadState",
  "screenshot",
  "click",
  "dblclick",
  "fill",
  "press",
  "type",
  "insertText",
  "setInputFiles",
  "reload",
  "dispatchEvent",
  "close",
  "move",
  "down",
  "up",
  "wheel",
  "tap",
  "hover",
  "selectOption",
  "check",
  "uncheck",
  "setChecked",
  "focus",
  "blur",
  "dragTo",
  "all",
  "count",
  "isVisible",
  "isEnabled",
  "inputValue",
  "textContent",
  "innerText",
  "getAttribute",
  "content",
  "url",
  "title",
  "bringToFront",
  "setViewportSize",
  "storageState",
  "grantPermissions",
  "clearPermissions",
]);

export function checkE2e(context, report) {
  for (const [file, source] of context.sources) {
    if (!file.startsWith("e2e/") || !file.endsWith(".spec.ts")) continue;

    for (const entry of imports(source)) {
      const specifier =
        entry.argument && ts.isStringLiteralLike(entry.argument)
          ? entry.argument.text
          : "";

      if (ts.isImportDeclaration(entry.node)) {
        const bindings = entry.node.importClause?.namedBindings;

        if (
          entry.node.importClause?.name ||
          (bindings && !ts.isNamedImports(bindings))
        )
          report(
            file,
            entry.node,
            "e2e-fixtures",
            "Specs consume named domain fixtures only.",
          );

        if (bindings && ts.isNamedImports(bindings)) {
          for (const binding of bindings.elements) {
            if (
              (binding.propertyName ?? binding.name).text !== "test" ||
              !/(?:^|\/)fixtures$/.test(specifier)
            )
              report(
                file,
                binding,
                "e2e-fixtures",
                "Specs import test only from their fixtures.",
              );

            if (binding.name.text !== "test")
              report(
                file,
                binding,
                "e2e-fixtures",
                "Keep the fixture test name explicit.",
              );
          }
        }
      } else
        report(
          file,
          entry.node,
          "e2e-fixtures",
          "Specs use fixture imports, not dynamic module loading.",
        );
    }

    visit(source, (node) => {
      if (ts.isCallExpression(node)) {
        if (
          ts.isIdentifier(node.expression) &&
          node.expression.text === "test"
        ) {
          const callback = node.arguments.at(-1);

          if (
            callback &&
            (ts.isArrowFunction(callback) ||
              ts.isFunctionExpression(callback)) &&
            callback.parameters[0] &&
            !ts.isObjectBindingPattern(callback.parameters[0].name)
          )
            report(
              file,
              callback,
              "e2e-domain-fixture",
              "Consume domain fixtures through an explicit fixture binding.",
            );
        }

        if (
          ts.isIdentifier(node.expression) &&
          node.expression.text === "expect"
        )
          report(file, node, "e2e-assertion", "Page Objects own assertions.");

        if (
          ts.isPropertyAccessExpression(node.expression) &&
          driverMethods.has(node.expression.name.text)
        )
          report(
            file,
            node,
            "e2e-driver",
            "Page Objects own low-level browser actions.",
          );
      }

      if (ts.isNewExpression(node))
        report(
          file,
          node,
          "e2e-construction",
          "Fixtures own Page Objects, contexts and data construction.",
        );

      if (
        ts.isObjectLiteralExpression(node) ||
        ts.isArrayLiteralExpression(node)
      )
        report(
          file,
          node,
          "e2e-data",
          "Fixtures own domain test data construction.",
        );

      if (ts.isParameter(node) && ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          if (
            element.dotDotDotToken ||
            [
              "page",
              "context",
              "request",
              "browser",
              "browserName",
              "testInfo",
            ].includes((element.propertyName ?? element.name).getText(source))
          )
            report(
              file,
              element,
              "e2e-domain-fixture",
              "Specs consume explicit domain fixtures, not built-in driver fixtures.",
            );
        }
      }

      if (
        (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
        node.parameters.length > 1
      )
        report(
          file,
          node,
          "e2e-test-info",
          "Specs use only their domain fixture parameter.",
        );
    });
  }
}
