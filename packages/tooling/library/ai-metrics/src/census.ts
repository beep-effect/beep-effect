/**
 * The agent output census: a `Context.Service` that reads local Claude Code and Codex transcripts for one
 * repository and window and folds them into an `agent-output-census/v1` report.
 *
 * **Details**
 *
 * The census enumerates each harness root, streams every selected file line by line, projects each record
 * into measured facts (the only step that sees text), reduces those facts per context, and folds the totals
 * into the report. Memory is bounded by the largest line and the per-context join state; nothing is written.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Line } from "@beep/jsonl/Line";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import {
  CalibrationBinRow,
  CensusCalibration,
  CensusCorpus,
  CensusFilterHabits,
  CensusHeadline,
  CensusLineClasses,
  CensusReport,
  CensusToolOutput,
  CensusTotals,
  CensusTurns,
  CensusWindow,
  ClaudeCorpus,
  ClaudeTotals,
  CodexCorpus,
  CodexTotals,
  DigFollowUp,
  FilterHabitCount,
  FilterHabitRow,
  LineClassChars,
  LineClassKindRow,
  OffenderRow,
  OutputVolume,
  ToolOutputGroup,
  ToolOutputRow,
  TurnClassRow,
  VerificationKindRow,
  VerificationRunSize,
  YeetSubcommandRow,
} from "./census-report.ts";
import {
  CalibrationBin,
  CalibrationBinRules,
  CensusOffender,
  CensusSelectionRules,
  currentCensusRuleVersion,
  FilterHabit,
  LineClass,
  OffenderRules,
  ToolOutputClass,
  TurnClass,
  VerificationKind,
  YeetSubcommand,
} from "./census-rules.ts";
import {
  CensusWindowMillis,
  CodexProjectorOptions,
  makeClaudeProjector,
  makeCodexProjector,
} from "./internal/census-projection.ts";
import { modifiedAtMillis } from "./internal/file-info.ts";
import type { CensusHarness } from "./census-rules.ts";
import type {
  AssistantFacts,
  ClaudeLineFacts,
  ResultFacts,
  TurnToolFacts,
  UsageFacts,
  VerificationFacts,
} from "./internal/census-projection.ts";

const $I = $RepoAiMetricsId.create("census");

/**
 * What to census: the window, both harness roots and the repository name.
 *
 * **Details**
 *
 * Roots are absolute paths; a root that does not exist is reported as absent. The repository name selects
 * Claude project directories by name and Codex sessions by working directory.
 *
 * **Example** (Construct a census request)
 *
 * ```ts
 * import { CensusRequest } from "@beep/repo-ai-metrics/census"
 * import { CensusWindow } from "@beep/repo-ai-metrics/census-report"
 * import * as DateTime from "effect/DateTime"
 * const request = CensusRequest.make({
 *   window: CensusWindow.make({
 *     since: DateTime.makeUnsafe("2026-11-11T11:56:00Z"),
 *     until: DateTime.makeUnsafe("2026-11-18T11:57:45Z"),
 *   }),
 *   claudeRoot: "/home/alice/.claude/projects",
 *   codexRoot: "/home/alice/.codex/sessions",
 *   repository: "beep-effect",
 * })
 * console.log(request.repository) // "beep-effect"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CensusRequest extends S.Opaque<CensusRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    window: CensusWindow,
    claudeRoot: S.NonEmptyString,
    codexRoot: S.NonEmptyString,
    repository: S.NonEmptyString,
  }).pipe($I.annoteSchema("CensusRequest", { description: "Window, harness roots and repository of one census." }))
) {}

/**
 * Why a census could not run. The reason never carries a path.
 *
 * **Example** (Construct an invalid-window refusal)
 *
 * ```ts
 * import { CensusError } from "@beep/repo-ai-metrics/census"
 * console.log(CensusError.make({ reason: "invalid-window" }).message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CensusError extends S.TaggedError<CensusError, { readonly brand: unique symbol }>($I`CensusError`)(
  "CensusError",
  { reason: S.Literals(["invalid-window", "unreadable-root"]) },
  $I.annote("CensusError", { description: "A census refused its window or could not read a harness root." })
) {
  /**
   * A fixed message naming the reason only.
   *
   * @returns The refusal message.
   */
  override get message(): string {
    return this.reason === "invalid-window"
      ? "Census window start is after its end."
      : "Census could not read a harness root that exists, or the root is not a directory.";
  }
}

/**
 * The census contract.
 *
 * **Example** (Type a census implementation)
 *
 * ```ts
 * import type { CensusShape } from "@beep/repo-ai-metrics/census"
 * const describe = (census: CensusShape) => typeof census.report
 * console.log(describe)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface CensusShape {
  /**
   * Census one window: enumerate both roots, stream and project every selected file, and fold the report.
   */
  readonly report: (request: CensusRequest) => Effect.Effect<CensusReport, CensusError>;
}

interface Volume {
  carried: number;
  chars: number;
  filtered: number;
  persisted: number;
  results: number;
}

interface HarnessTotals {
  apiCalls: number;
  cacheCreation: number;
  cacheRead: number;
  input: number;
  output: number;
  toolChars: number;
  verificationChars: number;
}

interface KindSamples {
  chars: number;
  habits: Record<FilterHabit, number>;
  lineClasses: Record<LineClass, number>;
  offenderChars: Record<CensusOffender, number>;
  offenderLines: Record<CensusOffender, number>;
  runs: number;
}

interface TurnBucket {
  chars: number;
  contextTokens: number;
  turns: number;
}

interface FileCounts {
  filesScanned: number;
  oversizedBytes: number;
  oversizedLines: number;
  unreadableFiles: number;
}

const byToolOutputClass = <V>(make: (key: ToolOutputClass) => V): Record<ToolOutputClass, V> =>
  R.fromEntries(A.map(ToolOutputClass.literals, (key) => [key, make(key)]));
const byFilterHabit = <V>(make: (key: FilterHabit) => V): Record<FilterHabit, V> =>
  R.fromEntries(A.map(FilterHabit.literals, (key) => [key, make(key)]));
const byLineClass = <V>(make: (key: LineClass) => V): Record<LineClass, V> =>
  R.fromEntries(A.map(LineClass.literals, (key) => [key, make(key)]));
const byOffender = <V>(make: (key: CensusOffender) => V): Record<CensusOffender, V> =>
  R.fromEntries(A.map(CensusOffender.literals, (key) => [key, make(key)]));
const byVerificationKind = <V>(make: (key: VerificationKind) => V): Record<VerificationKind, V> =>
  R.fromEntries(A.map(VerificationKind.literals, (key) => [key, make(key)]));
const byYeetSubcommand = <V>(make: (key: YeetSubcommand) => V): Record<YeetSubcommand, V> =>
  R.fromEntries(A.map(YeetSubcommand.literals, (key) => [key, make(key)]));
const byTurnClass = <V>(make: (key: TurnClass) => V): Record<TurnClass, V> =>
  R.fromEntries(A.map(TurnClass.literals, (key) => [key, make(key)]));
const byCalibrationBin = <V>(make: (key: CalibrationBin) => V): Record<CalibrationBin, V> =>
  R.fromEntries(A.map(CalibrationBin.literals, (key) => [key, make(key)]));
const zeroVolume = (): Volume => ({ results: 0, chars: 0, carried: 0, filtered: 0, persisted: 0 });
const zeroTotals = (): HarnessTotals => ({
  apiCalls: 0,
  input: 0,
  cacheCreation: 0,
  cacheRead: 0,
  output: 0,
  toolChars: 0,
  verificationChars: 0,
});
const zeroCounts = (): FileCounts => ({ filesScanned: 0, oversizedLines: 0, oversizedBytes: 0, unreadableFiles: 0 });
const zeroSamples = (): KindSamples => ({
  runs: 0,
  chars: 0,
  habits: byFilterHabit(() => 0),
  lineClasses: byLineClass(() => 0),
  offenderLines: byOffender(() => 0),
  offenderChars: byOffender(() => 0),
});

const makeAccumulator = () => ({
  claudeFiles: zeroCounts(),
  codexFiles: zeroCounts(),
  sessions: 0,
  subagents: 0,
  codexSessions: 0,
  boundaries: 0,
  totals: { "claude-session": zeroTotals(), "claude-subagent": zeroTotals(), codex: zeroTotals() } satisfies Record<
    CensusHarness,
    HarnessTotals
  >,
  claudeClasses: byToolOutputClass(zeroVolume),
  codexClasses: byToolOutputClass(zeroVolume),
  yeet: byYeetSubcommand(() => ({ results: 0, chars: 0 })),
  samples: byVerificationKind(zeroSamples),
  turns: {
    turns: 0,
    contextTokens: 0,
    classes: byTurnClass((): TurnBucket => ({ turns: 0, contextTokens: 0, chars: 0 })),
    runs: 0,
    redirected: 0,
    reruns: 0,
    rerunsSame: 0,
    digs: 0,
    ciFetches: 0,
    followUp: { runs: 0, zero: 0, one: 0, two: 0, threeOrMore: 0, max: 0, sum: 0 },
  },
  calibration: {
    n: 0,
    sx: 0,
    sy: 0,
    sxx: 0,
    sxy: 0,
    ratios: byCalibrationBin(() => A.empty<number>()),
  },
});

type Accumulator = ReturnType<typeof makeAccumulator>;

const sumOrKeepLargerForMax = (key: string, current: number, value: number) =>
  key === "max" ? Math.max(current, value) : current + value;

const mergeStagedFileCountsIntoRun = (target: Record<string, unknown>, staged: Record<string, unknown>): void =>
  A.forEach(R.toEntries(staged), ([key, value]) => {
    const current = target[key];
    if (P.isNumber(value) && P.isNumber(current)) target[key] = sumOrKeepLargerForMax(key, current, value);
    else if (A.isArray(value) && A.isArray(current)) current.push(...value);
    else
      O.map(O.all([O.liftPredicate(current, P.isObject), O.liftPredicate(value, P.isObject)]), ([nested, counts]) =>
        mergeStagedFileCountsIntoRun(nested, counts)
      );
  });

const contextTokensOf = (usage: {
  readonly input: number;
  readonly cacheCreation: number;
  readonly cacheRead: number;
}) => usage.input + usage.cacheCreation + usage.cacheRead;

const addSamples = (acc: Accumulator, facts: VerificationFacts) => {
  const samples = acc.samples[facts.kind];
  samples.runs += 1;
  samples.chars += facts.chars;
  A.forEach(facts.habits, (habit) => {
    samples.habits[habit] += 1;
  });
  A.forEach(LineClass.literals, (lineClass) => {
    samples.lineClasses[lineClass] += facts.lineClassChars[lineClass];
  });
  A.forEach(CensusOffender.literals, (offender) => {
    samples.offenderLines[offender] += facts.offenderLines[offender];
    samples.offenderChars[offender] += facts.offenderChars[offender];
  });
};

const addMeasuredResultAsClassVolumeYeetSubcommandAndVerificationSamples = (
  acc: Accumulator,
  harness: CensusHarness,
  result: ResultFacts
) => {
  const classes = harness === "codex" ? acc.codexClasses : acc.claudeClasses;
  const volume = classes[result.toolOutputClass];
  volume.results += 1;
  volume.chars += result.chars;
  volume.filtered += result.filtered ? 1 : 0;
  volume.persisted += result.persisted ? 1 : 0;
  acc.totals[harness].toolChars += result.chars;
  O.map(result.yeetSubcommand, (subcommand) => {
    acc.yeet[subcommand].results += 1;
    acc.yeet[subcommand].chars += result.chars;
  });
  O.map(result.verification, (facts) => {
    acc.totals[harness].verificationChars += result.chars;
    addSamples(acc, facts);
  });
};

const addCalibrationSample = (acc: Accumulator, chars: number, tokens: number) => {
  const calibration = acc.calibration;
  calibration.n += 1;
  calibration.sx += chars;
  calibration.sy += tokens;
  calibration.sxx += chars * chars;
  calibration.sxy += chars * tokens;
  const rule = A.findFirst(
    CalibrationBinRules,
    (entry) =>
      chars >= entry.minimumChars && O.match(entry.maximumChars, { onNone: () => true, onSome: (max) => chars < max })
  );
  O.map(rule, (entry) => calibration.ratios[entry.bin].push(chars / tokens));
};

const addFollowUp = (acc: Accumulator, digs: number) => {
  const followUp = acc.turns.followUp;
  followUp.runs += 1;
  followUp.sum += digs;
  followUp.max = Math.max(followUp.max, digs);
  if (digs === 0) followUp.zero += 1;
  else if (digs === 1) followUp.one += 1;
  else if (digs === 2) followUp.two += 1;
  else followUp.threeOrMore += 1;
};

const turnKindBits = { rerun: 1, run: 2, dig: 4, "ci-log": 8, edit: 16, read: 32, other: 32 } as const;

const turnClassOf = (bits: number, toolCalls: number): TurnClass => {
  const order: ReadonlyArray<readonly [number, TurnClass]> = [
    [turnKindBits.rerun, "rerun-no-edit"],
    [turnKindBits.run, "run-verification"],
    [turnKindBits.dig, "dig-captured-log"],
    [turnKindBits["ci-log"], "fetch-ci-log"],
    [turnKindBits.edit, "edit"],
  ];
  return pipe(
    A.findFirst(order, ([bit]) => (bits & bit) !== 0),
    O.match({
      onNone: (): TurnClass => (toolCalls > 0 ? "other-tool" : "no-tool"),
      onSome: ([, turnClass]) => turnClass,
    })
  );
};

interface Turn {
  bits: number;
  chars: number;
  contextTokens: number;
  readonly inWindow: boolean;
  toolCalls: number;
}

const makeClaudeContext = (acc: Accumulator, harness: CensusHarness) => {
  const usageById = MutableHashMap.empty<string, { readonly usage: UsageFacts; readonly inWindow: boolean }>();
  const turns = MutableHashMap.empty<string, Turn>();
  const counted = MutableHashSet.empty<string>();
  const inWindowCalls = MutableHashSet.empty<string>();
  const pending = byToolOutputClass(() => ({ chars: 0, charsAt: 0 }));
  let calls = 0;
  let lastContext = O.none<number>();
  let lastOutput = 0;
  let between = { count: 0, firstChars: 0 };
  let previousMarker = false;
  let runDigs = O.none<number>();

  const flush = () =>
    A.forEach(ToolOutputClass.literals, (toolOutputClass) => {
      const entry = pending[toolOutputClass];
      acc.claudeClasses[toolOutputClass].carried += entry.chars * calls - entry.charsAt;
      entry.chars = 0;
      entry.charsAt = 0;
    });
  const resetCalibration = () => {
    lastContext = O.none();
    between = { count: 0, firstChars: 0 };
  };
  const pushBetween = (chars: number) => {
    between = { count: between.count + 1, firstChars: between.count === 0 ? chars : between.firstChars };
  };

  const calibrate = (usage: UsageFacts, inWindow: boolean) => {
    const context = contextTokensOf(usage);
    const sample = between.count === 1 && between.firstChars > CensusSelectionRules.calibrationMinimumChars;
    O.map(
      O.filter(lastContext, () => sample && inWindow),
      (previous) => {
        const tokens = context - previous - lastOutput;
        if (tokens > 0) addCalibrationSample(acc, between.firstChars, tokens);
      }
    );
    lastContext = O.some(context);
    between = { count: 0, firstChars: 0 };
  };

  const countApiCall = (assistant: AssistantFacts, inWindow: boolean) => {
    if (MutableHashSet.has(counted, assistant.messageId)) return;
    MutableHashSet.add(counted, assistant.messageId);
    if (inWindow) calls += 1;
  };

  const turnTool = (turn: Turn, tool: TurnToolFacts) => {
    turn.bits |= turnKindBits[tool.kind];
    const counts = acc.turns;
    if (tool.kind === "dig") {
      counts.digs += 1;
      runDigs = O.map(runDigs, (digs) => digs + 1);
    }
    if (tool.kind === "ci-log") counts.ciFetches += 1;
    if (tool.kind !== "run") return;
    counts.runs += 1;
    counts.redirected += tool.redirected ? 1 : 0;
    counts.reruns += tool.rerun ? 1 : 0;
    counts.rerunsSame += tool.rerunSameCommand ? 1 : 0;
    turn.bits |= tool.rerun ? turnKindBits.rerun : 0;
    O.map(runDigs, (digs) => addFollowUp(acc, digs));
    runDigs = O.some(0);
  };

  const trackTurn = (assistant: AssistantFacts) => {
    const turn = O.getOrElse(MutableHashMap.get(turns, assistant.messageId), (): Turn => {
      const created: Turn = { inWindow: assistant.turnInWindow, contextTokens: 0, bits: 0, toolCalls: 0, chars: 0 };
      MutableHashMap.set(turns, assistant.messageId, created);
      return created;
    });
    O.map(assistant.usage, (usage) => {
      turn.contextTokens = contextTokensOf(usage);
    });
    turn.toolCalls += assistant.toolCalls;
    A.forEach(assistant.turnTools, (tool) => turnTool(turn, tool));
  };

  const onAssistant = (assistant: AssistantFacts, inWindow: boolean, beforeEnd: boolean) => {
    countApiCall(assistant, inWindow);
    if (inWindow) MutableHashSet.add(inWindowCalls, assistant.messageId);
    O.map(assistant.usage, (usage) => {
      const firstUsageBearingRecordOfCall = !MutableHashMap.has(usageById, assistant.messageId);
      if (firstUsageBearingRecordOfCall) calibrate(usage, inWindow);
      const kept = O.exists(MutableHashMap.get(usageById, assistant.messageId), (entry) => entry.inWindow) && !inWindow;
      if (!kept) MutableHashMap.set(usageById, assistant.messageId, { usage, inWindow });
      lastOutput = usage.output;
    });
    const recordAfterWindowEndAddsNothingToItsTurn = !beforeEnd;
    if (!recordAfterWindowEndAddsNothingToItsTurn) trackTurn(assistant);
  };

  const onResult = (result: ResultFacts, inWindow: boolean) => {
    pushBetween(result.chars);
    O.map(result.turnMessage, (messageId) =>
      O.map(MutableHashMap.get(turns, messageId), (turn) => {
        turn.chars += result.turnChars;
      })
    );
    if (!inWindow) return;
    addMeasuredResultAsClassVolumeYeetSubcommandAndVerificationSamples(acc, harness, result);
    pending[result.toolOutputClass].chars += result.chars;
    pending[result.toolOutputClass].charsAt += result.chars * calls;
  };

  const onMarker = (facts: ClaudeLineFacts) => {
    const marker = facts.marker !== "none";
    if (marker) {
      flush();
      resetCalibration();
      const countsAsCompaction = facts.marker === "boundary" || !previousMarker;
      if (facts.inWindow && countsAsCompaction) acc.boundaries += 1;
    }
    previousMarker = marker;
  };

  const consume = (facts: ClaudeLineFacts) => {
    onMarker(facts);
    if (facts.marker === "boundary") return;
    O.map(facts.assistant, (assistant) => onAssistant(assistant, facts.inWindow, facts.beforeEnd));
    A.forEach(facts.user, (entry) => (entry._tag === "Text" ? pushBetween(0) : onResult(entry.result, facts.inWindow)));
  };

  const addUsage = () => {
    const totals = acc.totals[harness];
    const inWindowUsageSuppliesTokensOnly = pipe(
      usageById,
      MutableHashMap.values,
      A.fromIterable,
      A.filter((entry) => entry.inWindow)
    );
    const apiCallsAreMessagesWithARecordInWindow = MutableHashSet.size(inWindowCalls);
    totals.apiCalls += apiCallsAreMessagesWithARecordInWindow;
    A.forEach(inWindowUsageSuppliesTokensOnly, ({ usage }) => {
      totals.input += usage.input;
      totals.cacheCreation += usage.cacheCreation;
      totals.cacheRead += usage.cacheRead;
      totals.output += usage.output;
    });
    return MutableHashSet.size(inWindowCalls) > 0;
  };

  const addTurns = () =>
    pipe(
      turns,
      MutableHashMap.values,
      A.fromIterable,
      A.filter((turn) => turn.inWindow),
      A.forEach((turn) => {
        const bucket = acc.turns.classes[turnClassOf(turn.bits, turn.toolCalls)];
        acc.turns.turns += 1;
        acc.turns.contextTokens += turn.contextTokens;
        bucket.turns += 1;
        bucket.contextTokens += turn.contextTokens;
        bucket.chars += turn.chars;
      })
    );

  const finish = () => {
    flush();
    O.map(runDigs, (digs) => addFollowUp(acc, digs));
    const active = addUsage();
    if (active && harness === "claude-subagent") acc.subagents += 1;
    if (active && harness !== "claude-subagent") acc.sessions += 1;
    addTurns();
  };

  return { consume, finish };
};

interface Source {
  readonly harness: CensusHarness;
  readonly path: string;
}

const maxUtf8BytesPerUtf16CodeUnit = 3;

const oversizedBytes = (line: string): number => {
  const bound = CensusSelectionRules.oversizedLineBytes;
  const tooShortToNeedAByteCount = Str.length(line) * maxUtf8BytesPerUtf16CodeUnit <= bound;
  if (tooShortToNeedAByteCount) return 0;
  const bytes = Line.byteLength(line);
  return bytes > bound ? bytes : 0;
};

const countLine = (counts: FileCounts, line: string) => {
  const bytes = oversizedBytes(line);
  if (bytes === 0) return;
  counts.oversizedLines += 1;
  counts.oversizedBytes += bytes;
};

const readLinesWhileConsumeCountingUnreadableNotFatal = Effect.fnUntraced(function* (
  path: string,
  runDiagnosticsOfEveryOpenedFile: FileCounts,
  consume: (line: string) => boolean
) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.stream(path).pipe(
    Stream.decodeText,
    Stream.splitLines,
    Stream.runForEachWhile((line) =>
      Effect.sync(() => {
        countLine(runDiagnosticsOfEveryOpenedFile, line);
        return consume(line);
      })
    ),
    Effect.as(true),
    Effect.catchTag("PlatformError", () =>
      Effect.sync(() => {
        runDiagnosticsOfEveryOpenedFile.unreadableFiles += 1;
        return false;
      })
    )
  );
});

const startsInWindow = (first: O.Option<number>, window: CensusWindowMillis) =>
  O.match(first, { onNone: () => true, onSome: (time) => time <= window.until });

const censusClaudeFile = Effect.fnUntraced(function* (acc: Accumulator, source: Source, window: CensusWindowMillis) {
  const projector = makeClaudeProjector(window);
  const stagedUntilFileReadsAndTouchesWindow = makeAccumulator();
  const context = makeClaudeContext(stagedUntilFileReadsAndTouchesWindow, source.harness);
  const read = yield* readLinesWhileConsumeCountingUnreadableNotFatal(source.path, acc.claudeFiles, (line) => {
    O.map(projector.project(line), context.consume);
    return startsInWindow(projector.firstTime(), window);
  });
  if (!read || !projector.touchedWindow()) return;
  context.finish();
  stagedUntilFileReadsAndTouchesWindow.claudeFiles.filesScanned += 1;
  mergeStagedFileCountsIntoRun(acc, stagedUntilFileReadsAndTouchesWindow);
});

const censusCodexFile = Effect.fnUntraced(function* (
  acc: Accumulator,
  path: string,
  window: CensusWindowMillis,
  repository: string
) {
  const projector = makeCodexProjector(CodexProjectorOptions.make({ window, repository }));
  const staged = makeAccumulator();
  let matched = false;
  let tokens = O.none<{ readonly input: number; readonly cachedInput: number; readonly output: number }>();
  const read = yield* readLinesWhileConsumeCountingUnreadableNotFatal(path, acc.codexFiles, (line) => {
    const facts = projector.project(line);
    if (facts._tag === "Stop") return false;
    if (facts._tag === "Matched") matched = true;
    if (facts._tag === "Tokens") tokens = O.some(facts.tokens);
    if (facts._tag === "Result")
      addMeasuredResultAsClassVolumeYeetSubcommandAndVerificationSamples(staged, "codex", facts.result);
    return startsInWindow(projector.firstTime(), window);
  });
  if (!read || !projector.touchedWindow()) return;
  staged.codexFiles.filesScanned += 1;
  if (matched) {
    staged.codexSessions += 1;
    O.map(tokens, (usage) => {
      staged.totals.codex.input += usage.input;
      staged.totals.codex.cacheRead += usage.cachedInput;
      staged.totals.codex.output += usage.output;
    });
  }
  mergeStagedFileCountsIntoRun(acc, staged);
});

const isTranscript = Str.endsWith(CensusSelectionRules.transcriptExtension);

const modifiedSince = Effect.fnUntraced(function* (path: string, since: number, failures: FileCounts) {
  const fs = yield* FileSystem.FileSystem;
  const info = yield* fs.stat(path).pipe(Effect.option);
  if (O.isNone(info)) failures.unreadableFiles += 1;
  return O.exists(info, (value) => modifiedAtMillis(value) >= since);
});

const listEntries = Effect.fnUntraced(function* (directory: string, failures: FileCounts) {
  const fs = yield* FileSystem.FileSystem;
  const entries = yield* fs.readDirectoryEntries(directory).pipe(
    Effect.catchTag("PlatformError", () =>
      Effect.sync(() => {
        failures.unreadableFiles += 1;
        return A.empty<FileSystem.DirectoryEntry>();
      })
    )
  );
  return A.sort(
    entries,
    Order.mapInput(Order.String, (entry: FileSystem.DirectoryEntry) => entry.name)
  );
});

const walk: (
  directory: string,
  depth: number,
  since: number,
  failures: FileCounts,
  descend: (name: string, depth: number) => boolean
) => Effect.Effect<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> = Effect.fnUntraced(
  function* (directory, depth, since, failures, descend) {
    const path = yield* Path.Path;
    const entries = yield* listEntries(directory, failures);
    const visit = (entry: FileSystem.DirectoryEntry) => {
      const child = path.join(directory, entry.name);
      if (entry.type === "Directory")
        return descend(entry.name, depth)
          ? walk(child, depth + 1, since, failures, descend)
          : Effect.succeed(A.empty<string>());
      if (!isTranscript(entry.name)) return Effect.succeed(A.empty<string>());
      return Effect.map(modifiedSince(child, since, failures), (selected) => (selected ? [child] : A.empty<string>()));
    };
    const found = yield* Effect.forEach(entries, visit, { concurrency: 1 });
    return A.flatten(found);
  }
);

const isSubagent = (relative: ReadonlyArray<string>) =>
  A.some(A.dropRight(relative, 1), (segment) => segment === CensusSelectionRules.subagentDirectory) ||
  O.exists(A.last(relative), Str.startsWith(CensusSelectionRules.subagentFilePrefix));

const onlyAMissingRootIsAbsent = Effect.fnUntraced(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const info = yield* fs.stat(root).pipe(
    Effect.asSome,
    Effect.catchTag("PlatformError", (error) =>
      error.reason._tag === "NotFound"
        ? Effect.succeed(O.none<FileSystem.File.Info>())
        : Effect.fail(CensusError.make({ reason: "unreadable-root" }))
    )
  );
  if (O.isNone(info)) return false;
  if (info.value.type !== "Directory") return yield* CensusError.make({ reason: "unreadable-root" });
  return true;
});

const requireListing = Effect.fnUntraced(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readDirectory(root).pipe(Effect.mapError(() => CensusError.make({ reason: "unreadable-root" })));
});

const claudeSources = Effect.fnUntraced(function* (
  root: string,
  repository: string,
  since: number,
  failures: FileCounts
) {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const listing = yield* fs
    .readDirectoryEntries(root)
    .pipe(Effect.mapError(() => CensusError.make({ reason: "unreadable-root" })));
  const isProjectDirectoryOrLinkNotOrdinaryFile = (entry: FileSystem.DirectoryEntry) => entry.type !== "File";
  const projects = pipe(
    listing,
    A.filter((entry) => isProjectDirectoryOrLinkNotOrdinaryFile(entry) && Str.includes(repository)(entry.name)),
    A.map((entry) => entry.name),
    A.sort(Order.String)
  );
  const descend = (name: string, depth: number) =>
    depth < CensusSelectionRules.claudeWalkDepth && name !== CensusSelectionRules.skippedDirectory;
  const sources: Array<Source> = [];
  for (const project of projects) {
    const directory = path.join(root, project);
    const files = yield* walk(directory, 0, since, failures, descend);
    for (const file of files) {
      const relative = Str.split(path.relative(directory, file), path.sep);
      sources.push({ path: file, harness: isSubagent(relative) ? "claude-subagent" : "claude-session" });
    }
  }
  return sources;
});

const ratio = (numerator: number, denominator: number): O.Option<number> =>
  denominator > 0 && Number.isFinite(numerator / denominator) ? O.some(numerator / denominator) : O.none();

const sumBy = <T>(items: ReadonlyArray<T>, get: (item: T) => number) =>
  A.reduce(items, 0, (total, item) => total + get(item));

const fitCalibration = (acc: Accumulator) => {
  const { n, sx, sy, sxx, sxy } = acc.calibration;
  const slope = n >= 2 ? ratio(n * sxy - sx * sy, n * sxx - sx * sx) : O.none<number>();
  const intercept = O.flatMap(slope, (value) => ratio(sy - value * sx, n));
  const charsPerToken = O.flatMap(
    O.filter(slope, (value) => value > 0),
    (value) => ratio(1, value)
  );
  return { slope, intercept, charsPerToken };
};

const quantile = (sorted: ReadonlyArray<number>, fraction: number) =>
  A.get(sorted, Math.floor(A.length(sorted) * fraction));

const calibrationReport = (acc: Accumulator) => {
  const fit = fitCalibration(acc);
  return CensusCalibration.make({
    samples: acc.calibration.n,
    ...fit,
    bins: A.map(CalibrationBinRules, (rule) => {
      const sorted = A.sort(acc.calibration.ratios[rule.bin], Order.Number);
      return CalibrationBinRow.make({
        bin: rule.bin,
        samples: A.length(sorted),
        median: quantile(sorted, 0.5),
        p25: quantile(sorted, 0.25),
        p75: quantile(sorted, 0.75),
      });
    }),
  });
};

interface Denominators {
  readonly charsPerToken: O.Option<number>;
  readonly claudeContextTokens: number;
  readonly claudeToolChars: number;
  readonly codexToolChars: number;
}

const shareOfContext = (carried: number, denominators: Denominators) =>
  O.flatMap(denominators.charsPerToken, (charsPerToken) =>
    ratio(carried / charsPerToken, denominators.claudeContextTokens)
  );

const volumeOf = (volume: Volume, toolChars: number, context: O.Option<Denominators>) =>
  OutputVolume.make({
    results: volume.results,
    chars: volume.chars,
    carriedCharTurns: volume.carried,
    filteredResults: volume.filtered,
    persistedResults: volume.persisted,
    shareOfToolOutput: ratio(volume.chars, toolChars),
    shareOfContextRead: O.flatMap(context, (denominators) => shareOfContext(volume.carried, denominators)),
  });

const sumVolumes = (volumes: ReadonlyArray<Volume>): Volume => ({
  results: sumBy(volumes, (volume) => volume.results),
  chars: sumBy(volumes, (volume) => volume.chars),
  carried: sumBy(volumes, (volume) => volume.carried),
  filtered: sumBy(volumes, (volume) => volume.filtered),
  persisted: sumBy(volumes, (volume) => volume.persisted),
});

const groupOf = (acc: Accumulator, classes: ReadonlyArray<ToolOutputClass>, denominators: Denominators) =>
  ToolOutputGroup.make({
    claude: volumeOf(
      sumVolumes(A.map(classes, (toolOutputClass) => acc.claudeClasses[toolOutputClass])),
      denominators.claudeToolChars,
      O.some(denominators)
    ),
    codex: volumeOf(
      sumVolumes(A.map(classes, (toolOutputClass) => acc.codexClasses[toolOutputClass])),
      denominators.codexToolChars,
      O.none()
    ),
  });

const toolOutputReport = (acc: Accumulator, denominators: Denominators) =>
  CensusToolOutput.make({
    rows: A.map(ToolOutputClass.literals, (toolOutputClass) =>
      ToolOutputRow.make({
        toolOutputClass,
        claude: volumeOf(acc.claudeClasses[toolOutputClass], denominators.claudeToolChars, O.some(denominators)),
        codex: volumeOf(acc.codexClasses[toolOutputClass], denominators.codexToolChars, O.none()),
      })
    ),
    verification: groupOf(acc, VerificationKind.literals, denominators),
    all: groupOf(acc, ToolOutputClass.literals, denominators),
  });

const verificationByKind = (acc: Accumulator, denominators: Denominators) => {
  const claudeVerification = sumBy(VerificationKind.literals, (kind) => acc.claudeClasses[kind].chars);
  return A.map(VerificationKind.literals, (kind) =>
    VerificationKindRow.make({
      kind,
      claudeChars: acc.claudeClasses[kind].chars,
      claudeShareOfVerification: ratio(acc.claudeClasses[kind].chars, claudeVerification),
      claudeShareOfContextRead: shareOfContext(acc.claudeClasses[kind].carried, denominators),
      codexChars: acc.codexClasses[kind].chars,
    })
  );
};

const habitCounts = (habits: Record<FilterHabit, number>) =>
  A.map(FilterHabit.literals, (habit) => FilterHabitCount.make({ habit, runs: habits[habit] }));

const filterHabitsReport = (acc: Accumulator) => {
  const samples = A.map(VerificationKind.literals, (kind) => acc.samples[kind]);
  return CensusFilterHabits.make({
    rows: A.map(VerificationKind.literals, (kind) =>
      FilterHabitRow.make({ kind, runs: acc.samples[kind].runs, habits: habitCounts(acc.samples[kind].habits) })
    ),
    allRuns: sumBy(samples, (entry) => entry.runs),
    allHabits: habitCounts(byFilterHabit((habit) => sumBy(samples, (entry) => entry.habits[habit]))),
  });
};

const lineClassChars = (classes: Record<LineClass, number>, total: number) =>
  A.map(LineClass.literals, (lineClass) =>
    LineClassChars.make({ lineClass, chars: classes[lineClass], share: ratio(classes[lineClass], total) })
  );

const lineClassesReport = (acc: Accumulator) => {
  const samples = A.map(VerificationKind.literals, (kind) => acc.samples[kind]);
  const totalChars = sumBy(samples, (entry) => entry.chars);
  const all = byLineClass((lineClass) => sumBy(samples, (entry) => entry.lineClasses[lineClass]));
  return CensusLineClasses.make({
    totalChars,
    classes: lineClassChars(all, totalChars),
    byKind: A.map(VerificationKind.literals, (kind) =>
      LineClassKindRow.make({
        kind,
        totalChars: acc.samples[kind].chars,
        classes: lineClassChars(acc.samples[kind].lineClasses, acc.samples[kind].chars),
      })
    ),
    offenders: A.map(OffenderRules, (rule) => {
      const scopeChars = sumBy(rule.scope, (kind) => acc.samples[kind].chars);
      const chars = sumBy(rule.scope, (kind) => acc.samples[kind].offenderChars[rule.offender]);
      return OffenderRow.make({
        offender: rule.offender,
        lines: sumBy(rule.scope, (kind) => acc.samples[kind].offenderLines[rule.offender]),
        chars,
        scopeChars,
        share: ratio(chars, scopeChars),
      });
    }),
  });
};

const turnsReport = (acc: Accumulator) => {
  const turns = acc.turns;
  const followUp = turns.followUp;
  return CensusTurns.make({
    turns: turns.turns,
    contextTokens: turns.contextTokens,
    rows: A.map(TurnClass.literals, (turnClass) => {
      const bucket = turns.classes[turnClass];
      return TurnClassRow.make({
        turnClass,
        turns: bucket.turns,
        shareOfTurns: ratio(bucket.turns, turns.turns),
        contextTokens: bucket.contextTokens,
        shareOfContextRead: ratio(bucket.contextTokens, turns.contextTokens),
        resultChars: bucket.chars,
      });
    }),
    verificationRuns: turns.runs,
    redirectedRuns: turns.redirected,
    rerunsNoEdit: turns.reruns,
    rerunsSameCommand: turns.rerunsSame,
    logDigs: turns.digs,
    ciLogFetches: turns.ciFetches,
    digFollowUp: DigFollowUp.make({
      runs: followUp.runs,
      zero: followUp.zero,
      one: followUp.one,
      two: followUp.two,
      threeOrMore: followUp.threeOrMore,
      max: followUp.max,
      mean: ratio(followUp.sum, followUp.runs),
    }),
  });
};

const headlineReport = (acc: Accumulator) => {
  const samples = A.map(VerificationKind.literals, (kind) => acc.samples[kind]);
  const runs = sumBy(samples, (entry) => entry.runs);
  const classes = acc.turns.classes;
  const followUps =
    classes["run-verification"].turns +
    classes["rerun-no-edit"].turns +
    classes["dig-captured-log"].turns +
    classes["fetch-ci-log"].turns;
  return CensusHeadline.make({
    filteredRunShare: ratio(runs - sumBy(samples, (entry) => entry.habits.unfiltered), runs),
    logDigsPerRun: ratio(acc.turns.followUp.sum, acc.turns.followUp.runs),
    verificationCharsPerRun: A.map(VerificationKind.literals, (kind) =>
      VerificationRunSize.make({
        kind,
        runs: acc.samples[kind].runs,
        chars: acc.samples[kind].chars,
        charsPerRun: ratio(acc.samples[kind].chars, acc.samples[kind].runs),
      })
    ),
    turnsPerVerdict: ratio(followUps, classes["run-verification"].turns),
  });
};

const claudeTotals = (totals: HarnessTotals) =>
  ClaudeTotals.make({
    apiCalls: totals.apiCalls,
    inputTokens: totals.input,
    cacheCreationTokens: totals.cacheCreation,
    cacheReadTokens: totals.cacheRead,
    outputTokens: totals.output,
    contextTokens: totals.input + totals.cacheCreation + totals.cacheRead,
    toolOutputChars: totals.toolChars,
    verificationChars: totals.verificationChars,
  });

interface Presence {
  readonly claude: boolean;
  readonly codex: boolean;
}

const corpusReport = (acc: Accumulator, presence: Presence) =>
  CensusCorpus.make({
    claude: presence.claude
      ? ClaudeCorpus.cases.Present.make({
          ...acc.claudeFiles,
          contextsActive: acc.sessions + acc.subagents,
          sessions: acc.sessions,
          subagents: acc.subagents,
          compactionBoundaries: acc.boundaries,
        })
      : ClaudeCorpus.cases.Absent.make({}),
    codex: presence.codex
      ? CodexCorpus.cases.Present.make({ ...acc.codexFiles, sessions: acc.codexSessions })
      : CodexCorpus.cases.Absent.make({}),
  });

const totalsReport = (acc: Accumulator, presence: Presence) =>
  CensusTotals.make({
    claudeSessions: presence.claude ? O.some(claudeTotals(acc.totals["claude-session"])) : O.none(),
    claudeSubagents: presence.claude ? O.some(claudeTotals(acc.totals["claude-subagent"])) : O.none(),
    codex: presence.codex
      ? CodexTotals.makeOption({
          inputTokens: acc.totals.codex.input,
          cachedInputTokens: acc.totals.codex.cacheRead,
          outputTokens: acc.totals.codex.output,
          toolOutputChars: acc.totals.codex.toolChars,
          verificationChars: acc.totals.codex.verificationChars,
        })
      : O.none(),
  });

const foldReport = (acc: Accumulator, request: CensusRequest, presence: Presence) => {
  const calibration = calibrationReport(acc);
  const sessions = acc.totals["claude-session"];
  const subagents = acc.totals["claude-subagent"];
  const denominators: Denominators = {
    claudeToolChars: sessions.toolChars + subagents.toolChars,
    codexToolChars: acc.totals.codex.toolChars,
    claudeContextTokens: contextTokensOf(sessions) + contextTokensOf(subagents),
    charsPerToken: calibration.charsPerToken,
  };
  return CensusReport.make({
    version: "agent-output-census/v1",
    ruleVersion: currentCensusRuleVersion,
    repository: request.repository === CensusSelectionRules.referenceRepository ? "reference" : "other",
    window: request.window,
    corpus: corpusReport(acc, presence),
    totals: totalsReport(acc, presence),
    toolOutput: toolOutputReport(acc, denominators),
    verificationByKind: verificationByKind(acc, denominators),
    yeetSubcommands: A.map(YeetSubcommand.literals, (subcommand) =>
      YeetSubcommandRow.make({ subcommand, ...acc.yeet[subcommand] })
    ),
    filterHabits: filterHabitsReport(acc),
    turns: turnsReport(acc),
    lineClasses: lineClassesReport(acc),
    calibration,
    headline: headlineReport(acc),
  });
};

const windowMillis = (window: CensusWindow): CensusWindowMillis =>
  CensusWindowMillis.make({
    since: DateTime.toEpochMillis(window.since),
    until: DateTime.toEpochMillis(window.until),
  });

const runCensus = Effect.fn("AiMetrics.census")(function* (request: CensusRequest) {
  const window = windowMillis(request.window);
  if (window.since > window.until) return yield* CensusError.make({ reason: "invalid-window" });
  const acc = makeAccumulator();
  const presence: Presence = {
    claude: yield* onlyAMissingRootIsAbsent(request.claudeRoot),
    codex: yield* onlyAMissingRootIsAbsent(request.codexRoot),
  };
  if (presence.claude) {
    const sources = yield* claudeSources(request.claudeRoot, request.repository, window.since, acc.claudeFiles);
    yield* Effect.forEach(sources, (source) => censusClaudeFile(acc, source, window), {
      concurrency: 1,
      discard: true,
    });
  }
  if (presence.codex) {
    yield* requireListing(request.codexRoot);
    const files = yield* walk(request.codexRoot, 0, window.since, acc.codexFiles, () => true);
    yield* Effect.forEach(files, (file) => censusCodexFile(acc, file, window, request.repository), {
      concurrency: 1,
      discard: true,
    });
  }
  yield* Effect.annotateCurrentSpan({
    "census.claude.files": acc.claudeFiles.filesScanned,
    "census.codex.sessions": acc.codexSessions,
  });
  return foldReport(acc, request, presence);
});

/**
 * Build the census over the platform `FileSystem` and `Path`.
 *
 * **Details**
 *
 * The service captures the services it was built with, so its `report` has no requirements. Use it with
 * `Effect.provideServiceEffect(Census, makeCensus)` inside a command, or through {@link Census.layer}.
 *
 * **Example** (Provide the census to one program)
 *
 * ```ts
 * import { Census, makeCensus } from "@beep/repo-ai-metrics/census"
 * import * as Effect from "effect/Effect"
 * const program = Effect.asVoid(Census.useSync((census) => census.report)).pipe(
 *   Effect.provideServiceEffect(Census, makeCensus)
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeCensus: Effect.Effect<CensusShape, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
  function* () {
    const services = yield* Effect.context<FileSystem.FileSystem | Path.Path>();
    return {
      report: Effect.fn("Census.report")((request: CensusRequest) => runCensus(request).pipe(Effect.provide(services))),
    };
  }
);

/**
 * The agent output census service.
 *
 * **Details**
 *
 * `Census.layer` reads through the platform `FileSystem` and `Path`. Each run is one sequential pass over
 * the selected files with no intermediate files and nothing sent anywhere.
 *
 * **Example** (Census a window)
 *
 * ```ts
 * import { Census, CensusRequest } from "@beep/repo-ai-metrics/census"
 * import { CensusWindow } from "@beep/repo-ai-metrics/census-report"
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 *
 * const program = Census.use((census) =>
 *   census.report(
 *     CensusRequest.make({
 *       window: CensusWindow.make({
 *         since: DateTime.makeUnsafe("2026-11-11T11:56:00Z"),
 *         until: DateTime.makeUnsafe("2026-11-18T11:57:45Z"),
 *       }),
 *       claudeRoot: "/home/alice/.claude/projects",
 *       codexRoot: "/home/alice/.codex/sessions",
 *       repository: "beep-effect",
 *     })
 *   )
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Census extends Context.Service<Census, CensusShape>()($I`Census`) {
  /**
   * The census over the platform filesystem.
   *
   * **Example** (Provide the census layer)
   *
   * ```ts
   * import { Census } from "@beep/repo-ai-metrics/census"
   * console.log(Census.layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<Census, never, FileSystem.FileSystem | Path.Path> = Layer.effect(
    Census,
    Effect.map(makeCensus, (shape) => Census.of(shape))
  );
}
