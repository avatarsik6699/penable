import assert from "node:assert/strict";
import test from "node:test";
import prettier from "prettier";
import ts from "typescript";
import { spaceCode } from "./spacing.mjs";

const format = async (text, file = "fixture.ts") =>
  prettier.format(
    spaceCode(await prettier.format(text, { filepath: file }), file),
    { filepath: file },
  );

const tokens = (text) => {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    text,
  );

  const result = [];

  while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken)
    result.push([scanner.getToken(), scanner.getTokenText()]);

  return result;
};

test("imports stay together while types and implementations are separated", async () => {
  const actual = await format(
    'import {a} from "a";\nimport {b} from "b";\ntype A = number;\nfunction run() {}',
  );

  assert.match(actual, /from "a";\nimport/);
  assert.match(actual, /from "b";\n\ntype/);
  assert.match(actual, /number;\n\nfunction/);
});

test("barrel exports and related simple constants stay compact", () => {
  const original = 'export {a} from "a";\nexport type {B} from "b";';

  assert.equal(spaceCode(original), original);

  const constants = "const a = 1;\nconst b = 2;";

  assert.equal(spaceCode(constants), constants);
});

test("fields stay together but constructors, methods, accessors and arrow actions separate", async () => {
  const actual = await format(
    "class Model {\n a=1;\n b=2;\n constructor(){}\n get value(){return this.a;}\n run=()=>this.a;\n stop(){}\n}",
  );

  assert.match(actual, /a = 1;\n  b = 2;\n\n  constructor/);
  assert.match(actual, /constructor\(\) \{\}\n\n  get value/);
  assert.match(actual, /\n\n  run =/);
  assert.match(actual, /\n\n  stop/);
});

test("guards, declarations, work and return form blocks without separating every assignment", async () => {
  const actual = await format(
    "function run(x: number) {\n if(!x)return;\n const a=x;\n const b=a;\n work(a);\n work(b);\n return b;\n}",
  );

  assert.match(actual, /return;\n\n  const a/);
  assert.match(actual, /const a = x;\n  const b = a;\n\n  work/);
  assert.match(actual, /work\(a\);\n  work\(b\);\n\n  return/);
});

test("multiline operations and object callbacks have breathing room", async () => {
  const actual = await format(
    "function run(){\n load({\n a:1,\n b:2,\n });\n finish();\n}\nconst handlers = {one:()=>{a();},two:()=>{b();}};",
  );

  assert.match(actual, /\}\);\n\n  finish/);
  assert.match(actual, /\},\n\n  two:/);
});

test("inline comments stay with previous code and leading comments stay with the next block", () => {
  const actual = spaceCode(
    "const a = 1; // previous\n// next\nfunction run() {}",
  );

  assert.equal(
    actual,
    "const a = 1; // previous\n\n// next\nfunction run() {}",
  );
});

test("blank lines inside a comment are not mistaken for spacing between blocks", () => {
  const original =
    "const a = 1;\n/** Documentation\n\n * still attached.\n */\nfunction run() {}";

  assert.equal(spaceCode(original), original.replace("1;\n/**", "1;\n\n/**"));
});

test("overload signatures remain attached to their implementation", () => {
  const original =
    "function run(x: string): void;\nfunction run(x: number): void;\nfunction run(x: string | number) {}";

  assert.equal(spaceCode(original), original);

  const member =
    "class Model {\n run(x: string): void;\n run(x: number): void;\n run(x: string | number) {}\n}";

  assert.equal(spaceCode(member), member);
});

test("only whitespace changes; strings, regex, templates, JSX and property lists remain intact", () => {
  const original =
    "const text = `first\nsecond`;\nfunction run(){\n const pattern = /a{2}/g;\n const el = <div>keep  this\ntext</div>;\n return { text, pattern, el };\n}";

  const actual = spaceCode(original, "fixture.tsx");

  assert.deepEqual(tokens(actual), tokens(original));
  assert.ok(actual.includes("<div>keep  this\ntext</div>"));

  assert.equal(
    spaceCode("type Props = {\n a: string;\n b: number;\n};"),
    "type Props = {\n a: string;\n b: number;\n};",
  );
});

test("CRLF and already separated code are stable", () => {
  const original = "function first() {}\r\nfunction next() {}";
  const actual = spaceCode(original);

  assert.equal(actual, "function first() {}\r\n\r\nfunction next() {}");
  assert.equal(spaceCode(actual), actual);
});

test("formatting a single-line input reaches a stable result with Prettier", async () => {
  const original = "function run(){ const x = 1; work(x); return x; }";
  const once = await format(original);

  assert.equal(await format(once), once);
  assert.deepEqual(tokens(once), tokens(original));
});

test("invalid source is rejected before writing", () => {
  assert.throws(() => spaceCode("function broken("), /invalid syntax/);
  assert.equal(spaceCode(""), "");
});

test("short arrow helpers are functions rather than a group of data constants", () => {
  const original = "const first = () => 1;\nconst next = () => 2;";

  assert.equal(
    spaceCode(original),
    "const first = () => 1;\n\nconst next = () => 2;",
  );
});

test("concise callback properties remain a compact configuration group", () => {
  const original =
    "const config = {\n  width: () => 3,\n  viewport: () => view,\n};";

  assert.equal(spaceCode(original), original);
});

test("constructor overload signatures remain a compact group", () => {
  const original =
    "class Model {\n constructor(x: string);\n constructor(x: number);\n constructor(x: string | number) {}\n}";

  assert.equal(spaceCode(original), original);
});
