// Playwriter -f runner. Start in-page, collect with short read-only polls.
// state.documentAudit = {action:"start"|"collect", label, pair, count?}.
const fs = require("node:fs");
const config = state.documentAudit;

if (
  !config ||
  !["baseline", "candidate"].includes(config.label) ||
  !Number.isInteger(config.pair)
)
  throw new Error("Document audit configuration required");

if (config.action === "start") {
  if (!state.page || !state.page.url().startsWith("http://127.0.0.1:4180/"))
    throw new Error("Owned benchmark tab required");

  const pending = await state.page.evaluate(() =>
    Boolean(window.__documentAudit42 && !window.__documentAudit42.done),
  );

  if (pending) throw new Error("A document measurement is still running");

  await state.page.goto(
    `http://127.0.0.1:4180/${config.label}${config.scope === "replacement" ? "-replacement" : ""}/`,
    {
      waitUntil: "domcontentloaded",
    },
  );

  await state.page.bringToFront();
  await state.page.evaluate(() => applicationBench.claimStorage());

  const provenance = await state.page.evaluate(() =>
    fetch("./provenance.json").then((response) => response.json()),
  );

  state.documentReceipt = {
    label: config.label,
    pair: config.pair,
    scope: config.scope ?? "full",
    provenance,
    metadata: await state.page.evaluate(() => penBench.metadata()),
  };

  console.log(
    await state.page.evaluate(
      ({ count, replacementOnly }) => {
        const receipt = {
          origin: performance.timeOrigin,
          done: false,
          result: null,
          error: null,
          idle: [],
        };

        window.__documentAudit42 = receipt;

        void (async () => {
          await applicationBench.documentPipeline(100, replacementOnly);

          await new Promise((resolve) => {
            const times = [];

            requestAnimationFrame(function frame(time) {
              times.push(time);

              if (times.length < 12) requestAnimationFrame(frame);
              else {
                receipt.idle = times
                  .slice(1)
                  .map((value, i) => value - times[i]);

                resolve();
              }
            });
          });

          if (Math.max(...receipt.idle) > 100)
            throw new Error("Invalid foreground RAF cadence");

          receipt.result = await applicationBench.documentPipeline(
            count,
            replacementOnly,
          );
        })()
          .catch((error) => {
            receipt.error = {
              name: error.name,
              message: error.message,
              stack: error.stack,
            };
          })
          .finally(() => {
            receipt.done = true;
          });

        return { started: true, origin: receipt.origin };
      },
      {
        count: config.count ?? 20000,
        replacementOnly: config.scope === "replacement",
      },
    ),
  );
} else if (config.action === "collect") {
  const result = await state.page.evaluate(() => {
    const receipt = window.__documentAudit42;

    if (!receipt || receipt.origin !== performance.timeOrigin)
      throw new Error("Document measurement context changed");

    return receipt.done ? receipt : { done: false, origin: receipt.origin };
  });

  if (!result.done) console.log(result);
  else {
    const logs = await getLatestLogs({ page: state.page, sinceLastCall: true });
    const path = `.artifacts/change-42/${config.scope === "replacement" ? "replacement" : "document"}-${config.pair}-${config.label}.json`;

    fs.mkdirSync(".artifacts/change-42", { recursive: true });

    fs.writeFileSync(
      path,
      JSON.stringify({ ...state.documentReceipt, ...result, logs }, null, 2),
    );

    console.log({
      path,
      error: result.error,
      exact: result.result?.exact,
      phases: result.result?.results.map((phase) => ({
        phase: phase.phase,
        wall: phase.wallMs,
        gap: phase.taskGaps.max,
        longTasks: phase.longTasks.length,
        pointPackets: phase.transfer.pointMessages,
        incomingPointPackets: phase.transfer.incomingPointMessages,
        maxOutgoing: phase.transfer.maximumOutgoing,
      })),
      logs,
    });
  }
} else throw new Error("Unknown document audit action");
