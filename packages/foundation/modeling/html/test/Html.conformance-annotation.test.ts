import { ConformantHtml } from "@beep/html/Html.conformance";
import * as Conformance from "@beep/schema/Conformance";
import { validateConformanceAnnotationAgainstLedgerArtifacts } from "@beep/test-utils/ConformanceLedger";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

describe("@beep/html conformance annotations", () => {
  it("collects the WHATWG profile from the conformant HTML proof schema", () => {
    const annotation = ConformantHtml.pipe(Conformance.collectConformanceAnnotations, A.head, O.getOrThrow);

    expect(S.is(Conformance.Annotation)(annotation)).toBe(true);
    expect(A.map(annotation.profiles, ({ id }) => id)).toEqual([
      "html-whatwg-living-2026-08-30",
      "html-current-vendored-2026-06-15",
    ]);
    expect(A.map(annotation.sources, ({ id }) => id)).toEqual([
      "html-whatwg-source-approved",
      "html-mimesniff-source-approved",
      "html-webref-dfns-current-local",
      "html-webref-elements-current-local",
      "html-webref-dfns-approved-target",
      "html-webref-elements-approved-target",
      "html-whatwg-content-model-current-local",
      "html-iana-language-subtag-registry-current-local",
      "html-classification-current-local",
      "html-obsolete-interfaces-current-local",
    ]);
    expect(A.map(annotation.invariants, ({ id }) => id)).toEqual([
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
      "html.safe-profile.active-content",
      "html.aria.role-compatibility",
      "html.obsolete.nonconforming-elements",
      "html.spec.per-rule-traceability",
      "html.parser.tree-construction",
      "html.custom-elements.open-world",
    ]);
  });

  it.effect("matches the exact selected HTML ledger records and enforcement evidence", () => {
    const annotation = ConformantHtml.pipe(Conformance.collectConformanceAnnotations, A.head, O.getOrThrow);

    return validateConformanceAnnotationAgainstLedgerArtifacts(
      new URL("../", import.meta.url),
      "@beep/html",
      annotation
    ).pipe(Effect.map((issues) => expect(issues).toEqual([])));
  });
});
