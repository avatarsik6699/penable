import { test } from "./fixtures";

test("large JSON roundtrip keeps every sample, bounded transfer and released export workers", async ({
  performance,
  documents,
}) => {
  await performance.expectLargeRoundtrip(documents.heavy);
});

test("one million samples use packed bounded transfer and survive replacement and reload", async ({
  performance,
  millionDocument,
}) => {
  await performance.expectPackedMillionRoundtrip(millionDocument);
});

test("worker replacement abort retains both records and retries the validated candidate", async ({
  replacementFailure,
  documents,
}) => {
  await replacementFailure.expectAtomicReplacementRetry(documents.legacy);
});

test("readonly recovery keeps its captured contents after another tab replaces storage", async ({
  recoveryCopies,
}) => {
  await recoveryCopies.expectCapturedRecoveryAfterReplacement();
});
