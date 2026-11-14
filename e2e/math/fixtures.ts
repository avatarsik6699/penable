import { test as base } from "../fixtures";
import { MathTemplatesPage } from "../pages/math-templates-page";
import { mathBoards } from "../data/math-boards";

export const test = base.extend<{ math: MathTemplatesPage }>({
  math: async ({ page, board }, provide) => {
    await provide(new MathTemplatesPage(page, board, mathBoards.legacy()));
  },
});
