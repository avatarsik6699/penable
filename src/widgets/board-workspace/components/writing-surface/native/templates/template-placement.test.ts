import { describe, expect, it, vi } from "vitest";
import { BoardTemplates, type TemplateItem } from "~/entities/board";
import { TemplatePlacement } from "./template-placement";

function harness() {
  let allowed = true,
    viewport = { x: 20, y: 30, zoom: 2 };

  const draw = vi.fn(),
    notice = vi.fn(),
    insert = vi.fn(async (_item: TemplateItem) => true);

  const placement = new TemplatePlacement({
    allowed: () => allowed,
    viewport: () => viewport,
    bounds: () => ({ left: 10, top: 20, width: 1000, height: 800 }),
    allocate: () => 7,
    draw,
    notice,
    insert,
  });

  return {
    placement,
    draw,
    notice,
    insert,

    disable: () => {
      allowed = false;
    },

    view: (value: typeof viewport) => {
      viewport = value;
    },
  };
}

describe("template placement ownership", () => {
  it("previews outside scene state, maps the chosen cursor to world space and inserts exactly once", () => {
    const h = harness();

    h.placement.arm(BoardTemplates.defaults("rectangle"));
    expect(h.insert).not.toHaveBeenCalled();
    expect(h.placement.active).toBe(true);
    h.placement.place(510, 420);
    expect(h.insert).toHaveBeenCalledOnce();

    const item = h.insert.mock.calls[0]![0];

    expect(item.id).toBe(7);
    expect(item.matrix).toEqual([0.5, 0, 0, 0.5, 160, 105]);
    expect(h.placement.place(510, 420)).toBe(false);
    expect(h.placement.active).toBe(false);
  });

  it("cancels without insertion and follows pan/zoom coordinates until permission is lost", () => {
    const h = harness();

    h.placement.arm(BoardTemplates.defaults("circle"));
    h.placement.move(510, 420);
    h.view({ x: 40, y: 50, zoom: 4 });
    h.placement.refresh();

    expect(h.draw.mock.lastCall![0]).toMatchObject({
      generatorVersion: 2,
      matrix: [0.5, 0, 0, 0.5, -5, -32.5],
    });

    h.disable();
    h.placement.refresh();
    expect(h.placement.active).toBe(false);
    expect(h.draw).toHaveBeenLastCalledWith(null);
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("uses explicit dimensions as world units and only shrinks them to fit the viewport", () => {
    const h = harness(),
      config = {
        ...BoardTemplates.defaults("rectangle"),
        width: 80,
        height: 80,
      };

    h.placement.arm(config, true);
    h.placement.place(510, 420);
    expect(h.insert.mock.calls[0]![0].matrix[0]).toBe(1);

    const big = harness();

    big.placement.arm({ ...config, width: 600, height: 400 }, true);
    big.placement.place(510, 420);
    expect(big.insert.mock.calls[0]![0].matrix[0]).toBeCloseTo(952 / 1200);
  });
});

it("places large mathematical lettering at nominal screen size around its actual origin without fitting it to 320px", () => {
  const h = harness();

  h.placement.arm({
    ...BoardTemplates.defaults("axes"),
    min: -100,
    max: 100,
    step: 1,
  });

  h.placement.place(510, 420);

  const item = h.insert.mock.calls[0]![0];

  expect(item.generatorVersion).toBe(2);
  expect(item.matrix[0]).toBe(0.5);
  expect(item.template.width).toBeGreaterThan(8000);

  const origin = BoardTemplates.origin(item.template, 2);

  expect(item.matrix[4] + origin.x * item.matrix[0]).toBe(240);
  expect(item.matrix[5] + origin.y * item.matrix[3]).toBe(185);
});

it("anchors the visible zero of a positive large range at the chosen point", () => {
  const h = harness();

  h.placement.arm({
    ...BoardTemplates.defaults("axes"),
    min: 0,
    max: 100,
    step: 1,
  });

  h.placement.place(510, 420);

  const item = h.insert.mock.calls[0]![0],
    origin = BoardTemplates.origin(item.template, 2);

  expect(item.matrix[4] + origin.x * item.matrix[0]).toBe(240);
  expect(item.matrix[5] + origin.y * item.matrix[3]).toBe(185);
  expect(item.matrix[0]).toBe(0.5);
});
