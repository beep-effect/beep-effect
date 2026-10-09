/**
 * The pure W8 KPI fold (KPI law v1.2 §7; launch sitting Rulings 3, 5–9).
 *
 * **Details**
 *
 * Every function here is pure over decoded, digest-verified inputs: no wall
 * clock, no environment read, no process spawn. The starvation bound and the
 * window slices are declared as constants before any computation (§7.6).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CiopsId } from "@beep/identity/packages";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Match from "effect/Match";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { PosInt } from "../projection/PosInt.ts";
import {
  AdoptionProbe,
  AdoptionTable,
  ChangeEventPartition,
  ChangeEventRow,
  ChangeEventTierPartition,
  Cq012Decomposition,
  EpisodeAdoption,
  EpisodeKey,
  GitCommitSha,
  KpiAdmissionJoinMismatchError,
  KpiEpisode,
  KpiInputDecodeError,
  KpiReading,
  M1ReplicaRow,
  PercentileRow,
  PercentileSet,
  PinnedKpiInput,
  StarvationRow,
  WindowBounds,
} from "./Schemas.ts";
import { FleetAttempt, FleetJournal, KpiAdmissionRow } from "./Sources.ts";
import type { AdoptionClass, AncestryVerdict, CensorClass, KpiTier } from "./Schemas.ts";

const $I = $CiopsId.create("kpi/Fold");

/**
 * The declared starvation bound, 120000 ms (KPI law v1.2 §7.6), fixed before any reading is computed.
 *
 * **Example** (Read the declared bound)
 *
 * ```ts
 * import { starvationBoundMs } from "@/kpi/Fold"
 *
 * console.log(starvationBoundMs) // 120000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const starvationBoundMs: PosInt = PosInt.make(120_000);

// Non-normative sensitivity bounds shown beside the declared one (15 and 60 minutes).
const sensitivityBoundsMs: ReadonlyArray<PosInt> = [PosInt.make(900_000), PosInt.make(3_600_000)];

/**
 * The window `W` and its two named slices (launch sitting Rulings 5 and 12b).
 *
 * **Details**
 *
 * `W` is half-open, `[start, end)`; `W-a` ends at M1's measurement instant
 * inclusive and `W-b` spans the canonical admission root's first to last
 * retained rows inclusive.
 *
 * **Example** (Read the window start)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime";
 * import { kpiWindows } from "@/kpi/Fold"
 *
 * console.log(DateTime.formatIso(kpiWindows[0].start)) // "2026-09-03T06:29:33.572Z"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const kpiWindows: readonly [WindowBounds, WindowBounds, WindowBounds] = [
  WindowBounds.make({
    slice: "W",
    start: DateTime.makeUnsafe("2026-09-03T06:29:33.572Z"),
    end: DateTime.makeUnsafe("2026-10-06T03:19:28.440Z"),
  }),
  WindowBounds.make({
    slice: "W-a",
    start: DateTime.makeUnsafe("2026-09-03T06:29:33.572Z"),
    end: DateTime.makeUnsafe("2026-09-28T12:57:53.988Z"),
  }),
  WindowBounds.make({
    slice: "W-b",
    start: DateTime.makeUnsafe("2026-10-01T09:32:09.602Z"),
    end: DateTime.makeUnsafe("2026-10-06T01:51:50.495Z"),
  }),
];

const [windowW, windowWa, windowWb] = kpiWindows;

// M1's comparable modes and its 24 h `comparable24h` ceiling (TTC rulings 73-75).
const m1Modes: ReadonlyArray<string> = ["verify", "repair", "publish"];
const m1CeilingMs = 86_400_000;

// Tiers that own an attempt subsequence; the merged-preview sub-partition shares TierLocalFullProof's.
const subsequenceTiers: ReadonlyArray<KpiTier> = ["repair-green", "local-full-proof", "ci-merge-green", "unassigned"];

// Tiers reported as percentile rows, in reading order.
const reportedTiers: ReadonlyArray<KpiTier> = [
  "repair-green",
  "local-full-proof",
  "local-full-proof-merged-preview",
  "ci-merge-green",
  "unassigned",
];

const localSeriesTiers: ReadonlyArray<KpiTier> = [
  "repair-green",
  "local-full-proof",
  "local-full-proof-merged-preview",
  "unassigned",
];

const hostedSeriesTiers: ReadonlyArray<KpiTier> = ["ci-merge-green"];

/**
 * Decoded, digest-verified inputs of the fold.
 *
 * **Example** (Construct an empty fold input)
 *
 * ```ts
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import * as DateTime from "effect/DateTime";
 * import { changeEventTable } from "@/kpi/ChangeEvents"
 * import { KpiFoldInput } from "@/kpi/Fold"
 * import { AdoptionTable, PinnedKpiInput } from "@/kpi/Schemas"
 *
 * const sha = Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * const input = KpiFoldInput.make({
 *   inputs: [PinnedKpiInput.make({ role: "adoption-table", path: "table.json", sha256: sha })],
 *   captureInstant: DateTime.makeUnsafe("2026-10-06T03:19:28.440Z"),
 *   journals: [],
 *   admissions: [],
 *   adoption: AdoptionTable.make({
 *     schemaVersion: "ciops-kpi-adoption-table/v1",
 *     generator: "apps/labs/ciops/scripts/generate-adoption-table.ts",
 *     probe: "git merge-base --is-ancestor",
 *     generation: "local clone with full history; never a CI check",
 *     windowStart: DateTime.makeUnsafe("2026-09-03T06:29:33.572Z"),
 *     windowEnd: DateTime.makeUnsafe("2026-10-06T03:19:28.440Z"),
 *     pins: [PinnedKpiInput.make({ role: "change-event-ledger", path: "ledger.yaml", sha256: sha })],
 *     rows: []
 *   }),
 *   changeEvents: changeEventTable
 * })
 * console.log(input.journals.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KpiFoldInput extends S.Class<KpiFoldInput>($I`KpiFoldInput`)(
  {
    inputs: S.NonEmptyArray(PinnedKpiInput),
    captureInstant: S.DateTimeUtcFromString,
    journals: S.Array(FleetJournal),
    admissions: S.Array(KpiAdmissionRow),
    adoption: AdoptionTable,
    changeEvents: S.NonEmptyArray(ChangeEventRow),
  },
  $I.annote("KpiFoldInput", {
    description: "Decoded, digest-verified journals, admission rows, adoption table and change events of one reading.",
  })
) {}

// One folded episode with the facts the reading needs beyond the contract's KpiEpisode.
class FoldedEpisode extends S.Class<FoldedEpisode>($I`FoldedEpisode`)(
  { episode: KpiEpisode, head: S.Option(GitCommitSha), queueWaitMs: S.Option(S.Natural) },
  $I.annote("FoldedEpisode", {
    description: "A KPI episode with its opening attempt's resolved head and, when it decomposes, its queue wait.",
  })
) {}

// A streak of attempts: closed by a green attempt, or open at the end of the subsequence.
class Streak extends S.Class<Streak>($I`Streak`)(
  { members: S.NonEmptyArray(FleetAttempt), closing: S.Option(FleetAttempt) },
  $I.annote("Streak", { description: "The red attempts of one streak and the green attempt that closed it, if any." })
) {}

// Facts of one attempt journal the censoring rules read.
class JournalFacts extends S.Class<JournalFacts>($I`JournalFacts`)(
  { atWriterCap: S.Boolean, cutoff: S.Option(S.DateTimeUtcFromString), firstAttemptId: S.Option(S.String) },
  $I.annote("JournalFacts", {
    description: "Writer-cap flag, compaction cutoff and first retained attempt of one attempt journal.",
  })
) {}

const millis = DateTime.toEpochMillis;
const natural = (value: number): number => S.Natural.make(Math.max(0, Math.round(value)));
const instant = (value: number): DateTime.Utc => DateTime.makeUnsafe(value);

const inSlice = (window: WindowBounds, at: DateTime.Utc): boolean =>
  DateTime.isGreaterThanOrEqualTo(at, window.start) &&
  (Eq.equals(window.slice, "W") ? DateTime.isLessThan(at, window.end) : DateTime.isLessThanOrEqualTo(at, window.end));

/**
 * Nearest-rank percentile of a population: the sorted value at index `ceil(p·n/100) − 1`.
 *
 * **Example** (Read the P95 of ten values)
 *
 * ```ts
 * import { nearestRank } from "@/kpi/Fold"
 *
 * console.log(nearestRank([10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 95)) // Option.some(10)
 * ```
 *
 * @category estimators
 * @since 0.0.0
 */
export const nearestRank: {
  (percentile: number): (values: ReadonlyArray<number>) => O.Option<number>;
  (values: ReadonlyArray<number>, percentile: number): O.Option<number>;
} = dual(2, (values: ReadonlyArray<number>, percentile: number): O.Option<number> => {
  const sorted = A.sort(values, N.Order);
  const rank = Math.ceil((percentile * A.length(sorted)) / 100) - 1;
  return A.get(sorted, Math.max(0, Math.min(A.length(sorted) - 1, rank)));
});

const percentileSet = (values: ReadonlyArray<number>): PercentileSet =>
  PercentileSet.make({
    n: natural(A.length(values)),
    p50Ms: O.map(nearestRank(values, 50), natural),
    p95Ms: O.map(nearestRank(values, 95), natural),
  });

/**
 * Classifies one attempt start onto a tier or bucket (KPI law v1.2 §7.3).
 *
 * **Details**
 *
 * By `stage`, with the proof scope as a guard: every `review-fix` start and
 * every pre-push start not at `full` scope goes to `unassigned`; a start with
 * no `stage` is `untiered`. Merged preview is identified by stage only.
 *
 * **Example** (Classify a cheap-gates publish)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime";
 * import * as O from "effect/Option"
 * import { classifyAttempt } from "@/kpi/Fold"
 * import { FleetAttempt } from "@/kpi/Sources"
 *
 * const attempt = FleetAttempt.make({
 *   checkout: "beep-effect",
 *   runId: "main-0123456789ab",
 *   attemptId: "a-1",
 *   branch: "main",
 *   mode: "publish",
 *   startedAt: DateTime.makeUnsafe("2026-10-06T02:00:00.000Z"),
 *   stage: O.some("pre-push"),
 *   proofScope: O.some("cheap-gates"),
 *   resolvedHeadSha: O.none(),
 *   outcome: "red",
 *   finishedAt: O.none()
 * })
 * console.log(classifyAttempt(attempt)) // "unassigned"
 * ```
 *
 * @category classification
 * @since 0.0.0
 */
export const classifyAttempt = (attempt: FleetAttempt): KpiTier =>
  O.exists(attempt.proofScope, Eq.equals("review-fix"))
    ? "unassigned"
    : O.match(attempt.stage, {
        onNone: (): KpiTier => "untiered",
        onSome: Match.type<FleetAttempt["stage"] extends O.Option<infer A> ? A : never>().pipe(
          Match.when("repair-loop", (): KpiTier => "repair-green"),
          Match.when(
            "pre-push",
            (): KpiTier => (O.exists(attempt.proofScope, Eq.equals("full")) ? "local-full-proof" : "unassigned")
          ),
          Match.when("merged-preview", (): KpiTier => "local-full-proof-merged-preview"),
          Match.when("hosted", (): KpiTier => "ci-merge-green"),
          Match.exhaustive
        ),
      });

const subsequenceOf = (attempt: FleetAttempt): KpiTier => {
  const tier = classifyAttempt(attempt);
  return Eq.equals(tier, "local-full-proof-merged-preview") ? "local-full-proof" : tier;
};

const attemptOrder = Order.combine(
  Order.mapInput(DateTime.Order, (attempt: FleetAttempt) => attempt.startedAt),
  Order.mapInput(Order.String, (attempt: FleetAttempt) => attempt.attemptId)
);

class StreakState extends S.Class<StreakState>($I`StreakState`)(
  { open: S.Array(FleetAttempt), closed: S.Array(Streak) },
  $I.annote("StreakState", { description: "Streak walk state: the open streak's members and the closed streaks." })
) {}

const closeStreak = (state: StreakState, attempt: FleetAttempt): StreakState =>
  A.match(state.open, {
    onEmpty: () => state,
    onNonEmpty: (members) =>
      StreakState.make({
        open: [],
        closed: A.append(state.closed, Streak.make({ members, closing: O.some(attempt) })),
      }),
  });

// A lock bounce never opens a streak (KPI law §4) but stays inside an open one.
const extendStreak = (state: StreakState, attempt: FleetAttempt): StreakState =>
  Eq.equals(attempt.outcome, "bounce") && A.isReadonlyArrayEmpty(state.open)
    ? state
    : StreakState.make({ open: A.append(state.open, attempt), closed: state.closed });

const walkStep = (state: StreakState, attempt: FleetAttempt): StreakState =>
  Eq.equals(attempt.outcome, "success") ? closeStreak(state, attempt) : extendStreak(state, attempt);

/**
 * Splits one `(checkout, branch)` attempt subsequence into red streaks.
 *
 * **Details**
 *
 * Attempts are walked in start order; consecutive non-green attempts form a
 * streak that the next green attempt closes, a lock bounce never opens one,
 * unterminated attempts stay outside every streak (as in M1), and a streak
 * still open at the end is returned without a closing attempt.
 *
 * **Example** (Walk an empty subsequence)
 *
 * ```ts
 * import { streaksOf } from "@/kpi/Fold"
 *
 * console.log(streaksOf([]).length) // 0
 * ```
 *
 * @category episodes
 * @since 0.0.0
 */
export const streaksOf = (attempts: ReadonlyArray<FleetAttempt>): ReadonlyArray<Streak> => {
  const walked = A.reduce(
    A.sort(
      A.filter(attempts, (attempt) => !Eq.equals(attempt.outcome, "unterminated")),
      attemptOrder
    ),
    StreakState.make({ open: [], closed: [] }),
    walkStep
  );
  return A.match(walked.open, {
    onEmpty: () => walked.closed,
    onNonEmpty: (members) => A.append(walked.closed, Streak.make({ members, closing: O.none() })),
  });
};

const pairKey = (attempt: FleetAttempt): string => `${attempt.checkout}\u0000${attempt.branch}`;
const journalKey = (checkout: string, runId: string): string => `${checkout}\u0000${runId}`;

const journalFacts = (journal: FleetJournal): JournalFacts =>
  JournalFacts.make({
    atWriterCap: journal.atWriterCap,
    cutoff: journal.compactionCutoff,
    firstAttemptId: O.map(A.head(A.sort(journal.attempts, attemptOrder)), (attempt) => attempt.attemptId),
  });

const factsByJournal = (journals: ReadonlyArray<FleetJournal>): HashMap.HashMap<string, JournalFacts> =>
  HashMap.fromIterable(
    A.map(journals, (journal) => [journalKey(journal.checkout, journal.runId), journalFacts(journal)])
  );

const resolutionInstant = (row: KpiAdmissionRow): O.Option<number> =>
  Match.value(row._tag).pipe(
    Match.when("admission-admitted", () => row.admittedAtMillis),
    Match.when("admission-withdrawn", () => row.withdrawnAtMillis),
    Match.when("admission-ticket-evicted", () => row.evictedAtMillis),
    Match.orElse(O.none<number>)
  );

const earliest = (map: HashMap.HashMap<string, number>, key: string, at: number): HashMap.HashMap<string, number> =>
  HashMap.set(
    map,
    key,
    Math.min(
      at,
      O.getOrElse(HashMap.get(map, key), () => at)
    )
  );

// A ticket is resolved by its admission, withdrawal or ticket eviction, whichever came first.
const resolutionsByNonce = (rows: ReadonlyArray<KpiAdmissionRow>): HashMap.HashMap<string, number> =>
  A.reduce(rows, HashMap.empty<string, number>(), (resolved, row) =>
    O.match(resolutionInstant(row), { onNone: () => resolved, onSome: (at) => earliest(resolved, row.nonce, at) })
  );

// One admission ticket naming an attempt: its nonce, the attempt and its enqueue instant.
class AttemptTicket extends S.Class<AttemptTicket>($I`AttemptTicket`)(
  { nonce: S.String, attemptId: S.String, enqueuedAtMillis: S.Finite },
  $I.annote("AttemptTicket", { description: "One admission ticket joined to a pinned attempt id." })
) {}

// The joined tickets of every attempt id, and each ticket nonce's resolution.
class TicketIndex extends S.Class<TicketIndex>($I`TicketIndex`)(
  {
    byAttempt: S.HashMap(S.String, S.Array(AttemptTicket)),
    resolved: S.HashMap(S.String, S.Finite),
  },
  $I.annote("TicketIndex", {
    description: "Admission tickets grouped by the attempt id they name, with each nonce's resolution instant.",
  })
) {}

// Every row carrying an attempt id and an enqueue instant names a ticket: v3 enqueue and
// withdrawal rows, and v1 admitted rows for granted work (KPI law v1.2 §7.4). One ticket per nonce.
const ticketIndex = (rows: ReadonlyArray<KpiAdmissionRow>): TicketIndex => {
  const tickets = A.dedupeWith(
    A.getSomes(
      A.map(rows, (row) =>
        O.map(O.all([row.attemptId, row.enqueuedAtMillis]), ([attemptId, enqueuedAtMillis]) =>
          AttemptTicket.make({ nonce: row.nonce, attemptId, enqueuedAtMillis })
        )
      )
    ),
    (a, b) => a.nonce === b.nonce
  );
  return TicketIndex.make({
    byAttempt: A.reduce(tickets, HashMap.empty<string, ReadonlyArray<AttemptTicket>>(), (index, ticket) =>
      HashMap.set(index, ticket.attemptId, A.append(O.getOrElse(HashMap.get(index, ticket.attemptId), A.empty), ticket))
    ),
    resolved: resolutionsByNonce(rows),
  });
};

// The earliest enqueue of any ticket joined to an attempt: the seat-request candidate (§7.4).
const seatRequestOf = (index: TicketIndex, attemptId: string): O.Option<number> =>
  O.flatMap(HashMap.get(index.byAttempt, attemptId), (tickets) =>
    O.map(
      A.head(
        A.sort(
          A.map(tickets, (ticket) => ticket.enqueuedAtMillis),
          N.Order
        )
      ),
      (enqueued) => enqueued
    )
  );

// An attempt's queue wait: the sum over its joined tickets of enqueue to resolution, observed
// only when it has at least one ticket and every ticket resolved.
const attemptQueueWait = (index: TicketIndex, attemptId: string): O.Option<number> =>
  O.flatMap(
    O.flatMap(HashMap.get(index.byAttempt, attemptId), A.match({ onEmpty: O.none, onNonEmpty: O.some })),
    (tickets) =>
      O.map(
        O.all(
          A.map(tickets, (ticket) =>
            O.map(HashMap.get(index.resolved, ticket.nonce), (at) => at - ticket.enqueuedAtMillis)
          )
        ),
        N.sumAll
      )
  );

const joinDisagreement = (row: KpiAdmissionRow, attempt: FleetAttempt): O.Option<string> =>
  O.exists(row.branch, (branch) => branch !== attempt.branch)
    ? O.some("branch")
    : O.exists(row.checkoutRoot, (root) => root !== `<fleet>/${attempt.checkout}`)
      ? O.some("checkout")
      : O.none();

// A ticket joins an attempt by attempt id, checked against `branch` and the checkout label
// where the row carries them; a disagreement fails closed (KPI law v1.2 §7.4).
const checkTicketJoins = (
  rows: ReadonlyArray<KpiAdmissionRow>,
  attempts: HashMap.HashMap<string, FleetAttempt>
): Effect.Effect<void, KpiAdmissionJoinMismatchError> =>
  pipe(
    A.getSomes(
      A.map(rows, (row) =>
        pipe(
          O.flatMap(row.attemptId, (attemptId) => HashMap.get(attempts, attemptId)),
          O.flatMap((attempt) => joinDisagreement(row, attempt)),
          O.map((member) =>
            KpiAdmissionJoinMismatchError.make({
              nonce: row.nonce,
              eventTag: row._tag,
              message: `The row names a pinned attempt whose ${member} differs from the row's.`,
            })
          )
        )
      )
    ),
    A.head,
    O.match({ onNone: () => Effect.void, onSome: Effect.fail })
  );

const stopInstant = (attempt: FleetAttempt): DateTime.Utc => O.getOrElse(attempt.finishedAt, () => attempt.startedAt);

const establishingAttempt = (streak: Streak): FleetAttempt =>
  O.getOrElse(streak.closing, () => A.lastNonEmpty(streak.members));

const isLeftCensored = (facts: JournalFacts, openedAt: DateTime.Utc): boolean =>
  O.exists(facts.cutoff, (cutoff) => DateTime.isGreaterThanOrEqualTo(cutoff, openedAt));

// No receipt, an at-cap journal, and the streak opens at its first retained attempt (§7.5).
const isPossiblyTruncated = (facts: JournalFacts, first: FleetAttempt): boolean =>
  facts.atWriterCap && O.isNone(facts.cutoff) && O.exists(facts.firstAttemptId, Eq.equals(first.attemptId));

const censoringOf = (
  streak: Streak,
  openedAt: DateTime.Utc,
  facts: O.Option<JournalFacts>
): ReadonlyArray<CensorClass> =>
  A.getSomes([
    O.isNone(streak.closing) ? O.some<CensorClass>("right-censored") : O.none(),
    O.exists(facts, (f) => isLeftCensored(f, openedAt)) ? O.some<CensorClass>("left-censored") : O.none(),
    O.exists(facts, (f) => isPossiblyTruncated(f, A.headNonEmpty(streak.members)))
      ? O.some<CensorClass>("possibly-truncated")
      : O.none(),
  ]);

const episodeTier = (tier: KpiTier, streak: Streak): KpiTier =>
  Eq.equals(tier, "local-full-proof") && O.exists(establishingAttempt(streak).stage, Eq.equals("merged-preview"))
    ? "local-full-proof-merged-preview"
    : tier;

// An episode decomposes when every attempt in it (members and the closing attempt) has an
// observed queue wait; its queue wait is then their sum (CQ-012, launch sitting Ruling 12d).
const episodeQueueWait = (index: TicketIndex, streak: Streak): O.Option<number> =>
  O.map(
    O.all(
      A.map(A.appendAll(streak.members, O.toArray(streak.closing)), (attempt) =>
        attemptQueueWait(index, attempt.attemptId)
      )
    ),
    N.sumAll
  );

const foldStreak =
  (tier: KpiTier, tickets: TicketIndex, journals: HashMap.HashMap<string, JournalFacts>) =>
  (streak: Streak): FoldedEpisode => {
    const first = A.headNonEmpty(streak.members);
    const startMs = millis(first.startedAt);
    const ticket = O.filter(seatRequestOf(tickets, first.attemptId), (enqueued) => enqueued <= startMs);
    const openMs = O.getOrElse(ticket, () => startMs);
    const stoppedAt = stopInstant(establishingAttempt(streak));
    const openedAt = instant(openMs);
    return FoldedEpisode.make({
      episode: KpiEpisode.make({
        key: EpisodeKey.make({ checkout: first.checkout, branch: first.branch }),
        tier: episodeTier(tier, streak),
        clock: O.isSome(ticket) ? "seat-request" : "attempt-start",
        openedAt,
        stoppedAt,
        durationMs: natural(millis(stoppedAt) - openMs),
        censoring: censoringOf(streak, openedAt, HashMap.get(journals, journalKey(first.checkout, first.runId))),
        adoption: [],
      }),
      head: first.resolvedHeadSha,
      queueWaitMs: O.map(episodeQueueWait(tickets, streak), natural),
    });
  };

// Groups attempts by (checkout, branch) in key order, so the fold is independent of input order.
const pairGroups = (attempts: ReadonlyArray<FleetAttempt>): ReadonlyArray<ReadonlyArray<FleetAttempt>> => {
  const groups = R.toEntries(A.groupBy(attempts, pairKey));
  return A.map(
    A.sort(
      groups,
      Order.mapInput(Order.String, ([key]: readonly [string, unknown]) => key)
    ),
    ([, members]) => members
  );
};

const episodesOfTier =
  (attempts: ReadonlyArray<FleetAttempt>, tickets: TicketIndex, journals: HashMap.HashMap<string, JournalFacts>) =>
  (tier: KpiTier): ReadonlyArray<FoldedEpisode> =>
    pipe(
      pairGroups(A.filter(attempts, (attempt) => Eq.equals(subsequenceOf(attempt), tier))),
      A.flatMap(streaksOf),
      A.map(foldStreak(tier, tickets, journals))
    );

const verdictClass = (verdict: AncestryVerdict): AdoptionClass =>
  Match.value(verdict).pipe(
    Match.when("ancestor", (): AdoptionClass => "post-adopted"),
    Match.when("not-ancestor", (): AdoptionClass => "post-unadopted"),
    Match.when("head-missing", (): AdoptionClass => "unknown"),
    Match.exhaustive
  );

const ancestryKey = (changeEventId: string, head: string): string => `${changeEventId}\u0000${head}`;

const ancestryIndex = (table: AdoptionTable): HashMap.HashMap<string, AncestryVerdict> =>
  HashMap.fromIterable(A.map(table.rows, (row) => [ancestryKey(row.changeEventId, row.resolvedHeadSha), row.ancestry]));

const adoptionClass =
  (index: HashMap.HashMap<string, AncestryVerdict>, adoptionPath: string) =>
  (folded: FoldedEpisode, event: ChangeEventRow): Effect.Effect<AdoptionClass, KpiInputDecodeError> =>
    DateTime.isLessThan(folded.episode.openedAt, event.landedAt)
      ? Effect.succeed("pre")
      : O.match(folded.head, {
          onNone: () => Effect.succeed<AdoptionClass>("unknown"),
          onSome: (head) =>
            Effect.fromOption(HashMap.get(index, ancestryKey(event.id, head))).pipe(
              Effect.map(verdictClass),
              Effect.mapError(() =>
                KpiInputDecodeError.make({
                  role: "adoption-table",
                  path: adoptionPath,
                  message: `The adoption table has no row for ${event.id} at head ${head}.`,
                })
              )
            ),
        });

const isLocalEvent = (event: ChangeEventRow): boolean => A.contains(event.tiers, "local");

const withAdoption =
  (classify: ReturnType<typeof adoptionClass>, events: ReadonlyArray<ChangeEventRow>) =>
  (folded: FoldedEpisode): Effect.Effect<FoldedEpisode, KpiInputDecodeError> =>
    Effect.forEach(events, (event) =>
      Effect.map(classify(folded, event), (adoption) => EpisodeAdoption.make({ changeEventId: event.id, adoption }))
    ).pipe(
      Effect.map((adoption) =>
        FoldedEpisode.make({ ...folded, episode: KpiEpisode.make({ ...folded.episode, adoption }) })
      )
    );

const isCensored = (episode: KpiEpisode): boolean => A.isReadonlyArrayNonEmpty(episode.censoring);

const hasCensor =
  (censor: CensorClass) =>
  (episode: KpiEpisode): boolean =>
    A.contains(episode.censoring, censor);

// TierLocalFullProof's row includes its merged-preview sub-partition.
const inTier =
  (tier: KpiTier) =>
  (episode: KpiEpisode): boolean =>
    Eq.equals(episode.tier, tier) ||
    (Eq.equals(tier, "local-full-proof") && Eq.equals(episode.tier, "local-full-proof-merged-preview"));

const durations = (episodes: ReadonlyArray<KpiEpisode>): ReadonlyArray<number> =>
  A.map(episodes, (episode) => episode.durationMs);

const count = (episodes: ReadonlyArray<KpiEpisode>, predicate: (episode: KpiEpisode) => boolean): number =>
  natural(A.countBy(episodes, predicate));

const percentileRow =
  (episodes: ReadonlyArray<KpiEpisode>) =>
  (window: WindowBounds, tier: KpiTier): PercentileRow => {
    const members = A.filter(episodes, (episode) => inSlice(window, episode.openedAt) && inTier(tier)(episode));
    return PercentileRow.make({
      slice: window.slice,
      tier,
      cut: percentileSet(durations(A.filter(members, (episode) => !isCensored(episode)))),
      uncut: percentileSet(durations(members)),
      rightCensored: count(members, hasCensor("right-censored")),
      leftCensored: count(members, hasCensor("left-censored")),
      possiblyTruncated: count(members, hasCensor("possibly-truncated")),
      seatRequestEpisodes: count(members, (episode) => Eq.equals(episode.clock, "seat-request")),
      attemptStartEpisodes: count(members, (episode) => Eq.equals(episode.clock, "attempt-start")),
    });
  };

class SeatRequest extends S.Class<SeatRequest>($I`SeatRequest`)(
  { enqueuedAt: S.DateTimeUtcFromString, waitMs: S.Natural, openAtCapture: S.Boolean },
  $I.annote("SeatRequest", {
    description: "One v3 seat request: its enqueue instant, its wait, and whether it was still open at capture.",
  })
) {}

// A request waits from its enqueue to its admission, withdrawal or ticket eviction, else to the capture (§7.6).
const seatRequests = (
  rows: ReadonlyArray<KpiAdmissionRow>,
  captureInstant: DateTime.Utc
): ReadonlyArray<SeatRequest> => {
  const resolved = resolutionsByNonce(rows);
  return A.getSomes(
    A.map(rows, (row) =>
      Eq.equals(row._tag, "admission-enqueued")
        ? O.map(row.enqueuedAtMillis, (enqueued) => {
            const resolution = HashMap.get(resolved, row.nonce);
            return SeatRequest.make({
              enqueuedAt: instant(enqueued),
              waitMs: natural(O.getOrElse(resolution, () => millis(captureInstant)) - enqueued),
              openAtCapture: O.isNone(resolution),
            });
          })
        : O.none()
    )
  );
};

const starvationRow =
  (requests: ReadonlyArray<SeatRequest>) =>
  (window: WindowBounds, boundMs: PosInt): StarvationRow => {
    const members = A.filter(requests, (request) => inSlice(window, request.enqueuedAt));
    return StarvationRow.make({
      slice: window.slice,
      boundMs,
      normative: boundMs === starvationBoundMs,
      requests: natural(A.length(members)),
      beyondBound: natural(A.countBy(members, (request) => request.waitMs > boundMs)),
      openAtCapture: natural(A.countBy(members, (request) => request.openAtCapture)),
      exceptions: "unobservable",
    });
  };

const starvationRows = (requests: ReadonlyArray<SeatRequest>): ReadonlyArray<StarvationRow> =>
  A.flatMap(kpiWindows, (window) =>
    A.map([starvationBoundMs, ...sensitivityBoundsMs], (bound) => starvationRow(requests)(window, bound))
  );

const survivorshipCount = (
  rows: ReadonlyArray<KpiAdmissionRow>,
  attempts: HashMap.HashMap<string, FleetAttempt>
): number =>
  natural(
    A.countBy(
      rows,
      (row) =>
        Eq.equals(row._tag, "admission-enqueued") &&
        O.exists(row.enqueuedAtMillis, (enqueued) => inSlice(windowW, instant(enqueued))) &&
        O.exists(row.attemptId, (attemptId) => !HashMap.has(attempts, attemptId))
    )
  );

const isM1Attempt = (attempt: FleetAttempt): boolean =>
  A.contains(m1Modes, attempt.mode) &&
  !Eq.equals(attempt.outcome, "bounce") &&
  DateTime.isGreaterThan(attempt.startedAt, windowWa.start) &&
  DateTime.isLessThanOrEqualTo(attempt.startedAt, windowWa.end);

const streakSpanMs = (streak: Streak, closing: FleetAttempt): number =>
  millis(stopInstant(closing)) - millis(A.headNonEmpty(streak.members).startedAt);

// M1's red-to-green definition run over the fleet pin on `W-a` (launch sitting Ruling 5), never M1
// itself: M1 modes, lock bounces excluded, no tiers, keyed by (checkout, branch), opened at the first
// red start. Closed spans of at most 24 h form `comparable24h`; `uncut` drops the ceiling; open
// streaks are only counted, as M1 counts them.
const m1ReplicaRow = (
  attempts: ReadonlyArray<FleetAttempt>,
  journals: HashMap.HashMap<string, JournalFacts>
): M1ReplicaRow => {
  const streaks = A.flatMap(pairGroups(A.filter(attempts, isM1Attempt)), streaksOf);
  const closed = A.getSomes(
    A.map(streaks, (streak) => O.map(streak.closing, (closing) => [streak, streakSpanMs(streak, closing)] as const))
  );
  const isLeft = ([streak]: readonly [Streak, number]): boolean => {
    const first = A.headNonEmpty(streak.members);
    return O.exists(HashMap.get(journals, journalKey(first.checkout, first.runId)), (facts) =>
      isLeftCensored(facts, first.startedAt)
    );
  };
  const kept = A.filter(closed, (entry) => !isLeft(entry));
  const leftCensored = A.filter(closed, isLeft);
  const spans = A.map(kept, ([, span]) => span);
  const comparable = A.filter(spans, (span) => span <= m1CeilingMs);
  return M1ReplicaRow.make({
    slice: "W-a",
    label: "M1 definition over the fleet pin, not M1",
    comparable24h: percentileSet(comparable),
    uncut: percentileSet(spans),
    rightCensoredStreaks: natural(A.countBy(streaks, (streak) => O.isNone(streak.closing))),
    leftCensoredEpisodesExcluded: natural(A.length(leftCensored)),
    closedEpisodesOver24hExcluded: natural(A.length(spans) - A.length(comparable)),
  });
};

// CQ-012's queue-wait share over W-b, void unless every episode decomposes (KPI law §2, §7.5;
// Ruling 12d). An episode decomposes when every attempt in it joins at least one admission ticket
// and every such ticket resolved; its queue wait is the sum of enqueue-to-resolution over them.
// The denominator is every W-b episode's (uncut) duration. A share above 1 (overlapping tickets)
// cannot be a share, so it voids the row as well.
const cq012Decomposition = (episodes: ReadonlyArray<FoldedEpisode>): Cq012Decomposition => {
  const members = A.filter(episodes, (folded) => inSlice(windowWb, folded.episode.openedAt));
  const waits = A.getSomes(A.map(members, (folded) => folded.queueWaitMs));
  const grandTotalMs = N.sumAll(A.map(members, (folded) => folded.episode.durationMs));
  const pair = { decomposedEpisodes: natural(A.length(waits)), windowEpisodes: natural(A.length(members)) };
  const share = grandTotalMs > 0 ? N.sumAll(waits) / grandTotalMs : Number.NaN;
  return A.length(waits) === A.length(members) && share >= 0 && share <= 1
    ? Cq012Decomposition.cases.shares.make({
        ...pair,
        queueWaitShare: UnitInterval.make(share),
        grandTotalMs: natural(grandTotalMs),
      })
    : Cq012Decomposition.cases.void.make(pair);
};

const adoptionOf = (episode: KpiEpisode, event: ChangeEventRow): O.Option<AdoptionClass> =>
  O.map(
    A.findFirst(episode.adoption, (entry) => entry.changeEventId === event.id),
    (entry) => entry.adoption
  );

const tierPartition =
  (episodes: ReadonlyArray<KpiEpisode>, event: ChangeEventRow) =>
  (tier: KpiTier): ChangeEventTierPartition => {
    const members = A.filter(episodes, inTier(tier));
    const ofClass = (adoption: AdoptionClass) =>
      A.filter(members, (episode) => O.exists(adoptionOf(episode, event), Eq.equals(adoption)));
    const pre = ofClass("pre");
    const postAdopted = ofClass("post-adopted");
    return ChangeEventTierPartition.make({
      tier,
      pre: percentileSet(durations(A.filter(pre, (episode) => !isCensored(episode)))),
      preCensored: count(pre, isCensored),
      postAdopted: percentileSet(durations(A.filter(postAdopted, (episode) => !isCensored(episode)))),
      postAdoptedCensored: count(postAdopted, isCensored),
      postUnadopted: natural(A.length(ofClass("post-unadopted"))),
      unknown: natural(A.length(ofClass("unknown"))),
    });
  };

const partitionOf =
  (episodes: ReadonlyArray<KpiEpisode>) =>
  (event: ChangeEventRow): ChangeEventPartition =>
    ChangeEventPartition.make({
      changeEventId: event.id,
      label: "observational",
      inWindow: inSlice(windowW, event.landedAt),
      tiers: A.map(
        [
          ...(isLocalEvent(event) ? localSeriesTiers : []),
          ...(A.contains(event.tiers, "hosted") ? hostedSeriesTiers : []),
        ],
        tierPartition(episodes, event)
      ),
    });

const attemptIndex = (attempts: ReadonlyArray<FleetAttempt>): HashMap.HashMap<string, FleetAttempt> =>
  HashMap.fromIterable(A.map(attempts, (attempt) => [attempt.attemptId, attempt]));

const untieredStarts = (attempts: ReadonlyArray<FleetAttempt>): number =>
  natural(A.countBy(attempts, (attempt) => O.isNone(attempt.stage) && inSlice(windowW, attempt.startedAt)));

// Checks every ticket join, then folds every tier's attempt subsequence into episodes.
const foldEpisodes = Effect.fnUntraced(function* (
  journals: ReadonlyArray<FleetJournal>,
  admissions: ReadonlyArray<KpiAdmissionRow>
): Effect.fn.Return<ReadonlyArray<FoldedEpisode>, KpiAdmissionJoinMismatchError> {
  const attempts = A.flatMap(journals, (journal) => journal.attempts);
  yield* checkTicketJoins(admissions, attemptIndex(attempts));
  return A.flatMap(subsequenceTiers, episodesOfTier(attempts, ticketIndex(admissions), factsByJournal(journals)));
});

const probeOrder = Order.combine(
  Order.mapInput(Order.String, (probe: AdoptionProbe) => probe.changeEventId),
  Order.mapInput(Order.String, (probe: AdoptionProbe) => probe.resolvedHeadSha)
);

const probesOf =
  (events: ReadonlyArray<ChangeEventRow>) =>
  (folded: FoldedEpisode): ReadonlyArray<AdoptionProbe> =>
    O.match(folded.head, {
      onNone: A.empty<AdoptionProbe>,
      onSome: (resolvedHeadSha) =>
        A.filterMap(events, (event) =>
          DateTime.isLessThan(folded.episode.openedAt, event.landedAt)
            ? Result.failVoid
            : Result.succeed(
                AdoptionProbe.make({ changeEventId: event.id, mergeCommit: event.mergeCommit, resolvedHeadSha })
              )
        ),
    });

/**
 * The ancestry probes the committed adoption table must answer (launch sitting Ruling 8).
 *
 * **Details**
 *
 * One probe per local-series change event and per resolved head of an
 * in-window episode opened at or after the event's `landedAt`, deduplicated
 * and sorted by change-event id, then head. Episodes whose opening attempt
 * carries no `resolvedHeadSha` need no probe: their post-period class is
 * `unknown`.
 *
 * **Example** (Probe an empty fleet)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { changeEventTable } from "@/kpi/ChangeEvents"
 * import { adoptionProbes } from "@/kpi/Fold"
 *
 * console.log(Effect.runSync(adoptionProbes([], [], changeEventTable)).length) // 0
 * ```
 *
 * @category folding
 * @since 0.0.0
 */
export const adoptionProbes = Effect.fn("KpiFold.adoptionProbes")(function* (
  journals: ReadonlyArray<FleetJournal>,
  admissions: ReadonlyArray<KpiAdmissionRow>,
  changeEvents: ReadonlyArray<ChangeEventRow>
): Effect.fn.Return<ReadonlyArray<AdoptionProbe>, KpiAdmissionJoinMismatchError> {
  const folded = yield* foldEpisodes(journals, admissions);
  const localEvents = A.filter(changeEvents, isLocalEvent);
  return pipe(
    A.filter(folded, (entry) => inSlice(windowW, entry.episode.openedAt)),
    A.flatMap(probesOf(localEvents)),
    A.dedupeWith((a, b) => a.changeEventId === b.changeEventId && a.resolvedHeadSha === b.resolvedHeadSha),
    A.sort(probeOrder)
  );
});

/**
 * Folds decoded, digest-verified inputs into the `ciops-kpi-reading/v1` document.
 *
 * **Details**
 *
 * Checks every ticket join, builds per-tier episodes, attaches adoption
 * classes for the local-series change events to every episode in `W`, and
 * computes the percentile, starvation, M1-replica, CQ-012 and partition rows.
 * `adoptionPath` names the adoption table in a missing-row failure.
 *
 * @category folding
 * @since 0.0.0
 */
export const foldKpiReading = Effect.fn("KpiFold.foldKpiReading")(function* (
  input: KpiFoldInput,
  adoptionPath: string
): Effect.fn.Return<KpiReading, KpiAdmissionJoinMismatchError | KpiInputDecodeError> {
  const attempts = A.flatMap(input.journals, (journal) => journal.attempts);
  const attemptsById = attemptIndex(attempts);
  const folded = yield* foldEpisodes(input.journals, input.admissions);
  const inWindow = A.filter(folded, (entry) => inSlice(windowW, entry.episode.openedAt));
  const classify = adoptionClass(ancestryIndex(input.adoption), adoptionPath);
  const adopted = yield* Effect.forEach(inWindow, withAdoption(classify, A.filter(input.changeEvents, isLocalEvent)));
  const episodes = A.map(folded, (entry) => entry.episode);
  const windowEpisodes = A.map(adopted, (entry) => entry.episode);
  return KpiReading.make({
    schemaVersion: "ciops-kpi-reading/v1",
    estimator: "nearest-rank",
    inputs: input.inputs,
    windows: kpiWindows,
    starvationBoundMs,
    untieredStarts: untieredStarts(attempts),
    survivorshipUnjoinedRequests: survivorshipCount(input.admissions, attemptsById),
    percentiles: A.flatMap(kpiWindows, (window) =>
      A.map(reportedTiers, (tier) => percentileRow(episodes)(window, tier))
    ),
    starvation: starvationRows(seatRequests(input.admissions, input.captureInstant)),
    m1Replica: [m1ReplicaRow(attempts, factsByJournal(input.journals))],
    decomposition: cq012Decomposition(folded),
    changeEvents: input.changeEvents,
    changeEventPartitions: A.map(input.changeEvents, partitionOf(windowEpisodes)),
  });
});
