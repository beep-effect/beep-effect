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
 * relations are not emitted yet.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, flow, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PatentClaim } from "../PatentDocument/PatentDocument.model.ts";
import { ClaimDecompositionError } from "./ClaimElement.errors.ts";
import { ClaimTermDeterminer } from "./ClaimElement.model.ts";
import { ClaimElementTree } from "./ClaimElement.tree.model.ts";
import type { PatentClaims } from "../PatentDocument/PatentDocument.model.ts";
import type { ClaimElementEdge } from "./ClaimElement.edge.model.ts";
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
  O.map(Str.indexOf(search)(Str.slice(from)(text)), (index) => from + index);

// Forward cursor: preamble, then transition, then body, each searched from the end of the previous part.
const locateParts = ({
  claimText,
  preamble,
  transition,
  body,
}: PatentClaim): O.Option<{ readonly preamble: Span; readonly body: Span }> =>
  O.flatMap(indexFrom(claimText, preamble, 0), (preambleStart) =>
    pipe(
      indexFrom(claimText, transition, preambleStart + Str.length(preamble)),
      O.flatMap((transitionStart) => indexFrom(claimText, body, transitionStart + Str.length(transition))),
      O.map((bodyStart) => ({
        preamble: { start: preambleStart, text: preamble },
        body: { start: bodyStart, text: body },
      }))
    )
  );

// Top-level separators: `;` ends a segment and is dropped; a `:` followed by
// whitespace or the end of the body ends a segment and stays with it.
const separatorPattern = /[;()[\]]|:(?=\s|$)/gu;

const splitBody = (body: Span): ReadonlyArray<Span> => {
  const split = A.reduce(
    matchesIn(separatorPattern)(body),
    { depth: 0, from: 0, segments: A.empty<Span>() },
    (state, mark) =>
      Match.value(mark.text).pipe(
        Match.whenOr("(", "[", () => ({ ...state, depth: state.depth + 1 })),
        Match.whenOr(")", "]", () => ({ ...state, depth: Num.max(0, state.depth - 1) })),
        Match.orElse((separator) => {
          const at = mark.start - body.start;
          const end = separator === ":" ? at + 1 : at;
          return state.depth > 0
            ? state
            : { depth: 0, from: at + 1, segments: A.append(state.segments, sliceSpan(body, state.from, end)) };
        })
      )
  );
  return A.append(split.segments, sliceSpan(body, split.from));
};

const cleanSegment = flow(
  trimSpan,
  dropPrefix(["and ", "or "]),
  trimSpan,
  dropSuffix([";", ".", ", and", ", or"]),
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

const tokenPattern = /[A-Za-z0-9-]+|[,;:.()[\]]/gu;
const digitsPattern = /^[0-9]+$/u;
const punctuation = HashSet.make(",", ";", ":", ".", "(", ")", "[", "]");
const boundaryWords = HashSet.fromIterable(
  Str.split(
    "that which wherein whereby where when configured adapted operable arranged having comprising comprises including includes containing contains being is are was were has have to for in on of at by with from into onto between through via and or such so than as each said the a an its their",
    " "
  )
);
const HEAD_TOKEN_CAP = 5;

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

// Rule `participle-boundary`: after the first head token, an -ed or -ing word
// ends the head. Words of four letters or fewer ("bed", "ring") and -eed words
// ("speed", "feed") are not participles.
const isParticiple = (word: string): boolean =>
  Str.length(word) > 4 && (Str.endsWith("ing")(word) || (Str.endsWith("ed")(word) && !Str.endsWith("eed")(word)));

const isHeadToken = ({ text }: Span, position: number): boolean => {
  const word = Str.toLowerCase(text);
  return (
    !HashSet.has(punctuation, text) && !HashSet.has(boundaryWords, word) && (position === 0 || !isParticiple(word))
  );
};

const headAt = (tokens: ReadonlyArray<Span>, index: number): ReadonlyArray<Span> =>
  A.take(A.takeWhile(A.drop(tokens, index), isHeadToken), HEAD_TOKEN_CAP);

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
    head: A.join(
      A.map(head, ({ text }) => Str.toLowerCase(text)),
      " "
    ),
  };
};

type ScanStep = readonly [term: O.Option<EncodedTerm>, resumeAt: number];

const scanStepOf = (term: O.Option<EncodedTerm>, resumeAt: number): ScanStep => [term, resumeAt];

// One scan step from `index`: the term found there, if any, and where the scan resumes.
const scanStep =
  (claimText: string, tokens: ReadonlyArray<Span>) =>
  (index: number): ScanStep =>
    pipe(
      determinerAt(tokens, index),
      O.match({
        onNone: () => scanStepOf(O.none(), index + 1),
        onSome: ({ determiner, start, width }) => {
          const headStart =
            index + width + (isReferringDeterminer(determiner) ? quantifierWidthAt(tokens, index + width) : 0);
          const head = headAt(tokens, headStart);
          return A.isReadonlyArrayNonEmpty(head) && !isClaimReference(head)
            ? scanStepOf(O.some(termOf(claimText, start, determiner, head)), headStart + A.length(head))
            : scanStepOf(O.none(), index + width);
        },
      })
    );

const termsIn =
  (claimText: string) =>
  (span: Span): ReadonlyArray<EncodedTerm> => {
    const tokens = matchesIn(tokenPattern)(span);
    const step = scanStep(claimText, tokens);
    return A.getSomes(A.unfold(0, (index) => (index < A.length(tokens) ? O.some(step(index)) : O.none())));
  };

const elementOf =
  (claimText: string, kind: ClaimElementKind) =>
  (path: string, span: Span): EncodedElement => ({
    path,
    anchor: anchorOf(span),
    kind,
    terms: termsIn(claimText)(span),
  });

const antecedentEdges = (elements: ReadonlyArray<EncodedElement>): ReadonlyArray<EncodedEdge> => {
  const located = A.flatMap(elements, ({ path, terms }) => A.map(terms, (term) => ({ path, term })));
  return A.getSomes(
    A.map(
      A.filter(located, ({ term }) => isReferringDeterminer(term.determiner)),
      (referring) => {
        const introductions = A.filter(
          located,
          ({ term }) =>
            isIntroducingDeterminer(term.determiner) &&
            Str.Equivalence(term.head, referring.term.head) &&
            term.anchor.startChar < referring.term.anchor.startChar
        );
        return pipe(
          A.length(introductions) === 1 ? A.head(introductions) : O.none(),
          O.map(
            (introducing): EncodedEdge => ({
              kind: "antecedent",
              referring: { path: referring.path, anchor: referring.term.anchor },
              introducing: { path: introducing.path, anchor: introducing.term.anchor },
            })
          )
        );
      }
    )
  );
};

const referencesOf = (claim: PatentClaim): ReadonlyArray<number> =>
  PatentClaim.match(claim, {
    independent: A.empty<number>,
    dependent: ({ claimReferences }) => claimReferences,
  });

const treeInput = (
  claim: PatentClaim,
  parts: { readonly preamble: Span; readonly body: Span }
): typeof ClaimElementTree.Encoded => {
  const root = `${claim.claimNumber}`;
  const segments = A.filter(A.map(splitBody(parts.body), cleanSegment), isContentSegment);
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
  return {
    claimNumber: claim.claimNumber,
    producer: "rule",
    elements,
    edges: [
      ...A.map(limitations, ({ path }): EncodedEdge => ({ kind: "part-of", child: path, parent: root })),
      ...A.map(subLimitations, ({ path }): EncodedEdge => ({ kind: "part-of", child: path, parent })),
      ...A.map(
        referencesOf(claim),
        (ancestor): EncodedEdge => ({
          kind: "depends-on-element",
          dependent: root,
          ancestor: `${ancestor}`,
        })
      ),
      ...antecedentEdges(elements),
    ],
  };
};

const decodeTree = S.decodeEffect(ClaimElementTree);

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
 * - Each element is scanned for determiners (`a`, `an`, `the`, `said`,
 *   `at least one`, `one or more`, `a plurality of`); the head is at most five
 *   words and stops at punctuation, connective words, or an `-ed`/`-ing` word
 *   after its first word.
 * - Edges: `part-of` to each parent, `depends-on-element` from the root to each
 *   referenced claim's root, and an intra-claim `antecedent` edge when a
 *   `the`/`said` term has exactly one earlier introduction with the same head.
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
 * console.log(A.map(tree.edges, ({ kind }) => kind)) // ["part-of", "part-of", "antecedent"]
 * ```
 *
 * @category domain-logic
 * @since 0.0.0
 */
export const decomposeClaim: {
  (
    claims: Parameters<ClaimElementDecomposer>[1]
  ): (claim: Parameters<ClaimElementDecomposer>[0]) => ReturnType<ClaimElementDecomposer>;
  (...args: Parameters<ClaimElementDecomposer>): ReturnType<ClaimElementDecomposer>;
} = dual(
  2,
  Effect.fn("ClaimElement.decomposeClaim")(function* (
    claim: PatentClaim,
    claims: PatentClaims
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
    return yield* decodeTree(treeInput(claim, parts)).pipe(
      Effect.mapError((error) =>
        ClaimDecompositionError.make({
          claimNumber,
          message: `Claim ${claimNumber} decomposed into an incoherent tree: ${error.message}`,
          reason: "incoherent-tree",
        })
      )
    );
  }) satisfies ClaimElementDecomposer
);
