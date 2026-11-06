import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationAnnotationTemplateFailure,
  makeCitationAnnotationTemplates,
} from "@beep/law-practice-server/internal/Citation/AnnotationTemplate";
import { CitationPythonSliceBounds } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import {
  CitationPythonUnicodeStorage,
  CitationSafetyLimitExceeded,
  CitationTextBudget,
} from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationAnnotationTemplate");
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-annotation-wrap/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    producerSha256: S.tag("3845e015f477bfdaabc2f80ca02e9cbbe0f4be2bfbf0fdbda08ec25e940a4e44"),
    templateParserSha256: S.tag("4748e39c77d6dc14f81af80e68a62ad99031a8182d5e0b219a6666d0cfb1626f"),
    cacheState: S.tag("cold-per-case"),
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        source: CitationNativeUnicodeHex,
        before: CitationNativeUnicodeHex,
        after: CitationNativeUnicodeHex,
        matches: S.Array(S.Struct(CitationPythonSliceBounds.fields)),
        warnings: S.Array(S.Literal("DeprecationWarning")),
        result: S.TaggedUnion({
          Success: { text: CitationNativeUnicodeHex },
          Failure: { kind: S.Literals(["error", "IndexError"]), message: CitationNativeUnicodeHex },
        }),
      })
    ).check(S.isBetweenLength(1320, 1320)),
  })
);
const CorpusCodec = Corpus.pipe(
  $I.annoteSchema("Corpus", {
    description: "Cold original wrapping outputs and failures with independently observed tag ranges.",
  })
);
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })(
  "original annotation replacement templates",
  (it) => {
    it.effect(
      "matches every cold-source output/refusal using original match ranges",
      () =>
        Effect.gen(function* () {
          const corpus = yield* readCitationOracleFixture(
            "annotation-wrap",
            "c2b7516115dc68b4e929ccb7f2de3caab9b787b884738ba2b43d3e11e520d35e"
          ).pipe(Effect.flatMap(S.decodeEffect(CorpusCodec)));
          const limits = (yield* defaultCitationEnginePolicy).limits;
          const budget = yield* makeCitationTextBudget(limits);
          const templates = yield* makeCitationAnnotationTemplates(limits).pipe(
            Effect.provideService(CitationTextBudget, budget)
          );
          for (const row of corpus.cases) {
            const compiled = templates.compile(
              CitationPythonUnicodeStorage.make(row.before),
              CitationPythonUnicodeStorage.make(row.after)
            );
            if (row.result._tag === "Failure") {
              const error = yield* Effect.flip(compiled);
              expect(error, `${row.id}`).toEqual(CitationAnnotationTemplateFailure.make({}));
            } else {
              const plan = yield* compiled;
              expect(plan.warnings, `${row.id}:warnings`).toBe(row.warnings.length);
              const output = yield* templates.substitute(
                plan,
                CitationPythonUnicodeStorage.make(row.source),
                A.map(row.matches, (span) => CitationPythonSliceBounds.make(span))
              );
              expect(output, `${row.id}`).toEqual(row.result.text);
            }
          }
        }),
      { timeout: 120000 }
    );
    it.effect("reserves the exact output before allocation and retains captured authority", () =>
      Effect.gen(function* () {
        const base = (yield* defaultCitationEnginePolicy).limits;
        const source = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array([60, 97, 62]) });
        const empty = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array([]) });
        const matches = [CitationPythonSliceBounds.make({ start: 0, end: 3 })];
        const caller = yield* makeCitationTextBudget(base);
        for (const maximum of [4, 5]) {
          const limits = { ...base, producedTextUtf16: maximum };
          const budget = yield* makeCitationTextBudget(limits);
          const templates = yield* makeCitationAnnotationTemplates(limits).pipe(
            Effect.provideService(CitationTextBudget, budget)
          );
          const plan = yield* templates.compile(empty, empty);
          const used = yield* budget.snapshot;
          expect(used).toBe(2);
          const output = templates
            .substitute(plan, source, matches)
            .pipe(Effect.provideService(CitationTextBudget, caller));
          if (maximum === 4) {
            const error = yield* Effect.flip(output);
            expect(error).toEqual(
              CitationSafetyLimitExceeded.make({ operation: "annotate", limit: "producedTextUtf16" })
            );
            const retained = yield* budget.snapshot;
            expect(retained).toBe(2);
          } else {
            const result = yield* output;
            expect(result).toEqual(source);
            const retained = yield* budget.snapshot;
            expect(retained).toBe(5);
          }
        }
        const untouched = yield* caller.snapshot;
        expect(untouched).toBe(0);
      })
    );
  }
);
