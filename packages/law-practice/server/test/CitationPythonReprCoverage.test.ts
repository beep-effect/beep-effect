import { makeCitationPythonRepr } from "@beep/law-practice-server/internal/Citation/PythonRepr";
import { CitationEngineLimits, CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Str from "effect/String";
import { refuseCitationTestConfiguration } from "./CitationConfigurationOwnership.fixtures.ts";
import { makeCitationTestScaffoldBinding } from "./CitationInvocation.fixtures.ts";
import { readCitationNativeRenderingAsset } from "./CitationNativeRendering.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const word = (text: string) => CitationPythonUnicodeStorage.make({ width: 1, bytes: new TextEncoder().encode(text) });

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "Python repr chunk and policy boundaries",
  (it) => {
    it.effect("joins multiple retained chunks across cooperative scan boundaries without truncation", () =>
      Effect.gen(function* () {
        const { limits } = yield* defaultCitationEnginePolicy;
        const table = yield* readCitationNativeRenderingAsset("python-printability");
        const repr = yield* makeCitationPythonRepr(limits, table).pipe(
          Effect.flatMap((stage) =>
            makeCitationTestScaffoldBinding(limits).pipe(Effect.map((bind) => ({ ...stage, text: bind(stage.text) })))
          )
        );
        const input = Str.repeat(5000)("x");
        const actual = yield* repr.text(word(input));
        expect(actual).toEqual(word(`'${input}'`));
        const empty = yield* repr.text(word(""));
        expect(empty).toEqual(word("''"));
      })
    );

    it.effect("refuses malformed policy before rendering", () =>
      Effect.gen(function* () {
        // Refused where configuration crosses into the engine.
        const malformed = yield* refuseCitationTestConfiguration(
          () => ({ _tag: "CitationPythonReprFailure", reason: "invalid-policy" }),
          CitationEngineLimits,
          {}
        );
        expect(malformed).toMatchObject({ _tag: "CitationPythonReprFailure", reason: "invalid-policy" });
      })
    );
  }
);
