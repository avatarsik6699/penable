import { describe, expect, it } from "vitest";
import {
  BoardTemplates,
  type TemplateItem,
  type TextItem,
} from "~/entities/board";
import { DocumentWorkload } from "./document-workload";

it("routes bounded but dense generated mathematics to the worker before point-free metadata bypasses budgets", () => {
  const config = {
    ...BoardTemplates.defaults("axes"),
    min: -100,
    max: 100,
    step: 1,
  };

  const item: TemplateItem = {
    kind: "template",
    id: 1,
    generatorVersion: 2,
    template: config,
    matrix: [1, 0, 0, 1, 0, 0],
  };

  expect(DocumentWorkload.heavyDocument([item])).toBe(true);

  expect(
    DocumentWorkload.heavyDocument([
      {
        ...item,
        generatorVersion: 1 as const,
        template: BoardTemplates.defaults("axes"),
      },
    ]),
  ).toBe(false);
});

it("routes dense text to workers without requiring ink or images", () => {
  const item: TextItem = {
    kind: "text",
    id: 1,
    text: "x".repeat(8000),
    width: 600,
    lines: [0],
    matrix: [1, 0, 0, 1, 0, 0],
  };

  expect(DocumentWorkload.heavyDocument([item])).toBe(false);

  expect(
    DocumentWorkload.heavyDocument(
      Array.from({ length: 5 }, (_, id) => ({ ...item, id: id + 1 })),
    ),
  ).toBe(true);
});

describe("small generated math cost", () => {
  it("accumulates generated geometry across ordinary item counts without inflating raw ink limits", () => {
    const item: TemplateItem = {
      kind: "template",
      id: 1,
      generatorVersion: 2,
      template: BoardTemplates.defaults("circle"),
      matrix: [1, 0, 0, 1, 0, 0],
    };

    expect(DocumentWorkload.heavyDocument([item])).toBe(false);

    expect(
      DocumentWorkload.heavyDocument(
        Array.from({ length: 40 }, (_, id) => ({ ...item, id: id + 1 })),
      ),
    ).toBe(true);
  });
});
