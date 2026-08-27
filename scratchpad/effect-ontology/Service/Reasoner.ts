/**
 * Service: RDFS Reasoner
 *
 * **Details**
 *
 * Implements forward-chaining RDFS reasoning using N3.js Reasoner.
 * Supports type inference via rdfs:subClassOf, domain/range inference,
 * and custom N3 rules.
 *
 * Based on the Re-SHACL pattern for targeted reasoning - only computing
 * inferences needed for validation rather than full materialization.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { OWL_NAMESPACE } from "@beep/rdf/Vocab/Owl";
import { RDF_NAMESPACE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_NAMESPACE } from "@beep/rdf/Vocab/Rdfs";
import { LiteralKit, NonNegativeInt, NonNegNum, PosInt } from "@beep/schema";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { Clock, Context, Effect, Layer, Match } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ErrorMessage, OptionalErrorCause } from "../Domain/Error/Base.ts";
import type { RdfStore } from "./Rdf.ts";
import { cloneRdfStore, rdfStoreApplyRules, rdfStoreSize } from "./Rdf.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Reasoner");

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error: Reasoning operation failed
 *
 * **Example** (Inspect reasoning error)
 *
 * ```ts
 * import { ReasoningError } from "@effect-ontology/Service/Reasoner"
 *
 * const error = ReasoningError.make({ message: "Reasoning failed" })
 * console.log(error._tag) // "ReasoningError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ReasoningError extends S.TaggedError<ReasoningError>($I`ReasoningError`)(
  "ReasoningError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable reasoning failure diagnostic.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional underlying reasoner defect.",
    }),
  },
  $I.annote("ReasoningError", {
    description: "Failure while applying inference rules to an RDF graph.",
  })
) {
  static readonly is = S.is(this);
}

/**
 * Error: Invalid N3 rule syntax
 *
 * **Example** (Inspect rule parse error)
 *
 * ```ts
 * import { RuleParseError } from "@effect-ontology/Service/Reasoner"
 *
 * const error = RuleParseError.make({
 *   message: "Invalid N3 syntax",
 *   rule: "{ ?a <p> ?b }"
 * })
 * console.log(error._tag) // "RuleParseError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RuleParseError extends S.TaggedError<RuleParseError>($I`RuleParseError`)(
  "RuleParseError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable rule parsing diagnostic.",
    }),
    rule: S.NonEmptyString.annotateKey({
      description: "N3 rule text that could not be parsed.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional underlying parser defect.",
    }),
  },
  $I.annote("RuleParseError", {
    description: "Failure to parse an N3 inference rule.",
  })
) {
  static readonly is = S.is(this);
}

// =============================================================================
// Domain Models
// =============================================================================

/**
 * Reasoning profile - predefined sets of RDFS/OWL rules
 *
 * **Example** (Inspect reasoning profile)
 *
 * ```ts
 * import { ReasoningProfile } from "@effect-ontology/Service/Reasoner"
 *
 * console.log(ReasoningProfile.is.rdfs("rdfs")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReasoningProfile = LiteralKit(["rdfs", "rdfs-subclass", "owl-sameas", "custom"]).pipe(
  $I.annoteSchema("ReasoningProfile", {
    description: "Closed set of RDFS/OWL reasoning profiles applied to an RDF store.",
  })
);
/**
 * Describes the reasoning profile data exposed by this module.
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export type ReasoningProfile = typeof ReasoningProfile.Type;

/**
 * Configuration for reasoning operations
 *
 * **Example** (Inspect reasoning config)
 *
 * ```ts
 * import { ReasoningConfig } from "@effect-ontology/Service/Reasoner"
 *
 * const config = ReasoningConfig.make({})
 * console.log(config.profile) // "rdfs"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ReasoningConfig extends S.Class<ReasoningConfig>($I`ReasoningConfig`)(
  {
    profile: ReasoningProfile.pipe(SchemaUtils.withKeyDefaults("rdfs")),
    customRules: S.Array(S.String).pipe(SchemaUtils.withKeyDefaults([])),
    maxIterations: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(100))),
  },
  $I.annote("ReasoningConfig", {
    description: "Reasoning profile, optional custom rules, and iteration bound.",
  })
) {
  /**
   * Create default RDFS reasoning config
   *
   * **Example** (Inspect reasoning config.rdfs)
   *
   * ```ts
   * import { ReasoningConfig } from "@effect-ontology/Service/Reasoner"
   *
   * const config = ReasoningConfig.rdfs()
   * console.log(config.profile) // "rdfs"
   * ```
   *
   * @returns Result produced by this operation.
   */
  static rdfs(): ReasoningConfig {
    return ReasoningConfig.make({ profile: "rdfs" });
  }

  /**
   * Create subclass-only reasoning config
   *
   * **Example** (Inspect reasoning config.subclass only)
   *
   * ```ts
   * import { ReasoningConfig } from "@effect-ontology/Service/Reasoner"
   *
   * const config = ReasoningConfig.subclassOnly()
   * console.log(config.profile) // "rdfs-subclass"
   * ```
   *
   * @returns Result produced by this operation.
   */
  static subclassOnly(): ReasoningConfig {
    return ReasoningConfig.make({ profile: "rdfs-subclass" });
  }

  /**
   * Create custom rules config
   *
   * **Example** (Inspect reasoning config.custom)
   *
   * ```ts
   * import { ReasoningConfig } from "@effect-ontology/Service/Reasoner"
   *
   * const config = ReasoningConfig.custom(["{ ?a <p> ?b } => { ?b <p> ?a } ."])
   * console.log(config.profile) // "custom"
   * ```
   *
   * @param rules - Input consumed by this operation.
   * @returns Result produced by this operation.
   */
  static custom(rules: ReadonlyArray<string>): ReasoningConfig {
    return ReasoningConfig.make({ profile: "custom", customRules: [...rules] });
  }
}

/**
 * Result of a reasoning operation
 *
 * **Example** (Inspect reasoning result)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { NonNegNum } from "@beep/schema/Number"
 * import { ReasoningResult } from "@effect-ontology/Service/Reasoner"
 *
 * const result = ReasoningResult.make({
 *   inferredTripleCount: NonNegativeInt.make(3),
 *   totalTripleCount: NonNegativeInt.make(10),
 *   rulesApplied: NonNegativeInt.make(2),
 *   durationMs: NonNegNum.make(12)
 * })
 * console.log(result.hasInferences) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ReasoningResult extends S.Class<ReasoningResult>($I`ReasoningResult`)(
  {
    inferredTripleCount: NonNegativeInt,
    totalTripleCount: NonNegativeInt,
    rulesApplied: NonNegativeInt,
    durationMs: NonNegNum,
  },
  $I.annote("ReasoningResult", {
    description: "Inferred triple counts, rules applied, and elapsed milliseconds.",
  })
) {
  /**
   * True if any new triples were inferred
   *
   * **Example** (Inspect reasoning result.has inferences)
   *
   * ```ts
   * import { ReasoningResult } from "@effect-ontology/Service/Reasoner"
   *
   * import { NonNegativeInt } from "@beep/schema"
 * import { NonNegNum } from "@beep/schema/Number"
 * import { ReasoningResult } from "@effect-ontology/Service/Reasoner"
 *
 * const result = ReasoningResult.make({
 *   inferredTripleCount: NonNegativeInt.make(3),
 *   totalTripleCount: NonNegativeInt.make(10),
 *   rulesApplied: NonNegativeInt.make(2),
 *   durationMs: NonNegNum.make(12)
 * })
 * console.log(result.hasInferences) // true
   * ```
   *
   * @returns Result produced by this operation.
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
const getRulesForProfile = Match.type<ReasoningProfile>().pipe(
  Match.when("rdfs", () => [
    RDFS_SUBCLASS_RULE,
    RDFS_SUBCLASS_CHAIN_RULE,
    RDFS_SUBPROPERTY_RULE,
    RDFS_DOMAIN_RULE,
    RDFS_RANGE_RULE,
  ]),
  Match.when("rdfs-subclass", () => [RDFS_SUBCLASS_RULE, RDFS_SUBCLASS_CHAIN_RULE]),
  Match.when("owl-sameas", () => [OWL_SAMEAS_RULE, OWL_SAMEAS_SYMMETRY_RULE]),
  Match.when("custom", () => []),
  Match.exhaustive
);

// =============================================================================
// Service Definition
// =============================================================================

/**
 * Reasoner - RDFS/OWL reasoning service using N3.js
 *
 * **Details**
 *
 * Provides forward-chaining reasoning for knowledge graphs with support
 * for RDFS entailment rules and custom N3 rules.
 *
 * **Example** (Inspect the reasoner layer)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { Effect } from "effect"
 * import { Reasoner } from "@effect-ontology/Service/Reasoner"
 *
 * const program = Effect.gen(function* () {
 *   const reasoner = yield* Reasoner
 *   return reasoner
 * }).pipe(Effect.provide(Reasoner.Default))
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
interface ReasonerShape {
  readonly reason: (
    store: RdfStore,
    config: ReasoningConfig
  ) => Effect.Effect<ReasoningResult, ReasoningError | RuleParseError>;
  readonly reasonCopy: (
    store: RdfStore,
    config: ReasoningConfig
  ) => Effect.Effect<{ readonly store: RdfStore; readonly result: ReasoningResult }, ReasoningError | RuleParseError>;
  readonly reasonForValidation: (store: RdfStore) => Effect.Effect<ReasoningResult, ReasoningError | RuleParseError>;
  readonly wouldInfer: (
    store: RdfStore,
    config: ReasoningConfig
  ) => Effect.Effect<boolean, ReasoningError | RuleParseError>;
  readonly getRules: (profile: ReasoningProfile) => ReadonlyArray<string>;
}

const makeReasoner = (): Effect.Effect<ReasonerShape> =>
  Effect.sync(() => {
    /**
     * Core reasoning function - mutates the store
     */
    const reason = Effect.fn("Reasoner.reason")(function* (
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

      if (A.isReadonlyArrayEmpty(allRules)) {
        yield* Effect.logDebug("No rules to apply");
        return ReasoningResult.make({
          inferredTripleCount: NonNegativeInt.make(0),
          totalTripleCount: NonNegativeInt.make(initialSize),
          rulesApplied: NonNegativeInt.make(0),
          durationMs: NonNegNum.make((yield* Clock.currentTimeMillis) - startTime),
        });
      }

      yield* rdfStoreApplyRules(store, allRules).pipe(
        Effect.mapError((error) =>
          ReasoningError.make({
            message: error.message,
            cause: O.some(error),
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
    const reasonCopy = Effect.fn("Reasoner.reasonCopy")(function* (
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
      reasonForValidation: Effect.fn("Reasoner.reasonForValidation")(function* (
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
      wouldInfer: Effect.fn("Reasoner.wouldInfer")(function* (
        store: RdfStore,
        config: ReasoningConfig
      ): Effect.fn.Return<boolean, ReasoningError | RuleParseError> {
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
  });

/**
 * Schema-backed RDF reasoner service.
 *
 * **Details**
 *
 * Applies the selected RDFS, OWL, or custom rule profile to an RDF store.
 *
 * **Example** (Inspect the reasoner layer)
 * ```ts
 * import { Layer } from "effect"
 * import { Effect } from "effect"
 * import { Reasoner } from "@effect-ontology/Service/Reasoner"
 *
 * const program = Effect.gen(function* () {
 *   const reasoner = yield* Reasoner
 *   return reasoner
 * }).pipe(Effect.provide(Reasoner.Default))
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Reasoner extends Context.Service<Reasoner, ReasonerShape>()($I`Reasoner`, {
  make: makeReasoner(),
}) {
  static readonly Default: Layer.Layer<Reasoner> = Layer.effect(this, this.make);
}
