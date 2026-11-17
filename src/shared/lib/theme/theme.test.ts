import { describe, expect, it } from "vitest";
import { Theme } from "./theme";

describe("theme display colors", () => {
  it("keeps every canonical palette color exact in light mode and offers a brighter paired dark color", () => {
    for (const color of Theme.colors) {
      expect(Theme.color(color)).toBe(color);
      expect(Theme.color(color, "light")).toBe(color);
      expect(Theme.color(color, "dark")).not.toBe(color);
      expect(Theme.cssColor(color)).toContain(color);
      expect(Theme.color(color, "light")).toBe(color);
    }
  });

  it("keeps unrecognized primitive colors untouched and resolves only valid preferences", () => {
    expect(Theme.color("transparent", "dark")).toBe("transparent");
    expect(Theme.cssColor("none")).toBe("none");
    expect(Theme.color("constructor", "dark")).toBe("constructor");
    expect(Theme.cssColor("toString")).toBe("toString");
    expect(Theme.preference(null)).toBe("light");
    expect(Theme.preference("invalid")).toBe("light");
    expect(Theme.resolve("light", true)).toBe("light");
    expect(Theme.resolve("dark", false)).toBe("dark");
    expect(Theme.resolve("system", true)).toBe("dark");
    expect(Theme.resolve("system", false)).toBe("light");
  });
});
