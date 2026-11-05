import {
  CitationEngineLimits,
  CitationSafetyBudget,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";

it.effect("citation safety budget names remain closed and cover the unchanged policy", () =>
  Effect.gen(function* () {
    const fields = R.keys(CitationEngineLimits.fields);
    expect(fields).toHaveLength(29);
    for (const field of fields) expect(S.is(CitationSafetyBudget)(field), field).toBe(true);
    expect(S.is(CitationSafetyBudget)("nativeHtmlParserResource")).toBe(true);
    expect(S.is(CitationSafetyBudget)("arbitrary-native-message")).toBe(false);
    const failure = CitationSafetyLimitExceeded.make({ operation: "clean", limit: "nativeHtmlParserResource" });
    const codec = S.fromJsonString(CitationSafetyLimitExceeded);
    const encoded = yield* S.encodeEffect(codec)(failure);
    const restored = yield* S.decodeEffect(codec)(encoded);
    expect(restored._tag).toBe("CitationSafetyLimitExceeded");
    expect(restored.limit).toBe("nativeHtmlParserResource");
  })
);
