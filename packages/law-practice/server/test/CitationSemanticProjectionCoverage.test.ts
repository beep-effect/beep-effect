import * as NodeURL from "node:url";
import { Citation, CitationEditionRef } from "@beep/law-practice-domain/values";
import { getCitationExtractionShortcut } from "@beep/law-practice-server/internal/Citation/ExtractionShortcut";
import { makeCitationSemanticProjection } from "@beep/law-practice-server/internal/Citation/SemanticProjection";
import { makeCitationSemanticVocabulary } from "@beep/law-practice-server/internal/Citation/SemanticVocabulary";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertFalse, assertTrue, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { setupCitationMetadataRuntime } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const load = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(
    NodeURL.fileURLToPath(new URL("../assets/citation/semantic-editions.json", import.meta.url))
  );
});
const unknownEdition = S.decodeEffect(CitationEditionRef)(Str.repeat(64)("0"));
const install = Effect.fnUntraced(function* (configuration: unknown) {
  const setup = yield* setupCitationMetadataRuntime("bun", undefined, false, true, 8192);
  return yield* makeCitationSemanticProjection(setup.limits, setup.runtime, configuration).pipe(
    Effect.provideContext(setup.provided)
  );
});

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("semantic projection refusals", (it) => {
  it.effect("refuses non-text vocabulary input and unknown edition identities", () =>
    Effect.gen(function* () {
      const invalid = yield* makeCitationSemanticVocabulary(42).pipe(Effect.flip);
      expect(invalid).toMatchObject({ _tag: "CitationSemanticVocabularyFailure", reason: "invalid-configuration" });
      const raw = yield* load();
      const vocabulary = yield* makeCitationSemanticVocabulary(raw);
      const edition = yield* unknownEdition;
      const missing = yield* vocabulary.lookup(edition, "case").pipe(Effect.flip);
      expect(missing).toMatchObject({ reason: "missing-edition" });
    })
  );

  it.effect("refuses malformed configuration and duplicate local edition ids", () =>
    Effect.gen(function* () {
      const malformed = yield* install({ editions: "none" }).pipe(Effect.flip);
      expect(malformed).toMatchObject({ _tag: "CitationSemanticProjectionFailure", reason: "invalid-configuration" });
      const vocabulary = yield* load();
      const ref = yield* unknownEdition;
      const duplicate = yield* install({
        editions: [
          { id: 1, ref },
          { id: 1, ref },
        ],
        vocabulary,
      }).pipe(Effect.flip);
      expect(duplicate).toMatchObject({ _tag: "CitationSemanticProjectionFailure", reason: "invalid-configuration" });
    })
  );

  it.effect("refuses malformed models and keeps an absent short-case plaintiff absent", () =>
    Effect.gen(function* () {
      const vocabulary = yield* load();
      const stage = yield* install({ editions: [], vocabulary });
      const invalid = yield* stage.project({ outcome: "not a model" }).pipe(Effect.flip);
      expect(invalid).toMatchObject({ _tag: "CitationSemanticProjectionFailure", reason: "invalid-input" });
      const models = yield* Effect.fromOption(getCitationExtractionShortcut("eyecite"));
      const original = A.getUnsafe(models, 0);
      const short = {
        index: original.index,
        token: original.token,
        reservedUnits: 0,
        outcome: {
          _tag: "ShortCaseCitation",
          spanEnd: null,
          fullSpanStart: null,
          fullSpanEnd: null,
          year: null,
          editionGuess: null,
          metadata: {
            pinCite: null,
            parenthetical: null,
            pinCiteSpanStart: null,
            pinCiteSpanEnd: null,
            antecedentGuess: null,
            court: null,
            year: null,
            month: null,
            day: null,
          },
        },
      };
      const meaning = yield* stage.project(short);
      const encoded = yield* S.encodeEffect(Citation)(meaning);
      strictEqual(encoded.type, "shortFormCase");
      assertFalse("plaintiff" in encoded.metadata);
      assertTrue("antecedentGuess" in encoded.metadata);
    })
  );
});
