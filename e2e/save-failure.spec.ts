import { test } from "./fixtures";

test("worker startup failure preserves pending ink and retry writes it", async ({
  saveFailureBoard,
}) => {
  await saveFailureBoard.drawPendingInk();
  await saveFailureBoard.storage.expectSaveError();
  await saveFailureBoard.retryFailedWorkerSave();
  await saveFailureBoard.storage.expectStrokeCount(1);
  await saveFailureBoard.reopenSavedBoard();
  await saveFailureBoard.storage.expectStrokeCount(1);
});
