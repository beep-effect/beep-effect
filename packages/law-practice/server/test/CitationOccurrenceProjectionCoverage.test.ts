import * as NodeURL from "node:url";
import { getCitationExtractionShortcut } from "@beep/law-practice-server/internal/Citation/ExtractionShortcut";
import { makeCitationOccurrenceProjection } from "@beep/law-practice-server/internal/Citation/OccurrenceProjection";
import { makeCitationSemanticProjection } from "@beep/law-practice-server/internal/Citation/SemanticProjection";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Str from "effect/String";
import { citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { setupCitationMetadataRuntime } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";

const artifact = Sha256Hex.make(Str.repeat(64)("a"));
const refusal = (failure: { readonly _tag: string }) => ({
  _tag: failure._tag,
  detail: "limit" in failure ? failure.limit : "reason" in failure ? failure.reason : undefined,
});
const loadVocabulary = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(
    NodeURL.fileURLToPath(new URL("../assets/citation/semantic-editions.json", import.meta.url))
  );
});
// The original "eyecite" shortcut is a complete raw outcome without native
// tokenizer work, so its semantic meaning comes from the real projection stage.
const install = Effect.fnUntraced(function* (narrow: Partial<CitationEngineLimits> = {}) {
  const setup = yield* setupCitationMetadataRuntime("bun", undefined, false, true, 8192);
  const vocabulary = yield* loadVocabulary();
  const semantic = yield* makeCitationSemanticProjection(setup.limits, setup.runtime, {
    editions: [],
    vocabulary,
  }).pipe(Effect.provideContext(setup.provided));
  const models = yield* Effect.fromOption(getCitationExtractionShortcut("eyecite"));
  const citations = yield* Effect.forEach(models, semantic.project);
  const stage = yield* makeCitationOccurrenceProjection({ ...setup.limits, ...narrow }, setup.runtime, {
    engineArtifact: artifact,
  }).pipe(Effect.provideContext(setup.provided));
  const shortcut = (rows = models, meanings = citations) => ({
    raw: { outcome: { _tag: "Shortcut", citations: rows }, reservedUnits: 0 },
    citations: meanings,
    reservedUnits: 0,
  });
  return { stage, models, citations, shortcut };
});

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("occurrence projection refusals", (it) => {
  it.effect("refuses an engine artifact configuration that is not a trusted digest", () =>
    Effect.gen(function* () {
      const setup = yield* setupCitationMetadataRuntime("bun");
      const failure = yield* makeCitationOccurrenceProjection(setup.limits, setup.runtime, {
        engineArtifact: "not-a-digest",
      }).pipe(Effect.provideContext(setup.provided), Effect.flip);
      deepStrictEqual(refusal(failure), {
        _tag: "CitationOccurrenceProjectionFailure",
        detail: "invalid-configuration",
      });
    })
  );
  it.effect("refuses a projection request without a completed semantic extraction", () =>
    Effect.gen(function* () {
      const { stage } = yield* install();
      const source = yield* citationFixtureSourceProof("1 U.S. 1");
      for (const raw of [null, { source }, { source, result: {} }]) {
        const failure = yield* stage.project(raw).pipe(Effect.flip);
        deepStrictEqual(refusal(failure), { _tag: "CitationOccurrenceProjectionFailure", detail: "invalid-input" });
      }
    })
  );
  it.effect("keeps every shortcut occurrence explicitly unverified against the shortcut source", () =>
    Effect.gen(function* () {
      const { stage, citations, shortcut } = yield* install();
      const source = yield* citationFixtureSourceProof("eyecite");
      const projected = yield* stage.project({ source, result: shortcut() });
      deepStrictEqual(
        {
          mentions: projected.mentions,
          unverified: projected.unverified,
          unverifiedComponents: projected.unverifiedComponents,
          unboundWarnings: projected.unboundWarnings,
        },
        {
          mentions: [],
          unverified: A.map(citations, (citation, index) => ({ index, citation, reason: "shortcut" as const })),
          unverifiedComponents: [],
          unboundWarnings: [],
        }
      );
    })
  );
  it.effect("refuses shortcut results bound to another source or with mismatched model and meaning counts", () =>
    Effect.gen(function* () {
      const { stage, models, citations, shortcut } = yield* install();
      const eyecite = yield* citationFixtureSourceProof("eyecite");
      const other = yield* citationFixtureSourceProof("not eyecite");
      const mismatch = yield* stage.project({ source: other, result: shortcut() }).pipe(Effect.flip);
      deepStrictEqual(refusal(mismatch), { _tag: "CitationOccurrenceProjectionFailure", detail: "source-mismatch" });
      const missing = yield* stage.project({ source: eyecite, result: shortcut(models, []) }).pipe(Effect.flip);
      deepStrictEqual(refusal(missing), { _tag: "CitationOccurrenceProjectionFailure", detail: "invalid-input" });
      // A shortcut binds one original model id; a second row has no id to claim.
      const doubled = yield* stage
        .project({ source: eyecite, result: shortcut(A.appendAll(models, models), A.appendAll(citations, citations)) })
        .pipe(Effect.flip);
      deepStrictEqual(refusal(doubled), { _tag: "CitationOccurrenceProjectionFailure", detail: "invalid-input" });
    })
  );
  it.effect("refuses sources beyond the effective extract source limit", () =>
    Effect.gen(function* () {
      const narrowSource = yield* install({ sourceUtf16: 3 });
      const eyecite = yield* citationFixtureSourceProof("eyecite");
      const longSource = yield* narrowSource.stage
        .project({ source: eyecite, result: narrowSource.shortcut() })
        .pipe(Effect.flip);
      deepStrictEqual(refusal(longSource), { _tag: "CitationSafetyLimitExceeded", detail: "sourceUtf16" });
    })
  );
});
