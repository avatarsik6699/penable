import type { MessageTypes } from "~/shared/lib/messages";
import { Messages } from "~/shared/lib/messages";
import {
  BoardTemplates,
  BoardTemplateSteps,
  type TemplateConfig,
  type TemplateKind,
} from "~/entities/board";
import type { TemplateDraftTypes } from "./template-draft.types";

function parse(value: string): number {
  const text = value.trim().replace(",", ".");

  return text === "" ? NaN : Number(text);
}

function resolve(state: TemplateDraftTypes.State): TemplateDraftTypes.State {
  if (state.config.kind !== "axes" && state.config.kind !== "number-line") {
    return {
      ...state,
      preview: BoardTemplates.prepare(state.config),
      resolved: BoardTemplates.prepare(state.config),
      error: null,
      recommendation: null,
    };
  }

  const min = parse(state.fields.min),
    max = parse(state.fields.max);

  const fail = (
    field: TemplateDraftTypes.Field,
    message: MessageTypes.Value,
    recommendation: number | null = null,
  ): TemplateDraftTypes.State => ({
    ...state,
    resolved: null,
    error: { field, message },
    recommendation,
  });

  if (!Number.isFinite(min))
    return fail("min", Messages.create("enterTheRangeStart"));

  if (Math.abs(min) > 10000)
    return fail("min", Messages.create("startMustBeBetween10000And"));

  if (!Number.isFinite(max))
    return fail("max", Messages.create("enterTheRangeEnd"));

  if (Math.abs(max) > 10000)
    return fail("max", Messages.create("endMustBeBetween10000And"));

  if (min >= max)
    return fail("max", Messages.create("rangeEndMustBeGreaterThanIts"));

  if (min > 0) return fail("min", Messages.create("theRangeMustIncludeZero"));

  if (max < 0) return fail("max", Messages.create("theRangeMustIncludeZero"));

  const config = { ...state.config, min, max };
  const recommendation = BoardTemplateSteps.recommend(config, 2);
  const step = state.automatic ? recommendation : parse(state.fields.step);

  if (step === null)
    return fail("step", Messages.create("couldNotChooseTicksForThisRange"));

  if (!Number.isFinite(step) || step < 0.000001)
    return fail(
      "step",
      Messages.create("enterAStepOfAtLeast0"),
      recommendation,
    );

  const resolved = { ...config, step };
  const error = BoardTemplates.validate(resolved, 2);

  if (error) return fail("step", error, recommendation);

  const prepared = BoardTemplates.prepare(resolved);

  return {
    ...state,
    preview: prepared,
    resolved: prepared,
    recommendation,
    error: null,
  };
}

function create(
  kind: TemplateKind = "rectangle",
  previous?: TemplateConfig,
): TemplateDraftTypes.State {
  const config = {
    ...BoardTemplates.defaults(kind),
    color: previous?.color ?? BoardTemplates.defaults().color,
  };

  return resolve({
    config,
    fields: {
      min: String(config.min),
      max: String(config.max),
      step: String(config.step),
    },
    automatic: true,
    preview: config,
    resolved: config,
    recommendation: null,
    error: null,
  });
}

function patch(
  state: TemplateDraftTypes.State,
  config: Partial<TemplateConfig>,
) {
  return resolve({ ...state, config: { ...state.config, ...config } });
}

function field(
  state: TemplateDraftTypes.State,
  name: TemplateDraftTypes.Field,
  value: string,
) {
  return resolve({ ...state, fields: { ...state.fields, [name]: value } });
}

function automatic(state: TemplateDraftTypes.State, value: boolean) {
  return resolve({
    ...state,
    automatic: value,
    fields: {
      ...state.fields,
      step: String(
        state.resolved?.step ?? state.recommendation ?? state.preview.step,
      ),
    },
  });
}

function applyRecommendation(state: TemplateDraftTypes.State) {
  return state.recommendation === null
    ? state
    : field(state, "step", String(state.recommendation));
}

export const TemplateDraft = {
  create,
  patch,
  field,
  automatic,
  applyRecommendation,
};
