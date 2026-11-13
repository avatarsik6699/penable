import { readFile } from "node:fs/promises";

export namespace TestImageTypes {
  export type File = {
    name: string;
    mimeType: string;
    buffer: Buffer;
  };

  export type Files = {
    png: File;
    jpeg: File;
    orientedJpeg: File;
    invalid: File;
  };
}

async function files(): Promise<TestImageTypes.Files> {
  return {
    png: {
      name: "quadrants.png",
      mimeType: "image/png",
      buffer: await readFile(
        new URL("./images/quadrants.png", import.meta.url),
      ),
    },
    jpeg: {
      name: "quadrants.jpg",
      mimeType: "image/jpeg",
      buffer: await readFile(
        new URL("./images/quadrants.jpg", import.meta.url),
      ),
    },
    invalid: {
      name: "unsupported.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>throw new Error("SVG must never execute")</script></svg>',
      ),
    },
    orientedJpeg: {
      name: "quadrants-oriented.jpg",
      mimeType: "image/jpeg",
      buffer: await readFile(
        new URL("./images/quadrants-oriented.jpg", import.meta.url),
      ),
    },
  };
}

export const testImageFiles = { files };
