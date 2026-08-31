/**
 * Exhaustive conformance classification for lossless Lexical editor-state wire.
 *
 * @packageDocumentation \@beep/lexical-schema/Lexical.conformance
 * @since 0.0.0
 */

import { $LexicalSchemaId } from "@beep/identity/packages";
import * as Conformance from "@beep/schema/Conformance";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { Option as O, Result } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import {
  analyzeEditorStateCompatibilityResult,
  LexicalCompatibilityIssue,
  SerializedEditorState,
  SerializedEditorStateWire,
} from "./Lexical.model.ts";

const $I = $LexicalSchemaId.create("Lexical.conformance");

const BeepLexicalConformanceAnnotation = {
  sources: [
    {
      id: "lexical-source-0.49.0",
      title: "Lexical v0.49.0 source commit tarball",
      role: "primarySpecification",
      canonicalUrl: "https://github.com/facebook/lexical/archive/ffe90924bd55b5d450c88de0f9f1c8b228c4a221.tar.gz",
      revision: {
        kind: "gitCommit",
        repository: "https://github.com/facebook/lexical",
        commit: "ffe90924bd55b5d450c88de0f9f1c8b228c4a221",
      },
      contentSha256: "c9a1e68fef4ed36a821083e5c24936ec49e03c53f99fdd094804b55f664ae67b",
      license: "MIT",
      scope:
        "Approved upstream source pin for serialized node shapes and runtime behavior; the tarball is not yet vendored as a package corpus. Consumed anchors: packages/lexical/src, packages/lexical-list/src, packages/lexical-table/src.",
    },
    {
      id: "lexical-nodes-docs-2026-08-30",
      title: "Lexical nodes concepts",
      role: "bestPractice",
      canonicalUrl: "https://lexical.dev/docs/concepts/nodes",
      revision: {
        kind: "retrievedSnapshot",
        retrievedOn: "2026-08-30",
      },
      contentSha256: "d0ad375abbfd81dcd1d3a7fd2c33b9a713ca4900902cb7938c699a18a890c524",
      license: "MIT",
      scope:
        "Informative explanation of node properties, serialization, NodeState, element children, and node replacement; not normative authority. Consumed anchors: node-properties, node-properties-and-serialization, node-state.",
    },
    {
      id: "lexical-npm-0.49.0",
      title: "lexical 0.49.0 npm artifact",
      role: "implementationReference",
      canonicalUrl: "https://registry.npmjs.org/lexical/-/lexical-0.49.0.tgz",
      revision: {
        kind: "release",
        version: "0.49.0",
      },
      contentSha256: "94af126c54427e80c88aac2051947921b45f7f036dbbfb94b5730ab38066bbe4",
      license: "MIT",
      scope:
        "Development-only real-runtime compatibility oracle; it is not a normative specification. Consumed anchors: package.",
    },
    {
      id: "lexical-list-npm-0.49.0",
      title: "@lexical/list 0.49.0 npm artifact",
      role: "implementationReference",
      canonicalUrl: "https://registry.npmjs.org/@lexical/list/-/list-0.49.0.tgz",
      revision: {
        kind: "release",
        version: "0.49.0",
      },
      contentSha256: "da6a019b5b9cfb6fa3f8bdd72ae06171fb30701a2592f823e668156362ceea10",
      license: "MIT",
      scope:
        "Development-only list serialization and normalization oracle; it is not a normative specification. Consumed anchors: package.",
    },
    {
      id: "lexical-table-npm-0.49.0",
      title: "@lexical/table 0.49.0 npm artifact",
      role: "implementationReference",
      canonicalUrl: "https://registry.npmjs.org/@lexical/table/-/table-0.49.0.tgz",
      revision: {
        kind: "release",
        version: "0.49.0",
      },
      contentSha256: "12107c51d850578ccd5e48776a1969e8912b6feb8f88f83aa8726f0d2b70006a",
      license: "MIT",
      scope:
        "Development-only table serialized-shape oracle; it is not a normative specification. Consumed anchors: package.",
    },
    {
      id: "lexical-beep-v1-baseline",
      title: "Beep strict and lossless Lexical v1 profile baseline",
      role: "implementationReference",
      canonicalUrl:
        "https://github.com/beep-effect/beep-effect/blob/1ed08f66df016a18c6d7d56bd97aa778912cb37b/packages/foundation/modeling/lexical/src/Lexical.model.ts",
      revision: {
        kind: "gitCommit",
        repository: "https://github.com/beep-effect/beep-effect",
        commit: "1ed08f66df016a18c6d7d56bd97aa778912cb37b",
      },
      contentSha256: "ed06366dc1263a30b375b4001c1d7aecfa5385e211a337b96c8ecc96224da0e3",
      license: "MIT",
      scope:
        "Immutable public pre-initiative package-owned baseline for the persisted-state contract, strict tree grammar, open lossless wire, and compatibility analysis. Consumed anchors: LexicalNode, SerializedEditorState, SerializedEditorStateWire.",
    },
  ],
  profiles: [
    {
      id: "beep-lexical-v1",
      title: "Beep strict and lossless Lexical v1",
      version: "1",
      description:
        "Package-owned strict semantic tree, open lossless wire, exhaustive boundary classification, and Markdown adapter profile.",
      sourceIds: [
        "lexical-source-0.49.0",
        "lexical-nodes-docs-2026-08-30",
        "lexical-npm-0.49.0",
        "lexical-list-npm-0.49.0",
        "lexical-table-npm-0.49.0",
        "lexical-beep-v1-baseline",
      ],
      invariantIds: [
        "lexical.ast.type-discrimination",
        "lexical.node.version-one",
        "lexical.strict.closed-objects",
        "lexical.lossless.open-wire",
        "lexical.strict.future-node-reporting",
        "lexical.tree.parent-child-grammar",
        "lexical.root.nonempty",
        "lexical.heading.tag-domain",
        "lexical.list.metadata-consistency",
        "lexical.table.structure",
        "lexical.text.format-bitmasks",
        "lexical.node-state.json-only",
        "lexical.safe.urls-and-styles",
        "lexical.nullish.option-boundary",
        "lexical.adapter.md-core-identity",
        "lexical.adapter.lossiness-reporting",
      ],
    },
  ],
  invariants: [
    {
      id: "lexical.ast.type-discrimination",
      title: "Supported semantic nodes must be exhaustively discriminated by type",
      statement: "The strict v1 node union has 16 literal type members and exposes exhaustive matching helpers.",
      strength: "must",
      scope: "node",
      decidability: "typeLevel",
      enforcement: [
        {
          kind: "typeLevel",
          mechanism: "@beep/lexical-schema exported schema type for lexical.ast.type-discrimination",
        },
        {
          kind: "runtime",
          validator: "@beep/lexical-schema Effect Schema decode boundary for lexical.ast.type-discrimination",
        },
        {
          kind: "test",
          suite: "test/Lexical.model.test.ts",
          oracle: "Pinned source rule and package expectation for lexical.ast.type-discrimination",
        },
      ],
      references: [
        {
          sourceId: "lexical-source-0.49.0",
          section: "packages/lexical/src",
        },
        {
          sourceId: "lexical-beep-v1-baseline",
          section: "LexicalNode",
        },
      ],
      testIds: [
        "test/Lexical.model.test.ts#round-trips-schema-derived-arbitrary-nodes-through-encode-decode",
        "test/Lexical.model.test.ts#rejects-nodes-outside-the-v1-union",
      ],
    },
    {
      id: "lexical.node.version-one",
      title: "Supported built-in nodes must use serialized node version one",
      statement:
        "LexicalNodeVersion is the literal wire value 1 for every supported strict node; this is distinct from npm package version 0.49.0.",
      strength: "must",
      scope: "node",
      decidability: "typeLevel",
      enforcement: [
        {
          kind: "typeLevel",
          mechanism: "@beep/lexical-schema exported schema type for lexical.node.version-one",
        },
        {
          kind: "runtime",
          validator: "@beep/lexical-schema Effect Schema decode boundary for lexical.node.version-one",
        },
        {
          kind: "test",
          suite: "test/Lexical.model.test.ts",
          oracle: "Pinned source rule and package expectation for lexical.node.version-one",
        },
      ],
      references: [
        {
          sourceId: "lexical-source-0.49.0",
          section: "node-serialization",
        },
        {
          sourceId: "lexical-beep-v1-baseline",
          section: "LexicalNode",
        },
      ],
      testIds: [
        "test/Lexical.model.test.ts#decodes-the-fixture-editor-state-and-captures-nullish-wire-values-as-Options",
        "test/Lexical.model.test.ts#rejects-impossible-serialized-formatting-and-structural-values",
      ],
    },
    {
      id: "lexical.strict.closed-objects",
      title: "Strict semantic decoding must reject excess fields",
      statement: "Every strict surface rejects excess properties rather than silently discarding them.",
      strength: "must",
      scope: "node",
      decidability: "localRuntime",
      enforcement: [
        {
          kind: "runtime",
          validator: "@beep/lexical-schema Effect Schema decode boundary for lexical.strict.closed-objects",
        },
        {
          kind: "test",
          suite: "test/Lexical.model.test.ts",
          oracle: "Pinned source rule and package expectation for lexical.strict.closed-objects",
        },
      ],
      references: [
        {
          sourceId: "lexical-beep-v1-baseline",
          section: "LexicalNode",
        },
        {
          sourceId: "lexical-beep-v1-baseline",
          section: "SerializedEditorState",
        },
      ],
      testIds: [
        "test/Lexical.model.test.ts#rejects-excess-fields-through-every-strict-surface-while-retaining-their-lossless-wire",
      ],
    },
    {
      id: "lexical.lossless.open-wire",
      title: "Lossless decoding must preserve future fields and nodes exactly",
      statement:
        "Open StructWithRest wire schemas retain envelope, root, node, version, NodeState, and future child fields without imposing the strict semantic grammar.",
      strength: "must",
      scope: "serialization",
      decidability: "localRuntime",
      enforcement: [
        {
          kind: "runtime",
          validator: "@beep/lexical-schema Effect Schema decode boundary for lexical.lossless.open-wire",
        },
        {
          kind: "test",
          suite: "test/Lexical.model.test.ts",
          oracle: "Pinned source rule and package expectation for lexical.lossless.open-wire",
        },
      ],
      references: [
        {
          sourceId: "lexical-nodes-docs-2026-08-30",
          section: "node-properties-and-serialization",
        },
        {
          sourceId: "lexical-nodes-docs-2026-08-30",
          section: "node-state",
        },
        {
          sourceId: "lexical-beep-v1-baseline",
          section: "SerializedEditorStateWire",
        },
      ],
      testIds: [
        "test/Lexical.model.test.ts#round-trips-arbitrary-open-wire-states-without-losing-extension-fields",
        "test/Lexical.model.test.ts#preserves-opaque-future-children-fields-without-imposing-semantic-child-grammar",
      ],
    },
    {
      id: "lexical.strict.future-node-reporting",
      title: "Future nodes must remain lossless and be reported as strict incompatibilities",
      statement:
        "Unknown future type strings remain in the lossless wire while compatibility analysis reports that strict semantic decoding cannot admit them.",
      strength: "must",
      scope: "value",
      decidability: "localRuntime",
      enforcement: [
        {
          kind: "runtime",
          validator: "@beep/lexical-schema Effect Schema decode boundary for lexical.strict.future-node-reporting",
        },
        {
          kind: "runtime",
          validator: "@beep/lexical-schema advisory inspector",
        },
        {
          kind: "test",
          suite: "test/Lexical.model.test.ts",
          oracle: "Pinned source rule and package expectation for lexical.strict.future-node-reporting",
        },
      ],
      references: [
        {
          sourceId: "lexical-source-0.49.0",
          section: "packages/lexical/src",
        },
        {
          sourceId: "lexical-beep-v1-baseline",
          section: "SerializedEditorStateWire",
        },
      ],
      testIds: [
        "test/Lexical.model.test.ts#preserves-future-JSON-wire-extensions-and-reports-strict-incompatibility",
        "test/Lexical.model.test.ts#rejects-nodes-outside-the-v1-union",
      ],
    },
    {
      id: "lexical.tree.parent-child-grammar",
      title: "Nodes must occur only beneath compatible parents",
      statement:
        "The public LexicalNode schema applies a recursive grammar after structural union decoding and rejects invalid root, table, list, link, code, and leaf placement.",
      strength: "must",
      scope: "subtree",
      decidability: "contextualRuntime",
      enforcement: [
        {
          kind: "runtime",
          validator: "@beep/lexical-schema Effect Schema decode boundary for lexical.tree.parent-child-grammar",
        },
        {
          kind: "runtime",
          validator: "strict Lexical schema compatibility checks",
        },
        {
          kind: "test",
          suite: "test/Lexical.model.test.ts",
          oracle: "Pinned source rule and package expectation for lexical.tree.parent-child-grammar",
        },
      ],
      references: [
        {
          sourceId: "lexical-beep-v1-baseline",
          section: "LexicalNode",
        },
      ],
      testIds: [
        "test/Lexical.model.test.ts#enforces-the-strict-v1-child-grammar-on-the-established-semantic-schema",
        "test/Lexical.model.test.ts#enforces-recursive-child-placement-and-non-empty-roots-on-the-public-node-schema",
      ],
    },
    {
      id: "lexical.root.nonempty",
      title: "Strict editor roots must contain at least one editable child",
      statement:
        "Strict decoding rejects empty roots; lossless decoding preserves them and reports incompatibility, while Md projection canonicalizes an empty document to one paragraph.",
      strength: "must",
      scope: "subtree",
      decidability: "contextualRuntime",
      enforcement: [
        {
          kind: "runtime",
          validator: "@beep/lexical-schema Effect Schema decode boundary for lexical.root.nonempty",
        },
        {
          kind: "runtime",
          validator: "strict Lexical schema compatibility checks",
        },
        {
          kind: "test",
          suite: "test/Lexical.codec.test.ts, test/Lexical.model.test.ts",
          oracle: "Pinned source rule and package expectation for lexical.root.nonempty",
        },
      ],
      references: [
        {
          sourceId: "lexical-source-0.49.0",
          section: "packages/lexical/src",
        },
        {
          sourceId: "lexical-beep-v1-baseline",
          section: "SerializedEditorState",
        },
      ],
      testIds: [
        "test/Lexical.codec.test.ts#canonicalizes-an-empty-Md-document-to-one-runtime-editable-paragraph",
        "test/Lexical.model.test.ts#preserves-an-empty-root-losslessly-while-reporting-strict-incompatibility",
      ],
    },
    {
      id: "lexical.heading.tag-domain",
      title: "Heading tags must be h1 through h6",
      statement:
        "HeadingTag is a six-member literal domain and the Markdown adapter maps it to HeadingLevel without an open string escape hatch.",
      strength: "must",
      scope: "node",
      decidability: "localRuntime",
      enforcement: [
        {
          kind: "typeLevel",
          mechanism: "@beep/lexical-schema exported schema type for lexical.heading.tag-domain",
        },
        {
          kind: "runtime",
          validator: "@beep/lexical-schema Effect Schema decode boundary for lexical.heading.tag-domain",
        },
        {
          kind: "runtime",
          validator: "@beep/lexical-schema adapter boundary for lexical.heading.tag-domain",
        },
        {
          kind: "test",
          suite: "test/Lexical.codec.test.ts, test/Lexical.model.test.ts",
          oracle: "Pinned source rule and package expectation for lexical.heading.tag-domain",
        },
      ],
      references: [
        {
          sourceId: "lexical-source-0.49.0",
          section: "heading-node",
        },
        {
          sourceId: "lexical-beep-v1-baseline",
          section: "LexicalNode",
        },
      ],
      testIds: [
        "test/Lexical.codec.test.ts#round-trips-an-md-core-assistant-turn-Md-Lexical-Md-identity",
        "test/Lexical.model.test.ts#rejects-impossible-serialized-formatting-and-structural-values",
      ],
    },
    {
      id: "lexical.list.metadata-consistency",
      title: "List type, tag, start, and checked metadata must be mutually consistent",
      statement:
        "Strict schemas reject contradictory list metadata, normalize approved legacy starts, and test canonical metadata against the real @lexical/list runtime.",
      strength: "must",
      scope: "subtree",
      decidability: "contextualRuntime",
      enforcement: [
        {
          kind: "runtime",
          validator: "@beep/lexical-schema Effect Schema decode boundary for lexical.list.metadata-consistency",
        },
        {
          kind: "runtime",
          validator: "strict Lexical schema compatibility checks",
        },
        {
          kind: "runtime",
          validator: "@beep/lexical-schema adapter boundary for lexical.list.metadata-consistency",
        },
        {
          kind: "test",
          suite: "test/Lexical.model.test.ts",
          oracle: "Pinned source rule and package expectation for lexical.list.metadata-consistency",
        },
      ],
      references: [
        {
          sourceId: "lexical-source-0.49.0",
          section: "packages/lexical-list/src",
        },
        {
          sourceId: "lexical-list-npm-0.49.0",
          section: "package",
        },
      ],
      testIds: [
        "test/Lexical.model.test.ts#generates-only-runtime-canonical-list-metadata",
        "test/Lexical.model.test.ts#keeps-canonical-list-metadata-fixed-through-the-real-Lexical-runtime",
        "test/Lexical.model.test.ts#rejects-contradictory-list-metadata-strictly-while-retaining-the-exact-lossless-wire",
        "test/Lexical.model.test.ts#normalizes-legacy-serialized-list-starts-and-rejects-corrupt-item-zeros",
      ],
    },
    {
      id: "lexical.table.structure",
      title: "Tables must contain rows and rows must contain cells with valid spans and dimensions",
      statement:
        "The strict grammar enforces the table-to-row-to-cell hierarchy and schema domains constrain header state, spans, and dimensions.",
      strength: "must",
      scope: "subtree",
      decidability: "contextualRuntime",
      enforcement: [
        {
          kind: "typeLevel",
          mechanism: "@beep/lexical-schema exported schema type for lexical.table.structure",
        },
        {
          kind: "runtime",
          validator: "@beep/lexical-schema Effect Schema decode boundary for lexical.table.structure",
        },
        {
          kind: "runtime",
          validator: "strict Lexical schema compatibility checks",
        },
        {
          kind: "test",
          suite: "test/Lexical.model.test.ts",
          oracle: "Pinned source rule and package expectation for lexical.table.structure",
        },
      ],
      references: [
        {
          sourceId: "lexical-source-0.49.0",
          section: "packages/lexical-table/src",
        },
        {
          sourceId: "lexical-table-npm-0.49.0",
          section: "package",
        },
      ],
      testIds: [
        "test/Lexical.model.test.ts#round-trips-schema-derived-arbitrary-editor-states-through-encode-decode",
        "test/Lexical.model.test.ts#enforces-the-strict-v1-child-grammar-on-the-established-semantic-schema",
      ],
    },
    {
      id: "lexical.text.format-bitmasks",
      title: "Text format and detail masks must contain only supported bits",
      statement:
        "Named bit domains and aggregate masks reject unsupported or impossible formatting values while preserving valid combinations.",
      strength: "must",
      scope: "node",
      decidability: "typeLevel",
      enforcement: [
        {
          kind: "typeLevel",
          mechanism: "@beep/lexical-schema exported schema type for lexical.text.format-bitmasks",
        },
        {
          kind: "runtime",
          validator: "@beep/lexical-schema Effect Schema decode boundary for lexical.text.format-bitmasks",
        },
        {
          kind: "test",
          suite: "test/Lexical.model.test.ts",
          oracle: "Pinned source rule and package expectation for lexical.text.format-bitmasks",
        },
      ],
      references: [
        {
          sourceId: "lexical-source-0.49.0",
          section: "text-node",
        },
        {
          sourceId: "lexical-beep-v1-baseline",
          section: "LexicalNode",
        },
      ],
      testIds: ["test/Lexical.model.test.ts#rejects-impossible-serialized-formatting-and-structural-values"],
    },
    {
      id: "lexical.node-state.json-only",
      title: "Strict NodeState must be JSON-valued",
      statement:
        "Strict semantic admission rejects functions, symbols, bigint values, and other non-JSON data while the open JSON wire remains lossless.",
      strength: "must",
      scope: "node",
      decidability: "localRuntime",
      enforcement: [
        {
          kind: "runtime",
          validator: "@beep/lexical-schema Effect Schema decode boundary for lexical.node-state.json-only",
        },
        {
          kind: "test",
          suite: "test/Lexical.model.test.ts",
          oracle: "Pinned source rule and package expectation for lexical.node-state.json-only",
        },
      ],
      references: [
        {
          sourceId: "lexical-nodes-docs-2026-08-30",
          section: "node-state",
        },
        {
          sourceId: "lexical-beep-v1-baseline",
          section: "LexicalNode",
        },
      ],
      testIds: [
        "test/Lexical.model.test.ts#round-trips-through-the-JSON-string-codec",
        "test/Lexical.model.test.ts#requires-strict-NodeState-values-to-be-lossless-JSON",
      ],
    },
    {
      id: "lexical.safe.urls-and-styles",
      title: "Semantic links and inline styles must be normalized to safe fixed points",
      statement:
        "Schema boundaries sanitize untrusted URLs and restrict inline style values; semantic constructors reject values that bypass normalization.",
      strength: "must",
      scope: "node",
      decidability: "localRuntime",
      enforcement: [
        {
          kind: "runtime",
          validator: "@beep/lexical-schema Effect Schema decode boundary for lexical.safe.urls-and-styles",
        },
        {
          kind: "runtime",
          validator: "@beep/lexical-schema adapter boundary for lexical.safe.urls-and-styles",
        },
        {
          kind: "test",
          suite: "test/Lexical.model.test.ts",
          oracle: "Pinned source rule and package expectation for lexical.safe.urls-and-styles",
        },
      ],
      references: [
        {
          sourceId: "lexical-beep-v1-baseline",
          section: "LexicalNode",
        },
      ],
      testIds: [
        "test/Lexical.model.test.ts#sanitizes-link-URLs-at-the-schema-boundary-and-keeps-safe-URLs-fixed",
        "test/Lexical.model.test.ts#rejects-unsafe-values-passed-directly-to-semantic-node-constructors",
      ],
    },
    {
      id: "lexical.nullish.option-boundary",
      title: "Nullish serialized fields must decode to explicit Options without wire drift",
      statement:
        "Nullable or absent Lexical wire fields decode to Option and encode back without changing the supported fixture wire.",
      strength: "must",
      scope: "node",
      decidability: "localRuntime",
      enforcement: [
        {
          kind: "runtime",
          validator: "@beep/lexical-schema Effect Schema decode boundary for lexical.nullish.option-boundary",
        },
        {
          kind: "test",
          suite: "test/Lexical.model.test.ts",
          oracle: "Pinned source rule and package expectation for lexical.nullish.option-boundary",
        },
      ],
      references: [
        {
          sourceId: "lexical-source-0.49.0",
          section: "node-serialization",
        },
        {
          sourceId: "lexical-beep-v1-baseline",
          section: "SerializedEditorState",
        },
      ],
      testIds: [
        "test/Lexical.model.test.ts#decodes-the-fixture-editor-state-and-captures-nullish-wire-values-as-Options",
        "test/Lexical.model.test.ts#round-trips-the-fixture-through-decode-encode-without-wire-drift",
      ],
    },
    {
      id: "lexical.adapter.md-core-identity",
      title: "The supported Md-core slice should round-trip through Lexical",
      statement:
        "The supported assistant-turn slice preserves semantic Markdown identity, while out-of-profile constructs use explicit deterministic degradation.",
      strength: "should",
      scope: "conversion",
      decidability: "localRuntime",
      enforcement: [
        {
          kind: "runtime",
          validator: "@beep/lexical-schema adapter boundary for lexical.adapter.md-core-identity",
        },
        {
          kind: "test",
          suite: "test/Lexical.codec.test.ts",
          oracle: "Pinned source rule and package expectation for lexical.adapter.md-core-identity",
        },
      ],
      references: [
        {
          sourceId: "lexical-beep-v1-baseline",
          section: "LexicalNode",
        },
      ],
      testIds: [
        "test/Lexical.codec.test.ts#round-trips-an-md-core-assistant-turn-Md-Lexical-Md-identity",
        "test/Lexical.codec.test.ts#degrades-out-of-profile-Md-nodes-deterministically",
      ],
    },
    {
      id: "lexical.adapter.lossiness-reporting",
      title: "Every lossy or normalized Markdown conversion must be explicit",
      statement:
        "Table alignment, unsupported text bits, code metadata, multi-block quotes, and out-of-profile nodes are normalized or degraded through tested policy rather than silently reinterpreted.",
      strength: "must",
      scope: "conversion",
      decidability: "localRuntime",
      enforcement: [
        {
          kind: "runtime",
          validator: "@beep/lexical-schema adapter boundary for lexical.adapter.lossiness-reporting",
        },
        {
          kind: "runtime",
          validator: "@beep/lexical-schema advisory inspector",
        },
        {
          kind: "test",
          suite: "test/Lexical.codec.test.ts",
          oracle: "Pinned source rule and package expectation for lexical.adapter.lossiness-reporting",
        },
      ],
      references: [
        {
          sourceId: "lexical-beep-v1-baseline",
          section: "LexicalNode",
        },
      ],
      testIds: [
        "test/Lexical.codec.test.ts#stabilizes-after-one-Md-Lexical-Md-pass-lossy-codec-idempotent-on-its-stable-image",
        "test/Lexical.codec.test.ts#drops-Lexical-only-text-format-bits-underline-per-the-lossiness-profile",
        "test/Lexical.codec.test.ts#normalizes-multi-block-quotes-into-a-single-linebreak-separated-paragraph",
      ],
    },
  ],
} satisfies typeof Conformance.Annotation.Encoded;
const encodeEditorState = S.encodeSync(SerializedEditorState);
const decodeEditorStateWire = S.decodeUnknownSync(SerializedEditorStateWire);
const wireEquivalence = S.toEquivalence(SerializedEditorStateWire);

class CompatibleEditorState extends S.TaggedClass<CompatibleEditorState>($I`CompatibleEditorState`)(
  "compatible",
  {
    state: SerializedEditorState,
    wire: SerializedEditorStateWire,
  },
  $I.annote("CompatibleEditorState", {
    description: "Lossless Lexical wire already equal to its strict v1 semantic encoding.",
  })
) {}

class NormalizableEditorState extends S.TaggedClass<NormalizableEditorState>($I`NormalizableEditorState`)(
  "normalizable",
  {
    state: SerializedEditorState,
    wire: SerializedEditorStateWire,
    normalizedWire: SerializedEditorStateWire,
  },
  $I.annote("NormalizableEditorState", {
    description: "Lexical wire accepted by the strict model after a declared canonical normalization.",
  })
) {}

class UnsupportedEditorState extends S.TaggedClass<UnsupportedEditorState>($I`UnsupportedEditorState`)(
  "unsupported",
  {
    issues: S.NonEmptyArray(LexicalCompatibilityIssue),
    wire: SerializedEditorStateWire,
  },
  $I.annote("UnsupportedEditorState", {
    description: "Valid lossless Lexical JSON wire outside the package's supported strict semantic grammar.",
  })
) {}

class InvalidEditorState extends S.TaggedClass<InvalidEditorState>($I`InvalidEditorState`)(
  "invalid",
  {
    message: S.NonEmptyString,
  },
  $I.annote("InvalidEditorState", {
    description: "Input which is not valid lossless Lexical JSON editor-state wire.",
  })
) {}

/**
 * Exhaustive compatibility result for a Lexical editor-state boundary.
 *
 * **Details**
 *
 * `compatible` values are exact strict-v1 fixed points. `normalizable` values
 * are accepted after a declared schema normalization and retain both forms.
 * `unsupported` values remain lossless JSON but cannot enter the strict model.
 * `invalid` values do not satisfy even the lossless JSON-wire boundary.
 *
 * **Example** (Match every compatibility outcome)
 *
 * ```ts import.meta.vitest name="Match every compatibility outcome"
 * import { inspectEditorStateConformance, LexicalConformanceResult } from "@beep/lexical-schema/Lexical.conformance"
 *
 * const result = inspectEditorStateConformance({ root: null })
 * const status = LexicalConformanceResult.match(result, {
 *   compatible: () => "compatible",
 *   normalizable: () => "normalizable",
 *   unsupported: () => "unsupported",
 *   invalid: () => "invalid",
 * })
 * status // => "invalid"
 * ```
 *
 * @invariant Every input is classified into exactly one exhaustive result case.
 * @see [Lexical serialization and deserialization](https://lexical.dev/docs/concepts/serialization#lexical---html)
 * @category diagnostics
 * @since 0.0.0
 */
export const LexicalConformanceResult = S.Union([
  CompatibleEditorState,
  NormalizableEditorState,
  UnsupportedEditorState,
  InvalidEditorState,
]).pipe(
  Conformance.annotateConformance(BeepLexicalConformanceAnnotation),
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("LexicalConformanceResult", {
    description: "Exhaustive strict, normalizable, unsupported, or invalid Lexical editor-state classification.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime result represented by {@link LexicalConformanceResult}.
 *
 * @see {@link LexicalConformanceResult} for constructors, guards, and exhaustive matching.
 * @category diagnostics
 * @since 0.0.0
 */
export type LexicalConformanceResult = typeof LexicalConformanceResult.Type;

/**
 * Classify unknown input against the lossless and strict Lexical boundaries.
 *
 * **Example** (Recognize unsupported future wire)
 *
 * ```ts import.meta.vitest name="Recognize unsupported future wire"
 * import { inspectEditorStateConformance } from "@beep/lexical-schema/Lexical.conformance"
 *
 * const result = inspectEditorStateConformance({
 *   root: { type: "root", version: 9, children: [{ type: "future-node", version: 1 }] },
 * })
 * result._tag // => "unsupported"
 * ```
 *
 * @param input - Unknown editor-state input to classify without discarding lossless wire.
 * @returns One exhaustive conformance result with all recoverable representations retained.
 * @invariant Strictly accepted normalized values re-encode to `normalizedWire`.
 * @see [Lexical node serialization](https://lexical.dev/docs/concepts/serialization#lexicalnodeexportjson)
 * @category validation
 * @since 0.0.0
 */
export const inspectEditorStateConformance = (input: unknown): LexicalConformanceResult =>
  Result.match(analyzeEditorStateCompatibilityResult(input), {
    onFailure: ({ message }) => LexicalConformanceResult.cases.invalid.make({ message }),
    onSuccess: ({ issues, state, wire }) =>
      O.match(state, {
        onNone: () => {
          const unsupportedIssues = A.isReadonlyArrayNonEmpty(issues)
            ? issues
            : A.of(LexicalCompatibilityIssue.make({ message: "Strict semantic state is unavailable." }));
          return LexicalConformanceResult.cases.unsupported.make({ issues: unsupportedIssues, wire });
        },
        onSome: (strictState) => {
          const normalizedWire = decodeEditorStateWire(encodeEditorState(strictState));
          return wireEquivalence(wire, normalizedWire)
            ? LexicalConformanceResult.cases.compatible.make({ state: strictState, wire })
            : LexicalConformanceResult.cases.normalizable.make({
                state: strictState,
                wire,
                normalizedWire,
              });
        },
      }),
  });
