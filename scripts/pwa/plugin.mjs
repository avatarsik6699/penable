import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { AppIcons } from "./icons.mjs";
import { ServiceWorkerSource } from "./service-worker.mjs";

const PwaBuild = {
  async files(directory, prefix = "") {
    const entries = await readdir(directory, { withFileTypes: true });

    const lists = await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? PwaBuild.files(
              join(directory, entry.name),
              prefix + entry.name + "/",
            )
          : [prefix + entry.name],
      ),
    );

    return lists.flat().sort();
  },
};

export function appAvailabilityPlugin() {
  let config;

  return {
    name: "penable-offline",
    apply: "build",

    configResolved(resolved) {
      config = resolved;
    },

    transformIndexHtml() {
      return [
        {
          tag: "link",
          attrs: {
            rel: "manifest",
            href: `${config.base}manifest.webmanifest`,
          },
          injectTo: "head",
        },
        {
          tag: "link",
          attrs: {
            rel: "apple-touch-icon",
            href: `${config.base}icon-180.png`,
          },
          injectTo: "head",
        },
      ];
    },

    async closeBundle() {
      const base = config.base;

      if (!base.startsWith("/") || !base.endsWith("/"))
        throw new Error(
          "Offline shell requires an absolute local base ending in /",
        );

      const out = resolve(config.root, config.build.outDir);

      for (const size of [180, 192, 512])
        await writeFile(join(out, `icon-${size}.png`), AppIcons.png(size));

      const manifest = {
        id: base,
        name: "penable — рукописные конспекты",
        short_name: "penable",
        lang: "ru",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [192, 512].map((size) => ({
          src: `${base}icon-${size}.png`,
          sizes: `${size}x${size}`,
          type: "image/png",
          purpose: "any maskable",
        })),
      };

      await writeFile(
        join(out, "manifest.webmanifest"),
        JSON.stringify(manifest),
      );

      const files = (await PwaBuild.files(out)).filter(
        (file) => file !== "sw.js" && !file.endsWith(".map"),
      );

      const hash = createHash("sha256")
        .update(base)
        .update(ServiceWorkerSource.create.toString());

      const integrities = {};

      for (const file of files) {
        const bytes = await readFile(join(out, file));

        hash.update(file).update(bytes);

        integrities[base + file] =
          `sha256-${createHash("sha256").update(bytes).digest("base64")}`;
      }

      const version = hash.digest("hex").slice(0, 24);
      const prefix = `penable-shell:${encodeURIComponent(base)}:`;

      await writeFile(
        join(out, "sw.js"),
        ServiceWorkerSource.create({
          base,
          prefix,
          version,
          integrities,
          files: files.map((file) => base + file),
        }),
      );
    },
  };
}
