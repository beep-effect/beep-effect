import { CitationAdmissionFailure } from "@beep/law-practice-server/internal/Citation/Admission";
import { CitationCallbackFailure } from "@beep/law-practice-server/internal/Citation/CallbackResource";
import {
  failCitationCleanerBoundary,
  failCitationResolverBoundary,
} from "@beep/law-practice-server/internal/Citation/PortFailure";
import {
  CitationCleanerFailure,
  CitationEngineFailure,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const Json = S.fromJsonString(CitationEngineFailure);
it.effect("redacts all declared cleaner and admission reasons at the method boundary", () =>
  Effect.gen(function* () {
    const errors = [
      ...A.map(CitationCleanerFailure.fields.reason.literals, (reason) => CitationCleanerFailure.make({ reason })),
      ...A.map(CitationAdmissionFailure.fields.reason.literals, (reason) => CitationAdmissionFailure.make({ reason })),
    ];
    for (const error of errors) {
      Reflect.set(error, "sourceText", "private source");
      Reflect.set(error, "cause", { frame: "private frame" });
      const failure: Effect.Effect<never, CitationEngineFailure> = failCitationCleanerBoundary(error);
      const result = yield* failure.pipe(Effect.flip);
      expect(result).toMatchObject({ _tag: "CitationInputError", operation: "clean" });
      const encoded = yield* S.encodeEffect(Json)(result);
      expect(encoded).not.toContain("private");
      expect("reason" in result).toBe(false);
      expect("cause" in result).toBe(false);
    }
    const safety = yield* failCitationCleanerBoundary(
      CitationSafetyLimitExceeded.make({ operation: "extract", limit: "nativeHtmlParserResource" })
    ).pipe(Effect.flip);
    expect(safety).toMatchObject({
      _tag: "CitationSafetyLimitExceeded",
      operation: "clean",
      limit: "nativeHtmlParserResource",
    });
  })
);
it.effect("retains actual resolver budget/evidence failures and does not invent missing categories", () =>
  Effect.gen(function* () {
    for (const reason of CitationCallbackFailure.fields.reason.literals) {
      const error = CitationCallbackFailure.make({ reason });
      Reflect.set(error, "sourceText", "private source");
      Reflect.set(error, "cause", { frame: "private frame" });
      const failed: Effect.Effect<never, CitationEngineFailure> = failCitationResolverBoundary(error);
      const result = yield* failed.pipe(Effect.flip);
      expect(result).toMatchObject({
        _tag: reason === "evidence-failed" ? "CitationPrerequisiteError" : "CitationInputError",
        operation: "resolve",
      });
      const encoded = yield* S.encodeEffect(Json)(result);
      expect(encoded).not.toContain("private");
      expect("reason" in result).toBe(false);
    }
    for (const limit of [
      "sourceUtf16",
      "mentions",
      "authorities",
      "resolutionEdges",
      "resolutionIterations",
    ] as const) {
      const result = yield* failCitationResolverBoundary(
        CitationCallbackFailure.make({ reason: "limit-exceeded", limit })
      ).pipe(Effect.flip);
      expect(result).toMatchObject({ _tag: "CitationSafetyLimitExceeded", operation: "resolve", limit });
    }
  })
);
