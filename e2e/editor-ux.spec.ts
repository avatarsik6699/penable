import { test } from "./fixtures";

test("dock and permanent controls keep their rectangles across tools at every breakpoint", async ({
  editor,
}) => {
  await editor.expectInvariantDockGeometry();
});

test("board sidebar provides search, lazy previews, row actions and stable canvas", async ({
  library,
}) => {
  await library.expectSidebarSearchAndPreviews();
});

test("board title leads its label and rename focus stays inside the scrollable list", async ({
  library,
}) => {
  await library.expectRenameFocusAndTitleHierarchy();
});

test("image insertion survives delayed decode and focus return, and accepts the same file again", async ({
  imageBoard,
  images,
}) => {
  await imageBoard.expectPickerFocusAndRepeat(images.png);
});

test("system clipboard preserves editable mixed fragments across boards and reload", async ({
  clipboard,
  library,
  imageBoard,
  images,
}) => {
  await clipboard.expectMixedClipboardAcrossBoards(
    library,
    imageBoard,
    images.png,
  );
});

test("cut then switch then paste uses ordinary independent undo and redo", async ({
  clipboard,
  library,
}) => {
  await clipboard.expectCutAndPasteUseOrdinaryHistory(library);
});

test("external clipboard contents replace stale in-tab fragments", async ({
  clipboard,
  imageBoard,
  images,
}) => {
  await clipboard.expectNewExternalContentReplacesOldFragment(
    imageBoard,
    images.png,
  );
});

test("corrupt editable clipboard data never falls back to raster PNG", async ({
  clipboard,
  images,
}) => {
  await clipboard.expectCorruptOwnFormatDoesNotPastePng(images.png);
});

test("failed clipboard write never cuts source content", async ({
  clipboardFailure,
}) => {
  await clipboardFailure.expectDeniedCutPreservesSource();
});

test("denied clipboard read never flattens an editable fragment", async ({
  clipboardFailure,
}) => {
  await clipboardFailure.expectDeniedReadDoesNotFlattenOwnFragment();
});

test("header-valid truncated clipboard image cannot commit or prevent board reopening", async ({
  clipboard,
  imageBoard,
  images,
}) => {
  await clipboard.expectTruncatedClipboardAssetPreservesDocument(
    imageBoard,
    images.png,
  );
});

test("event image fallback rejects advertised editable data and accepts an external PNG", async ({
  clipboardFailure,
  images,
}) => {
  await clipboardFailure.expectEventFallbackHonorsAdvertisedFormat(images.png);
});

test("menu Copy and Paste negotiate the same editable system clipboard", async ({
  clipboard,
}) => {
  await clipboard.expectMenuUsesSameClipboard();
});
