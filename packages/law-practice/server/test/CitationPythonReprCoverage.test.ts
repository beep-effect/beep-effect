import { makeCitationPythonRepr } from "@beep/law-practice-server/internal/Citation/PythonRepr";
import { makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { CitationPythonUnicodeStorage, CitationTextBudget } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Str from "effect/String";
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
        const repr = yield* makeCitationPythonRepr(limits, table);
        const input = Str.repeat(5000)("x");
        const actual = yield* repr.text(word(input));
        expect(actual).toEqual(word(`'${input}'`));
        const empty = yield* repr.text(word(""));
        expect(empty).toEqual(word("''"));
      })
    );

    it.effect("refuses malformed policy and a captured budget above its own ceiling without charging it", () =>
      Effect.gen(function* () {
        const { limits } = yield* defaultCitationEnginePolicy;
        const table = yield* readCitationNativeRenderingAsset("python-printability");
        const malformed = yield* makeCitationPythonRepr({}, table).pipe(Effect.flip);
        expect(malformed).toMatchObject({ _tag: "CitationPythonReprFailure", reason: "invalid-policy" });
        const enclosing = yield* makeCitationTextBudget(limits);
        const mismatch = yield* makeCitationPythonRepr({ ...limits, producedTextUtf16: 12 }, table).pipe(
          Effect.provideService(CitationTextBudget, enclosing),
          Effect.flip
        );
        expect(mismatch).toMatchObject({ _tag: "CitationPythonReprFailure", reason: "invalid-policy" });
        expect("cause" in mismatch).toBe(false);
        const used = yield* enclosing.snapshot;
        expect(used).toBe(0);
      })
    );
  }
);
