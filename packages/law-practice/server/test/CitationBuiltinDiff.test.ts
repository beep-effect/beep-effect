import { ResolvedSourceText, SourceTextResolver } from "@beep/file-processing/SourceText";
import { runCitationBuiltinDiff } from "@beep/law-practice-server/internal/Citation/BuiltinDiff";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { makeCitationSpanOffsets } from "@beep/law-practice-server/internal/Citation/SpanOffsets";
import {
  CitationAnnotationReplacement,
  CitationEngineAnnotationInput,
  CitationPythonUnicodeStorage,
} from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { readCitationBuiltinDiffCorpus } from "./CitationBuiltinDiff.fixtures.ts";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { makeCitationDiffWorkerFixture } from "./CitationDiffWorker.fixtures.ts";
import { buildCitationDefaultEngineFixture } from "./CitationEngineLayer.fixtures.ts";
import { citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { readCitationSpanOffsetsCorpus } from "./CitationSpanOffsets.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "original builtin SequenceMatcher",
  (it) => {
    it.effect(
      "matches all 4231 independent short, Unicode, tie, no-autojunk and seeded observations",
      () =>
        Effect.gen(function* () {
          const corpus = yield* readCitationBuiltinDiffCorpus();
          const { limits } = yield* defaultCitationEnginePolicy;
          for (const row of corpus.cases) {
            const request = {
              before: CitationPythonUnicodeStorage.make(row.before),
              after: CitationPythonUnicodeStorage.make(row.after),
              maximumSteps: limits.diffSteps,
              maximumInputUtf16: limits.diffInputUtf16,
              maximumOutputBytes: 8 * limits.diffSteps,
            };
            const steps = yield* runCitationBuiltinDiff(request);
            expect(steps, `original case ${row.id}`).toEqual(row.steps);
            if (row.steps.length > 0) {
              const refused = yield* runCitationBuiltinDiff({ ...request, maximumSteps: row.steps.length - 1 }).pipe(
                Effect.flip
              );
              expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "diffSteps" });
            }
          }
          expect(A.filter(corpus.cases, (row) => row.origin === "short-binary")).toHaveLength(3969);
          const astral = A.getUnsafe(corpus.cases, 3969);
          const inputBound = yield* runCitationBuiltinDiff({
            before: CitationPythonUnicodeStorage.make(astral.before),
            after: CitationPythonUnicodeStorage.make(astral.after),
            maximumSteps: limits.diffSteps,
            maximumInputUtf16: 2,
            maximumOutputBytes: 8 * limits.diffSteps,
          }).pipe(Effect.flip);
          expect(inputBound).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "diffInputUtf16" });
          const one = A.getUnsafe(corpus.cases, 1);
          const outputBound = yield* runCitationBuiltinDiff({
            before: CitationPythonUnicodeStorage.make(one.before),
            after: CitationPythonUnicodeStorage.make(one.after),
            maximumSteps: limits.diffSteps,
            maximumInputUtf16: limits.diffInputUtf16,
            maximumOutputBytes: 0,
          }).pipe(Effect.flip);
          expect(outputBound).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "processMessageBytes" });
        }),
      { timeout: 120000 }
    );
    it.effect("matches every original builtin SpanUpdater entry and left/right query", () =>
      Effect.gen(function* () {
        const { corpus, limits, plans } = yield* readCitationSpanOffsetsCorpus();
        let maps = 0;
        let queries = 0;
        for (const row of A.filter(corpus.maps, (row) => row.engine === "builtin")) {
          const steps = yield* runCitationBuiltinDiff({
            before: CitationPythonUnicodeStorage.make(row.before),
            after: CitationPythonUnicodeStorage.make(row.after),
            maximumSteps: limits.diffSteps,
            maximumInputUtf16: limits.diffInputUtf16,
            maximumOutputBytes: 8 * limits.diffSteps,
          });
          expect(steps).toEqual(row.steps);
          const map = yield* makeCitationSpanOffsets(limits, { ...A.getUnsafe(plans, row.id), steps });
          const snapshot = yield* map.snapshot;
          expect(snapshot).toEqual(row.entries);
          for (const query of row.queries) {
            if (query.error !== null) {
              const refused = yield* map.update(query.position, query.side).pipe(Effect.flip);
              expect(refused).toMatchObject({ _tag: "CitationSpanOffsetsFailure", reason: "empty-map" });
            } else {
              const value = yield* map.update(query.position, query.side);
              expect(value).toBe(query.value);
            }
            queries++;
          }
          maps++;
        }
        expect(maps).toBe(19);
        expect(queries).toBe(328);
      })
    );
    for (const kind of ["bun", "node"] as const) {
      it.effect(
        `executes builtin steps in the existing acknowledged ${kind} child`,
        () =>
          Effect.gen(function* () {
            const corpus = yield* readCitationBuiltinDiffCorpus();
            const { limits } = yield* defaultCitationEnginePolicy;
            const { worker, admission, observed } = yield* makeCitationDiffWorkerFixture(kind, limits, false);
            const ids = [0, 1, 33, 257, 3969, 3971, 3984, 4164, 4165, 4166, 4230];
            const rows = A.filter(corpus.cases, (row) => A.contains(ids, row.id));
            expect(rows).toHaveLength(ids.length);
            for (const row of rows) {
              const steps = yield* worker.evaluate(
                CitationPythonUnicodeStorage.make(row.before),
                CitationPythonUnicodeStorage.make(row.after)
              );
              expect(steps, `${kind}:${row.id}`).toEqual(row.steps);
            }
            const counts = yield* observed.snapshot;
            const state = yield* admission.snapshot;
            const physical = yield* worker.snapshot;
            expect(counts).toEqual({ spawned: ids.length, confirmed: ids.length });
            expect(state).toMatchObject({ active: 0, regexActive: 0, queued: 0, quarantined: 0 });
            expect(physical).toMatchObject({ processes: 0, quarantined: 0 });
          }),
        { timeout: 120000 }
      );
    }
    for (const kind of ["bun", "node"] as const) {
      it.effect(
        `preserves original builtin annotation through the default public engine on ${kind}`,
        () =>
          Effect.gen(function* () {
            const corpus = yield* readCitationBuiltinDiffCorpus();
            const installed = yield* installCitationDefaultConfigurationFixture(kind);
            const unicode = yield* makeCitationPythonUnicode(installed.setup.limits, "annotate");
            const sameSource = S.toEquivalence(SourceTextIdentity);
            let plain = yield* citationFixtureSourceProof("initial");
            let markup = plain;
            const resolver = SourceTextResolver.of({
              resolve: Effect.fn("BuiltinAnnotationTest.resolve")((request) =>
                Effect.sync(() => {
                  const proof = sameSource(request.identity, plain.source) ? plain : markup;
                  return ResolvedSourceText.make({ identity: proof.source, text: proof.sourceText });
                })
              ),
            });
            const { engine } = yield* buildCitationDefaultEngineFixture(installed, resolver);
            const rows = A.filter(corpus.annotations, (row) => !row.useDmp || row.id === 0);
            expect(rows).toHaveLength(6);
            for (const row of rows) {
              const originalPlain = yield* unicode.fromStorage(CitationPythonUnicodeStorage.make(row.plain));
              const originalSource = yield* unicode.fromStorage(CitationPythonUnicodeStorage.make(row.source));
              if (row.id === 9) {
                const refused = yield* citationFixtureSourceProof(originalPlain.text).pipe(Effect.flip);
                expect(refused).toMatchObject({ _tag: "VerifiedTextAnchorError" });
                continue;
              }
              plain = yield* citationFixtureSourceProof(originalPlain.text);
              markup = yield* citationFixtureSourceProof(originalSource.text);
              const input = CitationEngineAnnotationInput.make({
                plain: { source: plain.source, sourceText: plain.sourceText },
                markup: { source: markup.source, sourceText: markup.sourceText },
                useDmp: row.useDmp,
                mode: "unchecked",
                replacements: [
                  CitationAnnotationReplacement.make({
                    start: row.start,
                    end: row.end,
                    before: CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array([91]) }),
                    after: CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array([93]) }),
                  }),
                ],
              });
              const result = yield* engine.annotate(input);
              expect(row.error).toBe(null);
              expect(result.text, `${kind}:original annotation ${row.id}`).toEqual(row.output);
              expect(result.source.source).toEqual(markup.source);
            }
            const counts = yield* installed.setup.observed.snapshot;
            expect(counts.confirmed).toBe(counts.spawned);
          }),
        { timeout: 180000 }
      );
    }
  }
);
