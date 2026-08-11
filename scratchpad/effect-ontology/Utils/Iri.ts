/**
 * IRI Utilities
 *
 * Provides case-insensitive IRI matching and normalization utilities.
 * Used to handle casing mismatches between ontology IRI local names (PascalCase)
 * and rdfs:label values (camelCase) that cause LLM extraction failures.
 *
 * @since 0.0.0
 * @module Utils/Iri
 */
import * as S from "effect/Schema";
import * as O from "effect/Option";
import * as MutableHashSet from "effect/MutableHashSet";
import {IRI, LocalName} from "../Domain/Rdf/Types.ts";
import * as MutableHashMap from "effect/MutableHashMap";
import * as A from "effect/Array";
import * as Str from "effect/String";
import {pipe, flow, dual} from "effect/Function";
import * as P from "effect/Predicate";
import * as N from "effect/Number";

/**
 * Build a case-insensitive lookup map from IRIs.
 *
 * Creates a Map where keys are lowercase IRIs and values are the original canonical IRIs.
 * This allows case-insensitive matching while preserving the canonical form.
 *
 * @param iris - Array of canonical IRIs
 * @returns Map from lowercase IRI to canonical IRI
 *
 * **Example**
 *
 * ```ts
 * const map = buildCaseInsensitiveIriMap([
 *   "http://ontology/TeamRanking",
 *   "http://ontology/PlayerName"
 * ] as IRI[])
 * // map.get("http://ontology/teamranking") => "http://ontology/TeamRanking"
 * ```
 *
 * @since 0.0.0
 */
export const buildCaseInsensitiveIriMap = (
  iris: ReadonlyArray<IRI>
): MutableHashMap.MutableHashMap<string, IRI> => MutableHashMap.fromIterable(A.map(iris, (iri) => [Str.toLowerCase(iri), iri]));

/**
 * Normalize an IRI to its canonical form using case-insensitive matching.
 *
 * If the input IRI matches a canonical IRI (case-insensitively), returns the canonical form.
 * Otherwise, returns the input unchanged (cast as IRI).
 *
 * @param input - IRI to normalize (potentially with wrong casing)
 * @param iriMap - Case-insensitive lookup map from buildCaseInsensitiveIriMap
 * @returns Canonical IRI if found, otherwise the input unchanged
 *
 * **Example**
 *
 * ```ts
 * const map = buildCaseInsensitiveIriMap(["http://ontology/TeamRanking" as IRI])
 * normalizeIri("http://ontology/teamranking", map) // => "http://ontology/TeamRanking"
 * normalizeIri("http://ontology/Unknown", map) // => "http://ontology/Unknown"
 * ```
 *
 * @since 0.0.0
 */
export const normalizeIri: {
  (
    input: string,
    iriMap: MutableHashMap.MutableHashMap<string, IRI>,
  ): IRI,
  (
    iriMap: MutableHashMap.MutableHashMap<string, IRI>
  ): (input: string) => IRI
} = dual(2, (
  iriMap: MutableHashMap.MutableHashMap<string, IRI>,
  input: string,
): IRI => MutableHashMap.get(iriMap, Str.toLowerCase(input)).pipe(
  O.getOrElse(() => S.decodeSync(IRI)(input))
));

/**
 * Normalize an array of IRIs to their canonical forms.
 *
 * @param inputs - Array of IRIs to normalize
 * @param iriMap - Case-insensitive lookup map from buildCaseInsensitiveIriMap
 * @returns Array of normalized IRIs
 *
 * @since 0.0.0
 */
export const normalizeIris: {
  (
    inputs: ReadonlyArray<string>,
    iriMap: MutableHashMap.MutableHashMap<string, IRI>,
  ): ReadonlyArray<IRI>,
  (
    iriMap: MutableHashMap.MutableHashMap<string, IRI>
  ): (inputs: ReadonlyArray<string>) => ReadonlyArray<IRI>
} = dual(2, (
  iriMap: MutableHashMap.MutableHashMap<string, IRI>,
  inputs: ReadonlyArray<string>,
): ReadonlyArray<IRI> => A.map(inputs, normalizeIri(iriMap)));

/**
 * Check if an IRI exists in the canonical set (case-insensitively).
 *
 * @category combinators
 * @param input - IRI to check
 * @param iriMap - Case-insensitive lookup map from buildCaseInsensitiveIriMap
 * @returns true if the IRI exists (case-insensitively)
 * @since 0.0.0
 */
export const iriExistsCaseInsensitive: {
  (
    input: string,
    iriMap: MutableHashMap.MutableHashMap<string, IRI>,
  ): boolean,
  (
    iriMap: MutableHashMap.MutableHashMap<string, IRI>,
  ): (input: string) => boolean
} = dual(2, (
  input: string,
  iriMap: MutableHashMap.MutableHashMap<string, IRI>,
): boolean => MutableHashMap.has(iriMap, Str.toLowerCase(input)));

// =============================================================================
// Local Name Expansion Utilities
// =============================================================================

/**
 * Extract local name from an IRI (part after last / or #)
 *
 * **Example**
 *
 * ```ts
 * extractLocalNameFromIri("http://ontology/Player") // => "Player"
 * extractLocalNameFromIri("http://www.w3.org/2001/XMLSchema#string") // => "string"
 * ```
 *
 * @category combinators
 * @param iri - Full IRI string
 * @returns Local name portion
 * @since 0.0.0
 */
export const extractLocalNameFromIri = (iri: string): LocalName => {
  const lastSlashOpt = Str.lastIndexOf("/")(iri);
  const lastHashOpt = Str.lastIndexOf("#")(iri);
  return pipe(
    [lastSlashOpt, lastHashOpt] as const,
    O.liftPredicate(
      P.Tuple(
        [
          (v): v is O.Some<number> => O.isSome(v) && P.isNumber(v.value),
          (v): v is O.Some<number> => O.isSome(v) && P.isNumber(v.value),
        ]
      )
    ),
    O.map(([{value: lastSlash}, {value: lastHash}]) => {
      const splitIndex = Math.max(lastSlash, lastHash);
      return N.isGreaterThanOrEqualTo(splitIndex, 0) ? S.decodeSync(LocalName)(Str.slice(splitIndex + 1)(iri)) : S.decodeSync(LocalName)(iri);
    }),
    O.getOrElse(() => S.decodeSync(LocalName)(iri))
  );
};

/**
 * Result of building a local name to IRI map, including collision info
 *
 * @since 0.0.0
 */
export interface LocalNameMapResult {
  /** The local name to IRI mapping (last IRI wins for collisions) */
  readonly map: MutableHashMap.MutableHashMap<string, IRI>;
  /** Map of local names that had collisions to all their IRIs */
  readonly collisions: MutableHashMap.MutableHashMap<string, ReadonlyArray<IRI>>;
  /** Whether any collisions were detected */
  readonly hasCollisions: boolean;
}

/**
 * Build a case-insensitive local name to IRI map with collision detection.
 *
 * Creates a Map where keys are lowercase local names and values are the full canonical IRIs.
 * This allows case-insensitive local name matching while providing the full IRI.
 *
 * **IMPORTANT**: When multiple IRIs share the same local name (e.g., `org:member` and
 * `foaf:member`), this is a collision. The function tracks all collisions and returns
 * them in the result. The map will contain the LAST IRI for each colliding local name.
 *
 * **Example**
 *
 * ```ts
 * const result = buildLocalNameToIriMapSafe([
 *   "http://ontology/Player",
 *   "http://xmlns.com/foaf/0.1/member",
 *   "http://www.w3.org/ns/org#member"
 * ] as IRI[])
 * // result.map.get("member") => "http://www.w3.org/ns/org#member" (last wins)
 * // result.collisions.get("member") => ["http://xmlns.com/foaf/0.1/member", "http://www.w3.org/ns/org#member"]
 * // result.hasCollisions => true
 * ```
 *
 * @category combinators
 * @param iris - Array of canonical IRIs
 * @returns LocalNameMapResult with map, collisions, and hasCollisions flag
 * @since 0.0.0
 */
export const buildLocalNameToIriMapSafe = (
  iris: ReadonlyArray<IRI>
): LocalNameMapResult => {
  const map = MutableHashMap.empty<string, IRI>();
  const allByLocalName = MutableHashMap.empty<string, Array<IRI>>();

  for (const iri of iris) {
    const localName = extractLocalNameFromIri(iri).toLowerCase();

    // Track all IRIs for this local name
    const existing = MutableHashMap.get(allByLocalName, localName).pipe(O.getOrElse(A.empty<IRI>));
    existing.push(iri);
    MutableHashMap.set(allByLocalName, localName, existing);

    // Map stores the last one (for backwards compatibility)
    MutableHashMap.set(map, localName, iri);
  }

  // Build collisions map (only entries with > 1 IRI)
  const collisions = MutableHashMap.empty<string, ReadonlyArray<IRI>>();
  for (const [localName, iris] of allByLocalName) {
    if (iris.length > 1) {
      MutableHashMap.set(collisions, localName, iris);
    }
  }

  return {
    map,
    collisions,
    hasCollisions: MutableHashMap.size(collisions) > 0
  };
};

/**
 * Expand a local name to its full IRI using case-insensitive matching.
 *
 * **Example**
 *
 * ```ts
 * const map = buildLocalNameToIriMap(["http://ontology/Player" as IRI])
 * expandLocalNameToIri("player", map) // => "http://ontology/Player"
 * expandLocalNameToIri("Player", map) // => "http://ontology/Player"
 * expandLocalNameToIri("Unknown", map) // => undefined
 * ```
 *
 * @category combinators
 * @param localName - Local name (e.g., "Player")
 * @param localNameMap - Case-insensitive local name to IRI map from buildLocalNameToIriMap
 * @returns Full IRI if found, undefined otherwise
 * @since 0.0.0
 */
export const expandLocalNameToIri: {
  (
    localName: string,
    localNameMap: MutableHashMap.MutableHashMap<string, IRI>
  ): O.Option<IRI>,
  (
    localNameMap: MutableHashMap.MutableHashMap<string, IRI>
  ): (localName: string) => O.Option<IRI>
} = dual(2, (
  localName: string,
  localNameMap: MutableHashMap.MutableHashMap<string, IRI>
): O.Option<IRI> => MutableHashMap.get(localNameMap, Str.toLowerCase(localName)));

/**
 * Expand an array of local names to full IRIs.
 *
 * Filters out any local names that don't match known IRIs.
 *
 * @param localNames - Array of local names
 * @param localNameMap - Case-insensitive local name to IRI map
 * @returns Array of full IRIs (only valid expansions)
 *
 * **Example**
 *
 * ```ts
 * const map = buildLocalNameToIriMap([
 *   "http://ontology/Player",
 *   "http://ontology/Team"
 * ] as IRI[])
 * expandTypesToIris(["player", "Team", "Unknown"], map)
 * // => ["http://ontology/Player", "http://ontology/Team"]
 * ```
 *
 * @since 0.0.0
 */
export const expandTypesToIris: {
  (
    localNames: ReadonlyArray<string>,
    localNameMap: MutableHashMap.MutableHashMap<string, IRI>
  ): ReadonlyArray<IRI>,
  (
    localNameMap: MutableHashMap.MutableHashMap<string, IRI>
  ): (localNames: ReadonlyArray<string>) => ReadonlyArray<IRI>
} = dual(2, (
  localNames: ReadonlyArray<string>,
  localNameMap: MutableHashMap.MutableHashMap<string, IRI>
): ReadonlyArray<IRI> =>
  pipe(localNames, A.map(expandLocalNameToIri(localNameMap)), A.filter(S.is(IRI))));

/**
 * Get all valid local names from a set of IRIs.
 *
 * @param iris - Array of canonical IRIs
 * @returns Set of lowercase local names
 *
 * @since 0.0.0
 */
export const getLocalNameSet = (
  iris: ReadonlyArray<IRI>
): MutableHashSet.MutableHashSet<string> => MutableHashSet.fromIterable(A.map(iris, flow(extractLocalNameFromIri, Str.toLowerCase)));
