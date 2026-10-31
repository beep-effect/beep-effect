/**
 * Markdown-AST normalization for typed patent application documents.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { Heading, Ol, renderPlainTextBlock } from "@beep/md";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { constant, flow, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PosInt } from "../../internal/PosInt.ts";
import {
  PatentApplicationDocument,
  PatentApplicationSection,
  PatentClaim,
  PatentClaims,
  PatentClaimTransition,
} from "./PatentDocument.model.ts";
import type { Block, Document } from "@beep/md";
import type { PatentApplicationSectionRole } from "./PatentDocument.model.ts";

const decodeUnknownPatentApplicationDocument = S.decodeUnknownEffect(PatentApplicationDocument);
const decodeUnknownPatentClaims = S.decodeUnknownEffect(PatentClaims);

const $I = $LawPracticeDomainId.create("values/PatentDocument/PatentDocument.normalizer");
const claimBlockPattern = /(?:^|\n)[\t ]*(\d+)\.[\t ]+(.+?)(?=\n[\t ]*\d+\.[\t ]+|\s*$)/gsu;
const transitionPattern =
  /\b(consisting essentially of|consisting of|comprising|comprises|comprised of|including|includes|having|wherein|where|(?:(?:is|being)\s+)?characteri[sz]ed (?:in that|by(?: the fact that| the steps of)?)|in which(?: method)?)\b/giu;
const claimReferenceMarkerPattern = /\bclaims?\b/iu;
const claimReferencePattern = /(\d+)(?:\s*(?:-|–|—|through|thru|to)\s*(\d+))?/giu;
const ambiguousLexicalTransition = LiteralKit(["including", "having"]);
const isAmbiguousLexicalTransition = S.is(ambiguousLexicalTransition);
const isOrderedList = S.is(Ol);
const ambiguousTransitionPrefixPattern = /\b(?:by|for|of|without)\s*$/iu;
const MAX_PARENT_CLAIM_RANGE_CARDINALITY = 1024;

const ClaimNumberFromString = S.FiniteFromString.pipe(S.decodeTo(PosInt));
const decodeClaimNumberFromStringOption = S.decodeOption(ClaimNumberFromString);

const PatentDocumentNormalizationReason = LiteralKit([
  "content-before-first-section",
  "empty-section",
  "invalid-claim",
  "invalid-document",
  "missing-claims-section",
  "unknown-section-heading",
]);

/**
 * Typed failure raised while normalizing a Markdown patent application.
 *
 * **Example** (Construct an unknown-heading failure)
 *
 * ```ts
 * import { PatentDocumentNormalizationError } from "@beep/law-practice-domain/values/PatentDocument"
 *
 * const error = PatentDocumentNormalizationError.make({
 *   message: "Unknown patent application section heading: APPENDIX.",
 *   reason: "unknown-section-heading"
 * })
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PatentDocumentNormalizationError extends S.TaggedError<
  PatentDocumentNormalizationError,
  { readonly brand: unique symbol }
>($I`PatentDocumentNormalizationError`)(
  "PatentDocumentNormalizationError",
  {
    message: S.NonEmptyString.annotateKey({
      description: "Actionable explanation of the failed Markdown normalization invariant.",
    }),
    reason: PatentDocumentNormalizationReason.annotateKey({
      description: "Closed normalization failure category suitable for exhaustive handling.",
    }),
  },
  $I.annoteError<PatentDocumentNormalizationError>("PatentDocumentNormalizationError", {
    description: "Typed failure raised while normalizing a Markdown patent application.",
  })
) {}

const normalizeHeading: (heading: string) => string = flow(
  Str.trim,
  Str.toLowerCase,
  Str.replace(/[^a-z0-9]+/gu, " "),
  Str.replace(/\s+/gu, " "),
  Str.trim
);

const sectionRoleFromHeading = (heading: string): O.Option<PatentApplicationSectionRole> =>
  Match.value(normalizeHeading(heading)).pipe(
    Match.when(
      (value) => A.contains(["title", "title of invention", "title of the invention"], value),
      () => O.some("title-of-invention" as const)
    ),
    Match.when(
      (value) =>
        A.contains(
          [
            "cross reference to related applications",
            "cross reference to related application",
            "cross reference to related patent applications",
          ],
          value
        ),
      () => O.some("cross-reference-to-related-applications" as const)
    ),
    Match.when(
      (value) =>
        A.contains(
          [
            "statement regarding federally sponsored research or development",
            "federally sponsored research or development",
            "federally sponsored research",
          ],
          value
        ),
      () => O.some("federally-sponsored-research" as const)
    ),
    Match.when(
      (value) =>
        A.contains(
          [
            "names of the parties to a joint research agreement",
            "parties to a joint research agreement",
            "joint research agreement parties",
          ],
          value
        ),
      () => O.some("joint-research-agreement-parties" as const)
    ),
    Match.when(
      (value) =>
        A.contains(
          ["incorporation by reference of material submitted on a compact disc", "incorporation by reference"],
          value
        ),
      () => O.some("incorporation-by-reference" as const)
    ),
    Match.when(
      (value) =>
        A.contains(
          [
            "statement regarding prior disclosures by the inventor or a joint inventor",
            "prior inventor disclosures",
            "prior disclosures by the inventor",
          ],
          value
        ),
      () => O.some("prior-inventor-disclosures" as const)
    ),
    Match.when(
      (value) => A.contains(["background", "background of the invention"], value),
      () => O.some("background" as const)
    ),
    Match.when(
      (value) => A.contains(["brief summary of the invention", "summary", "summary of the invention"], value),
      () => O.some("summary" as const)
    ),
    Match.when(
      (value) =>
        A.contains(
          ["brief description of the several views of the drawing", "brief description of the drawings", "drawings"],
          value
        ),
      () => O.some("drawings-description" as const)
    ),
    Match.when(
      (value) =>
        A.contains(
          ["detailed description", "detailed description of the invention", "description of the invention"],
          value
        ),
      () => O.some("detailed-description" as const)
    ),
    Match.when(
      (value) => A.contains(["a claim or claims", "claim", "claims"], value),
      () => O.some("claims" as const)
    ),
    Match.when(
      (value) => A.contains(["abstract", "abstract of the disclosure"], value),
      () => O.some("abstract" as const)
    ),
    Match.when(
      (value) =>
        A.contains(
          ["sequence listing", "sequence listing table or computer program listing appendix", "sequence listing table"],
          value
        ),
      () => O.some("sequence-listing" as const)
    ),
    Match.orElse(O.none<PatentApplicationSectionRole>)
  );

interface SectionDraft {
  readonly blocks: ReadonlyArray<Block>;
  readonly heading: string;
  readonly role: PatentApplicationSectionRole;
  readonly sourceEnd: number;
  readonly sourceStart: number;
}

interface SectionDraftState {
  readonly current: O.Option<SectionDraft>;
  readonly drafts: ReadonlyArray<SectionDraft>;
  readonly errors: ReadonlyArray<PatentDocumentNormalizationError>;
  readonly sourceOffset: number;
}

const renderPatentTextBlock = (block: Block): string =>
  Match.value(block).pipe(
    Match.when(isOrderedList, ({ children, start }) =>
      pipe(
        children,
        A.map(
          (item, index) =>
            `${Num.sum(start, index)}. ${renderPlainTextBlock(
              Ol.make({
                children: [item],
              })
            )}`
        ),
        A.join("\n")
      )
    ),
    Match.orElse(renderPlainTextBlock)
  );

const renderPatentTextBlocks: (blocks: ReadonlyArray<Block>) => string = flow(
  A.map(renderPatentTextBlock),
  A.join("\n")
);

const flushCurrent = (state: SectionDraftState): SectionDraftState => ({
  ...state,
  current: O.none(),
  drafts: pipe(
    state.current,
    O.match({
      onNone: () => state.drafts,
      onSome: (current) => A.append(state.drafts, current),
    })
  ),
});

const collectSectionDrafts = (document: Document): SectionDraftState =>
  pipe(
    document.children,
    A.reduce<SectionDraftState, Block>(
      { current: O.none(), drafts: A.empty(), errors: A.empty(), sourceOffset: 0 },
      (state, block) => {
        const renderedBlock = renderPatentTextBlock(block);
        const nextSourceOffset = Num.sum(state.sourceOffset, Num.sum(Str.length(renderedBlock), 1));
        if (Heading.is(block) && block.level === 1) {
          const heading = Str.trim(renderedBlock);
          const flushed = flushCurrent(state);
          return pipe(
            sectionRoleFromHeading(heading),
            O.match({
              onNone: () => ({
                ...flushed,
                sourceOffset: nextSourceOffset,
                errors: A.append(
                  flushed.errors,
                  PatentDocumentNormalizationError.make({
                    message: `Unknown patent application section heading: ${heading}.`,
                    reason: "unknown-section-heading",
                  })
                ),
              }),
              onSome: (role) => ({
                ...flushed,
                current: O.some({
                  blocks: A.empty(),
                  heading,
                  role,
                  sourceEnd: nextSourceOffset,
                  sourceStart: nextSourceOffset,
                }),
                sourceOffset: nextSourceOffset,
              }),
            })
          );
        }
        return pipe(
          state.current,
          O.match({
            onNone: () => ({
              ...state,
              sourceOffset: nextSourceOffset,
              errors: Str.isEmpty(Str.trim(renderPlainTextBlock(block)))
                ? state.errors
                : A.append(
                    state.errors,
                    PatentDocumentNormalizationError.make({
                      message: "Patent application content must follow a recognized level-one section heading.",
                      reason: "content-before-first-section",
                    })
                  ),
            }),
            onSome: (current) => ({
              ...state,
              current: O.some({
                ...current,
                blocks: A.append(current.blocks, block),
                sourceEnd: Num.sum(state.sourceOffset, Str.length(renderedBlock)),
              }),
              sourceOffset: nextSourceOffset,
            }),
          })
        );
      }
    ),
    flushCurrent
  );

const parseClaimNumber = (value: string): O.Option<PosInt> => decodeClaimNumberFromStringOption(value);
const parseClaimTransition: (value: string) => PatentClaimTransition = flow(
  Str.toLowerCase,
  Str.replace(/^(?:(?:(?:is|being)\s+)?characteri[sz]ed .+|in which(?: method)?|where)$/u, "wherein"),
  Str.replace(/^(?:comprises|comprised of)$/u, "comprising"),
  Str.replace(/^includes$/u, "including"),
  // A source comma can introduce an implicit dependent limitation; the source
  // remains unchanged while the existing transition field records its role.
  Str.replace(/^,$/u, "wherein"),
  S.decodeUnknownOption(PatentClaimTransition),
  O.getOrThrow
);

const byMatchIndex = Order.mapInput(Num.Order, (match: RegExpMatchArray) =>
  O.getOrElse(O.fromUndefinedOr(match.index), constant(0))
);

const transitionFromClaimText = (claimText: string): O.Option<RegExpMatchArray> => {
  const matches = A.filter(A.fromIterable(Str.matchAll(transitionPattern)(claimText)), (match) => {
    const transition = pipe(A.get(match, 0), O.getOrThrow, Str.toLowerCase);
    const index = O.getOrElse(O.fromUndefinedOr(match.index), constant(0));
    return (
      !isAmbiguousLexicalTransition(transition) ||
      O.isNone(Str.match(ambiguousTransitionPrefixPattern)(Str.slice(0, index)(claimText)))
    );
  });
  const implicit = () =>
    A.findFirst(A.fromIterable(Str.matchAll(/,(?=\s+(?:the|said|each|an?|operating)\b)/giu)(claimText)), (match) => {
      const index = O.getOrElse(O.fromUndefinedOr(match.index), constant(0));
      return (
        O.isSome(
          Str.match(/\bclaims?\s+\d+(?:(?:\s*,\s*|\s+(?:and|or|to|through)\s+)\d+)*\s*$/iu)(
            Str.slice(0, index)(claimText)
          )
        ) &&
        O.isSome(
          Str.match(/\b(?:being|is|are|operating|operative|corresponding|performing)\b/iu)(
            Str.slice(index + 1)(claimText)
          )
        )
      );
    });
  // An eligible source comma competes with later lexical transitions: whichever starts
  // first splits the claim, so a component "includes" cannot swallow the dependent limitation.
  const first = pipe(A.getSomes([A.head(matches), implicit()]), A.sort(byMatchIndex), A.head);
  const subject = first.pipe(
    O.map((match) => Str.slice(0, match.index)(claimText)),
    O.flatMap(
      Str.match(/^(?:(?:an?|the)\s+)?(.+?)(?=\s+(?:for|of|with|according|as|to|designed|intended)\b|\s*\(\d|[,;:]|$)/iu)
    ),
    O.flatMap(A.get(1)),
    O.map(flow(Str.trim, Str.toLowerCase))
  );
  const defining = A.findFirst(matches, (match) => {
    const prefix = pipe(Str.slice(0, match.index)(claimText), Str.trim, Str.toLowerCase);
    return (
      O.isSome(Str.match(/^(?:(?:is|being)\s+)?characteri[sz]ed\b/iu)(match[0])) &&
      (O.isSome(Str.match(/[,;]$/u)(prefix)) ||
        O.exists(subject, (value) => Str.endsWith(` said ${value}`)(prefix) || Str.endsWith(` the ${value}`)(prefix)))
    );
  });
  return O.exists(first, (match) => O.isSome(Str.match(/^(?:wherein|having|including)$/iu)(match[0]))) &&
    O.isSome(defining)
    ? defining
    : first;
};

const isPriorClaimNumber = (currentClaimNumber: PosInt, candidate: PosInt): boolean =>
  Num.isLessThan(candidate, currentClaimNumber);

const claimReferencesFromMatch = (
  match: RegExpMatchArray,
  currentClaimNumber: PosInt
): O.Option<ReadonlyArray<PosInt>> =>
  pipe(
    A.get(match, 1),
    O.flatMap(parseClaimNumber),
    O.filter((start) => isPriorClaimNumber(currentClaimNumber, start)),
    O.flatMap((start) =>
      pipe(
        O.fromUndefinedOr(match[2]),
        O.match({
          onNone: () => O.some<ReadonlyArray<PosInt>>([start]),
          onSome: (endText) =>
            pipe(
              parseClaimNumber(endText),
              O.filter(
                (end) =>
                  Num.isGreaterThanOrEqualTo(end, start) &&
                  isPriorClaimNumber(currentClaimNumber, end) &&
                  Num.sum(Num.subtract(end, start), 1) <= MAX_PARENT_CLAIM_RANGE_CARDINALITY
              ),
              O.map((end) => A.map(A.range(start, end), (value) => PosInt.make(value)))
            ),
        })
      )
    )
  );

const parentClaimNumbers = (preamble: string, currentClaimNumber: PosInt): O.Option<ReadonlyArray<PosInt>> =>
  pipe(
    Str.match(claimReferenceMarkerPattern)(preamble),
    O.match({
      onNone: () => O.some(A.empty<PosInt>()),
      onSome: (marker) => {
        const markerIndex = pipe(O.fromUndefinedOr(marker.index), O.getOrThrow);
        const value = Str.slice(Num.sum(markerIndex, Str.length(marker[0])))(preamble);
        let expanded: ReadonlyArray<PosInt> = A.empty();
        let expandedCount = 0;
        let matched = false;
        for (const match of Str.matchAll(claimReferencePattern)(value)) {
          matched = true;
          const references = claimReferencesFromMatch(match, currentClaimNumber);
          if (O.isNone(references)) return O.none();
          expandedCount = Num.sum(expandedCount, A.length(references.value));
          if (expandedCount > MAX_PARENT_CLAIM_RANGE_CARDINALITY) return O.none();
          expanded = A.appendAll(expanded, references.value);
        }
        return matched ? O.some(A.dedupe(expanded)) : O.none();
      },
    })
  );

const parseClaim = Effect.fn("PatentDocument.parseClaim")(function* (
  claimNumberText: string,
  rawClaimText: string
): Effect.fn.Return<PatentClaim, PatentDocumentNormalizationError> {
  const claimText = pipe(rawClaimText, Str.replace(/\s+/gu, " "), Str.trim);
  const { claimNumber, transitionMatch } = yield* Effect.fromOption(
    O.all({
      claimNumber: parseClaimNumber(claimNumberText),
      transitionMatch: transitionFromClaimText(claimText),
    }),
    () =>
      PatentDocumentNormalizationError.make({
        message: `Claim ${claimNumberText} must have a positive number and a supported transition phrase.`,
        reason: "invalid-claim",
      })
  );
  const transition = parseClaimTransition(transitionMatch[0]);
  const transitionStart = pipe(O.fromUndefinedOr(transitionMatch.index), O.getOrThrow);
  const preamble = pipe(
    Str.slice(0, transitionStart)(claimText),
    Str.trim,
    Str.replace(/,?\s+further$/iu, ""),
    Str.trim
  );
  const body = Str.trim(Str.slice(transitionStart + transitionMatch[0].length)(claimText));
  const bodyReference = Str.match(
    /\b(?:according to|as (?:recited|claimed|set forth) in|of)\s+claims?\s+\d+(?:\s*(?:-|–|—|through|to|and|or|,)\s*\d+)*/iu
  )(body);
  const referenceText = O.isSome(Str.match(claimReferenceMarkerPattern)(preamble))
    ? preamble
    : O.match(bodyReference, { onNone: () => preamble, onSome: (match) => match[0] });
  const references = yield* Effect.fromOption(parentClaimNumbers(referenceText, claimNumber), () =>
    PatentDocumentNormalizationError.make({
      message: `Claim ${claimNumberText} contains an invalid parent-claim reference.`,
      reason: "invalid-claim",
    })
  );
  if (Str.isEmpty(preamble) || Str.isEmpty(body)) {
    return yield* PatentDocumentNormalizationError.make({
      message: `Claim ${claimNumberText} does not preserve a non-empty preamble, transition, and body.`,
      reason: "invalid-claim",
    });
  }
  return A.isReadonlyArrayNonEmpty(references)
    ? PatentClaim.cases.dependent.make({
        body,
        claimNumber,
        claimReferences: references,
        claimText,
        preamble,
        transition,
      })
    : PatentClaim.cases.independent.make({ body, claimNumber, claimText, preamble, transition });
});

/**
 * Normalize numbered claim texts into a validated patent claim set.
 *
 * **Details**
 *
 * Each entry is a claim number as written (`"1"`, `"00001"`) and its raw
 * claim text without the number. The text is whitespace-collapsed, split at
 * its first supported transition phrase into preamble and body, and read for
 * parent-claim references, exactly as the Markdown normalizer reads a claims
 * section. The result must be a consecutively numbered, acyclic claim set.
 *
 * **Example** (Normalize two numbered claims)
 *
 * ```ts
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 * import { normalizePatentClaims } from "@beep/law-practice-domain/values/PatentDocument"
 *
 * const claims = Effect.runSync(
 *   normalizePatentClaims([
 *     ["1", "A system comprising: a sensor."],
 *     ["2", "The system of claim 1, wherein the sensor is optical."]
 *   ])
 * )
 * console.log(A.map(claims, ({ claimType }) => claimType)) // ["independent", "dependent"]
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizePatentClaims = Effect.fn("PatentDocument.normalizeClaims")(function* (
  numberedClaims: ReadonlyArray<readonly [claimNumberText: string, claimText: string]>
): Effect.fn.Return<PatentClaims, PatentDocumentNormalizationError> {
  const claims = yield* Effect.forEach(numberedClaims, ([claimNumberText, claimText]) =>
    parseClaim(claimNumberText, claimText)
  );
  return yield* decodeUnknownPatentClaims(claims).pipe(
    Effect.mapError((cause) =>
      PatentDocumentNormalizationError.make({
        message: `Invalid patent claim dependency graph: ${String(cause)}`,
        reason: "invalid-claim",
      })
    )
  );
});

const claimsFromDraft = Effect.fn("PatentDocument.claimsFromDraft")(function* (
  draft: SectionDraft
): Effect.fn.Return<PatentClaims, PatentDocumentNormalizationError> {
  const claimsText = renderPatentTextBlocks(draft.blocks);
  const matches = A.fromIterable(Str.matchAll(claimBlockPattern)(claimsText));
  if (A.isReadonlyArrayEmpty(matches)) {
    return yield* PatentDocumentNormalizationError.make({
      message: "The claims section must contain at least one numbered claim.",
      reason: "invalid-claim",
    });
  }
  return yield* normalizePatentClaims(
    A.map(matches, (match): readonly [string, string] => [
      pipe(A.get(match, 1), O.getOrThrow),
      pipe(A.get(match, 2), O.getOrThrow),
    ])
  );
});

/**
 * Normalize one canonical Markdown AST into ordered patent sections and claims.
 *
 * **Details**
 *
 * Only level-one headings cross the section-recognition boundary. Lower-level
 * headings remain section content, so the consumer receives the typed contract
 * without duplicating heading or claim parsing.
 *
 * **Example** (Normalize a minimal patent document)
 *
 * ```ts
 * import { Md } from "@beep/md/Md"
 * import { normalizePatentApplicationDocument } from "@beep/law-practice-domain/values/PatentDocument"
 * import * as Effect from "effect/Effect";
 * const source = Md.make([
 *   Md.h1("TITLE OF THE INVENTION"),
 *   Md.p("Sensor system"),
 *   Md.h1("CLAIMS"),
 *   Md.p("1. A system comprising a sensor.")
 * ])
 * const program = normalizePatentApplicationDocument(source)
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @effects Fails with {@link PatentDocumentNormalizationError} when headings,
 * section content, claim syntax, section order, or dependencies are invalid.
 * @category normalization
 * @since 0.0.0
 */
export const normalizePatentApplicationDocument = Effect.fn("PatentDocument.normalize")(function* (
  document: Document
): Effect.fn.Return<PatentApplicationDocument, PatentDocumentNormalizationError> {
  const { drafts, errors } = collectSectionDrafts(document);
  if (A.isReadonlyArrayNonEmpty(errors)) {
    return yield* A.headNonEmpty(errors);
  }
  const sections = yield* Effect.forEach(drafts, (draft) => {
    const content = Str.trim(renderPatentTextBlocks(draft.blocks));
    return Str.isNonEmpty(content)
      ? Effect.succeed(
          PatentApplicationSection.make({
            content,
            heading: draft.heading,
            role: draft.role,
            sourceEnd: S.Natural.make(draft.sourceEnd),
            sourceStart: S.Natural.make(draft.sourceStart),
          })
        )
      : Effect.fail(
          PatentDocumentNormalizationError.make({
            message: `Patent application section ${draft.heading} must not be empty.`,
            reason: "empty-section",
          })
        );
  });
  const claimsDraft = A.findFirst(drafts, (draft) => draft.role === "claims");
  const claims = yield* pipe(
    claimsDraft,
    O.match({
      onNone: () =>
        Effect.fail(
          PatentDocumentNormalizationError.make({
            message: "Patent application document must include a CLAIMS section.",
            reason: "missing-claims-section",
          })
        ),
      onSome: claimsFromDraft,
    })
  );
  return yield* decodeUnknownPatentApplicationDocument({
    claims,
    sections,
    sourceText: renderPatentTextBlocks(document.children),
  }).pipe(
    Effect.mapError((cause) =>
      PatentDocumentNormalizationError.make({
        message: `Invalid normalized patent application document: ${String(cause)}`,
        reason: "invalid-document",
      })
    )
  );
});
