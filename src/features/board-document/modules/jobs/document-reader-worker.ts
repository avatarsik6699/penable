import { Messages } from "~/shared/lib/messages";
import { DocumentCodec, DocumentSchema } from "../codec";
import { OwnedRecordBuffer } from "./owned-record-buffer";
import { CreditWindow } from "./credit-window";
import { SourceUpload } from "./source-upload";
import type {
  DocumentReadResponse,
  DocumentReadRequest,
} from "./document-reader.types";

const host = self as unknown as {
  onmessage: ((event: MessageEvent<DocumentReadRequest>) => void) | null;
  postMessage: (
    message: DocumentReadResponse,
    transfer?: Transferable[],
  ) => void;
};

const credit = new CreditWindow();
const raw = new OwnedRecordBuffer();

host.onmessage = ({ data }) => {
  if (data.type === "ack") {
    try {
      credit.acknowledge(data.seq);
    } catch (error) {
      credit.fail(error);
      host.postMessage({ type: "error", message: Messages.from(error) });
    }

    return;
  }

  if (data.type.startsWith("raw-")) {
    const value = raw.accept(
      data as import("./document-reader.types").OwnedRecordPacket,
    );

    if ("seq" in data)
      host.postMessage({ type: "ack", id: data.id, seq: data.seq });

    if (data.type !== "raw-finish") return;

    data = { type: "stored", value };
  }

  if (data.type !== "stored" && data.type !== "file" && data.type !== "runtime")
    return;

  const request = data;

  void (async () => {
    try {
      if (
        request.type === "file" &&
        request.blob.size > DocumentCodec.DOCUMENT_LIMITS.bytes
      )
        throw Messages.error(Messages.create("fileExceeds64Mib"));

      const document =
        request.type === "file"
          ? DocumentCodec.parseDocumentJSON(await request.blob.text())
          : DocumentCodec.decodeDocument(
              request.type === "runtime" &&
                DocumentSchema.itemDocument(request.value.schemaVersion)
                ? DocumentCodec.encodeDocument(request.value)
                : request.value,
            );

      const upload = new SourceUpload(),
        { strokes: _strokes, ...root } = document;

      host.postMessage({ type: "start", id: 1, kind: "validate", root });

      await upload.send(
        document,
        host,
        1,
        () => {},
        async () => {},
        true,
        credit,
      );

      host.postMessage({ type: "finish", id: 1 });
    } catch (error) {
      credit.fail(error);
      host.postMessage({ type: "error", message: Messages.from(error) });
    }
  })();
};
