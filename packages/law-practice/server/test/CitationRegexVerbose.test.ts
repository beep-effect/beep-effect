import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { makeCitationRegexProgram } from "@beep/law-practice-server/internal/Citation/RegexProgram";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { assertCitationVerboseProfiles, replayCitationRegexVerbose } from "./CitationRegexVerbose.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("source verbose grammar", (it) => {
  it.effect("matches every original parse/profile or closed rejection", assertCitationVerboseProfiles);
  it.effect("bounds ignored raw text before parsing and recovers after refusal", () =>
    Effect.gen(function* () {
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const compiler = yield* makeCitationRegexProgram({ ...limits, patternUtf16: 8 }, "python-regex-v0");
      const tooLarge = yield* compiler
        .compile({ width: 1, bytes: new TextEncoder().encode("#123456789") }, 64)
        .pipe(Effect.flip);
      expect(tooLarge).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "patternUtf16" });
      const fresh = yield* compiler.compile({ width: 1, bytes: new TextEncoder().encode("#ok") }, 64);
      expect(fresh.minimumWidthFloor).toBe(0);
    })
  );
  for (const kind of CitationNativeRuntimeKind.literals) {
    it.effect(
      `matches source verbose behavior through actual ${kind} children`,
      () => replayCitationRegexVerbose(kind, false),
      { timeout: 120000 }
    );
  }
});
