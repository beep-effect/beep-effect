/**
 * Structural invariants consumed by the private HTML conformance registry.
 *
 * @packageDocumentation
 * @internal
 * @since 0.0.0
 */

import type * as Conformance from "@beep/schema/Conformance";

const defineInvariants = <const Invariants extends (typeof Conformance.Annotation.Encoded)["invariants"]>(
  invariants: Invariants
): Invariants => invariants;

/**
 * Inventory, AST, element, heading, document, and content-model invariants.
 *
 * @internal
 * @category specifications
 * @since 0.0.0
 */
export const HtmlConformanceStructureInvariants = defineInvariants([
  {
    id: "html.inventory.generated-elements",
    title: "Generated element inventory is exhaustive for the current vendored index",
    statement:
      "The current model exposes 142 generated HTML element members, including 29 obsolete members, with stable literal tags.",
    strength: "must",
    scope: "node",
    decidability: "typeLevel",
    enforcement: [
      {
        kind: "typeLevel",
        mechanism: "@beep/html exported schema type for html.inventory.generated-elements",
      },
      {
        kind: "runtime",
        validator: "HtmlNode",
      },
      {
        kind: "test",
        suite: "test/Html.test.ts",
        oracle: "Pinned source rule and package expectation for html.inventory.generated-elements",
      },
    ],
    references: [
      {
        sourceId: "html-webref-dfns-current-local",
        section: "dfns",
      },
    ],
    testIds: [
      "test/Html.test.ts#covers-every-WHATWG-element-from-the-pinned-dataset-conforming-obsolete",
      "test/Html.test.ts#rejects-tags-outside-the-generated-HtmlNode-inventory",
    ],
  },
  {
    id: "html.inventory.approved-refresh-drift",
    title: "Approved source refresh is not yet the consumed generator corpus",
    statement:
      "Conformance against the approved WHATWG and webref refresh cannot be claimed until the approved bytes are vendored, regenerated, and reviewed; the model currently consumes older webref and dated derived-index bytes.",
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
        sourceId: "html-whatwg-source-approved",
        section: "elements",
      },
      {
        sourceId: "html-webref-dfns-approved-target",
        section: "dfns",
      },
      {
        sourceId: "html-webref-dfns-current-local",
        section: "dfns",
      },
    ],
    testIds: [],
  },
  {
    id: "html.ast.literal-tag-discrimination",
    title: "Every public node variant has a stable literal discriminator",
    statement:
      "Generated elements and auxiliary nodes use literal _tag values and existing public unions are exhaustively discriminated by _tag.",
    strength: "must",
    scope: "node",
    decidability: "typeLevel",
    enforcement: [
      {
        kind: "typeLevel",
        mechanism: "@beep/html exported schema type for html.ast.literal-tag-discrimination",
      },
      {
        kind: "runtime",
        validator: "HtmlNode",
      },
      {
        kind: "test",
        suite: "test/Html.test.ts, test/Html.coverage-matrix.test.ts",
        oracle: "Pinned source rule and package expectation for html.ast.literal-tag-discrimination",
      },
    ],
    references: [
      {
        sourceId: "html-webref-dfns-current-local",
        section: "dfns",
      },
    ],
    testIds: [
      "test/Html.test.ts#round-trips-schema-derived-HTML-AST-schemas",
      "test/Html.coverage-matrix.test.ts#fails-malformed-JavaScript-callers-at-the-schema-snapshot-boundary",
    ],
  },
  {
    id: "html.element.local-content-model",
    title: "Element-local child schemas should reject impossible child categories",
    statement:
      "Most generated element classes currently admit broad HtmlChildren at type and decode boundaries; content categories and contextual grammars are applied later by inspectConformance.",
    strength: "must",
    scope: "children",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "inspectConformance",
      },
      {
        kind: "test",
        suite: "test/Html.coverage-matrix.test.ts, test/Html.security.test.ts",
        oracle: "Pinned source rule and package expectation for html.element.local-content-model",
      },
    ],
    references: [
      {
        sourceId: "html-whatwg-source-approved",
        section: "content-models",
      },
      {
        sourceId: "html-whatwg-content-model-current-local",
        section: "elements-3",
      },
      {
        sourceId: "html-classification-current-local",
        section: "specialChildGrammars",
      },
    ],
    testIds: [
      "test/Html.coverage-matrix.test.ts#allows-and-rejects-foreign-text-children-according-to-the-generated-content-tokens",
      "test/Html.security.test.ts#enforces-table-child-sequence-and-cardinality",
    ],
  },
  {
    id: "html.heading.phrasing-children",
    title: "Heading elements must contain only permitted phrasing content",
    statement:
      "H1 through H6 retain broad HtmlChildren at the local schema boundary, while inspectConformance rejects heading descendants and non-phrasing flow children through the generated phrasing-only content model.",
    strength: "must",
    scope: "children",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "inspectConformance",
      },
      {
        kind: "test",
        suite: "test/Html.heading-conformance.test.ts",
        oracle: "Pinned source rule and package expectation for html.heading.phrasing-children",
      },
    ],
    references: [
      {
        sourceId: "html-whatwg-source-approved",
        section: "the-h1,-h2,-h3,-h4,-h5,-and-h6-elements",
      },
    ],
    testIds: [
      "test/Html.heading-conformance.test.ts#rejects-heading-descendants-because-heading-content-is-phrasing-only",
      "test/Html.heading-conformance.test.ts#rejects-non-phrasing-flow-children-in-headings",
    ],
  },
  {
    id: "html.heading.computed-levels",
    title: "Computed heading levels must apply offsets, reset boundaries, and the level-nine cap",
    statement:
      "computeHeadingOutline applies inherited headingoffset values, resets the inherited offset at headingreset boundaries, and caps computed heading levels at nine.",
    strength: "must",
    scope: "subtree",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "computeHeadingOutline",
      },
      {
        kind: "test",
        suite: "test/Html.heading-conformance.test.ts",
        oracle: "Pinned source rule and package expectation for html.heading.computed-levels",
      },
    ],
    references: [
      {
        sourceId: "html-whatwg-source-approved",
        section: "heading-levels-and-offsets",
      },
    ],
    testIds: [
      "test/Html.heading-conformance.test.ts#applies-ancestor-offsets-and-reset-boundaries",
      "test/Html.heading-conformance.test.ts#caps-computed-heading-levels-at-nine",
      "test/Html.heading-conformance.test.ts#rejects-an-offset-induced-skipped-computed-heading-level",
    ],
  },
  {
    id: "html.heading.no-skipped-levels",
    title: "A computed heading level must be at most one greater than the preceding heading level",
    statement:
      "inspectConformance emits a headingOutline error when a heading following another in tree order has a computed level greater than the preceding heading's level plus one.",
    strength: "must",
    scope: "document",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "inspectConformance",
      },
      {
        kind: "test",
        suite: "test/Html.heading-conformance.test.ts",
        oracle: "Pinned source rule and package expectation for html.heading.no-skipped-levels",
      },
    ],
    references: [
      {
        sourceId: "html-whatwg-source-approved",
        section: "headings-and-outlines",
      },
    ],
    testIds: [
      "test/Html.heading-conformance.test.ts#rejects-a-skipped-computed-heading-level-in-tree-order",
      "test/Html.heading-conformance.test.ts#rejects-an-offset-induced-skipped-computed-heading-level",
    ],
  },
  {
    id: "html.heading.level-one-advisory",
    title: "A heading outline should contain at least one computed level-one heading",
    statement:
      "Missing computed level-one headings do not fail inspectConformance; inspectBestPractices reports the separate headingLevelOne advisory.",
    strength: "should",
    scope: "document",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "inspectBestPractices",
      },
      {
        kind: "test",
        suite: "test/Html.heading-conformance.test.ts",
        oracle: "Pinned source rule and package expectation for html.heading.level-one-advisory",
      },
    ],
    references: [
      {
        sourceId: "html-whatwg-source-approved",
        section: "headings-and-outlines",
      },
    ],
    testIds: ["test/Html.heading-conformance.test.ts#keeps-the-level-one-recommendation-advisory"],
  },
  {
    id: "html.document.structure",
    title: "A canonical HTML document has valid doctype and document-element structure",
    statement:
      "The canonical document boundary narrows direct children, while conform checks doctype placement, document element cardinality, and root placement.",
    strength: "must",
    scope: "document",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "typeLevel",
        mechanism: "@beep/html exported schema type for html.document.structure",
      },
      {
        kind: "runtime",
        validator: "HtmlDocument",
      },
      {
        kind: "runtime",
        validator: "inspectConformance",
      },
      {
        kind: "test",
        suite: "test/Html.coverage-matrix.test.ts",
        oracle: "Pinned source rule and package expectation for html.document.structure",
      },
    ],
    references: [
      {
        sourceId: "html-whatwg-source-approved",
        section: "the-html-element",
      },
      {
        sourceId: "html-whatwg-source-approved",
        section: "the-doctype",
      },
    ],
    testIds: [
      "test/Html.coverage-matrix.test.ts#serializes-optional-and-canonical-doctypes-and-rejects-every-noncanonical-component",
      "test/Html.coverage-matrix.test.ts#locates-every-document-doctype-and-root-placement-failure",
    ],
  },
  {
    id: "html.content.special-child-grammars",
    title: "Context-sensitive element child sequences must satisfy reviewed grammars",
    statement:
      "The generated conformance registry applies reviewed child-sequence and contextual grammars that cannot be represented by one local array schema.",
    strength: "must",
    scope: "value",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "inspectConformance",
      },
      {
        kind: "test",
        suite: "test/Html.conformance-hardening.test.ts, test/Html.security.test.ts",
        oracle: "Pinned source rule and package expectation for html.content.special-child-grammars",
      },
    ],
    references: [
      {
        sourceId: "html-whatwg-source-approved",
        section: "elements",
      },
      {
        sourceId: "html-classification-current-local",
        section: "specialChildGrammars",
      },
    ],
    testIds: [
      "test/Html.conformance-hardening.test.ts#keeps-schema-generated-valid-grammar-fixtures-free-of-grammar-issues",
      "test/Html.security.test.ts#enforces-table-child-sequence-and-cardinality",
      "test/Html.conformance-hardening.test.ts#enforces-edge-conditional-media-and-alternative-grammars",
    ],
  },
]);
