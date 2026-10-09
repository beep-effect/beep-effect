// The kit-wide dependency-section vocabulary: one concept spelled two ways.
//
// A manifest declares dependencies under four *field names*
// (`dependencies` … `optionalDependencies`); a consumer usually branches on the
// four short *kinds* (`prod` … `optional`). Both views, and the bidirectional
// mapping between them, live here once — instead of package-json's
// `DependencyKind`, lockfiles' `DependencyType` and workspaces' hand-rolled
// field names each carrying a private copy.
//
// `KIND_TO_FIELD` is the single source of truth; the inverse is derived from it,
// so the correspondence is written once.

import { Schema } from "effect";

/**
 * The short dependency kind: which dependency map an entry came from, named the
 * way consumers branch on it.
 *
 * @public
 */
export const DependencyKind = Schema.Literals(["prod", "dev", "peer", "optional"]);

/**
 * The union of short dependency kinds.
 *
 * @public
 */
export type DependencyKind = typeof DependencyKind.Type;

/**
 * The manifest field name a dependency is declared under, matching the
 * `package.json` / `package-lock.json` key exactly.
 *
 * @public
 */
export const DependencyField = Schema.Literals([
	"dependencies",
	"devDependencies",
	"peerDependencies",
	"optionalDependencies",
]);

/**
 * The union of manifest dependency-map field names.
 *
 * @public
 */
export type DependencyField = typeof DependencyField.Type;

// Single source of truth for the kind <-> field correspondence.
const KIND_TO_FIELD = {
	prod: "dependencies",
	dev: "devDependencies",
	peer: "peerDependencies",
	optional: "optionalDependencies",
} as const satisfies Record<DependencyKind, DependencyField>;

// Inverse, derived from KIND_TO_FIELD so the mapping is written once.
const FIELD_TO_KIND = Object.fromEntries(
	Object.entries(KIND_TO_FIELD).map(([kind, field]) => [field, kind] as const),
) as Record<DependencyField, DependencyKind>;

/**
 * The dependency-section vocabulary: the two literal schemas
 * ({@link (DependencyKind:variable)}, {@link (DependencyField:variable)}) plus
 * the bidirectional mapping between a short kind and its manifest field name.
 *
 * @public
 */
export class DependencySection {
	private constructor() {}

	/** The short-kind literal schema (`prod` … `optional`). */
	static readonly Kind = DependencyKind;

	/** The manifest field-name literal schema (`dependencies` … `optionalDependencies`). */
	static readonly Field = DependencyField;

	/** The manifest field name a kind is declared under. See {@link DependencySection.Kind}. */
	static readonly fieldOf = (kind: DependencyKind): DependencyField => KIND_TO_FIELD[kind];

	/** The short kind for a manifest field name. See {@link DependencySection.Field}. */
	static readonly kindOf = (field: DependencyField): DependencyKind => FIELD_TO_KIND[field];
}
