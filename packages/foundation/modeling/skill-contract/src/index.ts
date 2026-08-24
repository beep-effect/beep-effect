/**
 * Typed gate and evidence-receipt models for agent-work contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

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
