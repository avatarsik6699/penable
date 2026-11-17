import { test } from "./fixtures";

test("light default, explicit choice, live System mode and invalid saved preference", async ({
  themes,
}) => {
  await themes.preferenceLifecycle();
});

test("all instruments, templates and images roundtrip themes with canonical PNG and document", async ({
  mixedThemes,
}) => {
  await mixedThemes.mixedRasterAndExports();
});

test("system theme changes preserve held pen input and undo redo", async ({
  themes,
}) => {
  await themes.activeInputAndHistory();
});

test("theme switch retains selection, canvas identity and exact saved content", async ({
  themes,
}) => {
  await themes.selectionSurvives();
});

test("read-only tab can change origin-wide theme without writing notes", async ({
  readerTheme,
}) => {
  await readerTheme.readonlyAndCrossTab();
});

test("denied preference storage allows temporary theme and durable writing", async ({
  deniedTheme,
}) => {
  await deniedTheme.deniedPersistence();
});

test("narrow keyboard-accessible theme and language controls survive offline reload", async ({
  themes,
}) => {
  await themes.narrowOffline();
});
