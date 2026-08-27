/**
 * Markdown-AST normalization for typed patent application documents.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { Heading, renderPlainTextBlock, renderPlainTextBlocks } from "@beep/md";
import { LiteralKit, PosInt } from "@beep/schema";
import { Effect, flow, Match, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  PatentApplicationDocument,
  PatentApplicationSection,
  PatentClaim,
  PatentClaims,
  PatentClaimTransition,
} from "./PatentDocument.model.ts";
import type { Block, Document } from "@beep/md";
import type { PatentApplicationSectionRole } from "./PatentDocument.model.ts";

const $I = $LawPracticeDomainId.create("values/PatentDocument/PatentDocument.normalizer");
const claimBlockPattern = /^\s*(\d+)\.\s+(.+?)(?=^\s*\d+\.\s+|\s*$)/gmsu;
const transitionPattern = /\b(consisting essentially of|consisting of|comprising|including|having|wherein)\b/iu;
const claimReferenceMarkerPattern = /\bclaims?\b/iu;
const referenceNumberPattern = /\d+/gu;

const ClaimNumberFromString = S.FiniteFromString.pipe(S.decodeTo(PosInt));

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
export class PatentDocumentNormalizationError extends S.TaggedError<PatentDocumentNormalizationError>(
  $I`PatentDocumentNormalizationError`
)(
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
    Match.when("claims", () => O.some("claims" as const)),
    Match.when("abstract", () => O.some("abstract" as const)),
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
}

interface SectionDraftState {
  readonly current: O.Option<SectionDraft>;
  readonly drafts: ReadonlyArray<SectionDraft>;
  readonly errors: ReadonlyArray<PatentDocumentNormalizationError>;
}

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
    A.reduce<SectionDraftState, Block>({ current: O.none(), drafts: A.empty(), errors: A.empty() }, (state, block) => {
      if (Heading.is(block) && block.level === 1) {
        const heading = Str.trim(renderPlainTextBlock(block));
        const flushed = flushCurrent(state);
        return pipe(
          sectionRoleFromHeading(heading),
          O.match({
            onNone: () => ({
              ...flushed,
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
              current: O.some({ blocks: A.empty(), heading, role }),
            }),
          })
        );
      }
      return pipe(
        state.current,
        O.match({
          onNone: () => ({
            ...state,
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
            current: O.some({ ...current, blocks: A.append(current.blocks, block) }),
          }),
        })
      );
    }),
    flushCurrent
  );

const parseClaimNumber = (value: string): O.Option<PosInt> => S.decodeOption(ClaimNumberFromString)(value);

const transitionFromClaimText = (claimText: string): O.Option<RegExpMatchArray> =>
  Str.match(transitionPattern)(claimText);

const parentClaimNumbers = (preamble: string): ReadonlyArray<PosInt> =>
  pipe(
    Str.match(claimReferenceMarkerPattern)(preamble),
    O.map((marker) => Str.slice((marker.index ?? 0) + marker[0].length)(preamble)),
    O.map((value) => A.fromIterable(Str.matchAll(referenceNumberPattern)(value))),
    O.map(
      flow(
        A.map((match) => pipe(A.get(match, 0), O.flatMap(parseClaimNumber))),
        A.getSomes
      )
    ),
    O.getOrElse(A.empty)
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
  const transition = Str.toLowerCase(transitionMatch[0]);
  const transitionStart = transitionMatch.index ?? 0;
  const preamble = Str.trim(Str.slice(0, transitionStart)(claimText));
  const body = Str.trim(Str.slice(transitionStart + transitionMatch[0].length)(claimText));
  const references = parentClaimNumbers(preamble);
  if (!S.is(PatentClaimTransition)(transition) || Str.isEmpty(preamble) || Str.isEmpty(body)) {
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

const claimsFromDraft = Effect.fn("PatentDocument.claimsFromDraft")(function* (
  draft: SectionDraft
): Effect.fn.Return<PatentClaims, PatentDocumentNormalizationError> {
  const claimsText = renderPlainTextBlocks(draft.blocks);
  const matches = A.fromIterable(Str.matchAll(claimBlockPattern)(claimsText));
  if (A.isReadonlyArrayEmpty(matches)) {
    return yield* PatentDocumentNormalizationError.make({
      message: "The claims section must contain at least one numbered claim.",
      reason: "invalid-claim",
    });
  }
  const claims = yield* Effect.forEach(matches, (match) =>
    pipe(
      O.all({ claimNumber: A.get(match, 1), claimText: A.get(match, 2) }),
      O.match({
        onNone: () =>
          Effect.fail(
            PatentDocumentNormalizationError.make({
              message: "A numbered claim could not be separated into its number and text.",
              reason: "invalid-claim",
            })
          ),
        onSome: ({ claimNumber, claimText }) => parseClaim(claimNumber, claimText),
      })
    )
  );
  return yield* S.decodeUnknownEffect(PatentClaims)(claims).pipe(
    Effect.mapError((cause) =>
      PatentDocumentNormalizationError.make({
        message: `Invalid patent claim dependency graph: ${String(cause)}`,
        reason: "invalid-claim",
      })
    )
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
 * import { Md } from "@beep/md"
 * import { normalizePatentApplicationDocument } from "@beep/law-practice-domain/values/PatentDocument"
 * import { Effect } from "effect"
 *
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
    const content = Str.trim(renderPlainTextBlocks(draft.blocks));
    return Str.isNonEmpty(content)
      ? Effect.succeed(PatentApplicationSection.make({ content, heading: draft.heading, role: draft.role }))
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
  return yield* S.decodeUnknownEffect(PatentApplicationDocument)({
    claims,
    sections,
    sourceText: renderPlainTextBlocks(document.children),
  }).pipe(
    Effect.mapError((cause) =>
      PatentDocumentNormalizationError.make({
        message: `Invalid normalized patent application document: ${String(cause)}`,
        reason: "invalid-document",
      })
    )
  );
});
