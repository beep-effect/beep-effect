import { CitationEditionRef } from "@beep/law-practice-domain/values";
import { makeCitationFullExtraction } from "@beep/law-practice-server/internal/Citation/FullExtraction";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { readCitationCaseMetadataConfiguration } from "./CitationCaseMetadata.fixtures.ts";
import { installCitationFrozenMetadataRuntime } from "./CitationFrozenEditions.fixtures.ts";
import { makeCitationTestInvocationBinding } from "./CitationInvocation.fixtures.ts";
import { readCitationJournalMetadataCorpus } from "./CitationJournalMetadata.fixtures.ts";
import { loadCitationLawMetadataFixtures } from "./CitationLawMetadata.fixtures.ts";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const Bindings = S.fromJsonString(
  S.Struct({ bindings: S.Array(S.Struct({ id: S.Natural, ref: CitationEditionRef })) })
);

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("full-citation refusals", (it) => {
  it.effect(
    "refuses malformed configuration and malformed requests before dispatch",
    () =>
      Effect.gen(function* () {
        const corpus = yield* readCitationOracleFixture(
          "full-extraction",
          "a303ae5063b50d3af5344aefd0e43826412e932265778f7a46936af058c93b1c"
        ).pipe(Effect.flatMap(S.decodeEffect(Bindings)));
        const cases = yield* readCitationCaseMetadataConfiguration();
        const laws = yield* loadCitationLawMetadataFixtures();
        const journals = yield* readCitationJournalMetadataCorpus();
        const setup = yield* installCitationFrozenMetadataRuntime("bun");
        const make = (configuration: unknown) =>
          makeCitationFullExtraction(setup.limits, setup.runtime, configuration).pipe(
            Effect.flatMap((stage) =>
              makeCitationTestInvocationBinding(setup.limits).pipe(
                Effect.map((bind) => ({ ...stage, extract: bind(stage.extract) }))
              )
            ),
            Effect.provideContext(setup.provided),
            DateTime.withCurrentZoneOffset(0)
          );
        const malformed = yield* make({ editions: corpus.bindings }).pipe(Effect.flip);
        expect(malformed).toMatchObject({ _tag: "CitationFullExtractionFailure", reason: "invalid-configuration" });
        const stage = yield* make({
          editions: corpus.bindings,
          case: cases,
          law: laws.configuration,
          journal: journals.configuration,
        });
        const invalid = yield* stage.extract({ index: -1, words: null }).pipe(Effect.flip);
        expect(invalid).toMatchObject({ _tag: "CitationFullExtractionFailure", reason: "invalid-input" });
      }),
    { timeout: 10_000 }
  );
});
