import { test } from "./fixtures";

test("ink commits exactly, persists, supports undo/redo and a protected reload baseline", async ({
  board,
}) => {
  await board.drawAndExpectExactCommitRaster();

  const original = (await board.storage.records()).main!.items;

  await board.undo();
  await board.storage.expectStrokeCount(0);
  await board.redo();
  await board.storage.expectScene(original);
  await board.reopenSavedBoard();
  await board.storage.expectScene(original);
  await board.expectUndoUnavailable();
});

test("partial selection retains margins, clips and restores the exact scene", async ({
  board,
  samples,
}) => {
  await board.drawStroke();
  await board.storage.expectStrokeCount(1);

  const original = (await board.storage.records()).main!.items;

  await board.selectRectangle(samples.selectionStart, samples.selectionEnd);
  await board.expectSelectionSize(130, 120);
  await board.moveSelection(samples.moveStart, samples.moveEnd);
  await board.expectPartialMove(40, 30);

  const moved = (await board.storage.records()).main!.items;

  await board.undo();
  await board.storage.expectScene(original);
  await board.redo();
  await board.storage.expectScene(moved);
});

test("eraser is undoable and cancelled pen input never commits", async ({
  board,
  samples,
}) => {
  await board.drawStroke();
  await board.storage.expectStrokeCount(1);

  const original = (await board.storage.records()).main!.items;

  await board.cancelStroke();
  await board.storage.expectScene(original);
  await board.erase(samples.eraseStart, samples.eraseEnd);
  await board.storage.expectStrokeCount(0);
  await board.undo();
  await board.storage.expectScene(original);
});

test("JSON import/export and invalid import preserve recoverability", async ({
  board,
  documents,
}) => {
  await board.drawStroke();
  await board.storage.expectStrokeCount(1);

  const previous = (await board.storage.records()).main!;

  await board.storage.expectExportMatchesSaved();
  await board.storage.rejectInvalidImport();
  await board.storage.importDocument(documents.empty);
  await board.storage.expectStrokeCount(0);
  await board.storage.expectRecovery("previous", previous);
  await board.reopenSavedBoard();
  await board.storage.expectRecovery("previous", previous);
});

test("library migration keeps original schema1 and independent import backup", async ({
  legacyBoard,
  documents,
  samples,
}) => {
  await legacyBoard.storage.expectStrokeCount(1);
  await legacyBoard.drawStroke(samples.extraStart, samples.extraEnd);
  await legacyBoard.storage.expectStrokeCount(2);
  await legacyBoard.storage.expectRecovery("upgrade4", documents.legacy);
  await legacyBoard.storage.expectRecovery("beforeLibrary", documents.legacy);
  await legacyBoard.storage.expectRecovery("previous", documents.previous);
  await legacyBoard.storage.expectExportMatchesSaved();
});

test("a second tab remains read-only while the writer lease is held", async ({
  board,
  secondBoard,
}) => {
  await board.drawStroke();
  await board.storage.expectStrokeCount(1);
  await secondBoard.storage.expectReadOnly();
  await secondBoard.tryDrawingReadOnly();
  await board.storage.expectStrokeCount(1);
});

test("viewport and responsive layout preserve raw ink", async ({ board }) => {
  await board.drawStroke();
  await board.storage.expectStrokeCount(1);
  await board.expectViewportChangesOnly();
  await board.expectNarrowLayout();
});

test("large selection crosses editor and durable worker boundaries", async ({
  board,
  documents,
  samples,
}) => {
  await board.storage.importDocument(documents.heavy);
  await board.storage.expectScene(documents.heavy.strokes);

  const original = await board.storage.sceneFingerprint();

  await board.selectRectangle(samples.selectionStart, samples.selectionEnd);
  await board.expectSelectionSize(130, 120);
  await board.moveSelectionWithActions(samples.moveStart, samples.moveEnd);
  await board.expectPartialMove(40, 30);
  await board.expectDistinctWorkerPaths();

  const moved = await board.storage.sceneFingerprint();

  await board.undo();
  await board.storage.expectFingerprint(original);
  await board.redo();
  await board.storage.expectFingerprint(moved);
  await board.reopenSavedBoard();
  await board.storage.expectFingerprint(moved);
});

test("cursor shapes, pan and import dialog preserve input ownership", async ({
  board,
}) => {
  await board.expectCursorAndNavigationOwnership();
});

test("floating editor panels preserve canvas, ink and keyboard ownership", async ({
  editor,
}) => {
  await editor.expectStableDisclosures();
  await editor.expectDesktopAndCompactLayout();
});

test("v2 migration retains raw original and both older recovery copies", async ({
  v2Board,
  documents,
  samples,
}) => {
  await v2Board.drawStroke(samples.extraStart, samples.extraEnd);
  await v2Board.storage.expectRecovery("upgrade4", documents.v2);
  await v2Board.storage.expectRecovery("upgrade", documents.legacy);
  await v2Board.storage.expectRecovery("previous", documents.previous);
  await v2Board.reopenSavedBoard();
  await v2Board.storage.importDocument(documents.empty);
  await v2Board.storage.expectRecovery("upgrade4", documents.v2);
  await v2Board.storage.expectRecovery("upgrade", documents.legacy);
});

test("writing view and background settings survive navigation, resize and JSON", async ({
  navigation,
}) => {
  await navigation.expectWritingReturnAndBackgroundRoundtrip();
});

test("minimap navigates distant notes without changing zoom and releases its worker", async ({
  navigation,
  documents,
}) => {
  await navigation.expectOverviewNavigation(documents.distant);
});

test("overview worker failure leaves writing and saving intact and can retry", async ({
  overviewFailureNavigation,
}) => {
  await overviewFailureNavigation.expectOverviewFailureRecovery();
});

test("dense pressure and affine ink erases as one durable transaction and cancellation restores its preview", async ({
  eraserHeavyBoard,
}) => {
  await eraserHeavyBoard.expectDenseEraserTransaction();
});
