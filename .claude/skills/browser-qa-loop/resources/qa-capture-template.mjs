// Browser-QA capture harness template (reference instance: the
// ontology-workbench-migration shell — adapt the scenario list per surface).
// Drives the dev server with real pointer input, screenshots every scenario,
// and writes .beep/qa/round-N/manifest.json for the vision-judging pass.
//
// Recording integration (v0.2): when spawned by `bun run beep qa record
// --lane playwright`, the env below is set and the harness ALSO records
// video (playwright recordVideo), injects the witness event log, and fires
// the clock-sync beacon. Standalone runs (no env) still work screenshots-only.
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const ROUND = process.env.QA_ROUND ?? "1";
const URL = process.env.QA_URL ?? "http://storybook.beep.localhost:1355/";
const COLLECTOR = process.env.QA_COLLECTOR_URL; // e.g. http://127.0.0.1:43117
const SESSION_ID = process.env.QA_SESSION_ID;
const VIDEO_DIR = process.env.QA_VIDEO_DIR; // .beep/qa/round-N/video
const OUT = new globalThis.URL(`./qa/round-${ROUND}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const manifest = { round: ROUND, url: URL, scenarios: [] };
const scenario = (name) => {
  const record = { name, screenshots: [], assertions: [], consoleErrors: [], notes: [] };
  manifest.scenarios.push(record);
  return record;
};

// ---- browser + recording context -------------------------------------------
const VIEWPORT = { width: 1600, height: 1000 };
const browser = await chromium.launch();
// Snapshot a start hint BEFORE the context exists — the assumed-start clock
// fallback reads video/record-hint.json when the beacon is not detected.
const recordStartHintEpochMs = Date.now();
const context = await browser.newContext({
  viewport: VIEWPORT,
  ...(VIDEO_DIR ? { recordVideo: { dir: VIDEO_DIR, size: VIEWPORT } } : {}),
});
if (VIDEO_DIR) {
  mkdirSync(VIDEO_DIR, { recursive: true });
  writeFileSync(`${VIDEO_DIR}/record-hint.json`, JSON.stringify({ recordStartHintEpochMs }));
}
const page = await context.newPage();

// ---- witness injection (event log + fake cursor; survives navigations) -----
if (COLLECTOR) {
  const witnessSource = await (await fetch(`${COLLECTOR}/witness.js`)).text();
  const config = {
    collectorUrl: COLLECTOR,
    sessionId: SESSION_ID ?? `round-${ROUND}`,
    features: { cursor: true, beacon: false }, // beacon fired explicitly once below
  };
  await page.addInitScript({
    content: `window.__BEEP_QA__ = ${JSON.stringify(config)};\n${witnessSource}`,
  });
}
const mark = async (label) => {
  if (COLLECTOR) await page.evaluate((l) => window.__beepQa?.mark(l), label).catch(() => {});
};
const flushWitness = async () => {
  if (COLLECTOR) await page.evaluate(() => window.__beepQa?.flush()).catch(() => {});
};

const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text().slice(0, 300));
});
const drainConsole = (record) => {
  record.consoleErrors.push(...consoleErrors.splice(0));
};
const shot = async (record, label) => {
  const file = `${record.name}--${label}.png`;
  await page.screenshot({ path: `${OUT}${file}` });
  record.screenshots.push(file);
};
const assert = (record, name, ok, detail = "") => {
  record.assertions.push({ name, ok, detail });
};
const settle = (ms = 700) => page.waitForTimeout(ms);
const tabSelector = (key) => `[data-panel-id='surface-${key}']`;
// Gesture pacing: extraction needs frame density — keep drags ≥ 20 steps so a
// 25 fps recording catches every intermediate state (a 4-step flick is one
// frame). Slow is correct here.
const dragTab = async (fromKey, target) => {
  const tab = page.locator(tabSelector(fromKey)).first();
  const box = await tab.boundingBox();
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 40, box.y + 40, { steps: 8 });
  await page.mouse.move(target.x, target.y, { steps: 24 });
  return { finish: async () => { await page.mouse.up(); await settle(); } };
};
const groupBox = (groupId) => page.locator(`[data-group-id='${groupId}']`).first().boundingBox();
// Mid-gesture cancel injection: dispatches pointercancel on the element that
// holds the capture. Synthetic (tests handler wiring, not an OS-level cancel —
// a Lane B round covers the native path).
const injectPointerCancel = async (selector) => {
  await page.locator(selector).first().dispatchEvent("pointercancel");
};

// ---- boot (+ one-time sync beacon) ----
await page.addInitScript(() => {
  if (!window.__qaSeeded) {
    window.__qaSeeded = true;
    window.localStorage.setItem("desktop:dock-workspace:v1", "stale v1 snapshot");
  }
});
await page.goto(URL, { waitUntil: "networkidle" });
await settle(3000);
if (COLLECTOR) {
  // Fire the clock beacon exactly once, on a settled first page — the
  // correlator derives its probe window from these flip events.
  await page.evaluate(() => window.__beepQa?.runSyncBeacon());
  await settle(1600); // let all 8 flips land inside the recording
}

{
  const record = scenario("default-layout-and-v2-boot");
  await mark("scenario:default-layout-and-v2-boot");
  const groups = await page.$$eval("[data-group-id]", (els) => els.map((el) => el.getAttribute("data-group-id")));
  assert(record, "four groups", groups.length === 4, groups.join(","));
  const keys = await page.evaluate(() => ({
    v1: window.localStorage.getItem("desktop:dock-workspace:v1"),
    v2: window.localStorage.getItem("desktop:dock-workspace:v2"),
  }));
  assert(record, "stale v1 removed", keys.v1 === null);
  const actives = await page.$$eval("[role='tab'][data-active='true']", (els) => els.map((el) => el.textContent ?? ""));
  assert(record, "locked actives", ["Explorer", "Graph", "Inspector", "Chat"].every((label) => actives.some((text) => text.includes(label))), actives.join("|"));
  await shot(record, "boot");
  drainConsole(record);
}

{
  const record = scenario("rail-menu-every-panel");
  await mark("scenario:rail-menu-every-panel");
  for (const key of ["ontology-sparql", "ontology-validation", "ontology-metrics"]) {
    await page.click("[data-desktop-ontology-menu]");
    await settle(250);
    await page.click(`[data-panel-menu-item='${key}']`);
    await settle(500);
    assert(record, `${key} opened`, (await page.$(tabSelector(key))) !== null);
  }
  await shot(record, "tools-open");
  for (const key of ["ontology-explorer", "ontology-document", "ontology-graph", "ontology-source", "ontology-inspector", "ontology-changelog"]) {
    await page.click("[data-desktop-ontology-menu]");
    await settle(200);
    await page.click(`[data-panel-menu-item='${key}']`);
    await settle(300);
    const active = await page.$eval(tabSelector(key), (el) => el.getAttribute("data-active"));
    assert(record, `${key} focused`, active === "true");
  }
  await shot(record, "after-focus-sweep");
  drainConsole(record);
}

{
  const record = scenario("tab-overflow");
  await mark("scenario:tab-overflow");
  await page.setViewportSize({ width: 900, height: 800 });
  await settle(900);
  const trigger = await page.$("[data-dock-overflow]");
  assert(record, "overflow trigger appears at 900px", trigger !== null);
  if (trigger !== null) {
    await trigger.click();
    await settle(300);
    await shot(record, "dropdown-open");
    const item = await page.$("[role='menu'] [role='menuitem'], [data-dock-overflow] ~ div [data-panel-id]");
    const menuItems = await page.$$("[role='menuitem']");
    assert(record, "dropdown lists entries", menuItems.length > 0 || item !== null, `menuitems=${menuItems.length}`);
    if (menuItems.length > 0) {
      await menuItems[0].click();
      await settle(400);
    }
    await shot(record, "after-activate");
  }
  await page.setViewportSize({ width: 1600, height: 1000 });
  await settle(900);
  drainConsole(record);
}

{
  const record = scenario("drop-quadrants");
  await mark("scenario:drop-quadrants");
  const target = await groupBox("desktop-ontology-center");
  const zones = {
    left: { x: target.x + 8, y: target.y + target.height / 2 },
    right: { x: target.x + target.width - 8, y: target.y + target.height / 2 },
    top: { x: target.x + target.width / 2, y: target.y + 40 },
    bottom: { x: target.x + target.width / 2, y: target.y + target.height - 8 },
  };
  for (const [zone, point] of Object.entries(zones)) {
    await mark(`gesture:drop-preview-${zone}`);
    const drag = await dragTab("ontology-changelog", point);
    await settle(400); // hold the hover so extraction catches the preview state
    const indicator = await page.$("[data-drop-indicator]");
    assert(record, `${zone} zone shows preview`, indicator !== null);
    await shot(record, `preview-${zone}`);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await settle(300);
    void drag;
  }
  const before = (await page.$$("[data-group-id]")).length;
  await mark("gesture:drop-complete-bottom");
  const drag = await dragTab("ontology-changelog", zones.bottom);
  await drag.finish();
  const after = (await page.$$("[data-group-id]")).length;
  assert(record, "bottom edge drop splits", after === before + 1, `${before}->${after}`);
  const landed = await page.evaluate(() => {
    const tab = document.querySelector("[data-panel-id='surface-ontology-changelog']");
    const group = tab?.closest("[data-group-id]");
    const center = document.querySelector("[data-group-id='desktop-ontology-center']");
    if (!group || !center) return null;
    const g = group.getBoundingClientRect();
    const c = center.getBoundingClientRect();
    return { width: g.width, height: g.height, sameColumn: Math.abs(g.left - c.left) < 4 && Math.abs(g.width - c.width) < 4 };
  });
  assert(record, "split scoped to center column", landed !== null && landed.sameColumn, JSON.stringify(landed));
  assert(record, "inserted row respects minima", landed !== null && landed.height >= 200, `h=${landed?.height}`);
  await shot(record, "after-drop");
  drainConsole(record);
}

{
  const record = scenario("escape-cancels-drag");
  await mark("scenario:escape-cancels-drag");
  const target = await groupBox("desktop-ontology-left");
  const before = await page.$$eval("[data-group-id]", (els) => els.length);
  const drag = await dragTab("ontology-source", { x: target.x + 8, y: target.y + target.height / 2 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await settle(400);
  void drag;
  const after = await page.$$eval("[data-group-id]", (els) => els.length);
  assert(record, "no layout change after Escape", after === before, `${before}->${after}`);
  const sourceHome = await page.evaluate(() => document.querySelector("[data-panel-id='surface-ontology-source']")?.closest("[data-group-id]")?.getAttribute("data-group-id"));
  assert(record, "source stayed in center", sourceHome === "desktop-ontology-center", String(sourceHome));
  drainConsole(record);
}

{
  const record = scenario("float-dock-cycle-explorer-strictmode");
  await mark("scenario:float-dock-cycle");
  consoleErrors.splice(0);
  await page.click("button[aria-label='Float group desktop-ontology-left']");
  await settle(800);
  const floating = await page.$("[data-floating-pane]");
  assert(record, "explorer group floats", floating !== null);
  await shot(record, "floating");
  const header = await page.$("[data-floating-header]");
  const headerBox = await header.boundingBox();
  const grip = { x: headerBox.x + headerBox.width / 2, y: headerBox.y + 8 };
  const before = await page.$eval("[data-floating-pane]", (el) => el.getBoundingClientRect().toJSON());
  await mark("gesture:floating-header-drag");
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  // Deltas are measured from the PRESS point (round-1 harness-bug lesson).
  // Slow drag ACROSS panel text — mid-drag frames must show zero native
  // selection smear (Sash/FloatingPane preventDefault class).
  await page.mouse.move(grip.x + 160, grip.y + 120, { steps: 24 });
  await page.mouse.up();
  await settle(500);
  const moved = await page.$eval("[data-floating-pane]", (el) => el.getBoundingClientRect().toJSON());
  assert(record, "header drag translates by pointer delta only",
    Math.abs(moved.left - before.left - 160) <= 2 && Math.abs(moved.top - before.top - 120) <= 2 &&
    Math.abs(moved.width - before.width) <= 1 && Math.abs(moved.height - before.height) <= 1,
    `d=(${(moved.left - before.left).toFixed(0)},${(moved.top - before.top).toFixed(0)}) size ${moved.width}x${moved.height}`);
  const selectionClean = await page.evaluate(() => window.getSelection()?.isCollapsed !== false);
  assert(record, "no native selection after header drag", selectionClean);
  await shot(record, "moved");
  await page.click("button[aria-label^='Dock group']");
  await settle(800);
  assert(record, "docks back", (await page.$("[data-floating-pane]")) === null);
  await shot(record, "docked-back");
  const invariant = consoleErrors.filter((text) => text.includes("useDisposable") || text.includes("StrictMode"));
  record.notes.push(`StrictMode/useDisposable console errors during explorer reparenting: ${invariant.length}`);
  drainConsole(record);
}

{
  const record = scenario("chat-keepalive-across-relayout");
  await mark("scenario:chat-keepalive");
  const identity = await page.evaluate(() => {
    const node = document.querySelector("[data-testid='chat-app']");
    if (node) node.__qaMark = "keepalive-check";
    return node !== null;
  });
  assert(record, "chat mounted", identity);
  await page.click(tabSelector("ontology-source"));
  await settle(300);
  await page.click("button[aria-label='Float group desktop-ontology-center']");
  await settle(600);
  await page.click("button[aria-label^='Dock group']");
  await settle(600);
  const kept = await page.evaluate(() => document.querySelector("[data-testid='chat-app']")?.__qaMark === "keepalive-check");
  assert(record, "chat node identity survives ontology re-layout", kept);
  await shot(record, "after-relayout");
  drainConsole(record);
}

{
  const record = scenario("theme-toggle");
  await mark("scenario:theme-toggle");
  await shot(record, "before");
  const toggle = await page.$("nav button[aria-label*='heme'], nav [data-theme-toggle], nav button:has-text('Theme')");
  if (toggle !== null) {
    await toggle.click();
    await settle(400); // transition events land in the witness log; extraction correlates them
    await shot(record, "after");
    assert(record, "theme toggled", true);
  } else {
    const buttons = await page.$$("nav button");
    const last = buttons[buttons.length - 1];
    await last.click();
    await settle(400);
    await shot(record, "after");
    record.notes.push("theme toggle targeted as last nav button");
  }
  drainConsole(record);
}

{
  const record = scenario("sash-resize-respects-minima");
  await mark("scenario:sash-resize");
  const sash = await page.$("[data-sash-id='desktop-ontology-columns']");
  if (sash !== null) {
    const sashBox = await sash.boundingBox();
    await mark("gesture:sash-drag-to-minima");
    // Anchor drag Y to a TEXT row when hunting selection smear — panels are
    // mostly empty and a mid-height drag crosses nothing selectable. Note the
    // verified boundary: synthetic pointer streams do NOT anchor native
    // selections in headless Chromium — the smear class needs a Lane B round.
    await page.mouse.move(sashBox.x + 2, sashBox.y + sashBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(20, sashBox.y + sashBox.height / 2, { steps: 24 });
    await page.mouse.up();
    await settle(500);
    const after = await groupBox("desktop-ontology-left");
    assert(record, "left group respects min extent", after.width >= 170, `width=${after.width}`);
    const selectionClean = await page.evaluate(() => window.getSelection()?.isCollapsed !== false);
    assert(record, "no native selection after sash drag", selectionClean);
    await shot(record, "after-squeeze");

    // Mid-drag pointercancel: state must reset cleanly (cancel-reset lens).
    await mark("gesture:sash-pointercancel");
    const box2 = await sash.boundingBox();
    await page.mouse.move(box2.x + 2, box2.y + box2.height / 2);
    await page.mouse.down();
    await page.mouse.move(box2.x + 120, box2.y + box2.height / 2, { steps: 12 });
    await injectPointerCancel("[data-sash-id='desktop-ontology-columns']");
    await settle(200);
    const widthAtCancel = (await groupBox("desktop-ontology-left")).width;
    await page.mouse.move(box2.x + 260, box2.y + box2.height / 2, { steps: 8 });
    await settle(300);
    const widthAfterMove = (await groupBox("desktop-ontology-left")).width;
    assert(record, "pointercancel stops resize tracking", Math.abs(widthAfterMove - widthAtCancel) <= 2, `${widthAtCancel}->${widthAfterMove}`);
    await page.mouse.up();
    await settle(300);
  } else {
    record.notes.push("columns sash not found by id; skipped");
  }
  drainConsole(record);
}

{
  const record = scenario("reload-restores");
  await mark("scenario:reload-restores");
  await page.reload({ waitUntil: "networkidle" });
  // Geometry settles via ResizeObserver after the restore completes; wait for
  // REAL boxes — placeholder screenshots are a capture-timing artifact.
  let settled = false;
  for (let attempt = 0; attempt < 40 && !settled; attempt += 1) {
    await settle(300);
    settled = await page.evaluate(() => {
      const els = [...document.querySelectorAll("[data-group-id]")];
      return els.length >= 4 && els.every((el) => el.getBoundingClientRect().width > 100);
    });
  }
  assert(record, "restored groups reach visible geometry", settled);
  const groups = await page.$$eval("[data-group-id]", (els) => els.map((el) => el.getAttribute("data-group-id")));
  assert(record, "layout restored with extra split", groups.length >= 4, groups.join(","));
  const sparqlBox = await page.$eval(tabSelector("ontology-sparql"), (el) => el.getBoundingClientRect().width).catch(() => 0);
  assert(record, "sparql tab visibly restored", sparqlBox > 20, `w=${sparqlBox}`);
  await shot(record, "restored");
  drainConsole(record);
}

// ---- teardown: flush witness, then close context BEFORE reading the video
// path — playwright only guarantees the file after context.close().
await flushWitness();
const video = page.video();
await context.close();
if (video && VIDEO_DIR) {
  const recordedPath = await video.path();
  renameSync(recordedPath, `${VIDEO_DIR}/capture.webm`);
}
await browser.close();
writeFileSync(`${OUT}manifest.json`, JSON.stringify(manifest, null, 2));
const failures = manifest.scenarios.flatMap((s) => s.assertions.filter((a) => !a.ok).map((a) => `${s.name}: ${a.name} (${a.detail})`));
console.log(JSON.stringify({ scenarios: manifest.scenarios.length, failures }, null, 2));
console.log(failures.length === 0 ? "CAPTURE-GREEN" : `CAPTURE-FAILURES: ${failures.length}`);
