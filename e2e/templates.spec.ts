import { test } from "./fixtures";

test("placement has a readable primary action and color swatches retain keyboard focus", async ({
  templates,
}) => {
  await templates.expectVisiblePlacementAndKeyboardFocus();
});

test("changing the writing instrument discards an armed template before the next stroke", async ({
  templates,
}) => {
  await templates.expectInstrumentChangeCancelsPlacement();
});

test("closed shapes support independently colored outlines and fills", async ({
  templates,
}) => {
  await templates.expectOutlineAndFillAreIndependent();
});

test("editable clipboard fragments from the prior document format remain editable", async ({
  templates,
  documents,
}) => {
  await templates.expectLegacyClipboardStillEditable(documents.v4);
});

test("each figure and mathematical template is a single durable vector object", async ({
  templates,
}) => {
  await templates.expectAllTemplatesRemainVectorAfterReload();
});

test("template placement cancels cleanly, groups undo and is protected from the ink eraser", async ({
  templates,
}) => {
  await templates.expectPlacementCancellationAndHistory();
});

test("template transforms and exact partial selection survive history and reload", async ({
  templates,
  transforms,
}) => {
  await templates.expectTransformAndExactPartialMove(transforms);
});

test("templates use ordinary cut and paste between independent boards", async ({
  templates,
  library,
}) => {
  await templates.expectOrdinaryCrossBoardClipboard(library);
});

test("dense divisions and invalid ranges explain errors without mutating the board", async ({
  templates,
}) => {
  await templates.expectInvalidParametersBlockPlacement();
});

test("tool and board switching discard only the transient placement preview", async ({
  templates,
  library,
}) => {
  await templates.expectToolAndBoardSwitchCancelPlacement(library);
});
