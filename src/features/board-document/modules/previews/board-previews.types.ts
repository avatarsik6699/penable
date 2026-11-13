export namespace BoardPreviewsTypes {
  export type Preview = { url: string; bytes: number; release: () => void };

  export type Renderer = (
    document: Blob,
    signal: AbortSignal,
  ) => Promise<Preview>;

  export type Options = {
    load: (id: string, signal: AbortSignal) => Promise<Blob>;
    render: Renderer;
    changed: () => void;
  };
}
