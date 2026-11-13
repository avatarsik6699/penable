type PathCommand =
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

type StrokeGeometry =
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

export type { PathCommand, StrokeGeometry };
