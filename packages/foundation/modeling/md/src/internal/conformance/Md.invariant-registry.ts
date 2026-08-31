import type * as Conformance from "@beep/schema/Conformance";

/**
 * Internal registry of Markdown semantic invariants and their evidence descriptors.
 *
 * @internal
 * @category specifications
 * @since 0.0.0
 */
export const MarkdownInvariantDescriptors = {
  "md.profile.explicit-boundaries": {
    id: "md.profile.explicit-boundaries",
    title: "CommonMark, GFM, and Beep extensions must remain distinguishable",
    statement:
      "The broad lossless AST contains CommonMark, GFM, and package-owned extension members, while strict profile brands and the tree inspector reject members outside the selected profile.",
    strength: "must",
    scope: "document",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "typeLevel",
        mechanism: "@beep/md exported schema type for md.profile.explicit-boundaries",
      },
      {
        kind: "runtime",
        validator: "markdownConformanceIssues",
      },
      {
        kind: "test",
        suite: "test/Md.conformance.test.ts",
        oracle: "Pinned source rule and package expectation for md.profile.explicit-boundaries",
      },
    ],
    references: [
      {
        sourceId: "md-commonmark-0.31.2-spec",
        section: "blocks-and-inlines",
      },
      {
        sourceId: "md-gfm-0.29-published-spec",
        section: "introduction",
      },
      {
        sourceId: "md-beep-extensions-baseline",
        section: "Inline",
      },
      {
        sourceId: "md-beep-extensions-baseline",
        section: "Block",
      },
    ],
    testIds: [
      "test/Md.conformance.test.ts#keeps-profile-membership-explicit-for-GFM-and-Beep-extensions",
      "test/Md.conformance.test.ts#issues-distinct-strict-brands-for-documents-accepted-by-each-profile",
      "test/Md.conformance.test.ts#projects-implemented-checks-into-shared-specification-reports",
    ],
  },
  "md.profile.gfm-commonmark-version-divergence": {
    id: "md.profile.gfm-commonmark-version-divergence",
    title: "Published GFM 0.29 and the CommonMark 0.31.2 target must remain distinct",
    statement:
      "The package records the published GFM 0.29 specification and a separate CommonMark 0.31.2 target without claiming that their combination is an official GFM revision.",
    strength: "must",
    scope: "document",
    decidability: "externalAuthority",
    enforcement: [
      {
        kind: "notEnforced",
        gap: "No published GFM authority defines a composite GFM profile based on CommonMark 0.31.2; the package can only keep the two approved targets explicitly distinct.",
      },
    ],
    references: [
      {
        sourceId: "md-gfm-0.29-published-spec",
        section: "introduction",
      },
      {
        sourceId: "md-commonmark-0.31.2-spec",
        section: "version",
      },
    ],
    testIds: [],
  },
  "md.corpus.commonmark-exhaustive": {
    id: "md.corpus.commonmark-exhaustive",
    title: "The official CommonMark examples must be exercised exhaustively",
    statement:
      "The approved spec and example digests are recorded, but the bytes are not vendored and package tests do not execute the official example corpus.",
    strength: "must",
    scope: "document",
    decidability: "externalAuthority",
    enforcement: [
      {
        kind: "notEnforced",
        gap: "The current pinned evidence cannot establish exhaustive conformance for this invariant.",
      },
    ],
    references: [
      {
        sourceId: "md-commonmark-0.31.2-spec",
        section: "examples",
      },
      {
        sourceId: "md-commonmark-0.31.2-examples",
        section: "examples",
      },
    ],
    testIds: [],
  },
  "md.corpus.gfm-exhaustive": {
    id: "md.corpus.gfm-exhaustive",
    title: "The official selected GFM examples must be exercised exhaustively",
    statement:
      "The approved GFM base and extension digests are recorded, but neither corpus is vendored or run against @beep/md.",
    strength: "must",
    scope: "document",
    decidability: "externalAuthority",
    enforcement: [
      {
        kind: "notEnforced",
        gap: "The current pinned evidence cannot establish exhaustive conformance for this invariant.",
      },
    ],
    references: [
      {
        sourceId: "md-gfm-0.29.0.gfm.13-spec",
        section: "test/spec.txt",
      },
      {
        sourceId: "md-gfm-0.29.0.gfm.13-extensions",
        section: "tables",
      },
      {
        sourceId: "md-gfm-0.29.0.gfm.13-extensions",
        section: "task-list-items",
      },
      {
        sourceId: "md-gfm-0.29.0.gfm.13-extensions",
        section: "strikethrough-extension",
      },
    ],
    testIds: [],
  },
  "md.ast.literal-tag-discrimination": {
    id: "md.ast.literal-tag-discrimination",
    title: "Inline and block variants must have stable literal tags",
    statement:
      "All current inline and block members carry literal _tag values and the public Inline and Block schemas expose exhaustive tagged-union matching.",
    strength: "must",
    scope: "node",
    decidability: "typeLevel",
    enforcement: [
      {
        kind: "typeLevel",
        mechanism: "@beep/md exported schema type for md.ast.literal-tag-discrimination",
      },
      {
        kind: "runtime",
        validator: "Inline",
      },
      {
        kind: "runtime",
        validator: "Block",
      },
      {
        kind: "test",
        suite: "test/Md.conformance.test.ts, test/Md.test.ts",
        oracle: "Pinned source rule and package expectation for md.ast.literal-tag-discrimination",
      },
    ],
    references: [
      {
        sourceId: "md-beep-extensions-baseline",
        section: "Inline",
      },
      {
        sourceId: "md-beep-extensions-baseline",
        section: "Block",
      },
    ],
    testIds: [
      "test/Md.test.ts#round-trips-schema-derived-Markdown-AST-nodes",
      "test/Md.conformance.test.ts#rejects-unknown-Markdown-variant-tags",
    ],
  },
  "md.heading.level-domain": {
    id: "md.heading.level-domain",
    title: "Heading levels must be integers from one through six",
    statement: "HeadingLevel is a six-member finite domain and HTML projection exhaustively selects h1 through h6.",
    strength: "must",
    scope: "value",
    decidability: "localRuntime",
    enforcement: [
      {
        kind: "typeLevel",
        mechanism: "@beep/md exported schema type for md.heading.level-domain",
      },
      {
        kind: "runtime",
        validator: "HeadingLevel",
      },
      {
        kind: "test",
        suite: "test/Md.test.ts, test/Md.conformance.test.ts",
        oracle: "Pinned source rule and package expectation for md.heading.level-domain",
      },
    ],
    references: [
      {
        sourceId: "md-commonmark-0.31.2-spec",
        section: "atx-headings",
      },
      {
        sourceId: "md-commonmark-0.31.2-spec",
        section: "setext-headings",
      },
    ],
    testIds: [
      "test/Md.test.ts#renders-every-block-variant-to-Markdown-and-HTML",
      "test/Md.conformance.test.ts#exposes-six-flat-heading-payload-cases-with-exhaustive-helpers",
      "test/Md.test.ts#falls-back-to-a-closed-heading-tag-for-forged-heading-levels",
    ],
  },
  "md.heading.inline-children": {
    id: "md.heading.inline-children",
    title: "Heading content must be inline-only",
    statement:
      "Heading children use InlineChildren, preventing block nodes and nested heading blocks in the Markdown AST.",
    strength: "must",
    scope: "children",
    decidability: "typeLevel",
    enforcement: [
      {
        kind: "typeLevel",
        mechanism: "@beep/md exported schema type for md.heading.inline-children",
      },
      {
        kind: "runtime",
        validator: "Heading",
      },
      {
        kind: "test",
        suite: "test/Md.test.ts, test/Md.conformance.test.ts",
        oracle: "Pinned source rule and package expectation for md.heading.inline-children",
      },
    ],
    references: [
      {
        sourceId: "md-commonmark-0.31.2-spec",
        section: "atx-headings",
      },
      {
        sourceId: "md-commonmark-0.31.2-spec",
        section: "setext-headings",
      },
    ],
    testIds: [
      "test/Md.test.ts#round-trips-schema-derived-Markdown-AST-nodes",
      "test/Md.conformance.test.ts#rejects-block-children-at-the-heading-schema-boundary",
    ],
  },
  "md.heading.source-syntax": {
    id: "md.heading.source-syntax",
    title: "ATX and setext source distinctions are outside the semantic AST",
    statement:
      "Heading stores semantic level and inline content but intentionally does not preserve whether source used ATX or setext syntax.",
    strength: "may",
    scope: "value",
    decidability: "externalAuthority",
    enforcement: [
      {
        kind: "documented",
        rationale: "The rule is intentionally outside this semantic profile boundary.",
      },
    ],
    references: [
      {
        sourceId: "md-commonmark-0.31.2-spec",
        section: "atx-headings",
      },
      {
        sourceId: "md-commonmark-0.31.2-spec",
        section: "setext-headings",
      },
    ],
    testIds: [],
  },
  "md.link.nested-links": {
    id: "md.link.nested-links",
    title: "Links must not produce nested HTML anchors",
    statement:
      "The broad lossless AST retains nested links, the strict profile inspector rejects them with exact paths, and the HTML adapter degrades inner anchors to inert spans.",
    strength: "mustNot",
    scope: "conversion",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "markdownConformanceIssues",
      },
      {
        kind: "test",
        suite: "test/Md.test.ts, test/Md.conformance.test.ts",
        oracle: "Pinned source rule and package expectation for md.link.nested-links",
      },
    ],
    references: [
      {
        sourceId: "md-commonmark-0.31.2-spec",
        section: "links",
      },
    ],
    testIds: [
      "test/Md.test.ts#normalizes-nested-Markdown-links-into-conformant-non-interactive-descendants",
      "test/Md.conformance.test.ts#rejects-nested-links-strictly-while-retaining-the-exact-lossless-tree",
    ],
  },
  "md.list.nonempty": {
    id: "md.list.nonempty",
    title: "Strict semantic lists must contain at least one item",
    statement:
      "The broad lossless AST accepts empty list containers; strict profile validation reports every empty unordered, ordered, or task list without rewriting the supplied tree.",
    strength: "must",
    scope: "document",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "markdownConformanceIssues",
      },
      {
        kind: "test",
        suite: "test/Md.conformance.test.ts",
        oracle: "Pinned source rule and package expectation for md.list.nonempty",
      },
    ],
    references: [
      {
        sourceId: "md-commonmark-0.31.2-spec",
        section: "list-items",
      },
      {
        sourceId: "md-commonmark-0.31.2-spec",
        section: "lists",
      },
    ],
    testIds: ["test/Md.conformance.test.ts#reports-empty-lists-without-narrowing-the-broad-document-schema"],
  },
  "md.list.ordered-start-range": {
    id: "md.list.ordered-start-range",
    title: "Strict semantic ordered-list starts must be in the CommonMark marker range",
    statement:
      "The broad lossless AST accepts integer starts including zero; strict profile validation accepts 0 through 999999999 and rejects larger semantic values. Because source lexemes are not retained, this does not prove the original marker used one to nine digits.",
    strength: "must",
    scope: "document",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "markdownConformanceIssues",
      },
      {
        kind: "test",
        suite: "test/Md.conformance.test.ts",
        oracle: "Pinned source rule and package expectation for md.list.ordered-start-range",
      },
    ],
    references: [
      {
        sourceId: "md-commonmark-0.31.2-spec",
        section: "list-items",
      },
      {
        sourceId: "md-commonmark-0.31.2-spec",
        section: "lists",
      },
    ],
    testIds: [
      "test/Md.conformance.test.ts#models-zero-ordered-list-starts-losslessly-and-enforces-CommonMark-s-upper-bound-strictly",
    ],
  },
  "md.list.item-content": {
    id: "md.list.item-content",
    title: "List items must preserve representable inline and block content",
    statement:
      "ListItemChild accepts both Inline and Block tagged members and recursive list structures; exact source tight/loose-list semantics are not retained as a separate field.",
    strength: "must",
    scope: "children",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "typeLevel",
        mechanism: "@beep/md exported schema type for md.list.item-content",
      },
      {
        kind: "runtime",
        validator: "ListItemChild",
      },
      {
        kind: "test",
        suite: "test/Md.conformance.test.ts, test/Md.test.ts",
        oracle: "Pinned source rule and package expectation for md.list.item-content",
      },
    ],
    references: [
      {
        sourceId: "md-commonmark-0.31.2-spec",
        section: "list-items",
      },
      {
        sourceId: "md-commonmark-0.31.2-spec",
        section: "lists",
      },
    ],
    testIds: [
      "test/Md.test.ts#supports-template-interpolation-for-inline-and-block-containers",
      "test/Md.conformance.test.ts#rejects-values-outside-the-list-item-content-grammar",
    ],
  },
  "md.gfm.task-lists": {
    id: "md.gfm.task-lists",
    title: "Task-list items must retain checked state and list-item content",
    statement:
      "The AST has explicit task item and task list members with boolean checked state and list-item child content.",
    strength: "must",
    scope: "value",
    decidability: "localRuntime",
    enforcement: [
      {
        kind: "typeLevel",
        mechanism: "@beep/md exported schema type for md.gfm.task-lists",
      },
      {
        kind: "runtime",
        validator: "TaskItem",
      },
      {
        kind: "test",
        suite: "test/Md.conformance.test.ts, test/Md.test.ts",
        oracle: "Pinned source rule and package expectation for md.gfm.task-lists",
      },
    ],
    references: [
      {
        sourceId: "md-gfm-0.29-published-spec",
        section: "task-list-items",
      },
    ],
    testIds: [
      "test/Md.test.ts#renders-core-parity-rich-extension-frontmatter-and-URL-policy-additions",
      "test/Md.conformance.test.ts#rejects-non-boolean-GFM-task-item-state",
    ],
  },
  "md.gfm.strikethrough": {
    id: "md.gfm.strikethrough",
    title: "Strikethrough content must remain inline and render deterministically",
    statement: "Del is a dedicated inline member with InlineChildren and deterministic Markdown and HTML projections.",
    strength: "must",
    scope: "value",
    decidability: "localRuntime",
    enforcement: [
      {
        kind: "typeLevel",
        mechanism: "@beep/md exported schema type for md.gfm.strikethrough",
      },
      {
        kind: "runtime",
        validator: "Del",
      },
      {
        kind: "test",
        suite: "test/Md.conformance.test.ts, test/Md.test.ts",
        oracle: "Pinned source rule and package expectation for md.gfm.strikethrough",
      },
    ],
    references: [
      {
        sourceId: "md-gfm-0.29-published-spec",
        section: "strikethrough-extension",
      },
    ],
    testIds: [
      "test/Md.test.ts#renders-inline-Markdown-and-HTML-variants-with-escaped-text-by-default",
      "test/Md.conformance.test.ts#rejects-block-children-inside-GFM-strikethrough",
    ],
  },
  "md.gfm.table-structure": {
    id: "md.gfm.table-structure",
    title: "Table cells must contain only inline content",
    statement:
      "Nested table schemas enforce Table to TableRow to TableCell to InlineChildren structure and finite alignment values; the broad AST intentionally permits empty rows before strict GFM normalization.",
    strength: "must",
    scope: "value",
    decidability: "localRuntime",
    enforcement: [
      {
        kind: "typeLevel",
        mechanism: "@beep/md exported schema type for md.gfm.table-structure",
      },
      {
        kind: "runtime",
        validator: "TableCell",
      },
      {
        kind: "test",
        suite: "test/Md.conformance.test.ts, test/Md.test.ts",
        oracle: "Pinned source rule and package expectation for md.gfm.table-structure",
      },
    ],
    references: [
      {
        sourceId: "md-gfm-0.29-published-spec",
        section: "tables",
      },
    ],
    testIds: [
      "test/Md.test.ts#renders-later-table-rows-when-the-first-row-has-no-cells",
      "test/Md.conformance.test.ts#rejects-block-children-inside-GFM-table-cells",
    ],
  },
  "md.gfm.table-rectangularity": {
    id: "md.gfm.table-rectangularity",
    title: "Canonical GFM semantic table rows must match the header width",
    statement:
      "GFM parsing inserts missing cells and ignores excess cells before producing the semantic table; the broad pre-normalization AST remains permissive, while the strict GFM semantic-tree profile requires that canonical rectangular result.",
    strength: "must",
    scope: "value",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "markdownConformanceIssues",
      },
      {
        kind: "test",
        suite: "test/Md.conformance.test.ts",
        oracle: "Pinned source rule and package expectation for md.gfm.table-rectangularity",
      },
    ],
    references: [
      {
        sourceId: "md-gfm-0.29-published-spec",
        section: "tables",
      },
    ],
    testIds: ["test/Md.conformance.test.ts#enforces-GFM-header-rectangularity-and-alignment-width-as-tree-invariants"],
  },
  "md.gfm.table-alignment-width": {
    id: "md.gfm.table-alignment-width",
    title: "Strict GFM alignment metadata must match the header width",
    statement:
      "The strict GFM profile permits an empty alignment list or one entry per header cell and rejects every other alignment width; the broad table AST remains lossless and permissive.",
    strength: "must",
    scope: "value",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "markdownConformanceIssues",
      },
      {
        kind: "test",
        suite: "test/Md.conformance.test.ts",
        oracle: "Pinned source rule and package expectation for md.gfm.table-alignment-width",
      },
    ],
    references: [
      {
        sourceId: "md-gfm-0.29-published-spec",
        section: "tables",
      },
    ],
    testIds: ["test/Md.conformance.test.ts#enforces-GFM-header-rectangularity-and-alignment-width-as-tree-invariants"],
  },
  "md.gfm.disallowed-raw-html": {
    id: "md.gfm.disallowed-raw-html",
    title: "Strict GFM documents must apply the disallowed raw HTML filter",
    statement:
      "The GFM strict profile rejects raw HTML containing the pinned disallowed tag family, while CommonMark and the package-owned Beep profile do not inherit that GFM-only filter.",
    strength: "mustNot",
    scope: "node",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "markdownConformanceIssues",
      },
      {
        kind: "test",
        suite: "test/Md.conformance.test.ts",
        oracle: "Pinned source rule and package expectation for md.gfm.disallowed-raw-html",
      },
    ],
    references: [
      {
        sourceId: "md-gfm-0.29-published-spec",
        section: "disallowed-raw-html-extension",
      },
    ],
    testIds: [
      "test/Md.conformance.test.ts#applies-the-GFM-raw-HTML-filter-without-attributing-it-to-CommonMark-or-Beep",
    ],
  },
  "md.gfm.table-header": {
    id: "md.gfm.table-header",
    title: "Strict GFM tables must have a non-empty header row",
    statement:
      "The broad Beep table permits non-GFM tables, while the strict GFM profile requires headerRow true and a first row containing at least one cell.",
    strength: "must",
    scope: "value",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "markdownConformanceIssues",
      },
      {
        kind: "test",
        suite: "test/Md.conformance.test.ts",
        oracle: "Pinned source rule and package expectation for md.gfm.table-header",
      },
    ],
    references: [
      {
        sourceId: "md-gfm-0.29-published-spec",
        section: "tables",
      },
    ],
    testIds: ["test/Md.conformance.test.ts#enforces-GFM-header-rectangularity-and-alignment-width-as-tree-invariants"],
  },
  "md.safe.raw-content": {
    id: "md.safe.raw-content",
    title: "Untrusted safe documents must reject raw Markdown and raw HTML nodes",
    statement:
      "The broad AST retains trusted raw nodes, while documentSafetyIssues, SafeDocument, and refineSafeDocument reject them before safe HTML projection.",
    strength: "must",
    scope: "document",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "documentSafetyIssues",
      },
      {
        kind: "test",
        suite: "test/Md.test.ts",
        oracle: "Pinned source rule and package expectation for md.safe.raw-content",
      },
    ],
    references: [
      {
        sourceId: "md-beep-extensions-baseline",
        section: "RawMarkdown",
      },
      {
        sourceId: "md-beep-extensions-baseline",
        section: "RawHtml",
      },
    ],
    testIds: [
      "test/Md.test.ts#refines-user-authored-documents-without-changing-their-encoded-wire",
      "test/Md.test.ts#keeps-active-HTML-constructs-outside-the-SafeDocument-to-SafeHtml-path",
    ],
  },
  "md.safe.urls-and-scalars": {
    id: "md.safe.urls-and-scalars",
    title: "Safe documents must reject unsafe URLs and invalid scalar strings",
    statement:
      "The SafeDocument boundary rejects unsafe URLs and invalid scalar strings recursively, while render policies degrade denied targets to inert content.",
    strength: "must",
    scope: "value",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "documentSafetyIssues",
      },
      {
        kind: "test",
        suite: "test/Md.test.ts",
        oracle: "Pinned source rule and package expectation for md.safe.urls-and-scalars",
      },
    ],
    references: [
      {
        sourceId: "md-beep-extensions-baseline",
        section: "Inline",
      },
      {
        sourceId: "md-beep-extensions-baseline",
        section: "Block",
      },
    ],
    testIds: [
      "test/Md.test.ts#keeps-canonical-URL-policy-sanitization-at-a-fixed-point",
      "test/Md.test.ts#applies-a-custom-URL-policy-across-every-recursive-render-fold",
      "test/Md.test.ts#refines-user-authored-documents-without-changing-their-encoded-wire",
      "test/Md.test.ts#renders-policy-denied-top-level-and-nested-YouTube-blocks-as-inert-text",
      "test/Md.test.ts#keeps-active-HTML-constructs-outside-the-SafeDocument-to-SafeHtml-path",
      "test/Md.test.ts#rejects-values-that-cannot-complete-the-total-SafeDocument-to-SafeHtml-projection",
    ],
  },
  "md.safe.html-projection-conformance": {
    id: "md.safe.html-projection-conformance",
    title: "Safe documents must project to hard-conformant HTML",
    statement:
      "The SafeDocument brand admits a Markdown document only when Document.toHtml produces no hard HTML author-conformance issue, preserving a total SafeDocument-to-SafeHtml renderer.",
    strength: "must",
    scope: "document",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "typeLevel",
        mechanism: "@beep/md SafeDocument brand for md.safe.html-projection-conformance",
      },
      {
        kind: "runtime",
        validator: "documentSafetyIssues",
      },
      {
        kind: "test",
        suite: "test/Md.test.ts",
        oracle: "Pinned source rule and package expectation for md.safe.html-projection-conformance",
      },
    ],
    references: [
      {
        sourceId: "md-html-whatwg-source-approved",
        section: "headings-and-outlines",
      },
    ],
    testIds: [
      "test/Md.test.ts#rejects-a-heading-outline-that-the-safe-HTML-projection-cannot-render",
      "test/Md.test.ts#renders-every-schema-derived-SafeDocument-without-failing",
    ],
  },
  "md.footnote.unique-definitions": {
    id: "md.footnote.unique-definitions",
    title: "Footnote definition identifiers must be unique throughout a document",
    statement:
      "Both the safe-document refinement and the Beep strict-profile inspector traverse nested containers and report repeated footnote-definition identifiers at exact paths.",
    strength: "must",
    scope: "document",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "markdownConformanceIssues",
      },
      {
        kind: "test",
        suite: "test/Md.test.ts, test/Md.conformance.test.ts",
        oracle: "Pinned source rule and package expectation for md.footnote.unique-definitions",
      },
    ],
    references: [
      {
        sourceId: "md-beep-extensions-baseline",
        section: "FootnoteDefinition",
      },
      {
        sourceId: "md-beep-extensions-baseline",
        section: "Document",
      },
    ],
    testIds: [
      "test/Md.test.ts#rejects-duplicate-footnote-definitions-recursively-at-their-exact-paths",
      "test/Md.test.ts#rejects-every-schema-derived-duplicate-footnote-identifier",
      "test/Md.conformance.test.ts#checks-Beep-footnote-definition-uniqueness-and-reference-resolution-recursively",
    ],
  },
  "md.footnote.defined-references": {
    id: "md.footnote.defined-references",
    title: "Every Beep footnote reference must resolve to a definition",
    statement:
      "The Beep strict-profile inspector collects definitions and references recursively and reports every reference identifier absent from the document's definition set.",
    strength: "must",
    scope: "document",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "markdownConformanceIssues",
      },
      {
        kind: "test",
        suite: "test/Md.conformance.test.ts",
        oracle: "Pinned source rule and package expectation for md.footnote.defined-references",
      },
    ],
    references: [
      {
        sourceId: "md-beep-extensions-baseline",
        section: "FootnoteDefinition",
      },
      {
        sourceId: "md-beep-extensions-baseline",
        section: "FootnoteReference",
      },
      {
        sourceId: "md-beep-extensions-baseline",
        section: "Document",
      },
    ],
    testIds: [
      "test/Md.conformance.test.ts#checks-Beep-footnote-definition-uniqueness-and-reference-resolution-recursively",
    ],
  },
  "md.render.escaping": {
    id: "md.render.escaping",
    title: "Markdown and HTML rendering must escape untrusted text and attributes deterministically",
    statement:
      "Rendering utilities escape text, Markdown destinations, HTML attributes, and raw-looking inline payloads according to the selected trust path.",
    strength: "must",
    scope: "conversion",
    decidability: "localRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "renderMarkdownInline",
      },
      {
        kind: "test",
        suite: "test/Md.test.ts",
        oracle: "Pinned source rule and package expectation for md.render.escaping",
      },
    ],
    references: [
      {
        sourceId: "md-beep-extensions-baseline",
        section: "Inline",
      },
      {
        sourceId: "md-beep-extensions-baseline",
        section: "Block",
      },
    ],
    testIds: ["test/Md.test.ts#renders-inline-Markdown-and-HTML-variants-with-escaped-text-by-default"],
  },
  "md.soft-break-representation": {
    id: "md.soft-break-representation",
    title: "Soft line endings must have an explicit semantic policy",
    statement:
      "The current Inline union has Br for hard breaks but no distinct CommonMark soft-break node; conversions normalize soft breaks elsewhere and cannot preserve the distinction.",
    strength: "must",
    scope: "value",
    decidability: "localRuntime",
    enforcement: [
      {
        kind: "notEnforced",
        gap: "The package does not implement the required profile boundary.",
      },
    ],
    references: [
      {
        sourceId: "md-commonmark-0.31.2-spec",
        section: "soft-line-breaks",
      },
      {
        sourceId: "md-commonmark-0.31.2-spec",
        section: "hard-line-breaks",
      },
    ],
    testIds: [],
  },
  "md.source-parser": {
    id: "md.source-parser",
    title: "Arbitrary Markdown source parsing is outside the current package API",
    statement:
      "The package owns a semantic AST and renderers but does not expose a CommonMark-complete source parser; micromark is used only as a focused test oracle.",
    strength: "may",
    scope: "document",
    decidability: "externalAuthority",
    enforcement: [
      {
        kind: "notEnforced",
        gap: "The package does not implement the required profile boundary.",
      },
    ],
    references: [
      {
        sourceId: "md-commonmark-0.31.2-spec",
        section: "blocks-and-inlines",
      },
      {
        sourceId: "md-micromark-4.0.2",
        section: "package",
      },
    ],
    testIds: [],
  },
  "md.extensions.nonstandard-members": {
    id: "md.extensions.nonstandard-members",
    title: "Package extensions must not be presented as CommonMark or GFM requirements",
    statement:
      "Extension members remain valid in the broad Beep profile, carry package-owned provenance, and are rejected by strict CommonMark or GFM profile validation when the selected profile does not define them.",
    strength: "must",
    scope: "value",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "typeLevel",
        mechanism: "@beep/md exported schema type for md.extensions.nonstandard-members",
      },
      {
        kind: "runtime",
        validator: "markdownConformanceIssues",
      },
      {
        kind: "test",
        suite: "test/Md.test.ts, test/Md.conformance.test.ts",
        oracle: "Pinned source rule and package expectation for md.extensions.nonstandard-members",
      },
    ],
    references: [
      {
        sourceId: "md-beep-extensions-baseline",
        section: "Inline",
      },
      {
        sourceId: "md-beep-extensions-baseline",
        section: "Block",
      },
    ],
    testIds: [
      "test/Md.test.ts#renders-core-parity-rich-extension-frontmatter-and-URL-policy-additions",
      "test/Md.conformance.test.ts#keeps-profile-membership-explicit-for-GFM-and-Beep-extensions",
    ],
  },
} satisfies Readonly<Record<string, typeof Conformance.InvariantDescriptor.Encoded>>;

/**
 * Literal identifier for one invariant in the internal Markdown invariant registry.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type MarkdownInvariantId = keyof typeof MarkdownInvariantDescriptors;

/**
 * CommonMark invariants evaluated by the semantic-tree inspector.
 *
 * @internal
 * @category specifications
 * @since 0.0.0
 */
export const CommonMarkCheckedInvariantIds = [
  "md.link.nested-links",
  "md.extensions.nonstandard-members",
  "md.list.nonempty",
  "md.list.ordered-start-range",
] satisfies readonly [MarkdownInvariantId, ...ReadonlyArray<MarkdownInvariantId>];

/**
 * GFM invariants evaluated by the semantic-tree inspector.
 *
 * @internal
 * @category specifications
 * @since 0.0.0
 */
export const GfmCheckedInvariantIds = [
  "md.link.nested-links",
  "md.extensions.nonstandard-members",
  "md.list.nonempty",
  "md.list.ordered-start-range",
  "md.gfm.table-header",
  "md.gfm.table-rectangularity",
  "md.gfm.table-alignment-width",
  "md.gfm.disallowed-raw-html",
] satisfies readonly [MarkdownInvariantId, ...ReadonlyArray<MarkdownInvariantId>];

/**
 * Beep extension invariants evaluated by the semantic-tree inspector.
 *
 * @internal
 * @category specifications
 * @since 0.0.0
 */
export const BeepCheckedInvariantIds = [
  "md.link.nested-links",
  "md.extensions.nonstandard-members",
  "md.list.nonempty",
  "md.list.ordered-start-range",
  "md.footnote.unique-definitions",
  "md.footnote.defined-references",
] satisfies readonly [MarkdownInvariantId, ...ReadonlyArray<MarkdownInvariantId>];
