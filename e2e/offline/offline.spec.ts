import { test } from "./fixtures";

test("offline reopening preserves notes and supports lazy editor operations", async ({
  offlineApp,
}) => {
  await offlineApp.expectOfflineWriting();
});

test("offline text paste survives reload and portable export", async ({
  offlineApp,
}) => {
  await offlineApp.expectOfflineText();
});

test("upgrade waits for all app windows to close before activation", async ({
  offlineApp,
}) => {
  await offlineApp.expectSafeUpgrade();
});

test("failed upgrade retains current offline app and notes", async ({
  offlineApp,
}) => {
  await offlineApp.expectFailedUpgrade();
});

test("manifest and offline cache stay inside the Pages scope", async ({
  offlineApp,
}) => {
  await offlineApp.expectScopedAssets();
});

test("installation offer handles dismissal, failure and installed state", async ({
  offlineApp,
}) => {
  await offlineApp.expectInstallLifecycle();
});

test("failed first preparation remains editable and retries successfully", async ({
  offlineFailureApp,
}) => {
  await offlineFailureApp.expectPreparationRetry();
});
