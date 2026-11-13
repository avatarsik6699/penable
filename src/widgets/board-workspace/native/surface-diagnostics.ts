import type { InputDiagnostics } from "../model/types";

export class SurfaceDiagnostics {
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private value: InputDiagnostics,
    private readonly publish: (value: InputDiagnostics) => void,
    private readonly pointer: () => number | null,
  ) {}
  update(value: Partial<InputDiagnostics>) {
    this.value = { ...this.value, ...value };
    this.schedule();
  }
  readonly observe = (event?: PointerEvent) => {
    this.update({
      ...(event
        ? {
            pointerType: event.pointerType || "не указан",
            pressure: Number.isFinite(event.pressure) ? event.pressure : null,
            coalesced: typeof event.getCoalescedEvents === "function",
          }
        : {}),
      active: this.pointer() !== null,
    });
  };
  private schedule() {
    if (this.timer !== undefined) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.publish({ ...this.value });
    }, 100);
  }
  dispose() {
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}
