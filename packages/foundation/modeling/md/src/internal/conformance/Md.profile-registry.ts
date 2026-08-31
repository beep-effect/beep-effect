import * as A from "effect/Array";
import { MarkdownInvariantDescriptors } from "./Md.invariant-registry.ts";
import { MarkdownSpecificationSources } from "./Md.specification-source-registry.ts";
import type * as Conformance from "@beep/schema/Conformance";
import type { MarkdownInvariantId } from "./Md.invariant-registry.ts";
import type { MarkdownSpecificationSourceId } from "./Md.specification-source-registry.ts";

/**
 * Stable identifiers for the Markdown conformance profiles.
 *
 * @internal
 * @category specifications
 * @since 0.0.0
 */
export const MarkdownProfileIds = {
  CommonMark: "commonmark-0.31.2",
  Gfm: "gfm-0.29.0.gfm.13",
  Beep: "beep-md-extensions-v1",
} as const;

const commonMarkProfileSourceIds = [
  "md-commonmark-0.31.2-spec",
  "md-commonmark-0.31.2-examples",
  "md-micromark-4.0.2",
  "md-beep-extensions-baseline",
] satisfies A.NonEmptyReadonlyArray<MarkdownSpecificationSourceId>;

const gfmProfileSourceIds = [
  "md-gfm-0.29-published-spec",
  "md-commonmark-0.31.2-spec",
  "md-gfm-0.29.0.gfm.13-spec",
  "md-gfm-0.29.0.gfm.13-extensions",
  "md-beep-extensions-baseline",
] satisfies A.NonEmptyReadonlyArray<MarkdownSpecificationSourceId>;

const beepProfileSourceIds = [
  "md-commonmark-0.31.2-spec",
  "md-gfm-0.29-published-spec",
  "md-html-whatwg-source-approved",
  "md-beep-extensions-baseline",
] satisfies A.NonEmptyReadonlyArray<MarkdownSpecificationSourceId>;

const commonMarkProfileInvariantIds = [
  "md.corpus.commonmark-exhaustive",
  "md.ast.literal-tag-discrimination",
  "md.heading.level-domain",
  "md.heading.inline-children",
  "md.heading.source-syntax",
  "md.link.nested-links",
  "md.list.nonempty",
  "md.list.ordered-start-range",
  "md.list.item-content",
  "md.render.escaping",
  "md.soft-break-representation",
  "md.source-parser",
  "md.extensions.nonstandard-members",
] satisfies A.NonEmptyReadonlyArray<MarkdownInvariantId>;

const gfmProfileInvariantIds = [
  "md.profile.explicit-boundaries",
  "md.profile.gfm-commonmark-version-divergence",
  "md.corpus.gfm-exhaustive",
  "md.ast.literal-tag-discrimination",
  "md.heading.level-domain",
  "md.heading.inline-children",
  "md.link.nested-links",
  "md.list.nonempty",
  "md.list.ordered-start-range",
  "md.list.item-content",
  "md.gfm.task-lists",
  "md.gfm.strikethrough",
  "md.gfm.table-structure",
  "md.gfm.table-rectangularity",
  "md.gfm.table-alignment-width",
  "md.gfm.disallowed-raw-html",
  "md.gfm.table-header",
  "md.render.escaping",
  "md.extensions.nonstandard-members",
] satisfies A.NonEmptyReadonlyArray<MarkdownInvariantId>;

const beepProfileInvariantIds = [
  "md.profile.explicit-boundaries",
  "md.ast.literal-tag-discrimination",
  "md.heading.level-domain",
  "md.heading.inline-children",
  "md.link.nested-links",
  "md.list.nonempty",
  "md.list.ordered-start-range",
  "md.list.item-content",
  "md.safe.raw-content",
  "md.safe.urls-and-scalars",
  "md.safe.html-projection-conformance",
  "md.footnote.unique-definitions",
  "md.footnote.defined-references",
  "md.render.escaping",
  "md.extensions.nonstandard-members",
] satisfies A.NonEmptyReadonlyArray<MarkdownInvariantId>;

/**
 * Internal CommonMark profile definition assembled from the pinned Markdown registries.
 *
 * @internal
 * @category specifications
 * @since 0.0.0
 */
export const CommonMarkProfileDefinition = {
  id: MarkdownProfileIds.CommonMark,
  title: "CommonMark semantic AST",
  version: "0.31.2",
  description: "Tracked CommonMark 0.31.2 semantic-AST obligations and explicit source/corpus gaps.",
  sourceIds: commonMarkProfileSourceIds,
  invariantIds: commonMarkProfileInvariantIds,
} satisfies typeof Conformance.ConformanceProfile.Encoded;

/**
 * Internal GFM profile definition assembled from the pinned Markdown registries.
 *
 * @internal
 * @category specifications
 * @since 0.0.0
 */
export const GfmProfileDefinition = {
  id: MarkdownProfileIds.Gfm,
  title: "GitHub Flavored Markdown semantic AST",
  version: "0.29.0.gfm.13",
  description:
    "Published GFM 0.29 obligations across the decoded AST and adapters, with the separate CommonMark 0.31.2 target and unexecuted cmark-gfm corpora recorded as explicit gaps.",
  sourceIds: gfmProfileSourceIds,
  invariantIds: gfmProfileInvariantIds,
} satisfies typeof Conformance.ConformanceProfile.Encoded;

/**
 * Internal Beep Markdown profile definition assembled from the pinned registries.
 *
 * @internal
 * @category specifications
 * @since 0.0.0
 */
export const BeepMarkdownProfileDefinition = {
  id: MarkdownProfileIds.Beep,
  title: "Beep Markdown extension semantic AST",
  version: "1",
  description: "Implemented package-owned Markdown extension, safety-boundary, and rendering invariants.",
  sourceIds: beepProfileSourceIds,
  invariantIds: beepProfileInvariantIds,
} satisfies typeof Conformance.ConformanceProfile.Encoded;

const specificationSourcesFor = (
  sourceIds: A.NonEmptyReadonlyArray<MarkdownSpecificationSourceId>
): A.NonEmptyReadonlyArray<typeof Conformance.SpecificationSource.Encoded> =>
  A.map(sourceIds, (sourceId) => MarkdownSpecificationSources[sourceId]);

const invariantDescriptorsFor = (
  invariantIds: A.NonEmptyReadonlyArray<MarkdownInvariantId>
): A.NonEmptyReadonlyArray<typeof Conformance.InvariantDescriptor.Encoded> =>
  A.map(invariantIds, (invariantId) => MarkdownInvariantDescriptors[invariantId]);

/**
 * Internal conformance annotation carrying the CommonMark profile evidence set.
 *
 * @internal
 * @category specifications
 * @since 0.0.0
 */
export const CommonMarkConformanceAnnotation = {
  sources: specificationSourcesFor(commonMarkProfileSourceIds),
  profiles: [CommonMarkProfileDefinition],
  invariants: invariantDescriptorsFor(commonMarkProfileInvariantIds),
} satisfies typeof Conformance.Annotation.Encoded;

/**
 * Internal conformance annotation carrying the GFM profile evidence set.
 *
 * @internal
 * @category specifications
 * @since 0.0.0
 */
export const GfmConformanceAnnotation = {
  sources: specificationSourcesFor(gfmProfileSourceIds),
  profiles: [GfmProfileDefinition],
  invariants: invariantDescriptorsFor(gfmProfileInvariantIds),
} satisfies typeof Conformance.Annotation.Encoded;

/**
 * Internal conformance annotation carrying the Beep Markdown profile evidence set.
 *
 * @internal
 * @category specifications
 * @since 0.0.0
 */
export const BeepMarkdownConformanceAnnotation = {
  sources: specificationSourcesFor(beepProfileSourceIds),
  profiles: [BeepMarkdownProfileDefinition],
  invariants: invariantDescriptorsFor(beepProfileInvariantIds),
} satisfies typeof Conformance.Annotation.Encoded;
