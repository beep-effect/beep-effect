import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import {
  assertCitationTokenizerCase,
  citationTokenizerTestLayer,
  loadCitationTokenizerControls,
  setupCitationTokenizer,
} from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("owned tokenizer composition", (it) => {
  for (const kind of CitationNativeRuntimeKind.literals) {
    it.effect(
      `composes real isolated captures, class recipes and native text assembly under ${kind}`,
      () =>
        Effect.gen(function* () {
          const controls = yield* loadCitationTokenizerControls();
          const setup = yield* setupCitationTokenizer(kind, controls.configuration);
          for (const index of [0, 2, 12]) yield* assertCitationTokenizerCase(setup, A.getUnsafe(controls.cases, index));
          const original = A.getUnsafe(controls.configuration.extractors, 0);
          original.pattern.bytes.fill(0);
          for (const key of original.ordering.strings) key.bytes.fill(0);
          yield* assertCitationTokenizerCase(setup, A.getUnsafe(controls.cases, 2));
          const snapshot = yield* setup.observed.snapshot;
          expect(snapshot).toEqual({ spawned: 7, confirmed: 7 });
        }),
      { timeout: 30000 }
    );
  }
  it.effect("rejects incoherent or duplicate extractor configuration before execution", () =>
    Effect.gen(function* () {
      const controls = yield* loadCitationTokenizerControls();
      const first = A.getUnsafe(controls.configuration.extractors, 0);
      const incoherent = { ...first, recipe: { ...first.recipe, id: 999 } };
      for (const configuration of [
        { ...controls.configuration, extractors: [incoherent] },
        { ...controls.configuration, extractors: [first, first] },
      ]) {
        const failure = yield* setupCitationTokenizer("bun", configuration).pipe(Effect.flip);
        expect(failure).toMatchObject({ reason: "invalid-configuration" });
      }
    })
  );
  it.effect(
    "shares raw matches, candidates and produced text across extractors and gaps without partial results",
    () =>
      Effect.gen(function* () {
        const controls = yield* loadCitationTokenizerControls();
        for (const [overrides, limit] of [
          [{ patternMatches: 1 }, "patternMatches"],
          [{ candidates: 1 }, "candidates"],
          [{ producedTextUtf16: 13 }, "producedTextUtf16"],
        ]) {
          const setup = yield* setupCitationTokenizer("bun", controls.configuration, overrides);
          const source = { width: 1, bytes: new TextEncoder().encode("Id. x") };
          const failure = yield* setup.tokenizer.run(source).pipe(Effect.flip);
          expect(failure).toMatchObject({ limit });
          const snapshot = yield* setup.observed.snapshot;
          expect(snapshot.spawned).toBe(snapshot.confirmed);
          const admission = yield* setup.admission.snapshot;
          expect(admission).toMatchObject({ active: 0, queued: 0 });
          yield* assertCitationTokenizerCase(setup, A.getUnsafe(controls.cases, 0));
        }
        const setup = yield* setupCitationTokenizer("bun", controls.configuration, { tokens: 1 });
        const failure = yield* setup.tokenizer
          .run({ width: 1, bytes: new TextEncoder().encode("a b") })
          .pipe(Effect.flip);
        expect(failure).toMatchObject({ limit: "tokens" });
        const snapshot = yield* setup.observed.snapshot;
        expect(snapshot).toEqual({ spawned: 0, confirmed: 0 });
      }),
    { timeout: 60000 }
  );
});
