/**
 * In-memory projection of transcript records into measured, classified census facts.
 *
 * **Details**
 *
 * This module is the only place the census holds transcript text. Each projector reads one context's
 * records in order, joins tool results to their calls, classifies command text with the `census-rules`
 * domains, measures result text, and returns counts, sizes and literal classes. Text and command strings
 * stay in the projector's per-context state (call joins, captured-log names, the no-edit re-run window, the
 * gate-table rows seen) and are dropped with the projector at the end of the file.
 *
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { thunkEmptyStr } from "@beep/utils";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  AnsiSequencePattern,
  CensusOffender,
  CensusSelectionRules,
  EditToolName,
  FilteredCommandPattern,
  FilterHabit,
  FilterHabitPipePatterns,
  LineClass,
  LineClassRules,
  LineMatch,
  OffenderMatch,
  OffenderRules,
  RedirectTargetPattern,
  ShellClassRules,
  ToolOutputClass,
  TurboTaskPrefixPattern,
  TurnCommandPatterns,
  VerificationKind,
  YeetSubcommand,
  YeetSubcommandPattern,
} from "../census-rules.ts";
import { parseSourceEventTime } from "./source-event-time.ts";
import type { LineClassRule, OffenderRule, ShellClass } from "../census-rules.ts";

const $I = $RepoAiMetricsId.create("internal/census-projection");

/**
 * @category models
 * @since 0.0.0
 */
export class CensusWindowMillis extends S.Opaque<CensusWindowMillis, { readonly brand: unique symbol }>()(
  S.Struct({ since: S.Finite, until: S.Finite }).pipe(
    $I.annoteSchema("CensusWindowMillis", { description: "Inclusive record-time bounds in epoch milliseconds." })
  )
) {}

const timeOf = (value: unknown): O.Option<number> =>
  pipe(
    O.liftPredicate(value, P.isString),
    O.flatMap(parseSourceEventTime),
    O.map((time) => time.seconds * 1000 + Math.floor(time.nanoseconds / 1_000_000))
  );

const leadingUntimestampedRecordCountsInsideWindow = { inWindow: true, beforeEnd: true };

const makeClockWhereUntimestampedRecordTakesPreviousRecordTime = (window: CensusWindowMillis) => {
  let previousRecordTimeInFile = O.none<number>();
  let first = O.none<number>();
  let ownTimestampFellInsideWindow = false;
  const within = (time: number) => time >= window.since && time <= window.until;
  const observe = (timestamp: unknown) => {
    const own = timeOf(timestamp);
    previousRecordTimeInFile = O.orElse(own, () => previousRecordTimeInFile);
    first = O.orElse(first, () => own);
    ownTimestampFellInsideWindow = ownTimestampFellInsideWindow || O.exists(own, within);
    return O.match(previousRecordTimeInFile, {
      onNone: () => leadingUntimestampedRecordCountsInsideWindow,
      onSome: (time) => ({ inWindow: within(time), beforeEnd: time <= window.until }),
    });
  };
  return { observe, firstTime: () => first, touchedWindow: () => ownTimestampFellInsideWindow };
};

const classifyShellCommand = (command: string): ShellClass =>
  pipe(
    ShellClassRules,
    A.findFirst((rule) => rule.pattern.test(command)),
    O.match({ onNone: (): ShellClass => "other-shell", onSome: (rule) => rule.shellClass })
  );

const isVerificationKind = S.is(VerificationKind);
const isYeetSubcommand = S.is(YeetSubcommand);
const isEditToolName = S.is(EditToolName);

const yeetSubcommandOf = (command: string): YeetSubcommand =>
  pipe(
    command,
    Str.match(YeetSubcommandPattern),
    O.flatMap(A.get(1)),
    O.map(Str.replace(/\s+/g, "-")),
    O.match({
      onNone: (): YeetSubcommand => "none",
      onSome: (word) => (isYeetSubcommand(word) ? word : "other"),
    })
  );

const baseName = (path: string): string => pipe(Str.split(path, "/"), A.lastNonEmpty);

const redirectTargets = (command: string): ReadonlyArray<string> =>
  pipe(
    A.fromIterable(Str.matchAll(RedirectTargetPattern)(command)),
    A.flatMap((found) => A.fromOption(A.get(found, 1))),
    A.map(baseName),
    A.filter((name) => Str.length(name) > 3)
  );

const coreCommand = (command: string): string =>
  pipe(
    command,
    Str.replace(TurnCommandPatterns.corePrefix, ""),
    Str.replace(TurnCommandPatterns.coreSuffix, ""),
    Str.replace(/\s+/g, " "),
    Str.trim
  );

/**
 * @category models
 * @since 0.0.0
 */
export class CallFacts extends S.Opaque<CallFacts, { readonly brand: unique symbol }>()(
  S.Struct({
    asksForHelp: S.Boolean,
    filtered: S.Boolean,
    habits: S.Array(FilterHabit),
    toolOutputClass: ToolOutputClass,
    yeetSubcommand: S.Option(YeetSubcommand),
  }).pipe($I.annoteSchema("CallFacts", { description: "Classified facts about one tool call; no command text." }))
) {}

const habitsOf = (command: string, filtered: boolean): ReadonlyArray<FilterHabit> =>
  A.getSomes([
    FilterHabitPipePatterns.tail.test(command) ? O.some<FilterHabit>("tail") : O.none<FilterHabit>(),
    FilterHabitPipePatterns.head.test(command) ? O.some<FilterHabit>("head") : O.none<FilterHabit>(),
    FilterHabitPipePatterns.grep.test(command) ? O.some<FilterHabit>("grep") : O.none<FilterHabit>(),
    filtered ? O.none<FilterHabit>() : O.some<FilterHabit>("unfiltered"),
    A.isReadonlyArrayNonEmpty(redirectTargets(command)) ? O.some<FilterHabit>("redirect") : O.none<FilterHabit>(),
  ]);

const callFacts = (toolOutputClass: ToolOutputClass, command: string, filterable: boolean): CallFacts => {
  const filtered = filterable && FilteredCommandPattern.test(command);
  return CallFacts.make({
    toolOutputClass,
    filtered,
    habits: isVerificationKind(toolOutputClass) ? habitsOf(command, filtered) : [],
    yeetSubcommand: toolOutputClass === "yeet" ? O.some(yeetSubcommandOf(command)) : O.none(),
    asksForHelp: TurnCommandPatterns.help.test(command),
  });
};

const unmatchedCall = CallFacts.make({
  toolOutputClass: "unmatched-result",
  filtered: false,
  habits: [],
  yeetSubcommand: O.none(),
  asksForHelp: false,
});

const textOfBlock = (block: unknown): string => {
  if (P.isString(block)) return block;
  if (!P.isObject(block)) return "";
  const text = P.hasProperty(block, "text") ? block.text : undefined;
  if (P.hasProperty(block, "type") && block.type === "image") return "";
  return P.isString(text) ? text : "";
};

const textOf = (content: unknown): string => {
  if (P.isString(content)) return content;
  if (A.isArray(content)) return A.join(A.map(content, textOfBlock), "\n");
  return P.isObject(content) && P.hasProperty(content, "text") && P.isString(content.text) ? content.text : "";
};

const turnCharsOf = (content: unknown): number => {
  if (P.isString(content)) return Str.length(content);
  if (!A.isArray(content)) return 0;
  return A.reduce(content, 0, (total, block) =>
    P.isObject(block) && P.hasProperty(block, "text") && P.isString(block.text) ? total + Str.length(block.text) : total
  );
};

const isPersistedOutput = (text: string) =>
  CensusSelectionRules.persistedOutputPattern.test(Str.slice(0, CensusSelectionRules.persistedOutputProbeChars)(text));

/**
 * @category models
 * @since 0.0.0
 */
export class VerificationFacts extends S.Opaque<VerificationFacts, { readonly brand: unique symbol }>()(
  S.Struct({
    chars: S.Finite,
    habits: S.Array(FilterHabit),
    kind: VerificationKind,
    lineClassChars: S.Record(LineClass, S.Finite),
    offenderChars: S.Record(CensusOffender, S.Finite),
    offenderLines: S.Record(CensusOffender, S.Finite),
  }).pipe(
    $I.annoteSchema("VerificationFacts", {
      description: "Measured line classes, offenders and filter habits of one verification result.",
    })
  )
) {}

const zeroLineClasses = (): Record<LineClass, number> => R.fromEntries(A.map(LineClass.literals, (key) => [key, 0]));
const zeroOffenders = (): Record<CensusOffender, number> =>
  R.fromEntries(A.map(CensusOffender.literals, (key) => [key, 0]));

const lineRuleMatches = (rule: LineClassRule, line: string, seen: MutableHashSet.MutableHashSet<string>): boolean =>
  LineMatch.match(rule.match, {
    Pattern: ({ pattern }) => pattern.test(line),
    Empty: () => Str.isEmpty(line),
    RepeatInOutput: () => MutableHashSet.has(seen, line),
  });

const lineClassOf = (line: string, seen: MutableHashSet.MutableHashSet<string>): LineClass =>
  pipe(
    LineClassRules,
    A.findFirst((rule) => lineRuleMatches(rule, line, seen)),
    O.map((rule) => rule.lineClass),
    O.getOrElse((): LineClass => "other")
  );

const ansiChars = (text: string): number =>
  A.reduce(A.fromIterable(Str.matchAll(AnsiSequencePattern)(text)), 0, (total, found) => total + Str.length(found[0]));

const repeatOfRowClaimedEarlierInContext = (
  pattern: RegExp,
  line: string,
  rowsClaimedForRestOfContext: MutableHashSet.MutableHashSet<string>
): boolean => {
  if (!pattern.test(line)) return false;
  const repeat = MutableHashSet.has(rowsClaimedForRestOfContext, line);
  MutableHashSet.add(rowsClaimedForRestOfContext, line);
  return repeat;
};

interface OffenderState {
  readonly gateRows: MutableHashSet.MutableHashSet<string>;
  inHelpSection: boolean;
}

const inHelpSection = (header: RegExp, line: string, state: OffenderState, asksForHelp: boolean): boolean => {
  if (!asksForHelp) return false;
  if (header.test(line)) state.inHelpSection = true;
  else if (Str.isEmpty(line)) state.inHelpSection = false;
  return state.inHelpSection;
};

const offenderMatches = (rule: OffenderRule, line: string, state: OffenderState, asksForHelp: boolean): boolean =>
  OffenderMatch.match(rule.match, {
    Pattern: ({ pattern }) => pattern.test(line),
    RepeatInContext: ({ pattern }) => repeatOfRowClaimedEarlierInContext(pattern, line, state.gateRows),
    HelpSection: ({ header }) => inHelpSection(header, line, state, asksForHelp),
  });

const stripTurboPrefix = (line: string): readonly [string, number] =>
  pipe(
    line,
    Str.match(TurboTaskPrefixPattern),
    O.match({
      onNone: (): readonly [string, number] => [line, 0],
      onSome: (found): readonly [string, number] => [Str.slice(Str.length(found[0]))(line), Str.length(found[0])],
    })
  );

const measureLines = (text: string, kind: VerificationKind, call: CallFacts, gateRows: OffenderState["gateRows"]) => {
  const lineClassChars = zeroLineClasses();
  const offenderLines = zeroOffenders();
  const offenderChars = zeroOffenders();
  const seen = MutableHashSet.empty<string>();
  const state: OffenderState = { gateRows, inHelpSection: false };
  const scoped = A.filter(OffenderRules, (rule) => A.contains(rule.scope, kind));
  lineClassChars.ansi += ansiChars(text);
  for (const raw of Str.split(text, "\n")) {
    const size = Str.length(raw) + 1;
    const [rest, prefix] = stripTurboPrefix(Str.replace(AnsiSequencePattern, "")(raw));
    lineClassChars["turbo-prefix"] += prefix;
    const line = Str.trim(rest);
    lineClassChars[lineClassOf(line, seen)] += size;
    MutableHashSet.add(seen, line);
    for (const rule of scoped) {
      if (!offenderMatches(rule, line, state, call.asksForHelp)) continue;
      offenderLines[rule.offender] += 1;
      offenderChars[rule.offender] += size;
    }
  }
  return { lineClassChars, offenderLines, offenderChars };
};

const verificationFacts = (
  text: string,
  call: CallFacts,
  gateRows: OffenderState["gateRows"]
): O.Option<VerificationFacts> =>
  pipe(
    O.liftPredicate(call.toolOutputClass, isVerificationKind),
    O.map((kind) =>
      VerificationFacts.make({
        kind,
        chars: Str.length(text),
        habits: call.habits,
        ...measureLines(text, kind, call, gateRows),
      })
    )
  );

/**
 * @category models
 * @since 0.0.0
 */
export class ResultFacts extends S.Opaque<ResultFacts, { readonly brand: unique symbol }>()(
  S.Struct({
    chars: S.Finite,
    filtered: S.Boolean,
    persisted: S.Boolean,
    toolOutputClass: ToolOutputClass,
    turnChars: S.Finite,
    turnMessage: S.Option(S.String),
    verification: S.Option(VerificationFacts),
    yeetSubcommand: S.Option(YeetSubcommand),
  }).pipe(
    $I.annoteSchema("ResultFacts", { description: "Measured facts about one tool result: sizes and classes, no text." })
  )
) {}

const resultFacts = (
  text: string,
  turnChars: number,
  call: CallFacts,
  turnMessage: O.Option<string>,
  measured: O.Option<OffenderState["gateRows"]>
): ResultFacts =>
  ResultFacts.make({
    toolOutputClass: call.toolOutputClass,
    chars: Str.length(text),
    turnChars,
    filtered: call.filtered,
    persisted: isPersistedOutput(text),
    yeetSubcommand: call.yeetSubcommand,
    verification: O.flatMap(measured, (gateRows) => verificationFacts(text, call, gateRows)),
    turnMessage,
  });

/**
 * @category models
 * @since 0.0.0
 */
export class TurnToolFacts extends S.Opaque<TurnToolFacts, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.Literals(["edit", "read", "dig", "other", "run", "ci-log"]),
    redirected: S.Boolean,
    rerun: S.Boolean,
    rerunSameCommand: S.Boolean,
  }).pipe($I.annoteSchema("TurnToolFacts", { description: "What one tool call did in its turn." }))
) {}

const turnTool = (kind: TurnToolFacts["kind"]): TurnToolFacts =>
  TurnToolFacts.make({
    kind,
    redirected: false,
    rerun: false,
    rerunSameCommand: false,
  });

const makeTurnState = () => {
  const logNames = MutableHashSet.empty<string>();
  const sinceEdit = MutableHashMap.empty<string, string>();
  const remember = (command: string) =>
    A.forEach(redirectTargets(command), (name) => MutableHashSet.add(logNames, name));
  const namesLog = (test: (name: string) => boolean) => A.some(A.fromIterable(logNames), test);
  const run = (command: string): TurnToolFacts => {
    const redirected = A.isReadonlyArrayNonEmpty(redirectTargets(command));
    remember(command);
    const core = coreCommand(command);
    const prior = MutableHashMap.get(sinceEdit, core);
    MutableHashMap.set(sinceEdit, core, command);
    if (TurnCommandPatterns.mutation.test(command)) MutableHashMap.clear(sinceEdit);
    return TurnToolFacts.make({
      kind: "run",
      redirected,
      rerun: O.isSome(prior),
      rerunSameCommand: O.exists(prior, (previous) => previous === command),
    });
  };
  const otherShell = (command: string): TurnToolFacts => {
    if (TurnCommandPatterns.ciLog.test(command)) {
      remember(command);
      return turnTool("ci-log");
    }
    if (namesLog((name) => Str.includes(name)(command))) return turnTool("dig");
    if (!TurnCommandPatterns.mutation.test(command)) return turnTool("other");
    MutableHashMap.clear(sinceEdit);
    return turnTool("edit");
  };
  const shell = (command: string): TurnToolFacts =>
    TurnCommandPatterns.run.test(command) && !TurnCommandPatterns.help.test(command)
      ? run(command)
      : otherShell(command);
  const read = (path: string): TurnToolFacts =>
    TurnCommandPatterns.persistedOutput.test(path) || namesLog((name) => Str.endsWith(name)(path))
      ? turnTool("dig")
      : turnTool("read");
  const decide = (name: string, command: string): TurnToolFacts => {
    if (isEditToolName(name)) {
      MutableHashMap.clear(sinceEdit);
      return turnTool("edit");
    }
    if (name === "Read") return read(command);
    return name === "Bash" ? shell(command) : turnTool("other");
  };
  return { decide };
};

const UsageCount = S.optionalKey(S.Unknown);
const ClaudeUsage = S.Struct({
  input_tokens: UsageCount,
  output_tokens: UsageCount,
  cache_creation_input_tokens: UsageCount,
  cache_read_input_tokens: UsageCount,
});
const ClaudeMessage = S.Struct({
  id: S.optionalKey(S.Unknown),
  usage: S.optionalKey(S.Unknown),
  content: S.optionalKey(S.Unknown),
});
const ClaudeRecord = S.Struct({
  type: S.optionalKey(S.Unknown),
  subtype: S.optionalKey(S.Unknown),
  isCompactSummary: S.optionalKey(S.Unknown),
  timestamp: S.optionalKey(S.Unknown),
  uuid: S.optionalKey(S.Unknown),
  message: S.optionalKey(S.Unknown),
});
const ToolInput = S.Struct({ command: S.optionalKey(S.Unknown), file_path: S.optionalKey(S.Unknown) });
const ClaudeBlock = S.Union([
  S.Struct({
    type: S.tag("tool_use"),
    id: S.optionalKey(S.Unknown),
    name: S.String,
    input: S.optionalKey(S.Unknown),
  }),
  S.Struct({
    type: S.tag("tool_result"),
    tool_use_id: S.optionalKey(S.Unknown),
    content: S.optionalKey(S.Unknown),
  }),
  S.Struct({ type: S.tag("text") }),
]);
const decodeClaudeRecord = S.decodeUnknownOption(S.fromJsonString(ClaudeRecord));
const decodeClaudeMessage = S.decodeUnknownOption(ClaudeMessage);
const decodeClaudeUsage = S.decodeUnknownOption(ClaudeUsage);
const decodeClaudeBlock = S.decodeUnknownOption(ClaudeBlock);
const decodeToolInput = S.decodeUnknownOption(ToolInput);

const stringOf = (value: unknown): string => (P.isString(value) ? value : "");
const countOf = (value: unknown): number => (P.isNumber(value) && Number.isFinite(value) && value > 0 ? value : 0);

/**
 * @category models
 * @since 0.0.0
 */
export class UsageFacts extends S.Opaque<UsageFacts, { readonly brand: unique symbol }>()(
  S.Struct({
    cacheCreation: S.Finite,
    cacheRead: S.Finite,
    input: S.Finite,
    output: S.Finite,
  }).pipe($I.annoteSchema("UsageFacts", { description: "Token usage of one Claude API call." }))
) {}

const usageOf = (value: unknown): O.Option<UsageFacts> =>
  pipe(
    O.liftPredicate(value, P.isTruthy),
    O.flatMap(decodeClaudeUsage),
    O.map((usage) =>
      UsageFacts.make({
        input: countOf(usage.input_tokens),
        cacheCreation: countOf(usage.cache_creation_input_tokens),
        cacheRead: countOf(usage.cache_read_input_tokens),
        output: countOf(usage.output_tokens),
      })
    )
  );

/**
 * @category models
 * @since 0.0.0
 */
export class AssistantFacts extends S.Opaque<AssistantFacts, { readonly brand: unique symbol }>()(
  S.Struct({
    messageId: S.String,
    toolCalls: S.Finite,
    turnInWindow: S.Boolean,
    turnTools: S.Array(TurnToolFacts),
    usage: S.Option(UsageFacts),
  }).pipe(
    $I.annoteSchema("AssistantFacts", { description: "One Claude API call record: its message, usage and turn facts." })
  )
) {}

/**
 * @category models
 * @since 0.0.0
 */
export const UserEntry = S.Union([S.TaggedStruct("Text", {}), S.TaggedStruct("Result", { result: ResultFacts })]).pipe(
  $I.annoteSchema("UserEntry", { description: "One entry of a Claude user record: a text block or a tool result." })
);

/**
 * @category models
 * @since 0.0.0
 */
export type UserEntry = typeof UserEntry.Type;

/**
 * **Details**
 *
 * `marker` is `boundary` for a compaction boundary record (which contributes nothing else) and
 * `compact-summary` for a compacted summary, which resets the context and is then read as usual.
 *
 * @category models
 * @since 0.0.0
 */
export class ClaudeLineFacts extends S.Opaque<ClaudeLineFacts, { readonly brand: unique symbol }>()(
  S.Struct({
    assistant: S.Option(AssistantFacts),
    beforeEnd: S.Boolean,
    inWindow: S.Boolean,
    marker: S.Literals(["boundary", "compact-summary", "none"]),
    user: S.Array(UserEntry),
  }).pipe($I.annoteSchema("ClaudeLineFacts", { description: "The facts one Claude record contributes." }))
) {}

interface ClaudeCall {
  readonly facts: CallFacts;
  readonly turnMessage: O.Option<string>;
}

const claudeCallFacts = (name: string, input: O.Option<typeof ToolInput.Type>): readonly [CallFacts, string] => {
  if (name === "Bash") {
    const command = input.pipe(
      O.map((value) => value.command),
      O.getOrUndefined,
      stringOf
    );
    return [callFacts(classifyShellCommand(command), command, true), command];
  }
  if (name === "Read") {
    const path = input.pipe(
      O.map((value) => value.file_path),
      O.getOrUndefined,
      stringOf
    );
    const persisted = TurnCommandPatterns.persistedOutput.test(path);
    return [callFacts(persisted ? "persisted-reread" : "read-tool", path, false), path];
  }
  return [callFacts("other-tool", "", false), ""];
};

const contributes = (facts: TurnToolFacts) => facts.kind === "run" || facts.kind === "ci-log" || facts.kind === "dig";

/**
 * Make the projector for one Claude context (one transcript file).
 *
 * @param window - the census window in epoch milliseconds
 * @returns `project` for each line in file order, and the file's first record time
 * @category constructors
 * @since 0.0.0
 */
export const makeClaudeProjector = (window: CensusWindowMillis) => {
  const clock = makeClockWhereUntimestampedRecordTakesPreviousRecordTime(window);
  const calls = MutableHashMap.empty<string, ClaudeCall>();
  const turnWindow = MutableHashMap.empty<string, boolean>();
  const gateRows = MutableHashSet.empty<string>();
  const turns = makeTurnState();

  const toolUse = (
    block: { readonly id?: unknown; readonly name: string; readonly input?: unknown },
    messageId: string,
    inWindow: boolean
  ) => {
    const [facts, command] = claudeCallFacts(block.name, decodeToolInput(block.input));
    const turn = inWindow ? O.some(turns.decide(block.name, command)) : O.none<TurnToolFacts>();
    const turnMessage = O.filter(turn, contributes).pipe(O.as(messageId));
    MutableHashMap.set(calls, stringOf(block.id), { facts, turnMessage });
    return turn;
  };

  const assistant = (message: typeof ClaudeMessage.Type, uuid: unknown, inWindow: boolean): AssistantFacts => {
    const messageId = P.isString(message.id) ? message.id : stringOf(uuid);
    const turnInWindowAsItsFirstRecordWas = O.getOrElse(MutableHashMap.get(turnWindow, messageId), () => {
      MutableHashMap.set(turnWindow, messageId, inWindow);
      return inWindow;
    });
    const blocks = A.isArray(message.content)
      ? A.flatMap(message.content, (block) => A.fromOption(decodeClaudeBlock(block)))
      : [];
    const uses = A.flatMap(blocks, (block) => (block.type === "tool_use" ? [block] : []));
    const turnTools = A.flatMap(uses, (block) =>
      A.fromOption(toolUse(block, messageId, turnInWindowAsItsFirstRecordWas))
    );
    return AssistantFacts.make({
      messageId,
      usage: usageOf(message.usage),
      turnInWindow: turnInWindowAsItsFirstRecordWas,
      toolCalls: A.length(uses),
      turnTools,
    });
  };

  const result = (block: { readonly tool_use_id?: unknown; readonly content?: unknown }, inWindow: boolean) => {
    const call = O.getOrElse(MutableHashMap.get(calls, stringOf(block.tool_use_id)), () => ({
      facts: unmatchedCall,
      turnMessage: O.none<string>(),
    }));
    const measured = inWindow ? O.some(gateRows) : O.none<typeof gateRows>();
    return resultFacts(textOf(block.content), turnCharsOf(block.content), call.facts, call.turnMessage, measured);
  };

  const user = (message: typeof ClaudeMessage.Type, inWindow: boolean): ReadonlyArray<UserEntry> =>
    P.isString(message.content)
      ? [{ _tag: "Text" }]
      : A.isArray(message.content)
        ? A.flatMap(message.content, (raw) =>
            pipe(
              decodeClaudeBlock(raw),
              O.flatMap((block): O.Option<UserEntry> => {
                if (block.type === "text") return O.some({ _tag: "Text" });
                if (block.type === "tool_result") return O.some({ _tag: "Result", result: result(block, inWindow) });
                return O.none();
              }),
              A.fromOption
            )
          )
        : [];

  const markerOf = (record: typeof ClaudeRecord.Type): ClaudeLineFacts["marker"] => {
    const summary = P.isTruthy(record.isCompactSummary);
    if (record.type === "system" && (record.subtype === "compact_boundary" || summary)) return "boundary";
    return summary ? "compact-summary" : "none";
  };

  const facts = (record: typeof ClaudeRecord.Type): ClaudeLineFacts => {
    const { inWindow, beforeEnd } = clock.observe(record.timestamp);
    const marker = markerOf(record);
    const base = { inWindow, beforeEnd, marker, assistant: O.none<AssistantFacts>(), user: A.empty<UserEntry>() };
    const message =
      marker === "boundary" || !P.isTruthy(record.message) ? O.none() : decodeClaudeMessage(record.message);
    if (O.isNone(message)) return ClaudeLineFacts.make(base);
    if (record.type === "assistant")
      return ClaudeLineFacts.make({ ...base, assistant: O.some(assistant(message.value, record.uuid, inWindow)) });
    return ClaudeLineFacts.make(record.type === "user" ? { ...base, user: user(message.value, inWindow) } : base);
  };

  return {
    project: (line: string): O.Option<ClaudeLineFacts> => O.map(decodeClaudeRecord(line), facts),
    firstTime: clock.firstTime,
    touchedWindow: clock.touchedWindow,
  };
};

const CodexRecord = S.Struct({
  type: S.optionalKey(S.Unknown),
  timestamp: S.optionalKey(S.Unknown),
  payload: S.optionalKey(S.Unknown),
});
const CodexMeta = S.Struct({ cwd: S.optionalKey(S.Unknown), runtime_workspace_roots: S.optionalKey(S.Unknown) });
const CodexPayload = S.Struct({
  type: S.optionalKey(S.Unknown),
  name: S.optionalKey(S.Unknown),
  namespace: S.optionalKey(S.Unknown),
  call_id: S.optionalKey(S.Unknown),
  arguments: S.optionalKey(S.Unknown),
  input: S.optionalKey(S.Unknown),
  action: S.optionalKey(S.Unknown),
  output: S.optionalKey(S.Unknown),
  info: S.optionalKey(S.Unknown),
});
const CodexTokenInfo = S.Struct({ total_token_usage: S.optionalKey(S.Unknown) });
const CodexTokenUsage = S.Struct({
  input_tokens: UsageCount,
  cached_input_tokens: UsageCount,
  output_tokens: UsageCount,
});
const decodeCodexRecord = S.decodeUnknownOption(S.fromJsonString(CodexRecord));
const decodeCodexMeta = S.decodeUnknownOption(CodexMeta);
const decodeCodexPayload = S.decodeUnknownOption(CodexPayload);
const decodeCodexTokenInfo = S.decodeUnknownOption(CodexTokenInfo);
const decodeCodexTokenUsage = S.decodeUnknownOption(CodexTokenUsage);
const decodeJson = S.decodeUnknownOption(S.fromJsonString(S.Unknown));
const encodeJson = S.encodeUnknownOption(S.fromJsonString(S.Unknown));

const reencodeDecodedJsonThatCannotFail = (value: unknown): string => O.getOrElse(encodeJson(value), thunkEmptyStr);

/**
 * @category models
 * @since 0.0.0
 */
export class CodexTokenFacts extends S.Opaque<CodexTokenFacts, { readonly brand: unique symbol }>()(
  S.Struct({ cachedInput: S.Finite, input: S.Finite, output: S.Finite }).pipe(
    $I.annoteSchema("CodexTokenFacts", { description: "Cumulative token usage of one Codex session." })
  )
) {}

/**
 * The facts one Codex record contributes, or the end of a file that does not belong to the repository.
 *
 * @category models
 * @since 0.0.0
 */
export type CodexLineFacts =
  | { readonly _tag: "Skip" }
  | { readonly _tag: "Stop" }
  | { readonly _tag: "Matched" }
  | { readonly _tag: "Tokens"; readonly tokens: CodexTokenFacts }
  | { readonly _tag: "Result"; readonly result: ResultFacts };

const skip: CodexLineFacts = { _tag: "Skip" };
const stop: CodexLineFacts = { _tag: "Stop" };

const metaMatches = (payload: unknown, repository: string): boolean =>
  pipe(
    decodeCodexMeta(payload),
    O.exists((meta) => {
      const cwd = Str.includes(repository);
      const roots = A.isArray(meta.runtime_workspace_roots) ? meta.runtime_workspace_roots : [];
      return cwd(stringOf(meta.cwd)) || A.some(roots, (root) => cwd(stringOf(root)));
    })
  );

const arrayStringCoercionSeparator = ",";

const commandText = (value: unknown): string => {
  if (P.isString(value)) return value;
  if (P.isNumber(value)) return `${value}`;
  return A.isArray(value) ? A.join(A.map(value, commandText), arrayStringCoercionSeparator) : "";
};

const functionCommand = (argumentsValue: unknown): string => {
  if (!P.isString(argumentsValue))
    return argumentsValue === undefined ? "" : reencodeDecodedJsonThatCannotFail(argumentsValue);
  return pipe(
    decodeJson(argumentsValue),
    O.match({
      onNone: () => argumentsValue,
      onSome: (parsed) => {
        const fields = P.isObject(parsed) ? parsed : {};
        const value =
          P.hasProperty(fields, "cmd") && P.isNotNullish(fields.cmd)
            ? fields.cmd
            : P.hasProperty(fields, "command")
              ? fields.command
              : undefined;
        const command = commandText(value);
        return Str.isEmpty(command) ? argumentsValue : command;
      },
    })
  );
};

const codexCallCommand = (payload: typeof CodexPayload.Type): string =>
  payload.type === "function_call"
    ? functionCommand(payload.arguments)
    : P.isNotNullish(payload.input)
      ? commandText(payload.input)
      : reencodeDecodedJsonThatCannotFail(payload.action ?? "");

const codexOutputText = (output: unknown): string => {
  if (P.isString(output)) return output;
  const content =
    P.isObject(output) && P.hasProperty(output, "content") && P.isNotNullish(output.content) ? output.content : output;
  const text = textOf(content);
  return Str.isEmpty(text) ? reencodeDecodedJsonThatCannotFail(output ?? "") : text;
};

const isCodexCall = (type: unknown) =>
  type === "function_call" || type === "custom_tool_call" || type === "local_shell_call";
const isCodexOutput = (type: unknown) => type === "function_call_output" || type === "custom_tool_call_output";

const tokenFacts = (info: unknown): O.Option<CodexTokenFacts> =>
  pipe(
    decodeCodexTokenInfo(info),
    O.flatMap((value) => O.liftPredicate(value.total_token_usage, P.isTruthy)),
    O.flatMap(decodeCodexTokenUsage),
    O.map((usage) =>
      CodexTokenFacts.make({
        input: countOf(usage.input_tokens),
        cachedInput: countOf(usage.cached_input_tokens),
        output: countOf(usage.output_tokens),
      })
    )
  );

/**
 * @category models
 * @since 0.0.0
 */
export class CodexProjectorOptions extends S.Opaque<CodexProjectorOptions, { readonly brand: unique symbol }>()(
  S.Struct({ repository: S.String, window: CensusWindowMillis }).pipe(
    $I.annoteSchema("CodexProjectorOptions", { description: "Inputs of a Codex projector." })
  )
) {}

/**
 * Make the projector for one Codex session file.
 *
 * @param options - the census window in epoch milliseconds, and the repository name a session's working
 *   directory must contain
 * @returns `project` for each line in file order, and the file's first record time
 * @category constructors
 * @since 0.0.0
 */
export const makeCodexProjector = ({ window, repository }: CodexProjectorOptions) => {
  const clock = makeClockWhereUntimestampedRecordTakesPreviousRecordTime(window);
  const calls = MutableHashMap.empty<string, CallFacts>();
  const gateRows = MutableHashSet.empty<string>();
  let phase: "prelude" | "matched" = "prelude";
  let prelude = 0;

  const preludeRecord = (record: typeof CodexRecord.Type): CodexLineFacts => {
    if (record.type === "session_meta") {
      if (!metaMatches(record.payload, repository)) return stop;
      phase = "matched";
      return { _tag: "Matched" };
    }
    prelude += 1;
    return prelude > CensusSelectionRules.codexPreludeRecordLimit ? stop : skip;
  };

  const call = (payload: typeof CodexPayload.Type) => {
    const command = codexCallCommand(payload);
    const shell =
      payload.type !== "function_call" || CensusSelectionRules.codexShellToolPattern.test(stringOf(payload.name));
    MutableHashMap.set(
      calls,
      stringOf(payload.call_id),
      callFacts(shell ? classifyShellCommand(command) : "other-tool", command, true)
    );
    return skip;
  };

  const output = (payload: typeof CodexPayload.Type, inWindow: boolean): CodexLineFacts => {
    if (!inWindow) return skip;
    const facts = O.getOrElse(MutableHashMap.get(calls, stringOf(payload.call_id)), () => unmatchedCall);
    const text = codexOutputText(payload.output);
    return { _tag: "Result", result: resultFacts(text, Str.length(text), facts, O.none(), O.some(gateRows)) };
  };

  const matchedRecord = (record: typeof CodexRecord.Type, inWindow: boolean, beforeEnd: boolean): CodexLineFacts => {
    const payload = O.getOrUndefined(decodeCodexPayload(record.payload ?? {}));
    if (payload === undefined) return skip;
    if (record.type === "event_msg" && payload.type === "token_count")
      return pipe(
        O.filter(tokenFacts(payload.info), () => beforeEnd),
        O.match({ onNone: () => skip, onSome: (tokens): CodexLineFacts => ({ _tag: "Tokens", tokens }) })
      );
    if (record.type !== "response_item") return skip;
    if (isCodexCall(payload.type)) return call(payload);
    return isCodexOutput(payload.type) ? output(payload, inWindow) : skip;
  };

  return {
    project: (line: string): CodexLineFacts =>
      pipe(
        decodeCodexRecord(line),
        O.match({
          onNone: () => skip,
          onSome: (record) => {
            const { inWindow, beforeEnd } = clock.observe(record.timestamp);
            return phase === "prelude" ? preludeRecord(record) : matchedRecord(record, inWindow, beforeEnd);
          },
        })
      ),
    firstTime: clock.firstTime,
    touchedWindow: clock.touchedWindow,
  };
};
