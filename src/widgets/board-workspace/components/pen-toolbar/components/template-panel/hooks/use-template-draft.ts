import { useState } from "react";
import type { TemplateConfig, TemplateKind } from "~/entities/board";
import { TemplateDraft, type TemplateDraftTypes } from "../modules/draft";

export const useTemplateDraft = () => {
  const [state, setState] = useState(() => TemplateDraft.create());

  return {
    state,
    change: (patch: Partial<TemplateConfig>) =>
      setState((previous) => TemplateDraft.patch(previous, patch)),
    choose: (kind: TemplateKind) =>
      setState((previous) => TemplateDraft.create(kind, previous.config)),
    field: (name: TemplateDraftTypes.Field, value: string) =>
      setState((previous) => TemplateDraft.field(previous, name, value)),
    automatic: (value: boolean) =>
      setState((previous) => TemplateDraft.automatic(previous, value)),
    applyRecommendation: () =>
      setState((previous) => TemplateDraft.applyRecommendation(previous)),
  };
};
