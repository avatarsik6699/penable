import { test as base } from "../fixtures";

export const test = base.extend({
  hasTouch: true,
  isMobile: true,
  viewport: { width: 834, height: 1112 },
  deviceScaleFactor: 2,
});
