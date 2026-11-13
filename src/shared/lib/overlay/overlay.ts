export namespace OverlayElements {
  export type Container = HTMLDivElement;

  export type Button = HTMLButtonElement;

  export type Dialog = HTMLDialogElement;
}

function focus(element: HTMLElement | null) {
  element?.focus({ preventScroll: true });
}

function hasFocus(element: HTMLElement | null): boolean {
  return Boolean(element?.contains(document.activeElement));
}

function modal(dialog: HTMLDialogElement | null) {
  dialog?.showModal();

  return () => {
    dialog?.close();
  };
}

function bindDismiss(options: {
  roots: (HTMLElement | null)[];
  onOutside: () => void;
  onEscape: () => void;
  blocked?: () => boolean;
}) {
  const outside = (event: PointerEvent) => {
    if (
      event.target instanceof Node &&
      !options.roots.some((root) => root?.contains(event.target as Node))
    )
      options.onOutside();
  };

  const escape = (event: KeyboardEvent) => {
    if (
      event.key !== "Escape" ||
      options.blocked?.() ||
      document.querySelector("dialog[open]")
    )
      return;

    event.preventDefault();
    event.stopPropagation();
    options.onEscape();
  };

  document.addEventListener("pointerdown", outside);
  document.addEventListener("keydown", escape);

  return () => {
    document.removeEventListener("pointerdown", outside);
    document.removeEventListener("keydown", escape);
  };
}

function bindViewport(panel: HTMLElement | null) {
  if (!panel) return () => {};

  const property = "--panel-available-height",
    previous = panel.style.getPropertyValue(property),
    viewport = window.visualViewport;

  let active = true;

  const fit = () => {
    if (!active) return;

    const bottom = viewport
      ? viewport.offsetTop + viewport.height
      : window.innerHeight;

    const height = `${Math.max(0, Math.floor(bottom - panel.getBoundingClientRect().top - 12))}px`;

    if (panel.style.getPropertyValue(property) !== height)
      panel.style.setProperty(property, height);
  };

  const observer =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);

  for (
    let element: HTMLElement | null = panel;
    element;
    element = element.parentElement
  )
    observer?.observe(element);

  window.addEventListener("resize", fit);
  window.addEventListener("scroll", fit, true);
  viewport?.addEventListener("resize", fit);
  viewport?.addEventListener("scroll", fit);
  fit();

  return () => {
    active = false;
    observer?.disconnect();
    window.removeEventListener("resize", fit);
    window.removeEventListener("scroll", fit, true);
    viewport?.removeEventListener("resize", fit);
    viewport?.removeEventListener("scroll", fit);

    if (previous) panel.style.setProperty(property, previous);
    else panel.style.removeProperty(property);
  };
}

export const Overlay = { focus, hasFocus, modal, bindDismiss, bindViewport };
