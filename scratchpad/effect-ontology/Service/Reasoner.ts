/**
 * Service: RDFS Reasoner
 *
 * Implements forward-chaining RDFS reasoning using N3.js Reasoner.
 * Supports type inference via rdfs:subClassOf, domain/range inference,
 * and custom N3 rules.
 *
 * Based on the Re-SHACL pattern for targeted reasoning - only computing
 * inferences needed for validation rather than full materialization.
 *
 * @since 2.0.0
 * @module Service/Reasoner
 */

import { $ScratchpadId } from "@beep/identity";
import { OWL_NAMESPACE } from "@beep/rdf/Vocab/Owl";
import { RDF_NAMESPACE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_NAMESPACE } from "@beep/rdf/Vocab/Rdfs";
import { LiteralKit, NonNegativeInt, NonNegNum, PosInt } from "@beep/schema";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { Context, Data, Effect, Layer, Schema } from "effect";
import * as Clock from "effect/Clock";
import type { RdfStore } from "./Rdf.ts";
import { cloneRdfStore, rdfStoreApplyRules, rdfStoreSize } from "./Rdf.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Reasoner");

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error: Reasoning operation failed
 *
 * @since 2.0.0
 * @category Errors
 */
export class ReasoningError extends Data.TaggedError("ReasoningError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Error: Invalid N3 rule syntax
 *
 * @since 2.0.0
 * @category Errors
 */
export class RuleParseError extends Data.TaggedError("RuleParseError")<{
  readonly message: string;
  readonly rule: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// Domain Models
// =============================================================================

/**
 * Reasoning profile - predefined sets of RDFS/OWL rules
 *
 * @since 2.0.0
 * @category Models
 */
export const ReasoningProfile = LiteralKit(["rdfs", "rdfs-subclass", "owl-sameas", "custom"]);
export type ReasoningProfile = typeof ReasoningProfile.Type;

/**
 * Configuration for reasoning operations
 *
 * @since 2.0.0
 * @category Models
 */
export class ReasoningConfig extends Schema.Class<ReasoningConfig>("ReasoningConfig")({
  profile: ReasoningProfile.pipe(SchemaUtils.withKeyDefaults("rdfs" as const)),
  customRules: Schema.Array(Schema.String).pipe(SchemaUtils.withKeyDefaults([])),
  maxIterations: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(100))),
}) {
  /**
   * Create default RDFS reasoning config
   */
  static rdfs(): ReasoningConfig {
    return ReasoningConfig.make({ profile: "rdfs" });
  }

  /**
   * Create subclass-only reasoning config
   */
  static subclassOnly(): ReasoningConfig {
    return ReasoningConfig.make({ profile: "rdfs-subclass" });
  }

  /**
   * Create custom rules config
   */
  static custom(rules: ReadonlyArray<string>): ReasoningConfig {
    return ReasoningConfig.make({ profile: "custom", customRules: [...rules] });
  }
}

/**
 * Result of a reasoning operation
 *
 * @since 2.0.0
 * @category Models
 */
export class ReasoningResult extends Schema.Class<ReasoningResult>("ReasoningResult")({
  inferredTripleCount: NonNegativeInt,
  totalTripleCount: NonNegativeInt,
  rulesApplied: NonNegativeInt,
  durationMs: NonNegNum,
}) {
  /**
   * True if any new triples were inferred
   */
  get hasInferences(): boolean {
    return this.inferredTripleCount > 0;
  }
}

// =============================================================================
// RDFS Rules in N3 Notation
// =============================================================================

/**
 * RDFS subClassOf transitivity rule
 *
 * If ?s is of type ?c and ?c is subClassOf ?c2, then ?s is of type ?c2
 */
const RDFS_SUBCLASS_RULE = `
@prefix rdfs: <${RDFS_NAMESPACE}> .
@prefix rdf: <${RDF_NAMESPACE}> .

{
  ?s rdf:type ?c .
  ?c rdfs:subClassOf ?c2 .
} => {
  ?s rdf:type ?c2 .
} .
`;

/**
 * RDFS subClassOf chain rule
 *
 * If ?c1 subClassOf ?c2 and ?c2 subClassOf ?c3, then ?c1 subClassOf ?c3
 */
const RDFS_SUBCLASS_CHAIN_RULE = `
@prefix rdfs: <${RDFS_NAMESPACE}> .

{
  ?c1 rdfs:subClassOf ?c2 .
  ?c2 rdfs:subClassOf ?c3 .
} => {
  ?c1 rdfs:subClassOf ?c3 .
} .
`;

/**
 * RDFS subPropertyOf transitivity rule
 */
const RDFS_SUBPROPERTY_RULE = `
@prefix rdfs: <${RDFS_NAMESPACE}> .

{
  ?s ?p ?o .
  ?p rdfs:subPropertyOf ?p2 .
} => {
  ?s ?p2 ?o .
} .
`;

/**
 * RDFS domain inference rule
 *
 * If ?p has domain ?c and ?s ?p ?o, then ?s is of type ?c
 */
const RDFS_DOMAIN_RULE = `
@prefix rdfs: <${RDFS_NAMESPACE}> .
@prefix rdf: <${RDF_NAMESPACE}> .

{
  ?s ?p ?o .
  ?p rdfs:domain ?c .
} => {
  ?s rdf:type ?c .
} .
`;

/**
 * RDFS range inference rule
 *
 * If ?p has range ?c and ?s ?p ?o, then ?o is of type ?c
 * (Only for object properties, not literals)
 */
const RDFS_RANGE_RULE = `
@prefix rdfs: <${RDFS_NAMESPACE}> .
@prefix rdf: <${RDF_NAMESPACE}> .

{
  ?s ?p ?o .
  ?p rdfs:range ?c .
} => {
  ?o rdf:type ?c .
} .
`;

/**
 * OWL sameAs transitivity rule
 */
const OWL_SAMEAS_RULE = `
@prefix owl: <${OWL_NAMESPACE}> .

{
  ?a owl:sameAs ?b .
  ?b owl:sameAs ?c .
} => {
  ?a owl:sameAs ?c .
} .
`;

/**
 * OWL sameAs symmetry rule
 */
const OWL_SAMEAS_SYMMETRY_RULE = `
@prefix owl: <${OWL_NAMESPACE}> .

{
  ?a owl:sameAs ?b .
} => {
  ?b owl:sameAs ?a .
} .
`;

/**
 * Get rules for a reasoning profile
 */
const getRulesForProfile = (profile: ReasoningProfile): ReadonlyArray<string> => {
  switch (profile) {
    case "rdfs":
      return [RDFS_SUBCLASS_RULE, RDFS_SUBCLASS_CHAIN_RULE, RDFS_SUBPROPERTY_RULE, RDFS_DOMAIN_RULE, RDFS_RANGE_RULE];
    case "rdfs-subclass":
      return [RDFS_SUBCLASS_RULE, RDFS_SUBCLASS_CHAIN_RULE];
    case "owl-sameas":
      return [OWL_SAMEAS_RULE, OWL_SAMEAS_SYMMETRY_RULE];
    case "custom":
      return [];
  }
};

// =============================================================================
// Service Definition
// =============================================================================

/**
 * Reasoner - RDFS/OWL reasoning service using N3.js
 *
 * Provides forward-chaining reasoning for knowledge graphs with support
 * for RDFS entailment rules and custom N3 rules.
 *
 * @example
 * ```typescript
 * Effect.gen(function*() {
 *   const reasoner = yield* Reasoner
 *   const rdfBuilder = yield* RdfBuilder
 *
 *   const store = yield* rdfBuilder.createStore
 *   // ... add triples ...
 *
 *   // Apply RDFS reasoning
 *   const result = yield* reasoner.reason(store, ReasoningConfig.rdfs())
 *
 *   console.log(`Inferred ${result.inferredTripleCount} new triples`)
 * })
 * ```
 *
 * @since 2.0.0
 * @category Services
 */
export class Reasoner extends Context.Service<Reasoner>()($I`Reasoner`, {
  make: Effect.sync(() => {
    /**
     * Core reasoning function - mutates the store
     */
    const reason = Effect.fn(function* (
      store: RdfStore,
      config: ReasoningConfig
    ): Effect.fn.Return<ReasoningResult, ReasoningError | RuleParseError> {
      const startTime = yield* Clock.currentTimeMillis;
      const initialSize = rdfStoreSize(store);

      yield* Effect.logInfo("Reasoner.reason starting", {
        profile: config.profile,
        initialTriples: initialSize,
        customRuleCount: config.customRules.length,
      });

      // Collect all rules
      const profileRules = getRulesForProfile(config.profile);
      const allRules = [...profileRules, ...config.customRules];

      if (allRules.length === 0) {
        yield* Effect.logDebug("No rules to apply");
        return ReasoningResult.make({
          inferredTripleCount: NonNegativeInt.make(0),
          totalTripleCount: NonNegativeInt.make(initialSize),
          rulesApplied: NonNegativeInt.make(0),
          durationMs: NonNegNum.make((yield* Clock.currentTimeMillis) - startTime),
        });
      }

      yield* rdfStoreApplyRules(store, allRules).pipe(
        Effect.mapError(
          (error) =>
            new ReasoningError({
              message: error.message,
              cause: error,
            })
        )
      );

      const finalSize = rdfStoreSize(store);
      const inferredCount = finalSize - initialSize;
      const durationMs = (yield* Clock.currentTimeMillis) - startTime;

      yield* Effect.logInfo("Reasoner.reason complete", {
        inferredTriples: inferredCount,
        totalTriples: finalSize,
        rulesApplied: NonNegativeInt.make(allRules.length),
        durationMs: NonNegNum.make(durationMs),
      });

      return ReasoningResult.make({
        inferredTripleCount: NonNegativeInt.make(inferredCount),
        totalTripleCount: NonNegativeInt.make(finalSize),
        rulesApplied: NonNegativeInt.make(allRules.length),
        durationMs: NonNegNum.make(durationMs),
      });
    });

    /**
     * Copy-based reasoning function
     */
    const reasonCopy = Effect.fn(function* (
      store: RdfStore,
      config: ReasoningConfig
    ): Effect.fn.Return<
      {
        store: RdfStore;
        result: ReasoningResult;
      },
      ReasoningError | RuleParseError
    > {
      // Create a copy of the store
      const wrappedStore = cloneRdfStore(store);

      // Apply reasoning to the copy
      const result = yield* reason(wrappedStore, config);

      return { store: wrappedStore, result };
    });

    return {
      /**
       * Apply reasoning rules to a graph
       *
       * Mutates the input store by adding inferred triples.
       * Returns statistics about the reasoning operation.
       *
       * @param store - The RDF store to reason over (will be mutated)
       * @param config - Reasoning configuration with profile and optional custom rules
       * @returns Reasoning result with statistics
       */
      reason,

      /**
       * Apply reasoning and return a new store (non-mutating)
       *
       * Creates a copy of the input store, applies reasoning,
       * and returns the copy with inferred triples.
       *
       * @param store - The RDF store to reason over
       * @param config - Reasoning configuration
       * @returns New store with original + inferred triples
       */
      reasonCopy,

      /**
       * Targeted reasoning for SHACL validation
       *
       * Only applies rules that are relevant to the shapes being validated.
       * This is more efficient than full materialization when validating
       * against a subset of possible constraints.
       *
       * Currently applies rdfs:subClassOf for type inheritance which is
       * the most common requirement for SHACL sh:class constraints.
       *
       * @param store - The RDF store to reason over (will be mutated)
       * @returns Reasoning result
       */
      reasonForValidation: Effect.fn(function* (
        store: RdfStore
      ): Effect.fn.Return<ReasoningResult, ReasoningError | RuleParseError> {
        yield* Effect.logDebug("Reasoner.reasonForValidation - applying subclass inference");

        // For validation, we primarily need type inference via subClassOf
        // This handles the case where an entity is typed as :FootballPlayer
        // but needs to be validated against shapes for :Person (superclass)
        return yield* reason(store, ReasoningConfig.subclassOnly());
      }),

      /**
       * Check if reasoning would add any inferences
       *
       * Useful for checking if a graph needs reasoning before mutating it.
       *
       * @param store - The RDF store to check
       * @param config - Reasoning configuration
       * @returns True if reasoning would add new triples
       */
      wouldInfer: (store: RdfStore, config: ReasoningConfig): Effect.Effect<boolean, ReasoningError | RuleParseError> =>
        Effect.gen(function* () {
          const { result } = yield* reasonCopy(store, config);
          return result.hasInferences;
        }),

      /**
       * Get available RDFS rules as N3 strings
       *
       * Useful for debugging or displaying what rules will be applied.
       */
      getRules: (profile: ReasoningProfile): ReadonlyArray<string> => getRulesForProfile(profile),
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make);
}
