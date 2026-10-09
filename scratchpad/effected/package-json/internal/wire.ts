// The open-JSON ↔ class wire transform shared by `Package` (and its
// `.extend()`ed subclasses via `Package.wireFor`) and the presence-lenient
// `PackageManifest`. Raw object keys are partitioned against `Class.fields`:
// known keys decode to typed members, the remainder flow into the `rest`
// catch-all; on encode `rest` flattens back to top-level keys, so the on-disk
// shape never carries a literal `rest` key.
//
// Private implementation module — never re-exported from `index.ts`.

import { Schema, SchemaTransformation } from "effect";

const RawJson = Schema.Record(Schema.String, Schema.Unknown);

/**
 * Build the open-JSON ↔ class wire codec for a `Schema.Class` carrying a
 * `rest` catch-all field. Generic over the class so `Package`, its
 * `.extend()`ed subclasses and `PackageManifest` all share the one
 * implementation and cannot drift.
 */
export const makeWire = <Self>(
	// biome-ignore lint/suspicious/noExplicitAny: invariant Encoded slot — a concrete type is rejected by the class-factory generics
	Class: Schema.Codec<Self, any, any, any> & { readonly fields: Record<string, unknown> },
): Schema.Codec<Self, { readonly [k: string]: unknown }> => {
	const knownKeys = new Set(Object.keys(Class.fields).filter((k) => k !== "rest"));
	const wire = RawJson.pipe(
		Schema.decodeTo(
			Class,
			SchemaTransformation.transform({
				decode: (raw: { readonly [k: string]: unknown }) => {
					const known: Record<string, unknown> = {};
					// A null-prototype record: on a plain object, `rest["__proto__"] = v`
					// MUTATES the prototype instead of storing data, so a manifest
					// carrying an own `__proto__` key would both pollute the record and
					// lose the key on encode. Known keys come from `Class.fields` and
					// cannot collide with `__proto__`.
					const rest: Record<string, unknown> = Object.create(null);
					for (const [key, value] of Object.entries(raw)) {
						if (knownKeys.has(key)) known[key] = value;
						else rest[key] = value;
					}
					// Spread uses define-own-property semantics, so an own `__proto__`
					// data key survives into the encode side untouched.
					return { ...known, rest };
				},
				encode: (encoded: Record<string, unknown>) => {
					const { rest, ...known } = encoded as Record<string, unknown> & { rest?: Record<string, unknown> };
					// Typed fields win on a key collision: a hand-built instance whose
					// `rest` smuggles a known key (including an .extend()ed subclass
					// field — this is the one shared wire implementation behind
					// `Package.schema`, `Package.wireFor` and `PackageManifest.schema`)
					// must not shadow the typed member on the wire.
					return { ...(rest ?? {}), ...known };
				},
			}),
		),
	);
	return wire as unknown as Schema.Codec<Self, { readonly [k: string]: unknown }>;
};
