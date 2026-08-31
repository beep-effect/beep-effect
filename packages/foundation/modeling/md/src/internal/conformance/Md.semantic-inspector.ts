/**
 * Private Markdown conformance schemas and recursive semantic-tree inspection.
 *
 * @packageDocumentation
 * @internal
 * @since 0.0.0
 */

import { $MdId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { HashSet, Number as N } from "effect";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Block, Document, FootnoteIdentifier, Inline } from "../../Md.model.ts";
import { DocumentSafetyPathSegment } from "../../Md.safe.ts";
import { MarkdownProfileIds } from "./Md.profile-registry.ts";
import type { ListItemChild, Table } from "../../Md.model.ts";

const $I = $MdId.create("Md.conformance");

const commonMarkOrderedListMaximum = 999_999_999;
const gfmDisallowedRawHtmlPattern =
  /<\/?(?:title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext)(?:[\t\n\f\r />]|$)/iu;

/**
 * Specification profile selected for semantic Markdown AST validation.
 *
 * **Details**
 *
 * GFM includes the CommonMark structural rules plus the pinned table,
 * task-list, strikethrough, and raw-HTML filtering extensions. The Beep
 * profile permits package-owned nodes and applies package-owned footnote
 * invariants.
 *
 * **Example** (Select the GFM profile)
 *
 * ```ts import.meta.vitest name="Select the GFM profile"
 * import { MarkdownConformanceProfile } from "@beep/md/Md.conformance"
 *
 * MarkdownConformanceProfile.Enum.Gfm // => "gfm-0.29.0.gfm.13"
 * ```
 *
 * @see {@link https://spec.commonmark.org/0.31.2/ | CommonMark 0.31.2} for the base Markdown specification.
 * @see {@link https://github.com/github/cmark-gfm/tree/0.29.0.gfm.13 | cmark-gfm 0.29.0.gfm.13} for the pinned GFM extension corpus.
 * @category specifications
 * @since 0.0.0
 */
export const MarkdownConformanceProfile = LiteralKit({
  literals: [MarkdownProfileIds.CommonMark, MarkdownProfileIds.Gfm, MarkdownProfileIds.Beep],
  enumMapping: [
    [MarkdownProfileIds.CommonMark, "CommonMark"],
    [MarkdownProfileIds.Gfm, "Gfm"],
    [MarkdownProfileIds.Beep, "Beep"],
  ],
}).pipe(
  $I.annoteSchema("MarkdownConformanceProfile", {
    description: "Specification profile selected for semantic Markdown AST validation.",
  })
);

/**
 * Runtime profile accepted by {@link MarkdownConformanceProfile}.
 *
 * @see {@link MarkdownConformanceProfile} for named values and guards.
 * @category specifications
 * @since 0.0.0
 */
export type MarkdownConformanceProfile = typeof MarkdownConformanceProfile.Type;

/**
 * AST member that belongs to a narrower extension profile than CommonMark.
 *
 * **Example** (Recognize a GFM table member)
 *
 * ```ts import.meta.vitest name="Recognize a GFM table member"
 * import { MarkdownExtensionNodeTag } from "@beep/md/Md.conformance"
 *
 * MarkdownExtensionNodeTag.is.table("table") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MarkdownExtensionNodeTag = LiteralKit([
  "rawMarkdown",
  "del",
  "inlineMath",
  "footnoteReference",
  "taskList",
  "table",
  "youtube",
  "mathBlock",
  "footnoteDefinition",
  "admonition",
  "embed",
]).pipe(
  $I.annoteSchema("MarkdownExtensionNodeTag", {
    description: "Markdown AST member governed by GFM or Beep extension profiles.",
  })
);

/**
 * Runtime extension tag represented by {@link MarkdownExtensionNodeTag}.
 *
 * @category models
 * @since 0.0.0
 */
export type MarkdownExtensionNodeTag = typeof MarkdownExtensionNodeTag.Type;

const MarkdownConformancePath = S.Array(DocumentSafetyPathSegment).pipe(
  $I.annoteSchema("MarkdownConformancePath", {
    description: "Property and array-index path locating a Markdown conformance issue.",
  })
);

class NestedLinkIssue extends S.TaggedClass<NestedLinkIssue>($I`NestedLinkIssue`)(
  "NestedLink",
  {
    invariantId: S.tag("md.link.nested-links"),
    path: MarkdownConformancePath,
  },
  $I.annote("NestedLinkIssue", {
    description: "Link node nested below another link node.",
  })
) {}

class UnsupportedNodeIssue extends S.TaggedClass<UnsupportedNodeIssue>($I`UnsupportedNodeIssue`)(
  "UnsupportedNode",
  {
    invariantId: S.tag("md.extensions.nonstandard-members"),
    path: MarkdownConformancePath,
    nodeTag: MarkdownExtensionNodeTag,
    profile: MarkdownConformanceProfile,
  },
  $I.annote("UnsupportedNodeIssue", {
    description: "Extension node used outside the profile that defines it.",
  })
) {}

class EmptyListIssue extends S.TaggedClass<EmptyListIssue>($I`EmptyListIssue`)(
  "EmptyList",
  {
    invariantId: S.tag("md.list.nonempty"),
    path: MarkdownConformancePath,
    listTag: LiteralKit(["ul", "ol", "taskList"]),
  },
  $I.annote("EmptyListIssue", {
    description: "List block without any list items.",
  })
) {}

class OrderedListStartIssue extends S.TaggedClass<OrderedListStartIssue>($I`OrderedListStartIssue`)(
  "OrderedListStart",
  {
    invariantId: S.tag("md.list.ordered-start-range"),
    path: MarkdownConformancePath,
    start: S.Int,
  },
  $I.annote("OrderedListStartIssue", {
    description: "Ordered-list start outside CommonMark's one-to-nine digit marker range.",
  })
) {}

class GfmTableHeaderIssue extends S.TaggedClass<GfmTableHeaderIssue>($I`GfmTableHeaderIssue`)(
  "GfmTableHeader",
  {
    invariantId: S.tag("md.gfm.table-header"),
    path: MarkdownConformancePath,
  },
  $I.annote("GfmTableHeaderIssue", {
    description: "GFM table without a non-empty header row.",
  })
) {}

class GfmTableRowWidthIssue extends S.TaggedClass<GfmTableRowWidthIssue>($I`GfmTableRowWidthIssue`)(
  "GfmTableRowWidth",
  {
    invariantId: S.tag("md.gfm.table-rectangularity"),
    path: MarkdownConformancePath,
    expected: S.Natural,
    actual: S.Natural,
  },
  $I.annote("GfmTableRowWidthIssue", {
    description: "Noncanonical GFM semantic table row whose cell count differs from the header width.",
  })
) {}

class GfmTableAlignmentWidthIssue extends S.TaggedClass<GfmTableAlignmentWidthIssue>($I`GfmTableAlignmentWidthIssue`)(
  "GfmTableAlignmentWidth",
  {
    invariantId: S.tag("md.gfm.table-alignment-width"),
    path: MarkdownConformancePath,
    expected: S.Natural,
    actual: S.Natural,
  },
  $I.annote("GfmTableAlignmentWidthIssue", {
    description: "Non-empty GFM alignment metadata whose length differs from the header width.",
  })
) {}

class GfmDisallowedRawHtmlIssue extends S.TaggedClass<GfmDisallowedRawHtmlIssue>($I`GfmDisallowedRawHtmlIssue`)(
  "GfmDisallowedRawHtml",
  {
    invariantId: S.tag("md.gfm.disallowed-raw-html"),
    path: MarkdownConformancePath,
  },
  $I.annote("GfmDisallowedRawHtmlIssue", {
    description: "Raw HTML containing a tag filtered by the GFM disallowed-raw-HTML extension.",
  })
) {}

class DuplicateFootnoteDefinitionIssue extends S.TaggedClass<DuplicateFootnoteDefinitionIssue>(
  $I`DuplicateFootnoteDefinitionIssue`
)(
  "DuplicateFootnoteDefinition",
  {
    invariantId: S.tag("md.footnote.unique-definitions"),
    path: MarkdownConformancePath,
    identifier: FootnoteIdentifier,
  },
  $I.annote("DuplicateFootnoteDefinitionIssue", {
    description: "Repeated Beep footnote definition identifier.",
  })
) {}

class UndefinedFootnoteReferenceIssue extends S.TaggedClass<UndefinedFootnoteReferenceIssue>(
  $I`UndefinedFootnoteReferenceIssue`
)(
  "UndefinedFootnoteReference",
  {
    invariantId: S.tag("md.footnote.defined-references"),
    path: MarkdownConformancePath,
    identifier: FootnoteIdentifier,
  },
  $I.annote("UndefinedFootnoteReferenceIssue", {
    description: "Beep footnote reference without a matching definition.",
  })
) {}

/**
 * Exhaustive path-located semantic Markdown conformance issue.
 *
 * **Example** (Construct and match an issue)
 *
 * ```ts import.meta.vitest name="Construct and match an issue"
 * import { MarkdownConformanceIssue } from "@beep/md/Md.conformance"
 *
 * const issue = MarkdownConformanceIssue.cases.NestedLink.make({ path: ["children", 0] })
 * const invariantId = MarkdownConformanceIssue.match(issue, {
 *   NestedLink: ({ invariantId }) => invariantId,
 *   UnsupportedNode: ({ invariantId }) => invariantId,
 *   EmptyList: ({ invariantId }) => invariantId,
 *   OrderedListStart: ({ invariantId }) => invariantId,
 *   GfmTableHeader: ({ invariantId }) => invariantId,
 *   GfmTableRowWidth: ({ invariantId }) => invariantId,
 *   GfmTableAlignmentWidth: ({ invariantId }) => invariantId,
 *   GfmDisallowedRawHtml: ({ invariantId }) => invariantId,
 *   DuplicateFootnoteDefinition: ({ invariantId }) => invariantId,
 *   UndefinedFootnoteReference: ({ invariantId }) => invariantId,
 * })
 *
 * invariantId // => "md.link.nested-links"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const MarkdownConformanceIssue = S.Union([
  NestedLinkIssue,
  UnsupportedNodeIssue,
  EmptyListIssue,
  OrderedListStartIssue,
  GfmTableHeaderIssue,
  GfmTableRowWidthIssue,
  GfmTableAlignmentWidthIssue,
  GfmDisallowedRawHtmlIssue,
  DuplicateFootnoteDefinitionIssue,
  UndefinedFootnoteReferenceIssue,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("MarkdownConformanceIssue", {
    description: "Exhaustive path-located semantic Markdown conformance issue.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime issue represented by {@link MarkdownConformanceIssue}.
 *
 * @see {@link MarkdownConformanceIssue} for constructors, guards, and exhaustive matching.
 * @category diagnostics
 * @since 0.0.0
 */
export type MarkdownConformanceIssue = typeof MarkdownConformanceIssue.Type;

/**
 * Lossless profile inspection result retaining the exact supplied document.
 *
 * **Example** (Inspect without rejecting)
 *
 * ```ts import.meta.vitest name="Inspect without rejecting"
 * import { inspectMarkdownDocumentLosslessly, MarkdownConformanceProfile } from "@beep/md/Md.conformance"
 * import { Md } from "@beep/md"
 *
 * const document = Md.make([Md.p(Md.footnoteRef("missing"))])
 * const report = inspectMarkdownDocumentLosslessly(document, MarkdownConformanceProfile.Enum.Beep)
 * report.mode // => "lossless"
 * report.issues.length // => 1
 * ```
 *
 * @invariant Inspection never removes, rewrites, or substitutes the supplied AST.
 * @category diagnostics
 * @since 0.0.0
 */
export class LosslessMarkdownConformanceReport extends S.Class<LosslessMarkdownConformanceReport>(
  $I`LosslessMarkdownConformanceReport`
)(
  {
    mode: S.tag("lossless"),
    profile: MarkdownConformanceProfile,
    document: Document,
    issues: S.Array(MarkdownConformanceIssue),
  },
  $I.annote("LosslessMarkdownConformanceReport", {
    description: "Lossless Markdown profile inspection retaining the exact supplied document and all issues.",
  })
) {}

const GfmDisallowedRawHtml = S.String.check(
  S.isPattern(gfmDisallowedRawHtmlPattern, {
    identifier: $I`GfmDisallowedRawHtmlCheck`,
    title: "GFM disallowed raw HTML",
    description: "Raw HTML containing a tag filtered by the GFM disallowed-raw-HTML extension.",
    message: "Raw HTML contains a tag filtered by GFM.",
  })
).pipe(
  $I.annoteSchema("GfmDisallowedRawHtml", {
    description: "Raw HTML containing a tag filtered by the GFM disallowed-raw-HTML extension.",
  })
);
const isGfmDisallowedRawHtml = S.is(GfmDisallowedRawHtml);

type MarkdownConformancePath = ReadonlyArray<DocumentSafetyPathSegment>;
type FootnoteOccurrence = readonly [identifier: FootnoteIdentifier, path: MarkdownConformancePath];
type MarkdownScan = readonly [
  issues: ReadonlyArray<MarkdownConformanceIssue>,
  definitions: ReadonlyArray<FootnoteOccurrence>,
  references: ReadonlyArray<FootnoteOccurrence>,
];

const appendPath = (
  path: MarkdownConformancePath,
  ...segments: ReadonlyArray<DocumentSafetyPathSegment>
): MarkdownConformancePath => A.appendAll(path, segments);

const emptyScan = (): MarkdownScan => [
  A.empty<MarkdownConformanceIssue>(),
  A.empty<FootnoteOccurrence>(),
  A.empty<FootnoteOccurrence>(),
];

const scanFromIssues = (issues: ReadonlyArray<MarkdownConformanceIssue>): MarkdownScan => [
  issues,
  A.empty<FootnoteOccurrence>(),
  A.empty<FootnoteOccurrence>(),
];

const scanFromReference = (occurrence: FootnoteOccurrence): MarkdownScan => [
  A.empty<MarkdownConformanceIssue>(),
  A.empty<FootnoteOccurrence>(),
  A.of(occurrence),
];

const prependDefinition = (scan: MarkdownScan, occurrence: FootnoteOccurrence): MarkdownScan => [
  scan[0],
  A.prepend(scan[1], occurrence),
  scan[2],
];

const mergeScans = (left: MarkdownScan, right: MarkdownScan): MarkdownScan => [
  A.appendAll(left[0], right[0]),
  A.appendAll(left[1], right[1]),
  A.appendAll(left[2], right[2]),
];

const mergeAllScans = (scans: ReadonlyArray<MarkdownScan>): MarkdownScan => A.reduce(scans, emptyScan(), mergeScans);

const issueUnsupportedNode = (
  profile: MarkdownConformanceProfile,
  nodeTag: MarkdownExtensionNodeTag,
  path: MarkdownConformancePath,
  supportedByGfm: boolean
): ReadonlyArray<MarkdownConformanceIssue> =>
  MarkdownConformanceProfile.is.Beep(profile) || (supportedByGfm && MarkdownConformanceProfile.is.Gfm(profile))
    ? A.empty()
    : A.of(MarkdownConformanceIssue.cases.UnsupportedNode.make({ path, nodeTag, profile }));

const scanInlineChildren = (
  children: ReadonlyArray<Inline>,
  profile: MarkdownConformanceProfile,
  path: MarkdownConformancePath,
  insideLink: boolean
): MarkdownScan =>
  mergeAllScans(A.map(children, (inline, index) => scanInline(inline, profile, appendPath(path, index), insideLink)));

const scanInline = (
  inline: Inline,
  profile: MarkdownConformanceProfile,
  path: MarkdownConformancePath,
  insideLink: boolean
): MarkdownScan =>
  Inline.match(inline, {
    text: emptyScan,
    rawMarkdown: () => scanFromIssues(issueUnsupportedNode(profile, "rawMarkdown", path, false)),
    rawHtml: ({ value }) =>
      scanFromIssues(
        MarkdownConformanceProfile.is.Gfm(profile) && isGfmDisallowedRawHtml(value)
          ? A.of(MarkdownConformanceIssue.cases.GfmDisallowedRawHtml.make({ path }))
          : A.empty()
      ),
    strong: ({ children }) => scanInlineChildren(children, profile, appendPath(path, "children"), insideLink),
    em: ({ children }) => scanInlineChildren(children, profile, appendPath(path, "children"), insideLink),
    del: ({ children }) =>
      mergeScans(
        scanFromIssues(issueUnsupportedNode(profile, "del", path, true)),
        scanInlineChildren(children, profile, appendPath(path, "children"), insideLink)
      ),
    code: emptyScan,
    a: ({ children }) =>
      mergeScans(
        scanFromIssues(insideLink ? A.of(MarkdownConformanceIssue.cases.NestedLink.make({ path })) : A.empty()),
        scanInlineChildren(children, profile, appendPath(path, "children"), true)
      ),
    img: emptyScan,
    br: emptyScan,
    inlineMath: () => scanFromIssues(issueUnsupportedNode(profile, "inlineMath", path, false)),
    footnoteReference: ({ identifier }) =>
      mergeScans(
        scanFromIssues(issueUnsupportedNode(profile, "footnoteReference", path, false)),
        scanFromReference([identifier, appendPath(path, "identifier")])
      ),
  });

const scanListItemChild = (
  child: ListItemChild,
  profile: MarkdownConformanceProfile,
  path: MarkdownConformancePath
): MarkdownScan => (Inline.is(child) ? scanInline(child, profile, path, false) : scanBlock(child, profile, path));

const scanListItems = (
  children: ReadonlyArray<{ readonly children: ReadonlyArray<ListItemChild> }>,
  profile: MarkdownConformanceProfile,
  path: MarkdownConformancePath
): MarkdownScan =>
  mergeAllScans(
    A.flatMap(children, (item, itemIndex) =>
      A.map(item.children, (child, childIndex) =>
        scanListItemChild(child, profile, appendPath(path, itemIndex, "children", childIndex))
      )
    )
  );

const emptyListIssues = (
  children: ReadonlyArray<unknown>,
  listTag: "ul" | "ol" | "taskList",
  path: MarkdownConformancePath
): ReadonlyArray<MarkdownConformanceIssue> =>
  A.isReadonlyArrayNonEmpty(children)
    ? A.empty()
    : A.of(MarkdownConformanceIssue.cases.EmptyList.make({ path, listTag }));

const gfmTableIssues = (table: Table, path: MarkdownConformancePath): ReadonlyArray<MarkdownConformanceIssue> => {
  const firstRow = A.head(table.children);
  const headerWidth = pipe(
    firstRow,
    O.map(({ children }) => A.length(children)),
    O.getOrElse(() => 0)
  );
  const headerIssues =
    table.headerRow && O.exists(firstRow, ({ children }) => A.isReadonlyArrayNonEmpty(children))
      ? A.empty<MarkdownConformanceIssue>()
      : A.of(MarkdownConformanceIssue.cases.GfmTableHeader.make({ path }));
  const rowIssues = A.flatMap(table.children, (row, index) => {
    const actual = A.length(row.children);
    return N.Equivalence(actual, headerWidth)
      ? A.empty<MarkdownConformanceIssue>()
      : A.of(
          MarkdownConformanceIssue.cases.GfmTableRowWidth.make({
            path: appendPath(path, "children", index),
            expected: headerWidth,
            actual,
          })
        );
  });
  const alignmentWidth = A.length(table.align);
  const alignmentIssues =
    N.Equivalence(alignmentWidth, 0) || N.Equivalence(alignmentWidth, headerWidth)
      ? A.empty<MarkdownConformanceIssue>()
      : A.of(
          MarkdownConformanceIssue.cases.GfmTableAlignmentWidth.make({
            path: appendPath(path, "align"),
            expected: headerWidth,
            actual: alignmentWidth,
          })
        );
  return A.appendAll(A.appendAll(headerIssues, rowIssues), alignmentIssues);
};

const scanTableChildren = (
  table: Table,
  profile: MarkdownConformanceProfile,
  path: MarkdownConformancePath
): MarkdownScan =>
  mergeAllScans(
    A.flatMap(table.children, (row, rowIndex) =>
      A.map(row.children, (cell, cellIndex) =>
        scanInlineChildren(
          cell.children,
          profile,
          appendPath(path, "children", rowIndex, "children", cellIndex, "children"),
          false
        )
      )
    )
  );

const scanBlockChildren = (
  children: ReadonlyArray<Block>,
  profile: MarkdownConformanceProfile,
  path: MarkdownConformancePath
): MarkdownScan => mergeAllScans(A.map(children, (block, index) => scanBlock(block, profile, appendPath(path, index))));

const scanBlock = (block: Block, profile: MarkdownConformanceProfile, path: MarkdownConformancePath): MarkdownScan =>
  Block.match(block, {
    heading: ({ children }) => scanInlineChildren(children, profile, appendPath(path, "children"), false),
    p: ({ children }) => scanInlineChildren(children, profile, appendPath(path, "children"), false),
    blockquote: ({ children }) => scanBlockChildren(children, profile, appendPath(path, "children")),
    pre: emptyScan,
    ul: ({ children }) =>
      mergeScans(
        scanFromIssues(emptyListIssues(children, "ul", path)),
        scanListItems(children, profile, appendPath(path, "children"))
      ),
    ol: ({ children, start }) =>
      mergeAllScans([
        scanFromIssues(emptyListIssues(children, "ol", path)),
        scanFromIssues(
          N.between(start, { minimum: 0, maximum: commonMarkOrderedListMaximum })
            ? A.empty()
            : A.of(
                MarkdownConformanceIssue.cases.OrderedListStart.make({
                  path: appendPath(path, "start"),
                  start,
                })
              )
        ),
        scanListItems(children, profile, appendPath(path, "children")),
      ]),
    taskList: ({ children }) =>
      mergeAllScans([
        scanFromIssues(issueUnsupportedNode(profile, "taskList", path, true)),
        scanFromIssues(emptyListIssues(children, "taskList", path)),
        scanListItems(children, profile, appendPath(path, "children")),
      ]),
    table: (table) =>
      mergeAllScans([
        scanFromIssues(issueUnsupportedNode(profile, "table", path, true)),
        scanFromIssues(MarkdownConformanceProfile.is.Gfm(profile) ? gfmTableIssues(table, path) : A.empty()),
        scanTableChildren(table, profile, path),
      ]),
    youtube: () => scanFromIssues(issueUnsupportedNode(profile, "youtube", path, false)),
    mathBlock: () => scanFromIssues(issueUnsupportedNode(profile, "mathBlock", path, false)),
    footnoteDefinition: ({ children, identifier }) => {
      const nested = scanBlockChildren(children, profile, appendPath(path, "children"));
      return prependDefinition(
        mergeScans(scanFromIssues(issueUnsupportedNode(profile, "footnoteDefinition", path, false)), nested),
        [identifier, appendPath(path, "identifier")]
      );
    },
    admonition: ({ children }) =>
      mergeScans(
        scanFromIssues(issueUnsupportedNode(profile, "admonition", path, false)),
        scanBlockChildren(children, profile, appendPath(path, "children"))
      ),
    embed: () => scanFromIssues(issueUnsupportedNode(profile, "embed", path, false)),
    hr: emptyScan,
  });

const footnoteIssues = (
  definitions: ReadonlyArray<FootnoteOccurrence>,
  references: ReadonlyArray<FootnoteOccurrence>
): ReadonlyArray<MarkdownConformanceIssue> => {
  const identifierEquivalence = S.toEquivalence(FootnoteIdentifier);
  const duplicateIssues = A.flatMap(definitions, ([identifier, path]) =>
    A.length(A.filter(definitions, ([candidate]) => identifierEquivalence(candidate, identifier))) > 1
      ? A.of(MarkdownConformanceIssue.cases.DuplicateFootnoteDefinition.make({ identifier, path }))
      : A.empty()
  );
  const definitionIds = HashSet.fromIterable(A.map(definitions, ([identifier]) => identifier));
  const undefinedIssues = A.flatMap(references, ([identifier, path]) =>
    HashSet.has(definitionIds, identifier)
      ? A.empty()
      : A.of(MarkdownConformanceIssue.cases.UndefinedFootnoteReference.make({ identifier, path }))
  );
  return A.appendAll(duplicateIssues, undefinedIssues);
};

/**
 * Reports every implemented semantic invariant violation for a profile.
 *
 * **Details**
 *
 * The inspector checks nested links, list cardinality and ordered starts,
 * extension membership, canonical post-parse GFM table shape and filtered raw
 * HTML, and Beep footnote identity/reference rules. It does not parse source
 * syntax or claim official-corpus completeness.
 *
 * **Example** (Report a nested link)
 *
 * ```ts import.meta.vitest name="Report a nested link"
 * import { markdownConformanceIssues, MarkdownConformanceProfile } from "@beep/md/Md.conformance"
 * import { Md } from "@beep/md"
 *
 * const document = Md.make([Md.p(Md.a("/outer", Md.a("/inner", "nested")))])
 * const issues = markdownConformanceIssues(document, MarkdownConformanceProfile.Enum.CommonMark)
 * issues[0]?._tag // => "NestedLink"
 * ```
 *
 * @see {@link https://spec.commonmark.org/0.31.2/#links | CommonMark links} for the prohibition on nested links.
 * @see {@link https://spec.commonmark.org/0.31.2/#list-items | CommonMark list items} for ordered marker bounds and list structure.
 * @see {@link https://github.github.com/gfm/ | GFM extensions} for tables, task-list items, strikethrough, and filtered raw HTML.
 * @category validation
 * @since 0.0.0
 */
export const markdownConformanceIssues: {
  (document: Document, profile: MarkdownConformanceProfile): ReadonlyArray<MarkdownConformanceIssue>;
  (profile: MarkdownConformanceProfile): (document: Document) => ReadonlyArray<MarkdownConformanceIssue>;
} = dual(2, (document: Document, profile: MarkdownConformanceProfile): ReadonlyArray<MarkdownConformanceIssue> => {
  const scan = mergeAllScans(
    A.map(document.children, (block, index) => scanBlock(block, profile, ["children", index]))
  );
  return MarkdownConformanceProfile.is.Beep(profile) ? A.appendAll(scan[0], footnoteIssues(scan[1], scan[2])) : scan[0];
});

/**
 * Renders one conformance issue as a stable diagnostic sentence.
 *
 * **Example** (Format an empty-list issue)
 *
 * ```ts import.meta.vitest name="Format an empty-list issue"
 * import { formatMarkdownConformanceIssue, MarkdownConformanceIssue } from "@beep/md/Md.conformance"
 *
 * const issue = MarkdownConformanceIssue.cases.EmptyList.make({ path: [], listTag: "ul" })
 * formatMarkdownConformanceIssue(issue) // => "The ul list has no items."
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const formatMarkdownConformanceIssue = MarkdownConformanceIssue.match({
  NestedLink: () => "A link is nested inside another link.",
  UnsupportedNode: ({ nodeTag, profile }) => `The ${nodeTag} node is not part of ${profile}.`,
  EmptyList: ({ listTag }) => `The ${listTag} list has no items.`,
  OrderedListStart: ({ start }) =>
    `The ordered-list start ${start} is outside CommonMark's 0..${commonMarkOrderedListMaximum} range.`,
  GfmTableHeader: () => "A GFM table requires a non-empty header row.",
  GfmTableRowWidth: ({ actual, expected }) => `The GFM table row has ${actual} cells; the header has ${expected}.`,
  GfmTableAlignmentWidth: ({ actual, expected }) =>
    `The GFM alignment list has ${actual} entries; the header has ${expected} cells.`,
  GfmDisallowedRawHtml: () => "Raw HTML contains a tag filtered by GFM.",
  DuplicateFootnoteDefinition: ({ identifier }) => `Footnote ${identifier} is defined more than once.`,
  UndefinedFootnoteReference: ({ identifier }) => `Footnote ${identifier} is referenced but not defined.`,
});

/**
 * Inspects a document losslessly and retains the exact supplied AST alongside
 * every issue.
 *
 * **Example** (Retain an unsupported extension)
 *
 * ```ts import.meta.vitest name="Retain an unsupported extension"
 * import { inspectMarkdownDocumentLosslessly, MarkdownConformanceProfile } from "@beep/md/Md.conformance"
 * import { Md } from "@beep/md"
 *
 * const document = Md.make([Md.mathBlock("x")])
 * const report = inspectMarkdownDocumentLosslessly(document, MarkdownConformanceProfile.Enum.CommonMark)
 * report.document.children[0]?._tag // => "mathBlock"
 * report.issues[0]?._tag // => "UnsupportedNode"
 * ```
 *
 * @postcondition The returned report contains the supplied document without normalization or repair.
 * @category validation
 * @since 0.0.0
 */
export const inspectMarkdownDocumentLosslessly: {
  (document: Document, profile: MarkdownConformanceProfile): LosslessMarkdownConformanceReport;
  (profile: MarkdownConformanceProfile): (document: Document) => LosslessMarkdownConformanceReport;
} = dual(
  2,
  (document: Document, profile: MarkdownConformanceProfile): LosslessMarkdownConformanceReport =>
    LosslessMarkdownConformanceReport.make({
      profile,
      document,
      issues: markdownConformanceIssues(document, profile),
    })
);
