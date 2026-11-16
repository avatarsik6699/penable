import { expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { BoardPage } from "./board-page";
import type { TestBoardTypes } from "../data/board.types";

export class RecoveryCopiesPage {
  constructor(
    private readonly page: Page,
    private readonly reader: BoardPage,
    private readonly writer: BoardPage,
    private readonly captured: TestBoardTypes.StoredDocument,
  ) {}

  async expectCapturedRecoveryAfterReplacement() {
    await this.writer.storage.importDocument({
      ...this.captured,
      background: "grid",
    });

    expect((await this.writer.storage.records()).previous).not.toEqual(
      this.captured,
    );

    await this.reader.storage.openFiles();

    const pending = this.page.waitForEvent("download");

    await this.page
      .getByRole("button", { name: "Копия до замены", exact: true })
      .click();

    const download = await pending;
    const path = await download.path();

    expect(path).toBeTruthy();
    expect(JSON.parse(await readFile(path!, "utf8"))).toEqual(this.captured);
    await this.reader.storage.closeDetails();
    await this.reader.storage.expectReadOnly();
  }
}
