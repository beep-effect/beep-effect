/**
 * Retrieval Utilities
 *
 * **Details**
 *
 * Pure utility functions for retrieval and ranking operations:
 * - Reciprocal Rank Fusion (RRF) for combining multiple ranked lists
 * - Score computation and result fusion
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { HashMap, MutableHashMap, MutableHashSet, Order, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { dual2, dual3 } from "./Dual.ts";

const byRrfScoreDescending = Order.mapInput(
  Order.flip(Order.Number),
  (result: { readonly rrfScore: number }) => result.rrfScore
);
/**
 * Compute Reciprocal Rank Fusion score
 *
 * **Details**
 *
 * RRF formula: score = sum(1 / (k + rank)) for each list containing the item
 * where rank is 1-indexed and k is a constant (typically 60).
 *
 * **Example** (Inspect rrf score)
 *
 * ```ts
 * import { rrfScore } from "@effect-ontology/Utils/Retrieval"
 *
 * console.log(rrfScore)
 * ```
 *
 * @param ranks - Array of 1-indexed ranks
 * @param k - Constant to smooth rank differences (default: 60)
 * @returns RRF score (higher is better)
 * @category utilities
 * @since 0.0.0
 */
export const rrfScore = dual2((ranks: ReadonlyArray<number>, k: number): number =>
  A.reduce(ranks, 0, (sum, rank) => sum + 1 / (k + rank))
);

/**
 * Combine multiple ranked lists using Reciprocal Rank Fusion
 *
 * **Details**
 *
 * Takes multiple ranked lists of items and produces a single fused list
 * sorted by RRF score. Items are identified by their `id` field.
 *
 * **Example** (Inspect rrf fusion)
 *
 * ```ts
 * import { rrfFusion } from "@effect-ontology/Utils/Retrieval"
 *
 * console.log(rrfFusion)
 * ```
 *
 * @param rankedLists - Array of ranked lists, each sorted by relevance
 * @param k - RRF smoothing constant (default: 60)
 * @returns Combined list sorted by descending RRF score
 * @category utilities
 * @since 0.0.0
 */
export const rrfFusion: {
  <T extends { id: string }>(
    k: number
  ): (rankedLists: ReadonlyArray<ReadonlyArray<T>>) => ReadonlyArray<T & { rrfScore: number }>;
  <T extends { id: string }>(
    rankedLists: ReadonlyArray<ReadonlyArray<T>>,
    k: number
  ): ReadonlyArray<T & { rrfScore: number }>;
} = dual(2, <T extends { id: string }>(rankedLists: ReadonlyArray<ReadonlyArray<T>>, k: number) => {
  const itemMap = MutableHashMap.empty<string, { item: T; ranks: Array<number> }>();

  A.forEach(rankedLists, (list) =>
    A.forEach(list, (item, index) => {
      const rank = index + 1;
      const next = pipe(
        MutableHashMap.get(itemMap, item.id),
        O.map((existing) => ({
          item: existing.item,
          ranks: A.append(existing.ranks, rank),
        })),
        O.getOrElse(() => ({ item, ranks: [rank] }))
      );
      MutableHashMap.set(itemMap, item.id, next);
    })
  );

  return pipe(
    MutableHashMap.values(itemMap),
    A.fromIterable,
    A.map(({ item, ranks }) => ({ ...item, rrfScore: rrfScore(ranks, k) })),
    A.sort(byRrfScoreDescending)
  );
});

/**
 * Expanded term with weight
 *
 * **Example** (Reference ExpandedTerm fields)
 *
 * ```ts
 * import type { ExpandedTerm } from "@effect-ontology/Utils/Retrieval"
 *
 * const expandedTermFields: ReadonlyArray<keyof ExpandedTerm> = ["term", "weight", "source"]
 *
 * console.log(expandedTermFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ExpandedTerm {
  readonly term: string;
  readonly weight: number;
  readonly source: "original" | "altLabel" | "broader" | "narrower" | "related";
}

/**
 * Query expansion options
 *
 * **Example** (Reference QueryExpansionOptions fields)
 *
 * ```ts
 * import type { QueryExpansionOptions } from "@effect-ontology/Utils/Retrieval"
 *
 * const queryExpansionOptionsFields: ReadonlyArray<keyof QueryExpansionOptions> = ["includeAltLabels", "includeBroader", "includeNarrower"]
 *
 * console.log(queryExpansionOptionsFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface QueryExpansionOptions {
  /** Include SKOS altLabels (synonyms) - default: true */
  readonly includeAltLabels?: boolean;
  /** Include broader classes (generalizations) - default: false */
  readonly includeBroader?: boolean;
  /** Include narrower classes (specializations) - default: false */
  readonly includeNarrower?: boolean;
  /** Weight for original terms - default: 1.0 */
  readonly originalWeight?: number;
  /** Weight for synonym terms - default: 0.8 */
  readonly synonymWeight?: number;
  /** Weight for hierarchy terms - default: 0.5 */
  readonly hierarchyWeight?: number;
}

const defaultExpansionOptions: Required<QueryExpansionOptions> = {
  includeAltLabels: true,
  includeBroader: false,
  includeNarrower: false,
  originalWeight: 1.0,
  synonymWeight: 0.8,
  hierarchyWeight: 0.5,
};

/**
 * Simple class/property definition shape for expansion
 * (Minimal interface to avoid circular imports with Ontology model)
 */
interface OntologyElement {
  readonly label?: string;
  readonly altLabels?: ReadonlyArray<string>;
  readonly broader?: ReadonlyArray<string>;
  readonly narrower?: ReadonlyArray<string>;
}

/**
 * Simple ontology context shape for query expansion
 */
interface OntologyContext {
  readonly classes: HashMap.HashMap<string, OntologyElement>;
  readonly properties: HashMap.HashMap<string, OntologyElement>;
}

/**
 * Expand a query using ontology synonyms and relationships
 *
 * **Details**
 *
 * Finds matching classes/properties in the ontology and adds their
 * altLabels as expanded terms with reduced weight.
 *
 * **Example** (Inspect expand query with ontology)
 *
 * ```ts
 * import { HashMap } from "effect"
 * import { expandQueryWithOntology } from "@effect-ontology/Utils/Retrieval"
 *
 * const ontology = {
 *   classes: HashMap.empty<string, {
 *     readonly label?: string
 *     readonly altLabels?: ReadonlyArray<string>
 *   }>(),
 *   properties: HashMap.empty<string, {
 *     readonly label?: string
 *     readonly altLabels?: ReadonlyArray<string>
 *   }>()
 * }
 * const expanded = expandQueryWithOntology("player", ontology, {
 *   includeAltLabels: true,
 *   synonymWeight: 0.7
 * })
 * console.log(expanded)
 * ```
 *
 * @param query - Original query string
 * @param ontology - OntologyContext with classes and properties
 * @param options - Expansion options
 * @returns Array of expanded terms with weights
 * @category utilities
 * @since 0.0.0
 */
export const expandQueryWithOntology = dual3(
  (query: string, ontology: OntologyContext, options: QueryExpansionOptions): ReadonlyArray<ExpandedTerm> => {
    const opts = { ...defaultExpansionOptions, ...options };

    // Normalize query for matching
    const queryLower = pipe(query, Str.toLowerCase, Str.trim);
    if (Str.isEmpty(queryLower)) return A.empty();

    // Add original term
    let results: ReadonlyArray<ExpandedTerm> = A.of({
      term: query,
      weight: opts.originalWeight,
      source: "original",
    });
    const seenTerms = MutableHashSet.make(queryLower);

    // Helper to add unique terms
    const addTerm = (term: string, weight: number, source: ExpandedTerm["source"]) => {
      const termLower = pipe(term, Str.toLowerCase, Str.trim);
      if (Str.isNonEmpty(termLower) && !MutableHashSet.has(seenTerms, termLower)) {
        MutableHashSet.add(seenTerms, termLower);
        results = A.append(results, { term: termLower, weight, source });
      }
    };

    // Search classes for matches
    HashMap.forEach(ontology.classes, (cls) => {
      const labelLower = pipe(
        O.fromUndefinedOr(cls.label),
        O.map(Str.toLowerCase),
        O.getOrElse(() => "")
      );

      // Check if query matches class label
      if (Str.includes(queryLower)(labelLower) || Str.includes(labelLower)(queryLower)) {
        // Add altLabels as synonyms
        if (opts.includeAltLabels) {
          pipe(
            O.fromUndefinedOr(cls.altLabels),
            O.getOrElse(() => A.empty<string>()),
            A.forEach((alt) => {
              addTerm(alt, opts.synonymWeight, "altLabel");
            })
          );
        }

        // Add broader classes
        if (opts.includeBroader) {
          pipe(
            O.fromUndefinedOr(cls.broader),
            O.getOrElse(() => A.empty<string>()),
            A.forEach((broader) => {
              addTerm(broader, opts.hierarchyWeight, "broader");
            })
          );
        }

        // Add narrower classes
        if (opts.includeNarrower) {
          pipe(
            O.fromUndefinedOr(cls.narrower),
            O.getOrElse(() => A.empty<string>()),
            A.forEach((narrower) => {
              addTerm(narrower, opts.hierarchyWeight, "narrower");
            })
          );
        }
      }
    });

    // Search properties for matches
    HashMap.forEach(ontology.properties, (property) => {
      const labelLower = pipe(
        O.fromUndefinedOr(property.label),
        O.map(Str.toLowerCase),
        O.getOrElse(() => "")
      );

      if (Str.includes(queryLower)(labelLower) || Str.includes(labelLower)(queryLower)) {
        if (opts.includeAltLabels) {
          pipe(
            O.fromUndefinedOr(property.altLabels),
            O.getOrElse(() => A.empty<string>()),
            A.forEach((alt) => {
              addTerm(alt, opts.synonymWeight, "altLabel");
            })
          );
        }
      }
    });

    return results;
  }
);

/**
 * Build an expanded query string from expanded terms
 *
 * **Details**
 *
 * Combines expanded terms into a single query string, optionally
 * applying Lucene-style boosting syntax.
 *
 * **Example** (Inspect build expanded query)
 *
 * ```ts
 * import { buildExpandedQuery, type ExpandedTerm } from "@effect-ontology/Utils/Retrieval"
 *
 * const terms: ReadonlyArray<ExpandedTerm> = [
 *   { term: "player", weight: 1.0, source: "original" },
 *   { term: "athlete", weight: 0.8, source: "altLabel" }
 * ]
 *
 * console.log(buildExpandedQuery(terms, false)) // "player athlete"
 * console.log(buildExpandedQuery(terms, true)) // "player^1 athlete^0.8"
 * ```
 *
 * @param terms - Array of expanded terms with weights
 * @param useBoosting - Include weight as Lucene boost (^0.8) - default: false
 * @returns Combined query string
 * @category factories
 * @since 0.0.0
 */
export const buildExpandedQuery = dual2((terms: ReadonlyArray<ExpandedTerm>, useBoosting: boolean): string => {
  if (useBoosting) {
    return pipe(
      terms,
      A.map((term) => `${term.term}^${term.weight}`),
      A.join(" ")
    );
  }
  return pipe(
    terms,
    A.map((term) => term.term),
    A.join(" ")
  );
});
