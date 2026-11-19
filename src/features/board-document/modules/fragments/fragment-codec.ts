import { Messages } from "~/shared/lib/messages";
import type { SelectionClipboard } from "~/entities/board";
import { DocumentCodec, DocumentSchema, MaskDecoder } from "../codec";

function parse(text: string): SelectionClipboard {
  if (
    new TextEncoder().encode(text).byteLength >
    DocumentCodec.DOCUMENT_LIMITS.bytes
  )
    throw Messages.error(Messages.create("fragmentExceeds64Mib"));

  const value: unknown = JSON.parse(text);

  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Messages.error(Messages.create("invalidPenableFragment"));

  const root = value as Record<string, unknown>;

  if (
    Object.keys(root).sort().join(",") !==
      "document,format,region,schemaVersion" ||
    root.format !== "penable-fragment" ||
    root.schemaVersion !== 1
  )
    throw Messages.error(Messages.create("unsupportedPenableFragmentFormat"));

  const document = DocumentCodec.decodeDocument(root.document);

  if (
    !DocumentSchema.itemDocument(document.schemaVersion) ||
    !document.strokes.length
  )
    throw Messages.error(Messages.create("thePenableFragmentIsEmptyOrCorrupt"));

  const region = MaskDecoder.decodeMask(root.region);

  return { strokes: document.strokes, region };
}

function serialize(fragment: SelectionClipboard): string {
  const document = DocumentCodec.encodeDocument({
    ...DocumentCodec.emptyDocument(),
    strokes: fragment.strokes,
  });

  const text = JSON.stringify({
    format: "penable-fragment",
    schemaVersion: 1,
    document,
    region: fragment.region ?? [],
  });

  parse(text);

  return text;
}

export const FragmentCodec = {
  parse,
  serialize,
  MIME: "web application/x-penable-fragment+json",
  LIMIT: 64 * 1024 * 1024,
};
