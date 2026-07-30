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
 * @since 0.0.0
 */

import * as Arr from "effect/Array";
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
 * @category predicates
 * @since 0.0.0
 * @example
 * ```ts
 * import { Hook } from 'effect-claudecode'
 *
 * const isBash = Hook.matchTool('Bash')
 * const isEditOrWrite = Hook.matchTool('Edit|Write')
 * const isMcp = Hook.matchTool('mcp__.*')
 *
 * isBash('Bash')       // true
 * isBash('Bash(git)')  // false — exact match
 * isMcp('mcp__foo')    // true
 * ```
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
    return (name: string) => Arr.contains(exactValues, name);
  }
  const regex = new RegExp(pattern);
  return (name: string) => regex.test(name);
};

/**
 * Test whether a matcher pattern matches a value, one-shot.
 *
 * @category predicates
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.testTool("Bash", "Bash"))
 * ```
 */
export const testValue = (pattern: string | RegExp, name: string): boolean => matchValue(pattern)(name);

/**
 * Build a handler that runs only when the selected matcher value matches.
 *
 * @internal
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.handleMatcher)
 * ```
 *
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
 * @category predicates
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.matchTool)
 * ```
 */
export const matchTool = matchValue;

/**
 * Compile a FileChanged matcher into a tester. Claude Code splits
 * FileChanged matcher strings on `|` and treats each segment as a literal
 * basename rather than a regular expression. `*` and `""` still match all.
 *
 * @category predicates
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.FileChanged.onMatcher({
 *   matcher: "README.md|package.json",
 *   handler: () => Effect.succeed(Hook.FileChanged.passthrough())
 * })
 * ```
 */
export const matchFileName = (pattern: string | RegExp): ((name: string) => boolean) => {
  if (pattern instanceof RegExp) {
    return (name: string) => pattern.test(name);
  }
  if (pattern === "*" || Str.isEmpty(pattern)) {
    return () => true;
  }
  const exactValues = Str.split(pattern, "|");
  return (name: string) => Arr.contains(exactValues, name);
};

/**
 * Test whether a regex pattern matches a tool name, one-shot.
 *
 * @category predicates
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.testTool)
 * ```
 */
export const testTool = testValue;
