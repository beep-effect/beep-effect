import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationAnnotationReplacement,
  makeCitationAnnotationAssembly,
} from "@beep/law-practice-server/internal/Citation/AnnotationAssembly";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { CitationPythonUnicodeStorage, CitationTextBudget } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";

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
      S.Struct({ source: CitationNativeUnicodeHex, ordered: S.Array(Replacement), result: CitationNativeUnicodeHex })
    ).check(S.isBetweenLength(214, 214)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Original unchecked annotation assembly; sorting and other modes are separate qualification.",
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
  return { assembly, unicode, budget };
});
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("native annotation assembly", (it) => {
  it.effect(
    "matches all original sorted primitive tuples, overlaps, reversed/outside slices and literal surrogate points",
    () =>
      Effect.gen(function* () {
        const corpus = yield* readCitationOracleFixture(
          "annotation-assembly",
          "75a32d0456d6ff8e1237a5413f0a007eeb5cb29e6ce6fd7d6e54e0bb67722ecb"
        ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
        const { assembly, unicode } = yield* install();
        for (const row of corpus.cases) {
          const source = yield* unicode.fromStorage(row.source);
          const ordered = A.map(row.ordered, (value) =>
            CitationAnnotationReplacement.make({
              ...value,
              before: CitationPythonUnicodeStorage.make(value.before),
              after: CitationPythonUnicodeStorage.make(value.after),
            })
          );
          const result = yield* assembly.assemble(source, ordered);
          expect(result).toEqual(row.result);
        }
      })
  );
  it.effect("checks exact output, growth and cumulative allocation before materializing annotation output", () =>
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
  );
});
