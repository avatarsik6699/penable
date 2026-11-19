import { test } from "./fixtures";

test("finger pan and midpoint-anchored pinch rebase without creating ink", async ({
  touch,
}) => {
  await touch.expectNavigationAndRebase();
});

test("pen input has priority over held touches and releases their quarantine safely", async ({
  touch,
}) => {
  await touch.expectPenPriorityAndQuarantine();
});

test("explicit finger editing supports history and cancels its unfinished stroke before pinch", async ({
  touch,
}) => {
  await touch.expectFingerEditingAndPinchCancellation();
});

test("pointer cancellation and orientation changes release transient ownership", async ({
  touch,
}) => {
  await touch.expectCancelAndRotation();
});

test("read-only boards allow touch navigation while preserving durable content", async ({
  readOnlyTouch,
}) => {
  await readOnlyTouch.expectReadOnlyNavigation();
});

test("armed templates tolerate pinch and place once on a real single tap", async ({
  touch,
}) => {
  await touch.expectTemplateTouchPlacement();
});

test("a finger tap selects pasted text while navigation mode is active", async ({
  touch,
}) => {
  await touch.expectTextTapInNavigationMode();
});

test("phone portrait and landscape controls remain touchable and reachable", async ({
  touchLayout,
}) => {
  await touchLayout.expectPhoneLayouts();
});

test("tablet portrait, landscape and narrow windows keep stable touch controls", async ({
  touchLayout,
}) => {
  await touchLayout.expectTabletLayouts();
});

test("board library and settings preserve usable forms on phones", async ({
  touchLayout,
}) => {
  await touchLayout.expectLibraryAndSettings();
});

test("keyboard-sized visual viewport keeps focused fields and final actions reachable", async ({
  keyboardTouchLayout,
}) => {
  await keyboardTouchLayout.expectKeyboardViewport();
});

test("finger editing resizes a selected vector through generous touch handles", async ({
  touch,
}) => {
  await touch.expectTouchSelectionResize();
});

test("finger editing preference survives a board switch but resets on reload", async ({
  touch,
  library,
}) => {
  await touch.expectFingerModeAcrossBoards(library);
});
