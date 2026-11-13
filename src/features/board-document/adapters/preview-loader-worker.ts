import { LibraryRepositoryAdapter } from "./library-indexeddb";
import { DocumentCodec } from "../modules/codec";

const host = self as unknown as {
  onmessage: ((event: MessageEvent<string>) => void) | null;
  postMessage: (value: { blob?: Blob; error?: string }) => void;
};

host.onmessage = ({ data }) => {
  void (async () => {
    let repository: Awaited<
      ReturnType<typeof LibraryRepositoryAdapter.open>
    > | null = null;

    try {
      repository = await LibraryRepositoryAdapter.open(() => {});

      const record = await repository.board(data);

      if (!record.exists) throw new Error("Доска отсутствует.");

      const document = DocumentCodec.decodeDocument(record.value);

      const blob = new Blob(
        [JSON.stringify(DocumentCodec.encodeDocument(document))],
        { type: "application/json" },
      );

      await repository.close();
      repository = null;
      host.postMessage({ blob });
    } catch (error) {
      host.postMessage({
        error:
          error instanceof Error ? error.message : "Предпросмотр недоступен.",
      });
    } finally {
      await repository?.close();
    }
  })();
};
