/**
 * Matcher helpers for hooks that support a `matcher` field in settings.json.
 *
 * Claude Code matcher strings are exact/pipe-list matchers for plain
 * tokens, match-all for `*` or the empty string, and JavaScript regular
 * expressions only when they contain other characters. These helpers mirror
 * those semantics so individual hooks can branch on whether the incoming
 * event matches. They are NOT required — the `matcher` field in settings.json
 * filters hooks at Claude Code's side before the process is even spawned.
 * Use these when you dispatch many events from one script and need to
 * branch within a single handler.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import type * as Effect from "effect/Effect";
import * as Str from "effect/String";

// ---------------------------------------------------------------------------
// Matchers
// ---------------------------------------------------------------------------

const exactMatcherPattern = /^[A-Za-z0-9_|]+$/;

/**
 * Compile a matcher pattern into a tester function. String patterns follow
 * Claude Code's current matcher rules: `*` and `""` match all, strings made
 * only from letters/digits/`_`/`|` are exact values or `|`-separated exact
 * lists, and strings containing any other character are JavaScript regexes.
 *
 * **Gotchas**
 *
 * Claude Code already applies the `matcher` field in settings.json before
 * spawning the process. Use this helper only when one script must branch on
 * several incoming values itself.
 *
 * **Example** (Match exact, listed, and regular-expression names)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const isBash = Hook.matchValue("Bash")
 * const isEditOrWrite = Hook.matchValue("Edit|Write")
 * const isMcp = Hook.matchValue("mcp__.*")
 *
 * console.log(isBash("Bash")) // true
 * console.log(isEditOrWrite("Write")) // true
 * console.log(isMcp("mcp__foo")) // true
 * ```
 *
 * @see {@link matchFileName} for FileChanged basename matchers, which never compile `|` segments as regular expressions.
 * @see {@link matchTool} for the tool-name alias of this compiler.
 * @category predicates
 * @since 0.0.0
 */
export const matchValue = (pattern: string | RegExp): ((name: string) => boolean) => {
  if (pattern instanceof RegExp) {
    return (name: string) => pattern.test(name);
  }
  if (pattern === "*" || Str.isEmpty(pattern)) {
    return () => true;
  }
  if (exactMatcherPattern.test(pattern)) {
    const exactValues = Str.split(pattern, "|");
    return (name: string) => A.contains(exactValues, name);
  }
  const regex = new RegExp(pattern);
  return (name: string) => regex.test(name);
};

/**
 * One-shot test of a matcher pattern against a value.
 *
 * **Gotchas**
 *
 * Claude Code already applies the `matcher` field in settings.json before
 * spawning the process. Use this helper only when one script must branch on
 * several incoming values itself.
 *
 * **Example** (Test exact, listed, and regular-expression names)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.testValue("Bash", "Bash")) // true
 * console.log(Hook.testValue("Edit|Write", "Read")) // false
 * console.log(Hook.testValue("mcp__.*", "mcp__foo")) // true
 * ```
 *
 * @see {@link matchFileName} for FileChanged basename matchers, which never compile `|` segments as regular expressions.
 * @see {@link testTool} for the tool-name alias of this one-shot test.
 * @category predicates
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const testValue = (pattern: string | RegExp, name: string): boolean => matchValue(pattern)(name);

/**
 * Build a handler that runs only when the selected matcher value matches.
 *
 * **Example** (Branch on a matcher)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const handle = Hook.handleMatcher({
 *   matcher: "Bash",
 *   select: (tool: string) => tool,
 *   onMatch: () => Effect.succeed("matched"),
 *   onMismatch: () => Effect.succeed("skipped")
 * })
 * console.log(Effect.runSync(handle("Bash"))) // "matched"
 * ```
 *
 * @internal
 * @category predicates
 *
 * @since 0.0.0
 */
export const handleMatcher =
  <I, O, E, R>(config: {
    readonly matcher: string | RegExp;
    readonly select: (input: I) => string;
    readonly onMatch: (input: I) => Effect.Effect<O, E, R>;
    readonly onMismatch: (input: I) => Effect.Effect<O, E, R>;
  }): ((input: I) => Effect.Effect<O, E, R>) =>
  (input) =>
    testValue(config.matcher, config.select(input)) ? config.onMatch(input) : config.onMismatch(input);

/**
 * Alias for `matchValue(...)` when matching `tool_name`.
 *
 * **Gotchas**
 *
 * Claude Code already applies the `matcher` field in settings.json before
 * spawning the process. In-process matching is only needed when one script
 * handles many tool events.
 *
 * **Example** (Match a tool name)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const matches = Hook.matchTool("Bash")
 * console.log(matches("Bash")) // true
 * ```
 *
 * @see {@link matchFileName} for FileChanged basename matchers, which never compile `|` segments as regular expressions.
 * @see {@link matchValue} for the shared compiler this alias forwards to.
 * @category predicates
 * @since 0.0.0
 */
export const matchTool = matchValue;

/**
 * Compile a FileChanged matcher into a tester. Claude Code splits
 * FileChanged matcher strings on `|` and treats each segment as a literal
 * basename rather than a regular expression. `*` and `""` still match all.
 *
 * **Example** (Match literal basenames, not regular expressions)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const matches = Hook.matchFileName("README.md|package.json")
 * console.log(matches("README.md")) // true
 * console.log(matches("src.ts")) // false
 *
 * const looksLikeRegex = Hook.matchFileName("config.*|[secret].env")
 * console.log(looksLikeRegex("config.*")) // true
 * console.log(looksLikeRegex("config.json")) // false
 * ```
 *
 * @see {@link matchTool} for tool-name matchers, which compile non-exact patterns as JavaScript regular expressions.
 * @category predicates
 * @since 0.0.0
 */
export const matchFileName = (pattern: string | RegExp): ((name: string) => boolean) => {
  if (pattern instanceof RegExp) {
    return (name: string) => pattern.test(name);
  }
  if (pattern === "*" || Str.isEmpty(pattern)) {
    return () => true;
  }
  const exactValues = Str.split(pattern, "|");
  return (name: string) => A.contains(exactValues, name);
};

/**
 * One-shot test of a tool-name matcher against a candidate name.
 *
 * **Gotchas**
 *
 * Claude Code already applies the `matcher` field in settings.json before
 * spawning the process. In-process matching is only needed when one script
 * handles many tool events.
 *
 * **Example** (Test one tool matcher)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.testTool("Edit|Write", "Write")) // true
 * ```
 *
 * @see {@link matchFileName} for FileChanged basename matchers, which never compile `|` segments as regular expressions.
 * @see {@link testValue} for the shared one-shot tester this alias forwards to.
 * @category predicates
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const testTool = testValue;
