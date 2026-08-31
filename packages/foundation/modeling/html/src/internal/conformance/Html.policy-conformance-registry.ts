/**
 * Package-owned safety-policy source, profile, and invariant registry.
 *
 * @packageDocumentation
 * @internal
 * @since 0.0.0
 */

import type * as Conformance from "@beep/schema/Conformance";

const defineSources = <const Sources extends (typeof Conformance.Annotation.Encoded)["sources"]>(
  sources: Sources
): Sources => sources;

const defineProfiles = <const Profiles extends (typeof Conformance.Annotation.Encoded)["profiles"]>(
  profiles: Profiles
): Profiles => profiles;

const defineInvariants = <const Invariants extends (typeof Conformance.Annotation.Encoded)["invariants"]>(
  invariants: Invariants
): Invariants => invariants;

const HtmlSafePolicySources = defineSources([
  {
    id: "html-safe-policy-source-current-local",
    title: "@beep/html conservative safe-output policy",
    role: "implementationReference",
    canonicalUrl:
      "https://raw.githubusercontent.com/beep-effect/beep-effect/e6e88af611c2d677c8348e9e6722687b6c34c454/packages/foundation/modeling/html/src/Html.policy.ts",
    revision: {
      kind: "gitCommit",
      repository: "https://github.com/beep-effect/beep-effect",
      commit: "e6e88af611c2d677c8348e9e6722687b6c34c454",
    },
    contentSha256: "eb11258d9933cc5296673b3fdc12d88dc702ae4b84a09eb56b2c39eb26b759fd",
    license: "MIT",
    scope:
      "Exact package-owned implementation reference for the conservative SafeHtmlAst policy. This policy is stricter than general WHATWG author conformance and does not claim to be a WHATWG requirement. Consumed symbols: SafeHtmlAst, inspectSafeHtml, enforceSafeHtml.",
  },
]);

const HtmlSafePolicyProfiles = defineProfiles([
  {
    id: "html-safe-output-policy-e6e88af6",
    title: "@beep/html conservative safe-output policy",
    version: "e6e88af611c2d677c8348e9e6722687b6c34c454",
    description:
      "Package-owned deny-by-default browser-output policy applied after general HTML conformance; it is not a WHATWG conformance profile.",
    sourceIds: ["html-safe-policy-source-current-local"],
    invariantIds: ["html.safe-profile.active-content", "html.aria.role-compatibility"],
  },
]);

const HtmlSafePolicyInvariants = defineInvariants([
  {
    id: "html.safe-profile.active-content",
    title: "The safe profile must reject active content and unsafe attributes",
    statement:
      "SafeHtmlAst narrows the broad conformant AST by denying active, event, style, form, foreign, and unsafe URL surfaces and by issuing an opaque policy proof.",
    strength: "must",
    scope: "value",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "inspectSafeHtml",
      },
      {
        kind: "runtime",
        validator: "enforceSafeHtml",
      },
      {
        kind: "test",
        suite: "test/Html.security.test.ts",
        oracle: "Package safe-output policy behavior for html.safe-profile.active-content",
      },
    ],
    references: [
      {
        sourceId: "html-safe-policy-source-current-local",
        section: "SafeHtmlAst, inspectSafeHtml, enforceSafeHtml",
      },
    ],
    testIds: [
      "test/Html.security.test.ts#admits-only-self-targets-or-protected-blank-targets",
      "test/Html.security.test.ts#denies-active-foreign-form-data-event-style-and-broad-global-attributes",
      "test/Html.security.test.ts#rejects-prototype-spread-JSON-and-plain-object-proof-forgeries",
    ],
  },
  {
    id: "html.aria.role-compatibility",
    title: "The safe profile should enforce its finite role and ARIA compatibility policy",
    statement:
      "SafeHtmlAst accepts only the package policy's finite role and ARIA subset with element-aware compatibility checks; it does not claim exhaustive accessibility conformance.",
    strength: "should",
    scope: "attributes",
    decidability: "contextualRuntime",
    enforcement: [
      {
        kind: "runtime",
        validator: "inspectSafeHtml",
      },
      {
        kind: "runtime",
        validator: "enforceSafeHtml",
      },
      {
        kind: "test",
        suite: "test/Html.coverage-matrix.test.ts",
        oracle: "Package safe-output policy behavior for html.aria.role-compatibility",
      },
    ],
    references: [
      {
        sourceId: "html-safe-policy-source-current-local",
        section: "roleCompatibility, isCompatibleAriaAttribute, inspectSafeHtml",
      },
    ],
    testIds: [
      "test/Html.coverage-matrix.test.ts#applies-role-compatibility-across-matching-mismatching-and-absent-roles",
      "test/Html.coverage-matrix.test.ts#applies-each-element-aware-ARIA-compatibility-rule",
    ],
  },
]);

/**
 * Static annotation published by the opaque `SafeHtmlAst` proof schema.
 *
 * @internal
 * @category specifications
 * @since 0.0.0
 */
export const HtmlSafePolicyConformanceAnnotation = {
  sources: HtmlSafePolicySources,
  profiles: HtmlSafePolicyProfiles,
  invariants: HtmlSafePolicyInvariants,
} satisfies typeof Conformance.Annotation.Encoded;
