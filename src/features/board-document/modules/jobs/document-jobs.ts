import type { RegionInput, Stroke, SelectedPart } from "~/entities/board";
import { DocumentCodec } from "../codec";
import type {
  BoardDocument,
  DocumentPersistence,
} from "../../board-document.types";
import type { SelectionResult } from "./jobs-protocol";
import type { JobOptions } from "./document-jobs.types";
import { JobTransport } from "./job-transport";

export class DocumentJobs implements DocumentPersistence {
  private readonly transport: JobTransport;
  private tail: Promise<unknown> = Promise.resolve();
  private closing: Promise<void> | null = null;

  constructor(options: JobOptions = {}) {
    this.transport = new JobTransport(options);
  }

  select(
    strokes: readonly Stroke[],
    region: RegionInput,
    signal: AbortSignal,
  ): Promise<{
    region: SelectionResult["region"];
    parts: SelectedPart[];
  }> {
    if (this.closing)
      return Promise.reject(new Error("Обработка документа закрывается."));

    const originals = [...strokes];

    return this.transport
      .execute(
        "select",
        { ...DocumentCodec.emptyDocument(), strokes: originals },
        region,
        signal,
      )
      .then((result) => {
        if (!result.selection)
          throw new Error("Фоновый поток не вернул выделение.");

        return {
          region: result.selection.region,
          parts: result.selection.parts.map((part) => {
            const original = originals[part.index]!;

            return {
              original,
              selected: part.same
                ? original
                : { ...part.selected, points: original.points },
              remainder: part.remainder
                ? { ...part.remainder, points: original.points }
                : null,
            };
          }),
        };
      });
  }

  validate(
    strokes: readonly Stroke[],
    signal: AbortSignal,
    root: BoardDocument = DocumentCodec.emptyDocument(),
  ): Promise<void> {
    if (this.closing)
      return Promise.reject(new Error("Обработка документа закрывается."));

    return this.transport
      .execute(
        "validate",
        { ...root, strokes: [...strokes] },
        undefined,
        signal,
      )
      .then(() => {});
  }

  write(document: BoardDocument): Promise<void> {
    if (this.closing)
      return Promise.reject(new Error("Обработка документа закрывается."));

    const captured = {
      ...document,
      strokes: [...document.strokes],
      viewport: { ...document.viewport },
      tools: { ...document.tools },
    };

    const operation = this.tail.then(() =>
      this.transport.execute("save", captured),
    );

    this.tail = operation.catch(() => {});

    return operation.then(() => {});
  }

  cancel() {
    this.transport.cancel();
  }

  close(): Promise<void> {
    this.closing ??= this.drainAndClose();

    return this.closing;
  }

  private async drainAndClose() {
    await this.tail;
    await this.transport.close();
  }
}

export type { JobWorker } from "./document-jobs.types";
export { DocumentWorkload } from "./document-workload";
