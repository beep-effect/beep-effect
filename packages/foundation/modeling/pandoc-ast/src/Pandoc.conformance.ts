/**
 * Exhaustive conformance classification for Pandoc JSON wire values.
 *
 * @packageDocumentation \@beep/pandoc-ast/Pandoc.conformance
 * @since 0.0.0
 */

import { $PandocAstId } from "@beep/identity";
import * as Conformance from "@beep/schema/Conformance";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { A, O, P, R } from "@beep/utils";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { isPandocKnownConstructorName } from "./internal/Pandoc.registry.ts";
import {
  decodePandocJsonLossless,
  decodePandocJsonStrict,
  encodePandocJson,
  PandocConstructorWire,
  PandocJsonWire,
  PandocLosslessIssue,
} from "./Pandoc.codec.ts";
import { PandocDocument } from "./Pandoc.model.ts";

const $I = $PandocAstId.create("Pandoc.conformance");

const PandocJsonConformanceAnnotation = {
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
        "pandoc.meta.recursive-values",
        "pandoc.api-version.exact-profile",
        "pandoc.list.constructor-domains",
        "pandoc.math.constructor-domain",
        "pandoc.semantic-subset",
        "pandoc.raw.exact-retention",
        "pandoc.table.column-width-payload",
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
          validator: "@beep/pandoc-ast Effect Schema decode boundary for pandoc.registry.known-name-exhaustiveness",
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
          validator: "@beep/pandoc-ast Effect Schema decode boundary for pandoc.codec.future-constructors",
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
          validator: "decodePandocJsonLossless recursive inspector",
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
          validator: "@beep/pandoc-ast Effect Schema decode boundary for pandoc.codec.constructor-context",
        },
        {
          kind: "runtime",
          validator: "strict Pandoc decode and compatibility checks",
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
          validator: "@beep/pandoc-ast Effect Schema decode boundary for pandoc.codec.nullary-payloads",
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
          validator: "@beep/pandoc-ast Effect Schema decode boundary for pandoc.table.recursive-payload",
        },
        {
          kind: "runtime",
          validator: "strict Pandoc decode and compatibility checks",
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
          validator: "PandocColumnWidth schema and strict table decoder",
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
          validator: "@beep/pandoc-ast Effect Schema decode boundary for pandoc.meta.recursive-values",
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
          validator: "@beep/pandoc-ast Effect Schema decode boundary for pandoc.list.constructor-domains",
        },
        {
          kind: "runtime",
          validator: "@beep/pandoc-ast adapter boundary for pandoc.list.constructor-domains",
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
          validator: "@beep/pandoc-ast Effect Schema decode boundary for pandoc.math.constructor-domain",
        },
        {
          kind: "runtime",
          validator: "@beep/pandoc-ast adapter boundary for pandoc.math.constructor-domain",
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
          validator: "decodePandocJsonLossless recursive inspector",
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
          validator: "decodePandocJsonStrict and encodePandocJson",
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
      testIds: ["test/Pandoc.semantic-conformance.test.ts#retains-RawInline-and-RawBlock-format-and-text-exactly"],
    },
  ],
} satisfies typeof Conformance.Annotation.Encoded;

/**
 * Stable identifiers for the invariants checked by Pandoc conformance inspection.
 *
 * **Example** (Recognize semantic-subset invariant)
 *
 * ```ts import.meta.vitest name="Recognize semantic-subset invariant"
 * import { PandocConformanceInvariantId } from "@beep/pandoc-ast/Pandoc.conformance"
 *
 * PandocConformanceInvariantId.is["pandoc.semantic-subset"]("pandoc.semantic-subset") // => true
 * ```
 *
 * @see [Pandoc 1.23.1 AST definitions](https://github.com/jgm/pandoc-types/blob/8e064fa71e4448397165608beeffa9e6833cc373/src/Text/Pandoc/Definition.hs)
 * @category diagnostics
 * @since 0.0.0
 */
export const PandocConformanceInvariantId = LiteralKit([
  "pandoc.semantic-subset",
  "pandoc.raw.exact-retention",
  "pandoc.table.column-width-payload",
]).pipe(
  $I.annoteSchema("PandocConformanceInvariantId", {
    description: "Stable identifier for an invariant checked by Pandoc conformance inspection.",
  })
);

/**
 * Runtime type for {@link PandocConformanceInvariantId}.
 *
 * @see {@link PandocConformanceInvariantId} for the complete literal domain.
 * @category diagnostics
 * @since 0.0.0
 */
export type PandocConformanceInvariantId = typeof PandocConformanceInvariantId.Type;

/**
 * Complete ordered invariant set checked by the Pandoc conformance facade.
 *
 * **Example** (Make the checked invariant tuple)
 *
 * ```ts import.meta.vitest name="Make the checked invariant tuple"
 * import { PandocCheckedInvariantIds } from "@beep/pandoc-ast/Pandoc.conformance"
 *
 * const ids = PandocCheckedInvariantIds.make([
 *   "pandoc.semantic-subset",
 *   "pandoc.raw.exact-retention",
 *   "pandoc.table.column-width-payload",
 * ])
 * ids.length // => 3
 * ```
 *
 * @invariant Every conformance result reports these three stable IDs in this order.
 * @category diagnostics
 * @since 0.0.0
 */
export const PandocCheckedInvariantIds = S.Tuple([
  S.Literal("pandoc.semantic-subset"),
  S.Literal("pandoc.raw.exact-retention"),
  S.Literal("pandoc.table.column-width-payload"),
]).pipe(
  $I.annoteSchema("PandocCheckedInvariantIds", {
    description: "Complete ordered invariant set checked by the Pandoc conformance facade.",
  })
);

/**
 * Runtime type for {@link PandocCheckedInvariantIds}.
 *
 * @category diagnostics
 * @since 0.0.0
 */
export type PandocCheckedInvariantIds = typeof PandocCheckedInvariantIds.Type;

const checkedInvariantIds = PandocCheckedInvariantIds.make([
  "pandoc.semantic-subset",
  "pandoc.raw.exact-retention",
  "pandoc.table.column-width-payload",
]);

const PandocConformanceWire = S.Record(S.String, S.Json).pipe(
  $I.annoteSchema("PandocConformanceWire", {
    description: "Exact JSON object retained by Pandoc conformance inspection.",
  })
);

class FuturePandocConstructorIssue extends S.TaggedClass<FuturePandocConstructorIssue>(
  $I`FuturePandocConstructorIssue`
)(
  "futureConstructor",
  {
    constructor: S.String.annotateKey({
      description: "Future constructor name retained by the open semantic wire lane.",
    }),
  },
  $I.annote("FuturePandocConstructorIssue", {
    description: "Future Pandoc constructor retained losslessly but outside the pinned current AST.",
  })
) {}

class NonCanonicalPandocWireIssue extends S.TaggedClass<NonCanonicalPandocWireIssue>($I`NonCanonicalPandocWireIssue`)(
  "nonCanonicalWire",
  {
    message: S.NonEmptyString.annotateKey({
      description: "Explanation of the strict encode fixed-point mismatch.",
    }),
  },
  $I.annote("NonCanonicalPandocWireIssue", {
    description: "Lossless Pandoc JSON which strict decoding would not reproduce exactly.",
  })
) {}

/**
 * Unsupported-but-lossless reason discovered at the Pandoc JSON boundary.
 *
 * **Example** (Match an unsupported reason)
 *
 * ```ts import.meta.vitest name="Match an unsupported reason"
 * import { PandocConformanceIssue } from "@beep/pandoc-ast/Pandoc.conformance"
 *
 * const issue = PandocConformanceIssue.cases.futureConstructor.make({ constructor: "FutureBlock" })
 * PandocConformanceIssue.match(issue, {
 *   futureConstructor: ({ constructor }) => constructor,
 *   nonCanonicalWire: ({ message }) => message,
 * }) // => "FutureBlock"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const PandocConformanceIssue = S.Union([FuturePandocConstructorIssue, NonCanonicalPandocWireIssue]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("PandocConformanceIssue", {
    description: "Exhaustive unsupported-but-lossless Pandoc conformance reason.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime issue represented by {@link PandocConformanceIssue}.
 *
 * @category diagnostics
 * @since 0.0.0
 */
export type PandocConformanceIssue = typeof PandocConformanceIssue.Type;

class CompatiblePandocDocument extends S.TaggedClass<CompatiblePandocDocument>($I`CompatiblePandocDocument`)(
  "compatible",
  {
    checkedInvariantIds: PandocCheckedInvariantIds,
    document: PandocDocument,
    wire: PandocConformanceWire,
  },
  $I.annote("CompatiblePandocDocument", {
    description: "Pandoc JSON that is an exact fixed point of the pinned strict semantic codec.",
  })
) {}

class UnsupportedPandocDocument extends S.TaggedClass<UnsupportedPandocDocument>($I`UnsupportedPandocDocument`)(
  "unsupported",
  {
    checkedInvariantIds: PandocCheckedInvariantIds,
    document: PandocDocument,
    issues: S.NonEmptyArray(PandocConformanceIssue),
    wire: PandocConformanceWire,
  },
  $I.annote("UnsupportedPandocDocument", {
    description: "Lossless Pandoc JSON retained outside the pinned exact strict semantic profile.",
  })
) {}

class InvalidPandocDocument extends S.TaggedClass<InvalidPandocDocument>($I`InvalidPandocDocument`)(
  "invalid",
  {
    checkedInvariantIds: PandocCheckedInvariantIds,
    issues: S.Array(PandocLosslessIssue),
    message: S.NonEmptyString,
    wire: S.optionalKey(PandocConformanceWire),
  },
  $I.annote("InvalidPandocDocument", {
    description: "Input that fails the Pandoc JSON envelope or a pinned current-constructor payload invariant.",
  })
) {}

/**
 * Exhaustive result of Pandoc JSON conformance inspection.
 *
 * **Details**
 *
 * `compatible` means the input is accepted by the pinned current semantic
 * grammar and strict encoding reproduces its exact JSON. `unsupported` keeps
 * valid future constructors or a non-canonical lossless wire explicit.
 * `invalid` identifies a malformed envelope or current-constructor payload.
 * No `normalizable` case exists because this package declares no semantics-
 * preserving canonical rewrite.
 *
 * **Example** (Match every conformance outcome)
 *
 * ```ts import.meta.vitest name="Match every conformance outcome"
 * import { Effect } from "effect"
 * import { inspectPandocConformance, PandocConformanceResult } from "@beep/pandoc-ast/Pandoc.conformance"
 *
 * const result = Effect.runSync(inspectPandocConformance(null))
 * const status = PandocConformanceResult.match(result, {
 *   compatible: () => "compatible",
 *   unsupported: () => "unsupported",
 *   invalid: () => "invalid",
 * })
 * status // => "invalid"
 * ```
 *
 * @invariant Every input is classified into exactly one exhaustive result case.
 * @invariant `compatible` values are exact fixed points of strict decode followed by encode.
 * @see [Pandoc JSON AST types](https://github.com/jgm/pandoc-types/blob/8e064fa71e4448397165608beeffa9e6833cc373/src/Text/Pandoc/Definition.hs)
 * @see [Pandoc JSON filters](https://pandoc.org/MANUAL.html#json-filters)
 * @category diagnostics
 * @since 0.0.0
 */
export const PandocConformanceResult = S.Union([
  CompatiblePandocDocument,
  UnsupportedPandocDocument,
  InvalidPandocDocument,
]).pipe(
  Conformance.annotateConformance(PandocJsonConformanceAnnotation),
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("PandocConformanceResult", {
    description: "Exhaustive compatible, unsupported, or invalid Pandoc JSON classification.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime result represented by {@link PandocConformanceResult}.
 *
 * @see {@link PandocConformanceResult} for constructors, guards, and exhaustive matching.
 * @category diagnostics
 * @since 0.0.0
 */
export type PandocConformanceResult = typeof PandocConformanceResult.Type;

type JsonRecord = Readonly<Record<string, S.Json>>;

const isJsonArray = (value: S.Json): value is ReadonlyArray<S.Json> => A.isArray(value);

const isJsonRecord = (value: S.Json): value is JsonRecord =>
  P.isObject(value) && !P.isNull(value) && !isJsonArray(value);

const decodeConstructorOption = S.decodeUnknownOption(PandocConstructorWire);

const collectFutureConstructorNames = (value: S.Json): ReadonlyArray<string> =>
  O.match(decodeConstructorOption(value), {
    onNone: () =>
      isJsonArray(value)
        ? A.flatMap(value, collectFutureConstructorNames)
        : isJsonRecord(value)
          ? A.flatMap(R.values(value), collectFutureConstructorNames)
          : A.emptyReadonly<string>(),
    onSome: (constructor) =>
      isPandocKnownConstructorName(constructor.t)
        ? O.match(O.fromNullishOr(constructor.c), {
            onNone: () => A.emptyReadonly<string>(),
            onSome: collectFutureConstructorNames,
          })
        : [constructor.t],
  });

const jsonEquivalence = S.toEquivalence(S.Json);
const encodeWire = S.encodeSync(PandocJsonWire);

const invalidResult = (
  message: string,
  issues: ReadonlyArray<PandocLosslessIssue>,
  wire?: Readonly<Record<string, S.Json>>
): PandocConformanceResult =>
  PandocConformanceResult.cases.invalid.make({
    checkedInvariantIds,
    issues,
    message,
    ...(wire === undefined ? {} : { wire }),
  });

/**
 * Classify unknown input against lossless and strict Pandoc JSON boundaries.
 *
 * **Example** (Recognize a future constructor)
 *
 * ```ts import.meta.vitest name="Recognize a future constructor"
 * import { Effect } from "effect"
 * import { inspectPandocConformance } from "@beep/pandoc-ast/Pandoc.conformance"
 *
 * const result = Effect.runSync(inspectPandocConformance({
 *   "pandoc-api-version": [1, 23, 1],
 *   blocks: [{ t: "FutureBlock", c: { exact: true } }],
 *   meta: {},
 * }))
 * result._tag // => "unsupported"
 * ```
 *
 * @param input - Unknown Pandoc JSON input to classify without discarding valid future wire.
 * @returns An infallible effect containing one exhaustive conformance result.
 * @invariant Malformed pinned constructors are `invalid`; unknown future constructors are `unsupported`.
 * @invariant Raw inline and block format/text pairs survive strict round trips byte-for-byte.
 * @invariant `ColWidth` requires a finite numeric payload while `ColWidthDefault` remains nullary.
 * @see [Pandoc 1.23.1 inline and block constructors](https://github.com/jgm/pandoc-types/blob/8e064fa71e4448397165608beeffa9e6833cc373/src/Text/Pandoc/Definition.hs#L250-L355)
 * @category validation
 * @since 0.0.0
 */
export const inspectPandocConformance = (input: unknown): Effect.Effect<PandocConformanceResult> =>
  decodePandocJsonLossless(input).pipe(
    Effect.flatMap((lossless) => {
      const issues = lossless.issues;
      if (A.isReadonlyArrayNonEmpty(issues)) {
        return Effect.succeed(
          invalidResult("Pandoc JSON contains malformed pinned constructor payloads.", issues, lossless.wire)
        );
      }

      return decodePandocJsonStrict(lossless.wire).pipe(
        Effect.flatMap((document) =>
          encodePandocJson(document).pipe(
            Effect.map((encoded) => {
              const futureConstructors = A.dedupe(collectFutureConstructorNames(lossless.wire));
              const futureIssues = A.map(futureConstructors, (constructor) =>
                PandocConformanceIssue.cases.futureConstructor.make({ constructor })
              );
              const conformanceIssues = jsonEquivalence(lossless.wire, encodeWire(encoded))
                ? futureIssues
                : A.append(
                    futureIssues,
                    PandocConformanceIssue.cases.nonCanonicalWire.make({
                      message: "Strict semantic encoding does not reproduce the retained Pandoc JSON exactly.",
                    })
                  );

              return A.isReadonlyArrayNonEmpty(conformanceIssues)
                ? PandocConformanceResult.cases.unsupported.make({
                    checkedInvariantIds,
                    document,
                    issues: conformanceIssues,
                    wire: lossless.wire,
                  })
                : PandocConformanceResult.cases.compatible.make({
                    checkedInvariantIds,
                    document,
                    wire: lossless.wire,
                  });
            })
          )
        ),
        Effect.catch((error) => Effect.succeed(invalidResult(error.message, issues, lossless.wire)))
      );
    }),
    Effect.catch((error) => Effect.succeed(invalidResult(error.message, A.emptyReadonly())))
  );
