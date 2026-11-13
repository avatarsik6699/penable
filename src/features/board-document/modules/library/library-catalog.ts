import type { BoardCatalog } from "./library.types";

function title(value: string): string {
  const result = value.trim();

  if (!result.length || result.length > 80)
    throw new Error("Название доски должно содержать от 1 до 80 символов.");

  return result;
}

function decode(value: unknown): BoardCatalog {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Повреждён каталог досок. Исходные данные сохранены.");

  const raw = value as Record<string, unknown>;

  if (
    raw.format !== "penable-library" ||
    raw.schemaVersion !== 1 ||
    !Array.isArray(raw.boards) ||
    !raw.boards.length ||
    raw.boards.length > 100 ||
    typeof raw.activeId !== "string"
  )
    throw new Error("Неподдерживаемый или повреждённый каталог досок.");

  const ids = new Set<string>();

  const boards = raw.boards.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error("Повреждена запись каталога досок.");

    const board = entry as Record<string, unknown>;

    if (
      typeof board.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,160}$/.test(board.id) ||
      ids.has(board.id) ||
      typeof board.title !== "string" ||
      board.title !== title(board.title)
    )
      throw new Error("Недопустимая запись каталога досок.");

    ids.add(board.id);

    return { id: board.id, title: board.title };
  });

  if (!ids.has(raw.activeId))
    throw new Error("Активная доска отсутствует в каталоге.");

  return {
    format: "penable-library",
    schemaVersion: 1,
    activeId: raw.activeId,
    boards,
  };
}

function initial(): BoardCatalog {
  return {
    format: "penable-library",
    schemaVersion: 1,
    activeId: "main",
    boards: [{ id: "main", title: "Моя доска" }],
  };
}

export const LibraryCatalog = { title, decode, initial };
