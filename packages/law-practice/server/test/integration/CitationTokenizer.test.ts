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
} from "../CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("native tokenizer source composition", (it) => {
  for (const kind of CitationNativeRuntimeKind.literals) {
    it.effect(
      `matches every source composition case under ${kind}`,
      () =>
        Effect.gen(function* () {
          const controls = yield* loadCitationTokenizerControls();
          const setup = yield* setupCitationTokenizer(kind, controls.configuration);
          for (const row of controls.cases) yield* assertCitationTokenizerCase(setup, row);
          const count = A.reduce(controls.cases, 0, (n, row) => n + row.selected.length);
          const snapshot = yield* setup.observed.snapshot;
          expect(snapshot).toEqual({ spawned: count, confirmed: count });
        }),
      { timeout: 180000 }
    );
  }
});
