import { build } from 'vite'
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const source = resolve(process.env.PENABLE_BENCH_SOURCE || 'src')
const out = resolve(process.env.PENABLE_BENCH_OUT || '.artifacts/performance')
const hash = createHash('sha256')
for (const file of (await readdir(source, { recursive: true })).filter(file => /\.tsx?$/.test(file) && !file.endsWith('.test.ts')).sort()) {
  hash.update(file); hash.update(await readFile(resolve(source, file)))
}
const sourceHash = hash.digest('hex')
await mkdir(out, { recursive: true })
await build({
  configFile: false, logLevel: 'warn',
  resolve: { alias: { '@drawing': resolve(source, 'drawing') } },
  build: { outDir: out, emptyOutDir: false, minify: true,
    lib: { entry: resolve('scripts/performance/engine.js'), formats: ['es'], fileName: () => 'engine.js' } },
})
await writeFile(resolve(out, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Penable engine benchmark</title><link rel="icon" href="data:,"><body style="margin:0"><main style="position:relative;width:1280px;height:720px;background:white"><canvas id="completed" style="position:absolute;inset:0"></canvas><canvas id="live" style="position:absolute;inset:0"></canvas></main><p>Owned synthetic fixtures only. Run with Playwriter; this page never opens application storage.</p><script type="module" src="./engine.js"></script></body></html>`)
await writeFile(resolve(out, 'provenance.json'), JSON.stringify({ source, sourceHash, revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), node: process.version, builtAt: new Date().toISOString() }, null, 2))
console.log(out)
