import * as Root from "@beep/law-practice-use-cases";
import * as Public from "@beep/law-practice-use-cases/public";
import { CitationCleaner, CitationCleanerFailure, CitationEngineFailure } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { CitationLiveCleanerObject, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";

it.effect("keeps every captured cleaner method closed and its failures separate from engine failures", () =>
  Effect.gen(function* () {
    const refused = () => Effect.fail(CitationCleanerFailure.make({ reason: "closed-owner" }));
    const cleaner = CitationCleaner.of({
      fromText: refused,
      assertOwned: refused,
      textUnits: refused,
      open: refused,
      contains: refused,
      get: refused,
      callable: refused,
      invoke: refused,
    });
    const invocation = cleaner.fromText("server text");
    const closed: Effect.Effect<CitationLiveCleanerObject, CitationCleanerFailure | CitationSafetyLimitExceeded> =
      invocation;
    const failure = yield* closed.pipe(Effect.flip);
    expect(failure).toMatchObject({ _tag: "CitationCleanerFailure", reason: "closed-owner" });
    expect(S.is(CitationEngineFailure)(failure)).toBe(false);
    for (const name of [
      "CitationCleaner",
      "CitationCleanerFailure",
      "CitationCleanerObject",
      "CitationLiveCleanerObject",
      "CitationCleanerTextCharge",
      "CitationCleanerProduced",
      "CitationCleanerRun",
      "CitationCleanerWorkSnapshot",
    ]) {
      expect(name in Root).toBe(false);
      expect(name in Public).toBe(false);
    }
  })
);
