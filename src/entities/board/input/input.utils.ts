import { type PointerSample, type PointerInput } from "../board.types";

function sameSample(a: PointerSample, b: PointerSample) {
  return (
    a.pointerId === b.pointerId &&
    a.clientX === b.clientX &&
    a.clientY === b.clientY &&
    a.pressure === b.pressure &&
    a.timeStamp === b.timeStamp
  );
}

function eventSamples(event: PointerInput): PointerSample[] {
  let samples: PointerSample[] = [];

  try {
    samples = event.getCoalescedEvents?.() ?? [];
  } catch {
    // Capability detection cannot guarantee that every browser event supports the call.
  }

  if (!samples.length) return [event];

  // The parent is an aggregate of these samples, not an additional position.
  return samples.filter(
    (sample, index) =>
      !samples.slice(0, index).some((previous) => sameSample(previous, sample)),
  );
}

export const InputSamples = { eventSamples };
