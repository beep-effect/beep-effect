/** Pinned eyecite short-form missing-page observations, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { ResolvedSourceText, SourceTextResolver } from "@beep/file-processing/SourceText";
import { Citation } from "@beep/law-practice-domain/values";
import { normalizeCitationModelPage } from "@beep/law-practice-server/internal/Citation/ExtractionContext";
import {
  CitationEngineSourcePairInput,
  CitationPythonUnicodeStorage,
  CitationTokenSeed,
} from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { projectCitationCanonicalExpectedMetadata } from "./CitationCanonicalAttributes.fixtures.ts";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { buildCitationDefaultEngineFixture } from "./CitationEngineLayer.fixtures.ts";
import { assertCitationMentionRanges, citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { projectCitationSemanticMetadata } from "./CitationSemanticExtraction.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const Fields = S.Record(S.String, S.NullOr(S.String));
const Span = S.Tuple([S.Int, S.Int]);
const Capture = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-short-missing-page/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    license: S.tag("BSD-2-Clause"),
    python: S.tag("3.11.15"),
    cases: S.Array(
      S.Struct({
        input: S.String,
        citations: S.Array(
          S.Struct({
            kind: S.tag("ShortCaseCitation"),
            groups: Fields,
            metadata: Fields,
            span: Span,
            fullSpan: Span,
            spanWithPincite: Span,
            matchedText: S.String,
          })
        ).check(S.isBetweenLength(1, 1)),
      })
    ).check(S.isBetweenLength(2, 2)),
  })
);

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "original short-form missing pages",
  (it) => {
    it.effect("normalizes only underscore pages and preserves the raw token and other groups", () =>
      Effect.gen(function* () {
        const encoder = new TextEncoder();
        const raw = CitationPythonUnicodeStorage.make({ width: 1, bytes: encoder.encode("raw") });
        const cases: ReadonlyArray<readonly [string, boolean]> = [
          ["", false],
          ["\n", false],
          ["_a", false],
          ["___", true],
          ["__\n", true],
          [Str.repeat(4096)("_"), true],
        ];
        yield* Effect.forEach(
          cases,
          Effect.fnUntraced(function* ([text, missing]) {
            const page = CitationPythonUnicodeStorage.make({ width: 1, bytes: encoder.encode(text) });
            const token = CitationTokenSeed.make({
              kind: "CitationToken",
              data: raw,
              start: 0,
              end: 3,
              groups: { page, volume: raw },
              exact: [3],
              variation: [4],
              short: true,
            });
            const normalized = yield* normalizeCitationModelPage(token);
            expect(normalized).toMatchObject({
              kind: token.kind,
              data: raw,
              start: 0,
              end: 3,
              groups: { page: missing ? null : page, volume: raw },
              exact: [3],
              variation: [4],
              short: true,
            });
          }),
          { discard: true }
        );
      })
    );

    for (const kind of ["bun", "node"] as const) {
      it.effect(
        `preserves the raw pin prefix before normalizing model pages on ${kind}`,
        () =>
          Effect.gen(function* () {
            const raw = yield* readCitationOracleFixture(
              "short-missing-page",
              "c6066e527726aa524731ab922abed61f32c3f4f19bd1fe918018b7c26c24eb60"
            );
            const corpus = yield* S.decodeEffect(Capture)(raw);
            const installed = yield* installCitationDefaultConfigurationFixture(kind);
            let proof = yield* citationFixtureSourceProof("initial");
            const resolver = SourceTextResolver.of({
              resolve: Effect.fn("ShortMissingPageTest.resolve")(() =>
                Effect.succeed(ResolvedSourceText.make({ identity: proof.source, text: proof.sourceText }))
              ),
            });
            const { engine } = yield* buildCitationDefaultEngineFixture(installed, resolver);
            for (const row of corpus.cases) {
              proof = yield* citationFixtureSourceProof(row.input);
              const result = yield* engine.extract(
                CitationEngineSourcePairInput.make({
                  plain: { source: proof.source, sourceText: proof.sourceText },
                  markup: null,
                  cleanSteps: [],
                  removeAmbiguous: false,
                  container: "list",
                })
              );
              expect(result.citations).toHaveLength(1);
              expect(result.document.mentions).toHaveLength(1);
              const citation = A.getUnsafe(result.citations, 0);
              const expected = A.getUnsafe(row.citations, 0);
              const encoded = yield* S.encodeEffect(Citation)(citation);
              expect(encoded.type).toBe("shortFormCase");
              expect(encoded.components).toEqual(expected.groups);
              const metadata = yield* projectCitationSemanticMetadata(citation);
              expect(metadata).toEqual(projectCitationCanonicalExpectedMetadata(expected.metadata));
              yield* assertCitationMentionRanges(row.input, A.getUnsafe(result.document.mentions, 0), expected);
              expect(Str.slice(...expected.fullSpan)(row.input)).toBe(expected.matchedText);
              expect(result.diagnostics.unverified).toEqual([]);
              expect(result.diagnostics.unverifiedComponents).toEqual([]);
            }
            const counts = yield* installed.setup.observed.snapshot;
            expect(counts.confirmed).toBe(counts.spawned);
          }),
        { timeout: 180000 }
      );
    }
  }
);
