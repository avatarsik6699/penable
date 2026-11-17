import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemePreferences } from "./theme-platform";

function environment(saved: string | null = null, denied = false) {
  const media = Object.assign(new EventTarget(), { matches: true });

  const host = Object.assign(new EventTarget(), {
    matchMedia: vi.fn(() => media),
  });

  const root = {
    dataset: { theme: "" },
    style: { colorScheme: "", setProperty: vi.fn() },
  };

  const storage = {
    getItem: vi.fn(() => {
      if (denied) throw new Error("Denied");

      return saved;
    }),
    setItem: vi.fn((_key: string, value: string) => {
      if (denied) throw new Error("Denied");

      saved = value;
    }),
  };

  vi.stubGlobal("window", host);
  vi.stubGlobal("document", { documentElement: root });
  vi.stubGlobal("localStorage", storage);

  return {
    media,
    host,
    root,
    storage,

    system(dark: boolean) {
      media.matches = dark;
      media.dispatchEvent(new Event("change"));
    },

    received(
      value: string | null,
      key: string | null = "penable:theme",
      area = storage,
    ) {
      host.dispatchEvent(
        Object.assign(new Event("storage"), {
          key,
          newValue: value,
          storageArea: area,
        }),
      );
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("application theme preference lifecycle", () => {
  it("starts light on a dark system and applies a saved choice before any subscription", () => {
    const e = environment();
    const preferences = new ThemePreferences();

    expect(preferences.getSnapshot()).toEqual({
      preference: "light",
      theme: "light",
      persistenceUnavailable: false,
    });

    expect(e.root.dataset.theme).toBe("light");
    expect(e.root.style.colorScheme).toBe("light");

    expect(e.root.style.setProperty).toHaveBeenCalledWith(
      "--ink-182230",
      "#182230",
    );

    preferences.change("dark");
    expect(e.storage.setItem).toHaveBeenCalledWith("penable:theme", "dark");

    const reloaded = new ThemePreferences();

    expect(reloaded.getSnapshot().theme).toBe("dark");

    expect(e.root.style.setProperty).toHaveBeenCalledWith(
      "--ink-182230",
      "#e8edf4",
    );
  });

  it("follows native changes only in System and deduplicates immutable snapshots", () => {
    const e = environment("system");
    const preferences = new ThemePreferences();
    const changed = vi.fn();
    const unbind = preferences.subscribe(changed);
    const stop = preferences.start();
    const original = preferences.getSnapshot();

    e.system(true);
    expect(preferences.getSnapshot()).toBe(original);
    expect(changed).not.toHaveBeenCalled();
    e.system(false);
    expect(preferences.getSnapshot().theme).toBe("light");
    expect(changed).toHaveBeenCalledOnce();
    preferences.change("dark");

    const manual = preferences.getSnapshot();

    e.system(true);
    expect(preferences.getSnapshot()).toBe(manual);
    unbind();
    stop();
    e.received("light");
    expect(preferences.getSnapshot()).toBe(manual);
  });

  it("handles cross-tab change/clear without writing back, ignores other storage, and restarts after cleanup", () => {
    const e = environment();
    const preferences = new ThemePreferences();
    const stop = preferences.start();

    e.received("dark");
    expect(preferences.getSnapshot().theme).toBe("dark");
    expect(e.storage.setItem).not.toHaveBeenCalled();
    e.received("light", "unrelated");
    expect(preferences.getSnapshot().theme).toBe("dark");
    e.received("light", "penable:theme", { ...e.storage });
    expect(preferences.getSnapshot().theme).toBe("dark");
    e.received(null, null);
    expect(preferences.getSnapshot().theme).toBe("light");
    stop();

    const stopAgain = preferences.start();

    e.received("system");
    expect(preferences.getSnapshot().theme).toBe("dark");
    stopAgain();
  });

  it("allows in-memory theme changes after preference storage denial", () => {
    const e = environment(null, true);
    const preferences = new ThemePreferences();
    const stop = preferences.start();

    preferences.change("dark");

    expect(preferences.getSnapshot()).toEqual({
      preference: "dark",
      theme: "dark",
      persistenceUnavailable: true,
    });

    expect(e.root.dataset.theme).toBe("dark");
    preferences.change("system");
    e.system(false);

    expect(preferences.getSnapshot()).toEqual({
      preference: "system",
      theme: "light",
      persistenceUnavailable: true,
    });

    stop();
  });
});
