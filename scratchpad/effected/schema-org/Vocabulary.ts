import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import {
	DOMAIN_PROPERTIES,
	PROPERTY_INDEX,
	PROPERTY_NAMES,
	SUB_CLASS_OF,
	SUPERSEDED_PROPERTY_MAP,
	SUPERSEDED_TYPE_MAP,
	TYPE_INDEX,
	TYPE_NAMES,
	VOCABULARY_VERSION,
	decodeRow,
} from "./internal/vocabulary.ts";

/**
 * Strict ancestors of a type index: every supertype reachable through
 * `rdfs:subClassOf`, excluding the type itself.
 *
 * **Details**
 *
 * The walk is a cycle-guarded set union rather than a parent chain, because
 * the hierarchy is a DAG — 57 classes have more than one parent, and following
 * only the first silently truncates the closure into false rejections that are
 * indistinguishable from a missing-inheritance bug. Foreign parents were
 * dropped at generation time, so a branch that left the schema namespace
 * simply terminates here while its native siblings still carry the answer.
 */
function walkAncestors(index: number): ReadonlyArray<number> {
	const order: Array<number> = [];
	const seen = MutableHashSet.empty<number>();
	const stack = [...decodeRow(SUB_CLASS_OF[index])];
	while (stack.length > 0) {
		const parent = stack.pop();
		if (parent === undefined || MutableHashSet.has(seen, parent)) continue;
		MutableHashSet.add(seen, parent);
		order.push(parent);
		for (const grandparent of decodeRow(SUB_CLASS_OF[parent])) stack.push(grandparent);
	}
	return order;
}

// Rows decode on demand and are memoized by index: a caller that asks about
// three types never pays to decode the other 930.
const ancestorCache: Array<ReadonlyArray<number> | undefined> = new Array<ReadonlyArray<number> | undefined>(
	TYPE_NAMES.length,
);
const propertyCache: Array<ReadonlyArray<number> | undefined> = new Array<ReadonlyArray<number> | undefined>(
	TYPE_NAMES.length,
);

function ancestorIndices(index: number): ReadonlyArray<number> {
	const cached = ancestorCache[index];
	if (cached !== undefined) return cached;
	const computed = walkAncestors(index);
	ancestorCache[index] = computed;
	return computed;
}

/** Every property legal on a type index: its own `domainIncludes` members unioned with every ancestor's. */
function propertyIndices(index: number): ReadonlyArray<number> {
	const cached = propertyCache[index];
	if (cached !== undefined) return cached;
	const computed: Array<number> = [];
	const seen = MutableHashSet.empty<number>();
	for (const domain of [index, ...ancestorIndices(index)]) {
		for (const property of decodeRow(DOMAIN_PROPERTIES[domain])) {
			if (MutableHashSet.has(seen, property)) continue;
			MutableHashSet.add(seen, property);
			computed.push(property);
		}
	}
	propertyCache[index] = computed;
	return computed;
}

// Membership queries keep constant-time hashed lookup independently of public order.
const propertyMembershipCache: Array<HashSet.HashSet<number> | undefined> = [];
function propertyMembershipIndices(index: number): HashSet.HashSet<number> {
	const cached = propertyMembershipCache[index];
	if (cached !== undefined) return cached;
	const computed = HashSet.fromIterable(propertyIndices(index));
	propertyMembershipCache[index] = computed;
	return computed;
}

/**
 * A read API over the vendored schema.org vocabulary: which terms exist, how
 * the class hierarchy runs, and which properties a type may legally carry.
 *
 * **Details**
 *
 * This is the same data `Conformance` validates against, exported as a
 * queryable surface so a consumer building a *different* algebra over
 * schema.org does not have to re-vendor the dataset. It is offline, pinned and
 * total: every method is a pure lookup over compiled-in literals, and none of
 * them can fail.
 *
 * The vocabulary shipped is complete — every schema-native term at
 * {@link Vocabulary.version}, 933 classes and 1,521 properties, with no
 * scoping and no section cut. Completeness is what makes "this term does not
 * exist" an honest answer rather than an ambiguity between *you misspelled it*
 * and *that part was not shipped*.
 *
 * Foreign alignment terms (`gs1:`, `fibo-…`, `snomed:`, `foaf:`) are
 * deliberately absent: schema.org's document carries them under the same
 * `@type` as its own terms, but they are not terms schema.org defines and this
 * package does not claim to police them.
 *
 * **Example** (Check inherited property legality)
 *
 * ```ts
 * import { Vocabulary } from "@beep/scratchpad/effected/schema-org/Vocabulary";
 *
 * // `license` names only CreativeWork in its domainIncludes; this is legal
 * // through SoftwareSourceCode -> CreativeWork.
 * console.log(Vocabulary.isPropertyOn("license", "SoftwareSourceCode")); // true
 * console.log(Vocabulary.isPropertyOn("softwareVersion", "SoftwareSourceCode")); // false
 * ```
 *
 * @see {@link https://schema.org/docs/schemas.html | schema.org vocabulary} for the schema.org vocabulary documentation
 * @public
 * @category utilities
 * @since 0.0.0
 */
export class Vocabulary {
	/**
	 * The schema.org release the compiled-in vocabulary was generated from, as
	 * upstream spells it (`"30.0"`).
	 *
	 * **Details**
	 *
	 * Surfaced at runtime so a consumer's CI can report which vocabulary its
	 * gate ran against: a later disagreement about whether a term is legal
	 * cannot be attributed without it.
	 *
	 * **Example** (Report the vocabulary release)
	 *
	 * ```ts
	 * import { Vocabulary } from "@beep/scratchpad/effected/schema-org/Vocabulary";
	 *
	 * console.log(Vocabulary.version); // 30.0
	 * ```
	 *
	 * @category constants
	 * @since 0.0.0
	 */
	static readonly version: string = VOCABULARY_VERSION;

	/**
	 * Whether `name` is a class schema.org defines — for example `"TechArticle"`.
	 *
	 * **Example** (Recognize a schema.org class)
	 *
	 * ```ts
	 * import { Vocabulary } from "@beep/scratchpad/effected/schema-org/Vocabulary";
	 *
	 * console.log(Vocabulary.hasType("TechArticle")); // true
	 * console.log(Vocabulary.hasType("UnknownType")); // false
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	static hasType(name: string): boolean {
		return MutableHashMap.has(TYPE_INDEX, name);
	}

	/**
	 * Whether `name` is a property schema.org defines — for example `"codeRepository"`.
	 *
	 * **Example** (Recognize a schema.org property)
	 *
	 * ```ts
	 * import { Vocabulary } from "@beep/scratchpad/effected/schema-org/Vocabulary";
	 *
	 * console.log(Vocabulary.hasProperty("codeRepository")); // true
	 * console.log(Vocabulary.hasProperty("unknownProperty")); // false
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	static hasProperty(name: string): boolean {
		return MutableHashMap.has(PROPERTY_INDEX, name);
	}

	/**
	 * Every supertype of `type`, transitively, **excluding `type` itself**.
	 * Empty for an unknown type and for `Thing`, which has no supertype.
	 *
	 * **Details**
	 *
	 * The hierarchy is a DAG, not a tree, so this is a set rather than a chain:
	 * `HowToStep` is simultaneously a `ListItem`, a `CreativeWork` and an
	 * `ItemList`, and all three arms are present here along with everything
	 * above them.
	 *
	 * **Example** (Inspect inherited supertypes)
	 *
	 * ```ts
	 * import { Vocabulary } from "@beep/scratchpad/effected/schema-org/Vocabulary";
	 * import * as HashSet from "effect/HashSet";
	 *
	 * const ancestors = Vocabulary.ancestorsOf("HowToStep");
	 * console.log(HashSet.has(ancestors, "ListItem")); // true
	 * console.log(HashSet.has(ancestors, "CreativeWork")); // true
	 * console.log(HashSet.has(ancestors, "ItemList")); // true
	 * console.log(HashSet.has(ancestors, "HowToStep")); // false
	 * console.log(HashSet.size(Vocabulary.ancestorsOf("Thing"))); // 0
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	static ancestorsOf(type: string): HashSet.HashSet<string> {
		return HashSet.fromIterable(Vocabulary.ancestorsInOrder(type));
	}

	/**
	 * Strict ancestors in the original depth-first discovery order.
	 *
	 * **Example** (Inspect the ancestor discovery sequence)
	 *
	 * ```ts
	 * import { Vocabulary } from "@beep/scratchpad/effected/schema-org/Vocabulary";
	 *
	 * console.log(Vocabulary.ancestorsInOrder("SoftwareSourceCode").join(", ")); // CreativeWork, Thing
	 * console.log(Vocabulary.ancestorsInOrder("UnknownType").length); // 0
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	static ancestorsInOrder(type: string): ReadonlyArray<string> {
		return O.match(MutableHashMap.get(TYPE_INDEX, type), {
			onNone: () => [],
			onSome: (index) => A.getSomes(A.map(ancestorIndices(index), (ancestor) => A.get(TYPE_NAMES, ancestor))),
		});
	}

	/**
	 * Every property legal on `type`, **including inherited ones**. Empty for an
	 * unknown type.
	 *
	 * **Details**
	 *
	 * Inheritance is the whole content of this answer: `SoftwareSourceCode`
	 * declares none of `license`, `name` or `description` in its own
	 * `domainIncludes` — they arrive from `CreativeWork` and `Thing`.
	 *
	 * **Example** (Inspect inherited legal properties)
	 *
	 * ```ts
	 * import { Vocabulary } from "@beep/scratchpad/effected/schema-org/Vocabulary";
	 * import * as HashSet from "effect/HashSet";
	 *
	 * const properties = Vocabulary.propertiesOf("SoftwareSourceCode");
	 * console.log(HashSet.has(properties, "license")); // true
	 * console.log(HashSet.has(properties, "name")); // true
	 * console.log(HashSet.has(properties, "description")); // true
	 * console.log(HashSet.size(Vocabulary.propertiesOf("UnknownType"))); // 0
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	static propertiesOf(type: string): HashSet.HashSet<string> {
		return HashSet.fromIterable(Vocabulary.propertiesInOrder(type));
	}

	/**
	 * Legal properties in direct-domain then ancestor discovery order.
	 *
	 * **Example** (Inspect properties in discovery order)
	 *
	 * ```ts
	 * import { Vocabulary } from "@beep/scratchpad/effected/schema-org/Vocabulary";
	 * import * as A from "effect/Array";
	 *
	 * const properties = Vocabulary.propertiesInOrder("SoftwareSourceCode");
	 * console.log(A.contains(properties, "license")); // true
	 * console.log(Vocabulary.propertiesInOrder("UnknownType").length); // 0
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	static propertiesInOrder(type: string): ReadonlyArray<string> {
		return O.match(MutableHashMap.get(TYPE_INDEX, type), {
			onNone: () => [],
			onSome: (index) => A.getSomes(A.map(propertyIndices(index), (property) => A.get(PROPERTY_NAMES, property))),
		});
	}

	/**
	 * Whether `property` is legal on `type`: is any of the property's
	 * `domainIncludes` entries anywhere in the type's ancestor closure?
	 *
	 * **Gotchas**
	 *
	 * Two traps live in that one sentence, and a check that misses either
	 * rejects correct graphs. Legality is **inherited** — `license` carries
	 * exactly one `domainIncludes` entry, `CreativeWork`, and is legal on
	 * `SoftwareSourceCode` only through it. And a property may name **many**
	 * domains — 392 of the 1,521 do, up to 12 — so this is set intersection,
	 * never equality against the first entry.
	 *
	 * `false` when either term is unknown; ask {@link Vocabulary.hasType} or
	 * {@link Vocabulary.hasProperty} to tell those two answers apart, which is
	 * exactly what `Conformance` does.
	 *
	 * **Example** (Check inherited and unknown property domains)
	 *
	 * ```ts
	 * import { Vocabulary } from "@beep/scratchpad/effected/schema-org/Vocabulary";
	 *
	 * console.log(Vocabulary.isPropertyOn("license", "SoftwareSourceCode")); // true
	 * console.log(Vocabulary.isPropertyOn("softwareVersion", "SoftwareSourceCode")); // false
	 * console.log(Vocabulary.isPropertyOn("unknownProperty", "SoftwareSourceCode")); // false
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	static isPropertyOn(property: string, type: string): boolean {
		return O.match(O.all([
			MutableHashMap.get(TYPE_INDEX, type),
			MutableHashMap.get(PROPERTY_INDEX, property),
		]), {
			onNone: () => false,
			onSome: ([typeIdx, propertyIdx]) => HashSet.has(propertyMembershipIndices(typeIdx), propertyIdx),
		});
	}

	/**
	 * The term that supersedes `term`, when schema.org has deprecated it —
	 * `Vocabulary.supersededBy("episodes")` is `Option.some("episode")`.
	 * `Option.none()` for a current term and for an unknown one.
	 *
	 * **Details**
	 *
	 * Deprecated terms are kept in the table and are **valid but flagged**,
	 * never reported unknown and never rejected by default, exactly as
	 * `@effected/spdx` treats a deprecated license id.
	 *
	 * One lookup covers classes and properties because the two namespaces are
	 * disjoint in release 30.0 — every class name begins uppercase and every property
	 * name lowercase, and no name appears in both tables.
	 *
	 * **Example** (Resolve a deprecated property replacement)
	 *
	 * ```ts
	 * import { Vocabulary } from "@beep/scratchpad/effected/schema-org/Vocabulary";
	 * import * as O from "effect/Option";
	 *
	 * console.log(O.getOrElse(Vocabulary.supersededBy("episodes"), () => "none")); // episode
	 * console.log(O.isNone(Vocabulary.supersededBy("name"))); // true
	 * console.log(O.isNone(Vocabulary.supersededBy("unknownProperty"))); // true
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	static supersededBy(term: string): O.Option<string> {
		return O.match(MutableHashMap.get(TYPE_INDEX, term), {
			onSome: (index) => MutableHashMap.get(SUPERSEDED_TYPE_MAP, index).pipe(
				O.flatMap((superseding) => A.get(TYPE_NAMES, superseding)),
			),
			onNone: () => MutableHashMap.get(PROPERTY_INDEX, term).pipe(
				O.flatMap((index) => MutableHashMap.get(SUPERSEDED_PROPERTY_MAP, index)),
				O.flatMap((superseding) => A.get(PROPERTY_NAMES, superseding)),
			),
		});
	}
}
