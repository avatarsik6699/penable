import { test } from "./fixtures";

test("pen release retains its marker while the ink sample and next hover remain correct", async ({
  writingFeedback,
}) => {
  await writingFeedback.expectStablePenLift();
});

test("repeated pen strokes keep toolbar colors stable while native commands stay blocked", async ({
  writingFeedback,
}) => {
  await writingFeedback.expectCalmRepeatedWriting();
});

test("readonly writing controls retain muted native disabled behavior", async ({
  readOnlyWritingFeedback,
}) => {
  await readOnlyWritingFeedback.expectReadOnlyStaysMuted();
});
