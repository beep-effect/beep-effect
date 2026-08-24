/* biome-ignore-all lint/suspicious/noConsole: This standalone exercise prints its terminal result. */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import stableStringify from "fast-json-stable-stringify";
import { chromium } from "playwright-core";
import type { BrowserContext, Page } from "playwright-core";

type Outcome = "fail" | "pass" | "skipped";
type Observation = Readonly<{
  action: string;
  detail: string;
  entryId: typeof ENTRY_ID;
  outcome: Outcome;
  step: number;
}>;
type CollaborationPhase = "undo" | "clipboard" | "offline" | "export" | "narrow" | "keyboard" | "touch";
type Peer = "peer A" | "peer B";
type EditorStructure = Readonly<{
  paragraphs: number;
  textNodes: number;
}>;
type PeerStructures = Readonly<{
  peerA: EditorStructure;
  peerB: EditorStructure;
}>;
type PeerTexts = Readonly<{
  peerA: string;
  peerB: string;
}>;
type Presence = Readonly<{
  color: string;
  label: string;
  legacySelectionRects: number;
  selectedHighlightRanges: number;
}>;

const ENTRY_ID = "collaboration.realtime";
const EXERCISE_ROOT = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_ROOT = resolve(EXERCISE_ROOT, "../../history/p0-exercise/2026-08-24");
const ENTRY_DIRECTORY = resolve(EVIDENCE_ROOT, ENTRY_ID);
const RUN_LOCK_PATH = resolve(
  tmpdir(),
  `lexical-playground-capability-atlas-${createHash("sha256").update(EVIDENCE_ROOT).digest("hex").slice(0, 16)}.runner.lock`
);
// biome-ignore lint/suspicious/noUndeclaredEnvVars: This standalone runner is not a cached Turbo task.
const BASE_URL = process.env.EXERCISE_BASE_URL ?? "http://localhost:5199";
const COLLAB_ENDPOINT = "ws://localhost:1234";
const COLLAB_RUN_ID = randomUUID();
const COLLAB_ID_PREFIX = `p0-${ENTRY_ID}-${COLLAB_RUN_ID}`;
const COLLABORATION_PHASES: ReadonlyArray<CollaborationPhase> = [
  "undo",
  "clipboard",
  "offline",
  "export",
  "narrow",
  "keyboard",
  "touch",
];
const DEFAULT_VIEWPORT = { height: 900, width: 1280 } as const;
const NARROW_VIEWPORT = { height: 900, width: 480 } as const;
const BASELINE_EGRESS_HOSTS: ReadonlyArray<string> = [
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "va.vercel-scripts.com",
];
const EDITOR_SELECTOR = ".ContentEditable__root";
const HOME_PATH = /\/(?:@fs\/)?home\/[^/\s]+/g;
const PEER_A_TEXT = "peerA";
const PEER_B_TEXT = "peerB";
const OFFLINE_TEXT = "offlineA";
const BOTH_PEERS_TEXT = `${PEER_A_TEXT} ${PEER_B_TEXT}`;
const CLIPBOARD_SUFFIX = ` ${PEER_B_TEXT}`;
const CLIPBOARD_PASTED_TEXT = `${BOTH_PEERS_TEXT}${CLIPBOARD_SUFFIX}`;
const BLOCK_SCOPED_REPLACEMENT_TEXT = `${BOTH_PEERS_TEXT} ${PEER_B_TEXT}`;
const RECONNECTED_TEXT = `${BOTH_PEERS_TEXT} ${OFFLINE_TEXT}`;
const ANIMAL_NAMES: ReadonlyArray<string> = [
  "Bear",
  "Cat",
  "Dog",
  "Fox",
  "Frog",
  "Gull",
  "Hedgehog",
  "Leopard",
  "Owl",
  "Pigeon",
  "Rabbit",
  "Squid",
  "Squirrel",
  "Tiger",
  "Wolf",
  "Zebra",
];

const safeName = (value: string): string => value.replaceAll(/[^a-zA-Z0-9._-]/g, "-");

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

class ConcurrentRunnerError extends Error {}

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

const redactDetail = (detail: string): string =>
  detail.replaceAll(HOME_PATH, (match) => (match.startsWith("/@fs/") ? "/@fs/~" : "~"));

const normalizeEditorText = (value: string): string => value.replaceAll("\u00a0", " ").replaceAll(/\s+/g, " ").trim();

const editorText = async (page: Page): Promise<string> =>
  normalizeEditorText(await page.locator(EDITOR_SELECTOR).evaluate((element) => (element as HTMLElement).innerText));

const waitForEditorText = async (page: Page, expected: string): Promise<void> => {
  await page.waitForFunction(
    ({ expectedText, selector }) => {
      const element = document.querySelector<HTMLElement>(selector);
      const received = (element?.innerText ?? "").replaceAll("\u00a0", " ").replaceAll(/\s+/g, " ").trim();
      return received === expectedText;
    },
    { expectedText: expected, selector: EDITOR_SELECTOR },
    { timeout: 30_000 }
  );
};

const assertEditorText = async (page: Page, expected: string): Promise<void> => {
  const received = await editorText(page);
  if (received !== expected)
    throw new Error(`Expected editor text ${stableStringify(expected)}, received ${stableStringify(received)}`);
};

const editorStructure = async (page: Page): Promise<EditorStructure> => ({
  paragraphs: await page.locator(`${EDITOR_SELECTOR} > p`).count(),
  textNodes: await page.locator(`${EDITOR_SELECTOR} [data-lexical-text="true"]`).count(),
});

const assertPeerStructures = async (pageA: Page, pageB: Page, expected: EditorStructure): Promise<PeerStructures> => {
  const [peerA, peerB] = await Promise.all([editorStructure(pageA), editorStructure(pageB)]);
  if (
    peerA.paragraphs !== expected.paragraphs ||
    peerA.textNodes !== expected.textNodes ||
    peerB.paragraphs !== expected.paragraphs ||
    peerB.textNodes !== expected.textNodes
  ) {
    throw new Error(
      `Expected both peers to have ${expected.paragraphs} paragraph(s) and ${expected.textNodes} text node(s), received peer A=${stableStringify(peerA)} peer B=${stableStringify(peerB)}`
    );
  }
  return { peerA, peerB };
};

const waitForPeerTexts = async (pageA: Page, pageB: Page, expected: string): Promise<PeerTexts> => {
  try {
    await Promise.all([waitForEditorText(pageA, expected), waitForEditorText(pageB, expected)]);
  } catch (error) {
    const [peerA, peerB] = await Promise.all([editorText(pageA), editorText(pageB)]);
    throw new Error(
      `Expected both peers to contain ${stableStringify(expected)}, received peer A=${stableStringify(peerA)} peer B=${stableStringify(peerB)} :: ${errorMessage(error)}`
    );
  }
  const [peerA, peerB] = await Promise.all([editorText(pageA), editorText(pageB)]);
  return { peerA, peerB };
};

const replaceSharedText = async (pageA: Page, pageB: Page, text: string): Promise<PeerTexts> => {
  const editor = pageA.locator(EDITOR_SELECTOR);
  await editor.click();
  await editor.press("Control+A");
  await editor.pressSequentially(text, { delay: 8 });
  return waitForPeerTexts(pageA, pageB, text);
};

const stopCollaborationUndoCapture = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => {
    const element = document.querySelector<HTMLElement>('[data-lexical-editor="true"]');
    if (element === null || element.firstElementChild === null) return false;
    const editor = (
      element as HTMLElement & {
        __lexicalEditor?: Record<symbol, { stopCapturing: () => void }>;
      }
    ).__lexicalEditor;
    const undoManager = editor?.[Symbol.for("@lexical/yjs/UndoManager")];
    if (undoManager === undefined) return false;
    undoManager.stopCapturing();
    return true;
  });
};

const collaborationId = (phase: CollaborationPhase): string => `${COLLAB_ID_PREFIX}-${phase}`;

const collaborationRoom = (phase: CollaborationPhase): string => `playground/${collaborationId(phase)}/main`;

const collaborationUrl = (phase: CollaborationPhase): string => {
  const url = new URL("/", BASE_URL);
  url.searchParams.set("collabEndpoint", COLLAB_ENDPOINT);
  url.searchParams.set("collabId", collaborationId(phase));
  url.searchParams.set("emptyEditor", "true");
  url.searchParams.set("isCollab", "true");
  url.searchParams.set("isRichText", "true");
  url.searchParams.set("showTreeView", "false");
  url.searchParams.set("useCollabV2", "false");
  return url.href;
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

const addWindowErrorForwarder = async (context: BrowserContext): Promise<void> => {
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
};

const collaborationPhaseForSocket = (rawUrl: string): CollaborationPhase | undefined => {
  const url = new URL(rawUrl);
  const path = decodeURIComponent(url.pathname);
  if (url.origin !== COLLAB_ENDPOINT) return undefined;
  return COLLABORATION_PHASES.find((phase) => path.includes(`/playground/${collaborationId(phase)}/`));
};

const isMainCollaborationSocket = (rawUrl: string): boolean =>
  collaborationPhaseForSocket(rawUrl) !== undefined && decodeURIComponent(new URL(rawUrl).pathname).endsWith("/main");

const waitForRemotePresence = async (page: Page): Promise<Presence> => {
  await page.waitForFunction(
    ({ animalNames }) => {
      const labels = Array.from(document.querySelectorAll<HTMLSpanElement>("span"));
      const label = labels.find((element) => {
        const parent = element.parentElement as HTMLElement | null;
        return (
          animalNames.includes(element.textContent ?? "") &&
          element.style.whiteSpace === "nowrap" &&
          parent?.style.position === "absolute"
        );
      });
      if (label === undefined) return false;

      const registry = (
        globalThis.CSS as unknown as {
          highlights?: { entries: () => IterableIterator<[string, ReadonlySet<Range>]> };
        }
      ).highlights;
      const selectedHighlightRanges =
        registry === undefined
          ? 0
          : Array.from(registry.entries())
              .filter(([name]) => name.startsWith("lexical-cursor-"))
              .reduce((total, [, highlight]) => total + highlight.size, 0);
      const legacySelectionRects = Array.from(document.querySelectorAll<HTMLElement>("span")).filter(
        (element) => (element.firstElementChild as HTMLElement | null)?.style.opacity === "0.3"
      ).length;
      return selectedHighlightRanges > 0 || legacySelectionRects > 0;
    },
    { animalNames: [...ANIMAL_NAMES] },
    { timeout: 30_000 }
  );

  return page.evaluate(
    ({ animalNames }) => {
      const labels = Array.from(document.querySelectorAll<HTMLSpanElement>("span"));
      const label = labels.find((element) => {
        const parent = element.parentElement as HTMLElement | null;
        return (
          animalNames.includes(element.textContent ?? "") &&
          element.style.whiteSpace === "nowrap" &&
          parent?.style.position === "absolute"
        );
      });
      if (label === undefined) throw new Error("Remote cursor label was not rendered");

      const registry = (
        globalThis.CSS as unknown as {
          highlights?: { entries: () => IterableIterator<[string, ReadonlySet<Range>]> };
        }
      ).highlights;
      const selectedHighlightRanges =
        registry === undefined
          ? 0
          : Array.from(registry.entries())
              .filter(([name]) => name.startsWith("lexical-cursor-"))
              .reduce((total, [, highlight]) => total + highlight.size, 0);
      const legacySelectionRects = Array.from(document.querySelectorAll<HTMLElement>("span")).filter(
        (element) => (element.firstElementChild as HTMLElement | null)?.style.opacity === "0.3"
      ).length;

      return {
        color: label.style.backgroundColor || (label.parentElement as HTMLElement | null)?.style.backgroundColor || "",
        label: label.textContent ?? "",
        legacySelectionRects,
        selectedHighlightRanges,
      };
    },
    { animalNames: [...ANIMAL_NAMES] }
  );
};

const writeObservations = async (rows: ReadonlyArray<Observation>): Promise<void> => {
  const body = `${rows.map((row) => stableStringify(row)).join("\n")}\n`;
  await writeFile(resolve(ENTRY_DIRECTORY, "observations.ndjson"), body, "utf8");
};

const runExercise = async (): Promise<void> => {
  // Like the scripted runner, make the directory the complete record of this run.
  await rm(ENTRY_DIRECTORY, { force: true, recursive: true });
  await mkdir(ENTRY_DIRECTORY, { recursive: true });
  const observations: Observation[] = [];
  const baselineEgressRequests: string[] = [];
  const capabilityRequests: string[] = [];
  const mainSocketPeers = new Map<CollaborationPhase, Set<Peer>>(
    COLLABORATION_PHASES.map((phase) => [phase, new Set<Peer>()])
  );
  let failed = false;
  let observationIndex = 0;
  let screenshotIndex = 0;

  const record = (action: string, outcome: Outcome, detail: string): void => {
    observationIndex += 1;
    observations.push({ action, detail: redactDetail(detail), entryId: ENTRY_ID, outcome, step: observationIndex });
    if (outcome === "fail") failed = true;
  };

  const perform = async <T>(
    action: string,
    detail: string | ((value: T) => string),
    task: () => Promise<T>
  ): Promise<T | undefined> => {
    try {
      const value = await task();
      record(action, "pass", typeof detail === "string" ? detail : detail(value));
      return value;
    } catch (error) {
      const prefix = typeof detail === "string" ? detail : "[peers A+B] step did not return a result";
      record(action, "fail", `${prefix} :: ${errorMessage(error)}`);
      return undefined;
    }
  };

  const screenshot = async (page: Page, peer: Peer, label: string): Promise<void> => {
    screenshotIndex += 1;
    await perform("screenshot", `[${peer}] ${label}`, () =>
      page.screenshot({
        fullPage: true,
        path: resolve(ENTRY_DIRECTORY, `${String(screenshotIndex).padStart(2, "0")}-${safeName(label)}.png`),
      })
    );
  };

  const browser = await chromium.launch({
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
    // biome-ignore lint/suspicious/noUndeclaredEnvVars: This standalone runner is not a cached Turbo task.
    headless: process.env.EXERCISE_HEADLESS !== "0",
  });
  const contextA = await browser.newContext({ acceptDownloads: true, hasTouch: true, viewport: DEFAULT_VIEWPORT });
  const contextB = await browser.newContext({ acceptDownloads: true, hasTouch: true, viewport: DEFAULT_VIEWPORT });
  const origin = new URL(BASE_URL).origin;
  await Promise.all([
    contextA.grantPermissions(["clipboard-read", "clipboard-write"], { origin }),
    contextB.grantPermissions(["clipboard-read", "clipboard-write"], { origin }),
  ]);
  await Promise.all([addWindowErrorForwarder(contextA), addWindowErrorForwarder(contextB)]);
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const observePage = (page: Page, peer: Peer): void => {
    page.on("console", (message) => {
      const text = message.text();
      if (!text.startsWith("__exercise_window_error__ ")) return;
      record("window-error", "pass", `[${peer}] browser error event without an uncaught exception: ${text.slice(26)}`);
    });
    page.on("pageerror", (error) => {
      const firstStackLine = error.stack
        ?.split("\n")
        .slice(1)
        .find((line) => line.trim().length > 0)
        ?.trim();
      const summary = `[${peer}] ${error.name}: ${error.message}${
        firstStackLine === undefined ? "" : ` :: ${firstStackLine}`
      }`;
      if (firstStackLine?.includes("/@vite/client") === true) {
        record(
          "dev-client-error",
          "pass",
          `Vite dev client threw while rendering the preceding browser error event (not a Playground fault): ${summary}`
        );
        return;
      }
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
        record("network-request", "fail", `[${peer}] ${request.method()} ${url}`);
      }
    });
    page.on("websocket", (socket) => {
      const url = socket.url();
      const phase = collaborationPhaseForSocket(url);
      if (phase === undefined) return;
      if (isMainCollaborationSocket(url)) mainSocketPeers.get(phase)?.add(peer);
      record("websocket", "pass", `[${peer}] OPEN ${url}`);
    });
  };
  observePage(pageA, "peer A");
  observePage(pageB, "peer B");

  const waitForCleanEditor = async (page: Page): Promise<void> => {
    await Promise.all([
      page.locator(EDITOR_SELECTOR).waitFor({ state: "visible" }),
      page.locator(`${EDITOR_SELECTOR} > *`).first().waitFor(),
      page.getByRole("button", { name: "Disconnect from a collaborative editing server" }).waitFor(),
    ]);
    await waitForEditorText(page, "");
  };

  const waitForCleanJoin = async (): Promise<void> => {
    await Promise.all([waitForCleanEditor(pageA), waitForCleanEditor(pageB)]);
  };

  const openFreshRoom = async (url: string): Promise<void> => {
    await pageA.goto(url, { waitUntil: "domcontentloaded" });
    await waitForCleanEditor(pageA);
    await pageB.goto(url, { waitUntil: "domcontentloaded" });
    await waitForCleanJoin();
  };

  const joinFreshLifecyclePhase = async (phase: Exclude<CollaborationPhase, "undo">): Promise<void> => {
    const url = collaborationUrl(phase);
    const room = collaborationRoom(phase);
    await perform(`${phase}-join`, `[peers A+B] opened fresh room ${room} at ${url}`, async () => {
      await openFreshRoom(url);
    });
    await perform(
      `${phase}-baseline`,
      (texts) =>
        `[peers A+B] typed a clean converged baseline in ${room}; observed peer A=${stableStringify(texts.peerA)} peer B=${stableStringify(texts.peerB)}`,
      async () => {
        const editor = pageA.locator(EDITOR_SELECTOR);
        await editor.click();
        await editor.pressSequentially(BOTH_PEERS_TEXT, { delay: 8 });
        return waitForPeerTexts(pageA, pageB, BOTH_PEERS_TEXT);
      }
    );
  };

  try {
    const url = collaborationUrl("undo");
    const room = collaborationRoom("undo");
    await perform("goto", `[peers A+B] ${url} room=${room}`, async () => {
      await openFreshRoom(url);
    });
    await perform("collaboration-join", `[peers A+B] connected to ${room}`, waitForCleanJoin);

    const editorA = pageA.locator(EDITOR_SELECTOR);
    const editorB = pageB.locator(EDITOR_SELECTOR);
    await perform(
      "history-boundary",
      `[peer A] pinned Yjs UndoManager closed the completed bootstrap capture before local typing`,
      () => stopCollaborationUndoCapture(pageA)
    );
    await perform("type", `[peer A] keyboard typed ${stableStringify(PEER_A_TEXT)}`, async () => {
      await editorA.click();
      await editorA.pressSequentially(PEER_A_TEXT, { delay: 8 });
      await waitForEditorText(pageA, PEER_A_TEXT);
    });
    await perform(
      "history-boundary",
      `[peer A] pinned Yjs UndoManager closed peer A's local typing capture before peer B edited`,
      () => stopCollaborationUndoCapture(pageA)
    );
    await perform("peer-observe", `[peer B] observed peer A text ${stableStringify(PEER_A_TEXT)}`, () =>
      waitForEditorText(pageB, PEER_A_TEXT)
    );

    await perform("type", `[peer B] keyboard appended ${stableStringify(` ${PEER_B_TEXT}`)}`, async () => {
      await editorB.click();
      await editorB.press("Control+End");
      await editorB.pressSequentially(` ${PEER_B_TEXT}`, { delay: 8 });
      await waitForEditorText(pageB, BOTH_PEERS_TEXT);
    });
    await perform("peer-observe", `[peer A] observed peer B edit ${stableStringify(BOTH_PEERS_TEXT)}`, () =>
      waitForEditorText(pageA, BOTH_PEERS_TEXT)
    );
    await perform(
      "merged-node-structure",
      (structures) =>
        `[peers A+B] peer B's append occupied peer A's existing simple TextNode before undo: peer A=${stableStringify(structures.peerA)} peer B=${stableStringify(structures.peerB)}`,
      () => assertPeerStructures(pageA, pageB, { paragraphs: 1, textNodes: 1 })
    );

    await perform("keyboard-select", `[peer A] selected peer B text with Control+Shift+ArrowLeft`, async () => {
      await editorA.focus();
      await editorA.press("Control+End");
      await editorA.press("Control+Shift+ArrowLeft");
    });
    await perform(
      "remote-presence",
      (presence) =>
        `[peer B] rendered peer A cursor/presence label=${stableStringify(presence.label)} color=${stableStringify(presence.color)} selected-highlight-ranges=${presence.selectedHighlightRanges} legacy-selection-rects=${presence.legacySelectionRects}`,
      () => waitForRemotePresence(pageB)
    );
    await screenshot(pageB, "peer B", "peer-b-observes-peer-a-presence");

    await perform(
      "keyboard-undo",
      (texts) =>
        `[peer A] Control+Z on the merged TextNode removed peer A's tracked capture together with peer B's untracked append; observed peer A=${stableStringify(texts.peerA)} peer B=${stableStringify(texts.peerB)}`,
      async () => {
        await pageA.locator('button[aria-label="Undo"]:not([disabled])').waitFor();
        await editorA.press("Control+Z");
        const texts = await waitForPeerTexts(pageA, pageB, "");
        await assertPeerStructures(pageA, pageB, { paragraphs: 1, textNodes: 0 });
        return texts;
      }
    );
    await screenshot(pageB, "peer B", "peer-a-local-undo-result");
    await perform(
      "history-boundary",
      `[peer A] pinned Yjs UndoManager closed the merged-node undo before the separate-paragraph case`,
      () => stopCollaborationUndoCapture(pageA)
    );
    await perform(
      "undo-case-reset",
      (texts) =>
        `[peers A+B] reset the separate-paragraph undo case to peer A=${stableStringify(texts.peerA)} peer B=${stableStringify(texts.peerB)}`,
      () => replaceSharedText(pageA, pageB, PEER_A_TEXT)
    );
    await perform(
      "history-boundary",
      `[peer A] pinned Yjs UndoManager closed peer A's reset capture before peer B created a separate paragraph`,
      () => stopCollaborationUndoCapture(pageA)
    );
    await perform(
      "type",
      `[peer B] keyboard created a separate paragraph containing ${stableStringify(PEER_B_TEXT)}`,
      async () => {
        await editorB.click();
        await editorB.press("Control+End");
        await editorB.press("Enter");
        await editorB.pressSequentially(PEER_B_TEXT, { delay: 8 });
        await waitForPeerTexts(pageA, pageB, BOTH_PEERS_TEXT);
      }
    );
    await perform(
      "separate-paragraph-structure",
      (structures) =>
        `[peers A+B] peer edits occupied separate paragraphs/TextNodes before local-only undo: peer A=${stableStringify(structures.peerA)} peer B=${stableStringify(structures.peerB)}`,
      () => assertPeerStructures(pageA, pageB, { paragraphs: 2, textNodes: 2 })
    );
    await perform(
      "keyboard-undo-separate-paragraph",
      (texts) =>
        `[peer A] Control+Z removed peer A's local TextNode and preserved peer B's separate paragraph; observed peer A=${stableStringify(texts.peerA)} peer B=${stableStringify(texts.peerB)}`,
      async () => {
        await pageA.locator('button[aria-label="Undo"]:not([disabled])').waitFor();
        await editorA.press("Control+Z");
        const texts = await waitForPeerTexts(pageA, pageB, PEER_B_TEXT);
        await assertPeerStructures(pageA, pageB, { paragraphs: 2, textNodes: 1 });
        return texts;
      }
    );
    await perform(
      "keyboard-redo",
      (texts) =>
        `[peer A] Control+Y restored peer A's separate-paragraph insertion while preserving peer B's paragraph; observed peer A=${stableStringify(texts.peerA)} peer B=${stableStringify(texts.peerB)}`,
      async () => {
        await pageA.locator('button[aria-label="Redo"]:not([disabled])').waitFor();
        await editorA.press("Control+Y");
        const texts = await waitForPeerTexts(pageA, pageB, BOTH_PEERS_TEXT);
        await assertPeerStructures(pageA, pageB, { paragraphs: 2, textNodes: 2 });
        return texts;
      }
    );

    await perform(
      "phase-reset",
      (texts) =>
        `[peers A+B] the pinned Playground's first Control+A replaced only peer A's current paragraph and preserved peer B's separate paragraph; observed peer A=${stableStringify(texts.peerA)} peer B=${stableStringify(texts.peerB)}`,
      async () => {
        await editorA.click();
        await editorA.press("Control+Home");
        await editorA.press("Control+A");
        await editorA.pressSequentially(BOTH_PEERS_TEXT, { delay: 8 });
        const texts = await waitForPeerTexts(pageA, pageB, BLOCK_SCOPED_REPLACEMENT_TEXT);
        await assertPeerStructures(pageA, pageB, { paragraphs: 2, textNodes: 2 });
        return texts;
      }
    );

    await joinFreshLifecyclePhase("clipboard");
    await perform(
      "clipboard-copy",
      `[peer A] keyboard selected and copied peer B text from the fresh clipboard-room baseline`,
      async () => {
        await editorA.focus();
        await editorA.press("Control+End");
        await editorA.press("Control+Shift+ArrowLeft");
        await editorA.press("Control+C");
      }
    );
    await perform("clipboard-paste", `[peer A] keyboard pasted copied peer B text at the document end`, async () => {
      await editorA.press("Control+End");
      await editorA.pressSequentially(" ");
      await editorA.press("Control+V");
      await waitForPeerTexts(pageA, pageB, CLIPBOARD_PASTED_TEXT);
    });
    await perform(
      "keyboard-delete",
      (texts) =>
        `[peer A] pressed Backspace six times and restored peer A=${stableStringify(texts.peerA)} peer B=${stableStringify(texts.peerB)}`,
      async () => {
        await editorA.focus();
        await editorA.press("Control+End");
        for (let index = 0; index < 6; index += 1) await editorA.press("Backspace");
        return waitForPeerTexts(pageA, pageB, BOTH_PEERS_TEXT);
      }
    );

    await joinFreshLifecyclePhase("offline");
    await perform(
      "set-offline",
      `[peer B] browser context set offline; the existing socket stayed logically connected and the pinned UI remained at Disconnect`,
      async () => {
        await contextB.setOffline(true);
        await pageB.waitForTimeout(500);
        await pageB.getByRole("button", { name: "Disconnect from a collaborative editing server" }).waitFor();
      }
    );
    await perform(
      "offline-edit",
      `[peer A] continued typing ${stableStringify(` ${OFFLINE_TEXT}`)} while peer B was offline`,
      async () => {
        await editorA.click();
        await editorA.press("Control+End");
        await editorA.pressSequentially(` ${OFFLINE_TEXT}`, { delay: 8 });
        await waitForEditorText(pageA, RECONNECTED_TEXT);
      }
    );
    await perform("offline-isolation", `[peer B] remained at the pre-disconnect text while offline`, async () => {
      await pageB.waitForTimeout(500);
      await assertEditorText(pageB, BOTH_PEERS_TEXT);
    });
    await screenshot(pageB, "peer B", "peer-b-offline-stale-document");

    await perform("set-online", `[peer B] browser context restored network connectivity`, () =>
      contextB.setOffline(false)
    );
    await perform(
      "reconnect-convergence",
      `[peers A+B] reconnected and converged to ${stableStringify(RECONNECTED_TEXT)}`,
      async () => {
        await pageB
          .getByRole("button", { name: "Disconnect from a collaborative editing server" })
          .waitFor({ timeout: 45_000 });
        await Promise.all([waitForEditorText(pageA, RECONNECTED_TEXT), waitForEditorText(pageB, RECONNECTED_TEXT)]);
      }
    );

    await joinFreshLifecyclePhase("export");
    await perform("serialize-export", `[peer A] exported a converged .lexical document`, async () => {
      const [download] = await Promise.all([
        pageA.waitForEvent("download"),
        pageA.getByRole("button", { name: "Export editor state to JSON" }).click(),
      ]);
      const target = resolve(ENTRY_DIRECTORY, `peer-a-converged-${safeName(download.suggestedFilename())}`);
      await download.saveAs(target);
      if (!target.endsWith(".lexical")) throw new Error(`Expected a .lexical export, received ${target}`);
      const serialized = await readFile(target, "utf8");
      JSON.parse(serialized);
      for (const token of [PEER_A_TEXT, PEER_B_TEXT]) {
        if (!serialized.includes(token)) throw new Error(`Export does not contain ${stableStringify(token)}`);
      }
    });

    await joinFreshLifecyclePhase("narrow");
    await perform("set-viewport", `[peer B] viewport set to ${NARROW_VIEWPORT.width}x${NARROW_VIEWPORT.height}`, () =>
      pageB.setViewportSize(NARROW_VIEWPORT)
    );
    await joinFreshLifecyclePhase("keyboard");
    await perform(
      "keyboard-focus",
      `[peer B] keyboard focused the narrow editor and moved to the document end`,
      async () => {
        await editorB.focus();
        await editorB.press("Control+End");
        const focused = await editorB.evaluate((element) => element === document.activeElement);
        if (!focused) throw new Error("The collaborative editor did not retain keyboard focus");
      }
    );
    await perform(
      "keyboard-select",
      `[peer A] selected text so peer B could observe presence at narrow width`,
      async () => {
        await editorA.focus();
        await editorA.press("Control+End");
        await editorA.press("Control+Shift+ArrowLeft");
      }
    );
    await perform("remote-presence", `[peer B] remote cursor/selection remained rendered at narrow width`, async () => {
      await waitForRemotePresence(pageB);
    });
    await screenshot(pageB, "peer B", "peer-b-narrow-reconnected-presence");
    await joinFreshLifecyclePhase("touch");
    await perform(
      "touch-disconnect",
      `[peer B] tapped the labeled narrow-width collaboration disconnect control`,
      async () => {
        const button = pageB.getByRole("button", { name: "Disconnect from a collaborative editing server" });
        await button.scrollIntoViewIfNeeded();
        const box = await button.boundingBox();
        if (box === null) throw new Error("The collaboration disconnect control has no touch target");
        await pageB.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await pageB.getByRole("button", { name: "Connect to a collaborative editing server" }).waitFor();
      }
    );
    await perform(
      "touch-reconnect",
      (texts) =>
        `[peer B] tapped the labeled collaboration reconnect control and reconverged; observed peer A=${stableStringify(texts.peerA)} peer B=${stableStringify(texts.peerB)}`,
      async () => {
        const button = pageB.getByRole("button", { name: "Connect to a collaborative editing server" });
        await button.scrollIntoViewIfNeeded();
        const box = await button.boundingBox();
        if (box === null) throw new Error("The collaboration reconnect control has no touch target");
        await pageB.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await pageB
          .getByRole("button", { name: "Disconnect from a collaborative editing server" })
          .waitFor({ timeout: 45_000 });
        return waitForPeerTexts(pageA, pageB, BOTH_PEERS_TEXT);
      }
    );
  } catch (error) {
    record(
      "exercise-abort",
      "skipped",
      `[peers A+B] unexpected runner failure stopped remaining steps: ${errorMessage(error)}`
    );
  } finally {
    const joinedPhaseRooms = COLLABORATION_PHASES.filter((phase) => mainSocketPeers.get(phase)?.size === 2);
    const socketPassed = joinedPhaseRooms.length === COLLABORATION_PHASES.length;
    record(
      "websocket-summary",
      socketPassed ? "pass" : "fail",
      `[peers A+B] both peers opened ${joinedPhaseRooms.length}/${COLLABORATION_PHASES.length} phase main sockets under ${COLLAB_ENDPOINT}/playground/${COLLAB_ID_PREFIX}-<phase>/main`
    );
    const networkPassed = capabilityRequests.length === 0;
    record(
      "network-summary",
      networkPassed ? "pass" : "fail",
      `none: ${capabilityRequests.length} capability request(s); ${baselineEgressRequests.length} baseline egress request(s)`
    );
    await Promise.allSettled([contextA.close(), contextB.close()]);
    await browser.close();
    await writeObservations(observations);
  }

  console.log(`${failed ? "FAIL" : "PASS"} ${ENTRY_ID}`);
  console.log(`Evidence: ${ENTRY_DIRECTORY}`);
  if (failed) process.exitCode = 1;
};

const main = async (): Promise<void> => {
  const releaseLock = await acquireRunLock();
  try {
    await runExercise();
  } finally {
    await releaseLock();
  }
};

await main().catch((error: unknown) => {
  console.error(errorMessage(error));
  process.exitCode = error instanceof ConcurrentRunnerError ? 2 : 1;
});
