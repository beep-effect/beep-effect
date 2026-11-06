import { deriveCitationCanonicalSource } from "@beep/law-practice-server/internal/Citation/CanonicalSource";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { CitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";
import { citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { setupCitationMetadataRuntime } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("canonical text manifestation", (it) => {
  it.effect("retains unchanged proof and gives changed text deterministic, versioned parent lineage", () =>
    Effect.gen(function* () {
      const setup = yield* setupCitationMetadataRuntime("bun");
      const artifact = Sha256Hex.make(Str.repeat(64)("a"));
      const parent = yield* citationFixtureSourceProof("<p>Visible 😀</p>");
      const unicode = yield* makeCitationPythonUnicode(setup.limits);
      const original = yield* unicode.fromText(parent.sourceText);
      const changed = yield* unicode.fromText("Visible 😀");
      const modes = { role: "markup", cleanSteps: ["html"], container: "list" };
      const derive = (native: unknown, invocation = modes, engineArtifact = artifact) =>
        deriveCitationCanonicalSource(setup.limits, engineArtifact, parent, native, invocation).pipe(
          Effect.provideContext(setup.provided),
          Effect.provideService(CitationTextBudget, setup.budget)
        );
      const unchanged = yield* derive(original.storage);
      expect(unchanged._tag).toBe("Unchanged");
      expect(unchanged.source).toBe(parent);
      const first = yield* derive(changed.storage);
      const second = yield* derive(changed.storage);
      expect(first._tag).toBe("Derived");
      expect(first.source.source).toEqual(second.source.source);
      expect(first.parent).toEqual(parent.source);
      expect(first.source.source.sourceDigest).toBe(parent.source.sourceDigest);
      expect(first.source.source.sourceRef).toBe(parent.source.sourceRef);
      expect(first.source.source.locator).toBe(parent.source.locator);
      expect(first.source.source.scopeRef).toBe(parent.source.scopeRef);
      expect(first.source.source.normalizationVersion).toBe(parent.source.normalizationVersion);
      expect(first.source.sourceText).toBe("Visible 😀");
      const changedMode = yield* derive(changed.storage, { ...modes, container: "tuple" });
      expect(changedMode.source.source.textDigest).toBe(first.source.source.textDigest);
      expect(changedMode.source.source.extractor.version).not.toBe(first.source.source.extractor.version);
      const changedVersion = yield* derive(changed.storage, modes, Sha256Hex.make(Str.repeat(64)("b")));
      expect(changedVersion.source.source.extractor.version).not.toBe(first.source.source.extractor.version);
      const invalid = yield* derive({ width: 2, bytes: new Uint8Array([0, 0xd8]) }).pipe(Effect.flip);
      expect(invalid).toMatchObject({ reason: "unverifiable-text" });
      const observed = yield* setup.observed.snapshot;
      expect(observed).toEqual({ spawned: 0, confirmed: 0 });
    })
  );
});
