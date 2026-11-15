import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18n } from "~/shared/lib/i18n";
import { BackgroundControl } from "./background-control";

describe("localized background labels", () => {
  it.each([
    ["en", "Background contrast", "Background spacing"],
    ["ru", "Контраст фона", "Шаг фона"],
  ] as const)(
    "separates labels from their semantic outputs in %s",
    async (language, contrast, spacing) => {
      await I18n.initialize(language);
      await I18n.instance.changeLanguage(language);

      const markup = renderToStaticMarkup(
        createElement(BackgroundControl, {
          background: "grid",
          settings: { contrast: 45, spacing: 24 },
          readOnly: false,

          onSettingsChange: () => {},

          onBackgroundChange: () => {},
        }),
      );

      expect(markup).toContain(`>${contrast} <output>45%</output>`);
      expect(markup).toContain(`>${spacing} <output>24</output>`);
    },
  );
});
