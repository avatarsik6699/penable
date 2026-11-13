import { test } from "./fixtures";

test("compact content panels keep their final actions reachable after viewport resizing", async ({
  editor,
}) => {
  await editor.expectCompactContentPanelsReachable();
});

test("schema3 library upgrade preserves settings, transformed ink and every earlier recovery copy", async ({
  v3Board,
  documents,
}) => {
  await v3Board.storage.expectCurrentMetadata(documents.v3);
  await v3Board.storage.expectScene(documents.v3.strokes);
  await v3Board.storage.expectRecovery("upgrade4", documents.v3);
  await v3Board.storage.expectRecovery("beforeLibrary", documents.v3);
  await v3Board.storage.expectRecovery("upgrade3", documents.v2);
  await v3Board.storage.expectRecovery("upgrade", documents.legacy);
  await v3Board.storage.expectRecovery("previous", documents.previous);
  await v3Board.reopenSavedBoard();
  await v3Board.storage.expectCurrentMetadata(documents.v3);
  await v3Board.storage.expectExportMatchesSaved();
});

test("corrupt source record remains downloadable without initializing an empty library", async ({
  corruptStorage,
  documents,
}) => {
  await corruptStorage.expectRawRecovery(documents.corrupt);
});

test("missing catalog board is a recoverable error rather than a silent empty replacement", async ({
  missingBoardStorage,
  documents,
}) => {
  await missingBoardStorage.expectRawRecovery(documents.missingCatalog);
});

test("numeric selection transforms preserve source ink, history and portable backups", async ({
  transforms,
}) => {
  await transforms.expectNumericTransformRoundtrip();
});

test("pointer resize preserves proportions and cancellation restores the exact scene", async ({
  transforms,
}) => {
  await transforms.expectPointerResizeAndCancel();
});

test("pointer rotation snaps around the frame center and remains undoable", async ({
  transforms,
}) => {
  await transforms.expectPointerRotation();
});

test("PNG insertion paints, transforms and persists immutable image bytes", async ({
  imageBoard,
  images,
  transforms,
}) => {
  await imageBoard.expectInsertionAndTransform(images.png, transforms);
});

test("JPEG EXIF orientation preserves natural proportions and original bytes", async ({
  imageBoard,
  images,
}) => {
  await imageBoard.expectOrientedJpeg(images.orientedJpeg);
});

test("image crop preserves other ink and mixed PNG includes pixels and transparency", async ({
  imageBoard,
  images,
}) => {
  await imageBoard.expectCropAndPortablePng(images.png);
});

test("JPEG drop, image paste, modal ownership and unsupported files are safe", async ({
  imageBoard,
  images,
}) => {
  await imageBoard.expectDropPasteAndInvalidFile(images);
});

test("cropping a mixed partial selection never expands later ink deletion", async ({
  imageBoard,
  images,
}) => {
  await imageBoard.expectMixedCropRetainsPartialInk(images.png);
});

test("named boards retain independent ink, reload state and confirmed deletion", async ({
  library,
}) => {
  await library.expectIndependentBoardsAndDeletion();
});

test("cross-board image clipboard survives deletion and recovery is board-scoped", async ({
  library,
  imageBoard,
  images,
  documents,
}) => {
  await library.expectImageClipboardAndScopedRecovery(
    imageBoard,
    images.png,
    documents.empty,
  );
});

test("failed durable save prevents board switching and retry preserves pending ink", async ({
  failedSwitch,
}) => {
  await failedSwitch.library.expectFailedSavePreventsSwitch(
    failedSwitch.release,
  );
});

test("undecodable image inside otherwise valid JSON cannot replace the saved board", async ({
  imageBoard,
  images,
}) => {
  await imageBoard.expectCorruptImageImportPreservesCurrent(images.png);
});
