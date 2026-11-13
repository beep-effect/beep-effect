import { $LawPracticeServerId } from "@beep/identity/packages";
import { makeCitationAnnotationAssembly } from "@beep/law-practice-server/internal/Citation/AnnotationAssembly";
import {
  prepareCitationAnnotationSourceMap,
  prepareCitationAnnotations,
} from "@beep/law-practice-server/internal/Citation/AnnotationPreparation";
import { CitationHtmlDiscoveryConfiguration } from "@beep/law-practice-server/internal/Citation/HtmlDiscovery";
import { CitationHtmlGeometryPreparationConfiguration } from "@beep/law-practice-server/internal/Citation/HtmlGeometryPreparation";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import {
  citationUnaccountedText,
  makeCitationRegexInput,
} from "@beep/law-practice-server/internal/Citation/RegexInput";
import { CitationSpanDiffStep, makeCitationSpanOffsets } from "@beep/law-practice-server/internal/Citation/SpanOffsets";
import { makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import {
  CitationAnnotationReplacement,
  CitationPythonUnicodeStorage,
  CitationTextBudget,
} from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { makeCitationDiffTestRuntime } from "./CitationDiffWorker.fixtures.ts";
import { readCitationHtmlDiscoveryCorpus } from "./CitationHtmlDiscovery.fixtures.ts";
import { withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";
import {
  assertCitationWorkerCompositionReleased,
  readCitationOracleFixture,
  setupCitationMetadataRuntime,
} from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";
import type * as Digest from "effect/crypto/Digest";
import type * as Path from "effect/Path";
import type * as Scope from "effect/Scope";

const $I = $LawPracticeServerId.create("test/CitationAnnotationAssembly");
const Replacement = S.Struct({
  ...CitationAnnotationReplacement.fields,
  before: CitationNativeUnicodeHex,
  after: CitationNativeUnicodeHex,
}).pipe(
  $I.annoteSchema("Replacement", {
    description: "Original primitive annotation tuple with lossless source-native strings.",
  })
);
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-annotation-assembly/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    producerSha256: S.tag("77fb9a01de8284f7fedf57c2f62034da8019c805212ee1e66a952abdfc0e2ee6"),
    annotateSha256: S.tag("974bcabb0e7d608540732c42a5f3bf40b2616110bd1aca3d8bc7f09ed044af91"),
    cases: S.Array(
      S.Struct({
        source: CitationNativeUnicodeHex,
        ordered: S.Array(Replacement),
        input: S.Array(Replacement),
        result: CitationNativeUnicodeHex,
      })
    ).check(S.isBetweenLength(214, 214)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Original primitive annotation input, sorted tuples and unchecked output.",
  })
);
const MappingCorpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-annotation-mapping/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    producerSha256: S.tag("3fd3ce696955892e699483f13b0383aa9302c04448ffac4d05bd6f2c16a883ed"),
    cases: S.Array(
      S.Struct({
        plain: CitationNativeUnicodeHex,
        source: CitationNativeUnicodeHex,
        placeholder: CitationNativeUnicodeHex,
        input: S.Array(Replacement),
        mapped: S.Array(Replacement),
        steps: S.Array(CitationSpanDiffStep),
        result: CitationNativeUnicodeHex,
      })
    ).check(S.isBetweenLength(36, 36)),
  })
).pipe(
  $I.annoteSchema("MappingCorpus", {
    description: "Original implicit and supplied-map annotation results with exact pre-overlap mapped coordinates.",
  })
);
const loadMapping = readCitationOracleFixture(
  "annotation-mapping",
  "15562e5666859ab936a10c3f0f48e8d6cf665b60b3d11a5b244d915392353d30"
).pipe(Effect.flatMap(S.decodeEffect(MappingCorpus)));
const nativeReplacements = (values: ReadonlyArray<typeof Replacement.Type>) =>
  A.map(values, (value) =>
    CitationAnnotationReplacement.make({
      ...value,
      before: CitationPythonUnicodeStorage.make(value.before),
      after: CitationPythonUnicodeStorage.make(value.after),
    })
  );
const install = Effect.fn("AnnotationAssemblyTest.install")(function* (
  output?: number,
  growth?: number,
  produced?: number
) {
  const base = (yield* defaultCitationEnginePolicy).limits;
  const limits = {
    ...base,
    annotationOutputUtf16: output ?? base.annotationOutputUtf16,
    annotationGrowthUtf16: growth ?? base.annotationGrowthUtf16,
    producedTextUtf16: produced ?? base.producedTextUtf16,
  };
  const budget = yield* makeCitationTextBudget(limits);
  const assembly = yield* makeCitationAnnotationAssembly(limits).pipe(
    Effect.provideService(CitationTextBudget, budget)
  );
  const unicode = yield* makeCitationPythonUnicode(base);
  return { assembly, unicode, budget, limits };
});
it.layer(citationTokenizerTestLayer, { excludeTestServices: true, concurrent: false })(
  "native annotation assembly",
  (it) => {
    it.effect(
      "matches all original sorted primitive tuples, overlaps, reversed/outside slices and literal surrogate points",
      () =>
        withCitationTestInvocation(
          Effect.gen(function* () {
            const corpus = yield* readCitationOracleFixture(
              "annotation-assembly",
              "75a32d0456d6ff8e1237a5413f0a007eeb5cb29e6ce6fd7d6e54e0bb67722ecb"
            ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
            const { assembly, unicode, limits } = yield* install();
            for (const row of corpus.cases) {
              const source = yield* unicode.fromStorage(row.source);
              const ordered = nativeReplacements(row.ordered);
              const input = nativeReplacements(row.input);
              const prepared = yield* prepareCitationAnnotations(limits, input);
              expect(prepared).toEqual(ordered);
              const result = yield* assembly.assemble(source, prepared);
              expect(result).toEqual(row.result);
            }
          })
        )
    );
    it.effect("sorts before mapping starts right and ends left through the existing original diff index", () =>
      withCitationTestInvocation(
        Effect.gen(function* () {
          const corpus = yield* readCitationOracleFixture(
            "annotation-mapping",
            "15562e5666859ab936a10c3f0f48e8d6cf665b60b3d11a5b244d915392353d30"
          ).pipe(Effect.flatMap(S.decodeEffect(MappingCorpus)));
          const { assembly, unicode, limits } = yield* install();
          const input = yield* makeCitationRegexInput(limits, citationUnaccountedText);
          for (const row of corpus.cases) {
            const before = yield* input.prepareUnicode(row.plain, () => Effect.void);
            const after = yield* input.prepareUnicode(row.placeholder, () => Effect.void);
            const updater = yield* makeCitationSpanOffsets(limits, {
              before: before.layout,
              after: after.layout,
              steps: row.steps,
            });
            const prepared = yield* prepareCitationAnnotations(limits, nativeReplacements(row.input), O.some(updater));
            expect(prepared).toEqual(nativeReplacements(row.mapped));
            const source = yield* unicode.fromStorage(row.source);
            const output = yield* assembly.assemble(source, prepared);
            expect(output).toEqual(row.result);
          }
        })
      )
    );
    it.effect(
      "creates implicit source maps with actual placeholder and diff workers on Bun and Node",
      () =>
        withCitationTestInvocation(
          Effect.gen(function* () {
            const corpus = yield* loadMapping;
            const discovery = yield* readCitationHtmlDiscoveryCorpus();
            const fs = yield* FileSystem.FileSystem;
            const captured = yield* Effect.context<Scope.Scope | Digest.Digest | Path.Path>();
            for (const kind of ["bun", "node"] as const) {
              const setup = yield* setupCitationMetadataRuntime(kind, undefined, true);
              const directory = yield* fs.makeTempDirectoryScoped({ prefix: "citation-annotation-diff-" });
              const diffRuntime = yield* makeCitationDiffTestRuntime(kind, directory);
              const assembly = yield* makeCitationAnnotationAssembly(setup.limits).pipe(
                Effect.provideService(CitationTextBudget, setup.budget)
              );
              for (const row of A.filter(corpus.cases, (_, index) => index % 6 === 0)) {
                const output = yield* setup.operation.run(
                  "annotate",
                  Effect.gen(function* () {
                    const mapped = yield* prepareCitationAnnotationSourceMap(
                      setup.limits,
                      setup.runtime,
                      CitationHtmlGeometryPreparationConfiguration.make({
                        discovery: CitationHtmlDiscoveryConfiguration.make(discovery.configuration),
                        diffRuntime,
                      }),
                      CitationPythonUnicodeStorage.make(row.plain),
                      CitationPythonUnicodeStorage.make(row.source)
                    );
                    const prepared = yield* prepareCitationAnnotations(
                      setup.limits,
                      nativeReplacements(row.input),
                      O.some(mapped.updater)
                    );
                    expect(prepared).toEqual(nativeReplacements(row.mapped));
                    return yield* assembly.assemble(mapped.source, prepared);
                  }).pipe(
                    Effect.provideContext(setup.provided),
                    Effect.provideContext(captured),
                    Effect.provideService(CitationTextBudget, setup.budget)
                  )
                );
                expect(output).toEqual(row.result);
              }
              yield* assertCitationWorkerCompositionReleased(
                setup.operation,
                setup.admission,
                setup.observed.snapshot,
                12
              );
            }
          })
        ),
      { timeout: 120000 }
    );
    it.effect("checks exact output, growth and cumulative allocation before materializing annotation output", () =>
      withCitationTestInvocation(
        Effect.gen(function* () {
          for (const [output, growth, produced, limit] of [
            [4, 10, 10, "annotationOutputUtf16"],
            [10, 2, 10, "annotationGrowthUtf16"],
            [10, 10, 4, "producedTextUtf16"],
          ] as const) {
            const { assembly, unicode, budget } = yield* install(output, growth, produced);
            const source = yield* unicode.fromText("X");
            const before = yield* unicode.fromText("[a");
            const after = yield* unicode.fromText("b]");
            const failure = yield* assembly
              .assemble(source, [
                CitationAnnotationReplacement.make({ start: 0, end: 1, before: before.storage, after: after.storage }),
              ])
              .pipe(Effect.flip);
            expect(failure).toMatchObject({ _tag: "CitationSafetyLimitExceeded", operation: "annotate", limit });
            const used = yield* budget.snapshot;
            expect(used).toBe(0);
          }
          const { assembly, unicode, budget } = yield* install(5, 4, 5);
          const source = yield* unicode.fromText("X");
          const before = yield* unicode.fromText("[a");
          const after = yield* unicode.fromText("b]");
          const result = yield* assembly.assemble(source, [
            CitationAnnotationReplacement.make({ start: 0, end: 1, before: before.storage, after: after.storage }),
          ]);
          const text = yield* unicode.fromStorage(result);
          expect(text.text).toBe("[aXb]");
          const used = yield* budget.snapshot;
          expect(used).toBe(5);
        })
      )
    );
  }
);

const PropertyType = S.toType(CitationAnnotationReplacement);
const PropertyJson = CitationAnnotationReplacement.pipe(S.toCodecJson, S.fromJsonString);
const propertyEquivalent = S.toEquivalence(PropertyType);
it.effect.prop(
  "preserves annotation replacement Unicode and offset fields through JSON",
  { value: Arbitrary.schema(PropertyType) },
  ({ value }) =>
    withCitationTestInvocation(
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(PropertyJson)(value);
        const decoded = yield* S.decodeEffect(PropertyJson)(encoded);
        expect(propertyEquivalent(value, decoded)).toBe(true);
      })
    ),
  { arbitrary: fcRuns(100) }
);
