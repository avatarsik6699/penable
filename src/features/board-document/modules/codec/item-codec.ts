import {
  BoardTransforms,
  BoardRegions,
  BoardLimits,
  type BoardItem,
  type ImageAsset,
} from "~/entities/board";
import { TemplateDecoder } from "./template-decoder";
import { ImageAssets } from "../image-assets";
import { CodecConfig } from "./document-codec.config";
import { CodecPrimitives } from "./document-codec.utils";
import { StrokeDecoder } from "./stroke-decoder";
import { MaskDecoder } from "./mask-decoder";

function decode(
  root: Record<string, unknown>,
  limits = CodecConfig.DOCUMENT_LIMITS,
  geometryOnly = false,
  modern = false,
): BoardItem[] {
  const rawAssets = CodecPrimitives.own(root, "assets"),
    rawItems = CodecPrimitives.own(root, "items");

  if (
    !Array.isArray(rawAssets) ||
    rawAssets.length > ImageAssets.LIMITS.count ||
    !Array.isArray(rawItems) ||
    rawItems.length > limits.strokes
  )
    CodecPrimitives.invalid("items/assets");

  const assets = new Map<string, ImageAsset>();

  for (const value of rawAssets) {
    const raw = CodecPrimitives.object(value, "asset");

    const asset = {
      id: raw.id,
      mime: raw.mime,
      width: raw.width,
      height: raw.height,
      base64: raw.base64,
    } as ImageAsset;

    if (
      typeof asset.id !== "string" ||
      typeof asset.base64 !== "string" ||
      assets.has(asset.id)
    )
      CodecPrimitives.invalid("asset.id/base64");

    if (!geometryOnly) ImageAssets.validateAsset(asset);
    else {
      ImageAssets.dimensions(asset.width, asset.height);

      if (asset.mime !== "image/png" && asset.mime !== "image/jpeg")
        CodecPrimitives.invalid("asset.mime");
    }

    assets.set(asset.id, Object.freeze(asset));
  }

  const ink = rawItems.filter(
    (value) => CodecPrimitives.object(value, "item").kind === "ink",
  );

  const decodedInk = StrokeDecoder.decodeStrokes(ink, 2, limits, modern);

  let inkIndex = 0,
    vertices = 0;

  const ids = new Set<number>(),
    sourceKinds = new Map<string, string>();

  const items: BoardItem[] = rawItems.map((value) => {
    const raw = CodecPrimitives.object(value, "item");

    const id = CodecPrimitives.number(
      CodecPrimitives.own(raw, "id"),
      1,
      BoardLimits.MAX_STROKE_ID,
      "item.id",
    );

    if (!Number.isSafeInteger(id) || ids.has(id))
      CodecPrimitives.invalid("item.id");

    ids.add(id);

    const matrix = CodecPrimitives.own(raw, "matrix");

    if (!Array.isArray(matrix) || !BoardTransforms.valid(matrix))
      CodecPrimitives.invalid("item.matrix");

    let result: BoardItem;

    if (raw.kind === "ink") {
      result = decodedInk[inkIndex++]!;

      if (Object.hasOwn(raw, "translation"))
        CodecPrimitives.invalid("item.translation");

      if (BoardTransforms.translationOnly(matrix)) {
        if (matrix[4] || matrix[5])
          result.translation = { x: matrix[4], y: matrix[5] };
      } else result.matrix = matrix;
    } else if (raw.kind === "image") {
      if (typeof raw.assetId !== "string" || !assets.has(raw.assetId))
        CodecPrimitives.invalid("item.assetId");

      result = { kind: "image", id, asset: assets.get(raw.assetId)!, matrix };

      if (Object.hasOwn(raw, "clip"))
        result.clip = MaskDecoder.decodeMask(raw.clip);

      if (Object.hasOwn(raw, "source")) {
        if (
          typeof raw.source !== "string" ||
          !/^[a-zA-Z0-9_-]{1,160}$/.test(raw.source)
        )
          CodecPrimitives.invalid("item.source");

        result.source = raw.source;
      }
    } else if (modern && raw.kind === "template") {
      if (raw.generatorVersion !== 1)
        CodecPrimitives.invalid("item.generatorVersion");

      result = {
        kind: "template",
        id,
        generatorVersion: 1,
        template: TemplateDecoder.decode(raw.template),
        matrix,
      };

      if (Object.hasOwn(raw, "clip"))
        result.clip = MaskDecoder.decodeMask(raw.clip);

      if (Object.hasOwn(raw, "source")) {
        if (
          typeof raw.source !== "string" ||
          !/^[a-zA-Z0-9_-]{1,160}$/.test(raw.source)
        )
          CodecPrimitives.invalid("item.source");

        result.source = raw.source as string;
      }
    } else return CodecPrimitives.invalid("item.kind");

    vertices += result.clip ? BoardRegions.vertexCount(result.clip) : 0;

    if (vertices > BoardRegions.REGION_LIMITS.document)
      CodecPrimitives.invalid("clip: превышен общий предел");

    if (result.source) {
      const signature =
        result.kind === "image"
          ? `image:${result.asset.id}`
          : result.kind === "template"
            ? `template:${JSON.stringify(result.template)}`
            : "ink";

      if (
        sourceKinds.has(result.source) &&
        sourceKinds.get(result.source) !== signature
      )
        CodecPrimitives.invalid("item.source: несовместимый тип");

      sourceKinds.set(result.source, signature);
    }

    const bounds = BoardRegions.visibleBounds([result]);

    if (
      bounds &&
      !Object.values(bounds).every(
        (n) => Number.isFinite(n) && Math.abs(n) <= 1e9,
      )
    )
      CodecPrimitives.invalid("item: преобразование за пределами доски");

    return result;
  });

  if (!geometryOnly) ImageAssets.validateBoard(items, false);
  else if (
    [...assets.values()].reduce(
      (sum, asset) => sum + asset.width * asset.height,
      0,
    ) > ImageAssets.LIMITS.boardPixels
  )
    CodecPrimitives.invalid("assets: превышен предел 32 млн пикселей");

  if (
    assets.size !==
    new Set(items.filter((i) => i.kind === "image").map((i) => i.asset.id)).size
  )
    CodecPrimitives.invalid("assets: неиспользуемый ресурс");

  return items;
}

function encode(items: readonly BoardItem[], geometryOnly = false) {
  const assets = geometryOnly
      ? [
          ...new Map(
            items.flatMap((item) =>
              item.kind === "image"
                ? [[item.asset.id, item.asset] as const]
                : [],
            ),
          ).values(),
        ]
      : ImageAssets.unique(items),
    canonical = new Map(geometryOnly ? [] : assets.map((a) => [a.base64, a]));

  return {
    items: items.map((item) => {
      const matrix = BoardTransforms.matrix(item);

      if (item.kind === "image")
        return {
          kind: "image",
          id: item.id,
          assetId: geometryOnly
            ? item.asset.id
            : canonical.get(item.asset.base64)!.id,
          matrix,
          ...(item.source ? { source: item.source } : {}),
          ...(item.clip ? { clip: item.clip } : {}),
        };

      if (item.kind === "template")
        return {
          kind: "template",
          id: item.id,
          generatorVersion: 1,
          template: item.template,
          matrix,
          ...(item.source ? { source: item.source } : {}),
          ...(item.clip ? { clip: item.clip } : {}),
        };

      const {
        translation: _translation,
        matrix: _matrix,
        kind: _kind,
        ...ink
      } = item;

      return { ...ink, kind: "ink", matrix };
    }),
    assets,
  };
}

export const ItemCodec = { decode, encode };
