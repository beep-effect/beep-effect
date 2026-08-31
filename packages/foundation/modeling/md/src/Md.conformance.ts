/**
 * Profile-aware conformance checks for the semantic Markdown AST.
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
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { Number as N, Result } from "effect";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Block, Document, FootnoteIdentifier, Inline } from "./Md.model.ts";
import { DocumentSafetyPathSegment } from "./Md.safe.ts";
import type { ListItemChild, Table } from "./Md.model.ts";

const $I = $MdId.create("Md.conformance");

const MarkdownSpecificationSources = {
  "md-commonmark-0.31.2-spec": {
    id: "md-commonmark-0.31.2-spec",
    title: "CommonMark Specification 0.31.2",
    role: "primarySpecification",
    canonicalUrl: "https://spec.commonmark.org/0.31.2/spec.txt",
    revision: {
      kind: "release",
      version: "0.31.2",
    },
    contentSha256: "bfef4ddc97276b6ab6c2a28ace48478e35b1c50e60cde9f517ab8ab030aa3b82",
    license: "CC-BY-SA-4.0",
    scope:
      "Approved target authority for the CommonMark block, inline, container, and rendering profile; not yet vendored or run as a package conformance corpus. Consumed anchors: blocks-and-inlines, atx-headings, setext-headings, lists, links, raw-html.",
  },
  "md-commonmark-0.31.2-examples": {
    id: "md-commonmark-0.31.2-examples",
    title: "CommonMark Specification 0.31.2 examples",
    role: "conformanceCorpus",
    canonicalUrl: "https://spec.commonmark.org/0.31.2/spec.json",
    revision: {
      kind: "release",
      version: "0.31.2",
    },
    contentSha256: "d431b29d97b6f73e69d547109cf5081578fac931e72afe95639ebe766c1b2a20",
    license: "CC-BY-SA-4.0",
    scope:
      "Approved target differential corpus; not yet vendored or wired into package tests. Consumed anchors: examples.",
  },
  "md-gfm-0.29.0.gfm.13-spec": {
    id: "md-gfm-0.29.0.gfm.13-spec",
    title: "GitHub Flavored Markdown base specification fixture",
    role: "primarySpecification",
    canonicalUrl: "https://github.com/github/cmark-gfm/blob/587a12bb54d95ac37241377e6ddc93ea0e45439b/test/spec.txt",
    revision: {
      kind: "gitCommit",
      repository: "https://github.com/github/cmark-gfm",
      commit: "587a12bb54d95ac37241377e6ddc93ea0e45439b",
    },
    contentSha256: "7d8e5814befec287ac116786d81ff14e0adc9b13295b4494649e995408fd871c",
    license: "CC-BY-SA-4.0",
    scope:
      "Approved target GFM base corpus at tag 0.29.0.gfm.13; not yet vendored or wired into package tests. Consumed anchors: test/spec.txt.",
  },
  "md-gfm-0.29.0.gfm.13-extensions": {
    id: "md-gfm-0.29.0.gfm.13-extensions",
    title: "GitHub Flavored Markdown extension fixtures",
    role: "primarySpecification",
    canonicalUrl:
      "https://github.com/github/cmark-gfm/blob/587a12bb54d95ac37241377e6ddc93ea0e45439b/test/extensions.txt",
    revision: {
      kind: "gitCommit",
      repository: "https://github.com/github/cmark-gfm",
      commit: "587a12bb54d95ac37241377e6ddc93ea0e45439b",
    },
    contentSha256: "a2a45e98be9fca95f564f927265a0f63beea6cae5369d1cf4bde44caa51b2a3a",
    license: "CC-BY-SA-4.0",
    scope:
      "Approved target GFM extension corpus for tables, task-list items, strikethrough, autolinks, and tag filtering; not yet vendored or wired into package tests. Consumed anchors: tables, task-list-items, strikethrough-extension, autolinks-extension, disallowed-raw-html-extension.",
  },
  "md-micromark-4.0.2": {
    id: "md-micromark-4.0.2",
    title: "micromark 4.0.2 npm artifact",
    role: "implementationReference",
    canonicalUrl: "https://registry.npmjs.org/micromark/-/micromark-4.0.2.tgz",
    revision: {
      kind: "release",
      version: "4.0.2",
    },
    contentSha256: "ddbea34c618d8b869600f2fdde7398526c40f6caf511fc6393877796459a7e66",
    license: "MIT",
    scope:
      "Development-only differential oracle used by focused tests; it is not a normative source and does not currently provide full CommonMark corpus coverage. Consumed anchors: package.",
  },
  "md-beep-extensions-baseline": {
    id: "md-beep-extensions-baseline",
    title: "Beep Markdown extension profile baseline",
    role: "implementationReference",
    canonicalUrl:
      "https://github.com/beep-effect/beep-effect/blob/1ed08f66df016a18c6d7d56bd97aa778912cb37b/packages/foundation/modeling/md/src/Md.model.ts",
    revision: {
      kind: "gitCommit",
      repository: "https://github.com/beep-effect/beep-effect",
      commit: "1ed08f66df016a18c6d7d56bd97aa778912cb37b",
    },
    contentSha256: "9176ad9b581bf13f7656d3cec0f93338bc8b56a8d3825d022afd8acc3f54a805",
    license: "MIT",
    scope:
      "Immutable public pre-initiative package-owned extension baseline, including math, footnotes, admonitions, embeds, YouTube blocks, and trust-aware raw nodes. Consumed anchors: Inline, Block, Document.",
  },
} satisfies Readonly<Record<string, typeof Conformance.SpecificationSource.Encoded>>;

const MarkdownInvariantDescriptors = {
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
        validator: "@beep/md Effect Schema decode boundary for md.profile.explicit-boundaries",
      },
      {
        kind: "runtime",
        validator: "markdownConformanceIssues and strict profile schemas",
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
        sourceId: "md-gfm-0.29.0.gfm.13-extensions",
        section: "extensions",
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
        validator: "@beep/md Effect Schema decode boundary for md.ast.literal-tag-discrimination",
      },
      {
        kind: "test",
        suite: "test/Md.test.ts",
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
    testIds: ["test/Md.test.ts#round-trips-schema-derived-Markdown-AST-nodes"],
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
        validator: "@beep/md Effect Schema decode boundary for md.heading.level-domain",
      },
      {
        kind: "runtime",
        validator: "@beep/md adapter boundary for md.heading.level-domain",
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
        validator: "@beep/md Effect Schema decode boundary for md.heading.inline-children",
      },
      {
        kind: "test",
        suite: "test/Md.test.ts",
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
    testIds: ["test/Md.test.ts#round-trips-schema-derived-Markdown-AST-nodes"],
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
        validator: "markdownConformanceIssues and strict profile schemas",
      },
      {
        kind: "runtime",
        validator: "@beep/md adapter boundary for md.link.nested-links",
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
        validator: "markdownConformanceIssues and strict profile schemas",
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
        validator: "markdownConformanceIssues and strict profile schemas",
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
        validator: "@beep/md Effect Schema decode boundary for md.list.item-content",
      },
      {
        kind: "runtime",
        validator: "@beep/md adapter boundary for md.list.item-content",
      },
      {
        kind: "test",
        suite: "test/Md.test.ts",
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
    testIds: ["test/Md.test.ts#supports-template-interpolation-for-inline-and-block-containers"],
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
        validator: "@beep/md Effect Schema decode boundary for md.gfm.task-lists",
      },
      {
        kind: "runtime",
        validator: "@beep/md adapter boundary for md.gfm.task-lists",
      },
      {
        kind: "test",
        suite: "test/Md.test.ts",
        oracle: "Pinned source rule and package expectation for md.gfm.task-lists",
      },
    ],
    references: [
      {
        sourceId: "md-gfm-0.29.0.gfm.13-extensions",
        section: "task-list-items",
      },
    ],
    testIds: ["test/Md.test.ts#renders-core-parity-rich-extension-frontmatter-and-URL-policy-additions"],
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
        validator: "@beep/md Effect Schema decode boundary for md.gfm.strikethrough",
      },
      {
        kind: "runtime",
        validator: "@beep/md adapter boundary for md.gfm.strikethrough",
      },
      {
        kind: "test",
        suite: "test/Md.test.ts",
        oracle: "Pinned source rule and package expectation for md.gfm.strikethrough",
      },
    ],
    references: [
      {
        sourceId: "md-gfm-0.29.0.gfm.13-extensions",
        section: "strikethrough-extension",
      },
    ],
    testIds: ["test/Md.test.ts#renders-inline-Markdown-and-HTML-variants-with-escaped-text-by-default"],
  },
  "md.gfm.table-structure": {
    id: "md.gfm.table-structure",
    title: "Table cells must contain inline content and rows must contain cells",
    statement:
      "Nested table schemas enforce Table to TableRow to TableCell to InlineChildren structure and finite alignment values.",
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
        validator: "@beep/md Effect Schema decode boundary for md.gfm.table-structure",
      },
      {
        kind: "runtime",
        validator: "@beep/md adapter boundary for md.gfm.table-structure",
      },
      {
        kind: "test",
        suite: "test/Md.test.ts",
        oracle: "Pinned source rule and package expectation for md.gfm.table-structure",
      },
    ],
    references: [
      {
        sourceId: "md-gfm-0.29.0.gfm.13-extensions",
        section: "tables",
      },
    ],
    testIds: ["test/Md.test.ts#renders-later-table-rows-when-the-first-row-has-no-cells"],
  },
  "md.gfm.table-rectangularity": {
    id: "md.gfm.table-rectangularity",
    title: "Strict GFM table rows must match the semantic header width",
    statement:
      "The broad table AST remains permissive, while the strict GFM profile rejects every row whose cell count differs from the first header row's width.",
    strength: "should",
    scope: "value",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "markdownConformanceIssues and strict profile schemas",
      },
      {
        kind: "test",
        suite: "test/Md.conformance.test.ts",
        oracle: "Pinned source rule and package expectation for md.gfm.table-rectangularity",
      },
    ],
    references: [
      {
        sourceId: "md-gfm-0.29.0.gfm.13-extensions",
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
        validator: "markdownConformanceIssues and strict profile schemas",
      },
      {
        kind: "test",
        suite: "test/Md.conformance.test.ts",
        oracle: "Pinned source rule and package expectation for md.gfm.table-alignment-width",
      },
    ],
    references: [
      {
        sourceId: "md-gfm-0.29.0.gfm.13-extensions",
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
        validator: "markdownConformanceIssues and strict profile schemas",
      },
      {
        kind: "test",
        suite: "test/Md.conformance.test.ts",
        oracle: "Pinned source rule and package expectation for md.gfm.disallowed-raw-html",
      },
    ],
    references: [
      {
        sourceId: "md-gfm-0.29.0.gfm.13-extensions",
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
        validator: "markdownConformanceIssues and strict profile schemas",
      },
      {
        kind: "test",
        suite: "test/Md.conformance.test.ts",
        oracle: "Pinned source rule and package expectation for md.gfm.table-header",
      },
    ],
    references: [
      {
        sourceId: "md-gfm-0.29.0.gfm.13-extensions",
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
        validator: "documentSafetyIssues, SafeDocument, and refineSafeDocument",
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
        validator: "documentSafetyIssues, SafeDocument, and refineSafeDocument",
      },
      {
        kind: "runtime",
        validator: "makeMarkdownAdapter and makeHtmlFragmentAdapter URL policy boundaries",
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
        validator: "markdownConformanceIssues and strict profile schemas",
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
        validator: "markdownConformanceIssues and strict profile schemas",
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
        validator: "@beep/md adapter boundary for md.render.escaping",
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
        validator: "@beep/md Effect Schema decode boundary for md.extensions.nonstandard-members",
      },
      {
        kind: "runtime",
        validator: "markdownConformanceIssues and strict profile schemas",
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

type MarkdownSpecificationSourceId = keyof typeof MarkdownSpecificationSources;
type MarkdownInvariantId = keyof typeof MarkdownInvariantDescriptors;

const commonMarkProfileSourceIds = [
  "md-commonmark-0.31.2-spec",
  "md-commonmark-0.31.2-examples",
  "md-gfm-0.29.0.gfm.13-extensions",
  "md-micromark-4.0.2",
  "md-beep-extensions-baseline",
] satisfies A.NonEmptyReadonlyArray<MarkdownSpecificationSourceId>;

const gfmProfileSourceIds = [
  "md-commonmark-0.31.2-spec",
  "md-gfm-0.29.0.gfm.13-spec",
  "md-gfm-0.29.0.gfm.13-extensions",
  "md-beep-extensions-baseline",
] satisfies A.NonEmptyReadonlyArray<MarkdownSpecificationSourceId>;

const beepProfileSourceIds = [
  "md-commonmark-0.31.2-spec",
  "md-gfm-0.29.0.gfm.13-extensions",
  "md-beep-extensions-baseline",
] satisfies A.NonEmptyReadonlyArray<MarkdownSpecificationSourceId>;

const commonMarkProfileInvariantIds = [
  "md.profile.explicit-boundaries",
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
  "md.footnote.unique-definitions",
  "md.footnote.defined-references",
  "md.render.escaping",
  "md.extensions.nonstandard-members",
] satisfies A.NonEmptyReadonlyArray<MarkdownInvariantId>;

const CommonMarkProfileDefinition = {
  id: "commonmark-0.31.2",
  title: "CommonMark semantic AST",
  version: "0.31.2",
  description: "Tracked CommonMark 0.31.2 semantic-AST obligations and explicit source/corpus gaps.",
  sourceIds: commonMarkProfileSourceIds,
  invariantIds: commonMarkProfileInvariantIds,
} satisfies typeof Conformance.ConformanceProfile.Encoded;

const GfmProfileDefinition = {
  id: "gfm-0.29.0.gfm.13",
  title: "GitHub Flavored Markdown semantic AST",
  version: "0.29.0.gfm.13",
  description: "Tracked GFM obligations across decoded AST, adapters, and explicit corpus gaps.",
  sourceIds: gfmProfileSourceIds,
  invariantIds: gfmProfileInvariantIds,
} satisfies typeof Conformance.ConformanceProfile.Encoded;

const BeepMarkdownProfileDefinition = {
  id: "beep-md-extensions-v1",
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

const CommonMarkConformanceAnnotation = {
  sources: specificationSourcesFor(commonMarkProfileSourceIds),
  profiles: [CommonMarkProfileDefinition],
  invariants: invariantDescriptorsFor(commonMarkProfileInvariantIds),
} satisfies typeof Conformance.Annotation.Encoded;

const GfmConformanceAnnotation = {
  sources: specificationSourcesFor(gfmProfileSourceIds),
  profiles: [GfmProfileDefinition],
  invariants: invariantDescriptorsFor(gfmProfileInvariantIds),
} satisfies typeof Conformance.Annotation.Encoded;

const BeepMarkdownConformanceAnnotation = {
  sources: specificationSourcesFor(beepProfileSourceIds),
  profiles: [BeepMarkdownProfileDefinition],
  invariants: invariantDescriptorsFor(beepProfileInvariantIds),
} satisfies typeof Conformance.Annotation.Encoded;
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
 * @see [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/) for the base Markdown specification.
 * @see [cmark-gfm 0.29.0.gfm.13](https://github.com/github/cmark-gfm/tree/0.29.0.gfm.13) for the pinned GFM extension corpus.
 * @category specifications
 * @since 0.0.0
 */
export const MarkdownConformanceProfile = LiteralKit({
  literals: ["commonmark-0.31.2", "gfm-0.29.0.gfm.13", "beep-md-extensions-v1"],
  enumMapping: [
    ["commonmark-0.31.2", "CommonMark"],
    ["gfm-0.29.0.gfm.13", "Gfm"],
    ["beep-md-extensions-v1", "Beep"],
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

const commonMarkCheckedInvariantIds = [
  "md.link.nested-links",
  "md.extensions.nonstandard-members",
  "md.list.nonempty",
  "md.list.ordered-start-range",
] satisfies A.NonEmptyReadonlyArray<MarkdownInvariantId>;

const gfmCheckedInvariantIds = [
  "md.link.nested-links",
  "md.extensions.nonstandard-members",
  "md.list.nonempty",
  "md.list.ordered-start-range",
  "md.gfm.table-header",
  "md.gfm.table-rectangularity",
  "md.gfm.table-alignment-width",
  "md.gfm.disallowed-raw-html",
] satisfies A.NonEmptyReadonlyArray<MarkdownInvariantId>;

const beepCheckedInvariantIds = [
  "md.link.nested-links",
  "md.extensions.nonstandard-members",
  "md.list.nonempty",
  "md.list.ordered-start-range",
  "md.footnote.unique-definitions",
  "md.footnote.defined-references",
] satisfies A.NonEmptyReadonlyArray<MarkdownInvariantId>;

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
 * @see [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/) for the pinned normative source.
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
 * @see [cmark-gfm 0.29.0.gfm.13](https://github.com/github/cmark-gfm/tree/0.29.0.gfm.13) for the pinned implementation and fixtures.
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
    description: "GFM table row whose cell count differs from the header width.",
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
 * extension membership, GFM table shape and filtered raw HTML, and Beep
 * footnote identity/reference rules. It does not parse source syntax or claim
 * official-corpus completeness.
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
 * @see [CommonMark links](https://spec.commonmark.org/0.31.2/#links) for the prohibition on nested links.
 * @see [CommonMark list items](https://spec.commonmark.org/0.31.2/#list-items) for ordered marker bounds and list structure.
 * @see [GFM extensions](https://github.github.com/gfm/) for tables, task-list items, strikethrough, and filtered raw HTML.
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
 * @see [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/) for the governing specification.
 * @category validation
 * @since 0.0.0
 */
export const CommonMarkDocument = Document.pipe(
  S.check(CommonMarkDocumentCheck),
  S.brand("CommonMarkDocument"),
  Conformance.annotateConformance(CommonMarkConformanceAnnotation),
  $I.annoteSchema("CommonMarkDocument", {
    description: "Markdown AST satisfying every implemented CommonMark 0.31.2 semantic-tree check.",
  }),
  SchemaUtils.withCodecStatics
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
 * the semantic-tree inspector subset.
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
 * @see [GFM extensions](https://github.github.com/gfm/) for the extension semantics.
 * @category validation
 * @since 0.0.0
 */
export const GfmDocument = Document.pipe(
  S.check(GfmDocumentCheck),
  S.brand("GfmDocument"),
  Conformance.annotateConformance(GfmConformanceAnnotation),
  $I.annoteSchema("GfmDocument", {
    description: "Markdown AST satisfying every implemented pinned-GFM semantic-tree check.",
  }),
  SchemaUtils.withCodecStatics
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
 * @see [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/) for the normative base syntax.
 * @category validation
 * @since 0.0.0
 */
export const BeepMarkdownDocument = Document.pipe(
  S.check(BeepMarkdownDocumentCheck),
  S.brand("BeepMarkdownDocument"),
  Conformance.annotateConformance(BeepMarkdownConformanceAnnotation),
  $I.annoteSchema("BeepMarkdownDocument", {
    description: "Markdown AST satisfying every implemented Beep extension semantic-tree check.",
  }),
  SchemaUtils.withCodecStatics
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
  CommonMark: () => commonMarkCheckedInvariantIds,
  Gfm: () => gfmCheckedInvariantIds,
  Beep: () => beepCheckedInvariantIds,
});

const must = (): Conformance.RequirementStrength => "must";
const mustNot = (): Conformance.RequirementStrength => "mustNot";
const should = (): Conformance.RequirementStrength => "should";

const sharedRequirementStrength = MarkdownConformanceIssue.match({
  NestedLink: mustNot,
  UnsupportedNode: mustNot,
  EmptyList: must,
  OrderedListStart: must,
  GfmTableHeader: must,
  GfmTableRowWidth: should,
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
