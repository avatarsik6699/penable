import { test } from "./fixtures";

test("tool panels are compact at desktop sizes and remain reachable on narrow and short screens", async ({
  toolPanels,
}) => {
  await toolPanels.expectCompactPanels();
});

test("large automatic axis ranges stay vector and retain their divisions when visually resized", async ({
  toolPanels,
}) => {
  await toolPanels.expectExtremeRangeAndResize();
});

test("outline width uses a precise keyboard accessible slider and survives reload", async ({
  toolPanels,
}) => {
  await toolPanels.expectOutlineSlider();
});

test("manual divisions suggest a valid step while incomplete range drafts retain the preview", async ({
  toolPanels,
}) => {
  await toolPanels.expectManualRecommendationAndDrafts();
});

test("contextual help opens on hover and keyboard focus and can be pinned by click", async ({
  toolPanels,
}) => {
  await toolPanels.expectContextualHelp();
});
