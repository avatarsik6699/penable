import { test } from "../math/touch/fixtures";

test("phone and tablet math panels keep controls, readable glyphs and placement reachable", async ({
  math,
}) => {
  await math.expectTouchLayouts();
});

test("finger panning of the math preview cannot change board camera or create ink", async ({
  math,
}) => {
  await math.expectTouchPreviewPan();
});
