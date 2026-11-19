// Run in an owned Playwriter session. Serve the two Pages builds on isolated
// loopback origins. Set state.port to 4266 (baseline) or 4267 (candidate).
const port = state.port;

if (![4266, 4267].includes(port)) throw new Error("Unexpected benchmark port");

const root = "http://127.0.0.1:" + port + "/penable/";
const page = state.page;

await page.goto(root + "manifest.webmanifest");

await page.evaluate(async () => {
  const marker = "penable-benchmark-editor-46";

  if ((await indexedDB.databases()).length) {
    if (!localStorage.getItem(marker)) throw new Error("Origin already in use");

    return;
  }

  const doc = {
    format: "penable-board",
    schemaVersion: 3,
    strokes: [],
    background: "blank",
    backgroundSettings: { contrast: 45, spacing: 24 },
    lastWritingView: null,
    viewport: { zoom: 1, x: 0, y: 0 },
    tools: { width: 3, stabilization: 65 },
  };

  const boards = [
    { id: "main", title: "Small" },
    { id: "large", title: "Million" },
  ];

  const strokes = Array.from({ length: 20000 }, (_, i) => ({
    id: i + 1,
    color: "#182230",
    width: 3,
    stabilization: { strength: 65, captureZoom: 1 },
    points: Array.from({ length: 50 }, (_, j) => ({
      x: 2000 + (i % 100) * 64 + j,
      y: 2000 + Math.floor(i / 100) * 8 + (j % 3),
      pressure: (j % 5) / 4,
      time: i * 50 + j,
    })),
  }));

  await new Promise((resolve, reject) => {
    const req = indexedDB.open("penable", 1);

    req.onupgradeneeded = () => req.result.createObjectStore("documents");
    req.onerror = () => reject(req.error);

    req.onsuccess = () => {
      const db = req.result,
        tx = db.transaction("documents", "readwrite"),
        store = tx.objectStore("documents");

      store.put(
        {
          format: "penable-library",
          schemaVersion: 2,
          boards,
          activeId: "main",
        },
        "library",
      );

      store.put(doc, "main");
      store.put({ ...doc, strokes }, "board:large");

      tx.oncomplete = () => {
        db.close();
        resolve();
      };

      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
  });

  localStorage.setItem(marker, "1");
});

await page.goto(root);

await page.bringToFront();

const boards = page.getByRole("button", { name: /^(Boards|Доски)$/ });

await boards.click();

const open = (title) =>
  page.getByRole("button", {
    name: new RegExp("(Open board|Открыть доску).*" + title, "i"),
  });

const target = open("Million");

if (await target.isDisabled()) {
  await open("Small").click();
  await boards.click();
}

await target.waitFor();

await page.evaluate(() => {
  const old = document.querySelector('[data-testid="board-live"]');

  if (!old) throw new Error("Small board did not mount");

  document.addEventListener(
    "click",
    () => {
      const start = performance.now();

      let previous = start,
        maxGap = 0;

      const timer = setInterval(() => {
        const now = performance.now();

        maxGap = Math.max(maxGap, now - previous);
        previous = now;
      }, 8);

      function probe() {
        if (performance.now() - start > 60000) {
          clearInterval(timer);
          window.open46 = { error: "timeout" };

          return;
        }

        const canvas = document.querySelector('[data-testid="board-live"]');

        if (canvas && canvas !== old) {
          const init = {
            pointerId: 561,
            pointerType: "pen",
            button: 0,
            buttons: 1,
            isPrimary: true,
            clientX: 350,
            clientY: 250,
            pressure: 0.5,
            bubbles: true,
            cancelable: true,
          };

          if (!canvas.dispatchEvent(new PointerEvent("pointerdown", init))) {
            canvas.dispatchEvent(
              new PointerEvent("pointercancel", { ...init, buttons: 0 }),
            );

            const ready = performance.now();

            clearInterval(timer);

            window.open46 = {
              readyMs: ready - start,
              maxGapMs: Math.max(maxGap, ready - previous),
            };

            return;
          }
        }

        requestAnimationFrame(probe);
      }

      requestAnimationFrame(probe);
    },
    { capture: true, once: true },
  );
});

await target.click();

await page.waitForFunction(() => window.open46, undefined, { timeout: 60000 });

const result = await page.evaluate(() => window.open46);

if (result.error) throw new Error(result.error);

const cdp = await getCDPSession({ page });

await cdp.send("Performance.enable");

// Automated Chromium fixtures may request a post-readiness retained-heap sample.
if (state.collectHeap) await cdp.send("HeapProfiler.collectGarbage");

const heap = (await cdp.send("Performance.getMetrics")).metrics.find(
  (metric) => metric.name === "JSHeapUsedSize",
);

console.log({
  port,
  ...result,
  heapMiB: heap.value / 1048576,
  browser: await page.evaluate(() => navigator.userAgent),
});

await boards.click();

await open("Small").click();

await page.waitForFunction(() =>
  Array.from(document.querySelectorAll("button")).some(
    (button) =>
      /^(Boards|Доски)$/.test(button.getAttribute("aria-label") ?? "") &&
      button.textContent.includes("Small"),
  ),
);

console.log(await getLatestLogs({ page, sinceLastCall: true, count: 4 }));
