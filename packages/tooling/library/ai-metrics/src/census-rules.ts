/**
 * The closed class domains of the agent output census and each member's matching rule, kept as data.
 *
 * **Details**
 *
 * The rules started as the ones that produced the 2026-11-18 transcript audit; rule version
 * `census-rules/2026-11-23` adds `beep ci failures` to the `ci-logs` class. Each report carries the
 * {@link CensusRuleVersion} it ran under. Shell commands land in the first {@link ShellClassRules} entry whose pattern
 * matches, then `other-shell`; output lines land in the first {@link LineClassRules} entry that matches.
 * Changing any rule here changes what the census measures and needs a new rule version.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $RepoAiMetricsId.create("census-rules");

/**
 * Version of the census rule set: the classes, the patterns and the selection rules together.
 *
 * **Example** (Read the current rule version)
 *
 * ```ts
 * import { CensusRuleVersion } from "@beep/repo-ai-metrics/census-rules"
 * console.log(CensusRuleVersion.literals) // ["census-rules/2026-11-18", "census-rules/2026-11-23"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CensusRuleVersion = LiteralKit(["census-rules/2026-11-18", "census-rules/2026-11-23"]).pipe(
  $I.annoteSchema("CensusRuleVersion", {
    description: "Version of the census class domains, matching rules and corpus selection rules.",
  })
);

/**
 * **Example** (Type a rule version)
 *
 * ```ts
 * import type { CensusRuleVersion } from "@beep/repo-ai-metrics/census-rules"
 * const version: CensusRuleVersion = "census-rules/2026-11-23"
 * console.log(version)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CensusRuleVersion = typeof CensusRuleVersion.Type;

/**
 * The rule version this build of the census applies.
 *
 * **Example** (Stamp a report with the rule version)
 *
 * ```ts
 * import { currentCensusRuleVersion } from "@beep/repo-ai-metrics/census-rules"
 * console.log(currentCensusRuleVersion) // "census-rules/2026-11-23"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const currentCensusRuleVersion: CensusRuleVersion = "census-rules/2026-11-23";

/**
 * The transcript populations the census reports separately.
 *
 * **Example** (List the harness populations)
 *
 * ```ts
 * import { CensusHarness } from "@beep/repo-ai-metrics/census-rules"
 * console.log(CensusHarness.literals) // ["claude-session", "claude-subagent", "codex"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CensusHarness = LiteralKit(["claude-session", "claude-subagent", "codex"]).pipe(
  $I.annoteSchema("CensusHarness", {
    description: "Claude Code main sessions, Claude Code subagent contexts, and Codex sessions.",
  })
);

/**
 * **Example** (Type a harness population)
 *
 * ```ts
 * import type { CensusHarness } from "@beep/repo-ai-metrics/census-rules"
 * const harness: CensusHarness = "codex"
 * console.log(harness)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CensusHarness = typeof CensusHarness.Type;

/**
 * **Example** (Check a shell class)
 *
 * ```ts
 * import { ShellClass } from "@beep/repo-ai-metrics/census-rules"
 * console.log(ShellClass.is.yeet("yeet")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ShellClass = LiteralKit([
  "ci-logs",
  "yeet",
  "ci-status",
  "quality",
  "test",
  "check",
  "lint",
  "docgen",
  "build",
  "turbo",
  "install",
  "beep-other",
  "gh",
  "git",
  "search-read",
  "other-shell",
]).pipe(
  $I.annoteSchema("ShellClass", {
    description: "First-match classes of a shell command's text, with other-shell as the remainder.",
  })
);

/**
 * **Example** (Type a shell class)
 *
 * ```ts
 * import type { ShellClass } from "@beep/repo-ai-metrics/census-rules"
 * const shellClass: ShellClass = "search-read"
 * console.log(shellClass)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ShellClass = typeof ShellClass.Type;

/**
 * Where a tool result's characters are attributed: a shell class or a non-shell member.
 *
 * **Details**
 *
 * `read-tool` is the Read tool on any path but persisted output, `persisted-reread` is the Read tool on
 * a harness-persisted tool result, `other-tool` is every other named or MCP tool, and `unmatched-result`
 * is a result whose call is not in the same context.
 *
 * **Example** (List the non-shell members)
 *
 * ```ts
 * import { ToolOutputClass } from "@beep/repo-ai-metrics/census-rules"
 * console.log(ToolOutputClass.literals.slice(-4))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ToolOutputClass = LiteralKit([
  ...ShellClass.literals,
  "read-tool",
  "persisted-reread",
  "other-tool",
  "unmatched-result",
]).pipe(
  $I.annoteSchema("ToolOutputClass", {
    description: "Shell classes plus the Read tool, persisted-output re-reads, other tools and unmatched results.",
  })
);

/**
 * **Example** (Type a tool-output class)
 *
 * ```ts
 * import type { ToolOutputClass } from "@beep/repo-ai-metrics/census-rules"
 * const toolOutputClass: ToolOutputClass = "read-tool"
 * console.log(toolOutputClass)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ToolOutputClass = typeof ToolOutputClass.Type;

/**
 * **Example** (Check a verification kind)
 *
 * ```ts
 * import { VerificationKind } from "@beep/repo-ai-metrics/census-rules"
 * console.log(VerificationKind.is.test("test")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VerificationKind = LiteralKit([
  "yeet",
  "test",
  "check",
  "lint",
  "quality",
  "ci-logs",
  "turbo",
  "ci-status",
  "install",
  "docgen",
  "build",
]).pipe(
  $I.annoteSchema("VerificationKind", {
    description: "Shell classes whose output is a verification verdict: gates, tests, checks, lints and CI.",
  })
);

/**
 * **Example** (Type a verification kind)
 *
 * ```ts
 * import type { VerificationKind } from "@beep/repo-ai-metrics/census-rules"
 * const kind: VerificationKind = "check"
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VerificationKind = typeof VerificationKind.Type;

/**
 * A shell class and the pattern that claims a command for it.
 *
 * **Example** (Read the first shell rule)
 *
 * ```ts
 * import { ShellClassRules } from "@beep/repo-ai-metrics/census-rules"
 * console.log(ShellClassRules[0]?.shellClass) // "ci-logs"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShellClassRule extends S.Opaque<ShellClassRule, { readonly brand: unique symbol }>()(
  S.Struct({ shellClass: ShellClass, pattern: S.RegExp }).pipe(
    $I.annoteSchema("ShellClassRule", { description: "One first-match shell class rule." })
  )
) {}

const shellRule = ([shellClass, pattern]: readonly [ShellClass, RegExp]) =>
  ShellClassRule.make({ shellClass, pattern });

/**
 * The shell class rules in first-match order. A command no rule claims is `other-shell`.
 *
 * **Example** (Find the rule for Yeet)
 *
 * ```ts
 * import { ShellClassRules } from "@beep/repo-ai-metrics/census-rules"
 * console.log(ShellClassRules.find((rule) => rule.shellClass === "yeet")?.pattern.test("bun run beep yeet open"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ShellClassRules: ReadonlyArray<ShellClassRule> = A.map(
  [
    [
      "ci-logs",
      /gh run view[^|;&]*--log|actions\/(jobs|runs)\/\d+\/(attempts\/\d+\/)?logs|\/logs\b.*gh api|gh api[^|;&]*\/logs|yeet gh[^|;&]*log|job-logs|run-logs|beep(\.ts)? ci failures\b/,
    ],
    [
      "yeet",
      /beep(\.ts)? yeet\b|\byeet (repair|final-check|publish|open|verify|ready|monitor|job|sweep|reply|merge-gate|gate-table|cheap-gates|inbox)/,
    ],
    [
      "ci-status",
      /gh pr checks|gh run (list|view|watch)|gh api[^|;&]*(check-runs|check-suites|actions\/runs|commits\/[^/ ]+\/status)|gh pr view[^|;&]*statusCheckRollup/,
    ],
    ["quality", /beep(\.ts)? quality\b/],
    [
      "test",
      /\bvitest\b|\bbun (run )?test\b|bun run [\w:-]*test|turbo (run )?[^|;&]*\btest\b|beep(\.ts)? test\b|playwright test/,
    ],
    ["check", /\btsc\b|\btsgo\b|\btsrs\b|bun run [\w:-]*check\b|turbo (run )?[^|;&]*\bcheck\b|typecheck/],
    [
      "lint",
      /\bbiome\b|\boxlint\b|\beslint\b|beep(\.ts)? lint\b|bun run [\w:-]*lint|turbo (run )?[^|;&]*\blint\b|\bfallow\b|commitlint|syncpack/,
    ],
    ["docgen", /docgen/],
    ["build", /turbo (run )?[^|;&]*\bbuild\b|bun run [\w:-]*build\b|\bvite build\b|next build/],
    ["turbo", /\bturbo\b/],
    ["install", /\bbun (install|i|add|remove|update)\b|pnpm (install|i|add)\b|npm (install|ci)\b/],
    ["beep-other", /bun run beep\b|beep\.ts\b/],
    ["gh", /\bgh\b/],
    ["git", /\bgit\b/],
    ["search-read", /\b(rg|grep|ugrep|cat|sed|awk|head|tail|ls|find|fd|wc|jq|tree|stat)\b/],
  ] as const,
  shellRule
);

/**
 * Yeet sub-commands the census breaks Yeet output down by.
 *
 * **Details**
 *
 * The sub-command is the first word after `yeet` (with `job wait` kept together). A word outside this
 * domain is `other`, and a command with no word after `yeet` is `none`.
 *
 * **Example** (Check a Yeet sub-command)
 *
 * ```ts
 * import { YeetSubcommand } from "@beep/repo-ai-metrics/census-rules"
 * console.log(YeetSubcommand.is["final-check"]("final-check")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetSubcommand = LiteralKit([
  "repair",
  "final-check",
  "publish",
  "open",
  "verify",
  "ready",
  "monitor",
  "job",
  "job-wait",
  "sweep",
  "reply",
  "merge-gate",
  "gate-table",
  "cheap-gates",
  "inbox",
  "gh",
  "status",
  "economics",
  "other",
  "none",
]).pipe(
  $I.annoteSchema("YeetSubcommand", {
    description: "The Yeet sub-command a Yeet-class command ran, other for an unlisted word, none for no word.",
  })
);

/**
 * **Example** (Type a Yeet sub-command)
 *
 * ```ts
 * import type { YeetSubcommand } from "@beep/repo-ai-metrics/census-rules"
 * const subcommand: YeetSubcommand = "monitor"
 * console.log(subcommand)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type YeetSubcommand = typeof YeetSubcommand.Type;

/**
 * Captures the Yeet sub-command word, with an optional trailing `wait`.
 *
 * **Example** (Capture a Yeet sub-command)
 *
 * ```ts
 * import { YeetSubcommandPattern } from "@beep/repo-ai-metrics/census-rules"
 * console.log(YeetSubcommandPattern.exec("bun run beep yeet job wait 7")?.[1]) // "job wait"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YeetSubcommandPattern = /yeet\s+([a-z-]+(?:\s+wait)?)/;

/**
 * How an agent cut a verification run's output down before it reached context.
 *
 * **Details**
 *
 * A run can carry several habits: `tail`, `head` and `grep` are pipes into that filter, `redirect` is a
 * redirect or `tee` into a log file, and `unfiltered` is a run with none of the {@link FilteredCommandPattern}
 * filters.
 *
 * **Example** (List the filter habits)
 *
 * ```ts
 * import { FilterHabit } from "@beep/repo-ai-metrics/census-rules"
 * console.log(FilterHabit.literals) // ["tail", "head", "grep", "unfiltered", "redirect"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FilterHabit = LiteralKit(["tail", "head", "grep", "unfiltered", "redirect"]).pipe(
  $I.annoteSchema("FilterHabit", {
    description: "Pipes, redirects and their absence on a verification command.",
  })
);

/**
 * **Example** (Type a filter habit)
 *
 * ```ts
 * import type { FilterHabit } from "@beep/repo-ai-metrics/census-rules"
 * const habit: FilterHabit = "tail"
 * console.log(habit)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FilterHabit = typeof FilterHabit.Type;

/**
 * A command whose output an agent filtered: a pipe into a text filter, a discard, or a redirect to a log.
 *
 * **Example** (Recognize a filtered command)
 *
 * ```ts
 * import { FilteredCommandPattern } from "@beep/repo-ai-metrics/census-rules"
 * console.log(FilteredCommandPattern.test("bunx vitest run | tail -20")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FilteredCommandPattern =
  /\|\s*(tail|head|grep|rg|ugrep|awk|sed|jq|wc|cut)\b|>\s*\/dev\/null|>\s*\S+\.(log|txt|json)\b/;

/**
 * The pipe pattern behind each pipe habit.
 *
 * **Example** (Recognize a grep pipe)
 *
 * ```ts
 * import { FilterHabitPipePatterns } from "@beep/repo-ai-metrics/census-rules"
 * console.log(FilterHabitPipePatterns.grep.test("tsgo -b | rg error")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FilterHabitPipePatterns = {
  tail: /\|\s*tail\b/,
  head: /\|\s*head\b/,
  grep: /\|\s*(grep|rg|ugrep)\b/,
} as const;

/**
 * Redirect and `tee` targets that name a log file; the census keeps each target's base name.
 *
 * **Details**
 *
 * A base name of three characters or fewer is ignored. A later command or Read that names the base name
 * is a dig through that captured log.
 *
 * **Example** (Find a redirect target)
 *
 * ```ts
 * import { RedirectTargetPattern } from "@beep/repo-ai-metrics/census-rules"
 * console.log([..."bun run check > /tmp/check.log".matchAll(RedirectTargetPattern)][0]?.[1]) // "/tmp/check.log"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const RedirectTargetPattern = /(?:>>?|&>|tee(?: -a)?)\s*"?([^\s"|;&)]+\.(?:log|txt|out|json|ndjson))/g;

/**
 * The kinds of API call (turn) the census counts, in the priority a turn is classified by.
 *
 * **Details**
 *
 * A turn takes the first class any of its tool calls earns: a re-run with no edit since, a verification
 * run, a dig through a captured log, a CI log fetch, an edit or delegation, any other tool, and no tool.
 *
 * **Example** (Read the highest-priority turn class)
 *
 * ```ts
 * import { TurnClass } from "@beep/repo-ai-metrics/census-rules"
 * console.log(TurnClass.literals[0]) // "rerun-no-edit"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TurnClass = LiteralKit([
  "rerun-no-edit",
  "run-verification",
  "dig-captured-log",
  "fetch-ci-log",
  "edit",
  "other-tool",
  "no-tool",
]).pipe(
  $I.annoteSchema("TurnClass", {
    description: "What one Claude API call's tool calls did, by priority.",
  })
);

/**
 * **Example** (Type a turn class)
 *
 * ```ts
 * import type { TurnClass } from "@beep/repo-ai-metrics/census-rules"
 * const turnClass: TurnClass = "dig-captured-log"
 * console.log(turnClass)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TurnClass = typeof TurnClass.Type;

/**
 * Tools whose call is an edit or a delegation, which also ends the no-edit window for re-run detection.
 *
 * **Example** (Check an edit tool)
 *
 * ```ts
 * import { EditToolName } from "@beep/repo-ai-metrics/census-rules"
 * console.log(EditToolName.is.Edit("Edit")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EditToolName = LiteralKit(["Edit", "Write", "NotebookEdit", "Agent", "SendMessage", "Workflow"]).pipe(
  $I.annoteSchema("EditToolName", {
    description: "Claude tools that edit files or delegate work.",
  })
);

/**
 * **Example** (Type an edit tool)
 *
 * ```ts
 * import type { EditToolName } from "@beep/repo-ai-metrics/census-rules"
 * const tool: EditToolName = "Write"
 * console.log(tool)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EditToolName = typeof EditToolName.Type;

/**
 * The command patterns that decide a shell call's part in a turn.
 *
 * **Details**
 *
 * `run` is a verification run unless the command asks for `help`; `ciLog` fetches a CI log; `mutation`
 * changes the tree and ends the no-edit window; `persistedOutput` is a path to a harness-persisted tool
 * result. `corePrefix` and `coreSuffix` strip leading `cd`/`export`/assignment steps and everything from
 * the first pipe or redirect, so two runs compare by their core command.
 *
 * **Example** (Strip a command to its core)
 *
 * ```ts
 * import { TurnCommandPatterns } from "@beep/repo-ai-metrics/census-rules"
 * console.log("cd pkg && bun run check | tail".replace(TurnCommandPatterns.corePrefix, "").replace(TurnCommandPatterns.coreSuffix, ""))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TurnCommandPatterns = {
  run: /\bvitest\b|\bbun (run )?test\b|bun run [\w:-]*(test|check|lint|build)\b|\bturbo\b|\btsc\b|\btsgo\b|\btsrs\b|\bbiome\b|\boxlint\b|beep(\.ts)? (lint|quality|test)\b|docgen|yeet (final-check|repair|publish|verify|cheap-gates|open)\b/,
  help: /--help\b/,
  ciLog: /gh run view[^|;&]*--log|actions\/(jobs|runs)\/\d+\/(attempts\/\d+\/)?logs|gh api[^|;&]*\/logs/,
  mutation:
    /\bsed -i|\bgit (checkout|merge|pull|stash|apply|reset|commit|restore|rebase|cherry-pick)\b|--write\b|--fix\b|\bbun (install|add|remove)\b|\bpatch\b|\bmv\b|\brm\b|cat\s*>\s*\S+\.(ts|tsx|json|md|ya?ml)|<<\s*'?EOF/,
  persistedOutput: /tool-results\//,
  corePrefix: /^\s*((cd|export|[A-Z_]+=)\S*[^&;]*(&&|;)\s*)+/,
  coreSuffix: /\s*(2>&1)?\s*(\||>|&>).*$/s,
} as const;

/**
 * **Details**
 *
 * `turbo-prefix` (a Turbo task prefix, measured then stripped) and `ansi` (escape sequences) are measured
 * beside the exclusive classes, so they overlap them; every other line lands in exactly one class by
 * {@link LineClassRules}.
 *
 * **Example** (Check a line class)
 *
 * ```ts
 * import { LineClass } from "@beep/repo-ai-metrics/census-rules"
 * console.log(LineClass.is.signal("signal")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LineClass = LiteralKit([
  "signal",
  "other",
  "dup-line",
  "pass-line",
  "runner-chrome",
  "coverage-table",
  "turbo-chrome",
  "turbo-prefix",
  "script-echo",
  "stack-vendor",
  "stack-own",
  "zsh-noise",
  "blank",
  "ansi",
  "persist-wrapper",
]).pipe(
  $I.annoteSchema("LineClass", {
    description: "What one line of verification output is: signal, chrome, noise, repeats or unclassified.",
  })
);

/**
 * **Example** (Type a line class)
 *
 * ```ts
 * import type { LineClass } from "@beep/repo-ai-metrics/census-rules"
 * const lineClass: LineClass = "zsh-noise"
 * console.log(lineClass)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LineClass = typeof LineClass.Type;

/**
 * How a line class claims a trimmed, escape-free line.
 *
 * **Details**
 *
 * `Pattern` matches the pattern, `Empty` claims a blank line, and `RepeatInOutput` claims a line already
 * seen earlier in the same output. A line no rule claims is `other`.
 *
 * **Example** (Inspect the repeat rule)
 *
 * ```ts
 * import { LineMatch } from "@beep/repo-ai-metrics/census-rules"
 * console.log(LineMatch.cases.RepeatInOutput.make({})._tag) // "RepeatInOutput"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LineMatch = S.TaggedUnion({
  Pattern: { pattern: S.RegExp },
  Empty: {},
  RepeatInOutput: {},
}).pipe($I.annoteSchema("LineMatch", { description: "One line-class matching rule." }));

/**
 * **Example** (Type a line rule)
 *
 * ```ts
 * import type { LineMatch } from "@beep/repo-ai-metrics/census-rules"
 * const match: LineMatch = { _tag: "Empty" }
 * console.log(match._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LineMatch = typeof LineMatch.Type;

/**
 * **Example** (Read the first line rule)
 *
 * ```ts
 * import { LineClassRules } from "@beep/repo-ai-metrics/census-rules"
 * console.log(LineClassRules[0]?.lineClass) // "blank"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LineClassRule extends S.Opaque<LineClassRule, { readonly brand: unique symbol }>()(
  S.Struct({ lineClass: LineClass, match: LineMatch }).pipe(
    $I.annoteSchema("LineClassRule", { description: "One first-match line-class rule." })
  )
) {}

const linePattern = (lineClass: LineClass, pattern: RegExp) =>
  LineClassRule.make({ lineClass, match: LineMatch.cases.Pattern.make({ pattern }) });

/**
 * The exclusive line-class rules in first-match order; a line none of them claims is `other`.
 *
 * **Example** (Classify a script echo)
 *
 * ```ts
 * import { LineClassRules } from "@beep/repo-ai-metrics/census-rules"
 * const echo = LineClassRules.find((rule) => rule.lineClass === "script-echo")
 * console.log(echo?.match._tag) // "Pattern"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LineClassRules: ReadonlyArray<LineClassRule> = [
  LineClassRule.make({ lineClass: "blank", match: LineMatch.cases.Empty.make({}) }),
  linePattern(
    "zsh-noise",
    /gitstatus|zle|Add the following parameter|can't change option: (zle|monitor)|no job control|POWERLEVEL|instant prompt/
  ),
  linePattern(
    "turbo-chrome",
    /cache (hit|miss|bypass)|replaying logs|suppressing logs|^Tasks:|^Cached:|^Time:|Packages in scope|Running .* in \d+ packages|Remote caching|>>> FULL TURBO|^turbo \d|^• /
  ),
  linePattern("script-echo", /^\$ |^> /),
  linePattern("pass-line", /^[✓√]|^\(pass\)|^ok \d/),
  linePattern(
    "runner-chrome",
    /^(RUN|Test Files|Tests|Start at|Duration|Type Errors|Snapshots)\b|^% Coverage|^-{5,}|^={5,}|^File\s+\|/
  ),
  linePattern("coverage-table", /^[\w./<>-]*\s*\|\s*[\d.]+\s*\|/),
  linePattern("stack-vendor", /^at .*(node_modules|node:|native:|bun:)/),
  linePattern("stack-own", /^at /),
  LineClassRule.make({ lineClass: "dup-line", match: LineMatch.cases.RepeatInOutput.make({}) }),
  linePattern("persist-wrapper", /<persisted-output>|Output too large|Preview \(first/),
  linePattern("signal", /\berror\b|\bFAIL|✗|×|\bTS\d{4,}|failed|Error:|warning|\bwarn\b|AssertionError|expected|✘/i),
];

/**
 * Terminal escape sequences, measured as the `ansi` class and stripped before a line is classified.
 *
 * **Example** (Measure an escape sequence)
 *
 * ```ts
 * import { AnsiSequencePattern } from "@beep/repo-ai-metrics/census-rules"
 * console.log("\u001b[31mred\u001b[0m".replace(AnsiSequencePattern, "")) // "red"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const AnsiSequencePattern = /\u001b\[[0-9;?]*[A-Za-z]/g;

/**
 * A Turbo task prefix, measured as the `turbo-prefix` class and stripped before a line is classified.
 *
 * **Example** (Strip a Turbo task prefix)
 *
 * ```ts
 * import { TurboTaskPrefixPattern } from "@beep/repo-ai-metrics/census-rules"
 * console.log("@beep/schema:check: ok".replace(TurboTaskPrefixPattern, "")) // "ok"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TurboTaskPrefixPattern = /^(@beep\/[\w-]+:[\w:#-]+: |[\w@/-]+:[\w:-]+: )/;

/**
 * Named repeat offenders inside verification output.
 *
 * **Details**
 *
 * Each offender's rule and the verification kinds whose output it is measured against are in
 * {@link OffenderRules}.
 *
 * **Example** (List the offenders)
 *
 * ```ts
 * import { CensusOffender } from "@beep/repo-ai-metrics/census-rules"
 * console.log(CensusOffender.literals.length) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CensusOffender = LiteralKit([
  "ts6305-unbuilt-output",
  "gate-table-repeat",
  "json-envelope",
  "help-global-flags",
  "tests-passed-line",
]).pipe(
  $I.annoteSchema("CensusOffender", {
    description: "Repeat offenders named by the transcript audit, each with a written rule.",
  })
);

/**
 * **Example** (Type an offender)
 *
 * ```ts
 * import type { CensusOffender } from "@beep/repo-ai-metrics/census-rules"
 * const offender: CensusOffender = "json-envelope"
 * console.log(offender)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CensusOffender = typeof CensusOffender.Type;

/**
 * How an offender claims a trimmed, escape-free, prefix-stripped line of verification output.
 *
 * **Details**
 *
 * `Pattern` matches the pattern. `RepeatInContext` matches the pattern on a line already seen in an earlier
 * verification output of the same context. `HelpSection` claims the header line and every following line up
 * to the next blank line, in the output of a command that asks for `--help`.
 *
 * **Example** (Inspect the help-section rule)
 *
 * ```ts
 * import { OffenderRules } from "@beep/repo-ai-metrics/census-rules"
 * console.log(OffenderRules.find((rule) => rule.offender === "help-global-flags")?.match._tag) // "HelpSection"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OffenderMatch = S.TaggedUnion({
  Pattern: { pattern: S.RegExp },
  RepeatInContext: { pattern: S.RegExp },
  HelpSection: { header: S.RegExp },
}).pipe($I.annoteSchema("OffenderMatch", { description: "One offender matching rule." }));

/**
 * **Example** (Type an offender rule)
 *
 * ```ts
 * import type { OffenderMatch } from "@beep/repo-ai-metrics/census-rules"
 * const match: OffenderMatch = { _tag: "Pattern", pattern: /TS6305/ }
 * console.log(match._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OffenderMatch = typeof OffenderMatch.Type;

/**
 * An offender, its rule, and the verification kinds whose output it is counted in.
 *
 * **Example** (Read the TS6305 scope)
 *
 * ```ts
 * import { OffenderRules } from "@beep/repo-ai-metrics/census-rules"
 * console.log(OffenderRules[0]?.scope) // ["check", "lint", "quality"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OffenderRule extends S.Opaque<OffenderRule, { readonly brand: unique symbol }>()(
  S.Struct({ offender: CensusOffender, scope: S.Array(VerificationKind), match: OffenderMatch }).pipe(
    $I.annoteSchema("OffenderRule", { description: "One offender rule and its measured scope." })
  )
) {}

/**
 * The offender rules. Rules are not exclusive: one line can be several offenders.
 *
 * **Example** (Recognize a test verdict line)
 *
 * ```ts
 * import { OffenderRules } from "@beep/repo-ai-metrics/census-rules"
 * const rule = OffenderRules.find((entry) => entry.offender === "tests-passed-line")
 * console.log(rule?.match._tag === "Pattern" && rule.match.pattern.test("Tests  12 passed (12)")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OffenderRules: ReadonlyArray<OffenderRule> = [
  OffenderRule.make({
    offender: "ts6305-unbuilt-output",
    scope: ["check", "lint", "quality"],
    match: OffenderMatch.cases.Pattern.make({ pattern: /\berror TS6305\b/ }),
  }),
  OffenderRule.make({
    offender: "gate-table-repeat",
    scope: ["yeet"],
    match: OffenderMatch.cases.RepeatInContext.make({ pattern: /^#\d+\s+(?:DRAFT|ready|UNREADABLE)\b/ }),
  }),
  OffenderRule.make({
    offender: "json-envelope",
    scope: ["yeet"],
    match: OffenderMatch.cases.Pattern.make({ pattern: /^\[[\w:.-]+\]\s*\{".*\}$|^\{"schemaVersion".*\}$/ }),
  }),
  OffenderRule.make({
    offender: "help-global-flags",
    scope: ["yeet"],
    match: OffenderMatch.cases.HelpSection.make({ header: /^GLOBAL FLAGS\b/ }),
  }),
  OffenderRule.make({
    offender: "tests-passed-line",
    scope: VerificationKind.literals,
    match: OffenderMatch.cases.Pattern.make({ pattern: /^(?:Test Files|Tests)\s+\d+ passed\b/ }),
  }),
];

/**
 * Result-size bins for the chars-per-token calibration's binned medians.
 *
 * **Example** (List the calibration bins)
 *
 * ```ts
 * import { CalibrationBin } from "@beep/repo-ai-metrics/census-rules"
 * console.log(CalibrationBin.literals) // ["3k-6k", "6k-12k", "12k-20k", "20k-plus"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CalibrationBin = LiteralKit(["3k-6k", "6k-12k", "12k-20k", "20k-plus"]).pipe(
  $I.annoteSchema("CalibrationBin", { description: "Character-size bins of calibration samples." })
);

/**
 * **Example** (Type a calibration bin)
 *
 * ```ts
 * import type { CalibrationBin } from "@beep/repo-ai-metrics/census-rules"
 * const bin: CalibrationBin = "20k-plus"
 * console.log(bin)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CalibrationBin = typeof CalibrationBin.Type;

/**
 * A calibration bin and its half-open character range.
 *
 * **Example** (Read a bin's lower bound)
 *
 * ```ts
 * import { CalibrationBinRules } from "@beep/repo-ai-metrics/census-rules"
 * console.log(CalibrationBinRules[1]?.minimumChars) // 6000
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CalibrationBinRule extends S.Opaque<CalibrationBinRule, { readonly brand: unique symbol }>()(
  S.Struct({ bin: CalibrationBin, minimumChars: S.Natural, maximumChars: S.OptionFromNullOr(S.Natural) }).pipe(
    $I.annoteSchema("CalibrationBinRule", {
      description:
        "A bin holding samples of at least the minimum and fewer than the maximum characters; the last bin has no maximum.",
    })
  )
) {}

/**
 * The calibration bins in ascending order.
 *
 * **Example** (Count the bins)
 *
 * ```ts
 * import { CalibrationBinRules } from "@beep/repo-ai-metrics/census-rules"
 * console.log(CalibrationBinRules.length) // 4
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CalibrationBinRules: ReadonlyArray<CalibrationBinRule> = [
  CalibrationBinRule.make({ bin: "3k-6k", minimumChars: 3000, maximumChars: O.some(6000) }),
  CalibrationBinRule.make({ bin: "6k-12k", minimumChars: 6000, maximumChars: O.some(12_000) }),
  CalibrationBinRule.make({ bin: "12k-20k", minimumChars: 12_000, maximumChars: O.some(20_000) }),
  CalibrationBinRule.make({ bin: "20k-plus", minimumChars: 20_000, maximumChars: O.none() }),
];

/**
 * How transcripts are selected and read.
 *
 * **Details**
 *
 * Claude: every directory under the projects root whose name contains the repository name, walked
 * `claudeWalkDepth` levels deep, skipping `skippedDirectory`, taking every `transcriptExtension` file; a file
 * under a `subagentDirectory` directory or named with `subagentFilePrefix` is a subagent context. Codex:
 * every transcript file under the sessions root whose first `session_meta` record names a working directory,
 * or a runtime workspace root, containing the repository name; a file is abandoned after
 * `codexPreludeRecordLimit` records with no `session_meta`: the record after the limit ends the file. A function
 * call is a shell call when its name matches `codexShellToolPattern`; a custom tool call and a local shell call
 * are always shell calls, because Codex batches its shell commands inside one custom call. A tool result is persisted output when `persistedOutputPattern` matches
 * its first `persistedOutputProbeChars` characters. A calibration sample is a result larger than
 * `calibrationMinimumChars`. A line over `oversizedLineBytes` is counted, never rejected.
 *
 * **Example** (Read the Claude walk depth)
 *
 * ```ts
 * import { CensusSelectionRules } from "@beep/repo-ai-metrics/census-rules"
 * console.log(CensusSelectionRules.claudeWalkDepth) // 3
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CensusSelectionRules = {
  referenceRepository: "beep-effect",
  claudeWalkDepth: 3,
  skippedDirectory: "tool-results",
  subagentDirectory: "subagents",
  subagentFilePrefix: "agent-",
  transcriptExtension: ".jsonl",
  codexPreludeRecordLimit: 6,
  codexShellToolPattern: /exec|shell|command/,
  persistedOutputPattern: /<persisted-output>/,
  persistedOutputProbeChars: 200,
  calibrationMinimumChars: 3000,
  oversizedLineBytes: 262_144,
} as const;
