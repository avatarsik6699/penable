import type { PreviewCamera } from "../preview-camera";

export namespace PreviewInputElements {
  export type Region = HTMLDivElement;

  export type Graphic = SVGSVGElement;
}

function bind(
  region: HTMLElement,
  svg: SVGSVGElement,
  camera: PreviewCamera,
  changed: () => void,
) {
  let contact: { id: number; x: number; y: number } | null = null;

  let frame: number | null = null;

  let width = 0,
    height = 0;

  const resize = () => {
    const bounds = svg.getBoundingClientRect();

    if (
      bounds.width <= 0 ||
      bounds.height <= 0 ||
      (bounds.width === width && bounds.height === height)
    )
      return;

    width = bounds.width;
    height = bounds.height;
    camera.resize(width, height);
    changed();
  };

  const observer = new ResizeObserver(() => {
    if (frame !== null) return;

    frame = requestAnimationFrame(() => {
      frame = null;
      resize();
    });
  });

  const cancel = () => {
    if (contact) {
      try {
        if (svg.hasPointerCapture(contact.id))
          svg.releasePointerCapture(contact.id);
      } catch {
        /* Capture can already be lost. */
      }
    }

    contact = null;
  };

  const down = (event: PointerEvent) => {
    if (contact || event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    region.focus({ preventScroll: true });
    contact = { id: event.pointerId, x: event.clientX, y: event.clientY };

    try {
      svg.setPointerCapture(event.pointerId);
    } catch {
      /* Cancel on leave when synthetic capture is unavailable. */
    }
  };

  const move = (event: PointerEvent) => {
    if (!contact || contact.id !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    camera.pan(event.clientX - contact.x, event.clientY - contact.y);
    contact = { id: contact.id, x: event.clientX, y: event.clientY };
    changed();
  };

  const up = (event: PointerEvent) => {
    if (contact?.id === event.pointerId) cancel();
  };

  const key = (event: KeyboardEvent) => {
    if (event.altKey || event.metaKey || event.ctrlKey) return;

    const direction: Record<string, [number, number]> = {
      ArrowLeft: [40, 0],
      ArrowRight: [-40, 0],
      ArrowUp: [0, 40],
      ArrowDown: [0, -40],
    };

    const delta = direction[event.code];

    if (!delta) return;

    event.preventDefault();
    event.stopPropagation();
    camera.pan(...delta);
    changed();
  };

  svg.addEventListener("pointerdown", down);
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerup", up);
  svg.addEventListener("pointercancel", up);
  svg.addEventListener("lostpointercapture", up);
  region.addEventListener("keydown", key);
  window.addEventListener("blur", cancel);
  observer.observe(svg);
  resize();

  return () => {
    cancel();
    observer.disconnect();

    if (frame !== null) cancelAnimationFrame(frame);

    frame = null;
    svg.removeEventListener("pointerdown", down);
    svg.removeEventListener("pointermove", move);
    svg.removeEventListener("pointerup", up);
    svg.removeEventListener("pointercancel", up);
    svg.removeEventListener("lostpointercapture", up);
    region.removeEventListener("keydown", key);
    window.removeEventListener("blur", cancel);
  };
}

export const PreviewInput = { bind };
