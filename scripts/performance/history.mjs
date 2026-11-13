// A retained object-graph comparison, independent of GC availability in Chrome.
import { build } from 'vite'
import { serialize } from 'node:v8'
import { resolve } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const source = resolve(process.env.PENABLE_BENCH_SOURCE || 'src')
const out = resolve(process.env.PENABLE_BENCH_OUT || '.artifacts/performance')
await mkdir(out, { recursive: true })
await build({ configFile: false, logLevel: 'silent', build: { target: 'esnext', minify: false, outDir: out, emptyOutDir: false,
  lib: { entry: resolve(source, 'drawing/history.ts'), formats: ['es'], fileName: () => 'history.mjs' } } })
const { StrokeHistory } = await import(pathToFileURL(resolve(out, 'history.mjs')).href)
const strokes = Array.from({ length: 20000 }, (_, i) => ({ id: i + 1, color: '#182230', width: 3, points: [{ x: i, y: i, pressure: 0.5, time: 1 }] }))
const history = new StrokeHistory(strokes, strokes.length)
const before = serialize(history).byteLength
const started = performance.now()
for (let i = 0; i < 500; i++) {
  const next = [...strokes]
  next[10000] = { ...next[10000], translation: { x: i + 1, y: 0 } }
  history.replace(next)
}
const editMs = performance.now() - started
const after = serialize(history).byteLength
const undoStart = performance.now()
for (let i = 0; i < 500; i++) history.undo()
const undone = !strokes[10000].translation
for (let i = 0; i < 500; i++) history.redo()
const result = { fixture: '20000 baseline objects, 500 single-object replacements', beforeBytes: before, afterBytes: after, retainedGraphGrowthBytes: after - before, editMs, undoRedoMs: performance.now() - undoStart,
  restored: undone && strokes[10000].translation.x === 500 && strokes.length === 20000 }
if (!result.restored) throw new Error('History roundtrip failed')
await writeFile(resolve(out, 'history.json'), JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
