import * as Registry from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import { it, TestContextUnavailable, TestHang } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const ProjectedIdentity = S.Struct({
  identifier: S.String,
  iri: S.String,
  curie: S.String,
});

const decodeProjected = S.decodeUnknownEffect(ProjectedIdentity);

const projectedAnnotations = [
  S.resolveAnnotations(TestContextUnavailable),
  S.resolveAnnotationsKey(TestContextUnavailable.fields.method),
  S.resolveAnnotations(TestHang),
  S.resolveAnnotationsKey(TestHang.fields.lastLogLine),
  S.resolveAnnotationsKey(TestHang.fields.testName),
  S.resolveAnnotationsKey(TestHang.fields.timeoutMillis),
  S.resolveAnnotations(TestHang.fields.timeoutMillis),
];

const registryRow = (identifier: string) =>
  O.map(Registry.bindingOf(identifier), (term) => ({
    identifier,
    iri: term.iri,
    curie: `${term.namespace}:${term.local}`,
  }));

describe("@beep/test-runner registry projection parity", () => {
  it.effect(
    "annotates every Vitest error schema with the registry binding of its code identity",
    Effect.fnUntraced(function* () {
      const projected = yield* Effect.forEach(projectedAnnotations, (annotations) => decodeProjected(annotations), {
        concurrency: 1,
      });
      const bound = A.map(projected, ({ identifier }) => registryRow(identifier));

      expect(bound).toEqual(A.map(projected, O.some));
      expect(A.map(projected, ({ curie }) => curie)).toEqual([
        "vitest:TestContextUnavailable",
        "vitest:TestContextUnavailable.method",
        "vitest:TestHang",
        "vitest:TestHang.lastLogLine",
        "vitest:TestHang.testName",
        "vitest:TestHang.timeoutMillis",
        "vitest:PositiveTimeoutMillis",
      ]);
    })
  );

  it("records each retired test-utils IRI as a deprecation replaced by its vitest term", () => {
    const vitest = Registry.namespace("vitest").iri;
    expect(Registry.RegistryVocab.vitest.terms).toHaveLength(7);
    for (const local of Registry.RegistryVocab.vitest.terms) {
      assertSome(
        Registry.replacementOf(`https://beep-effect.com/ns/test-utils/Vitest/${local}`),
        TermIri.make(`${vitest}${local}`)
      );
    }
  });
});
