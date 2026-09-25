/**
 * `yeet economics`: the A1 economics computation as a checkout report over live
 * attempt journals (time-to-certainty A3, rulings 73–75).
 *
 * **Details**
 *
 * {@link YeetEconomicsSource} reads `.beep/yeet/runs/<runId>/attempts.ndjson`
 * and orphan `verdict.json` files into normalized journals; the pure fold
 * {@link buildYeetEconomicsReport} turns them into the `yeet-economics/v1`
 * document. Nothing is written to disk.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import { thunk0, thunkEmptyStr, thunkFalse } from "@beep/utils";
import {
  Cause,
  Console,
  Context,
  DateTime,
  Duration,
  Effect,
  FileSystem,
  flow,
  Layer,
  Match,
  Order,
  Path,
  pipe,
} from "effect";
import * as A from "effect/Array";
import { constTrue, dual, identity } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ContainedFileRead, readContainedFileStringNoFollow } from "../../../internal/cli/FsGuards.ts";
import { YeetAttemptTerminationReason } from "../../../internal/repo-run/AttemptTerminationJournal.ts";
import { repoRunArtifactId } from "../../../internal/repo-run/RepoRunArtifacts.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { nearestRank } from "../../../internal/stats/NearestRank.ts";
import { CLAUDE_WORKTREES_RELATIVE_ROOT, WORKTREES_ROOT_SUFFIX } from "../../Worktree/Worktree.constants.ts";
import {
  EconomicsAttempt,
  EconomicsAttemptMix,
  EconomicsAttempts,
  EconomicsCountRow,
  EconomicsDataQuality,
  EconomicsDiagnostics,
  EconomicsEpisodeSummary,
  EconomicsFirstFailure,
  EconomicsJournal,
  EconomicsJournalDiagnostics,
  EconomicsLane,
  EconomicsLaneKind,
  EconomicsLanePopulation,
  EconomicsLaneRow,
  EconomicsRedToGreen,
  EconomicsScope,
  EconomicsScopeKind,
  EconomicsScopeRequest,
  EconomicsTerminations,
  EconomicsUnchangedFingerprint,
  YEET_ECONOMICS_OFFSET_METHOD,
  YEET_ECONOMICS_PERCENTILE_ESTIMATOR,
  YEET_ECONOMICS_ROUNDING,
  YEET_ECONOMICS_SCHEMA_VERSION,
  YeetEconomicsError,
  YeetEconomicsErrorReason,
  YeetEconomicsOptions,
  YeetEconomicsReport,
  YeetEconomicsReportJson,
} from "./Economics.schemas.ts";
import { YeetRunMode } from "./Planner.ts";
import { YeetFailureKind, YeetLaneStatus, YeetOutcome } from "./Verdict.ts";
import type * as Crypto from "effect/Crypto";

const $I = $RepoCliId.create("commands/Yeet/internal/Economics");

const RUNS_DIRECTORY_NAME = "runs";
const JOURNAL_FILE_NAME = "attempts.ndjson";
const VERDICT_FILE_NAME = "verdict.json";
const CHECKOUT_PREFIX = "beep-effect";
const GIT_METADATA_NAME = ".git";
const GIT_WORKTREES_DIRECTORY_NAME = "worktrees";
const GITDIR_PREFIX = "gitdir:";
const FLEET_READ_CONCURRENCY = 8;
const COMPARABLE_EPISODE_CUT = Duration.hours(24);
const UNKNOWN_KEY = "unknown";
const VERDICT_V2 = "yeet-verdict/v2";
const UNLOCATED_LANE = "unlocated";
const TOP_LANE_ROWS = 10;

// Ruling 74: the wrapper phase prefixes for verdicts written before inner
// lanes carried `parentLaneId`.
const WRAPPER_LANE_PREFIXES = [
  "full:",
  "feedback:",
  "prepare:",
  "publish:",
  "monitor:",
  "closeout:",
  "advisory:",
  "commit:",
] as const;

// The scheduler lock-bounce sentence (`ProofState.ts`); ruling 75 matches it
// case-sensitively for comparability, the receipt proxy lowercased.
const LOCK_BOUNCE_SENTENCE = "Another Yeet full proof";

const EconomicsComparableMode = LiteralKit(YeetRunMode.pickOptions(["verify", "repair", "publish"])).pipe(
  $I.annoteSchema("EconomicsComparableMode", {
    description: "Yeet run modes whose red-to-green episodes are comparable to the A1 article baseline.",
  })
);
const isComparableMode = S.is(EconomicsComparableMode);

const EconomicsReceiptProxyClass = LiteralKit([
  "scheduler-lock-bounce",
  "native-compiler-flake",
  "stale-workspace-or-projection",
  "base-churn",
  "scheduler-or-submitter",
  "semantic-delta-path",
  "unclassified",
]).pipe(
  $I.annoteSchema("EconomicsReceiptProxyClass", {
    description: "The A1 script's receipt-proxy classes for a red attempt, in match order.",
  })
);

// Ruling 75: the termination reasons `reconcileJournalLocked` stamps with its
// own clock when it sweeps an unfinished start, so their `recordedAt` is the
// sweep, not the moment the attempt died.
const EconomicsReconcilerStampedReason = LiteralKit(
  YeetAttemptTerminationReason.pickOptions(["legacy-unowned-start", "owner-dead", "stale-unverifiable-owner"])
).pipe(
  $I.annoteSchema("EconomicsReconcilerStampedReason", {
    description:
      "Termination reasons written by the journal reconciler at sweep time rather than at the attempt's death.",
  })
);
const isReconcilerStampedReason = S.is(EconomicsReconcilerStampedReason);

// Match order and patterns of the A1 script's `classify_receipt_proxy`, over the
// lowercased message, repair commands and failed step id.
const RECEIPT_PROXY_PATTERNS: ReadonlyArray<readonly [typeof EconomicsReceiptProxyClass.Type, RegExp]> = [
  [EconomicsReceiptProxyClass.Enum["scheduler-lock-bounce"], /another yeet full proof/u],
  [EconomicsReceiptProxyClass.Enum["native-compiler-flake"], /ts2589|excessively deep/u],
  [
    EconomicsReceiptProxyClass.Enum["stale-workspace-or-projection"],
    /ts2307|ts6305|node_modules|generated projection|goals[/ ]index|determinism/u,
  ],
  [EconomicsReceiptProxyClass.Enum["base-churn"], /origin\/main.*advanced|stale[- ]base|behind.*base|base freshness/u],
  [EconomicsReceiptProxyClass.Enum["scheduler-or-submitter"], /admission|scheduler|coordinator|proof.*active|queued/u],
  [EconomicsReceiptProxyClass.Enum["semantic-delta-path"], /broken-tracked-path|semantic[- ]delta/u],
];

// Journal rows are decoded through a projection of only the consumed fields, so
// a row the strict journal schema would reject for an unrelated field still
// counts; a row that fails the projection counts as invalid.
const LenientString = S.OptionFromOptionalNullOr(S.String);

class EconomicsVerdictLaneRow extends S.Class<EconomicsVerdictLaneRow>($I`EconomicsVerdictLaneRow`)(
  {
    id: S.String,
    label: S.String,
    phase: S.String,
    status: YeetLaneStatus,
    durationMs: S.OptionFromOptionalNullOr(S.Finite),
    repairCommand: LenientString,
    parentLaneId: LenientString,
  },
  $I.annote("EconomicsVerdictLaneRow", {
    description: "The verdict-lane fields the economics fold consumes.",
  })
) {}

class EconomicsVerdictRow extends S.Class<EconomicsVerdictRow>($I`EconomicsVerdictRow`)(
  {
    schemaVersion: LenientString,
    attemptId: LenientString,
    branch: LenientString,
    mode: LenientString,
    outcome: S.OptionFromOptionalNullOr(YeetOutcome),
    failureKind: S.OptionFromOptionalNullOr(YeetFailureKind),
    failedStepId: LenientString,
    message: LenientString,
    startedAt: LenientString,
    endedAt: LenientString,
    createdAt: LenientString,
    elapsedMs: S.OptionFromOptionalNullOr(S.Finite),
    lanes: S.Array(EconomicsVerdictLaneRow).pipe(
      S.withDecodingDefault(Effect.succeed(A.empty<typeof EconomicsVerdictLaneRow.Encoded>()))
    ),
  },
  $I.annote("EconomicsVerdictRow", {
    description: "The verdict fields the economics fold consumes, from a finished row or an orphan verdict file.",
  })
) {}

const JournalSchemaVersion = S.Literal("yeet-attempt-journal/v1");

class EconomicsStartedRow extends S.Class<EconomicsStartedRow>($I`EconomicsStartedRow`)(
  {
    schemaVersion: JournalSchemaVersion,
    _tag: S.Literal("attempt-started"),
    attemptId: S.String,
    startedAt: LenientString,
    branch: LenientString,
    mode: LenientString,
    diffFingerprint: LenientString,
  },
  $I.annote("EconomicsStartedRow", { description: "The attempt-started fields the economics fold consumes." })
) {}

class EconomicsFinishedRow extends S.Class<EconomicsFinishedRow>($I`EconomicsFinishedRow`)(
  {
    schemaVersion: JournalSchemaVersion,
    _tag: S.Literal("attempt-finished"),
    attemptId: S.String,
    recordedAt: LenientString,
    verdict: EconomicsVerdictRow,
    diffFingerprint: LenientString,
  },
  $I.annote("EconomicsFinishedRow", { description: "The attempt-finished fields the economics fold consumes." })
) {}

class EconomicsTerminatedRow extends S.Class<EconomicsTerminatedRow>($I`EconomicsTerminatedRow`)(
  {
    schemaVersion: JournalSchemaVersion,
    _tag: S.Literal("attempt-terminated"),
    attemptId: S.String,
    recordedAt: LenientString,
    reason: YeetAttemptTerminationReason,
    diffFingerprint: LenientString,
  },
  $I.annote("EconomicsTerminatedRow", { description: "The attempt-terminated fields the economics fold consumes." })
) {}

class EconomicsCompactedRow extends S.Class<EconomicsCompactedRow>($I`EconomicsCompactedRow`)(
  {
    schemaVersion: JournalSchemaVersion,
    _tag: S.Literal("journal-compacted"),
    terminalEvictionCutoffRecordedAt: LenientString,
    oldestEvictedRecordedAt: LenientString,
  },
  $I.annote("EconomicsCompactedRow", { description: "The journal-compacted fields the economics fold consumes." })
) {}

const EconomicsJournalRow = S.Union([
  EconomicsStartedRow,
  EconomicsFinishedRow,
  EconomicsTerminatedRow,
  EconomicsCompactedRow,
]).pipe(S.toTaggedUnion("_tag"));

type EconomicsJournalRow = typeof EconomicsJournalRow.Type;

const EconomicsJournalRowJson = JsonStringCodec(EconomicsJournalRow);
const EconomicsVerdictRowJson = JsonStringCodec(EconomicsVerdictRow);
const JsonRecordJson = JsonStringCodec(S.Unknown);

// ---------------------------------------------------------------------------
// Timestamps and rounding
// ---------------------------------------------------------------------------

const parseMillis = (value: string): O.Option<number> => O.map(DateTime.make(value), DateTime.toEpochMillis);
const formatMillis = (millis: number): O.Option<string> => O.map(DateTime.make(millis), DateTime.formatIso);
const roundedRank = (values: ReadonlyArray<number>, quantile: number): O.Option<number> =>
  O.map(nearestRank(values, quantile), Num.round(0));
const percentOf = (numerator: number, denominator: number): O.Option<number> =>
  O.map(Num.divide(numerator, denominator), flow(Num.round(6), Num.multiply(100), Num.round(2)));
const minutesOf = (millis: number): number => Num.round(millis / 60_000, 2);
const sumOf = <A>(values: ReadonlyArray<A>, pick: (value: A) => number): number => Num.sumAll(A.map(values, pick));
const maxMillis = (current: O.Option<number>, next: O.Option<number>): O.Option<number> =>
  pipe(
    next,
    O.map((value) => O.getOrElse(O.map(current, Num.max(value)), () => value)),
    O.orElse(() => current)
  );

// ---------------------------------------------------------------------------
// Journal loader (pure part)
// ---------------------------------------------------------------------------

interface TerminalFacts {
  readonly diffFingerprint: O.Option<string>;
  readonly reason: O.Option<YeetAttemptTerminationReason>;
  readonly recordedAt: O.Option<string>;
  readonly verdict: O.Option<EconomicsVerdictRow>;
}

interface JournalFold {
  readonly compactionReceipts: number;
  readonly cutoffMs: O.Option<number>;
  readonly duplicateStarts: number;
  readonly duplicateTerminals: number;
  readonly starts: HashMap.HashMap<string, EconomicsStartedRow>;
  readonly terminals: HashMap.HashMap<string, TerminalFacts>;
}

const emptyJournalFold: JournalFold = {
  starts: HashMap.empty(),
  terminals: HashMap.empty(),
  cutoffMs: O.none(),
  compactionReceipts: 0,
  duplicateStarts: 0,
  duplicateTerminals: 0,
};

const countIf = (condition: boolean): number => (condition ? 1 : 0);

// A repeated start or terminal row replaces the earlier one (every source is
// live, which is the A1 loader's "live overwrites" rule) and is counted.
const recordTerminal = (fold: JournalFold, attemptId: string, facts: TerminalFacts): JournalFold => ({
  ...fold,
  terminals: HashMap.set(fold.terminals, attemptId, facts),
  duplicateTerminals: fold.duplicateTerminals + countIf(HashMap.has(fold.terminals, attemptId)),
});

const stepJournalFold = (fold: JournalFold, row: EconomicsJournalRow): JournalFold =>
  EconomicsJournalRow.match(row, {
    "attempt-started": (started): JournalFold => ({
      ...fold,
      starts: HashMap.set(fold.starts, started.attemptId, started),
      duplicateStarts: fold.duplicateStarts + countIf(HashMap.has(fold.starts, started.attemptId)),
    }),
    "attempt-finished": (finished) =>
      recordTerminal(fold, finished.attemptId, {
        verdict: O.some(finished.verdict),
        recordedAt: finished.recordedAt,
        diffFingerprint: finished.diffFingerprint,
        reason: O.none(),
      }),
    "attempt-terminated": (terminated) =>
      recordTerminal(fold, terminated.attemptId, {
        verdict: O.none(),
        recordedAt: terminated.recordedAt,
        diffFingerprint: terminated.diffFingerprint,
        reason: O.some(terminated.reason),
      }),
    "journal-compacted": (compacted): JournalFold => ({
      ...fold,
      compactionReceipts: fold.compactionReceipts + 1,
      cutoffMs: maxMillis(
        fold.cutoffMs,
        pipe(
          compacted.terminalEvictionCutoffRecordedAt,
          O.orElse(() => compacted.oldestEvictedRecordedAt),
          O.flatMap(parseMillis)
        )
      ),
    }),
  });

interface DecodedJournalText {
  readonly invalidRows: number;
  readonly rows: ReadonlyArray<EconomicsJournalRow>;
}

// The journal's own torn-tail rule (`AttemptTerminationJournal`): only invalid
// JSON on an unterminated last line is an append still in flight and is not
// counted. A complete JSON row that fails the projection is an invalid row.
const decodeJournalText = (text: string): DecodedJournalText => {
  const lines = A.filter(Str.split(text, "\n"), flow(Str.trim, Str.isNonEmpty));
  const decoded = A.map(lines, (line) => EconomicsJournalRowJson.decodeOption(line));
  const rows = A.getSomes(decoded);
  const tornTail =
    !Str.endsWith("\n")(text) && O.exists(A.last(lines), (line) => O.isNone(JsonRecordJson.decodeOption(line)));
  return { rows, invalidRows: A.length(decoded) - A.length(rows) - countIf(tornTail) };
};

// Ruling 74: a lane is inner when it carries `parentLaneId`. A verdict where no
// lane carries one predates the field, so its lanes split by wrapper prefix.
const isWrapperLane = (lane: EconomicsVerdictLaneRow, verdictMarksParents: boolean): boolean =>
  verdictMarksParents
    ? O.isNone(lane.parentLaneId)
    : A.some(WRAPPER_LANE_PREFIXES, (prefix) => Str.startsWith(prefix)(lane.id));

const economicsLanes = (lanes: ReadonlyArray<EconomicsVerdictLaneRow>): ReadonlyArray<EconomicsLane> => {
  const verdictMarksParents = A.some(lanes, (lane) => O.isSome(lane.parentLaneId));
  return A.map(lanes, (lane) =>
    EconomicsLane.make({
      id: lane.id,
      label: lane.label,
      phase: lane.phase,
      status: lane.status,
      durationMs: lane.durationMs,
      repairCommand: lane.repairCommand,
      population: isWrapperLane(lane, verdictMarksParents)
        ? EconomicsLaneKind.Enum.wrapper
        : EconomicsLaneKind.Enum.inner,
      parentLaneId: lane.parentLaneId,
    })
  );
};

const elapsedBetween = (startedAt: O.Option<string>, endedAt: O.Option<string>): O.Option<number> =>
  O.flatMap(O.flatMap(startedAt, parseMillis), (start) => O.map(O.flatMap(endedAt, parseMillis), (end) => end - start));

// Resolution order of the A1 loader: the verdict wins, then the start row; the
// terminal row's facts win over the start row's; a terminated row has no
// verdict, so its outcome is none (red) and it has no lanes. A reconciler-
// stamped termination still orders by its `recordedAt` but measures no
// elapsed time and ends no streak bound (ruling 75).
const attemptFromTerminal = (
  journal: { readonly checkout: string; readonly runId: string },
  attemptId: string,
  terminal: TerminalFacts,
  start: O.Option<EconomicsStartedRow>
): EconomicsAttempt => {
  const fromVerdict = <A>(pick: (verdict: EconomicsVerdictRow) => O.Option<A>): O.Option<A> =>
    O.flatMap(terminal.verdict, pick);
  const fromStart = <A>(pick: (started: EconomicsStartedRow) => O.Option<A>): O.Option<A> => O.flatMap(start, pick);
  const startedAt = O.orElse(
    fromVerdict((verdict) => verdict.startedAt),
    () => fromStart((started) => started.startedAt)
  );
  const endedAt = pipe(
    fromVerdict((verdict) => verdict.endedAt),
    O.orElse(() => fromVerdict((verdict) => verdict.createdAt)),
    O.orElse(() => terminal.recordedAt)
  );
  const measuredEnd = O.filter(endedAt, () => !O.exists(terminal.reason, isReconcilerStampedReason));
  return EconomicsAttempt.make({
    checkout: journal.checkout,
    runId: journal.runId,
    attemptId,
    branch: pipe(
      fromVerdict((verdict) => verdict.branch),
      O.orElse(() => fromStart((started) => started.branch)),
      O.getOrElse(() => journal.runId)
    ),
    mode: O.orElse(
      fromVerdict((verdict) => verdict.mode),
      () => fromStart((started) => started.mode)
    ),
    outcome: fromVerdict((verdict) => verdict.outcome),
    failureKind: fromVerdict((verdict) => verdict.failureKind),
    failedStepId: fromVerdict((verdict) => verdict.failedStepId),
    message: O.getOrElse(
      fromVerdict((verdict) => verdict.message),
      thunkEmptyStr
    ),
    startedAt,
    endedAt,
    elapsedMs: O.orElse(
      fromVerdict((verdict) => verdict.elapsedMs),
      () => elapsedBetween(startedAt, measuredEnd)
    ),
    diffFingerprint: O.orElse(terminal.diffFingerprint, () => fromStart((started) => started.diffFingerprint)),
    terminationReason: terminal.reason,
    verdictSchemaVersion: fromVerdict((verdict) => verdict.schemaVersion),
    lanes: economicsLanes(
      O.getOrElse(
        O.map(terminal.verdict, (verdict) => verdict.lanes),
        A.empty
      )
    ),
  });
};

interface OrphanVerdict {
  readonly orphanVerdictFilesAdded: number;
  readonly terminals: HashMap.HashMap<string, TerminalFacts>;
  readonly unkeyedVerdictFiles: number;
}

// A `verdict.json` whose attempt has no terminal row synthesizes one; a verdict
// file that is unreadable, malformed or has no `attemptId` cannot be keyed.
const applyOrphanVerdict = (
  terminals: HashMap.HashMap<string, TerminalFacts>,
  read: ContainedFileRead
): OrphanVerdict => {
  const keyed = pipe(
    read.contents,
    O.flatMap(EconomicsVerdictRowJson.decodeOption),
    O.flatMap((verdict) => O.map(verdict.attemptId, (attemptId) => ({ attemptId, verdict })))
  );
  const unkeyedVerdictFiles = countIf(read.exists && O.isNone(keyed));
  return pipe(
    keyed,
    O.filter(({ attemptId }) => !HashMap.has(terminals, attemptId)),
    O.match({
      onNone: () => ({ terminals, orphanVerdictFilesAdded: 0, unkeyedVerdictFiles }),
      onSome: ({ attemptId, verdict }) => ({
        terminals: HashMap.set(terminals, attemptId, {
          verdict: O.some(verdict),
          recordedAt: O.orElse(verdict.endedAt, () => verdict.createdAt),
          diffFingerprint: O.none(),
          reason: O.none(),
        }),
        orphanVerdictFilesAdded: 1,
        unkeyedVerdictFiles,
      }),
    })
  );
};

interface RunIdentity {
  readonly checkout: string;
  readonly runId: string;
}

const foldRunJournal = (
  run: RunIdentity,
  inFlightAttemptId: O.Option<string>,
  journalRead: ContainedFileRead,
  verdictRead: ContainedFileRead
): EconomicsJournal => {
  const decoded = journalRead.contents.pipe(
    O.match({
      onNone: (): DecodedJournalText => ({ rows: A.empty(), invalidRows: 0 }),
      onSome: decodeJournalText,
    })
  );
  const fold = A.reduce(decoded.rows, emptyJournalFold, stepJournalFold);
  const orphan = applyOrphanVerdict(fold.terminals, verdictRead);
  // The caller's own running attempt (a closeout reading its branch) has a
  // start and no terminal row yet; it is dropped, not counted as a death.
  const inFlight = O.filter(
    inFlightAttemptId,
    (attemptId) => HashMap.has(fold.starts, attemptId) && !HashMap.has(orphan.terminals, attemptId)
  );
  const starts = inFlight.pipe(
    O.map((attemptId) => HashMap.remove(fold.starts, attemptId)),
    O.getOrElse(() => fold.starts)
  );
  const startIds = starts.pipe(HashMap.keys, HashSet.fromIterable);
  const terminalIds = orphan.terminals.pipe(HashMap.keys, HashSet.fromIterable);
  const journalReadable = O.isSome(journalRead.contents);
  const inFlightExcluded = O.isSome(inFlight);
  return EconomicsJournal.make({
    checkout: run.checkout,
    runId: run.runId,
    cutoff: O.flatMap(fold.cutoffMs, formatMillis),
    attempts: A.map(HashMap.toEntries(orphan.terminals), ([attemptId, terminal]) =>
      attemptFromTerminal(run, attemptId, terminal, HashMap.get(starts, attemptId))
    ),
    diagnostics: EconomicsJournalDiagnostics.make({
      journalsObserved: countIf(journalReadable),
      unreadableJournals: countIf(journalRead.exists && !journalReadable),
      invalidRows: decoded.invalidRows,
      compactionReceipts: fold.compactionReceipts,
      duplicateStartedRowsDeduplicated: fold.duplicateStarts,
      duplicateFinishedRowsDeduplicated: fold.duplicateTerminals,
      orphanVerdictFilesAdded: orphan.orphanVerdictFilesAdded,
      unkeyedVerdictFiles: orphan.unkeyedVerdictFiles,
      starts: HashSet.size(startIds),
      startsWithoutFinish: HashSet.size(HashSet.difference(startIds, terminalIds)),
      verdictsWithoutStart: HashSet.size(HashSet.difference(terminalIds, startIds)),
      inFlightStartsExcluded: countIf(inFlightExcluded),
    }),
  });
};

// ---------------------------------------------------------------------------
// Journal source (effectful part)
// ---------------------------------------------------------------------------

interface EconomicsCheckout {
  readonly label: string;
  readonly runsDirectory: string;
}

const checkoutOrder = Order.mapInput(Order.String, (checkout: EconomicsCheckout) => checkout.label);

// No-follow directory test: a symlink is never a directory here, so a
// symlinked checkout or run directory is skipped rather than read through.
const isRealDirectory = Effect.fnUntraced(function* (entry: string) {
  const fs = yield* FileSystem.FileSystem;
  if (O.isSome(yield* fs.readLink(entry).pipe(Effect.option))) {
    return false;
  }
  return O.exists(yield* fs.stat(entry).pipe(Effect.option), (info) => Str.Equivalence(info.type, "Directory"));
});

// Whether the entry itself exists, a dangling symlink included.
const existsNoFollow = Effect.fnUntraced(function* (entry: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readLink(entry).pipe(
    Effect.as(true),
    Effect.catch(() => fs.exists(entry)),
    Effect.orElseSucceed(thunkFalse)
  );
});

const listDirectory = Effect.fnUntraced(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const entries = yield* fs.readDirectory(directory).pipe(Effect.orElseSucceed(A.empty<string>));
  return A.sort(entries, Order.String);
});

// The names under `directory` that `keep` accepts and that are real
// directories; stray files and symlinks are skipped without being counted.
const realDirectoryNames = Effect.fnUntraced(function* (directory: string, keep: (name: string) => boolean) {
  const path = yield* Path.Path;
  return yield* Effect.filter(A.filter(yield* listDirectory(directory), keep), (name) =>
    isRealDirectory(path.join(directory, name))
  );
});

// A linked worktree's `.git` file holds `gitdir: <clone>/.git/worktrees/<name>`.
const gitDirOfGitFile = (path: Path.Path, checkout: string, content: string): O.Option<string> =>
  pipe(
    A.findFirst(A.map(Str.split(content, "\n"), Str.trim), Str.startsWith(GITDIR_PREFIX)),
    O.map(flow(Str.slice(Str.length(GITDIR_PREFIX)), Str.trim)),
    O.filter(Str.isNonEmpty),
    O.map((target) => path.resolve(checkout, target))
  );

const cloneOfGitDir = (path: Path.Path, gitDir: string): O.Option<string> => {
  const worktrees = path.dirname(gitDir);
  const metadata = path.dirname(worktrees);
  return O.liftPredicate(
    path.dirname(metadata),
    () =>
      Str.Equivalence(path.basename(worktrees), GIT_WORKTREES_DIRECTORY_NAME) &&
      Str.Equivalence(path.basename(metadata), GIT_METADATA_NAME)
  );
};

// The clone that owns a checkout, read from its git metadata without spawning
// git: a `.git` directory makes the checkout its own clone, a `.git` file
// names the clone's `.git/worktrees/<name>`. None when `.git` is unreadable.
const cloneRootOf = Effect.fnUntraced(function* (checkout: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const gitPath = path.join(checkout, GIT_METADATA_NAME);
  const kind = O.map(yield* fs.stat(gitPath).pipe(Effect.option), (info) => info.type);
  if (O.contains(kind, "Directory")) {
    return O.some(checkout);
  }
  const content = O.contains(kind, "File") ? yield* fs.readFileString(gitPath).pipe(Effect.option) : O.none<string>();
  return pipe(
    content,
    O.flatMap((text) => gitDirOfGitFile(path, checkout, text)),
    O.flatMap((gitDir) => cloneOfGitDir(path, gitDir))
  );
});

// The projects root is the clone's parent (ruling 73). Only when `.git` is
// unreadable does the directory name decide: a lane under `<clone>-worktrees/`
// sits one level deeper than a clone.
const projectsRootOf = Effect.fnUntraced(function* (repoRoot: string) {
  const path = yield* Path.Path;
  const parent = path.dirname(repoRoot);
  return O.getOrElse(
    O.map(yield* cloneRootOf(repoRoot), (clone) => path.dirname(clone)),
    () => (Str.endsWith(WORKTREES_ROOT_SUFFIX)(path.basename(parent)) ? path.dirname(parent) : parent)
  );
});

const hasRunsDirectory = Effect.fnUntraced(function* (runsDirectory: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.exists(runsDirectory).pipe(Effect.orElseSucceed(thunkFalse));
});

// `--fleet` candidates (ruling 73): every `beep-effect*` directory under the
// projects root, every lane inside a `beep-effect*-worktrees` directory, and
// every lane under a clone's `.claude/worktrees`. Symlinks are never followed.
const fleetCandidates = Effect.fnUntraced(function* (projectsRoot: string) {
  const path = yield* Path.Path;
  const names = yield* realDirectoryNames(projectsRoot, Str.startsWith(CHECKOUT_PREFIX));
  const nested = yield* Effect.forEach(names, (name) => {
    const directory = path.join(projectsRoot, name);
    const isWorktreesRoot = Str.endsWith(WORKTREES_ROOT_SUFFIX)(name);
    const lanesRoot = isWorktreesRoot ? directory : path.join(directory, CLAUDE_WORKTREES_RELATIVE_ROOT);
    const lanes = Effect.map(
      realDirectoryNames(lanesRoot, constTrue),
      A.map((lane) => path.join(lanesRoot, lane))
    );
    return isWorktreesRoot ? lanes : Effect.map(lanes, A.prepend(directory));
  });
  return A.flatten(nested);
});

const resolveCheckouts = Effect.fnUntraced(function* (request: EconomicsScopeRequest) {
  const path = yield* Path.Path;
  const repoRoot = path.resolve(request.repoRoot);
  const projectsRoot = yield* projectsRootOf(repoRoot);
  const roots = request.fleet ? A.dedupe(A.prepend(yield* fleetCandidates(projectsRoot), repoRoot)) : A.of(repoRoot);
  // The packet dir resolves against each checkout unless absolute; checkouts
  // that resolve to the same runs directory are read once.
  const checkouts = A.dedupeWith(
    A.map(
      roots,
      (root): EconomicsCheckout => ({
        label: path.relative(projectsRoot, root),
        runsDirectory: path.resolve(root, request.packetDir, RUNS_DIRECTORY_NAME),
      })
    ),
    (self, that) => Str.Equivalence(self.runsDirectory, that.runsDirectory)
  );
  const withRuns = yield* Effect.filter(checkouts, (checkout) => hasRunsDirectory(checkout.runsDirectory));
  if (!request.fleet && A.isReadonlyArrayEmpty(withRuns)) {
    return yield* YeetEconomicsError.make({
      reason: "no-runs-directory",
      message: `no ${A.join([request.packetDir, RUNS_DIRECTORY_NAME], "/")} under ${repoRoot}`,
    });
  }
  return A.sort(withRuns, checkoutOrder);
});

// A guard refusal (a symlinked file or directory component) reads as present
// without contents only when the entry itself exists: a refused journal counts
// as unreadable, and a missing verdict counts as nothing.
const readRunFile = (
  runsDirectory: string,
  target: string
): Effect.Effect<ContainedFileRead, never, FileSystem.FileSystem | Path.Path> =>
  readContainedFileStringNoFollow(runsDirectory, target).pipe(
    Effect.catchTag("FsGuardError", () =>
      Effect.map(existsNoFollow(target), (exists) => ContainedFileRead.make({ exists, contents: O.none() }))
    )
  );

const readRunJournal = Effect.fnUntraced(function* (
  checkout: EconomicsCheckout,
  runId: string,
  inFlightAttemptId: O.Option<string>
) {
  const path = yield* Path.Path;
  const runDirectory = path.join(checkout.runsDirectory, runId);
  const journalRead = yield* readRunFile(checkout.runsDirectory, path.join(runDirectory, JOURNAL_FILE_NAME));
  const verdictRead = yield* readRunFile(checkout.runsDirectory, path.join(runDirectory, VERDICT_FILE_NAME));
  return journalRead.exists || verdictRead.exists
    ? O.some(foldRunJournal({ checkout: checkout.label, runId }, inFlightAttemptId, journalRead, verdictRead))
    : O.none<EconomicsJournal>();
});

// Every real run directory, or only the branch's; a stray file or a symlink
// under `runs/` is skipped without a diagnostic.
const readCheckoutJournals = Effect.fnUntraced(function* (
  checkout: EconomicsCheckout,
  runId: O.Option<string>,
  inFlightAttemptId: O.Option<string>
) {
  const runIds = yield* realDirectoryNames(
    checkout.runsDirectory,
    (name) => O.isNone(runId) || O.contains(runId, name)
  );
  return A.getSomes(yield* Effect.forEach(runIds, (id) => readRunJournal(checkout, id, inFlightAttemptId)));
});

const readEconomicsJournals = Effect.fn("Yeet.Economics.read")(function* (
  request: EconomicsScopeRequest
): Effect.fn.Return<
  ReadonlyArray<EconomicsJournal>,
  YeetEconomicsError,
  Crypto.Crypto | FileSystem.FileSystem | Path.Path
> {
  const checkouts = yield* resolveCheckouts(request);
  const runId = yield* Effect.transposeOption(O.map(request.branch, repoRunArtifactId)).pipe(
    Effect.mapError((cause) =>
      YeetEconomicsError.make({ reason: "run-id", message: "Failed to derive the branch run id.", cause })
    )
  );
  const nested = yield* Effect.forEach(
    checkouts,
    (checkout) => readCheckoutJournals(checkout, runId, request.inFlightAttemptId),
    { concurrency: FLEET_READ_CONCURRENCY }
  );
  return A.flatten(nested);
});

/**
 * Operations the economics source provides.
 *
 * **Example** (Describe a scope read)
 *
 * ```ts
 * import { EconomicsScopeRequest } from "@beep/repo-cli/test/Yeet"
 * import type { YeetEconomicsSourceShape } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const request = EconomicsScopeRequest.make({ repoRoot: "/repo", branch: O.none(), fleet: false })
 * const readScope = (source: YeetEconomicsSourceShape) => source.read(request)
 * console.log(readScope.length) // 1
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface YeetEconomicsSourceShape {
  readonly read: (request: EconomicsScopeRequest) => Effect.Effect<ReadonlyArray<EconomicsJournal>, YeetEconomicsError>;
}

const makeYeetEconomicsSource: Effect.Effect<
  YeetEconomicsSourceShape,
  never,
  Crypto.Crypto | FileSystem.FileSystem | Path.Path
> = Effect.map(Effect.context<Crypto.Crypto | FileSystem.FileSystem | Path.Path>(), (context) => ({
  read: (request: EconomicsScopeRequest) => readEconomicsJournals(request).pipe(Effect.provide(context)),
}));

/**
 * Service boundary that reads a scope's attempt journals (ruling 73).
 *
 * **Details**
 *
 * The default scope is every `<packetDir>/runs/<runId>/attempts.ndjson` of the
 * checkout (`packetDir` defaults to `.beep/yeet`) plus orphan `verdict.json`
 * files; a branch narrows to that branch's run directory. The fleet adds every
 * sibling `beep-effect*` checkout, `beep-effect*-worktrees/*` lane and
 * `<clone>/.claude/worktrees/*` lane under the projects root, the parent of
 * the clone named by the checkout's `.git` metadata, each labelled by its path
 * relative to that root. Symlinked checkouts and run directories and stray
 * files under `runs/` are skipped without being counted.
 *
 * A bad journal never fails the read: an unreadable file counts in
 * `unreadableJournals` and a line that fails the row projection counts in
 * `invalidRows`. The one exemption is the journal's torn-tail rule: invalid
 * JSON on an unterminated last line is an append still in flight and is not
 * counted. `read` fails with reason `no-runs-directory` when a non-fleet scope
 * has no `<packetDir>/runs`, and with `run-id` when a branch's run id cannot
 * be derived.
 *
 * **Example** (Read the current checkout)
 *
 * ```ts
 * import { EconomicsScopeRequest, YeetEconomicsSource } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = Effect.gen(function* () {
 *   const source = yield* YeetEconomicsSource
 *   return yield* source.read(EconomicsScopeRequest.make({ repoRoot: "/repo", branch: O.none(), fleet: false }))
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class YeetEconomicsSource extends Context.Service<YeetEconomicsSource, YeetEconomicsSourceShape>()(
  $I`YeetEconomicsSource`,
  { make: makeYeetEconomicsSource }
) {
  /** Live source over the filesystem; `Crypto` derives a branch's run id. */
  static readonly layer: Layer.Layer<YeetEconomicsSource, never, Crypto.Crypto | FileSystem.FileSystem | Path.Path> =
    Layer.effect(YeetEconomicsSource, YeetEconomicsSource.make);
}

// ---------------------------------------------------------------------------
// Pure fold
// ---------------------------------------------------------------------------

const countRowOrder = Order.combine(
  Order.mapInput(Order.flip(Order.Number), (row: EconomicsCountRow) => row.count),
  Order.mapInput(Order.String, (row: EconomicsCountRow) => row.key)
);

const countMix = (keys: ReadonlyArray<string>): ReadonlyArray<EconomicsCountRow> =>
  A.sort(
    A.map(R.toEntries(A.groupBy(keys, identity)), ([key, members]) =>
      EconomicsCountRow.make({ key, count: A.length(members) })
    ),
    countRowOrder
  );

const orUnknown: (value: O.Option<string>) => string = O.getOrElse(() => UNKNOWN_KEY);
const isGreen = (attempt: EconomicsAttempt): boolean => O.exists(attempt.outcome, YeetOutcome.is.success);
const isRed = P.not(isGreen);
const isLockBounce = (attempt: EconomicsAttempt): boolean =>
  O.exists(attempt.failureKind, YeetFailureKind.is["handler-error"]) &&
  Str.includes(LOCK_BOUNCE_SENTENCE)(attempt.message);
const isComparable = (attempt: EconomicsAttempt): boolean =>
  O.exists(attempt.mode, isComparableMode) && !isLockBounce(attempt);
const attemptKey = (attempt: EconomicsAttempt): string =>
  A.join([attempt.checkout, attempt.runId, attempt.attemptId], "\u0000");

const attemptMix = (attempts: ReadonlyArray<EconomicsAttempt>): EconomicsAttemptMix =>
  EconomicsAttemptMix.make({
    outcomeMix: countMix(A.map(attempts, (attempt) => orUnknown(attempt.outcome))),
    modeMix: countMix(A.map(attempts, (attempt) => orUnknown(attempt.mode))),
    failureKindMix: countMix(A.map(A.filter(attempts, isRed), (attempt) => orUnknown(attempt.failureKind))),
  });

interface LaneObservation {
  readonly attemptKey: string;
  readonly durationMs: number;
  readonly lane: EconomicsLane;
}

const laneRowOrder = Order.combineAll([
  Order.mapInput(Order.flip(Order.Number), (row: EconomicsLaneRow) => row.totalDurationMs),
  Order.mapInput(Order.String, (row: EconomicsLaneRow) => row.id),
  Order.mapInput(Order.String, (row: EconomicsLaneRow) => row.label),
]);

const laneIdentity = (observation: LaneObservation): string =>
  A.join([observation.lane.id, observation.lane.label, observation.lane.phase], "\u0000");

const laneRow = (group: A.NonEmptyReadonlyArray<LaneObservation>, populationMs: number): EconomicsLaneRow => {
  const { lane } = A.headNonEmpty(group);
  const durations = A.map(group, (observation) => observation.durationMs);
  const totalMs = Num.sumAll(durations);
  return EconomicsLaneRow.make({
    id: lane.id,
    label: lane.label,
    phase: lane.phase,
    attempts: HashSet.size(HashSet.fromIterable(A.map(group, (observation) => observation.attemptKey))),
    executions: A.length(group),
    p50DurationMs: roundedRank(durations, 0.5),
    p95DurationMs: roundedRank(durations, 0.95),
    totalDurationMs: Math.round(totalMs),
    sharePct: percentOf(totalMs, populationMs),
    statusMix: countMix(A.map(group, (observation) => observation.lane.status)),
  });
};

// Ruling 74: each population has its own denominator; the two are never summed.
const lanePopulation = (
  attempts: ReadonlyArray<EconomicsAttempt>,
  kind: EconomicsLaneKind
): EconomicsLanePopulation => {
  const observations = A.flatMap(attempts, (attempt) =>
    A.getSomes(
      A.map(attempt.lanes, (lane) =>
        pipe(
          lane.durationMs,
          O.filter(() => EconomicsLaneKind.is[kind](lane.population)),
          O.filter(Num.isGreaterThanOrEqualTo(0)),
          O.map((durationMs): LaneObservation => ({ attemptKey: attemptKey(attempt), lane, durationMs }))
        )
      )
    )
  );
  const totalMs = sumOf(observations, (observation) => observation.durationMs);
  // The denominator is the elapsed time of the attempts that contributed at
  // least one observation to this population, never of every attempt.
  const contributing = HashSet.fromIterable(A.map(observations, (observation) => observation.attemptKey));
  const elapsedMs = sumOf(
    A.filter(attempts, (attempt) => HashSet.has(contributing, attemptKey(attempt))),
    (attempt) => O.getOrElse(attempt.elapsedMs, thunk0)
  );
  return EconomicsLanePopulation.make({
    rows: A.sort(
      A.map(R.values(A.groupBy(observations, laneIdentity)), (group) => laneRow(group, totalMs)),
      laneRowOrder
    ),
    executions: A.length(observations),
    totalDurationMs: Math.round(totalMs),
    attemptElapsedMs: Math.round(elapsedMs),
    accountedPct: percentOf(totalMs, elapsedMs),
  });
};

const isFailedLane = (lane: EconomicsLane): boolean => YeetLaneStatus.is.failed(lane.status);
const isInnerLane = (lane: EconomicsLane): boolean => EconomicsLaneKind.is.inner(lane.population);
const isTimedFailure = (lane: EconomicsLane): boolean => isFailedLane(lane) && O.isSome(lane.durationMs);

interface FailureOffsets {
  readonly completionOffsetMs: number;
  readonly startOffsetMs: number;
}

interface FailingLane {
  readonly lane: EconomicsLane;
  readonly precedingMs: number;
}

const nonNegativeDurationMs = (lanes: ReadonlyArray<EconomicsLane>): number =>
  Num.sumAll(A.filter(A.getSomes(A.map(lanes, (lane) => lane.durationMs)), Num.isGreaterThanOrEqualTo(0)));

const parentEquivalence = O.makeEquivalence(Str.Equivalence);

// Ruling 74: the failing lane is the first failed inner lane with a duration,
// else the first failed wrapper with one. An inner lane starts after the
// wrappers before its parent wrapper (`parentLaneId`; for a legacy verdict, the
// first failed timed wrapper; every wrapper when none is found) and after that
// wrapper's inner lanes before it. A failing wrapper starts after the wrappers
// before it.
const failureOffsets = (attempt: EconomicsAttempt): O.Option<FailureOffsets> => {
  const wrappers = A.filter(attempt.lanes, P.not(isInnerLane));
  const inner = A.filter(attempt.lanes, isInnerLane);
  const legacyParent = O.map(A.findFirst(wrappers, isTimedFailure), (lane) => lane.id);
  const parentOf = (lane: EconomicsLane): O.Option<string> => O.orElse(lane.parentLaneId, () => legacyParent);
  const [innerBefore, innerFrom] = A.span(inner, P.not(isTimedFailure));
  const [wrappersBefore, wrappersFrom] = A.span(wrappers, P.not(isTimedFailure));
  return pipe(
    A.head(innerFrom),
    O.map((lane): FailingLane => {
      const parent = parentOf(lane);
      return {
        lane,
        precedingMs:
          nonNegativeDurationMs(A.takeWhile(wrappers, (wrapper) => !O.contains(parent, wrapper.id))) +
          nonNegativeDurationMs(A.filter(innerBefore, (sibling) => parentEquivalence(parentOf(sibling), parent))),
      };
    }),
    O.orElse(() =>
      O.map(A.head(wrappersFrom), (lane): FailingLane => ({ lane, precedingMs: nonNegativeDurationMs(wrappersBefore) }))
    ),
    O.flatMap(({ lane, precedingMs }) =>
      O.map(lane.durationMs, (durationMs) => ({
        startOffsetMs: precedingMs,
        completionOffsetMs: precedingMs + durationMs,
      }))
    )
  );
};

const actionableLane = (attempt: EconomicsAttempt): string =>
  pipe(
    A.findFirst(attempt.lanes, (lane) => isInnerLane(lane) && isFailedLane(lane)),
    O.map((lane) => lane.id),
    O.orElse(() => attempt.failedStepId),
    O.orElse(() => O.map(A.findFirst(attempt.lanes, isFailedLane), (lane) => lane.id)),
    O.getOrElse(() => UNLOCATED_LANE)
  );

const receiptProxyClass = (attempt: EconomicsAttempt): string => {
  const text = Str.toLowerCase(
    A.join(
      [
        attempt.message,
        A.join(
          A.map(attempt.lanes, (lane) => O.getOrElse(lane.repairCommand, thunkEmptyStr)),
          " "
        ),
        O.getOrElse(attempt.failedStepId, thunkEmptyStr),
      ],
      " "
    )
  );
  return pipe(
    A.findFirst(RECEIPT_PROXY_PATTERNS, ([, pattern]) => pattern.test(text)),
    O.map(([proxyClass]) => proxyClass),
    O.getOrElse(() => EconomicsReceiptProxyClass.Enum.unclassified)
  );
};

const firstFailure = (attempts: ReadonlyArray<EconomicsAttempt>): EconomicsFirstFailure => {
  const red = A.filter(attempts, isRed);
  const offsets = A.getSomes(A.map(red, failureOffsets));
  const starts = A.map(offsets, (offset) => offset.startOffsetMs);
  const completions = A.map(offsets, (offset) => offset.completionOffsetMs);
  return EconomicsFirstFailure.make({
    redAttempts: A.length(red),
    attemptsWithReconstructableOuterFailure: A.length(offsets),
    attemptsWithoutReconstructableOuterFailure: A.length(red) - A.length(offsets),
    offsetMethod: YEET_ECONOMICS_OFFSET_METHOD,
    startOffsetP50Ms: roundedRank(starts, 0.5),
    startOffsetP95Ms: roundedRank(starts, 0.95),
    completionOffsetP50Ms: roundedRank(completions, 0.5),
    completionOffsetP95Ms: roundedRank(completions, 0.95),
    actionableLaneMix: countMix(A.map(red, actionableLane)),
    receiptProxyMix: countMix(A.map(red, receiptProxyClass)),
  });
};

interface TimedAttempt {
  readonly attempt: EconomicsAttempt;
  readonly endedMs: O.Option<number>;
  readonly startedMs: O.Option<number>;
}

const timedAttemptOrder = Order.combine(
  Order.mapInput(O.makeOrder(Order.Number), (timed: TimedAttempt) => O.orElse(timed.startedMs, () => timed.endedMs)),
  Order.mapInput(Order.String, (timed: TimedAttempt) => timed.attempt.attemptId)
);

// One journal's attempts in `(startedAt, attemptId)` order; an attempt without
// a start sorts by its end, and one with neither sorts first.
const timedAttempts = (journal: EconomicsJournal): ReadonlyArray<TimedAttempt> =>
  A.sort(
    A.map(journal.attempts, (attempt) => ({
      attempt,
      startedMs: O.flatMap(attempt.startedAt, parseMillis),
      endedMs: O.flatMap(attempt.endedAt, parseMillis),
    })),
    timedAttemptOrder
  );

// Ruling 75: the comparable sequence of one run, which red-to-green and the
// M4 proxy both walk: attempts with a start, in order, whose mode is
// comparable and that are not lock bounces.
const comparableSequence = (journal: EconomicsJournal): ReadonlyArray<TimedAttempt> =>
  A.filter(timedAttempts(journal), (timed) => O.isSome(timed.startedMs) && isComparable(timed.attempt));

interface Episode {
  readonly attempts: number;
  readonly leftCensored: boolean;
  readonly machineMs: number;
  readonly spanMs: number;
}

interface EpisodeWalk {
  readonly episodes: ReadonlyArray<Episode>;
  readonly streak: ReadonlyArray<TimedAttempt>;
}

const emptyEpisodeWalk: EpisodeWalk = { streak: A.empty(), episodes: A.empty() };

const endMillis = (timed: TimedAttempt): number =>
  O.getOrElse(
    O.orElse(timed.endedMs, () => timed.startedMs),
    thunk0
  );
const startMillis = (timed: TimedAttempt): number => O.getOrElse(timed.startedMs, thunk0);
// The last time an attempt was measured: its end, except that a reconciler-
// stamped termination's end is the sweep, so it stops at its start.
const measuredEndMillis = (timed: TimedAttempt): number =>
  O.exists(timed.attempt.terminationReason, isReconcilerStampedReason) ? startMillis(timed) : endMillis(timed);
const machineMillis = (members: ReadonlyArray<TimedAttempt>): number =>
  sumOf(members, (timed) => O.getOrElse(timed.attempt.elapsedMs, thunk0));

interface OpenStreak {
  readonly attempts: number;
  readonly observedSpanMs: number;
}

interface JournalEpisodes {
  readonly closed: ReadonlyArray<Episode>;
  readonly openStreak: O.Option<OpenStreak>;
}

// Ruling 75: a red attempt joins the streak, a green one closes it; a green with
// no streak closes nothing. Episodes never span two runs.
const journalEpisodes = (journal: EconomicsJournal): JournalEpisodes => {
  const cutoffMs = O.flatMap(journal.cutoff, parseMillis);
  const walk = A.reduce(
    comparableSequence(journal),
    emptyEpisodeWalk,
    (state: EpisodeWalk, timed: TimedAttempt): EpisodeWalk =>
      isRed(timed.attempt)
        ? { ...state, streak: A.append(state.streak, timed) }
        : A.match(state.streak, {
            onEmpty: () => state,
            onNonEmpty: (streak): EpisodeWalk => {
              const start = startMillis(A.headNonEmpty(streak));
              const members = A.append(streak, timed);
              return {
                streak: A.empty(),
                episodes: A.append(state.episodes, {
                  spanMs: Math.max(0, endMillis(timed) - start),
                  attempts: A.length(members),
                  machineMs: machineMillis(members),
                  leftCensored: O.exists(cutoffMs, (cutoff) => start <= cutoff),
                }),
              };
            },
          })
  );
  return {
    closed: walk.episodes,
    // A streak still red at the end is right-censored; its observed lower
    // bound runs from the first red's start to the last member's last
    // measured time.
    openStreak: A.match(walk.streak, {
      onEmpty: O.none,
      onNonEmpty: (streak) =>
        O.some({
          attempts: A.length(streak),
          observedSpanMs: Math.max(0, measuredEndMillis(A.lastNonEmpty(streak)) - startMillis(A.headNonEmpty(streak))),
        }),
    }),
  };
};

const episodeSummary = (
  label: string,
  kept: ReadonlyArray<Episode>,
  leftCensored: ReadonlyArray<Episode>,
  openStreaks: ReadonlyArray<OpenStreak>,
  over24hExcluded: O.Option<number>
): EconomicsEpisodeSummary => {
  const spans = A.map(kept, (episode) => episode.spanMs);
  return EconomicsEpisodeSummary.make({
    label,
    closedEpisodes: A.length(kept),
    p50Ms: roundedRank(spans, 0.5),
    p95Ms: roundedRank(spans, 0.95),
    totalEpisodeSpanMinutes: minutesOf(Num.sumAll(spans)),
    measuredAttemptMachineMinutes: minutesOf(sumOf(kept, (episode) => episode.machineMs)),
    leftCensoredEpisodesExcluded: A.length(leftCensored),
    leftCensoredObservedAttempts: sumOf(leftCensored, (episode) => episode.attempts),
    rightCensoredStreaks: A.length(openStreaks),
    rightCensoredRedAttempts: sumOf(openStreaks, (streak) => streak.attempts),
    rightCensoredObservedSpanMinutes: minutesOf(sumOf(openStreaks, (streak) => streak.observedSpanMs)),
    closedEpisodesOver24hExcluded: over24hExcluded,
  });
};

const redToGreen = (journals: ReadonlyArray<EconomicsJournal>): EconomicsRedToGreen => {
  const perJournal = A.map(journals, journalEpisodes);
  const episodes = A.flatMap(perJournal, (journal) => journal.closed);
  const closed = A.filter(episodes, (episode) => !episode.leftCensored);
  const leftCensored = A.filter(episodes, (episode) => episode.leftCensored);
  const openStreaks = A.getSomes(A.map(perJournal, (episodes) => episodes.openStreak));
  const cutMs = Duration.toMillis(COMPARABLE_EPISODE_CUT);
  const comparable = A.filter(closed, (episode) => episode.spanMs <= cutMs);
  return EconomicsRedToGreen.make({
    comparable24h: episodeSummary(
      "comparable24h: modes verify/repair/publish; lock bounces and left-censored episodes excluded; span <= 24h",
      comparable,
      leftCensored,
      openStreaks,
      O.some(A.length(closed) - A.length(comparable))
    ),
    uncut: episodeSummary(
      "uncut: same modes, bounce and censoring rule; no span ceiling",
      closed,
      leftCensored,
      openStreaks,
      O.none()
    ),
  });
};

const sameFingerprint = (red: EconomicsAttempt, green: EconomicsAttempt): boolean =>
  O.exists(red.diffFingerprint, (fingerprint) =>
    O.exists(green.diffFingerprint, (next) => Str.Equivalence(fingerprint, next))
  );

// A red attempt that carries a verdict; a terminated row has no outcome.
const hasRedVerdict = (attempt: EconomicsAttempt): boolean => O.exists(attempt.outcome, P.not(YeetOutcome.is.success));

// The M4 fingerprint-repeat proxy (ruling 75): the red side of each pair of
// consecutive comparable attempts where a verdict-bearing red is followed by a
// green on the same diff fingerprint.
const fingerprintRepeats = (journal: EconomicsJournal): ReadonlyArray<EconomicsAttempt> => {
  const ordered = A.map(comparableSequence(journal), (timed) => timed.attempt);
  return A.map(
    A.filter(
      A.zip(ordered, A.drop(ordered, 1)),
      ([current, next]) => hasRedVerdict(current) && isGreen(next) && sameFingerprint(current, next)
    ),
    ([current]) => current
  );
};

const unchangedFingerprint = (
  journals: ReadonlyArray<EconomicsJournal>,
  attempts: ReadonlyArray<EconomicsAttempt>
): EconomicsUnchangedFingerprint => {
  const attemptsWithFingerprint = A.length(A.filter(attempts, (attempt) => O.isSome(attempt.diffFingerprint)));
  const repeats = A.flatMap(journals, fingerprintRepeats);
  return EconomicsUnchangedFingerprint.make({
    classification: attemptsWithFingerprint > 0 ? "measured" : "unmeasurable",
    attemptsWithFingerprint,
    failedUnchangedFingerprintThenGreen: A.length(repeats),
    byActionableLane: countMix(A.map(repeats, actionableLane)),
    byReceiptProxy: countMix(A.map(repeats, receiptProxyClass)),
  });
};

const terminations = (
  journals: ReadonlyArray<EconomicsJournal>,
  attempts: ReadonlyArray<EconomicsAttempt>
): EconomicsTerminations =>
  EconomicsTerminations.make({
    starts: sumOf(journals, (journal) => journal.diagnostics.starts),
    startsWithoutFinish: sumOf(journals, (journal) => journal.diagnostics.startsWithoutFinish),
    reasonMix: countMix(A.getSomes(A.map(attempts, (attempt) => attempt.terminationReason))),
  });

const dataQuality = (
  journals: ReadonlyArray<EconomicsJournal>,
  attempts: ReadonlyArray<EconomicsAttempt>
): EconomicsDataQuality => {
  const instants = A.sort(
    A.flatMap(attempts, (attempt) =>
      A.getSomes([O.flatMap(attempt.startedAt, parseMillis), O.flatMap(attempt.endedAt, parseMillis)])
    ),
    Order.Number
  );
  const total = (pick: (diagnostics: EconomicsJournalDiagnostics) => number): number =>
    sumOf(journals, (journal) => pick(journal.diagnostics));
  const verdictV2Attempts = A.length(
    A.filter(attempts, (attempt) =>
      O.exists(attempt.verdictSchemaVersion, (version) => Str.Equivalence(version, VERDICT_V2))
    )
  );
  return EconomicsDataQuality.make({
    attemptWindowStartUtc: O.flatMap(A.head(instants), formatMillis),
    attemptWindowEndUtc: O.flatMap(A.last(instants), formatMillis),
    diagnostics: EconomicsDiagnostics.make({
      journalsObserved: total((diagnostics) => diagnostics.journalsObserved),
      unreadableJournals: total((diagnostics) => diagnostics.unreadableJournals),
      invalidRows: total((diagnostics) => diagnostics.invalidRows),
      compactionReceipts: total((diagnostics) => diagnostics.compactionReceipts),
      duplicateStartedRowsDeduplicated: total((diagnostics) => diagnostics.duplicateStartedRowsDeduplicated),
      duplicateFinishedRowsDeduplicated: total((diagnostics) => diagnostics.duplicateFinishedRowsDeduplicated),
      orphanVerdictFilesAdded: total((diagnostics) => diagnostics.orphanVerdictFilesAdded),
      unkeyedVerdictFiles: total((diagnostics) => diagnostics.unkeyedVerdictFiles),
      starts: total((diagnostics) => diagnostics.starts),
      startsWithoutFinish: total((diagnostics) => diagnostics.startsWithoutFinish),
      verdictsWithoutStart: total((diagnostics) => diagnostics.verdictsWithoutStart),
      inFlightStartsExcluded: total((diagnostics) => diagnostics.inFlightStartsExcluded),
      leftCensoredJournals: A.length(A.filter(journals, (journal) => O.isSome(journal.cutoff))),
      finishedAttempts: A.length(attempts),
      verdictV2Attempts,
      verdictOtherAttempts: A.length(attempts) - verdictV2Attempts,
    }),
    percentileEstimator: YEET_ECONOMICS_PERCENTILE_ESTIMATOR,
    rounding: YEET_ECONOMICS_ROUNDING,
  });
};

/**
 * Fold normalized journals into the `yeet-economics/v1` report.
 *
 * **Details**
 *
 * Pure: the same journals, scope and instant always give the same document.
 * Lanes and first failure fold every attempt; red-to-green folds the
 * comparable attempts of each run separately; percentiles are nearest rank
 * rounded with `Math.round`.
 *
 * **Example** (A report over no journals)
 *
 * ```ts
 * import { buildYeetEconomicsReport, EconomicsScope } from "@beep/repo-cli/test/Yeet"
 * import { DateTime } from "effect"
 * import * as O from "effect/Option"
 *
 * const report = buildYeetEconomicsReport(
 *   [],
 *   EconomicsScope.make({ kind: "checkout", checkouts: [], branch: O.none() }),
 *   DateTime.makeUnsafe("2026-09-25T00:00:00.000Z")
 * )
 * console.log(report.dataQuality.diagnostics.finishedAttempts) // 0
 * ```
 *
 * @param journals - The scope's normalized journals.
 * @param scope - The scope the journals were read from.
 * @param now - The measurement instant recorded as `measurementAsOf`.
 * @returns The report document.
 * @category utilities
 * @since 0.0.0
 */
export const buildYeetEconomicsReport: {
  (scope: EconomicsScope, now: DateTime.Utc): (journals: ReadonlyArray<EconomicsJournal>) => YeetEconomicsReport;
  (journals: ReadonlyArray<EconomicsJournal>, scope: EconomicsScope, now: DateTime.Utc): YeetEconomicsReport;
} = dual(
  3,
  (journals: ReadonlyArray<EconomicsJournal>, scope: EconomicsScope, now: DateTime.Utc): YeetEconomicsReport => {
    const attempts = A.flatMap(journals, (journal) => journal.attempts);
    return YeetEconomicsReport.make({
      schemaVersion: YEET_ECONOMICS_SCHEMA_VERSION,
      scope,
      measurementAsOf: DateTime.formatIso(now),
      attempts: EconomicsAttempts.make({
        all: attemptMix(attempts),
        comparable: attemptMix(A.filter(attempts, isComparable)),
      }),
      wrapperLanes: lanePopulation(attempts, EconomicsLaneKind.Enum.wrapper),
      innerLanes: lanePopulation(attempts, EconomicsLaneKind.Enum.inner),
      firstFailure: firstFailure(attempts),
      redToGreen: redToGreen(journals),
      terminations: terminations(journals, attempts),
      unchangedFingerprint: unchangedFingerprint(journals, attempts),
      dataQuality: dataQuality(journals, attempts),
    });
  }
);

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

// The A1 script's `fmt_ms` thresholds: hours, minutes, seconds, else ms.
const DURATION_UNITS: ReadonlyArray<readonly [number, number, string]> = [
  [3_600_000, 2, "h"],
  [60_000, 1, "m"],
  [1_000, 1, "s"],
];

const formatDurationMs = (millis: number): string =>
  pipe(
    A.findFirst(DURATION_UNITS, ([divisor]) => millis >= divisor),
    O.match({
      onNone: () => `${millis.toFixed(0)}ms`,
      onSome: ([divisor, digits, unit]) => `${(millis / divisor).toFixed(digits)}${unit}`,
    })
  );

const formatOptionalMs: (value: O.Option<number>) => string = O.match({
  onNone: () => "n/a",
  onSome: formatDurationMs,
});

const formatPercent: (value: O.Option<number>) => string = O.match({
  onNone: () => "n/a",
  onSome: (value) => `${value}%`,
});

const formatList = (items: ReadonlyArray<string>, limit = items.length): string =>
  A.match(items, {
    onEmpty: () => "none",
    onNonEmpty: (nonEmpty) =>
      A.join(
        A.appendAll(A.take(nonEmpty, limit), A.length(nonEmpty) > limit ? [`+${A.length(nonEmpty) - limit} more`] : []),
        ", "
      ),
  });

const formatMix = (rows: ReadonlyArray<EconomicsCountRow>, limit = rows.length): string =>
  formatList(
    A.map(rows, (row) => `${row.key} ${row.count}`),
    limit
  );

const laneName = (row: EconomicsLaneRow): string => (row.id === row.label ? row.id : `${row.id} / ${row.label}`);

const renderPopulation = (title: string, population: EconomicsLanePopulation): ReadonlyArray<string> => [
  `${title}: ${population.executions} execution(s), ${formatDurationMs(population.totalDurationMs)} measured, ${formatPercent(population.accountedPct)} of ${formatDurationMs(population.attemptElapsedMs)} attempt time`,
  ...A.map(
    A.take(population.rows, TOP_LANE_ROWS),
    (row) =>
      `  ${laneName(row)} (${row.phase}): ${row.executions} run(s) in ${row.attempts} attempt(s), p50 ${formatOptionalMs(row.p50DurationMs)}, p95 ${formatOptionalMs(row.p95DurationMs)}, total ${formatDurationMs(row.totalDurationMs)}, ${formatPercent(row.sharePct)}`
  ),
  ...(A.length(population.rows) > TOP_LANE_ROWS
    ? [`  +${A.length(population.rows) - TOP_LANE_ROWS} more lane(s)`]
    : []),
];

const renderEpisodes = (title: string, summary: EconomicsEpisodeSummary): string =>
  `${title}: ${summary.closedEpisodes} closed episode(s), p50 ${formatOptionalMs(summary.p50Ms)}, p95 ${formatOptionalMs(summary.p95Ms)}, span ${summary.totalEpisodeSpanMinutes} min, attempt machine ${summary.measuredAttemptMachineMinutes} min${O.getOrElse(
    O.map(summary.closedEpisodesOver24hExcluded, (over) => `, ${over} over 24h excluded`),
    thunkEmptyStr
  )}`;

const totalCount = (rows: ReadonlyArray<EconomicsCountRow>): number => sumOf(rows, (row) => row.count);

const inFlightNote = (excluded: number): string => (excluded > 0 ? ` (${excluded} in flight)` : "");

const scopeLine = (report: YeetEconomicsReport): string =>
  `yeet economics (${report.schemaVersion}) — ${report.scope.kind}${O.getOrElse(
    O.map(report.scope.branch, (branch) => ` ${branch}`),
    thunkEmptyStr
  )}: ${formatList(report.scope.checkouts, 3)}; as of ${report.measurementAsOf}`;

/**
 * Render the economics report for the terminal, one section per metric.
 *
 * **Example** (Render an empty report)
 *
 * ```ts
 * import { buildYeetEconomicsReport, EconomicsScope, renderYeetEconomicsReport } from "@beep/repo-cli/test/Yeet"
 * import { DateTime } from "effect"
 * import * as O from "effect/Option"
 *
 * const text = renderYeetEconomicsReport(
 *   buildYeetEconomicsReport(
 *     [],
 *     EconomicsScope.make({ kind: "checkout", checkouts: [], branch: O.none() }),
 *     DateTime.makeUnsafe("2026-09-25T00:00:00.000Z")
 *   )
 * )
 * console.log(text.startsWith("yeet economics")) // true
 * ```
 *
 * @param report - The folded economics report.
 * @returns The multi-line terminal rendering.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetEconomicsReport = (report: YeetEconomicsReport): string => {
  const {
    attempts,
    firstFailure: failure,
    redToGreen: episodes,
    unchangedFingerprint: fingerprint,
    dataQuality: quality,
  } = report;
  const diagnostics = quality.diagnostics;
  return A.join(
    [
      scopeLine(report),
      `attempts: ${totalCount(attempts.all.outcomeMix)} — ${formatMix(attempts.all.outcomeMix)}; comparable ${totalCount(attempts.comparable.outcomeMix)} — ${formatMix(attempts.comparable.outcomeMix)}`,
      `  modes: ${formatMix(attempts.all.modeMix)}`,
      `  failure kinds: ${formatMix(attempts.all.failureKindMix)}`,
      ...renderPopulation("wrapper lanes", report.wrapperLanes),
      ...renderPopulation("inner lanes", report.innerLanes),
      `first failure (M2): ${failure.redAttempts} red attempt(s), ${failure.attemptsWithReconstructableOuterFailure} reconstructable, ${failure.attemptsWithoutReconstructableOuterFailure} not; start p50 ${formatOptionalMs(failure.startOffsetP50Ms)} p95 ${formatOptionalMs(failure.startOffsetP95Ms)}; completion p50 ${formatOptionalMs(failure.completionOffsetP50Ms)} p95 ${formatOptionalMs(failure.completionOffsetP95Ms)}`,
      `  actionable lanes: ${formatMix(failure.actionableLaneMix, TOP_LANE_ROWS)}`,
      `  receipt proxies: ${formatMix(failure.receiptProxyMix)}`,
      renderEpisodes("red to green (M1) comparable24h", episodes.comparable24h),
      renderEpisodes("red to green (M1) uncut", episodes.uncut),
      `  censoring: left ${episodes.uncut.leftCensoredEpisodesExcluded} episode(s) (${episodes.uncut.leftCensoredObservedAttempts} attempt(s)), right ${episodes.uncut.rightCensoredStreaks} streak(s) (${episodes.uncut.rightCensoredRedAttempts} red attempt(s), observed at least ${episodes.uncut.rightCensoredObservedSpanMinutes} min)`,
      `terminations (M5): ${report.terminations.starts} start(s), ${report.terminations.startsWithoutFinish} without a terminal row; reasons: ${formatMix(report.terminations.reasonMix)}`,
      `unchanged fingerprint (M4 fingerprint-repeat proxy; the ack-resolution join is not on this surface): ${fingerprint.classification}; ${fingerprint.attemptsWithFingerprint} attempt(s) carry a fingerprint; ${fingerprint.failedUnchangedFingerprintThenGreen} verdict red then green on the same fingerprint`,
      `  by actionable lane: ${formatMix(fingerprint.byActionableLane, TOP_LANE_ROWS)}; by receipt proxy: ${formatMix(fingerprint.byReceiptProxy)}`,
      `data quality: window ${O.getOrElse(quality.attemptWindowStartUtc, () => "n/a")} .. ${O.getOrElse(quality.attemptWindowEndUtc, () => "n/a")}; journals ${diagnostics.journalsObserved} read, ${diagnostics.unreadableJournals} unreadable; invalid rows ${diagnostics.invalidRows}; compaction receipts ${diagnostics.compactionReceipts} (${diagnostics.leftCensoredJournals} left-censored journal(s))`,
      `  duplicates ${diagnostics.duplicateStartedRowsDeduplicated} start / ${diagnostics.duplicateFinishedRowsDeduplicated} terminal; orphan verdicts ${diagnostics.orphanVerdictFilesAdded} added, ${diagnostics.unkeyedVerdictFiles} unkeyed; verdicts without start ${diagnostics.verdictsWithoutStart}; verdicts v2 ${diagnostics.verdictV2Attempts}, other ${diagnostics.verdictOtherAttempts}`,
      `  estimator: ${quality.percentileEstimator}, rounding ${quality.rounding}`,
    ],
    "\n"
  );
};

/**
 * Render the closeout summary: at most five lines on where the branch's
 * minutes went.
 *
 * **Details**
 *
 * The lines cover attempts and outcomes, the comparable closed-episode span
 * p50, the first-failure completion offset p50, the top wrapper lane by
 * minutes, and terminations. An empty report still renders every line. The
 * terminations line ends ` (N in flight)` when the caller's own running
 * attempt was dropped from the starts.
 *
 * **Example** (Summarize an empty report)
 *
 * ```ts
 * import {
 *   buildYeetEconomicsReport,
 *   EconomicsScope,
 *   renderYeetEconomicsCloseoutSummary,
 * } from "@beep/repo-cli/test/Yeet"
 * import { DateTime } from "effect"
 * import * as O from "effect/Option"
 *
 * const lines = renderYeetEconomicsCloseoutSummary(
 *   buildYeetEconomicsReport(
 *     [],
 *     EconomicsScope.make({ kind: "branch", checkouts: [], branch: O.some("main") }),
 *     DateTime.makeUnsafe("2026-09-25T00:00:00.000Z")
 *   )
 * )
 * console.log(lines.length <= 5) // true
 * ```
 *
 * @param report - The folded economics report for one branch.
 * @returns Up to five summary lines, each starting with `economics:`.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetEconomicsCloseoutSummary = (report: YeetEconomicsReport): ReadonlyArray<string> => [
  `economics: ${totalCount(report.attempts.all.outcomeMix)} attempt(s) — ${formatMix(report.attempts.all.outcomeMix)}`,
  `economics: red to green p50 ${formatOptionalMs(report.redToGreen.comparable24h.p50Ms)} over ${report.redToGreen.comparable24h.closedEpisodes} closed episode(s) (comparable, <= 24h)`,
  `economics: first failure completes at p50 ${formatOptionalMs(report.firstFailure.completionOffsetP50Ms)} (${report.firstFailure.attemptsWithReconstructableOuterFailure} of ${report.firstFailure.redAttempts} red attempt(s) reconstructable)`,
  O.match(A.head(report.wrapperLanes.rows), {
    onNone: () => "economics: no wrapper lane time measured",
    onSome: (row) =>
      `economics: top wrapper lane ${laneName(row)} ${formatDurationMs(row.totalDurationMs)} (${formatPercent(row.sharePct)} of wrapper time)`,
  }),
  `economics: terminations ${report.terminations.starts} start(s), ${report.terminations.startsWithoutFinish} without a terminal row; reasons ${formatMix(report.terminations.reasonMix)}${inFlightNote(report.dataQuality.diagnostics.inFlightStartsExcluded)}`,
];

// ---------------------------------------------------------------------------
// Runners
// ---------------------------------------------------------------------------

const scopeKind = Match.type<EconomicsScopeRequest>().pipe(
  Match.when({ fleet: true }, () => EconomicsScopeKind.Enum.fleet),
  Match.when({ branch: O.isSome }, () => EconomicsScopeKind.Enum.branch),
  Match.orElse(() => EconomicsScopeKind.Enum.checkout)
);

const scopeFor = (request: EconomicsScopeRequest, journals: ReadonlyArray<EconomicsJournal>): EconomicsScope =>
  EconomicsScope.make({
    kind: scopeKind(request),
    checkouts: A.sort(A.dedupe(A.map(journals, (journal) => journal.checkout)), Order.String),
    branch: request.branch,
  });

const reportFor = Effect.fnUntraced(function* (
  request: EconomicsScopeRequest,
  journals: ReadonlyArray<EconomicsJournal>
) {
  return buildYeetEconomicsReport(journals, scopeFor(request, journals), yield* DateTime.now);
});

const locateRepoRoot: Effect.Effect<string, YeetEconomicsError, FileSystem.FileSystem> = findRepoRoot().pipe(
  Effect.mapError((cause) =>
    YeetEconomicsError.make({ reason: "repo-root", message: "Failed to locate repo root.", cause })
  )
);

const isNoRunsDirectory = (error: YeetEconomicsError): boolean =>
  YeetEconomicsErrorReason.is["no-runs-directory"](error.reason);

/**
 * Run one `yeet economics` pass: read the scope, fold, print text or JSON.
 *
 * **Details**
 *
 * A checkout with no `<packetDir>/runs` prints an empty report rather than
 * failing, as `proof-report` does for an empty ledger. Every other
 * {@link YeetEconomicsError} cause (a failed run-id derivation, no repo root,
 * a failed encoding) fails the run.
 *
 * **Example** (Build the runner effect)
 *
 * ```ts
 * import { runYeetEconomics, YeetEconomicsOptions } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const run = runYeetEconomics(YeetEconomicsOptions.make({ json: false, branch: O.none(), fleet: false }))
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @param options - Parsed `yeet economics` flags.
 * @param repoRoot - Where the checkout root comes from; defaults to the git root of the working directory.
 * @returns Void once the report was printed.
 * @category services
 * @since 0.0.0
 */
export const runYeetEconomics = Effect.fn("Yeet.runEconomics")(function* (
  options: YeetEconomicsOptions,
  repoRoot: Effect.Effect<string, YeetEconomicsError, FileSystem.FileSystem> = locateRepoRoot
): Effect.fn.Return<void, YeetEconomicsError, FileSystem.FileSystem | YeetEconomicsSource> {
  const source = yield* YeetEconomicsSource;
  const request = EconomicsScopeRequest.make({
    repoRoot: yield* repoRoot,
    branch: options.branch,
    fleet: options.fleet,
    packetDir: options.packetDir,
  });
  const journals = yield* source
    .read(request)
    .pipe(Effect.catchIf(isNoRunsDirectory, () => Effect.succeed(A.empty<EconomicsJournal>())));
  const report = yield* reportFor(request, journals);
  if (options.json) {
    const json = yield* YeetEconomicsReportJson.encode(report).pipe(
      Effect.mapError((cause) =>
        YeetEconomicsError.make({ reason: "encode", message: "Failed to encode the economics report.", cause })
      )
    );
    yield* Console.log(json);
    return;
  }
  yield* Console.log(renderYeetEconomicsReport(report));
});

/**
 * The `yeet economics` command handler: decode the parsed flags and run the
 * report from the working directory's checkout over the live source.
 *
 * **Example** (Build the handler effect)
 *
 * ```ts
 * import { runYeetEconomicsCommand } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * console.log(Effect.isEffect(runYeetEconomicsCommand({ json: true, branch: O.none(), fleet: false }))) // true
 * ```
 *
 * @param options - Parsed `yeet economics` flags.
 * @returns Void once the report was printed.
 * @category services
 * @since 0.0.0
 */
export const runYeetEconomicsCommand = (
  options: Parameters<typeof YeetEconomicsOptions.make>[0]
): Effect.Effect<void, YeetEconomicsError, Crypto.Crypto | FileSystem.FileSystem | Path.Path> =>
  runYeetEconomics(YeetEconomicsOptions.make(options)).pipe(
    Effect.provideServiceEffect(YeetEconomicsSource, YeetEconomicsSource.make)
  );

const firstLine = (text: string): string => A.headNonEmpty(Str.split(text, "\n"));

/**
 * Print the closeout economics summary for one branch, never failing.
 *
 * **Details**
 *
 * Every line is prefixed `[yeet] `. The closeout journals its own
 * `attempt-started` row before it runs, so it passes its attempt id as
 * `inFlightAttemptId`: that start is dropped before folding and the
 * terminations line ends ` (1 in flight)`. A source failure or a defect in
 * the fold becomes one `[yeet] economics: <reason>` line, so the closeout that
 * calls this cannot fail because of it.
 *
 * **Example** (Build the summary effect)
 *
 * ```ts
 * import { printYeetEconomicsCloseoutSummary } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const summary = printYeetEconomicsCloseoutSummary("/repo", "main", ".beep/yeet", O.some("attempt-1"))
 * console.log(Effect.isEffect(summary)) // true
 * ```
 *
 * @param repoRoot - The checkout whose journals to read.
 * @param branch - The branch whose run directory to read.
 * @param packetDir - The Yeet packet directory holding `runs`, relative to `repoRoot` unless absolute.
 * @param inFlightAttemptId - The caller's own running attempt, dropped from the starts.
 * @returns Void once the summary or its failure line was printed.
 * @category services
 * @since 0.0.0
 */
export const printYeetEconomicsCloseoutSummary = Effect.fn("Yeet.printEconomicsCloseoutSummary")(function* (
  repoRoot: string,
  branch: string,
  packetDir: string,
  inFlightAttemptId: O.Option<string>
): Effect.fn.Return<void, never, YeetEconomicsSource> {
  const source = yield* YeetEconomicsSource;
  const request = EconomicsScopeRequest.make({
    repoRoot,
    branch: O.some(branch),
    fleet: false,
    packetDir,
    inFlightAttemptId,
  });
  const lines = yield* source.read(request).pipe(
    Effect.flatMap((journals) => reportFor(request, journals)),
    Effect.map(renderYeetEconomicsCloseoutSummary),
    Effect.catchTag("YeetEconomicsError", (error) => Effect.succeed(A.of(`economics: ${error.message}`))),
    Effect.catchDefect((defect) => Effect.succeed(A.of(`economics: ${firstLine(Cause.pretty(Cause.die(defect)))}`)))
  );
  yield* Effect.forEach(lines, (line) => Console.log(`[yeet] ${line}`), { discard: true });
});
