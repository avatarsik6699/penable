import { test } from "./fixtures";

test("dock and permanent controls keep their rectangles across tools at every breakpoint", async ({
  editor,
}) => {
  await editor.expectInvariantDockGeometry();
});

test("board sidebar provides search, instant covers, row actions and stable canvas", async ({
  library,
}) => {
  await library.expectSidebarSearchAndCovers();
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

test("plain text stays editable with annotations, clipboard transfer and JSON", async ({
  clipboard,
  library,
}) => {
  await clipboard.expectEditableTextRoundtrip(library);
});

test("a tall quotation stays copyable above clipboard PNG limits", async ({
  clipboard,
}) => {
  await clipboard.expectTallTextClipboard();
});

test("menu text paste wraps long content and narrow edit preserves an invalid draft", async ({
  clipboard,
}) => {
  await clipboard.expectTextMenuAndNarrowEdit();
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

test("first keyboard image paste after focus return recovers a stale native image read", async ({
  clipboardFailure,
  images,
}) => {
  await clipboardFailure.expectExternalImageRecoversOnFirstPaste(
    images.png,
    false,
  );
});

test("first menu image paste after focus return recovers a transient native clipboard read", async ({
  clipboardFailure,
  images,
}) => {
  await clipboardFailure.expectExternalImageRecoversOnFirstPaste(
    images.png,
    true,
  );
});

test("native image paste succeeds when the async clipboard exposes no formats", async ({
  clipboardFailure,
  images,
}) => {
  await clipboardFailure.expectOpaqueReadUsesNativeImage(images.png, false);
});

test("opaque menu clipboard suggests native paste which inserts exactly one image", async ({
  clipboardFailure,
  images,
}) => {
  await clipboardFailure.expectOpaqueReadUsesNativeImage(images.png, true);
});
