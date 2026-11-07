import { makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { CitationPythonUnicodeStorage, CitationTextBudget } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import { installCitationXmlWorker, replayCitationXmlWorker } from "./CitationXmlWorker.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("owned XML worker", (it) => {
  it.effect(
    "preserves original XML outcomes and physical retirement on Bun",
    () => replayCitationXmlWorker("bun", false),
    { timeout: 120000 }
  );
  it.effect(
    "preserves the same false/true values and native widths on Node",
    () => replayCitationXmlWorker("node", false),
    { timeout: 120000 }
  );
  it.effect("captures the parent text authority and refuses allocation before native spawn", () =>
    Effect.gen(function* () {
      const setup = yield* installCitationXmlWorker("bun");
      yield* setup.budget.reserve(setup.limits.producedTextUtf16 - 1);
      const replacement = yield* makeCitationTextBudget(setup.limits);
      const source = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array([65, 66]) });
      const failure = yield* setup.worker
        .balance(source)
        .pipe(Effect.provideService(CitationTextBudget, replacement), Effect.flip);
      expect(failure).toMatchObject({ operation: "annotate", limit: "producedTextUtf16" });
      const used = yield* setup.budget.snapshot;
      const swapped = yield* replacement.snapshot;
      expect(used).toBe(setup.limits.producedTextUtf16 - 1);
      expect(swapped).toBe(0);
      const counts = yield* setup.observed.snapshot;
      expect(counts).toEqual({ spawned: 0, confirmed: 0 });
    })
  );
});
