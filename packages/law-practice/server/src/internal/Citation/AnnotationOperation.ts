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

/** Capture installation policy/artifact, then reuse source annotation admission,
 * timing, native transport and callback ownership. Project the completed native
 * operation's measured work and final reservation; queue time is not work.
 * No caller service or request-supplied artifact can replace captured authority.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationAnnotationOperation = Effect.fn("Citation.makeAnnotationOperation")(function* (
  policy: unknown,
  runtime: unknown,
  configuration: unknown,
  artifact: unknown
) {
  const invalid = () => CitationInputError.make({ operation: "annotate" });
  const { limits, engineArtifact } = yield* captureCitationOperationPolicy(policy, artifact, invalid);
  const stage = yield* makeCitationSourceAnnotation(limits, runtime, configuration);
  return {
    annotate: Effect.fn("Citation.annotateReported")(function* (raw: unknown) {
      const result = yield* stage.annotate(raw);
      return CitationEngineAnnotationResult.make({
        source: result.source,
        companion: result.companion,
        text: result.text,
        report: CitationEngineReport.make({
          operation: "annotate",
          engineArtifact,
          limits,
          producedTextUtf16: result.reservedUnits,
          workDuration: result.workDuration,
          extraction: null,
        }),
      });
    }),
  };
});
