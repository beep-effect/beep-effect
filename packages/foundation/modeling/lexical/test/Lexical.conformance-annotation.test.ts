import { LexicalConformanceResult } from "@beep/lexical-schema/Lexical.conformance";
import * as Conformance from "@beep/schema/Conformance";
import { validateConformanceAnnotationAgainstLedgerArtifacts } from "@beep/test-utils/ConformanceLedger";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

describe("@beep/lexical-schema conformance annotations", () => {
  it("collects the Beep v1 profile from the exhaustive Lexical result schema", () => {
    const annotation = LexicalConformanceResult.pipe(Conformance.collectConformanceAnnotations, A.head, O.getOrThrow);

    expect(S.is(Conformance.Annotation)(annotation)).toBe(true);
    expect(A.map(annotation.profiles, ({ id }) => id)).toEqual(["beep-lexical-v1"]);
    expect(A.map(annotation.sources, ({ id }) => id)).toEqual([
      "lexical-source-0.49.0",
      "lexical-nodes-docs-2026-08-30",
      "lexical-npm-0.49.0",
      "lexical-list-npm-0.49.0",
      "lexical-table-npm-0.49.0",
      "lexical-beep-v1-baseline",
    ]);
    expect(A.map(annotation.invariants, ({ id }) => id)).toEqual([
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
    ]);
  });

  it.effect("matches the exact selected Lexical ledger records and enforcement evidence", () => {
    const annotation = LexicalConformanceResult.pipe(Conformance.collectConformanceAnnotations, A.head, O.getOrThrow);

    return validateConformanceAnnotationAgainstLedgerArtifacts(
      new URL("../", import.meta.url),
      "@beep/lexical-schema",
      annotation
    ).pipe(Effect.map((issues) => expect(issues).toEqual([])));
  });
});
