import { Messages } from "~/shared/lib/messages";
import { describe, expect, it } from "vitest";
import { BoardTemplates } from "~/entities/board";
import { TemplateDraft } from "./template-draft";

describe("template panel drafts", () => {
  it("automatically resolves wide ranges to an insertable concrete configuration", () => {
    let state = TemplateDraft.create("axes");

    state = TemplateDraft.field(state, "min", "-10000");
    state = TemplateDraft.field(state, "max", "10000");
    expect(state.error).toBeNull();
    expect(state.resolved?.step).toBeGreaterThan(1);
    expect(BoardTemplates.validate(state.resolved!, 2)).toBe("");
    expect(state.resolved).not.toHaveProperty("automatic");
  });

  it.each(["", "-", "nonsense", "Infinity", "10001"])(
    "keeps invalid text %j and the last correct preview",
    (draft) => {
      const initial = TemplateDraft.create("axes");
      const state = TemplateDraft.field(initial, "min", draft);

      expect(state.fields.min).toBe(draft);
      expect(state.preview).toBe(initial.preview);
      expect(state.resolved).toBeNull();
      expect(state.error?.field).toBe("min");
    },
  );

  it("explains reversed and zero-excluding ranges at the relevant field", () => {
    const initial = TemplateDraft.create("axes");

    expect(TemplateDraft.field(initial, "max", "-6").error?.field).toBe("max");

    expect(
      Messages.plain(
        TemplateDraft.field(initial, "min", "2").error?.message ?? "",
      ),
    ).toContain("ноль");

    expect(
      Messages.plain(
        TemplateDraft.field(initial, "max", "-1").error?.message ?? "",
      ),
    ).toContain("ноль");
  });

  it("initializes manual mode from effective auto step and offers a valid actionable repair", () => {
    let state = TemplateDraft.field(
      TemplateDraft.create("axes"),
      "max",
      "10000",
    );

    const step = state.resolved!.step;

    state = TemplateDraft.automatic(state, false);
    expect(state.fields.step).toBe(String(step));

    const preview = state.preview;

    state = TemplateDraft.field(state, "step", "0.001");
    expect(state.preview).toBe(preview);
    expect(state.error?.field).toBe("step");
    expect(state.resolved).toBeNull();
    expect(state.recommendation).not.toBeNull();
    state = TemplateDraft.applyRecommendation(state);
    expect(state.error).toBeNull();
    expect(state.automatic).toBe(false);
    expect(state.resolved!.step).toBe(state.recommendation);
  });

  it("repairs overly sparse manual steps and accepts decimal comma", () => {
    let state = TemplateDraft.automatic(
      TemplateDraft.create("number-line"),
      false,
    );

    state = TemplateDraft.field(state, "step", "1000");
    expect(state.resolved).toBeNull();
    expect(TemplateDraft.applyRecommendation(state).resolved).not.toBeNull();
    state = TemplateDraft.field(TemplateDraft.create("axes"), "min", "-0,5");
    expect(state.resolved?.min).toBe(-0.5);
  });

  it("resets drafts on figure change and retains outline color", () => {
    const state = TemplateDraft.patch(TemplateDraft.create("axes"), {
      color: "#175cd3",
    });

    const next = TemplateDraft.create("circle", state.config);

    expect(next.automatic).toBe(true);
    expect(next.config.color).toBe("#175cd3");
    expect(next.resolved).not.toBeNull();
    expect(next.config.width).toBe(next.config.height);
  });
});

it("accepts required manual step1 ranges without silently increasing the step", () => {
  for (const [min, max] of [
    [0, 15],
    [0, 100],
    [-100, 100],
  ]) {
    let state = TemplateDraft.automatic(TemplateDraft.create("axes"), false);

    state = TemplateDraft.field(state, "min", String(min));
    state = TemplateDraft.field(state, "max", String(max));
    state = TemplateDraft.field(state, "step", "1");
    expect(state.error).toBeNull();
    expect(state.resolved?.step).toBe(1);
    expect(state.resolved?.width).toBeGreaterThan(320);
  }
});
