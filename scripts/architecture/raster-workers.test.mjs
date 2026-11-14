import assert from "node:assert/strict";
import test from "node:test";
import { checkFiles } from "./check.mjs";

const base = "src/widgets/board-workspace/components/writing-surface/native";
const launcher = `${base}/rendering/raster-job.ts`;
const worker = `${base}/rendering/thumbnail-worker.ts`;
const painter = `${base}/rendering/paint.ts`;

function fixture() {
  return {
    [launcher]:
      'new Worker(new URL("./thumbnail-worker.ts", import.meta.url));',
    [worker]:
      'import { paint } from "./paint"; import { codec } from "~/features/board-document/worker"; export const render = () => codec(paint());',
    [painter]: "export const paint = () => new OffscreenCanvas(256, 160);",
    "src/features/board-document/index.ts": "export const ui = 1;",
    "src/features/board-document/worker.ts":
      'export { codec } from "./modules/codec";',
    "src/features/board-document/modules/codec.ts":
      "export const codec = (value: unknown) => value;",
  };
}

const check = (files, owners) =>
  checkFiles(files, {
    root: "/architecture-raster-fixtures",
    ...(owners ? { owners } : {}),
  });

function rejects(files, rule, owners) {
  const diagnostics = check(files, owners);

  assert.ok(
    diagnostics.some((entry) => entry.rule === rule),
    JSON.stringify(diagnostics),
  );
}

test("only the registered raster execution root can reach its exact native painter", () => {
  assert.deepEqual(check(fixture()), []);

  rejects(
    {
      ...fixture(),
      "src/features/board-document/adapters/job.ts":
        'new Worker(new URL("./job-worker.ts", import.meta.url));',
      "src/features/board-document/adapters/job-worker.ts": `import { paint } from "~/widgets/board-workspace/components/writing-surface/native/rendering/paint"; export { paint };`,
    },
    "worker-platform",
  );
});

test("writing and template painters extend only the explicit raster execution closure", () => {
  for (const name of ["pressure-paint", "template-paint"]) {
    const child = `${base}/rendering/${name}.ts`;

    const source =
      name === "pressure-paint"
        ? "export const render = () => new Path2D();"
        : "export const render = () => 1;";

    const files = {
      ...fixture(),
      [painter]: `import { render } from "./${name}"; export const paint = render;`,
      [child]: source,
    };

    assert.deepEqual(check(files), []);

    rejects(
      {
        ...files,
        [child]:
          "export const render = () => document.createElement('canvas');",
      },
      "worker-platform",
    );

    rejects(
      {
        ...files,
        "src/features/board-document/adapters/ordinary.ts":
          'new Worker(new URL("./ordinary-worker.ts", import.meta.url));',
        "src/features/board-document/adapters/ordinary-worker.ts": `import { render } from "~/widgets/board-workspace/components/writing-surface/native/rendering/${name}"; export { render };`,
      },
      name === "pressure-paint" ? "worker-platform" : "worker-ui",
    );
  }
});

test("raster exception never admits DOM, frames, clipboard or a nested Worker", () => {
  for (const source of [
    'export const render = () => document.createElement("canvas");',
    "export const render = () => self.document;",
    "export const render = () => requestAnimationFrame(() => {});",
    "export const render = () => navigator.clipboard.read();",
    'new Worker(new URL("./nested-worker.ts", import.meta.url));',
  ]) {
    rejects(
      {
        ...fixture(),
        [worker]: source,
        [`${base}/rendering/nested-worker.ts`]: "export const nested = true;",
      },
      "worker-platform",
    );
  }
});

test("neighbor native files and broad UI barrels remain forbidden in raster closure", () => {
  rejects(
    {
      ...fixture(),
      [worker]: 'import { extra } from "./extra"; export { extra };',
      [`${base}/rendering/extra.ts`]: "export const extra = 1;",
    },
    "worker-ui",
  );

  rejects(
    {
      ...fixture(),
      [worker]: 'import { input } from "../images"; export { input };',
      [`${base}/images/index.ts`]: 'export { input } from "./image-input";',
      [`${base}/images/image-input.ts`]: "export const input = 1;",
    },
    "worker-ui",
  );

  rejects(
    {
      ...fixture(),
      [worker]:
        'import { ui } from "~/features/board-document"; export { ui };',
      "src/features/board-document/index.ts":
        'import { useState } from "react"; export const ui = useState;',
    },
    "worker-react",
  );
});

test("secondary public worker entry is exact and cannot bypass own or private boundaries", () => {
  rejects(
    {
      ...fixture(),
      [worker]:
        'import { other } from "~/features/board-document/other"; export { other };',
      "src/features/board-document/other.ts": "export const other = 1;",
    },
    "private-import",
  );

  rejects(
    {
      ...fixture(),
      "src/features/board-document/model/inside.ts":
        'import { codec } from "../worker"; export const inside = codec;',
    },
    "own-barrel",
  );

  rejects(
    {
      ...fixture(),
      [worker]:
        'import { secret } from "~/features/board-document/modules/secret/private"; export { secret };',
      "src/features/board-document/modules/secret/index.ts":
        "export const value = 1;",
      "src/features/board-document/modules/secret/private.ts":
        "export const secret = 1;",
    },
    "child-private",
  );
});

test("bitmap worker subentry passes without exposing ImageInput through the main images API", () => {
  assert.deepEqual(
    check({
      ...fixture(),
      [worker]:
        'import { cache } from "../images/worker"; export const render = cache;',
      [`${base}/images/index.ts`]: 'export { input } from "./image-input";',
      [`${base}/images/image-input.ts`]:
        'export const input = () => document.createElement("input");',
      [`${base}/images/worker.ts`]: 'export { cache } from "./bitmap-cache";',
      [`${base}/images/bitmap-cache.ts`]:
        "export const cache = () => new OffscreenCanvas(1, 1);",
    }),
    [],
  );
});

test("clipboard reader can preflight bitmaps without granting canvas to document workers", () => {
  const files = {
    "src/features/board-document/adapters/fragment-reader.ts":
      'new Worker(new URL("./fragment-reader-worker.ts", import.meta.url));',
    "src/features/board-document/adapters/fragment-reader-worker.ts":
      'import { validate } from "./image-preflight"; export { validate };',
    "src/features/board-document/adapters/image-preflight.ts":
      "export const validate = () => createImageBitmap(new Blob());",
  };

  assert.deepEqual(check(files), []);

  rejects(
    {
      ...files,
      "src/features/board-document/adapters/job.ts":
        'new Worker(new URL("./job-worker.ts", import.meta.url));',
      "src/features/board-document/adapters/job-worker.ts":
        'import { validate } from "./image-preflight"; export { validate };',
    },
    "worker-platform",
  );
});
