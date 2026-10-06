import { Sha256Hex } from "@beep/schema/Sha256";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { DateTime, Effect, FileSystem, Layer, Path } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Hex from "effect/encoding/Hex";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { decodeAdmissionPolicyParams } from "@/projection/AboxPolicy";
import {
  EvidenceMode,
  EvidencePaths,
  generateLiveReplayEvidence,
  generateReplayEvidence,
  LiveEvidencePaths,
  LiveEvidenceSummary,
  manifestWindowDisagreements,
  readManifestWindowMembers,
  renderLiveReplayEvidence,
  run4FleetCanonicalWindow,
  run4FleetLiveEvidencePaths,
} from "@/projection/Evidence";
import { PosInt } from "@/projection/PosInt";
import {
  buildLiveReplayReport,
  Cq009Reading,
  Cq009Scope,
  CustodyCensus,
  decodeAdmissionJournal,
  FirstChoiceAgreement,
  MismatchAttribution,
  ReplayOptions,
  ReplayReport,
  ReplayTerminalTag,
  ReplayWindow,
  ReplayWindowError,
  replayAdmissionJournal,
} from "@/projection/Replay";
import {
  AdmissionOwnerRefVariant,
  admissionRowCustody,
  PolicyDecodeError,
  ProjectionMismatch,
} from "@/projection/Schemas";
import type { LiveReplayReport } from "@/projection/Replay";

const repoRoot = "../../..";
const pin = "explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/run4-fleet";
const aboxPath = "explorations/beep-ci-operational-ontology/ontology/extraction/s6/graphs/abox.ttl";
const goldenJournalPath =
  "explorations/beep-ci-operational-ontology/ontology/extraction/s6/snapshot/raw/journal.ndjson";
const committedEvidencePath = `${repoRoot}/${run4FleetLiveEvidencePaths.evidence}`;
const surrogateFixturePath = "test/fixtures/admission-journal-v3-surrogate.ndjson";
const mixedFixturePath = "test/fixtures/admission-journal-v3-mixed.ndjson";
const releasedOnlyFixturePath = "test/fixtures/admission-journal-released-only-chain.ndjson";
const trimmedEvictionFixturePath = "test/fixtures/admission-journal-trimmed-lease-eviction.ndjson";
const fixtureJournalSha256 = Sha256Hex.make("a".repeat(64));
const frozenRecord = "# committed live evidence — must survive every check run\n";
// Golden render bytes at 801020f3dc (before the W5 widening), recomputed from that tree.
const goldenRenderSha256 = "624bab058087d54693e1c4b0b4c6d83ed45bf381520664acbb1568f5b4d30699";

const PlatformLive = Layer.mergeAll(BunFileSystem.layer, BunCrypto.layer, BunPath.layer);

// Independent literal restatement of the pin, cross-checked against the shared
// constants the evidence script and the end-to-end tests run on.
const pinnedWindowLiteral = ReplayWindow.make({
  firstRetainedInstant: DateTime.makeUnsafe("2026-10-01T09:32:09.602Z"),
  lastRetainedInstant: DateTime.makeUnsafe("2026-10-06T01:51:50.495Z"),
  preV3Chains: S.Natural.make(3),
  journalSha256: Sha256Hex.make("b691253cee4b7859dea4b3b40f339dfd7c68c6cbdfc0326e594230a6aac5df6d"),
  manifestSha256: Sha256Hex.make("7d22f37b879ce6e43d6dc41c5c388ea53f837e07abf1c2ad4e5a21cfeda5be6c"),
});

const pinnedPathsLiteral = LiveEvidencePaths.make({
  repoRoot,
  abox: aboxPath,
  goldenJournal: goldenJournalPath,
  journal: `${pin}/admission/canonical/journal.ndjson`,
  manifest: `${pin}/MANIFEST.yaml`,
  evidence: "goals/ciops-ontology-pipeline/research/s7-live-replay-evidence.md",
});

const encodeWindow = S.encodeEffect(ReplayWindow);

const fixtureWindow = (preV3Chains: number, lastRetainedMillis = 1600, firstRetainedMillis = 1000) =>
  ReplayWindow.make({
    firstRetainedInstant: DateTime.makeUnsafe(firstRetainedMillis),
    lastRetainedInstant: DateTime.makeUnsafe(lastRetainedMillis),
    preV3Chains: S.Natural.make(preV3Chains),
    journalSha256: fixtureJournalSha256,
    manifestSha256: Sha256Hex.make("b".repeat(64)),
  });

const windowed = (window: ReplayWindow) => ReplayOptions.make({ window: O.some(window) });

const readText = Effect.fn("LiveReplayTest.readText")(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFileString(path)
    .pipe(Effect.mapError(() => PolicyDecodeError.make({ message: `Unable to read ${path}.` })));
});

const readPolicy = Effect.fn("LiveReplayTest.readPolicy")(function* () {
  return yield* decodeAdmissionPolicyParams(yield* readText(`${repoRoot}/${aboxPath}`));
});

// A scratch evidence file holding a frozen record, addressed repo-relative like every live path.
const scratchEvidence = Effect.fn("LiveReplayTest.scratchEvidence")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "ciops-live-evidence-" });
  const absolute = path.join(directory, "s7-live-replay-evidence.md");
  yield* fs.writeFileString(absolute, frozenRecord);
  const paths = LiveEvidencePaths.make({
    ...run4FleetLiveEvidencePaths,
    evidence: path.relative(path.resolve(repoRoot), absolute),
  });
  return { absolute, paths } as const;
});

const replaySource = Effect.fn("LiveReplayTest.replaySource")(function* (source: string, options?: ReplayOptions) {
  const policy = yield* readPolicy();
  const events = yield* decodeAdmissionJournal(source);
  const report = yield* replayAdmissionJournal(policy, events, "fixture-policy", fixtureJournalSha256, options);
  return { events, report } as const;
});

const replayFixture = Effect.fn("LiveReplayTest.replayFixture")(function* (path: string, options?: ReplayOptions) {
  return yield* replaySource(yield* readText(path), options);
});

const v3Base = {
  schemaVersion: "yeet-admission-journal/v3",
  nonce: "row",
  checkoutRoot: "<fleet>/fixture",
  branch: "",
};
const queued = { kind: "review-fix", priority: "verify", originKey: "", enqueuedAtMillis: 1 };

// One row per v3 class: the enqueue/withdrawal rows inherit the invariant through
// `.extend`, the release and eviction rows through a re-applied spread check.
const v3Shapes: ReadonlyArray<Record<string, unknown>> = [
  { ...queued, _tag: "admission-enqueued", weightTokens: 1 },
  { ...queued, _tag: "admission-withdrawn", withdrawnAtMillis: 2 },
  { _tag: "admission-released", releasedAtMillis: 2 },
  { _tag: "admission-lease-evicted", evictedAtMillis: 2, reason: "owner-dead-or-reused", lastHeartbeatAtMillis: 1 },
  { _tag: "admission-ticket-evicted", evictedAtMillis: 2, reason: "queued-submitter-death" },
];

// One row per v1/v2 class that carries owner members.
const legacyShapes: ReadonlyArray<Record<string, unknown>> = [
  {
    schemaVersion: "yeet-admission-journal/v1",
    _tag: "admission-admitted",
    ...queued,
    weightTokens: 1,
    admittedAtMillis: 2,
  },
  { schemaVersion: "yeet-admission-journal/v1", _tag: "admission-released", releasedAtMillis: 2 },
  {
    schemaVersion: "yeet-admission-journal/v2",
    _tag: "admission-lease-evicted",
    evictedAtMillis: 2,
    reason: "owner-dead-or-reused",
  },
  {
    schemaVersion: "yeet-admission-journal/v2",
    _tag: "admission-ticket-evicted",
    evictedAtMillis: 2,
    reason: "queued-submitter-death",
  },
];

const surrogateOwner: { readonly ownerRef: string; readonly ownerRefVariant: AdmissionOwnerRefVariant } = {
  ownerRef: "0a1b2c3d4e5f",
  ownerRefVariant: AdmissionOwnerRefVariant.Enum.pid_pair,
};

// A live owner: classes without a procStart member ignore it as an excess key.
const liveOwner = { pid: 7, procStart: "proc-start" };

const sameCheckout: MismatchAttribution = MismatchAttribution.Enum["same-checkout-active-lease"];
const unattributed: MismatchAttribution = MismatchAttribution.Enum.unattributed;
const outOfScope: Cq009Scope = Cq009Scope.Enum["temporally-out-of-scope"];

const ndjson = (rows: ReadonlyArray<Record<string, unknown>>): string =>
  A.join(
    A.map(rows, (row) => JSON.stringify(row)),
    "\n"
  );

const decodeRow = (row: Record<string, unknown>) => decodeAdmissionJournal(ndjson([row]));

const v3Released = (nonce: string, releasedAtMillis: number, checkout: Record<string, string>) => ({
  ...surrogateOwner,
  ...checkout,
  schemaVersion: "yeet-admission-journal/v3",
  _tag: "admission-released",
  nonce,
  branch: "",
  releasedAtMillis,
});

const fixtureMismatch = (eventIndex: number, projectedNonce: string, activeGrantNonces: ReadonlyArray<string>) =>
  ProjectionMismatch.make({
    eventIndex: S.Natural.make(eventIndex),
    admittedAtMillis: S.Natural.make(1000),
    expectedNonce: "recorded",
    projectedNonce,
    pendingCount: S.Natural.make(2),
    activeTokenTotal: S.Natural.make(1),
    requestWeightTokens: PosInt.make(1),
    wouldBeActiveTokenTotal: PosInt.make(2),
    capacityMaxTokens: PosInt.make(10),
    activeGrantNonces,
  });

// A pin-manifest excerpt with exactly the members the live run reads.
const syntheticManifest = (members: {
  readonly label: string;
  readonly first: string;
  readonly last: string;
  readonly releasedOnly: string;
  readonly preV3: O.Option<string>;
}): string =>
  A.join(
    [
      "admission_roots:",
      `- label: ${members.label}`,
      "  status: present",
      "  window:",
      `    first_retained_row_instant: '${members.first}'`,
      `    last_retained_row_instant: '${members.last}'`,
      `    released_only_chains: ${members.releasedOnly}`,
      "    count_basis: released_only_chains is this root's pre-v3 class count in loss_population (no retained",
      "      enqueue)",
      "loss_population:",
      "  chain_counts:",
      ...O.match(members.preV3, { onNone: A.empty<string>, onSome: (value) => [`    pre-v3: ${value}`] }),
    ],
    "\n"
  );

const agreeingManifest = {
  label: "canonical",
  first: "2026-10-01T09:32:09.602Z",
  last: "2026-10-06T01:51:50.495Z",
  releasedOnly: "3",
  preV3: O.some("3"),
};

const cq009SectionOf = (rendered: string): string => A.join(A.drop(Str.split(rendered, "## CQ-009"), 1), "");

const fixtureSummary = (live: LiveReplayReport) =>
  LiveEvidenceSummary.make({
    live,
    golden: FirstChoiceAgreement.make({ agreed: S.Natural.make(41), total: S.Natural.make(41) }),
    goldenJournalSha256: "golden-fixture",
    policySha256: "policy-fixture",
  });

describe("@beep/ciops live replay", () => {
  it.layer(PlatformLive, { timeout: "20 seconds" })((it) => {
    it.effect("effect 4.0.0 keeps a class struct check through .extend but not through a .fields spread", () =>
      Effect.gen(function* () {
        class Base extends S.Class<Base>("LiveReplayTest/Base")(
          S.Struct({ a: S.Finite }).check(S.makeFilter((base: { readonly a: number }) => base.a > 0))
        ) {}
        class Extended extends Base.extend<Extended>("LiveReplayTest/Extended")({ b: S.Finite }) {}
        class Spread extends S.Class<Spread>("LiveReplayTest/Spread")({ ...Base.fields, b: S.Finite }) {}

        const extended = S.decodeOption(Extended)({ a: 0, b: 1 });
        const spreadDecoded = O.isSome(S.decodeOption(Spread)({ a: 0, b: 1 }));

        assertNone(extended);
        assertTrue(spreadDecoded);
        return yield* Effect.void;
      })
    );

    it.effect("decodes surrogate rows as surrogate custody and pid rows as live custody", () =>
      Effect.gen(function* () {
        const surrogate = yield* decodeAdmissionJournal(yield* readText(surrogateFixturePath));
        const mixed = yield* decodeAdmissionJournal(yield* readText(mixedFixturePath));

        expect(surrogate).toHaveLength(9);
        expect(A.every(surrogate, (event) => admissionRowCustody(event) === "surrogate")).toBe(true);
        expect(A.map(mixed, admissionRowCustody)).toStrictEqual([
          "live",
          "redacted",
          "live",
          "redacted",
          "redacted",
          "live",
          "live",
          "redacted",
          "redacted",
          "live",
          "redacted",
          "redacted",
          "live",
        ]);
      })
    );

    it.effect("replays surrogate rows exactly like their live-custody twin: the fold is custody-blind", () =>
      Effect.gen(function* () {
        const source = yield* readText(surrogateFixturePath);
        const twinSource = A.join(
          A.map(
            Str.split(source, "\n"),
            Str.replace(/"ownerRef":"[0-9a-f]{12}","ownerRefVariant":"[a-z_]+"/, '"pid":7,"procStart":"twin-start"')
          ),
          "\n"
        );
        const surrogate = yield* replaySource(source);
        const twin = yield* replaySource(twinSource);
        const verdictKey = (report: ReplayReport) =>
          A.map(report.verdicts, (verdict) => [
            verdict.eventIndex,
            verdict.expectedNonce,
            verdict.projectedNonce,
            verdict.outcome,
          ]);

        expect(Str.includes("ownerRef")(twinSource)).toBe(false);
        expect(A.every(surrogate.events, (event) => admissionRowCustody(event) === "surrogate")).toBe(true);
        expect(A.every(twin.events, (event) => admissionRowCustody(event) === "live")).toBe(true);
        expect(A.length(surrogate.report.verdicts)).toBe(2);
        expect(verdictKey(twin.report)).toStrictEqual(verdictKey(surrogate.report));
        expect([twin.report.eventCount, twin.report.admittedCount, twin.report.releasedCount]).toStrictEqual([
          surrogate.report.eventCount,
          surrogate.report.admittedCount,
          surrogate.report.releasedCount,
        ]);
        expect(twin.report.passed).toBe(surrogate.report.passed);
        expect(surrogate.report.skippedRows).toHaveLength(0);
      })
    );

    it.effect("fails typed on a v3 row with both or neither of pid and ownerRef, on every v3 class", () =>
      Effect.gen(function* () {
        for (const shape of v3Shapes) {
          const live = yield* decodeRow({ ...v3Base, ...shape, ...liveOwner });
          const surrogate = yield* decodeRow({ ...v3Base, ...shape, ...surrogateOwner });
          const both = yield* Effect.flip(decodeRow({ ...v3Base, ...shape, ...surrogateOwner, ...liveOwner }));
          const neither = yield* Effect.flip(decodeRow({ ...v3Base, ...shape }));

          expect(A.map(live, admissionRowCustody)).toStrictEqual(["live"]);
          expect(A.map(surrogate, admissionRowCustody)).toStrictEqual(["surrogate"]);
          assertInstanceOf(both, PolicyDecodeError);
          assertInstanceOf(neither, PolicyDecodeError);
        }
      })
    );

    it.effect("fails typed on a v3 queued row whose procStart is not paired with its pid", () =>
      Effect.gen(function* () {
        for (const shape of A.take(v3Shapes, 2)) {
          const pidOnly = yield* Effect.flip(decodeRow({ ...v3Base, ...shape, pid: 7 }));
          const surrogateWithProcStart = yield* Effect.flip(
            decodeRow({ ...v3Base, ...shape, ...surrogateOwner, procStart: "proc-start" })
          );

          assertInstanceOf(pidOnly, PolicyDecodeError);
          assertInstanceOf(surrogateWithProcStart, PolicyDecodeError);
        }
      })
    );

    it.effect("fails typed on a doubled owner in every v1/v2 class and accepts either owner alone", () =>
      Effect.gen(function* () {
        for (const shape of legacyShapes) {
          const row = { ...shape, nonce: "row" };
          const live = yield* decodeRow({ ...row, ...liveOwner });
          const surrogate = yield* decodeRow({ ...row, ...surrogateOwner });
          const redacted = yield* decodeRow(row);
          const both = yield* Effect.flip(decodeRow({ ...row, ...surrogateOwner, ...liveOwner }));

          expect(A.map([...live, ...surrogate, ...redacted], admissionRowCustody)).toStrictEqual([
            "live",
            "surrogate",
            "redacted",
          ]);
          assertInstanceOf(both, PolicyDecodeError);
        }
      })
    );

    it.effect("fails typed on unpaired owner variants and doubled or missing checkouts", () =>
      Effect.gen(function* () {
        const released = { ...v3Base, _tag: "admission-released", releasedAtMillis: 2, ...surrogateOwner };
        const failures = yield* Effect.forEach(
          [
            { ...released, ownerRefVariant: undefined },
            { ...released, checkoutRef: "9f8e7d6c5b4a" },
            { ...released, checkoutRoot: undefined },
            { ...legacyShapes[0], nonce: "row", ownerRef: "0a1b2c3d4e5f" },
          ],
          (row) => Effect.flip(decodeRow(row))
        );
        const checkoutRefOnly = yield* decodeRow({ ...released, checkoutRoot: undefined, checkoutRef: "9f8e7d6c5b4a" });

        expect(failures).toHaveLength(4);
        for (const failure of failures) {
          assertInstanceOf(failure, PolicyDecodeError);
        }
        expect(A.map(checkoutRefOnly, admissionRowCustody)).toStrictEqual(["surrogate"]);
      })
    );

    it.effect("fails typed on a released-only chain without a window", () =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(replayFixture(releasedOnlyFixturePath));

        assertInstanceOf(failure, PolicyDecodeError);
        expect(failure.message).toContain('Release nonce "released-only" had no active admitted pair.');
      })
    );

    it.effect("skips the released-only row in place under a window and censors earlier verdicts", () =>
      Effect.gen(function* () {
        const { events, report } = yield* replayFixture(releasedOnlyFixturePath, windowed(fixtureWindow(2)));
        const live = buildLiveReplayReport(events, report, fixtureWindow(2));

        expect(report.eventCount).toBe(6);
        expect(report.admittedCount).toBe(2);
        expect(report.releasedCount).toBe(2);
        const expectedSkips: ReadonlyArray<readonly [number, string, ReplayTerminalTag]> = [
          [1, "released-only", ReplayTerminalTag.Enum["admission-released"]],
        ];
        expect(A.map(report.skippedRows, (row) => [row.eventIndex, row.nonce, row.tag])).toStrictEqual(expectedSkips);
        expect(A.map(report.verdicts, (verdict) => verdict.eventIndex)).toStrictEqual([0, 4]);
        expect(A.map(report.verdicts, (verdict) => verdict.ledgerCensored)).toStrictEqual([true, false]);
        expect(live.enqueueLessAdmissions).toBe(1);
        expect(live.agreement.agreed).toBe(2);
        expect(live.cq009.scope).toBe(Cq009Scope.Enum["pre-929-rows-present"]);
        expect(live.cq009.preCutRows).toBe(6);
      })
    );

    it.effect("skips a trimmed lease eviction in place without counting it as a pre-v3 chain", () =>
      Effect.gen(function* () {
        const { events, report } = yield* replayFixture(trimmedEvictionFixturePath, windowed(fixtureWindow(1)));
        const live = buildLiveReplayReport(events, report, fixtureWindow(1));
        const countFailure = yield* Effect.flip(replayFixture(trimmedEvictionFixturePath, windowed(fixtureWindow(2))));
        const expectedSkips: ReadonlyArray<readonly [number, string, ReplayTerminalTag]> = [
          [1, "evicted-only", ReplayTerminalTag.Enum["admission-lease-evicted"]],
        ];

        expect(A.map(report.skippedRows, (row) => [row.eventIndex, row.nonce, row.tag])).toStrictEqual(expectedSkips);
        expect([report.eventCount, report.admittedCount, report.releasedCount]).toStrictEqual([6, 2, 2]);
        expect(A.map(report.verdicts, (verdict) => verdict.eventIndex)).toStrictEqual([0, 4]);
        expect(A.map(report.verdicts, (verdict) => verdict.ledgerCensored)).toStrictEqual([true, false]);
        expect(live.enqueueLessAdmissions).toBe(1);
        assertInstanceOf(countFailure, ReplayWindowError);
        expect([countFailure.member, countFailure.expected, countFailure.actual]).toStrictEqual([
          "preV3Chains",
          "2",
          "1",
        ]);
      })
    );

    it.effect("fails typed on a windowed terminal row whose chain kept its enqueue but lost its admission", () =>
      Effect.gen(function* () {
        const enqueued = {
          ...v3Base,
          ...queued,
          ...surrogateOwner,
          _tag: "admission-enqueued",
          nonce: "lost-admission",
          enqueuedAtMillis: 1000,
          weightTokens: 1,
        };
        const source = ndjson([enqueued, v3Released("lost-admission", 1100, { checkoutRoot: "<fleet>/fixture" })]);
        const failure = yield* Effect.flip(replaySource(source, windowed(fixtureWindow(0, 1100))));

        assertInstanceOf(failure, PolicyDecodeError);
        expect(failure.message).toContain('Release nonce "lost-admission" had no active admitted pair.');
      })
    );

    it.effect("fails typed when a skipped release closes a chain the pre-v3 classifier rejects", () =>
      Effect.gen(function* () {
        const checkout = { checkoutRoot: "<fleet>/fixture" };
        const source = ndjson([
          v3Released("double-release", 1000, checkout),
          v3Released("double-release", 1100, checkout),
        ]);
        const failure = yield* Effect.flip(replaySource(source, windowed(fixtureWindow(0, 1100))));

        assertInstanceOf(failure, ReplayWindowError);
        expect([failure.member, failure.actual]).toStrictEqual(["skippedRows", "unclassified chain(s) double-release"]);
      })
    );

    it.effect("fails typed when the window's pre-v3 count, either instant or the digest disagree", () =>
      Effect.gen(function* () {
        const failureMember = (window: ReplayWindow) =>
          Effect.flip(replayFixture(releasedOnlyFixturePath, windowed(window))).pipe(
            Effect.map((failure) => [failure._tag, "member" in failure ? failure.member : failure.message])
          );
        const policy = yield* readPolicy();
        const events = yield* decodeAdmissionJournal(yield* readText(releasedOnlyFixturePath));
        const digestFailure = yield* Effect.flip(
          replayAdmissionJournal(policy, events, "fixture-policy", "c".repeat(64), windowed(fixtureWindow(2)))
        );
        const countFailure = yield* Effect.flip(replayFixture(releasedOnlyFixturePath, windowed(fixtureWindow(1))));

        assertInstanceOf(countFailure, ReplayWindowError);
        expect([countFailure.member, countFailure.expected, countFailure.actual]).toStrictEqual([
          "preV3Chains",
          "1",
          "2",
        ]);
        expect(yield* failureMember(fixtureWindow(2, 1700))).toStrictEqual([
          "ReplayWindowError",
          "lastRetainedInstant",
        ]);
        expect(yield* failureMember(fixtureWindow(2, 1600, 999))).toStrictEqual([
          "ReplayWindowError",
          "firstRetainedInstant",
        ]);
        expect(yield* failureMember(fixtureWindow(2, 1600, 1001))).toStrictEqual([
          "ReplayWindowError",
          "firstRetainedInstant",
        ]);
        assertInstanceOf(digestFailure, ReplayWindowError);
        expect(digestFailure.member).toBe("journalSha256");
      })
    );

    it.effect("decodes an ordered replay window and fails typed when the first instant follows the last", () =>
      Effect.gen(function* () {
        const decode = S.decodeUnknownEffect(ReplayWindow);
        const encoded = {
          firstRetainedInstant: "2026-10-01T00:00:00.000Z",
          lastRetainedInstant: "2026-10-01T00:00:00.001Z",
          preV3Chains: 0,
          journalSha256: "a".repeat(64),
          manifestSha256: "b".repeat(64),
        };
        const ordered = yield* decode(encoded);
        const reversed = yield* Effect.flip(
          decode({
            ...encoded,
            firstRetainedInstant: encoded.lastRetainedInstant,
            lastRetainedInstant: encoded.firstRetainedInstant,
          })
        );

        expect(ordered.preV3Chains).toBe(0);
        assertInstanceOf(reversed, S.SchemaError);
        expect(reversed.message).toContain("The first retained instant must not follow the last");
      })
    );

    it.effect("reads the pinned manifest's window and pre-v3 members line by line", () =>
      Effect.gen(function* () {
        const members = readManifestWindowMembers(yield* readText(`${repoRoot}/${pin}/MANIFEST.yaml`));

        assertSome(HashMap.get(members, "admission_roots[0].label"), "canonical");
        assertSome(
          HashMap.get(members, "admission_roots[0].window.first_retained_row_instant"),
          "2026-10-01T09:32:09.602Z"
        );
        assertSome(
          HashMap.get(members, "admission_roots[0].window.last_retained_row_instant"),
          "2026-10-06T01:51:50.495Z"
        );
        assertSome(HashMap.get(members, "admission_roots[0].window.released_only_chains"), "3");
        assertSome(HashMap.get(members, "loss_population.chain_counts.pre-v3"), "3");
      })
    );

    it.effect("reports every drifted manifest member, one member at a time and all at once", () =>
      Effect.gen(function* () {
        const membersOf = (manifest: string) =>
          A.map(manifestWindowDisagreements(manifest, run4FleetCanonicalWindow), (error) => error.member);
        const drifts: ReadonlyArray<readonly [Partial<typeof agreeingManifest>, string]> = [
          [{ label: "system-tmp" }, "admission_roots[0].label"],
          [{ first: "2026-10-01T09:32:09.603Z" }, "admission_roots[0].window.first_retained_row_instant"],
          [{ last: "2026-10-06T01:51:50.494Z" }, "admission_roots[0].window.last_retained_row_instant"],
          [{ releasedOnly: "2" }, "admission_roots[0].window.released_only_chains"],
          [{ preV3: O.some("2") }, "loss_population.chain_counts.pre-v3"],
          [{ preV3: O.none() }, "loss_population.chain_counts.pre-v3"],
        ];

        expect(membersOf(syntheticManifest(agreeingManifest))).toStrictEqual([]);
        for (const [drift, member] of drifts) {
          expect(membersOf(syntheticManifest({ ...agreeingManifest, ...drift }))).toStrictEqual([member]);
        }
        expect(
          membersOf(
            syntheticManifest({
              label: "system-tmp",
              first: "2026-10-01T09:32:09.603Z",
              last: "2026-10-06T01:51:50.494Z",
              releasedOnly: "2",
              preV3: O.none(),
            })
          )
        ).toStrictEqual(A.map(A.take(drifts, 5), ([, member]) => member));
        expect(
          A.map(
            manifestWindowDisagreements(run4FleetCanonicalWindow)(
              syntheticManifest({ ...agreeingManifest, preV3: O.none() })
            ),
            (error) => error.actual
          )
        ).toStrictEqual(["<absent>"]);
      })
    );

    it.effect.prop(
      "a manifest rendered from any replay window agrees with that window on every member",
      [Arbitrary.schema(ReplayWindow)],
      ([window]) =>
        Effect.gen(function* () {
          const manifest = syntheticManifest({
            label: "canonical",
            first: DateTime.formatIso(window.firstRetainedInstant),
            last: DateTime.formatIso(window.lastRetainedInstant),
            releasedOnly: `${window.preV3Chains}`,
            preV3: O.some(`${window.preV3Chains}`),
          });

          expect(manifestWindowDisagreements(manifest, window)).toStrictEqual([]);
          return yield* Effect.succeed(true);
        }),
      { arbitrary: fcRuns(64) }
    );

    it.effect("shares one pin constant set with the evidence script, equal to the literal pin", () =>
      Effect.gen(function* () {
        expect(yield* encodeWindow(run4FleetCanonicalWindow)).toStrictEqual(yield* encodeWindow(pinnedWindowLiteral));
        expect(run4FleetLiveEvidencePaths).toStrictEqual(pinnedPathsLiteral);
      })
    );

    it.effect("replays the live pinned journal end to end and matches the committed evidence bytes", () =>
      Effect.gen(function* () {
        const run = yield* generateLiveReplayEvidence(
          EvidenceMode.Enum.check,
          run4FleetLiveEvidencePaths,
          run4FleetCanonicalWindow
        );
        const { live, golden } = run.summary;

        expect(live.report.eventCount).toBe(689);
        expect([live.agreement.agreed, live.agreement.total]).toStrictEqual([197, 200]);
        expect([golden.agreed, golden.total]).toStrictEqual([41, 41]);
        expect(
          A.map(live.attributedMismatches, (attributed) => [attributed.mismatch.eventIndex, attributed.attribution])
        ).toStrictEqual([
          [69, sameCheckout],
          [259, sameCheckout],
          [284, sameCheckout],
        ]);
        expect(A.map(live.report.skippedRows, (row) => row.eventIndex)).toStrictEqual([10]);
        expect(
          A.map(
            A.filter(live.report.verdicts, (verdict) => verdict.ledgerCensored),
            (verdict) => verdict.eventIndex
          )
        ).toStrictEqual([0, 2, 5, 8]);
        expect(live.enqueueLessAdmissions).toBe(2);
        expect(live.custody).toStrictEqual(
          CustodyCensus.make({
            live: S.Natural.make(0),
            surrogate: S.Natural.make(689),
            redacted: S.Natural.make(0),
          })
        );
        expect([live.withdrawnRows, live.ticketEvictedRows]).toStrictEqual([44, 1]);
        expect(run.rendered).toBe(yield* readText(committedEvidencePath));
      })
    );

    it.effect("attributes a mismatch to a shared checkout only when the projected head shares one", () =>
      Effect.gen(function* () {
        const events = yield* decodeAdmissionJournal(
          ndjson([
            v3Released("holder", 1, { checkoutRoot: "<fleet>/fixture-worktrees/shared" }),
            v3Released("projected-shared", 2, { checkoutRoot: "<fleet>/fixture-worktrees/shared" }),
            v3Released("projected-alone", 3, { checkoutRoot: "<fleet>/fixture-worktrees/alone" }),
            v3Released("holder-ref-only", 4, { checkoutRef: "9f8e7d6c5b4a" }),
            v3Released("projected-ref-only", 5, { checkoutRef: "9f8e7d6c5b4a" }),
          ])
        );
        const report = ReplayReport.make({
          eventCount: S.Natural.make(5),
          admittedCount: S.Natural.make(0),
          releasedCount: S.Natural.make(0),
          verdicts: [],
          mismatches: [
            fixtureMismatch(1, "projected-alone", ["holder"]),
            fixtureMismatch(2, "projected-shared", ["holder-ref-only", "holder"]),
            fixtureMismatch(3, "projected-ref-only", ["holder-ref-only"]),
          ],
          evictions: [],
          passed: false,
        });
        const [alone, shared, refOnly] = buildLiveReplayReport(events, report, fixtureWindow(0)).attributedMismatches;

        expect(A.map([alone, shared, refOnly], (attributed) => attributed?.attribution)).toStrictEqual([
          unattributed,
          sameCheckout,
          unattributed,
        ]);
        assertNone(alone?.sharedCheckoutRoot ?? O.some("missing"));
        assertSome(shared?.sharedCheckoutRoot ?? O.none(), "<fleet>/fixture-worktrees/shared");
        assertNone(refOnly?.sharedCheckoutRoot ?? O.some("missing"));
      })
    );

    it.effect("check mode fails typed on drifted evidence and only write mode rewrites it", () =>
      Effect.gen(function* () {
        const scratch = yield* scratchEvidence();
        const drift = yield* Effect.flip(
          generateLiveReplayEvidence(EvidenceMode.Enum.check, scratch.paths, run4FleetCanonicalWindow)
        );

        assertInstanceOf(drift, PolicyDecodeError);
        expect(drift.message).toContain("evidence:s7-live:write");
        expect(yield* readText(scratch.absolute)).toBe(frozenRecord);

        const written = yield* generateLiveReplayEvidence(
          EvidenceMode.Enum.write,
          scratch.paths,
          run4FleetCanonicalWindow
        );
        expect(yield* readText(scratch.absolute)).toBe(written.rendered);
      })
    );

    it.effect("fails typed before replay or write when a pinned constant disagrees with the bytes", () =>
      Effect.gen(function* () {
        const scratch = yield* scratchEvidence();
        const failureMember = (drift: Partial<ReplayWindow>) =>
          Effect.flip(
            generateLiveReplayEvidence(
              EvidenceMode.Enum.write,
              scratch.paths,
              ReplayWindow.make({ ...run4FleetCanonicalWindow, ...drift })
            )
          ).pipe(Effect.map((failure) => [failure._tag, "member" in failure ? failure.member : failure.message]));

        expect(yield* failureMember({ journalSha256: Sha256Hex.make("0".repeat(64)) })).toStrictEqual([
          "ReplayWindowError",
          "journalSha256",
        ]);
        expect(yield* failureMember({ manifestSha256: Sha256Hex.make("0".repeat(64)) })).toStrictEqual([
          "ReplayWindowError",
          "manifestSha256",
        ]);
        expect(
          yield* failureMember({ firstRetainedInstant: DateTime.makeUnsafe("2026-10-01T09:32:09.603Z") })
        ).toStrictEqual(["ReplayWindowError", "admission_roots[0].window.first_retained_row_instant"]);
        expect(yield* failureMember({ preV3Chains: S.Natural.make(1) })).toStrictEqual([
          "ReplayWindowError",
          "admission_roots[0].window.released_only_chains",
        ]);
        expect(yield* readText(scratch.absolute)).toBe(frozenRecord);
      })
    );

    it.effect("prints CQ-009 as temporally out of scope, never as a verdict", () =>
      Effect.gen(function* () {
        const run = yield* generateLiveReplayEvidence(
          EvidenceMode.Enum.check,
          run4FleetLiveEvidencePaths,
          run4FleetCanonicalWindow
        );
        const cq009Section = cq009SectionOf(run.rendered);

        expect(run.summary.live.cq009).toStrictEqual(
          Cq009Reading.make({ scope: outOfScope, preCutRows: S.Natural.make(0), totalRows: S.Natural.make(689) })
        );
        expect(cq009Section).toContain(
          "CQ-009 — temporally out of scope: 0 of 689 pinned rows precede #929 (graduation Ruling 9)."
        );
        expect(Str.includes("PASS")(cq009Section)).toBe(false);
        expect(Str.includes("FAIL")(cq009Section)).toBe(false);
      })
    );

    it.effect("prints pre-#929 rows as CQ-009's temporal scope, never as a verdict", () =>
      Effect.gen(function* () {
        const { events, report } = yield* replayFixture(releasedOnlyFixturePath, windowed(fixtureWindow(2)));
        const rendered = renderLiveReplayEvidence(
          fixtureSummary(buildLiveReplayReport(events, report, fixtureWindow(2))),
          run4FleetLiveEvidencePaths
        );
        const cq009Section = cq009SectionOf(rendered);

        expect(cq009Section).toContain(
          "CQ-009 — 6 of 6 pinned rows precede #929; only those rows fall in CQ-009's temporal scope, and this lab does not evaluate them (graduation Ruling 9)."
        );
        expect(Str.includes("PASS")(cq009Section)).toBe(false);
        expect(Str.includes("FAIL")(cq009Section)).toBe(false);
      })
    );

    it.effect("renders skipped lease evictions apart from the pre-v3 chains", () =>
      Effect.gen(function* () {
        const { events, report } = yield* replayFixture(trimmedEvictionFixturePath, windowed(fixtureWindow(1)));
        const rendered = renderLiveReplayEvidence(
          fixtureSummary(buildLiveReplayReport(events, report, fixtureWindow(1))),
          run4FleetLiveEvidencePaths
        );

        expect(rendered).toContain(
          "- Pre-v3 chains: 1 = 1 enqueue-less admitted chain(s) replayed + 0 release-only chain(s) whose release was skipped, classified as the pin manifest's `classify_chain` does. Skipped lease evictions: 1; each closes a lease-evicted chain, outside the pre-v3 class."
        );
      })
    );

    it.effect("renders the same bytes from the typed summary on every call", () =>
      Effect.gen(function* () {
        const paths = run4FleetLiveEvidencePaths;
        const run = yield* generateLiveReplayEvidence(EvidenceMode.Enum.check, paths, run4FleetCanonicalWindow);
        const summary = LiveEvidenceSummary.make({ ...run.summary });

        expect(renderLiveReplayEvidence(summary, paths)).toBe(run.rendered);
        expect(renderLiveReplayEvidence(paths)(summary)).toBe(run.rendered);
      })
    );

    it.effect("keeps the golden path byte-unchanged: no skips, no censoring, the same render", () =>
      Effect.gen(function* () {
        const run = yield* generateReplayEvidence(
          EvidenceMode.Enum.check,
          EvidencePaths.make({
            abox: `${repoRoot}/${aboxPath}`,
            journal: `${repoRoot}/${goldenJournalPath}`,
            evidence: "unused-in-check-mode.md",
          })
        );
        const crypto = yield* Crypto.Crypto;
        const digest = yield* crypto.digest("SHA-256", new TextEncoder().encode(run.rendered));
        const policy = yield* readPolicy();
        const events = yield* decodeAdmissionJournal(yield* readText(`${repoRoot}/${goldenJournalPath}`));
        const report = yield* replayAdmissionJournal(policy, events, "frozen-policy", "frozen-journal");

        expect(Hex.encode(digest)).toBe(goldenRenderSha256);
        expect(report.skippedRows).toHaveLength(0);
        expect(A.some(report.verdicts, (verdict) => verdict.ledgerCensored)).toBe(false);
        expect(A.every(events, (event) => admissionRowCustody(event) === "redacted")).toBe(true);
      })
    );
  });
});
