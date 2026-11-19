import type { MessageTypes } from "~/shared/lib/messages";
import { Messages } from "~/shared/lib/messages";
import { BoardWriting } from "~/entities/board";
import { WritingDecoder } from "./writing-decoder";
import { ItemCodec } from "./item-codec";
import { type BoardDocument } from "../../board-document.types";
import { CodecConfig } from "./document-codec.config";
import { CodecPrimitives } from "./document-codec.utils";
import { StrokeDecoder } from "./stroke-decoder";
import { SnapshotOperations } from "./document-snapshots";
import { BackupSerializer } from "./backup-serializer";
import { DocumentSchema } from "./document-schema";

function decodeDocument(
  value: unknown,
  limits = CodecConfig.DOCUMENT_LIMITS,
  geometryOnly = false,
): BoardDocument {
  const root = CodecPrimitives.object(value, "document");
  const schemaVersion = CodecPrimitives.own(root, "schemaVersion");

  if (
    CodecPrimitives.own(root, "format") !== "penable-board" ||
    (schemaVersion !== 1 &&
      schemaVersion !== 2 &&
      schemaVersion !== 3 &&
      !DocumentSchema.itemDocument(schemaVersion))
  )
    CodecPrimitives.invalid("format/schemaVersion");

  const decoded = DocumentSchema.itemDocument(schemaVersion)
    ? ItemCodec.decode(root, limits, geometryOnly, schemaVersion)
    : StrokeDecoder.decodeStrokes(
        CodecPrimitives.own(root, "strokes"),
        schemaVersion === 1 ? 1 : 2,
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

  let backgroundSettings = { contrast: 45, spacing: 24 };
  let lastWritingView: import("~/entities/board").WritingView | null = null;

  if (schemaVersion === 3 || DocumentSchema.itemDocument(schemaVersion)) {
    const settings = CodecPrimitives.object(
      CodecPrimitives.own(root, "backgroundSettings"),
      "backgroundSettings",
    );

    backgroundSettings = {
      contrast: CodecPrimitives.number(
        CodecPrimitives.own(settings, "contrast"),
        0,
        100,
        "backgroundSettings.contrast",
      ),
      spacing: CodecPrimitives.number(
        CodecPrimitives.own(settings, "spacing"),
        12,
        64,
        "backgroundSettings.spacing",
      ),
    };

    if (
      !Number.isInteger(backgroundSettings.contrast) ||
      !Number.isInteger(backgroundSettings.spacing) ||
      backgroundSettings.spacing % 2 !== 0
    )
      CodecPrimitives.invalid("backgroundSettings");

    const rawView = CodecPrimitives.own(root, "lastWritingView");

    if (rawView !== null) {
      const view = CodecPrimitives.object(rawView, "lastWritingView");

      const center = CodecPrimitives.object(
        CodecPrimitives.own(view, "center"),
        "lastWritingView.center",
      );

      lastWritingView = {
        center: {
          x: CodecPrimitives.number(
            CodecPrimitives.own(center, "x"),
            -1e10,
            1e10,
            "lastWritingView.center.x",
          ),
          y: CodecPrimitives.number(
            CodecPrimitives.own(center, "y"),
            -1e10,
            1e10,
            "lastWritingView.center.y",
          ),
        },
        zoom: CodecPrimitives.number(
          CodecPrimitives.own(view, "zoom"),
          0.25,
          8,
          "lastWritingView.zoom",
        ),
      };
    }
  }

  const result: BoardDocument = {
    format: "penable-board",
    schemaVersion,
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
    backgroundSettings,
    lastWritingView,
    tools: {
      ...(schemaVersion >= 5
        ? {
            writing: WritingDecoder.writing(
              CodecPrimitives.own(tools, "writing"),
            ),
          }
        : {}),
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
    !geometryOnly &&
    new TextEncoder().encode(JSON.stringify(encodeDocument(result)))
      .byteLength > limits.bytes
  )
    CodecPrimitives.invalid(Messages.create("documentSizeExceeds64Mib"));

  return result;
}

function parseDocumentJSON(text: string): BoardDocument {
  if (
    new TextEncoder().encode(text).byteLength >
    DocumentCodec.DOCUMENT_LIMITS.bytes
  )
    throw Messages.error(Messages.create("fileExceeds64Mib"));

  return decodeDocument(JSON.parse(text) as unknown);
}

function serializeDocument(document: BoardDocument): {
  json: string;
  warning: MessageTypes.Value;
} {
  const json = JSON.stringify(
    encodeDocument(SnapshotOperations.cloneDocument(document)),
  );

  let warning: MessageTypes.Value = "";

  try {
    parseDocumentJSON(json);
  } catch {
    warning = Messages.create("thisCopyContainsAllCompletedContentBut");
  }

  return { json, warning };
}

function documentStats(document: BoardDocument) {
  return {
    strokes: document.strokes.length,
    points: document.strokes.reduce(
      (sum, stroke) =>
        sum +
        (stroke.kind === "image" ||
        stroke.kind === "template" ||
        stroke.kind === "text"
          ? 0
          : stroke.points.length),
      0,
    ),
  };
}

function encodeDocument(document: BoardDocument, geometryOnly = false) {
  const { strokes: _strokes, ...root } = document;

  return {
    ...root,
    schemaVersion: DocumentSchema.current(document.strokes),
    tools: {
      ...document.tools,
      writing:
        document.tools.writing ??
        BoardWriting.defaults(
          document.tools.width,
          document.tools.stabilization,
        ),
    },
    ...ItemCodec.encode(document.strokes, geometryOnly),
  };
}

export const DocumentCodec = {
  encodeDocument,
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
