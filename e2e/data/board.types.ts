export namespace TestBoardTypes {
  export type Point = { x: number; y: number; pressure: number; time: number };
  export type Stroke = {
    id: number;
    color: "#182230";
    width: number;
    points: Point[];
    stabilization?: {
      strength?: number;
      mode?: "off" | "light" | "strong";
      captureZoom: number;
    };
    source?: string;
    translation?: { x: number; y: number };
    clip?: number[][][][];
  };
  export type Document = {
    format: "penable-board";
    schemaVersion: 1 | 2;
    strokes: Stroke[];
    viewport: { x: number; y: number; zoom: number };
    background: "blank" | "dots" | "grid";
    tools: { width: number; stabilization: number };
  };
  export type Records = {
    main?: Document;
    previous?: Document;
    upgrade?: Document;
  };
  export type Position = { x: number; y: number };
}
