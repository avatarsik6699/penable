// Measurement collector (not a pass/fail gate). One alternating production-engine pair; repeat three times with state.pair=1/2/3.
if (!state.page || !state.page.url().startsWith("http://127.0.0.1:4180/"))
  throw new Error("Own benchmark tab required");

state.pairs ??= [];

const pair = { pair: state.pair || 1, builds: {} };

for (const label of ["baseline", "candidate"]) {
  await state.page.goto(`http://127.0.0.1:4180/${label}/`, {
    waitUntil: "domcontentloaded",
  });

  const metadata = await state.page.evaluate(() => penBench.metadata());

  const idle = await state.page.evaluate(
    () =>
      new Promise((resolve) => {
        const times = [];
        const watchdog = setTimeout(() => resolve(null), 2500);

        requestAnimationFrame(function frame(t) {
          times.push(t);

          if (times.length < 12) requestAnimationFrame(frame);
          else {
            clearTimeout(watchdog);
            resolve(times.slice(1).map((t, i) => t - times[i]));
          }
        });
      }),
  );

  if (!idle || Math.max(...idle) > 100)
    throw new Error(
      "RAF throttled: no trustworthy frame benchmark; use task mode and report it explicitly",
    );

  const results = [];

  // Warmup is excluded from reported measurements.
  await state.page.evaluate(() => penBench.ink(2000, 50, 65));
  results.push(await state.page.evaluate(() => penBench.ink(10000, 50, 65)));
  results.push(await state.page.evaluate(() => penBench.ink(50000, 200, 100)));

  results.push(
    await state.page.evaluate(() => penBench.navigation(10000, 50, false)),
  );

  results.push(
    await state.page.evaluate(() => penBench.navigation(20000, 1, true)),
  );

  pair.builds[label] = {
    metadata,
    idle,
    results,
    logs: await getLatestLogs({ page: state.page, sinceLastCall: true }),
  };
}

state.pairs.push(pair);

require("node:fs").writeFileSync(
  ".artifacts/performance/pairs.json",
  JSON.stringify(state.pairs, null, 2),
);

console.log(pair);
