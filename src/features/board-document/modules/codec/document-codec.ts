import { type BoardDocument } from "../../board-document.types";
import { CodecConfig } from "./document-codec.config";
import { CodecPrimitives } from "./document-codec.utils";
import { StrokeDecoder } from "./stroke-decoder";
import { SnapshotOperations } from "./document-snapshots";
import { BackupSerializer } from "./backup-serializer";

function decodeDocument(
  value: unknown,
  limits = CodecConfig.DOCUMENT_LIMITS,
): BoardDocument {
  const root = CodecPrimitives.object(value, "document");
  const schemaVersion = CodecPrimitives.own(root, "schemaVersion");

  if (
    CodecPrimitives.own(root, "format") !== "penable-board" ||
    (schemaVersion !== 1 && schemaVersion !== 2)
  )
    CodecPrimitives.invalid("format/schemaVersion");

  const decoded = StrokeDecoder.decodeStrokes(
    CodecPrimitives.own(root, "strokes"),
    schemaVersion as 1 | 2,
    limits,
  );

  const viewport = CodecPrimitives.object(
    CodecPrimitives.own(root, "viewport"),
    "viewport",
  );

  const tools = CodecPrimitives.object(
    CodecPrimitives.own(root, "tools"),
    "tools",
  );

  const background = CodecPrimitives.own(root, "background");

  if (background !== "blank" && background !== "dots" && background !== "grid")
    CodecPrimitives.invalid("background");

  const result: BoardDocument = {
    format: "penable-board",
    schemaVersion: schemaVersion as 1 | 2,
    strokes: decoded,
    viewport: {
      zoom: CodecPrimitives.number(
        CodecPrimitives.own(viewport, "zoom"),
        0.25,
        8,
        "viewport.zoom",
      ),
      x: CodecPrimitives.coordinate(
        CodecPrimitives.own(viewport, "x"),
        "viewport.x",
      ),
      y: CodecPrimitives.coordinate(
        CodecPrimitives.own(viewport, "y"),
        "viewport.y",
      ),
    },
    background,
    tools: {
      width: CodecPrimitives.number(
        CodecPrimitives.own(tools, "width"),
        0.5,
        12,
        "tools.width",
      ),
      stabilization: CodecPrimitives.number(
        CodecPrimitives.own(tools, "stabilization"),
        0,
        100,
        "tools.stabilization",
      ),
    },
  };

  if (
    new TextEncoder().encode(JSON.stringify(result)).byteLength > limits.bytes
  )
    CodecPrimitives.invalid("размер документа превышает 64 MiB");

  return result;
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
  const json = JSON.stringify(SnapshotOperations.cloneDocument(document));
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

export const DocumentCodec = {
  DOCUMENT_LIMITS: CodecConfig.DOCUMENT_LIMITS,
  emptyDocument: SnapshotOperations.emptyDocument,
  cloneDocument: SnapshotOperations.cloneDocument,
  decodeDocument,
  parseDocumentJSON,
  serializeDocument,
  documentStats,
  serializeRawBackup: BackupSerializer.serializeRawBackup,
};

export { DocumentSnapshots } from "./document-snapshots";
