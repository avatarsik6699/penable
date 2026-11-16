declare const candidateBrand: unique symbol;

export type ImportCandidate = Readonly<{
  readonly [candidateBrand]: true;
  summary: Readonly<{ strokes: number; points: number }>;
}>;
