import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18n } from "~/shared/lib/i18n";
import { TemplateDraft } from "../../modules/draft";
import { MathSettings } from "./math-settings";
import type { MathSettingsTypes } from "./math-settings.types";

describe("localized mathematical recommendations", () => {
  it.each([
    ["en", "Apply step 2000", "Step: —", "Step: 2000"],
    ["ru", "Применить шаг 2000", "Шаг: —", "Шаг: 2000"],
  ] as const)(
    "renders complete action and current-step names in %s",
    async (language, action, invalidStep, validStep) => {
      await I18n.initialize(language);
      await I18n.instance.changeLanguage(language);

      let state = TemplateDraft.create("axes");

      state = TemplateDraft.field(state, "min", "-10000");
      state = TemplateDraft.field(state, "max", "10000");

      const valid = state;

      state = TemplateDraft.automatic(state, false);
      state = TemplateDraft.field(state, "step", "0.001");

      expect(state.recommendation).toBe(2000);
      expect(state.error?.field).toBe("step");

      const props: MathSettingsTypes.Props = {
        state,
        disabled: false,

        onField: () => {},

        onAutomatic: () => {},

        onRecommendation: () => {},

        onNumbers: () => {},

        onGrid: () => {},
      };

      const markup = renderToStaticMarkup(createElement(MathSettings, props));

      expect(markup).toContain(`>${action}</button>`);
      expect(markup).toContain(`>${invalidStep}</output>`);

      expect(
        renderToStaticMarkup(
          createElement(MathSettings, { ...props, state: valid }),
        ),
      ).toContain(`>${validStep}</output>`);
    },
  );
});
