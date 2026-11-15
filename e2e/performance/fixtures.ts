import { test as base } from "../fixtures";
import { PerformancePage } from "../pages/performance-page";

export const test = base.extend<{ performance: PerformancePage }>({
  performance: async ({ page, board }, provide) => {
    const performance = new PerformancePage(page, board);

    await performance.monitorResources();
    await provide(performance);
  },
});
