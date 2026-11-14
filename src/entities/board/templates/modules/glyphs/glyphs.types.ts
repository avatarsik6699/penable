export type GlyphRun = Readonly<{
  width: number;
  height: number;
  glyphs: readonly Readonly<{
    path: string;
    x: number;
    y: number;
    scale: number;
  }>[];
}>;
