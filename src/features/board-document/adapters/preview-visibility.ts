export namespace PreviewVisibilityTypes {
  export type Root = HTMLUListElement;
}

export const PreviewVisibility = {
  observe(root: HTMLElement, changed: (ids: string[]) => void) {
    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.boardId;

          if (!id) continue;

          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }

        changed([...visible]);
      },
      { root, threshold: 0.01 },
    );

    for (const row of root.querySelectorAll("[data-board-id]"))
      observer.observe(row);

    return () => {
      observer.disconnect();
      visible.clear();
    };
  },
};
