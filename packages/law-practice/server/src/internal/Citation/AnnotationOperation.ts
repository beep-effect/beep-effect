/** Public annotation result projection over the existing admitted source owner.
 * @internal @packageDocumentation @since 0.0.0
 */
import {
  CitationEngineAnnotationResult,
  CitationEngineReport,
  CitationInputError,
} from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
import { captureCitationOperationPolicy } from "./Snapshot.ts";
import { makeCitationSourceAnnotation } from "./SourceAnnotation.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { Sha256Hex } from "@beep/schema";
import type { CitationAnnotationEntryConfiguration } from "./AnnotationEntry.ts";
import type { CitationOwned } from "./ConfigurationOwnership.ts";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

/** Capture installation policy/artifact, then reuse source annotation admission,
 * timing, native transport and callback ownership. Project the completed native
 * operation's measured work and final reservation; queue time is not work.
 * No caller service or request-supplied artifact can replace captured authority.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationAnnotationOperation = Effect.fn("Citation.makeAnnotationOperation")(function* (
  limits: CitationOwned<CitationEngineLimits>,
  runtime: CitationNativeProcessRuntime,
  configuration: CitationOwned<CitationAnnotationEntryConfiguration>,
  engineArtifact: Sha256Hex
) {
  const invalid = () => CitationInputError.make({ operation: "annotate" });
  const stage = yield* makeCitationSourceAnnotation(limits, runtime, configuration);
  return {
    annotate: Effect.fn("Citation.annotateReported")(function* (raw: unknown) {
      const result = yield* stage.annotate(raw);
      const reportPolicy = yield* captureCitationOperationPolicy(limits, engineArtifact, invalid);
      return CitationEngineAnnotationResult.make({
        source: result.source,
        companion: result.companion,
        text: result.text,
        report: CitationEngineReport.make({
          operation: "annotate",
          engineArtifact,
          limits: reportPolicy.limits,
          producedTextUtf16: result.reservedUnits,
          workDuration: result.workDuration,
          extraction: null,
        }),
      });
    }),
  };
});
