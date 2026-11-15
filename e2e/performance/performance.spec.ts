import { test } from "./fixtures";

test("large JSON roundtrip keeps every sample, bounded transfer and released export workers", async ({
  performance,
  documents,
}) => {
  await performance.expectLargeRoundtrip(documents.heavy);
});
