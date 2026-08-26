/**
 * IRI Utilities
 *
 * **Details**
 *
 * Provides case-insensitive IRI matching and normalization utilities.
 * Used to handle casing mismatches between ontology IRI local names (PascalCase)
 * and rdfs:label values (camelCase) that cause LLM extraction failures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { IRI } from "@beep/rdf";
import { MutableHashMapFromSelf } from "@beep/schema/MutableHashMap";
import { MutableHashMap, MutableHashSet, Number as N, SchemaGetter } from "effect";
import * as A from "effect/Array";
import { dual, flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $ScratchpadId.create("effect-ontology/Utils/Iri");

/**
 * Build a case-insensitive lookup map from IRIs.
 *
 * **Details**
 *
 * Creates a Map where keys are lowercase IRIs and values are the original canonical IRIs.
 * This allows case-insensitive matching while preserving the canonical form.
 *
 * **Example** (Inspect build case insensitive iri map)
 *
 * ```ts
 * import { IRI } from "@beep/rdf"
 * import { buildCaseInsensitiveIriMap } from "@effect-ontology/Utils/Iri"
 * import * as MutableHashMap from "effect/MutableHashMap"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const iris = S.decodeUnknownOption(S.Array(IRI))([
 *   "https://ontology/TeamRanking",
 *   "https://ontology/PlayerName"
 * ])
 * console.log(O.flatMap(iris, (values) =>
 *   MutableHashMap.get(buildCaseInsensitiveIriMap(values), "https://ontology/teamranking")
 * ))
 * ```
 *
 * @param iris - Array of canonical IRIs
 * @returns Map from lowercase IRI to canonical IRI
 * @category factories
 * @since 0.0.0
 */
export const buildCaseInsensitiveIriMap = (iris: ReadonlyArray<IRI>): MutableHashMap.MutableHashMap<string, IRI> =>
  MutableHashMap.fromIterable(A.map(iris, (iri) => [Str.toLowerCase(iri), iri]));

/**
 * Normalize an IRI to its canonical form using case-insensitive matching.
 *
 * **Details**
 *
 * If the input IRI matches a canonical IRI (case-insensitively), returns the canonical form.
 * Otherwise, returns the input unchanged (cast as IRI).
 *
 * **Example** (Inspect normalize iri)
 *
 * ```ts
 * import { IRI } from "@beep/rdf"
 * import { buildCaseInsensitiveIriMap, normalizeIri } from "@effect-ontology/Utils/Iri"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const iris = S.decodeUnknownOption(S.Tuple([IRI, IRI, IRI]))([
 *   "https://ontology/TeamRanking",
 *   "https://ontology/teamranking",
 *   "https://ontology/Unknown"
 * ])
 * console.log(O.map(iris, ([canonical, lowerCase, unknown]) => {
 *   const map = buildCaseInsensitiveIriMap([canonical])
 *   return [normalizeIri(lowerCase, map), normalizeIri(unknown, map)]
 * }))
 * ```
 *
 * @param input - IRI to normalize (potentially with wrong casing)
 * @param iriMap - Case-insensitive lookup map from buildCaseInsensitiveIriMap
 * @returns Canonical IRI if found, otherwise the input unchanged
 * @category normalization
 * @since 0.0.0
 */
export const normalizeIri: {
  (input: IRI, iriMap: MutableHashMap.MutableHashMap<string, IRI>): IRI;
  (iriMap: MutableHashMap.MutableHashMap<string, IRI>): (input: IRI) => IRI;
} = dual(
  2,
  (input: IRI, iriMap: MutableHashMap.MutableHashMap<string, IRI>): IRI =>
    MutableHashMap.get(iriMap, Str.toLowerCase(input)).pipe(O.getOrElse(() => input))
);

/**
 * Normalize an array of IRIs to their canonical forms.
 *
 * **Example** (Normalize an empty collection)
 *
 * ```ts
 * import { normalizeIris } from "@effect-ontology/Utils/Iri"
 * import * as MutableHashMap from "effect/MutableHashMap"
 *
 * console.log(normalizeIris([], MutableHashMap.empty()).length) // 0
 * ```
 *
 * @param inputs - Array of IRIs to normalize
 * @param iriMap - Case-insensitive lookup map from buildCaseInsensitiveIriMap
 * @returns Array of normalized IRIs
 * @category normalization
 * @since 0.0.0
 */
export const normalizeIris: {
  (inputs: ReadonlyArray<IRI>, iriMap: MutableHashMap.MutableHashMap<string, IRI>): ReadonlyArray<IRI>;
  (iriMap: MutableHashMap.MutableHashMap<string, IRI>): (inputs: ReadonlyArray<IRI>) => ReadonlyArray<IRI>;
} = dual(
  2,
  (inputs: ReadonlyArray<IRI>, iriMap: MutableHashMap.MutableHashMap<string, IRI>): ReadonlyArray<IRI> =>
    A.map(inputs, normalizeIri(iriMap))
);

/**
 * Check if an IRI exists in the canonical set (case-insensitively).
 *
 * **Example** (Check an empty canonical map)
 *
 * ```ts
 * import { iriExistsCaseInsensitive } from "@effect-ontology/Utils/Iri"
 * import * as MutableHashMap from "effect/MutableHashMap"
 *
 * console.log(iriExistsCaseInsensitive("https://example.com/A", MutableHashMap.empty())) // false
 * ```
 *
 * @param input - IRI to check
 * @param iriMap - Case-insensitive lookup map from buildCaseInsensitiveIriMap
 * @returns true if the IRI exists (case-insensitively)
 * @category utilities
 * @since 0.0.0
 */
export const iriExistsCaseInsensitive: {
  (input: string, iriMap: MutableHashMap.MutableHashMap<string, IRI>): boolean;
  (iriMap: MutableHashMap.MutableHashMap<string, IRI>): (input: string) => boolean;
} = dual(2, (input: string, iriMap: MutableHashMap.MutableHashMap<string, IRI>): boolean =>
  MutableHashMap.has(iriMap, Str.toLowerCase(input))
);

// =============================================================================
// Local Name Expansion Utilities
// =============================================================================

/**
 * Extract local name from an IRI (part after last / or #)
 *
 * **Example** (Inspect extract local name from iri)
 *
 * ```ts
 * import { extractLocalNameFromIri } from "@effect-ontology/Utils/Iri"
 *
 * extractLocalNameFromIri("https://ontology/Player") // => "Player"
 * extractLocalNameFromIri("https://www.w3.org/2001/XMLSchema#string") // => "string"
 * ```
 *
 * @param iri - Full IRI string
 * @returns Local name portion
 * @category schemas
 * @since 0.0.0
 */
export const extractLocalNameFromIri = (iri: string): string => {
  const lastSlashOpt = Str.lastIndexOf("/")(iri);
  const lastHashOpt = Str.lastIndexOf("#")(iri);
  const splitIndex = N.max(
    O.getOrElse(lastSlashOpt, () => -1),
    O.getOrElse(lastHashOpt, () => -1)
  );
  return N.isGreaterThanOrEqualTo(splitIndex, 0) ? Str.slice(splitIndex + 1)(iri) : iri;
};

/**
 * Build a case-insensitive schema for local names derived from canonical IRIs.
 *
 * **Details**
 *
 * Decoding accepts any case-equivalent local name. Encoding restores the
 * canonical spelling from the source IRI collection when a match exists.
 *
 * **Example** (Create a local-name codec)
 *
 * ```ts
 * import { IRI } from "@beep/rdf"
 * import { makeLocalNameSchema } from "@effect-ontology/Utils/Iri"
 * import * as S from "effect/Schema"
 *
 * const TypeName = makeLocalNameSchema([IRI.make("https://schema.org/Person")], "Type", "Class")
 * console.log(S.is(TypeName)("Person")) // true
 * ```
 *
 * @param iris - Canonical IRIs whose local names are accepted.
 * @param diagnosticNoun - Noun used in validation diagnostics, such as `Type`.
 * @param descriptionNoun - Noun used in schema descriptions, such as `Class`.
 * @returns A schema constrained to the supplied local-name vocabulary.
 * @category schemas
 * @since 0.0.0
 */
export const makeLocalNameSchema: {
  (iris: ReadonlyArray<IRI>, diagnosticNoun: string, descriptionNoun: string): S.Codec<string, string, never, never>;
  (
    diagnosticNoun: string,
    descriptionNoun: string
  ): (iris: ReadonlyArray<IRI>) => S.Codec<string, string, never, never>;
} = dual(3, (iris: ReadonlyArray<IRI>, diagnosticNoun: string, descriptionNoun: string) => {
  const { map: localNameMap } = buildLocalNameToIriMapSafe(iris);
  const localNames = A.map(iris, extractLocalNameFromIri);
  const preview = `${A.join(A.take(localNames, 10), ", ")}${A.length(localNames) > 10 ? "..." : ""}`;

  return S.String.pipe(
    S.decodeTo(S.String, {
      decode: SchemaGetter.transform((canonical) => canonical),
      encode: SchemaGetter.transform((input) =>
        pipe(
          expandLocalNameToIri(input, localNameMap),
          O.map(extractLocalNameFromIri),
          O.getOrElse(() => input)
        )
      ),
    }),
    S.check(
      S.makeFilter((name) => MutableHashMap.has(localNameMap, Str.toLowerCase(name)), {
        message: `${diagnosticNoun} must be one of: ${preview}`,
      })
    ),
    S.annotate({
      description: `${descriptionNoun} name (one of: ${A.join(localNames, ", ")})`,
    })
  );
});

/**
 * Result of building a local name to IRI map, including collision info
 *
 * **Example** (Build a collision-aware local-name map)
 *
 * ```ts
 * import { IRI } from "@beep/rdf"
 * import { buildLocalNameToIriMapSafe } from "@effect-ontology/Utils/Iri"
 *
 * const result = buildLocalNameToIriMapSafe([IRI.make("https://example.com/Person")])
 * console.log(result.hasCollisions) // false
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export class LocalNameMapResult extends S.Class<LocalNameMapResult>($I`LocalNameMapResult`)(
  {
    map: MutableHashMapFromSelf({ key: S.String, value: IRI }).annotateKey({
      description: "Case-insensitive local-name mapping; the last IRI wins when names collide.",
    }),
    collisions: MutableHashMapFromSelf({ key: S.String, value: S.Array(IRI) }).annotateKey({
      description: "All IRIs associated with each colliding local name.",
    }),
    hasCollisions: S.Boolean.annotateKey({ description: "Whether any local-name collision was detected." }),
  },
  $I.annote("LocalNameMapResult", {
    description: "Mutable local-name lookup state and its collision inventory.",
  })
) {}

/**
 * Build a case-insensitive local name to IRI map with collision detection.
 *
 * **Details**
 *
 * Creates a Map where keys are lowercase local names and values are the full canonical IRIs.
 * This allows case-insensitive local name matching while providing the full IRI.
 *
 * **IMPORTANT**: When multiple IRIs share the same local name (e.g., `org:member` and
 * `foaf:member`), this is a collision. The function tracks all collisions and returns
 * them in the result. The map will contain the LAST IRI for each colliding local name.
 *
 * **Example** (Inspect build local name to iri map safe)
 *
 * ```ts
 * import { IRI } from "@beep/rdf"
 * import { buildLocalNameToIriMapSafe } from "@effect-ontology/Utils/Iri"
 * import * as MutableHashMap from "effect/MutableHashMap"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const iris = S.decodeUnknownOption(S.Array(IRI))([
 *   "https://ontology/Player",
 *   "https://xmlns.com/foaf/0.1/member",
 *   "https://www.w3.org/ns/org#member"
 * ])
 * console.log(O.map(iris, (values) => {
 *   const result = buildLocalNameToIriMapSafe(values)
 *   return {
 *     member: O.getOrNull(MutableHashMap.get(result.map, "member")),
 *     hasCollisions: result.hasCollisions
 *   }
 * }))
 * ```
 *
 * @param iris - Array of canonical IRIs
 * @returns LocalNameMapResult with map, collisions, and hasCollisions flag
 * @category factories
 * @since 0.0.0
 */
export const buildLocalNameToIriMapSafe = (iris: ReadonlyArray<IRI>): LocalNameMapResult => {
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
    hasCollisions: MutableHashMap.size(collisions) > 0,
  };
};

/**
 * Expand a local name to its full IRI using case-insensitive matching.
 *
 * **Example** (Inspect expand local name to iri)
 *
 * ```ts
 * import { IRI } from "@beep/rdf"
 * import { buildLocalNameToIriMapSafe, expandLocalNameToIri } from "@effect-ontology/Utils/Iri"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const iri = S.decodeUnknownOption(IRI)("https://ontology/Player")
 * const map = O.map(iri, (value) => buildLocalNameToIriMapSafe([value]).map)
 * console.log(O.flatMap(map, (value) => expandLocalNameToIri("player", value)))
 * console.log(O.map(map, (value) => O.isNone(expandLocalNameToIri("Unknown", value))))
 * ```
 *
 * @param localName - Local name (e.g., "Player")
 * @param localNameMap - Case-insensitive local name to IRI map from buildLocalNameToIriMap
 * @returns Full IRI if found, undefined otherwise
 * @category utilities
 * @since 0.0.0
 */
export const expandLocalNameToIri: {
  (localName: string, localNameMap: MutableHashMap.MutableHashMap<string, IRI>): O.Option<IRI>;
  (localNameMap: MutableHashMap.MutableHashMap<string, IRI>): (localName: string) => O.Option<IRI>;
} = dual(
  2,
  (localName: string, localNameMap: MutableHashMap.MutableHashMap<string, IRI>): O.Option<IRI> =>
    MutableHashMap.get(localNameMap, Str.toLowerCase(localName))
);

/**
 * Expand an array of local names to full IRIs.
 *
 * **Details**
 *
 * Filters out any local names that don't match known IRIs.
 *
 * **Example** (Inspect expand types to iris)
 *
 * ```ts
 * import { IRI } from "@beep/rdf"
 * import { buildLocalNameToIriMapSafe, expandTypesToIris } from "@effect-ontology/Utils/Iri"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const iris = S.decodeUnknownOption(S.Array(IRI))([
 *   "https://ontology/Player",
 *   "https://ontology/Team"
 * ])
 * console.log(O.map(iris, (values) =>
 *   expandTypesToIris(["player", "Team", "Unknown"], buildLocalNameToIriMapSafe(values).map)
 * ))
 * ```
 *
 * @param localNames - Array of local names
 * @param localNameMap - Case-insensitive local name to IRI map
 * @returns Array of full IRIs (only valid expansions)
 * @category utilities
 * @since 0.0.0
 */
export const expandTypesToIris: {
  (localNames: ReadonlyArray<string>, localNameMap: MutableHashMap.MutableHashMap<string, IRI>): ReadonlyArray<IRI>;
  (localNameMap: MutableHashMap.MutableHashMap<string, IRI>): (localNames: ReadonlyArray<string>) => ReadonlyArray<IRI>;
} = dual(
  2,
  (localNames: ReadonlyArray<string>, localNameMap: MutableHashMap.MutableHashMap<string, IRI>): ReadonlyArray<IRI> =>
    pipe(localNames, A.flatMap(flow(expandLocalNameToIri(localNameMap), O.toArray)))
);

/**
 * Get all valid local names from a set of IRIs.
 *
 * **Example** (Collect no local names)
 *
 * ```ts
 * import { getLocalNameSet } from "@effect-ontology/Utils/Iri"
 * import * as MutableHashSet from "effect/MutableHashSet"
 *
 * console.log(MutableHashSet.size(getLocalNameSet([]))) // 0
 * ```
 *
 * @param iris - Array of canonical IRIs
 * @returns Set of lowercase local names
 * @category utilities
 * @since 0.0.0
 */
export const getLocalNameSet = (iris: ReadonlyArray<IRI>): MutableHashSet.MutableHashSet<string> =>
  MutableHashSet.fromIterable(A.map(iris, flow(extractLocalNameFromIri, Str.toLowerCase)));
