import type { Position } from "./types";

export type PathCommand =
  | {
      kind: "move";
      x: number;
      y: number;
    }
  | {
      kind: "line";
      x: number;
      y: number;
    }
  | {
      kind: "quadratic";
      cx: number;
      cy: number;
      x: number;
      y: number;
    };

export type StrokeGeometry =
  | {
      kind: "empty";
    }
  | {
      kind: "dot";
      x: number;
      y: number;
      radius: number;
    }
  | {
      kind: "path";
      commands: readonly PathCommand[];
    };

// Pressure/time remain in canonical points; only consecutive duplicate positions disappear here.
function strokeGeometry(
  points: readonly Position[],
  width: number,
): StrokeGeometry {
  const positions: Position[] = [];

  for (const point of points) {
    const previous = positions.at(-1);

    if (!previous || point.x !== previous.x || point.y !== previous.y)
      positions.push(point);
  }

  const first = positions[0];

  if (!first) return { kind: "empty" };

  if (positions.length === 1)
    return { kind: "dot", x: first.x, y: first.y, radius: width / 2 };

  const commands: PathCommand[] = [{ kind: "move", x: first.x, y: first.y }];

  for (let index = 1; index < positions.length - 1; index++) {
    const control = positions[index]!;
    const next = positions[index + 1]!;

    commands.push({
      kind: "quadratic",
      cx: control.x,
      cy: control.y,
      x: (control.x + next.x) / 2,
      y: (control.y + next.y) / 2,
    });
  }

  const last = positions.at(-1)!;

  commands.push({ kind: "line", x: last.x, y: last.y });

  return { kind: "path", commands };
}

export const BoardGeometry = { strokeGeometry };
