// This isolated review artifact never imports the editor or reads browser storage.
const editor = document.querySelector("#editor");

const icons = {
  "chevron-down": '<path d="m7 10 5 5 5-5"/>',
  pen: '<path d="m14 4 6 6-9 9-7 1 1-7Z M11 7l6 6 M4 20l4-4"/>',
  eraser: '<path d="m14 4 6 6-10 10H6l-4-4Z M8 10l6 6 M10 20h11"/>',
  selection: '<path stroke-dasharray="3 3" d="M4 4h16v16H4Z"/>',
  undo: '<path d="m8 4-5 5 5 5 M3 9h11a6 6 0 0 1 0 12"/>',
  redo: '<path d="m16 4 5 5-5 5 M21 9H10a6 6 0 0 0 0 12"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12 M6 18 18 6"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8 8 12 12 M8 16 20 4"/>',
  paste:
    '<rect x="7" y="3" width="10" height="4" rx="1"/><path d="M7 5H4v16h16V5h-3 M8 12h8 M8 16h6"/>',
  duplicate:
    '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5 M11 14h7 M14.5 10.5v7"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 18 6-6 4 4 3-3 5 5"/>',
  download: '<path d="M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V4 m-5 5 5-5 5 5 M4 16v5h16v-5"/>',
  trash: '<path d="M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7"/>',
  history: '<path d="M3 4v6h6 M3 10a9 9 0 1 1 1 7 M12 7v6l4 2"/>',
  device:
    '<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8 M12 17v4"/>',
  retry: '<path d="M20 4v6h-6 M20 10a8 8 0 1 0 0 6"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M5 12h14 M12 5v14"/>',
  fit: '<path d="M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5 M8 8h8v8H8Z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2 M12 17h.01"/>',
};

function renderIcon(element, name) {
  element.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
}

for (const element of document.querySelectorAll("[data-icon]")) {
  renderIcon(element, element.dataset.icon);
}

const panels = [...document.querySelectorAll(".popover")];
let activeTrigger = null;
let currentTool = "pen";
let noticeTimer;

function closePanels(returnFocus = false) {
  for (const panel of panels) panel.hidden = true;

  for (const trigger of document.querySelectorAll("[aria-expanded]")) {
    trigger.setAttribute("aria-expanded", "false");
  }

  if (returnFocus) activeTrigger?.focus();

  activeTrigger = null;
}

function openPanel(id, trigger, focus = true) {
  const panel = document.getElementById(id);
  const wasOpen = !panel.hidden;

  closePanels();

  if (wasOpen) return;

  panel.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  activeTrigger = trigger;

  if (focus) panel.querySelector("button:not(:disabled), input")?.focus();
}

function notify() {
  const notice = document.querySelector("#demo-notice");

  notice.textContent =
    "Это макет: действия с записями и файлами не выполняются.";

  notice.hidden = false;
  clearTimeout(noticeTimer);

  noticeTimer = setTimeout(() => {
    notice.hidden = true;
  }, 3500);
}

function setTool(tool) {
  closePanels();
  currentTool = tool;
  editor.dataset.tool = tool;

  for (const button of document.querySelectorAll("[data-tool]")) {
    const selected = button.dataset.tool === tool;

    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }

  document.querySelector("#width-setting").hidden = tool !== "pen";
  document.querySelector("#eraser-setting").hidden = tool !== "eraser";
  document.querySelector("#selection-setting").hidden = tool !== "selection";
}

function setSaveError(error) {
  editor.dataset.error = String(error);

  document.querySelector("#save-label").textContent = error
    ? "Не удалось сохранить"
    : "Сохранено локально";

  document.querySelector("#save-title").textContent = error
    ? "Нужна резервная копия"
    : "Записи сохранены";

  document.querySelector("#save-description").textContent = error
    ? "Скачайте копию доски, чтобы сохранить последние записи в отдельном файле."
    : "Доска сохранена локально в этом браузере. Для отдельной копии скачайте JSON-файл.";

  document.querySelector("#save-recovery").hidden = !error;
  renderIcon(document.querySelector("#save-icon"), error ? "retry" : "check");
}

function setState(state) {
  const validStates = ["writing", "pen", "selection", "board", "error"];
  const next = validStates.includes(state) ? state : "writing";

  editor.dataset.state = next;
  document.querySelector("#demo-notice").hidden = true;

  for (const button of document.querySelectorAll(".state-switcher button")) {
    button.setAttribute("aria-pressed", String(button.dataset.state === next));
  }

  setTool(next === "selection" ? "selection" : "pen");
  setSaveError(next === "error");

  const preset = {
    pen: ["pen-panel", 'button[data-tool="pen"]'],
    selection: ["selection-panel", "#actions-trigger"],
    board: ["board-panel", "#board-trigger"],
    error: ["save-panel", "#save-trigger"],
  }[next];

  if (preset) openPanel(preset[0], document.querySelector(preset[1]), false);
}

for (const button of document.querySelectorAll(".state-switcher button")) {
  button.addEventListener("click", () => setState(button.dataset.state));
}

for (const button of document.querySelectorAll("[data-tool]")) {
  button.addEventListener("click", () => {
    if (currentTool === "pen" && button.dataset.tool === "pen") {
      openPanel("pen-panel", button);
    } else {
      setTool(button.dataset.tool);
    }
  });
}

for (const trigger of document.querySelectorAll("[aria-controls]")) {
  if (trigger.hasAttribute("data-tool")) continue;

  trigger.addEventListener("click", () =>
    openPanel(trigger.getAttribute("aria-controls"), trigger),
  );
}

for (const button of document.querySelectorAll("[data-close]")) {
  button.addEventListener("click", () => closePanels(true));
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closePanels(true);
});

document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest(".popover, [aria-controls], .state-switcher"))
    closePanels();
});

for (const button of document.querySelectorAll("[data-demo]")) {
  button.addEventListener("click", () => {
    if (button.dataset.demo === "clear") setTool("pen");

    notify();
  });
}

for (const button of document.querySelectorAll("[data-shape]")) {
  button.addEventListener("click", () => {
    for (const option of document.querySelectorAll("[data-shape]")) {
      const selected = option === button;

      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    }

    editor.dataset.shape = button.dataset.shape;
  });
}

for (const button of document.querySelectorAll("[data-background]")) {
  button.addEventListener("click", () => {
    editor.dataset.background = button.dataset.background;

    for (const option of document.querySelectorAll("[data-background]")) {
      const selected = option === button;

      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    }
  });
}

document.querySelector("#retry-button").addEventListener("click", () => {
  setSaveError(false);
  closePanels(true);
  notify();
});

function updateRanges() {
  const width = document.querySelector("#pen-width");
  const stabilization = document.querySelector("#stabilization");

  document.querySelector("#width-value").innerHTML =
    `${Number(width.value).toFixed(1)}<span>px</span>`;

  document.querySelector("#stabilization-value").innerHTML =
    `${stabilization.value}<span>%</span>`;

  document.querySelector("#width-dot").style.width = `${width.value}px`;
  document.querySelector("#width-dot").style.height = `${width.value}px`;
  document.querySelector(".stroke-sample path").style.strokeWidth = width.value;

  for (const range of [width, stabilization]) {
    range.style.setProperty(
      "--range-progress",
      `${((range.value - range.min) / (range.max - range.min)) * 100}%`,
    );
  }
}

for (const range of document.querySelectorAll('input[type="range"]')) {
  range.addEventListener("input", updateRanges);
}

const query = new URLSearchParams(location.search);

if (query.has("preview")) document.body.dataset.preview = "";

setState(query.get("state"));

updateRanges();

// Inline a local, authored SVG so the locally bundled handwriting font applies.
const response = await fetch("assets/scene.svg");

if (!response.ok)
  throw new Error("Не удалось загрузить синтетический конспект");

const scene = new DOMParser().parseFromString(
  await response.text(),
  "image/svg+xml",
);

document
  .querySelector("#note-scene")
  .append(document.importNode(scene.documentElement, true));

await document.fonts.ready;

document.body.dataset.ready = "true";
