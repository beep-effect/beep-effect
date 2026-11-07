import {
  deriveCitationCanonicalSource,
  retainCitationCanonicalSource,
} from "@beep/law-practice-server/internal/Citation/CanonicalSource";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { CitationTextBudget } from "@beep/law-practice-use-cases/server";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";
import { citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { setupCitationMetadataRuntime } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const artifact = Sha256Hex.make(Str.repeat(64)("a"));
const modes = { role: "markup", cleanSteps: ["html"], container: "list" };

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("canonical source refusals", (it) => {
  it.effect("retains a genuine parent by identity and refuses anything that is not verified source text", () =>
    Effect.gen(function* () {
      const parent = yield* citationFixtureSourceProof("Visible text");
      const retained = yield* retainCitationCanonicalSource(parent);
      strictEqual(retained._tag, "Unchanged");
      strictEqual(retained.source, parent);
      const failure = yield* retainCitationCanonicalSource({ sourceText: "forged" }).pipe(Effect.flip);
      deepStrictEqual(failure.reason, "invalid-input");
    })
  );
  it.effect("refuses an unverified parent or unknown derivation modes before reading native output", () =>
    Effect.gen(function* () {
      const setup = yield* setupCitationMetadataRuntime("bun");
      const parent = yield* citationFixtureSourceProof("<p>Visible</p>");
      const unicode = yield* makeCitationPythonUnicode(setup.limits);
      const changed = yield* unicode.fromText("Visible");
      // The data-last form captures every argument except limits.
      const derive = (parentInput: unknown, modesInput: unknown) =>
        deriveCitationCanonicalSource(
          artifact,
          parentInput,
          changed.storage,
          modesInput
        )(setup.limits).pipe(
          Effect.provideContext(setup.provided),
          Effect.provideService(CitationTextBudget, setup.budget)
        );
      const derived = yield* derive(parent, modes);
      strictEqual(derived._tag, "Derived");
      const forged = yield* derive({ ...parent.source }, modes).pipe(Effect.flip);
      deepStrictEqual("reason" in forged ? forged.reason : forged._tag, "invalid-input");
      const unknown = yield* derive(parent, { ...modes, role: "unknown" }).pipe(Effect.flip);
      deepStrictEqual("reason" in unknown ? unknown.reason : unknown._tag, "invalid-input");
    })
  );
});
