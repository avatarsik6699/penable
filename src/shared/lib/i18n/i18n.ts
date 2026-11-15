import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import { Messages } from "~/shared/lib/messages";
import type { MessageTypes } from "~/shared/lib/messages";
import type { I18nTypes } from "./i18n.types";

const instance = createInstance();
let initialized: Promise<unknown> | undefined;

function initialize(language: I18nTypes.Language): Promise<unknown> {
  initialized ??= instance.use(initReactI18next).init({
    lng: language,
    fallbackLng: "en",
    supportedLngs: ["en", "ru"],
    resources: {
      en: { translation: Messages.resources.en },
      ru: { translation: Messages.resources.ru },
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    initAsync: false,
  });

  return initialized;
}

function parameter(value: MessageTypes.Parameter): string | number | boolean {
  if (Array.isArray(value)) return value.map(parameter).join("");

  if (Messages.is(value)) return translate(value);

  return typeof value === "number" || typeof value === "boolean"
    ? value
    : String(value ?? "");
}

function translate(value: MessageTypes.Descriptor): string {
  const params = Object.fromEntries(
    Object.entries(value.params ?? {}).map(([key, value]) => [
      key,
      parameter(value),
    ]),
  );

  return String(instance.t(value.code, params));
}

function text<T>(value: T): T extends MessageTypes.Descriptor ? string : T {
  return (
    Messages.is(value) ? translate(value) : value
  ) as T extends MessageTypes.Descriptor ? string : T;
}

function t(code: MessageTypes.Code, params?: MessageTypes.Params): string {
  return translate(Messages.create(code, params));
}

function resolve(
  preference: I18nTypes.Preference,
  languages: readonly string[],
): I18nTypes.Language {
  if (preference !== "auto") return preference;

  for (const language of languages) {
    const base = language.toLowerCase().split(/[-_]/)[0];

    if (base === "en" || base === "ru") return base;
  }

  return "en";
}

function preference(value: unknown): I18nTypes.Preference {
  return value === "en" || value === "ru" ? value : "auto";
}

function bind(listener: () => void) {
  instance.on("languageChanged", listener);

  return () => {
    instance.off("languageChanged", listener);
  };
}

export const I18n = {
  instance,
  initialize,
  text,
  t,
  resolve,
  preference,
  bind,
};
