import { test } from "./fixtures";

test("partial move of a hundred-thousand-point pressure stroke keeps exact history and durable worker validation", async ({
  pressureHeavyBoard,
  samples,
}) => {
  const original = await pressureHeavyBoard.storage.sceneFingerprint();

  await pressureHeavyBoard.selectRectangle(
    samples.selectionStart,
    samples.selectionEnd,
  );

  await pressureHeavyBoard.expectSelectionSize(130, 120);

  await pressureHeavyBoard.moveSelectionWithActions(
    samples.moveStart,
    samples.moveEnd,
  );

  await pressureHeavyBoard.expectPartialMove(40, 30);
  await pressureHeavyBoard.expectDistinctWorkerPaths();

  const moved = await pressureHeavyBoard.storage.sceneFingerprint();

  await pressureHeavyBoard.undo();
  await pressureHeavyBoard.storage.expectFingerprint(original);
  await pressureHeavyBoard.redo();
  await pressureHeavyBoard.storage.expectFingerprint(moved);
  await pressureHeavyBoard.reopenSavedBoard();
  await pressureHeavyBoard.storage.expectFingerprint(moved);
});
