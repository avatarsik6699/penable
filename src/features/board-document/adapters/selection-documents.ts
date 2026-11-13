import {
  BoardSelectionHelpers,
  type BoardSnapshot,
  type RegionInput,
  type BoardItem,
} from "~/entities/board";
import { DocumentCodec, DocumentSnapshots } from "../modules/codec";
import { DocumentJobs, DocumentWorkload } from "../modules/jobs";

// Editor-generation jobs are separate from the session-owned durable writer.
export class SelectionDocuments {
  private readonly jobs = new DocumentJobs();

  select(
    strokes: readonly BoardItem[],
    region: RegionInput,
    signal: AbortSignal,
  ) {
    return DocumentWorkload.heavyDocument(strokes, region)
      ? this.jobs.select(strokes, region, signal)
      : BoardSelectionHelpers.prepareSelection(strokes, region);
  }

  validate(snapshot: BoardSnapshot, signal: AbortSignal) {
    const dto = DocumentSnapshots.fromSnapshot(snapshot);

    if (DocumentWorkload.heavyDocument(snapshot.strokes))
      return this.jobs.validate(snapshot.strokes, signal, dto);

    DocumentCodec.decodeDocument(DocumentCodec.encodeDocument(dto));
  }

  dispose() {
    this.jobs.cancel();
    void this.jobs.close();
  }
}
