import { describe, expect, it } from "vitest";
import { LibraryCatalog } from "./library-catalog";
import { LibraryAppearance } from "./library-appearance";

function legacy(count = 100) {
  return {
    format: "penable-library",
    schemaVersion: 1,
    activeId: "board-0",
    boards: Array.from({ length: count }, (_, index) => ({
      id: `board-${index}`,
      title: `Доска ${index}`,
    })),
  };
}

describe("board cover catalog compatibility", () => {
  it("derives 100 distinct stable allowlisted pairs and preserves them across rename/reload", () => {
    const raw = legacy();
    const catalog = LibraryCatalog.decode(raw);

    expect(catalog.schemaVersion).toBe(2);

    expect(
      new Set(
        catalog.boards.map((board) => LibraryAppearance.key(board.appearance)),
      ).size,
    ).toBe(100);

    expect(
      catalog.boards.every((board) =>
        LibraryAppearance.valid(board.appearance),
      ),
    ).toBe(true);

    expect(LibraryCatalog.decode(raw)).toEqual(catalog);
    catalog.boards[0]!.title = "Новое название";
    expect(LibraryCatalog.decode(catalog)).toEqual(catalog);

    const appearance = LibraryAppearance.assign(
      "new-board",
      new Set(
        catalog.boards.map((board) => LibraryAppearance.key(board.appearance)),
      ),
    );

    expect(
      catalog.boards.some(
        (board) =>
          LibraryAppearance.key(board.appearance) ===
          LibraryAppearance.key(appearance),
      ),
    ).toBe(false);
  });

  it("retains manual duplicates and reserves explicit pairs before assigning malformed covers", () => {
    const raw = {
      ...legacy(4),
      schemaVersion: 2,
      boards: legacy(4).boards.map((board, index) => ({
        ...board,
        appearance:
          index < 2
            ? { color: "violet", icon: "book" }
            : index === 2
              ? { color: "javascript", icon: "unknown" }
              : null,
      })),
    };

    const catalog = LibraryCatalog.decode(raw);

    expect(catalog.boards[0]!.appearance).toEqual({
      color: "violet",
      icon: "book",
    });

    expect(catalog.boards[1]!.appearance).toEqual(
      catalog.boards[0]!.appearance,
    );

    expect(LibraryAppearance.key(catalog.boards[2]!.appearance)).not.toBe(
      "violet/book",
    );

    expect(catalog.boards[3]!.appearance).not.toEqual(
      catalog.boards[2]!.appearance,
    );

    expect(LibraryCatalog.decode(raw)).toEqual(catalog);
  });

  it.each([
    null,
    "blue",
    [],
    {},
    { color: "blue" },
    { color: "unknown", icon: "pen" },
    { color: "blue", icon: "unknown" },
  ])(
    "falls back on malformed appearance %j without rejecting valid content identity",
    (appearance) => {
      const catalog = LibraryCatalog.decode({
        ...legacy(1),
        schemaVersion: 2,
        boards: [{ ...legacy(1).boards[0], appearance }],
      });

      expect(catalog.boards[0]!.id).toBe("board-0");
      expect(LibraryAppearance.valid(catalog.boards[0]!.appearance)).toBe(true);
    },
  );

  it.each([
    { ...legacy(1), schemaVersion: 3 },
    { ...legacy(1), activeId: "missing" },
    { ...legacy(1), boards: [] },
    { ...legacy(1), boards: new Array(1) },
    { ...legacy(1), boards: [{ id: "bad/id", title: "Доска" }] },
    { ...legacy(1), boards: [{ id: "board-0", title: " bad " }] },
    {
      ...legacy(1),
      boards: [
        { id: "board-0", title: "A" },
        { id: "board-0", title: "B" },
      ],
    },
  ])("rejects structural catalog corruption", (raw) => {
    expect(() => LibraryCatalog.decode(raw)).toThrow();
  });
});
