export namespace TestBoardTypes {
  export type Point = { x: number; y: number; pressure: number; time: number };

  export type Stroke = {
    id: number;
    color: string;
    style?: {
      instrument: "pen" | "pressure" | "highlighter";
      opacity: number;
      pressureStrength: number;
    };
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
    tools: { width: number; stabilization: number; writing?: WritingSettings };
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

  export type WritingSettings = {
    instrument: "pen" | "pressure" | "highlighter";
    instruments: Record<
      "pen" | "pressure" | "highlighter",
      {
        color: string;
        width: number;
        stabilization: number;
        opacity: number;
        pressureStrength: number;
      }
    >;
  };

  export type TemplateItem = {
    kind: "template";
    id: number;
    generatorVersion: 1 | 2;
    template: {
      kind:
        | "line"
        | "arrow"
        | "rectangle"
        | "ellipse"
        | "triangle"
        | "number-line"
        | "axes"
        | "circle";
      width: number;
      height: number;
      color: string;
      lineWidth: number;
      dashed: boolean;
      fill: string | null;
      min: number;
      max: number;
      step: number;
      numbers: boolean;
      grid: boolean;
      labels: boolean;
      rays: boolean;
    };
    matrix: Matrix;
    source?: string;
    clip?: number[][][][];
  };

  export type TextItem = {
    kind: "text";
    id: number;
    text: string;
    width: number;
    lines: number[];
    matrix: Matrix;
    source?: string;
    clip?: never;
  };

  export type Item = InkItem | ImageItem | TemplateItem | TextItem;

  export type Asset = {
    id: string;
    mime: "image/png" | "image/jpeg";
    width: number;
    height: number;
    base64: string;
  };

  export type StoredDocument = Omit<Document, "schemaVersion" | "strokes"> & {
    schemaVersion: 4 | 5 | 6;
    items: Item[];
    assets: Asset[];
  };

  export type LegacyCatalog = {
    format: "penable-library";
    schemaVersion: 1;
    activeId: string;
    boards: Array<{ id: string; title: string }>;
  };

  export type Appearance = { color: string; icon: string };

  export type Catalog = Omit<LegacyCatalog, "schemaVersion" | "boards"> & {
    schemaVersion: 2;
    boards: Array<{ id: string; title: string; appearance: Appearance }>;
  };

  export type Records = {
    main?: StoredDocument;
    previous?: Document | StoredDocument;
    upgrade?: Document;
    upgrade3?: Document;
    upgrade4?: Document;
    upgrade5?: Document | StoredDocument;
    upgrade6?: Document | StoredDocument;
    beforeLibrary?: Document;
    catalog?: Catalog | LegacyCatalog;
    beforeCatalog2?: LegacyCatalog;
  };

  export type Position = { x: number; y: number };
}
