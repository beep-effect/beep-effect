import {
  CitationExtractorOrderingBinding,
  makeCitationExtractorOrdering as makeOwnedCitationExtractorOrdering,
} from "@beep/law-practice-server/internal/Citation/ExtractorOrdering";
import {
  CitationExtractorSelectionBinding,
  makeCitationExtractorSelection as makeOwnedCitationExtractorSelection,
} from "@beep/law-practice-server/internal/Citation/ExtractorSelection";
import { makeCitationPythonHash } from "@beep/law-practice-server/internal/Citation/PythonHash";
import { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import {
  ownCitationTestConfiguration,
  refuseCitationTestConfiguration,
} from "./CitationConfigurationOwnership.fixtures.ts";
import { loadCitationExtractorSelectionControls } from "./CitationExtractorSelection.fixtures.ts";

// Own the fixture configuration through the engine boundary before the direct install.
const makeCitationExtractorOrdering = Effect.fnUntraced(function* (
  a0: Parameters<typeof makeOwnedCitationExtractorOrdering>[0],
  a1: unknown
) {
  const o1 = yield* ownCitationTestConfiguration(S.Array(CitationExtractorOrderingBinding), a1);
  return yield* makeOwnedCitationExtractorOrdering(a0, o1);
});

// Own the fixture configuration through the engine boundary before the direct install.
const makeCitationExtractorSelection = Effect.fnUntraced(function* (
  a0: Parameters<typeof makeOwnedCitationExtractorSelection>[0],
  a1: unknown
) {
  const o1 = yield* ownCitationTestConfiguration(S.Array(CitationExtractorSelectionBinding), a1);
  return yield* makeOwnedCitationExtractorSelection(a0, o1);
});

const sameOrder = S.toEquivalence(S.Array(S.Natural));
it.layer(Layer.merge(BunFileSystem.layer, BunCrypto.layerDigest), { excludeTestServices: true })(
  "static source extractor order",
  (it) => {
    it.effect("bounds colliding source-set probes during installation", () =>
      Effect.gen(function* () {
        const controls = yield* loadCitationExtractorSelectionControls();
        const limits = { ...(yield* defaultCitationEnginePolicy).limits, patternEvaluations: 1 };
        const bindings = A.map(A.take(controls.ordering.bindings, 3), (row, id) => ({
          ...row,
          id,
          hash: 0n,
          equalityClass: id,
          strings: [],
        }));
        const failed = yield* makeCitationExtractorOrdering(limits, bindings).pipe(Effect.flip);
        expect(failed).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "patternEvaluations" });
      })
    );
    it.effect("recomputes every synthetic repr hash and matches source set order and first introductions", () =>
      Effect.gen(function* () {
        const controls = yield* loadCitationExtractorSelectionControls();
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const hash = yield* makeCitationPythonHash(limits);
        for (const binding of controls.ordering.bindings) {
          const citationResult1 = yield* hash.unicode(binding.representation);
          expect(citationResult1, `binding ${binding.id}`).toBe(binding.hash);
        }
        const selector = yield* makeCitationExtractorSelection(limits, controls.ordering.bindings);
        const ordering = yield* makeCitationExtractorOrdering(limits, controls.ordering.bindings);
        // Refused where configuration crosses into the engine.
        const invalidPolicy = yield* refuseCitationTestConfiguration(
          () => ({ reason: "invalid-policy" }),
          CitationEngineLimits,
          {}
        );
        expect(invalidPolicy).toMatchObject({ reason: "invalid-policy" });
        // Refused where configuration crosses into the engine.
        const invalidBindings = yield* refuseCitationTestConfiguration(
          () => ({ reason: "invalid-bindings" }),
          S.Array(CitationExtractorOrderingBinding),
          {}
        );
        expect(invalidBindings).toMatchObject({ reason: "invalid-bindings" });
        let nonIndexOrders = 0;
        for (const row of controls.ordering.cases) {
          const citationResult2 = yield* selector.select(row.source);
          expect(citationResult2.insertions, `case ${row.id}`).toEqual(row.insertions);
          const result = yield* ordering.ordered(row.source);
          expect(result.indices, `case ${row.id}`).toEqual(row.ordered);
          if (!sameOrder(result.indices, row.selected)) nonIndexOrders++;
        }
        expect(nonIndexOrders).toBeGreaterThan(0);
        // Identical configurations collapse by equality at the same hash;
        // equal dictionaries with distinct repr hashes remain separate in source.
        const dictCase = A.getUnsafe(controls.ordering.cases, 23);
        const dictOrder = (yield* ordering.ordered(dictCase.source)).indices;
        expect(dictOrder).toEqual(expect.arrayContaining([1, 18, 19]));
        expect(dictOrder).not.toContain(16);
        expect(dictOrder).not.toContain(17);
      })
    );
  }
);
