import path from "node:path";
import ts from "typescript";
import { hasJsx, visit } from "./ast.mjs";
import { isTest } from "./policy.mjs";
import { hookFilename, isComponentLocation, isLegacyUi } from "./modules.mjs";

const exported = (node) =>
  node.modifiers?.some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
  );

const callName = (expression) =>
  ts.isIdentifier(expression)
    ? expression.text
    : ts.isPropertyAccessExpression(expression)
      ? expression.name.text
      : "";

const isFunction = (node) =>
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isArrowFunction(node);

const isComponentName = (name) => /^[A-Z][A-Za-z0-9]*$/.test(name);

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

const declarationName = (node) => {
  const name = node.name;

  if (!name) return undefined;

  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;

  if (
    ts.isComputedPropertyName(name) &&
    ts.isStringLiteralLike(name.expression)
  )
    return name.expression.text;

  return undefined;
};

function componentType(file, declaration, source, files, report) {
  const type = declaration.type;

  if (
    !type ||
    !ts.isTypeReferenceNode(type) ||
    !/^(?:React\.)?FC$/.test(type.typeName.getText(source))
  ) {
    report(
      file,
      declaration,
      "component-fc",
      "Components must be arrow functions typed React.FC.",
    );

    return;
  }

  if (!type.typeArguments?.length) return;

  const component = declaration.name.getText(source);
  const expected = `${component}Types.Props`;

  if (type.typeArguments[0].getText(source) !== expected)
    report(
      file,
      declaration,
      "component-props",
      `Root props must use ${expected}.`,
    );

  const typesFile = file.replace(/\.tsx$/, ".types.ts");

  if (!Object.hasOwn(files, typesFile))
    report(
      file,
      declaration,
      "component-types-file",
      `Root props belong in ${typesFile}.`,
    );

  const namespace = component + "Types";

  const imported = source.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      statement.importClause.namedBindings.elements.some(
        (element) => element.name.text === namespace,
      ) &&
      ts.isStringLiteralLike(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.replace(/\.ts$/, "") ===
        `./${path.basename(typesFile, ".ts")}`,
  );

  if (!imported)
    report(
      file,
      declaration,
      "component-types-import",
      `Import ${namespace} from the colocated root-component.types.ts.`,
    );
}

function defaultPropsOnly(binding) {
  return (
    binding.elements.length > 0 &&
    binding.elements.every((element) => !!element.initializer)
  );
}

function thinForwarder(fn, binding) {
  const rest = binding.elements.find((element) => element.dotDotDotToken);

  if (
    !rest ||
    !ts.isIdentifier(rest.name) ||
    !/^[a-z][A-Za-z0-9]+Props$/.test(rest.name.text)
  )
    return false;

  if (
    binding.elements.some(
      (element) => !element.dotDotDotToken && !element.initializer,
    )
  )
    return false;

  const expression = ts.isBlock(fn.body)
    ? fn.body.statements.length === 1 &&
      ts.isReturnStatement(fn.body.statements[0])
      ? fn.body.statements[0].expression
      : undefined
    : fn.body;

  if (
    !expression ||
    !(ts.isJsxElement(expression) || ts.isJsxSelfClosingElement(expression))
  )
    return false;

  const opening = ts.isJsxElement(expression)
    ? expression.openingElement
    : expression;

  return opening.attributes.properties.some(
    (attribute) =>
      ts.isJsxSpreadAttribute(attribute) &&
      ts.isIdentifier(attribute.expression) &&
      attribute.expression.text === rest.name.text,
  );
}

export function checkShape(context, files, report) {
  for (const [file, source] of context.sources) {
    if (!file.startsWith("src/") || file.endsWith(".d.ts") || isTest(file))
      continue;

    if (
      file
        .split("/")
        .some(
          (part) => !/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+)*$/.test(part),
        )
    )
      report(file, source, "kebab-path", "Source paths must use kebab-case.");

    const components = [];

    if (isLegacyUi(file))
      report(
        file,
        source,
        "legacy-ui",
        "Use module component roots and recursive components/ instead of a flat ui/ collection.",
      );

    if (/\/(?:types|utils|config)\.[cm]?[jt]sx?$/.test(file))
      report(
        file,
        source,
        "scoped-file",
        "Types, utilities and configuration need an owner-qualified filename.",
      );

    visit(source, (node) => {
      if (ts.isInterfaceDeclaration(node))
        report(
          file,
          node,
          "interface",
          "Use type aliases in production source.",
        );

      if (
        (ts.isJsxElement(node) ||
          ts.isJsxSelfClosingElement(node) ||
          ts.isJsxFragment(node)) &&
        (!file.endsWith(".tsx") || !isComponentLocation(file, files))
      )
        report(
          file,
          node,
          "jsx-file",
          "JSX belongs in explicit component roots, recursive components/ or app composition.",
        );

      if (ts.isVariableDeclaration(node) && node.initializer) {
        if (
          ts.isObjectBindingPattern(node.name) ||
          ts.isArrayBindingPattern(node.name)
        ) {
          if (
            ts.isCallExpression(node.initializer) &&
            /^use[A-Z]/.test(callName(node.initializer.expression)) &&
            !(
              ts.isArrayBindingPattern(node.name) &&
              callName(node.initializer.expression) === "useState"
            )
          )
            report(
              file,
              node,
              "hook-destructure",
              "Keep object-valued hook results under one name; only useState tuples are destructured.",
            );
        }

        if (!isFunction(unwrap(node.initializer)) && hasJsx(node.initializer))
          report(
            file,
            node,
            "jsx-helper",
            "Do not store JSX in helper constants.",
          );
      }

      if (isFunction(node) && node.body) {
        let declaration =
          ts.isArrowFunction(node) || ts.isFunctionExpression(node)
            ? node.parent
            : node;

        while (
          ts.isParenthesizedExpression(declaration) ||
          ts.isAsExpression(declaration) ||
          ts.isTypeAssertionExpression(declaration) ||
          ts.isNonNullExpression(declaration) ||
          ts.isSatisfiesExpression(declaration)
        )
          declaration = declaration.parent;

        const name = declarationName(declaration);

        const functionName =
          node.name && ts.isIdentifier(node.name) ? node.name.text : name;

        if (
          functionName &&
          /^use[A-Z]/.test(functionName) &&
          !file.endsWith(`/hooks/${hookFilename(functionName)}.ts`)
        )
          report(
            file,
            node,
            "hook-location",
            `Hook ${functionName} belongs in hooks/${hookFilename(functionName)}.ts.`,
          );

        if (
          name &&
          isComponentName(name) &&
          (file.endsWith(".tsx") ||
            hasJsx(node.body) ||
            (ts.isVariableDeclaration(declaration) &&
              declaration.type &&
              /(?:\.)?FC\b/.test(declaration.type.getText(source))))
        ) {
          components.push(node);

          if (
            !ts.isArrowFunction(node) ||
            !ts.isVariableDeclaration(declaration)
          )
            report(
              file,
              node,
              "component-arrow",
              "Authored components must be arrow functions.",
            );
          else componentType(file, declaration, source, files, report);

          let ancestor = declaration.parent;

          while (ancestor && !ts.isSourceFile(ancestor)) {
            if (isFunction(ancestor)) {
              report(
                file,
                node,
                "nested-component",
                "Declare components at module scope.",
              );

              break;
            }

            ancestor = ancestor.parent;
          }

          for (const parameter of node.parameters) {
            if (
              ts.isObjectBindingPattern(parameter.name) &&
              !defaultPropsOnly(parameter.name) &&
              !thinForwarder(node, parameter.name)
            )
              report(
                file,
                parameter,
                "props-destructure",
                "Access props through their named root object.",
              );

            if (ts.isIdentifier(parameter.name)) {
              const propSymbols = new Set([
                context.checker.getSymbolAtLocation(parameter.name),
              ]);

              visit(node.body, (child) => {
                if (
                  !ts.isVariableDeclaration(child) ||
                  !child.initializer ||
                  !ts.isIdentifier(child.initializer)
                )
                  return;

                if (
                  !propSymbols.has(
                    context.checker.getSymbolAtLocation(child.initializer),
                  )
                )
                  return;

                if (ts.isIdentifier(child.name))
                  propSymbols.add(
                    context.checker.getSymbolAtLocation(child.name),
                  );
                else if (
                  ts.isObjectBindingPattern(child.name) &&
                  !defaultPropsOnly(child.name)
                )
                  report(
                    file,
                    child,
                    "props-destructure",
                    "Access props through their named root object.",
                  );
              });
            }
          }
        } else if (
          name &&
          hasJsx(node.body) &&
          (ts.isFunctionDeclaration(node) ||
            declaration.parent?.parent === source)
        )
          report(
            file,
            node,
            "jsx-helper",
            "Render cohesive components instead of JSX-valued helper functions.",
          );
      }

      if (
        ts.isMethodDeclaration(node) &&
        node.body &&
        declarationName(node) &&
        /^use[A-Z]/.test(declarationName(node)) &&
        !file.endsWith(`/hooks/${hookFilename(declarationName(node))}.ts`)
      )
        report(
          file,
          node,
          "hook-location",
          `Hook ${declarationName(node)} belongs in hooks/${hookFilename(declarationName(node))}.ts.`,
        );

      if (
        ts.isCallExpression(node) &&
        /^(?:useEffect|useLayoutEffect|useInsertionEffect)$/.test(
          callName(node.expression),
        )
      ) {
        const callback = node.arguments[0];

        const name =
          callback &&
          (ts.isIdentifier(callback)
            ? callback.text
            : ts.isFunctionExpression(callback)
              ? callback.name?.text
              : undefined);

        if (!name?.endsWith("Fx"))
          report(
            file,
            node,
            "effect-name",
            "Effect callbacks must be named functions ending Fx.",
          );
      }

      if (file.startsWith("src/shared/lib/")) {
        if (ts.isFunctionDeclaration(node) && exported(node))
          report(
            file,
            node,
            "helper-namespace",
            "Public shared/lib helpers expose a namespace-style object.",
          );

        if (ts.isVariableStatement(node) && exported(node)) {
          for (const declaration of node.declarationList.declarations) {
            const initializer = declaration.initializer;

            const object =
              initializer &&
              (ts.isObjectLiteralExpression(initializer) ||
                (ts.isCallExpression(initializer) &&
                  initializer.expression.getText(source) === "Object.freeze" &&
                  initializer.arguments[0] &&
                  ts.isObjectLiteralExpression(initializer.arguments[0])));

            if (!object || !ts.isIdentifier(declaration.name))
              report(
                file,
                declaration,
                "helper-namespace",
                "Public shared/lib helpers expose a namespace-style object.",
              );
          }
        }
      }
    });

    if (components.length > 1)
      report(
        file,
        components[1],
        "one-component",
        "Keep one authored React component per file.",
      );
  }
}
