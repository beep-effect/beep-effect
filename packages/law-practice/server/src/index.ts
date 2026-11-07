/**
 * Package entry point for `@beep/law-practice-server`.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

export * from "./ClaimInspection/index.ts";
/**
 * Law-practice server layer exports.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./Layer.ts";
/** Atomic office-action evidence exports. @category services @since 0.0.0 */
export * as OfficeActionStructure from "./OfficeActionStructure/index.ts";
/**
 * Practice contact adapter for the party use-case port.
 * @category re-exports
 * @since 0.0.0
 */
export * as PartyContactSource from "./PartyContactSource/index.ts";
/**
 * @category use-cases
 * @since 0.0.0
 */
export * from "./PracticeKg.claims.ts";
/**
 * @category use-cases
 * @since 0.0.0
 */
export * from "./PracticeKg.compare.ts";
/**
 * @category use-cases
 * @since 0.0.0
 */
export * from "./PracticeKg.contacts.ts";
/**
 * @category use-cases
 * @since 0.0.0
 */
export * from "./PracticeKg.correspondents.ts";
/**
 * @category errors
 * @since 0.0.0
 */
export * from "./PracticeKg.errors.ts";
export * from "./PracticeKg.families.ts";
/** DuckDB projection builder. @category use-cases @since 0.0.0 */
export { buildDuckDb } from "./PracticeKg.fts.ts";
/**
 * @category services
 * @since 0.0.0
 */
export * from "./PracticeKg.host.ts";
/**
 * @category use-cases
 * @since 0.0.0
 */
export * from "./PracticeKg.mail-index.ts";
export * from "./PracticeKg.matters.ts";
/**
 * @category services
 * @since 0.0.0
 */
export * from "./PracticeKg.projections.ts";
/**
 * @category constants
 * @since 0.0.0
 */
export * from "./PracticeKg.queries.ts";
export * from "./PracticeKg.references.ts";
/**
 * @category use-cases
 * @since 0.0.0
 */
export * from "./PracticeKg.register.ts";
/**
 * @category schemas
 * @since 0.0.0
 */
export * from "./PracticeKg.rows.ts";
/**
 * @category schemas
 * @since 0.0.0
 */
export * from "./PracticeKg.schemas.ts";
/**
 * @category handlers
 * @since 0.0.0
 */
export * from "./PracticeKg.tool-handlers.ts";
export * from "./PracticeKg.verify.ts";
/**
 * @category tools
 * @since 0.0.0
 */
export * from "./Tools.ts";
