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

  let lastValueEndInContainer = 0;
  let lastSeparatorComma = O.none<number>();

  const isOpen = (closer: SyntaxKind): boolean => currentToken !== closer && currentToken !== "EOF";

  const closesAfterSeparator = (due: boolean, closer: SyntaxKind): boolean => {
    if (!due || currentToken !== "Comma") return false;
    lastSeparatorComma = O.some(scanner.getTokenOffset());
    currentToken = scanner.scan();
    return currentToken === closer;
  };

  const scanMemberLeavingCursorOnMatchingValue = (segment: string): O.Option<number> => {
    if (currentToken !== "String") {
      currentToken = scanner.scan();
      lastValueEndInContainer = scanner.getTokenOffset();
      return O.none();
    }
    const keyStart = scanner.getTokenOffset();
    const key = scanner.getTokenValue();
    currentToken = scanner.scan();
    if (currentToken === "Colon") {
      currentToken = scanner.scan();
    }
    if (key === segment) {
      return O.some(keyStart);
    }
    lastValueEndInContainer = skipValue();
    return O.none();
  };

  const scanObjectUntilKeyOrCloser = (segment: string) => {
    currentToken = scanner.scan();
    lastValueEndInContainer = scanner.getTokenOffset();
    lastSeparatorComma = O.none();
    let isFirst = true;
    while (isOpen("CloseBrace") && !closesAfterSeparator(!isFirst, "CloseBrace")) {
      const keyStart = scanMemberLeavingCursorOnMatchingValue(segment);
      if (O.isSome(keyStart)) {
        return {
          found: O.some({ keyStart: keyStart.value, commaBefore: lastSeparatorComma }),
          lastValueEnd: lastValueEndInContainer,
          isFirst,
        };
      }
      isFirst = false;
    }
    return {
      found: O.none<{ readonly keyStart: number; readonly commaBefore: O.Option<number> }>(),
      lastValueEnd: lastValueEndInContainer,
      isFirst,
    };
  };

  const scanArrayUntilIndexOrCloser = (segment: number) => {
    currentToken = scanner.scan();
    let index = 0;
    lastValueEndInContainer = scanner.getTokenOffset();
    lastSeparatorComma = O.none();
    while (isOpen("CloseBracket") && !closesAfterSeparator(index > 0, "CloseBracket")) {
      if (index === segment) {
        return { found: true, lastValueEndInContainer, index, lastSeparatorComma };
      }
      lastValueEndInContainer = skipValue();
      index++;
    }
    return { found: false, lastValueEndInContainer, index, lastSeparatorComma };
  };

  const mismatch = (segment: JsoncSegment): NavigateResult =>
    NavigateResult.cases.Mismatch.make({ depth, expected: P.isString(segment) === true ? "object" : "array" });

  const canEnter = (segment: JsoncSegment): boolean =>
    P.isString(segment) === true ? currentToken === "OpenBrace" : currentToken === "OpenBracket";

  const descend = (segment: JsoncSegment): void => {
    if (P.isString(segment) === true) {
      scanObjectUntilKeyOrCloser(segment);
    } else {
      scanArrayUntilIndexOrCloser(segment);
    }
  };

  const resolveKey = (key: string): NavigateResult => {
    const { found, lastValueEnd, isFirst } = scanObjectUntilKeyOrCloser(key);
    return O.match(found, {
      onSome: ({ keyStart, commaBefore }) => located("object", keyStart, commaBefore),
      onNone: () => NavigateResult.cases.Insert.make({ container: "object", at: lastValueEnd, isFirst, depth }),
    });
  };

  const resolveIndex = (target: number): NavigateResult => {
    const scanned = scanArrayUntilIndexOrCloser(target);
    if (scanned.found) {
      return located("array", scanner.getTokenOffset(), scanned.lastSeparatorComma);
    }
    return scanned.index <= target
      ? NavigateResult.cases.Insert.make({
          container: "array",
          at: scanned.lastValueEndInContainer,
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
