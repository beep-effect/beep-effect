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
 * **Example** (Match exact, listed, and regular-expression tools)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const isBash = Hook.matchTool('Bash')
 * const isEditOrWrite = Hook.matchTool('Edit|Write')
 * const isMcp = Hook.matchTool('mcp__.*')
 *
 * console.log(isBash("Bash")) // true
 * console.log(isEditOrWrite("Write")) // true
 * console.log(isMcp("mcp__foo")) // true
 * ```
 *
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
 * Test whether a matcher pattern matches a value, one-shot.
 *
 * **Example** (Test one tool name)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.testTool("Bash", "Bash"))
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
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
 * **Example** (Match a tool name)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const matches = Hook.matchTool("Bash")
 * console.log(matches("Bash")) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const matchTool = matchValue;

/**
 * Compile a FileChanged matcher into a tester. Claude Code splits
 * FileChanged matcher strings on `|` and treats each segment as a literal
 * basename rather than a regular expression. `*` and `""` still match all.
 *
 * **Example** (Match an exact file basename)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.FileChanged.onMatcher({
 *   matcher: "README.md|package.json",
 *   handler: () => Effect.succeed(Hook.FileChanged.passthrough())
 * })
 * console.log(hook.event) // "FileChanged"
 * ```
 *
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
 * Test whether a regex pattern matches a tool name, one-shot.
 *
 * **Example** (Test one tool matcher)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.testTool("Edit|Write", "Write")) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const testTool = testValue;
