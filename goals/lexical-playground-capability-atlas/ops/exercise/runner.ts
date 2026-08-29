/* biome-ignore-all lint/suspicious/noConsole: This CLI prints its inventory, progress, and terminal result. */
import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as Str from "effect/String";
import stableStringify from "fast-json-stable-stringify";
import { chromium } from "playwright-core";
import { allScenarios, scenarioGroups } from "./scenarios/index.ts";
import type { Browser, BrowserContext, Download, Locator, Page } from "playwright-core";
import type { LocatorSpec, Scenario, Step } from "./scenarios/dsl.ts";

type Outcome = "fail" | "pass" | "skipped";
type Observation = Readonly<{
  action: string;
  detail: string;
  entryId: string;
  outcome: Outcome;
  step: number;
}>;
type BatchManifest = Readonly<Record<string, Readonly<{ group: string; manualReason?: string; scripted: boolean }>>>;
type ParsedCli = Readonly<{ kind: "all" | "batch" | "entry" | "list"; value?: string }>;
type RuntimeState = {
  copiedEditorText?: string;
};

const EXERCISE_ROOT = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_ROOT = resolve(EXERCISE_ROOT, "../../history/p0-exercise/2026-08-24");
const MANIFEST_PATH = resolve(EXERCISE_ROOT, "batches.json");
const RUN_LOCK_PATH = resolve(
  tmpdir(),
  `lexical-playground-capability-atlas-${createHash("sha256").update(EVIDENCE_ROOT).digest("hex").slice(0, 16)}.runner.lock`
);
// biome-ignore lint/suspicious/noUndeclaredEnvVars: This standalone runner is not a cached Turbo task.
const BASE_URL = process.env.EXERCISE_BASE_URL ?? "http://localhost:3000";
const DEFAULT_VIEWPORT = { height: 900, width: 1280 } as const;
const BASELINE_EGRESS_HOSTS: ReadonlyArray<string> = [
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "va.vercel-scripts.com",
];
const REGEXP_META = /[.*+?^${}()|[\]\\]/g;
const HOME_PATH = /\/(?:@fs\/)?home\/[^/\s]+/g;

const usage = "Usage: bun runner.ts --batch <surface-group> | --entry <atlas-id> | --list | --all";

class ConcurrentRunnerError extends Error {}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  Object.prototype.toString.call(value) === "[object Object]";

const isObject = (value: unknown): value is object => Object(value) === value;

const errorCode = (error: unknown): string | undefined => {
  if (!isObject(error)) return undefined;
  const code = Reflect.get(error, "code");
  return typeof code === "string" ? code : undefined;
};

const processIsAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return errorCode(error) !== "ESRCH";
  }
};

const acquireRunLock = async (): Promise<() => Promise<void>> => {
  for (;;) {
    try {
      const handle = await open(RUN_LOCK_PATH, "wx");
      try {
        await handle.writeFile(`${process.pid}\n`, "utf8");
      } catch (error) {
        await handle.close();
        await rm(RUN_LOCK_PATH, { force: true });
        throw error;
      }
      return async () => {
        try {
          await handle.close();
        } finally {
          await rm(RUN_LOCK_PATH, { force: true });
        }
      };
    } catch (error) {
      if (errorCode(error) !== "EEXIST") throw error;
      let recordedPid = Number.NaN;
      try {
        recordedPid = Number.parseInt((await readFile(RUN_LOCK_PATH, "utf8")).trim(), 10);
      } catch (readError) {
        if (errorCode(readError) === "ENOENT") continue;
        throw readError;
      }
      if (Number.isSafeInteger(recordedPid) && recordedPid > 0 && processIsAlive(recordedPid)) {
        throw new ConcurrentRunnerError(
          `Runner PID ${recordedPid} is active; concurrent runs share the system clipboard and are forbidden.`
        );
      }
      const stalePath = `${RUN_LOCK_PATH}.stale-${process.pid}`;
      try {
        await rename(RUN_LOCK_PATH, stalePath);
        await rm(stalePath, { force: true });
      } catch (staleError) {
        if (errorCode(staleError) !== "ENOENT") throw staleError;
      }
    }
  }
};

const comparableText = (value: string): string => value.replaceAll(/\s+/g, "");

const redactDetail = (detail: string): string =>
  detail.replaceAll(HOME_PATH, (match) => (match.startsWith("/@fs/") ? "/@fs/~" : "~"));

const requireCopiedEditorText = (state: RuntimeState): string => {
  if (state.copiedEditorText === undefined) throw new Error("No editor text was captured by clipboard-copy");
  return state.copiedEditorText;
};

const countOccurrences = (value: string, expected: string): number => {
  let count = 0;
  let offset = 0;
  while (offset <= value.length - expected.length) {
    const index = value.indexOf(expected, offset);
    if (index < 0) break;
    count += 1;
    offset = index + expected.length;
  }
  return count;
};

const serializedText = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(serializedText).join("");
  if (!isRecord(value)) return "";
  if (typeof value.text === "string") return value.text;
  return Object.values(value).map(serializedText).join("");
};

const parseCli = (argv: ReadonlyArray<string>): ParsedCli => {
  if (argv.length === 1 && argv[0] === "--list") return { kind: "list" };
  if (argv.length === 1 && argv[0] === "--all") return { kind: "all" };
  if (argv.length === 2 && argv[0] === "--batch") return { kind: "batch", value: argv[1] };
  if (argv.length === 2 && argv[0] === "--entry") return { kind: "entry", value: argv[1] };
  throw new Error(usage);
};

const safeName = (value: string): string => value.replaceAll(/[^a-zA-Z0-9._-]/g, "-");

const toLocator = (page: Page, spec: LocatorSpec): Locator => {
  const locator = (() => {
    switch (spec.kind) {
      case "css":
        return page.locator(spec.selector);
      case "placeholder":
        return page.getByPlaceholder(spec.placeholder);
      case "role": {
        const root = spec.scope === undefined ? page : page.locator(spec.scope);
        const name =
          spec.name === undefined || spec.nameMatch === undefined
            ? spec.name
            : new RegExp(`^${Str.replace(REGEXP_META, "\\$&")(spec.name)}(?:\\s|$)`);
        return root.getByRole(spec.role, { exact: spec.nameMatch === undefined ? spec.exact : undefined, name });
      }
      case "test-id":
        return page.getByTestId(spec.id);
      case "text":
        return page.getByText(spec.text, { exact: spec.exact });
    }
  })();
  return spec.nth === undefined ? locator : locator.nth(spec.nth);
};

const describeLocator = (spec: LocatorSpec): string => {
  switch (spec.kind) {
    case "css":
      return `css=${spec.selector}${spec.nth === undefined ? "" : ` nth=${spec.nth}`}`;
    case "placeholder":
      return `placeholder=${stableStringify(spec.placeholder)}`;
    case "role":
      return `${spec.scope === undefined ? "" : `scope=${spec.scope} `}role=${spec.role}${
        spec.name === undefined
          ? ""
          : ` name${spec.nameMatch === undefined ? "" : `-${spec.nameMatch}`}=${stableStringify(spec.name)}`
      }`;
    case "test-id":
      return `test-id=${spec.id}`;
    case "text":
      return `text=${stableStringify(spec.text)}`;
  }
};

const stepDetail = (step: Step): string => {
  switch (step.action) {
    case "goto":
      return `${step.path} ${stableStringify(step.query ?? {})}`;
    case "reload":
      return "reload current URL";
    case "click":
      return describeLocator(step.locator);
    case "hover":
      return describeLocator(step.locator);
    case "drag":
      return `${describeLocator(step.source)} -> ${step.target === undefined ? stableStringify(step.delta ?? {}) : describeLocator(step.target)}`;
    case "keyboard":
      return `${step.keys}${step.locator === undefined ? "" : ` on ${describeLocator(step.locator)}`}`;
    case "type":
      return `${step.mode ?? "insert"} ${stableStringify(step.text)} in ${describeLocator(step.locator)}`;
    case "expect-selector":
      return `${describeLocator(step.locator)} is ${step.state ?? "visible"}`;
    case "expect-text":
      return `${describeLocator(step.locator)} contains ${stableStringify(step.text)}`;
    case "expect-attr":
      return `${describeLocator(step.locator)}[${step.attribute}]=${stableStringify(step.value)}`;
    case "screenshot":
      return step.label;
    case "clipboard-copy":
      return describeLocator(step.locator);
    case "clipboard-paste":
      return `${describeLocator(step.locator)} ${step.payload?.mimeType ?? "system clipboard"}`;
    case "file-paste":
      return `${describeLocator(step.locator)} ${step.fileName} (${step.mimeType})`;
    case "clipboard-verify":
      return `${describeLocator(step.locator)} system clipboard matches captured editor text`;
    case "paste-verify":
      return `${describeLocator(step.locator)} contains two whitespace-stripped copies of captured editor text`;
    case "export-verify":
      return `download-slot=${step.downloadSlot} editorState.root contains captured editor text`;
    case "set-viewport":
      return `${step.width}x${step.height}`;
    case "touch-swipe":
      return `${describeLocator(step.locator)} delta=${stableStringify(step.delta)}`;
    case "mark-manual":
      return step.reason;
  }
};

const gotoUrl = (step: Extract<Step, { action: "goto" }>): string => {
  const destination = new URL(step.path, BASE_URL);
  for (const [key, value] of Object.entries(step.query ?? {}))
    destination.searchParams.set(key, stableStringify(value));
  return destination.href;
};

const executeClick = async (
  page: Page,
  context: BrowserContext,
  step: Extract<Step, { action: "click" }>,
  downloads: Map<string, string>,
  entryDirectory: string
): Promise<void> => {
  const locator = toLocator(page, step.locator);
  const options = step.options;
  if (options?.upload !== undefined) {
    const chooserPromise = page.waitForEvent("filechooser");
    await locator.click({ force: options.force });
    const chooser = await chooserPromise;
    if ("fromDownloadSlot" in options.upload) {
      const downloadPath = downloads.get(options.upload.fromDownloadSlot);
      if (downloadPath === undefined) throw new Error(`No download in slot ${options.upload.fromDownloadSlot}`);
      await chooser.setFiles(downloadPath);
    } else {
      await chooser.setFiles({
        buffer: Buffer.from(options.upload.content),
        mimeType: options.upload.mimeType,
        name: options.upload.fileName,
      });
    }
    return;
  }
  if (options?.downloadSlot !== undefined) {
    const [download] = await Promise.all([page.waitForEvent("download"), locator.click({ force: options.force })]);
    await saveDownload(download, options.downloadSlot, downloads, entryDirectory);
    return;
  }
  if (options?.input === "touch") {
    const box = await locator.boundingBox();
    if (box === null) throw new Error(`Cannot touch hidden locator ${describeLocator(step.locator)}`);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    return;
  }
  await locator.click({
    button: options?.button,
    force: options?.force,
    modifiers: options?.modifiers as Array<"Alt" | "Control" | "Meta" | "Shift"> | undefined,
    position: options?.position,
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(BASE_URL).origin });
};

const saveDownload = async (
  download: Download,
  slot: string,
  downloads: Map<string, string>,
  entryDirectory: string
): Promise<void> => {
  const target = resolve(entryDirectory, `${safeName(slot)}-${safeName(download.suggestedFilename())}`);
  await download.saveAs(target);
  downloads.set(slot, target);
};

const executeStep = async (
  page: Page,
  context: BrowserContext,
  step: Step,
  screenshotIndex: number,
  entryDirectory: string,
  downloads: Map<string, string>,
  state: RuntimeState
): Promise<string | undefined> => {
  switch (step.action) {
    case "goto":
      await page.goto(gotoUrl(step), { waitUntil: "domcontentloaded" });
      return;
    case "reload":
      await page.reload({ waitUntil: "domcontentloaded" });
      return;
    case "click":
      await executeClick(page, context, step, downloads, entryDirectory);
      return;
    case "hover":
      await toLocator(page, step.locator).hover();
      return;
    case "drag": {
      const source = toLocator(page, step.source);
      if (step.target !== undefined) {
        await source.dragTo(toLocator(page, step.target));
        return;
      }
      const box = await source.boundingBox();
      if (box === null) throw new Error(`Cannot drag hidden locator ${describeLocator(step.source)}`);
      const delta = step.delta ?? { x: 40, y: 0 };
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + delta.x, box.y + box.height / 2 + delta.y, { steps: 8 });
      await page.mouse.up();
      return;
    }
    case "keyboard":
      if (step.locator === undefined) await page.keyboard.press(step.keys);
      else await toLocator(page, step.locator).press(step.keys);
      return;
    case "type": {
      const locator = toLocator(page, step.locator);
      if (step.mode === "fill") await locator.fill(step.text);
      else await locator.pressSequentially(step.text, { delay: 8 });
      return;
    }
    case "expect-selector": {
      const locator = toLocator(page, step.locator);
      const state = step.state ?? "visible";
      if (state === "visible") await locator.first().waitFor({ state });
      else await locator.waitFor({ state });
      return;
    }
    case "expect-text": {
      const value = (await toLocator(page, step.locator).textContent()) ?? "";
      const matches = step.exact === true ? value === step.text : value.includes(step.text);
      if (!matches) throw new Error(`Expected ${stableStringify(step.text)}, received ${stableStringify(value)}`);
      return;
    }
    case "expect-attr": {
      const value = await toLocator(page, step.locator).getAttribute(step.attribute);
      if (value !== step.value)
        throw new Error(
          `Expected ${step.attribute}=${stableStringify(step.value)}, received ${stableStringify(value)}`
        );
      return;
    }
    case "screenshot":
      await page.screenshot({
        fullPage: true,
        path: resolve(entryDirectory, `${String(screenshotIndex).padStart(2, "0")}-${safeName(step.label)}.png`),
      });
      return;
    case "clipboard-copy": {
      const locator = toLocator(page, step.locator);
      state.copiedEditorText = (await locator.textContent()) ?? "";
      await locator.evaluate(() => navigator.clipboard.writeText(""));
      await locator.focus();
      await locator.press("Control+A");
      await locator.press("Control+A");
      await locator.press("Control+C");
      // Lexical applies DOM `selectionchange` asynchronously. A caret key (End,
      // ArrowRight) sent within ~50ms of the select-all leaves Lexical's own
      // selection covering the document, and the next Enter deletes it. Collapse
      // through the DOM and give Lexical a frame to observe it before continuing.
      const selectionCollapsed = await locator.evaluate(() => {
        const selection = window.getSelection();
        if (selection !== null && selection.rangeCount > 0) {
          selection.collapseToEnd();
          return true;
        }
        return false;
      });
      if (!selectionCollapsed) {
        await locator.focus();
        await locator.press("End");
      }
      await page.waitForTimeout(150);
      return;
    }
    case "clipboard-paste": {
      const locator = toLocator(page, step.locator);
      if (step.payload === undefined) {
        await locator.press("Control+V");
      } else {
        await locator.focus();
        await locator.evaluate(() => navigator.clipboard.writeText(""));
        await locator.evaluate((element, payload) => {
          const transfer = new DataTransfer();
          transfer.setData(payload.mimeType, payload.text);
          element.dispatchEvent(
            new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: transfer })
          );
        }, step.payload);
      }
      return;
    }
    case "file-paste": {
      const locator = toLocator(page, step.locator);
      const base64 = Str.replace(/^data:[^,]+,/, "")(step.dataUri);
      await locator.focus();
      await locator.evaluate(() => navigator.clipboard.writeText(""));
      await locator.evaluate(
        (element, payload) => {
          const decoded = atob(payload.base64);
          const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
          const transfer = new DataTransfer();
          transfer.items.add(new File([bytes], payload.fileName, { type: payload.mimeType }));
          element.dispatchEvent(
            new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: transfer })
          );
        },
        { base64, fileName: step.fileName, mimeType: step.mimeType }
      );
      return;
    }
    case "clipboard-verify": {
      const captured = requireCopiedEditorText(state);
      const clipboard = await page.evaluate(() => navigator.clipboard.readText());
      const expected = comparableText(captured);
      const received = comparableText(clipboard);
      if (received !== expected) {
        throw new Error(
          `Expected system clipboard ${stableStringify(captured)}, received ${stableStringify(clipboard)}`
        );
      }
      return `${describeLocator(step.locator)} system clipboard matched captured editor text ${stableStringify(captured)}`;
    }
    case "paste-verify": {
      const captured = requireCopiedEditorText(state);
      const expected = comparableText(captured);
      const readEditorText = async (): Promise<string> => (await toLocator(page, step.locator).textContent()) ?? "";
      let receivedText = await readEditorText();
      let received = comparableText(receivedText);
      // Lexical applies the paste inside an editor update; poll briefly so the
      // verification observes the settled document rather than the pre-paste text.
      for (
        let attempt = 0;
        attempt < 20 && expected.length > 0 && countOccurrences(received, expected) < 2;
        attempt += 1
      ) {
        await page.waitForTimeout(250);
        receivedText = await readEditorText();
        received = comparableText(receivedText);
      }
      if (expected.length === 0) {
        if (received.length > 0) {
          throw new Error(
            `Expected an empty editor after the inserted line break, received ${stableStringify(receivedText)}`
          );
        }
        return `${describeLocator(step.locator)} remained empty after the inserted line break`;
      }
      const copies = countOccurrences(received, expected);
      if (copies !== 2) {
        throw new Error(
          `Expected two copies of ${stableStringify(captured)}, found ${copies} in ${stableStringify(receivedText)}`
        );
      }
      return `${describeLocator(step.locator)} contains ${copies} whitespace-stripped copies of captured editor text ${stableStringify(captured)}`;
    }
    case "export-verify": {
      const downloadPath = downloads.get(step.downloadSlot);
      if (downloadPath === undefined) throw new Error(`No download in slot ${step.downloadSlot}`);
      const fileName = basename(downloadPath);
      try {
        const document: unknown = JSON.parse(await readFile(downloadPath, "utf8"));
        if (!isRecord(document) || !isRecord(document.editorState) || !isRecord(document.editorState.root)) {
          throw new Error("missing editorState.root");
        }
        const captured = requireCopiedEditorText(state);
        const serialized = serializedText(document.editorState.root);
        const expected = comparableText(captured);
        const received = comparableText(serialized);
        if (expected.length > 0 && !received.includes(expected)) {
          throw new Error(
            `captured editor text ${stableStringify(captured)} was absent; received ${stableStringify(serialized)}`
          );
        }
        return `${fileName} editorState.root text contains captured editor text ${stableStringify(captured)}`;
      } catch (error) {
        throw new Error(
          `Downloaded file ${fileName} failed export verification: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    case "set-viewport":
      await page.setViewportSize({ height: step.height, width: step.width });
      return;
    case "touch-swipe":
      await toLocator(page, step.locator).evaluate((element, delta) => {
        const bounds = element.getBoundingClientRect();
        const startX = bounds.left + bounds.width / 4;
        const startY = bounds.top + bounds.height / 2;
        const endX = startX + delta.x;
        const endY = startY + delta.y;
        const start = new Touch({
          clientX: startX,
          clientY: startY,
          identifier: 1,
          pageX: startX,
          pageY: startY,
          screenX: startX,
          screenY: startY,
          target: element,
        });
        const end = new Touch({
          clientX: endX,
          clientY: endY,
          identifier: 1,
          pageX: endX,
          pageY: endY,
          screenX: endX,
          screenY: endY,
          target: element,
        });
        element.dispatchEvent(
          new TouchEvent("touchstart", {
            bubbles: true,
            cancelable: true,
            changedTouches: [start],
            composed: true,
            targetTouches: [start],
            touches: [start],
          })
        );
        element.dispatchEvent(
          new TouchEvent("touchend", {
            bubbles: true,
            cancelable: true,
            changedTouches: [end],
            composed: true,
            targetTouches: [],
            touches: [],
          })
        );
      }, step.delta);
      return;
    case "mark-manual":
      return;
  }
};

const isExternalRequest = (rawUrl: string): boolean => {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.origin === new URL(BASE_URL).origin) return false;
  const hostname = url.hostname.toLowerCase();
  return !(
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
};

const isBaselineEgress = (rawUrl: string): boolean =>
  BASELINE_EGRESS_HOSTS.includes(new URL(rawUrl).hostname.toLowerCase());

const runScenario = async (browser: Browser, scenario: Scenario): Promise<Outcome> => {
  if (!scenario.scripted) return "skipped";
  const entryDirectory = resolve(EVIDENCE_ROOT, scenario.id);
  await rm(entryDirectory, { force: true, recursive: true });
  await mkdir(entryDirectory, { recursive: true });
  const observations: Observation[] = [];
  let observationIndex = 0;
  const record = (action: string, outcome: Outcome, detail: string): void => {
    observationIndex += 1;
    observations.push({ action, detail: redactDetail(detail), entryId: scenario.id, outcome, step: observationIndex });
  };

  const screenshotCount = scenario.steps.filter(({ action }) => action === "screenshot").length;
  if (screenshotCount < 2 || screenshotCount > 4) {
    record("scenario-validation", "fail", `Expected 2-4 screenshots, found ${screenshotCount}`);
    await writeObservations(entryDirectory, observations);
    return "fail";
  }

  const context = await browser.newContext({
    acceptDownloads: true,
    hasTouch: true,
    viewport: DEFAULT_VIEWPORT,
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(BASE_URL).origin });
  const page = await context.newPage();
  const downloads = new Map<string, string>();
  const baselineEgressRequests: string[] = [];
  const capabilityRequests: string[] = [];
  const state: RuntimeState = {};
  let failed = false;
  // Browser `error` events that carry no exception object (for example the
  // benign "ResizeObserver loop completed with undelivered notifications")
  // never reach Playwright's `pageerror`, but the Vite dev client still tries
  // to render them in its ErrorOverlay and throws while doing so. Forward the
  // event through the console so the evidence names the underlying event.
  await context.addInitScript(() => {
    window.addEventListener("error", (event) => {
      console.debug(
        `${"__exercise_window_error__"} ${JSON.stringify({
          hasException: event.error instanceof Error,
          message: event.message,
        })}`
      );
    });
  });
  page.on("console", (message) => {
    const text = message.text();
    if (!text.startsWith("__exercise_window_error__ ")) return;
    record("window-error", "pass", `browser error event without an uncaught exception: ${text.slice(26)}`);
  });
  page.on("pageerror", (error) => {
    const firstStackLine = error.stack
      ?.split("\n")
      .slice(1)
      .find((line) => line.trim().length > 0)
      ?.trim();
    const summary = `${error.name}: ${error.message}${firstStackLine === undefined ? "" : ` :: ${firstStackLine}`}`;
    if (firstStackLine?.includes("/@vite/client") === true) {
      record(
        "dev-client-error",
        "pass",
        `Vite dev client threw while rendering the preceding browser error event (not a Playground fault): ${summary}`
      );
      return;
    }
    failed = true;
    record("page-error", "fail", summary);
  });
  page.on("request", (request) => {
    const url = request.url();
    if (isExternalRequest(url)) {
      if (isBaselineEgress(url)) {
        baselineEgressRequests.push(url);
        record("baseline-egress", "pass", `expected Playground default egress (D9/D14): ${request.method()} ${url}`);
        return;
      }
      capabilityRequests.push(url);
      const outcome =
        scenario.networkExpectation === "none" || scenario.networkExpectation === "rejected" ? "fail" : "pass";
      record("network-request", outcome, `${request.method()} ${url}`);
    }
  });

  let screenshotIndex = 0;
  for (const step of scenario.steps) {
    if (step.action === "screenshot") screenshotIndex += 1;
    try {
      const detail = await executeStep(page, context, step, screenshotIndex, entryDirectory, downloads, state);
      record(step.action, "pass", detail ?? stepDetail(step));
    } catch (error) {
      failed = true;
      record(step.action, "fail", `${stepDetail(step)} :: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const inertExpectation = scenario.networkExpectation === "none" || scenario.networkExpectation === "rejected";
  const networkPassed = inertExpectation ? capabilityRequests.length === 0 : capabilityRequests.length > 0;
  if (!networkPassed) failed = true;
  record(
    "network-summary",
    networkPassed ? "pass" : "fail",
    `${scenario.networkExpectation}: ${capabilityRequests.length} capability request(s); ${baselineEgressRequests.length} baseline egress request(s)`
  );
  await context.close();
  await writeObservations(entryDirectory, observations);
  return failed ? "fail" : "pass";
};

const writeObservations = async (entryDirectory: string, rows: ReadonlyArray<Observation>): Promise<void> => {
  const body = `${rows.map((row) => stableStringify(row)).join("\n")}\n`;
  await writeFile(resolve(entryDirectory, "observations.ndjson"), body, "utf8");
};

const validateInventory = async (): Promise<BatchManifest> => {
  const manifest = (await Bun.file(MANIFEST_PATH).json()) as BatchManifest;
  const seen = new Set<string>();
  for (const scenario of allScenarios) {
    if (seen.has(scenario.id)) throw new Error(`Duplicate scenario id: ${scenario.id}`);
    seen.add(scenario.id);
    const entry = manifest[scenario.id];
    if (entry === undefined) throw new Error(`Missing batches.json entry: ${scenario.id}`);
    if (
      entry.group !== scenario.group ||
      entry.scripted !== scenario.scripted ||
      entry.manualReason !== scenario.manualReason
    ) {
      throw new Error(`batches.json disagrees with scenario: ${scenario.id}`);
    }
  }
  const extra = Object.keys(manifest).filter((id) => !seen.has(id));
  if (extra.length > 0) throw new Error(`Unexpected batches.json entries: ${extra.join(", ")}`);
  if (seen.size !== 163) throw new Error(`Expected 163 scenarios, found ${seen.size}`);
  return manifest;
};

const printList = (): void => {
  for (const group of scenarioGroups) {
    console.log(`${group.slug} (${group.scenarios.length}) — ${group.title}`);
    for (const scenario of group.scenarios)
      console.log(`  ${scenario.scripted ? "scripted" : "manual  "}  ${scenario.id} — ${scenario.title}`);
  }
  const scripted = allScenarios.filter(({ scripted }) => scripted).length;
  console.log(`TOTAL ${allScenarios.length} | scripted ${scripted} | manual ${allScenarios.length - scripted}`);
};

const selectScenarios = (cli: ParsedCli): ReadonlyArray<Scenario> => {
  if (cli.kind === "all") return allScenarios;
  if (cli.kind === "entry") {
    const scenario = allScenarios.find(({ id }) => id === cli.value);
    if (scenario === undefined) throw new Error(`Unknown atlas id: ${cli.value}`);
    return [scenario];
  }
  if (cli.kind === "batch") {
    const group = scenarioGroups.find(({ slug }) => slug === cli.value);
    if (group === undefined) throw new Error(`Unknown surface group: ${cli.value}`);
    return group.scenarios;
  }
  return [];
};

const main = async (): Promise<void> => {
  const cli = parseCli(Bun.argv.slice(2));
  await validateInventory();
  if (cli.kind === "list") {
    printList();
    return;
  }
  const selected = selectScenarios(cli);
  const releaseLock = await acquireRunLock();
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  try {
    if (selected.some(({ scripted }) => scripted)) {
      const browser = await chromium.launch({
        args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
        // biome-ignore lint/suspicious/noUndeclaredEnvVars: This standalone runner is not a cached Turbo task.
        headless: process.env.EXERCISE_HEADLESS !== "0",
      });
      try {
        for (const scenario of selected) {
          const outcome = await runScenario(browser, scenario);
          if (outcome === "skipped") {
            skipped += 1;
            console.log(`SKIP ${scenario.id} — manual: ${scenario.manualReason ?? "Manual exercise required"}`);
          } else {
            console.log(`${outcome === "pass" ? "PASS" : "FAIL"} ${scenario.id}`);
            if (outcome === "pass") passed += 1;
            else failed += 1;
          }
        }
      } finally {
        await browser.close();
      }
    } else {
      for (const scenario of selected) {
        skipped += 1;
        console.log(`SKIP ${scenario.id} — manual: ${scenario.manualReason ?? "Manual exercise required"}`);
      }
    }
  } finally {
    await releaseLock();
  }
  console.log(`Completed ${selected.length}: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  if (failed > 0) process.exitCode = 1;
};

await main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = error instanceof ConcurrentRunnerError ? 2 : 1;
});
