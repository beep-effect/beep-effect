/**
 * The consumer-side view of the checkout failure inbox.
 *
 * **Details**
 *
 * Writers append immutable rows (`appendYeetInboxRow`) and never look
 * back; this module is where every consumer — the `yeet inbox` CLI today, the
 * A2 harness adapters (Claude hook deny/inject, Codex splice, Grok tail) next
 * — turns that append-only evidence into the three joined facts enforcement
 * runs on: what failed (the row), whether it was dealt with (the ack state),
 * and whether it still matters (liveness against the current remediation
 * wave).
 *
 * **Gotchas**
 *
 * The reader is deliberately tolerant. Undecodable lines are counted and
 * skipped, never fatal: the inbox is a shared append-only file and one
 * writer's garbage must not blind consumers to every other writer's rows.
 * Duplicate ids keep the first occurrence — rows are immutable
 * first-observation evidence, so a re-appended id is the same failure
 * re-announced, not new information.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { thunkFalse } from "@beep/utils";
import { DateTime, Effect, FileSystem, HashMap, HashSet, MutableHashSet, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { readYeetAckState, YeetAckState } from "./Ack.ts";
import {
  describeYeetInboxRow,
  YeetInboxRow,
  YeetInboxRowJson,
  yeetInboxExpectedRowId,
  yeetInboxPaths,
  yeetInboxRowIsObserved,
  yeetInboxRowIsWaveExempt,
  yeetInboxRowPrNumber,
  yeetInboxRowWakes,
} from "./Inbox.ts";
import { YeetPushToAckTimeline } from "./MonitorPolicy.ts";
import { loadYeetRemediationWave, yeetRedSetKeyGained } from "./Remediation.ts";
import type * as Crypto from "effect/Crypto";
import type { YeetHeadTimeline } from "./MonitorPolicy.ts";
import type { YeetRemediationWave } from "./Remediation.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/InboxView");

/**
 * Schema version stamped on every rendered inbox view.
 *
 * **Example** (Read the version)
 *
 * ```ts
 * import { YEET_INBOX_VIEW_SCHEMA_VERSION } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_INBOX_VIEW_SCHEMA_VERSION) // "yeet-inbox-view/v1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_INBOX_VIEW_SCHEMA_VERSION = "yeet-inbox-view/v1";

/**
 * Whether an inbox row still gates anything.
 *
 * **Details**
 *
 * `live` means the row's identity matches the current remediation wave —
 * same PR, same head — so its failure is about the code the checkout is
 * standing on. `superseded` means a later push made the row historical, and
 * a superseded row must not gate anything. `unknown` means there is no
 * usable wave record to join against — it is *not* a verdict either way.
 * Only the watch dispatcher maintains the wave record today, so rows from
 * writers that never touch it (SPEC A2's local lane runners and collision
 * detectors, A5's package audits) are expected to be `unknown` rather than
 * dead: liveness rules out stale rows, and the consumer's severity policy
 * decides what an `unknown` row's tier still enforces.
 *
 * **Example** (Check a liveness)
 *
 * ```ts
 * import { YeetInboxLiveness } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetInboxLiveness.is.live("live")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetInboxLiveness = LiteralKit(["live", "superseded", "unknown"]).pipe(
  $I.annoteSchema("YeetInboxLiveness", {
    title: "Yeet Inbox Liveness",
    description: "Whether one inbox row belongs to the current remediation wave, a superseded one, or no known wave.",
  })
);

/**
 * Whether an inbox row still gates anything.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetInboxLiveness = typeof YeetInboxLiveness.Type;

/**
 * Decide one row's liveness against the persisted wave record.
 *
 * **Details**
 *
 * Rows the wave never owns are always `live`: sibling collisions, local shard
 * failures, the observed kinds (`YeetInboxObservedRowKind`), and the
 * wave-exempt kinds (`YeetInboxWaveExemptRowKind`), which a push does not
 * resolve. Every other row joins the wave on its capsule's (headSha,
 * prNumber): a match is `live`, a mismatch is `superseded`, and no wave record
 * is `unknown`.
 *
 * **Example** (No wave record means unknown)
 *
 * ```ts
 * import { yeetInboxRowLiveness, YeetCheckFailedRow, YeetFailureCapsule, yeetInboxRowId } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
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
 * const row = YeetCheckFailedRow.make({
 *   capsule,
 *   checkout: "/repo",
 *   id: yeetInboxRowId(capsule),
 *   severity: "P0",
 *   ts: "2026-08-17T00:00:00Z"
 * })
 *
 * console.log(yeetInboxRowLiveness(row, O.none())) // "unknown"
 * ```
 *
 * @param row - The inbox row to place.
 * @param wave - The persisted remediation wave, when one exists.
 * @returns The row's liveness tier.
 * @category utilities
 * @since 0.0.0
 */
export const yeetInboxRowLiveness: {
  (wave: O.Option<YeetRemediationWave>): (row: YeetInboxRow) => YeetInboxLiveness;
  (row: YeetInboxRow, wave: O.Option<YeetRemediationWave>): YeetInboxLiveness;
} = dual(2, (row: YeetInboxRow, wave: O.Option<YeetRemediationWave>): YeetInboxLiveness => {
  // Rows the remediation wave never owns: collisions, local shards, the rows
  // acknowledged by observation (job results, and merge-ready announcements the
  // merge loop supersedes itself with a fix-sha receipt on push), and the
  // wave-exempt kinds a push does not resolve (review threads, comments). Their
  // liveness is not a wave question. The inbox hook escapes the same observed
  // and exempt kinds from one marked literal line, parity-tested against both kits.
  if (
    row.kind === "sibling-collision" ||
    row.kind === "local-shard-failed" ||
    yeetInboxRowIsObserved(row) ||
    yeetInboxRowIsWaveExempt(row)
  ) {
    return "live";
  }
  return O.match(wave, {
    onNone: () => "unknown" as const,
    onSome: (current) =>
      current.headSha === row.capsule.headSha && current.prNumber === row.capsule.prNumber
        ? ("live" as const)
        : ("superseded" as const),
  });
});

/**
 * One inbox row joined with everything a consumer decides on.
 *
 * **Example** (Build an entry)
 *
 * ```ts
 * import {
 *   YeetAckState,
 *   YeetCheckFailedRow,
 *   YeetFailureCapsule,
 *   YeetInboxEntry,
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
 * const entry = YeetInboxEntry.make({
 *   ack: YeetAckState.make({ acked: false, receipt: null }),
 *   liveness: "live",
 *   row: YeetCheckFailedRow.make({
 *     capsule,
 *     checkout: "/repo",
 *     id: yeetInboxRowId(capsule),
 *     severity: "P0",
 *     ts: "2026-08-17T00:00:00Z"
 *   })
 * })
 *
 * console.log(entry.ack.acked) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetInboxEntry extends S.Class<YeetInboxEntry>($I`YeetInboxEntry`)(
  {
    row: YeetInboxRow,
    ack: YeetAckState,
    liveness: YeetInboxLiveness,
  },
  $I.annote("YeetInboxEntry", {
    description: "One inbox row joined with its ack state and its liveness against the current wave.",
  })
) {}

/**
 * The joined inbox: every deduplicated row plus the reader's accounting.
 *
 * **Details**
 *
 * `unreadable` distinguishes "the failures file does not exist" (a genuinely
 * empty inbox) from "the file exists but could not be read" (permissions, a
 * directory squatting on the path, IO failure). An enforcement consumer must
 * not treat the second case as an empty backlog — the inbox state is unknown,
 * not clear.
 *
 * **Example** (Build an empty view)
 *
 * ```ts
 * import { YeetInboxView } from "@beep/repo-cli/test/Yeet"
 *
 * const view = YeetInboxView.make({ entries: [], skippedLines: 0, unreadable: false })
 * console.log(view.schemaVersion) // "yeet-inbox-view/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetInboxView extends S.Class<YeetInboxView>($I`YeetInboxView`)(
  {
    schemaVersion: S.Literal(YEET_INBOX_VIEW_SCHEMA_VERSION).pipe(
      S.withConstructorDefault(Effect.succeed(YEET_INBOX_VIEW_SCHEMA_VERSION))
    ),
    entries: S.Array(YeetInboxEntry),
    skippedLines: S.Finite,
    unreadable: S.Boolean,
  },
  $I.annote("YeetInboxView", {
    description:
      "Every deduplicated inbox entry, the count of skipped lines, and whether the failures file was unreadable.",
  })
) {}

/**
 * JSON string codec for one rendered inbox view.
 *
 * **Example** (Reject garbage)
 *
 * ```ts
 * import { YeetInboxViewJson } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(YeetInboxViewJson.decodeOption("not json"))) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const YeetInboxViewJson = JsonStringCodec(YeetInboxView);

const dedupeRowsById = (rows: ReadonlyArray<YeetInboxRow>): ReadonlyArray<YeetInboxRow> => {
  const seen = MutableHashSet.empty<string>();
  return A.filter(rows, (row) => {
    if (MutableHashSet.has(seen, row.id)) {
      return false;
    }
    MutableHashSet.add(seen, row.id);
    return true;
  });
};

// Appends write one whole `line\n` per call, so an unterminated tail is an
// in-flight append the next read will see whole — provisional, not garbage.
// Only newline-terminated content is complete evidence.
const terminatedPortion = (text: string): string =>
  Str.endsWith("\n")(text)
    ? text
    : O.match(Str.lastIndexOf("\n")(text), {
        onNone: () => "",
        onSome: (index) => Str.slice(0, index + 1)(text),
      });

/**
 * Load the joined inbox view for one checkout.
 *
 * **Details**
 *
 * Reads the failures file tolerantly: a missing file is an empty inbox, an
 * existing-but-unreadable file is flagged `unreadable` instead of decaying to
 * empty, an unterminated final line is treated as an in-flight append and
 * ignored without counting, and terminated lines that fail to decode — or
 * whose id breaks the deterministic {@link yeetInboxRowId} contract the
 * append path enforces — are counted in `skippedLines`. Surviving rows are
 * deduplicated by id keeping the first observation, then joined with their
 * ack state and their liveness against the persisted wave record. This is the
 * one read every consumer shares, so the CLI and the hook adapters provably
 * see the same inbox.
 *
 * **Example** (Build the load effect)
 *
 * ```ts
 * import { loadYeetInboxView } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(loadYeetInboxView("/repo"))) // true
 * ```
 *
 * @param repoRoot - The checkout whose inbox is read.
 * @returns The joined view; never an error — failure modes fold into the view's accounting.
 * @category services
 * @since 0.0.0
 */
export const loadYeetInboxView = Effect.fn("Yeet.loadYeetInboxView")(function* (
  repoRoot: string
): Effect.fn.Return<YeetInboxView, never, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const paths = yield* yeetInboxPaths(repoRoot);
  const exists = yield* fs.exists(paths.failuresPath).pipe(Effect.orElseSucceed(thunkFalse));
  if (!exists) {
    return YeetInboxView.make({ entries: [], skippedLines: 0, unreadable: false });
  }
  const text = yield* Effect.option(fs.readFileString(paths.failuresPath));
  if (O.isNone(text)) {
    return YeetInboxView.make({ entries: [], skippedLines: 0, unreadable: true });
  }
  const lines = A.filter(Str.split(terminatedPortion(text.value), "\n"), Str.isNonEmpty);
  const rows = A.getSomes(A.map(lines, YeetInboxRowJson.decodeOption));
  const wellFormed = yield* Effect.filter(
    rows,
    (row) =>
      yeetInboxExpectedRowId(row).pipe(
        Effect.map((expected) => row.id === expected),
        Effect.orElseSucceed(thunkFalse)
      ),
    { concurrency: 1 }
  );
  const deduped = dedupeRowsById(wellFormed);
  const wave = yield* loadYeetRemediationWave(repoRoot);
  const entries = yield* Effect.forEach(deduped, (row) =>
    readYeetAckState(repoRoot, row.id).pipe(
      Effect.map((ack) => YeetInboxEntry.make({ ack, liveness: yeetInboxRowLiveness(row, wave), row }))
    )
  );
  return YeetInboxView.make({
    entries,
    skippedLines: A.length(lines) - A.length(wellFormed),
    unreadable: false,
  });
});

/**
 * A new inbox wave on one pull request: the rows `yeet job wait` returns on.
 *
 * **Details**
 *
 * A wave is every inbox row on the pull request that still asks for work and
 * that no earlier `job wait` on the same job returned: in the wake set
 * (`yeetInboxRowWakes`: every P0 row, plus P1 `review-thread` and
 * `pr-comment` rows, never an observation row), not acknowledged, and not
 * superseded by a newer head. An optional red is a P1 `check-failed` row, so
 * it is written and injected but never makes a wave (ttc ruling 42).
 * `unknown` liveness counts, because the inbox hook keeps those rows too. The
 * rows stay in the inbox; the wave is a read, never an acknowledgement
 * (pr-event-awareness D31).
 *
 * The rows are read from the inbox, not from the per-head wave record in
 * `dispatch.json`. Wave-exempt rows (review threads, pull request comments)
 * never join that record and a push never supersedes them, so a new P1
 * `pr-comment` row on the pull request wakes the waiter like a new red, and
 * a later wait on the same job skips it once returned. The record does add
 * one thing: `redSetKey`, the head's required red set. It is carried here
 * when the record is on this pull request, and the waiter keeps it as the red
 * set it handed back.
 *
 * **Example** (Read a wave's size)
 *
 * ```ts
 * import { YeetPrWave } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof YeetPrWave.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetPrWave extends S.Class<YeetPrWave>($I`YeetPrWave`)(
  {
    prNumber: S.Finite,
    entries: S.NonEmptyArray(YeetInboxEntry),
    redSetKey: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("YeetPrWave", {
    description:
      "The unacknowledged, not superseded wake-set inbox rows on one pull request that a job wait returns on, with the head's required red set.",
  })
) {}

// Content-only half of the wave rule: everything decidable from the row
// itself, so the loader can drop other rows before paying for ack reads.
const isYeetPrWaveRow = (row: YeetInboxRow, prNumber: number, returned: HashSet.HashSet<string>): boolean =>
  yeetInboxRowWakes(row) && O.contains(yeetInboxRowPrNumber(row), prNumber) && !HashSet.has(returned, row.id);

/**
 * Select the new wave on one pull request from joined inbox entries.
 *
 * **Details**
 *
 * Keeps the entries whose row is in the wake set (`yeetInboxRowWakes`),
 * belongs to `prNumber`, is not acknowledged, is not superseded, and whose id
 * is not in `returned`, the ids an earlier `job wait` on the same job already
 * returned. Rows on another pull request never qualify, so two monitors in one
 * checkout never wake each other's waiter.
 *
 * **Example** (No entries, no wave)
 *
 * ```ts
 * import { selectYeetPrWave } from "@beep/repo-cli/test/Yeet"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(selectYeetPrWave([], 751, HashSet.empty()))) // true
 * ```
 *
 * @param entries - Joined inbox entries (row, ack state, liveness).
 * @param prNumber - The pull request the waiting job follows.
 * @param returned - Row ids an earlier wait on the same job already returned.
 * @returns The wave, or `None` when no entry qualifies.
 * @category utilities
 * @since 0.0.0
 */
export const selectYeetPrWave: {
  (
    prNumber: number,
    returned: HashSet.HashSet<string>
  ): (entries: ReadonlyArray<YeetInboxEntry>) => O.Option<YeetPrWave>;
  (entries: ReadonlyArray<YeetInboxEntry>, prNumber: number, returned: HashSet.HashSet<string>): O.Option<YeetPrWave>;
} = dual(
  3,
  (entries: ReadonlyArray<YeetInboxEntry>, prNumber: number, returned: HashSet.HashSet<string>): O.Option<YeetPrWave> =>
    pipe(
      A.filter(
        entries,
        (entry) => isYeetPrWaveRow(entry.row, prNumber, returned) && !entry.ack.acked && entry.liveness !== "superseded"
      ),
      A.match({
        onEmpty: O.none,
        onNonEmpty: (waveEntries) => O.some(YeetPrWave.make({ prNumber, entries: waveEntries })),
      })
    )
);

/**
 * Read the checkout's inbox for a new wave on one pull request.
 *
 * **Details**
 *
 * The read both waiters repeat on every poll: `yeet job wait` and an attached
 * `--until-ready` loop. It decodes the failures file with the same tolerance
 * as {@link loadYeetInboxView}, keeps the rows the wave rule can accept from
 * their content alone, then checks their ids, drops duplicates, and joins only
 * those rows with their ack state and their liveness against the wave record.
 * A missing or unreadable inbox has no wave.
 *
 * `accounted` is the required red set the waiter already handed back. When
 * the wave record is on this pull request and its `redSetKey` names a red
 * that `accounted` does not (`yeetRedSetKeyGained`), a red changed on the
 * same head: a rerun came back red with a new job link, which re-derives the
 * row id the waiter already returned. That is a new wave, so the waiter's
 * returned `check-failed` ids stop excluding their rows for this read, and the
 * live ones come back with the same gate line. A red set that only shrank
 * names nothing new and wakes nobody. `None` skips the comparison, and a
 * waiter that has handed back no red set yet passes `Some("")`.
 *
 * **Example** (Build the read effect)
 *
 * ```ts
 * import { loadYeetPrWave } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 * import * as HashSet from "effect/HashSet"
 *
 * console.log(Effect.isEffect(loadYeetPrWave("/repo", 751, HashSet.empty()))) // true
 * ```
 *
 * @param repoRoot - The checkout whose inbox is read.
 * @param prNumber - The pull request the waiting job follows.
 * @param returned - Row ids an earlier wait on the same job already returned.
 * @param accounted - The red-set key the waiter already handed back; `None` skips the red-set comparison.
 * @returns The wave, carrying the record's red-set key, or `None`; never an error.
 * @category services
 * @since 0.0.0
 */
export const loadYeetPrWave = Effect.fn("Yeet.loadYeetPrWave")(function* (
  repoRoot: string,
  prNumber: number,
  returned: HashSet.HashSet<string>,
  accounted: O.Option<string> = O.none()
): Effect.fn.Return<O.Option<YeetPrWave>, never, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const paths = yield* yeetInboxPaths(repoRoot);
  const text = yield* Effect.option(fs.readFileString(paths.failuresPath));
  if (O.isNone(text)) {
    return O.none<YeetPrWave>();
  }
  const wave = yield* loadYeetRemediationWave(repoRoot);
  const redSetKey = O.flatMap(
    O.filter(wave, (record) => record.prNumber === prNumber),
    (record) => record.redSetKey
  );
  const redSetChanged = O.exists(accounted, (handed) =>
    O.exists(redSetKey, (current) => yeetRedSetKeyGained(current, handed))
  );
  const decoded = A.getSomes(
    A.map(A.filter(Str.split(terminatedPortion(text.value), "\n"), Str.isNonEmpty), YeetInboxRowJson.decodeOption)
  );
  const pending = redSetChanged
    ? HashSet.difference(
        returned,
        HashSet.fromIterable(
          A.map(
            A.filter(decoded, (row) => row.kind === "check-failed"),
            (row) => row.id
          )
        )
      )
    : returned;
  const candidates = A.filter(decoded, (row) => isYeetPrWaveRow(row, prNumber, pending));
  if (A.isReadonlyArrayEmpty(candidates)) {
    return O.none<YeetPrWave>();
  }
  const wellFormed = yield* Effect.filter(
    candidates,
    (row) =>
      yeetInboxExpectedRowId(row).pipe(
        Effect.map((expected) => row.id === expected),
        Effect.orElseSucceed(thunkFalse)
      ),
    { concurrency: 1 }
  );
  const entries = yield* Effect.forEach(dedupeRowsById(wellFormed), (row) =>
    readYeetAckState(repoRoot, row.id).pipe(
      Effect.map((ack) => YeetInboxEntry.make({ ack, liveness: yeetInboxRowLiveness(row, wave), row }))
    )
  );
  return O.map(selectYeetPrWave(entries, prNumber, pending), (selected) => YeetPrWave.make({ ...selected, redSetKey }));
});

/**
 * Read the ids of every row the checkout's inbox holds, on any pull request.
 *
 * **Details**
 *
 * An attached `--until-ready` loop reads this once when it starts: rows
 * already in the inbox then are not new, so they never end the loop, the same
 * way ids an earlier `job wait` returned never wake a later one. It decodes
 * the failures file with the same tolerance as {@link loadYeetInboxView}; a
 * missing or unreadable inbox holds no ids.
 *
 * **Example** (Build the read effect)
 *
 * ```ts
 * import { loadYeetInboxRowIds } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(loadYeetInboxRowIds("/repo"))) // true
 * ```
 *
 * @param repoRoot - The checkout whose inbox is read.
 * @returns The ids of the decodable rows in the failures file; never an error.
 * @category services
 * @since 0.0.0
 */
export const loadYeetInboxRowIds = Effect.fn("Yeet.loadYeetInboxRowIds")(function* (
  repoRoot: string
): Effect.fn.Return<HashSet.HashSet<string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const paths = yield* yeetInboxPaths(repoRoot);
  const text = yield* fs.readFileString(paths.failuresPath).pipe(Effect.orElseSucceed(() => Str.empty));
  return HashSet.fromIterable(
    A.map(
      A.getSomes(
        A.map(A.filter(Str.split(terminatedPortion(text), "\n"), Str.isNonEmpty), YeetInboxRowJson.decodeOption)
      ),
      (row) => row.id
    )
  );
});

/**
 * Who handed a pull request's inbox wave back to the operator.
 *
 * **Details**
 *
 * `job-wait` is `yeet job wait` on a detached monitor job: the job keeps
 * running and the re-run waits on it again. `attached-monitor` is an attached
 * `yeet monitor --until-ready`: it has no job, so it stopped itself and the
 * re-run is the same monitor command.
 *
 * **Example** (List the returners)
 *
 * ```ts
 * import { YeetPrWaveReturn } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetPrWaveReturn.Options) // ["job-wait", "attached-monitor"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetPrWaveReturn = LiteralKit(["job-wait", "attached-monitor"]).pipe(
  $I.annoteSchema("YeetPrWaveReturn", {
    description: "Who handed a pull request's inbox wave back: a job wait, or an attached monitor that stopped.",
  })
);

/**
 * Who handed a pull request's inbox wave back to the operator.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetPrWaveReturn = typeof YeetPrWaveReturn.Type;

/**
 * Render the gate line printed when a wave is handed back.
 *
 * **Details**
 *
 * Both returners print the same line: the wave's rows (severity, description,
 * id), that they stay in the inbox until acknowledged or superseded, and the
 * re-run command. Only the middle clause differs: a job wait says the job
 * keeps running, an attached monitor says it stopped.
 *
 * **Example** (Name the rows and the re-run command)
 *
 * ```ts
 * import { renderYeetPrWaveLine } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof renderYeetPrWaveLine) // "function"
 * ```
 *
 * @param wave - The wave handed back.
 * @param via - Who handed it back.
 * @param rerunCommand - The command that resumes following the pull request.
 * @returns One operator line naming each row (severity, description, id) and the re-run command.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetPrWaveLine: {
  (via: YeetPrWaveReturn, rerunCommand: string): (wave: YeetPrWave) => string;
  (wave: YeetPrWave, via: YeetPrWaveReturn, rerunCommand: string): string;
} = dual(
  3,
  (wave: YeetPrWave, via: YeetPrWaveReturn, rerunCommand: string): string =>
    `[yeet] wave on PR #${wave.prNumber}: ${A.length(wave.entries)} new P0/P1 inbox row(s): ${A.join(
      A.map(wave.entries, (entry) => `${entry.row.severity} ${describeYeetInboxRow(entry.row)} [${entry.row.id}]`),
      "; "
    )}. ${YeetPrWaveReturn.$match(via, {
      "job-wait": () => "The job keeps running",
      "attached-monitor": () => "The attached monitor stopped",
    })} and the rows stay in the inbox until acknowledged or superseded; fix, publish, then re-run: ${rerunCommand}`
);

/**
 * Schema version the inbox hook stamps on each per-session state file.
 *
 * **Example** (Read the version)
 *
 * ```ts
 * import { YEET_HOOK_SESSION_SCHEMA_VERSION } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_HOOK_SESSION_SCHEMA_VERSION) // "yeet-hook-session/v1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_HOOK_SESSION_SCHEMA_VERSION = "yeet-hook-session/v1";

const hookSessionsDirName = "sessions";

/**
 * One harness session's inbox-hook bookkeeping, as the hook writes it.
 *
 * **Details**
 *
 * `.claude/hooks/yeet-inbox.sh` owns `.beep/inbox/sessions/<harness>-<key>.json`
 * and writes it; repo-cli only reads it. `seenIds` are the rows already handed
 * to the session at a deduplicating boundary. `firstSeenAt` is an additive map
 * from row id to the instant the session was first handed that row, stamped
 * once and never pruned; a file written before the map existed decodes to an
 * empty map. The schema version is unchanged by the map, and the hook's
 * `incidentId` is not read here.
 *
 * **Example** (A file written before `firstSeenAt` existed)
 *
 * ```ts
 * import { YeetHookSessionStateJson } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const state = YeetHookSessionStateJson.decodeOption(
 *   '{"schemaVersion":"yeet-hook-session/v1","incidentId":null,"seenIds":["coverage-abc"]}'
 * )
 * console.log(O.map(state, (value) => value.firstSeenAt)) // Some({})
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetHookSessionState extends S.Class<YeetHookSessionState>($I`YeetHookSessionState`)(
  {
    schemaVersion: S.Literal(YEET_HOOK_SESSION_SCHEMA_VERSION),
    seenIds: S.Array(S.String).pipe(SchemaUtils.withKeyDefaults(A.empty<string>())),
    firstSeenAt: S.Record(S.String, S.String).pipe(SchemaUtils.withKeyDefaults({})),
  },
  $I.annote("YeetHookSessionState", {
    description: "One harness session's inbox-hook state: rows already handed to it and when each was first handed.",
  })
) {}

/**
 * JSON string codec for one inbox-hook session file.
 *
 * **Example** (Reject another schema version)
 *
 * ```ts
 * import { YeetHookSessionStateJson } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(YeetHookSessionStateJson.decodeOption('{"schemaVersion":"other"}'))) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const YeetHookSessionStateJson = JsonStringCodec(YeetHookSessionState);

const instantMillis = (instant: string): number =>
  O.getOrElse(O.map(DateTime.make(instant), DateTime.toEpochMillis), () => Number.POSITIVE_INFINITY);

const instantOrder: Order.Order<string> = Order.mapInput(Order.Number, instantMillis);

const earlierInstant = Order.min(instantOrder);

const keepEarliestFirstSeen = (
  firstSeen: HashMap.HashMap<string, string>,
  state: YeetHookSessionState
): HashMap.HashMap<string, string> =>
  A.reduce(R.toEntries(state.firstSeenAt), firstSeen, (acc, [id, at]) =>
    HashMap.set(
      acc,
      id,
      O.match(HashMap.get(acc, id), { onNone: () => at, onSome: (previous) => earlierInstant(previous, at) })
    )
  );

/**
 * Read when any harness session in this checkout was first handed each inbox row.
 *
 * **Details**
 *
 * Folds every readable `.beep/inbox/sessions/*.json` file, keeping the earliest
 * `firstSeenAt` per row id across sessions. A missing directory, the hook's
 * in-flight temp files, and undecodable files are skipped: the stamps are
 * measurement, and a missing one reads as an absent stage, never an error.
 *
 * **Example** (Build the read)
 *
 * ```ts
 * import { loadYeetHookFirstSeen } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(loadYeetHookFirstSeen("/repo"))) // true
 * ```
 *
 * @param repoRoot - The checkout whose hook session files are read.
 * @returns Row id to the earliest instant any session was handed that row.
 * @category services
 * @since 0.0.0
 */
export const loadYeetHookFirstSeen = Effect.fn("Yeet.loadYeetHookFirstSeen")(function* (
  repoRoot: string
): Effect.fn.Return<HashMap.HashMap<string, string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const paths = yield* yeetInboxPaths(repoRoot);
  const dir = path.join(paths.dir, hookSessionsDirName);
  const names = yield* fs.readDirectory(dir).pipe(Effect.orElseSucceed(A.empty<string>));
  const states = yield* Effect.forEach(
    A.filter(names, (name) => !Str.startsWith(".")(name) && Str.endsWith(".json")(name)),
    (name) =>
      fs
        .readFileString(path.join(dir, name))
        .pipe(Effect.map(YeetHookSessionStateJson.decodeOption), Effect.orElseSucceed(O.none<YeetHookSessionState>))
  );
  return A.reduce(A.getSomes(states), HashMap.empty<string, string>(), keepEarliestFirstSeen);
});

const entryOrder: Order.Order<YeetInboxEntry> = Order.mapInput(instantOrder, (entry: YeetInboxEntry) => entry.row.ts);

const firstRedRowFor = (
  entries: ReadonlyArray<YeetInboxEntry>,
  headSha: string,
  prNumber: O.Option<number>
): O.Option<YeetInboxEntry> =>
  pipe(
    entries,
    A.filter(
      (entry) =>
        entry.row.kind === "check-failed" &&
        entry.row.capsule.headSha === headSha &&
        O.contains(prNumber, entry.row.capsule.prNumber)
    ),
    A.sort(entryOrder),
    A.head
  );

/**
 * Join one head's push → row → ack timeline from the monitor's stamps and the inbox.
 *
 * **Details**
 *
 * `pushed` and `red` come from the head timeline the monitor loop stamped. The
 * row is the head's earliest `check-failed` row on this pull request; `row` is
 * its `ts`, `injected` the earliest hook `firstSeenAt` for its id, and `acked`
 * its receipt's `ackedAt` while the receipt still acknowledges it. A head with
 * no such row, or an unknown pull request number, keeps those stages absent.
 *
 * **Example** (Build the join)
 *
 * ```ts
 * import { loadYeetPushToAckTimeline, YeetHeadTimeline } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const timeline = YeetHeadTimeline.make({ headSha: "abc123", firstObservedAt: "2026-09-25T12:00:00Z" })
 * console.log(Effect.isEffect(loadYeetPushToAckTimeline("/repo", timeline, O.some(7)))) // true
 * ```
 *
 * @param repoRoot - The checkout whose inbox, ack receipts, and hook session files are read.
 * @param timeline - The head timeline the monitor loop stamped.
 * @param prNumber - The pull request the head belongs to, when known.
 * @returns The joined timeline; every unreadable source reads as an absent stage.
 * @category services
 * @since 0.0.0
 */
export const loadYeetPushToAckTimeline = Effect.fn("Yeet.loadYeetPushToAckTimeline")(function* (
  repoRoot: string,
  timeline: YeetHeadTimeline,
  prNumber: O.Option<number>
): Effect.fn.Return<YeetPushToAckTimeline, never, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  const view = yield* loadYeetInboxView(repoRoot);
  const row = firstRedRowFor(view.entries, timeline.headSha, prNumber);
  const firstSeen = yield* loadYeetHookFirstSeen(repoRoot);
  return YeetPushToAckTimeline.make({
    headSha: timeline.headSha,
    pushedAt: timeline.pushedAt,
    redAt: timeline.redAt,
    rowAt: O.map(row, (entry) => entry.row.ts),
    injectedAt: O.flatMap(row, (entry) => HashMap.get(firstSeen, entry.row.id)),
    ackedAt: pipe(
      row,
      O.filter((entry) => entry.ack.acked),
      O.flatMap((entry) => O.fromNullOr(entry.ack.receipt)),
      O.map((receipt) => receipt.ackedAt)
    ),
  });
});
