/**
 * Remediation dispatch for the inbox wave that `yeet monitor --watch` and
 * `yeet monitor --until-ready` both write.
 *
 * **Details**
 *
 * This is the policy half of ship-velocity A1: every hosted check red either
 * loop observes becomes one inbox capsule, and the *wave record* decides what
 * that capsule means — the first red for a head opens the wave's repair
 * session, subsequent reds for the same head queue onto it, and a new push
 * supersedes the whole wave. A base conflict seen by `--until-ready` joins the
 * same wave, so the fix push supersedes it too. The policy is a pure total
 * function over the persisted {@link YeetRemediationWave}; the effectful
 * wrapper only loads state, appends the inbox row, persists, and announces.
 *
 * The wave record at `.beep/inbox/dispatch.json` is the countable "repair
 * session" unit: one wave, one session, N queued capsules. Nothing here
 * launches a fixer. The inbox hook injects the rows into the owner session and
 * `yeet job wait` hands the wave back to it; that woken owner dispatches the
 * fix itself (pr-event-awareness D14).
 *
 * **Gotchas**
 *
 * Dispatch failures never escape to the calling loop: a capsule that cannot be
 * appended is reported loudly on stderr and *not* recorded in the wave, so the
 * next observation of the same red retries the append instead of believing the
 * capsule was delivered. The A7 posture applies — a side-channel failure must
 * not cancel check watching.
 *
 * The wave record is last-writer-wins by design, not a lock: two concurrent
 * loops on one checkout (watches or `--until-ready` monitors) can interleave
 * load/persist and clobber each other's record. The failure modes that
 * leaves are bounded — a re-announced red or a same-id row re-appended, never
 * a lost capsule (the inbox is append-only and ids are deterministic, so
 * consumers dedup by id), and a stale-head record self-heals on the next
 * tick's supersede-and-converge.
 * Single-writer discipline for the checkout is A2's hook-mutex deliverable.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Console, Effect, FileSystem, HashSet, Match, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { writeContainedFileString } from "../../../internal/cli/FsGuards.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { readYeetAckState } from "./Ack.ts";
import {
  appendYeetInboxRow,
  appendYeetInboxRowOnce,
  YeetBaseConflictRow,
  YeetCheckFailedRow,
  YeetFailureCapsule,
  YeetInboxSeverity,
  yeetBaseConflictRowId,
  yeetInboxAckPath,
  yeetInboxPaths,
  yeetInboxRowId,
} from "./Inbox.ts";
import type { Crypto } from "effect";
import type { YeetCommandError } from "../Yeet.errors.ts";
import type { YeetBaseConflictCapsule } from "./Inbox.ts";
import type { YeetWatchCheck } from "./WatchStream.ts";

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
 * `redSetKey` is the head's required red set as the `--until-ready` loop last
 * observed it ({@link yeetWaveRedSetKey}), stamped on every converging poll by
 * {@link stampYeetWaveRedSet}. A row id cannot see a rerun that comes back
 * red on the same head, because the id stays the same; the key can, because
 * the rerun's job link and completion stamp change. The waiters compare it
 * with the key they last handed back: a red set that names a red they have
 * not handed back is a new wave. A record written before the field existed,
 * or by a loop that does not stamp it, decodes with `None`, and the schema
 * version is unchanged.
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
    redSetKey: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("YeetRemediationWave", {
    description:
      "The remediation wave for one PR head: session start, queued capsule ids, freshness, and the last observed required red set.",
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
 * the same head append to that session's queue. A same-head wave keeps its
 * `redSetKey`; only {@link stampYeetWaveRedSet} moves it.
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
          redSetKey: wave.redSetKey,
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
          redSetKey: wave.redSetKey,
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

// One red check as the red-set key names it: its name, its job link and its
// completion stamp, tab-separated. A rerun of the same check changes the link
// or the stamp, so it is a different entry.
const yeetRedSetEntry = (check: YeetWatchCheck): string =>
  A.join(
    [
      check.name,
      O.getOrElse(O.fromNullOr(check.link), () => Str.empty),
      O.getOrElse(check.completedAt, () => Str.empty),
    ],
    "\t"
  );

const yeetRedSetEntries = (key: string): HashSet.HashSet<string> =>
  HashSet.fromIterable(A.filter(Str.split(key, "\n"), Str.isNonEmpty));

/**
 * Key a set of red checks: one sorted line per check naming it, its job link and its completion stamp.
 *
 * **Details**
 *
 * The caller passes the reds it means; the order it passes them in does not
 * matter. The merge loop keys every failing check to skip re-triaging a red
 * set it already classified, and keys only the failing *required* checks for
 * the wave record ({@link yeetWaveRedSetKey}). No reds key to the empty string.
 *
 * **Example** (Order does not matter)
 *
 * ```ts
 * import { YeetWatchCheck, yeetRedSetKey } from "@beep/repo-cli/test/Yeet"
 *
 * const lint = YeetWatchCheck.make({ name: "Lint", outcome: "fail", link: "https://ci/1" })
 * const check = YeetWatchCheck.make({ name: "Check", outcome: "fail", link: "https://ci/2" })
 *
 * console.log(yeetRedSetKey([lint, check]) === yeetRedSetKey([check, lint])) // true
 * ```
 *
 * @param reds - The red checks to key.
 * @returns The key: sorted, newline-joined entries; empty for no reds.
 * @category utilities
 * @since 0.0.0
 */
export const yeetRedSetKey = (reds: ReadonlyArray<YeetWatchCheck>): string =>
  pipe(A.map(reds, yeetRedSetEntry), A.sort(Order.String), A.join("\n"));

/**
 * Key one head's required red set, the key the wave record carries.
 *
 * **Details**
 *
 * Only failing required checks count. An optional red never wakes a waiter
 * (ttc ruling 42), so a rerun of an optional check must not move the key
 * either.
 *
 * **Example** (An optional red is not in the key)
 *
 * ```ts
 * import { YeetWatchCheck, yeetWaveRedSetKey } from "@beep/repo-cli/test/Yeet"
 *
 * const vercel = YeetWatchCheck.make({ name: "Vercel", outcome: "fail", required: false })
 * const lint = YeetWatchCheck.make({ name: "Lint", outcome: "pass" })
 *
 * console.log(yeetWaveRedSetKey([vercel, lint])) // ""
 * ```
 *
 * @param checks - One poll's checks for the head.
 * @returns The required red set's key; empty when no required check is red.
 * @category utilities
 * @since 0.0.0
 */
export const yeetWaveRedSetKey = (checks: ReadonlyArray<YeetWatchCheck>): string =>
  yeetRedSetKey(A.filter(checks, (check) => check.required && check.outcome === "fail"));

/**
 * Whether a red-set key names a red that an accounted-for key does not.
 *
 * **Details**
 *
 * This is the "new wave on the same head" test. A red whose rerun came back
 * red again has a new job link, so its entry is new. A red set that only
 * shrank (a rerun went green) or emptied names nothing new, so it wakes
 * nobody: there is no new work in it.
 *
 * **Example** (A rerun that failed again is new; a shrink is not)
 *
 * ```ts
 * import { YeetWatchCheck, yeetRedSetKey, yeetRedSetKeyGained } from "@beep/repo-cli/test/Yeet"
 *
 * const red = (name: string, link: string) => YeetWatchCheck.make({ name, outcome: "fail", link })
 * const before = yeetRedSetKey([red("Lint", "https://ci/1"), red("Check", "https://ci/2")])
 *
 * console.log(yeetRedSetKeyGained(yeetRedSetKey([red("Lint", "https://ci/3")]), before)) // true
 * console.log(yeetRedSetKeyGained(yeetRedSetKey([red("Lint", "https://ci/1")]), before)) // false
 * ```
 *
 * @param current - The red-set key observed now.
 * @param accounted - The red-set key already handed back.
 * @returns Whether `current` names at least one red `accounted` does not.
 * @category predicates
 * @since 0.0.0
 */
export const yeetRedSetKeyGained: {
  (accounted: string): (current: string) => boolean;
  (current: string, accounted: string): boolean;
} = dual(2, (current: string, accounted: string): boolean => {
  const handed = yeetRedSetEntries(accounted);
  return HashSet.some(yeetRedSetEntries(current), (entry) => !HashSet.has(handed, entry));
});

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
): Effect.fn.Return<O.Option<YeetRemediationWave>, never, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
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
): Effect.Effect<void, never, Crypto.Crypto | FileSystem.FileSystem | Path.Path> =>
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
 * The capsule derives from the failing check's own record — name, link,
 * workflow, raw bucket/state — plus the observed head's identity, and the row
 * id is deterministic over (prNumber, headSha, lane). The head is only
 * `{ headSha, prNumber }`, so the watch snapshot and the merge loop's status
 * snapshot both dispatch through here. A `duplicate` decision performs no
 * writes at all. Otherwise the inbox append happens *before* the wave persist,
 * and an append failure skips the persist: the wave must never claim a capsule
 * the inbox does not hold, because the next observation of the same red is
 * the retry.
 *
 * Nothing here fails the caller: every failure path degrades to a loud stderr
 * line, keeping the A7 posture that a side-channel failure must not cancel
 * check watching.
 *
 * **Example** (Build the dispatch effect)
 *
 * ```ts
 * import { dispatchYeetCheckFailure, YeetWatchCheck } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const check = YeetWatchCheck.make({ name: "Check", outcome: "fail" })
 * const head = { headSha: "abc123", prNumber: 751 }
 *
 * console.log(Effect.isEffect(dispatchYeetCheckFailure("/repo", head, check, "2026-08-17T00:00:00Z"))) // true
 * ```
 *
 * @param repoRoot - The checkout whose inbox and wave record receive the failure.
 * @param head - The observed pull-request head the failure belongs to: its SHA and PR number.
 * @param check - The failing check's record itself — never a name to re-resolve,
 * because a rollup can legitimately carry two same-named checks.
 * @param at - The observation timestamp stamped on the capsule and row.
 * @returns Nothing; every failure path degrades to a stderr line.
 * @category services
 * @since 0.0.0
 */
export const dispatchYeetCheckFailure = Effect.fn("Yeet.dispatchYeetCheckFailure")(function* (
  repoRoot: string,
  head: Pick<YeetRemediationWave, "headSha" | "prNumber">,
  check: YeetWatchCheck,
  at: string
): Effect.fn.Return<void, never, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  const capsule = YeetFailureCapsule.make({
    bucket: check.signal.bucket,
    headSha: head.headSha,
    lane: check.name,
    link: check.link,
    observedAt: at,
    prNumber: head.prNumber,
    state: check.signal.state,
    workflow: check.workflow,
  });
  const id = yield* yeetInboxRowId(capsule).pipe(
    Effect.asSome,
    Effect.catch((error) =>
      Console.error(
        `[yeet] failed to derive inbox row id for "${capsule.lane}" (${error.message}); the red is NOT queued and will retry on the next observation.`
      ).pipe(Effect.as(O.none<string>()))
    )
  );
  if (O.isNone(id)) {
    return;
  }
  const row = YeetCheckFailedRow.make({
    capsule,
    checkout: repoRoot,
    id: id.value,
    severity: check.required ? YeetInboxSeverity.Enum.P0 : YeetInboxSeverity.Enum.P1,
    ts: at,
  });
  const wave = yield* loadYeetRemediationWave(repoRoot);
  const outcome = decideYeetRemediation(
    YeetRemediationInput.make({
      at,
      capsuleId: row.id,
      headSha: head.headSha,
      prNumber: head.prNumber,
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

const renderYeetBaseConflictDispatchLine = (outcome: YeetRemediationOutcome, row: YeetBaseConflictRow): string => {
  const head = Str.slice(0, 7)(row.capsule.headSha);
  const opened = `[yeet] base conflict with ${row.capsule.base} on head ${head} — P0 capsule ${row.id}`;
  return Match.value(outcome.decision).pipe(
    Match.when("start-session", () => `${opened} opened the repair session; merge ${row.capsule.base} and push`),
    Match.when(
      "queue",
      () =>
        `${opened} queued to the head ${head} repair session (${A.length(outcome.wave.capsuleIds)} capsules); merge ${row.capsule.base} and push`
    ),
    Match.when("duplicate", () => `${opened} already queued for head ${head}`),
    Match.exhaustive
  );
};

/**
 * Derive the conflict generation for the next base-conflict row on one pull request head.
 *
 * **Details**
 *
 * Counts the head's consumed base-conflict rows, by walking the
 * deterministic id chain from generation 0 and stopping at the first id that
 * is not consumed. A row is consumed when its ack receipt is `cleared`, or
 * when a receipt file exists but does not decode. Generation n + 1 is only
 * ever written after generation n was consumed, so the walk sees every
 * consumed row. While the latest row is still open this returns its
 * generation, so every poll and a restarted monitor derive the same id and
 * append nothing; after the loop acks it `cleared`, the next conflict on the
 * same head gets the next generation and a new row.
 *
 * **Gotchas**
 *
 * The walk reads the ack receipts, not the bounded active index: the index
 * drops an acked row the next time any row is appended, so counting the rows
 * it holds would lose cleared generations and derive an acknowledged id
 * again. A receipt that exists but does not decode (a truncated write) still
 * acks its row, so the append would skip that id and the recall would ignore
 * it; stopping there would leave the head's next conflict with no row. The
 * walk counts it as consumed instead and prints one stderr line naming the
 * receipt path. A decodable receipt of any kind other than `cleared` stays
 * the current generation: a row an operator acked some other way keeps the
 * head's conflict closed until a push.
 *
 * **Example** (Build the derivation)
 *
 * ```ts
 * import { yeetBaseConflictGeneration } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const program = yeetBaseConflictGeneration("/repo", { headSha: "abc123", prNumber: 751 })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param repoRoot - The checkout whose ack receipts are read.
 * @param coordinates - The pull request number and head SHA.
 * @returns The number of the head's consumed base-conflict rows: acked `cleared`, or with a receipt that does not decode.
 * @category services
 * @since 0.0.0
 */
export const yeetBaseConflictGeneration = Effect.fn("Yeet.yeetBaseConflictGeneration")(function* (
  repoRoot: string,
  coordinates: Pick<YeetBaseConflictCapsule, "headSha" | "prNumber">
): Effect.fn.Return<number, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  let generation = 0;
  while (yield* baseConflictGenerationConsumed(repoRoot, { ...coordinates, generation })) {
    generation += 1;
  }
  return generation;
});

// Whether the generation's row id is consumed: its receipt is `cleared`, or
// the receipt file exists but does not decode. A corrupt receipt still acks
// the row, so ending the walk on it would wedge the head at that generation;
// it is passed with one stderr line instead. A missing receipt, or a
// decodable one of another kind, ends the walk at that generation.
const baseConflictGenerationConsumed = Effect.fnUntraced(function* (
  repoRoot: string,
  coordinates: Pick<YeetBaseConflictCapsule, "generation" | "headSha" | "prNumber">
): Effect.fn.Return<boolean, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  const id = yield* yeetBaseConflictRowId(coordinates);
  const ack = yield* readYeetAckState(repoRoot, id);
  const receipt = O.fromNullOr(ack.receipt);
  if (O.isSome(receipt)) return receipt.value.resolution.kind === "cleared";
  if (!ack.acked) return false;
  const ackPath = yield* yeetInboxAckPath(repoRoot, id);
  yield* Console.error(
    `[yeet] base-conflict ack receipt ${ackPath} does not decode; counting conflict generation ${coordinates.generation} on head ${Str.slice(0, 7)(coordinates.headSha)} as consumed`
  );
  return true;
});

/**
 * Dispatch one observed base conflict: inbox row once, then the head's wave.
 *
 * **Details**
 *
 * The row id is deterministic over (prNumber, headSha, generation), so the
 * row is appended at most once per conflict generation on a head, including
 * across monitor restarts; the caller derives the generation with
 * {@link yeetBaseConflictGeneration}. The row's id then joins the wave record
 * through the same {@link decideYeetRemediation} policy a check red uses: a
 * conflict on a head with no open session opens it, and a conflict beside a
 * red queues onto it. That keeps the conflict's liveness tied to the head, so
 * the next push supersedes it with the rest of the wave. As with check reds,
 * the append happens before the wave persist and an append failure skips the
 * persist. The next poll that still reads the conflict is the retry.
 *
 * When the inbox already holds the row, or an ack receipt for it, nothing is
 * appended, the wave is left alone, and the result is `None`: `Some` always
 * means this call wrote a live, unacknowledged row.
 *
 * Nothing here fails the caller: every failure path degrades to a stderr line.
 *
 * **Example** (Build the dispatch effect)
 *
 * ```ts
 * import { dispatchYeetBaseConflict, YeetBaseConflictCapsule } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const capsule = YeetBaseConflictCapsule.make({
 *   base: "origin/main", headSha: "abc123", link: null,
 *   mergeable: "CONFLICTING", mergeStateStatus: "DIRTY", prNumber: 751
 * })
 *
 * console.log(Effect.isEffect(dispatchYeetBaseConflict("/repo", capsule, "2026-09-25T00:00:00Z"))) // true
 * ```
 *
 * @param repoRoot - The checkout whose inbox and wave record receive the conflict.
 * @param capsule - The conflicted head, its pull request, and the raw merge fields.
 * @param at - The observation timestamp stamped on the row and the wave.
 * @returns The row when this call appended it; `None` when the inbox already held it, an ack receipt exists for it, or the append failed.
 * @category services
 * @since 0.0.0
 */
export const dispatchYeetBaseConflict = Effect.fn("Yeet.dispatchYeetBaseConflict")(function* (
  repoRoot: string,
  capsule: YeetBaseConflictCapsule,
  at: string
): Effect.fn.Return<O.Option<YeetBaseConflictRow>, never, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  const delivered = yield* yeetBaseConflictRowId(capsule).pipe(
    Effect.map((id) => YeetBaseConflictRow.make({ capsule, checkout: repoRoot, id, severity: "P0", ts: at })),
    Effect.flatMap((row) =>
      appendYeetInboxRowOnce(repoRoot, row).pipe(
        Effect.map((appended) => (appended ? O.some(row) : O.none<YeetBaseConflictRow>()))
      )
    ),
    Effect.catch((error) =>
      Console.error(
        `[yeet] failed to deliver the base-conflict row for head ${Str.slice(0, 7)(capsule.headSha)} to the inbox (${error.message}); it is NOT queued and will retry on the next poll.`
      ).pipe(Effect.as(O.none<YeetBaseConflictRow>()))
    )
  );
  if (O.isNone(delivered)) {
    return delivered;
  }
  const row = delivered.value;
  const wave = yield* loadYeetRemediationWave(repoRoot);
  const outcome = decideYeetRemediation(
    YeetRemediationInput.make({
      at,
      capsuleId: row.id,
      headSha: capsule.headSha,
      prNumber: capsule.prNumber,
      wave: O.getOrNull(wave),
    })
  );
  if (!YeetDispatchDecision.is.duplicate(outcome.decision)) {
    yield* persistYeetRemediationWave(repoRoot, outcome.wave);
  }
  yield* Console.error(renderYeetBaseConflictDispatchLine(outcome, row));
  return delivered;
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
): Effect.fn.Return<void, never, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
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

/**
 * Stamp one head's required red set on the persisted wave record.
 *
 * **Details**
 *
 * The `--until-ready` loop calls this on every converging poll, after the
 * poll's rows are appended and after the first poll of a head pinned the
 * record to it. It writes only when the record is pinned to this head and
 * holds a different key, so an unchanged red set costs one read. A record on
 * another head is left alone: pinning is the caller's first-poll job.
 *
 * **Gotchas**
 *
 * The rows and the key are two writes. A waiter that reads between them can
 * hand the same rows back once more on its next read. That is accepted: the
 * window is one poll's local file writes, and a duplicate return repeats the
 * gate line; it loses nothing.
 *
 * **Example** (Build the stamp effect)
 *
 * ```ts
 * import { stampYeetWaveRedSet } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const head = { headSha: "abc123", prNumber: 751 }
 *
 * console.log(Effect.isEffect(stampYeetWaveRedSet("/repo", head, "", "2026-09-25T00:00:00Z"))) // true
 * ```
 *
 * @param repoRoot - The checkout whose wave record is stamped.
 * @param head - The observed head: its SHA and pull request number.
 * @param redSetKey - The head's required red set ({@link yeetWaveRedSetKey}).
 * @param at - The observation timestamp stamped as the record's `updatedAt`.
 * @returns The key the record held for this head before the stamp; `None` when it held none or is on another head.
 * @category services
 * @since 0.0.0
 */
export const stampYeetWaveRedSet = Effect.fn("Yeet.stampYeetWaveRedSet")(function* (
  repoRoot: string,
  head: Pick<YeetRemediationWave, "headSha" | "prNumber">,
  redSetKey: string,
  at: string
): Effect.fn.Return<O.Option<string>, never, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  const pinned = O.filter(
    yield* loadYeetRemediationWave(repoRoot),
    (wave) => wave.headSha === head.headSha && wave.prNumber === head.prNumber
  );
  if (O.isNone(pinned)) return O.none<string>();
  const previous = pinned.value.redSetKey;
  if (!O.contains(previous, redSetKey)) {
    yield* persistYeetRemediationWave(
      repoRoot,
      YeetRemediationWave.make({ ...pinned.value, redSetKey: O.some(redSetKey), updatedAt: at })
    );
  }
  return previous;
});
