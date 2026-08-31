/**
 * Specification-grounded conformance models and schema annotations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * @category specifications
 * @since 0.0.0
 */
export * from "./Conformance.annotations.ts";
/**
 * Concise canonical names for conformance annotation operations.
 *
 * @category getters
 * @since 0.0.0
 */
export { annotateConformance as annotate } from "./Conformance.annotations.ts";
/**
 * @category getters
 * @since 0.0.0
 */
export * from "./Conformance.collector.ts";
/**
 * Concise canonical names for conformance annotation collection.
 *
 * @category getters
 * @since 0.0.0
 */
export {
  collectConformanceAnnotations as collectAnnotations,
  collectConformanceAnnotationsResult as collectAnnotationsResult,
} from "./Conformance.collector.ts";
/**
 * @category specifications
 * @since 0.0.0
 */
export * from "./Conformance.invariant.schema.ts";
/**
 * Concise canonical names for invariants and their enforcement evidence.
 *
 * @category specifications
 * @since 0.0.0
 */
export {
  InvariantDescriptor as Invariant,
  InvariantEnforcement as Enforcement,
} from "./Conformance.invariant.schema.ts";
/**
 * @category policies
 * @since 0.0.0
 */
export * from "./Conformance.policy.schema.ts";
/**
 * Concise canonical name for {@link ConformancePolicy} in the Conformance namespace.
 *
 * @category policies
 * @since 0.0.0
 */
export { ConformancePolicy as Policy } from "./Conformance.policy.schema.ts";
/**
 * @category specifications
 * @since 0.0.0
 */
export * from "./Conformance.profile.schema.ts";
/**
 * Concise canonical name for {@link ConformanceProfile} in the Conformance namespace.
 *
 * @category specifications
 * @since 0.0.0
 */
export { ConformanceProfile as Profile } from "./Conformance.profile.schema.ts";
/**
 * @category diagnostics
 * @since 0.0.0
 */
export * from "./Conformance.report.schema.ts";
/**
 * Concise canonical names for conformance diagnostics.
 *
 * @category diagnostics
 * @since 0.0.0
 */
export { ConformanceIssue as Issue, ConformanceReport as Report } from "./Conformance.report.schema.ts";
/**
 * @category specifications
 * @since 0.0.0
 */
export * from "./Conformance.source.schema.ts";
/**
 * Concise canonical names for registered specification provenance.
 *
 * @category specifications
 * @since 0.0.0
 */
export {
  SpecificationReference as Reference,
  SpecificationRevision as Revision,
  SpecificationSource as Source,
} from "./Conformance.source.schema.ts";
