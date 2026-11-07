import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationBalancedStyleSpan,
  makeCitationStyleTagBalancer,
} from "@beep/law-practice-server/internal/Citation/AnnotationStyle";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { CitationTextBudget } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationAnnotationStyle");
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-annotation-style/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    producerSha256: S.tag("0e13344df5eea8f04867b49cd70cb669304d576baec5f677b4409d3778f44712"),
    utilsSha256: S.tag("8e27eb1207f6c0fdb695530e3677a3e9f039986b2baf68461ba680ee2bff902e"),
    cases: S.Array(
      S.Struct({
        source: CitationNativeUnicodeHex,
        start: S.Int,
        end: S.Int,
        tolerance: S.Int,
        result: S.Struct({ ...CitationBalancedStyleSpan.fields, text: CitationNativeUnicodeHex }),
      })
    ).check(S.isBetweenLength(685, 685)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description:
      "Original literal style proximity results, including Python slice and unchanged initial-span membership.",
  })
);
const install = Effect.fn("AnnotationStyleTest.install")(function* (maximum?: number) {
  const limits = (yield* defaultCitationEnginePolicy).limits;
  const unicode = yield* makeCitationPythonUnicode(limits);
  const budget = yield* makeCitationTextBudget({ ...limits, producedTextUtf16: maximum ?? limits.producedTextUtf16 });
  const balancer = yield* makeCitationStyleTagBalancer().pipe(Effect.provideService(CitationTextBudget, budget));
  return { unicode, budget, balancer };
});
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("original annotation style expansion", (it) => {
  it.effect("matches all original i/em/b bounds, tolerance, slice and surrogate observations", () =>
    Effect.gen(function* () {
      const corpus = yield* readCitationOracleFixture(
        "annotation-style",
        "05639fb7db1d6c30ec48b09f582ba8e318f3fa40db80233f5a0b2124a5acc39e"
      ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
      const { unicode, balancer } = yield* install();
      for (const row of corpus.cases) {
        const source = yield* unicode.fromStorage(row.source);
        const result = yield* balancer.balance(source, row.start, row.end, row.tolerance);
        expect(result).toEqual(row.result);
      }
    })
  );
  it.effect("reserves the expanded native slice before allocation and refuses without a successful charge", () =>
    Effect.gen(function* () {
      const refused = yield* install(9);
      const source = yield* refused.unicode.fromText("<i>Foo</i>");
      const failure = yield* refused.balancer.balance(source, 0, 6).pipe(Effect.flip);
      expect(failure).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        operation: "annotate",
        limit: "producedTextUtf16",
      });
      const used = yield* refused.budget.snapshot;
      expect(used).toBe(0);
      const admitted = yield* install(10);
      const result = yield* admitted.balancer.balance(source, 0, 6);
      expect(result.start).toBe(0);
      expect(result.end).toBe(10);
      const text = yield* admitted.unicode.fromStorage(result.text);
      expect(text.text).toBe("<i>Foo</i>");
      const final = yield* admitted.budget.snapshot;
      expect(final).toBe(10);
    })
  );
});
