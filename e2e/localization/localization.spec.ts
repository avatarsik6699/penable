import { test } from "./fixtures";

test("English browser starts in English with automatic preference", async ({
  englishApp,
}) => {
  await englishApp.automaticEnglish();
});

test("Russian browser starts in Russian with automatic preference", async ({
  russianApp,
}) => {
  await russianApp.automaticRussian();
});

test("unsupported browser and invalid saved preference fall back to English", async ({
  unsupportedApp,
}) => {
  await unsupportedApp.unsupportedFallsBackAndInvalidPreferenceIsIgnored();
});

test("manual language survives reload and Auto restores browser preference", async ({
  englishApp,
}) => {
  await englishApp.manualChoicePersistsAndAutoRestoresBrowser();
});

test("denied preference storage permits in-memory language changes and durable writing", async ({
  deniedPreferenceApp,
}) => {
  await deniedPreferenceApp.deniedPreferencesStillAllowSwitchAndWriting();
});

test("language switch retains canvas identity, exact document, selection and history", async ({
  englishApp,
}) => {
  await englishApp.switchPreservesCanvasDocumentSelectionAndUndo();
});

test("read-only tab can switch application language without editing notes", async ({
  readerApp,
}) => {
  await readerApp.readOnlyTabCanChangeApplicationLanguage();
});

test("an already-visible save failure changes language without losing unsaved ink", async ({
  saveErrorApp,
}) => {
  await saveErrorApp.visibleSaveErrorRetranslates();
});

test("retry save retains readable primary colors on hover in both themes", async ({
  saveErrorApp,
}) => {
  await saveErrorApp.retrySaveThemeContrast();
});

test("narrow keyboard-accessible language control and both catalogs survive offline reload", async ({
  englishApp,
}) => {
  await englishApp.narrowKeyboardAndOfflineReload();
});
