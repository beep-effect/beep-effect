import type { Schema } from "effect";
import type { SchemaVersion } from "./SchemaVersioning.ts";

/**
 * A single schema publication target: an Effect Schema source paired with
 * the identity and destination it is serialized under. A repo generating
 * SchemaStore artifacts declares one target per emitted document (the
 * extraction source's `{schema, $id, path}` triples, generalized).
 *
 * Not a `Schema.Class`: a target carries a live Effect Schema value, which
 * is program wiring rather than serializable data.
 *
 * @public
 */
export interface SchemaTarget {
	/** The Effect Schema source the document is generated from. */
	readonly schema: Schema.Constraint;
	/** The canonical `$id` URL the generated document declares. */
	readonly $id: string;
	/**
	 * The catalog/file base name (`name.json` / `name-<version>.json`).
	 *
	 * Only the catalog path consumes it — a target that merely emits a file
	 * to `path` needs no name, and inventing one to
	 * satisfy the constructor duplicates the basename with no invariant
	 * tying the two together. Required whenever `version` is present, since
	 * versioned catalog naming is defined in terms of it.
	 */
	readonly name?: string;
	/** The destination path the document is written to (`SchemaFile`). */
	readonly path: string;
	/** The version label, for versioned catalog mode. Omit for unversioned. */
	readonly version?: SchemaVersion;
}

/**
 * Constructors for `SchemaTarget` values.
 *
 * @public
 */
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: deliberate — the class carries only statics and a private constructor, so it contributes no instance members to the merge; the interface (above) remains the sole shape of a SchemaTarget value.
export class SchemaTarget {
	private constructor() {}

	/**
	 * Builds an unversioned target. `name` is optional — only catalog
	 * naming reads it, so a target that merely emits a file needs none.
	 */
	static make(options: {
		readonly schema: Schema.Constraint;
		readonly $id: string;
		readonly name?: string;
		readonly path: string;
	}): SchemaTarget;
	/**
	 * Builds a versioned target. `name` is **required** here: versioned
	 * catalog naming is `name-<version>.json`, so a version without a name
	 * cannot be resolved — the overload pair makes that unrepresentable
	 * rather than a runtime throw.
	 */
	static make(options: {
		readonly schema: Schema.Constraint;
		readonly $id: string;
		readonly name: string;
		readonly path: string;
		readonly version: SchemaVersion;
	}): SchemaTarget;
	/**
	 * Builds a target. `$id` and `path` must be non-empty — an empty
	 * identity is a wiring mistake and throws, as does an empty `name` when
	 * one is given. The `name`-with-`version` invariant is enforced by the
	 * overloads above; the runtime check remains for untyped callers.
	 */
	static make(options: {
		readonly schema: Schema.Constraint;
		readonly $id: string;
		readonly name?: string;
		readonly path: string;
		readonly version?: SchemaVersion;
	}): SchemaTarget {
		for (const key of ["$id", "path"] as const) {
			if (options[key].length === 0) {
				throw new Error(`SchemaTarget.make requires a non-empty "${key}"`);
			}
		}
		if (options.name !== undefined && options.name.length === 0) {
			throw new Error('SchemaTarget.make requires a non-empty "name" when one is given');
		}
		if (options.version !== undefined && options.name === undefined) {
			throw new Error(
				'SchemaTarget.make requires a "name" when "version" is given (catalog naming is name-<version>.json)',
			);
		}
		return {
			schema: options.schema,
			$id: options.$id,
			path: options.path,
			...(options.name !== undefined ? { name: options.name } : {}),
			...(options.version !== undefined ? { version: options.version } : {}),
		};
	}
}
