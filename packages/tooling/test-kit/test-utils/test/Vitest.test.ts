import { bindingOf } from "@beep/identity/Registry";
import {
  TestContextUnavailable as LeafContextUnavailable,
  TestHang as LeafHang,
  it as leafIt,
} from "@beep/test-runner";
import { makeIt as makeLeafIt } from "@beep/test-runner/test/Vitest";
import { makeIt } from "@beep/test-utils/test/Vitest";
import { it, TestContextUnavailable, TestHang } from "@beep/test-utils/Vitest";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

it("preserves runner and error constructor identity through compatibility exports", () => {
  expect(it).toBe(leafIt);
  expect(TestContextUnavailable).toBe(LeafContextUnavailable);
  expect(TestHang).toBe(LeafHang);
  expect(makeIt).toBe(makeLeafIt);
});

it("carries the registry-bound vitest identities through the compatibility exports", () => {
  const annotated = [
    ["TestContextUnavailable", S.resolveAnnotations(TestContextUnavailable)],
    ["TestContextUnavailable.method", S.resolveAnnotationsKey(TestContextUnavailable.fields.method)],
    ["TestHang", S.resolveAnnotations(TestHang)],
    ["TestHang.lastLogLine", S.resolveAnnotationsKey(TestHang.fields.lastLogLine)],
    ["TestHang.testName", S.resolveAnnotationsKey(TestHang.fields.testName)],
    ["TestHang.timeoutMillis", S.resolveAnnotationsKey(TestHang.fields.timeoutMillis)],
  ] as const;
  expect(
    A.map(annotated, ([, annotations]) => ({
      identifier: annotations?.identifier,
      iri: annotations?.iri,
      curie: annotations?.curie,
    }))
  ).toStrictEqual(
    A.map(annotated, ([local]) => {
      const code = `@beep/test-runner/Vitest/${local}`;
      const term = O.getOrThrow(bindingOf(code));
      return { identifier: code, iri: term.iri, curie: `${term.namespace}:${term.local}` };
    })
  );
});
