import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const names = new Set(["writing", "fragment-editing", "math-boards"]);

// Runs inside a Playwriter session. Page-scoped CDP avoids the installed
// extension's unreliable frame-evaluation/screenshot synchronization.
class Capture {
  constructor(page, cdp, applicationCommit) {
    if (!/^[0-9a-f]{40}$/.test(applicationCommit ?? ""))
      throw new Error(
        "Pass the verified production build commit before capture.",
      );

    this.applicationCommit = applicationCommit;
    this.page = page;
    this.cdp = cdp;
    this.frames = [];
    this.directory = undefined;
    this.name = undefined;
  }

  async prepare(base) {
    const url = new URL(base);

    if (
      url.protocol !== "http:" ||
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.pathname !== "/penable/"
    )
      throw new Error(
        "Use an owned loopback Pages preview ending in /penable/.",
      );

    await this.page.goto(new URL("manifest.webmanifest", url).href, {
      waitUntil: "domcontentloaded",
    });

    const existing = await this.cdp.send("Runtime.evaluate", {
      expression: "indexedDB.databases()",
      awaitPromise: true,
      returnByValue: true,
    });

    if (existing.exceptionDetails || !Array.isArray(existing.result?.value))
      throw new Error("Cannot verify that the demo origin is unused.");

    if (existing.result.value.length)
      throw new Error(
        "Origin contains existing databases. Use another unused preview port; do not clear data.",
      );

    await this.cdp.send("Runtime.evaluate", {
      expression: 'localStorage.setItem("penable:language", "en"); true',
      returnByValue: true,
    });

    await this.page.setViewportSize({ width: 1280, height: 800 });
    await this.page.goto(url.href, { waitUntil: "domcontentloaded" });
    await this.page.getByRole("button", { name: "Pen", exact: true }).waitFor();
  }

  start(name, seconds = 10) {
    if (!names.has(name) || seconds < 8 || seconds > 12)
      throw new Error("Use a known demo name and an 8–12 second duration.");

    const parent = path.join(repository, ".artifacts/change-37/frames", name);
    let take = 1;

    while (fs.existsSync(path.join(parent, `take-${take}`))) take++;

    this.directory = path.join(parent, `take-${take}`);
    fs.mkdirSync(this.directory, { recursive: true });
    this.name = name;
    this.seconds = seconds;
    this.frames = [];

    return this.directory;
  }

  async frame(weight = 1) {
    if (!this.directory || !(weight > 0))
      throw new Error("Start a demo first.");

    const shot = await this.cdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });

    const file = path.join(
      this.directory,
      `frame-${String(this.frames.length).padStart(4, "0")}.png`,
    );

    fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
    this.frames.push({ file, weight });

    return file;
  }

  async draw(paths, animated = false) {
    for (const points of paths) {
      if (points.length < 2) throw new Error("A demo stroke needs two points.");

      await this.page.mouse.move(...points[0]);
      await this.page.mouse.down();

      for (let index = 1; index < points.length; index++) {
        const from = points[index - 1];
        const to = points[index];
        const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);

        await this.page.mouse.move(...to, {
          steps: Math.max(2, Math.ceil(distance / 10)),
        });

        if (animated) await this.frame();
      }

      await this.page.mouse.up();

      if (animated) await this.frame(2);
    }
  }

  async drag(from, to, steps = 10) {
    await this.page.mouse.move(...from);
    await this.page.mouse.down();

    for (let index = 1; index <= steps; index++) {
      await this.page.mouse.move(
        from[0] + ((to[0] - from[0]) * index) / steps,
        from[1] + ((to[1] - from[1]) * index) / steps,
      );

      await this.frame();
    }

    await this.page.mouse.up();
  }

  finish(poster = this.frames.at(-1)?.file) {
    if (!poster || !this.frames.length)
      throw new Error("Capture frames before export.");

    const file = path.join(this.directory, "frames.json");

    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          name: this.name,
          applicationCommit: this.applicationCommit,
          seconds: this.seconds,
          poster,
          viewport: { width: 1280, height: 800 },
          input:
            "Authored synthetic notes and scripted mouse input in the real application",
          frames: this.frames,
        },
        null,
        2,
      ) + "\n",
    );

    return file;
  }
}

export const DemoCapture = {
  create: (page, cdp, applicationCommit) =>
    new Capture(page, cdp, applicationCommit),
};
