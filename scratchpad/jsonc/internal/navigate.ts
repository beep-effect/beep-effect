/**
 * Scanner-based path navigation for the modifier. Private implementation.
 *
 * **Details**
 *
 * Resolves a {@link JsoncPath} through scanner tokens rather than a
 * `lastIndexOf('"segment"')` search of the raw text, so keys containing quote
 * characters are located from the key token itself. Returns a plain
 * structural result; {@link JsoncModifier} synthesizes edits and constructs
 * {@link JsoncModificationError} from it, so this module never imports the
 * facade or the edit vocabulary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import * as O from "@beep/utils/Option";
import { Schema } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import type { JsoncPath } from "../JsoncNode.ts";
import { createScanner } from "./scanner.ts";
import type { SkipCursor } from "./skip.ts";
import { skipBalancedValue } from "./skip.ts";

const $I = $ScratchpadId.create("jsonc/internal/navigate");

/**
 * The target property/element was located.
 *
 * **Example** (Construct a located object member)
 *
 * ```ts
 * import { Located } from "../../../jsonc/internal/navigate.ts"
 *
 * const result = Located.make({ container: "object", keyStart: 2, valueStart: 10, valueEnd: 14 })
 * console.log(result._tag) // "Located"
 * ```
 *
 * @see {@link navigate} for the function that produces this variant.
 * @see {@link NavigateResult} for the closed result union.
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const Located = Schema.TaggedStruct("Located", {
  container: Schema.Literals(["object", "array"]),
  /** Start offset of the property key (object) or the element value (array). */
  keyStart: Schema.Finite,
  /** Start offset of the value token. */
  valueStart: Schema.Finite,
  /** Tight end offset of the value (excludes trailing whitespace/comments). */
  valueEnd: Schema.Finite,
  /**
   * Offset of the separator comma preceding this entry in its container, or
   * undefined when the entry is first. Captured from the comma token itself so
   * edit synthesis never searches raw text (commas inside comments are
   * invisible here).
   */
  commaBefore: Schema.optionalKey(Schema.Finite),
  /** Offset of the comma token immediately following the value, if any. */
  commaAfter: Schema.optionalKey(Schema.Finite),
}).pipe(
  $I.annoteSchema("Located", {
    description: "A JSONC navigation result locating an existing object member or array element.",
  })
);

/**
 * Decoded located navigation result.
 *
 * @see {@link Located} for the runtime schema.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type Located = typeof Located.Type;

/**
 * The target does not exist; an insertion point was resolved instead.
 *
 * **Example** (Construct an insertion point)
 *
 * ```ts
 * import { Insert } from "../../../jsonc/internal/navigate.ts"
 *
 * const result = Insert.make({ container: "array", at: 1, isFirst: true, depth: 1 })
 * console.log(result._tag) // "Insert"
 * ```
 *
 * @see {@link navigate} for the function that produces this variant.
 * @see {@link NavigateResult} for the closed result union.
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const Insert = Schema.TaggedStruct("Insert", {
  container: Schema.Literals(["object", "array"]),
  /** Offset at which new content should be inserted. */
  at: Schema.Finite,
  /** Whether the container is empty (affects surrounding punctuation). */
  isFirst: Schema.Boolean,
  /** Depth of the insertion (path length) for indentation. */
  depth: Schema.Finite,
}).pipe(
  $I.annoteSchema("Insert", {
    description: "A JSONC navigation result locating an insertion point in an object or array.",
  })
);

/**
 * Decoded insertion-point navigation result.
 *
 * @see {@link Insert} for the runtime schema.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type Insert = typeof Insert.Type;

/**
 * A structural type mismatch: expected an object or array but found otherwise.
 *
 * **Example** (Construct a container mismatch)
 *
 * ```ts
 * import { Mismatch } from "../../../jsonc/internal/navigate.ts"
 *
 * const result = Mismatch.make({ depth: 1, expected: "object" })
 * console.log(result.expected) // "object"
 * ```
 *
 * @see {@link navigate} for the function that produces this variant.
 * @see {@link NavigateResult} for the closed result union.
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const Mismatch = Schema.TaggedStruct("Mismatch", {
  depth: Schema.Finite,
  expected: Schema.Literals(["object", "array"]),
}).pipe(
  $I.annoteSchema("Mismatch", {
    description: "A JSONC navigation result describing an object-versus-array container mismatch.",
  })
);

/**
 * Decoded mismatch navigation result.
 *
 * @see {@link Mismatch} for the runtime schema.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type Mismatch = typeof Mismatch.Type;

/**
 * Nothing to resolve (for example navigating an empty path segment set).
 *
 * **Example** (Construct the no-op variant)
 *
 * ```ts
 * import { NoOp } from "../../../jsonc/internal/navigate.ts"
 *
 * console.log(NoOp.make({})._tag) // "NoOp"
 * ```
 *
 * @see {@link navigate} for the function that produces this variant.
 * @see {@link NavigateResult} for the closed result union.
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const NoOp = Schema.TaggedStruct("NoOp", {}).pipe(
  $I.annoteSchema("NoOp", {
    description: "A JSONC navigation result for an empty path that requires no navigation.",
  })
);

/**
 * Decoded no-op navigation result.
 *
 * @see {@link NoOp} for the runtime schema.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type NoOp = typeof NoOp.Type;

/**
 * The outcome of navigating a {@link JsoncPath} through JSONC source.
 *
 * **Example** (Guard a navigation result)
 *
 * ```ts
 * import { NavigateResult, NoOp } from "../../../jsonc/internal/navigate.ts"
 * import { Schema } from "effect"
 *
 * console.log(Schema.is(NavigateResult)(NoOp.make({}))) // true
 * ```
 *
 * @see {@link navigate} for the function that returns this union.
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const NavigateResult = Schema.Union([Located, Insert, Mismatch, NoOp]).pipe(
  $I.annoteSchema("NavigateResult", {
    description: "The closed located, insert, mismatch, or no-op result of JSONC path navigation.",
  })
);

/**
 * Decoded JSONC navigation result.
 *
 * @see {@link NavigateResult} for the runtime schema.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type NavigateResult = typeof NavigateResult.Type;

/**
 * Resolve `path` against `text`, returning where the target is (or where it
 * would be inserted). `path` must be non-empty — the whole-document case is
 * handled by the caller.
 *
 * **Example** (Locate, insert-miss, and mismatch)
 *
 * ```ts
 * import { navigate } from "../../../jsonc/internal/navigate.ts";
 *
 * const located = navigate('{ "port": 3000 }', ["port"]);
 * console.log(located._tag); // "Located"
 *
 * const insert = navigate('{ "port": 3000 }', ["host"]);
 * console.log(insert._tag); // "Insert"
 *
 * const mismatch = navigate("[1, 2]", ["port"]);
 * console.log(mismatch._tag); // "Mismatch"
 * ```
 *
 * @see {@link NavigateResult} for the `Located` / `Insert` / `Mismatch` / `NoOp` union.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const navigate: {
  (text: string, path: JsoncPath): NavigateResult;
  (path: JsoncPath): (text: string) => NavigateResult;
} = dual(2, (text: string, path: JsoncPath): NavigateResult => {
  if (path.length === 0) {
    return NoOp.make({});
  }

  const scanner = createScanner(text, true);
  let currentToken = scanner.scan();

  // Tight end-of-token offset for the CURRENT token. Because this scanner
  // ignores trivia, scan() silently skips whitespace when advancing, so
  // getTokenOffset() after advancing is the start of the NEXT token; capture
  // this value before advancing.
  function tokenEnd(): number {
    return scanner.getTokenOffset() + scanner.getTokenLength();
  }

  // Cursor adapter for the shared iterative bracket-balance skip (see
  // internal/skip.ts). Being non-recursive, the skip cannot overflow the
  // stack on hostile deeply-nested input, so `navigate` (and `JsoncModifier`)
  // need no separate depth cap. Malformed input can route a non-value token
  // here (JsoncModifier.modify passes raw text straight to navigate(), so a
  // value slot may hold a closer, e.g. `{"k":}`) — the helper's guard leaves
  // the cursor untouched in that case.
  const skipCursor: SkipCursor = {
    getToken: () => currentToken,
    advance: () => {
      currentToken = scanner.scan();
    },
    tokenStart: () => scanner.getTokenOffset(),
    tokenEnd,
  };

  // Skip the value starting at currentToken and return its tight end offset.
  function skipValue(): number {
    return skipBalancedValue(skipCursor);
  }

  let depth = 0;
  for (const segment of path) {
    depth++;
    if (P.isString(segment)) {
      if (currentToken !== "OpenBrace") {
        return Mismatch.make({ depth, expected: "object" });
      }
      currentToken = scanner.scan();
      let found = false;
      let lastValueEnd = scanner.getTokenOffset();
      let isFirst = true;
      let lastComma: number | undefined;

      while (currentToken !== "CloseBrace" && currentToken !== "EOF") {
        if (!isFirst && currentToken === "Comma") {
          lastComma = scanner.getTokenOffset();
          currentToken = scanner.scan();
        }
        if (currentToken === "String") {
          const keyStart = scanner.getTokenOffset();
          const key = scanner.getTokenValue();
          currentToken = scanner.scan(); // skip key
          if (currentToken === "Colon") {
            currentToken = scanner.scan(); // skip colon
          }
          if (key === segment) {
            found = true;
            if (depth === path.length) {
              const valueStart = scanner.getTokenOffset();
              const valueEnd = skipValue();
              const commaAfter = currentToken === "Comma" ? scanner.getTokenOffset() : undefined;
              return Located.make({
                container: "object",
                keyStart,
                valueStart,
                valueEnd,
                ...O.getSomesStruct({
                  commaBefore: O.fromUndefinedOr(lastComma),
                  commaAfter: O.fromUndefinedOr(commaAfter),
                }),
              });
            }
            break; // descend into this value on the next segment
          }
          lastValueEnd = skipValue();
        } else {
          currentToken = scanner.scan();
          lastValueEnd = scanner.getTokenOffset();
        }
        isFirst = false;
      }

      if (!found && depth === path.length) {
        return Insert.make({
          container: "object",
          at: lastValueEnd,
          isFirst,
          depth,
        });
      }
      // Intermediate miss: fall through to the next segment, where the
      // closing brace token will fail the OpenBrace/OpenBracket check.
    } else {
      if (currentToken !== "OpenBracket") {
        return Mismatch.make({ depth, expected: "array" });
      }
      currentToken = scanner.scan();
      let idx = 0;
      let lastEnd = scanner.getTokenOffset();
      let lastComma: number | undefined;

      while (currentToken !== "CloseBracket" && currentToken !== "EOF") {
        if (idx > 0 && currentToken === "Comma") {
          lastComma = scanner.getTokenOffset();
          currentToken = scanner.scan();
        }
        if (idx === segment) {
          if (depth === path.length) {
            const valueStart = scanner.getTokenOffset();
            const valueEnd = skipValue();
            const commaAfter = currentToken === "Comma" ? scanner.getTokenOffset() : undefined;
            return Located.make({
              container: "array",
              keyStart: valueStart,
              valueStart,
              valueEnd,
              ...O.getSomesStruct({
                commaBefore: O.fromUndefinedOr(lastComma),
                commaAfter: O.fromUndefinedOr(commaAfter),
              }),
            });
          }
          break; // descend into this element on the next segment
        }
        lastEnd = skipValue();
        idx++;
      }

      if (idx <= segment && depth === path.length) {
        return Insert.make({
          container: "array",
          at: lastEnd,
          isFirst: idx === 0,
          depth,
        });
      }
    }
  }

  return NoOp.make({});
});
