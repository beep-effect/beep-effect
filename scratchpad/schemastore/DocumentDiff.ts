// Classifies the difference between two emitted schema documents by what
// the difference MEANS, not by how the bytes read: a change confined to
// documentation keywords is transparently replaceable for consumers, while
// a change to any assertion keyword alters the validation contract and is
// the signal to cut a new schema version.
//
// Pure — no IO. `SchemaFile` consumes it to answer what changed alongside
// whether it wrote.

import { MAX_NESTING_DEPTH } from "./internal/limits.ts";
import { KeywordFamilies } from "./KeywordFamilies.ts";

/**
 * What differs between two schema documents:
 *
 * - `"none"` — the documents are equal in content (key ORDER is not a
 *   difference; array order is).
 * - `"annotations"` — only documentation keywords differ (see
 *   {@link DocumentDiff.isAnnotationKeyword}). The validation contract is
 *   identical, so the new document replaces the old transparently for
 *   every consumer — republish without cutting a version.
 * - `"contract"` — at least one assertion keyword differs, so a document
 *   valid against one is not necessarily valid against the other. Under
 *   {@link SchemaVersioning}, this is the change that warrants a new
 *   version rather than an in-place replacement.
 *
 * @public
 */
export type SchemaChange = "none" | "annotations" | "contract";

// Documentation-only keywords: prose and editor affordances a consumer
// reads but no validator asserts on.
//
// `default`, `examples`, `readOnly` and `writeOnly` are annotations in the
// Draft-07 vocabulary's own taxonomy but are DELIBERATELY excluded — form
// generators and clients act on them, so a change there is not
// transparently replaceable. The asymmetry is intentional: misreporting a
// contract change as `"annotations"` ships a silent breaking change, while
// misreporting the reverse only costs an unnecessary version bump. When in
// doubt this set stays small.
const DOCUMENTATION_KEYWORDS = new Set(["title", "description", "$comment"]);

// Keywords whose value is a MAP of property name → schema.
const SCHEMA_MAP_KEYWORDS = new Set(["properties", "patternProperties", "$defs", "definitions"]);

// Keywords whose value is an ARRAY of schemas.
const SCHEMA_ARRAY_KEYWORDS = new Set(["allOf", "anyOf", "oneOf"]);

// Keywords whose value is a single schema.
const SCHEMA_KEYWORDS = new Set([
	"additionalItems",
	"additionalProperties",
	"propertyNames",
	"contains",
	"if",
	"then",
	"else",
	"not",
]);

const isSchemaObject = (node: unknown): node is Record<string, unknown> =>
	typeof node === "object" && node !== null && !Array.isArray(node);

// A stack guard for the leaf value comparison, deliberately looser than the
// structural cap above: `MAX_NESTING_DEPTH` bounds how deep the walk keeps
// CLASSIFYING, while this only stops the comparison from overflowing the
// stack on hostile (or cyclic) input. Sharing one budget between the two
// made a deeply-nested but identical document compare as different, because
// the fallback ran out of frames before reaching the leaves.
const VALUE_COMPARISON_STACK_GUARD = MAX_NESTING_DEPTH * 8;

// Order-insensitive for object keys, order-sensitive for arrays — key order
// is a serialization detail (a formatter may sort), element order is data.
// Past the stack guard, unequal-by-reference is reported as different,
// which is the conservative direction.
const deepEqual = (a: unknown, b: unknown, depth: number): boolean => {
	if (a === b) {
		return true;
	}
	if (depth >= VALUE_COMPARISON_STACK_GUARD) {
		return false;
	}
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
			return false;
		}
		return a.every((element, index) => deepEqual(element, b[index], depth + 1));
	}
	if (!isSchemaObject(a) || !isSchemaObject(b)) {
		// Primitives that failed `===` (including NaN, and null vs object).
		return false;
	}
	const aKeys = Object.keys(a);
	if (aKeys.length !== Object.keys(b).length) {
		return false;
	}
	return aKeys.every(
		(key) => Object.hasOwn(b, key) && deepEqual(a[key], (b as Record<string, unknown>)[key], depth + 1),
	);
};

// `"contract"` dominates `"annotations"` dominates `"none"`.
const worst = (left: SchemaChange, right: SchemaChange): SchemaChange => {
	if (left === "contract" || right === "contract") {
		return "contract";
	}
	if (left === "annotations" || right === "annotations") {
		return "annotations";
	}
	return "none";
};

const isAnnotationKey = (key: string): boolean => DOCUMENTATION_KEYWORDS.has(key) || KeywordFamilies.isDeclared(key);

// Compares two nodes standing at a SCHEMA position. Only here is a key read
// as a keyword — inside `properties`, `enum`, `const` and friends the same
// text is data, and the descent below never treats it otherwise.
const compareSchema = (a: unknown, b: unknown, depth: number): SchemaChange => {
	if (a === b) {
		return "none";
	}
	if (depth >= MAX_NESTING_DEPTH) {
		// Past the cap the walk stops distinguishing: a difference of any
		// kind below here reads as a contract change (the safe direction).
		return deepEqual(a, b, 0) ? "none" : "contract";
	}
	if (!isSchemaObject(a) || !isSchemaObject(b)) {
		// Draft-07 boolean schemas and any non-object leaf.
		return deepEqual(a, b, depth) ? "none" : "contract";
	}

	let change: SchemaChange = "none";
	const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
	for (const key of keys) {
		const present = Object.hasOwn(a, key) && Object.hasOwn(b, key);
		if (!present) {
			// A keyword added or removed outright: annotation keywords stay
			// transparent, everything else changes the contract.
			change = worst(change, isAnnotationKey(key) ? "annotations" : "contract");
			if (change === "contract") {
				return "contract";
			}
			continue;
		}
		const left = a[key];
		const right = b[key];
		if (isAnnotationKey(key)) {
			change = worst(change, deepEqual(left, right, depth) ? "none" : "annotations");
			continue;
		}
		if (SCHEMA_MAP_KEYWORDS.has(key)) {
			change = worst(change, compareSchemaMap(left, right, depth + 1));
		} else if (SCHEMA_ARRAY_KEYWORDS.has(key)) {
			change = worst(change, compareSchemaArray(left, right, depth + 1));
		} else if (SCHEMA_KEYWORDS.has(key)) {
			change = worst(change, compareSchema(left, right, depth + 1));
		} else if (key === "items") {
			change = worst(
				change,
				Array.isArray(left) || Array.isArray(right)
					? compareSchemaArray(left, right, depth + 1)
					: compareSchema(left, right, depth + 1),
			);
		} else if (key === "dependencies") {
			change = worst(change, compareDependencies(left, right, depth + 1));
		} else {
			// Data-position keywords (`type`, `enum`, `const`, `required`,
			// `default`, `examples`, `$ref`, `$id`, ...) and any unknown key:
			// compared as opaque values, never descended into.
			change = worst(change, deepEqual(left, right, depth) ? "none" : "contract");
		}
		if (change === "contract") {
			return "contract";
		}
	}
	return change;
};

const compareSchemaMap = (a: unknown, b: unknown, depth: number): SchemaChange => {
	if (!isSchemaObject(a) || !isSchemaObject(b)) {
		return deepEqual(a, b, depth) ? "none" : "contract";
	}
	let change: SchemaChange = "none";
	const names = new Set([...Object.keys(a), ...Object.keys(b)]);
	for (const name of names) {
		// A property appearing or disappearing is a contract change, whatever
		// the subschema says.
		if (!Object.hasOwn(a, name) || !Object.hasOwn(b, name)) {
			return "contract";
		}
		change = worst(change, compareSchema(a[name], b[name], depth + 1));
		if (change === "contract") {
			return "contract";
		}
	}
	return change;
};

const compareSchemaArray = (a: unknown, b: unknown, depth: number): SchemaChange => {
	if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
		return "contract";
	}
	let change: SchemaChange = "none";
	for (const [index, element] of a.entries()) {
		change = worst(change, compareSchema(element, b[index], depth + 1));
		if (change === "contract") {
			return "contract";
		}
	}
	return change;
};

// Draft-07 `dependencies` values are either a schema or an array of
// property names; the array form is data.
const compareDependencies = (a: unknown, b: unknown, depth: number): SchemaChange => {
	if (!isSchemaObject(a) || !isSchemaObject(b)) {
		return deepEqual(a, b, depth) ? "none" : "contract";
	}
	let change: SchemaChange = "none";
	const names = new Set([...Object.keys(a), ...Object.keys(b)]);
	for (const name of names) {
		if (!Object.hasOwn(a, name) || !Object.hasOwn(b, name)) {
			return "contract";
		}
		const left = a[name];
		const right = b[name];
		change = worst(
			change,
			Array.isArray(left) || Array.isArray(right)
				? deepEqual(left, right, depth)
					? "none"
					: "contract"
				: compareSchema(left, right, depth + 1),
		);
		if (change === "contract") {
			return "contract";
		}
	}
	return change;
};

/**
 * Classifies the difference between two emitted schema documents by
 * meaning: identical, documentation-only, or a change to the validation
 * contract.
 *
 * The walk is keyword-position aware in exactly the way {@link DocumentLint}'s
 * is — a property NAMED `description` inside `properties` is data, not an
 * annotation — and object key order is never a difference, so a document
 * reformatted (or key-sorted) by another tool still classifies as `"none"`.
 *
 * Total: hostile nesting past the package's depth cap stops the structural
 * walk and degrades to a whole-subtree comparison reported as `"contract"`
 * when unequal, never a throw.
 *
 * @example
 * ```ts
 * import { DocumentDiff } from "@effected/schemastore";
 *
 * const before = { type: "object", properties: { name: { type: "string", description: "A" } } };
 * const after = { type: "object", properties: { name: { type: "string", description: "B" } } };
 *
 * console.log(DocumentDiff.classify(before, after));
 * // => "annotations"  (republish transparently; no new version needed)
 *
 * console.log(DocumentDiff.classify(before, { ...before, required: ["name"] }));
 * // => "contract"     (documents valid before may be invalid now)
 * ```
 *
 * @public
 */
export class DocumentDiff {
	private constructor() {}

	/**
	 * Classify the difference between two emitted document values (the
	 * `toJson()` publication shape, or anything parsed from a written
	 * schema file). Both sides are plain JSON values, so this compares an
	 * on-disk document against a freshly built one without either being a
	 * {@link StoreDocument}.
	 */
	static classify(existing: unknown, next: unknown): SchemaChange {
		return compareSchema(existing, next, 0);
	}

	/**
	 * Whether a classification means "nothing changed" — `true` only for
	 * `"none"`.
	 *
	 * Exists so the clean case is not a string literal every consumer
	 * spells for itself. `"created"` is deliberately NOT clean: a file that
	 * did not exist is a change.
	 */
	static isClean(change: SchemaChange | "created"): boolean {
		return change === "none";
	}

	/**
	 * Whether `key`, standing at a schema position, is a documentation
	 * keyword: `title`, `description`, `$comment`, or any declared
	 * non-standard language-server family ({@link KeywordFamilies}).
	 *
	 * `default`, `examples`, `readOnly` and `writeOnly` are deliberately
	 * NOT documentation — consumers act on them.
	 */
	static isAnnotationKeyword(key: string): boolean {
		return isAnnotationKey(key);
	}
}
