/** Verified raw-source cleaning through captured owned-value adapters.
 * @internal @packageDocumentation @since 0.0.0
 */
import {
  CitationCleaner,
  CitationEngineCleanInput,
  CitationEngineCleanResult,
  CitationEngineReport,
  CitationInputError,
  CitationSafetyLimitExceeded,
  CitationTextBudget,
} from "@beep/law-practice-use-cases/server";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeCitationCleanerPipeline } from "./CleanerPipeline.ts";
import { CitationCleanerValues } from "./CleanerValues.ts";
import { CitationInvocation } from "./Invocation.ts";
import { failCitationCleanerBoundary } from "./PortFailure.ts";
import { CitationRegexOperation, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { captureCitationOperationPolicy, snapshotCitationValue } from "./Snapshot.ts";
import { makeCitationSourceEvidence } from "./SourceEvidence.ts";
import { measureCitationTextWork } from "./TextBudget.ts";
import type { CitationCleanerObject, CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { Sha256Hex } from "@beep/schema";
import type { CitationOwned } from "./ConfigurationOwnership.ts";

const InputType = S.toType(CitationEngineCleanInput);
const InputJson = CitationEngineCleanInput.pipe(S.toCodecJson, S.fromJsonString);
/** Capture source verification, shared admission and a coherent cleaner/value
 * owner. Each invocation reserves primitive input before materializing it,
 * reuses the original owned pipeline, and reserves the detached native view
 * before the value adapter copies it. Host results remain opaque and uncoerced.
 * Pipeline nesting shares the enclosing budget and does not reacquire admission.
 * Captured ports/value owner live in the engine Scope, not the invocation Scope.
 * Returned clean exposes only engine failures and requires no caller services.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationSourceCleaning = Effect.fn("Citation.makeSourceCleaning")(
  function* (limits: CitationOwned<CitationEngineLimits>, engineArtifact: Sha256Hex) {
    const invalid = () => CitationInputError.make({ operation: "clean" });
    const cleaner = yield* CitationCleaner;
    const values = yield* CitationCleanerValues;
    const clock = yield* Clock.Clock;
    const evidence = yield* makeCitationSourceEvidence(limits);
    const timing = yield* makeCitationRegexTiming(limits, true);
    const capture = Effect.fn("Citation.captureCleanSourceInput")(function* (raw: unknown) {
      if (P.isObject(raw) && P.isString(raw.sourceText) && Str.length(raw.sourceText) > limits.sourceUtf16)
        return yield* CitationSafetyLimitExceeded.make({ operation: "clean", limit: "sourceUtf16" });
      const decoded = yield* S.decodeUnknownEffect(InputType)(raw).pipe(Effect.mapError(invalid));
      if (Str.length(decoded.sourceText) > limits.sourceUtf16)
        return yield* CitationSafetyLimitExceeded.make({ operation: "clean", limit: "sourceUtf16" });
      return yield* snapshotCitationValue(InputJson, decoded, invalid);
    });
    const copyText = Effect.fn("Citation.copyCleanResultText")(function* (value: CitationCleanerObject) {
      const budget = yield* CitationTextBudget;
      const units = yield* values.getUnicodeUnits(value);
      if (O.isNone(units)) return O.none();
      yield* budget.reserve(units.value);
      const native = yield* values.getUnicode(value);
      return O.map(native, (word) => word.storage);
    });
    const prepare = Effect.fn("Citation.cleanRawSource")(
      function* (raw: unknown) {
        const request = yield* capture(raw);
        const source = yield* evidence.resolve(request);
        const budget = yield* CitationTextBudget;
        yield* budget.reserve(Str.length(source.sourceText));
        const initial = yield* cleaner.fromText(source.sourceText);
        const pipeline = yield* makeCitationCleanerPipeline(limits);
        const result = yield* pipeline.runOwned({ value: initial, plan: request.plan });
        const text = yield* copyText(result.value);
        return { source, value: result.value, text };
      },
      Effect.provideService(CitationCleaner, cleaner),
      Effect.provideService(Clock.Clock, clock)
    );
    return {
      clean: Effect.fn("Citation.cleanSourceBoundary")(
        function* (raw: unknown) {
          const { workDuration, result, producedTextUtf16 } = yield* measureCitationTextWork(
            (yield* CitationInvocation).budget,
            prepare(raw)
          );
          const reportPolicy = yield* captureCitationOperationPolicy(limits, engineArtifact, invalid);
          return CitationEngineCleanResult.make({
            ...result,
            report: CitationEngineReport.make({
              operation: "clean",
              engineArtifact,
              limits: reportPolicy.limits,
              producedTextUtf16,
              workDuration,
              extraction: null,
            }),
          });
        },
        Effect.catchTags({
          CitationCleanerFailure: failCitationCleanerBoundary,
          CitationSafetyLimitExceeded: timing.failSafety,
        })
      ),
    };
  },
  Effect.provideService(CitationRegexOperation, "clean")
);
