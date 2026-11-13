import type {
  BoardAppearance,
  BoardColor,
  BoardIcon,
} from "../../board-document.types";

const colors: readonly BoardColor[] = [
  "blue",
  "teal",
  "green",
  "amber",
  "orange",
  "red",
  "violet",
  "pink",
];

const icons: readonly BoardIcon[] = [
  "notebook",
  "book",
  "calculator",
  "languages",
  "flask",
  "atom",
  "code",
  "briefcase",
  "lightbulb",
  "music",
  "palette",
  "globe",
  "calendar",
  "folder",
  "graduation",
  "pen",
];

function valid(value: unknown): value is BoardAppearance {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const appearance = value as Record<string, unknown>;

  return (
    colors.includes(appearance.color as BoardColor) &&
    icons.includes(appearance.icon as BoardIcon)
  );
}

function key(value: BoardAppearance): string {
  return `${value.color}/${value.icon}`;
}

function assign(id: string, used: ReadonlySet<string>): BoardAppearance {
  let hash = 2166136261;

  for (const character of id)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;

  for (let offset = 0; offset < 128; offset++) {
    const pair = (hash + offset) % 128;

    const appearance = {
      color: colors[pair % 8]!,
      icon: icons[Math.floor(pair / 8)]!,
    };

    if (!used.has(key(appearance))) return appearance;
  }

  return { color: "blue", icon: "notebook" };
}

export const LibraryAppearance = { colors, icons, valid, key, assign };
