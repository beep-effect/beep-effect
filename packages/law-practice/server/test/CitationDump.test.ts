import { makeCitationBuiltinDump } from "@beep/law-practice-server/internal/Citation/BuiltinDump";
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
    it.effect("refuses an invalid policy or printability table before rendering", () =>
      Effect.gen(function* () {
        const policy = yield* defaultCitationEnginePolicy;
        const printability = yield* readCitationNativeRenderingAsset("python-printability");
        const badPolicy = yield* makeCitationDump({}, printability).pipe(Effect.flip);
        expect(badPolicy).toMatchObject({ reason: "invalid-policy" });
        const notText = yield* makeCitationDump(policy.limits, 5).pipe(Effect.flip);
        expect(notText).toMatchObject({ reason: "invalid-configuration" });
        const wrongTable = yield* makeCitationDump(policy.limits, "not the pinned table").pipe(Effect.flip);
        expect(wrongTable).toMatchObject({ reason: "invalid-configuration" });
      })
    );
    it.effect("refuses more citations than the mention limit", () =>
      Effect.gen(function* () {
        const policy = yield* defaultCitationEnginePolicy;
        const printability = yield* readCitationNativeRenderingAsset("python-printability");
        const dump = yield* makeCitationDump({ ...policy.limits, mentions: 1 }, printability);
        const row = { kind: "IdCitation", span: [0, 0], fields: [] };
        const refused = yield* dump
          .render({ text: { width: 1, bytes: new Uint8Array() }, citations: [row, row] })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "mentions" });
      })
    );
    it.effect("renders integer and None scalars and omits falsy top-level fields", () =>
      Effect.gen(function* () {
        const policy = yield* defaultCitationEnginePolicy;
        const printability = yield* readCitationNativeRenderingAsset("python-printability");
        const dump = yield* makeCitationDump(policy.limits, printability);
        const output = yield* dump.render({
          text: { width: 1, bytes: new Uint8Array() },
          citations: [
            {
              kind: "IdCitation",
              span: [0, 0],
              fields: [
                { _tag: "Scalar", name: "kept", value: { _tag: "Integer", value: 7 } },
                { _tag: "Scalar", name: "zero", value: { _tag: "Integer", value: 0 } },
                { _tag: "Scalar", name: "none", value: { _tag: "None" } },
                {
                  _tag: "Fields",
                  name: "groups",
                  entries: [
                    { name: "count", value: { _tag: "Integer", value: 3 } },
                    { name: "absent", value: { _tag: "None" } },
                  ],
                },
              ],
            },
          ],
        });
        const text = new TextDecoder().decode(output.bytes);
        expect(text).toContain("  * kept=7");
        expect(text).not.toContain("zero=");
        expect(text).not.toContain("none=");
        expect(text).toContain("    * count=3");
        expect(text).toContain("    * absent=None");
      })
    );
    it.effect("renders text and boolean scalars by their truthiness", () =>
      Effect.gen(function* () {
        const policy = yield* defaultCitationEnginePolicy;
        const printability = yield* readCitationNativeRenderingAsset("python-printability");
        const dump = yield* makeCitationDump(policy.limits, printability);
        const storage = (text: string) => ({ width: 1, bytes: new TextEncoder().encode(text) });
        const output = yield* dump.render({
          text: { width: 1, bytes: new Uint8Array() },
          citations: [
            {
              kind: "IdCitation",
              span: [0, 0],
              fields: [
                { _tag: "Scalar", name: "name", value: { _tag: "Text", value: storage("abc") } },
                { _tag: "Scalar", name: "blank", value: { _tag: "Text", value: storage("") } },
                { _tag: "Scalar", name: "on", value: { _tag: "Boolean", value: true } },
                { _tag: "Scalar", name: "off", value: { _tag: "Boolean", value: false } },
                {
                  _tag: "Fields",
                  name: "flags",
                  entries: [
                    { name: "yes", value: { _tag: "Boolean", value: true } },
                    { name: "no", value: { _tag: "Boolean", value: false } },
                  ],
                },
              ],
            },
          ],
        });
        const text = new TextDecoder().decode(output.bytes);
        expect(text).toContain("  * name='abc'");
        expect(text).not.toContain("blank=");
        expect(text).toContain("  * on=True");
        expect(text).not.toContain("off=");
        expect(text).toContain("    * yes=True");
        expect(text).toContain("    * no=False");
      })
    );
    it.effect("refuses an enclosing budget larger than the policy allows", () =>
      Effect.gen(function* () {
        const policy = yield* defaultCitationEnginePolicy;
        const printability = yield* readCitationNativeRenderingAsset("python-printability");
        const larger = yield* makeCitationTextBudget(policy.limits);
        const refused = yield* makeCitationDump({ ...policy.limits, producedTextUtf16: 1 }, printability).pipe(
          Effect.provideService(CitationTextBudget, larger),
          Effect.flip
        );
        expect(refused).toMatchObject({ reason: "invalid-policy" });
      })
    );
    it.effect("builtin adapter refuses an invalid profile, policy or model", () =>
      Effect.gen(function* () {
        const policy = yield* defaultCitationEnginePolicy;
        const profile = yield* readCitationNativeRenderingAsset("builtin-dump-profile");
        const notText = yield* makeCitationBuiltinDump(policy.limits, 5).pipe(Effect.flip);
        expect(notText).toMatchObject({ reason: "invalid-configuration" });
        const wrongDigest = yield* makeCitationBuiltinDump(policy.limits, "not the pinned profile").pipe(Effect.flip);
        expect(wrongDigest).toMatchObject({ reason: "invalid-configuration" });
        const badPolicy = yield* makeCitationBuiltinDump({}, profile).pipe(Effect.flip);
        expect(badPolicy).toMatchObject({ reason: "invalid-policy" });
        const adapter = yield* makeCitationBuiltinDump(policy.limits, profile);
        const badModel = yield* adapter.project({}).pipe(Effect.flip);
        expect(badModel).toMatchObject({ reason: "invalid-input" });
      })
    );
  }
);
