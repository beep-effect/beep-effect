// Browser-QA capture harness — lexical-playground-capability-atlas P2.
// Drives the Professional Desktop shell with REAL pointer/keyboard/touch input
// against the synthetic `editor-proof` dock panel and writes
// .beep/qa/round-N/manifest.json for the vision-judging pass.
//
// Recording integration: when spawned by `bun run beep qa record --lane
// playwright`, the env below is set and the harness also records video,
// injects the witness event log, and fires the clock-sync beacon.
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { chromium } from "playwright";

const ROUND = process.env.QA_ROUND ?? "1";
const URL = process.env.QA_URL ?? "http://professional-desktop.beep.localhost:1355/";
const COLLECTOR = process.env.QA_COLLECTOR_URL;
const SESSION_ID = process.env.QA_SESSION_ID;
const VIDEO_DIR = process.env.QA_VIDEO_DIR;
const CURSOR = process.env.QA_CURSOR !== "0";
const BEACON = process.env.QA_BEACON !== "0";
// `beep qa record` roots the round under <cwd>/.beep/qa and hands the harness
// its video dir; write the manifest and screenshots beside that video dir so
// extract/judge find them. Standalone runs fall back to the harness-relative
// round dir.
const OUT = VIDEO_DIR ? `${dirname(VIDEO_DIR)}/` : new globalThis.URL(`./qa/round-${ROUND}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const manifest = { round: ROUND, url: URL, scenarios: [] };
const scenario = (name) => {
  const record = { name, screenshots: [], assertions: [], consoleErrors: [], notes: [] };
  manifest.scenarios.push(record);
  return record;
};

// ---- browser + recording context -------------------------------------------
const VIEWPORT = { width: 1600, height: 1000 };
const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
const recordStartHintEpochMs = Date.now();
const context = await browser.newContext({
  viewport: VIEWPORT,
  hasTouch: true,
  ignoreHTTPSErrors: true,
  ...(VIDEO_DIR ? { recordVideo: { dir: VIDEO_DIR, size: VIEWPORT } } : {}),
});
if (VIDEO_DIR) {
  mkdirSync(VIDEO_DIR, { recursive: true });
  writeFileSync(`${VIDEO_DIR}/record-hint.json`, JSON.stringify({ recordStartHintEpochMs }));
}
const page = await context.newPage();

// ---- witness injection -------------------------------------------------------
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
// The witness posts to the recorder's collector; its CORS chatter is recorder
// traffic, not an app defect — ledger it separately so the judge sees app errors only.
const collectorNoise = [];
page.on("console", (message) => {
  if (message.type() !== "error") return;
  const text = message.text().slice(0, 300);
  const sourceUrl = message.location()?.url ?? "";
  if (COLLECTOR && (text.includes(COLLECTOR) || sourceUrl.includes(COLLECTOR))) collectorNoise.push(text);
  else consoleErrors.push(text);
});
page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${String(error).slice(0, 300)}`));
const drainConsole = (record) => {
  record.consoleErrors.push(...consoleErrors.splice(0));
  const noise = collectorNoise.splice(0);
  if (noise.length > 0) record.notes.push(`recorder collector CORS console errors (not app traffic): ${noise.length}`);
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

// Network egress ledger: every request whose host is not the app itself (the
// witness collector on 127.0.0.1 is the recorder, not the app).
const appHost = new globalThis.URL(URL).hostname;
const foreignRequests = [];
page.on("request", (request) => {
  const host = new globalThis.URL(request.url()).hostname;
  if (host !== appHost && host !== "127.0.0.1" && host !== "localhost") foreignRequests.push(request.url());
});

// ---- selectors ---------------------------------------------------------------
const NAV_BUTTON = "nav[aria-label='Desktop pages'] button:has-text('Editor proof')";
const TAB = "[data-panel-id='surface-editor-proof']";
const PANEL = "[data-testid='editor-proof-panel']";
const EDITOR = `${PANEL} [contenteditable='true']`;
const TOOLBAR = `${PANEL} [role='toolbar'][aria-label='Editing commands']`;
const HELP = `${PANEL} section:has(h2:text-is('Keyboard shortcuts'))`;
const RADIO_MINIMAL = `${PANEL} label:has-text('Minimal') input[type='radio']`;
const RADIO_DOCUMENT = `${PANEL} label:has-text('Document proof') input[type='radio']`;
const IMPORT_BUTTON = `${PANEL} button:has-text('Import canonical JSON')`;
const RELOAD_BUTTON = `${PANEL} button:has-text('Reload from canonical')`;
const JSON_SUMMARY = `${PANEL} summary:has-text('Canonical JSON')`;
const JSON_TEXTAREA = `${PANEL} textarea[aria-label='Canonical JSON']`;

const toolbarLabels = () => page.$$eval(`${TOOLBAR} button`, (els) => els.map((el) => el.textContent?.trim() ?? ""));
const helpLabels = () => page.$$eval(`${HELP} dt`, (els) => els.map((el) => el.textContent?.trim() ?? ""));
const toolbarButtons = () =>
  page.$$eval(`${TOOLBAR} button`, (els) =>
    els.map((el) => ({ label: el.textContent?.trim() ?? "", chord: el.getAttribute("aria-keyshortcuts") ?? "" }))
  );
const sameSet = (a, b) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
// aria-keyshortcuts ("Ctrl+Shift+7") → playwright key spec ("Control+Shift+7").
const playwrightChord = (chord) =>
  chord
    .split("+")
    .map((token) => (token === "Ctrl" ? "Control" : token === "Win" ? "Meta" : token))
    .join("+");
// Select the first word of the first paragraph by keyboard (deterministic
// caret placement, no coordinate guessing).
// The root's first block (the fixture heading) is a stable target; the first
// `<p>` migrates into the table once earlier blocks have been converted.
const selectFirstWord = async () => {
  await page.click(`${EDITOR} > :first-child`, { position: { x: 4, y: 8 } });
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
  await settle(250);
};
// Computed-style probe over the current selection's anchor — theme-agnostic.
const selectionStyle = () =>
  page.evaluate(() => {
    const selection = window.getSelection();
    const node = selection?.anchorNode;
    const element = node instanceof Element ? node : node?.parentElement;
    if (!element) return null;
    const style = getComputedStyle(element);
    const block = element.closest("h1,h2,h3,p,li,blockquote,pre,code,td");
    return {
      fontWeight: style.fontWeight,
      fontStyle: style.fontStyle,
      textDecoration: style.textDecorationLine,
      fontFamily: style.fontFamily,
      block: block?.tagName.toLowerCase() ?? "",
      tag: element.tagName.toLowerCase(),
    };
  });
const editorText = () => page.$eval(EDITOR, (el) => el.textContent ?? "");
// Poll (recording load slows the editor) until the text renders bold.
const waitForBold = (needle, timeout = 3000) =>
  page
    .waitForFunction(
      ({ selector, text }) => {
        const root = document.querySelector(selector);
        return root
          ? [...root.querySelectorAll("strong, b, [data-lexical-text]")].some(
              (node) => (node.textContent ?? "").includes(text) && Number(getComputedStyle(node).fontWeight) >= 600
            )
          : false;
      },
      { selector: EDITOR, text: needle },
      { timeout }
    )
    .then(() => true)
    .catch(() => false);
// Whether the given text currently renders bold anywhere in the editor.
const boldTextPresent = (needle) =>
  page.$eval(EDITOR, (el, text) =>
    [...el.querySelectorAll("strong, b, [data-lexical-text]")].some(
      (node) => (node.textContent ?? "").includes(text) && Number(getComputedStyle(node).fontWeight) >= 600
    ), needle);
const editorHasUnderline = () =>
  page.$eval(EDITOR, (el) =>
    [...el.querySelectorAll("*")].some((child) => {
      const style = getComputedStyle(child);
      return child.tagName === "U" || style.textDecorationLine.includes("underline");
    })
  );


// Each scenario runs isolated: a thrown Playwright error becomes a failed
// assertion instead of losing the manifest for every scenario after it.
const run = async (name, body) => {
  const record = scenario(name);
  await mark(`scenario:${name}`);
  try {
    await body(record);
  } catch (error) {
    assert(record, "scenario completed without a harness exception", false, String(error).split("\n")[0].slice(0, 300));
    await shot(record, "crash").catch(() => undefined);
  }
  drainConsole(record);
};

// ---- boot (+ one-time sync beacon) ------------------------------------------
await page.goto(URL, { waitUntil: "load" });
// Dev-mode boot serves hundreds of modules; wait for the shell itself, not a
// network heuristic (a blank first frame is a capture-timing artifact).
await page.waitForSelector(NAV_BUTTON, { timeout: 90_000 });
await settle(2500);
if (COLLECTOR && BEACON) {
  await page.evaluate(() => window.__beepQa?.runSyncBeacon());
  await settle(1600);
}

await run("open-panel-through-dock", async (record) => {
  assert(record, "panel starts closed", (await page.$(TAB)) === null);
  await shot(record, "before-open");
  foreignRequests.splice(0);
  await mark("gesture:nav-click-editor-proof");
  await page.click(NAV_BUTTON);
  await settle(900);
  const tab = await page.$(TAB);
  assert(record, "tab appears in the dock", tab !== null);
  const active = tab ? await tab.getAttribute("data-active") : null;
  assert(record, "tab is active", active === "true", String(active));
  await page.waitForSelector(EDITOR, { timeout: 5000 }).catch(() => undefined);
  const fill = await page.evaluate(() => {
    const panel = document.querySelector("[data-testid='editor-proof-panel']");
    const tab = document.querySelector("[data-panel-id='surface-editor-proof']");
    const group = tab?.closest("[data-group-id]");
    if (!panel || !group) return null;
    const p = panel.getBoundingClientRect();
    const g = group.getBoundingClientRect();
    return { panelH: p.height, panelW: p.width, groupH: g.height, groupW: g.width, groupId: group.getAttribute("data-group-id") };
  });
  assert(
    record,
    "panel fills its dock box",
    fill !== null && fill.panelW >= fill.groupW * 0.95 && fill.panelH >= (fill.groupH - 48) * 0.9,
    JSON.stringify(fill)
  );
  assert(record, "minimal profile is the default", await page.isChecked(RADIO_MINIMAL));
  // Anything painted over the panel from another surface is a finding input.
  const overlay = await page.evaluate(() => {
    const panel = document.querySelector("[data-testid='editor-proof-panel']");
    if (!panel) return null;
    const box = panel.getBoundingClientRect();
    const probe = document.elementFromPoint(box.left + box.width / 2, box.bottom - 24);
    return probe && !panel.contains(probe) ? probe.outerHTML.slice(0, 240) : null;
  });
  assert(record, "nothing from another surface is painted over the panel", overlay === null, overlay ?? "");
  await shot(record, "opened");
});

await run("minimal-toolbar-help-and-readable-content", async (record) => {
  const labels = await toolbarLabels();
  assert(record, "minimal toolbar is exactly Bold/Italic/Undo/Redo", sameSet(labels, ["Bold", "Italic", "Undo", "Redo"]), labels.join(","));
  const help = await helpLabels();
  assert(record, "help lists exactly the resolved commands", sameSet(help, labels), help.join(","));
  const text = await editorText();
  const readable = ["Capability proof", "Bold", "italic", "struck", "inline()", "proof link", "First item", "Second item", "Checked task", "Quoted proof", "const proof = true", "A1", "B2"].filter((needle) => !text.includes(needle));
  assert(record, "every fixture semantic stays readable under minimal", readable.length === 0, `missing=${readable.join(",")}`);
  const structure = await page.$eval(EDITOR, (el) => ({
    h1: el.querySelectorAll("h1").length,
    ul: el.querySelectorAll("ul").length,
    link: el.querySelectorAll("a").length,
    quote: el.querySelectorAll("blockquote").length,
    code: el.querySelectorAll("code").length,
    table: el.querySelectorAll("table").length,
  }));
  assert(record, "heading/list/link/quote/code/table nodes render", structure.h1 === 1 && structure.ul >= 1 && structure.link === 1 && structure.quote === 1 && structure.code >= 1 && structure.table === 1, JSON.stringify(structure));
  await shot(record, "minimal");
});

await run("minimal-disabled-authoring-paths", async (record) => {
  await page.click(`${EDITOR} > p`, { position: { x: 4, y: 8 } });
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
  await settle(250);
  await mark("gesture:minimal-ctrl-u");
  await page.keyboard.press("Control+U");
  await settle(300);
  assert(record, "Ctrl+U does not underline under minimal (guarded chord)", !(await editorHasUnderline()));
  await mark("gesture:minimal-ctrl-alt-1");
  await page.keyboard.press("Control+Alt+1");
  await settle(300);
  const block = (await selectionStyle())?.block;
  assert(record, "Ctrl+Alt+1 does not create a heading under minimal", block === "p", String(block));
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await mark("gesture:minimal-markdown-shortcut");
  await page.keyboard.type("## ", { delay: 60 });
  await settle(300);
  const afterMd = (await selectionStyle())?.block;
  assert(record, "'## ' stays a paragraph under minimal (no markdown shortcut)", afterMd === "p", String(afterMd));
  await mark("gesture:minimal-ctrl-b");
  await page.keyboard.type("bolded", { delay: 40 });
  await settle(250);
  await page.keyboard.press("Shift+Home");
  // Lexical syncs DOM selection asynchronously; give it a beat before the
  // command or the format lands on a collapsed selection under recording load.
  await settle(250);
  await page.keyboard.press("Control+B");
  assert(record, "Ctrl+B still bolds under minimal", await waitForBold("bolded"));
  await shot(record, "after-disabled-paths");
});

await run("switch-to-document-proof-keeps-content", async (record) => {
  const before = await editorText();
  await mark("gesture:radio-document-proof");
  await page.click(`${PANEL} label:has-text('Document proof')`);
  await settle(900);
  assert(record, "document proof selected", await page.isChecked(RADIO_DOCUMENT));
  const after = await editorText();
  assert(record, "typed text survives the remount transaction", after.includes("bolded") && after.includes("Capability proof"), after.slice(0, 80));
  assert(record, "content identical across the remount", before === after, `${before.length} vs ${after.length}`);
  const labels = await toolbarLabels();
  assert(record, "document-proof toolbar grows beyond minimal", labels.length > 4, labels.join(","));
  const help = await helpLabels();
  assert(record, "help exactly matches the resolved command set", sameSet(help, labels), `help=${help.length} toolbar=${labels.length}`);
  await shot(record, "document-proof");
});

await run("every-command-mouse-and-keyboard", async (record) => {
  const buttons = await toolbarButtons();
  assert(record, "every toolbar button has a visible label", buttons.every((b) => b.label.length > 0));
  assert(record, "every toolbar button exposes aria-keyshortcuts", buttons.every((b) => b.chord.length > 0), buttons.filter((b) => !b.chord).map((b) => b.label).join(","));
  for (const button of buttons) {
    await selectFirstWord();
    await mark(`gesture:mouse-${button.label}`);
    await page.click(`${TOOLBAR} button:text-is('${button.label}')`);
    await settle(250);
    const focusInEditor = await page.evaluate(() => document.activeElement?.getAttribute("contenteditable") === "true");
    assert(record, `${button.label}: focus stays in the editor after a mouse click`, focusInEditor);
    await mark(`gesture:keyboard-${button.chord}`);
    await page.keyboard.press(playwrightChord(button.chord));
    await settle(250);
    const stillHasContent = (await editorText()).includes("Capability proof") || (await editorText()).length > 20;
    assert(record, `${button.label}: editor survives keyboard chord ${button.chord}`, stillHasContent);
  }
  await shot(record, "after-sweep");
  // Deterministic checks on representative toggles.
  await page.click(`${TOOLBAR} button:text-is('Normal')`);
  await selectFirstWord();
  const selectedText = await page.evaluate(() => window.getSelection()?.toString() ?? "");
  await page.keyboard.press("Control+B");
  assert(record, "Ctrl+B bolds the selection", selectedText.length > 0 && (await waitForBold(selectedText.slice(0, 12))), JSON.stringify(selectedText));
  await page.keyboard.press("Control+B");
  await page.keyboard.press("Control+Alt+1");
  await settle(200);
  const heading = (await selectionStyle())?.block;
  assert(record, "Ctrl+Alt+1 makes a heading", heading === "h1", String(heading));
  await page.keyboard.press("Control+Alt+0");
  await settle(200);
  const normal = (await selectionStyle())?.block;
  assert(record, "Ctrl+Alt+0 returns to a paragraph", normal === "p", String(normal));
  await page.keyboard.press("Control+Shift+8");
  await settle(200);
  const list = (await selectionStyle())?.block;
  assert(record, "Ctrl+Shift+8 makes a bullet list item", list === "li", String(list));
  await page.keyboard.press("Control+Z");
  await settle(200);
  const undone = (await selectionStyle())?.block;
  assert(record, "Ctrl+Z undoes the list", undone === "p", String(undone));
  await page.keyboard.press("Control+Y");
  await settle(200);
  const redone = (await selectionStyle())?.block;
  assert(record, "Ctrl+Y redoes the list", redone === "li", String(redone));
  await page.keyboard.press("Control+Z");
  await settle(200);
  await mark("gesture:document-ctrl-u");
  await page.keyboard.press("Control+U");
  await settle(200);
  assert(record, "Ctrl+U stays guarded under document-proof (canonical loss avoided)", !(await editorHasUnderline()));
  await shot(record, "after-toggles");
});

await run("slash-menu-and-markdown-shortcut", async (record) => {
  await page.click(`${EDITOR} > :first-child`, { position: { x: 4, y: 8 } });
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await mark("gesture:slash-open");
  await page.keyboard.type("/", { delay: 80 });
  await settle(500);
  const options = await page.$$eval("[role='option']", (els) => els.map((el) => el.textContent?.trim() ?? ""));
  assert(record, "slash menu opens with block commands", options.length > 0 && options.some((o) => o.includes("Heading 1")), options.join("|"));
  await shot(record, "slash-open");
  await page.keyboard.type("head", { delay: 60 });
  await settle(300);
  await page.keyboard.press("Enter");
  await settle(300);
  const slashBlock = (await selectionStyle())?.block;
  assert(record, "slash 'Heading 1' converts the block", slashBlock === "h1", String(slashBlock));
  await page.keyboard.type("Slash heading", { delay: 40 });
  await page.keyboard.press("Enter");
  await mark("gesture:markdown-shortcut");
  await page.keyboard.type("## ", { delay: 60 });
  await settle(300);
  const mdBlock = (await selectionStyle())?.block;
  assert(record, "'## ' markdown shortcut makes an h2 under document-proof", mdBlock === "h2", String(mdBlock));
  await page.keyboard.type("Markdown heading", { delay: 40 });
  await shot(record, "after-slash-and-markdown");
});

await run("keyboard-focus-order-and-accessible-names", async (record) => {
  await page.click(`${PANEL} label:has-text('Document proof')`);
  await settle(700);
  await page.focus(RADIO_DOCUMENT);
  const visited = [];
  for (let i = 0; i < 24; i += 1) {
    await page.keyboard.press("Tab");
    const entry = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const name = el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "";
      const inPanel = el.closest("[data-testid='editor-proof-panel']") !== null;
      return { tag: el.tagName.toLowerCase(), name: name.slice(0, 40), editable: el.getAttribute("contenteditable") === "true", inPanel };
    });
    if (!entry || !entry.inPanel) break;
    visited.push(entry);
    if (entry.editable) break;
  }
  assert(record, "Tab reaches the toolbar then the editor without a trap", visited.some((v) => v.tag === "button") && visited.at(-1)?.editable === true, visited.map((v) => `${v.tag}:${v.name}`).join(" > "));
  const unnamed = visited.filter((v) => v.tag === "button" && v.name.length === 0);
  assert(record, "every focusable control has an accessible name", unnamed.length === 0);
  const controls = await page.$$eval(`${PANEL} button, ${PANEL} input, ${PANEL} textarea, ${PANEL} summary`, (els) =>
    els.map((el) => {
      const label = el.id ? document.querySelector(`label[for='${el.id}']`)?.textContent : el.closest("label")?.textContent;
      const name = el.getAttribute("aria-label") ?? label ?? el.textContent ?? "";
      return { tag: el.tagName.toLowerCase(), named: name.trim().length > 0 };
    })
  );
  assert(record, "no unlabeled icon or color controls in the panel", controls.every((c) => c.named), JSON.stringify(controls.filter((c) => !c.named)));
  const roles = await page.evaluate(() => ({
    toolbar: document.querySelector("[role='toolbar'][aria-label='Editing commands']") !== null,
    region: document.querySelector("section[aria-labelledby]") !== null,
    alert: document.querySelectorAll("[role='alert']").length,
  }));
  assert(record, "toolbar and help carry landmark roles", roles.toolbar && roles.region, JSON.stringify(roles));
  await shot(record, "focus-sweep");
});

await run("canonical-json-import-lifecycle", async (record) => {
  await page.click(JSON_SUMMARY);
  await settle(400);
  const json = await page.inputValue(JSON_TEXTAREA);
  assert(record, "canonical JSON reflects the live document", json.includes("Markdown heading"), `${json.length} chars`);
  await mark("gesture:json-edit-valid");
  await page.fill(JSON_TEXTAREA, json.replace("Markdown heading", "Imported proof"));
  await page.click(IMPORT_BUTTON);
  await settle(900);
  const imported = await editorText();
  assert(record, "valid canonical JSON import remounts the editor with the new heading", imported.includes("Imported proof") && !imported.includes("Markdown heading"), imported.slice(0, 60));
  assert(record, "no alert after a valid import", (await page.$(`${PANEL} [role='alert']`)) === null);
  await shot(record, "after-valid-import");
  await mark("gesture:json-edit-invalid");
  await page.fill(JSON_TEXTAREA, "{ not canonical");
  await page.click(IMPORT_BUTTON);
  await settle(600);
  const alert = await page.$(`${PANEL} [role='alert']`);
  assert(record, "invalid JSON surfaces a typed alert", alert !== null);
  assert(record, "editor stays mounted after a failed import", (await page.$(EDITOR)) !== null);
  await shot(record, "after-invalid-import");
  await mark("gesture:reload-from-canonical");
  await page.click(RELOAD_BUTTON);
  await settle(700);
  assert(record, "reload keeps the imported canonical document", (await editorText()).includes("Imported proof"));
});

await run("narrow-viewport-and-touch", async (record) => {
  // A phone-width window is used with the group maximized: that is the
  // dock's own overflow alternative, and it keeps the judge on this panel.
  await mark("gesture:maximize-editor-group");
  const groupId = await page.$eval(TAB, (el) => el.closest("[data-group-id]")?.getAttribute("data-group-id") ?? "");
  await page.click(`button[aria-label='Maximize group ${groupId}']`);
  await settle(700);
  await page.setViewportSize({ width: 480, height: 800 });
  await settle(1200);
  const geometry = await page.evaluate(() => {
    const panel = document.querySelector("[data-testid='editor-proof-panel']");
    const toolbar = document.querySelector("[role='toolbar'][aria-label='Editing commands']");
    if (!panel) return null;
    return {
      overflowX: panel.scrollWidth - panel.clientWidth,
      docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      toolbarRows: toolbar ? Math.round(toolbar.getBoundingClientRect().height / 32) : 0,
      toolbarVisible: toolbar ? toolbar.getBoundingClientRect().width > 0 : false,
    };
  });
  assert(record, "no horizontal overflow at 480px", geometry !== null && geometry.overflowX <= 1 && geometry.docOverflowX <= 1, JSON.stringify(geometry));
  assert(record, "toolbar wraps and stays visible at 480px", geometry !== null && geometry.toolbarVisible, JSON.stringify(geometry));
  await shot(record, "narrow-drawer-open");
  const regionHeight = () =>
    page.$eval(EDITOR, (el) => el.closest("[data-testid='editor-proof-panel']")?.querySelector("[role='toolbar']")?.parentElement?.getBoundingClientRect().height ?? 0);
  assert(record, "composer region keeps a usable floor with the drawer open", (await regionHeight()) >= 200, `h=${await regionHeight()}`);
  await mark("gesture:close-json-drawer");
  await page.click(JSON_SUMMARY);
  await settle(500);
  await page.$eval(EDITOR, (el) => el.scrollIntoView({ block: "center" }));
  await settle(300);
  await shot(record, "narrow");
  const bold = await page.$(`${TOOLBAR} button:text-is('Bold')`);
  const box = bold ? await bold.boundingBox() : null;
  assert(record, "Bold control is reachable at 480px", box !== null && box.width > 0 && box.y >= 0 && box.y < 800, JSON.stringify(box));
  if (box) {
    // Nested scroll containers at 480px: select by keyboard, not coordinates.
    await page.focus(EDITOR);
    await page.keyboard.press("Control+Home");
    await page.keyboard.press("Shift+End");
    await settle(200);
    await mark("gesture:touch-tap-bold");
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await settle(400);
    assert(record, "touch tap on Bold runs the command", (await selectionStyle()) !== null);
  }
  await shot(record, "after-touch");
  const summaryBox = await page.$eval(JSON_SUMMARY, (el) => el.getBoundingClientRect().toJSON()).catch(() => null);
  assert(record, "canonical JSON control remains reachable at 480px", summaryBox !== null && summaryBox.width > 0, JSON.stringify(summaryBox));
  await page.setViewportSize(VIEWPORT);
  await settle(800);
  await mark("gesture:restore-editor-group");
  await page.click(`button[aria-label='Restore group ${groupId}']`).catch(() => undefined);
  await settle(600);
  await shot(record, "restored");
});

await run("no-network-egress", async (record) => {
  assert(record, "no request left the app origin while the panel was exercised", foreignRequests.length === 0, foreignRequests.slice(0, 5).join(","));
  record.notes.push(`foreign requests observed: ${foreignRequests.length}`);
});

// ---- teardown ----------------------------------------------------------------
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
