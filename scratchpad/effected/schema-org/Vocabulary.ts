import { Option } from "effect";
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
 * The walk is a cycle-guarded set union rather than a parent chain, because
 * the hierarchy is a DAG — 57 classes have more than one parent, and following
 * only the first silently truncates the closure into false rejections that are
 * indistinguishable from a missing-inheritance bug. Foreign parents were
 * dropped at generation time, so a branch that left the schema namespace
 * simply terminates here while its native siblings still carry the answer.
 */
function walkAncestors(index: number): ReadonlySet<number> {
	const seen = new Set<number>();
	const stack = [...decodeRow(SUB_CLASS_OF[index])];
	while (stack.length > 0) {
		const parent = stack.pop();
		if (parent === undefined || seen.has(parent)) continue;
		seen.add(parent);
		for (const grandparent of decodeRow(SUB_CLASS_OF[parent])) stack.push(grandparent);
	}
	return seen;
}

// Rows decode on demand and are memoized by index: a caller that asks about
// three types never pays to decode the other 930.
const ancestorCache: Array<ReadonlySet<number> | undefined> = new Array<ReadonlySet<number> | undefined>(
	TYPE_NAMES.length,
);
const propertyCache: Array<ReadonlySet<number> | undefined> = new Array<ReadonlySet<number> | undefined>(
	TYPE_NAMES.length,
);

function ancestorIndices(index: number): ReadonlySet<number> {
	const cached = ancestorCache[index];
	if (cached !== undefined) return cached;
	const computed = walkAncestors(index);
	ancestorCache[index] = computed;
	return computed;
}

/** Every property legal on a type index: its own `domainIncludes` members unioned with every ancestor's. */
function propertyIndices(index: number): ReadonlySet<number> {
	const cached = propertyCache[index];
	if (cached !== undefined) return cached;
	const computed = new Set<number>();
	for (const property of decodeRow(DOMAIN_PROPERTIES[index])) computed.add(property);
	for (const ancestor of ancestorIndices(index)) {
		for (const property of decodeRow(DOMAIN_PROPERTIES[ancestor])) computed.add(property);
	}
	propertyCache[index] = computed;
	return computed;
}

/** Resolve a superseding index against its name table. */
function supersedingName(index: number | undefined, names: readonly string[]): Option.Option<string> {
	if (index === undefined) return Option.none();
	const name = names[index];
	return name === undefined ? Option.none() : Option.some(name);
}

/**
 * A read API over the vendored schema.org vocabulary: which terms exist, how
 * the class hierarchy runs, and which properties a type may legally carry.
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
 * @example
 * ```ts
 * import { Vocabulary } from "./conformance-entry.ts";
 *
 * // `license` names only CreativeWork in its domainIncludes; this is legal
 * // through SoftwareSourceCode -> CreativeWork.
 * console.log(Vocabulary.isPropertyOn("license", "SoftwareSourceCode"));
 * // => true
 * console.log(Vocabulary.isPropertyOn("softwareVersion", "SoftwareSourceCode"));
 * // => false
 * ```
 *
 * @see {@link https://schema.org/docs/schemas.html | schema.org vocabulary}
 * @public
 */
export class Vocabulary {
	/**
	 * The schema.org release the compiled-in vocabulary was generated from, as
	 * upstream spells it (`"30.0"`).
	 *
	 * Surfaced at runtime so a consumer's CI can report which vocabulary its
	 * gate ran against: a later disagreement about whether a term is legal
	 * cannot be attributed without it.
	 */
	static readonly version: string = VOCABULARY_VERSION;

	/** Whether `name` is a class schema.org defines — for example `"TechArticle"`. */
	static hasType(name: string): boolean {
		return TYPE_INDEX.has(name);
	}

	/** Whether `name` is a property schema.org defines — for example `"codeRepository"`. */
	static hasProperty(name: string): boolean {
		return PROPERTY_INDEX.has(name);
	}

	/**
	 * Every supertype of `type`, transitively, **excluding `type` itself**.
	 * Empty for an unknown type and for `Thing`, which has no supertype.
	 *
	 * @remarks
	 * The hierarchy is a DAG, not a tree, so this is a set rather than a chain:
	 * `HowToStep` is simultaneously a `ListItem`, a `CreativeWork` and an
	 * `ItemList`, and all three arms are present here along with everything
	 * above them.
	 */
	static ancestorsOf(type: string): ReadonlySet<string> {
		const index = TYPE_INDEX.get(type);
		if (index === undefined) return new Set<string>();
		const out = new Set<string>();
		for (const ancestor of ancestorIndices(index)) {
			const name = TYPE_NAMES[ancestor];
			if (name !== undefined) out.add(name);
		}
		return out;
	}

	/**
	 * Every property legal on `type`, **including inherited ones**. Empty for an
	 * unknown type.
	 *
	 * @remarks
	 * Inheritance is the whole content of this answer: `SoftwareSourceCode`
	 * declares none of `license`, `name` or `description` in its own
	 * `domainIncludes` — they arrive from `CreativeWork` and `Thing`.
	 */
	static propertiesOf(type: string): ReadonlySet<string> {
		const index = TYPE_INDEX.get(type);
		if (index === undefined) return new Set<string>();
		const out = new Set<string>();
		for (const property of propertyIndices(index)) {
			const name = PROPERTY_NAMES[property];
			if (name !== undefined) out.add(name);
		}
		return out;
	}

	/**
	 * Whether `property` is legal on `type`: is any of the property's
	 * `domainIncludes` entries anywhere in the type's ancestor closure?
	 *
	 * @remarks
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
	 */
	static isPropertyOn(property: string, type: string): boolean {
		const typeIdx = TYPE_INDEX.get(type);
		const propertyIdx = PROPERTY_INDEX.get(property);
		if (typeIdx === undefined || propertyIdx === undefined) return false;
		return propertyIndices(typeIdx).has(propertyIdx);
	}

	/**
	 * The term that supersedes `term`, when schema.org has deprecated it —
	 * `Vocabulary.supersededBy("episodes")` is `Option.some("episode")`.
	 * `Option.none()` for a current term and for an unknown one.
	 *
	 * @remarks
	 * Deprecated terms are kept in the table and are **valid but flagged**,
	 * never reported unknown and never rejected by default, exactly as
	 * `@effected/spdx` treats a deprecated license id.
	 *
	 * One lookup covers classes and properties because the two namespaces are
	 * disjoint in release 30.0 — every class name begins uppercase and every property
	 * name lowercase,, and no name appears in both tables.
	 */
	static supersededBy(term: string): Option.Option<string> {
		const typeIdx = TYPE_INDEX.get(term);
		if (typeIdx !== undefined) return supersedingName(SUPERSEDED_TYPE_MAP.get(typeIdx), TYPE_NAMES);
		const propertyIdx = PROPERTY_INDEX.get(term);
		if (propertyIdx !== undefined) return supersedingName(SUPERSEDED_PROPERTY_MAP.get(propertyIdx), PROPERTY_NAMES);
		return Option.none();
	}
}
