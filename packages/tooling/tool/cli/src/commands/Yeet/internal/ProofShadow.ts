import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { Console, DateTime, Duration, Effect, pipe } from "effect";
import * as A from "effect/Array";
import { constFalse } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ProofEnvProfile, ProofStage } from "../../../internal/repo-run/QualityScheduler.schemas.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { GithubCheckLaneRunStatus } from "../../Quality/Quality.schemas.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { proofLedgerPathForCheckout } from "./ArtifactPaths.ts";
import { collectProofEpoch, proofCommandDigest, proofInputKey } from "./ProofDigest.ts";
import {
  PROOF_FACT_SCHEMA_VERSION,
  ProofFact,
  ProofInputDigest,
  ProofInputSource,
  ProofLedgerFactRow,
  ProofLedgerShadowRow,
  ProofMissReason,
  ProofOutcome,
  ProofProvenance,
  ProofReuseHit,
} from "./ProofFact.ts";
import { ProofLedger } from "./ProofLedger.ts";
import type { Crypto, FileSystem, Path } from "effect";
import type { QualityTaskLaneRun, QualityTaskLaneRunReport } from "../../Quality/Quality.schemas.ts";
import type { YeetAttemptStarted } from "./AttemptJournal.ts";
import type { ProofEpoch, ProofReuseDecision } from "./ProofFact.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/ProofShadow");

/**
 * Schema version of the shadow disagreement report.
 *
 * @category constants
 * @since 0.0.0
 */
export const PROOF_SHADOW_REPORT_SCHEMA_VERSION = "proof-shadow-report/v1";

/**
 * How long a recorded fact stays reusable before it expires (orchestrator
 * default recorded with the C1 rulings: the remote cache's lifecycle).
 *
 * @category constants
 * @since 0.0.0
 */
export const PROOF_FACT_TTL = Duration.days(30);

/**
 * Placeholder input digest for a lane that declared no inputs; the reuse key
 * still needs a non-empty digest, and `inputSource: "undeclared"` makes the
 * ledger refuse to reuse it (ruling 1).
 *
 * @category constants
 * @since 0.0.0
 */
export const UNDECLARED_INPUT_DIGEST = "undeclared";

// Plain non-negative integer counts: the report is derived, never decoded from
// operator input, so an unbranded count keeps the builders free of brand casts.
const ProofCount = S.Int.check(S.isGreaterThanOrEqualTo(0));

const isHit = S.is(ProofReuseHit);
const isPassed = ProofOutcome.is.passed;

/**
 * The event-count bar shadow mode must clear before the attempt-to-attempt
 * pair is enforced (ruling 7).
 *
 * **Example** (Read the ratified bar)
 *
 * ```ts
 * import { ProofShadowEnforcementBar } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(ProofShadowEnforcementBar.ratified.attempts) // 200
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofShadowEnforcementBar extends S.Class<ProofShadowEnforcementBar>($I`ProofShadowEnforcementBar`)(
  {
    attempts: ProofCount,
    branches: ProofCount,
    disagreements: ProofCount,
  },
  $I.annote("ProofShadowEnforcementBar", {
    description:
      "Minimum attempts and distinct branches, and the maximum disagreements, shadow mode must record before enforcement.",
  })
) {
  static readonly ratified = ProofShadowEnforcementBar.make({ attempts: 200, branches: 10, disagreements: 0 });
}

/**
 * One shadow disagreement: the ledger would have reused a passed fact, and the
 * lane failed when it actually ran.
 *
 * **Example** (Construct a disagreement row)
 *
 * ```ts
 * import { ProofShadowDisagreement } from "@beep/repo-cli/test/Yeet"
 *
 * const row = ProofShadowDisagreement.make({
 *   attemptId: "attempt-1",
 *   laneId: "quality:coverage",
 *   branch: "feat/example",
 *   stage: "pre-push",
 *   key: "k3",
 *   recordedAt: "2026-09-03T12:05:00.000Z",
 * })
 * console.log(row.laneId) // "quality:coverage"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofShadowDisagreement extends S.Class<ProofShadowDisagreement>($I`ProofShadowDisagreement`)(
  {
    attemptId: S.NonEmptyString,
    laneId: S.NonEmptyString,
    branch: S.NonEmptyString,
    stage: ProofStage,
    key: S.NonEmptyString,
    recordedAt: S.NonEmptyString,
  },
  $I.annote("ProofShadowDisagreement", {
    description: "A lane the ledger would have reused that failed when it actually ran.",
  })
) {}

/**
 * How many shadow lookups missed for one reason.
 *
 * @category models
 * @since 0.0.0
 */
export class ProofShadowMissCount extends S.Class<ProofShadowMissCount>($I`ProofShadowMissCount`)(
  {
    reason: ProofMissReason,
    count: ProofCount,
  },
  $I.annote("ProofShadowMissCount", {
    description: "Shadow lookups that missed for one reuse-miss reason.",
  })
) {}

/**
 * The shadow disagreement report `yeet proof-report` prints (ruling 64).
 *
 * **Details**
 *
 * Every count comes from the checkout's proof ledger alone: `attempts` and
 * `branches` are distinct attempt ids and branches across all shadow rows,
 * `wouldReuse` is the hit decisions, `reusableMs` is the observed duration of
 * the hits whose lane passed (the time enforcement would have saved). The bar
 * is judged on the first enforced pair only (ruling 2): `barAttempts`,
 * `barBranches` and `barDisagreements` count the rows whose stage and env
 * profile equal `barStage` / `barEnvProfile`, and `enforcementReady` is the
 * ratified bar applied to those, so merged-preview rows can never flip the
 * pre-push gate.
 *
 * **Example** (Recognise a not-ready report)
 *
 * ```ts
 * import { ProofShadowEnforcementBar, ProofShadowReport } from "@beep/repo-cli/test/Yeet"
 *
 * const report = ProofShadowReport.make({
 *   schemaVersion: "proof-shadow-report/v1",
 *   generatedAt: "2026-09-21T00:00:00.000Z",
 *   ledgerPath: "/repo/.beep/yeet/proof-ledger.ndjson",
 *   shadowRows: 0,
 *   attempts: 0,
 *   branches: 0,
 *   wouldReuse: 0,
 *   reusableMs: 0,
 *   misses: [],
 *   disagreements: [],
 *   facts: 0,
 *   expiredFacts: 0,
 *   malformedRows: 0,
 *   bar: ProofShadowEnforcementBar.ratified,
 *   barStage: "pre-push",
 *   barEnvProfile: "local",
 *   barAttempts: 0,
 *   barBranches: 0,
 *   barDisagreements: 0,
 *   enforcementReady: false,
 * })
 * console.log(report.enforcementReady) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofShadowReport extends S.Class<ProofShadowReport>($I`ProofShadowReport`)(
  {
    schemaVersion: S.Literal(PROOF_SHADOW_REPORT_SCHEMA_VERSION),
    generatedAt: S.NonEmptyString,
    ledgerPath: S.NonEmptyString,
    shadowRows: ProofCount,
    attempts: ProofCount,
    branches: ProofCount,
    wouldReuse: ProofCount,
    reusableMs: S.Finite.check(S.isGreaterThanOrEqualTo(0)),
    misses: S.Array(ProofShadowMissCount),
    disagreements: S.Array(ProofShadowDisagreement),
    facts: ProofCount,
    expiredFacts: ProofCount,
    malformedRows: ProofCount,
    bar: ProofShadowEnforcementBar,
    barStage: ProofStage,
    barEnvProfile: ProofEnvProfile,
    barAttempts: ProofCount,
    barBranches: ProofCount,
    barDisagreements: ProofCount,
    enforcementReady: S.Boolean,
  },
  $I.annote("ProofShadowReport", {
    description:
      "Shadow-mode disagreement report: sample size, would-have-reused decisions, misses by reason, disagreements, ledger health, and the enforcement bar verdict over the first enforced pair's stage and env profile.",
  })
) {}

/**
 * JSON codec for {@link ProofShadowReport}.
 *
 * @category codecs
 * @since 0.0.0
 */
export const ProofShadowReportJson = JsonStringCodec(ProofShadowReport);

/**
 * What one attempt's shadow pass recorded.
 *
 * **Example** (An attempt with nothing to shadow)
 *
 * ```ts
 * import { ProofShadowAttemptSummary } from "@beep/repo-cli/test/Yeet"
 *
 * const summary = ProofShadowAttemptSummary.make({
 *   attemptId: "attempt-1",
 *   recorded: 0,
 *   wouldReuse: 0,
 *   disagreements: 0,
 *   undeclared: 0,
 * })
 * console.log(summary.recorded) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofShadowAttemptSummary extends S.Class<ProofShadowAttemptSummary>($I`ProofShadowAttemptSummary`)(
  {
    attemptId: S.NonEmptyString,
    recorded: ProofCount,
    wouldReuse: ProofCount,
    disagreements: ProofCount,
    undeclared: ProofCount,
  },
  $I.annote("ProofShadowAttemptSummary", {
    description: "Lanes shadowed for one attempt, how many the ledger would have reused, and how many disagreed.",
  })
) {}

/**
 * Attempt facts the shadow pass needs, resolved from the attempt-started row.
 *
 * @category models
 * @since 0.0.0
 */
export type ProofShadowAttemptFacts = {
  readonly attemptId: string;
  readonly runId: string;
  readonly branch: string;
  readonly headSha: string;
  readonly tier: ProofProvenance["tier"];
  readonly stage: ProofStage;
  readonly envProfile: ProofEnvProfile;
};

/**
 * Resolve the shadow pass inputs from an attempt-started journal row.
 *
 * **Details**
 *
 * Missing optional facts fall back to the pre-push defaults the planner uses
 * (`full` tier, `pre-push` stage, `local` profile); the resolved head SHA wins
 * over the symbolic head when it was recorded.
 *
 * @category utilities
 * @since 0.0.0
 */
export const proofShadowAttemptFacts = (attempt: YeetAttemptStarted): ProofShadowAttemptFacts => ({
  attemptId: attempt.attemptId,
  runId: attempt.runId,
  branch: attempt.branch,
  headSha: O.getOrElse(attempt.resolvedHeadSha, () => attempt.head),
  tier: O.getOrElse(attempt.proofTier, () => "full" as const),
  stage: O.getOrElse(attempt.stage, () => "pre-push" as const),
  envProfile: O.getOrElse(attempt.envProfile, () => "local" as const),
});

/**
 * A lane that ran to a terminal outcome and can be shadowed.
 */
type ShadowableLane = {
  readonly lane: QualityTaskLaneRun;
  readonly observed: ProofOutcome;
  readonly commandText: string;
};

const observedOutcome = (lane: QualityTaskLaneRun): O.Option<ProofOutcome> =>
  GithubCheckLaneRunStatus.$match(lane.status, {
    passed: () => O.some<ProofOutcome>("passed"),
    failed: () => O.some<ProofOutcome>("failed"),
    reused: O.none<ProofOutcome>,
    "not-run-early-stop": O.none<ProofOutcome>,
  });

const shadowableLane = (lane: QualityTaskLaneRun): O.Option<ShadowableLane> =>
  O.all({
    lane: O.some(lane),
    observed: observedOutcome(lane),
    commandText: O.filter(lane.commandText, Str.isNonEmpty),
  });

/**
 * Select the inner lanes an attempt can shadow: lanes that ran to `passed` or
 * `failed` with a command line; reused and skipped lanes carry no new evidence.
 *
 * **Example** (Nothing shadowable in an empty wave)
 *
 * ```ts
 * import { shadowableLaneRuns } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(shadowableLaneRuns([]).length) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const shadowableLaneRuns = (
  reports: ReadonlyArray<QualityTaskLaneRunReport>
): ReadonlyArray<{
  readonly lane: QualityTaskLaneRun;
  readonly observed: ProofOutcome;
  readonly commandText: string;
}> =>
  A.getSomes(
    pipe(
      reports,
      A.flatMap((report) => report.lanes),
      A.map(shadowableLane)
    )
  );

const shadowInputDigest = Effect.fn("Yeet.ProofShadow.inputDigest")(function* (
  candidate: ShadowableLane,
  facts: ProofShadowAttemptFacts,
  epoch: ProofEpoch
): Effect.fn.Return<ProofInputDigest, YeetCommandError, Crypto.Crypto> {
  const commandDigest = yield* proofCommandDigest(candidate.commandText);
  const declared = O.filter(candidate.lane.inputDigest, Str.isNonEmpty);
  const inputDigest = O.getOrElse(declared, () => UNDECLARED_INPUT_DIGEST);
  const components = {
    laneId: candidate.lane.id,
    commandDigest,
    envProfile: facts.envProfile,
    inputDigest,
    epochDigest: epoch.digest,
  };
  const key = yield* proofInputKey(components);
  return ProofInputDigest.make({
    ...components,
    laneClass: "cli-runnable",
    inputSource: O.isSome(declared) ? "turbo-task-hash" : "undeclared",
    key,
  });
});

const shadowFact = (
  key: ProofInputDigest,
  epoch: ProofEpoch,
  candidate: ShadowableLane,
  facts: ProofShadowAttemptFacts,
  repoRoot: string,
  now: DateTime.Utc
): ProofFact =>
  ProofFact.make({
    schemaVersion: PROOF_FACT_SCHEMA_VERSION,
    key,
    epoch,
    outcome: candidate.observed,
    durationMs: O.getOrElse(candidate.lane.durationMs, () => 0),
    provenance: ProofProvenance.make({
      runId: facts.runId,
      attemptId: facts.attemptId,
      originKey: repoRoot,
      tier: facts.tier,
      stage: facts.stage,
      headSha: facts.headSha,
      hostedRunId: null,
    }),
    recordedAt: DateTime.formatIso(now),
    expiresAt: DateTime.formatIso(DateTime.addDuration(now, PROOF_FACT_TTL)),
  });

const shadowRow = (
  decision: ProofReuseDecision,
  candidate: ShadowableLane,
  facts: ProofShadowAttemptFacts,
  now: DateTime.Utc
): ProofLedgerShadowRow =>
  ProofLedgerShadowRow.make({
    schemaVersion: PROOF_FACT_SCHEMA_VERSION,
    attemptId: facts.attemptId,
    laneId: candidate.lane.id,
    branch: facts.branch,
    stage: facts.stage,
    envProfile: facts.envProfile,
    decision,
    observed: candidate.observed,
    durationMs: O.getOrElse(candidate.lane.durationMs, () => 0),
    recordedAt: DateTime.formatIso(now),
  });

const isDisagreement = (row: ProofLedgerShadowRow): boolean => isHit(row.decision) && !isPassed(row.observed);

/**
 * Shadow one attempt's inner lanes against the checkout proof ledger (ruling 63).
 *
 * **Details**
 *
 * For every lane that ran to `passed` or `failed`, in report order: derive the
 * tier-independent reuse key, ask the ledger what it would have decided, append
 * that decision next to the observed outcome as a shadow row, then append the
 * lane's own fact so the next attempt can hit it. All keys are decided against
 * one ledger snapshot taken before anything is written, so a lane never
 * "reuses" the fact it is about to write, and every row of the attempt lands in
 * one append (shadow row then fact, per lane, in report order), so a fault
 * mid-attempt leaves no half-recorded lane. Nothing is skipped or
 * short-circuited: shadow mode only observes. The changed-package tripwire is
 * not wired here; C5 adds it with its must-fail fixture.
 *
 * **Example** (Build the shadow pass effect)
 *
 * ```ts
 * import { recordProofShadowForAttempt } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const facts = {
 *   attemptId: "attempt-1",
 *   runId: "run-1",
 *   branch: "feat/example",
 *   headSha: "88fa371cb0",
 *   tier: "full" as const,
 *   stage: "pre-push" as const,
 *   envProfile: "local" as const,
 * }
 * console.log(Effect.isEffect(recordProofShadowForAttempt("/repo", facts, []))) // true
 * ```
 *
 * @param repoRoot - Checkout whose ledger receives the rows.
 * @param facts - Attempt identity, branch, head, tier, stage and env profile.
 * @param reports - Durable inner-lane reports the wrappers wrote for this attempt.
 * @returns Counts of what the pass recorded.
 * @category services
 * @since 0.0.0
 */
export const recordProofShadowForAttempt = Effect.fn("Yeet.recordProofShadowForAttempt")(function* (
  repoRoot: string,
  facts: ProofShadowAttemptFacts,
  reports: ReadonlyArray<QualityTaskLaneRunReport>
): Effect.fn.Return<ProofShadowAttemptSummary, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  const candidates = shadowableLaneRuns(reports);
  if (A.isReadonlyArrayEmpty(candidates)) {
    return ProofShadowAttemptSummary.make({
      attemptId: facts.attemptId,
      recorded: 0,
      wouldReuse: 0,
      disagreements: 0,
      undeclared: 0,
    });
  }
  const epoch = yield* collectProofEpoch(repoRoot);
  const ledger = yield* ProofLedger.make(repoRoot, constFalse);
  const now = yield* DateTime.now;
  const keys = yield* Effect.forEach(candidates, (candidate) => shadowInputDigest(candidate, facts, epoch));
  const decisions = yield* ledger.lookupAll(keys, now);
  const rows = A.map(A.zip(A.zip(candidates, keys), decisions), ([[candidate, key], decision]) => ({
    row: shadowRow(decision, candidate, facts, now),
    fact: shadowFact(key, epoch, candidate, facts, repoRoot, now),
    undeclared: ProofInputSource.is.undeclared(key.inputSource),
  }));
  yield* ledger.appendAll(
    A.flatMap(rows, ({ row, fact }) => [
      row,
      ProofLedgerFactRow.make({ schemaVersion: PROOF_FACT_SCHEMA_VERSION, fact }),
    ])
  );
  return ProofShadowAttemptSummary.make({
    attemptId: facts.attemptId,
    recorded: A.length(rows),
    wouldReuse: A.length(A.filter(rows, ({ row }) => isHit(row.decision))),
    disagreements: A.length(A.filter(rows, ({ row }) => isDisagreement(row))),
    undeclared: A.length(A.filter(rows, ({ undeclared }) => undeclared)),
  });
});

/**
 * Render the one-line attempt summary the verdict path logs.
 *
 * **Example** (Render a summary)
 *
 * ```ts
 * import { ProofShadowAttemptSummary, renderProofShadowAttemptSummary } from "@beep/repo-cli/test/Yeet"
 *
 * const line = renderProofShadowAttemptSummary(
 *   ProofShadowAttemptSummary.make({ attemptId: "a", recorded: 3, wouldReuse: 1, disagreements: 0, undeclared: 2 })
 * )
 * console.log(line) // "proof shadow: 3 lane(s) recorded; would reuse 1; disagreements 0; undeclared inputs 2"
 * ```
 *
 * @category rendering
 * @since 0.0.0
 */
export const renderProofShadowAttemptSummary = (summary: ProofShadowAttemptSummary): string =>
  `proof shadow: ${summary.recorded} lane(s) recorded; would reuse ${summary.wouldReuse}; disagreements ${summary.disagreements}; undeclared inputs ${summary.undeclared}`;

const missCounts = (rows: ReadonlyArray<ProofLedgerShadowRow>): ReadonlyArray<ProofShadowMissCount> => {
  const counts = MutableHashMap.empty<ProofMissReason, number>();
  for (const row of rows) {
    if (!isHit(row.decision)) {
      const reason = row.decision.reason;
      MutableHashMap.set(counts, reason, O.getOrElse(MutableHashMap.get(counts, reason), () => 0) + 1);
    }
  }
  return A.getSomes(
    A.map(ProofMissReason.Options, (reason) =>
      O.map(MutableHashMap.get(counts, reason), (count) => ProofShadowMissCount.make({ reason, count }))
    )
  );
};

const distinctCount = (
  rows: ReadonlyArray<ProofLedgerShadowRow>,
  pick: (row: ProofLedgerShadowRow) => string
): number => HashSet.size(HashSet.fromIterable(A.map(rows, pick)));

/**
 * The first enforced pair (ruling 2): attempt-to-attempt within pre-push, on
 * the local profile. Only rows from this stage and profile count toward the
 * enforcement bar.
 *
 * @category constants
 * @since 0.0.0
 */
export const PROOF_SHADOW_BAR_SAMPLE = { stage: "pre-push", envProfile: "local" } as const satisfies {
  readonly stage: ProofStage;
  readonly envProfile: ProofEnvProfile;
};

const inBarSample = (row: ProofLedgerShadowRow): boolean =>
  ProofStage.is[PROOF_SHADOW_BAR_SAMPLE.stage](row.stage) &&
  ProofEnvProfile.is[PROOF_SHADOW_BAR_SAMPLE.envProfile](row.envProfile);

/**
 * Fold shadow rows and ledger health into the disagreement report.
 *
 * **Details**
 *
 * The headline counts fold every shadow row; the enforcement verdict folds only
 * the rows in {@link PROOF_SHADOW_BAR_SAMPLE}, so a ledger full of
 * merged-preview rows reads `not ready` for the pre-push pair.
 *
 * **Example** (An empty ledger is not ready)
 *
 * ```ts
 * import { buildProofShadowReport } from "@beep/repo-cli/test/Yeet"
 *
 * const report = buildProofShadowReport({
 *   generatedAt: "2026-09-21T00:00:00.000Z",
 *   ledgerPath: "/repo/.beep/yeet/proof-ledger.ndjson",
 *   rows: [],
 *   facts: 0,
 *   expiredFacts: 0,
 *   malformedRows: 0,
 * })
 * console.log(report.enforcementReady) // false
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const buildProofShadowReport = (input: {
  readonly generatedAt: string;
  readonly ledgerPath: string;
  readonly rows: ReadonlyArray<ProofLedgerShadowRow>;
  readonly facts: number;
  readonly expiredFacts: number;
  readonly malformedRows: number;
  readonly bar?: ProofShadowEnforcementBar;
}): ProofShadowReport => {
  const bar = input.bar ?? ProofShadowEnforcementBar.ratified;
  const hits = A.filter(input.rows, (row) => isHit(row.decision));
  const disagreements = pipe(
    input.rows,
    A.filter(isDisagreement),
    A.map((row) =>
      ProofShadowDisagreement.make({
        attemptId: row.attemptId,
        laneId: row.laneId,
        branch: row.branch,
        stage: row.stage,
        key: row.decision.key,
        recordedAt: row.recordedAt,
      })
    )
  );
  const attempts = distinctCount(input.rows, (row) => row.attemptId);
  const branches = distinctCount(input.rows, (row) => row.branch);
  const barRows = A.filter(input.rows, inBarSample);
  const barAttempts = distinctCount(barRows, (row) => row.attemptId);
  const barBranches = distinctCount(barRows, (row) => row.branch);
  const barDisagreements = A.length(A.filter(barRows, isDisagreement));
  return ProofShadowReport.make({
    schemaVersion: PROOF_SHADOW_REPORT_SCHEMA_VERSION,
    generatedAt: input.generatedAt,
    ledgerPath: input.ledgerPath,
    shadowRows: A.length(input.rows),
    attempts,
    branches,
    wouldReuse: A.length(hits),
    reusableMs: pipe(
      hits,
      A.filter((row) => isPassed(row.observed)),
      A.map((row) => row.durationMs),
      Num.sumAll
    ),
    misses: missCounts(input.rows),
    disagreements,
    facts: input.facts,
    expiredFacts: input.expiredFacts,
    malformedRows: input.malformedRows,
    bar,
    barStage: PROOF_SHADOW_BAR_SAMPLE.stage,
    barEnvProfile: PROOF_SHADOW_BAR_SAMPLE.envProfile,
    barAttempts,
    barBranches,
    barDisagreements,
    enforcementReady:
      barAttempts >= bar.attempts && barBranches >= bar.branches && barDisagreements <= bar.disagreements,
  });
};

const formatMinutes = (ms: number): string => `${(ms / 60_000).toFixed(1)} min`;

/**
 * Render the disagreement report for the terminal.
 *
 * **Example** (Render an empty report)
 *
 * ```ts
 * import { buildProofShadowReport, renderProofShadowReport } from "@beep/repo-cli/test/Yeet"
 *
 * const text = renderProofShadowReport(
 *   buildProofShadowReport({
 *     generatedAt: "2026-09-21T00:00:00.000Z",
 *     ledgerPath: "/repo/.beep/yeet/proof-ledger.ndjson",
 *     rows: [],
 *     facts: 0,
 *     expiredFacts: 0,
 *     malformedRows: 0,
 *   })
 * )
 * console.log(text.startsWith("proof shadow report")) // true
 * ```
 *
 * @category rendering
 * @since 0.0.0
 */
export const renderProofShadowReport = (report: ProofShadowReport): string => {
  const misses = A.isReadonlyArrayEmpty(report.misses)
    ? ["misses by reason: none"]
    : ["misses by reason:", ...A.map(report.misses, (miss) => `  ${miss.reason}: ${miss.count}`)];
  const disagreements = A.isReadonlyArrayEmpty(report.disagreements)
    ? ["disagreements: none"]
    : [
        `disagreements: ${A.length(report.disagreements)}`,
        ...A.map(
          report.disagreements,
          (row) => `  ${row.laneId} on ${row.branch} (${row.stage}, attempt ${row.attemptId}) at ${row.recordedAt}`
        ),
      ];
  const bar = report.bar;
  return A.join(
    [
      `proof shadow report (${report.ledgerPath})`,
      `shadow rows: ${report.shadowRows} across ${report.attempts} attempt(s) on ${report.branches} branch(es)`,
      `would reuse: ${report.wouldReuse} lane run(s), ${formatMinutes(report.reusableMs)} of passed lane time`,
      ...misses,
      ...disagreements,
      `facts: ${report.facts} recorded, ${report.expiredFacts} expired; malformed rows: ${report.malformedRows}`,
      `enforcement (attempt-to-attempt, ${report.barStage}, ${report.barEnvProfile}): ${report.enforcementReady ? "ready" : "not ready"} — attempts ${report.barAttempts}/${bar.attempts}, branches ${report.barBranches}/${bar.branches}, disagreements ${report.barDisagreements}/${bar.disagreements}`,
    ],
    "\n"
  );
};

/**
 * Options for `yeet proof-report`.
 *
 * @category models
 * @since 0.0.0
 */
export type YeetProofReportOptions = {
  readonly json: boolean;
};

/**
 * Build the disagreement report for one checkout from its proof ledger.
 *
 * **Example** (Build the report effect)
 *
 * ```ts
 * import { loadProofShadowReport } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(loadProofShadowReport("/repo"))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const loadProofShadowReport = Effect.fn("Yeet.loadProofShadowReport")(function* (
  repoRoot: string
): Effect.fn.Return<ProofShadowReport, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const ledger = yield* ProofLedger.make(repoRoot, constFalse);
  const now = yield* DateTime.now;
  const rows = yield* ledger.shadowRows;
  const facts = yield* ledger.facts;
  const expiredFacts = yield* ledger.expire(now);
  const malformedRows = yield* ledger.malformedRows;
  const ledgerPath = yield* proofLedgerPathForCheckout(repoRoot);
  return buildProofShadowReport({
    generatedAt: DateTime.formatIso(now),
    ledgerPath,
    rows,
    facts,
    expiredFacts,
    malformedRows,
  });
});

/**
 * Run one `yeet proof-report` pass: load the ledger, print the report.
 *
 * **Example** (Build the runner effect)
 *
 * ```ts
 * import { runYeetProofReport } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(runYeetProofReport({ json: false }))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const runYeetProofReport = Effect.fn("Yeet.runProofReportCommand")(function* (
  options: YeetProofReportOptions
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const repoRoot = yield* findRepoRoot().pipe(Effect.mapError(YeetCommandError.new("Failed to locate repo root.")));
  const report = yield* loadProofShadowReport(repoRoot);
  if (options.json) {
    const json = yield* ProofShadowReportJson.encode(report).pipe(
      Effect.mapError(YeetCommandError.new("Failed to encode the proof shadow report."))
    );
    yield* Console.log(json);
    return;
  }
  yield* Console.log(renderProofShadowReport(report));
});
