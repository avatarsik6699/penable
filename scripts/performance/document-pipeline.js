import * as Document from "@document";
import { WorkerProbe } from "./worker-probe.js";
import { I18n } from "@benchmark-locale";

function fixture(count, offset = 0) {
  return {
    ...Document.DocumentCodec.emptyDocument(),
    background: offset ? "grid" : "dots",
    strokes: Array.from({ length: count }, (_, source) => ({
      kind: "ink",
      id: source + 1,
      color: "#182230",
      width: 3,
      matrix: [1, 0, 0, 1, 0, 0],
      stabilization: { strength: 65, captureZoom: 1 },
      points: Array.from({ length: 50 }, (_, index) => ({
        x: offset + (source % 100) * 64 + index,
        y: Math.floor(source / 100) * 8 + (index % 3),
        pressure: (index % 5) / 4,
        time: source * 50 + index,
      })),
    })),
  };
}

async function fingerprint(document) {
  // Integrity work deliberately runs outside latency measurements.
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);

    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .filter((key) => value[key] !== undefined)
          .map((key) => [key, canonical(value[key])]),
      );

    return value;
  }

  const encoded = Document.DocumentCodec.encodeDocument(document);

  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(canonical(encoded))),
  );

  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function run(measure, count = 20000, replacementOnly = false) {
  await I18n.initialize("en");

  let snapshot = Document.DocumentSnapshots.toSnapshot(
    Document.DocumentCodec.emptyDocument(),
  );

  let original = fixture(count);
  let candidateDocument = fixture(count, 7);

  const expected = {
    previous: await fingerprint(original),
    candidate: await fingerprint(candidateDocument),
  };

  const blob = new Blob([
    JSON.stringify(Document.DocumentCodec.encodeDocument(candidateDocument)),
  ]);

  candidateDocument = null;

  if (blob.size > Document.DocumentCodec.DOCUMENT_LIMITS.bytes)
    throw new Error("Synthetic pipeline file exceeds the real file limit");

  const createSession = () =>
    Document.DocumentSessions.create({
      snapshot: () => snapshot,

      onHydrate: (value) => {
        snapshot = value;
      },

      onState: () => {},
    });

  let session = createSession();
  let library = null;
  let reader = null;
  let libraryState = null;
  let readerSnapshot = null;
  let candidate;
  let exported;
  const results = [];
  const probe = WorkerProbe.start();

  const createLibrary = (readonly = false) =>
    Document.BoardLibraries.create({
      snapshot: () => (readonly ? readerSnapshot : snapshot),

      onHydrate: (value) => {
        if (readonly) readerSnapshot = value;
        else snapshot = value;
      },

      onState: () => {},

      onLibrary: (value) => {
        if (!readonly) libraryState = value;
      },
    });

  const phase = async (name, operation) => {
    const before = probe.mark();

    const result = await measure(async () => {
      const start = performance.now();

      await operation();

      const operationMs = performance.now() - start;

      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );

      return { phase: name, operationMs };
    });

    results.push({ ...result, transfer: probe.since(before) });
  };

  try {
    await session.start();
    await session.replace(original, () => false);
    original = null;

    const opaque = typeof Document.DocumentReader.readCandidate === "function";

    await phase("read-candidate", async () => {
      candidate = opaque
        ? await Document.DocumentReader.readCandidate(
            blob,
            new AbortController().signal,
          )
        : await Document.DocumentReader.read(
            blob,
            new AbortController().signal,
          );
    });

    await phase("replace", () =>
      opaque
        ? session.replaceCandidate(candidate, () => false)
        : session.replace(candidate, () => false),
    );

    if (!replacementOnly) {
      const exporter = new Document.DocumentJobs();

      try {
        await phase("export", async () => {
          exported = await exporter.export(
            Document.DocumentSnapshots.fromSnapshot(snapshot),
            new AbortController().signal,
          );
        });
      } finally {
        await phase("export-close", () => exporter.close());
      }

      await phase("session-close", () => session.dispose());
      session = createSession();
      await phase("open", () => session.start());
      await phase("loaded-session-close", () => session.dispose());
      session = null;

      // Warm the real catalog composition, then measure existing-catalog open and
      // readonly/switch paths. Bootstrap/migration correctness has separate tests.
      library = createLibrary();
      await library.start();

      const title = "Owned benchmark empty";

      if (!libraryState.boards.some((board) => board.title === title)) {
        await library.createBoard(title);
        await library.switchBoard("main");
      }

      const emptyId = libraryState.boards.find(
        (board) => board.title === title,
      ).id;

      await library.dispose();
      library = createLibrary();
      await phase("library-open", () => library.start());

      readerSnapshot = Document.DocumentSnapshots.toSnapshot(
        Document.DocumentCodec.emptyDocument(),
      );

      reader = createLibrary(true);
      await phase("readonly-open", () => reader.start());

      if (!reader.state.readOnly)
        throw new Error("Readonly library stole writer authority");

      await phase("readonly-close", () => reader.dispose());
      reader = null;
      readerSnapshot = null;
      await phase("library-switch-empty", () => library.switchBoard(emptyId));
      await phase("library-switch-large", () => library.switchBoard("main"));
      await phase("library-close", () => library.dispose());
      library = null;
    }

    const actual = {
      live: await fingerprint(
        Document.DocumentSnapshots.fromSnapshot(snapshot),
      ),
      ...(exported
        ? {
            exported: await fingerprint(
              Document.DocumentCodec.parseDocumentJSON(
                await exported.blob.text(),
              ),
            ),
          }
        : {}),
    };

    const repository = await Document.DocumentRepositoryAdapter.openRepository(
      () => {},
    );

    try {
      const records = await repository.read();

      actual.previous = await fingerprint(
        Document.DocumentCodec.decodeDocument(records.beforeImport.value),
      );

      actual.stored = await fingerprint(
        Document.DocumentCodec.decodeDocument(records.main.value),
      );
    } finally {
      await repository.close();
    }

    if (
      actual.previous !== expected.previous ||
      [
        actual.live,
        actual.stored,
        ...(actual.exported ? [actual.exported] : []),
      ].some((value) => value !== expected.candidate)
    )
      throw new Error("Exact document pipeline roundtrip failed");

    return {
      fixture: replacementOnly ? "document-replacement" : "document-pipeline",
      sources: count,
      points: count * 50,
      bytes: blob.size,
      opaque,
      expected,
      actual,
      exact: true,
      results,
    };
  } finally {
    Document.DocumentReader.disposeCandidate?.(candidate);
    await reader?.dispose();
    await library?.dispose();
    await session?.dispose();
    probe.stop();
  }
}

export const DocumentPipeline = { run };
