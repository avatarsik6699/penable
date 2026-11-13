import assert from "node:assert/strict";
import test from "node:test";
import { checkFiles } from "./check.mjs";

const check = (files, options = {}) =>
  checkFiles(files, { root: "/architecture-module-fixtures", ...options });

const accepts = (files, options) => assert.deepEqual(check(files, options), []);

const rejects = (files, rule, options) => {
  const diagnostics = check(files, options);

  assert.ok(
    diagnostics.some((diagnostic) => diagnostic.rule === rule),
    `Expected ${rule}: ${JSON.stringify(diagnostics)}`,
  );
};

const fractal = {
  "src/entities/board/index.ts":
    "export { selection } from './modules/selection'; export { geometry } from './modules/geometry';",
  "src/entities/board/board.types.ts": "export type Board = { id: string };",
  "src/entities/board/modules/geometry/index.ts":
    "export { geometry } from './geometry';",
  "src/entities/board/modules/geometry/geometry.ts":
    "export const geometry = { point: (x: number) => x };",
  "src/entities/board/modules/selection/index.ts":
    "export { selection } from './selection'; export type { Selection } from './selection.types';",
  "src/entities/board/modules/selection/selection.types.ts":
    "export type Selection = { id: string };",
  "src/entities/board/modules/selection/selection.ts":
    "import type { Board } from '../../board.types'; import { geometry } from '../geometry'; import { contacts } from './modules/contacts'; export const selection = { read: (board: Board) => contacts.read(board.id) + geometry.point(1) };",
  "src/entities/board/modules/selection/modules/contacts/index.ts":
    "export { contacts } from './contacts';",
  "src/entities/board/modules/selection/modules/contacts/contacts.ts":
    "import type { Selection } from '../../selection.types'; export const contacts = { read: (id: Selection['id']) => id };",
};

test("recursive public children, sibling APIs and inward foundational types pass", () =>
  accepts(fractal));

test("all indexed source directories establish boundaries, with no template directory requirement", () => {
  accepts({
    "src/entities/board/index.ts":
      "export { value } from './algorithms/value';",
    "src/entities/board/algorithms/value.ts": "export const value = 1;",
  });

  rejects(
    {
      "src/entities/board/index.ts":
        "export { value } from './algorithms/value';",
      "src/entities/board/algorithms/index.ts":
        "export { value } from './value';",
      "src/entities/board/algorithms/value.ts": "export const value = 1;",
    },
    "child-private",
  );
});

test("root facades cannot reexport a private child implementation or type", () => {
  rejects(
    {
      ...fractal,
      "src/entities/board/index.ts":
        "export { selection } from './modules/selection/selection';",
    },
    "child-private",
  );

  rejects(
    {
      ...fractal,
      "src/entities/board/index.ts":
        "export type { Selection } from './modules/selection/selection.types';",
    },
    "child-private",
  );
});

test("a public descendant cannot bypass the public boundary of its containing child", () => {
  rejects(
    {
      ...fractal,
      "src/entities/board/index.ts":
        "export { contacts } from './modules/selection/modules/contacts';",
    },
    "child-private",
  );
});

test("same-child private imports pass while private sibling imports fail across all dependency forms", () => {
  for (const statement of [
    "import { geometry } from '../geometry/geometry';",
    "export { geometry } from '../geometry/geometry';",
    "type Geometry = import('../geometry/geometry').geometry;",
    "const load = import('../geometry/geometry');",
    "const load = require('../geometry/geometry');",
  ])
    rejects(
      {
        ...fractal,
        "src/entities/board/modules/selection/selection.ts": statement,
      },
      "child-private",
    );
});

test("own and ancestor barrel imports fail even when only types are imported", () => {
  rejects(
    {
      ...fractal,
      "src/entities/board/modules/selection/selection.ts":
        "import type { Selection } from './index'; export const selection = {};",
    },
    "own-barrel",
  );

  rejects(
    {
      ...fractal,
      "src/entities/board/modules/selection/modules/contacts/contacts.ts":
        "import type { Selection } from '../../index'; export const contacts = {};",
    },
    "ancestor-barrel",
  );

  rejects(
    {
      ...fractal,
      "src/entities/board/modules/selection/modules/contacts/contacts.ts":
        "import type { Board } from '../../../../index'; export const contacts = {};",
    },
    "ancestor-barrel",
  );
});

test("sibling public API cycles still fail", () => {
  rejects(
    {
      ...fractal,
      "src/entities/board/modules/geometry/geometry.ts":
        "import { selection } from '../selection'; export const geometry = { selection };",
    },
    "cycle",
  );
});

test("recursive components have a local public root and root-qualified colocated props", () => {
  accepts({
    "src/widgets/workspace/index.ts":
      "export { Workspace } from './workspace';",
    "src/widgets/workspace/workspace.tsx":
      "import type React from 'react'; import { Tools } from './components/tools'; export const Workspace: React.FC = () => <Tools title='Pen' />;",
    "src/widgets/workspace/components/tools/index.ts":
      "export { Tools } from './tools';",
    "src/widgets/workspace/components/tools/tools.tsx":
      "import type React from 'react'; import type { ToolsTypes } from './tools.types'; import { Label } from './components/label'; export const Tools: React.FC<ToolsTypes.Props> = (props) => <Label title={props.title} />;",
    "src/widgets/workspace/components/tools/tools.types.ts":
      "export namespace ToolsTypes { export type Props = { title: string }; }",
    "src/widgets/workspace/components/tools/components/label/index.ts":
      "export { Label } from './label';",
    "src/widgets/workspace/components/tools/components/label/label.tsx":
      "import type React from 'react'; import type { LabelTypes } from './label.types'; export const Label: React.FC<LabelTypes.Props> = (props) => <b>{props.title}</b>;",
    "src/widgets/workspace/components/tools/components/label/label.types.ts":
      "export namespace LabelTypes { export type Props = { title: string }; }",
  });
});

test("flat UI collections and generic types, utils and config filenames fail", () => {
  rejects(
    {
      "src/widgets/workspace/ui/label.tsx":
        "import type React from 'react'; export const Label: React.FC = () => <b />;",
    },
    "legacy-ui",
  );

  for (const name of ["types", "utils", "config"])
    rejects(
      { [`src/entities/board/${name}.ts`]: "export type Value = string;" },
      "scoped-file",
    );

  accepts({
    "src/entities/board/board.types.ts": "export type Board = string;",
    "src/entities/board/board.config.ts":
      "export const BoardConfig = { limit: 5 };",
    "src/entities/board/board.utils.ts":
      "export const BoardUtils = { valid: () => true };",
  });
});

test("actual useX functions require the corresponding hooks/use-x.ts file", () => {
  accepts({
    "src/widgets/workspace/hooks/use-board.ts":
      "export function useBoard() { return { ready: true }; }",
  });

  accepts({
    "src/widgets/workspace/hooks/use-board-dom.ts":
      "export const useBoardDOM = () => ({ ready: true });",
  });

  for (const implementation of [
    "export function useBoard() { return {}; }",
    "export const useBoard = () => ({});",
    "export const hook = function useBoard() { return {}; };",
    "export const hooks = { useBoard() { return {}; } };",
  ])
    rejects(
      { "src/widgets/workspace/workspace.utils.ts": implementation },
      "hook-location",
    );

  rejects(
    {
      "src/widgets/workspace/hooks/use-other.ts":
        "export const useBoard = () => ({});",
    },
    "hook-location",
  );

  accepts({
    "src/entities/board/board.utils.ts":
      "export const labels = { useBoard: 'copy' }; // function useBoard() {}",
  });
});

test("component and hook files cannot acquire native capabilities; exact nested native owners can", () => {
  const view = "src/widgets/workspace/components/board/board.tsx";
  const hook = "src/widgets/workspace/components/board/hooks/use-board.ts";
  const native = "src/widgets/workspace/components/board/native/platform.ts";

  rejects(
    { [view]: "export const read = () => window.innerWidth;" },
    "platform-owner",
    { owners: { [view]: ["dom"] } },
  );

  rejects(
    { [hook]: "export const useBoard = () => window.innerWidth;" },
    "platform-owner",
    { owners: { [hook]: ["dom"] } },
  );

  accepts(
    { [native]: "export const read = () => window.innerWidth;" },
    { owners: { [native]: ["dom"] } },
  );

  rejects(
    { [native]: "export const read = () => window.innerWidth;" },
    "platform-owner",
    {
      owners: {
        "src/widgets/workspace/components/board/native/neighbor.ts": ["dom"],
      },
    },
  );
});

test("worker execution closure rejects injected hooks without a React import", () => {
  const client = "src/features/document/adapters/jobs.ts";

  rejects(
    {
      [client]: 'new Worker(new URL("./worker.ts", import.meta.url));',
      "src/features/document/adapters/worker.ts":
        "import { useValue } from '../hooks/use-value'; export const compute = useValue;",
      "src/features/document/hooks/use-value.ts":
        "export const useValue = () => 1;",
    },
    "worker-ui",
    { owners: { [client]: ["worker", "url"] } },
  );
});

test("child styles stay private and nested component implementations match their root", () => {
  rejects(
    {
      ...fractal,
      "src/entities/board/modules/selection/selection.ts":
        "import '../geometry/geometry.module.css'; export const selection = {};",
    },
    "child-private",
  );

  rejects(
    {
      "src/widgets/workspace/components/tools/index.ts":
        "export { Label } from './label';",
      "src/widgets/workspace/components/tools/label.tsx":
        "import type React from 'react'; export const Label: React.FC = () => <b />;",
    },
    "jsx-file",
  );
});

test("shared component native adapters retain exact ownership and bootstrap remains explicit", () => {
  const native = "src/shared/ui/button/native/platform.ts";

  accepts(
    { [native]: "export const focus = () => document.activeElement;" },
    { owners: { [native]: ["dom"] } },
  );

  accepts(
    { "src/main.tsx": 'const root = document.getElementById("root");' },
    { owners: { "src/main.tsx": ["dom"] } },
  );

  rejects(
    { "src/main.tsx": 'const root = document.getElementById("root");' },
    "platform-owner",
    { owners: {} },
  );
});

test("nested hooks use their local scoped filenames and function-valued properties are checked", () => {
  accepts({
    "src/widgets/workspace/modules/settings/hooks/use-settings.ts":
      "export const useSettings = () => ({ ready: true });",
  });

  rejects(
    {
      "src/widgets/workspace/workspace.utils.ts":
        'export const hooks = { "useBoard": () => ({}) };',
    },
    "hook-location",
  );

  rejects(
    {
      "src/widgets/workspace/hooks/use-board.ts":
        "export const useBoard = () => ({}); export const useOther = () => ({});",
    },
    "hook-location",
  );

  rejects(
    {
      "src/widgets/workspace/workspace.utils.ts":
        "export const useBoard = (() => ({})) as () => object;",
    },
    "hook-location",
  );

  rejects(
    {
      "src/widgets/workspace/workspace.utils.ts":
        'export const hooks = { ["useBoard"]() { return {}; } };',
    },
    "hook-location",
  );

  accepts({
    "src/widgets/workspace/hooks/use-board.ts":
      "export const useBoard = (() => ({})) as () => object;",
  });
});

test("outer component root implementations match their module name", () => {
  rejects(
    {
      "src/widgets/workspace/index.ts": "export { Other } from './other';",
      "src/widgets/workspace/other.tsx":
        "import type React from 'react'; export const Other: React.FC = () => <b />;",
    },
    "jsx-file",
  );
});
