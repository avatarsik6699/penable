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
    schemaVersion: 1 | 2 | 3;
    strokes: Stroke[];
    viewport: { x: number; y: number; zoom: number };
    background: "blank" | "dots" | "grid";
    tools: { width: number; stabilization: number };
    backgroundSettings?: { contrast: number; spacing: number };
    lastWritingView?: { center: { x: number; y: number }; zoom: number } | null;
  };

  export type Matrix = [number, number, number, number, number, number];

  export type InkItem = Omit<Stroke, "translation"> & {
    kind: "ink";
    matrix: Matrix;
  };

  export type ImageItem = {
    kind: "image";
    id: number;
    assetId: string;
    source?: string;
    matrix: Matrix;
    clip?: number[][][][];
  };

  export type Item = InkItem | ImageItem;

  export type Asset = {
    id: string;
    mime: "image/png" | "image/jpeg";
    width: number;
    height: number;
    base64: string;
  };

  export type StoredDocument = Omit<Document, "schemaVersion" | "strokes"> & {
    schemaVersion: 4;
    items: Item[];
    assets: Asset[];
  };

  export type Catalog = {
    format: "penable-library";
    schemaVersion: 1;
    activeId: string;
    boards: Array<{ id: string; title: string }>;
  };

  export type Records = {
    main?: StoredDocument;
    previous?: Document | StoredDocument;
    upgrade?: Document;
    upgrade3?: Document;
    upgrade4?: Document;
    beforeLibrary?: Document;
    catalog?: Catalog;
  };

  export type Position = { x: number; y: number };
}
