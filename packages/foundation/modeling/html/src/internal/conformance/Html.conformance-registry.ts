/**
 * Internal specification metadata used by the HTML conformance facade.
 *
 * @packageDocumentation
 * @internal
 * @since 0.0.0
 */

import { HtmlConformanceAuthoringInvariants } from "./Html.conformance-authoring-invariants.ts";
import { HtmlConformanceBoundaryInvariants } from "./Html.conformance-boundary-invariants.ts";
import { HtmlConformanceProfiles } from "./Html.conformance-profile-registry.ts";
import { HtmlConformanceSources } from "./Html.conformance-source-registry.ts";
import { HtmlConformanceStructureInvariants } from "./Html.conformance-structure-invariants.ts";
import type * as Conformance from "@beep/schema/Conformance";

/**
 * Static source, profile, invariant, and evidence registry for WHATWG HTML conformance.
 *
 * @internal
 * @category specifications
 * @since 0.0.0
 */
export const HtmlWhatwgConformanceAnnotation = {
  sources: HtmlConformanceSources,
  profiles: HtmlConformanceProfiles,
  invariants: [
    ...HtmlConformanceStructureInvariants,
    ...HtmlConformanceAuthoringInvariants,
    ...HtmlConformanceBoundaryInvariants,
  ],
} satisfies typeof Conformance.Annotation.Encoded;
