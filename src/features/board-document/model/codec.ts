import { BoardSnapshots, type BoardSnapshot } from "~/entities/board";
import { BoardRegions } from "~/entities/board";
import type { ClipMask } from "~/entities/board";
import {
  type Point,
  type StabilizationProfile,
  type Stroke,
  BoardConstants,
} from "~/entities/board";
import type { BoardDocument } from "./types";
import { BoardLimits } from "~/entities/board";
const DOCUMENT_LIMITS = {
  bytes: 64 * 1024 * 1024,
  ...BoardLimits.SCENE_LIMITS,
};
const COORDINATE_LIMIT = 1e9;
function emptyDocument(): BoardDocument {
  return {
    format: "penable-board",
    schemaVersion: 2,
    strokes: [],
    viewport: { zoom: 1, x: 0, y: 0 },
    background: "blank",
    tools: { width: 3, stabilization: 65 },
  };
}
function cloneDocument(document: BoardDocument): BoardDocument {
  return {
    format: "penable-board",
    schemaVersion: document.schemaVersion,
    ...BoardSnapshots.clone(document),
  };
}
function toSnapshot(document: BoardDocument): BoardSnapshot {
  return {
    strokes: document.strokes,
    viewport: document.viewport,
    background: document.background,
    tools: document.tools,
  };
}
function fromSnapshot(snapshot: BoardSnapshot): BoardDocument {
  return { format: "penable-board", schemaVersion: 2, ...snapshot };
}
export const DocumentSnapshots = { toSnapshot, fromSnapshot };
function invalid(field: string): never {
  throw new Error(`Недопустимые данные: ${field}.`);
}
function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return invalid(field);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    return invalid(field);
  for (const key of ["__proto__", "constructor", "prototype"]) {
    if (Object.hasOwn(value, key)) return invalid(`${field}.${key}`);
  }
  return value as Record<string, unknown>;
}
function own(value: Record<string, unknown>, key: string): unknown {
  if (!Object.hasOwn(value, key)) return invalid(key);
  return value[key];
}
function number(
  value: unknown,
  min: number,
  max: number,
  field: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    return invalid(field);
  return value;
}
function coordinate(value: unknown, field: string) {
  return number(value, -COORDINATE_LIMIT, COORDINATE_LIMIT, field);
}
function decodeDocument(
  value: unknown,
  limits = DOCUMENT_LIMITS,
): BoardDocument {
  const root = object(value, "document");
  const schemaVersion = own(root, "schemaVersion");
  if (
    own(root, "format") !== "penable-board" ||
    (schemaVersion !== 1 && schemaVersion !== 2)
  )
    invalid("format/schemaVersion");
  const strokes = own(root, "strokes");
  if (!Array.isArray(strokes) || strokes.length > limits.strokes)
    invalid("strokes: превышен предел");
  for (let index = 0; index < strokes.length; index++)
    if (!Object.hasOwn(strokes, index)) invalid("strokes: пропущен элемент");
  let totalPoints = 0;
  const ids = new Set<number>();
  const sources = new Map<string, string>();
  let totalVertices = 0;
  const decoded: Stroke[] = strokes.map((entry: unknown) => {
    const stroke = object(entry, "stroke");
    const id = number(
      own(stroke, "id"),
      1,
      BoardLimits.MAX_STROKE_ID,
      "stroke.id",
    );
    if (!Number.isSafeInteger(id) || ids.has(id))
      invalid("stroke.id: повтор/небезопасное число");
    ids.add(id);
    if (own(stroke, "color") !== BoardConstants.INK) invalid("stroke.color");
    const rawPoints = own(stroke, "points");
    if (
      !Array.isArray(rawPoints) ||
      !rawPoints.length ||
      rawPoints.length > limits.pointsPerStroke
    )
      invalid("stroke.points: превышен предел/пусто");
    for (let index = 0; index < rawPoints.length; index++)
      if (!Object.hasOwn(rawPoints, index))
        invalid("stroke.points: пропущен элемент");
    totalPoints += rawPoints.length;
    if (totalPoints > limits.points) invalid("points: превышен общий предел");
    const points: Point[] = rawPoints.map((entry: unknown) => {
      const point = object(entry, "point");
      return {
        x: coordinate(own(point, "x"), "point.x"),
        y: coordinate(own(point, "y"), "point.y"),
        pressure: number(own(point, "pressure"), 0, 1, "point.pressure"),
        time: number(own(point, "time"), 0, Number.MAX_VALUE, "point.time"),
      };
    });
    const result: Stroke = {
      id,
      color: BoardConstants.INK,
      width: number(own(stroke, "width"), 0.5, 12, "stroke.width"),
      points,
    };
    if (Object.hasOwn(stroke, "stabilization")) {
      const profile = object(stroke.stabilization, "stabilization");
      const captureZoom = number(
        own(profile, "captureZoom"),
        0.25,
        8,
        "captureZoom",
      );
      if (Object.hasOwn(profile, "strength") === Object.hasOwn(profile, "mode"))
        invalid("stabilization: нужен strength или mode");
      let stabilization: StabilizationProfile;
      if (Object.hasOwn(profile, "strength"))
        stabilization = {
          strength: number(profile.strength, 0, 100, "strength"),
          captureZoom,
        };
      else {
        const mode = own(profile, "mode");
        if (mode !== "off" && mode !== "light" && mode !== "strong")
          invalid("mode");
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
          invalid("stroke.source");
        result.source = stroke.source as string;
      }
      if (Object.hasOwn(stroke, "translation")) {
        const offset = object(stroke.translation, "translation");
        result.translation = {
          x: coordinate(own(offset, "x"), "translation.x"),
          y: coordinate(own(offset, "y"), "translation.y"),
        };
      }
      if (Object.hasOwn(stroke, "clip")) {
        result.clip = decodeMask(stroke.clip);
        totalVertices += BoardRegions.vertexCount(result.clip);
        if (totalVertices > BoardRegions.REGION_LIMITS.document)
          invalid("clip: превышен общий предел 100000 вершин");
      }
      if ((result.clip || result.translation) && !result.source)
        invalid("stroke.source: требуется для фрагмента");
      if (result.source) {
        const signature = JSON.stringify({
          color: result.color,
          width: result.width,
          points: result.points,
          stabilization: result.stabilization,
        });
        const previous = sources.get(result.source);
        if (previous && previous !== signature)
          invalid("stroke.source: несовместимая исходная геометрия");
        sources.set(result.source, signature);
      }
    }
    return result;
  });
  const viewport = object(own(root, "viewport"), "viewport");
  const tools = object(own(root, "tools"), "tools");
  const background = own(root, "background");
  if (background !== "blank" && background !== "dots" && background !== "grid")
    invalid("background");
  const result: BoardDocument = {
    format: "penable-board",
    schemaVersion: schemaVersion as 1 | 2,
    strokes: decoded,
    viewport: {
      zoom: number(own(viewport, "zoom"), 0.25, 8, "viewport.zoom"),
      x: coordinate(own(viewport, "x"), "viewport.x"),
      y: coordinate(own(viewport, "y"), "viewport.y"),
    },
    background,
    tools: {
      width: number(own(tools, "width"), 0.5, 12, "tools.width"),
      stabilization: number(
        own(tools, "stabilization"),
        0,
        100,
        "tools.stabilization",
      ),
    },
  };
  if (
    new TextEncoder().encode(JSON.stringify(result)).byteLength > limits.bytes
  )
    invalid("размер документа превышает 64 MiB");
  return result;
}
function decodeMask(value: unknown): ClipMask {
  if (!Array.isArray(value) || !value.length) invalid("clip: пустая маска");
  let vertices = 0;
  const mask: ClipMask = value.map((polygon: unknown) => {
    if (!Array.isArray(polygon) || !polygon.length) invalid("clip.polygon");
    return polygon.map((ring: unknown) => {
      if (!Array.isArray(ring) || ring.length < 4) invalid("clip.ring");
      vertices += ring.length;
      if (vertices > BoardRegions.REGION_LIMITS.mask)
        invalid("clip: превышен предел 8192 вершин");
      const points: [number, number][] = ring.map((pair: unknown) => {
        if (!Array.isArray(pair) || pair.length !== 2) invalid("clip.point");
        return [coordinate(pair[0], "clip.x"), coordinate(pair[1], "clip.y")];
      });
      if (
        points[0]![0] !== points.at(-1)![0] ||
        points[0]![1] !== points.at(-1)![1]
      )
        invalid("clip: незамкнутая граница");
      return points;
    });
  });
  // Normalized topology has closed, nonintersecting outer/hole rings. Reject malformed
  // input, rather than silently repairing a backup and revealing hidden writing.
  const normalized = BoardRegions.normalizeMask(mask);
  if (JSON.stringify(normalized) !== JSON.stringify(mask))
    invalid("clip: требуется нормализованная топология");
  return normalized;
}
function parseDocumentJSON(text: string): BoardDocument {
  if (
    new TextEncoder().encode(text).byteLength >
    DocumentCodec.DOCUMENT_LIMITS.bytes
  )
    throw new Error("Файл превышает 64 MiB.");
  return decodeDocument(JSON.parse(text) as unknown);
}
function serializeDocument(document: BoardDocument): {
  json: string;
  warning: string;
} {
  const json = JSON.stringify(cloneDocument(document));
  let warning = "";
  try {
    parseDocumentJSON(json);
  } catch {
    warning =
      "Копия содержит все завершённые данные, но выходит за пределы поддерживаемого формата. Обратный импорт этой версией не поддерживается.";
  }
  return { json, warning };
}
function documentStats(document: BoardDocument) {
  return {
    strokes: document.strokes.length,
    points: document.strokes.reduce(
      (sum, stroke) => sum + stroke.points.length,
      0,
    ),
  };
}
function serializeRawBackup(value: unknown): string {
  const seen = new Set<object>();
  const compatible = (entry: unknown): boolean => {
    if (
      entry === null ||
      typeof entry === "string" ||
      typeof entry === "boolean"
    )
      return true;
    if (typeof entry === "number") return Number.isFinite(entry);
    if (typeof entry !== "object" || seen.has(entry)) return false;
    seen.add(entry);
    const array = Array.isArray(entry);
    const prototype = Object.getPrototypeOf(entry);
    if (
      array
        ? prototype !== Array.prototype
        : prototype !== Object.prototype && prototype !== null
    )
      return false;
    const keys = Reflect.ownKeys(entry);
    if (array) {
      if (keys.length !== entry.length + 1) return false;
      for (let index = 0; index < entry.length; index++)
        if (!Object.hasOwn(entry, index)) return false;
    }
    for (const key of keys) {
      if (array && key === "length") continue;
      if (typeof key !== "string") return false;
      const descriptor = Object.getOwnPropertyDescriptor(entry, key);
      if (
        !descriptor?.enumerable ||
        !Object.hasOwn(descriptor, "value") ||
        !compatible(descriptor.value)
      )
        return false;
    }
    return true;
  };
  try {
    if (!compatible(value)) throw new Error("unsupported");
    return JSON.stringify(value);
  } catch {
    throw new Error(
      "Исходная запись не представима в JSON без потери данных. Она сохранена в IndexedDB без изменений; JSON-копия не создана.",
    );
  }
}

export const DocumentCodec = {
  DOCUMENT_LIMITS,
  emptyDocument,
  cloneDocument,
  decodeDocument,
  parseDocumentJSON,
  serializeDocument,
  documentStats,
  serializeRawBackup,
};
