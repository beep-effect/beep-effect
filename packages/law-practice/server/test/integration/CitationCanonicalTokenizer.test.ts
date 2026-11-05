import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { makeCitationCanonicalTokenizerCatalog } from "@beep/law-practice-server/internal/Citation/TokenizerCatalog";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { loadCitationCanonicalTokenizerControls } from "../CitationCanonicalTokenizer.fixtures.ts";
import {
  assertCitationTokenizerCase,
  citationTokenizerTestLayer,
  setupCitationTokenizer,
} from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("complete default tokenizer composition", (it) => {
  for (const kind of CitationNativeRuntimeKind.literals) {
    it.effect(
      `matches all default citation and edition outcomes under ${kind}`,
      () =>
        Effect.gen(function* () {
          const controls = yield* loadCitationCanonicalTokenizerControls();
          const limits = (yield* defaultCitationEnginePolicy).limits;
          const config = yield* makeCitationCanonicalTokenizerCatalog(limits, controls.payload, controls.metadata);
          const setup = yield* setupCitationTokenizer(kind, config);
          for (const row of controls.corpus.cases) yield* assertCitationTokenizerCase(setup, row);
          const snapshot = yield* setup.observed.snapshot;
          expect(snapshot).toEqual({ spawned: 192, confirmed: 192 });
        }),
      { timeout: 360000 }
    );
  }
});
