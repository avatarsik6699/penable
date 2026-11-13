import type { BoardItem, ClipMask, Viewport } from "../board.types";
import { BoardLimits } from "../scene-limits";
import { BoardRegions } from "../regions";
import { BoardViewport } from "../viewport";
import { BoardIds } from "../stroke-ids";
import { SelectionUtils } from "./selection.utils";

function prepare(
  scene: readonly BoardItem[],
  originals: readonly BoardItem[],
  region: ClipMask,
  viewport: Viewport,
  size: { width: number; height: number },
  duplicate: boolean,
) {
  if (scene.length + originals.length > BoardLimits.SCENE_LIMITS.strokes)
    throw new Error(
      "Вставка превышает предел 20 000 фрагментов. Выделите меньше записей.",
    );

  const points = (strokes: readonly BoardItem[]) =>
    strokes.reduce(
      (sum, stroke) =>
        sum + (stroke.kind === "image" ? 0 : stroke.points.length),
      0,
    );

  if (points(scene) + points(originals) > BoardLimits.SCENE_LIMITS.points)
    throw new Error(
      "Вставка превышает предел 1 000 000 точек. Выделите меньше записей.",
    );

  const bounds =
    BoardRegions.maskBounds(region) ?? BoardRegions.visibleBounds(originals);

  if (!bounds) return;

  const center = BoardViewport.screenToWorld(
    { x: size.width / 2, y: size.height / 2 },
    viewport,
  );

  const delta = duplicate
    ? { x: 24 / viewport.zoom, y: 24 / viewport.zoom }
    : {
        x: center.x - (bounds.left + bounds.right) / 2,
        y: center.y - (bounds.top + bounds.bottom) / 2,
      };

  const allocate = BoardIds.createStrokeIdAllocator(scene),
    sources = new Map<string | BoardItem, string>();

  const selected = SelectionUtils.copy(originals).map((stroke, index) => {
    const key = originals[index]!.source ?? originals[index]!;
    let source = sources.get(key);

    if (!source) {
      source = BoardRegions.newSource();
      sources.set(key, source);
    }

    return {
      ...SelectionUtils.shifted(stroke, delta),
      id: allocate(),
      source,
    };
  });

  const known = new Map(
    scene.flatMap((item) =>
      item.kind === "image" ? [[item.asset.id, item.asset] as const] : [],
    ),
  );

  const assets = new Map<
    import("../board.types").ImageAsset,
    import("../board.types").ImageAsset
  >();

  const reconciled = selected.map((item) => {
    if (item.kind !== "image") return item;

    let asset = assets.get(item.asset);

    if (!asset) {
      asset =
        [...known.values()].find(
          (a) => a.base64 === item.asset.base64 && a.mime === item.asset.mime,
        ) ?? item.asset;

      if (known.has(asset.id) && known.get(asset.id) !== asset) {
        let suffix = 1;

        while (known.has(`${asset.id.slice(0, 140)}_${suffix}`)) suffix++;

        asset = { ...asset, id: `${asset.id.slice(0, 140)}_${suffix}` };
      }

      assets.set(item.asset, asset);
      known.set(asset.id, asset);
    }

    return { ...item, asset };
  });

  return {
    candidate: { strokes: [...scene, ...reconciled], selected: reconciled },
    region: BoardRegions.translateMask(
      region.length
        ? region
        : BoardRegions.rectangle(
            { x: bounds.left, y: bounds.top },
            { x: bounds.right, y: bounds.bottom },
          ),
      delta,
    ),
  };
}

export const SelectionClipboardTransforms = { prepare };
