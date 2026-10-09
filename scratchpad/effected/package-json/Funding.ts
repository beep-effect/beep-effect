// The `funding` field model: where to send money for a package.
//
// npm accepts three encodings — a bare URL string, an object with `url` and an
// optional `type`, or an array mixing either — and this model normalizes the
// READ side of that: `Funding.FromField` always decodes to an array, so a
// consumer crediting maintainers never branches on arity.
//
// The WRITE side is not normalized, which is the whole difficulty. The package
// holds the same wire-fidelity requirement `Person`, `Repository` and `Bugs`
// do: a formatter must not rewrite one legal encoding into another. A lone
// entry read as a bare value therefore re-encodes as a bare value, never as a
// one-element array, and an entry read from the string form re-encodes to that
// exact string. Both are remembered as provenance beside the instance — its
// wire value, and whether it was the whole field written bare — because
// provenance must not appear in the encoded output, must not affect
// structural equality, and must not survive being copied into a hand-built
// value.
//
// Unlike `Bugs`, whose email-only entry makes `url` optional, `url` is
// REQUIRED here: npm's object form carries no other way to say where the money
// goes, so an entry without one is a decode failure rather than a
// partially-populated value. The failure is expressed the way every other
// shape violation in this tier is — as a schema issue, which the manifest
// tiers normalize to `PackageDecodeError` at their decode boundary — rather
// than as a degradation, which is `LenientManifest`'s job alone.

import type { SchemaIssue } from "effect";
import { Effect, Schema, SchemaTransformation } from "effect";

/** The wire value a single funding entry was decoded from. */
type EntryWire = string | { readonly [k: string]: unknown };

const entryWires = new WeakMap<Funding, EntryWire>();

/**
 * Entries that were the WHOLE field, written bare rather than inside an array.
 *
 * Keyed by the ENTRY, not by the decoded array: `Schema.Array` rebuilds the
 * array on the way out of the transform, so an array-keyed WeakMap is empty by
 * the time `encode` runs — verified by the arity round trip failing under it.
 * Arity provenance therefore rides the one instance that was the field, and
 * the replay is guarded on that instance still being alone.
 */
const bareEntries = new WeakSet<Funding>();

const KNOWN_FUNDING_KEYS: ReadonlySet<string> = new Set(["type", "url"]);

// Validated by the same route `Person.schema` uses: the struct produces the
// issue tree, so a missing or non-string `url` reads exactly as it would from
// decoding the class directly.
const FundingFields = Schema.Struct({
	type: Schema.optionalKey(Schema.String),
	url: Schema.String,
});

const decodeFundingFields = Schema.decodeUnknownEffect(FundingFields);

const restOf = (raw: { readonly [k: string]: unknown }): Record<string, unknown> => {
	const rest: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(raw)) {
		if (!KNOWN_FUNDING_KEYS.has(key)) rest[key] = value;
	}
	return rest;
};

/**
 * Whether the remembered object still describes this entry. Guarding the
 * replay is load-bearing: `Schema.Class` instances are not frozen, so an entry
 * mutated in place keeps a provenance entry that no longer describes it, and
 * an unguarded replay would write the ORIGINAL object back — silently
 * discarding the edit.
 */
const isFaithfulObject = (wire: { readonly [k: string]: unknown }, funding: Funding): boolean => {
	if (wire.url !== funding.url) return false;
	if ((typeof wire.type === "string" ? wire.type : undefined) !== funding.type) return false;
	// Keys added to `rest` after the decode are not in the remembered object.
	for (const [key, value] of Object.entries(funding.rest ?? {})) {
		if (wire[key] !== value) return false;
	}
	return true;
};

/** Whether the bare string form can still carry everything this entry holds. */
const isStringExpressible = (funding: Funding): boolean =>
	funding.type === undefined && Object.keys(funding.rest ?? {}).length === 0;

const encodeEntry = (funding: Funding): EntryWire => {
	const wire = entryWires.get(funding);
	// Shape fidelity, `Person`'s rule: an edited string entry re-emits as a
	// STRING (rebuilt from the new url), not upgraded to the object form — a
	// manifest's `funding` must not change representation because the url was
	// edited. The object form is the fallback only when the string genuinely
	// cannot carry the value, which is exactly when the entry gained a `type`
	// or an unknown key, since a string has no syntax for either.
	if (typeof wire === "string" && isStringExpressible(funding)) return funding.url;
	if (wire !== undefined && typeof wire !== "string" && isFaithfulObject(wire, funding)) return wire;
	return {
		...(funding.type !== undefined && { type: funding.type }),
		url: funding.url,
		...funding.rest,
	};
};

const decodeEntry = (input: EntryWire): Effect.Effect<Funding, SchemaIssue.Issue> => {
	if (typeof input === "string") {
		const funding = Funding.make({ url: input });
		entryWires.set(funding, input);
		return Effect.succeed(funding);
	}
	return decodeFundingFields(input).pipe(
		Effect.mapError((error) => error.issue),
		Effect.map((fields) => {
			const rest = restOf(input);
			const funding = Funding.make({ ...fields, ...(Object.keys(rest).length > 0 ? { rest } : {}) });
			entryWires.set(funding, input);
			return funding;
		}),
	);
};

const EntryValue = Schema.Union([Schema.Record(Schema.String, Schema.Unknown), Schema.String]);
const FieldValue = Schema.Union([EntryValue, Schema.Array(EntryValue)]);

/**
 * Where to send money for a package: one funding entry.
 *
 * @remarks
 * npm's `funding` field accepts a bare URL string, this object form, or an
 * array of either. `url` is **required** — it is the only thing the field
 * actually says — so an object without one fails to decode rather than
 * producing a half-populated entry. `type` (`"individual"`, `"github"`, …) is
 * caller data and is kept **verbatim**, never normalized.
 *
 * @example
 * ```ts
 * import { Funding } from "./index.ts";
 * import { Effect, Schema } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   // Always an array, whichever encoding the manifest used.
 *   const entries = yield* Schema.decodeUnknownEffect(Funding.FromField)("https://example.com/sponsor");
 *   console.log(entries[0]?.url); // "https://example.com/sponsor"
 * });
 * ```
 *
 * @public
 */
export class Funding extends Schema.Class<Funding>("Funding")({
	/** The funding platform, when the object form carried one (`"github"`, …). */
	type: Schema.optionalKey(Schema.String),
	/** Where the money goes, exactly as the manifest wrote it. */
	url: Schema.String,
	/** Keys outside the documented set, preserved so encoding does not drop them. */
	rest: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
}) {
	/**
	 * A single `funding` entry: the bare URL string or the object form, always
	 * decoded to a {@link Funding} and always re-encoded in the form it was read
	 * from.
	 *
	 * @remarks
	 * Provenance belongs to the instance, so an entry that is *rebuilt* rather
	 * than carried through has none and encodes in the canonical object form.
	 */
	static readonly FromValue: Schema.Codec<Funding, string | { readonly [k: string]: unknown }> = EntryValue.pipe(
		Schema.decodeTo(
			Schema.instanceOf(Funding),
			// `transformEffect` rather than `transform`: this transform constructs
			// the instance itself — the only way to associate the raw wire value
			// with the result — so it must carry the field validation the class
			// factory would otherwise perform, including the required `url`.
			SchemaTransformation.transformEffect({
				decode: (input: string | { readonly [k: string]: unknown }) => decodeEntry(input),
				encode: (funding: Funding) => Effect.succeed(encodeEntry(funding)),
			}),
		),
	);

	/**
	 * The `funding` field: a lone entry or an array of them, **always** decoded
	 * to an array so a consumer never branches on arity.
	 *
	 * @remarks
	 * The normalization is one-directional. A field written bare re-encodes
	 * bare, not as a one-element array — the arity is remembered against the
	 * single entry that WAS the field, and the replay is guarded on that entry
	 * still being alone, so pushing a second entry into the decoded array in
	 * place upgrades the field to the array form instead of silently dropping
	 * the addition. An entry built by hand has no provenance, so an array of
	 * such entries encodes as an array.
	 */
	static readonly FromField: Schema.Codec<
		ReadonlyArray<Funding>,
		string | { readonly [k: string]: unknown } | ReadonlyArray<string | { readonly [k: string]: unknown }>
	> = FieldValue.pipe(
		Schema.decodeTo(
			Schema.Array(Schema.instanceOf(Funding)),
			SchemaTransformation.transformEffect({
				decode: (
					input: string | { readonly [k: string]: unknown } | ReadonlyArray<string | { readonly [k: string]: unknown }>,
				) => {
					const bare = !Array.isArray(input);
					const values = (bare ? [input] : input) as ReadonlyArray<EntryWire>;
					return Effect.map(Effect.forEach(values, decodeEntry), (entries) => {
						const only = entries[0];
						if (bare && only !== undefined) bareEntries.add(only);
						return entries;
					});
				},
				encode: (entries: ReadonlyArray<Funding>) => {
					const only = entries.length === 1 ? entries[0] : undefined;
					// Guarded on the entry still being alone: pushing a second entry
					// into the decoded field upgrades it to the array form rather
					// than silently dropping the addition.
					if (only !== undefined && bareEntries.has(only)) return Effect.succeed(encodeEntry(only));
					return Effect.succeed(entries.map(encodeEntry));
				},
			}),
		),
	);
}
