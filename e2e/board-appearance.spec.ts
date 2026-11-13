import { test } from "./fixtures";

test("protected deletion keeps dialog ownership through Escape, backdrop, cancel and confirm", async ({
  library,
}) => {
  await library.expectProtectedDeleteOwnership();
});

test("board covers persist through rename, reload and manual duplicate choices", async ({
  appearance,
}) => {
  await appearance.expectStableEditableCovers();
});

test("cover draft cancels safely and native radio keyboard choices save without moving canvas", async ({
  appearance,
}) => {
  await appearance.expectDraftCancelAndKeyboard();
});

test("appearance choices and final save remain reachable on compact and short screens", async ({
  appearance,
}) => {
  await appearance.expectCompactEditor();
});

test("catalog1 migrates once with raw backup and100 distinct covers without thumbnail workers", async ({
  legacyAppearance,
}) => {
  await legacyAppearance.expectMigrationAndDistinctCatalog();
});

test("aborted appearance save keeps committed catalog and draft available for retry", async ({
  appearanceFailure,
}) => {
  await appearanceFailure.expectFailedSavePreservesDraft();
});

test("aborted catalog migration preserves the original catalog and board", async ({
  migrationFailureAppearance,
}) => {
  await migrationFailureAppearance.expectFailedMigrationPreservesOriginal();
});

test("readonly catalog1 shows covers without migration or metadata writes", async ({
  readOnlyAppearance,
}) => {
  await readOnlyAppearance.expectReadOnlyWithoutMigration();
});
