import { test } from "./fixtures";

test("the file picker inserts a large image on an empty board", async ({
  imageInsertion,
}) => {
  await imageInsertion.expectEmptyBoardInsertion();
});

test("Ctrl+V commits five large images after writing and focus return", async ({
  imageInsertion,
}) => {
  await imageInsertion.expectFiveInsertionsFrom("paste");
});

test("the image menu path commits five large images with selection tool active", async ({
  imageInsertion,
}) => {
  await imageInsertion.expectFiveInsertionsFrom("menu");
});

test("the file picker commits five large images without requiring a selection", async ({
  imageInsertion,
}) => {
  await imageInsertion.expectFiveInsertionsFrom("file");
});

test("dropping a large image preserves the exact source bytes", async ({
  imageInsertion,
}) => {
  await imageInsertion.expectDropKeepsSourceBytes();
});

test("pointer noise cannot cancel an actual held image validation reply", async ({
  imageInsertion,
}) => {
  await imageInsertion.expectPointerNoiseDoesNotCancelHeldValidation();
});

test("blur and visibility changes preserve an acquired image until validation returns", async ({
  imageInsertion,
}) => {
  await imageInsertion.expectBlurAndHiddenKeepHeldValidation();
});

test("Escape rejects a held result as stale and the same image can retry", async ({
  imageInsertion,
}) => {
  await imageInsertion.expectStaleReleaseThenRetry();
});
