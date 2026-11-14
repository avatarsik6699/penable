import { test } from "./fixtures";

test("schema4 upgrades preserve exact raw source, transformed legacy ink and earlier recoveries", async ({
  v4Board,
  documents,
}) => {
  await v4Board.storage.expectScene(documents.v4.items);
  await v4Board.storage.expectRecovery("upgrade5", documents.v4);
  await v4Board.storage.expectRecovery("upgrade4", documents.v3);
  await v4Board.storage.expectRecovery("upgrade3", documents.v2);
  await v4Board.storage.expectRecovery("upgrade", documents.legacy);
  await v4Board.storage.expectRecovery("previous", documents.previous);
  await v4Board.storage.expectSchema5RecoveryDownload(documents.v4);
  await v4Board.reopenSavedBoard();
  await v4Board.storage.expectScene(documents.v4.items);
  await v4Board.storage.expectRecovery("upgrade5", documents.v4);
  await v4Board.storage.expectExportMatchesSaved();
});

test("schema1 upgrades preserve exact source in both original and latest recovery slots", async ({
  legacyBoard,
  documents,
}) => {
  await legacyBoard.storage.expectRecovery("upgrade4", documents.legacy);
  await legacyBoard.storage.expectRecovery("upgrade5", documents.legacy);
  await legacyBoard.storage.expectScene(documents.legacy.strokes);
});
