/**
 * Authoring invariants consumed by the private HTML conformance registry.
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
 * Attribute, input, script, microsyntax, reference, responsive, and foreign-content invariants.
 *
 * @internal
 * @category specifications
 * @since 0.0.0
 */
export const HtmlConformanceAuthoringInvariants = defineInvariants([
  {
    id: "html.attributes.conditional-requirements",
    title: "Conditional required, forbidden, and value-constrained attributes must be enforced",
    statement:
      "Generated schemas enforce local value domains and inspectConformance enforces contextual attribute requirements and exclusions.",
    strength: "must",
    scope: "attributes",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "inspectConformance",
      },
      {
        kind: "test",
        suite: "test/Html.generator.test.ts, test/Html.conformance-hardening.test.ts",
        oracle: "Pinned source rule and package expectation for html.attributes.conditional-requirements",
      },
    ],
    references: [
      {
        sourceId: "html-whatwg-source-approved",
        section: "attributes",
      },
      {
        sourceId: "html-classification-current-local",
        section: "attributeRequirements",
      },
    ],
    testIds: [
      "test/Html.generator.test.ts#publishes-the-exact-required-and-tree-unique-attribute-profiles",
      "test/Html.conformance-hardening.test.ts#enforces-generated-base-map-and-track-attribute-laws",
      "test/Html.conformance-hardening.test.ts#enforces-link-addresses-and-the-meta-charset-mode",
    ],
  },
  {
    id: "html.attributes.input-state-applicability",
    title: "Input attributes must be valid for the effective input state",
    statement:
      "The current flat Input model decodes finite type values and the tree validator applies the reviewed 22-state attribute applicability table.",
    strength: "must",
    scope: "attributes",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "inspectConformance",
      },
      {
        kind: "test",
        suite: "test/Html.generator.test.ts, test/Html.conformance-hardening.test.ts",
        oracle: "Pinned source rule and package expectation for html.attributes.input-state-applicability",
      },
    ],
    references: [
      {
        sourceId: "html-webref-dfns-current-local",
        section: "input-type",
      },
      {
        sourceId: "html-classification-current-local",
        section: "inputAttributeApplicability",
      },
    ],
    testIds: [
      "test/Html.generator.test.ts#publishes-the-exact-attribute-conditional-category-profiles",
      "test/Html.conformance-hardening.test.ts#enforces-state-specific-input-and-effective-submit-button-attributes",
    ],
  },
  {
    id: "html.script.type-state",
    title: "Script type values must resolve to an author-conforming semantic state",
    statement:
      "ScriptState classifies missing, empty, JavaScript MIME essence-match, module, import-map, speculation-rules, and valid data-block type values while preserving Script.type; invalid non-special strings produce typed failures and conformance diagnostics.",
    strength: "must",
    scope: "attributes",
    decidability: "localRuntime",
    enforcement: [
      {
        kind: "typeLevel",
        mechanism: "@beep/html ScriptState and ScriptDataBlockMimeType schemas",
      },
      {
        kind: "runtime",
        validator: "resolveScriptState",
      },
      {
        kind: "runtime",
        validator: "inspectConformance",
      },
      {
        kind: "test",
        suite: "test/Html.script.test.ts",
        oracle: "Pinned WHATWG HTML and MIME Sniffing script type algorithms",
      },
    ],
    references: [
      {
        sourceId: "html-whatwg-source-approved",
        section: "attr-script-type",
      },
      {
        sourceId: "html-mimesniff-source-approved",
        section: "valid-mime-type",
      },
      {
        sourceId: "html-mimesniff-source-approved",
        section: "javascript-mime-type",
      },
    ],
    testIds: [
      "test/Html.script.test.ts#recognizes-the-exact-JavaScript-MIME-essence-registry-as-classic-script",
      "test/Html.script.test.ts#classifies-every-author-conforming-script-type-without-rewriting-its-wire",
      "test/Html.script.test.ts#returns-a-typed-failure-and-conformance-diagnostic-for-an-invalid-script-type",
      "test/Html.script.test.ts#enforces-script-MIME-correlations-at-compile-and-decode-boundaries",
      "test/Html.script.test.ts#exhaustively-matches-every-script-semantic-state",
      "test/Html.script.test.ts#round-trips-schema-derived-script-semantic-states",
    ],
  },
  {
    id: "html.script.attribute-applicability",
    title: "Script attributes must be valid for the effective type and inline or external context",
    statement:
      "inspectConformance exhaustively applies the WHATWG classic, module, import-map, speculation-rules, and data-block attribute matrix, including that src is limited to classic and module scripts and data blocks remain inline.",
    strength: "must",
    scope: "attributes",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "inspectConformance",
      },
      {
        kind: "test",
        suite: "test/Html.script.test.ts",
        oracle: "Pinned WHATWG script attribute applicability table",
      },
    ],
    references: [
      {
        sourceId: "html-whatwg-source-approved",
        section: "the-script-element",
      },
    ],
    testIds: [
      "test/Html.script.test.ts#accepts-the-contextual-script-attribute-matrix",
      "test/Html.script.test.ts#rejects-attributes-outside-the-contextual-script-matrix",
    ],
  },
  {
    id: "html.script.payload-language-validity",
    title: "Inline script payloads must conform to their selected language or data format",
    statement:
      "The AST retains script content losslessly, but the package does not parse JavaScript, module, import-map, speculation-rules, script-documentation, or arbitrary data-block MIME payload languages and therefore cannot establish their language-level validity.",
    strength: "must",
    scope: "children",
    decidability: "externalAuthority",
    enforcement: [
      {
        kind: "notEnforced",
        gap: "Payload-language conformance requires language-specific parsers or profile adapters that are outside the structural HTML AST validator.",
      },
    ],
    references: [
      {
        sourceId: "html-whatwg-source-approved",
        section: "restrictions-for-contents-of-script-elements",
      },
      {
        sourceId: "html-whatwg-source-approved",
        section: "attr-script-type",
      },
    ],
    testIds: [],
  },
  {
    id: "html.attributes.microsyntaxes",
    title: "Finite keywords, booleans, numbers, token lists, and case rules must decode canonically",
    statement:
      "Generated and hand-authored attribute schemas enforce finite keyword, presence-boolean, numeric, token-list, and ASCII-case fixed points where modeled.",
    strength: "must",
    scope: "attributes",
    decidability: "typeLevel",
    enforcement: [
      {
        kind: "typeLevel",
        mechanism: "@beep/html exported schema type for html.attributes.microsyntaxes",
      },
      {
        kind: "runtime",
        validator: "HtmlNode",
      },
      {
        kind: "test",
        suite: "test/Html.microsyntax.test.ts, test/Html.conformance-hardening.test.ts",
        oracle: "Pinned source rule and package expectation for html.attributes.microsyntaxes",
      },
    ],
    references: [
      {
        sourceId: "html-whatwg-source-approved",
        section: "common-microsyntaxes",
      },
      {
        sourceId: "html-classification-current-local",
        section: "attributeSyntaxes",
      },
    ],
    testIds: [
      "test/Html.microsyntax.test.ts#models-boolean-presence-without-a-false-value",
      "test/Html.microsyntax.test.ts#canonicalizes-encoded-enumerated-keywords-while-preserving-fixed-point-Types",
      "test/Html.conformance-hardening.test.ts#decodes-presence-booleans-blocking-tokens-and-exact-enumerations",
    ],
  },
  {
    id: "html.attributes.numeric-relationships",
    title: "Cross-attribute numeric relationships must hold",
    statement:
      "Generated relationship records enforce ordering, defaults, and bounded domains that span multiple attributes.",
    strength: "must",
    scope: "attributes",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "inspectConformance",
      },
      {
        kind: "test",
        suite: "test/Html.generator.test.ts, test/Html.conformance-hardening.test.ts",
        oracle: "Pinned source rule and package expectation for html.attributes.numeric-relationships",
      },
    ],
    references: [
      {
        sourceId: "html-whatwg-source-approved",
        section: "common-element-apis",
      },
      {
        sourceId: "html-classification-current-local",
        section: "numericAttributeRelationships",
      },
    ],
    testIds: [
      "test/Html.generator.test.ts#publishes-the-complete-generated-meter-and-progress-relationship-profiles",
      "test/Html.conformance-hardening.test.ts#enforces-generated-meter-and-progress-domains-and-relationships",
    ],
  },
  {
    id: "html.document.unique-ids-and-references",
    title: "IDs must be unique and constrained references must resolve in the required scope",
    statement:
      "The tree validator reports duplicate IDs and validates configured single and list ID references with case-sensitive scope rules.",
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
        suite: "test/Html.conformance-hardening.test.ts",
        oracle: "Pinned source rule and package expectation for html.document.unique-ids-and-references",
      },
    ],
    references: [
      {
        sourceId: "html-whatwg-source-approved",
        section: "the-id-attribute",
      },
      {
        sourceId: "html-classification-current-local",
        section: "idReferenceAttributes",
      },
      {
        sourceId: "html-classification-current-local",
        section: "idReferenceListAttributes",
      },
    ],
    testIds: [
      "test/Html.conformance-hardening.test.ts#reports-every-duplicate-id-occurrence-at-its-root-relative-attribute-path",
      "test/Html.conformance-hardening.test.ts#resolves-case-sensitive-id-references-in-the-same-root-and-nearest-table",
    ],
  },
  {
    id: "html.track.language-tags",
    title: "Subtitle track srclang values must use registered and structurally valid language tags",
    statement:
      "The generator verifies the IANA registry digest and emits the tables used by conditional srclang validation, including extlang prefix constraints.",
    strength: "must",
    scope: "attributes",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "inspectConformance",
      },
      {
        kind: "test",
        suite: "test/Html.conformance-hardening.test.ts",
        oracle: "Pinned source rule and package expectation for html.track.language-tags",
      },
    ],
    references: [
      {
        sourceId: "html-iana-language-subtag-registry-current-local",
        section: "File-Date",
      },
      {
        sourceId: "html-iana-language-subtag-registry-current-local",
        section: "RFC-5646-2.2.9",
      },
      {
        sourceId: "html-whatwg-source-approved",
        section: "the-track-element",
      },
    ],
    testIds: [
      "test/Html.conformance-hardening.test.ts#accepts-registered-grandfathered-private-use-extension-and-deprecated-tags",
      "test/Html.conformance-hardening.test.ts#rejects-malformed-unregistered-repeated-and-incomplete-tags-at-srclang",
      "test/Html.conformance-hardening.test.ts#requires-every-registered-extlang-to-follow-its-IANA-primary-language-prefix",
    ],
  },
  {
    id: "html.responsive.srcset",
    title: "Responsive image srcset syntax and descriptor relationships must be valid",
    statement:
      "The package parses srcset candidates, validates descriptors and URLs, and applies element-context relationships.",
    strength: "must",
    scope: "attributes",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "inspectSrcset",
      },
      {
        kind: "runtime",
        validator: "inspectConformance",
      },
      {
        kind: "test",
        suite: "test/Html.srcset.test.ts, test/Html.responsive-image-conformance.test.ts",
        oracle: "Pinned source rule and package expectation for html.responsive.srcset",
      },
    ],
    references: [
      {
        sourceId: "html-whatwg-source-approved",
        section: "srcset-attributes",
      },
    ],
    testIds: [
      "test/Html.srcset.test.ts#accepts-WHATWG-density-width-and-descriptorless-profiles",
      "test/Html.srcset.test.ts#rejects-malformed-non-positive-and-multiple-descriptors",
      "test/Html.responsive-image-conformance.test.ts#enforces-picture-source-width-and-auto-relationships-against-the-following-img",
    ],
  },
  {
    id: "html.responsive.sizes",
    title: "Responsive image source-size lists must satisfy the supported WHATWG and CSS grammar",
    statement:
      "The source-size analyzer validates supported lengths, math functions, media conditions, auto placement, and contextual responsive-image relationships.",
    strength: "must",
    scope: "attributes",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "inspectSourceSizeList",
      },
      {
        kind: "runtime",
        validator: "inspectConformance",
      },
      {
        kind: "test",
        suite: "test/Html.source-size.test.ts, test/Html.responsive-image-conformance.test.ts",
        oracle: "Pinned source rule and package expectation for html.responsive.sizes",
      },
    ],
    references: [
      {
        sourceId: "html-whatwg-source-approved",
        section: "sizes-attributes",
      },
    ],
    testIds: [
      "test/Html.source-size.test.ts#accepts-WHATWG-conditional-lists-and-CSS-whitespace-or-comments",
      "test/Html.source-size.test.ts#rejects-malformed-list-structure-instead-of-browser-processing-recovery",
      "test/Html.responsive-image-conformance.test.ts#enforces-img-descriptor-pairing-and-the-narrow-lazy-auto-exception",
    ],
  },
  {
    id: "html.foreign.names-and-namespaces",
    title: "Foreign element and qualified attribute names must obey namespace and adjustment rules",
    statement:
      "The package validates SVG, MathML, XML, XMLNS, and XLink name adjustments and requires compatible foreign integration context.",
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
        suite: "test/Html.conformance-hardening.test.ts, test/Html.coverage-matrix.test.ts, test/Html.security.test.ts",
        oracle: "Pinned source rule and package expectation for html.foreign.names-and-namespaces",
      },
    ],
    references: [
      {
        sourceId: "html-whatwg-source-approved",
        section: "adjust-svg-attributes",
      },
      {
        sourceId: "html-whatwg-source-approved",
        section: "adjust-mathml-attributes",
      },
      {
        sourceId: "html-whatwg-source-approved",
        section: "adjust-foreign-attributes",
      },
      {
        sourceId: "html-classification-current-local",
        section: "svgElementNameAdjustments",
      },
    ],
    testIds: [
      "test/Html.conformance-hardening.test.ts#covers-every-standard-SVG-and-MathML-adjustment-entry",
      "test/Html.coverage-matrix.test.ts#accepts-namespace-matching-qualified-foreign-names-and-rejects-mismatches",
      "test/Html.security.test.ts#requires-foreign-integration-roots-and-rejects-context-free-noscript-proofs",
    ],
  },
]);
