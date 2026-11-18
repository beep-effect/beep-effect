import { $TestUtilsId } from "@beep/identity/packages";
import { it, TestContextUnavailable, TestHang } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// @beep/test-runner pins its schema IRIs as literals because it must not
// depend on @beep/identity. This parity test keeps those pins equal to the
// identity derivation, so an authority move cannot leave them behind.

const PinnedIdentity = S.Struct({
  identifier: S.String,
  iri: S.String,
  curie: S.String,
});

const decodePinned = S.decodeUnknownEffect(PinnedIdentity);

const $Vitest = $TestUtilsId.create("Vitest");

const pinnedAnnotations = [
  S.resolveAnnotations(TestContextUnavailable),
  S.resolveAnnotationsKey(TestContextUnavailable.fields.method),
  S.resolveAnnotations(TestHang),
  S.resolveAnnotationsKey(TestHang.fields.lastLogLine),
  S.resolveAnnotationsKey(TestHang.fields.testName),
  S.resolveAnnotationsKey(TestHang.fields.timeoutMillis),
  S.resolveAnnotations(TestHang.fields.timeoutMillis),
];

const derivedComposers = [
  $Vitest.create("TestContextUnavailable"),
  $Vitest.create("TestContextUnavailable.method"),
  $Vitest.create("TestHang"),
  $Vitest.create("TestHang.lastLogLine"),
  $Vitest.create("TestHang.testName"),
  $Vitest.create("TestHang.timeoutMillis"),
  $Vitest.create("PositiveTimeoutMillis"),
];

describe("@beep/test-runner pinned IRI parity", () => {
  it.effect(
    "pins every Vitest error IRI and CURIE exactly as $TestUtilsId derives them",
    Effect.fnUntraced(function* () {
      const pinned = yield* Effect.forEach(pinnedAnnotations, (annotations) => decodePinned(annotations), {
        concurrency: 1,
      });
      const derived = A.map(derivedComposers, (composer) => ({
        identifier: composer.string(),
        iri: composer.iri,
        curie: composer.curie,
      }));
      const isUnderVitestRoot = Str.startsWith(`${$Vitest.iri}/`);

      expect(pinned).toEqual(derived);
      expect(A.every(pinned, ({ iri }) => isUnderVitestRoot(iri))).toBe(true);
    })
  );
});
