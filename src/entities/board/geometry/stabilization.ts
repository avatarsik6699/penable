import {
  type StabilizationMode,
  type Point,
  type StabilizationProfile,
  type Position,
} from "../board.types";
import { StabilizationConfig } from "./stabilization.config";

function normalizeStrength(value: number | StabilizationMode): number {
  if (typeof value === "string")
    return value === "light" ? 50 : value === "strong" ? 100 : 0;

  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

function alpha(cutoff: number, dt: number): number {
  return 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
}

// Inspired by the 1€ filter. A shared cutoff and radial cap keep this variant isotropic.
function stabilizedPositions(
  points: readonly Point[],
  profile?: StabilizationProfile,
): Position[] {
  const unique: Point[] = [];

  for (const point of points) {
    const previous = unique.at(-1);

    if (!previous || point.x !== previous.x || point.y !== previous.y)
      unique.push(point);
  }

  const first = unique[0];
  const strength = normalizeStrength(profile?.strength ?? profile?.mode ?? 0);

  if (!first || strength === 0) return unique.map(({ x, y }) => ({ x, y }));

  const captureZoom = profile?.captureZoom ?? 1;

  const zoom =
    Number.isFinite(captureZoom) && captureZoom > 0 ? captureZoom : 1;

  const blend = Math.min(1, strength / 50);
  const t = (strength - 50) / 50;
  const { light, strong } = StabilizationConfig.PROFILES;

  const { minCutoff, beta, maxDeviation } =
    strength <= 50
      ? light
      : strength === 100
        ? strong
        : {
            minCutoff:
              light.minCutoff + (strong.minCutoff - light.minCutoff) * t,
            beta: light.beta + (strong.beta - light.beta) * t,
            maxDeviation:
              light.maxDeviation +
              (strong.maxDeviation - light.maxDeviation) * t,
          };

  const output: Position[] = [{ x: first.x, y: first.y }];
  let previous = first;
  let filteredX = first.x * zoom;
  let filteredY = first.y * zoom;
  let velocityX = 0;
  let velocityY = 0;

  for (let index = 1; index < unique.length; index++) {
    const point = unique[index]!;
    const elapsed = (point.time - previous.time) / 1000;

    const dt =
      Number.isFinite(elapsed) && elapsed > 0
        ? elapsed
        : StabilizationConfig.FALLBACK_DT;

    const derivativeAlpha = alpha(StabilizationConfig.DERIVATIVE_CUTOFF, dt);
    const rawX = point.x * zoom;
    const rawY = point.y * zoom;

    velocityX +=
      derivativeAlpha * (((point.x - previous.x) * zoom) / dt - velocityX);

    velocityY +=
      derivativeAlpha * (((point.y - previous.y) * zoom) / dt - velocityY);

    const positionAlpha = alpha(
      minCutoff + beta * Math.hypot(velocityX, velocityY),
      dt,
    );

    filteredX += positionAlpha * (rawX - filteredX);
    filteredY += positionAlpha * (rawY - filteredY);

    const deviation = Math.hypot(filteredX - rawX, filteredY - rawY);

    if (deviation > maxDeviation) {
      const fraction = maxDeviation / deviation;

      filteredX = rawX + (filteredX - rawX) * fraction;
      filteredY = rawY + (filteredY - rawY) * fraction;
    }

    output.push(
      strength < 50
        ? {
            x: point.x + (filteredX / zoom - point.x) * blend,
            y: point.y + (filteredY / zoom - point.y) * blend,
          }
        : { x: filteredX / zoom, y: filteredY / zoom },
    );

    previous = point;
  }

  // Keep the exact tip in the output, while future samples still start from the capped state.
  const last = unique.at(-1)!;

  output[output.length - 1] = { x: last.x, y: last.y };

  return output;
}

// Append-only counterpart to stabilizedPositions. The batch function above remains the
// reference for completed/imported ink. The returned point is the filter state, before
// the displayed raw-tip override; callers finalize it only after the next unique sample.
export class IncrementalStabilizer {
  private previous: Point | null = null;
  private filteredX = 0;
  private filteredY = 0;
  private velocityX = 0;
  private velocityY = 0;
  private readonly strength: number;
  private readonly zoom: number;
  private readonly blend: number;
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly maxDeviation: number;

  constructor(profile?: StabilizationProfile) {
    this.strength = normalizeStrength(profile?.strength ?? profile?.mode ?? 0);

    const captureZoom = profile?.captureZoom ?? 1;

    this.zoom =
      Number.isFinite(captureZoom) && captureZoom > 0 ? captureZoom : 1;

    this.blend = Math.min(1, this.strength / 50);

    const t = (this.strength - 50) / 50;
    const { light, strong } = StabilizationConfig.PROFILES;

    const parameters =
      this.strength <= 50
        ? light
        : this.strength === 100
          ? strong
          : {
              minCutoff:
                light.minCutoff + (strong.minCutoff - light.minCutoff) * t,
              beta: light.beta + (strong.beta - light.beta) * t,
              maxDeviation:
                light.maxDeviation +
                (strong.maxDeviation - light.maxDeviation) * t,
            };

    this.minCutoff = parameters.minCutoff;
    this.beta = parameters.beta;
    this.maxDeviation = parameters.maxDeviation;
  }

  append(point: Point): Position | null {
    const previous = this.previous;

    if (previous && previous.x === point.x && previous.y === point.y)
      return null;

    this.previous = point;

    if (!previous) {
      this.filteredX = point.x * this.zoom;
      this.filteredY = point.y * this.zoom;

      return { x: point.x, y: point.y };
    }

    if (this.strength === 0) return { x: point.x, y: point.y };

    const elapsed = (point.time - previous.time) / 1000;

    const dt =
      Number.isFinite(elapsed) && elapsed > 0
        ? elapsed
        : StabilizationConfig.FALLBACK_DT;

    const derivativeAlpha = alpha(StabilizationConfig.DERIVATIVE_CUTOFF, dt);
    const rawX = point.x * this.zoom;
    const rawY = point.y * this.zoom;

    this.velocityX +=
      derivativeAlpha *
      (((point.x - previous.x) * this.zoom) / dt - this.velocityX);

    this.velocityY +=
      derivativeAlpha *
      (((point.y - previous.y) * this.zoom) / dt - this.velocityY);

    const positionAlpha = alpha(
      this.minCutoff + this.beta * Math.hypot(this.velocityX, this.velocityY),
      dt,
    );

    this.filteredX += positionAlpha * (rawX - this.filteredX);
    this.filteredY += positionAlpha * (rawY - this.filteredY);

    const deviation = Math.hypot(this.filteredX - rawX, this.filteredY - rawY);

    if (deviation > this.maxDeviation) {
      const fraction = this.maxDeviation / deviation;

      this.filteredX = rawX + (this.filteredX - rawX) * fraction;
      this.filteredY = rawY + (this.filteredY - rawY) * fraction;
    }

    return this.strength < 50
      ? {
          x: point.x + (this.filteredX / this.zoom - point.x) * this.blend,
          y: point.y + (this.filteredY / this.zoom - point.y) * this.blend,
        }
      : { x: this.filteredX / this.zoom, y: this.filteredY / this.zoom };
  }
}

export const BoardStabilization = {
  DEFAULT_STABILIZATION_STRENGTH:
    StabilizationConfig.DEFAULT_STABILIZATION_STRENGTH,
  normalizeStrength,
  stabilizedPositions,
};
