import { it, TestContextUnavailable, TestHang } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as S from "effect/Schema";

// The identity registry declares these terms in its `vitest` shard and projects them into this
// package; @beep/identity's VitestErrorsParity test proves the projection equals the registry.

const annotated = [
  ["TestContextUnavailable", S.resolveAnnotations(TestContextUnavailable)],
  ["TestContextUnavailable.method", S.resolveAnnotationsKey(TestContextUnavailable.fields.method)],
  ["TestHang", S.resolveAnnotations(TestHang)],
  ["TestHang.lastLogLine", S.resolveAnnotationsKey(TestHang.fields.lastLogLine)],
  ["TestHang.testName", S.resolveAnnotationsKey(TestHang.fields.testName)],
  ["TestHang.timeoutMillis", S.resolveAnnotationsKey(TestHang.fields.timeoutMillis)],
  ["PositiveTimeoutMillis", S.resolveAnnotations(TestHang.fields.timeoutMillis)],
] as const;

describe("@beep/test-runner registry terms", () => {
  it("annotates every Vitest error schema with its registry identity, IRI and CURIE", () => {
    expect(
      A.map(annotated, ([, annotations]) => ({
        schemaId: annotations?.schemaId,
        identifier: annotations?.identifier,
        iri: annotations?.iri,
        curie: annotations?.curie,
      }))
    ).toStrictEqual(
      A.map(annotated, ([local]) => ({
        schemaId: Symbol.for(`@beep/test-runner/Vitest/${local}`),
        identifier: `@beep/test-runner/Vitest/${local}`,
        iri: `https://beep-effect.com/ns/vitest/${local}`,
        curie: `vitest:${local}`,
      }))
    );
  });

  it("tags each error with its registry code identity", () => {
    expect(TestHang.make({ testName: "a", timeoutMillis: 1 })._tag).toBe("TestHang");
    expect(S.resolveAnnotations(TestHang)?.identifier).toBe("@beep/test-runner/Vitest/TestHang");
  });
});
