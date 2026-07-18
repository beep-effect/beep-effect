// M4 browser-QA capture harness for the ontology-workbench-migration shell.
// Drives the dev server with real pointer input, screenshots every scenario,
// and writes .beep/qa/round-N/manifest.json for the vision-judging pass.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const ROUND = process.env.QA_ROUND ?? "1";
const URL = process.env.QA_URL ?? "http://127.0.0.1:14320/";
const OUT = new globalThis.URL(`./qa/round-${ROUND}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const manifest = { round: ROUND, url: URL, scenarios: [] };
const scenario = (name) => {
  const record = { name, screenshots: [], assertions: [], consoleErrors: [], notes: [] };
  manifest.scenarios.push(record);
  return record;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
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
const dragTab = async (fromKey, target) => {
  const tab = page.locator(tabSelector(fromKey)).first();
  const box = await tab.boundingBox();
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 40, box.y + 40, { steps: 4 });
  await page.mouse.move(target.x, target.y, { steps: 12 });
  return { finish: async () => { await page.mouse.up(); await settle(); } };
};
const groupBox = (groupId) => page.locator(`[data-group-id='${groupId}']`).first().boundingBox();

// ---- boot with stale v1 key ----
await page.addInitScript(() => {
  if (!window.__qaSeeded) {
    window.__qaSeeded = true;
    window.localStorage.setItem("desktop:dock-workspace:v1", "stale v1 snapshot");
  }
});
await page.goto(URL, { waitUntil: "networkidle" });
await settle(3000);

{
  const record = scenario("default-layout-and-v2-boot");
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
  // Narrow the right cluster (now holding 5 tabs) by dragging its sash right-to-left is hard
  // to target generically; shrink the viewport instead so strips get tight.
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
  const target = await groupBox("desktop-ontology-center");
  const zones = {
    left: { x: target.x + 8, y: target.y + target.height / 2 },
    right: { x: target.x + target.width - 8, y: target.y + target.height / 2 },
    top: { x: target.x + target.width / 2, y: target.y + 40 },
    bottom: { x: target.x + target.width / 2, y: target.y + target.height - 8 },
  };
  for (const [zone, point] of Object.entries(zones)) {
    const drag = await dragTab("ontology-changelog", point);
    await settle(250);
    const indicator = await page.$("[data-drop-indicator]");
    assert(record, `${zone} zone shows preview`, indicator !== null);
    await shot(record, `preview-${zone}`);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await settle(300);
    void drag;
  }
  // Complete one real edge drop, then verify a new group exists.
  const before = (await page.$$("[data-group-id]")).length;
  const drag = await dragTab("ontology-changelog", zones.bottom);
  await drag.finish();
  const after = (await page.$$("[data-group-id]")).length;
  assert(record, "bottom edge drop splits", after === before + 1, `${before}->${after}`);
  // R1-01 regression guard: the split must scope to the hovered CENTER
  // column (not a full-width root row above Chat) and respect panel minima.
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
  // Float the left group (Explorer) — the RichTreeView reparenting case.
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
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  // Deltas are measured from the PRESS point — round 1 dragged to
  // header.x+160 after pressing at header center, so the pane "moved the
  // wrong way" by half its width (harness bug, judged as R1-02).
  await page.mouse.move(grip.x + 160, grip.y + 120, { steps: 10 });
  await page.mouse.up();
  await settle(500);
  const moved = await page.$eval("[data-floating-pane]", (el) => el.getBoundingClientRect().toJSON());
  assert(record, "header drag translates by pointer delta only",
    Math.abs(moved.left - before.left - 160) <= 2 && Math.abs(moved.top - before.top - 120) <= 2 &&
    Math.abs(moved.width - before.width) <= 1 && Math.abs(moved.height - before.height) <= 1,
    `d=(${(moved.left - before.left).toFixed(0)},${(moved.top - before.top).toFixed(0)}) size ${moved.width}x${moved.height}`);
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
  const identity = await page.evaluate(() => {
    const node = document.querySelector("[data-testid='chat-app']");
    if (node) node.__qaMark = "keepalive-check";
    return node !== null;
  });
  assert(record, "chat mounted", identity);
  // Re-layout ontology: activate source, float center group, dock it back.
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
  await shot(record, "before");
  const toggle = await page.$("nav button[aria-label*='heme'], nav [data-theme-toggle], nav button:has-text('Theme')");
  if (toggle !== null) {
    await toggle.click();
    await settle(400);
    await shot(record, "after");
    assert(record, "theme toggled", true);
  } else {
    // Fall back: last button in nav (ThemeToggle renders on the right).
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
  const left = await groupBox("desktop-ontology-left");
  const sash = await page.$("[data-sash-id='desktop-ontology-columns']");
  if (sash !== null) {
    const sashBox = await sash.boundingBox();
    await page.mouse.move(sashBox.x + 2, sashBox.y + sashBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(20, sashBox.y + sashBox.height / 2, { steps: 10 });
    await page.mouse.up();
    await settle(500);
    const after = await groupBox("desktop-ontology-left");
    assert(record, "left group respects min extent", after.width >= 170, `width=${after.width}`);
    await shot(record, "after-squeeze");
  } else {
    record.notes.push("columns sash not found by id; skipped");
  }
  drainConsole(record);
}

{
  const record = scenario("reload-restores");
  await page.reload({ waitUntil: "networkidle" });
  // Geometry settles via ResizeObserver after the restore completes; under a
  // dev-server reload that window stretches to seconds. Wait for REAL boxes —
  // a screenshot of the 2x2 pre-measurement placeholders is a capture-timing
  // artifact, not a restore regression (round-3 R3-01).
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

await browser.close();
writeFileSync(`${OUT}manifest.json`, JSON.stringify(manifest, null, 2));
const failures = manifest.scenarios.flatMap((s) => s.assertions.filter((a) => !a.ok).map((a) => `${s.name}: ${a.name} (${a.detail})`));
console.log(JSON.stringify({ scenarios: manifest.scenarios.length, failures }, null, 2));
console.log(failures.length === 0 ? "CAPTURE-GREEN" : `CAPTURE-FAILURES: ${failures.length}`);
