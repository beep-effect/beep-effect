import type * as Conformance from "@beep/schema/Conformance";

/**
 * Internal registry of pinned Markdown specification and implementation sources.
 *
 * @internal
 * @category specifications
 * @since 0.0.0
 */
export const MarkdownSpecificationSources = {
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
  "md-gfm-0.29-published-spec": {
    id: "md-gfm-0.29-published-spec",
    title: "GitHub Flavored Markdown Specification 0.29-gfm",
    role: "primarySpecification",
    canonicalUrl: "https://github.github.com/gfm/",
    revision: {
      kind: "retrievedSnapshot",
      retrievedOn: "2026-08-31",
    },
    contentSha256: "b153d814fdfc8624bb6da7449162c1cd707a637f7d1c1b636eb44b9cf63fa220",
    license: "CC-BY-SA-4.0",
    scope:
      "Published GFM 0.29 authority for the CommonMark superset and table, task-list, strikethrough, autolink, and tag-filter extensions. Consumed anchors: introduction, tables-extension, task-list-items-extension, strikethrough-extension, autolinks-extension, disallowed-raw-html-extension.",
  },
  "md-gfm-0.29.0.gfm.13-spec": {
    id: "md-gfm-0.29.0.gfm.13-spec",
    title: "cmark-gfm 0.29.0.gfm.13 base conformance corpus",
    role: "conformanceCorpus",
    canonicalUrl:
      "https://raw.githubusercontent.com/github/cmark-gfm/587a12bb54d95ac37241377e6ddc93ea0e45439b/test/spec.txt",
    revision: {
      kind: "gitCommit",
      repository: "https://github.com/github/cmark-gfm.git",
      commit: "587a12bb54d95ac37241377e6ddc93ea0e45439b",
    },
    contentSha256: "7d8e5814befec287ac116786d81ff14e0adc9b13295b4494649e995408fd871c",
    license: "CC-BY-SA-4.0",
    scope:
      "Approved target GFM base corpus at tag 0.29.0.gfm.13; not yet vendored or wired into package tests. Consumed anchors: test/spec.txt.",
  },
  "md-gfm-0.29.0.gfm.13-extensions": {
    id: "md-gfm-0.29.0.gfm.13-extensions",
    title: "cmark-gfm 0.29.0.gfm.13 extension conformance corpus",
    role: "conformanceCorpus",
    canonicalUrl:
      "https://raw.githubusercontent.com/github/cmark-gfm/587a12bb54d95ac37241377e6ddc93ea0e45439b/test/extensions.txt",
    revision: {
      kind: "gitCommit",
      repository: "https://github.com/github/cmark-gfm.git",
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

/**
 * Literal identifier for one source in the internal Markdown specification registry.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type MarkdownSpecificationSourceId = keyof typeof MarkdownSpecificationSources;
