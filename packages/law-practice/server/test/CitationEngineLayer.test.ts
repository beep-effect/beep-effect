import { ResolvedSourceText, SourceTextResolver, SourceTextResolverError } from "@beep/file-processing/SourceText";
import { captureCitationMentionReceiptData } from "@beep/law-practice-server/internal/Citation/Mention";
import {
  CitationAnnotationReplacement,
  CitationEngineAnnotationInput,
  CitationEngineCleanInput,
  CitationEngineResolutionInput,
  CitationEngineSourcePairInput,
  CitationPythonUnicodeStorage,
} from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { buildCitationEngineFixture } from "./CitationEngineLayer.fixtures.ts";
import { citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { assertCitationWorkerCompositionObserved } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const word = (text: string) => CitationPythonUnicodeStorage.make({ width: 1, bytes: new TextEncoder().encode(text) });
it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "four-operation engine Layer",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      it.effect(
        `captures real server owners and executes all four operations on ${kind}`,
        () =>
          Effect.gen(function* () {
            const installed = yield* installCitationDefaultConfigurationFixture(kind);
            const { setup, adapter } = installed;
            const proof = yield* citationFixtureSourceProof("Foo v. Bar, 1 U.S. 1 (2000). Id. at 2.");
            const slot = { source: proof.source, sourceText: proof.sourceText };
            let sourceCalls = 0;
            const resolver = SourceTextResolver.of({
              resolve: Effect.fn("EngineLayerTest.resolve")(function* () {
                const state = yield* setup.operation.snapshot;
                expect(state).toMatchObject({ active: 1, queued: 0 });
                sourceCalls++;
                return ResolvedSourceText.make({ identity: proof.source, text: proof.sourceText });
              }),
            });
            const originalDeadline = Duration.toMillis(setup.limits.cleanDeadline);
            const { engine, configuration } = yield* buildCitationEngineFixture(installed, resolver);
            expect(Reflect.set(configuration.limits.cleanDeadline.value, "millis", 1)).toBe(true);
            const late = SourceTextResolver.of({
              resolve: Effect.fn("EngineLayerTest.late")(() =>
                Effect.fail(SourceTextResolverError.new("source-unavailable", "later resolver must be ignored"))
              ),
            });
            const steps = yield* adapter.create({ kind: "list", names: ["underscores"] });
            const plan = yield* adapter.document.plan(steps);
            const cleanInput = yield* S.decodeEffect(CitationEngineCleanInput)({ ...slot, plan });
            const cleaned = yield* engine.clean(cleanInput).pipe(Effect.provideService(SourceTextResolver, late));
            expect(O.getOrThrow(cleaned.text)).toEqual(word(proof.sourceText));
            expect(Duration.toMillis(cleaned.report.limits.cleanDeadline)).toBe(originalDeadline);
            const extractionInput = yield* S.decodeEffect(CitationEngineSourcePairInput)({
              plain: slot,
              cleanSteps: [],
            });
            const extracted = yield* engine
              .extract(extractionInput)
              .pipe(Effect.provideService(SourceTextResolver, late));
            expect(extracted.document.mentions).toHaveLength(2);
            expect(extracted.document.authorities).toHaveLength(1);
            const resolutionInput = CitationEngineResolutionInput.make({
              ...slot,
              mentions: A.map(extracted.document.mentions, captureCitationMentionReceiptData),
            });
            const resolved = yield* engine
              .resolve(resolutionInput)
              .pipe(Effect.provideService(SourceTextResolver, late));
            expect(resolved.document).toEqual(extracted.document);
            const annotationInput = yield* S.decodeEffect(CitationEngineAnnotationInput)({
              plain: slot,
              replacements: [
                CitationAnnotationReplacement.make({
                  start: 12,
                  end: 20,
                  before: word("<cite>"),
                  after: word("</cite>"),
                }),
              ],
            });
            const annotated = yield* engine
              .annotate(annotationInput)
              .pipe(Effect.provideService(SourceTextResolver, late));
            expect(annotated.text).toEqual(word("Foo v. Bar, <cite>1 U.S. 1</cite> (2000). Id. at 2."));
            expect(
              A.map([cleaned.report, extracted.report, resolved.report, annotated.report], (report) => report.operation)
            ).toEqual(["clean", "extract", "resolve", "annotate"]);
            expect(sourceCalls).toBe(4);
            yield* assertCitationWorkerCompositionObserved(setup.operation, setup.admission, setup.observed.snapshot);
          }),
        { timeout: 180000 }
      );
    }
  }
);

const PropertyType = S.toType(CitationEngineCleanInput);
const PropertyJson = CitationEngineCleanInput.pipe(S.toCodecJson, S.fromJsonString);
const propertyEquivalent = S.toEquivalence(PropertyType);
it.effect.prop(
  "preserves clean request defaults and ordered step selections through JSON",
  { value: Arbitrary.schema(PropertyType) },
  ({ value }) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(PropertyJson)(value);
      const decoded = yield* S.decodeEffect(PropertyJson)(encoded);
      expect(propertyEquivalent(value, decoded)).toBe(true);
    }),
  { arbitrary: fcRuns(100) }
);
