import { makeCitationDump } from "@beep/law-practice-server/internal/Citation/Dump";
import { makeCitationPythonRepr } from "@beep/law-practice-server/internal/Citation/PythonRepr";
import { CitationRegexOperation } from "@beep/law-practice-server/internal/Citation/RegexPolicy";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { makeCitationTestInvocationBinding } from "./CitationInvocation.fixtures.ts";
import { readCitationNativeRenderingAsset } from "./CitationNativeRendering.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "installed native rendering operation",
  (it) => {
    it.effect("attributes repr and dump allocation refusals to their installed operation", () =>
      Effect.gen(function* () {
        const policy = yield* defaultCitationEnginePolicy;
        const printability = yield* readCitationNativeRenderingAsset("python-printability");
        const limits = { ...policy.limits, producedTextUtf16: 16 };
        for (const operation of ["clean", "extract", "resolve", "annotate"] as const) {
          const repr = yield* makeCitationPythonRepr(limits, printability).pipe(
            Effect.flatMap((stage) =>
              makeCitationTestInvocationBinding(limits).pipe(
                Effect.map((bind) => ({ ...stage, text: bind(stage.text) }))
              )
            ),
            Effect.provideService(CitationRegexOperation, operation)
          );
          const dump = yield* makeCitationDump(limits, printability).pipe(
            Effect.flatMap((stage) =>
              makeCitationTestInvocationBinding(limits).pipe(
                Effect.map((bind) => ({ ...stage, render: bind(stage.render) }))
              )
            ),
            Effect.provideService(CitationRegexOperation, operation)
          );
          const reprFailure = yield* repr
            .text({ width: 1, bytes: new Uint8Array([0, 0, 0]) })
            .pipe(Effect.provideService(CitationRegexOperation, "extract"), Effect.flip);
          expect(reprFailure).toMatchObject({
            _tag: "CitationSafetyLimitExceeded",
            operation,
            limit: "producedTextUtf16",
          });
          const dumpFailure = yield* dump
            .render({
              text: { width: 1, bytes: new Uint8Array() },
              citations: [{ kind: "IdCitation", span: [0, 0], fields: [] }],
            })
            .pipe(Effect.provideService(CitationRegexOperation, "extract"), Effect.flip);
          expect(dumpFailure).toMatchObject({
            _tag: "CitationSafetyLimitExceeded",
            operation,
            limit: "producedTextUtf16",
          });
        }
      })
    );
  }
);
