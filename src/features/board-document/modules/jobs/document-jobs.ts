import { RecordCopies } from "../record-copies";
import { DocumentCapture } from "./document-capture";
import { Messages } from "~/shared/lib/messages";
import type { RegionInput, BoardItem, SelectedPart } from "~/entities/board";
import { DocumentCodec } from "../codec";
import type {
  BoardDocument,
  DocumentPersistence,
} from "../../board-document.types";
import { DocumentProtocol, type SelectionResult } from "./jobs-protocol";
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
    strokes: readonly BoardItem[],
    region: RegionInput,
    signal: AbortSignal,
  ): Promise<{
    region: SelectionResult["region"];
    parts: SelectedPart[];
  }> {
    if (this.closing)
      return Promise.reject(
        Messages.error(Messages.create("documentProcessingIsClosing")),
      );

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
          throw Messages.error(
            Messages.create("theBackgroundWorkerDidNotReturnA"),
          );

        return {
          region: result.selection.region,
          parts: result.selection.parts.map((part) => {
            const original = originals[part.index]!;

            return {
              original,
              selected: part.same
                ? original
                : ({ ...original, ...part.selected } as BoardItem),
              remainder: part.remainder
                ? ({ ...original, ...part.remainder } as BoardItem)
                : null,
            };
          }),
        };
      });
  }

  validate(
    strokes: readonly BoardItem[],
    signal: AbortSignal,
    root: BoardDocument = DocumentCodec.emptyDocument(),
  ): Promise<void> {
    if (this.closing)
      return Promise.reject(
        Messages.error(Messages.create("documentProcessingIsClosing")),
      );

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
      return Promise.reject(
        Messages.error(Messages.create("documentProcessingIsClosing")),
      );

    const captured = DocumentCapture.completed(document);

    const operation = this.tail.then(() =>
      this.transport.execute("save", captured),
    );

    this.tail = operation.catch(() => {});

    return operation.then(() => {});
  }

  replace(
    previous: import("../../board-document.types").ReplacementPrevious,
    candidate: BoardDocument,
  ): Promise<void> {
    return this.replaceQueued(previous, candidate, false).then(() => {});
  }

  // Production persistence port only: Session has already completed strict preparation.
  replaceValidated(
    previous: import("../../board-document.types").ReplacementPrevious,
    candidate: BoardDocument,
  ): Promise<import("../../board-document.types").StoredRecord | void> {
    return this.replaceQueued(previous, candidate, true);
  }

  private replaceQueued(
    previous: import("../../board-document.types").ReplacementPrevious,
    candidate: BoardDocument,
    trusted: boolean,
  ): Promise<import("../../board-document.types").StoredRecord | void> {
    if (this.closing)
      return Promise.reject(
        Messages.error(Messages.create("documentProcessingIsClosing")),
      );

    const before =
      "kind" in previous ? previous : DocumentCapture.completed(previous);

    const captured = DocumentCapture.completed(candidate);

    const operation = this.tail.then(() =>
      this.transport.execute(
        "replace",
        captured,
        undefined,
        undefined,
        undefined,
        before,
        trusted,
      ),
    );

    this.tail = operation.catch(() => {});

    return operation.then((result) =>
      result.previousCopy
        ? RecordCopies.capture(result.previousCopy)
        : undefined,
    );
  }

  overview(
    strokes: readonly BoardItem[],
    signal: AbortSignal,
  ): Promise<import("./modules/overview").OverviewResult> {
    if (this.closing)
      return Promise.reject(
        Messages.error(Messages.create("overviewIsClosing")),
      );

    return this.transport
      .execute(
        "overview",
        { ...DocumentCodec.emptyDocument(), strokes: [...strokes] },
        undefined,
        signal,
      )
      .then((result) => {
        return DocumentProtocol.overviewResult(result.overview);
      });
  }

  async fragment(
    fragment: import("~/entities/board").SelectionClipboard,
    signal: AbortSignal,
  ): Promise<Blob> {
    const result = await this.transport.execute(
      "fragment",
      { ...DocumentCodec.emptyDocument(), strokes: fragment.strokes },
      undefined,
      signal,
      fragment.region,
    );

    if (!result.fragment)
      throw Messages.error(Messages.create("fragmentIsNotReady"));

    return result.fragment;
  }

  async export(document: BoardDocument, signal: AbortSignal) {
    if (this.closing)
      throw Messages.error(Messages.create("documentProcessingIsClosing"));

    const result = await this.transport.execute(
      "export",
      document,
      undefined,
      signal,
    );

    if (!result.exported)
      throw Messages.error(Messages.create("documentProcessingFailed"));

    return result.exported;
  }

  async exportRaw(document: BoardDocument, signal: AbortSignal): Promise<Blob> {
    const result = await this.transport.execute(
      "raw-export",
      document,
      undefined,
      signal,
    );

    if (!result.rawExport)
      throw Messages.error(Messages.create("documentProcessingFailed"));

    return result.rawExport;
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
