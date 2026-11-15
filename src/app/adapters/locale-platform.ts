import { I18n } from "~/shared/lib/i18n";
import type { I18nTypes } from "~/shared/lib/i18n";

const preferenceKey = "penable:language";

export class LocalePreferences {
  private listeners = new Set<() => void>();
  private snapshot: I18nTypes.Snapshot;
  private attached = false;

  constructor() {
    let preference: I18nTypes.Preference = "auto",
      persistenceUnavailable = false;

    try {
      preference = I18n.preference(localStorage.getItem(preferenceKey));
    } catch {
      persistenceUnavailable = true;
    }

    this.snapshot = {
      preference,
      language: I18n.resolve(
        preference,
        navigator.languages ?? [navigator.language],
      ),
      persistenceUnavailable,
    };
  }

  readonly getSnapshot = () => this.snapshot;

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  private apply(
    preference: I18nTypes.Preference,
    persistenceUnavailable = this.snapshot.persistenceUnavailable,
  ) {
    const language = I18n.resolve(
      preference,
      navigator.languages ?? [navigator.language],
    );

    if (
      this.snapshot.preference === preference &&
      this.snapshot.language === language &&
      this.snapshot.persistenceUnavailable === persistenceUnavailable
    )
      return;

    this.snapshot = { preference, language, persistenceUnavailable };
    void I18n.instance.changeLanguage(language);
    this.metadata();

    for (const listener of this.listeners) listener();
  }

  readonly change = (preference: I18nTypes.Preference) => {
    let unavailable = false;

    try {
      if (preference === "auto") localStorage.removeItem(preferenceKey);
      else localStorage.setItem(preferenceKey, preference);
    } catch {
      unavailable = true;
    }

    this.apply(preference, unavailable);
  };

  private readonly browserLanguageChanged = () => {
    if (this.snapshot.preference === "auto") this.apply("auto");
  };

  private readonly storageChanged = (event: StorageEvent) => {
    if (event.key !== preferenceKey && event.key !== null) return;

    this.apply(I18n.preference(event.newValue), false);
  };

  private metadata() {
    document.documentElement.lang = this.snapshot.language;
    document.title = I18n.t("applicationTitle");

    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", I18n.t("applicationDescription"));
  }

  start() {
    if (!this.attached) {
      window.addEventListener("languagechange", this.browserLanguageChanged);
      window.addEventListener("storage", this.storageChanged);
      this.attached = true;
    }

    this.metadata();

    return () => {
      window.removeEventListener("languagechange", this.browserLanguageChanged);
      window.removeEventListener("storage", this.storageChanged);
      this.attached = false;
    };
  }
}
