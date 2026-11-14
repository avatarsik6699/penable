import { test } from "./fixtures";

test("opaque colored ink retains scene order during drag, commit and reload", async ({
  writing,
}) => {
  await writing.expectOpaqueColorPreviewMatchesCommit();
});

test("a marker cannot change the opacity of a later inserted image", async ({
  writing,
  imageBoard,
  images,
}) => {
  await writing.expectMarkerDoesNotTintImages(imageBoard, images.png);
});

test("instrument colors and settings preserve stable chrome, export and reload pixels", async ({
  writing,
}) => {
  await writing.expectPaletteAndInstrumentPersistence();
});

test("a highlighter stroke is uniformly translucent while separate strokes accumulate", async ({
  writing,
}) => {
  await writing.expectUniformHighlighterAndHistory();
});

test("rejoined highlighter fragments retain exact pixels and their order beneath other ink", async ({
  writing,
}) => {
  await writing.expectClippedTranslucencyPreservesLayerOrder();
});

test("recorded pen pressure changes rendered width and survives a durable roundtrip", async ({
  writing,
}) => {
  await writing.expectPressureAffectsGeometryAndSurvivesReload();
});
