import { Messages } from "~/shared/lib/messages";
import { DocumentCodec } from "../codec";
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

host.onmessage = ({ data }) => {
  void (async () => {
    try {
      if (
        data.type === "file" &&
        data.blob.size > DocumentCodec.DOCUMENT_LIMITS.bytes
      )
        throw Messages.error(Messages.create("fileExceeds64Mib"));

      const document =
        data.type === "file"
          ? DocumentCodec.parseDocumentJSON(await data.blob.text())
          : DocumentCodec.decodeDocument(
              data.type === "runtime" &&
                (data.value.schemaVersion === 4 ||
                  data.value.schemaVersion === 5)
                ? DocumentCodec.encodeDocument(data.value)
                : data.value,
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
      );

      host.postMessage({ type: "finish", id: 1 });
    } catch (error) {
      host.postMessage({ type: "error", message: Messages.from(error) });
    }
  })();
};
