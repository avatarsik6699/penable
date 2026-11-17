import type { ThemeTypes } from "./theme.types";

const darkColors: Readonly<Record<string, string>> = {
  "#182230": "#e8edf4",
  "#667085": "#a8b4c6",
  "#175cd3": "#84adff",
  "#0ba5ec": "#7cd4fd",
  "#0e9384": "#5fe9d0",
  "#2e7d32": "#81ce89",
  "#f4c430": "#f4d35e",
  "#e87518": "#ffad66",
  "#d92d20": "#ff8a80",
  "#7f56d9": "#bda4ff",
};

function preference(value: unknown): ThemeTypes.Preference {
  return value === "dark" || value === "system" ? value : "light";
}

function resolve(
  value: ThemeTypes.Preference,
  systemDark: boolean,
): ThemeTypes.Effective {
  return value === "system" ? (systemDark ? "dark" : "light") : value;
}

function color(value: string, theme: ThemeTypes.Effective = "light"): string {
  return theme === "dark" && Object.hasOwn(darkColors, value)
    ? darkColors[value]!
    : value;
}

function cssColor(value: string): string {
  return Object.hasOwn(darkColors, value)
    ? `var(--ink-${value.slice(1)}, ${value})`
    : value;
}

export const Theme = {
  preference,
  resolve,
  color,
  cssColor,
  colors: Object.freeze(Object.keys(darkColors)),
};
