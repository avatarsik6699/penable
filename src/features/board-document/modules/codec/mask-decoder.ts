import { type ClipMask, BoardRegions } from "~/entities/board";
import { CodecPrimitives } from "./document-codec.utils";

function decodeMask(value: unknown): ClipMask {
  if (!Array.isArray(value) || !value.length)
    CodecPrimitives.invalid("clip: пустая маска");

  let vertices = 0;

  const mask: ClipMask = value.map((polygon: unknown) => {
    if (!Array.isArray(polygon) || !polygon.length)
      CodecPrimitives.invalid("clip.polygon");

    return polygon.map((ring: unknown) => {
      if (!Array.isArray(ring) || ring.length < 4)
        CodecPrimitives.invalid("clip.ring");

      vertices += ring.length;

      if (vertices > BoardRegions.REGION_LIMITS.mask)
        CodecPrimitives.invalid("clip: превышен предел 8192 вершин");

      const points: [number, number][] = ring.map((pair: unknown) => {
        if (!Array.isArray(pair) || pair.length !== 2)
          CodecPrimitives.invalid("clip.point");

        return [
          CodecPrimitives.coordinate(pair[0], "clip.x"),
          CodecPrimitives.coordinate(pair[1], "clip.y"),
        ];
      });

      if (
        points[0]![0] !== points.at(-1)![0] ||
        points[0]![1] !== points.at(-1)![1]
      )
        CodecPrimitives.invalid("clip: незамкнутая граница");

      return points;
    });
  });

  // Normalized topology has closed, nonintersecting outer/hole rings. Reject malformed
  // input, rather than silently repairing a backup and revealing hidden writing.
  const normalized = BoardRegions.normalizeMask(mask);

  if (JSON.stringify(normalized) !== JSON.stringify(mask))
    CodecPrimitives.invalid("clip: требуется нормализованная топология");

  return normalized;
}

export const MaskDecoder = { decodeMask };
