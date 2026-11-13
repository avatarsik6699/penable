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

export const Overlay = { focus, hasFocus, modal, bindDismiss };
