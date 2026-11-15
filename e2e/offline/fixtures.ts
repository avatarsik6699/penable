import { test as base, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { AppAvailabilityPage } from "../pages/app-availability-page";
import { BoardPage } from "../pages/board-page";
import { StoragePage } from "../pages/storage-page";

type OfflineServer = {
  setVersion: (version: "original" | "update" | "broken") => void;
};

export const test = base.extend<
  { offlineApp: AppAvailabilityPage; offlineFailureApp: AppAvailabilityPage },
  { offlineServer: OfflineServer }
>({
  offlineServer: [
    async ({ browserName: _browserName }, provide) => {
      let version = "original";
      const root = resolve(process.env.PENABLE_E2E_DIST ?? "dist");

      const types: Record<string, string> = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".png": "image/png",
        ".webmanifest": "application/manifest+json",
      };

      const server = createServer(async (request, response) => {
        const url = new URL(request.url ?? "/", "http://127.0.0.1:4209");
        const name = url.pathname.replace(/^\/penable\//, "") || "index.html";
        const path = resolve(root, name);

        if (!path.startsWith(`${root}/`)) {
          response.writeHead(404).end();

          return;
        }

        try {
          let body: string | Buffer = await readFile(path);

          if (name === "sw.js" && version !== "original") {
            body = body
              .toString()
              .replace(
                /(const CACHE(?:_NAME)? = )([^;]+);/,
                `$1$2 + "-${version}";`,
              );

            body += `\n// owned ${version} upgrade\n`;
          }

          if (name === "index.html" && version === "broken")
            body = body.toString() + "<!-- owned deployment mismatch -->";

          response.writeHead(200, {
            "Content-Type": types[extname(path)] ?? "application/octet-stream",
            "Cache-Control": "no-store",
          });

          response.end(body);
        } catch {
          response.writeHead(404).end();
        }
      });

      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(4209, "127.0.0.1", resolve);
      });

      try {
        await provide({
          setVersion: (next) => {
            version = next;
          },
        });
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    },
    { scope: "worker" },
  ],

  offlineApp: async ({ browser, offlineServer }, provide) => {
    offlineServer.setVersion("original");

    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:4209/penable/",
      locale: "ru-RU",
      acceptDownloads: true,
      serviceWorkers: "allow",
    });

    const errors: string[] = [];

    context.on("page", (page) => {
      page.on("pageerror", (error) => errors.push(error.message));

      page.on("console", (message) => {
        if (["warning", "error"].includes(message.type()))
          errors.push(message.text());
      });
    });

    const page = await context.newPage();

    const board = new BoardPage(page, new StoragePage(page));

    try {
      await board.open();

      await provide(
        new AppAvailabilityPage(page, context, board, offlineServer.setVersion),
      );
    } finally {
      await context.close();
      expect(errors).toEqual([]);
    }
  },

  offlineFailureApp: async ({ browser, offlineServer }, provide) => {
    offlineServer.setVersion("broken");

    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:4209/penable/",
      locale: "ru-RU",
      acceptDownloads: true,
      serviceWorkers: "allow",
    });

    const errors: string[] = [];

    context.on("page", (page) => {
      page.on("pageerror", (error) => errors.push(error.message));

      page.on("console", (message) => {
        if (["warning", "error"].includes(message.type()))
          errors.push(message.text());
      });
    });

    const page = await context.newPage();

    const board = new BoardPage(page, new StoragePage(page));

    try {
      await board.open();

      await provide(
        new AppAvailabilityPage(page, context, board, offlineServer.setVersion),
      );
    } finally {
      await context.close();
      expect(errors).toEqual([]);
    }
  },
});
