/**
 * Pure claim-element decomposer: its contract and the deterministic rule set
 * that binds to it.
 *
 * **Details**
 *
 * `decomposeClaim` splits a claim into its preamble subject, body
 * limitations and colon sub-limitations, scans each element for
 * determiner-bearing terms, and links them with `part-of`,
 * `depends-on-element` and intra-claim `antecedent` edges. Functional
 * relations preserve ordered terms and connecting source spans.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { constant, dual, flow, identity, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PatentClaim } from "../PatentDocument/PatentDocument.model.ts";
import { qualifyClaimInput } from "../PatentDocument/PatentDocument.normalizer.ts";
import { ClaimDecompositionError } from "./ClaimElement.errors.ts";
import { ClaimInputQualification } from "./ClaimElement.input.model.ts";
import { ClaimInputDecomposition } from "./ClaimElement.inspection.model.ts";
import { ClaimTermDeterminer } from "./ClaimElement.model.ts";
import { ClaimElementTree } from "./ClaimElement.tree.model.ts";
import {
  isCountedHead,
  isDesignatedHead,
  isExplicitAbbreviatedHead,
  isPluralityReferenceHead,
  isSingleModifiedHead,
  pluralityReferenceContent,
} from "./ClaimTerm.compatibility.ts";
import type { PatentClaims } from "../PatentDocument/PatentDocument.model.ts";
import type { ClaimElementEdge, ClaimFunctionalPart } from "./ClaimElement.edge.model.ts";
import type { ClaimInputCollection } from "./ClaimElement.input.model.ts";
import type { ClaimElement, ClaimElementKind, ClaimTerm } from "./ClaimElement.model.ts";

const $I = $LawPracticeDomainId.create("values/ClaimElement/ClaimElement.behavior");

/**
 * Determiners that introduce a new claim term rather than refer back to one.
 *
 * **Example** (Classify introducing determiners)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ClaimTermIntroducingDeterminer } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * console.log(S.is(ClaimTermIntroducingDeterminer)("plurality-of")) // true
 * console.log(S.is(ClaimTermIntroducingDeterminer)("the")) // false
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ClaimTermIntroducingDeterminer = ClaimTermDeterminer.pick([
  "a",
  "an",
  "at-least-one",
  "plurality-of",
]).pipe(
  $I.annoteSchema("ClaimTermIntroducingDeterminer", {
    description: "Determiner that introduces a claim term: a, an, at-least-one, or plurality-of.",
  })
);

/**
 * Runtime determiner produced by {@link ClaimTermIntroducingDeterminer}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimTermIntroducingDeterminer = typeof ClaimTermIntroducingDeterminer.Type;

/**
 * Determiners that refer back to an earlier introduction and so need antecedent basis.
 *
 * **Example** (Classify referring determiners)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ClaimTermReferringDeterminer } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * console.log(S.is(ClaimTermReferringDeterminer)("said")) // true
 * console.log(S.is(ClaimTermReferringDeterminer)("an")) // false
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ClaimTermReferringDeterminer = ClaimTermDeterminer.pick(["the", "said"]).pipe(
  $I.annoteSchema("ClaimTermReferringDeterminer", {
    description: "Determiner that refers back to an earlier claim term: the or said.",
  })
);

/**
 * Runtime determiner produced by {@link ClaimTermReferringDeterminer}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimTermReferringDeterminer = typeof ClaimTermReferringDeterminer.Type;

const isIntroducingDeterminer = S.is(ClaimTermIntroducingDeterminer);
const isReferringDeterminer = S.is(ClaimTermReferringDeterminer);

/**
 * Pure decomposition of one normalized patent claim into its claim-element tree.
 *
 * **Details**
 *
 * The second argument is the document's whole validated claim set. It is the
 * context the claim is read in: a dependent claim's `claimReferences` resolve
 * against it, which is how `depends-on-element` edges reach earlier claims.
 * The claim itself must be a member of that set.
 *
 * An implementation is pure and deterministic: the same claim and claim set
 * always give the same tree. Its requirements channel is `never`, so it reads
 * no services, files, configuration or clock. It fails only when no tree can
 * be built at all ({@link ClaimDecompositionError}); phrasing no rule covers
 * still yields a tree, and the antecedent policy reports it as
 * `pattern-not-covered`.
 *
 * **Example** (Bind a decomposer that refuses every claim)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ClaimDecompositionError } from "@beep/law-practice-domain/values/ClaimElement"
 * import type { ClaimElementDecomposer } from "@beep/law-practice-domain/values/ClaimElement"
 * import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 *
 * const refuse: ClaimElementDecomposer = (claim) =>
 *   Effect.fail(
 *     ClaimDecompositionError.make({
 *       claimNumber: claim.claimNumber,
 *       message: `Claim ${claim.claimNumber} has no segmentable structure.`,
 *       reason: "unsupported-claim-text"
 *     })
 *   )
 *
 * const claim = PatentClaim.cases.independent.make({
 *   body: "a sensor",
 *   claimNumber: PosInt.make(1),
 *   claimText: "A system comprising a sensor.",
 *   preamble: "A system",
 *   transition: "comprising"
 * })
 * const exit = Effect.runSyncExit(refuse(claim, [claim]))
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ClaimElementDecomposer = (
  claim: PatentClaim,
  claims: PatentClaims
) => Effect.Effect<ClaimElementTree, ClaimDecompositionError>;

/** A run of claim text and its absolute offset into `claimText`. */
type Span = { readonly start: number; readonly text: string };

// Inspection-only construction state. Public tree and PatentClaim shapes stay unchanged.
class ColonHeaderSpan extends S.Opaque<ColonHeaderSpan, { readonly brand: unique symbol }>()(
  S.Struct({ start: S.Int.check(S.isGreaterThanOrEqualTo(0)), text: S.String }).pipe(
    $I.annoteSchema("ColonHeaderSpan", {
      description: "Original source span used only for a colon container's lexical ownership.",
    })
  )
) {}
class ColonScopeLabel extends S.Opaque<ColonScopeLabel, { readonly brand: unique symbol }>()(
  S.Struct({ style: S.Literals(["parenthesized", "suffix", "step"]), value: S.NonEmptyString }).pipe(
    $I.annoteSchema("ColonScopeLabel", {
      description: "Explicit source enumeration label; only a consecutive peer label closes its matching colon scope.",
    })
  )
) {}
class ColonScopeNode extends S.Opaque<ColonScopeNode, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.NonEmptyString,
    parent: S.NonEmptyString,
    header: ColonHeaderSpan,
    endChar: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    group: S.Boolean,
    label: S.Option(ColonScopeLabel),
  }).pipe(
    $I.annoteSchema("ColonScopeNode", {
      description:
        "Inspection node with distinct header lexical ownership and full group extent, plus its explicit source label.",
    })
  )
) {}

class ColonScopeState extends S.Opaque<ColonScopeState, { readonly brand: unique symbol }>()(
  S.Struct({ nodes: S.Array(ColonScopeNode), stack: S.Array(S.Int.check(S.isGreaterThanOrEqualTo(0))) }).pipe(
    $I.annoteSchema("ColonScopeState", {
      description:
        "Ordered inspection nodes and active ancestor container positions during source-only scope construction.",
    })
  )
) {}

type EncodedTerm = typeof ClaimTerm.Encoded;
type EncodedElement = typeof ClaimElement.Encoded;
type EncodedEdge = typeof ClaimElementEdge.Encoded;

const sliceSpan = (span: Span, from: number, to = Str.length(span.text)): Span => ({
  start: span.start + from,
  text: Str.slice(from, to)(span.text),
});

const trimSpan = (span: Span): Span =>
  sliceSpan(span, Str.length(span.text) - Str.length(Str.trimStart(span.text)), Str.length(Str.trimEnd(span.text)));

const dropPrefix =
  (prefixes: ReadonlyArray<string>) =>
  (span: Span): Span =>
    pipe(
      A.findFirst(prefixes, (prefix) => Str.startsWith(prefix)(span.text)),
      O.map((prefix) => sliceSpan(span, Str.length(prefix))),
      O.getOrElse(() => span)
    );

const dropSuffix =
  (suffixes: ReadonlyArray<string>) =>
  (span: Span): Span =>
    pipe(
      A.findFirst(suffixes, (suffix) => Str.endsWith(suffix)(span.text)),
      O.map((suffix) => sliceSpan(span, 0, Str.length(span.text) - Str.length(suffix))),
      O.getOrElse(() => span)
    );

const anchorOf = ({ start, text }: Span): EncodedTerm["anchor"] => ({
  startChar: start,
  endChar: start + Str.length(text),
  quote: text,
});

const matchesIn =
  (pattern: RegExp) =>
  (span: Span): ReadonlyArray<Span> =>
    A.getSomes(
      A.map(A.fromIterable(Str.matchAll(pattern)(span.text)), (match) =>
        O.map(O.fromUndefinedOr(match.index), (index) => ({ start: span.start + index, text: match[0] }))
      )
    );

const indexFrom = (text: string, search: string, from: number): O.Option<number> =>
  O.map(Str.indexOf(Str.toLowerCase(search))(Str.toLowerCase(Str.slice(from)(text))), (index) => from + index);

// Forward cursor: preamble, then transition, then body, each searched from the end of the previous part.
const locateParts = ({
  claimText,
  preamble,
  body,
  claimType,
  transition,
}: PatentClaim): O.Option<{ readonly preamble: Span; readonly body: Span }> =>
  O.flatMap(indexFrom(claimText, preamble, 0), (preambleStart) =>
    pipe(
      O.some(preambleStart + Str.length(preamble)),
      O.flatMap((preambleEnd) => indexFrom(claimText, body, preambleEnd)),
      O.filter(
        (bodyStart) =>
          O.isSome(
            Str.match(
              /\b(?:consisting essentially of|consisting of|comprising|comprises|comprised of|including|includes|having|wherein|where|(?:(?:is|being)\s+)?characteri[sz]ed (?:in that|by(?: the fact that| the steps of)?)|in which(?: method)?)\b/iu
            )(Str.slice(preambleStart + Str.length(preamble), bodyStart)(claimText))
          ) ||
          (claimType === "dependent" &&
            transition === "wherein" &&
            O.isSome(Str.match(/^\s*,\s*$/u)(Str.slice(preambleStart + Str.length(preamble), bodyStart)(claimText))))
      ),
      O.map((bodyStart) => ({
        preamble: { start: preambleStart, text: preamble },
        body: { start: bodyStart, text: body },
      }))
    )
  );

// Top-level separators: `;` ends a segment and is dropped; a `:` followed by
// whitespace or the end of the body ends a segment and stays with it.
const separatorPattern = /[,;()[\]]|:(?=\s|$)/gu;
const clauseStartPattern =
  /^(?:and\s+|or\s+)?(?:wherein\b|(?:the|said|an?|at least one|one or more)\s+[^,;]*?\b(?:is|are|has|have|comprises|includes|forms|acts|passes|describes|generates)\b|(?:creating|encoding|generating|transmitting|receiving|flushing|placing|threading|stretching|turning)\b)/iu;

const splitAtSeparators = (body: Span, separators: ReadonlyArray<Span>): ReadonlyArray<Span> => {
  const split = A.reduce(separators, { depth: 0, from: 0, segments: A.empty<Span>() }, (state, mark) =>
    Match.value(mark.text).pipe(
      Match.whenOr("(", "[", () => ({ ...state, depth: state.depth + 1 })),
      Match.whenOr(")", "]", () => ({ ...state, depth: Num.max(0, state.depth - 1) })),
      Match.orElse((separator) => {
        const at = mark.start - body.start;
        const end = separator === ":" ? at + 1 : at;
        const isClauseComma =
          separator !== "," || O.isSome(Str.match(clauseStartPattern)(Str.trimStart(Str.slice(at + 1)(body.text))));
        return state.depth > 0 || !isClauseComma
          ? state
          : { depth: 0, from: at + 1, segments: A.append(state.segments, sliceSpan(body, state.from, end)) };
      })
    )
  );
  return A.append(split.segments, sliceSpan(body, split.from));
};

const splitBody = (body: Span): ReadonlyArray<Span> => splitAtSeparators(body, matchesIn(separatorPattern)(body));
const isStepLabelSeparator = (body: Span, mark: Span): boolean =>
  (mark.text === "," || mark.text === ":") &&
  O.isSome(
    Str.match(/(?:^|[;:])\s*(?:(?:and|or)\s+)?step\s+[0-9]+$/iu)(Str.slice(0, mark.start - body.start)(body.text))
  );
const splitInspectionBody = (body: Span): ReadonlyArray<Span> => {
  const quotations = matchesIn(quotedPhrasePattern)(body);
  const separators = A.filter(
    matchesIn(separatorPattern)(body),
    (mark) =>
      !isStepLabelSeparator(body, mark) &&
      !A.some(quotations, (quote) => mark.start >= quote.start && mark.start < quote.start + Str.length(quote.text))
  );
  return splitAtSeparators(body, separators);
};

const cleanSegment = flow(
  trimSpan,
  dropPrefix(["and, ", "and ", "or "]),
  trimSpan,
  dropSuffix([";", ".", ", and", ", or", ", respectively", " respectively"]),
  trimSpan
);

const isContentSegment = ({ text }: Span): boolean => Str.isNonEmpty(text) && text !== ":";

const endsWithColon = ({ text }: Span): boolean => Str.endsWith(":")(text);

const alphabet = "abcdefghijklmnopqrstuvwxyz";

// a..z, then aa, ab, ... (bijective base 26).
const letterSegment = (index: number): string =>
  index < 26
    ? Str.slice(index, index + 1)(alphabet)
    : `${letterSegment((index - (index % 26)) / 26 - 1)}${Str.slice(index % 26, (index % 26) + 1)(alphabet)}`;

const romanDigits: ReadonlyArray<readonly [number, string]> = [
  [1000, "m"],
  [900, "cm"],
  [500, "d"],
  [400, "cd"],
  [100, "c"],
  [90, "xc"],
  [50, "l"],
  [40, "xl"],
  [10, "x"],
  [9, "ix"],
  [5, "v"],
  [4, "iv"],
  [1, "i"],
];

const romanSegment = (value: number): string =>
  A.reduce(romanDigits, { rest: value, roman: "" }, ({ rest, roman }, [digit, symbol]) => ({
    rest: rest % digit,
    roman: `${roman}${Str.repeat((rest - (rest % digit)) / digit)(symbol)}`,
  })).roman;

// Only complete paired quotations shield lexical function words.
// Unpaired marks retain ordinary scanning and never suppress the remaining source.
const quotedPhrasePattern = /“[^”]*”|"(?:\\.|[^"\\])*"|‘(?:[^’]|’(?=[\p{L}\p{N}]))*’/gu;
const tokenPattern = /[\p{L}\p{N}]+(?:[-’'/][\p{L}\p{N}]+)*|[“”"‘’]|[,;:.()[\]]/gu;
const digitsPattern = /^[0-9]+$/u;
const punctuation = HashSet.make(",", ";", ":", ".", "(", ")", "[", "]");
const boundaryWords = HashSet.fromIterable(
  Str.split(
    "that which wherein whereby where when whether configured adapted operable arranged having comprising comprises including includes containing contains being is are was were has have to for in on of at by with from into onto between through via and or such so than as each said the a an its their according claim claims they it we them can may shall must should will would be been not apart respectively further out along below above beyond across",
    " "
  )
);
// Closed grammatical separators, not a lexical token cap or suffix guess.
const predicateWords = HashSet.fromIterable(
  Str.split(
    "irradiates switching reconstructs detects indicates controls samples outputs detect provide support accommodate allow allows determines invokes transmits triggering avoiding facing wired operates configuring comprised flushing provides passes determining acts formed couple depressed spaced bending skip start passed received transmitted assigned generated allocated chosen configured adapted operable arranged connected coupled mounted attached positioned located disposed formed extending extends comprises includes contains comprising including containing detects detecting based before after during upon under over near within without until than whose respectively either both such",
    " "
  )
);
const nominalFollowers = HashSet.fromIterable(
  Str.split(
    "unit units condition conditions device devices circuit circuits member members portion portions surface surfaces means system systems apparatus assembly assemblies mechanism mechanisms strip strips rod rods bracket brackets",
    " "
  )
);
const isPurposePredicate = (tokens: ReadonlyArray<Span>, index: number, participle: boolean): boolean =>
  surfaceAt(tokens, index + 1)(["for"]) &&
  (surfaceAt(tokens, index)(["used"]) || (participle && surfaceAt(tokens, index - 1)(["be"])));

const isPredicateToken = (tokens: ReadonlyArray<Span>, index: number): boolean => {
  const current = O.map(A.get(tokens, index), ({ text }) => Str.toLowerCase(text));
  const next = O.map(A.get(tokens, index + 1), ({ text }) => Str.toLowerCase(text));
  const previous = O.map(A.get(tokens, index - 1), ({ text }) => Str.toLowerCase(text));
  const participle = O.exists(
    current,
    (word) => Str.length(word) > 4 && (Str.endsWith("ed")(word) || Str.endsWith("ing")(word))
  );
  const complement = O.exists(next, (word) =>
    HashSet.has(
      HashSet.make("to", "in", "into", "on", "with", "by", "the", "a", "an", "said", "its", "their", "them"),
      word
    )
  );
  const quantifiedObject = A.some(
    [
      ["at", "least", "one"],
      ["one", "or", "more"],
    ],
    surfaceAt(tokens, index + 1)
  );
  const nominal = O.exists(previous, (word) =>
    HashSet.has(HashSet.make("a", "an", "the", "said", "its", "their"), word)
  );
  const finite = O.exists(current, (word) =>
    A.some([word, Str.replace(/s$/u, "")(word), Str.replace(/es$/u, "")(word)], (base) =>
      HashSet.has(
        HashSet.make("display", "extend", "mesh", "embed", "include", "incorporate", "rotate", "go", "generate"),
        base
      )
    )
  );
  const clauseVerb = O.exists(previous, (word) => HashSet.has(HashSet.make("to", "that", "which"), word));
  const purposeParticiple = isPurposePredicate(tokens, index, participle);
  const relational = O.contains(current, "responsive") && O.contains(next, "to");
  const formingInfinitive = O.contains(previous, "to") && O.contains(current, "form");
  return (
    A.some(
      [
        O.exists(current, (word) => HashSet.has(predicateWords, word)),
        finite,
        purposeParticiple,
        relational,
        formingInfinitive,
        participle && (complement || quantifiedObject),
      ],
      identity
    ) &&
    (!O.exists(next, (word) => HashSet.has(nominalFollowers, word)) || clauseVerb) &&
    !nominal
  );
};

// Longest surface first, so "a plurality of" wins over "a".
const determinerSurfaces: ReadonlyArray<readonly [ReadonlyArray<string>, ClaimTermDeterminer]> = [
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

const quantifierSurfaces: ReadonlyArray<ReadonlyArray<string>> = [
  ["at", "least", "one"],
  ["one", "or", "more"],
  ["a", "plurality", "of"],
  ["plurality", "of"],
];

const surfaceAt =
  (tokens: ReadonlyArray<Span>, index: number) =>
  (words: ReadonlyArray<string>): boolean =>
    A.every(words, (word, offset) =>
      O.exists(A.get(tokens, index + offset), ({ text }) => Str.toLowerCase(text) === word)
    );

const determinerAt = (
  tokens: ReadonlyArray<Span>,
  index: number
): O.Option<{ readonly determiner: ClaimTermDeterminer; readonly start: number; readonly width: number }> =>
  O.flatMap(A.get(tokens, index), ({ start }) =>
    O.map(
      A.findFirst(determinerSurfaces, ([words]) => surfaceAt(tokens, index)(words)),
      ([words, determiner]) => ({ determiner, start, width: A.length(words) })
    )
  );

const quantifierWidthAt = (tokens: ReadonlyArray<Span>, index: number): number =>
  pipe(
    A.findFirst(quantifierSurfaces, surfaceAt(tokens, index)),
    O.map(A.length),
    O.getOrElse(() => 0)
  );

// Participial modifiers such as "detecting unit" and "scanning condition"
// belong to the noun phrase. Predicate words end it only outside that context.
const abbreviationAt = (tokens: ReadonlyArray<Span>, index: number): boolean =>
  O.exists(A.get(tokens, index), ({ text }) => text === "(") &&
  O.exists(A.get(tokens, index + 1), ({ text }) => O.isSome(Str.match(/^[A-Z][A-Z0-9-]+$/u)(text))) &&
  O.exists(A.get(tokens, index + 2), ({ text }) => text === ")");

const ordinalWords = HashSet.make(
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth"
);

const continuesHeadAt = (tokens: ReadonlyArray<Span>, position: number): boolean =>
  O.exists(
    A.get(tokens, position),
    ({ text }) => !HashSet.has(boundaryWords, Str.toLowerCase(text)) && !HashSet.has(punctuation, text)
  ) && !isPredicateToken(tokens, position);

const isCoordinatedOrdinal = (tokens: ReadonlyArray<Span>, index: number, offset: number): boolean =>
  offset > 0 &&
  A.every(A.take(A.drop(tokens, index), offset), ({ text }) => HashSet.has(ordinalWords, Str.toLowerCase(text))) &&
  O.exists(A.get(tokens, index + offset + 1), ({ text }) => HashSet.has(ordinalWords, Str.toLowerCase(text)));

const isSelectorHead = (tokens: ReadonlyArray<Span>, index: number): boolean =>
  surfaceAt(tokens, index - 2)(["one", "of"]) && !surfaceAt(tokens, index - 4)(["at", "least"]);

const hasPartitiveHead = (tokens: ReadonlyArray<Span>, index: number, offset: number): boolean =>
  A.some(A.take(A.drop(tokens, index), offset), ({ text }) =>
    HashSet.has(HashSet.make("pair", "set", "group", "series", "number"), Str.toLowerCase(text))
  ) && O.exists(A.get(tokens, index + offset + 1), ({ text }) => !HashSet.has(boundaryWords, Str.toLowerCase(text)));

const permitsHeadBoundary = (tokens: ReadonlyArray<Span>, index: number, offset: number, word: string): boolean => {
  const position = index + offset;
  return A.some(
    [
      word === "of" && hasPartitiveHead(tokens, index, offset),
      word === "and" && isCoordinatedOrdinal(tokens, index, offset),
      word === "or" && offset > 0 && continuesHeadAt(tokens, position + 1),
      word === "through" && offset === 0 && surfaceAt(tokens, position + 1)(["hole"]),
      word === "further" && offset === 0 && !isPredicateToken(tokens, position + 1),
    ],
    identity
  );
};

const permitsAdverbHead = (tokens: ReadonlyArray<Span>, position: number, offset: number, word: string): boolean =>
  A.some(
    [!Str.endsWith("ly")(word), Str.endsWith("assembly")(word), offset === 0 && continuesHeadAt(tokens, position + 1)],
    identity
  );

const headAt = (tokens: ReadonlyArray<Span>, index: number, quotations: ReadonlyArray<Span>): ReadonlyArray<Span> =>
  A.takeWhile(A.drop(tokens, index), ({ text, start }, offset) => {
    const word = Str.toLowerCase(text);
    const position = index + offset;
    if (A.some(quotations, (quote) => start >= quote.start && start < quote.start + Str.length(quote.text)))
      return true;
    if (A.some([position, position - 1, position - 2], (at) => abbreviationAt(tokens, at))) return true;
    if (isSelectorHead(tokens, index) && HashSet.has(HashSet.make(",", "or", "and"), word)) return true;
    return (
      !HashSet.has(punctuation, text) &&
      (!HashSet.has(boundaryWords, word) || permitsHeadBoundary(tokens, index, offset, word)) &&
      !isPredicateToken(tokens, position) &&
      permitsAdverbHead(tokens, position, offset, word)
    );
  });

// Inspection grammar plans a source interval and scanner continuation without
// changing the historical strict extractor or the element's syntactic role.
class NominalBoundaryPlan extends S.Opaque<NominalBoundaryPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    headEnd: S.Int,
    resumeAt: S.Int,
    reason: S.Literals([
      "legacy",
      "copular-subject",
      "shared-participle",
      "coordinated-action",
      "relational-complement",
      "possessive-singular-article",
      "possessive-plural-quantity",
      "possessive-regular-singular",
      "possessive-known-plural",
    ]),
  }).pipe(
    $I.annoteSchema("NominalBoundaryPlan", {
      description: "Owned source token interval and continuation justified by an explicit nominal grammar frame.",
    })
  )
) {}
type NominalPlanner = (
  tokens: ReadonlyArray<Span>,
  index: number,
  headStart: number,
  quotations: ReadonlyArray<Span>
) => NominalBoundaryPlan;
const tokenWordAt = (tokens: ReadonlyArray<Span>, index: number): string =>
  O.getOrElse(
    O.map(A.get(tokens, index), ({ text }) => Str.toLowerCase(text)),
    () => ""
  );
const quotedTokenAt = (tokens: ReadonlyArray<Span>, index: number, quotations: ReadonlyArray<Span>): boolean =>
  O.exists(A.get(tokens, index), ({ start }) =>
    A.some(quotations, (quote) => start >= quote.start && start < quote.start + Str.length(quote.text))
  );
const legacyNominalPlan: NominalPlanner = (tokens, _index, headStart, quotations) => {
  const end = headStart + headAt(tokens, headStart, quotations).length;
  return NominalBoundaryPlan.make({ headEnd: end, resumeAt: end, reason: "legacy" });
};
const copulas = HashSet.make("is", "are", "was", "were");
const hardNominalBarrier = (tokens: ReadonlyArray<Span>, index: number, quotations: ReadonlyArray<Span>): boolean =>
  !quotedTokenAt(tokens, index, quotations) && HashSet.has(boundaryWords, tokenWordAt(tokens, index));
const finiteCompetes = (tokens: ReadonlyArray<Span>, index: number, headStart: number): boolean => {
  const word = tokenWordAt(tokens, index);
  const previous = tokenWordAt(tokens, index - 1);
  const prefix = A.take(A.drop(tokens, headStart), index - headStart);
  const plural = A.some(prefix, ({ text }) => Str.endsWith("s")(text) && !Str.endsWith("ss")(text));
  const baseVerb = HashSet.has(predicateWords, word) && !Str.endsWith("ed")(word) && !Str.endsWith("ing")(word);
  const singularVerb = Str.endsWith("s")(word) && HashSet.has(predicateWords, Str.slice(0, -1)(word));
  return (baseVerb && (plural || Str.endsWith("ly")(previous))) || (!plural && singularVerb);
};
const copularNominalPlan = (
  tokens: ReadonlyArray<Span>,
  index: number,
  headStart: number,
  quotations: ReadonlyArray<Span>
): O.Option<NominalBoundaryPlan> => {
  if (index !== 0) return O.none();
  const boundary = A.findFirstIndex(A.drop(tokens, headStart), (_, offset) => {
    const at = headStart + offset;
    return (
      !quotedTokenAt(tokens, at, quotations) &&
      (HashSet.has(copulas, tokenWordAt(tokens, at)) ||
        hardNominalBarrier(tokens, at, quotations) ||
        HashSet.has(punctuation, tokenWordAt(tokens, at)))
    );
  });
  return O.flatMap(boundary, (offset) => {
    const end = headStart + offset;
    if (end <= headStart || !HashSet.has(copulas, tokenWordAt(tokens, end))) return O.none();
    if (isPredicateToken(tokens, end - 1) || Str.endsWith("ly")(tokenWordAt(tokens, end - 1))) return O.none();
    if (
      A.some(A.take(A.drop(tokens, headStart + 1), end - headStart - 1), (_, offset) => {
        const at = headStart + 1 + offset;
        return !quotedTokenAt(tokens, at, quotations) && finiteCompetes(tokens, at, headStart);
      })
    )
      return O.none();
    return O.some(NominalBoundaryPlan.make({ headEnd: end, resumeAt: end, reason: "copular-subject" }));
  });
};
const participleAt = (tokens: ReadonlyArray<Span>, at: number): boolean => {
  const word = tokenWordAt(tokens, at);
  return Str.length(word) > 4 && Str.endsWith("ing")(word);
};
const participialNominalPlan = (
  tokens: ReadonlyArray<Span>,
  headStart: number,
  quotations: ReadonlyArray<Span>
): O.Option<NominalBoundaryPlan> => {
  const prefix = A.takeWhile(A.drop(tokens, headStart), (_, offset) => {
    const at = headStart + offset;
    const word = tokenWordAt(tokens, at);
    return !HashSet.has(punctuation, word) && (!HashSet.has(boundaryWords, word) || word === "and" || word === "or");
  });
  const pair = A.findFirstIndex(prefix, (_, offset) => {
    const at = headStart + offset;
    return (
      !quotedTokenAt(tokens, at, quotations) &&
      participleAt(tokens, at) &&
      HashSet.has(HashSet.make("and", "or"), tokenWordAt(tokens, at + 1)) &&
      participleAt(tokens, at + 2)
    );
  });
  return O.flatMap(pair, (offset) => {
    const at = headStart + offset;
    const prefix = A.take(A.drop(tokens, headStart), offset);
    if (headAt(tokens, headStart, quotations).length < offset) return O.none();
    if (
      A.some(
        prefix,
        (_, before) =>
          !quotedTokenAt(tokens, headStart + before, quotations) &&
          HashSet.has(
            HashSet.make("and", "or", "toward", "towards", "against", "among", "around"),
            tokenWordAt(tokens, headStart + before)
          )
      )
    )
      return O.none();
    const following = at + 3;
    if (O.isSome(determinerAt(tokens, following))) {
      if (at === headStart) return O.none();
      return O.some(NominalBoundaryPlan.make({ headEnd: at, resumeAt: following, reason: "coordinated-action" }));
    }
    const noun = tokenWordAt(tokens, following);
    if (!HashSet.has(nominalFollowers, noun) || Str.endsWith("s")(noun)) return O.none();
    const end = following + headAt(tokens, following, quotations).length;
    return end > following
      ? O.some(NominalBoundaryPlan.make({ headEnd: end, resumeAt: end, reason: "shared-participle" }))
      : O.none();
  });
};
const definitePossessivePlan = (
  tokens: ReadonlyArray<Span>,
  index: number,
  end: number
): O.Option<NominalBoundaryPlan> => {
  const article = tokenWordAt(tokens, index);
  const auxiliary = tokenWordAt(tokens, end);
  const head = tokenWordAt(tokens, end - 1);
  if (!HashSet.has(HashSet.make("the", "said"), article)) return O.none();
  // Definite s-final heads are ambiguous (regular plurals, mass nouns,
  // irregular plurals and singular status-like forms). Only the existing
  // count-head inventory supplies a plural fact; all other s-final heads fall back.
  if (Str.endsWith("s")(head))
    return auxiliary === "have" &&
      HashSet.has(nominalFollowers, head) &&
      HashSet.has(nominalFollowers, Str.slice(0, -1)(head)) &&
      !Str.endsWith("ss")(head)
      ? O.some(NominalBoundaryPlan.make({ headEnd: end, resumeAt: end, reason: "possessive-known-plural" }))
      : O.none();
  return auxiliary === "has"
    ? O.some(NominalBoundaryPlan.make({ headEnd: end, resumeAt: end, reason: "possessive-regular-singular" }))
    : O.none();
};
const possessiveAgreementPlan = (
  tokens: ReadonlyArray<Span>,
  index: number,
  end: number
): O.Option<NominalBoundaryPlan> => {
  const auxiliary = tokenWordAt(tokens, end);
  const article = tokenWordAt(tokens, index);
  const pluralQuantity =
    surfaceAt(tokens, index)(["a", "plurality", "of"]) ||
    surfaceAt(tokens, index)(["one", "or", "more"]) ||
    surfaceAt(tokens, index + 1)(["one", "or", "more"]) ||
    surfaceAt(tokens, index + 1)(["plurality", "of"]);
  if (pluralQuantity)
    return auxiliary === "have"
      ? O.some(NominalBoundaryPlan.make({ headEnd: end, resumeAt: end, reason: "possessive-plural-quantity" }))
      : O.none();
  if (HashSet.has(HashSet.make("a", "an"), article))
    return auxiliary === "has"
      ? O.some(NominalBoundaryPlan.make({ headEnd: end, resumeAt: end, reason: "possessive-singular-article" }))
      : O.none();
  return definitePossessivePlan(tokens, index, end);
};
// A recognized singular finite form competes regardless of number-looking
// modifiers earlier in the subject. The legacy copular guard stays unchanged.
const possessiveFiniteCompetes = (tokens: ReadonlyArray<Span>, index: number, headStart: number): boolean => {
  const word = tokenWordAt(tokens, index);
  const singular =
    Str.endsWith("s")(word) &&
    A.some([word, Str.slice(0, -1)(word), Str.slice(0, -2)(word)], (form) => HashSet.has(predicateWords, form));
  return singular || finiteCompetes(tokens, index, headStart);
};
// Agreement here is structural evidence, not an open-class noun dictionary.
// In particular an internal plural-looking modifier never determines number.
const possessiveNominalPlan = (
  tokens: ReadonlyArray<Span>,
  index: number,
  headStart: number,
  quotations: ReadonlyArray<Span>
): O.Option<NominalBoundaryPlan> => {
  if (index !== 0 && !HashSet.has(HashSet.make("wherein", "whereby"), tokenWordAt(tokens, index - 1))) return O.none();
  const boundary = A.findFirstIndex(A.drop(tokens, headStart), (_, offset) => {
    const at = headStart + offset;
    return hardNominalBarrier(tokens, at, quotations) || HashSet.has(punctuation, tokenWordAt(tokens, at));
  });
  return O.flatMap(boundary, (offset) => {
    const end = headStart + offset;
    const auxiliary = tokenWordAt(tokens, end);
    if (offset === 0 || !HashSet.has(HashSet.make("has", "have"), auxiliary)) return O.none();
    const prefix = A.take(A.drop(tokens, headStart), offset);
    if (
      A.some(
        prefix,
        ({ text }, before) =>
          quotedTokenAt(tokens, headStart + before, quotations) ||
          !O.isSome(Str.match(/^[a-z][a-z-]*$/u)(text)) ||
          possessiveFiniteCompetes(tokens, headStart + before, headStart)
      )
    )
      return O.none();
    if (!explicitLexicalObjectAt(tokens, end + 1, quotations)) return O.none();
    return possessiveAgreementPlan(tokens, index, end);
  });
};
const inspectionNominalPlan: NominalPlanner = (tokens, index, headStart, quotations) =>
  O.getOrElse(
    O.orElse(participialNominalPlan(tokens, headStart, quotations), () =>
      copularNominalPlan(tokens, index, headStart, quotations)
    ),
    () => legacyNominalPlan(tokens, index, headStart, quotations)
  );

class InspectionSourceRole extends S.Opaque<InspectionSourceRole, { readonly brand: unique symbol }>()(
  S.Struct({
    consumedStart: S.Int,
    resumeAt: S.Int,
    reason: S.Literals(["reciprocal-argument", "relational-link", "licensed-infinitive"]),
  }).pipe(
    $I.annoteSchema("InspectionSourceRole", {
      description:
        "A consumed source interval containing grammatical relation or predicate text, with its scanner continuation.",
    })
  )
) {}
const lexicalComplementAt = (tokens: ReadonlyArray<Span>, index: number, quotations: ReadonlyArray<Span>): boolean => {
  const start = O.match(determinerAt(tokens, index), {
    onNone: () => index,
    onSome: ({ determiner, width }) =>
      index + width + (isReferringDeterminer(determiner) ? quantifierWidthAt(tokens, index + width) : 0),
  });
  const head = headAt(tokens, start, quotations);
  return (
    A.isReadonlyArrayNonEmpty(head) &&
    !isClaimReference(head) &&
    A.some(head, ({ text }) => O.isSome(Str.match(/\p{L}/u)(text)))
  );
};
const relationAt = (tokens: ReadonlyArray<Span>, index: number, quotations: ReadonlyArray<Span>): boolean =>
  !quotedTokenAt(tokens, index, quotations) &&
  surfaceAt(tokens, index + 1)(["to"]) &&
  HashSet.has(HashSet.make("due", "opposite", "perpendicular", "relative"), tokenWordAt(tokens, index)) &&
  lexicalComplementAt(tokens, index + 2, quotations);
const reciprocalAt = (tokens: ReadonlyArray<Span>, index: number, quotations: ReadonlyArray<Span>): boolean => {
  if (quotedTokenAt(tokens, index, quotations)) return false;
  if (!surfaceAt(tokens, index)(["each", "other"]) && !surfaceAt(tokens, index)(["one", "another"])) return false;
  const next = tokenWordAt(tokens, index + 2);
  const complete =
    next === "" ||
    HashSet.has(
      HashSet.make(
        ".",
        ",",
        ";",
        ":",
        ")",
        "]",
        "in",
        "on",
        "at",
        "by",
        "with",
        "from",
        "to",
        "than",
        "when",
        "wherein"
      ),
      next
    );
  return (
    complete &&
    HashSet.has(HashSet.make("to", "from", "with", "between", "against", "among", "of"), tokenWordAt(tokens, index - 1))
  );
};
const InfinitiveSlotRole = LiteralKit([
  "quantity",
  "grammatical-function",
  "ambiguous-multiplier",
  "lexical-candidate",
]).pipe(
  $I.annoteSchema("InfinitiveSlotRole", {
    description: "Closed quantity/function-slot exclusions checked before admitting an unknown infinitival verb.",
  })
);
type InfinitiveSlotRole = typeof InfinitiveSlotRole.Type;
// Closed grammatical classes, not open noun/verb entries. A token with both a
// function/quantity reading and a possible lexical verb reading stays ambiguous.
const quantitySlotWords = HashSet.fromIterable(
  Str.split(
    "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion trillion half quarter third few fewer many much little less more most least several some any enough all both either neither each every no another approximately roughly nearly almost exactly precisely",
    " "
  )
);
const multiplierSlotWords = HashSet.fromIterable(
  Str.split(
    "single double triple quadruple quintuple sextuple septuple octuple nonuple decuple multiple once twice thrice",
    " "
  )
);
const functionSlotWords = HashSet.fromIterable(
  Str.split(
    "aboard about above across after against along alongside amid amidst among amongst around as astride at atop before behind below beneath beside besides between beyond by concerning considering despite down during except excluding following for from in including inside into like minus near notwithstanding of off on onto opposite outside over past per plus regarding round save since than through throughout till to toward towards under underneath unlike until unto up upon versus via with within without only merely solely also even rather quite very too",
    " "
  )
);
const isQuantitySlot = (word: string): boolean =>
  A.every(Str.split(word, "-"), (part) => HashSet.has(quantitySlotWords, part) || HashSet.has(ordinalWords, part));
const infinitiveSlotRole = (word: string): InfinitiveSlotRole => {
  if (isQuantitySlot(word)) return "quantity";
  if (HashSet.has(multiplierSlotWords, word)) return "ambiguous-multiplier";
  if (HashSet.has(boundaryWords, word) || HashSet.has(functionSlotWords, word)) return "grammatical-function";
  return "lexical-candidate";
};
const licensedVerbAt = (tokens: ReadonlyArray<Span>, index: number): boolean =>
  infinitiveSlotRole(tokenWordAt(tokens, index)) === "lexical-candidate" &&
  O.exists(A.get(tokens, index), ({ text }) => O.isSome(Str.match(/^[a-z][a-z-]*$/u)(text)));
const explicitLexicalObjectAt = (
  tokens: ReadonlyArray<Span>,
  index: number,
  quotations: ReadonlyArray<Span>
): boolean =>
  O.isSome(determinerAt(tokens, index)) &&
  lexicalComplementAt(tokens, index, quotations) &&
  !O.exists(A.get(tokens, index), ({ text }) => text === "A" || text === "AN");
// Closed introducers establish a verbal slot independently of the verb's
// spelling. The object is proved separately and remains available to scanning.
const licensedInfinitiveAt = (
  tokens: ReadonlyArray<Span>,
  index: number,
  quotations: ReadonlyArray<Span>
): O.Option<InspectionSourceRole> => {
  const purpose = surfaceAt(tokens, index)(["so", "as", "to"]);
  const licensed =
    HashSet.has(HashSet.make("configured", "adapted", "operable", "arranged"), tokenWordAt(tokens, index)) &&
    surfaceAt(tokens, index + 1)(["to"]);
  if (!purpose && !licensed) return O.none();
  if (
    A.some(
      A.take(tokens, index),
      ({ text }, at) =>
        HashSet.has(HashSet.make('"', "“", "”", "‘", "’"), text) && !quotedTokenAt(tokens, at, quotations)
    )
  )
    return O.none();
  const verbAt = index + (purpose ? 3 : 2);
  const objectAt = verbAt + 1;
  if (!licensedVerbAt(tokens, verbAt) || !explicitLexicalObjectAt(tokens, objectAt, quotations)) return O.none();
  if (A.some(A.range(index, objectAt), (at) => quotedTokenAt(tokens, at, quotations))) return O.none();
  return O.some(InspectionSourceRole.make({ consumedStart: index, resumeAt: objectAt, reason: "licensed-infinitive" }));
};
const inspectionRoleAt = (
  tokens: ReadonlyArray<Span>,
  index: number,
  quotations: ReadonlyArray<Span>
): O.Option<InspectionSourceRole> => {
  const infinitive = licensedInfinitiveAt(tokens, index, quotations);
  if (O.isSome(infinitive)) return infinitive;
  if (reciprocalAt(tokens, index, quotations))
    return O.some(
      InspectionSourceRole.make({ consumedStart: index, resumeAt: index + 2, reason: "reciprocal-argument" })
    );
  const previous = tokenWordAt(tokens, index - 1);
  if (relationAt(tokens, index, quotations) && (HashSet.has(copulas, previous) || isPredicateToken(tokens, index - 1)))
    return O.some(InspectionSourceRole.make({ consumedStart: index, resumeAt: index + 2, reason: "relational-link" }));
  return O.none();
};
const relationalNominalPlan = (
  tokens: ReadonlyArray<Span>,
  headStart: number,
  quotations: ReadonlyArray<Span>
): O.Option<NominalBoundaryPlan> => {
  const legacy = headAt(tokens, headStart, quotations);
  const found = A.findFirstIndex(
    legacy,
    (_, offset) => offset > 0 && relationAt(tokens, headStart + offset, quotations)
  );
  return O.map(found, (offset) =>
    NominalBoundaryPlan.make({
      headEnd: headStart + offset,
      resumeAt: headStart + offset + 2,
      reason: "relational-complement",
    })
  );
};
type LexicalGrammar = {
  readonly plan: NominalPlanner;
  readonly ignoreAt: (
    tokens: ReadonlyArray<Span>,
    index: number,
    quotations: ReadonlyArray<Span>
  ) => O.Option<InspectionSourceRole>;
};
const strictLexicalGrammar: LexicalGrammar = { plan: legacyNominalPlan, ignoreAt: () => O.none() };
const inspectionLexicalGrammar: LexicalGrammar = {
  plan: (tokens, index, headStart, quotations) =>
    O.getOrElse(possessiveNominalPlan(tokens, index, headStart, quotations), () =>
      O.getOrElse(relationalNominalPlan(tokens, headStart, quotations), () =>
        inspectionNominalPlan(tokens, index, headStart, quotations)
      )
    ),
  ignoreAt: inspectionRoleAt,
};

// Rule `claim-reference`: "the claim 1" names a claim, not a claim term.
const isClaimReference = (head: ReadonlyArray<Span>): boolean =>
  O.exists(A.get(head, 0), ({ text }) => Str.toLowerCase(text) === "claim") &&
  O.exists(A.get(head, 1), ({ text }) => O.isSome(Str.match(digitsPattern)(text)));

const termOf = (
  claimText: string,
  start: number,
  determiner: ClaimTermDeterminer,
  head: A.NonEmptyReadonlyArray<Span>
): EncodedTerm => {
  const last = A.lastNonEmpty(head);
  const endChar = last.start + Str.length(last.text);
  return {
    anchor: { startChar: start, endChar, quote: Str.slice(start, endChar)(claimText) },
    determiner,
    head: pipe(
      Str.slice(A.headNonEmpty(head).start, endChar)(claimText),
      Str.toLowerCase,
      Str.replace(/\s+/gu, " "),
      Str.trim
    ),
  };
};

type ScanStep = readonly [term: O.Option<EncodedTerm>, resumeAt: number];

const scanStepOf = (term: O.Option<EncodedTerm>, resumeAt: number): ScanStep => [term, resumeAt];

// One scan step from `index`: the term found there, if any, and where the scan resumes.
const scanStep =
  (claimText: string, tokens: ReadonlyArray<Span>, quotations: ReadonlyArray<Span>, grammar: LexicalGrammar) =>
  (index: number): ScanStep => {
    const role = grammar.ignoreAt(tokens, index, quotations);
    if (O.isSome(role)) return scanStepOf(O.none(), role.value.resumeAt);
    const idiom = A.findFirst(
      [
        ["by", "means", "of"],
        ["side", "by", "side"],
        ["in", "association", "with"],
        ["in", "response", "to"],
        ["at", "least", "by", "means", "of"],
      ],
      (words) => surfaceAt(tokens, index)(words)
    );
    if (O.isSome(idiom)) return scanStepOf(O.none(), index + idiom.value.length);
    if (surfaceAt(tokens, index)(["one", "of"])) return scanStepOf(O.none(), index + 2);
    if (
      surfaceAt(tokens, index)(["at", "least"]) &&
      O.exists(A.get(tokens, index + 2), ({ text }) =>
        HashSet.has(HashSet.make("the", "said", "a", "an", "each"), Str.toLowerCase(text))
      )
    )
      return scanStepOf(O.none(), index + 2);
    return pipe(
      determinerAt(tokens, index),
      O.match({
        onNone: () => {
          const head = headAt(tokens, index, quotations);
          const previous = O.map(A.get(tokens, index - 1), ({ text }) => text);
          const isReferenceNumber =
            O.exists(previous, (word) =>
              HashSet.has(HashSet.make("is", "are", "was", "were"), Str.toLowerCase(word))
            ) ||
            O.contains(previous, "(") ||
            O.contains(previous, "[") ||
            O.exists(A.head(head), ({ text }) => O.isSome(Str.match(digitsPattern)(text)));
          return A.isReadonlyArrayNonEmpty(head) && !isReferenceNumber && !isClaimReference(head)
            ? scanStepOf(O.some(termOf(claimText, A.headNonEmpty(head).start, "bare", head)), index + head.length)
            : scanStepOf(O.none(), index + 1);
        },
        onSome: ({ determiner, start, width }) => {
          const headStart =
            index + width + (isReferringDeterminer(determiner) ? quantifierWidthAt(tokens, index + width) : 0);
          const plan = grammar.plan(tokens, index, headStart, quotations);
          const head = A.take(A.drop(tokens, headStart), plan.headEnd - headStart);
          if (!A.isReadonlyArrayNonEmpty(head) || isClaimReference(head)) return scanStepOf(O.none(), index + width);
          const term = termOf(claimText, start, determiner, head);
          const lexicalStart = O.getOrThrow(A.get(tokens, index + width)).start;
          // A referring determiner does not consume the collective noun plurality.
          // Retain that explicit source phrase in the head, while scanning the
          // nominal contents after the quantity's grammatical separators.
          const lexical = surfaceAt(tokens, index + width)(["plurality", "of"])
            ? {
                ...term,
                head: pipe(
                  Str.slice(lexicalStart, term.anchor.endChar)(claimText),
                  Str.toLowerCase,
                  Str.replace(/\s+/gu, " "),
                  Str.trim
                ),
              }
            : term;
          return scanStepOf(O.some(lexical), plan.resumeAt);
        },
      })
    );
  };

const termsIn =
  (claimText: string, grammar: LexicalGrammar = strictLexicalGrammar) =>
  (span: Span): ReadonlyArray<EncodedTerm> => {
    const material = Str.match(
      /\b(?:is|are|was|were)\s+(?:formed|made|composed)\s+(?:of|from)\s+(?!a\b|an\b|the\b|said\b)([^,;]+)$/iu
    )(span.text).pipe(
      O.filter((match) =>
        O.exists(A.get(match, 1), (tail) => O.isNone(Str.match(/\b(?:a|an|the|said|its|their)\b/iu)(tail)))
      )
    );
    const entitySpan = O.match(material, {
      onNone: () => span,
      onSome: (match) => sliceSpan(span, 0, O.getOrElse(O.fromUndefinedOr(match.index), constant(span.text.length))),
    });
    const tokens = matchesIn(tokenPattern)(entitySpan);
    const step = scanStep(claimText, tokens, matchesIn(quotedPhrasePattern)(entitySpan), grammar);
    return A.getSomes(A.unfold(0, (index) => (index < A.length(tokens) ? O.some(step(index)) : O.none())));
  };

const elementOf =
  (claimText: string, kind: ClaimElementKind, grammar: LexicalGrammar = strictLexicalGrammar) =>
  (path: string, span: Span): EncodedElement => {
    const tokens = matchesIn(tokenPattern)(span);
    return {
      path,
      anchor: anchorOf(span),
      kind:
        kind !== "preamble-subject" &&
        (A.some(tokens, (_, index) => isPredicateToken(tokens, index)) ||
          O.isSome(
            Str.match(
              /\b(?:that|which|wherein|configured|adapted|coupled|connected|mounted|attached|wired|facing|having|includes|comprises|is|are|extends|extending|for)\b/iu
            )(span.text)
          ))
          ? "functional-relation"
          : kind,
      terms: termsIn(
        claimText,
        grammar
      )(
        kind === "preamble-subject"
          ? O.match(
              Str.match(
                /\b(?:according to|in accordance with|as (?:set forth|recited|claimed) in|of)\s+(?:the\s+|any(?:\s+one)?\s+of\s+)?claims?\b/iu
              )(span.text),
              {
                onNone: () => span,
                onSome: (match) => sliceSpan(span, 0, O.getOrElse(O.fromUndefinedOr(match.index), constant(0))),
              }
            )
          : span
      ),
    };
  };

type AntecedentStrategy = {
  readonly headFor: (path: string, term: EncodedTerm) => string;
  readonly allows: (path: string, term: EncodedTerm, candidatePath: string, candidate: EncodedTerm) => boolean;
};
const legacyAntecedentStrategy: AntecedentStrategy = {
  headFor: (_path, term) => term.head,
  allows: () => true,
};
const antecedentEdges = (
  elements: ReadonlyArray<EncodedElement>,
  ancestors: ReadonlyArray<EncodedElement> = [],
  strategy: AntecedentStrategy = legacyAntecedentStrategy
): ReadonlyArray<EncodedEdge> => {
  const located = A.flatMap(A.appendAll(elements, ancestors), (element: EncodedElement) =>
    A.map(element.terms, (term) => ({
      path: element.path,
      // Edge resolution uses the entity contents; emitted trees retain lexical heads.
      term: {
        ...term,
        head: O.getOrElse(pluralityReferenceContent(strategy.headFor(element.path, term)), () =>
          strategy.headFor(element.path, term)
        ),
      },
    }))
  );
  const local = (path: string) => A.some(elements, (element) => element.path === path);
  const root = (path: string) => O.exists(A.head(elements), (element) => element.path === path);
  const referringTerms = A.filter(
    located,
    ({ path, term }) =>
      local(path) &&
      (isReferringDeterminer(term.determiner) ||
        (ancestors.length > 0 &&
          root(path) &&
          (isIntroducingDeterminer(term.determiner) || term.determiner === "bare")))
  );
  return A.getSomes(
    A.map(referringTerms, (referring) => {
      const before = A.filter(
        located,
        ({ path, term }) =>
          (!local(path) || term.anchor.startChar < referring.term.anchor.startChar) &&
          strategy.allows(referring.path, referring.term, path, term)
      );
      const introductionsBefore = A.filter(
        before,
        ({ path, term }) =>
          isIntroducingDeterminer(term.determiner) ||
          (root(referring.path) &&
            term.determiner === "bare" &&
            A.some(ancestors, (element) => element.path === path && element.kind === "preamble-subject"))
      );
      const eligible = root(referring.path)
        ? introductionsBefore
        : A.filter(
            introductionsBefore,
            ({ path, term }) =>
              !A.some(
                A.appendAll(elements, ancestors),
                (element) =>
                  element.path === path &&
                  element.kind === "preamble-subject" &&
                  O.exists(A.head(element.terms), (first) => first.anchor.startChar === term.anchor.startChar) &&
                  O.isSome(Str.match(/\bclaims?\s+\d/iu)(element.anchor.quote)) &&
                  A.some(
                    ancestors,
                    (origin) =>
                      origin.path !== path &&
                      origin.kind === "preamble-subject" &&
                      A.some(origin.terms, (first) => first.head === term.head)
                  )
              )
          );
      const exact = A.filter(eligible, ({ term }) => term.head === referring.term.head);
      const abbreviated = A.filter(eligible, ({ term }) => isExplicitAbbreviatedHead(referring.term.head)(term.head));
      const counted = A.filter(eligible, ({ term }) => isCountedHead(referring.term.head)(term.head));
      const modified = A.filter(eligible, ({ term }) => isSingleModifiedHead(referring.term.head)(term.head));
      // A unique exact earlier mention is a structural back-reference, even if its
      // original definite wording still requires a legal antecedent-basis warning.
      const mentions = A.filter(
        before,
        ({ path, term }) =>
          term.head === referring.term.head &&
          (!root(referring.path) ||
            A.some(ancestors, (element) => element.path === path && element.kind === "preamble-subject"))
      );
      const bareMentions = A.filter(mentions, ({ term }) => term.determiner === "bare");
      const localDesignated = A.filter(
        before,
        ({ path, term }) => local(path) && isDesignatedHead(referring.term.head)(term.head)
      );
      const designated = A.filter(before, ({ term }) => isDesignatedHead(referring.term.head)(term.head));
      const modifiedMentions = A.filter(
        before,
        ({ path, term }) => !local(path) && isSingleModifiedHead(referring.term.head)(term.head)
      );
      const rootShortened = root(referring.path)
        ? A.filter(
            eligible,
            ({ path, term }) =>
              Str.endsWith(` ${referring.term.head}`)(term.head) &&
              A.some(ancestors, (element) => element.path === path && element.kind === "preamble-subject")
          )
        : [];
      const introductions = O.getOrElse(
        A.findFirst(
          [
            localDesignated,
            exact,
            abbreviated,
            counted,
            designated,
            rootShortened,
            modified,
            bareMentions,
            mentions,
            modifiedMentions,
          ],
          A.isReadonlyArrayNonEmpty
        ),
        () => []
      );
      return O.map(
        A.length(introductions) === 1 ? A.head(introductions) : O.none(),
        (introducing): EncodedEdge => ({
          kind: "antecedent",
          referring: { path: referring.path, anchor: referring.term.anchor },
          introducing: { path: introducing.path, anchor: introducing.term.anchor },
        })
      );
    })
  );
};

// Ownership restricts structural identity only for inspection. Lexical matching
// still proposes candidates; a modifier or source proximity is never owner proof.
class SourceOwnership extends S.Opaque<SourceOwnership, { readonly brand: unique symbol }>()(
  S.Struct({
    part: S.NonEmptyString,
    owner: S.NonEmptyString,
    head: S.NonEmptyString,
    reason: S.Literals(["of", "composition", "relative", "possessive", "part-location"]),
  }).pipe(
    $I.annoteSchema("SourceOwnership", {
      description: "Explicit owned-source relationship between existing term mentions, before and after owner binding.",
    })
  )
) {}
const mentionKey = (path: string, term: EncodedTerm): string => `${path}:${term.anchor.startChar}`;
const ownershipMentions = (elements: ReadonlyArray<EncodedElement>) =>
  A.flatMap(elements, (element) => A.map(element.terms, (term) => ({ path: element.path, term })));
const sameMention = (path: string, start: number, otherPath: string, otherStart: number): boolean =>
  path === otherPath && start === otherStart;
const ownerBridge = (element: EncodedElement, left: EncodedTerm, right: EncodedTerm): string =>
  pipe(
    Str.slice(
      left.anchor.endChar - element.anchor.startChar,
      right.anchor.startChar - element.anchor.startChar
    )(element.anchor.quote),
    Str.replace(/\(\s*\d+[a-z]?\s*\)|\[\s*\d+[a-z]?\s*\]/giu, " "),
    Str.replace(/\s+/gu, " "),
    Str.toLowerCase,
    Str.trim
  );
const isSpatialPartHead = (head: string): boolean =>
  O.isSome(Str.match(/\b(?:portions?|surfaces?|edges?|ends?|regions?|areas?|sections?|sides?|bases?)$/u)(head));
const pairOwnership = (element: EncodedElement, left: EncodedTerm, right: EncodedTerm): O.Option<SourceOwnership> => {
  const bridge = ownerBridge(element, left, right);
  if (bridge === "of")
    return O.some(
      SourceOwnership.make({
        part: mentionKey(element.path, left),
        owner: mentionKey(element.path, right),
        head: left.head,
        reason: "of",
      })
    );
  const reason = bridge === "of which" ? "relative" : "composition";
  // "a signal of which the sensor is aware" is a relative predicate argument,
  // not a possessive part relationship. The relative branch needs a part head.
  if (reason === "relative" && !isSpatialPartHead(right.head)) return O.none();
  const composition =
    /^(?:with|having|including|containing|has|have|(?:further )?(?:comprises|includes)|(?:is|are) provided with)$/u;
  if (reason === "composition" && O.isNone(Str.match(composition)(bridge))) return O.none();
  return O.some(
    SourceOwnership.make({
      part: mentionKey(element.path, right),
      owner: mentionKey(element.path, left),
      head: right.head,
      reason,
    })
  );
};
const claimOfMention = (path: string): O.Option<number> => Num.parse(A.headNonEmpty(Str.split(path, ".")));
const mentionPrecedes = (path: string, term: EncodedTerm, otherPath: string, other: EncodedTerm): boolean =>
  O.exists(O.all([claimOfMention(path), claimOfMention(otherPath)]), ([claim, otherClaim]) =>
    claim === otherClaim ? term.anchor.startChar < other.anchor.startChar : claim < otherClaim
  );
const possessiveOwnership = (
  path: string,
  term: EncodedTerm,
  mentions: ReturnType<typeof ownershipMentions>
): O.Option<SourceOwnership> => {
  if (!isReferringDeterminer(term.determiner)) return O.none();
  return O.flatMap(Str.match(/^(.+?)[’']s (.+)$/u)(term.head), (parts) => {
    const owners = A.filter(
      mentions,
      (candidate) =>
        isIntroducingDeterminer(candidate.term.determiner) &&
        O.contains(A.get(parts, 1), candidate.term.head) &&
        mentionPrecedes(candidate.path, candidate.term, path, term)
    );
    return O.flatMap(owners.length === 1 ? A.head(owners) : O.none(), (owner) =>
      O.map(A.get(parts, 2), (head) =>
        SourceOwnership.make({
          part: mentionKey(path, term),
          owner: mentionKey(owner.path, owner.term),
          head,
          reason: "possessive",
        })
      )
    );
  });
};
const partLocationOwnership = (element: EncodedElement): O.Option<SourceOwnership> =>
  O.flatMap(
    O.all([A.get(element.terms, 0), A.get(element.terms, 1), A.get(element.terms, 2)]),
    ([part, region, owner]) => {
      if (isReferringDeterminer(part.determiner)) return O.none();
      if (!HashSet.has(HashSet.make("in", "on", "at"), ownerBridge(element, part, region))) return O.none();
      if (ownerBridge(element, region, owner) !== "of") return O.none();
      if (!isSpatialPartHead(region.head)) return O.none();
      return O.some(
        SourceOwnership.make({
          part: mentionKey(element.path, part),
          owner: mentionKey(element.path, owner),
          head: part.head,
          reason: "part-location",
        })
      );
    }
  );
const rawOwnership = (elements: ReadonlyArray<EncodedElement>): ReadonlyArray<SourceOwnership> => {
  const mentions = ownershipMentions(elements);
  return A.appendAll(
    A.flatMap(elements, (element) =>
      A.appendAll(
        A.getSomes(
          A.map(element.terms, (left, index) =>
            O.flatMap(A.get(element.terms, index + 1), (right) => pairOwnership(element, left, right))
          )
        ),
        O.toArray(partLocationOwnership(element))
      )
    ),
    A.getSomes(A.map(mentions, ({ path, term }) => possessiveOwnership(path, term, mentions)))
  );
};
const boundOwner = (
  key: string,
  raw: ReadonlyArray<SourceOwnership>,
  mentions: ReturnType<typeof ownershipMentions>,
  baseline: ReadonlyArray<EncodedEdge>
): O.Option<string> =>
  O.flatMap(
    A.findFirst(mentions, ({ path, term }) => mentionKey(path, term) === key),
    ({ path, term }) => {
      if (isIntroducingDeterminer(term.determiner)) return O.some(key);
      // An explicitly owned part cannot inherit a possibly conflicting old owner
      // reference to bind further nested ownership. Decline that nested proof.
      if (A.some(raw, (fact) => fact.part === key)) return O.none();
      const links = A.filter(
        baseline,
        (edge) =>
          edge.kind === "antecedent" &&
          sameMention(path, term.anchor.startChar, edge.referring.path, edge.referring.anchor.startChar)
      );
      return O.flatMap(links.length === 1 ? A.head(links) : O.none(), (edge) =>
        edge.kind === "antecedent" ? O.some(`${edge.introducing.path}:${edge.introducing.anchor.startChar}`) : O.none()
      );
    }
  );
const uniqueOwner = (facts: ReadonlyArray<SourceOwnership>, part: string): O.Option<string> => {
  const owners = HashSet.fromIterable(
    A.map(
      A.filter(facts, (fact) => fact.part === part),
      (fact) => fact.owner
    )
  );
  return HashSet.size(owners) === 1 ? pipe(owners, A.fromIterable, A.head) : O.none();
};
const locativePartChain = (element: EncodedElement, partIndex: number, referring: EncodedTerm): boolean =>
  O.exists(
    O.all([A.get(element.terms, partIndex), A.get(element.terms, partIndex + 1), A.get(element.terms, partIndex + 2)]),
    ([part, region, target]) =>
      target.anchor.startChar === referring.anchor.startChar &&
      isSpatialPartHead(region.head) &&
      HashSet.has(HashSet.make("in", "on", "at"), ownerBridge(element, part, region)) &&
      ownerBridge(element, region, target) === "of"
  );
const scopedPartRelationship = (element: EncodedElement, referring: EncodedTerm, fact: SourceOwnership): boolean =>
  O.exists(
    A.findFirstIndex(element.terms, (term) => mentionKey(element.path, term) === fact.part),
    (index) =>
      Match.value(fact.reason).pipe(
        Match.when("relative", () =>
          O.exists(
            A.get(element.terms, index),
            (part) => part.head === referring.head && part.anchor.startChar < referring.anchor.startChar
          )
        ),
        Match.when("composition", () => locativePartChain(element, index, referring)),
        Match.orElse(() => false)
      )
  );
const compositionOwner = (
  element: EncodedElement,
  referring: EncodedTerm,
  raw: ReadonlyArray<SourceOwnership>,
  facts: ReadonlyArray<SourceOwnership>,
  mentions: ReturnType<typeof ownershipMentions>,
  baseline: ReadonlyArray<EncodedEdge>
): O.Option<string> =>
  O.flatMap(A.head(element.terms), (subject) =>
    O.flatMap(boundOwner(mentionKey(element.path, subject), raw, mentions, baseline), (owner) => {
      const scoped = A.some(facts, (fact) => fact.owner === owner && scopedPartRelationship(element, referring, fact));
      if (!scoped) return O.none();
      const competitors = A.filter(
        element.terms,
        (term) =>
          term.anchor.startChar < referring.anchor.startChar && term.anchor.startChar !== subject.anchor.startChar
      );
      const competingOwner = A.some(competitors, (term) =>
        O.exists(
          boundOwner(mentionKey(element.path, term), raw, mentions, baseline),
          (other) => other !== owner && A.some(facts, (fact) => fact.owner === other)
        )
      );
      return competingOwner ? O.none() : O.some(owner);
    })
  );
const ownershipStrategy = (
  elements: ReadonlyArray<EncodedElement>,
  ancestors: ReadonlyArray<EncodedElement>,
  baseline: ReadonlyArray<EncodedEdge>
) => {
  const all = A.appendAll(elements, ancestors);
  const mentions = ownershipMentions(all);
  const raw = rawOwnership(all);
  const facts = A.getSomes(
    A.map(raw, (fact) =>
      O.map(boundOwner(fact.owner, raw, mentions, baseline), (owner) => SourceOwnership.make({ ...fact, owner }))
    )
  );
  const unresolvedParts = HashSet.fromIterable(
    A.map(
      A.filter(raw, (fact) => O.isNone(boundOwner(fact.owner, raw, mentions, baseline))),
      (fact) => fact.part
    )
  );
  const contextFor = (path: string, term: EncodedTerm) => {
    const key = mentionKey(path, term);
    // An explicit unknown/ambiguous owner cannot be replaced by a surrounding
    // composition scope, such as "shaft of the sleeve" inside a nut clause.
    if (A.some(raw, (fact) => fact.part === key))
      return HashSet.has(unresolvedParts, key) ? O.none() : uniqueOwner(facts, key);
    return O.flatMap(
      A.findFirst(elements, (element) => element.path === path),
      (element) => compositionOwner(element, term, raw, facts, mentions, baseline)
    );
  };
  const contexts = A.reduce(
    ownershipMentions(elements),
    HashMap.empty<string, O.Option<string>>(),
    (map, { path, term }) => HashMap.set(map, mentionKey(path, term), contextFor(path, term))
  );
  const ownersByPart = A.reduce(facts, HashMap.empty<string, HashSet.HashSet<string>>(), (map, fact) =>
    HashMap.set(
      map,
      fact.part,
      HashSet.add(O.getOrElse(HashMap.get(map, fact.part), HashSet.empty<string>), fact.owner)
    )
  );
  const possessiveHeads = A.reduce(
    A.filter(
      facts,
      (fact) =>
        fact.reason === "possessive" &&
        !HashSet.has(unresolvedParts, fact.part) &&
        O.isSome(uniqueOwner(facts, fact.part))
    ),
    HashMap.empty<string, string>(),
    (map, fact) => HashMap.set(map, fact.part, fact.head)
  );
  const strategy: AntecedentStrategy = {
    headFor: (path, term) => O.getOrElse(HashMap.get(possessiveHeads, mentionKey(path, term)), () => term.head),
    allows: (path, term, candidatePath, candidate) => {
      const key = mentionKey(path, term);
      const owner = O.flatten(HashMap.get(contexts, key));
      return O.getOrElse(
        O.flatMap(owner, (context) =>
          O.map(HashMap.get(ownersByPart, mentionKey(candidatePath, candidate)), (owners) =>
            HashSet.has(owners, context)
          )
        ),
        // Unknown ownership retains legacy matching, except that a new
        // possessive normalization needs a positive donor-owner match.
        () => O.isNone(owner) || !HashMap.has(possessiveHeads, key)
      );
    },
  };
  return { strategy, facts };
};
type StructuralReferenceStrategy = (
  elements: ReadonlyArray<EncodedElement>,
  ancestors: ReadonlyArray<EncodedElement>,
  parents: ReadonlyArray<number>,
  ancestorBindings: () => ReadonlyArray<EncodedEdge>
) => ReadonlyArray<EncodedEdge>;
const legacyStructuralReferences: StructuralReferenceStrategy = (elements, ancestors) =>
  antecedentEdges(elements, ancestors);
const inspectionStructuralReferences: StructuralReferenceStrategy = (
  elements,
  ancestors,
  parents,
  ancestorBindings
) => {
  // Foreign referring edges are evidence for binding an ancestor's owner only.
  // The returned reference list is still produced for current elements alone.
  const baseline = A.appendAll(antecedentEdges(elements, ancestors), ancestorBindings());
  const { strategy, facts } = ownershipStrategy(elements, ancestors, baseline);
  const references = antecedentEdges(elements, ancestors, strategy);
  const dependencies = A.getSomes(
    A.map(
      A.filter(facts, (fact) => fact.reason === "part-location"),
      (fact): O.Option<EncodedEdge> => {
        const introduced = A.findFirst(
          ownershipMentions(ancestors),
          ({ path, term }) => mentionKey(path, term) === fact.owner && isIntroducingDeterminer(term.determiner)
        );
        const dependent = A.findFirst(elements, (element) =>
          O.exists(A.head(element.terms), (term) => mentionKey(element.path, term) === fact.part)
        );
        return O.flatMap(O.all([introduced, dependent]), ([owner, element]) =>
          O.exists(claimOfMention(owner.path), (number) => A.contains(parents, number))
            ? O.some({ kind: "depends-on-element", dependent: element.path, ancestor: owner.path })
            : O.none()
        );
      }
    )
  );
  return A.appendAll(references, dependencies);
};

const functionalEdges = (elements: ReadonlyArray<EncodedElement>): ReadonlyArray<EncodedEdge> =>
  A.map(
    A.filter(elements, (element) => element.kind === "functional-relation"),
    (element): EncodedEdge => {
      const parts: Array<typeof ClaimFunctionalPart.Encoded> = [];
      let cursor = element.anchor.startChar;
      const textPart = (end: number) => {
        if (end > cursor)
          parts.push({
            kind: "text",
            anchor: {
              startChar: cursor,
              endChar: end,
              quote: Str.slice(cursor - element.anchor.startChar, end - element.anchor.startChar)(element.anchor.quote),
            },
          });
      };
      for (const term of element.terms) {
        textPart(term.anchor.startChar);
        parts.push({ kind: "term", term: { path: element.path, anchor: term.anchor } });
        cursor = term.anchor.endChar;
      }
      textPart(element.anchor.endChar);
      return {
        kind: "functional",
        element: element.path,
        parts: A.isArrayNonEmpty(parts) ? parts : [{ kind: "text", anchor: element.anchor }],
      };
    }
  );

const referencesOf = (claim: PatentClaim): ReadonlyArray<number> =>
  PatentClaim.match(claim, {
    independent: A.empty<number>,
    dependent: ({ claimReferences }) => claimReferences,
  });

const assembleTree = (
  claim: PatentClaim,
  elements: A.NonEmptyReadonlyArray<EncodedElement>,
  containment: ReadonlyArray<EncodedEdge>
): typeof ClaimElementTree.Encoded => ({
  claimNumber: claim.claimNumber,
  producer: "rule",
  elements,
  edges: [
    ...containment,
    ...A.flatMap(referencesOf(claim), (ancestor) => {
      const explicit = A.filter(elements, (element) => O.isSome(Str.match(/\bclaims?\s+\d/iu)(element.anchor.quote)));
      return A.map(
        A.isArrayNonEmpty(explicit) ? A.map(explicit, (element) => element.path) : [`${claim.claimNumber}`],
        (dependent): EncodedEdge => ({ kind: "depends-on-element", dependent, ancestor: `${ancestor}` })
      );
    }),
    ...antecedentEdges(elements),
    ...functionalEdges(elements),
  ],
});

const bodySegments = (
  claim: PatentClaim,
  body: Span,
  split: (body: Span) => ReadonlyArray<Span>
): ReadonlyArray<Span> => {
  const methodFrame = O.isSome(Str.match(/^(?::\s*)?(?:the\s+)?following steps\s*:/iu)(Str.trimStart(body.text)));
  return A.filter(
    A.map(split(body), (segment) => {
      const cleaned = cleanSegment(segment);
      return claim.transition === "wherein" ||
        methodFrame ||
        O.isSome(Str.match(/\bfurther\s+(?:comprising|including|having)\b/iu)(claim.claimText))
        ? pipe(cleaned, dropPrefix(["wherein "]), trimSpan)
        : cleaned;
    }),
    (span) => isContentSegment(span) && !O.isSome(Str.match(/^(?:the\s+)?following steps\s*:$/iu)(span.text))
  );
};

const treeInput = (
  claim: PatentClaim,
  parts: { readonly preamble: Span; readonly body: Span }
): typeof ClaimElementTree.Encoded => {
  const root = `${claim.claimNumber}`;
  const segments = bodySegments(claim, parts.body, splitBody);
  // Rule `colon-sublist`: the first limitation ending in ":" absorbs every later segment.
  const [beforeColon, fromColon] = A.span(segments, (segment) => !endsWithColon(segment));
  const limitations = A.map(A.appendAll(beforeColon, A.take(fromColon, 1)), (span, index) => ({
    path: `${root}.${letterSegment(index)}`,
    span,
  }));
  const parent = `${root}.${letterSegment(A.length(beforeColon))}`;
  const subLimitations = A.map(A.drop(fromColon, 1), (span, index) => ({
    path: `${parent}.${romanSegment(index + 1)}`,
    span,
  }));
  const elements = A.prepend(
    A.appendAll(
      A.map(limitations, ({ path, span }) => elementOf(claim.claimText, "limitation")(path, span)),
      A.map(subLimitations, ({ path, span }) => elementOf(claim.claimText, "sub-limitation")(path, span))
    ),
    elementOf(claim.claimText, "preamble-subject")(root, pipe(parts.preamble, trimSpan, dropSuffix([","]), trimSpan))
  );
  return assembleTree(claim, elements, [
    ...A.map(limitations, ({ path }): EncodedEdge => ({ kind: "part-of", child: path, parent: root })),
    ...A.map(subLimitations, ({ path }): EncodedEdge => ({ kind: "part-of", child: path, parent })),
  ]);
};

const colonLabelOf = ({ text }: Span): O.Option<ColonScopeLabel> => {
  const parenthesized = Str.match(/^\(([a-z]+|[0-9]+)\)\s+/iu)(text);
  if (O.isSome(parenthesized))
    return O.map(A.get(parenthesized.value, 1), (value) =>
      ColonScopeLabel.make({ style: "parenthesized", value: Str.toLowerCase(value) })
    );
  const suffix = Str.match(/^([a-z]+|[0-9]+)[).]\s+/iu)(text);
  if (O.isSome(suffix))
    return O.map(A.get(suffix.value, 1), (value) =>
      ColonScopeLabel.make({ style: "suffix", value: Str.toLowerCase(value) })
    );
  return O.flatMap(Str.match(/^step\s+([0-9]+)[,:.]\s+/iu)(text), (match) =>
    O.map(A.get(match, 1), (value) => ColonScopeLabel.make({ style: "step", value }))
  );
};
const numericLabel = S.FiniteFromString.pipe(
  S.decodeTo(S.Int.check(S.isGreaterThan(0))),
  $I.annoteSchema("ColonNumericLabel", {
    description: "Positive source enumeration number used only to recognize a consecutive explicit peer label.",
  })
);
const decodeNumericLabel = S.decodeOption(numericLabel);
const romanLabelValue = (value: string): O.Option<number> => {
  const parsed = A.reduce(romanDigits, { rest: value, number: 0 }, (state, [digit, symbol]) => {
    let rest = state.rest;
    let number = state.number;
    while (Str.startsWith(symbol)(rest)) {
      rest = Str.slice(Str.length(symbol))(rest);
      number += digit;
    }
    return { rest, number };
  });
  return O.filter(
    O.some(parsed.number),
    (number) => number > 0 && parsed.rest === "" && romanSegment(number) === value
  );
};
const nextLabelValues = (value: string): ReadonlyArray<string> => {
  const alpha = O.filter(Str.indexOf(value)(alphabet), () => Str.length(value) === 1);
  return A.getSomes([
    O.flatMap(alpha, (index) => O.filter(O.some(Str.slice(index + 1, index + 2)(alphabet)), Str.isNonEmpty)),
    O.map(decodeNumericLabel(value), (index) => `${index + 1}`),
    O.map(romanLabelValue(value), (index) => romanSegment(index + 1)),
  ]);
};
const followsLabel = (previous: O.Option<ColonScopeLabel>, next: O.Option<ColonScopeLabel>): boolean =>
  O.exists(
    O.all([previous, next]),
    ([left, right]) => left.style === right.style && A.contains(nextLabelValues(left.value), right.value)
  );
const transparentColonFrame = ({ text }: Span): boolean =>
  O.isSome(
    Str.match(
      /^(?:(?:(?:it|(?:the|said) method)\s+(?:comprises|includes|has)\s+)?(?:the\s+)?following steps\s*:|(?:comprising|including|having)\s*:)$/iu
    )(text)
  );
const activeColonScopes = (
  nodes: ReadonlyArray<ColonScopeNode>,
  stack: ReadonlyArray<number>,
  label: O.Option<ColonScopeLabel>
): ReadonlyArray<number> => {
  const matches = A.filter(stack, (index) => O.exists(A.get(nodes, index), (node) => followsLabel(node.label, label)));
  const peer = O.flatMap(
    O.filter(A.head(matches), () => matches.length === 1),
    (matched) =>
      O.filter(
        A.findFirstIndex(stack, (index) => index === matched),
        () =>
          O.exists(
            A.get(nodes, matched),
            (node) =>
              !O.exists(
                A.findFirst(nodes, (child) => child.parent === node.path && O.isSome(child.label)),
                (child) => followsLabel(child.label, label)
              )
          )
      )
  );
  return O.getOrElse(
    O.map(peer, (index) => A.take(stack, index)),
    () => stack
  );
};
const appendColonNode = (
  root: string,
  nodes: ReadonlyArray<ColonScopeNode>,
  stack: ReadonlyArray<number>,
  header: Span,
  label: O.Option<ColonScopeLabel>
): ReadonlyArray<ColonScopeNode> => {
  const parent = O.getOrElse(
    O.flatMap(A.last(stack), (index) => O.map(A.get(nodes, index), (node) => node.path)),
    () => root
  );
  const count = A.countBy(nodes, (node) => node.parent === parent);
  const path = `${parent}.${parent === root ? letterSegment(count) : romanSegment(count + 1)}`;
  const endChar = header.start + Str.length(header.text);
  const extended = A.map(nodes, (node, index) =>
    A.contains(stack, index) ? ColonScopeNode.make({ ...node, endChar, group: true }) : node
  );
  return A.append(
    extended,
    ColonScopeNode.make({ path, parent, header: ColonHeaderSpan.make(header), endChar, group: false, label })
  );
};
const colonNodesOf = (root: string, segments: ReadonlyArray<Span>): ReadonlyArray<ColonScopeNode> =>
  A.reduce(segments, ColonScopeState.make({ nodes: [], stack: [] }), (state, header) => {
    const label = colonLabelOf(header);
    const stack = activeColonScopes(state.nodes, state.stack, label);
    const nodes = appendColonNode(root, state.nodes, stack, header, label);
    return ColonScopeState.make({ nodes, stack: endsWithColon(header) ? A.append(stack, nodes.length - 1) : stack });
  }).nodes;
const scopedElementOf =
  (claimText: string, root: string) =>
  (node: ColonScopeNode): EncodedElement => {
    const element = elementOf(
      claimText,
      node.parent === root ? "limitation" : "sub-limitation",
      inspectionLexicalGrammar
    )(node.path, node.header);
    return node.group
      ? {
          ...element,
          kind: "limitation",
          anchor: anchorOf({ start: node.header.start, text: Str.slice(node.header.start, node.endChar)(claimText) }),
        }
      : element;
  };
const inspectionTreeInput: typeof treeInput = (claim, parts) => {
  const root = `${claim.claimNumber}`;
  const segments = A.filter(
    bodySegments(claim, parts.body, splitInspectionBody),
    (span) => !transparentColonFrame(span)
  );
  const nodes = colonNodesOf(root, segments);
  const elements = A.prepend(
    A.map(nodes, scopedElementOf(claim.claimText, root)),
    elementOf(
      claim.claimText,
      "preamble-subject",
      inspectionLexicalGrammar
    )(root, pipe(parts.preamble, trimSpan, dropSuffix([","]), trimSpan))
  );
  return assembleTree(
    claim,
    elements,
    A.map(nodes, ({ path, parent }): EncodedEdge => ({ kind: "part-of", child: path, parent }))
  );
};

const decodeTree = S.decodeEffect(ClaimElementTree);

// Resolve each ancestor's owner references in that ancestor's own common natural
// ancestry, never in the current claim's pooled earlier elements. The provider
// is lazy: the historical strict strategy does not request this extra evidence.
const ancestorReferenceProvider =
  (
    claim: PatentClaim,
    claims: ReadonlyArray<PatentClaim>,
    commonByClaim: HashMap.HashMap<number, HashSet.HashSet<number>>,
    constructTree: typeof treeInput,
    resolveReferences: StructuralReferenceStrategy
  ): (() => ReadonlyArray<EncodedEdge>) =>
  () => {
    let prepared = HashMap.empty<number, ReadonlyArray<EncodedEdge>>();
    const sourceAncestors = (number: number) => {
      const allowed = O.getOrElse(HashMap.get(commonByClaim, number), HashSet.empty<number>);
      return A.filter(
        claims,
        (candidate) => candidate.claimNumber < number && HashSet.has(allowed, candidate.claimNumber)
      );
    };
    const elementsOf = (source: PatentClaim): ReadonlyArray<EncodedElement> =>
      O.match(locateParts(source), {
        onNone: A.empty<EncodedElement>,
        onSome: (parts) => constructTree(source, parts).elements,
      });
    const referencesFor = (source: PatentClaim): ReadonlyArray<EncodedEdge> =>
      O.getOrElse(HashMap.get(prepared, source.claimNumber), () => {
        const context = sourceAncestors(source.claimNumber);
        const resolved = resolveReferences(
          elementsOf(source),
          A.flatMap(context, elementsOf),
          referencesOf(source),
          () => A.flatMap(context, referencesFor)
        );
        const references = A.filter(resolved, (edge) => edge.kind === "antecedent");
        prepared = HashMap.set(prepared, source.claimNumber, references);
        return references;
      });
    return A.flatMap(sourceAncestors(claim.claimNumber), referencesFor);
  };

const decomposeInContext = Effect.fn("ClaimElement.decomposeClaim")(function* (
  claim: PatentClaim,
  claims: ReadonlyArray<PatentClaim>,
  constructTree: typeof treeInput,
  resolveReferences: StructuralReferenceStrategy = legacyStructuralReferences
): Effect.fn.Return<ClaimElementTree, ClaimDecompositionError> {
  const claimNumber = claim.claimNumber;
  const parts = yield* Effect.fromOption(locateParts(claim), () =>
    ClaimDecompositionError.make({
      claimNumber,
      message: `Claim ${claimNumber} does not contain its preamble, transition and body in that order.`,
      reason: "unsupported-claim-text",
    })
  );
  const needed = A.prepend(referencesOf(claim), claimNumber);
  const missing = A.filter(needed, (needs) => !A.some(claims, (known) => Num.Equivalence(known.claimNumber, needs)));
  if (A.isReadonlyArrayNonEmpty(missing)) {
    return yield* ClaimDecompositionError.make({
      claimNumber,
      message: `Claim ${claimNumber} needs claim ${A.join(
        A.map(missing, (number) => `${number}`),
        ", "
      )}, which is not in the claim set.`,
      reason: "claim-not-in-claims",
    });
  }
  const input = constructTree(claim, parts);
  // A term must resolve on every alternative dependency route. Intersect
  // branch ancestry instead of treating the union as one fictitious chain.
  let commonByClaim = HashMap.empty<number, HashSet.HashSet<number>>();
  for (const earlier of A.sort(claims, (left: PatentClaim, right: PatentClaim) =>
    Num.Order(left.claimNumber, right.claimNumber)
  )) {
    const branches = A.map(referencesOf(earlier), (parent) =>
      HashSet.add(O.getOrElse(HashMap.get(commonByClaim, parent), HashSet.empty<number>), parent)
    );
    const common = O.match(A.head(branches), {
      onNone: () => HashSet.empty<number>(),
      onSome: (first) => A.reduce(A.drop(branches, 1), first, (shared, branch) => HashSet.intersection(shared, branch)),
    });
    commonByClaim = HashMap.set(commonByClaim, earlier.claimNumber, common);
  }
  const ancestorNumbers = O.getOrElse(HashMap.get(commonByClaim, claimNumber), HashSet.empty<number>);
  const ancestors = A.flatMap(
    A.filter(claims, (candidate: PatentClaim) => HashSet.has(ancestorNumbers, candidate.claimNumber)),
    (candidate: PatentClaim) =>
      O.match(locateParts(candidate), {
        onNone: () => [],
        onSome: (located) => constructTree(candidate, located).elements,
      })
  );
  const antecedents = resolveReferences(
    input.elements,
    ancestors,
    referencesOf(claim),
    ancestorReferenceProvider(claim, claims, commonByClaim, constructTree, resolveReferences)
  );
  const bodyDependencies = A.flatMap(antecedents, (edge): ReadonlyArray<EncodedEdge> => {
    if (
      edge.kind !== "antecedent" ||
      edge.referring.path === `${claimNumber}` ||
      !Str.includes(".")(edge.introducing.path)
    )
      return [];
    const parent = A.some(referencesOf(claim), (number) => Str.startsWith(`${number}.`)(edge.introducing.path));
    const subject = A.some(
      input.elements,
      (element) =>
        element.path === edge.referring.path &&
        O.exists(A.head(element.terms), (term) => {
          if (term.anchor.startChar !== element.anchor.startChar) return false;
          const partOwner =
            isIntroducingDeterminer(term.determiner) &&
            O.isSome(Str.match(/\b(?:portion|surface|edge|end|region|area|section|side)$/u)(term.head)) &&
            Str.trim(Str.slice(term.anchor.endChar, edge.referring.anchor.startChar)(claim.claimText)) === "of";
          if (term.anchor.startChar !== edge.referring.anchor.startChar && !partOwner) return false;
          return A.some(
            ancestors,
            (ancestor) =>
              ancestor.path === edge.introducing.path &&
              A.some(
                ancestor.terms,
                (introduced) =>
                  introduced.anchor.startChar === edge.introducing.anchor.startChar &&
                  isIntroducingDeterminer(introduced.determiner) &&
                  (partOwner || introduced.head === term.head || isPluralityReferenceHead(term.head)(introduced.head))
              )
          );
        })
    );
    return parent && subject
      ? [{ kind: "depends-on-element", dependent: edge.referring.path, ancestor: edge.introducing.path }]
      : [];
  });
  // A bare object explicitly defined by `to form` is a structural result,
  // even though bare wording does not establish legal antecedent basis.
  // Later limitations may refine that result through an immediate parent.
  const resultDependencies = A.flatMap(
    input.elements,
    (element): ReadonlyArray<EncodedEdge> =>
      O.match(
        O.filter(
          A.head(element.terms),
          (term) =>
            element.kind === "functional-relation" &&
            term.anchor.startChar === element.anchor.startChar &&
            isReferringDeterminer(term.determiner)
        ),
        {
          onNone: () => [],
          onSome: (subject) => {
            const origins = A.flatMap(ancestors, (ancestor) =>
              A.map(
                A.filter(
                  ancestor.terms,
                  (term) =>
                    term.determiner === "bare" &&
                    term.head === subject.head &&
                    O.isSome(
                      Str.match(/\bto form\s*$/iu)(
                        Str.slice(0, term.anchor.startChar - ancestor.anchor.startChar)(ancestor.anchor.quote)
                      )
                    ) &&
                    A.some(
                      antecedents,
                      (edge) =>
                        edge.kind === "antecedent" &&
                        edge.referring.path === element.path &&
                        edge.referring.anchor.startChar === subject.anchor.startChar &&
                        edge.introducing.path === ancestor.path &&
                        edge.introducing.anchor.startChar === term.anchor.startChar
                    )
                ),
                () => ancestor
              )
            );
            if (origins.length !== 1) return [];
            const origin = O.getOrThrow(A.head(origins));
            const parents = A.filter(
              ancestors,
              (ancestor) =>
                A.some(referencesOf(claim), (number) => Str.startsWith(`${number}.`)(ancestor.path)) &&
                (ancestor.path === origin.path ||
                  (ancestor.kind === "functional-relation" &&
                    O.exists(
                      A.head(ancestor.terms),
                      (term) => term.anchor.startChar === ancestor.anchor.startChar && term.head === subject.head
                    )))
            );
            return O.match(parents.length === 1 ? A.head(parents) : O.none(), {
              onNone: () => [],
              onSome: (parent): ReadonlyArray<EncodedEdge> => [
                { kind: "depends-on-element", dependent: element.path, ancestor: parent.path },
              ],
            });
          },
        }
      )
  );
  const linked = {
    ...input,
    edges: [
      ...A.filter(input.edges, (edge) => edge.kind !== "antecedent"),
      ...antecedents,
      ...bodyDependencies,
      ...resultDependencies,
    ],
  };
  return yield* decodeTree(linked).pipe(
    Effect.mapError((error) =>
      ClaimDecompositionError.make({
        claimNumber,
        message: `Claim ${claimNumber} decomposed into an incoherent tree: ${error.message}`,
        reason: "incoherent-tree",
      })
    )
  );
});

/**
 * Deterministic rule decomposer: splits a claim into span-anchored elements, terms and edges.
 *
 * **Details**
 *
 * - The preamble, transition and body are found in `claimText` in that order.
 *   The root element `"<n>"` is the preamble subject, trimmed of a trailing
 *   comma.
 * - The body splits at top-level `;` (outside `()` and `[]`) into limitations
 *   `"<n>.a"`, `"<n>.b"`, and so on, with leading `and`/`or` connectors and
 *   trailing punctuation stripped. A top-level `:` followed by whitespace
 *   also ends a segment and stays with it; the first limitation ending in `:`
 *   absorbs every later segment as sub-limitations `"<n>.<x>.i"`,
 *   `"<n>.<x>.ii"`, and so on.
 * - Elements retain determiner-bearing and explicit bare noun phrases without
 *   a token cap. Participial modifiers are retained before nominal heads.
 *   Source predicates and grammatical separators delimit phrase boundaries.
 * - Edges: `part-of` to each parent, `depends-on-element` from the root to each
 *   referenced claim's root, unique antecedents in this claim or dependency
 *   ancestors, and ordered source-anchored functional parts.
 *
 * Fails with `unsupported-claim-text` when a part is missing from the text,
 * `claim-not-in-claims` when the claim or a referenced claim is absent from the
 * claim set, and `incoherent-tree` when the result fails the tree's coherence
 * check (a decomposer bug).
 *
 * **Example** (Decompose an independent claim)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { decomposeClaim } from "@beep/law-practice-domain/values/ClaimElement"
 * import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 *
 * const claim = PatentClaim.cases.independent.make({
 *   body: "a sensor; and a controller coupled to the sensor.",
 *   claimNumber: PosInt.make(1),
 *   claimText: "A system comprising: a sensor; and a controller coupled to the sensor.",
 *   preamble: "A system",
 *   transition: "comprising"
 * })
 * const tree = Effect.runSync(decomposeClaim(claim, [claim]))
 * console.log(A.map(tree.elements, ({ path }) => path)) // ["1", "1.a", "1.b"]
 * console.log(A.some(tree.edges, ({ kind }) => kind === "functional")) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const decomposeClaim: {
  (
    claims: Parameters<ClaimElementDecomposer>[1]
  ): (claim: Parameters<ClaimElementDecomposer>[0]) => ReturnType<ClaimElementDecomposer>;
  (...args: Parameters<ClaimElementDecomposer>): ReturnType<ClaimElementDecomposer>;
} = dual(
  2,
  Effect.fn("ClaimElement.strictDecomposition")((claim: PatentClaim, claims: PatentClaims) =>
    decomposeInContext(claim, claims, treeInput)
  ) satisfies ClaimElementDecomposer
);

/**
 * Decompose every eligible source record while retaining every unchecked record.
 *
 * **Details**
 * The raw input is normalized and qualified here; callers cannot supply a
 * sparse array disguised as PatentClaims. Every alternative ancestor must be
 * available. Its inspection tree strategy preserves full colon-group extents
 * with header-only lexical ownership and explicit label scope, while the strict
 * decomposer retains its original colon contract. This operation builds structures only; substantive findings and
 * global source-index coverage belong to the subsequent inspection policy.
 *
 * **Example** (Inspect the structural input operation)
 *
 * ```ts
 * import { decomposeClaimInput } from "@beep/law-practice-domain/values/ClaimElement"
 * console.log(typeof decomposeClaimInput) // function
 * ```
 *
 * @category domain-logic
 * @since 0.0.0
 */
export const decomposeClaimInput = Effect.fn("ClaimElement.decomposeClaimInput")(function* (
  input: ClaimInputCollection
): Effect.fn.Return<ReadonlyArray<ClaimInputDecomposition>> {
  const qualifications = yield* qualifyClaimInput(input);
  const claims = A.map(A.filter(qualifications, ClaimInputQualification.guards["context-ready"]), ({ claim }) => claim);
  return yield* Effect.forEach(qualifications, (qualification): Effect.Effect<ClaimInputDecomposition> => {
    if (!ClaimInputQualification.guards["context-ready"](qualification)) {
      return Effect.succeed(ClaimInputDecomposition.cases.unchecked.make({ qualification }));
    }
    return decomposeInContext(qualification.claim, claims, inspectionTreeInput, inspectionStructuralReferences).pipe(
      Effect.map((tree) => ClaimInputDecomposition.cases.decomposed.make({ qualification, tree })),
      Effect.catchTag("ClaimDecompositionError", (cause) =>
        Effect.succeed(ClaimInputDecomposition.cases["decomposition-failed"].make({ qualification, cause }))
      )
    );
  });
});
