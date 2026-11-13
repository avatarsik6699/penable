import { paintStrokes } from './paint'
import { visibleBounds, type InkBounds } from './regions'
import type { Stroke } from './types'

export function pngDimensions(bounds: InkBounds): { width: number; height: number } {
  const width = Math.max(1, Math.ceil((bounds.right - bounds.left) * 2) + 4)
  const height = Math.max(1, Math.ceil((bounds.bottom - bounds.top) * 2) + 4)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width > 8192 || height > 8192 || width * height > 16_777_216) {
    throw new Error('PNG превышает предел 8192 px по стороне или 16 777 216 пикселей. Выделите меньший фрагмент.')
  }
  return { width, height }
}
export async function selectionPNG(strokes: readonly Stroke[]): Promise<Blob> {
  const bounds = visibleBounds(strokes)
  if (!bounds) throw new Error('Сначала выделите записи.')
  const size = pngDimensions(bounds)
  const canvas = document.createElement('canvas')
  canvas.width = size.width; canvas.height = size.height
  try {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Не удалось создать PNG: Canvas 2D недоступен.')
    context.setTransform(2, 0, 0, 2, 2 - bounds.left * 2, 2 - bounds.top * 2)
    paintStrokes(context, strokes)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Не удалось создать PNG.')), 'image/png'))
  } finally { canvas.width = 0; canvas.height = 0 }
}
export function downloadPNG(blob: Blob) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = 'penable-selection.png'; document.body.append(link)
  try { link.click() } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 0) }
}

export function writePNG(png: Promise<Blob>): Promise<void> {
  try {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) throw new Error('Системный буфер недоступен.')
    return navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
  } catch (error) { return Promise.reject(error) }
}
