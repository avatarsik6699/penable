import { test } from "./fixtures";

test("numeric math retains every step and expands required ranges without shrinking placement", async ({
  math,
}) => {
  await math.expectRequiredRanges();
});

test("math preview has an independent readable camera with whole, closeup and keyboard navigation", async ({
  math,
}) => {
  await math.expectPreviewNavigation();
});

test("circle angle and coordinate notation are independent and export through the PNG worker", async ({
  math,
}) => {
  await math.expectCircleNotationAndPng();
});

test("legacy math remains exact while mixed generator versions use ordinary cross-board clipboard", async ({
  math,
  library,
}) => {
  await math.expectMixedVersions(library);
});
