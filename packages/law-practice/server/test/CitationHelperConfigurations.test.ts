import * as NodeURL from "node:url";
import { CitationExtractionLoopConfiguration } from "@beep/law-practice-server/internal/Citation/ExtractionLoop";
import {
  loadCitationHelperConfigurations,
  makeCitationHelperConfigurations,
} from "@beep/law-practice-server/internal/Citation/HelperConfigurations";
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
import * as TestClock from "effect/testing/TestClock";
import { installCitationExtractionLoopFixture } from "./CitationExtractionLoop.fixtures.ts";
import { readCitationHtmlDiscoveryCorpus } from "./CitationHtmlDiscovery.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const assetPath = NodeURL.fileURLToPath(new URL("../assets/citation/helper-configurations.data", import.meta.url));
const sameLoop = S.toEquivalence(CitationExtractionLoopConfiguration);
const setYear = Effect.fn("HelperConfigurationsTest.setYear")(function* (year: number) {
  const date = yield* Effect.fromOption(DateTime.make({ year, month: 6, day: 1 }));
  yield* date.pipe(DateTime.toEpochMillis, TestClock.setTime);
});
it.layer(citationTokenizerTestLayer)("production helper configurations", (it) => {
  it.layer(TestClock.layer())("installation clock", (it) => {
    it.effect(
      "matches all independently loaded helpers and captures one shared calendar cutoff",
      () =>
        Effect.gen(function* () {
          const expected = yield* installCitationExtractionLoopFixture("bun");
          const discovery = yield* readCitationHtmlDiscoveryCorpus();
          yield* setYear(2026);
          const installed = yield* makeCitationHelperConfigurations(
            expected.setup.limits,
            assetPath,
            expected.configuration.full.editions
          ).pipe(DateTime.withCurrentZoneOffset(0));
          expect(sameLoop(installed.loop, expected.configuration)).toBe(true);
          expect(installed.discovery).toEqual(discovery.configuration);
          yield* setYear(2040);
          const later = yield* makeCitationHelperConfigurations(
            expected.setup.limits,
            assetPath,
            expected.configuration.full.editions
          ).pipe(DateTime.withCurrentZoneOffset(0));
          const bounds = [
            later.loop.full.case.post.highestValidYear,
            later.loop.full.case.pre.highestValidYear,
            later.loop.full.law.highestValidYear,
            later.loop.full.journal.highestValidYear,
            later.loop.reference.pin.highestValidYear,
          ];
          expect(bounds).toEqual([2041, 2041, 2041, 2041, 2041]);
          expect(sameLoop(installed.loop, expected.configuration)).toBe(true);
          const counts = yield* expected.setup.observed.snapshot;
          expect(counts).toEqual({ spawned: 0, confirmed: 0 });
        }),
      { timeout: 60000 }
    );
  });
  it.effect("refuses changed, truncated, appended and absent assets", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const original = yield* fs.readFile(assetPath);
      const directory = yield* fs.makeTempDirectoryScoped({ prefix: "citation-helpers-" });
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
        const failure = yield* loadCitationHelperConfigurations(target).pipe(Effect.flip);
        expect(failure).toMatchObject({ reason: "artifact-mismatch" });
      }
      const absent = yield* loadCitationHelperConfigurations(path.join(directory, "absent.data")).pipe(Effect.flip);
      expect(absent).toMatchObject({ reason: "unavailable" });
    })
  );
});
