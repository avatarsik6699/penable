import * as Document from "@document";

async function run(measure, stats, cycles = 3, retain = false) {
  const results = [];

  let snapshot = Document.DocumentSnapshots.toSnapshot(
    Document.DocumentCodec.emptyDocument(),
  );

  for (let cycle = 0; cycle < cycles; cycle++) {
    const session = Document.DocumentSessions.create({
      snapshot: () => snapshot,

      onHydrate: (value) => {
        snapshot = value;
      },

      onState: () => {},
    });

    const intervals = [];
    let previous = null;
    let frame = 0;

    const tick = (time) => {
      if (previous !== null) intervals.push(time - previous);

      previous = time;
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    try {
      const measured = await measure(async () => {
        await session.start();

        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );

        return { phase: "owned-open", cycle };
      });

      if (!session.state.loaded)
        throw new Error("Owned open did not load the document");

      results.push({
        ...measured,
        frames: stats(intervals),
        document: Document.DocumentCodec.documentStats(
          Document.DocumentSnapshots.fromSnapshot(snapshot),
        ),
      });
    } finally {
      cancelAnimationFrame(frame);
      await session.dispose();

      if (!retain)
        snapshot = Document.DocumentSnapshots.toSnapshot(
          Document.DocumentCodec.emptyDocument(),
        );
    }
  }

  return { fixture: "owned-open-attribution", retain, results };
}

export const OpenProbe = { run };
