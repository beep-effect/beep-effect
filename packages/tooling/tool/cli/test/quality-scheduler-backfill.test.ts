import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  AdmissionAttemptVerdict,
  AdmissionBackfillContext,
  AdmissionBackfillPolicy,
  AdmissionBackfillView,
  AdmissionConfig,
  AdmissionEtaEstimator,
  AdmissionJournalAdmitted,
  AdmissionJournalEnqueued,
  AdmissionJournalReleased,
  AdmissionJournalReleasedV3,
  AdmissionJournalWithdrawn,
  AdmissionRequest,
  AdmissionUsageInterval,
  admissionAttemptVerdict,
  admissionBackfillOrder,
  admissionConditionalDeadline,
  admissionEtaFor,
  admissionProtocolPath,
  admissionTokenWeight,
  admissionUsageIntervals,
  currentEffectiveUserIdOption,
  MemoryStats,
  noAdmissionOriginGate,
  noteAdmissionWaitForTesting,
  provideRuntimeRootForTesting,
  QualityScheduler,
  QualitySchedulerLive,
  RuntimeRootChoice,
  readAdmissionJournalHistory,
  readAdmissionJournalHistorySince,
  selfMayAttemptForTesting,
  YeetAdmissionLease,
  YeetAdmissionTicket,
} from "@beep/repo-cli/test/RepoRun";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";

// SCHE-06 in the live scheduler (goals/local-proof-under-ten PLAN slice 12): the
// verdict ported from the ciops lab, applied after the deployed skippable checks
// behind the protocol's backfill and fairness gates, which default off.

const policyOf = (fields: Partial<Parameters<typeof AdmissionBackfillPolicy.make>[0]> = {}) =>
  AdmissionBackfillPolicy.make({
    capacityTokens: 10,
    publishAgingMillis: 120_000,
    protectAfterMillis: 120_000,
    fairnessWindowMillis: 1_800_000,
    promotionOverheadMillis: 5_000,
    backfill: "easy",
    fairness: "off",
    ...fields,
  });

const ticketOf = (fields: Partial<Parameters<typeof YeetAdmissionTicket.make>[0]> & { readonly nonce: string }) =>
  YeetAdmissionTicket.make({
    schemaVersion: "yeet-admission-ticket/v1",
    pid: 1,
    procStart: "1",
    kind: "full-proof",
    weightTokens: 3,
    priority: "verify",
    originKey: "origin-alice",
    checkoutRoot: `/repo/${fields.nonce}`,
    branch: "feat/alice",
    enqueuedAtMillis: 0,
    heartbeatAtMillis: 0,
    ...fields,
  });

const leaseOf = (fields: Partial<Parameters<typeof YeetAdmissionLease.make>[0]> & { readonly nonce: string }) =>
  YeetAdmissionLease.make({
    schemaVersion: "yeet-admission-lease/v1",
    pid: 2,
    procStart: "2",
    kind: "full-proof",
    weightTokens: 3,
    priority: "verify",
    originKey: "origin-another",
    checkoutRoot: `/repo/lease-${fields.nonce}`,
    branch: "feat/another",
    command: "bun run beep yeet verify",
    startedAt: "1970-01-01T00:00:00.000Z",
    admittedAtMillis: 0,
    heartbeatAtMillis: 0,
    ...fields,
  });

const viewOf = (
  nowMillis: number,
  tickets: ReadonlyArray<YeetAdmissionTicket>,
  leases: ReadonlyArray<YeetAdmissionLease> = [],
  finished: ReadonlyArray<AdmissionUsageInterval> = []
) => AdmissionBackfillView.make({ nowMillis, tickets, leases, finished });

const verdictOf = (view: AdmissionBackfillView, policy: AdmissionBackfillPolicy, nonce: string) =>
  AdmissionAttemptVerdict.match(admissionAttemptVerdict(view, policy, nonce), {
    Attempt: ({ route }) => route,
    Wait: ({ reason }) => reason,
  });

describe("SCHE-06 verdict on live tickets", () => {
  // A 7-token lease due at 60 s blocks an 8-token head; a 3-token ticket fits beside the lease.
  const blocker = leaseOf({ nonce: "lease-1", weightTokens: 7, etaMillis: O.some(60_000) });
  const head = ticketOf({ nonce: "head", weightTokens: 8, enqueuedAtMillis: 0 });
  const small = (etaMillis: O.Option<number>, nonce = "small") =>
    ticketOf({ nonce, weightTokens: 3, enqueuedAtMillis: 1_000, etaMillis });

  it("lets the head attempt when it fits and makes it wait for capacity when it does not", () => {
    strictEqual(verdictOf(viewOf(10_000, [head]), policyOf(), "head"), "head");
    strictEqual(verdictOf(viewOf(10_000, [head], [blocker]), policyOf(), "head"), "capacity");
    strictEqual(verdictOf(viewOf(10_000, [head], [blocker]), policyOf(), "absent"), "not-queued");
    // The data-last forms read the same view.
    const view = viewOf(10_000, [head]);
    assertTrue(AdmissionAttemptVerdict.guards.Attempt(admissionAttemptVerdict(policyOf(), "head")(view)));
    deepStrictEqual(admissionBackfillOrder(policyOf())(view), [head]);
    assertNone(admissionConditionalDeadline(policyOf(), "absent")(view));
  });

  it("backfills a ticket whose ETA ends before the head's projected start, and no other", () => {
    const now = 10_000;
    strictEqual(verdictOf(viewOf(now, [head, small(O.some(40_000))], [blocker]), policyOf(), "small"), "backfill");
    strictEqual(
      verdictOf(viewOf(now, [head, small(O.some(60_000))], [blocker]), policyOf(), "small"),
      "ends-after-head-start"
    );
    strictEqual(verdictOf(viewOf(now, [head, small(O.none())], [blocker]), policyOf(), "small"), "eta-unknown");
    strictEqual(
      verdictOf(viewOf(now, [head, small(O.some(40_000))], [blocker]), policyOf({ backfill: "off" }), "small"),
      "behind-head"
    );
    // A ticket that fits but would overrun capacity waits for it.
    const wide = ticketOf({ nonce: "wide", weightTokens: 4, enqueuedAtMillis: 1_000, etaMillis: O.some(1_000) });
    strictEqual(verdictOf(viewOf(now, [head, wide], [blocker]), policyOf(), "wide"), "capacity");
  });

  it("stops backfill when a lease overran or never declared its ETA, and while a bound is breached", () => {
    const overrun = leaseOf({ nonce: "lease-1", weightTokens: 7, etaMillis: O.some(5_000) });
    const silent = leaseOf({ nonce: "lease-1", weightTokens: 7 });
    strictEqual(verdictOf(viewOf(10_000, [head, small(O.some(1_000))], [overrun]), policyOf(), "small"), "eta-unknown");
    strictEqual(verdictOf(viewOf(10_000, [head, small(O.some(1_000))], [silent]), policyOf(), "small"), "eta-unknown");
    const breached = ticketOf({ nonce: "head", weightTokens: 8, deadlineMillis: O.some(9_000) });
    strictEqual(
      verdictOf(viewOf(10_000, [breached, small(O.some(1_000))], [blocker]), policyOf(), "small"),
      "backfill-disabled"
    );
  });

  it("projects the head's start across several leases and breaks enqueue ties by nonce", () => {
    // 4 tokens end at 30 s and 3 at 60 s: an 8-token head fits after both, at 60 s.
    const leases = [
      leaseOf({ nonce: "late", weightTokens: 3, etaMillis: O.some(60_000) }),
      leaseOf({ nonce: "early", weightTokens: 4, etaMillis: O.some(30_000) }),
    ];
    const twinB = ticketOf({ nonce: "twin-b", weightTokens: 3, enqueuedAtMillis: 1_000, etaMillis: O.some(45_000) });
    const twinA = ticketOf({ nonce: "twin-a", weightTokens: 3, enqueuedAtMillis: 1_000, etaMillis: O.some(45_000) });
    const view = viewOf(10_000, [head, twinB, twinA], leases);
    strictEqual(verdictOf(view, policyOf(), "twin-a"), "backfill");
    strictEqual(verdictOf(view, policyOf(), "twin-b"), "behind-backfill");
  });

  it("backfills in queue order, never shortest-job-first", () => {
    const first = small(O.some(40_000), "first");
    const second = ticketOf({ nonce: "second", weightTokens: 3, enqueuedAtMillis: 2_000, etaMillis: O.some(1_000) });
    const view = viewOf(10_000, [head, first, second], [blocker]);
    strictEqual(verdictOf(view, policyOf(), "first"), "backfill");
    strictEqual(verdictOf(view, policyOf(), "second"), "behind-backfill");
  });

  it("keeps protected tickets in enqueue order ahead of newer publish work", () => {
    const old = ticketOf({ nonce: "old", enqueuedAtMillis: 0 });
    const fresh = ticketOf({ nonce: "fresh", priority: "publish", enqueuedAtMillis: 100_000 });
    const order = (now: number) => A.map(admissionBackfillOrder(viewOf(now, [fresh, old]), policyOf()), (t) => t.nonce);
    deepStrictEqual(order(60_000), ["fresh", "old"]);
    deepStrictEqual(order(130_000), ["old", "fresh"]);
  });

  it("orders unprotected tickets by recent origin, then checkout, usage under fairness", () => {
    const busy = ticketOf({ nonce: "busy", originKey: "origin-alice", enqueuedAtMillis: 0 });
    const quiet = ticketOf({ nonce: "quiet", originKey: "origin-ada", enqueuedAtMillis: 10_000 });
    const finished = [
      AdmissionUsageInterval.make({
        originKey: "origin-alice",
        checkoutRoot: "/repo/busy",
        weightTokens: 3,
        admittedAtMillis: 0,
        releasedAtMillis: 50_000,
      }),
    ];
    const order = (fairness: "off" | "origin-checkout") =>
      A.map(
        admissionBackfillOrder(viewOf(60_000, [busy, quiet], [], finished), policyOf({ fairness })),
        (t) => t.nonce
      );
    deepStrictEqual(order("off"), ["busy", "quiet"]);
    deepStrictEqual(order("origin-checkout"), ["quiet", "busy"]);
    // Within one origin the checkout with less usage leads.
    const sibling = ticketOf({ nonce: "sibling", originKey: "origin-alice", enqueuedAtMillis: 10_000 });
    const lease = leaseOf({ nonce: "running", originKey: "origin-alice", checkoutRoot: "/repo/busy" });
    deepStrictEqual(
      A.map(
        admissionBackfillOrder(viewOf(60_000, [busy, sibling], [lease]), policyOf({ fairness: "origin-checkout" })),
        (t) => t.nonce
      ),
      ["sibling", "busy"]
    );
  });

  it("stamps the conditional bound only when every ETA it reads is declared", () => {
    const lone = ticketOf({ nonce: "lone" });
    assertSome(admissionConditionalDeadline(viewOf(120_000, [lone]), policyOf(), "lone"), 125_000);
    const behind = ticketOf({ nonce: "behind", enqueuedAtMillis: 1_000 });
    const withEta = ticketOf({ nonce: "lone", etaMillis: O.some(30_000) });
    // 120 s + 50 s left on the lease + 30 s ahead + two overheads.
    assertSome(
      admissionConditionalDeadline(
        viewOf(130_000, [withEta, behind], [leaseOf({ nonce: "l", etaMillis: O.some(180_000) })]),
        policyOf(),
        "behind"
      ),
      130_000 + 50_000 + 30_000 + 10_000
    );
    assertNone(admissionConditionalDeadline(viewOf(130_000, [lone, behind]), policyOf(), "behind"));
    assertNone(admissionConditionalDeadline(viewOf(130_000, [lone]), policyOf(), "absent"));
  });
});

const admittedRow = (nonce: string, kind: "full-proof" | "review-fix", admittedAtMillis: number) =>
  AdmissionJournalAdmitted.make({
    schemaVersion: "yeet-admission-journal/v1",
    nonce,
    pid: 3,
    procStart: "3",
    kind,
    weightTokens: admissionTokenWeight(kind),
    priority: "verify",
    originKey: "origin-ada",
    enqueuedAtMillis: admittedAtMillis,
    admittedAtMillis,
  });

const releasedRow = (nonce: string, releasedAtMillis: number) =>
  AdmissionJournalReleasedV3.make({
    schemaVersion: "yeet-admission-journal/v3",
    nonce,
    pid: 3,
    releasedAtMillis,
    checkoutRoot: "/repo/ada",
    branch: "feat/ada",
  });

const enqueuedRow = (nonce: string) =>
  AdmissionJournalEnqueued.make({
    schemaVersion: "yeet-admission-journal/v3",
    nonce,
    pid: 3,
    procStart: "3",
    kind: "full-proof",
    priority: "verify",
    originKey: "origin-ada",
    checkoutRoot: "/repo/ada-enqueued",
    branch: "feat/ada",
    enqueuedAtMillis: 0,
    weightTokens: 3,
  });

describe("SCHE-06 journal readings", () => {
  const estimator = AdmissionEtaEstimator.make({ quantilePermille: 900, minSamples: 5, historyLimit: 200 });
  const holds = [10_000, 20_000, 30_000, 40_000, 50_000, 60_000, 70_000, 80_000, 90_000, 100_000];
  const events = A.flatMap(holds, (hold, index) => [
    admittedRow(`n-${index}`, "full-proof", index * 1_000_000),
    releasedRow(`n-${index}`, index * 1_000_000 + hold),
  ]);

  it("declares the p90 of a kind's holds once five exist, and nothing before", () => {
    assertSome(admissionEtaFor(events, "full-proof", estimator), 90_000);
    assertNone(admissionEtaFor(events, "review-fix", estimator));
    assertNone(admissionEtaFor(A.take(events, 8), "full-proof", estimator));
    // Only the latest holds count: the last two are 90 s and 100 s.
    const recent = AdmissionEtaEstimator.make({ quantilePermille: 500, minSamples: 1, historyLimit: 2 });
    assertSome(admissionEtaFor("full-proof", recent)(events), 90_000);
  });

  it("counts only released leases still inside the fairness window", () => {
    const withdrawn = AdmissionJournalWithdrawn.make({
      schemaVersion: "yeet-admission-journal/v3",
      nonce: "w",
      pid: 3,
      procStart: "3",
      kind: "full-proof",
      priority: "verify",
      originKey: "origin-ada",
      checkoutRoot: "/repo/w",
      branch: "feat/w",
      enqueuedAtMillis: 0,
      withdrawnAtMillis: 1,
    });
    const intervals = admissionUsageIntervals(
      [enqueuedRow("n-9"), ...events, withdrawn, admittedRow("open", "full-proof", 0)],
      9_100_000,
      1_000_000
    );
    deepStrictEqual(
      A.map(intervals, (interval) => [interval.checkoutRoot, interval.admittedAtMillis, interval.releasedAtMillis]),
      [["/repo/ada-enqueued", 9_000_000, 9_100_000]]
    );
    deepStrictEqual(
      admissionUsageIntervals(9_100_000, 1_000_000)(events),
      admissionUsageIntervals(events, 9_100_000, 1_000_000)
    );
    // A legacy release row carries no checkout; the interval still counts for its origin.
    const legacy = AdmissionJournalReleased.make({
      schemaVersion: "yeet-admission-journal/v1",
      nonce: "legacy",
      pid: 3,
      releasedAtMillis: 50,
    });
    deepStrictEqual(
      A.map(
        admissionUsageIntervals(
          [
            AdmissionJournalEnqueued.make({ ...enqueuedRow("legacy"), checkoutRoot: "" }),
            admittedRow("legacy", "review-fix", 0),
            legacy,
          ],
          60,
          1_000
        ),
        (i) => [i.originKey, i.checkoutRoot]
      ),
      [["origin-ada", ""]]
    );
  });
});

// With both modes off the gated verdict is the deployed rule, on any small queue.
describe("SCHE-06 wait progress", () => {
  const progressRequest = AdmissionRequest.make({
    kind: "full-proof",
    weightTokens: 3,
    priority: "verify",
    originKey: "origin-alice",
    checkoutRoot: "/repo/alice",
    branch: "feat/alice",
    command: "bun run beep yeet verify",
  });
  const older = ticketOf({ nonce: "older", enqueuedAtMillis: 0 });
  const self = ticketOf({ nonce: "self", enqueuedAtMillis: 1_000 });
  const progressLine = Effect.fn("progressLine")(
    function* (order: O.Option<ReadonlyArray<YeetAdmissionTicket>>) {
      yield* noteAdmissionWaitForTesting(
        progressRequest,
        self,
        0,
        { escalated: 0, lastProgressMillis: -60_000 },
        AdmissionConfig.make({}),
        {
          availableGib: 10,
          capacityTokens: 3,
          deadlineMillis: O.none(),
          order,
          nowMillis: 30_000,
          state: {
            dead: [],
            deadLeases: [],
            deadTickets: [],
            leases: [],
            quarantined: [],
            tickets: [
              { path: "older", ticket: older },
              { path: "self", ticket: self },
            ],
          },
        }
      );
      const lines = yield* TestConsole.logLines;
      return A.join(A.filter(lines, S.is(S.String)), "\n");
    },
    Effect.provideServiceEffect(Console.Console, TestConsole.make)
  );

  it.effect("reports the queue position in the order the verdict uses", () =>
    Effect.gen(function* () {
      const deployed = yield* progressLine(O.none());
      expect(deployed).toContain("position 2");
      // Under fairness the scan may put this ticket first; the progress line follows it.
      const fair = yield* progressLine(O.some([self, older]));
      expect(fair).toContain("position 1");
    })
  );
});

it.layer(Layer.mergeAll(MemoryFileSystem.layer, Path.layer), { timeout: "20 seconds" })(
  "SCHE-06 windowed journal read",
  (it) => {
    it.effect("reads only the archive segments whose day ends after the instant", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = "/run/sche-06-window/admit";
        const archive = path.join(root, "journal-archive");
        yield* fs.makeDirectory(archive, { recursive: true });
        const day = 86_400_000;
        // One admitted and one released row per nonce, in the bytes the journal writer emits.
        const rowsFor = (nonce: string, at: number) =>
          `{"_tag":"admission-admitted","schemaVersion":"yeet-admission-journal/v1","nonce":"${nonce}","pid":3,"procStart":"3","kind":"full-proof","weightTokens":3,"priority":"verify","originKey":"origin-ada","enqueuedAtMillis":${at},"admittedAtMillis":${at}}\n` +
          `{"checkoutRoot":"/repo/ada","branch":"feat/ada","_tag":"admission-released","schemaVersion":"yeet-admission-journal/v3","nonce":"${nonce}","pid":3,"releasedAtMillis":${at + 1_000}}\n`;
        const oldRows = rowsFor("old", 1_000);
        const recentRows = rowsFor("recent", 2 * day + 1_000);
        yield* fs.writeFileString(path.join(archive, "1970-01-01.ndjson"), oldRows);
        yield* fs.writeFileString(path.join(archive, "1970-01-03.ndjson"), recentRows);
        const recent = yield* readAdmissionJournalHistorySince(root, 2 * day);
        deepStrictEqual(A.dedupe(A.map(recent.events, (event) => event.nonce)), ["recent"]);
        deepStrictEqual(recent.archive.segments, ["1970-01-03.ndjson"]);
        const all = yield* readAdmissionJournalHistory(root);
        deepStrictEqual(A.dedupe(A.map(all.events, (event) => event.nonce)), ["old", "recent"]);
      })
    );

    it.effect("never opens an older segment: one that cannot be read fails only the full read", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = "/run/sche-06-window-unread/admit";
        const archive = path.join(root, "journal-archive");
        const day = 86_400_000;
        // A directory where a day segment belongs: any attempt to read it fails.
        yield* fs.makeDirectory(path.join(archive, "1970-01-01.ndjson"), { recursive: true });
        yield* fs.writeFileString(
          path.join(archive, "1970-01-03.ndjson"),
          `{"checkoutRoot":"/repo/ada","branch":"feat/ada","_tag":"admission-released","schemaVersion":"yeet-admission-journal/v3","nonce":"recent","pid":3,"releasedAtMillis":${2 * day + 1_000}}\n`
        );
        const recent = yield* readAdmissionJournalHistorySince(root, 2 * day);
        deepStrictEqual(
          [recent.archive.segments, recent.archivedRows, A.map(recent.events, (event) => event.nonce)],
          [["1970-01-03.ndjson"], 1, ["recent"]]
        );
        const full = yield* Effect.exit(readAdmissionJournalHistory(root));
        strictEqual(full._tag, "Failure");
      })
    );
  }
);

describe("SCHE-06 modes off equal the deployed self-selection", () => {
  const config = AdmissionConfig.make({});

  it("agrees on every seeded queue", () => {
    let seed = 7;
    const next = (bound: number): number => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed % bound;
    };
    for (let round = 0; round < 400; round++) {
      const tickets = A.makeBy(1 + next(5), (index) =>
        ticketOf({
          nonce: `t-${index}`,
          pid: 10 + index,
          kind: next(3) === 0 ? "review-fix" : "full-proof",
          weightTokens: 1 + next(6),
          priority: next(2) === 0 ? "publish" : "verify",
          checkoutRoot: `/repo/c-${next(3)}`,
          enqueuedAtMillis: next(300_000),
          blockedOnOriginAtMillis: next(4) === 0 ? 290_000 : 0,
        })
      );
      const leases = A.makeBy(next(4), (index) =>
        leaseOf({
          nonce: `l-${index}`,
          kind: next(2) === 0 ? "review-fix" : "full-proof",
          weightTokens: 1 + next(5),
          checkoutRoot: `/repo/c-${next(5)}`,
        })
      );
      const capacityTokens = 3 + next(8);
      for (const self of tickets) {
        const scan = { leases, tickets, capacityTokens, nowMillis: 300_000, config, self };
        expect(
          selfMayAttemptForTesting({
            ...scan,
            context: O.some(
              AdmissionBackfillContext.make({ policy: policyOf({ backfill: "off", capacityTokens }), finished: [] })
            ),
          }),
          `round ${round} ${self.nonce}`
        ).toBe(selfMayAttemptForTesting({ ...scan, context: O.none() }));
      }
    }
  });
});

const spawner = ScriptedSpawner.make(() => ({}));
const fixtureProcStart = "424242";
const procStatFixture = `${process.pid} (beep) S ${A.join(A.replicate("0", 18), " ")} ${fixtureProcStart} 0 0\n`;

const SchedulerTestLayer = Layer.mergeAll(
  MemoryFileSystem.layer,
  Path.layer,
  BunCrypto.layer,
  spawner.layer,
  Layer.succeed(
    MemoryStats,
    MemoryStats.of({ availableGib: Effect.succeed(50), totalGib: Effect.succeed(128), ceilingGib: Effect.succeed(128) })
  ),
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ BEEP_RUN_SCOPES: "0" })),
  QualitySchedulerLive
);

const prepareRoot = Effect.fn("AdmissionBackfillTest.prepareRoot")(function* (name: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const runtimeRoot = path.join("/run/sche-06", name);
  const root = path.join(runtimeRoot, "beep", "admit");
  yield* fs.makeDirectory(root, { recursive: true, mode: 0o700 });
  const uid = O.getOrElse(currentEffectiveUserIdOption(), () => 0);
  yield* fs.chown(root, uid, uid);
  yield* fs.makeDirectory(`/proc/${process.pid}`, { recursive: true });
  yield* fs.writeFileString(`/proc/${process.pid}/stat`, procStatFixture);
  return { root, choice: RuntimeRootChoice.make({ kind: "test-override", root: runtimeRoot }) };
});

const request = AdmissionRequest.make({
  kind: "full-proof",
  weightTokens: admissionTokenWeight("full-proof"),
  priority: "verify",
  originKey: "origin0sche06",
  checkoutRoot: "/repo/sche-06",
  branch: "feat/sche-06",
  command: "bun run beep yeet verify",
});

const decodeLease = S.decodeEffect(S.fromJsonString(YeetAdmissionLease));
const decodeTicket = S.decodeEffect(S.fromJsonString(YeetAdmissionTicket));

const admitAndReadLease = Effect.fn("AdmissionBackfillTest.admitAndReadLease")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const scheduler = yield* QualityScheduler;
  const leases = path.join(root, "leases");
  const text = yield* scheduler.admit(
    request,
    noAdmissionOriginGate,
    fs
      .readDirectory(leases)
      .pipe(Effect.flatMap((names) => fs.readFileString(path.join(leases, A.join(A.take(names, 1), "")))))
  );
  return Str.trim(text);
});

it.layer(SchedulerTestLayer, { concurrent: false, timeout: "20 seconds" })("backfill gates (SCHE-06)", (it) => {
  it.effect("keeps the backfill and fairness gates independent of the others, defaulting off", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const scheduler = yield* QualityScheduler;
      const { root, choice } = yield* prepareRoot("protocol");
      yield* Effect.gen(function* () {
        const steps = [
          yield* scheduler.protocol,
          yield* scheduler.setBackfillProtocol("easy"),
          yield* scheduler.setPressureProtocol("on"),
          yield* scheduler.setFairnessProtocol("origin-checkout"),
          yield* scheduler.setBackfillProtocol("off"),
        ];
        deepStrictEqual(
          A.map(steps, (protocol) => [protocol.pressure, protocol.backfill, protocol.fairness]),
          [
            ["off", "off", "off"],
            ["off", "easy", "off"],
            ["on", "easy", "off"],
            ["on", "easy", "origin-checkout"],
            ["on", "off", "origin-checkout"],
          ]
        );
        // A marker an older checkout writes has neither key, which turns both modes off again.
        const protocolPath = yield* admissionProtocolPath(root);
        yield* fs.writeFileString(protocolPath, '{"schemaVersion":"yeet-admission-protocol/v2","eviction":"on"}\n');
        const older = yield* scheduler.protocol;
        deepStrictEqual([older.backfill, older.fairness], ["off", "off"]);
      }).pipe(provideRuntimeRootForTesting(choice));
    })
  );

  it.effect("declares a journal-derived ETA on the ticket and lease only under the backfill gate", () =>
    Effect.gen(function* () {
      const scheduler = yield* QualityScheduler;
      const { choice, root } = yield* prepareRoot("eta");
      yield* Effect.gen(function* () {
        // Five recorded full proofs give the kind an ETA; with the gate off none is declared.
        const history = yield* Effect.forEach(
          A.makeBy(5, () => root),
          admitAndReadLease,
          { concurrency: 1 }
        );
        const offLeases = yield* Effect.forEach(history, (text) => decodeLease(text), { concurrency: 1 });
        assertTrue(A.every(offLeases, (lease) => O.isNone(lease.etaMillis)));
        expect(A.getUnsafe(history, 0)).not.toContain("etaMillis");
        yield* scheduler.setBackfillProtocol("easy");
        const onLease = yield* admitAndReadLease(root).pipe(Effect.flatMap((text) => decodeLease(text)));
        assertSome(onLease.etaMillis, 1);
        yield* scheduler.setFairnessProtocol("origin-checkout");
        const fairLease = yield* admitAndReadLease(root).pipe(Effect.flatMap((text) => decodeLease(text)));
        assertSome(fairLease.etaMillis, 1);
      }).pipe(provideRuntimeRootForTesting(choice));
    })
  );
});

// Its own block, so the TestClock it adjusts is not shared with another case.
it.layer(SchedulerTestLayer, { concurrent: false, timeout: "20 seconds" })(
  "backfill deadline stamp (SCHE-06)",
  (it) => {
    it.effect("stamps the bound on the waiting ticket once it is protected", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const scheduler = yield* QualityScheduler;
        const { choice, root } = yield* prepareRoot("deadline");
        yield* Effect.gen(function* () {
          yield* scheduler.setBackfillProtocol("easy");
          const reached = yield* Deferred.make<void>();
          const busyGate = {
            tryAcquire: Deferred.succeed(reached, undefined).pipe(Effect.as(O.none<string>())),
            tryAcquireFallback: Effect.succeedNone,
            release: () => Effect.void,
          };
          const fiber = yield* scheduler.admit(request, busyGate, Effect.void).pipe(Effect.forkChild);
          yield* Deferred.await(reached);
          const queue = path.join(root, "queue");
          const readTicket = fs.readDirectory(queue).pipe(
            Effect.flatMap((names) => fs.readFileString(path.join(queue, A.join(A.take(names, 1), "")))),
            Effect.flatMap((text) => decodeTicket(Str.trim(text)))
          );
          const early = yield* readTicket;
          assertNone(early.deadlineMillis);
          yield* TestClock.adjust("130 seconds");
          const stamped = yield* readTicket;
          // Protected at 120 s on an idle machine: the bound is one heartbeat of overhead later.
          assertSome(stamped.deadlineMillis, 125_000);
          yield* TestClock.adjust("10 seconds");
          const kept = yield* readTicket;
          assertSome(kept.deadlineMillis, 125_000);
          yield* Fiber.interrupt(fiber);
        }).pipe(provideRuntimeRootForTesting(choice));
      })
    );
  }
);
