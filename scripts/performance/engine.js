// This entry is bundled separately from the application. No diagnostic globals ship to Pages.
import { CanvasRenderer } from '@drawing/renderer.ts'
import { PenInput } from '@drawing/input.ts'
import { EraserInput } from '@drawing/eraser.ts'
import { StrokeHistory } from '@drawing/history.ts'
import { sourceGeometry } from '@drawing/source-geometry.ts'
import { strokeGeometry } from '@drawing/geometry.ts'
import { stabilizedPositions } from '@drawing/stabilization.ts'
import { paintStroke } from '@drawing/paint.ts'

let scheduling = 'raf'
const nextFrame = () => scheduling === 'raf' ? new Promise(resolve => requestAnimationFrame(resolve)) : new Promise(resolve => {
  const channel = new MessageChannel()
  channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); resolve(performance.now()) }
  channel.port2.postMessage(null)
})
function stats(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return { count: values.length, median: sorted[Math.floor(sorted.length / 2)] ?? 0,
    p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0,
    max: sorted.at(-1) ?? 0, total: values.reduce((a, b) => a + b, 0) }
}
function point(i, offset = 0) { return { x: 20 + offset + (i % 600) * 1.8, y: 80 + Math.sin(i * 0.16) * 22 + Math.sin(i * 0.031) * 45, pressure: 0.5, time: i * 4 + 1 } }
function note(id, points = 50, dense = false) {
  const x = dense ? (id % 100) * 10 : (id % 40) * 160
  const y = dense ? Math.floor(id / 100) * 3 : Math.floor(id / 40) * 80
  return { id, color: '#182230', width: 2, stabilization: { strength: 65, captureZoom: 1 },
    points: Array.from({ length: points }, (_, i) => ({ x: x + i * 2, y: y + Math.sin(i * 0.7) * 10, pressure: 0.5, time: i * 4 + 1 })) }
}
function setup(strokes = []) {
  const scene = { strokes, active: null }, pending = new Map()
  let id = 0
  const canvas = ['completed', 'live'].map(id => document.getElementById(id))
  const renderer = new CanvasRenderer(...canvas.map(canvas => ({ canvas, context: canvas.getContext('2d') })), scene,
    { zoom: 1, x: 0, y: 0 }, { request: callback => { pending.set(++id, callback); return id }, cancel: id => pending.delete(id) })
  const flush = () => { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback()) }
  renderer.resize(1280, 720, window.devicePixelRatio)
  return { scene, renderer, flush }
}
function pointer(sample, buttons = 1) {
  return { pointerId: 1, pointerType: 'pen', isPrimary: true, button: 0, buttons,
    clientX: sample.x, clientY: sample.y, pressure: sample.pressure, timeStamp: sample.time }
}
async function observe(operation) {
  const tasks = [], observer = new PerformanceObserver(list => tasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration }))))
  observer.observe({ type: 'longtask' })
  await nextFrame()
  const start = performance.now()
  const result = await operation()
  const end = performance.now()
  await nextFrame(); await new Promise(resolve => setTimeout(resolve, 0))
  tasks.push(...observer.takeRecords().map(entry => ({ start: entry.startTime, duration: entry.duration })))
  observer.disconnect()
  return { ...result, scheduling, wallMs: end - start, longTasks: tasks.filter(task => task.start >= start && task.start < end) }
}
let held = null
const api = {
  schedule(mode) { if (!['raf', 'tasks'].includes(mode)) throw new Error('Unknown scheduler'); scheduling = mode },
  metadata: () => ({ userAgent: navigator.userAgent, dpr: devicePixelRatio, viewport: [innerWidth, innerHeight], canvas: [1280, 720], scheduling }),
  async ink(count = 10000, batch = 50, strength = 65) {
    const { scene, renderer, flush } = setup(), work = [], intervals = []
    const history = new StrokeHistory(scene.strokes)
    const samples = Array.from({ length: count }, (_, i) => point(i))
    const input = new PenInput({ scene, bounds: () => ({ left: 0, top: 0 }), viewport: () => ({ zoom: 1, x: 0, y: 0 }), width: () => 3, stabilization: () => strength,
      onActiveChange: () => renderer.activeChanged(), onCommit: ink => { history.commit(ink); renderer.commit(ink) } })
    flush()
    const result = await observe(async () => {
      input.down(pointer(samples[0])); flush()
      let previous = performance.now()
      for (let offset = 1; offset < samples.length; offset += batch) {
        await nextFrame(); const now = performance.now(); intervals.push(now - previous); previous = now
        const values = samples.slice(offset, offset + batch).map(value => pointer(value))
        const t = performance.now()
        input.move({ ...values.at(-1), getCoalescedEvents: () => values }); flush()
        work.push(performance.now() - t)
      }
      const t = performance.now(); input.up(pointer(samples.at(-1), 0)); flush()
      return { fixture: 'ink', count, batch, strength, work: stats(work), frames: stats(intervals), finishMs: performance.now() - t, committed: scene.strokes.length, rawPoints: scene.strokes[0].points.length }
    })
    renderer.dispose(); return result
  },
  async navigation(count = 2000, points = 50, dense = false) {
    const { renderer, flush } = setup(Array.from({ length: count }, (_, i) => note(i + 1, points, dense)))
    const start = performance.now(); flush(); const coldMs = performance.now() - start
    const work = [], intervals = []
    const result = await observe(async () => {
      let previous = performance.now()
      for (let i = 0; i < 90; i++) {
        await nextFrame(); const now = performance.now(); intervals.push(now - previous); previous = now
        const t = performance.now()
        renderer.setViewport({ zoom: i < 45 ? 1 : 1 + (i - 45) / 90, x: -i * 4, y: -i * 2 }); flush()
        work.push(performance.now() - t)
      }
      return { fixture: 'navigation', count, points, dense, coldMs, work: stats(work), frames: stats(intervals) }
    })
    renderer.dispose(); return result
  },
  async eraser(count = 10000) {
    const { scene, renderer, flush } = setup(Array.from({ length: count }, (_, i) => note(i + 1)))
    flush()
    const input = new EraserInput({ scene, bounds: () => ({ left: 0, top: 0 }), viewport: () => ({ zoom: 1, x: 0, y: 0 }), onPreviewChange: () => {}, onCommit: () => {} })
    const work = []
    const result = await observe(async () => {
      input.down(pointer({ x: 50, y: 50, pressure: 0.5, time: 1 }))
      for (let i = 0; i < 60; i++) {
        await nextFrame(); const t = performance.now()
        input.move(pointer({ x: 50 + i * 2, y: 50 + Math.sin(i) * 20, pressure: 0.5, time: i + 2 }))
        work.push(performance.now() - t)
      }
      input.cancel(); return { fixture: 'eraser-hit-test', scope: 'input hit-test only; excludes preview redraw and commit', count, work: stats(work) }
    })
    renderer.dispose(); return result
  },
  async history(count = 20000, operations = 500) {
    api.release()
    const strokes = Array.from({ length: count }, (_, i) => note(i + 1, 1))
    held = new StrokeHistory(strokes, strokes.length)
    const work = []
    const result = await observe(async () => {
      for (let i = 0; i < operations; i++) {
        if (i % 20 === 0) await nextFrame()
        const candidate = [...strokes], index = Math.floor(count / 2)
        candidate[index] = { ...candidate[index], translation: { x: i + 1, y: 0 } }
        const start = performance.now(); held.replace(candidate); work.push(performance.now() - start)
      }
      const t = performance.now()
      for (let i = 0; i < operations; i++) held.undo()
      for (let i = 0; i < operations; i++) held.redo()
      return { fixture: 'history', count, operations, work: stats(work), undoRedoMs: performance.now() - t,
        restored: strokes.length === count && strokes[Math.floor(count / 2)].translation.x === operations }
    })
    return result
  },
  release() { held = null },
  async lifecycle(cycles = 20) {
    for (let i = 0; i < cycles; i++) {
      const { scene, renderer, flush } = setup(Array.from({ length: 2000 }, (_, j) => note(j + 1)))
      flush(); renderer.setViewport({ zoom: 2, x: -100, y: -100 }); flush()
      renderer.dispose(); scene.strokes.length = 0
      if (i % 2 === 0) await nextFrame()
    }
    return { cycles }
  },
  raster() {
    const diffs = []
    for (const dpr of [1, 2]) for (const strength of [0, 1, 49, 50, 65, 99, 100]) for (const zoom of [0.25, 1, 4, 8]) {
      const ink = note(1, 100); ink.width = 0.7; ink.points = []; ink.stabilization = { strength, captureZoom: zoom }
      const canvases = Array.from({ length: 2 }, () => Object.assign(document.createElement('canvas'), { width: 512 * dpr, height: 256 * dpr }))
      const contexts = canvases.map(canvas => canvas.getContext('2d', { willReadFrequently: true }))
      for (let i = 0; i < 100; i++) {
        ink.points.push({ ...point(i), x: 20 + i * 2.5, y: 100 + Math.sin(i * 0.4) * 50 })
        if (i % 9 !== 0 && i !== 99) { sourceGeometry(ink, true); continue }
        contexts.forEach(ctx => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 512 * dpr, 256 * dpr); ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * (20 - 20 * zoom), dpr * (100 - 100 * zoom)) })
        paintStroke(contexts[0], ink, true)
        const geometry = strokeGeometry(stabilizedPositions(ink.points, ink.stabilization), ink.width)
        const reference = { ...ink, points: stabilizedPositions(ink.points, ink.stabilization) }; delete reference.stabilization
        paintStroke(contexts[1], reference)
        const actual = sourceGeometry(ink, true)
        if (JSON.stringify(actual) !== JSON.stringify(geometry)) throw new Error('Geometry mismatch')
        const a = contexts[0].getImageData(0, 0, 512 * dpr, 256 * dpr).data, b = contexts[1].getImageData(0, 0, 512 * dpr, 256 * dpr).data
        let different = 0; for (let pixel = 0; pixel < a.length; pixel++) if (a[pixel] !== b[pixel]) different++
        if (different) diffs.push({ dpr, strength, zoom, prefix: i + 1, different })
      }
    }
    return { comparisons: 2 * 7 * 4 * 12, diffs }
  },
}
window.penBench = api
