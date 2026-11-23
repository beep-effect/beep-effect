// Scanner-based path navigation for the modifier. Private implementation.
//
// Resolution is structural, through the scanner's tokens, rather than a
// string search that breaks on keys containing quote characters: the matching
// property's key offset is captured directly from the key token, never
// guessed from the source text. `navigate` returns a plain structural result;
// `JsoncModifier` synthesizes edits and constructs `JsoncModificationError`
// from it, so this module never imports the facade or the edit vocabulary.

import { $JsoncId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { createScanner } from "./scanner.ts";
import { skipBalancedValue } from "./skip.ts";
import type { JsoncSegment } from "../JsoncNode.ts";
import type { SyntaxKind } from "./scanner.ts";
import type { SkipCursor } from "./skip.ts";

const $I = $JsoncId.create("internal/navigate");

/**
 * The container kind a path segment addresses: a string key enters an object,
 * a number enters an array.
 *
 * **Example** (Guard a container kind)
 *
 * ```ts
 * import { NavigateContainer } from "@beep/jsonc/internal/navigate"
 *
 * console.log(NavigateContainer.is.object("object")) // true
 * console.log(NavigateContainer.is.object("array")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NavigateContainer = LiteralKit(["object", "array"]).pipe(
  $I.annoteSchema("NavigateContainer", { description: "The JSONC container kind a path segment addresses." })
);

/**
 * Decoded value produced by {@link NavigateContainer}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type NavigateContainer = typeof NavigateContainer.Type;

/**
 * Structural outcomes of locating a path in the original JSONC text.
 *
 * **Details**
 *
 * - `Located`: the target exists. `keyStart` is the property key's offset (or
 *   the element's value offset in an array), `valueStart`/`valueEnd` bound the
 *   value tightly, and the comma offsets come from scanner tokens so commas
 *   inside comments are invisible.
 * - `Insert`: the target does not exist; `at` is the insertion offset,
 *   `isFirst` whether the container is empty, `depth` the path length for
 *   indentation.
 * - `Mismatch`: the value at `depth` is not the container kind the segment
 *   requires. An intermediate miss surfaces as a mismatch at the next segment.
 * - `NoOp`: the final array index can never address an element or the end of
 *   the array (a negative or fractional index the scan passed), so nothing is
 *   edited; this keeps upstream's no-edit answer for such indices.
 *
 * **Example** (Locate a property)
 *
 * ```ts
 * import { navigate, NavigateResult } from "@beep/jsonc/internal/navigate"
 *
 * const result = navigate('{ "a": 1, "b": 2 }', ["b"])
 *
 * console.log(NavigateResult.guards.Located(result)) // true
 * console.log(NavigateResult.match(result, {
 *   Located: (r) => r.valueStart,
 *   Insert: (r) => r.at,
 *   Mismatch: (r) => r.depth,
 *   NoOp: () => -1,
 * })) // 15
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NavigateResult = S.TaggedUnion({
  Located: {
    container: NavigateContainer,
    keyStart: S.Natural,
    valueStart: S.Natural,
    valueEnd: S.Natural,
    commaBefore: S.Option(S.Natural),
    commaAfter: S.Option(S.Natural),
  },
  Insert: { container: NavigateContainer, at: S.Natural, isFirst: S.Boolean, depth: S.Natural },
  Mismatch: { depth: S.Natural, expected: NavigateContainer },
  NoOp: {},
}).pipe(
  $I.annoteSchema("NavigateResult", {
    description:
      "Where a JSONC path resolves in the source text: a located value, an insertion point, a structural mismatch or no edit.",
  })
);

/**
 * @see {@link NavigateResult} for the runtime schema and its case helpers.
 * @category type-level
 * @since 0.0.0
 */
export type NavigateResult = typeof NavigateResult.Type;

/**
 * Resolve `path` against `text`, returning where the target is or where it
 * would be inserted.
 *
 * **Details**
 *
 * Dual: `navigate(text, path)` or `navigate(path)(text)`. The path is
 * non-empty by type; the whole-document case is handled by the caller.
 * Skipping is iterative, so hostile nesting cannot overflow the stack and no
 * depth cap is needed here.
 *
 * **Example** (Resolve an insertion point in an empty object)
 *
 * ```ts
 * import { navigate, NavigateResult } from "@beep/jsonc/internal/navigate"
 *
 * const result = navigate("{}", ["port"])
 *
 * console.log(NavigateResult.guards.Insert(result) && result.isFirst) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const navigate: {
  (text: string, path: A.NonEmptyReadonlyArray<JsoncSegment>): NavigateResult;
  (path: A.NonEmptyReadonlyArray<JsoncSegment>): (text: string) => NavigateResult;
} = dual(2, (text: string, path: A.NonEmptyReadonlyArray<JsoncSegment>): NavigateResult => {
  const scanner = createScanner(text, true);
  let currentToken = scanner.scan();
  let depth = 0;

  // Malformed input can route a non-value token here (a value slot may hold a
  // closer, as in `{"k":}`); the skip helper leaves the cursor untouched then.
  const skipCursor: SkipCursor = {
    getToken: () => currentToken,
    advance: () => {
      currentToken = scanner.scan();
    },
    tokenStart: () => scanner.getTokenOffset(),
    tokenLength: () => scanner.getTokenLength(),
  };

  const skipValue = (): number => skipBalancedValue(skipCursor);

  const located: {
    (container: NavigateContainer, keyStart: number, commaBefore: O.Option<number>): NavigateResult;
    (keyStart: number, commaBefore: O.Option<number>): (container: NavigateContainer) => NavigateResult;
  } = dual(3, (container: NavigateContainer, keyStart: number, commaBefore: O.Option<number>): NavigateResult => {
    const valueStart = scanner.getTokenOffset();
    const valueEnd = skipValue();
    return NavigateResult.cases.Located.make({
      container,
      keyStart,
      valueStart,
      valueEnd,
      commaBefore,
      commaAfter: currentToken === "Comma" ? O.some(scanner.getTokenOffset()) : O.none(),
    });
  });

  // Shared walk state for the container currently being scanned: the end of
  // the last value seen and the offset of the last separator comma.
  let lastEnd = 0;
  let lastComma = O.none<number>();

  const isOpen = (closer: SyntaxKind): boolean => currentToken !== closer && currentToken !== "EOF";

  // Consume a separator comma when one is due. A trailing comma before the
  // closer ends the members (`true`); an insertion then belongs after the last
  // value, inside the container (upstream-bug fix).
  const closesAfterSeparator = (due: boolean, closer: SyntaxKind): boolean => {
    if (!due || currentToken !== "Comma") return false;
    lastComma = O.some(scanner.getTokenOffset());
    currentToken = scanner.scan();
    return currentToken === closer;
  };

  // Process the object member at the cursor: `Some(keyStart)` when its key is
  // `segment` (cursor left on the value), otherwise the member is skipped.
  const scanMember = (segment: string): O.Option<number> => {
    if (currentToken !== "String") {
      currentToken = scanner.scan();
      lastEnd = scanner.getTokenOffset();
      return O.none();
    }
    const keyStart = scanner.getTokenOffset();
    const key = scanner.getTokenValue();
    currentToken = scanner.scan(); // skip key
    if (currentToken === "Colon") {
      currentToken = scanner.scan(); // skip colon
    }
    if (key === segment) {
      return O.some(keyStart);
    }
    lastEnd = skipValue();
    return O.none();
  };

  // Walk an object's entries until `segment` is found; the cursor is left on
  // the matching value, or on the closer when the key is absent.
  const scanObject = (segment: string) => {
    currentToken = scanner.scan(); // skip {
    lastEnd = scanner.getTokenOffset();
    lastComma = O.none();
    let isFirst = true;
    while (isOpen("CloseBrace") && !closesAfterSeparator(!isFirst, "CloseBrace")) {
      const keyStart = scanMember(segment);
      if (O.isSome(keyStart)) {
        return { found: O.some({ keyStart: keyStart.value, commaBefore: lastComma }), lastValueEnd: lastEnd, isFirst };
      }
      isFirst = false;
    }
    return {
      found: O.none<{ readonly keyStart: number; readonly commaBefore: O.Option<number> }>(),
      lastValueEnd: lastEnd,
      isFirst,
    };
  };

  // Walk an array's elements until index `segment`; the cursor is left on the
  // matching value, or on the closer when the array is shorter.
  const scanArray = (segment: number) => {
    currentToken = scanner.scan(); // skip [
    let index = 0;
    lastEnd = scanner.getTokenOffset();
    lastComma = O.none();
    while (isOpen("CloseBracket") && !closesAfterSeparator(index > 0, "CloseBracket")) {
      if (index === segment) {
        return { found: true, lastEnd, index, lastComma };
      }
      lastEnd = skipValue();
      index++;
    }
    return { found: false, lastEnd, index, lastComma };
  };

  const mismatch = (segment: JsoncSegment): NavigateResult =>
    NavigateResult.cases.Mismatch.make({ depth, expected: P.isString(segment) === true ? "object" : "array" });

  const canEnter = (segment: JsoncSegment): boolean =>
    P.isString(segment) === true ? currentToken === "OpenBrace" : currentToken === "OpenBracket";

  // Intermediate segments only need to position the cursor on the next value.
  // A miss leaves the cursor on the closer, which the next segment reports.
  const descend = (segment: JsoncSegment): void => {
    if (P.isString(segment) === true) {
      scanObject(segment);
    } else {
      scanArray(segment);
    }
  };

  const resolveKey = (key: string): NavigateResult => {
    const { found, lastValueEnd, isFirst } = scanObject(key);
    return O.match(found, {
      onSome: ({ keyStart, commaBefore }) => located("object", keyStart, commaBefore),
      onNone: () => NavigateResult.cases.Insert.make({ container: "object", at: lastValueEnd, isFirst, depth }),
    });
  };

  const resolveIndex = (target: number): NavigateResult => {
    const scanned = scanArray(target);
    if (scanned.found) {
      return located("array", scanner.getTokenOffset(), scanned.lastComma);
    }
    // Upstream inserts only while the scanned length has not passed the index;
    // a negative or fractional index the scan passed resolves to no edit.
    return scanned.index <= target
      ? NavigateResult.cases.Insert.make({
          container: "array",
          at: scanned.lastEnd,
          isFirst: scanned.index === 0,
          depth,
        })
      : NavigateResult.cases.NoOp.make({});
  };

  for (const segment of A.initNonEmpty(path)) {
    depth++;
    if (!canEnter(segment)) {
      return mismatch(segment);
    }
    descend(segment);
  }

  const last = A.lastNonEmpty(path);
  depth++;
  if (!canEnter(last)) {
    return mismatch(last);
  }
  return P.isString(last) === true ? resolveKey(last) : resolveIndex(last);
});
