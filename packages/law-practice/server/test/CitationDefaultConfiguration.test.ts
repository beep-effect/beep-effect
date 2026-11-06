import * as NodeURL from "node:url";
import { makeCitationDefaultConfiguration } from "@beep/law-practice-server/internal/Citation/DefaultConfiguration";
import { CitationSemanticExtractionConfiguration } from "@beep/law-practice-server/internal/Citation/SemanticExtraction";
import { loadCitationSemanticVocabularyAsset } from "@beep/law-practice-server/internal/Citation/SemanticVocabulary";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Bytes from "effect/Bytes";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { installCitationDocumentExtractionFixture } from "./CitationDocumentExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const asset = (name: string) => NodeURL.fileURLToPath(new URL(`../assets/citation/${name}`, import.meta.url));
const same = S.toEquivalence(CitationSemanticExtractionConfiguration);
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })(
  "production default extraction configuration",
  (it) => {
    it.effect(
      "assembles the complete independent configuration without native execution",
      () =>
        Effect.gen(function* () {
          const expected = yield* installCitationDocumentExtractionFixture("bun");
          const fs = yield* FileSystem.FileSystem;
          const vocabulary = yield* fs.readFileString(asset("semantic-editions.json"));
          const actual = yield* makeCitationDefaultConfiguration(expected.setup.limits, {
            parserCatalog: asset("parser-catalog.data"),
            helpers: asset("helper-configurations.data"),
            vocabulary: asset("semantic-editions.json"),
            diffRuntime: expected.configuration.document.diffRuntime,
          }).pipe(Effect.provideContext(expected.provided), DateTime.withCurrentZoneOffset(0));
          const original = CitationSemanticExtractionConfiguration.make({
            extraction: expected.configuration,
            semantic: { vocabulary, editions: expected.configuration.extraction.loop.full.editions },
          });
          expect(same(actual.configuration, original)).toBe(true);
          expect(actual.configuration.semantic.editions).toHaveLength(2533);
          expect(actual.assets.vocabulary).toBe("9e3e5f9539e13f0cfce17489ece472686e11c9ccc446ba7d71319d8680c0dba8");
          const counts = yield* expected.setup.observed.snapshot;
          expect(counts).toEqual({ spawned: 0, confirmed: 0 });
          const invalid = yield* makeCitationDefaultConfiguration(expected.setup.limits, {}).pipe(
            DateTime.withCurrentZoneOffset(0),
            Effect.flip
          );
          expect(invalid._tag).toBe("CitationDefaultConfigurationFailure");
        }),
      { timeout: 60000 }
    );
    it.effect("refuses changed, truncated, appended and unavailable vocabulary assets", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const original = yield* fs.readFile(asset("semantic-editions.json"));
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "citation-vocabulary-" });
        const changed = new Uint8Array(original);
        changed[0] = 0;
        const cases = [
          changed,
          original.subarray(0, original.length - 1),
          Bytes.concat([original, new Uint8Array([32])]),
        ];
        for (const [bytes, index] of A.map(cases, (bytes, index) => Tuple.make(bytes, index))) {
          const target = path.join(directory, `${index}.data`);
          yield* fs.writeFile(target, bytes);
          const failure = yield* loadCitationSemanticVocabularyAsset(target).pipe(Effect.flip);
          expect(failure).toMatchObject({ reason: "artifact-mismatch" });
        }
        const absent = yield* loadCitationSemanticVocabularyAsset(path.join(directory, "absent.data")).pipe(
          Effect.flip
        );
        expect(absent).toMatchObject({ reason: "artifact-mismatch" });
      })
    );
  }
);
