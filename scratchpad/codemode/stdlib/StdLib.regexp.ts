/**
 * Guest RegExp construction, `RegExp.escape`, and lastIndex-aware `exec`/`test`
 * for the CodeMode interpreter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, type SafeObject } from "@beep/schema";
import { Unknown } from "@beep/schema/Unknown";
import { A, P, pipe, R } from "@beep/utils";
import { type RegExpMethod, type RegExpStatic, regexpMethods } from "../Codemode.method-names.ts";
import { isBlockedMember } from "../Codemode.tool-runtime.ts";
import { CodeModeRegExp, makeEmptySafeObject } from "../Codemode.values.ts";
import { type AstNode, InterpreterRuntimeError } from "../interpreter/Interpreter.model.ts";
import { coerceToNumber, coerceToString } from "./StdLib.value.ts";

export {
  regexpMethods,
  regexpStatics,
} from "../Codemode.method-names.ts";

const $I = $ScratchpadId.create("codemode/stdlib/StdLib.regexp");

type MatchValue = Array<unknown> & {
  index?: number;
  groups?: SafeObject;
  indices?: IndicesValue;
};

type IndicesValue = Array<unknown> & {
  groups?: SafeObject;
};

/**
 * Closed kit of guest-visible `RegExp` instance properties including flags and
 * `lastIndex`.
 *
 * **Example** (Confirm source and lastIndex membership)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { regexpProperties } from "../../../codemode/stdlib/StdLib.regexp.ts"
 *
 * console.log(S.is(regexpProperties)("source"))
 * console.log(S.is(regexpProperties)("lastIndex"))
 * ```
 *
 * @see {@link invokeRegExpMethod} for exec and test against those properties.
 * @category constants
 * @since 0.0.0
 */
export const regexpProperties = LiteralKit([
  "source",
  "flags",
  "lastIndex",
  "hasIndices",
  "global",
  "ignoreCase",
  "multiline",
  "sticky",
  "unicode",
  "unicodeSets",
  "dotAll",
]).pipe(
  $I.annoteSchema("regexpProperties", {
    description: "Guest-visible RegExp instance property names.",
  })
);

/**
 * Decoded value produced by {@link regexpProperties}.
 *
 * @see {@link regexpProperties} for the runtime kit of RegExp property names.
 * @category type-level
 * @since 0.0.0
 */
export type regexpProperties = typeof regexpProperties.Type;

const encodeJson = Unknown.encodeUnknownSyncFromJsonString;

/**
 * Strips the host `Invalid regular expression:` prefix from a thrown pattern
 * error so guest diagnostics stay pattern-focused.
 *
 * **Example** (Normalize a SyntaxError message)
 *
 * ```ts
 * import { regexFailureReason } from "../../../codemode/stdlib/StdLib.regexp.ts"
 *
 * console.log(regexFailureReason(new SyntaxError("Invalid regular expression: /(/: Unterminated group")))
 * ```
 *
 * @see {@link escapeRegexHint} for the hint appended when a string pattern is invalid.
 * @see {@link toHostRegex} for the constructor that uses this reason.
 * @category utilities
 * @since 0.0.0
 */
export const regexFailureReason = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).replace(/^Invalid regular expression:\s*/i, "");

/**
 * Hint appended when a string pattern is not a valid regular expression.
 *
 * **Example** (Read the escape hint)
 *
 * ```ts
 * import { escapeRegexHint } from "../../../codemode/stdlib/StdLib.regexp.ts"
 *
 * console.log(escapeRegexHint.includes("backslash"))
 * ```
 *
 * @see {@link toHostRegex} for the constructor that includes this hint in SyntaxError.
 * @see {@link regexFailureReason} for the stripped host error text.
 * @category constants
 * @since 0.0.0
 */
export const escapeRegexHint =
  'To match special characters like ( ) [ ] { } + * ? . literally, escape them with a backslash (e.g. "\\\\(") or test for them with String.includes instead.';

/**
 * Converts a guest pattern argument into a host `RegExp`.
 *
 * **Gotchas**
 *
 * An undefined pattern behaves as an empty pattern (`/(?:)/` equivalent
 * `new RegExp("")`), matching native `String.prototype.match(undefined)`.
 * Invalid string patterns throw `SyntaxError` whose message includes
 * {@link regexFailureReason} and {@link escapeRegexHint}.
 *
 * **Example** (Treat undefined as an empty pattern)
 *
 * ```ts
 * import { toHostRegex } from "../../../codemode/stdlib/StdLib.regexp.ts"
 *
 * const node = { type: "CallExpression" }
 * const regex = toHostRegex(undefined, "match", node)
 * console.log(regex.source)
 * console.log(regex.test(""))
 * ```
 *
 * @see {@link escapeRegexHint} for the text appended to invalid-pattern errors.
 * @see {@link matchToValue} for converting exec results into guest arrays.
 * @category interop
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Guest intrinsic dispatch uses co-primary receiver/name/arguments/AST context; a data-last overload would misstate the protocol.
export const toHostRegex = (arg: unknown, method: string, node: AstNode, extraFlags = ""): RegExp => {
  // Native parity: an undefined pattern behaves as an empty pattern.
  if (P.isUndefined(arg)) return new RegExp("", extraFlags);
  if (CodeModeRegExp.is(arg)) return arg.regex;
  if (P.isString(arg)) {
    try {
      return new RegExp(arg, extraFlags);
    } catch (error) {
      throw InterpreterRuntimeError.new(
        `String.${method} received the string ${encodeJson(arg)}, which is not a valid regular expression pattern (${regexFailureReason(error)}). ${escapeRegexHint}`,
        node
      ).as("SyntaxError");
    }
  }
  throw InterpreterRuntimeError.new(
    `String.${method} expects a regular expression (a /pattern/flags literal or new RegExp(...)) or a string pattern, not ${arg === null ? "null" : typeof arg}.`,
    node
  );
};

/**
 * Copies a native `RegExpMatchArray` into a guest array, dropping blocked
 * named-group keys.
 *
 * **Gotchas**
 *
 * Named groups whose keys fail {@link isBlockedMember} are omitted from
 * `groups` rather than throwing.
 *
 * **Example** (Preserve index and named groups)
 *
 * ```ts
 * import { matchToValue } from "../../../codemode/stdlib/StdLib.regexp.ts"
 *
 * const match = /(?<digit>\d)/.exec("a1")
 * const value = match === null ? null : matchToValue(match)
 * console.log(value)
 * ```
 *
 * @see {@link invokeRegExpMethod} for exec that feeds this converter.
 * @see {@link toHostRegex} for building the host regex that produced the match.
 * @category utilities
 * @since 0.0.0
 */
export const matchToValue = (match: RegExpMatchArray): Array<unknown> => {
  const result: MatchValue = pipe(
    match,
    A.fromIterable,
    A.map((group) => group)
  );
  if (P.isNotUndefined(match.index)) result.index = match.index;
  if (P.isNotUndefined(match.groups)) {
    const groups = makeEmptySafeObject();
    for (const [key, group] of R.toEntries(match.groups)) {
      if (!isBlockedMember(key)) Reflect.set(groups, key, group);
    }
    result.groups = groups;
  }
  if (P.isNotUndefined(match.indices)) result.indices = indicesToValue(match.indices);
  return result;
};

/**
 * Implements guest `RegExp.escape` only; the name argument is ignored.
 *
 * **Gotchas**
 *
 * This is not a general static dispatcher. The only implemented static is
 * `RegExp.escape`. Non-string arguments throw `TypeError`.
 *
 * **Example** (Escape a capturing-group pattern)
 *
 * ```ts
 * import { invokeRegExpStatic } from "../../../codemode/stdlib/StdLib.regexp.ts"
 *
 * const node = { type: "CallExpression" }
 * console.log(invokeRegExpStatic("escape", ["(foo)"], node))
 * ```
 *
 * @see {@link toHostRegex} for compiling an escaped or raw pattern.
 * @see {@link escapeRegexHint} for the user-facing escape guidance.
 * @category interop
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Guest intrinsic dispatch uses co-primary receiver/name/arguments/AST context; a data-last overload would misstate the protocol.
export const invokeRegExpStatic = (_name: RegExpStatic, args: Array<unknown>, node: AstNode): string => {
  if (!P.isString(args[0])) {
    throw InterpreterRuntimeError.new("RegExp.escape expects a string.", node).as("TypeError");
  }
  return RegExp.escape(args[0]);
};

/**
 * Dispatches guest `RegExp.prototype` `test`, `exec`, and `toString`.
 *
 * **Gotchas**
 *
 * For `global` or `sticky` flags, `lastIndex` is copied onto the host regex
 * before `test`/`exec` and written back after. Non-stateful flags restore the
 * previous `lastIndex` so matching does not appear to mutate it.
 *
 * **Example** (Exec a digit pattern and read index)
 *
 * ```ts
 * import { CodeModeRegExp } from "../../../codemode/Codemode.values.ts"
 * import { invokeRegExpMethod } from "../../../codemode/stdlib/StdLib.regexp.ts"
 *
 * const node = { type: "CallExpression" }
 * const regex = CodeModeRegExp.new("(?<digit>\\d)", "")
 * const match = invokeRegExpMethod(regex, "exec", ["a1"], node)
 * console.log(match)
 * ```
 *
 * @see {@link matchToValue} for how exec arrays are copied into guest values.
 * @see {@link toHostRegex} for compiling string patterns used by String.match.
 * @category interop
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Guest intrinsic dispatch uses co-primary receiver/name/arguments/AST context; a data-last overload would misstate the protocol.
export const invokeRegExpMethod = (
  value: CodeModeRegExp,
  name: RegExpMethod,
  args: Array<unknown>,
  _node: AstNode
): unknown => {
  const execute = (returnBoolean: boolean): unknown => {
    const input = coerceToString(args[0]);
    const lastIndex = value.lastIndex;
    const stateful = value.regex.global || value.regex.sticky;
    value.regex.lastIndex = toLength(lastIndex);
    if (returnBoolean) {
      const matched = value.regex.test(input);
      if (!stateful) value.lastIndex = lastIndex;
      return matched;
    }
    const matched = value.regex.exec(input);
    if (!stateful) value.lastIndex = lastIndex;
    return P.isNull(matched) ? null : matchToValue(matched);
  };
  return regexpMethods.$match(name, {
    test: () => execute(true),
    exec: () => execute(false),
    toString: () => coerceToString(value),
  });
};

const toLength = (value: unknown): number => {
  const number = coerceToNumber(value);
  if (Number.isNaN(number) || number <= 0) return 0;
  return Math.min(Math.floor(number), Number.MAX_SAFE_INTEGER);
};

const indicesToValue = (indices: RegExpIndicesArray): IndicesValue => {
  const result: IndicesValue = pipe(
    indices,
    A.fromIterable,
    A.map((range) => (P.isUndefined(range) ? undefined : [...range]))
  );
  if (P.isNotUndefined(indices.groups)) {
    const groups = makeEmptySafeObject();
    for (const [key, range] of R.toEntries(indices.groups)) {
      if (!isBlockedMember(key)) {
        Reflect.set(groups, key, P.isUndefined(range) ? undefined : [...range]);
      }
    }
    result.groups = groups;
    return result;
  }
  Reflect.set(result, "groups", undefined);
  return result;
};
