import type { SelectionClipboard } from "~/entities/board";
import { DocumentCodec, MaskDecoder } from "../codec";

function parse(text: string): SelectionClipboard {
  if (
    new TextEncoder().encode(text).byteLength >
    DocumentCodec.DOCUMENT_LIMITS.bytes
  )
    throw new Error("Фрагмент превышает 64 MiB.");

  const value: unknown = JSON.parse(text);

  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Некорректный фрагмент Penable.");

  const root = value as Record<string, unknown>;

  if (
    Object.keys(root).sort().join(",") !==
      "document,format,region,schemaVersion" ||
    root.format !== "penable-fragment" ||
    root.schemaVersion !== 1
  )
    throw new Error("Неподдерживаемый формат фрагмента Penable.");

  const document = DocumentCodec.decodeDocument(root.document);

  if (document.schemaVersion !== 4 || !document.strokes.length)
    throw new Error("Фрагмент Penable пуст или повреждён.");

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
