import {
  CitationFrozenEditions,
  makeCitationFrozenEditions,
} from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import { makeCitationTokenDispatch } from "@beep/law-practice-server/internal/Citation/TokenDispatch";
import { makeCitationCanonicalTokenizerCatalog } from "@beep/law-practice-server/internal/Citation/TokenizerCatalog";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { loadCitationCanonicalTokenizerControls } from "./CitationCanonicalTokenizer.fixtures.ts";
import { loadCitationFrozenEditionFixtures } from "./CitationFrozenEditions.fixtures.ts";
import {
  assertCitationTokenizerCase,
  citationTokenizerTestLayer,
  setupCitationTokenizer,
} from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("canonical tokenizer catalog", (it) => {
  it.effect("rejects duplicate descriptor keys and source recipe identity mismatches", () =>
    Effect.gen(function* () {
      const controls = yield* loadCitationCanonicalTokenizerControls();
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const descriptor = A.getUnsafe(controls.metadata.descriptors, 0);
      const first = A.getUnsafe(controls.metadata.recipes, 0);
      const other = yield* Effect.fromOption(
        A.findFirst(controls.metadata.recipes, (row) => row.patternSha256 !== first.patternSha256)
      );
      for (const metadata of [
        {
          ...controls.metadata,
          descriptors: A.map(controls.metadata.descriptors, (row, index) => (index === 1 ? descriptor : row)),
        },
        {
          ...controls.metadata,
          recipes: A.map(controls.metadata.recipes, (row, index) => (index === 0 ? { ...row, id: row.id + 1 } : row)),
        },
        {
          ...controls.metadata,
          recipes: A.map(controls.metadata.recipes, (row, index) =>
            index === 0 ? { ...row, patternSha256: other.patternSha256 } : row
          ),
        },
      ]) {
        const failed = yield* makeCitationCanonicalTokenizerCatalog(limits, controls.payload, metadata).pipe(
          Effect.flip
        );
        expect(failed).toMatchObject({ _tag: "CitationTokenizerCatalogFailure", reason: "metadata-mismatch" });
        expect("cause" in failed).toBe(false);
      }
    })
  );
  it.effect("rejects malformed policy, payload and incomplete metadata before preparing extractors", () =>
    Effect.gen(function* () {
      const controls = yield* loadCitationCanonicalTokenizerControls();
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const invalidPolicy = yield* makeCitationCanonicalTokenizerCatalog({}, controls.payload, controls.metadata).pipe(
        Effect.flip
      );
      expect(invalidPolicy).toMatchObject({ reason: "invalid-input" });
      const invalidPayload = yield* makeCitationCanonicalTokenizerCatalog(limits, null, controls.metadata).pipe(
        Effect.flip
      );
      expect(invalidPayload).toMatchObject({ reason: "invalid-input" });
      for (const metadata of [
        {},
        { ...controls.metadata, recipes: A.drop(controls.metadata.recipes, 1) },
        { ...controls.metadata, hashes: A.drop(controls.metadata.hashes, 1) },
      ]) {
        const failure = yield* makeCitationCanonicalTokenizerCatalog(limits, controls.payload, metadata).pipe(
          Effect.flip
        );
        expect(failure).toMatchObject({ reason: "metadata-mismatch" });
      }
      const patternBudget = yield* makeCitationCanonicalTokenizerCatalog(
        { ...limits, patterns: 1 },
        controls.payload,
        controls.metadata
      ).pipe(Effect.flip);
      expect(patternBudget).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "patterns" });
      const patternTextBudget = yield* makeCitationCanonicalTokenizerCatalog(
        { ...limits, patternUtf16: 1 },
        controls.payload,
        controls.metadata
      ).pipe(Effect.flip);
      expect(patternTextBudget).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "patternUtf16" });
    })
  );
  it.effect(
    "prepares all canonical patterns, classes, ordering and edition identities and matches a real citation",
    () =>
      Effect.gen(function* () {
        const controls = yield* loadCitationCanonicalTokenizerControls();
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const config = yield* makeCitationCanonicalTokenizerCatalog(limits, controls.payload, controls.metadata);
        expect(config.extractors).toHaveLength(6805);
        expect(config.editions).toHaveLength(2533);
        A.forEach(config.extractors, (entry, index) => {
          expect(entry.recipe.id).toBe(index);
          expect(entry.ordering.id).toBe(index);
          expect(entry.descriptor.patternSha256).toBe(entry.recipe.patternSha256);
        });
        const setup = yield* setupCitationTokenizer("bun", config);
        const output = yield* assertCitationTokenizerCase(setup, A.getUnsafe(controls.corpus.cases, 2));
        const { bundle } = yield* loadCitationFrozenEditionFixtures();
        const frozen = yield* makeCitationFrozenEditions(bundle);
        const dispatch = yield* makeCitationTokenDispatch(limits, controls.metadata.editions).pipe(
          Effect.provideService(CitationFrozenEditions, frozen)
        );
        const plan = yield* dispatch.plan(output);
        expect(plan.decisions).toEqual(
          A.map(output.assembly.citations, ([index, id]) => ({ index, id, action: "FullCaseCitation" }))
        );
        const snapshot = yield* setup.observed.snapshot;
        expect(snapshot).toEqual({ spawned: 11, confirmed: 11 });
        const changed = yield* makeCitationCanonicalTokenizerCatalog(
          limits,
          `${controls.payload} `,
          controls.metadata
        ).pipe(Effect.flip);
        expect(changed).toMatchObject({ reason: "artifact-mismatch" });
        const missing = yield* makeCitationCanonicalTokenizerCatalog(limits, controls.payload, {
          ...controls.metadata,
          descriptors: [],
        }).pipe(Effect.flip);
        expect(missing).toMatchObject({ reason: "metadata-mismatch" });
      }),
    { timeout: 60000 }
  );
});
