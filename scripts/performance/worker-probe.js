// Benchmark-only observation of real Worker traffic. Never enters Pages.
function start() {
  const NativeWorker = window.Worker;

  const state = {
    created: 0,
    terminated: 0,
    points: 0,
    pointMessages: 0,
    incomingPoints: 0,
    incomingPointMessages: 0,
    rawPoints: 0,
    rawPointMessages: 0,
    recoveryBlobBytes: 0,
    maximumRecoveryBlobBytes: 0,
    previousBlobBytes: 0,
    metadata: 0,
    assetCharacters: 0,
    maximumPointChunk: 0,
    maximumRanges: 0,
    maximumMetadata: 0,
    maximumOutgoing: 0,
    maximumIncoming: 0,
    maximumPostMs: 0,
    postsOver50ms: 0,
  };

  function packet(message, incoming) {
    if (message.previousCopy?.blob)
      state.previousBlobBytes += message.previousCopy.blob.size;

    if (message.type === "records") {
      const bytes = Object.values(message.records).reduce(
        (sum, record) => sum + (record?.blob?.size ?? 0),
        0,
      );

      state.recoveryBlobBytes += bytes;

      state.maximumRecoveryBlobBytes = Math.max(
        state.maximumRecoveryBlobBytes,
        bytes,
      );
    }

    if (message.type === "raw-points") {
      state.rawPoints += message.values.length;
      state.rawPointMessages++;

      state.maximumPointChunk = Math.max(
        state.maximumPointChunk,
        message.values.length,
      );

      state.maximumRanges = Math.max(
        state.maximumRanges,
        message.ranges.length,
      );
    }

    if (message.type === "points" || message.type === "points-batch") {
      const count = message.values.length / 4;

      state[incoming ? "incomingPoints" : "points"] += count;
      state[incoming ? "incomingPointMessages" : "pointMessages"]++;
      state.maximumPointChunk = Math.max(state.maximumPointChunk, count);

      state.maximumRanges = Math.max(
        state.maximumRanges,
        message.ranges?.length ?? 1,
      );
    }

    if (message.type === "strokes" || message.type === "raw-items") {
      const count = (message.values ?? message.entries).length;

      state.metadata += count;

      state.maximumMetadata = Math.max(state.maximumMetadata, count);
    }

    if (message.type === "asset") state.assetCharacters += message.value.length;
  }

  function sequence(message, pending) {
    if (Number.isInteger(message.seq) && message.type !== "ack")
      pending.add(`${message.id}:${message.seq}`);
  }

  const InstrumentedWorker = class extends NativeWorker {
    outgoing = new Set();
    incoming = new Set();
    closed = false;

    constructor(...args) {
      super(...args);
      state.created++;

      this.addEventListener("message", ({ data }) => {
        if (Number.isInteger(data.ack))
          this.outgoing.delete(`${data.id}:${data.ack}`);
        else if (data.type === "ack")
          this.outgoing.delete(`${data.id}:${data.seq}`);
        else {
          packet(data, true);
          sequence(data, this.incoming);

          state.maximumIncoming = Math.max(
            state.maximumIncoming,
            this.incoming.size,
          );
        }
      });
    }

    postMessage(message, ...rest) {
      if (message.type === "ack")
        this.incoming.delete(`${message.id}:${message.seq}`);
      else {
        packet(message, false);
        sequence(message, this.outgoing);

        state.maximumOutgoing = Math.max(
          state.maximumOutgoing,
          this.outgoing.size,
        );
      }

      const before = performance.now();

      super.postMessage(message, ...rest);

      const duration = performance.now() - before;

      state.maximumPostMs = Math.max(state.maximumPostMs, duration);

      if (duration >= 50) state.postsOver50ms++;
    }

    terminate() {
      if (!this.closed) {
        state.terminated++;
        this.closed = true;
      }

      this.outgoing.clear();
      this.incoming.clear();
      super.terminate();
    }
  };

  window.Worker = InstrumentedWorker;

  return {
    snapshot: () => ({ ...state }),

    mark() {
      const before = { ...state };

      for (const key of Object.keys(state))
        if (key.startsWith("maximum")) state[key] = 0;

      return before;
    },

    since(before) {
      return Object.fromEntries(
        Object.entries(state).map(([key, value]) => [
          key,
          key.startsWith("maximum") ? value : value - before[key],
        ]),
      );
    },

    stop() {
      if (window.Worker === InstrumentedWorker) window.Worker = NativeWorker;
    },
  };
}

export const WorkerProbe = { start };
