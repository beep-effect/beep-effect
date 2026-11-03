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
