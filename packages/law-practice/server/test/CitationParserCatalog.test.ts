import * as NodeURL from "node:url";
import {
  loadCitationParserCatalog,
  makeCitationParserCatalog,
} from "@beep/law-practice-server/internal/Citation/ParserCatalog";
import { CitationTokenizerConfiguration } from "@beep/law-practice-server/internal/Citation/Tokenizer";
import {
  CitationCanonicalTokenizerMetadata,
  makeCitationCanonicalTokenizerCatalog,
} from "@beep/law-practice-server/internal/Citation/TokenizerCatalog";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Bytes from "effect/Bytes";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { loadCitationCanonicalTokenizerControls } from "./CitationCanonicalTokenizer.fixtures.ts";
import { loadCitationFrozenEditionFixtures } from "./CitationFrozenEditions.fixtures.ts";
import { setupCitationMetadataRuntime } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const assetPath = NodeURL.fileURLToPath(new URL("../assets/citation/parser-catalog.data", import.meta.url));
const sameMetadata = S.toEquivalence(CitationCanonicalTokenizerMetadata);
const sameTokenizer = S.toEquivalence(CitationTokenizerConfiguration);
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("production parser catalog", (it) => {
  it.effect(
    "matches complete independently sealed fixture installation without native execution",
    () =>
      Effect.gen(function* () {
        const setup = yield* setupCitationMetadataRuntime("bun", undefined, false, true, 8192);
        const loaded = yield* loadCitationParserCatalog(assetPath);
        const original = yield* loadCitationCanonicalTokenizerControls();
        const publications = yield* loadCitationFrozenEditionFixtures();
        expect(loaded.payload).toBe(original.payload);
        expect(sameMetadata(loaded.metadata, CitationCanonicalTokenizerMetadata.make(original.metadata))).toBe(true);
        expect(loaded.frozen).toEqual(publications.bundle);
        const installed = yield* makeCitationParserCatalog(setup.limits, assetPath).pipe(
          Effect.provideContext(setup.provided)
        );
        const expected = yield* makeCitationCanonicalTokenizerCatalog(
          setup.limits,
          original.payload,
          original.metadata
        ).pipe(Effect.provideContext(setup.provided));
        expect(sameTokenizer(installed.tokenizer, expected)).toBe(true);
        expect(installed.tokenizer.extractors).toHaveLength(6805);
        expect(installed.tokenizer.editions).toHaveLength(2533);
        const counts = yield* setup.observed.snapshot;
        expect(counts).toEqual({ spawned: 0, confirmed: 0 });
      }),
    { timeout: 60000 }
  );
  it.effect("refuses changed, truncated, appended and absent assets through closed errors", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const original = yield* fs.readFile(assetPath);
      const directory = yield* fs.makeTempDirectoryScoped({ prefix: "citation-catalog-control-" });
      const changed = new Uint8Array(original);
      changed[0] = 0;
      const cases = [
        changed,
        original.subarray(0, original.length - 1),
        Bytes.concat([original, new Uint8Array([32])]),
      ];
      for (const [bytes, index] of A.map(cases, (bytes, index) => [bytes, index] as const)) {
        const target = path.join(directory, `${index}.data`);
        yield* fs.writeFile(target, bytes);
        const failed = yield* loadCitationParserCatalog(target).pipe(Effect.flip);
        expect(failed).toMatchObject({ reason: "artifact-mismatch" });
      }
      const unavailable = yield* loadCitationParserCatalog(path.join(directory, "absent.data")).pipe(Effect.flip);
      expect(unavailable).toMatchObject({ reason: "unavailable" });
    })
  );
});
