import { $TestUtilsId } from "@beep/identity/packages";
import {
  TestContextUnavailable as LeafContextUnavailable,
  TestHang as LeafHang,
  it as leafIt,
} from "@beep/test-runner";
import { makeIt as makeLeafIt } from "@beep/test-runner/test/Vitest";
import { makeIt } from "@beep/test-utils/test/Vitest";
import { it, TestContextUnavailable, TestHang } from "@beep/test-utils/Vitest";
import { expect } from "@effect/vitest";
import * as S from "effect/Schema";

const $I = $TestUtilsId.create("Vitest");

it("preserves runner and error constructor identity through compatibility exports", () => {
  expect(it).toBe(leafIt);
  expect(TestContextUnavailable).toBe(LeafContextUnavailable);
  expect(TestHang).toBe(LeafHang);
  expect(makeIt).toBe(makeLeafIt);
});

it("preserves historical schema identities without a runner dependency on identity", () => {
  expect(S.resolveAnnotations(TestContextUnavailable)).toMatchObject($I.annoteError("TestContextUnavailable"));
  expect(S.resolveAnnotations(TestHang)).toMatchObject($I.annoteError("TestHang"));
  expect(S.resolveAnnotationsKey(TestContextUnavailable.fields.method)).toMatchObject(
    $I.annote("TestContextUnavailable.method")
  );
  expect(S.resolveAnnotationsKey(TestHang.fields.lastLogLine)).toMatchObject($I.annote("TestHang.lastLogLine"));
  expect(S.resolveAnnotationsKey(TestHang.fields.testName)).toMatchObject($I.annote("TestHang.testName"));
  expect(S.resolveAnnotationsKey(TestHang.fields.timeoutMillis)).toMatchObject($I.annote("TestHang.timeoutMillis"));
});
