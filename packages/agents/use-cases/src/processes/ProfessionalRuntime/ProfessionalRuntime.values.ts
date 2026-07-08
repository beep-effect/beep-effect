/**
 * Concept-local value vocabularies for Agentic Professional Runtime contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentsUseCasesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $AgentsUseCasesId.create("processes/ProfessionalRuntime/ProfessionalRuntime.values");

/**
 * Fixture scenario ids supported by the deterministic professional runtime proof.
 *
 * @example
 * ```ts
 * import { RuntimeFixtureScenarioId } from "@beep/agents-use-cases/public"
 * import * as S from "effect/Schema"
 *
 * const isScenario = S.is(RuntimeFixtureScenarioId)
 * console.log(isScenario("law-patent-intake")) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const RuntimeFixtureScenarioId = LiteralKit(["law-patent-intake", "wealth-cash-request"]).annotate(
  $I.annote("RuntimeFixtureScenarioId", {
    description: "Fixture scenario ids supported by the deterministic professional runtime proof.",
  })
);

/**
 * Runtime type for {@link RuntimeFixtureScenarioId}.
 *
 * @example
 * ```ts
 * import type { RuntimeFixtureScenarioId } from "@beep/agents-use-cases/public"
 *
 * const scenarioId: RuntimeFixtureScenarioId = "law-patent-intake"
 * console.log(scenarioId)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type RuntimeFixtureScenarioId = typeof RuntimeFixtureScenarioId.Type;

/**
 * Candidate lifecycle vocabulary used by runtime output sections.
 *
 * @example
 * ```ts
 * import { RuntimeCandidateLifecycle } from "@beep/agents-use-cases/public"
 * import * as S from "effect/Schema"
 *
 * const isLifecycle = S.is(RuntimeCandidateLifecycle)
 * console.log(isLifecycle("candidate")) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const RuntimeCandidateLifecycle = LiteralKit(["candidate"]).annotate(
  $I.annote("RuntimeCandidateLifecycle", {
    description: "Candidate lifecycle vocabulary used by runtime output sections.",
  })
);

/**
 * Runtime type for {@link RuntimeCandidateLifecycle}.
 *
 * @example
 * ```ts
 * import type { RuntimeCandidateLifecycle } from "@beep/agents-use-cases/public"
 *
 * const lifecycle: RuntimeCandidateLifecycle = "candidate"
 * console.log(lifecycle)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type RuntimeCandidateLifecycle = typeof RuntimeCandidateLifecycle.Type;

/**
 * Confidence vocabulary for candidate claims.
 *
 * @example
 * ```ts
 * import { RuntimeClaimConfidence } from "@beep/agents-use-cases/public"
 * import * as S from "effect/Schema"
 *
 * const isConfidence = S.is(RuntimeClaimConfidence)
 * console.log(isConfidence("medium")) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const RuntimeClaimConfidence = LiteralKit(["high", "medium", "low"]).annotate(
  $I.annote("RuntimeClaimConfidence", {
    description: "Confidence vocabulary for candidate claims.",
  })
);

/**
 * Runtime type for {@link RuntimeClaimConfidence}.
 *
 * @example
 * ```ts
 * import type { RuntimeClaimConfidence } from "@beep/agents-use-cases/public"
 *
 * const confidence: RuntimeClaimConfidence = "medium"
 * console.log(confidence)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type RuntimeClaimConfidence = typeof RuntimeClaimConfidence.Type;

/**
 * Approval decision vocabulary for candidate approval gates.
 *
 * @example
 * ```ts
 * import { RuntimeApprovalDecision } from "@beep/agents-use-cases/public"
 * import * as S from "effect/Schema"
 *
 * const isDecision = S.is(RuntimeApprovalDecision)
 * console.log(isDecision("pending")) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const RuntimeApprovalDecision = LiteralKit(["pending"]).annotate(
  $I.annote("RuntimeApprovalDecision", {
    description: "Approval decision vocabulary for candidate approval gates.",
  })
);

/**
 * Runtime type for {@link RuntimeApprovalDecision}.
 *
 * @example
 * ```ts
 * import type { RuntimeApprovalDecision } from "@beep/agents-use-cases/public"
 *
 * const decision: RuntimeApprovalDecision = "pending"
 * console.log(decision)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type RuntimeApprovalDecision = typeof RuntimeApprovalDecision.Type;

/**
 * Runtime request kinds represented in context packets.
 *
 * @example
 * ```ts
 * import { RuntimeRequestKind } from "@beep/agents-use-cases/public"
 * import * as S from "effect/Schema"
 *
 * const isRequestKind = S.is(RuntimeRequestKind)
 * console.log(isRequestKind("email_to_candidate_work")) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const RuntimeRequestKind = LiteralKit(["email_to_candidate_work"]).annotate(
  $I.annote("RuntimeRequestKind", {
    description: "Runtime request kinds represented in context packets.",
  })
);

/**
 * Runtime type for {@link RuntimeRequestKind}.
 *
 * @example
 * ```ts
 * import type { RuntimeRequestKind } from "@beep/agents-use-cases/public"
 *
 * const kind: RuntimeRequestKind = "email_to_candidate_work"
 * console.log(kind)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type RuntimeRequestKind = typeof RuntimeRequestKind.Type;

/**
 * Source artifact kinds represented in context packets.
 *
 * @example
 * ```ts
 * import { RuntimeSourceKind } from "@beep/agents-use-cases/public"
 * import * as S from "effect/Schema"
 *
 * const isSourceKind = S.is(RuntimeSourceKind)
 * console.log(isSourceKind("email")) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const RuntimeSourceKind = LiteralKit(["email"]).annotate(
  $I.annote("RuntimeSourceKind", {
    description: "Source artifact kinds represented in context packets.",
  })
);

/**
 * Runtime type for {@link RuntimeSourceKind}.
 *
 * @example
 * ```ts
 * import type { RuntimeSourceKind } from "@beep/agents-use-cases/public"
 *
 * const kind: RuntimeSourceKind = "email"
 * console.log(kind)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type RuntimeSourceKind = typeof RuntimeSourceKind.Type;

/**
 * Activity types emitted by deterministic runtime fixtures.
 *
 * @example
 * ```ts
 * import { RuntimeActivityType } from "@beep/agents-use-cases/public"
 * import * as S from "effect/Schema"
 *
 * const isActivityType = S.is(RuntimeActivityType)
 * console.log(isActivityType("candidate_work_proposed")) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const RuntimeActivityType = LiteralKit(["artifact_ingested", "candidate_work_proposed"]).annotate(
  $I.annote("RuntimeActivityType", {
    description: "Activity types emitted by deterministic runtime fixtures.",
  })
);

/**
 * Runtime type for {@link RuntimeActivityType}.
 *
 * @example
 * ```ts
 * import type { RuntimeActivityType } from "@beep/agents-use-cases/public"
 *
 * const activityType: RuntimeActivityType = "candidate_work_proposed"
 * console.log(activityType)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type RuntimeActivityType = typeof RuntimeActivityType.Type;

/**
 * Usage modes emitted by deterministic runtime fixtures.
 *
 * @example
 * ```ts
 * import { RuntimeUsageMode } from "@beep/agents-use-cases/public"
 * import * as S from "effect/Schema"
 *
 * const isUsageMode = S.is(RuntimeUsageMode)
 * console.log(isUsageMode("deterministic_fixture")) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const RuntimeUsageMode = LiteralKit(["deterministic_fixture"]).annotate(
  $I.annote("RuntimeUsageMode", {
    description: "Usage modes emitted by deterministic runtime fixtures.",
  })
);

/**
 * Runtime type for {@link RuntimeUsageMode}.
 *
 * @example
 * ```ts
 * import type { RuntimeUsageMode } from "@beep/agents-use-cases/public"
 *
 * const mode: RuntimeUsageMode = "deterministic_fixture"
 * console.log(mode)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type RuntimeUsageMode = typeof RuntimeUsageMode.Type;
