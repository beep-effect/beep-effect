import { makeCitationExtractorOrdering } from "@beep/law-practice-server/internal/Citation/ExtractorOrdering";
import { makeCitationExtractorSelection } from "@beep/law-practice-server/internal/Citation/ExtractorSelection";
import { makeCitationPythonHash } from "@beep/law-practice-server/internal/Citation/PythonHash";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { loadCitationExtractorSelectionControls } from "./CitationExtractorSelection.fixtures.ts";

const sameOrder = S.toEquivalence(S.Array(S.Natural));
it.layer(Layer.merge(BunServices.layer, BunCrypto.layerDigest), { excludeTestServices: true })(
  "static source extractor order",
  (it) => {
    it.effect("recomputes every synthetic repr hash and matches source set order and first introductions", () =>
      Effect.gen(function* () {
        const controls = yield* loadCitationExtractorSelectionControls();
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const hash = yield* makeCitationPythonHash(limits);
        for (const binding of controls.ordering.bindings) {
          expect(yield* hash.unicode(binding.representation), `binding ${binding.id}`).toBe(binding.hash);
        }
        const selector = yield* makeCitationExtractorSelection(limits, controls.ordering.bindings);
        const ordering = yield* makeCitationExtractorOrdering(limits, controls.ordering.bindings);
        let nonIndexOrders = 0;
        for (const row of controls.ordering.cases) {
          expect((yield* selector.select(row.source)).insertions, `case ${row.id}`).toEqual(row.insertions);
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
