/**
 * Profile-aware conformance checks for the semantic Markdown AST.
 *
 * **Details**
 *
 * These checks inspect already-decoded AST values. They do not parse Markdown
 * source and do not claim coverage of the official CommonMark or GFM example
 * corpora. The broad {@link Document} schema remains the lossless persistence
 * model; strict profile schemas and refinements are additive boundaries.
 *
 * @packageDocumentation \@beep/md/Md.conformance
 * @since 0.0.0
 */

import { $MdId } from "@beep/identity/packages";
import * as Conformance from "@beep/schema/Conformance";
import { Result } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import {
  BeepCheckedInvariantIds,
  CommonMarkCheckedInvariantIds,
  GfmCheckedInvariantIds,
} from "./internal/conformance/Md.invariant-registry.ts";
import {
  BeepMarkdownConformanceAnnotation,
  BeepMarkdownProfileDefinition,
  CommonMarkConformanceAnnotation,
  CommonMarkProfileDefinition,
  GfmConformanceAnnotation,
  GfmProfileDefinition,
} from "./internal/conformance/Md.profile-registry.ts";
import {
  formatMarkdownConformanceIssue,
  inspectMarkdownDocumentLosslessly,
  LosslessMarkdownConformanceReport,
  MarkdownConformanceIssue,
  MarkdownConformanceProfile,
  MarkdownExtensionNodeTag,
  markdownConformanceIssues,
} from "./internal/conformance/Md.semantic-inspector.ts";
import { Document } from "./Md.model.ts";

/**
 * Lossless conformance inspection surface re-exported from the semantic inspector.
 *
 * @category validation
 * @since 0.0.0
 */
export {
  formatMarkdownConformanceIssue,
  inspectMarkdownDocumentLosslessly,
  LosslessMarkdownConformanceReport,
  MarkdownConformanceIssue,
  MarkdownConformanceProfile,
  MarkdownExtensionNodeTag,
  markdownConformanceIssues,
};

const $I = $MdId.create("Md.conformance");

/**
 * Shared registry of tracked CommonMark semantic-tree obligations and evidence.
 *
 * **Details**
 *
 * The profile publishes both enforced invariants and explicit gaps. Runtime
 * conformance reports separately name the narrower set actually checked by the
 * semantic-tree inspector.
 *
 * **Gotchas**
 *
 * The semantic-tree schema does not parse Markdown source or run the official
 * example corpus; the profile preserves those limitations as explicit gap
 * descriptors.
 *
 * **Example** (Inspect the CommonMark profile)
 *
 * ```ts import.meta.vitest name="Inspect the CommonMark profile"
 * import { CommonMarkSpecificationProfile } from "@beep/md/Md.conformance"
 *
 * CommonMarkSpecificationProfile.id // => "commonmark-0.31.2"
 * ```
 *
 * @see {@link inspectMarkdownSpecificationConformance} for the checked runtime subset.
 * @see {@link https://spec.commonmark.org/0.31.2/ | CommonMark 0.31.2} for the pinned normative source.
 * @category specifications
 * @since 0.0.0
 */
export const CommonMarkSpecificationProfile = Conformance.ConformanceProfile.make(CommonMarkProfileDefinition);

/**
 * Shared registry of tracked pinned-GFM semantic-tree obligations and evidence.
 *
 * **Details**
 *
 * The profile includes structural, adapter, and corpus obligations. Runtime
 * reports keep their checked invariant IDs limited to the semantic-tree
 * inspector's actual checks.
 *
 * **Gotchas**
 *
 * The profile records the selected GFM sources but does not represent a run of
 * the unvendored cmark-gfm fixture corpus.
 *
 * **Example** (Inspect the GFM profile)
 *
 * ```ts import.meta.vitest name="Inspect the GFM profile"
 * import { GfmSpecificationProfile } from "@beep/md/Md.conformance"
 *
 * GfmSpecificationProfile.id // => "gfm-0.29.0.gfm.13"
 * ```
 *
 * @see {@link inspectMarkdownSpecificationConformance} for the checked runtime subset.
 * @see {@link https://github.com/github/cmark-gfm/tree/0.29.0.gfm.13 | cmark-gfm 0.29.0.gfm.13} for the pinned implementation and fixtures.
 * @category specifications
 * @since 0.0.0
 */
export const GfmSpecificationProfile = Conformance.ConformanceProfile.make(GfmProfileDefinition);

/**
 * Shared registry of Beep Markdown extension, safety, and rendering obligations.
 *
 * **Details**
 *
 * Safety invariants name {@link SafeDocument} and rendering adapters as their
 * enforcement boundaries; they are not attributed to the Beep semantic-tree
 * inspector.
 *
 * **Example** (Inspect the Beep profile)
 *
 * ```ts import.meta.vitest name="Inspect the Beep profile"
 * import { BeepMarkdownSpecificationProfile } from "@beep/md/Md.conformance"
 *
 * BeepMarkdownSpecificationProfile.id // => "beep-md-extensions-v1"
 * ```
 *
 * @see {@link BeepMarkdownDocument} for the corresponding strict schema boundary.
 * @see {@link SafeDocument} for the separately enforced user-content safety boundary.
 * @category specifications
 * @since 0.0.0
 */
export const BeepMarkdownSpecificationProfile = Conformance.ConformanceProfile.make(BeepMarkdownProfileDefinition);

/**
 * Typed failure returned by strict Markdown profile refinement.
 *
 * **Example** (Construct a strict failure)
 *
 * ```ts import.meta.vitest name="Construct a strict failure"
 * import { MarkdownConformanceError, MarkdownConformanceIssue, MarkdownConformanceProfile } from "@beep/md/Md.conformance"
 *
 * const error = MarkdownConformanceError.make({
 *   profile: MarkdownConformanceProfile.Enum.CommonMark,
 *   issues: [MarkdownConformanceIssue.cases.EmptyList.make({ path: ["children", 0], listTag: "ul" })]
 * })
 * error._tag // => "MarkdownConformanceError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MarkdownConformanceError extends S.TaggedError<MarkdownConformanceError>($I`MarkdownConformanceError`)(
  "MarkdownConformanceError",
  {
    profile: MarkdownConformanceProfile,
    issues: S.NonEmptyArray(MarkdownConformanceIssue),
  },
  $I.annoteError<MarkdownConformanceError>("MarkdownConformanceError", {
    description: "Strict Markdown profile refinement failed one or more semantic invariants.",
  })
) {}

const CommonMarkDocumentCheck = S.makeFilter<Document>(
  (document) =>
    !A.isReadonlyArrayNonEmpty(markdownConformanceIssues(document, MarkdownConformanceProfile.Enum.CommonMark)),
  {
    identifier: $I`CommonMarkDocumentCheck`,
    title: "CommonMark semantic document",
    description: "A Markdown AST satisfying every implemented CommonMark 0.31.2 semantic-tree invariant.",
    message: "Document violates an implemented CommonMark 0.31.2 semantic-tree invariant.",
  }
);

const GfmDocumentCheck = S.makeFilter<Document>(
  (document) => !A.isReadonlyArrayNonEmpty(markdownConformanceIssues(document, MarkdownConformanceProfile.Enum.Gfm)),
  {
    identifier: $I`GfmDocumentCheck`,
    title: "GFM semantic document",
    description: "A Markdown AST satisfying every implemented pinned-GFM semantic-tree invariant.",
    message: "Document violates an implemented GFM semantic-tree invariant.",
  }
);

const BeepMarkdownDocumentCheck = S.makeFilter<Document>(
  (document) => !A.isReadonlyArrayNonEmpty(markdownConformanceIssues(document, MarkdownConformanceProfile.Enum.Beep)),
  {
    identifier: $I`BeepMarkdownDocumentCheck`,
    title: "Beep Markdown semantic document",
    description: "A Markdown AST satisfying every implemented Beep extension semantic-tree invariant.",
    message: "Document violates an implemented Beep Markdown semantic-tree invariant.",
  }
);

/**
 * Branded document satisfying every implemented CommonMark semantic-tree check.
 *
 * **Details**
 *
 * Its conformance annotation publishes the full CommonMark profile registry,
 * including gap records. The schema check itself enforces only the implemented
 * semantic-tree inspector subset.
 *
 * **Gotchas**
 *
 * This schema validates the semantic AST subset only. It does not prove source
 * parsing, source-syntax preservation, or official example-corpus coverage.
 *
 * **Example** (Decode a CommonMark semantic document)
 *
 * ```ts import.meta.vitest name="Decode a CommonMark semantic document"
 * import { CommonMarkDocument } from "@beep/md/Md.conformance"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * Result.isSuccess(S.decodeUnknownResult(CommonMarkDocument)({ _tag: "document", children: [] })) // => true
 * ```
 *
 * @invariant Decoded values contain no violation reported by the implemented CommonMark semantic-tree inspector.
 * @see {@link https://spec.commonmark.org/0.31.2/ | CommonMark 0.31.2} for the governing specification.
 * @category validation
 * @since 0.0.0
 */
export const CommonMarkDocument = Document.pipe(
  S.check(CommonMarkDocumentCheck),
  S.brand("CommonMarkDocument"),
  Conformance.annotateConformance(CommonMarkConformanceAnnotation),
  $I.annoteSchema("CommonMarkDocument", {
    description: "Markdown AST satisfying every implemented CommonMark 0.31.2 semantic-tree check.",
  })
);

/**
 * Runtime branded value decoded by {@link CommonMarkDocument}.
 *
 * @category models
 * @since 0.0.0
 */
export type CommonMarkDocument = typeof CommonMarkDocument.Type;

/**
 * Branded document satisfying every implemented pinned-GFM semantic-tree check.
 *
 * **Details**
 *
 * Its conformance annotation publishes the full GFM profile registry, including
 * adapter obligations and explicit gaps. The schema check itself enforces only
 * the semantic-tree inspector subset. GFM source rows may be ragged, but the
 * pinned parsing semantics insert missing cells and discard excess cells; this
 * strict semantic-AST boundary therefore requires the resulting rectangular
 * representation while the broad {@link Document} remains permissive.
 *
 * **Gotchas**
 *
 * This schema does not parse Markdown source or substitute for running the
 * official cmark-gfm fixtures.
 *
 * **Example** (Decode a GFM semantic document)
 *
 * ```ts import.meta.vitest name="Decode a GFM semantic document"
 * import { GfmDocument } from "@beep/md/Md.conformance"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const value = { _tag: "document", children: [] }
 * Result.isSuccess(S.decodeUnknownResult(GfmDocument)(value)) // => true
 * ```
 *
 * @invariant Decoded values contain no violation reported by the implemented GFM semantic-tree inspector.
 * @see {@link https://github.github.com/gfm/ | GFM extensions} for the extension semantics.
 * @category validation
 * @since 0.0.0
 */
export const GfmDocument = Document.pipe(
  S.check(GfmDocumentCheck),
  S.brand("GfmDocument"),
  Conformance.annotateConformance(GfmConformanceAnnotation),
  $I.annoteSchema("GfmDocument", {
    description: "Markdown AST satisfying every implemented pinned-GFM semantic-tree check.",
  })
);

/**
 * Runtime branded value decoded by {@link GfmDocument}.
 *
 * @category models
 * @since 0.0.0
 */
export type GfmDocument = typeof GfmDocument.Type;

/**
 * Branded document satisfying the Beep extension profile's implemented checks.
 *
 * **Details**
 *
 * Package-owned raw, math, footnote, admonition, embed, and YouTube nodes are
 * valid in this profile. Use {@link SafeDocument} when raw content and unsafe
 * destinations must be rejected at a user-content boundary. The attached
 * annotation publishes those safety obligations with their actual boundaries;
 * this strict schema does not claim to enforce them.
 *
 * **Example** (Decode a Beep extension document)
 *
 * ```ts import.meta.vitest name="Decode a Beep extension document"
 * import { BeepMarkdownDocument } from "@beep/md/Md.conformance"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const value = { _tag: "document", children: [{ _tag: "mathBlock", value: "x" }] }
 * Result.isSuccess(S.decodeUnknownResult(BeepMarkdownDocument)(value)) // => true
 * ```
 *
 * @invariant Decoded values contain no violation reported by the implemented Beep semantic-tree inspector.
 * @see {@link Document} for the permissive lossless AST.
 * @see {@link SafeDocument} for the user-content safety refinement.
 * @see {@link https://spec.commonmark.org/0.31.2/ | CommonMark 0.31.2} for the normative base syntax.
 * @category validation
 * @since 0.0.0
 */
export const BeepMarkdownDocument = Document.pipe(
  S.check(BeepMarkdownDocumentCheck),
  S.brand("BeepMarkdownDocument"),
  Conformance.annotateConformance(BeepMarkdownConformanceAnnotation),
  $I.annoteSchema("BeepMarkdownDocument", {
    description: "Markdown AST satisfying every implemented Beep extension semantic-tree check.",
  })
);

/**
 * Runtime branded value decoded by {@link BeepMarkdownDocument}.
 *
 * @category models
 * @since 0.0.0
 */
export type BeepMarkdownDocument = typeof BeepMarkdownDocument.Type;

/**
 * Strict document brand selected by a {@link MarkdownConformanceProfile}.
 *
 * @category models
 * @since 0.0.0
 */
export type StrictMarkdownDocument = CommonMarkDocument | GfmDocument | BeepMarkdownDocument;

const makeStrictMarkdownDocument = (document: Document, profile: MarkdownConformanceProfile): StrictMarkdownDocument =>
  MarkdownConformanceProfile.$match(profile, {
    CommonMark: () => CommonMarkDocument.make(document),
    Gfm: () => GfmDocument.make(document),
    Beep: () => BeepMarkdownDocument.make(document),
  });

/**
 * Refines a decoded document into the strict brand selected by a profile.
 *
 * **Example** (Reject a GFM table without a header)
 *
 * ```ts import.meta.vitest name="Reject a GFM table without a header"
 * import { MarkdownConformanceProfile, refineStrictMarkdownDocument } from "@beep/md/Md.conformance"
 * import { Md } from "@beep/md"
 * import { Result } from "effect"
 *
 * const document = Md.make([Md.table([["cell"]])])
 * Result.isFailure(refineStrictMarkdownDocument(document, MarkdownConformanceProfile.Enum.Gfm)) // => true
 * ```
 *
 * @returns A profile-branded document or a typed error containing every implemented violation.
 * @invariant Success is issued only after the selected profile's implemented semantic-tree checks return no issues.
 * @category validation
 * @since 0.0.0
 */
export const refineStrictMarkdownDocument: {
  (
    document: Document,
    profile: MarkdownConformanceProfile
  ): Result.Result<StrictMarkdownDocument, MarkdownConformanceError>;
  (
    profile: MarkdownConformanceProfile
  ): (document: Document) => Result.Result<StrictMarkdownDocument, MarkdownConformanceError>;
} = dual(
  2,
  (
    document: Document,
    profile: MarkdownConformanceProfile
  ): Result.Result<StrictMarkdownDocument, MarkdownConformanceError> => {
    const issues = markdownConformanceIssues(document, profile);
    return A.isReadonlyArrayNonEmpty(issues)
      ? Result.fail(MarkdownConformanceError.make({ profile, issues }))
      : Result.succeed(makeStrictMarkdownDocument(document, profile));
  }
);

const sharedProfileFor = MarkdownConformanceProfile.$match({
  CommonMark: () => CommonMarkSpecificationProfile,
  Gfm: () => GfmSpecificationProfile,
  Beep: () => BeepMarkdownSpecificationProfile,
});

const checkedInvariantIdsFor = MarkdownConformanceProfile.$match({
  CommonMark: () => CommonMarkCheckedInvariantIds,
  Gfm: () => GfmCheckedInvariantIds,
  Beep: () => BeepCheckedInvariantIds,
});

const must = (): Conformance.RequirementStrength => "must";
const mustNot = (): Conformance.RequirementStrength => "mustNot";

const sharedRequirementStrength = MarkdownConformanceIssue.match({
  NestedLink: mustNot,
  UnsupportedNode: mustNot,
  EmptyList: must,
  OrderedListStart: must,
  GfmTableHeader: must,
  GfmTableRowWidth: must,
  GfmTableAlignmentWidth: must,
  GfmDisallowedRawHtml: mustNot,
  DuplicateFootnoteDefinition: must,
  UndefinedFootnoteReference: must,
});

const toSharedViolation = (issue: MarkdownConformanceIssue) =>
  Conformance.ConformanceIssue.cases.violation.make({
    invariantId: issue.invariantId,
    strength: sharedRequirementStrength(issue),
    path: issue.path,
    message: formatMarkdownConformanceIssue(issue),
  });

/**
 * Projects the package-local Markdown inspection into the shared conformance
 * report model.
 *
 * **Details**
 *
 * The result is conforming only with respect to the profile's declared
 * `checkedInvariantIds`. Source parsing and official-corpus execution are not
 * among those IDs and are therefore not implied by a conforming result.
 *
 * **Example** (Project a nested-link violation)
 *
 * ```ts import.meta.vitest name="Project a nested-link violation"
 * import { inspectMarkdownSpecificationConformance, MarkdownConformanceProfile } from "@beep/md/Md.conformance"
 * import { Md } from "@beep/md"
 *
 * const document = Md.make([Md.p(Md.a("/outer", Md.a("/inner", "nested")))])
 * const report = inspectMarkdownSpecificationConformance(document, MarkdownConformanceProfile.Enum.CommonMark)
 * report.status // => "nonConforming"
 * ```
 *
 * @returns A shared conforming or non-conforming report for every implemented profile check.
 * @invariant `nonConforming` is returned exactly when the package-local inspector returns at least one violation.
 * @see {@link inspectMarkdownDocumentLosslessly} for a report that also retains the exact document.
 * @category validation
 * @since 0.0.0
 */
export const inspectMarkdownSpecificationConformance: {
  (document: Document, profile: MarkdownConformanceProfile): Conformance.ConformanceReport;
  (profile: MarkdownConformanceProfile): (document: Document) => Conformance.ConformanceReport;
} = dual(2, (document: Document, profile: MarkdownConformanceProfile): Conformance.ConformanceReport => {
  const issues = markdownConformanceIssues(document, profile);
  const sharedProfile = sharedProfileFor(profile);
  const profileIds: A.NonEmptyReadonlyArray<string> = [sharedProfile.id];
  const checkedInvariantIds = checkedInvariantIdsFor(profile);

  return A.isReadonlyArrayNonEmpty(issues)
    ? Conformance.ConformanceReport.cases.nonConforming.make({
        profileIds,
        checkedInvariantIds,
        issues: A.map(issues, toSharedViolation),
      })
    : Conformance.ConformanceReport.cases.conforming.make({ profileIds, checkedInvariantIds });
});
