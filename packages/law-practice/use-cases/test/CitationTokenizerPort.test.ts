import * as Root from "@beep/law-practice-use-cases";
import * as Public from "@beep/law-practice-use-cases/public";
import {
  CitationEngineFailure,
  CitationTokenizer,
  CitationTokenizerFailure,
} from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { CitationSafetyLimitExceeded, CitationTokenizerResult } from "@beep/law-practice-use-cases/server";

it.effect("captures a closed tokenizer and keeps runtime token/work contracts server-only", () =>
  Effect.gen(function* () {
    const tokenizer = CitationTokenizer.of({
      tokenize: Effect.fn("CitationTokenizer.tokenize")(() =>
        Effect.fail(CitationTokenizerFailure.make({ reason: "invalid-source" }))
      ),
    });
    const invocation = tokenizer.tokenize({ width: 1, bytes: new Uint8Array() });
    const closed: Effect.Effect<CitationTokenizerResult, CitationTokenizerFailure | CitationSafetyLimitExceeded> =
      invocation;
    const failure = yield* closed.pipe(Effect.flip);
    expect(failure).toMatchObject({ _tag: "CitationTokenizerFailure", reason: "invalid-source" });
    expect(S.is(CitationEngineFailure)(failure)).toBe(false);
    for (const name of [
      "CitationTokenizer",
      "CitationTokenizerFailure",
      "CitationTokenizerResult",
      "CitationTokenSeed",
      "CitationAssemblyResult",
      "CitationPythonUnicodeStorage",
      "CitationTextBudget",
    ]) {
      expect(name in Root).toBe(false);
      expect(name in Public).toBe(false);
    }
  })
);
