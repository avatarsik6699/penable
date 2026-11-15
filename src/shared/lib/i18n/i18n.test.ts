import { beforeAll, afterEach, describe, expect, it } from "vitest";
import { I18n } from "./i18n";
import { Messages } from "~/shared/lib/messages";

beforeAll(() => I18n.initialize("en"));

afterEach(() => I18n.instance.changeLanguage("en"));

describe("interface language resolution", () => {
  it("honors an explicit choice before the browser list", () => {
    expect(I18n.resolve("ru", ["en-US"])).toBe("ru");
    expect(I18n.resolve("en", ["ru-RU"])).toBe("en");
  });

  it("uses the first supported preference and English for unsupported languages", () => {
    expect(I18n.resolve("auto", ["fr-FR", "ru-RU", "en-US"])).toBe("ru");
    expect(I18n.resolve("auto", ["EN-gb", "ru-RU"])).toBe("en");
    expect(I18n.resolve("auto", ["de-DE"])).toBe("en");
    expect(I18n.resolve("auto", [])).toBe("en");
    expect(I18n.preference("invalid")).toBe("auto");
    expect(I18n.preference(null)).toBe("auto");
  });
});

describe("bundled message presentation", () => {
  it("keeps complete resources and identical interpolation parameters", () => {
    expect(Object.keys(Messages.resources.ru).sort()).toEqual(
      Object.keys(Messages.resources.en).sort(),
    );

    for (const code of Object.keys(Messages.resources.en) as Array<
      keyof typeof Messages.resources.en
    >) {
      const params = (text: string) =>
        [...text.matchAll(/{{(\w+)}}/g)].map((entry) => entry[1]).sort();

      expect(Messages.resources.en[code].length, code).toBeGreaterThan(0);

      expect(params(Messages.resources.ru[code]), code).toEqual(
        params(Messages.resources.en[code]),
      );
    }
  });

  it("retranslates a retained worker error with nested parameters", async () => {
    const original = Messages.error(
      Messages.create("invalidDataValue", {
        p0: Messages.create("clipTotalLimitExceeded"),
      }),
    );

    const transferred = structuredClone(Messages.from(original));
    const retained = Messages.from(Messages.error(transferred));

    expect(I18n.text(retained)).toBe(
      "Invalid data: clip: total limit exceeded.",
    );

    await I18n.instance.changeLanguage("ru");

    expect(I18n.text(retained)).toBe(
      "Недопустимые данные: clip: превышен общий предел.",
    );

    expect(Messages.from(Messages.error(retained))).toEqual(transferred);
  });

  it("formats complete text around dynamic titles, counts and error details", async () => {
    expect(I18n.t("boardAppearanceValue", { p0: "Calculus" })).toBe(
      "Board appearance: Calculus",
    );

    expect(I18n.t("backupSummary", { strokes: 2, points: 500 })).toContain(
      "Strokes: 2. Points: 500.",
    );

    expect(
      I18n.t("openThisPageInACurrentSafari", {
        p0: Messages.create("canvas2dIsUnavailableInThisBrowser"),
      }),
    ).toBe(
      "Canvas 2D is unavailable in this browser. Open this page in a current Safari, Chrome or Edge version.",
    );

    await I18n.instance.changeLanguage("ru");

    expect(I18n.t("boardAppearanceValue", { p0: "Алгебра" })).toBe(
      "Оформление доски: Алгебра",
    );

    expect(I18n.t("backupSummary", { strokes: 2, points: 500 })).toContain(
      "В копии: 2 штрихов, 500 точек.",
    );
  });

  it("keeps literal user content and native technical detail intact", () => {
    expect(I18n.text("Мой конспект / My notes")).toBe(
      "Мой конспект / My notes",
    );

    expect(I18n.text(Messages.from(new Error("quota detail")))).toBe(
      "quota detail",
    );

    expect(Messages.from(new Error("quota detail"))).toBe("quota detail");
  });

  it("composes error guidance without discarding its descriptors", async () => {
    const message = Messages.concat(
      Messages.create("couldNotSaveTheCurrentBoard"),
      Messages.create("changesRemainInMemoryDownloadACopy"),
    );

    expect(I18n.text(message)).toContain("Could not save the current board.");
    await I18n.instance.changeLanguage("ru");
    expect(I18n.text(message)).toContain("Не удалось сохранить текущую доску.");
    expect(I18n.text(message)).toContain("Изменения остаются в памяти");
  });
});
