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
import { dual, identity } from "effect/Function";
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
  YEET_ECONOMICS_PERCENTILE_ESTIMATOR,
  YEET_ECONOMICS_ROUNDING,
  YEET_ECONOMICS_SCHEMA_VERSION,
  YeetEconomicsError,
  YeetEconomicsOptions,
  YeetEconomicsReport,
  YeetEconomicsReportJson,
} from "./Economics.schemas.ts";
import { YeetRunMode } from "./Planner.ts";
import { YeetFailureKind, YeetLaneStatus, YeetOutcome } from "./Verdict.ts";
import type * as Crypto from "effect/Crypto";

const $I = $RepoCliId.create("commands/Yeet/internal/Economics");

const RUNS_PATH = [".beep", "yeet", "runs"] as const;
const JOURNAL_FILE_NAME = "attempts.ndjson";
const VERDICT_FILE_NAME = "verdict.json";
const CHECKOUT_PREFIX = "beep-effect";
const WORKTREES_SUFFIX = "-worktrees";
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

// An unterminated last line that does not decode is an append still in flight,
// not an invalid row.
const decodeJournalText = (text: string): DecodedJournalText => {
  const decoded = A.map(A.filter(Str.split(text, "\n"), flow(Str.trim, Str.isNonEmpty)), (line) =>
    EconomicsJournalRowJson.decodeOption(line)
  );
  const rows = A.getSomes(decoded);
  const tornTail = !Str.endsWith("\n")(text) && O.exists(A.last(decoded), O.isNone);
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
    })
  );
};

const elapsedBetween = (startedAt: O.Option<string>, endedAt: O.Option<string>): O.Option<number> =>
  O.flatMap(O.flatMap(startedAt, parseMillis), (start) => O.map(O.flatMap(endedAt, parseMillis), (end) => end - start));

// Resolution order of the A1 loader: the verdict wins, then the start row; the
// terminal row's facts win over the start row's; a terminated row has no
// verdict, so its outcome is none (red) and it has no lanes.
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
      () => elapsedBetween(startedAt, endedAt)
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

const foldRunJournal = (
  checkout: string,
  runId: string,
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
  const startIds = fold.starts.pipe(HashMap.keys, HashSet.fromIterable);
  const terminalIds = orphan.terminals.pipe(HashMap.keys, HashSet.fromIterable);
  const journalReadable = O.isSome(journalRead.contents);
  const journal = { checkout, runId };
  return EconomicsJournal.make({
    checkout,
    runId,
    cutoff: O.flatMap(fold.cutoffMs, formatMillis),
    attempts: A.map(HashMap.toEntries(orphan.terminals), ([attemptId, terminal]) =>
      attemptFromTerminal(journal, attemptId, terminal, HashMap.get(fold.starts, attemptId))
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
    }),
  });
};

// ---------------------------------------------------------------------------
// Journal source (effectful part)
// ---------------------------------------------------------------------------

interface EconomicsCheckout {
  readonly label: string;
  readonly root: string;
}

const checkoutOrder = Order.mapInput(Order.String, (checkout: EconomicsCheckout) => checkout.label);

// The projects root is the clone's parent: a lane under `<clone>-worktrees/`
// sits one level deeper than a clone.
const projectsRootOf = (path: Path.Path, repoRoot: string): string => {
  const parent = path.dirname(repoRoot);
  return Str.endsWith(WORKTREES_SUFFIX)(path.basename(parent)) ? path.dirname(parent) : parent;
};

const listDirectory = Effect.fnUntraced(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const entries = yield* fs.readDirectory(directory).pipe(Effect.orElseSucceed(A.empty<string>));
  return A.sort(entries, Order.String);
});

const hasRunsDirectory = Effect.fnUntraced(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.exists(path.join(root, ...RUNS_PATH)).pipe(Effect.orElseSucceed(thunkFalse));
});

// `--fleet` candidates (ruling 73): every `beep-effect*` directory under the
// projects root, and every lane inside a `beep-effect*-worktrees` directory.
const fleetCandidates = Effect.fnUntraced(function* (projectsRoot: string) {
  const path = yield* Path.Path;
  const names = A.filter(yield* listDirectory(projectsRoot), Str.startsWith(CHECKOUT_PREFIX));
  const nested = yield* Effect.forEach(names, (name) => {
    const directory = path.join(projectsRoot, name);
    return Str.endsWith(WORKTREES_SUFFIX)(name)
      ? Effect.map(
          listDirectory(directory),
          A.map((lane) => path.join(directory, lane))
        )
      : Effect.succeed(A.of(directory));
  });
  return A.flatten(nested);
});

const resolveCheckouts = Effect.fnUntraced(function* (request: EconomicsScopeRequest) {
  const path = yield* Path.Path;
  const repoRoot = path.resolve(request.repoRoot);
  const projectsRoot = projectsRootOf(path, repoRoot);
  const candidates = request.fleet ? A.dedupe(A.prepend(yield* fleetCandidates(projectsRoot), repoRoot)) : [repoRoot];
  const roots = yield* Effect.filter(candidates, hasRunsDirectory);
  if (!request.fleet && A.isReadonlyArrayEmpty(roots)) {
    return yield* YeetEconomicsError.make({ message: `no ${A.join(RUNS_PATH, "/")} under ${repoRoot}` });
  }
  return A.sort(
    A.map(roots, (root) => ({ label: path.relative(projectsRoot, root), root })),
    checkoutOrder
  );
});

// A symlinked or otherwise unreadable entry reads as present without contents,
// so it counts as unreadable rather than failing the report.
const readRunFile = (
  checkoutRoot: string,
  target: string
): Effect.Effect<ContainedFileRead, never, FileSystem.FileSystem | Path.Path> =>
  readContainedFileStringNoFollow(checkoutRoot, target).pipe(
    Effect.orElseSucceed(() => ContainedFileRead.make({ exists: true, contents: O.none() }))
  );

const readRunJournal = Effect.fnUntraced(function* (checkout: EconomicsCheckout, runId: string) {
  const path = yield* Path.Path;
  const runDirectory = path.join(checkout.root, ...RUNS_PATH, runId);
  const journalRead = yield* readRunFile(checkout.root, path.join(runDirectory, JOURNAL_FILE_NAME));
  const verdictRead = yield* readRunFile(checkout.root, path.join(runDirectory, VERDICT_FILE_NAME));
  return journalRead.exists || verdictRead.exists
    ? O.some(foldRunJournal(checkout.label, runId, journalRead, verdictRead))
    : O.none<EconomicsJournal>();
});

const readCheckoutJournals = Effect.fnUntraced(function* (checkout: EconomicsCheckout, runId: O.Option<string>) {
  const path = yield* Path.Path;
  const runIds = yield* O.match(runId, {
    onNone: () => listDirectory(path.join(checkout.root, ...RUNS_PATH)),
    onSome: (id) => Effect.succeed(A.of(id)),
  });
  return A.getSomes(yield* Effect.forEach(runIds, (id) => readRunJournal(checkout, id)));
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
    Effect.mapError((cause) => YeetEconomicsError.make({ message: "Failed to derive the branch run id.", cause }))
  );
  const nested = yield* Effect.forEach(checkouts, (checkout) => readCheckoutJournals(checkout, runId), {
    concurrency: FLEET_READ_CONCURRENCY,
  });
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
 * The default scope is every `.beep/yeet/runs/<runId>/attempts.ndjson` of the
 * checkout plus orphan `verdict.json` files; a branch narrows to that branch's
 * run directory, and the fleet adds every sibling `beep-effect*` checkout and
 * `beep-effect*-worktrees/*` lane under the projects root, each labelled by
 * its path relative to that root. A bad journal never fails the read: an
 * unreadable file and a malformed line are counted. `read` fails only when a
 * non-fleet scope has no `.beep/yeet/runs`.
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
  const elapsedMs = sumOf(attempts, (attempt) => O.getOrElse(attempt.elapsedMs, thunk0));
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

// Ruling 74: walk the inner lanes when any failed, otherwise the wrappers; the
// first failed lane with a duration ends the walk.
const failureOffsets = (attempt: EconomicsAttempt): O.Option<FailureOffsets> => {
  const inner = A.filter(attempt.lanes, isInnerLane);
  const population = A.some(inner, isFailedLane) ? inner : A.filter(attempt.lanes, P.not(isInnerLane));
  const [before, rest] = A.span(population, P.not(isTimedFailure));
  const startOffsetMs = Num.sumAll(
    A.filter(A.getSomes(A.map(before, (lane) => lane.durationMs)), Num.isGreaterThanOrEqualTo(0))
  );
  return pipe(
    A.head(rest),
    O.flatMap((lane) => lane.durationMs),
    O.map((durationMs) => ({ startOffsetMs, completionOffsetMs: startOffsetMs + durationMs }))
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
const machineMillis = (members: ReadonlyArray<TimedAttempt>): number =>
  sumOf(members, (timed) => O.getOrElse(timed.attempt.elapsedMs, thunk0));

interface JournalEpisodes {
  readonly closed: ReadonlyArray<Episode>;
  readonly openStreak: O.Option<number>;
}

// Ruling 75: a red attempt joins the streak, a green one closes it; a green with
// no streak closes nothing. Episodes never span two runs.
const journalEpisodes = (journal: EconomicsJournal): JournalEpisodes => {
  const cutoffMs = O.flatMap(journal.cutoff, parseMillis);
  const rows = A.filter(timedAttempts(journal), (timed) => O.isSome(timed.startedMs) && isComparable(timed.attempt));
  const walk = A.reduce(
    rows,
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
    openStreak: A.isReadonlyArrayNonEmpty(walk.streak) ? O.some(A.length(walk.streak)) : O.none(),
  };
};

const episodeSummary = (
  label: string,
  kept: ReadonlyArray<Episode>,
  leftCensored: ReadonlyArray<Episode>,
  openStreaks: ReadonlyArray<number>,
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
    rightCensoredRedAttempts: Num.sumAll(openStreaks),
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

// M4 (ruling 75): within one run, a red attempt whose next attempt is green on
// the same diff fingerprint.
const unchangedFingerprint = (
  journals: ReadonlyArray<EconomicsJournal>,
  attempts: ReadonlyArray<EconomicsAttempt>
): EconomicsUnchangedFingerprint => {
  const attemptsWithFingerprint = A.length(A.filter(attempts, (attempt) => O.isSome(attempt.diffFingerprint)));
  const thenGreen = sumOf(journals, (journal) => {
    const ordered = A.map(timedAttempts(journal), (timed) => timed.attempt);
    return A.length(
      A.filter(
        A.zip(ordered, A.drop(ordered, 1)),
        ([current, next]) => isRed(current) && isGreen(next) && sameFingerprint(current, next)
      )
    );
  });
  return EconomicsUnchangedFingerprint.make({
    classification: attemptsWithFingerprint > 0 ? "measured" : "unmeasurable",
    attemptsWithFingerprint,
    failedUnchangedFingerprintThenGreen: thenGreen,
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
 * @category rendering
 * @since 0.0.0
 */
export const renderYeetEconomicsReport = (report: YeetEconomicsReport): string => {
  const { attempts, firstFailure: failure, redToGreen: episodes, dataQuality: quality } = report;
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
      `  censoring: left ${episodes.uncut.leftCensoredEpisodesExcluded} episode(s) (${episodes.uncut.leftCensoredObservedAttempts} attempt(s)), right ${episodes.uncut.rightCensoredStreaks} streak(s) (${episodes.uncut.rightCensoredRedAttempts} red attempt(s))`,
      `terminations (M5): ${report.terminations.starts} start(s), ${report.terminations.startsWithoutFinish} without a terminal row; reasons: ${formatMix(report.terminations.reasonMix)}`,
      `unchanged fingerprint (M4): ${report.unchangedFingerprint.classification}; ${report.unchangedFingerprint.attemptsWithFingerprint} attempt(s) carry a fingerprint; ${report.unchangedFingerprint.failedUnchangedFingerprintThenGreen} red then green on the same fingerprint`,
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
 * minutes, and terminations. An empty report still renders every line.
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
 * @category rendering
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
  `economics: terminations ${report.terminations.starts} start(s), ${report.terminations.startsWithoutFinish} without a terminal row; reasons ${formatMix(report.terminations.reasonMix)}`,
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
  Effect.mapError((cause) => YeetEconomicsError.make({ message: "Failed to locate repo root.", cause }))
);

/**
 * Run one `yeet economics` pass: read the scope, fold, print text or JSON.
 *
 * **Details**
 *
 * A checkout with no `.beep/yeet/runs` prints an empty report rather than
 * failing, as `proof-report` does for an empty ledger.
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
  });
  const journals = yield* source
    .read(request)
    .pipe(Effect.catchTag("YeetEconomicsError", () => Effect.succeed(A.empty<EconomicsJournal>())));
  const report = yield* reportFor(request, journals);
  if (options.json) {
    const json = yield* YeetEconomicsReportJson.encode(report).pipe(
      Effect.mapError((cause) => YeetEconomicsError.make({ message: "Failed to encode the economics report.", cause }))
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
 * Every line is prefixed `[yeet] `. A source failure or a defect in the fold
 * becomes one `[yeet] economics: <reason>` line, so the closeout that calls
 * this cannot fail because of it.
 *
 * **Example** (Build the summary effect)
 *
 * ```ts
 * import { printYeetEconomicsCloseoutSummary } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(printYeetEconomicsCloseoutSummary("/repo", "main"))) // true
 * ```
 *
 * @param repoRoot - The checkout whose journals to read.
 * @param branch - The branch whose run directory to read.
 * @returns Void once the summary or its failure line was printed.
 * @category services
 * @since 0.0.0
 */
export const printYeetEconomicsCloseoutSummary = Effect.fn("Yeet.printEconomicsCloseoutSummary")(function* (
  repoRoot: string,
  branch: string
): Effect.fn.Return<void, never, YeetEconomicsSource> {
  const source = yield* YeetEconomicsSource;
  const request = EconomicsScopeRequest.make({ repoRoot, branch: O.some(branch), fleet: false });
  const lines = yield* source.read(request).pipe(
    Effect.flatMap((journals) => reportFor(request, journals)),
    Effect.map(renderYeetEconomicsCloseoutSummary),
    Effect.catchTag("YeetEconomicsError", (error) => Effect.succeed(A.of(`economics: ${error.message}`))),
    Effect.catchDefect((defect) => Effect.succeed(A.of(`economics: ${firstLine(Cause.pretty(Cause.die(defect)))}`)))
  );
  yield* Effect.forEach(lines, (line) => Console.log(`[yeet] ${line}`), { discard: true });
});
