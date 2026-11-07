/**
 * Span-anchored claim elements and the determiner-bearing terms they recite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import { constant, flow, identity } from "effect/Function";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";
import type * as SchemaAST from "effect/SchemaAST";

const $I = $LawPracticeDomainId.create("values/ClaimElement/ClaimElement.model");

/**
 * Ordinal address of one claim element, rooted at its claim number.
 *
 * **Details**
 *
 * The first dot-separated segment is the claim number, so a path is a
 * document-wide address: `1` names claim 1's preamble subject, `1.b` its second
 * limitation, `1.b.ii` a sub-limitation of it. Later segments are lowercase
 * letters, roman numerals, or digits, matching how the claim numbers its own
 * subparagraphs. Cross-claim references use the path alone because its root
 * already names the claim.
 *
 * **Example** (Decode a sub-limitation path)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ClaimElementPath } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * const path = Effect.runSync(S.decodeUnknownEffect(ClaimElementPath)("1.b.ii"))
 * console.log(path) // "1.b.ii"
 * console.log(S.is(ClaimElementPath)("b.ii")) // false
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ClaimElementPath = S.String.check(
  S.isPattern(
    /^[1-9][0-9]*(?:\.[a-z0-9]+)*$/u,
    $I.annote("ClaimElementPathPatternCheck", {
      title: "Claim element path",
      description: "A claim number followed by zero or more dot-separated lowercase letter, roman, or digit segments.",
      message: "Claim element paths start with a positive claim number, e.g. 1, 1.b, or 1.b.ii.",
    })
  )
).pipe(
  S.brand("ClaimElementPath"),
  $I.annoteSchema("ClaimElementPath", {
    description: "Ordinal claim element address rooted at its claim number, e.g. 1.b.ii.",
  })
);

/**
 * Branded path type produced by {@link ClaimElementPath}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimElementPath = typeof ClaimElementPath.Type;

/**
 * Claim number a {@link ClaimElementPath} is rooted at.
 *
 * **Details**
 *
 * The path pattern guarantees a positive integer root, so the parse cannot
 * fail for a decoded path; the `0` fallback is unreachable.
 *
 * **Example** (Read the claim number of a path)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ClaimElementPath, claimNumberOfPath } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * const path = Effect.runSync(S.decodeUnknownEffect(ClaimElementPath)("12.b.ii"))
 * console.log(claimNumberOfPath(path)) // 12
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const claimNumberOfPath: (path: ClaimElementPath) => number = flow(
  Str.split("."),
  A.headNonEmpty,
  N.parse,
  O.getOrElse(constant(0))
);

/**
 * Role an element plays in the claim's structure.
 *
 * **Example** (Inspect element kinds)
 *
 * ```ts
 * import { ClaimElementKind } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * console.log(ClaimElementKind.is["preamble-subject"]("preamble-subject")) // true
 * console.log(ClaimElementKind.literals.length) // 4
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ClaimElementKind = LiteralKit([
  "preamble-subject",
  "limitation",
  "sub-limitation",
  "functional-relation",
]).pipe(
  $I.annoteSchema("ClaimElementKind", {
    description: "Preamble subject, limitation, nested sub-limitation, or functional relation between terms.",
  })
);

/**
 * Runtime element kind produced by {@link ClaimElementKind}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimElementKind = typeof ClaimElementKind.Type;

/**
 * Determiner that opens a claim term, which decides whether it introduces or refers back.
 *
 * **Details**
 *
 * `a`, `an`, `at-least-one`, and `plurality-of` introduce a term; `the` and
 * `said` refer back to an earlier introduction; `bare` marks a term recited
 * without any determiner.
 *
 * **Example** (Inspect determiners)
 *
 * ```ts
 * import { ClaimTermDeterminer } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * console.log(ClaimTermDeterminer.is.said("said")) // true
 * console.log(ClaimTermDeterminer.is.bare("the")) // false
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ClaimTermDeterminer = LiteralKit(["a", "an", "the", "said", "at-least-one", "plurality-of", "bare"]).pipe(
  $I.annoteSchema("ClaimTermDeterminer", {
    description: "Determiner opening a claim term: introducing, referring back, or bare.",
  })
);

/**
 * Runtime determiner produced by {@link ClaimTermDeterminer}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimTermDeterminer = typeof ClaimTermDeterminer.Type;

/**
 * Normalized head noun phrase a claim term names, without its determiner.
 *
 * **Details**
 *
 * Normalized means lowercase, trimmed, and single-spaced, so "the Optical
 * Sensor" and "an optical  sensor" share the head `optical sensor`.
 *
 * **Example** (Check normalization)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ClaimTermHead } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * console.log(S.is(ClaimTermHead)("optical sensor")) // true
 * console.log(S.is(ClaimTermHead)("Optical  sensor")) // false
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ClaimTermHead = S.String.check(
  S.isPattern(
    /^\S+(?: \S+)*$/u,
    $I.annote("ClaimTermHeadSpacingCheck", {
      title: "Single-spaced head",
      description: "A non-empty, trimmed head noun phrase with single spaces between words.",
      message: "Claim term heads are trimmed and single-spaced.",
    })
  ),
  S.isLowercased(
    $I.annote("ClaimTermHeadCaseCheck", {
      title: "Lowercase head",
      description: "A head noun phrase normalized to lowercase.",
      message: "Claim term heads are lowercase.",
    })
  )
).pipe(
  $I.annoteSchema("ClaimTermHead", {
    description: "Lowercase, trimmed, single-spaced head noun phrase of a claim term.",
  })
);

/**
 * Runtime head type produced by {@link ClaimTermHead}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimTermHead = typeof ClaimTermHead.Type;

/**
 * Lowercase surface words that open each claim term determiner, longest
 * surface first.
 *
 * **Details**
 *
 * This is the single surface table shared by the claim decomposer and the
 * {@link ClaimTerm} quote check. A surface counts only when whitespace
 * separates each of its words and follows the last one, so `a+b` and
 * `the+x` open no determiner. Possessive surfaces such as `its` stay `bare`.
 *
 * **Example** (Find the surface that opens a quote)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import { claimTermDeterminerSurfaces } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * const found = A.findFirst(claimTermDeterminerSurfaces, ([words]) => A.join(words, " ") === "at least one")
 * console.log(found) // Option.some([["at", "least", "one"], "at-least-one"])
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const claimTermDeterminerSurfaces: ReadonlyArray<
  readonly [words: A.NonEmptyReadonlyArray<string>, determiner: ClaimTermDeterminer]
> = [
  [["at", "least", "one"], "at-least-one"],
  [["one", "or", "more"], "at-least-one"],
  [["a", "plurality", "of"], "plurality-of"],
  [["plurality", "of"], "plurality-of"],
  [["an"], "an"],
  [["a"], "a"],
  [["the"], "the"],
  [["said"], "said"],
  // Preserve unsupported possessives as spans; the policy abstains explicitly.
  [["each"], "bare"],
  [["its"], "bare"],
  [["their"], "bare"],
];

// Words of one surface may be separated by any whitespace run, matching the scanner.
const determinerSurfacePatterns = A.map(
  claimTermDeterminerSurfaces,
  ([words, determiner]): readonly [RegExp, ClaimTermDeterminer] => [
    new RegExp(`^${A.join(words, "\\s+")}\\s`, "u"),
    determiner,
  ]
);

// The determiner a lowercase quote opens with; a quote opening with no surface is bare.
const quoteDeterminer = (quote: string): ClaimTermDeterminer =>
  O.getOrElse(
    O.map(
      A.findFirst(determinerSurfacePatterns, ([pattern]) => O.isSome(Str.match(pattern)(quote))),
      ([, determiner]) => determiner
    ),
    constant(ClaimTermDeterminer.Enum.bare)
  );

// The surface text each determiner recites, used to build schema-derived terms.
const determinerSurfaceText: { readonly [K in ClaimTermDeterminer]: string } = {
  a: "a ",
  an: "an ",
  the: "the ",
  said: "said ",
  "at-least-one": "at least one ",
  "plurality-of": "a plurality of ",
  bare: "",
};

// Keep a generated head short enough for its quote, and never let it open with
// a determiner word, so a bare term's quote recites none.
const arbitraryHead = (head: string): string =>
  Str.replace(/^(a|an|the|said|at|one|plurality)(?=\s|$)/u, "x$1")(Str.trim(Str.slice(0, 200)(head)));

const ClaimTermDeterminerSurfaceCheck = S.makeFilter(
  ({ anchor, determiner }: { readonly anchor: TextAnchor; readonly determiner: ClaimTermDeterminer }): boolean =>
    quoteDeterminer(Str.toLowerCase(anchor.quote)) === determiner,
  $I.annote("ClaimTermDeterminerSurfaceCheck", {
    title: "Determiner matches the quote",
    description: "The term's quote opens with its determiner's surface; a bare term opens with no determiner.",
    message: "A claim term's determiner must match how its quote opens, e.g. the for 'the sensor'.",
  })
);

/**
 * One determiner-bearing noun phrase recited in a claim element.
 *
 * **Details**
 *
 * `anchor` covers the full surface phrase, determiner included, as a
 * char-exact range of the owning claim's `claimText`.
 *
 * **Example** (Decode an introducing term)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ClaimTerm } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * const term = Effect.runSync(
 *   S.decodeUnknownEffect(ClaimTerm)({
 *     anchor: { startChar: 20, endChar: 37, quote: "an optical sensor" },
 *     determiner: "an",
 *     head: "optical sensor"
 *   })
 * )
 * console.log(term.head) // "optical sensor"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ClaimTerm extends S.Class<ClaimTerm, { readonly brand: unique symbol }>($I`ClaimTerm`)(
  S.Struct({
    anchor: TextAnchor.annotateKey({
      description: "Char-exact span of the whole term, determiner included, in the claim text.",
    }),
    determiner: ClaimTermDeterminer.annotateKey({
      description: "Determiner opening the term, or bare when none is recited.",
    }),
    head: ClaimTermHead.annotateKey({
      description: "Normalized head noun phrase without the determiner.",
    }),
  }).check(ClaimTermDeterminerSurfaceCheck),
  $I.annote("ClaimTerm", {
    toCodecArbitrary: (): SchemaAST.Link =>
      S.link<ClaimTerm>()(
        S.Struct({ anchor: TextAnchor, determiner: ClaimTermDeterminer, head: ClaimTermHead }),
        SchemaTransformation.transform({
          decode: ({ anchor: { startChar }, determiner, head }) => {
            const safeHead = arbitraryHead(head);
            const quote = `${determinerSurfaceText[determiner]}${safeHead}`;
            return ClaimTerm.make({
              anchor: TextAnchor.make({ startChar, endChar: S.Natural.make(startChar + Str.length(quote)), quote }),
              determiner,
              head: safeHead,
            });
          },
          encode: identity,
        })
      ),
    description: "Span-anchored determiner and normalized head noun phrase recited in a claim element.",
  })
) {}

/**
 * Companion namespace for {@link ClaimTerm}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ClaimTerm {
  /**
   * Wire-encoded representation of a decoded {@link ClaimTerm}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ClaimTerm.Encoded;
}

/**
 * Address of one term: the element that recites it and its exact span.
 *
 * **Details**
 *
 * Terms within an element never overlap, so the element path plus the span
 * names one term without a positional index. The anchor indexes the claim
 * text of the claim the path is rooted at.
 *
 * **Example** (Decode a term reference)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ClaimTermRef } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * const ref = Effect.runSync(
 *   S.decodeUnknownEffect(ClaimTermRef)({
 *     path: "2",
 *     anchor: { startChar: 30, endChar: 48, quote: "the optical sensor" }
 *   })
 * )
 * console.log(ref.anchor.quote) // "the optical sensor"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ClaimTermRef extends S.Opaque<ClaimTermRef, { readonly brand: unique symbol }>()(
  S.Struct({
    path: ClaimElementPath.annotateKey({
      description: "Path of the element that recites the term; its root names the claim.",
    }),
    anchor: TextAnchor.annotateKey({
      description: "Char-exact span of the term in the claim text of the path's root claim.",
    }),
  }).pipe(
    $I.annoteSchema("ClaimTermRef", {
      description: "Reference to one claim term by its element path and exact span.",
    })
  )
) {}

/**
 * Companion namespace for {@link ClaimTermRef}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ClaimTermRef {
  /**
   * Wire-encoded representation of a decoded {@link ClaimTermRef}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ClaimTermRef.Encoded;
}

/**
 * One span-anchored element of a claim with the terms it recites.
 *
 * **Example** (Decode a limitation)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ClaimElement } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * const element = Effect.runSync(
 *   S.decodeUnknownEffect(ClaimElement)({
 *     path: "1.a",
 *     anchor: { startChar: 20, endChar: 37, quote: "an optical sensor" },
 *     kind: "limitation",
 *     terms: [
 *       {
 *         anchor: { startChar: 20, endChar: 37, quote: "an optical sensor" },
 *         determiner: "an",
 *         head: "optical sensor"
 *       }
 *     ]
 *   })
 * )
 * console.log(element.kind) // "limitation"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ClaimElement extends S.Opaque<ClaimElement, { readonly brand: unique symbol }>()(
  S.Struct({
    path: ClaimElementPath.annotateKey({
      description: "Ordinal path of the element, rooted at its claim number.",
    }),
    anchor: TextAnchor.annotateKey({
      description: "Char-exact span of the element in the claim text.",
    }),
    kind: ClaimElementKind.annotateKey({
      description: "Structural role of the element in the claim.",
    }),
    terms: S.Array(ClaimTerm).annotateKey({
      description: "Determiner-bearing terms recited in the element, in text order.",
    }),
  }).pipe(
    $I.annoteSchema("ClaimElement", {
      description: "Span-anchored claim element with its ordinal path, structural kind, and recited terms.",
    })
  )
) {}

/**
 * Companion namespace for {@link ClaimElement}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ClaimElement {
  /**
   * Wire-encoded representation of a decoded {@link ClaimElement}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ClaimElement.Encoded;
}
