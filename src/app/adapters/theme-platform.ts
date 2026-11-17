import { Theme, type ThemeTypes } from "~/shared/lib/theme";

const preferenceKey = "penable:theme";

export class ThemePreferences {
  private readonly media = window.matchMedia("(prefers-color-scheme: dark)");
  private readonly listeners = new Set<() => void>();
  private snapshot: ThemeTypes.Snapshot;
  private attached = false;

  constructor() {
    let preference: ThemeTypes.Preference = "light",
      persistenceUnavailable = false;

    try {
      preference = Theme.preference(localStorage.getItem(preferenceKey));
    } catch {
      persistenceUnavailable = true;
    }

    this.snapshot = {
      preference,
      theme: Theme.resolve(preference, this.media.matches),
      persistenceUnavailable,
    };

    this.presentation();
  }

  readonly getSnapshot = () => this.snapshot;

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  private apply(
    preference: ThemeTypes.Preference,
    persistenceUnavailable = this.snapshot.persistenceUnavailable,
  ) {
    const theme = Theme.resolve(preference, this.media.matches);

    if (
      preference === this.snapshot.preference &&
      theme === this.snapshot.theme &&
      persistenceUnavailable === this.snapshot.persistenceUnavailable
    )
      return;

    this.snapshot = { preference, theme, persistenceUnavailable };
    this.presentation();

    for (const listener of this.listeners) listener();
  }

  readonly change = (preference: ThemeTypes.Preference) => {
    let persistenceUnavailable = false;

    try {
      localStorage.setItem(preferenceKey, preference);
    } catch {
      persistenceUnavailable = true;
    }

    this.apply(preference, persistenceUnavailable);
  };

  private readonly systemChanged = () => {
    if (this.snapshot.preference === "system") this.apply("system");
  };

  private readonly storageChanged = (event: StorageEvent) => {
    if (event.key !== preferenceKey && event.key !== null) return;

    try {
      if (event.storageArea && event.storageArea !== localStorage) return;
    } catch {
      return;
    }

    this.apply(Theme.preference(event.newValue), false);
  };

  private presentation() {
    const root = document.documentElement;

    root.dataset.theme = this.snapshot.theme;
    root.style.colorScheme = this.snapshot.theme;

    for (const color of Theme.colors)
      root.style.setProperty(
        `--ink-${color.slice(1)}`,
        Theme.color(color, this.snapshot.theme),
      );
  }

  start() {
    if (!this.attached) {
      this.media.addEventListener("change", this.systemChanged);
      window.addEventListener("storage", this.storageChanged);
      this.attached = true;
    }

    this.apply(this.snapshot.preference);
    this.presentation();

    return () => {
      this.media.removeEventListener("change", this.systemChanged);
      window.removeEventListener("storage", this.storageChanged);
      this.attached = false;
    };
  }
}
