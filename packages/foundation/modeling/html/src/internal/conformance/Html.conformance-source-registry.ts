/**
 * Immutable source records consumed by the private HTML conformance registry.
 *
 * @packageDocumentation
 * @internal
 * @since 0.0.0
 */

import type * as Conformance from "@beep/schema/Conformance";

const defineSources = <const Sources extends (typeof Conformance.Annotation.Encoded)["sources"]>(
  sources: Sources
): Sources => sources;

/**
 * Specification sources and pinned implementation inputs for HTML conformance.
 *
 * @internal
 * @category specifications
 * @since 0.0.0
 */
export const HtmlConformanceSources = defineSources([
  {
    id: "html-whatwg-source-approved",
    title: "WHATWG HTML source",
    role: "primarySpecification",
    canonicalUrl: "https://raw.githubusercontent.com/whatwg/html/778afd942c67b78335a4becc28c1c725a25d1cab/source",
    revision: {
      kind: "gitCommit",
      repository: "https://github.com/whatwg/html",
      commit: "778afd942c67b78335a4becc28c1c725a25d1cab",
    },
    contentSha256: "550116d4525b762ffb6f3777de8c2179d61c6e8376bf1455c66e303aa977164d",
    license: "CC-BY-4.0",
    scope:
      "Approved target authority for HTML element, content-model, attribute, parsing, and author-conformance rules; these target bytes are not yet vendored by this package. Consumed anchors: semantics, elements, common-microsyntaxes, parsing, obsolete.",
  },
  {
    id: "html-mimesniff-source-approved",
    title: "WHATWG MIME Sniffing source",
    role: "normativeDependency",
    canonicalUrl:
      "https://raw.githubusercontent.com/whatwg/mimesniff/39aa53511b13953d84fef8d4131d6f61d0ccbde6/mimesniff.bs",
    revision: {
      kind: "gitCommit",
      repository: "https://github.com/whatwg/mimesniff",
      commit: "39aa53511b13953d84fef8d4131d6f61d0ccbde6",
    },
    contentSha256: "7b05b5ecd55535d2bbcfb42459f27c06871fe0518469e31b9f34381266c9178d",
    license: "CC-BY-4.0",
    scope:
      "Normative dependency for HTML script type author conformance. Consumed anchors: valid-mime-type, javascript-mime-type, JavaScript MIME type essence match.",
  },
  {
    id: "html-webref-dfns-approved-target",
    title: "Approved W3C webref HTML definitions refresh",
    role: "implementationReference",
    canonicalUrl:
      "https://raw.githubusercontent.com/w3c/webref/f3b81966c45f34f62df20e7f8d6f66d5b5ba9279/ed/dfns/html.json",
    revision: {
      kind: "gitCommit",
      repository: "https://github.com/w3c/webref",
      commit: "f3b81966c45f34f62df20e7f8d6f66d5b5ba9279",
    },
    contentSha256: "7f52ab97068d94454b0e52b9a447579f5b67d0e58805fa63dbba2d93d5ba2d25",
    license: "MIT",
    scope: "Approved target refresh; not the bytes currently consumed by scripts/generate.ts. Consumed anchors: dfns.",
  },
  {
    id: "html-webref-elements-approved-target",
    title: "Approved W3C webref HTML element interface refresh",
    role: "implementationReference",
    canonicalUrl:
      "https://raw.githubusercontent.com/w3c/webref/f3b81966c45f34f62df20e7f8d6f66d5b5ba9279/ed/elements/html.json",
    revision: {
      kind: "gitCommit",
      repository: "https://github.com/w3c/webref",
      commit: "f3b81966c45f34f62df20e7f8d6f66d5b5ba9279",
    },
    contentSha256: "56030c8bb725c6009e17ca85ef729aa4cecb9f51926a9ef870f36c5ecb37dfd0",
    license: "MIT",
    scope:
      "Approved target refresh; not the bytes currently consumed by scripts/generate.ts. Consumed anchors: elements.",
  },
  {
    id: "html-webref-dfns-current-local",
    title: "W3C webref HTML definitions currently vendored",
    role: "implementationReference",
    canonicalUrl:
      "https://raw.githubusercontent.com/w3c/webref/99e9e5eccbfc924203bda66a2328eade5cc08e7b/ed/dfns/html.json",
    revision: {
      kind: "gitCommit",
      repository: "https://github.com/w3c/webref",
      commit: "99e9e5eccbfc924203bda66a2328eade5cc08e7b",
    },
    contentSha256: "1112e26795a7e13cf822b113d0676610608c2f71fd56b16e11af1ae9d77a90db",
    license: "MIT",
    scope:
      "Current local generator input at data/webref/dfns-html.json. Element inventory, obsolete status, element attributes, enumerated values, and input states. Consumed anchors: dfns.",
  },
  {
    id: "html-webref-elements-current-local",
    title: "W3C webref HTML element interface index currently vendored",
    role: "implementationReference",
    canonicalUrl:
      "https://raw.githubusercontent.com/w3c/webref/99e9e5eccbfc924203bda66a2328eade5cc08e7b/ed/elements/html.json",
    revision: {
      kind: "gitCommit",
      repository: "https://github.com/w3c/webref",
      commit: "99e9e5eccbfc924203bda66a2328eade5cc08e7b",
    },
    contentSha256: "d1e938d60324db5fba3a14487f01eccf72fe03d6e5b4a0179d049c47c4aede9d",
    license: "MIT",
    scope:
      "Current local generator input at data/webref/elements-html.json. The recorded digest covers the committed 18,704-byte local artifact, which normalizes the pinned 18,703-byte upstream response by adding one trailing LF. Conforming element to DOM interface mapping. Consumed anchors: elements.",
  },
  {
    id: "html-whatwg-content-model-current-local",
    title: "WHATWG list-of-elements derived content-model index currently vendored",
    role: "implementationReference",
    canonicalUrl:
      "https://raw.githubusercontent.com/beep-effect/beep-effect/dc9e7d2707508787a0c5daf9f33c5cf1b6259e87/packages/foundation/modeling/html/data/whatwg/content-model.json",
    revision: {
      kind: "gitCommit",
      repository: "https://github.com/beep-effect/beep-effect",
      commit: "dc9e7d2707508787a0c5daf9f33c5cf1b6259e87",
    },
    contentSha256: "84ace8b4308951d97b55655d368c16328829f9de466499762d1f52997245d41b",
    license: "CC-BY-4.0",
    scope:
      "Immutable public copy of the exact current generator input at data/whatwg/content-model.json, derived from the WHATWG list of elements on 2026-06-15. Non-normative category, attribute, and child-token index for 114 elements; reviewed overrides cover the remaining inventory and contextual rules. Consumed anchors: elements-3.",
  },
  {
    id: "html-iana-language-subtag-registry-current-local",
    title: "IANA Language Subtag Registry",
    role: "registry",
    canonicalUrl: "https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry",
    revision: {
      kind: "registryVersion",
      registry: "IANA Language Subtag Registry",
      version: "2026-06-14",
    },
    contentSha256: "be1fad86a99e3a932d07b80c9b3c271ec2381a5909ce22420144e5077ab0a43a",
    license: "IANA-TERMS-OF-USE",
    scope:
      "Current local generator input at data/iana/language-subtag-registry.txt. The recorded digest covers the committed File-Date 2026-06-14 registry snapshot; the mutable canonical authority can and does advance independently. Registered language, extlang, script, region, variant, grandfathered, and private-use data used by track srclang conformance. Consumed anchors: File-Date, RFC-5646-2.2.2, RFC-5646-2.2.9.",
  },
  {
    id: "html-classification-current-local",
    title: "Reviewed HTML classification and conformance rules",
    role: "implementationReference",
    canonicalUrl:
      "https://raw.githubusercontent.com/beep-effect/beep-effect/1ed08f66df016a18c6d7d56bd97aa778912cb37b/packages/foundation/modeling/html/data/overrides/classification.json",
    revision: {
      kind: "gitCommit",
      repository: "https://github.com/beep-effect/beep-effect",
      commit: "1ed08f66df016a18c6d7d56bd97aa778912cb37b",
    },
    contentSha256: "38adaa45302dd82692c05db21cbac4c4c419a20f0ae3f054222d29dc12ea08ac",
    license: "MIT",
    scope:
      "Immutable public pre-initiative package-owned generator-input baseline for data/overrides/classification.json. Reviewed microsyntaxes, special child grammars, conditional categories, contextual rules, and foreign-name adjustments. Consumed anchors: specialChildGrammars, conformanceRules, attributeRequirements, inputAttributeApplicability.",
  },
  {
    id: "html-obsolete-interfaces-current-local",
    title: "Reviewed obsolete HTML interface mapping",
    role: "implementationReference",
    canonicalUrl:
      "https://raw.githubusercontent.com/beep-effect/beep-effect/1ed08f66df016a18c6d7d56bd97aa778912cb37b/packages/foundation/modeling/html/data/overrides/obsolete-interfaces.json",
    revision: {
      kind: "gitCommit",
      repository: "https://github.com/beep-effect/beep-effect",
      commit: "1ed08f66df016a18c6d7d56bd97aa778912cb37b",
    },
    contentSha256: "fb9db066956e67f808ac8474013a32850f3013a4576061158b383d0badc5c5ac",
    license: "MIT",
    scope:
      "Immutable public pre-initiative package-owned generator-input baseline for data/overrides/obsolete-interfaces.json. DOM interface names for obsolete generated elements absent from the current webref element index. Consumed anchors: interfaces.",
  },
]);
