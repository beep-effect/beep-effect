import { makeCitationDump } from "@beep/law-practice-server/internal/Citation/Dump";
import { makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { CitationTextBudget } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { CitationDumpCorpus } from "./CitationDump.fixtures.ts";
import {
  authenticateCitationRenderingProducer,
  readCitationNativeRenderingAsset,
} from "./CitationNativeRendering.fixtures.ts";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "native builtin citation dumps",
  (it) => {
    it.effect(
      "matches all 803 independent ordered dump observations including signed context, whitespace and literal surrogates",
      () =>
        Effect.gen(function* () {
          const policy = yield* defaultCitationEnginePolicy;
          const printability = yield* readCitationNativeRenderingAsset("python-printability");
          const dump = yield* makeCitationDump(policy.limits, printability);
          const text = yield* readCitationOracleFixture(
            "builtin-dump-cases",
            "803ef80f613730fad97a1744434263092f7d952ece80090efcbd9036f4477f18"
          );
          const corpus = yield* S.decodeEffect(CitationDumpCorpus)(text);
          yield* authenticateCitationRenderingProducer("probe-dump.py", corpus.producerSha256);
          for (const [i, row] of corpus.cases.entries()) {
            const actual = yield* dump.render(row.input);
            expect(actual, `dump source observation ${i}`).toEqual(row.output);
          }
        }),
      { timeout: 60000 }
    );
    it.effect("keeps its captured parent budget when the caller supplies a replacement", () =>
      Effect.gen(function* () {
        const policy = yield* defaultCitationEnginePolicy;
        const printability = yield* readCitationNativeRenderingAsset("python-printability");
        const parent = yield* makeCitationTextBudget({ ...policy.limits, producedTextUtf16: 1 });
        const replacement = yield* makeCitationTextBudget(policy.limits);
        const dump = yield* makeCitationDump(policy.limits, printability).pipe(
          Effect.provideService(CitationTextBudget, parent)
        );
        const refused = yield* dump
          .render({
            text: { width: 1, bytes: new Uint8Array() },
            citations: [{ kind: "IdCitation", span: [0, 0], fields: [] }],
          })
          .pipe(Effect.provideService(CitationTextBudget, replacement), Effect.flip);
        expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "producedTextUtf16" });
        const used = yield* replacement.snapshot;
        expect(used).toBe(0);
      })
    );
    it.effect("refuses malformed input and oversized output without publishing partial context", () =>
      Effect.gen(function* () {
        const policy = yield* defaultCitationEnginePolicy;
        const printability = yield* readCitationNativeRenderingAsset("python-printability");
        const dump = yield* makeCitationDump({ ...policy.limits, producedTextUtf16: 16 }, printability);
        const invalid = yield* dump.render({}).pipe(Effect.flip);
        expect(invalid).toMatchObject({ reason: "invalid-input" });
        const refused = yield* dump
          .render({
            text: { width: 1, bytes: new Uint8Array() },
            citations: [{ kind: "IdCitation", span: [0, 0], fields: [] }],
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "producedTextUtf16" });
        const empty = yield* dump.render({ text: { width: 1, bytes: new Uint8Array() }, citations: [] });
        expect(empty).toEqual({ width: 1, bytes: new Uint8Array() });
      })
    );
  }
);
