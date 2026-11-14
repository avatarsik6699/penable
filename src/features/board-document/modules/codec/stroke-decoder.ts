import {
  type Stroke,
  BoardLimits,
  BoardConstants,
  type Point,
  type StabilizationProfile,
  BoardRegions,
} from "~/entities/board";
import { BoardWriting } from "~/entities/board";
import { WritingDecoder } from "./writing-decoder";
import { CodecConfig } from "./document-codec.config";
import { CodecPrimitives } from "./document-codec.utils";
import { MaskDecoder } from "./mask-decoder";

function decodeStrokes(
  strokes: unknown,
  schemaVersion: 1 | 2,
  limits: typeof CodecConfig.DOCUMENT_LIMITS,
  modern = false,
): Stroke[] {
  if (!Array.isArray(strokes) || strokes.length > limits.strokes)
    CodecPrimitives.invalid("strokes: превышен предел");

  for (let index = 0; index < strokes.length; index++)
    if (!Object.hasOwn(strokes, index))
      CodecPrimitives.invalid("strokes: пропущен элемент");

  let totalPoints = 0;
  const ids = new Set<number>();
  const sources = new Map<string, string>();
  let totalVertices = 0;

  const decoded: Stroke[] = strokes.map((entry: unknown) => {
    const stroke = CodecPrimitives.object(entry, "stroke");

    const id = CodecPrimitives.number(
      CodecPrimitives.own(stroke, "id"),
      1,
      BoardLimits.MAX_STROKE_ID,
      "stroke.id",
    );

    if (!Number.isSafeInteger(id) || ids.has(id))
      CodecPrimitives.invalid("stroke.id: повтор/небезопасное число");

    ids.add(id);

    if (
      modern
        ? !BoardWriting.isColor(stroke.color)
        : CodecPrimitives.own(stroke, "color") !== BoardConstants.INK
    )
      CodecPrimitives.invalid("stroke.color");

    const rawPoints = CodecPrimitives.own(stroke, "points");

    if (
      !Array.isArray(rawPoints) ||
      !rawPoints.length ||
      rawPoints.length > limits.pointsPerStroke
    )
      CodecPrimitives.invalid("stroke.points: превышен предел/пусто");

    for (let index = 0; index < rawPoints.length; index++)
      if (!Object.hasOwn(rawPoints, index))
        CodecPrimitives.invalid("stroke.points: пропущен элемент");

    totalPoints += rawPoints.length;

    if (totalPoints > limits.points)
      CodecPrimitives.invalid("points: превышен общий предел");

    const points: Point[] = rawPoints.map((entry: unknown) => {
      const point = CodecPrimitives.object(entry, "point");

      return {
        x: CodecPrimitives.coordinate(
          CodecPrimitives.own(point, "x"),
          "point.x",
        ),
        y: CodecPrimitives.coordinate(
          CodecPrimitives.own(point, "y"),
          "point.y",
        ),
        pressure: CodecPrimitives.number(
          CodecPrimitives.own(point, "pressure"),
          0,
          1,
          "point.pressure",
        ),
        time: CodecPrimitives.number(
          CodecPrimitives.own(point, "time"),
          0,
          Number.MAX_VALUE,
          "point.time",
        ),
      };
    });

    const result: Stroke = {
      id,
      color: modern
        ? (stroke.color as import("~/entities/board").InkColor)
        : BoardConstants.INK,
      ...(modern && Object.hasOwn(stroke, "style")
        ? { style: WritingDecoder.style(stroke.style) }
        : {}),
      width: CodecPrimitives.number(
        CodecPrimitives.own(stroke, "width"),
        0.5,
        modern &&
          (stroke.style as Record<string, unknown> | undefined)?.instrument ===
            "highlighter"
          ? 64
          : 12,
        "stroke.width",
      ),
      points,
    };

    if (result.style?.instrument === "highlighter" && result.width < 4)
      CodecPrimitives.invalid("stroke.width");

    if (Object.hasOwn(stroke, "stabilization")) {
      const profile = CodecPrimitives.object(
        stroke.stabilization,
        "stabilization",
      );

      const captureZoom = CodecPrimitives.number(
        CodecPrimitives.own(profile, "captureZoom"),
        0.25,
        8,
        "captureZoom",
      );

      if (Object.hasOwn(profile, "strength") === Object.hasOwn(profile, "mode"))
        CodecPrimitives.invalid("stabilization: нужен strength или mode");

      let stabilization: StabilizationProfile;

      if (Object.hasOwn(profile, "strength"))
        stabilization = {
          strength: CodecPrimitives.number(
            profile.strength,
            0,
            100,
            "strength",
          ),
          captureZoom,
        };
      else {
        const mode = CodecPrimitives.own(profile, "mode");

        if (mode !== "off" && mode !== "light" && mode !== "strong")
          CodecPrimitives.invalid("mode");

        stabilization = { mode, captureZoom };
      }

      result.stabilization = stabilization;
    }

    if (schemaVersion === 2) {
      if (Object.hasOwn(stroke, "source")) {
        if (
          typeof stroke.source !== "string" ||
          !/^[a-zA-Z0-9_-]{1,160}$/.test(stroke.source)
        )
          CodecPrimitives.invalid("stroke.source");

        result.source = stroke.source as string;
      }

      if (Object.hasOwn(stroke, "translation")) {
        const offset = CodecPrimitives.object(
          stroke.translation,
          "translation",
        );

        result.translation = {
          x: CodecPrimitives.coordinate(
            CodecPrimitives.own(offset, "x"),
            "translation.x",
          ),
          y: CodecPrimitives.coordinate(
            CodecPrimitives.own(offset, "y"),
            "translation.y",
          ),
        };
      }

      if (Object.hasOwn(stroke, "clip")) {
        result.clip = MaskDecoder.decodeMask(stroke.clip);
        totalVertices += BoardRegions.vertexCount(result.clip);

        if (totalVertices > BoardRegions.REGION_LIMITS.document)
          CodecPrimitives.invalid("clip: превышен общий предел 100000 вершин");
      }

      if ((result.clip || result.translation) && !result.source)
        CodecPrimitives.invalid("stroke.source: требуется для фрагмента");

      if (result.source) {
        const signature = JSON.stringify({
          color: result.color,
          width: result.width,
          points: result.points,
          stabilization: result.stabilization,
          style: result.style,
        });

        const previous = sources.get(result.source);

        if (previous && previous !== signature)
          CodecPrimitives.invalid(
            "stroke.source: несовместимая исходная геометрия",
          );

        sources.set(result.source, signature);
      }
    }

    return result;
  });

  return decoded;
}

export const StrokeDecoder = { decodeStrokes };
