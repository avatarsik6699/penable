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

test("explicit pen contact recovers after repeated focus loss without resuming cancelled held ink", async ({
  writingFeedback,
}) => {
  await writingFeedback.expectFocusRecovery();
});

test("capture cancellation discards held pen input and the next fresh contact works", async ({
  writingFeedback,
}) => {
  await writingFeedback.expectCaptureCancellation();
});

test("diagnostics retain rejected pen contact flags and later show recovered contact acceptance", async ({
  writingFeedback,
}) => {
  await writingFeedback.expectContactDiagnostics();
});
