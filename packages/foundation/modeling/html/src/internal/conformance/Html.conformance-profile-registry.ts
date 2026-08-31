/**
 * Profile selections consumed by the private HTML conformance registry.
 *
 * @packageDocumentation
 * @internal
 * @since 0.0.0
 */

import type * as Conformance from "@beep/schema/Conformance";

const defineProfiles = <const Profiles extends (typeof Conformance.Annotation.Encoded)["profiles"]>(
  profiles: Profiles
): Profiles => profiles;

/**
 * Versioned HTML profiles that select the registered sources and invariants.
 *
 * @internal
 * @category specifications
 * @since 0.0.0
 */
export const HtmlConformanceProfiles = defineProfiles([
  {
    id: "html-whatwg-living-2026-08-30",
    title: "WHATWG HTML semantic conformance",
    version: "778afd942c67b78335a4becc28c1c725a25d1cab",
    description: "Target WHATWG HTML profile with generated local schemas, contextual validation, and explicit gaps.",
    sourceIds: [
      "html-whatwg-source-approved",
      "html-mimesniff-source-approved",
      "html-webref-dfns-approved-target",
      "html-webref-elements-approved-target",
      "html-webref-dfns-current-local",
      "html-webref-elements-current-local",
      "html-whatwg-content-model-current-local",
      "html-iana-language-subtag-registry-current-local",
      "html-classification-current-local",
      "html-obsolete-interfaces-current-local",
    ],
    invariantIds: [
      "html.inventory.generated-elements",
      "html.inventory.approved-refresh-drift",
      "html.ast.literal-tag-discrimination",
      "html.element.local-content-model",
      "html.heading.phrasing-children",
      "html.heading.computed-levels",
      "html.heading.no-skipped-levels",
      "html.heading.level-one-advisory",
      "html.document.structure",
      "html.content.special-child-grammars",
      "html.attributes.conditional-requirements",
      "html.attributes.input-state-applicability",
      "html.script.type-state",
      "html.script.attribute-applicability",
      "html.script.payload-language-validity",
      "html.attributes.microsyntaxes",
      "html.attributes.numeric-relationships",
      "html.document.unique-ids-and-references",
      "html.track.language-tags",
      "html.responsive.srcset",
      "html.responsive.sizes",
      "html.foreign.names-and-namespaces",
      "html.serialization.text-modes",
      "html.obsolete.nonconforming-elements",
      "html.spec.per-rule-traceability",
      "html.parser.tree-construction",
      "html.custom-elements.open-world",
    ],
  },
  {
    id: "html-current-vendored-2026-06-15",
    title: "Current vendored HTML generator profile",
    version: "2026-06-15",
    description:
      "Currently vendored derived indices, registry data, and reviewed overrides consumed by offline HTML generation.",
    sourceIds: [
      "html-whatwg-source-approved",
      "html-webref-dfns-current-local",
      "html-webref-elements-current-local",
      "html-webref-dfns-approved-target",
      "html-whatwg-content-model-current-local",
      "html-iana-language-subtag-registry-current-local",
      "html-classification-current-local",
      "html-obsolete-interfaces-current-local",
    ],
    invariantIds: [
      "html.inventory.generated-elements",
      "html.inventory.approved-refresh-drift",
      "html.element.local-content-model",
      "html.obsolete.nonconforming-elements",
    ],
  },
]);
