// Execute with Playwriter -f after navigating an OWN tab to a bench:build output.
// state.label chooses an artifact filename; this runner never opens application storage.
const fs = require('node:fs')
if (!state.page || !/^http:\/\/127\.0\.0\.1:4180\//.test(state.page.url())) throw new Error('Navigate an owned page to bench:serve on port4180 first')
state.cdp = await getCDPSession({ page: state.page })
const collect = async () => {
  let collected = true
  try { await state.cdp.send('HeapProfiler.collectGarbage') } catch { collected = false }
  return { collected, ...(await state.cdp.send('Runtime.getHeapUsage')) }
}
state.results = { metadata: await state.page.evaluate(() => penBench.metadata()), cases: [] }
if (state.results.metadata.scheduling === 'raf') {
  state.results.idle = await state.page.evaluate(() => new Promise(resolve => {
    const times = []; const watchdog = setTimeout(() => resolve(null), 2500)
    requestAnimationFrame(function frame(t) { times.push(t); if (times.length < 12) requestAnimationFrame(frame); else { clearTimeout(watchdog); resolve(times.slice(1).map((t, i) => t - times[i])) } })
  }))
  if (!state.results.idle || Math.max(...state.results.idle) > 100) throw new Error('RAF throttled: restore cadence in owned test tab, or select tasks mode and disclose that limitation')
}

for (const args of [[10000, 50, 65], [10000, 50, 0], [50000, 200, 100]]) {
  state.results.cases.push(await state.page.evaluate(args => penBench.ink(...args), args))
}
for (const args of [[200, 50, false], [2000, 50, false], [10000, 50, false], [20000, 1, true]]) {
  state.results.cases.push(await state.page.evaluate(args => penBench.navigation(...args), args))
}
state.results.cases.push(await state.page.evaluate(() => penBench.eraser(10000)))
await state.page.evaluate(() => penBench.release())
state.results.heapBeforeHistory = await collect()
state.results.cases.push(await state.page.evaluate(() => penBench.history(20000, 500)))
state.results.heapWithHistory = await collect()
await state.page.evaluate(() => penBench.release())
state.results.heapAfterHistory = await collect()
await state.page.evaluate(() => penBench.lifecycle(20))
state.results.heapAfterLifecycle = await collect()
state.results.raster = await state.page.evaluate(() => penBench.raster())
state.results.logs = await getLatestLogs({ page: state.page, sinceLastCall: true })
fs.mkdirSync('.artifacts/performance', { recursive: true })
const name = String(state.label || 'candidate').replace(/[^a-zA-Z0-9_-]/g, '_')
fs.writeFileSync(`.artifacts/performance/${name}.json`, JSON.stringify(state.results, null, 2))
console.log(state.results)

const failures = []
if (state.results.raster.diffs.length) failures.push('native raster mismatch')
for (const value of state.results.cases) {
  if (value.fixture === 'ink' && (value.committed !== 1 || value.rawPoints !== value.count)) failures.push('ink commit/raw points mismatch')
  if (value.fixture === 'history' && !value.restored) failures.push('history roundtrip failed')
  const ordinary = (value.fixture === 'ink' && value.count === 10000) || (value.fixture === 'navigation' && value.count === 200)
  if (ordinary && value.longTasks.length && name !== 'baseline') failures.push('ordinary main-thread long task')
}
if (state.results.logs.some(line => /\[(?:error|warn)\]/i.test(line))) failures.push('browser console errors/warnings')
if (failures.length) throw new Error(failures.join('; '))
