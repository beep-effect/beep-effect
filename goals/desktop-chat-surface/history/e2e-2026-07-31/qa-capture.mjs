// Full-UI E2E evidence pass for the professional-desktop chat surface
// (desktop-chat-surface Exception Ledger closure). Real Anthropic kernel:
// create thread → send rich message → streamed turn → cancel-in-flight →
// edit-as-branch + version selector → reload persistence.
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const ROUND = process.env.QA_ROUND ?? "1";
const URL = process.env.QA_URL ?? "http://professional-desktop.beep.localhost:1355/";
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

const VIEWPORT = { width: 1600, height: 1000 };
const browser = await chromium.launch();
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

if (COLLECTOR) {
  const witnessSource = await (await fetch(`${COLLECTOR}/witness.js`)).text();
  const config = {
    collectorUrl: COLLECTOR,
    sessionId: SESSION_ID ?? `round-${ROUND}`,
    cursor: CURSOR,
    beacon: false,
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

const tid = (id) => `[data-testid='${id}']`;
const count = (id) => page.locator(tid(id)).count();
const composerEditor = () => page.locator(`${tid("composer")} [contenteditable='true']`).first();
// Slow typing = frame density for extraction; avoid "/" and "@" (menu triggers).
const typeIntoComposer = async (text) => {
  await composerEditor().click();
  await settle(300);
  await page.keyboard.type(text, { delay: 25 });
};
const waitGone = (id, timeout) =>
  page
    .waitForSelector(tid(id), { state: "detached", timeout })
    .then(() => true)
    .catch(() => false);
const waitFor = (id, timeout) =>
  page
    .waitForSelector(tid(id), { state: "visible", timeout })
    .then(() => true)
    .catch(() => false);

// ---- boot (+ one-time sync beacon) ----
// Warm-up visit: vite's first-load dependency optimization forces a full page
// reload seconds after boot, which destroys in-flight evaluate contexts. Visit,
// let the optimize-reload happen, then navigate fresh for the recorded run.
await page.goto(URL, { waitUntil: "load" });
await settle(6000);
await page.goto(URL, { waitUntil: "load" });
await settle(4000);
if (COLLECTOR && BEACON) {
  await page.evaluate(() => window.__beepQa?.runSyncBeacon()).catch(() => {});
  await settle(1600);
}

const scenarios = async () => {
  {
    const record = scenario("boot-chat-surface");
    await mark("scenario:boot-chat-surface");
    assert(record, "chat app mounted", await waitFor("chat-app", 20000));
    await shot(record, "boot");
    drainConsole(record);
  }

  {
    const record = scenario("create-thread");
    await mark("scenario:create-thread");
    const before = await count("sidebar-item");
    const createButton =
      (await page.locator(tid("chat-no-thread-create")).count()) > 0 ? "chat-no-thread-create" : "sidebar-new";
    await page.locator(tid(createButton)).first().click();
    await settle(1200);
    const after = await count("sidebar-item");
    assert(record, "thread row appears in sidebar", after === before + 1, `${before}->${after}`);
    assert(record, "composer visible for new thread", await waitFor("composer", 10000));
    await shot(record, "thread-created");
    drainConsole(record);
  }

  {
    const record = scenario("send-rich-message-streams-blocks");
    await mark("scenario:send-rich-message");
    await typeIntoComposer(
      "Explain what a schema-first codebase is in one short paragraph, then a two-item bullet list of benefits, then a tiny TypeScript code example."
    );
    await shot(record, "composed");
    await mark("gesture:send-enter");
    await page.keyboard.press("Enter");
    const userRendered = await page
      .waitForSelector("[data-testid='turn-user'], [data-testid='turn-streaming-user']", {
        state: "visible",
        timeout: 15000,
      })
      .then(() => true)
      .catch(() => false);
    assert(record, "user turn renders (optimistic or reconciled)", userRendered);
    const streamingSeen = await waitFor("turn-streaming", 30000);
    assert(record, "assistant streaming state renders", streamingSeen);
    assert(record, "stop control renders while streaming", await waitFor("turn-stop", 15000));
    await shot(record, "streaming-early");
    await settle(2500); // hold: extraction needs mid-stream frames of block-by-block render
    await shot(record, "streaming-mid");
    const finalized = await waitGone("turn-streaming", 120000);
    assert(record, "turn finalizes (streaming state clears)", finalized);
    assert(
      record,
      "assistant turn persisted in timeline",
      (await count("turn-assistant")) === 1,
      `assistant=${await count("turn-assistant")}`
    );
    await shot(record, "finalized");
    drainConsole(record);
  }

  {
    const record = scenario("cancel-in-flight-leaves-no-partial");
    await mark("scenario:cancel-in-flight");
    await typeIntoComposer(
      "Now write a very long, detailed essay about the history of typed functional programming, at least 1500 words, with many sections."
    );
    await mark("gesture:send-then-stop");
    await page.keyboard.press("Enter");
    const streaming = await waitFor("turn-streaming", 30000);
    assert(record, "second turn streams", streaming);
    await waitFor("turn-stop", 15000);
    await settle(400); // brief real-token window; click while unmistakably mid-flight
    await shot(record, "streaming-before-stop");
    await mark("gesture:click-stop");
    await page.locator(tid("turn-stop")).first().click();
    await settle(1500);
    assert(record, "streaming state clears on stop", await waitGone("turn-streaming", 15000));
    // Contract: cancel persists ONLY a stopped marker — no partial model content.
    const assistants = await count("turn-assistant");
    const lastAssistantText = ((await page.locator(tid("turn-assistant")).last().textContent()) ?? "").trim();
    assert(
      record,
      "cancelled turn persists only the stopped marker",
      assistants === 2 && lastAssistantText.includes("stopped"),
      `assistant=${assistants} last="${lastAssistantText.slice(0, 80)}"`
    );
    assert(
      record,
      "no partial model content in cancelled turn",
      lastAssistantText.replace(/\s+/g, " ").length < 40,
      `len=${lastAssistantText.length}`
    );
    const users = await count("turn-user");
    assert(record, "cancelled user message retained", users === 2, `user=${users}`);
    await shot(record, "after-stop");
    drainConsole(record);
  }

  {
    const record = scenario("edit-as-branch-version-selector");
    await mark("scenario:edit-as-branch");
    // Edit the LAST user turn: version-selector renders only for turns with a
    // parent (root turns have no parentTurnId, so root branches show no selector).
    await page.locator(tid("turn-edit")).last().click();
    await settle(800);
    const editingBanner = await page.getByText("Editing message", { exact: false }).count();
    assert(record, "edit mode banner shows", editingBanner > 0);
    await shot(record, "editing");
    await composerEditor().click();
    await page.keyboard.press("Control+a");
    await settle(200);
    await page.keyboard.type("Instead, reply with exactly one short haiku about schemas.", { delay: 25 });
    await shot(record, "edited-content");
    await mark("gesture:rewrite-enter");
    await page.keyboard.press("Enter");
    const streamed = await waitFor("turn-streaming", 30000);
    assert(record, "rewrite streams a new turn", streamed);
    assert(record, "rewrite finalizes", await waitGone("turn-streaming", 120000));
    assert(record, "version selector appears on branched turn", await waitFor("turn-versions", 10000));
    await shot(record, "branched");
    drainConsole(record);
  }

  {
    const record = scenario("reload-history-intact");
    await mark("scenario:reload-history-intact");
    const beforeCounts = { user: await count("turn-user"), assistant: await count("turn-assistant") };
    await page.reload({ waitUntil: "networkidle" });
    await settle(2500);
    if ((await count("turn-user")) === 0 && (await count("sidebar-item")) > 0) {
      await page.locator(tid("sidebar-item")).first().click();
      await settle(1500);
    }
    assert(record, "thread renders after reload", await waitFor("thread", 20000));
    // Scroll to the newest turn and hold — the restored view must show the
    // REWRITTEN branch's content (the haiku), proving reload does not resurrect
    // the superseded branch (frames document this for the vision judge).
    await page.locator(tid("thread")).evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await settle(1200);
    const bottomText = ((await page.locator(tid("thread")).textContent()) ?? "").replace(/\s+/g, " ");
    assert(
      record,
      "reload restores the rewritten branch (haiku visible, no essay/stopped tail)",
      bottomText.includes("haiku about schemas") && !bottomText.includes("(stopped)"),
      bottomText.slice(-160)
    );
    await shot(record, "restored-bottom");
    const afterCounts = { user: await count("turn-user"), assistant: await count("turn-assistant") };
    assert(
      record,
      "turn counts survive reload",
      afterCounts.user === beforeCounts.user && afterCounts.assistant === beforeCounts.assistant,
      `before=${JSON.stringify(beforeCounts)} after=${JSON.stringify(afterCounts)}`
    );
    assert(record, "version selector persists across reload", await waitFor("turn-versions", 10000));
    assert(record, "no decode failures after reload", (await count("message-decode-failure")) === 0);
    await shot(record, "restored");
    drainConsole(record);
  }
};

let harnessError = null;
try {
  await scenarios();
} catch (error) {
  harnessError = String(error).slice(0, 500);
}
await flushWitness();
const video = page.video();
await context.close();
if (video && VIDEO_DIR) {
  const recordedPath = await video.path();
  renameSync(recordedPath, `${VIDEO_DIR}/capture.webm`);
}
await browser.close();
if (harnessError !== null) {
  const record = scenario("harness-error");
  record.assertions.push({ name: "harness completed", ok: false, detail: harnessError });
}
writeFileSync(`${OUT}manifest.json`, JSON.stringify(manifest, null, 2));
const failures = manifest.scenarios.flatMap((s) =>
  s.assertions.filter((a) => !a.ok).map((a) => `${s.name}: ${a.name} (${a.detail})`)
);
console.log(JSON.stringify({ scenarios: manifest.scenarios.length, failures }, null, 2));
console.log(failures.length === 0 ? "CAPTURE-GREEN" : `CAPTURE-FAILURES: ${failures.length}`);
process.exitCode = failures.length === 0 ? 0 : 1;
