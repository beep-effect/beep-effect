import { PandocConformanceResult } from "@beep/pandoc-ast/Pandoc.conformance";
import * as Conformance from "@beep/schema/Conformance";
import { validateConformanceAnnotationAgainstLedgerArtifacts } from "@beep/test-utils/ConformanceLedger";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

describe("@beep/pandoc-ast conformance annotations", () => {
  it("collects the Pandoc JSON profile from the exhaustive result schema", () => {
    const annotation = PandocConformanceResult.pipe(Conformance.collectConformanceAnnotations, A.head, O.getOrThrow);

    expect(S.is(Conformance.Annotation)(annotation)).toBe(true);
    expect(A.map(annotation.profiles, ({ id }) => id)).toEqual(["pandoc-json-1.23.1"]);
    expect(A.map(annotation.sources, ({ id }) => id)).toEqual([
      "pandoc-types-1.23.1-definition",
      "pandoc-registry-baseline",
      "pandoc-model-baseline",
    ]);
    expect(A.map(annotation.invariants, ({ id }) => id)).toEqual([
      "pandoc.registry.upstream-generation",
      "pandoc.registry.known-name-exhaustiveness",
      "pandoc.codec.future-constructors",
      "pandoc.codec.known-unsupported",
      "pandoc.codec.constructor-context",
      "pandoc.codec.nullary-payloads",
      "pandoc.table.recursive-payload",
      "pandoc.table.column-width-payload",
      "pandoc.meta.recursive-values",
      "pandoc.api-version.exact-profile",
      "pandoc.list.constructor-domains",
      "pandoc.math.constructor-domain",
      "pandoc.semantic-subset",
      "pandoc.raw.exact-retention",
    ]);
  });

  it.effect("matches the exact selected Pandoc ledger records and enforcement evidence", () => {
    const annotation = PandocConformanceResult.pipe(Conformance.collectConformanceAnnotations, A.head, O.getOrThrow);

    return validateConformanceAnnotationAgainstLedgerArtifacts(
      new URL("../", import.meta.url),
      "@beep/pandoc-ast",
      annotation
    ).pipe(Effect.map((issues) => expect(issues).toEqual([])));
  });
});
