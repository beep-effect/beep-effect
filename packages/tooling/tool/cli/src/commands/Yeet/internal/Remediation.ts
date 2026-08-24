/**
 * Remediation dispatch for the `yeet monitor --watch` backpressure engine.
 *
 * **Details**
 *
 * This is the policy half of ship-velocity A1: every hosted check red the
 * watch observes becomes one inbox capsule, and the *wave record* decides what
 * that capsule means — the first red for a head opens the wave's repair
 * session, subsequent reds for the same head queue onto it, and a new push
 * supersedes the whole wave. The policy is a pure total function over the
 * persisted {@link YeetRemediationWave}; the effectful wrapper only loads
 * state, appends the inbox row, persists, and announces.
 *
 * The wave record at `.beep/inbox/dispatch.json` is the countable "repair
 * session" unit: one wave, one session, N queued capsules. Attaching a live
 * harness to that session is deliberately not this module's job — A2's hook
 * adapters consume the inbox rows, and A4's lease machinery decides where a
 * session runs when the owning checkout is busy.
 *
 * **Gotchas**
 *
 * Dispatch failures never escape to the watch loop: a capsule that cannot be
 * appended is reported loudly on stderr and *not* recorded in the wave, so the
 * next observation of the same red retries the append instead of believing the
 * capsule was delivered. The A7 posture applies — a side-channel failure must
 * not cancel check watching.
 *
 * The wave record is last-writer-wins by design, not a lock: two concurrent
 * watches on one checkout can interleave load/persist and clobber each
 * other's record. The failure modes that leaves are bounded — a re-announced
 * red or a same-id row re-appended, never a lost capsule (the inbox is
 * append-only and ids are deterministic, so consumers dedup by id), and a
 * stale-head record self-heals on the next tick's supersede-and-converge.
 * Single-writer discipline for the checkout is A2's hook-mutex deliverable.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Console, Effect, FileSystem, Match, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { writeContainedFileString } from "../../../internal/cli/FsGuards.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import {
  appendYeetInboxRow,
  YeetCheckFailedRow,
  YeetFailureCapsule,
  YeetInboxSeverity,
  yeetInboxPaths,
  yeetInboxRowId,
} from "./Inbox.ts";
import type { YeetWatchCheck, YeetWatchSnapshot } from "./WatchStream.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Remediation");

/**
 * Schema version stamped on the persisted wave record.
 *
 * **Example** (Read the version)
 *
 * ```ts
 * import { YEET_DISPATCH_SCHEMA_VERSION } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_DISPATCH_SCHEMA_VERSION) // "yeet-dispatch/v1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_DISPATCH_SCHEMA_VERSION = "yeet-dispatch/v1";

/**
 * The remediation wave for one PR head: the repair session and its queue.
 *
 * **Details**
 *
 * `sessionStartedAt` is null between a head change and that head's first red —
 * the push opens a fresh, empty wave, and only a red opens the session.
 * `capsuleIds` holds the queued inbox row ids in arrival order; because row
 * ids are deterministic over (prNumber, headSha, lane), membership here is
 * exactly the "dedup by headSha+lane" the dispatch contract requires.
 *
 * **Example** (Build a wave)
 *
 * ```ts
 * import { YeetRemediationWave } from "@beep/repo-cli/test/Yeet"
 *
 * const wave = YeetRemediationWave.make({
 *   capsuleIds: ["coverage-abc"],
 *   headSha: "abc123",
 *   prNumber: 751,
 *   sessionStartedAt: "2026-08-17T00:00:00Z",
 *   updatedAt: "2026-08-17T00:00:00Z"
 * })
 *
 * console.log(wave.capsuleIds.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetRemediationWave extends S.Class<YeetRemediationWave>($I`YeetRemediationWave`)(
  {
    schemaVersion: S.Literal(YEET_DISPATCH_SCHEMA_VERSION).pipe(
      S.withConstructorDefault(Effect.succeed(YEET_DISPATCH_SCHEMA_VERSION))
    ),
    capsuleIds: S.Array(S.String),
    headSha: S.NonEmptyString,
    prNumber: S.Finite,
    sessionStartedAt: S.NullOr(S.String),
    updatedAt: S.String,
  },
  $I.annote("YeetRemediationWave", {
    description: "The remediation wave for one PR head: session start, queued capsule ids, and freshness.",
  })
) {}

/**
 * JSON string codec for the persisted wave record.
 *
 * **Example** (Reject garbage)
 *
 * ```ts
 * import { YeetRemediationWaveJson } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(YeetRemediationWaveJson.decodeOption("not json"))) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const YeetRemediationWaveJson = JsonStringCodec(YeetRemediationWave);

/**
 * What the dispatch policy decided about one observed red.
 *
 * **Example** (Check a decision)
 *
 * ```ts
 * import { YeetDispatchDecision } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetDispatchDecision.is["start-session"]("start-session")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetDispatchDecision = LiteralKit(["start-session", "queue", "duplicate"]).pipe(
  $I.annoteSchema("YeetDispatchDecision", {
    title: "Yeet Dispatch Decision",
    description: "Whether an observed red opened the wave's repair session, queued onto it, or was already queued.",
  })
);

/**
 * What the dispatch policy decided about one observed red.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetDispatchDecision = typeof YeetDispatchDecision.Type;

/**
 * The dispatch policy's input: one observed red plus the persisted wave.
 *
 * **Example** (Build a first-red input)
 *
 * ```ts
 * import { YeetRemediationInput } from "@beep/repo-cli/test/Yeet"
 *
 * const input = YeetRemediationInput.make({
 *   at: "2026-08-17T00:00:00Z",
 *   capsuleId: "coverage-abc",
 *   headSha: "abc123",
 *   prNumber: 754,
 *   wave: null
 * })
 *
 * console.log(input.wave) // null
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetRemediationInput extends S.Class<YeetRemediationInput>($I`YeetRemediationInput`)(
  {
    at: S.String,
    capsuleId: S.NonEmptyString,
    headSha: S.NonEmptyString,
    prNumber: S.Finite,
    wave: S.NullOr(YeetRemediationWave),
  },
  $I.annote("YeetRemediationInput", {
    description: "One observed red (capsule id, head, PR) plus the persisted wave record, or null for none.",
  })
) {}

/**
 * The dispatch policy's output: the decision and the wave to persist.
 *
 * **Example** (Build an outcome)
 *
 * ```ts
 * import { YeetRemediationOutcome, YeetRemediationWave } from "@beep/repo-cli/test/Yeet"
 *
 * const outcome = YeetRemediationOutcome.make({
 *   decision: "start-session",
 *   wave: YeetRemediationWave.make({
 *     capsuleIds: ["coverage-abc"],
 *     headSha: "abc123",
 *     prNumber: 754,
 *     sessionStartedAt: "2026-08-17T00:00:00Z",
 *     updatedAt: "2026-08-17T00:00:00Z"
 *   })
 * })
 *
 * console.log(outcome.decision) // "start-session"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetRemediationOutcome extends S.Class<YeetRemediationOutcome>($I`YeetRemediationOutcome`)(
  {
    decision: YeetDispatchDecision,
    wave: YeetRemediationWave,
  },
  $I.annote("YeetRemediationOutcome", {
    description: "The dispatch decision plus the wave record reflecting it.",
  })
) {}

/**
 * Decide what one observed red means for the current remediation wave.
 *
 * **Details**
 *
 * The policy is total over four cases: no wave (or a wave for another head)
 * starts a fresh session for this head; a capsule id already in the wave's
 * queue is a duplicate — the same lane re-observed red on the same head, for
 * example after a job re-run — and changes nothing; a wave whose session has
 * not started yet (a push opened it empty) starts the session now; anything
 * else queues onto the running session. The first two SPEC sentences fall out
 * directly: first red for a head starts a repair session, subsequent reds for
 * the same head append to that session's queue.
 *
 * **Example** (First red starts the session)
 *
 * ```ts
 * import { decideYeetRemediation, YeetRemediationInput } from "@beep/repo-cli/test/Yeet"
 *
 * const outcome = decideYeetRemediation(YeetRemediationInput.make({
 *   at: "2026-08-17T00:00:00Z",
 *   capsuleId: "coverage-abc",
 *   headSha: "abc123",
 *   prNumber: 751,
 *   wave: null
 * }))
 *
 * console.log(outcome.decision) // "start-session"
 * ```
 *
 * @param input - The observed red and the persisted wave.
 * @returns The decision plus the wave record to persist.
 * @category mapping
 * @since 0.0.0
 */
export const decideYeetRemediation = (input: YeetRemediationInput): YeetRemediationOutcome => {
  const wave = input.wave;
  // Freshness is (prNumber, headSha): a branch tip re-opened as a new PR
  // shares the head with the dead PR's wave, and treating that stale record
  // as current would swallow the new PR's start-session signal.
  if (P.isNull(wave) || wave.headSha !== input.headSha || wave.prNumber !== input.prNumber) {
    return YeetRemediationOutcome.make({
      decision: YeetDispatchDecision.Enum["start-session"],
      wave: YeetRemediationWave.make({
        capsuleIds: [input.capsuleId],
        headSha: input.headSha,
        prNumber: input.prNumber,
        sessionStartedAt: input.at,
        updatedAt: input.at,
      }),
    });
  }
  if (A.contains(wave.capsuleIds, input.capsuleId)) {
    return YeetRemediationOutcome.make({ decision: YeetDispatchDecision.Enum.duplicate, wave });
  }
  const queued = A.append(wave.capsuleIds, input.capsuleId);
  return P.isNull(wave.sessionStartedAt)
    ? YeetRemediationOutcome.make({
        decision: YeetDispatchDecision.Enum["start-session"],
        wave: YeetRemediationWave.make({
          capsuleIds: queued,
          headSha: wave.headSha,
          prNumber: wave.prNumber,
          sessionStartedAt: input.at,
          updatedAt: input.at,
        }),
      })
    : YeetRemediationOutcome.make({
        decision: YeetDispatchDecision.Enum.queue,
        wave: YeetRemediationWave.make({
          capsuleIds: queued,
          headSha: wave.headSha,
          prNumber: wave.prNumber,
          sessionStartedAt: wave.sessionStartedAt,
          updatedAt: input.at,
        }),
      });
};

/**
 * The supersession input: the observed head plus the persisted wave.
 *
 * **Example** (Build a supersession input)
 *
 * ```ts
 * import { YeetWaveSupersedeInput } from "@beep/repo-cli/test/Yeet"
 *
 * const input = YeetWaveSupersedeInput.make({
 *   at: "2026-08-17T00:00:00Z",
 *   headSha: "bbb222",
 *   prNumber: 754,
 *   wave: null
 * })
 *
 * console.log(input.headSha) // "bbb222"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetWaveSupersedeInput extends S.Class<YeetWaveSupersedeInput>($I`YeetWaveSupersedeInput`)(
  {
    at: S.String,
    headSha: S.NonEmptyString,
    prNumber: S.Finite,
    wave: S.NullOr(YeetRemediationWave),
  },
  $I.annote("YeetWaveSupersedeInput", {
    description: "The newly observed head (after a push) plus the persisted wave record, or null for none.",
  })
) {}

/**
 * Supersede the wave after a push: a new head opens a fresh, empty wave.
 *
 * **Details**
 *
 * "A new push supersedes the prior wave" in record form: the fresh wave has no
 * session and no queue, and the old head's capsules can no longer leak into
 * the new wave because membership is keyed on the new head's ids. A wave
 * already on the observed head passes through unchanged, so calling this on
 * every observation is safe.
 *
 * **Example** (A push resets the wave)
 *
 * ```ts
 * import { supersedeYeetRemediationWave, YeetWaveSupersedeInput } from "@beep/repo-cli/test/Yeet"
 *
 * const wave = supersedeYeetRemediationWave(YeetWaveSupersedeInput.make({
 *   at: "2026-08-17T00:00:00Z",
 *   headSha: "bbb222",
 *   prNumber: 751,
 *   wave: null
 * }))
 *
 * console.log(wave.capsuleIds.length) // 0
 * ```
 *
 * @param input - The newly observed head and the persisted wave.
 * @returns The wave record for the observed head.
 * @category mapping
 * @since 0.0.0
 */
export const supersedeYeetRemediationWave = (input: YeetWaveSupersedeInput): YeetRemediationWave => {
  const wave = input.wave;
  return P.isNotNull(wave) && wave.headSha === input.headSha && wave.prNumber === input.prNumber
    ? wave
    : YeetRemediationWave.make({
        capsuleIds: [],
        headSha: input.headSha,
        prNumber: input.prNumber,
        sessionStartedAt: null,
        updatedAt: input.at,
      });
};

/**
 * Resolve the persisted wave record's path for one checkout.
 *
 * **Example** (Build the resolution effect)
 *
 * ```ts
 * import { yeetDispatchStatePath } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(yeetDispatchStatePath("/repo"))) // true
 * ```
 *
 * @param repoRoot - The checkout the wave record belongs to.
 * @returns The wave record's file path.
 * @category services
 * @since 0.0.0
 */
export const yeetDispatchStatePath = Effect.fn("Yeet.yeetDispatchStatePath")(function* (
  repoRoot: string
): Effect.fn.Return<string, never, Path.Path> {
  const paths = yield* yeetInboxPaths(repoRoot);
  const path = yield* Path.Path;
  return path.join(paths.dir, "dispatch.json");
});

/**
 * Read the persisted wave record for one checkout.
 *
 * **Details**
 *
 * Every way the read can go wrong — no record yet, an unreadable file, an
 * older schema version — yields `None`, which the dispatcher reads as "no
 * wave". The record is a dedup optimisation over deterministic row ids, so a
 * lost record degrades to re-announcing, never to a lost capsule.
 *
 * **Example** (Build the read effect)
 *
 * ```ts
 * import { loadYeetRemediationWave } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(loadYeetRemediationWave("/repo"))) // true
 * ```
 *
 * @param repoRoot - The checkout the wave record belongs to.
 * @returns The persisted wave, or `None` when there is no usable one.
 * @category services
 * @since 0.0.0
 */
export const loadYeetRemediationWave = Effect.fn("Yeet.loadYeetRemediationWave")(function* (
  repoRoot: string
): Effect.fn.Return<O.Option<YeetRemediationWave>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const statePath = yield* yeetDispatchStatePath(repoRoot);
  const text = yield* Effect.option(fs.readFileString(statePath));
  return O.flatMap(text, YeetRemediationWaveJson.decodeOption);
});

/**
 * Warn that the wave record could not be persisted, naming the consequence.
 *
 * **Example** (Render the warning)
 *
 * ```ts
 * import { renderYeetDispatchStateWarning } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderYeetDispatchStateWarning("disk is full"))
 * ```
 *
 * @param reason - Why the write failed.
 * @returns The operator warning line.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetDispatchStateWarning = (reason: string): string =>
  `[yeet] could not persist the remediation wave record (${reason}); reds may be re-announced, but capsule ids are deterministic so inbox consumers still dedup safely.`;

const writeRemediationWave = Effect.fn("Yeet.writeRemediationWave")(function* (
  repoRoot: string,
  wave: YeetRemediationWave
) {
  const statePath = yield* yeetDispatchStatePath(repoRoot);
  const json = yield* YeetRemediationWaveJson.encode(wave);
  yield* writeContainedFileString(repoRoot, statePath, `${json}\n`);
});

// Persisting is best effort by the same argument as the comment cursor: the
// record is a dedup optimisation, and failing the watch over it would cost the
// whole check stream.
const persistYeetRemediationWave = (
  repoRoot: string,
  wave: YeetRemediationWave
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  writeRemediationWave(repoRoot, wave).pipe(
    Effect.catch((error) => Console.error(renderYeetDispatchStateWarning(error.message)))
  );

/**
 * The rendering input for one dispatch announcement: decision plus row.
 *
 * **Example** (Build a report)
 *
 * ```ts
 * import {
 *   YeetCheckFailedRow,
 *   YeetDispatchReport,
 *   YeetFailureCapsule,
 *   YeetRemediationOutcome,
 *   YeetRemediationWave,
 *   yeetInboxRowId
 * } from "@beep/repo-cli/test/Yeet"
 *
 * const capsule = YeetFailureCapsule.make({
 *   bucket: "fail",
 *   headSha: "abc123",
 *   lane: "Check",
 *   link: null,
 *   observedAt: "2026-08-17T00:00:00Z",
 *   prNumber: 754,
 *   state: "FAILURE",
 *   workflow: null
 * })
 * const report = YeetDispatchReport.make({
 *   outcome: YeetRemediationOutcome.make({
 *     decision: "start-session",
 *     wave: YeetRemediationWave.make({
 *       capsuleIds: [yeetInboxRowId(capsule)],
 *       headSha: "abc123",
 *       prNumber: 754,
 *       sessionStartedAt: "2026-08-17T00:00:00Z",
 *       updatedAt: "2026-08-17T00:00:00Z"
 *     })
 *   }),
 *   row: YeetCheckFailedRow.make({
 *     capsule,
 *     checkout: "/repo",
 *     id: yeetInboxRowId(capsule),
 *     severity: "P0",
 *     ts: "2026-08-17T00:00:00Z"
 *   })
 * })
 *
 * console.log(report.outcome.decision) // "start-session"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetDispatchReport extends S.Class<YeetDispatchReport>($I`YeetDispatchReport`)(
  {
    outcome: YeetRemediationOutcome,
    row: YeetCheckFailedRow,
  },
  $I.annote("YeetDispatchReport", {
    description: "One dispatch outcome plus the inbox row it concerns, for operator announcement.",
  })
) {}

/**
 * Render the operator announcement for one dispatch outcome.
 *
 * **Example** (Announce a session start)
 *
 * ```ts
 * import {
 *   renderYeetDispatchLine,
 *   YeetCheckFailedRow,
 *   YeetDispatchReport,
 *   YeetFailureCapsule,
 *   YeetRemediationOutcome,
 *   YeetRemediationWave
 * } from "@beep/repo-cli/test/Yeet"
 *
 * const row = YeetCheckFailedRow.make({
 *   capsule: YeetFailureCapsule.make({
 *     bucket: "fail",
 *     headSha: "abc123def",
 *     lane: "Check",
 *     link: null,
 *     observedAt: "2026-08-17T00:00:00Z",
 *     prNumber: 751,
 *     state: "FAILURE",
 *     workflow: null
 *   }),
 *   checkout: "/repo",
 *   id: "check-abc",
 *   severity: "P0",
 *   ts: "2026-08-17T00:00:00Z"
 * })
 * const outcome = YeetRemediationOutcome.make({
 *   decision: "start-session",
 *   wave: YeetRemediationWave.make({
 *     capsuleIds: ["check-abc"],
 *     headSha: "abc123def",
 *     prNumber: 751,
 *     sessionStartedAt: "2026-08-17T00:00:00Z",
 *     updatedAt: "2026-08-17T00:00:00Z"
 *   })
 * })
 *
 * console.log(renderYeetDispatchLine(YeetDispatchReport.make({ outcome, row })).includes("repair session opened")) // true
 * ```
 *
 * @param report - The dispatch outcome and the inbox row it concerns.
 * @returns The stderr announcement line.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetDispatchLine = (report: YeetDispatchReport): string => {
  const lane = report.row.capsule.lane;
  const head = Str.slice(0, 7)(report.row.capsule.headSha);
  const count = A.length(report.outcome.wave.capsuleIds);
  return Match.value(report.outcome.decision).pipe(
    Match.when(
      "start-session",
      () =>
        `[yeet] first red on "${lane}" (head ${head}) — repair session opened; capsule ${report.row.id} queued in .beep/inbox/failures.ndjson`
    ),
    Match.when(
      "queue",
      () =>
        `[yeet] red on "${lane}" — capsule ${report.row.id} queued to the head ${head} repair session (${count} capsules)`
    ),
    Match.when("duplicate", () => `[yeet] red on "${lane}" already queued for head ${head}`),
    Match.exhaustive
  );
};

/**
 * Dispatch one observed check failure: capsule, inbox row, wave, announcement.
 *
 * **Details**
 *
 * The capsule derives from the failing check's own snapshot record — name,
 * link, workflow, raw bucket/state — plus the watched PR's identity, and the
 * row id is deterministic over (prNumber, headSha, lane). A `duplicate`
 * decision performs no writes at all. Otherwise the inbox append happens
 * *before* the wave persist, and an append failure skips the persist: the
 * wave must never claim a capsule the inbox does not hold, because the next
 * observation of the same red is the retry.
 *
 * Nothing here fails the caller: every failure path degrades to a loud stderr
 * line, keeping the A7 posture that a side-channel failure must not cancel
 * check watching.
 *
 * **Example** (Build the dispatch effect)
 *
 * ```ts
 * import { dispatchYeetCheckFailure, YeetWatchCheck, YeetWatchSnapshot } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const check = YeetWatchCheck.make({ name: "Check", outcome: "fail" })
 * const snapshot = YeetWatchSnapshot.make({
 *   checks: [check],
 *   headSha: "abc123",
 *   mergeable: "MERGEABLE",
 *   prNumber: 751,
 *   state: "OPEN",
 *   threads: []
 * })
 *
 * console.log(Effect.isEffect(dispatchYeetCheckFailure("/repo", snapshot, check, "2026-08-17T00:00:00Z"))) // true
 * ```
 *
 * @param repoRoot - The checkout whose inbox and wave record receive the failure.
 * @param snapshot - The snapshot the failure was observed in.
 * @param check - The failing check's record itself — never a name to re-resolve,
 * because a rollup can legitimately carry two same-named checks.
 * @param at - The observation timestamp stamped on the capsule and row.
 * @returns Nothing; every failure path degrades to a stderr line.
 * @category services
 * @since 0.0.0
 */
export const dispatchYeetCheckFailure = Effect.fn("Yeet.dispatchYeetCheckFailure")(function* (
  repoRoot: string,
  snapshot: YeetWatchSnapshot,
  check: YeetWatchCheck,
  at: string
): Effect.fn.Return<void, never, FileSystem.FileSystem | Path.Path> {
  const capsule = YeetFailureCapsule.make({
    bucket: check.signal.bucket,
    headSha: snapshot.headSha,
    lane: check.name,
    link: check.link,
    observedAt: at,
    prNumber: snapshot.prNumber,
    state: check.signal.state,
    workflow: check.workflow,
  });
  const row = YeetCheckFailedRow.make({
    capsule,
    checkout: repoRoot,
    id: yeetInboxRowId(capsule),
    severity: YeetInboxSeverity.Enum.P0,
    ts: at,
  });
  const wave = yield* loadYeetRemediationWave(repoRoot);
  const outcome = decideYeetRemediation(
    YeetRemediationInput.make({
      at,
      capsuleId: row.id,
      headSha: snapshot.headSha,
      prNumber: snapshot.prNumber,
      wave: O.getOrNull(wave),
    })
  );
  if (YeetDispatchDecision.is.duplicate(outcome.decision)) {
    return;
  }
  const delivered = yield* appendYeetInboxRow(repoRoot, row).pipe(
    Effect.as(O.some(row)),
    Effect.catch((error) =>
      Console.error(
        `[yeet] failed to deliver capsule ${row.id} for "${capsule.lane}" to the inbox (${error.message}); the red is NOT queued and will retry on the next observation.`
      ).pipe(Effect.as(O.none<YeetCheckFailedRow>()))
    )
  );
  if (O.isNone(delivered)) {
    return;
  }
  yield* persistYeetRemediationWave(repoRoot, outcome.wave);
  yield* Console.error(renderYeetDispatchLine(YeetDispatchReport.make({ outcome, row })));
});

/**
 * Supersede the persisted wave after the watch observed a head change.
 *
 * **Details**
 *
 * Loads the record, applies {@link supersedeYeetRemediationWave}, persists the
 * fresh wave, and announces when an in-flight session was actually superseded.
 * Safe to call when no record exists — the push still pins the new head so the
 * first red after it starts cleanly.
 *
 * **Example** (Build the supersession effect)
 *
 * ```ts
 * import { supersedeYeetDispatchState } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(supersedeYeetDispatchState("/repo", "bbb222", 751, "2026-08-17T00:00:00Z"))) // true
 * ```
 *
 * @param repoRoot - The checkout whose wave record is superseded.
 * @param headSha - The newly observed head.
 * @param prNumber - The watched pull request.
 * @param at - The observation timestamp.
 * @returns Nothing; persistence failures degrade to a stderr line.
 * @category services
 * @since 0.0.0
 */
export const supersedeYeetDispatchState = Effect.fn("Yeet.supersedeYeetDispatchState")(function* (
  repoRoot: string,
  headSha: string,
  prNumber: number,
  at: string
): Effect.fn.Return<void, never, FileSystem.FileSystem | Path.Path> {
  const previous = yield* loadYeetRemediationWave(repoRoot);
  const wave = supersedeYeetRemediationWave(
    YeetWaveSupersedeInput.make({ at, headSha, prNumber, wave: O.getOrNull(previous) })
  );
  yield* persistYeetRemediationWave(repoRoot, wave);
  const superseded = O.filter(
    previous,
    (before) =>
      (before.headSha !== headSha || before.prNumber !== prNumber) && A.isReadonlyArrayNonEmpty(before.capsuleIds)
  );
  if (O.isSome(superseded)) {
    yield* Console.error(
      `[yeet] head moved to ${Str.slice(0, 7)(headSha)}; the ${A.length(superseded.value.capsuleIds)}-capsule wave for ${Str.slice(0, 7)(superseded.value.headSha)} is superseded.`
    );
  }
});
