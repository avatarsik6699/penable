// Playwriter -f runner; one bounded suite per invocation, alternating baseline/candidate.
// state.label, state.pair and state.suite select the receipt, never application data.
const fs = require("node:fs");
const label = state.label;
const suite = state.suite || "engine";
const pair = state.pair || 1;

if (!["baseline", "candidate"].includes(label))
  throw new Error("Select baseline/candidate");

if (!state.page || !state.page.url().startsWith("http://127.0.0.1:4180/"))
  throw new Error("Owned benchmark tab required");

await state.page.goto(`http://127.0.0.1:4180/${label}/`, {
  waitUntil: "domcontentloaded",
});

await state.page.bringToFront();

const receipt = {
  label,
  pair,
  suite,
  metadata: await state.page.evaluate(() => penBench.metadata()),
  provenance: await state.page.evaluate(() =>
    fetch("./provenance.json").then((response) => response.json()),
  ),
  results: [],
};

receipt.idle = await state.page.evaluate(
  () =>
    new Promise((resolve) => {
      const times = [];
      const watchdog = setTimeout(() => resolve(null), 2500);

      requestAnimationFrame(function frame(time) {
        times.push(time);

        if (times.length < 12) requestAnimationFrame(frame);
        else {
          clearTimeout(watchdog);
          resolve(times.slice(1).map((time, i) => time - times[i]));
        }
      });
    }),
);

if (!receipt.idle || Math.max(...receipt.idle) > 100)
  throw new Error("Invalid foreground RAF cadence; discard run");

if (suite === "engine") {
  await state.page.evaluate(() => penBench.ink(2000, 50, 65));

  for (const args of [
    [500, 25, 65],
    [2000, 50, 65],
    [10000, 50, 65],
    [10000, 50, 65, "pressure"],
    [10000, 50, 65, "highlighter"],
  ])
    receipt.results.push(
      await state.page.evaluate((args) => penBench.ink(...args), args),
    );

  for (const args of [
    [200, 50, false],
    [2000, 50, false],
    [10000, 50, false],
    [20000, 1, true],
  ])
    receipt.results.push(
      await state.page.evaluate((args) => penBench.navigation(...args), args),
    );

  receipt.results.push(
    await state.page.evaluate(() => penBench.history(20000, 120)),
  );
} else if (suite === "files") {
  await state.page.evaluate(() => applicationBench.fileIO(200, 50));

  for (const args of [
    [200, 50],
    [2000, 50],
    [10000, 50],
    [1, 100000],
    [2000, 50, true],
  ])
    receipt.results.push(
      await state.page.evaluate(
        (args) => applicationBench.fileIO(...args),
        args,
      ),
    );
} else if (suite === "jobs") {
  await state.page.evaluate(() => applicationBench.claimStorage());

  for (const args of [
    [200, 50],
    [2000, 50],
    [2000, 50, true],
  ])
    receipt.results.push(
      await state.page.evaluate((args) => applicationBench.jobs(...args), args),
    );

  receipt.results.push(
    await state.page.evaluate(() => applicationBench.session(2000, 50, 3)),
  );

  receipt.results.push(
    await state.page.evaluate(() => applicationBench.cancellation()),
  );
} else if (suite === "selection") {
  for (const count of [5000, 20000])
    receipt.results.push(
      await state.page.evaluate(
        (count) => applicationBench.selectionState(count),
        count,
      ),
    );
} else if (suite === "raster") {
  receipt.results.push(await state.page.evaluate(() => penBench.raster()));

  receipt.results.push(
    await state.page.evaluate(() => penBench.instrumentRaster()),
  );

  receipt.results.push(
    await state.page.evaluate(() => penBench.mixedContent()),
  );
} else throw new Error("Unknown audit suite");

receipt.logs = await getLatestLogs({ page: state.page, sinceLastCall: true });

fs.mkdirSync(".artifacts/change-40", { recursive: true });

const path = `.artifacts/change-40/audit-${suite}-${pair}-${label}.json`;

fs.writeFileSync(path, JSON.stringify(receipt, null, 2));

console.log({
  path,
  cases: receipt.results.length,
  idleMax: Math.max(...receipt.idle),
  logs: receipt.logs,
});
