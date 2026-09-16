// Browser-QA capture harness for the Todox product site (Evergreen Ledger
// world). Drives the portless dev server with REAL keyboard and pointer input
// and writes .beep/qa/round-N/manifest.json for the vision-judging pass.
// Spawned by `bun run beep qa record --lane playwright --app todox --round N`.
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const ROUND = process.env.QA_ROUND ?? "1";
const URL = process.env.QA_URL ?? "https://todox.beep.localhost:1355/";
const COLLECTOR = process.env.QA_COLLECTOR_URL;
const SESSION_ID = process.env.QA_SESSION_ID;
const VIDEO_DIR = process.env.QA_VIDEO_DIR;
const CURSOR = process.env.QA_CURSOR !== "0";
const BEACON = process.env.QA_BEACON !== "0";
const OUT = new globalThis.URL(`./qa/round-${ROUND}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const manifest = { round: ROUND, url: URL, scenarios: [] };
const scenario = (name) => {
  const record = { name, screenshots: [], assertions: [], consoleErrors: [], notes: [] };
  manifest.scenarios.push(record);
  return record;
};

const VIEWPORT = { width: 1440, height: 1000 };
const browser = await chromium.launch();
const recordStartHintEpochMs = Date.now();
const context = await browser.newContext({
  viewport: VIEWPORT,
  ignoreHTTPSErrors: true,
  ...(VIDEO_DIR ? { recordVideo: { dir: VIDEO_DIR, size: VIEWPORT } } : {}),
});
if (VIDEO_DIR) {
  mkdirSync(VIDEO_DIR, { recursive: true });
  writeFileSync(`${VIDEO_DIR}/record-hint.json`, JSON.stringify({ recordStartHintEpochMs }));
}
const page = await context.newPage();

if (COLLECTOR) {
  const witnessSource = await (await fetch(`${COLLECTOR}/witness.js`)).text();
  const config = { collectorUrl: COLLECTOR, sessionId: SESSION_ID ?? `round-${ROUND}`, cursor: CURSOR, beacon: false };
  await page.addInitScript({ content: `window.__BEEP_QA__ = ${JSON.stringify(config)};\n${witnessSource}` });
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
const shot = async (record, label, options = {}) => {
  const file = `${record.name}--${label}.png`;
  await page.screenshot({ path: `${OUT}${file}`, ...options });
  record.screenshots.push(file);
};
const assert = (record, name, ok, detail = "") => {
  record.assertions.push({ name, ok, detail });
};
const settle = (ms = 700) => page.waitForTimeout(ms);
const activeRow = () =>
  page.evaluate(() => {
    const el = document.activeElement;
    return el instanceof HTMLElement ? (el.getAttribute("data-row") ?? el.tagName) : null;
  });
const expandedRows = () =>
  page.$$eval("[data-inspector-list='demo'] button[data-row][aria-expanded='true']", (els) =>
    els.map((el) => el.getAttribute("data-row"))
  );
const overflowers = () =>
  page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    document.querySelectorAll("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      // wide content that scrolls inside its own overflow-x container is by design (repo law)
      if (el.closest("[data-scroll-x]") !== null && !el.hasAttribute("data-scroll-x")) return;
      if (el.closest("nextjs-portal") !== null) return; // dev overlay, not page content
      // the QA witness cursor ring: a fixed, unmarked div at the last pointer position (pink #ff2d92)
      if (el.parentElement === document.body && el.tagName === "DIV") {
        const style = el.getAttribute("style") ?? "";
        if (style.includes("ff2d92") || style.includes("255, 45, 146")) return;
      }
      if (r.right > vw + 0.5 && r.width > 0) out.push(`${el.className || el.tagName}:${Math.round(r.right)}`);
    });
    return out.slice(0, 8);
  });
const scrollTo = (selector) =>
  page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ behavior: "instant", block: "start" }), selector);

await page.goto(URL, { waitUntil: "networkidle" });
await settle(2200); // let the graph draw
if (COLLECTOR && BEACON) {
  await page.evaluate(() => window.__beepQa?.runSyncBeacon());
  await settle(1600);
}

{
  const record = scenario("hero-first-viewport");
  await mark("scenario:hero-first-viewport");
  const h1 = await page.$eval("h1", (el) => el.textContent ?? "");
  assert(record, "headline present", h1.includes("The AI runtime your firm actually controls."), h1);
  const cta = await page.$eval(".hero .button--glow", (el) => el.getBoundingClientRect().bottom);
  assert(record, "primary CTA inside the first viewport", cta <= 1000, `bottom=${cta}`);
  const graph = await page.$eval(".graph", (el) => el.getBoundingClientRect().width);
  assert(record, "evidence graph rendered", graph > 300, `w=${graph}`);
  const contract = await page.evaluate(() =>
    (document.querySelector("[data-direction-contract]")?.innerHTML ?? "").includes("evergreen-ledger")
  );
  assert(record, "direction contract in the body", contract);
  await shot(record, "first-viewport");
  drainConsole(record);
}

{
  const record = scenario("evidence-graph-interaction");
  await mark("scenario:evidence-graph");
  const detailDefault = await page.$eval(".graph-detail", (el) => el.textContent ?? "");
  assert(record, "graph opens on the core claim", detailDefault.includes("CLM 0101"), detailDefault.slice(0, 60));
  const target = page.locator("[data-node='superseded']");
  const box = await target.boundingBox();
  await mark("gesture:hover-superseded");
  await page.mouse.move(box.x - 60, box.y + box.height / 2, { steps: 10 });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 24 });
  await settle(500);
  const hoverActive = await page.$$eval(".graph__edge[data-active='true']", (els) => els.length);
  assert(record, "hover lights the node's two edges", hoverActive === 2, `active=${hoverActive}`);
  await shot(record, "hover-superseded", { clip: { x: 760, y: 80, width: 640, height: 720 } });
  await mark("gesture:click-superseded");
  await page.mouse.down();
  await settle(120);
  await page.mouse.up();
  await settle(500);
  const detail = await page.$eval(".graph-detail", (el) => el.textContent ?? "");
  assert(
    record,
    "click selects CLM 0099 and shows SUPERSEDED",
    detail.includes("CLM 0099") && detail.includes("SUPERSEDED"),
    detail.slice(0, 80)
  );
  await shot(record, "selected-superseded", { clip: { x: 760, y: 80, width: 640, height: 720 } });
  await mark("gesture:tab-to-brief-enter");
  await page.mouse.move(20, 400, { steps: 8 });
  await page.keyboard.press("Tab");
  await settle(300);
  await page.keyboard.press("Enter");
  await settle(500);
  const pressed = await page.evaluate(() => document.activeElement?.getAttribute("data-node") ?? "");
  const detailAfterKey = await page.$eval(".graph-detail", (el) => el.textContent ?? "");
  assert(
    record,
    "Tab then Enter selects the next node",
    pressed === "brief" && detailAfterKey.includes("PKT 0501"),
    `${pressed} :: ${detailAfterKey.slice(0, 40)}`
  );
  await shot(record, "keyboard-brief", { clip: { x: 760, y: 80, width: 640, height: 720 } });
  await page.mouse.move(400, 900, { steps: 8 });
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await settle(300);
  drainConsole(record);
}

{
  const record = scenario("nav-anchors-and-sections");
  await mark("scenario:nav-anchors");
  const links = await page.$$eval("nav[aria-label='Sections'] a", (els) =>
    els.map((a) => a.getAttribute("href") ?? "")
  );
  assert(record, "five section links", links.length === 5, links.join(","));
  for (const href of links) {
    const target = await page.$(href);
    assert(record, `${href} resolves`, target !== null);
  }
  await mark("gesture:click-how-it-works");
  const link = page.locator("nav[aria-label='Sections'] a", { hasText: "How it works" });
  const box = await link.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 16 });
  await settle(300);
  await page.mouse.down();
  await page.mouse.up();
  await settle(800);
  const top = await page.evaluate(() =>
    Math.round(document.querySelector("#how-it-works")?.getBoundingClientRect().top ?? -1)
  );
  assert(record, "anchor scroll lands below the sticky nav", top >= 0 && top <= 96, `top=${top}`);
  await shot(record, "after-anchor");
  drainConsole(record);
}

{
  const record = scenario("session-demo-keyboard-and-pointer");
  await mark("scenario:session-demo");
  await scrollTo("[data-session-demo]");
  await settle(500);
  const focal = await expandedRows();
  assert(record, "demo opens on the rejected candidate", focal.includes("demo:CLM 0104"), focal.join(","));
  await shot(record, "default-open");
  await page.focus("[data-inspector-list='demo'] button[data-row]");
  await settle(300);
  await mark("gesture:arrow-down-x3");
  for (let step = 0; step < 3; step += 1) {
    await page.keyboard.press("ArrowDown");
    await settle(600);
  }
  assert(record, "ArrowDown x3 lands on TSK 0202", (await activeRow()) === "demo:TSK 0202", String(await activeRow()));
  await mark("gesture:enter-opens");
  await page.keyboard.press("Enter");
  await settle(800);
  const opened = await expandedRows();
  assert(
    record,
    "Enter opens exactly the addressed record",
    opened.length === 1 && opened[0] === "demo:TSK 0202",
    opened.join(",")
  );
  const producer = await page.$eval("#demo-inspector dd[data-field='producer']", (el) => el.textContent ?? "");
  assert(record, "receipt names the deterministic producer", producer.includes("NO LIVE MODEL"), producer);
  await shot(record, "inspector-open-tsk-0202");
  await mark("gesture:escape-closes");
  await page.keyboard.press("Escape");
  await settle(700);
  assert(record, "Escape closes the inspector", (await expandedRows()).length === 0);
  const target = page.locator("button[data-row='demo:WHAT CHANGED:0']");
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  await mark("gesture:pointer-click-what-changed");
  await page.mouse.move(box.x + 8, box.y + box.height / 2, { steps: 20 });
  await settle(400);
  await page.mouse.down();
  await settle(120);
  await page.mouse.up();
  await settle(800);
  const clicked = await expandedRows();
  assert(
    record,
    "click opens the WHAT CHANGED entry",
    clicked.length === 1 && clicked[0] === "demo:WHAT CHANGED:0",
    clicked.join(",")
  );
  const lit = await page.$eval("#demo-inspector [data-span='S2']", (el) => el.classList.contains("span--lit"));
  assert(record, "inspector lights span S2", lit);
  await shot(record, "after-click");
  drainConsole(record);
}

{
  const record = scenario("faq-and-form");
  await mark("scenario:faq-and-form");
  await scrollTo("#faq");
  await settle(500);
  const summary = page.locator("#faq details:nth-of-type(2) summary");
  const box = await summary.boundingBox();
  await mark("gesture:open-faq-2");
  await page.mouse.move(box.x + 20, box.y + box.height / 2, { steps: 16 });
  await page.mouse.down();
  await page.mouse.up();
  await settle(500);
  const open = await page.$eval("#faq details:nth-of-type(2)", (el) => el.hasAttribute("open"));
  assert(record, "second FAQ opens on click", open);
  await shot(record, "faq-open");
  await scrollTo("#request-demo");
  await settle(500);
  const action = await page.$eval("form[data-wiring='pending']", (el) => el.getAttribute("action"));
  assert(record, "form posts to the placeholder action", action === "/api/request-demo", String(action));
  await page.focus("#demo-name");
  await page.keyboard.type("Sample Advisor", { delay: 40 });
  const typed = await page.$eval("#demo-name", (el) => el.value);
  assert(record, "name field accepts typing", typed === "Sample Advisor", typed);
  await shot(record, "form");
  await page.fill("#demo-firm", "Sample Firm");
  await page.fill("#demo-email", "sample@example.test");
  await mark("gesture:submit-held");
  const submit = page.locator("form[data-wiring='pending'] button[type='submit']");
  const sbox = await submit.boundingBox();
  await page.mouse.move(sbox.x + sbox.width / 2, sbox.y + sbox.height / 2, { steps: 16 });
  await page.mouse.down();
  await settle(120);
  await page.mouse.up();
  await settle(500);
  const held = await page.$eval("[data-form-held]", (el) => el.textContent ?? "").catch(() => "");
  assert(
    record,
    "submit is held on the page with the honest status",
    held.includes("nothing was sent"),
    held.slice(0, 60)
  );
  assert(
    record,
    "submit stays on the page",
    page.url().includes("#request-demo") || !page.url().includes("/api/"),
    page.url()
  );
  await shot(record, "form-held");
  drainConsole(record);
}

{
  const record = scenario("printable-sections-desktop");
  await mark("scenario:sections-desktop");
  for (const id of ["product", "skills", "why-todox", "trust"]) {
    await scrollTo(`#${id}`);
    await settle(500);
    await shot(record, `${id}-top`);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await settle(400);
  await shot(record, "full-page-1440", { fullPage: true });
  drainConsole(record);
}

{
  const record = scenario("mobile-360");
  await mark("scenario:mobile-360");
  await page.setViewportSize({ width: 360, height: 780 });
  await settle(1500); // container queries and the sticky nav re-lay out after the resize
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await settle(600);
  const over = await overflowers();
  assert(record, "no horizontal overflow at 360px", over.length === 0, over.join(" | "));
  const delta = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(record, "document not wider than the viewport", delta <= 0, `delta=${delta}`);
  await shot(record, "hero-360");
  await scrollTo("[data-session-demo]");
  await settle(500);
  await shot(record, "demo-360");
  await scrollTo("#why-todox");
  await settle(500);
  await shot(record, "compare-360");
  await scrollTo("#request-demo");
  await settle(500);
  await shot(record, "form-360");
  await page.setViewportSize(VIEWPORT);
  await settle(600);
  drainConsole(record);
}

{
  const record = scenario("reduced-motion-and-no-js");
  await mark("scenario:reduced-motion-no-js");
  try {
    const reduced = await browser.newContext({ viewport: VIEWPORT, ignoreHTTPSErrors: true, reducedMotion: "reduce" });
    const rmPage = await reduced.newPage();
    await rmPage.goto(URL, { waitUntil: "load" });
    await rmPage.waitForTimeout(250);
    const rmFile = `${record.name}--reduced-motion-at-load.png`;
    await rmPage.screenshot({ path: `${OUT}${rmFile}`, timeout: 20000 });
    record.screenshots.push(rmFile);
    const animations = await rmPage.evaluate(() => document.getAnimations().length);
    assert(record, "no running animations under reduced motion", animations === 0, `animations=${animations}`);
    await reduced.close();
  } catch (error) {
    assert(record, "reduced-motion capture completed", false, String(error).slice(0, 200));
  }
  try {
    const noJs = await browser.newContext({ viewport: VIEWPORT, ignoreHTTPSErrors: true, javaScriptEnabled: false });
    const njPage = await noJs.newPage();
    await njPage.goto(URL, { waitUntil: "load" });
    await njPage.waitForTimeout(250);
    const receipts = await njPage.$$eval("dd[data-field='producer']", (els) => els.length);
    const rows = await njPage.$$eval("button[data-row]", (els) => els.length);
    const graphDetail = await njPage.$eval(".graph-detail", (el) => el.textContent ?? "");
    assert(record, "no-JS: the default receipt renders statically", receipts === 1, `receipts=${receipts}`);
    assert(record, "no-JS: every record row renders", rows >= 11, `rows=${rows}`);
    assert(
      record,
      "no-JS: the graph detail shows the core claim",
      graphDetail.includes("CLM 0101"),
      graphDetail.slice(0, 40)
    );
    await njPage.evaluate(() => document.querySelector("[data-session-demo]")?.scrollIntoView());
    const njFile = `${record.name}--no-js-demo.png`;
    await njPage.screenshot({ path: `${OUT}${njFile}`, timeout: 20000 });
    record.screenshots.push(njFile);
    await noJs.close();
  } catch (error) {
    assert(record, "no-JS capture completed", false, String(error).slice(0, 200));
  }
  drainConsole(record);
}

await flushWitness();
const video = page.video();
await context.close();
if (video && VIDEO_DIR) {
  const recordedPath = await video.path();
  renameSync(recordedPath, `${VIDEO_DIR}/capture.webm`);
}
await browser.close();
writeFileSync(`${OUT}manifest.json`, JSON.stringify(manifest, null, 2));
const failures = manifest.scenarios.flatMap((s) =>
  s.assertions.filter((a) => !a.ok).map((a) => `${s.name}: ${a.name} (${a.detail})`)
);
console.log(JSON.stringify({ scenarios: manifest.scenarios.length, failures }, null, 2));
console.log(failures.length === 0 ? "CAPTURE-GREEN" : `CAPTURE-FAILURES: ${failures.length}`);
process.exitCode = failures.length === 0 ? 0 : 1;
