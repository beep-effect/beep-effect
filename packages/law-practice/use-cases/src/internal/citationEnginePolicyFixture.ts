/**
 * Deterministic test policy fixture; never an ambient production default.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as S from "effect/Schema";
import { CitationEngineEffectivePolicy } from "../CitationEngine/CitationEngine.limits.ts";

/**
 * Decode the explicit default/test policy with real Duration values.
 *
 * **Example** (Acquire a policy fixture)
 *
 * ```ts
 * import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test"
 * const policy = defaultCitationEnginePolicy
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const defaultCitationEnginePolicy = S.decodeEffect(CitationEngineEffectivePolicy)({
  version: "citation-engine-policy/v1",
  execution: "isolated-process",
  limits: {
    sourceUtf16: 250_000,
    tokens: 250_000,
    candidates: 25_000,
    mentions: 10_000,
    authorities: 10_000,
    patterns: 8_192,
    patternUtf16: 4_096,
    patternEvaluations: 250_000,
    patternMatches: 100_000,
    resolutionEdges: 100_000,
    resolutionIterations: 100_000,
    annotationReplacements: 10_000,
    annotationOutputUtf16: 1_000_000,
    annotationGrowthUtf16: 250_000,
    producedTextUtf16: 2_000_000,
    diffInputUtf16: 1_000_000,
    diffSteps: 500_000,
    processMessageBytes: 8_000_000,
    concurrentOperations: 1,
    concurrentRegexProcesses: 1,
    queuedOperations: 4,
    cleanDeadline: 10_000,
    extractDeadline: 10_000,
    resolveDeadline: 10_000,
    annotateDeadline: 10_000,
    operationDeadline: 30_000,
    regexDeadline: 250,
    queueDeadline: 1_000,
    cleanupDeadline: 1_000,
  },
});
