/**
 * Typed gate and evidence-receipt models for agent-work contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Four-rung cumulative evidence ladder and monotonic transition helpers.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./EvidenceLadder.ts";
/**
 * Unsigned in-toto Statement-aligned evidence receipts: digest-bound subjects,
 * versioned predicate types, typed predicates.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./EvidenceReceipt.ts";
/**
 * Fail-closed gate declarations, audited allowed/denied verdict values, and
 * the gate-evaluator contract.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Gate.ts";
/**
 * Bounded-recovery policy, budget, attempt, and terminal failure schemas.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Recovery.ts";
/**
 * Persisted references to runtime-bound input, output, and condition schemas.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./SchemaReference.ts";
/**
 * Evaluator-only opaque completion proof and terminal skill states.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./SkillCompletion.ts";
/**
 * Aggregate root for a versioned typed skill promise.
 *
 * @category aggregates
 * @since 0.0.0
 */
export * from "./SkillContract.ts";
/**
 * Deterministic SKILL.md projection and artifact re-extraction verdicts.
 *
 * @category projections
 * @since 0.0.0
 */
export * from "./SkillProjection.ts";
