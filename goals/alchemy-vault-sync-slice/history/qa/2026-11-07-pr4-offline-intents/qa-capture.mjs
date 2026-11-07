// Vault-sync offline intents QA capture (alchemy-vault-sync-slice PR 4).
// The real renderer and sidecar run; only the vault-sync RPCs are answered by
// this harness, switchable between "online", "offline" (connection refused)
// and "online" with conflict reviews rejected (typed VaultSyncActionError).
import * as NodeFS from "node:fs";
import { chromium } from "playwright";

const ROUND = process.env.QA_ROUND ?? "1";
const URL = process.env.QA_URL ?? "https://professional-desktop-vsoi.beep.localhost:1355/";
const COLLECTOR = process.env.QA_COLLECTOR_URL;
const SESSION_ID = process.env.QA_SESSION_ID;
const VIDEO_DIR = process.env.QA_VIDEO_DIR;
const CURSOR = process.env.QA_CURSOR !== "0";
const BEACON = process.env.QA_BEACON !== "0";
const OUT = new globalThis.URL(`./qa/round-${ROUND}/`, import.meta.url).pathname;
NodeFS.mkdirSync(OUT, { recursive: true });

const manifest = { round: ROUND, url: URL, scenarios: [] };
const scenario = (name) => {
  const record = { name, screenshots: [], assertions: [], consoleErrors: [], notes: [] };
  manifest.scenarios.push(record);
  return record;
};

// ---------------------------------------------------------------- RPC stub

const conflict = {
  conflictKind: "remoteEdit",
  createdAt: 1,
  createdByPrincipal: { kind: "System", component: "Runtime" },
  entityType: "DocumentsSyncConflict",
  id: 41,
  localRelPath: "matters/synthetic/engagement-letter.docx",
  orgId: 1,
  provider: "box",
  publicId: "documents_sync_conflict_c1",
  remoteEventId: "event-c1",
  remoteId: "remote-1",
  remotePayload: { eventType: "ITEM_MODIFY" },
  resolutionStatus: "open",
  rowVersion: 1,
  schemaVersion: "0.0.0",
  source: "System",
  syncItemId: 1,
  updatedAt: 1,
  updatedByPrincipal: { kind: "System", component: "Runtime" },
  workspaceId: 1,
};
const status = (pendingItems) => ({
  conflictItems: 1,
  connected: true,
  disconnectReason: null,
  currentItems: 3,
  cursorPosition: null,
  errorItems: 0,
  failedOperations: 0,
  openConflicts: 1,
  pendingItems,
  probedAt: null,
  provider: "box",
  queuedOperations: 0,
});

/** "online" | "offline" | "reject-reviews" */
let mode = "online";
const received = [];
const SYNC_TAGS = new Set([
  "GetWorkspaceVault",
  "WatchVaultSyncStatus",
  "GetVaultSyncStatus",
  "ListVaultSyncConflicts",
  "TriggerVaultSync",
  "MarkVaultSyncConflictReviewed",
]);
const exit = (requestId, value) => ({ _tag: "Exit", requestId, exit: { _tag: "Success", value } });
const fail = (requestId, message) => ({
  _tag: "Exit",
  requestId,
  exit: { _tag: "Failure", cause: [{ _tag: "Fail", error: { _tag: "VaultSyncActionError", message } }] },
});
const answer = (request) => {
  const { id, tag, payload } = request;
  switch (tag) {
    case "GetWorkspaceVault":
      return [exit(id, { vaultRootPath: "/home/operator/Vault", workspaceId: 1 })];
    case "WatchVaultSyncStatus":
      return [{ _tag: "Chunk", requestId: id, values: [status(0)] }, exit(id, null)];
    case "GetVaultSyncStatus":
      return [exit(id, status(0))];
    case "ListVaultSyncConflicts":
      return [exit(id, [conflict])];
    case "TriggerVaultSync":
      return [exit(id, status(2))];
    case "MarkVaultSyncConflictReviewed":
      return mode === "reject-reviews"
        ? [fail(id, "The conflict changed on Box since it was listed. Review it again.")]
        : [exit(id, { ...conflict, resolutionStatus: "reviewed" })];
  }
  return [];
};

// ---------------------------------------------------------------- browser

const VIEWPORT = { width: 1280, height: 960 };
const browser = await chromium.launch();
const recordStartHintEpochMs = Date.now();
const context = await browser.newContext({
  viewport: VIEWPORT,
  ignoreHTTPSErrors: true,
  ...(VIDEO_DIR ? { recordVideo: { dir: VIDEO_DIR, size: VIEWPORT } } : {}),
});
if (VIDEO_DIR) {
  NodeFS.mkdirSync(VIDEO_DIR, { recursive: true });
  NodeFS.writeFileSync(`${VIDEO_DIR}/record-hint.json`, JSON.stringify({ recordStartHintEpochMs }));
}
const page = await context.newPage();

await page.route("**/rpc**", async (route) => {
  const body = route.request().postData() ?? "";
  const requests = body
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line))
    .filter((message) => message._tag === "Request");
  if (requests.length === 0 || !requests.every((request) => SYNC_TAGS.has(request.tag))) return route.fallback();
  for (const request of requests) received.push({ mode, tag: request.tag, payload: request.payload });
  // The sidecar is gone: every vault-sync call fails at the transport, workspace reads included.
  if (mode === "offline" && requests.some((request) => request.tag !== "GetWorkspaceVault"))
    return route.abort("connectionrefused");
  const lines = requests.flatMap(answer).map((message) => JSON.stringify(message));
  return route.fulfill({ status: 200, contentType: "application/ndjson", body: `${lines.join("\n")}\n` });
});

if (COLLECTOR) {
  const witnessSource = await (await fetch(`${COLLECTOR}/witness.js`)).text();
  const config = { collectorUrl: COLLECTOR, sessionId: SESSION_ID ?? `round-${ROUND}`, cursor: CURSOR, beacon: false };
  await page.addInitScript({ content: `window.__BEEP_QA__ = ${JSON.stringify(config)};\n${witnessSource}` });
}
const mark = async (label) => {
  if (COLLECTOR) await page.evaluate((l) => window.__beepQa?.mark(l), label).catch(() => {});
};

const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text().slice(0, 300));
});
const drainConsole = (record) => {
  // Aborted vault-sync calls log "Failed to load resource" by design while offline.
  record.consoleErrors.push(...consoleErrors.splice(0).filter((text) => !text.includes("net::ERR_CONNECTION_REFUSED")));
};
// Panel-only screenshots keep the judge payload small enough to carry every scenario's end state.
const shot = async (record, label) => {
  const file = `${record.name}--${label}.png`;
  await page.locator("[data-testid=vault-sync-panel]").screenshot({ path: `${OUT}${file}` });
  record.screenshots.push(file);
};
const assert = (record, name, ok, detail = "") => record.assertions.push({ name, ok, detail });
const settle = (ms = 700) => page.waitForTimeout(ms);
const panel = page.locator("[data-testid=vault-sync-panel]");
const testId = (id) => panel.locator(`[data-testid=${id}]`);
const textOf = async (id) => ((await testId(id).count()) > 0 ? ((await testId(id).first().textContent()) ?? "") : "");
const waitText = async (id, needle, timeout = 8000) =>
  page
    .waitForFunction(
      ([sel, n]) => (document.querySelector(sel)?.textContent ?? "").includes(n),
      [`[data-testid=vault-sync-panel] [data-testid=${id}]`, needle],
      { timeout }
    )
    .then(() => true)
    .catch(() => false);
/** Move the real mouse to an element slowly, then click it. */
const clickSlowly = async (locator) => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
  await settle(400);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};
const openVaultSync = async () => {
  await page.getByRole("button", { name: "Vault sync" }).first().click();
  await panel.waitFor({ timeout: 30000 });
  // Park the pointer beside the panel so later clicks do not sweep the animated graph.
  const box = await panel.boundingBox();
  await page.mouse.move(box.x - 20, box.y + box.height / 2);
  await settle(1200);
};

await page.goto(URL, { waitUntil: "load", timeout: 90000 });
await page.evaluate(() => window.localStorage.removeItem("beep.professional.vault-sync.intents.v1"));
await openVaultSync();
if (COLLECTOR && BEACON) {
  await page.evaluate(() => window.__beepQa?.runSyncBeacon());
  await settle(1600);
}

{
  const record = scenario("online-baseline");
  await mark("scenario:online-baseline");
  assert(record, "connected badge", (await textOf("vault-sync-connection")).includes("connected"));
  assert(record, "one open conflict row", (await testId("vault-sync-conflict-row").count()) === 1);
  assert(record, "no intents queued", (await testId("vault-sync-intents").count()) === 0);
  await shot(record, "online");
  drainConsole(record);
}

{
  const record = scenario("offline-trigger-queued");
  mode = "offline";
  await mark("scenario:offline-trigger-queued");
  await clickSlowly(testId("vault-sync-trigger"));
  const clickedAt = Date.now();
  assert(record, "queued notice", await waitText("vault-sync-offline-notice", "Sidecar offline"));
  record.notes.push(`queued after ${Date.now() - clickedAt} ms`);
  if (process.env.QA_DEBUG) console.log(`queued after ${Date.now() - clickedAt} ms`);
  assert(record, "one action waiting", (await textOf("vault-sync-intents")).includes("1 action waiting"));
  assert(record, "trigger reads Sync queued", (await textOf("vault-sync-trigger")).includes("Sync queued"));
  assert(record, "pill reads sidecar offline", (await textOf("vault-sync-connection")).includes("sidecar offline"));
  assert(record, "queued ops shows local waiting", (await textOf("vault-sync-count-queued-ops")).includes("+1 waiting"));
  await shot(record, "queued");
  drainConsole(record);
}

{
  const record = scenario("offline-review-predicted");
  await mark("scenario:offline-review-predicted");
  await clickSlowly(testId("vault-sync-conflict-review"));
  assert(record, "row predicted reviewed", await waitText("vault-sync-conflict-row", "Reviewed, waiting to sync"));
  assert(record, "two actions waiting", await waitText("vault-sync-intents", "2 actions waiting"));
  assert(
    record,
    "open conflicts shows pending review",
    (await textOf("vault-sync-count-open-conflicts")).includes("1 reviewed, waiting to sync")
  );
  await shot(record, "predicted");
  drainConsole(record);
}

{
  const record = scenario("offline-reload-keeps-queue");
  await mark("scenario:offline-reload-keeps-queue");
  await page.reload({ waitUntil: "load" });
  await openVaultSync();
  const persisted = await page.evaluate(() => window.localStorage.getItem("beep.professional.vault-sync.intents.v1"));
  assert(record, "queue persisted across reload", (persisted ?? "").includes("review"), (persisted ?? "").slice(0, 120));
  assert(record, "two actions still waiting", await waitText("vault-sync-intents", "2 actions waiting"));
  assert(record, "one offline notice, no red status error", (await panel.locator(".text-destructive").count()) === 0);
  assert(record, "pending review row kept", await waitText("vault-sync-conflict-pending", "Reviewed, waiting to sync"));
  assert(record, "row keeps its path", (await textOf("vault-sync-conflict-row")).includes("engagement-letter.docx"));
  assert(record, "pill reads sidecar offline", (await textOf("vault-sync-connection")).includes("sidecar offline"));
  await shot(record, "reloaded");
  drainConsole(record);
}

{
  const record = scenario("reconnect-replay-and-revert");
  mode = "reject-reviews";
  await mark("scenario:reconnect-replay-and-revert");
  // The panel's replay loop runs every two seconds: no click needed.
  const reverted = await waitText("vault-sync-conflict-error", "Review it again", 15000);
  assert(record, "rejection message shown on its row", reverted);
  assert(record, "no sync-level error for the review", (await testId("vault-sync-error").count()) === 0);
  // The message must be readable, not clipped by the dock area: scroll it into view and compare boxes.
  const error = testId("vault-sync-conflict-error").first();
  await error.scrollIntoViewIfNeeded().catch(() => {});
  const visible = await error.evaluate((node) => {
    const own = node.getBoundingClientRect();
    let parent = node.parentElement;
    while (parent && getComputedStyle(parent).overflowY !== "auto") parent = parent.parentElement;
    const clip = (parent ?? document.documentElement).getBoundingClientRect();
    return own.top >= clip.top && own.bottom <= clip.bottom;
  }).catch(() => false);
  assert(record, "rejection message fully visible", visible);
  await settle(1500);
  assert(record, "intent queue drained", (await testId("vault-sync-intents").count()) === 0);
  assert(record, "review prediction reverted", (await testId("vault-sync-conflict-review").count()) === 1);
  assert(record, "status reconnected after replay", await waitText("vault-sync-connection", "connected", 6000) && !(await textOf("vault-sync-connection")).includes("disconnected"), await textOf("vault-sync-connection"));
  const triggers = received.filter((entry) => entry.tag === "TriggerVaultSync");
  const ids = new Set(triggers.map((entry) => entry.payload.intentId));
  assert(
    record,
    "trigger replayed with one intent id",
    triggers.length >= 2 && ids.size === 1 && triggers.at(-1).mode === "reject-reviews",
    JSON.stringify(triggers.map((entry) => [entry.mode, entry.payload.intentId]))
  );
  await shot(record, "reverted");
  drainConsole(record);
}

if (process.env.QA_DEBUG) console.log(JSON.stringify(received.map((entry) => [entry.mode, entry.tag])));
await mark("capture:end");
await page.evaluate(() => window.__beepQa?.flush()).catch(() => {});
await context.close();
await browser.close();
NodeFS.writeFileSync(`${OUT}manifest.json`, JSON.stringify(manifest, null, 2));
const failures = manifest.scenarios.flatMap((record) =>
  record.assertions.filter((entry) => !entry.ok).map((entry) => `${record.name}: ${entry.name} ${entry.detail}`)
);
for (const failure of failures) console.log(`FAIL ${failure}`);
console.log(failures.length === 0 ? "CAPTURE-GREEN" : `CAPTURE-FAILURES: ${failures.length}`);
