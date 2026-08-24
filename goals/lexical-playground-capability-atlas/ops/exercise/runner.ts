/* biome-ignore-all lint/suspicious/noConsole: This CLI prints its inventory, progress, and terminal result. */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
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

const EXERCISE_ROOT = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_ROOT = resolve(EXERCISE_ROOT, "../../history/p0-exercise/2026-08-24");
const MANIFEST_PATH = resolve(EXERCISE_ROOT, "batches.json");
// biome-ignore lint/suspicious/noUndeclaredEnvVars: This standalone runner is not a cached Turbo task.
const BASE_URL = process.env.EXERCISE_BASE_URL ?? "http://localhost:3000";
const DEFAULT_VIEWPORT = { height: 900, width: 1280 } as const;
const REGEXP_META = /[.*+?^${}()|[\]\\]/g;

const usage = "Usage: bun runner.ts --batch <surface-group> | --entry <atlas-id> | --list | --all";

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
    case "set-viewport":
      return `${step.width}x${step.height}`;
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
  downloads: Map<string, string>
): Promise<void> => {
  switch (step.action) {
    case "goto":
      await page.goto(gotoUrl(step), { waitUntil: "domcontentloaded" });
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
    case "expect-selector":
      await toLocator(page, step.locator).waitFor({ state: step.state ?? "visible" });
      return;
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
      await locator.press("Control+A");
      await locator.press("Control+C");
      return;
    }
    case "clipboard-paste": {
      const locator = toLocator(page, step.locator);
      if (step.payload === undefined) {
        await locator.press("Control+V");
      } else {
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
    case "set-viewport":
      await page.setViewportSize({ height: step.height, width: step.width });
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

const runScenario = async (browser: Browser, scenario: Scenario): Promise<boolean> => {
  const entryDirectory = resolve(EVIDENCE_ROOT, scenario.id);
  await mkdir(entryDirectory, { recursive: true });
  const observations: Observation[] = [];
  let observationIndex = 0;
  const record = (action: string, outcome: Outcome, detail: string): void => {
    observationIndex += 1;
    observations.push({ action, detail, entryId: scenario.id, outcome, step: observationIndex });
  };

  if (!scenario.scripted) {
    record("manual", "skipped", scenario.manualReason ?? "Manual exercise required");
    await writeObservations(entryDirectory, observations);
    return true;
  }

  const screenshotCount = scenario.steps.filter(({ action }) => action === "screenshot").length;
  if (screenshotCount < 2 || screenshotCount > 4) {
    record("scenario-validation", "fail", `Expected 2-4 screenshots, found ${screenshotCount}`);
    await writeObservations(entryDirectory, observations);
    return false;
  }

  const context = await browser.newContext({
    acceptDownloads: true,
    hasTouch: true,
    viewport: DEFAULT_VIEWPORT,
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(BASE_URL).origin });
  const page = await context.newPage();
  const downloads = new Map<string, string>();
  const externalRequests: string[] = [];
  let failed = false;
  page.on("pageerror", (error) => {
    failed = true;
    const firstStackLine = error.stack
      ?.split("\n")
      .slice(1)
      .find((line) => line.trim().length > 0)
      ?.trim();
    record(
      "page-error",
      "fail",
      `${error.name}: ${error.message}${firstStackLine === undefined ? "" : ` :: ${firstStackLine}`}`
    );
  });
  page.on("request", (request) => {
    const url = request.url();
    if (isExternalRequest(url)) {
      externalRequests.push(url);
      const outcome =
        scenario.networkExpectation === "none" || scenario.networkExpectation === "rejected" ? "fail" : "pass";
      record("network-request", outcome, `${request.method()} ${url}`);
    }
  });

  let screenshotIndex = 0;
  for (const step of scenario.steps) {
    if (step.action === "screenshot") screenshotIndex += 1;
    try {
      await executeStep(page, context, step, screenshotIndex, entryDirectory, downloads);
      record(step.action, "pass", stepDetail(step));
    } catch (error) {
      failed = true;
      record(step.action, "fail", `${stepDetail(step)} :: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const inertExpectation = scenario.networkExpectation === "none" || scenario.networkExpectation === "rejected";
  const networkPassed = inertExpectation ? externalRequests.length === 0 : externalRequests.length > 0;
  if (!networkPassed) failed = true;
  record(
    "network-summary",
    networkPassed ? "pass" : "fail",
    `${scenario.networkExpectation}: ${externalRequests.length} non-localhost request(s)`
  );
  await context.close();
  await writeObservations(entryDirectory, observations);
  return !failed;
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
  if (seen.size !== 162) throw new Error(`Expected 162 scenarios, found ${seen.size}`);
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
  const browser = await chromium.launch({
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
    // biome-ignore lint/suspicious/noUndeclaredEnvVars: This standalone runner is not a cached Turbo task.
    headless: process.env.EXERCISE_HEADLESS !== "0",
  });
  let passed = 0;
  try {
    for (const scenario of selected) {
      const ok = await runScenario(browser, scenario);
      console.log(`${ok ? "PASS" : "FAIL"} ${scenario.id}`);
      if (ok) passed += 1;
    }
  } finally {
    await browser.close();
  }
  console.log(`Completed ${selected.length}: ${passed} passed, ${selected.length - passed} failed`);
  if (passed !== selected.length) process.exitCode = 1;
};

await main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
