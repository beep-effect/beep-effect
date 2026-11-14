import { makeCitationBuiltinDump } from "@beep/law-practice-server/internal/Citation/BuiltinDump";
import { makeCitationDump } from "@beep/law-practice-server/internal/Citation/Dump";
import { CitationInvocation } from "@beep/law-practice-server/internal/Citation/Invocation";
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
import { makeCitationTestScaffoldBinding, withCitationTestTextBudget } from "./CitationInvocation.fixtures.ts";
import { readCitationNativeRenderingAsset } from "./CitationNativeRendering.fixtures.ts";
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
          const dump = yield* makeCitationDump(policy.limits, printability).pipe(
            Effect.flatMap((stage) =>
              makeCitationTestScaffoldBinding(policy.limits).pipe(
                Effect.map((bind) => ({ ...stage, render: bind(stage.render) }))
              )
            )
          );
          const text = yield* readCitationOracleFixture(
            "builtin-dump-cases",
            "803ef80f613730fad97a1744434263092f7d952ece80090efcbd9036f4477f18"
          );
          const corpus = yield* S.decodeEffect(CitationDumpCorpus)(text);
          // The Python producer was removed with the repository's Python (goal python-free-repo). Its
          // digest stays pinned in the corpus as `producerSha256`; recover the exact producer with
          // `git show 05ed8bc6b6cc50f2a284ed02caaab16f216bb9c3:goals/citation-extraction-engine/ops/probe-dump.py`.
          for (const [i, row] of corpus.cases.entries()) {
            const actual = yield* dump.render(row.input);
            expect(actual, `dump source observation ${i}`).toEqual(row.output);
          }
        }),
      { timeout: 60000 }
    );
    it.effect("reads the invocation budget despite a legacy service replacement", () =>
      withCitationTestTextBudget(
        1,
        Effect.gen(function* () {
          const policy = yield* defaultCitationEnginePolicy;
          const printability = yield* readCitationNativeRenderingAsset("python-printability");
          const parent = (yield* CitationInvocation).budget;
          const replacement = yield* makeCitationTextBudget(policy.limits);
          const dump = yield* makeCitationDump(policy.limits, printability).pipe(
            Effect.flatMap((stage) =>
              makeCitationTestScaffoldBinding(policy.limits).pipe(
                Effect.map((bind) => ({ ...stage, render: bind(stage.render) }))
              )
            ),
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
      )
    );
    it.effect("refuses malformed input and oversized output without publishing partial context", () =>
      Effect.gen(function* () {
        const policy = yield* defaultCitationEnginePolicy;
        const printability = yield* readCitationNativeRenderingAsset("python-printability");
        const dump = yield* makeCitationDump({ ...policy.limits, producedTextUtf16: 16 }, printability).pipe(
          Effect.flatMap((stage) =>
            makeCitationTestScaffoldBinding({ ...policy.limits, producedTextUtf16: 16 }).pipe(
              Effect.map((bind) => ({ ...stage, render: bind(stage.render) }))
            )
          )
        );
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
        const badPolicy = yield* makeCitationDump({}, printability).pipe(
          Effect.flatMap((stage) =>
            makeCitationTestScaffoldBinding({}).pipe(Effect.map((bind) => ({ ...stage, render: bind(stage.render) })))
          ),
          Effect.flip
        );
        expect(badPolicy).toMatchObject({ reason: "invalid-policy" });
        const notText = yield* makeCitationDump(policy.limits, 5).pipe(
          Effect.flatMap((stage) =>
            makeCitationTestScaffoldBinding(policy.limits).pipe(
              Effect.map((bind) => ({ ...stage, render: bind(stage.render) }))
            )
          ),
          Effect.flip
        );
        expect(notText).toMatchObject({ reason: "invalid-configuration" });
        const wrongTable = yield* makeCitationDump(policy.limits, "not the pinned table").pipe(
          Effect.flatMap((stage) =>
            makeCitationTestScaffoldBinding(policy.limits).pipe(
              Effect.map((bind) => ({ ...stage, render: bind(stage.render) }))
            )
          ),
          Effect.flip
        );
        expect(wrongTable).toMatchObject({ reason: "invalid-configuration" });
      })
    );
    it.effect("refuses more citations than the mention limit", () =>
      Effect.gen(function* () {
        const policy = yield* defaultCitationEnginePolicy;
        const printability = yield* readCitationNativeRenderingAsset("python-printability");
        const dump = yield* makeCitationDump({ ...policy.limits, mentions: 1 }, printability).pipe(
          Effect.flatMap((stage) =>
            makeCitationTestScaffoldBinding({ ...policy.limits, mentions: 1 }).pipe(
              Effect.map((bind) => ({ ...stage, render: bind(stage.render) }))
            )
          )
        );
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
        const dump = yield* makeCitationDump(policy.limits, printability).pipe(
          Effect.flatMap((stage) =>
            makeCitationTestScaffoldBinding(policy.limits).pipe(
              Effect.map((bind) => ({ ...stage, render: bind(stage.render) }))
            )
          )
        );
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
        const dump = yield* makeCitationDump(policy.limits, printability).pipe(
          Effect.flatMap((stage) =>
            makeCitationTestScaffoldBinding(policy.limits).pipe(
              Effect.map((bind) => ({ ...stage, render: bind(stage.render) }))
            )
          )
        );
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
    it.effect("clamps spans past the text and trims whitespace runs longer than one yield interval", () =>
      Effect.gen(function* () {
        const policy = yield* defaultCitationEnginePolicy;
        const printability = yield* readCitationNativeRenderingAsset("python-printability");
        const dump = yield* makeCitationDump(policy.limits, printability).pipe(
          Effect.flatMap((stage) =>
            makeCitationTestScaffoldBinding(policy.limits).pipe(
              Effect.map((bind) => ({ ...stage, render: bind(stage.render) }))
            )
          )
        );
        const encoder = new TextEncoder();
        const row = (span: readonly [number, number]) => ({ kind: "IdCitation", span, fields: [] });
        const clamped = yield* dump.render({
          text: { width: 1, bytes: encoder.encode("abc") },
          citations: [row([-100, 100])],
        });
        expect(new TextDecoder().decode(clamped.bytes)).toContain("abc");
        const padding = new TextDecoder().decode(new Uint8Array(5000).fill(32));
        const padded = yield* dump.render({
          text: { width: 1, bytes: encoder.encode(`${padding}match${padding}`) },
          citations: [row([5000, 5005])],
          contextChars: 6000,
        });
        expect(new TextDecoder().decode(padded.bytes)).toContain("match");
      })
    );

    it.effect("builtin adapter refuses an invalid profile, policy or model", () =>
      Effect.gen(function* () {
        const policy = yield* defaultCitationEnginePolicy;
        const profile = yield* readCitationNativeRenderingAsset("builtin-dump-profile");
        const notText = yield* makeCitationBuiltinDump(policy.limits, 5).pipe(
          Effect.flatMap((stage) =>
            makeCitationTestScaffoldBinding(policy.limits).pipe(
              Effect.map((bind) => ({ ...stage, project: bind(stage.project) }))
            )
          ),
          Effect.flip
        );
        expect(notText).toMatchObject({ reason: "invalid-configuration" });
        const wrongDigest = yield* makeCitationBuiltinDump(policy.limits, "not the pinned profile").pipe(
          Effect.flatMap((stage) =>
            makeCitationTestScaffoldBinding(policy.limits).pipe(
              Effect.map((bind) => ({ ...stage, project: bind(stage.project) }))
            )
          ),
          Effect.flip
        );
        expect(wrongDigest).toMatchObject({ reason: "invalid-configuration" });
        const badPolicy = yield* makeCitationBuiltinDump({}, profile).pipe(
          Effect.flatMap((stage) =>
            makeCitationTestScaffoldBinding({}).pipe(Effect.map((bind) => ({ ...stage, project: bind(stage.project) })))
          ),
          Effect.flip
        );
        expect(badPolicy).toMatchObject({ reason: "invalid-policy" });
        const adapter = yield* makeCitationBuiltinDump(policy.limits, profile).pipe(
          Effect.flatMap((stage) =>
            makeCitationTestScaffoldBinding(policy.limits).pipe(
              Effect.map((bind) => ({ ...stage, project: bind(stage.project) }))
            )
          )
        );
        const badModel = yield* adapter.project({}).pipe(Effect.flip);
        expect(badModel).toMatchObject({ reason: "invalid-input" });
      })
    );
  }
);
