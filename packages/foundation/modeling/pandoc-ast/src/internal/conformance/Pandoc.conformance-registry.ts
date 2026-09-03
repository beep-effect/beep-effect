/**
 * Internal specification metadata used by the Pandoc JSON conformance facade.
 *
 * @packageDocumentation
 * @internal
 * @since 0.0.0
 */

import type * as Conformance from "@beep/schema/Conformance";

/**
 * Static source, profile, invariant, and evidence registry for Pandoc JSON conformance.
 *
 * @internal
 * @category specifications
 * @since 0.0.0
 */
export const PandocJsonConformanceAnnotation = {
  sources: [
    {
      id: "pandoc-types-1.23.1-definition",
      title: "pandoc-types 1.23.1 Definition.hs",
      role: "primarySpecification",
      canonicalUrl:
        "https://github.com/jgm/pandoc-types/blob/8e064fa71e4448397165608beeffa9e6833cc373/src/Text/Pandoc/Definition.hs",
      revision: {
        kind: "gitCommit",
        repository: "https://github.com/jgm/pandoc-types",
        commit: "8e064fa71e4448397165608beeffa9e6833cc373",
      },
      contentSha256: "a578c3b4f09e3d8452e2d9f4395846b7d6d608738ec68f6bf0eb5dd5eef483f7",
      license: "BSD-3-Clause",
      scope:
        "Approved upstream authority for the Pandoc 1.23.1 JSON constructor universe; not yet vendored or used to generate the local registry. Consumed anchors: data-Pandoc, data-Block, data-Inline, data-MetaValue, table-types.",
    },
    {
      id: "pandoc-registry-baseline",
      title: "Beep Pandoc 1.23.1 constructor registry baseline",
      role: "implementationReference",
      canonicalUrl:
        "https://github.com/beep-effect/beep-effect/blob/1ed08f66df016a18c6d7d56bd97aa778912cb37b/packages/foundation/modeling/pandoc-ast/src/internal/Pandoc.registry.ts",
      revision: {
        kind: "gitCommit",
        repository: "https://github.com/beep-effect/beep-effect",
        commit: "1ed08f66df016a18c6d7d56bd97aa778912cb37b",
      },
      contentSha256: "006cda579d8ea3670dbf95df16d72e5aa3b55aa70cd6a006b27616e8080b77fd",
      license: "MIT",
      scope:
        "Immutable public pre-initiative hand-authored 78-name known-constructor registry baseline; not yet mechanically generated from the approved pandoc-types source. Consumed anchors: PandocKnownConstructorName, PandocSupportedConstructorName.",
    },
    {
      id: "pandoc-model-baseline",
      title: "Beep Pandoc semantic and lossless v1 model baseline",
      role: "implementationReference",
      canonicalUrl:
        "https://github.com/beep-effect/beep-effect/blob/1ed08f66df016a18c6d7d56bd97aa778912cb37b/packages/foundation/modeling/pandoc-ast/src/Pandoc.model.ts",
      revision: {
        kind: "gitCommit",
        repository: "https://github.com/beep-effect/beep-effect",
        commit: "1ed08f66df016a18c6d7d56bd97aa778912cb37b",
      },
      contentSha256: "e818ee0900f4eee076f05d4423f69f070b2b743baff7de3fd5885ae143417f8f",
      license: "MIT",
      scope:
        "Immutable public pre-initiative package-owned semantic and lossless model baseline, including the strict subset, future-constructor nodes, recursive metadata, and table payload grammar. Consumed anchors: PandocInline, PandocBlock, PandocMetaValue, PandocDocument.",
    },
  ],
  profiles: [
    {
      id: "pandoc-json-1.23.1",
      title: "Pandoc JSON data-model profile",
      version: "1.23.1",
      description: "Pinned pandoc-types constructor and recursive payload profile with strict and lossless decoding.",
      sourceIds: ["pandoc-types-1.23.1-definition", "pandoc-registry-baseline", "pandoc-model-baseline"],
      invariantIds: [
        "pandoc.registry.upstream-generation",
        "pandoc.registry.known-name-exhaustiveness",
        "pandoc.codec.future-constructors",
        "pandoc.codec.known-unsupported",
        "pandoc.codec.constructor-context",
        "pandoc.codec.nullary-payloads",
        "pandoc.table.recursive-payload",
        "pandoc.table.column-width-payload",
        "pandoc.meta.recursive-values",
        "pandoc.api-version.exact-profile",
        "pandoc.list.constructor-domains",
        "pandoc.math.constructor-domain",
        "pandoc.semantic-subset",
        "pandoc.raw.exact-retention",
      ],
    },
  ],
  invariants: [
    {
      id: "pandoc.registry.upstream-generation",
      title: "The known constructor registry must be generated from pinned pandoc-types source",
      statement:
        "The current registry is hand-authored and tested against a duplicated 78-name list; approved Definition.hs bytes are recorded but not vendored or parsed by generation.",
      strength: "must",
      scope: "node",
      decidability: "localRuntime",
      enforcement: [
        {
          kind: "notEnforced",
          gap: "The current pinned evidence cannot establish exhaustive conformance for this invariant.",
        },
      ],
      references: [
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "data-Block",
        },
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "data-Inline",
        },
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "data-MetaValue",
        },
        {
          sourceId: "pandoc-registry-baseline",
          section: "PandocKnownConstructorName",
        },
      ],
      testIds: [],
    },
    {
      id: "pandoc.registry.known-name-exhaustiveness",
      title: "Pinned known constructor names must not be mistaken for future extensions",
      statement:
        "The current registry reserves 78 pinned data and newtype constructor names plus the historical TableCaption alias before classifying any other t value as unknown relative to that pin.",
      strength: "must",
      scope: "node",
      decidability: "typeLevel",
      enforcement: [
        {
          kind: "typeLevel",
          mechanism: "@beep/pandoc-ast exported schema type for pandoc.registry.known-name-exhaustiveness",
        },
        {
          kind: "runtime",
          validator: "UnknownBlock",
        },
        {
          kind: "test",
          suite: "test/Pandoc.codec.test.ts",
          oracle: "Pinned source rule and package expectation for pandoc.registry.known-name-exhaustiveness",
        },
      ],
      references: [
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "data-Block",
        },
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "data-Inline",
        },
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "data-MetaValue",
        },
        {
          sourceId: "pandoc-registry-baseline",
          section: "PandocKnownConstructorName",
        },
      ],
      testIds: [
        "test/Pandoc.codec.test.ts#rejects-known-names-from-semantic-unknown-constructors-and-retains-valid-future-constructors",
      ],
    },
    {
      id: "pandoc.codec.future-constructors",
      title: "Constructor wire unknown to the pinned registry must round-trip exactly",
      statement:
        "Names absent from the pinned registry become explicit future-lane semantic nodes in supported contexts without claiming upstream validity, while complete t/c objects and extension fields remain exact in lossless mode.",
      strength: "must",
      scope: "serialization",
      decidability: "contextualRuntime",
      enforcement: [
        {
          kind: "runtime",
          validator: "UnknownBlock",
        },
        {
          kind: "test",
          suite: "test/Pandoc.codec.test.ts",
          oracle: "Pinned source rule and package expectation for pandoc.codec.future-constructors",
        },
      ],
      references: [
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "data-Block",
        },
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "data-Inline",
        },
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "data-MetaValue",
        },
        {
          sourceId: "pandoc-model-baseline",
          section: "PandocInline",
        },
        {
          sourceId: "pandoc-model-baseline",
          section: "PandocBlock",
        },
        {
          sourceId: "pandoc-model-baseline",
          section: "PandocMetaValue",
        },
      ],
      testIds: [
        "test/Pandoc.codec.test.ts#retains-exact-future-constructors-including-absent-payloads-and-extension-fields",
        "test/Pandoc.codec.test.ts#preserves-arbitrary-future-JSON-through-the-public-lossless-profile",
        "test/Pandoc.codec.test.ts#rejects-known-names-from-semantic-unknown-constructors-and-retains-valid-future-constructors",
      ],
    },
    {
      id: "pandoc.codec.known-unsupported",
      title: "Known context-only constructors must not masquerade as future extensions",
      statement:
        "Pinned structural and newtype constructors such as Row, Cell, Caption, and Citation are accepted only in their defined payload slots; strict decoding rejects them elsewhere and lossless analysis reports exact paths.",
      strength: "must",
      scope: "serialization",
      decidability: "localRuntime",
      enforcement: [
        {
          kind: "typeLevel",
          mechanism: "Context-specific PandocInline, PandocBlock, metadata, and structural wire schemas",
        },
        {
          kind: "runtime",
          validator: "decodePandocJsonStrict",
        },
        {
          kind: "runtime",
          validator: "decodePandocJsonLossless",
        },
        {
          kind: "test",
          suite: "test/Pandoc.codec.test.ts",
          oracle: "Pinned constructor context grammar",
        },
      ],
      references: [
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "structural table, citation, and newtype constructors",
        },
        {
          sourceId: "pandoc-registry-baseline",
          section: "PandocKnownConstructorName",
        },
      ],
      testIds: [
        "test/Pandoc.codec.test.ts#rejects-known-constructors-in-the-wrong-context-and-reports-their-exact-paths-losslessly",
        "test/Pandoc.codec.test.ts#rejects-pinned-structural-and-newtype-constructors-nested-in-opaque-table-slots",
      ],
    },
    {
      id: "pandoc.codec.constructor-context",
      title: "Known constructors must occur only in valid semantic contexts",
      statement:
        "The recursive strict decoder rejects known constructors in the wrong context and the lossless decoder reports the nearest exact JSON pointer.",
      strength: "must",
      scope: "serialization",
      decidability: "contextualRuntime",
      enforcement: [
        {
          kind: "runtime",
          validator: "decodePandocJsonStrict",
        },
        {
          kind: "runtime",
          validator: "decodePandocJsonLossless",
        },
        {
          kind: "test",
          suite: "test/Pandoc.codec.test.ts",
          oracle: "Pinned source rule and package expectation for pandoc.codec.constructor-context",
        },
      ],
      references: [
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "data-Block",
        },
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "data-Inline",
        },
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "table-types",
        },
      ],
      testIds: [
        "test/Pandoc.codec.test.ts#rejects-known-constructors-in-the-wrong-context-and-reports-their-exact-paths-losslessly",
        "test/Pandoc.codec.test.ts#rejects-known-constructors-in-table-structural-slots-and-reports-their-exact-paths",
      ],
    },
    {
      id: "pandoc.codec.nullary-payloads",
      title: "Nullary constructors must not carry a c payload",
      statement:
        "Strict decoding rejects c fields on known nullary constructors and lossless decoding preserves and reports the malformed wire.",
      strength: "mustNot",
      scope: "serialization",
      decidability: "localRuntime",
      enforcement: [
        {
          kind: "runtime",
          validator: "decodePandocJsonStrict",
        },
        {
          kind: "test",
          suite: "test/Pandoc.codec.test.ts",
          oracle: "Pinned source rule and package expectation for pandoc.codec.nullary-payloads",
        },
      ],
      references: [
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "constructors",
        },
      ],
      testIds: ["test/Pandoc.codec.test.ts#rejects-payloads-on-known-nullary-constructors-and-reports-them-losslessly"],
    },
    {
      id: "pandoc.table.recursive-payload",
      title: "Table payloads must satisfy the full recursive Pandoc table grammar",
      statement:
        "The semantic table schema validates attributes, caption, column specifications, head, bodies, foot, rows, cells, spans, alignments, and nested block constructors rather than accepting shallow arrays.",
      strength: "must",
      scope: "subtree",
      decidability: "contextualRuntime",
      enforcement: [
        {
          kind: "typeLevel",
          mechanism: "@beep/pandoc-ast exported schema type for pandoc.table.recursive-payload",
        },
        {
          kind: "runtime",
          validator: "PandocTablePayload",
        },
        {
          kind: "runtime",
          validator: "decodePandocJsonStrict",
        },
        {
          kind: "test",
          suite: "test/Pandoc.codec.test.ts",
          oracle: "Pinned source rule and package expectation for pandoc.table.recursive-payload",
        },
      ],
      references: [
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "table-types",
        },
      ],
      testIds: [
        "test/Pandoc.codec.test.ts#uses-the-semantic-table-schema-at-the-strict-decoder-boundary",
        "test/Pandoc.codec.test.ts#decodes-authentic-Pandoc-1-23-1-table-attributes-captions-heads-and-feet",
        "test/Pandoc.codec.test.ts#rejects-shallow-only-semantic-table-payloads-while-preserving-their-lossless-wire",
        "test/Pandoc.codec.test.ts#rejects-malformed-caption-head-and-foot-slots-with-exact-lossless-diagnostics",
      ],
    },
    {
      id: "pandoc.table.column-width-payload",
      title: "Column-width constructors must enforce variant-dependent payload cardinality",
      statement:
        "ColWidth carries exactly one finite numeric payload, while ColWidthDefault is nullary and cannot carry c; exhaustive t discrimination preserves both exact wire forms.",
      strength: "must",
      scope: "value",
      decidability: "typeLevel",
      enforcement: [
        {
          kind: "typeLevel",
          mechanism: 'PandocColumnWidth S.toTaggedUnion("t")',
        },
        {
          kind: "runtime",
          validator: "PandocColumnWidth",
        },
        {
          kind: "test",
          suite: "test/Pandoc.semantic-conformance.test.ts",
          oracle: "Pinned ColWidth and ColWidthDefault payload grammar",
        },
      ],
      references: [
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "ColWidth and ColWidthDefault",
        },
      ],
      testIds: [
        "test/Pandoc.semantic-conformance.test.ts#discriminates-finite-ColWidth-from-nullary-ColWidthDefault",
        "test/Pandoc.semantic-conformance.test.ts#accepts-every-finite-generated-ColWidth-payload",
      ],
    },
    {
      id: "pandoc.meta.recursive-values",
      title: "Metadata values must recursively preserve all supported constructors",
      statement:
        "Boolean, string, inline, block, list, map, and future metadata values form a recursive tagged union with strict malformed-value rejection and lossless preservation.",
      strength: "must",
      scope: "value",
      decidability: "contextualRuntime",
      enforcement: [
        {
          kind: "typeLevel",
          mechanism: "@beep/pandoc-ast exported schema type for pandoc.meta.recursive-values",
        },
        {
          kind: "runtime",
          validator: "PandocMetaValue",
        },
        {
          kind: "test",
          suite: "test/Pandoc.codec.test.ts",
          oracle: "Pinned source rule and package expectation for pandoc.meta.recursive-values",
        },
      ],
      references: [
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "data-MetaValue",
        },
      ],
      testIds: [
        "test/Pandoc.codec.test.ts#round-trips-recursive-semantic-metadata-and-preserves-unknown-metadata-constructors",
        "test/Pandoc.codec.test.ts#reports-malformed-metadata-in-lossless-mode-and-preserves-it-exactly",
      ],
    },
    {
      id: "pandoc.api-version.exact-profile",
      title: "The strict 1.23.1 profile must distinguish other API versions",
      statement:
        "PandocApiVersion currently accepts any non-empty array of non-negative integers and DEFAULT_PANDOC_API_VERSION only supplies a construction default; strict decode does not prove exact 1.23.1 compatibility.",
      strength: "must",
      scope: "serialization",
      decidability: "localRuntime",
      enforcement: [
        {
          kind: "notEnforced",
          gap: "The current pinned evidence cannot establish exhaustive conformance for this invariant.",
        },
        {
          kind: "test",
          suite: "test/Pandoc.codec.test.ts",
          oracle: "Pinned source rule and package expectation for pandoc.api-version.exact-profile",
        },
      ],
      references: [
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "data-Pandoc",
        },
        {
          sourceId: "pandoc-model-baseline",
          section: "PandocDocument",
        },
      ],
      testIds: [
        "test/Pandoc.codec.test.ts#preserves-representative-encoded-wire-shapes-for-attrs-targets-and-API-versions",
      ],
    },
    {
      id: "pandoc.list.constructor-domains",
      title: "Ordered-list style and delimiter constructors must use pinned domains",
      statement:
        "Numbering style and delimiter use finite constructor domains; malformed or known-wrong-context values fail strict decoding, and list item block structure is preserved.",
      strength: "must",
      scope: "attributes",
      decidability: "localRuntime",
      enforcement: [
        {
          kind: "typeLevel",
          mechanism: "@beep/pandoc-ast exported schema type for pandoc.list.constructor-domains",
        },
        {
          kind: "runtime",
          validator: "decodePandocJsonStrict",
        },
        {
          kind: "runtime",
          validator: "pandocToDocument",
        },
        {
          kind: "test",
          suite: "test/Pandoc.mapping.test.ts, test/Pandoc.codec.test.ts",
          oracle: "Pinned source rule and package expectation for pandoc.list.constructor-domains",
        },
      ],
      references: [
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "ListNumberStyle",
        },
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "ListNumberDelim",
        },
      ],
      testIds: [
        "test/Pandoc.mapping.test.ts#preserves-Pandoc-list-item-block-structure",
        "test/Pandoc.codec.test.ts#rejects-malformed-known-list-constructors-through-the-typed-strict-API",
      ],
    },
    {
      id: "pandoc.math.constructor-domain",
      title: "Math mode must be InlineMath or DisplayMath",
      statement:
        "The semantic Math node accepts only the two pinned math constructors; unsupported or malformed modes fail strict decoding and remain lossless.",
      strength: "must",
      scope: "value",
      decidability: "localRuntime",
      enforcement: [
        {
          kind: "typeLevel",
          mechanism: "@beep/pandoc-ast exported schema type for pandoc.math.constructor-domain",
        },
        {
          kind: "runtime",
          validator: "decodePandocJsonStrict",
        },
        {
          kind: "runtime",
          validator: "pandocToDocument",
        },
        {
          kind: "test",
          suite: "test/Pandoc.mapping.test.ts, test/Pandoc.codec.test.ts",
          oracle: "Pinned source rule and package expectation for pandoc.math.constructor-domain",
        },
      ],
      references: [
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "MathType",
        },
      ],
      testIds: [
        "test/Pandoc.mapping.test.ts#preserves-beep-md-titles-ordered-starts-and-math-in-Pandoc-projection",
        "test/Pandoc.mapping.test.ts#round-trips-an-Md-math-block-through-a-Pandoc-display-math-paragraph",
        "test/Pandoc.codec.test.ts#rejects-unsupported-Math-subtypes-strictly-retains-them-losslessly-and-preserves-ordered-list-semantics",
        "test/Pandoc.codec.test.ts#rejects-known-or-malformed-nullary-constructors-in-a-Math-type-slot",
      ],
    },
    {
      id: "pandoc.semantic-subset",
      title: "The strict semantic model must exhaust the current inline and block constructor set",
      statement:
        "Every pandoc-types 1.23.1 inline and block constructor has a schema-backed semantic member and strict codec case; malformed current payloads fail strict decoding, future names remain open unknown lanes, and Markdown conversion reports target-specific loss.",
      strength: "must",
      scope: "serialization",
      decidability: "contextualRuntime",
      enforcement: [
        {
          kind: "typeLevel",
          mechanism: "PandocInline and PandocBlock exhaustive S.toTaggedUnion schemas",
        },
        {
          kind: "runtime",
          validator: "decodePandocJsonStrict",
        },
        {
          kind: "runtime",
          validator: "decodePandocJsonLossless",
        },
        {
          kind: "runtime",
          validator: "inspectPandocConformance",
        },
        {
          kind: "test",
          suite: "test/Pandoc.semantic-conformance.test.ts",
          oracle: "Pinned pandoc-types constructor and payload grammar",
        },
      ],
      references: [
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "data-Inline",
        },
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "data-Block",
        },
      ],
      testIds: [
        "test/Pandoc.semantic-conformance.test.ts#strictly-round-trips-all-eleven-newly-modeled-pandoc-types-constructors",
        "test/Pandoc.semantic-conformance.test.ts#reports-malformed-Quoted-Cite-LineBlock-DefinitionList-and-Figure-payloads-losslessly",
        "test/Pandoc.semantic-conformance.test.ts#classifies-an-exact-current-document-as-compatible-with-stable-invariant-IDs",
        "test/Pandoc.semantic-conformance.test.ts#classifies-retained-future-constructors-as-unsupported-through-exhaustive-helpers",
        "test/Pandoc.semantic-conformance.test.ts#classifies-malformed-current-constructors-as-invalid-with-lossless-diagnostics",
      ],
    },
    {
      id: "pandoc.raw.exact-retention",
      title: "Raw content format and text must retain exact wire spelling",
      statement:
        "RawInline and RawBlock preserve the exact format identifier and text through strict decode and encode; the model does not case-normalize the open Format string even though Pandoc compares it case-insensitively.",
      strength: "must",
      scope: "serialization",
      decidability: "localRuntime",
      enforcement: [
        {
          kind: "typeLevel",
          mechanism: "PandocFormat, RawInline, and RawBlock schemas",
        },
        {
          kind: "runtime",
          validator: "decodePandocJsonStrict",
        },
        {
          kind: "runtime",
          validator: "encodePandocJson",
        },
        {
          kind: "test",
          suite: "test/Pandoc.semantic-conformance.test.ts",
          oracle: "Exact raw format and text wire round trip",
        },
      ],
      references: [
        {
          sourceId: "pandoc-types-1.23.1-definition",
          section: "Format, RawInline, and RawBlock",
        },
      ],
      testIds: [
        "test/Pandoc.semantic-conformance.test.ts#retains-RawInline-and-RawBlock-format-and-text-exactly",
        "test/Pandoc.semantic-conformance.test.ts#rejects-malformed-raw-format-and-text-payloads",
      ],
    },
  ],
} satisfies typeof Conformance.Annotation.Encoded;
