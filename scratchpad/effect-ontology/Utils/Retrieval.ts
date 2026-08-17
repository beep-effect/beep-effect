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
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { HashMap, MutableHashMap, MutableHashSet, Order, Tuple } from "effect";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { dual2, dual3 } from "./Dual.ts";

const $I = $ScratchpadId.create("effect-ontology/Utils/Retrieval");

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

const ExpandedTermSource = LiteralKit(["original", "altLabel", "broader", "narrower", "related"]);

class ExpandedTermBase extends S.Class<ExpandedTermBase>($I`ExpandedTermBase`)(
  {
    term: S.NonEmptyString.annotateKey({
      description: "Non-empty query term contributed to retrieval expansion.",
    }),
    weight: UnitInterval.annotateKey({
      description: "Relative retrieval weight between zero and one.",
    }),
  },
  $I.annote("ExpandedTermBase", {
    description: "Shared query term and bounded weight carried by every expansion source.",
  })
) {}

class OriginalExpandedTerm extends ExpandedTermBase.extend<OriginalExpandedTerm>($I`OriginalExpandedTerm`)(
  { source: S.tag(ExpandedTermSource.Enum.original) },
  $I.annote("OriginalExpandedTerm", {
    description: "Original query text retained at full configured weight.",
  })
) {}

class AlternateLabelExpandedTerm extends ExpandedTermBase.extend<AlternateLabelExpandedTerm>(
  $I`AlternateLabelExpandedTerm`
)(
  { source: S.tag(ExpandedTermSource.Enum.altLabel) },
  $I.annote("AlternateLabelExpandedTerm", {
    description: "Synonym contributed by an ontology alternate label.",
  })
) {}

class BroaderExpandedTerm extends ExpandedTermBase.extend<BroaderExpandedTerm>($I`BroaderExpandedTerm`)(
  { source: S.tag(ExpandedTermSource.Enum.broader) },
  $I.annote("BroaderExpandedTerm", {
    description: "Generalized term contributed by a broader ontology concept.",
  })
) {}

class NarrowerExpandedTerm extends ExpandedTermBase.extend<NarrowerExpandedTerm>($I`NarrowerExpandedTerm`)(
  { source: S.tag(ExpandedTermSource.Enum.narrower) },
  $I.annote("NarrowerExpandedTerm", {
    description: "Specialized term contributed by a narrower ontology concept.",
  })
) {}

class RelatedExpandedTerm extends ExpandedTermBase.extend<RelatedExpandedTerm>($I`RelatedExpandedTerm`)(
  { source: S.tag(ExpandedTermSource.Enum.related) },
  $I.annote("RelatedExpandedTerm", {
    description: "Associative term contributed by a related ontology concept.",
  })
) {}

/**
 * Weighted query term discriminated by its ontology expansion source.
 *
 * **Example** (Construct an alternate-label term)
 * ```ts
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 * import { ExpandedTerm } from "@effect-ontology/Utils/Retrieval"
 *
 * const term = ExpandedTerm.cases.altLabel.make({
 *   term: "athlete",
 *   weight: UnitInterval.make(0.8)
 * })
 * console.log(ExpandedTerm.guards.altLabel(term)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ExpandedTerm = ExpandedTermSource.mapMembers(
  Tuple.evolve([
    () => OriginalExpandedTerm,
    () => AlternateLabelExpandedTerm,
    () => BroaderExpandedTerm,
    () => NarrowerExpandedTerm,
    () => RelatedExpandedTerm,
  ])
).pipe(
  S.toTaggedUnion("source"),
  $I.annoteSchema("ExpandedTerm", {
    description: "Weighted query term discriminated by its ontology expansion source.",
  })
);

/**
 * Runtime value decoded by {@link ExpandedTerm}.
 *
 * **Example** (Read an expanded term)
 * ```ts
 * import type { ExpandedTerm } from "@effect-ontology/Utils/Retrieval"
 *
 * const source = (term: ExpandedTerm): ExpandedTerm["source"] => term.source
 * console.log(typeof source) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExpandedTerm = typeof ExpandedTerm.Type;

const selectExpandedTermCase = ExpandedTermSource.$match({
  original: () => ExpandedTerm.cases.original,
  altLabel: () => ExpandedTerm.cases.altLabel,
  broader: () => ExpandedTerm.cases.broader,
  narrower: () => ExpandedTerm.cases.narrower,
  related: () => ExpandedTerm.cases.related,
});

/**
 * Query expansion options
 *
 * **Example** (Construct query-expansion options)
 *
 * ```ts
 * import { QueryExpansionOptions } from "@effect-ontology/Utils/Retrieval"
 *
 * const options = QueryExpansionOptions.make({ includeBroader: true })
 * console.log(options.includeAltLabels) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class QueryExpansionOptions extends S.Class<QueryExpansionOptions>($I`QueryExpansionOptions`)(
  {
    includeAltLabels: SchemaUtils.BoolKeyDefaultTrue.annotateKey({
      description: "Whether SKOS alternate labels contribute synonym terms.",
    }),
    includeBroader: SchemaUtils.BoolKeyDefaultFalse.annotateKey({
      description: "Whether broader ontology concepts contribute generalized terms.",
    }),
    includeNarrower: SchemaUtils.BoolKeyDefaultFalse.annotateKey({
      description: "Whether narrower ontology concepts contribute specialized terms.",
    }),
    originalWeight: UnitInterval.pipe(
      SchemaUtils.withKeyDefaults(UnitInterval.make(1)),
      S.annotateKey({ description: "Weight assigned to the original query term." })
    ),
    synonymWeight: UnitInterval.pipe(
      SchemaUtils.withKeyDefaults(UnitInterval.make(0.8)),
      S.annotateKey({ description: "Weight assigned to alternate-label synonyms." })
    ),
    hierarchyWeight: UnitInterval.pipe(
      SchemaUtils.withKeyDefaults(UnitInterval.make(0.5)),
      S.annotateKey({ description: "Weight assigned to broader and narrower concepts." })
    ),
  },
  $I.annote("QueryExpansionOptions", {
    description: "Schema-defaulted ontology query-expansion policy with bounded weights.",
  })
) {}

/** @internal */
type QueryExpansionOptionsInput = (typeof QueryExpansionOptions)["~type.make.in"];

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
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 * import * as HashMap from "effect/HashMap"
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
 *   synonymWeight: UnitInterval.make(0.7)
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
  (query: string, ontology: OntologyContext, options: QueryExpansionOptionsInput): ReadonlyArray<ExpandedTerm> => {
    const policy = QueryExpansionOptions.make(options);

    // Normalize query for matching
    const queryLower = pipe(query, Str.toLowerCase, Str.trim);
    if (Str.isEmpty(queryLower)) return A.empty();

    // Add original term
    let results: ReadonlyArray<ExpandedTerm> = A.of(
      ExpandedTerm.cases.original.make({
        term: query,
        weight: policy.originalWeight,
      })
    );
    const seenTerms = MutableHashSet.make(queryLower);
    const matchesQuery = (label: string | undefined): boolean =>
      O.exists(O.fromUndefinedOr(label), (value) => {
        const normalized = Str.toLowerCase(value);
        return Str.includes(queryLower)(normalized) || Str.includes(normalized)(queryLower);
      });

    // Helper to add unique terms
    const addTerm = (term: string, weight: UnitInterval, source: ExpandedTerm["source"]) => {
      const termLower = pipe(term, Str.toLowerCase, Str.trim);
      if (Str.isNonEmpty(termLower) && !MutableHashSet.has(seenTerms, termLower)) {
        MutableHashSet.add(seenTerms, termLower);
        results = A.append(results, selectExpandedTermCase(source).make({ term: termLower, weight }));
      }
    };

    // Search classes for matches
    HashMap.forEach(ontology.classes, (cls) => {
      // Check if query matches class label
      if (matchesQuery(cls.label)) {
        // Add altLabels as synonyms
        if (policy.includeAltLabels) {
          pipe(
            O.fromUndefinedOr(cls.altLabels),
            O.getOrElse(A.empty<string>),
            A.forEach((alt) => {
              addTerm(alt, policy.synonymWeight, "altLabel");
            })
          );
        }

        // Add broader classes
        if (policy.includeBroader) {
          pipe(
            O.fromUndefinedOr(cls.broader),
            O.getOrElse(A.empty<string>),
            A.forEach((broader) => {
              addTerm(broader, policy.hierarchyWeight, "broader");
            })
          );
        }

        // Add narrower classes
        if (policy.includeNarrower) {
          pipe(
            O.fromUndefinedOr(cls.narrower),
            O.getOrElse(A.empty<string>),
            A.forEach((narrower) => {
              addTerm(narrower, policy.hierarchyWeight, "narrower");
            })
          );
        }
      }
    });

    // Search properties for matches
    HashMap.forEach(ontology.properties, (property) => {
      if (matchesQuery(property.label)) {
        if (policy.includeAltLabels) {
          pipe(
            O.fromUndefinedOr(property.altLabels),
            O.getOrElse(A.empty<string>),
            A.forEach((alt) => {
              addTerm(alt, policy.synonymWeight, "altLabel");
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
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 * import { buildExpandedQuery, ExpandedTerm } from "@effect-ontology/Utils/Retrieval"
 *
 * const terms = [
 *   ExpandedTerm.cases.original.make({ term: "player", weight: UnitInterval.make(1) }),
 *   ExpandedTerm.cases.altLabel.make({ term: "athlete", weight: UnitInterval.make(0.8) })
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
