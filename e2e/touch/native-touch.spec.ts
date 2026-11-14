import { test } from "./fixtures";

test("Chromium native multitouch backend pans and zooms the board without ink", async ({
  nativeTouch,
}) => {
  await nativeTouch.expectNativeTouchNavigation();
});

test("positive safe area insets keep the dock and navigation inside usable screen edges", async ({
  nativeTouch,
}) => {
  await nativeTouch.expectSafeAreaInsets();
});
