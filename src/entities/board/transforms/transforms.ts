import { Messages } from "~/shared/lib/messages";
import type {
  AffineMatrix,
  BoardItem,
  ClipMask,
  Position,
} from "../board.types";

const IDENTITY: AffineMatrix = [1, 0, 0, 1, 0, 0];

function matrix(item: Pick<BoardItem, "matrix" | "translation">): AffineMatrix {
  return (
    item.matrix ??
    (item.translation
      ? [1, 0, 0, 1, item.translation.x, item.translation.y]
      : IDENTITY)
  );
}

function valid(value: readonly number[]): value is AffineMatrix {
  if (value.length !== 6 || !value.every(Number.isFinite)) return false;

  const [a, b, c, d, e, f] = value as AffineMatrix;

  return (
    Math.abs(a * d - b * c) > 1e-12 &&
    value.every((v) => Math.abs(v) <= 1e9) &&
    Number.isFinite(e + f)
  );
}

function multiply(a: AffineMatrix, b: AffineMatrix): AffineMatrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function inverse(m: AffineMatrix): AffineMatrix {
  if (!valid(m))
    throw Messages.error(Messages.create("invalidTransformSingularMatrix"));

  const determinant = m[0] * m[3] - m[1] * m[2];

  return [
    m[3] / determinant,
    -m[1] / determinant,
    -m[2] / determinant,
    m[0] / determinant,
    (m[2] * m[5] - m[3] * m[4]) / determinant,
    (m[1] * m[4] - m[0] * m[5]) / determinant,
  ];
}

function point(m: AffineMatrix, p: Position): Position {
  return {
    x: m[0] * p.x + m[2] * p.y + m[4],
    y: m[1] * p.x + m[3] * p.y + m[5],
  };
}

function mask(value: ClipMask, m: AffineMatrix): ClipMask {
  return value.map((polygon) =>
    polygon.map((ring) =>
      ring.map(([x, y]) => {
        const p = point(m, { x, y });

        return [p.x, p.y];
      }),
    ),
  );
}

function translationOnly(m: AffineMatrix): boolean {
  return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1;
}

function apply(item: BoardItem, transform: AffineMatrix): BoardItem {
  const result = multiply(transform, matrix(item));

  if (!valid(result))
    throw Messages.error(Messages.create("transformIsTooSmallOrExceedsBoard"));

  if (
    item.kind !== "image" &&
    item.kind !== "template" &&
    translationOnly(result)
  ) {
    const { matrix: _matrix, ...rest } = item;

    return { ...rest, translation: { x: result[4], y: result[5] } };
  }

  const { translation: _translation, ...rest } = item;

  return { ...rest, matrix: result };
}

function around(
  center: Position,
  scaleX: number,
  scaleY: number,
  degrees: number,
): AffineMatrix {
  if (
    ![scaleX, scaleY, degrees].every(Number.isFinite) ||
    scaleX <= 0 ||
    scaleY <= 0
  )
    throw Messages.error(Messages.create("scaleMustBeAPositiveNumber"));

  const angle = (degrees * Math.PI) / 180,
    c = Math.cos(angle),
    s = Math.sin(angle);

  const a = c * scaleX,
    b = s * scaleX,
    d = c * scaleY,
    e = -s * scaleY;

  return [
    a,
    b,
    e,
    d,
    center.x - a * center.x - e * center.y,
    center.y - b * center.x - d * center.y,
  ];
}

function bounds(
  value: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  },
  m: AffineMatrix,
) {
  const corners = [
    point(m, { x: value.left, y: value.top }),
    point(m, { x: value.right, y: value.top }),
    point(m, { x: value.right, y: value.bottom }),
    point(m, { x: value.left, y: value.bottom }),
  ];

  return {
    left: Math.min(...corners.map((p) => p.x)),
    right: Math.max(...corners.map((p) => p.x)),
    top: Math.min(...corners.map((p) => p.y)),
    bottom: Math.max(...corners.map((p) => p.y)),
  };
}

export const BoardTransforms = {
  IDENTITY,
  matrix,
  valid,
  multiply,
  inverse,
  point,
  mask,
  translationOnly,
  apply,
  around,
  bounds,
};
