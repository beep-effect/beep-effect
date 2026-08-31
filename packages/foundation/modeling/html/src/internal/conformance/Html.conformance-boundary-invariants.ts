/**
 * Boundary invariants consumed by the private HTML conformance registry.
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
 * Serialization, obsolescence, traceability, parser, and custom-element boundary invariants.
 *
 * @internal
 * @category specifications
 * @since 0.0.0
 */
export const HtmlConformanceBoundaryInvariants = defineInvariants([
  {
    id: "html.serialization.text-modes",
    title: "Text, comment, raw-text, RCDATA, plaintext, and void serialization must be deterministic and safe",
    statement:
      "Serialization applies context-specific escaping, deterministic attribute order, void handling, and raw end-tag hazard checks.",
    strength: "must",
    scope: "serialization",
    decidability: "localRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "serialize",
      },
      {
        kind: "test",
        suite: "test/Html.security.test.ts",
        oracle: "Pinned source rule and package expectation for html.serialization.text-modes",
      },
    ],
    references: [
      {
        sourceId: "html-whatwg-source-approved",
        section: "serializing-html-fragments",
      },
      {
        sourceId: "html-classification-current-local",
        section: "rawText",
      },
      {
        sourceId: "html-classification-current-local",
        section: "rcData",
      },
      {
        sourceId: "html-classification-current-local",
        section: "plaintext",
      },
      {
        sourceId: "html-classification-current-local",
        section: "void",
      },
    ],
    testIds: [
      "test/Html.security.test.ts#escapes-text-and-attributes-and-emits-deterministic-attribute-order",
      "test/Html.security.test.ts#rejects-scalar-hazards-ambiguous-comments-raw-end-tags-and-plaintext",
    ],
  },
  {
    id: "html.obsolete.nonconforming-elements",
    title: "Obsolete elements must remain losslessly decodable but be reported as non-conforming",
    statement:
      "The broad AST retains obsolete element wires for compatibility, while conformance metadata marks them non-conforming.",
    strength: "must",
    scope: "value",
    decidability: "localRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "inspectConformance",
      },
      {
        kind: "test",
        suite: "test/Html.coverage-matrix.test.ts",
        oracle: "Pinned source rule and package expectation for html.obsolete.nonconforming-elements",
      },
    ],
    references: [
      {
        sourceId: "html-webref-dfns-current-local",
        section: "obsolete",
      },
      {
        sourceId: "html-obsolete-interfaces-current-local",
        section: "interfaces",
      },
    ],
    testIds: [
      "test/Html.coverage-matrix.test.ts#covers-picture-datalist-select-ruby-and-obsolete-element-alternatives",
      "test/Html.coverage-matrix.test.ts#rejects-obsolete-elements-at-the-inspectConformance-boundary",
    ],
  },
  {
    id: "html.spec.per-rule-traceability",
    title: "Every generated or reviewed rule should cite an immutable source anchor",
    statement:
      "Current reviewed classification entries and generated element docs do not carry stable per-rule source IDs and anchors, so exhaustive semantic traceability is not yet proven.",
    strength: "should",
    scope: "value",
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
        section: "source",
      },
      {
        sourceId: "html-classification-current-local",
        section: "conformanceRules",
      },
    ],
    testIds: [],
  },
  {
    id: "html.parser.tree-construction",
    title: "HTML source parsing and browser tree repair are outside the AST profile",
    statement:
      "The package validates already-constructed AST values and does not claim to tokenize arbitrary HTML source or reproduce browser error recovery.",
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
        sourceId: "html-whatwg-source-approved",
        section: "parsing",
      },
    ],
    testIds: [],
  },
  {
    id: "html.custom-elements.open-world",
    title: "Arbitrary custom elements are outside the generated standard-element union",
    statement:
      "HtmlNode is exhaustive for the pinned standard and obsolete element inventory; arbitrary autonomous custom HTML element classes are not modeled as first-class generated members.",
    strength: "may",
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
        sourceId: "html-whatwg-source-approved",
        section: "custom-elements",
      },
    ],
    testIds: [],
  },
]);
