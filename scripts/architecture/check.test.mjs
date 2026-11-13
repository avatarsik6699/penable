import assert from "node:assert/strict";
import test from "node:test";
import { checkFiles } from "./check.mjs";

const root = "/architecture-policy-fixtures";

const check = (files, options = {}) => checkFiles(files, { root, ...options });

const rejects = (files, rule, options) => {
  const diagnostics = check(files, options);

  assert.ok(
    diagnostics.some((diagnostic) => diagnostic.rule === rule),
    `Expected ${rule}: ${JSON.stringify(diagnostics)}`,
  );
};

const accepts = (files, options) => assert.deepEqual(check(files, options), []);

const board = {
  "src/entities/board/index.ts": "export type Board = { id: string };",
};

test("public roots, downward edges, relative internal imports and type exports pass", () => {
  accepts({
    ...board,
    "src/features/document/index.ts": "export { model } from './model/model';",
    "src/features/document/model/model.ts":
      "import type { Board } from '~/entities/board'; export const model = (board: Board) => board.id;",
    "src/app/main.ts":
      "import { model } from '~/features/document'; export const app = model;",
    "src/shared/lib/math/index.ts": "export { math } from './math';",
    "src/shared/lib/math/math.ts":
      "export const math = { add: (a: number, b: number) => a + b };",
  });
});

test("upward, sibling, deep relative and alias private imports fail", () => {
  const files = {
    ...board,
    "src/features/one/index.ts": "export const one = 1;",
    "src/features/two/index.ts":
      "import { one } from '~/features/one'; export const two = one;",
    "src/entities/board/value.ts":
      "import { one } from '../../features/one'; export const value = one;",
    "src/app/main.ts":
      "import { value } from '~/entities/board/value'; export const app = value;",
  };

  for (const rule of [
    "upward-import",
    "sibling-import",
    "private-import",
    "cross-owner-alias",
  ])
    rejects(files, rule);
});

test("own barrels, internal aliases, wildcard exports and cycles fail", () => {
  const files = {
    "src/entities/board/index.ts": "export * from './value';",
    "src/entities/board/value.ts":
      "import type { X } from '~/entities/board'; export type X = { next: X };",
  };

  for (const rule of [
    "own-barrel",
    "internal-alias",
    "wildcard-export",
    "cycle",
  ])
    rejects(files, rule);
});

test("all TypeScript dependency forms participate in public API checks", () => {
  for (const expression of [
    "import type { Value } from '~/entities/board/private';",
    "export type { Value } from '~/entities/board/private';",
    "const load = import('~/entities/board/private');",
    "type Value = import('~/entities/board/private').Value;",
    "const load = require('~/entities/board/private');",
    "import load = require('~/entities/board/private');",
  ]) {
    rejects(
      {
        "src/app/main.ts": expression,
        "src/entities/board/private.ts": "export type Value = string;",
      },
      "private-import",
    );
  }
});

test("dynamic module paths cannot hide graph edges; lexical require shadows are allowed", () => {
  rejects(
    {
      "src/app/main.ts": "export const load = (name: string) => import(name);",
    },
    "dynamic-module",
  );

  accepts({
    "src/entities/board/model.ts":
      "export const model = (require: (name: string) => string) => require('not/a/module');",
  });
});

test("module-looking comments and strings do not create dependencies", () => {
  accepts({
    "src/entities/board/model.ts":
      "// import('~/features/wrong')\nexport const text = `require('~/widgets/wrong') document.body interface Fake {}`;",
  });
});

test("unresolved local sources and the old flat source tree fail", () => {
  rejects({ "src/app/main.ts": "import './missing';" }, "unresolved-module");
  rejects({ "src/drawing/geometry.ts": "export const value = 1;" }, "layer");
});

test("browser globals and DOM types need exact capability owners", () => {
  const files = {
    "src/widgets/board-workspace/native/owner.ts":
      'export const owner = () => document.createElement("canvas"); export type Surface = HTMLCanvasElement;',
  };

  rejects(files, "platform-owner");

  accepts(files, {
    owners: { "src/widgets/board-workspace/native/owner.ts": ["dom"] },
  });

  rejects(files, "platform-owner", {
    owners: { "src/widgets/board-workspace/native/neighbor.ts": ["dom"] },
  });
});

test("lexical shadows, fields, parameter types and model document names pass", () => {
  accepts({
    "src/entities/board/model.ts": `type Local = { body: string };
      export const read = (document: Local, window: Local, Path2D: () => string, navigator: Local) => ({
        document: document.body, window: window.body, path: Path2D(), navigator: navigator.body,
      });
      export const projected = { document: 'model', setTimeout: 'label' };
      export const localGlobal = (globalThis: Local) => globalThis.body;`,
  });
});

test("timers, RAF, worker creation and storage require separate capabilities", () => {
  const file = "src/features/board-document/adapters/platform.ts";

  const files = {
    [file]:
      'setTimeout(() => {}, 10); queueMicrotask(() => {}); globalThis.scheduler?.yield(); requestAnimationFrame(() => {}); new Worker(new URL("./worker.ts", import.meta.url)); indexedDB.open("x");',
    "src/features/board-document/adapters/worker.ts": "export {};",
  };

  accepts(files, {
    owners: { [file]: ["timers", "frames", "worker", "url", "storage"] },
  });

  rejects(files, "platform-owner", { owners: { [file]: ["dom"] } });
});

test("globalThis access and destructuring cannot bypass platform ownership", () => {
  for (const expression of [
    "globalThis.document",
    'globalThis["document"]',
    "const { document } = globalThis",
  ]) {
    rejects(
      { "src/entities/board/model.ts": `${expression}; export {};` },
      expression.startsWith("const") ? "global-escape" : "entity-platform",
    );
  }
});

test("entities support portable cancellation but reject browser, React and protocol dependencies", () => {
  accepts({
    "src/entities/board/model.ts":
      "export const cancel = (signal: AbortSignal) => new AbortController().signal.aborted || signal.aborted;",
  });

  rejects(
    { "src/entities/board/model.ts": "export const drawing = new Path2D();" },
    "entity-platform",
  );

  rejects(
    {
      "src/entities/board/model.ts":
        "import type { FC } from 'react'; export type View = FC;",
    },
    "entity-dependency",
  );

  rejects(
    {
      "src/entities/board/model.ts": "import type { Job } from './protocol';",
      "src/entities/board/protocol.ts": "export type Job = string;",
    },
    "entity-dependency",
  );
});

test("worker URL entrypoints form separate execution edges without own-barrel false positives", () => {
  const file = "src/features/board-document/adapters/jobs.ts";

  accepts(
    {
      [file]:
        'export const jobs = () => new Worker(new URL("./jobs-worker.ts", import.meta.url), { type: "module" });',
      "src/features/board-document/adapters/jobs-worker.ts":
        "export const calculate = () => 1;",
    },
    { owners: { [file]: ["worker", "url"] } },
  );
});

test("transitive worker graphs reject DOM, native Canvas and React even when file is an allowed browser owner", () => {
  const file = "src/features/board-document/adapters/jobs.ts";

  const files = {
    [file]: 'new Worker(new URL("./jobs-worker.ts", import.meta.url));',
    "src/features/board-document/adapters/jobs-worker.ts":
      "import { paint } from './paint'; export { paint };",
    "src/features/board-document/adapters/paint.ts":
      'export const paint = () => document.createElement("canvas");',
  };

  rejects(files, "worker-platform", {
    owners: {
      [file]: ["worker", "url"],
      "src/features/board-document/adapters/paint.ts": ["dom"],
    },
  });

  rejects(
    {
      ...files,
      "src/features/board-document/adapters/paint.ts":
        "import { useState } from 'react'; export const paint = useState;",
    },
    "worker-react",
    { owners: { [file]: ["worker", "url"] } },
  );

  rejects(
    {
      ...files,
      "src/features/board-document/adapters/paint.ts":
        "import type { Paint } from '~/widgets/canvas';",
      "src/widgets/canvas/index.ts":
        "export type { Paint } from './native/paint';",
      "src/widgets/canvas/native/paint.ts": "export type Paint = string;",
    },
    "worker-ui",
    { owners: { [file]: ["worker", "url"] } },
  );
});

const props = {
  "src/widgets/example/example.types.ts":
    "export namespace ExampleTypes { export type Props = { title: string }; }",
};

const view = (body) => ({
  "src/widgets/example/index.ts": "export { Example } from './example';",
  ...props,
  "src/widgets/example/example.tsx": `import type React from 'react'; import type { ExampleTypes } from './example.types'; ${body}`,
});

test("root-qualified props, arrow FC and named effects pass", () => {
  accepts(
    view(
      "export const Example: React.FC<ExampleTypes.Props> = (props) => { React.useEffect(function mountFx() {}, []); return <span>{props.title}</span>; };",
    ),
  );
});

test("component syntax, root props, nesting and one component per file are checked", () => {
  rejects(
    view("export function Example() { return <span />; }"),
    "component-arrow",
  );

  rejects(view("export const Example = () => <span />;"), "component-fc");

  rejects(
    view(
      "export const Example: React.FC<{title:string}> = (props) => <span>{props.title}</span>;",
    ),
    "component-props",
  );

  rejects(
    view(
      "export const Example: React.FC<ExampleTypes.Props> = (props) => { const Nested: React.FC = () => <b />; return <Nested />; };",
    ),
    "nested-component",
  );

  rejects(
    view(
      "export const Example: React.FC = () => <span />; export const Other: React.FC = () => <b />;",
    ),
    "one-component",
  );

  rejects(
    {
      "src/widgets/example/example.tsx":
        'import type React from "react"; export const Example: React.FC<ExampleTypes.Props> = () => <b />;',
    },
    "component-types-file",
  );
});

test("object props and hook results stay named, while useState tuples and default props pass", () => {
  rejects(
    view(
      "export const Example: React.FC<ExampleTypes.Props> = ({title}) => <span>{title}</span>;",
    ),
    "props-destructure",
  );

  rejects(
    view(
      "export const Example: React.FC = () => { const { data } = useBoard(); return <span>{data}</span>; };",
    ),
    "hook-destructure",
  );

  accepts(
    view(
      'export const Example: React.FC<ExampleTypes.Props> = ({title = "default"}) => { const [value, setValue] = useState(1); const board = useBoard(); return <span>{title}{board.data}{value}</span>; };',
    ),
  );
});

test("thin purpose-named forwarding props are the only rest exception", () => {
  accepts(
    view(
      "export const Example: React.FC<ExampleTypes.Props> = ({...buttonProps}) => <button {...buttonProps} />;",
    ),
  );

  rejects(
    view(
      "export const Example: React.FC<ExampleTypes.Props> = ({...props}) => <button {...props} />;",
    ),
    "props-destructure",
  );
});

test("anonymous effects, JSX helper constants, interfaces and non-kebab paths fail", () => {
  rejects(
    view(
      "export const Example: React.FC = () => { useEffect(() => {}, []); return <span />; };",
    ),
    "effect-name",
  );

  rejects(
    view(
      "const content = <span />; export const Example: React.FC = () => content;",
    ),
    "jsx-helper",
  );

  rejects(
    { "src/entities/board/model.ts": "export interface Board { id: string }" },
    "interface",
  );

  rejects(
    { "src/entities/board/BoardModel.ts": "export type Board = string;" },
    "kebab-path",
  );
});

test("shared helpers expose namespace objects; stateful domain classes remain classes", () => {
  rejects(
    {
      "src/shared/lib/math/math.ts":
        "export const add = (a: number, b: number) => a+b;",
    },
    "helper-namespace",
  );

  rejects(
    {
      "src/shared/lib/math/math.ts":
        "export function add(a: number, b: number) { return a+b; }",
    },
    "helper-namespace",
  );

  accepts({
    "src/entities/board/history.ts":
      "export class BoardHistory { private value = 0; add() { this.value++; } }",
  });
});

test("views cannot acquire browser ownership by allowlisting themselves", () => {
  const file = "src/widgets/example/example.tsx";

  rejects(
    { [file]: "export const read = () => window.innerWidth;" },
    "platform-owner",
    { owners: { [file]: ["dom"] } },
  );
});

test("domain fixture specs pass with no raw drivers, data or assertion construction", () => {
  accepts({
    "e2e/board.spec.ts":
      "import { test } from './fixtures'; test('save', async ({ board, secondBoard }) => { await board.drawNote(); await board.assertSaved(); await secondBoard.assertReadOnly(); });",
    "e2e/fixtures.ts": "export const test = () => {};",
  });
});

test("specs reject direct Playwright imports, built-in fixtures, low-level calls, assertions and Page Objects", () => {
  const files = {
    "e2e/board.spec.ts":
      "import { test, expect } from '@playwright/test'; test('bad', async ({ page, context, request }, testInfo) => { const board = new BoardPage(page); await page.goto('/'); expect(board).toBeTruthy(); });",
  };

  for (const rule of [
    "e2e-fixtures",
    "e2e-domain-fixture",
    "e2e-driver",
    "e2e-assertion",
    "e2e-construction",
    "e2e-test-info",
  ])
    rejects(files, rule);
});

test("test scaffolding can use platform mocks; declaration files can describe generated interfaces", () => {
  accepts({
    "src/entities/board/model.test.ts":
      "interface Mock { value: string } export const mock = () => window.innerWidth;",
    "src/generated.d.ts": "interface Generated { value: string }",
  });
});

test("qualified globals and shorthand references retain capability ownership", () => {
  const file = "src/features/document/adapters/platform.ts";

  rejects({ [file]: 'window.indexedDB.open("x");' }, "platform-owner", {
    owners: { [file]: ["dom"] },
  });

  rejects(
    { "src/entities/board/model.ts": "export const globals = { document };" },
    "entity-platform",
  );

  accepts({
    "src/entities/board/model.ts":
      'export const maximum = globalThis["Math"].max(1, 2);',
  });
});

test("worker DOM access through self and uninspectable worker entrypoints fail", () => {
  const file = "src/features/document/adapters/jobs.ts";
  const worker = "src/features/document/adapters/worker.ts";

  rejects(
    {
      [file]: 'new Worker(new URL("./worker.ts", import.meta.url));',
      [worker]: 'self.document.createElement("canvas");',
    },
    "worker-platform",
    { owners: { [file]: ["worker", "url"], [worker]: ["worker-scope"] } },
  );

  rejects(
    { [file]: 'new Worker("./worker.ts");', [worker]: "export {};" },
    "worker-entry",
    { owners: { [file]: ["worker"] } },
  );
});

test("entities cannot acquire browser dependencies indirectly through shared helpers", () => {
  rejects(
    {
      "src/entities/board/model.ts":
        'import { clock } from "~/shared/lib/clock"; export const model = clock;',
      "src/shared/lib/clock/index.ts":
        "export const clock = { now: () => performance.now() };",
    },
    "entity-platform",
    { owners: { "src/shared/lib/clock/index.ts": ["clock"] } },
  );
});

test("body props destructuring and null-returning untyped components fail", () => {
  rejects(
    view(
      "export const Example: React.FC<ExampleTypes.Props> = (props) => { const {title} = props; return <b>{title}</b>; };",
    ),
    "props-destructure",
  );

  rejects(
    view("export function Example() { return null; }"),
    "component-arrow",
  );
});

test("specs cannot hide built-in fixtures or construct domain data inline", () => {
  rejects(
    {
      "e2e/board.spec.ts":
        'import {test} from "./fixtures"; test("bad", async fixtures => { await fixtures.page.mouse.move(0, 0); });',
    },
    "e2e-domain-fixture",
  );

  rejects(
    {
      "e2e/board.spec.ts":
        'import {test} from "./fixtures"; test("bad", async ({board}) => { await board.importNote({ strokes: [] }); });',
    },
    "e2e-data",
  );
});

test("shared public namespaces may compose peers and views may import colocated CSS", () => {
  accepts({
    "src/shared/lib/first/index.ts": "export const first = {value: 1};",
    "src/shared/lib/second/index.ts":
      'import {first} from "~/shared/lib/first"; export const second = {value: first.value};',
    ...view(
      'import styles from "./example.module.css"; export const Example: React.FC<ExampleTypes.Props> = (props) => <b className={styles.title}>{props.title}</b>;',
    ),
  });
});

test("local URL and Worker constructor shadows do not create execution edges", () => {
  accepts({
    "src/entities/board/model.ts":
      'export const model = (URL: new (name: string, base: string) => unknown, Worker: new (value: unknown) => unknown) => new Worker(new URL("./not-a-worker.ts", import.meta.url));',
  });
});

test("JSX is kept in views rather than model files", () => {
  rejects(
    {
      "src/features/document/model/example.tsx":
        'import type React from "react"; export const Example: React.FC = () => <b />;',
    },
    "jsx-file",
  );
});

test("bracket access retains exact storage, clipboard and locks ownership", () => {
  const file = "src/widgets/workspace/native/presenter.ts";

  const expressions = [
    'window["localStorage"].getItem("note")',
    'window[`sessionStorage`].getItem("note")',
    'self["indexedDB"].open("note")',
    'navigator["clipboard"].readText()',
    'navigator[`locks`].request("note", () => {})',
    'window["navigator"]["clipboard"].readText()',
    'globalThis["navigator"]["locks"].request("note", () => {})',
    'const browser = window; browser["localStorage"].getItem("note")',
    'const browserNavigator = navigator; browserNavigator["clipboard"].readText()',
  ];

  for (const expression of expressions)
    rejects({ [file]: `${expression}; export {};` }, "platform-owner", {
      owners: { [file]: ["dom", "worker-scope"] },
    });

  accepts(
    {
      [file]:
        'window["localStorage"].getItem("note"); navigator["clipboard"].readText(); navigator["locks"].request("note", () => {});',
    },
    { owners: { [file]: ["dom", "storage", "clipboard", "locks"] } },
  );

  accepts(
    {
      [file]:
        'navigator["clipboard"].readText(); navigator["locks"].request("note", () => {});',
    },
    { owners: { [file]: ["clipboard", "locks"] } },
  );
});

test("global binding aliases and nested destructuring retain capability checks", () => {
  const file = "src/widgets/workspace/native/presenter.ts";

  for (const expression of [
    'const { localStorage: storage } = window; storage.getItem("note")',
    "const { clipboard } = navigator; clipboard.readText()",
    'const { ["locks"]: manager } = navigator; manager.request("note", () => {})',
    "const { navigator: { clipboard } } = window; clipboard.readText()",
    "export const read = ({ clipboard }: Navigator) => clipboard.readText()",
  ])
    rejects({ [file]: `${expression}; export {};` }, "platform-owner", {
      owners: { [file]: ["dom"] },
    });

  accepts(
    {
      [file]:
        'const {clipboard} = navigator; const {locks: manager} = navigator; clipboard.readText(); manager.request("note", () => {});',
    },
    { owners: { [file]: ["clipboard", "locks"] } },
  );
});

test("computed access, namespace rest, spread and assignment cannot hide native capabilities", () => {
  const file = "src/widgets/workspace/native/presenter.ts";

  for (const expression of [
    'const key: string = "localStorage"; window[key]',
    "const {...browser} = window",
    "const {...browserNavigator} = navigator",
    "const browser = {...window}",
    "let storage; ({localStorage: storage} = window)",
  ])
    rejects({ [file]: `${expression}; export {};` }, "global-escape", {
      owners: { [file]: ["dom"] },
    });
});

test("local shadows retain ordinary bracket access, destructuring and rest", () => {
  accepts({
    "src/entities/board/model.ts": `
    type Store = {getItem: (key: string) => string};
    type BrowserModel = {localStorage: Store; clipboard: {readText: () => string}; locks: {read: () => string}};
    export const model = (window: BrowserModel, navigator: BrowserModel, self: BrowserModel, globalThis: BrowserModel) => {
      const {localStorage: storage, ...others} = window;
      const {clipboard} = navigator;
      const {locks} = self;
      const key = 'localStorage';
      return [window['localStorage'].getItem('note'), navigator['clipboard'].readText(), self['locks'].read(), globalThis[key].getItem('note'), storage.getItem('note'), others.clipboard.readText(), clipboard.readText(), locks.read()];
    };
  `,
  });
});
