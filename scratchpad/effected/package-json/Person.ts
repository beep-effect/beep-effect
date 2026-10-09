// The `author` / `contributors` field model: a `Person` class with structured
// `name` / `email` / `url` plus a `rest` catch-all, `Person.FromString` — the
// `"Name <email> (url)"` shorthand codec — and `Person.FromValue`, the union
// accepting either the object or the shorthand string. Wired into
// `Package.author` / `Package.contributors`.
//
// Wire-form fidelity is a hard requirement here: a formatter must not rewrite
// legal input into a different-but-equivalent encoding. Two mechanisms carry
// it. (1) A person decoded from the shorthand string re-encodes to that exact
// string — the original text is remembered in `wireStrings` and replayed
// verbatim, so unusual-but-legal spacing survives. (2) Unknown keys on the
// object form land in `rest` and flatten back on encode, instead of being
// silently dropped.

import { $ScratchpadId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as P from "effect/Predicate";
import * as R from "effect/Record";

const $I = $ScratchpadId.create("effected/package-json/Person");

const parsePersonString = (input: string): Person => {
	const emailMatch = input.match(/<([^>]+)>/);
	const urlMatch = input.match(/\(([^)]+)\)/);
	let name = input;
	if (emailMatch !== null) name = name.replace(emailMatch[0], "");
	if (urlMatch !== null) name = name.replace(urlMatch[0], "");
	name = name.trim();
	return Person.make({
		name,
		...(emailMatch !== null ? { email: emailMatch[1] } : {}),
		...(urlMatch !== null ? { url: urlMatch[1] } : {}),
	});
};

const serializePerson = (person: Person): string => {
	let result = person.name;
	if (person.email !== undefined) result += ` <${person.email}>`;
	if (person.url !== undefined) result += ` (${person.url})`;
	return result;
};

/** The verbatim wire value a person was decoded from: shorthand text or the raw object. */
type PersonWire = string | { readonly [k: string]: unknown };

// The wire value each person was decoded from, keyed by instance. A WeakMap
// rather than a field: this is provenance, not data — it must not appear in the
// encoded form, must not affect structural equality, and must not survive being
// copied into a hand-built person.
const wireForms = new WeakMap<Person, PersonWire>();

const rememberWire = (person: Person, wire: PersonWire): Person => {
	wireForms.set(person, wire);
	return person;
};

const KNOWN_KEYS: ReadonlySet<string> = new Set(["name", "email", "url"]);

// Structural comparison over arbitrary JSON `rest` values. `Equal.equals` is
// reference equality on plain objects, so it cannot serve here; the stored rest
// is derived from this very wire value, so a stringify comparison differs only
// when the person was actually edited — the conservative direction.
const sameRest = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});

// A remembered wire value is replayed only while it still describes the person
// faithfully. A person whose fields were changed after decoding re-encodes
// canonically instead of emitting stale text.
// Whether the shorthand grammar can carry this person at all. It has no syntax
// for extra keys, so a person holding a meaningful `rest` cannot be written as
// one. An EMPTY rest carries no information and does not disqualify anything.
//
// Two callers, deliberately the same predicate: the faithfulness guard (a
// remembered shorthand never describes a person that has since gained keys) and
// the re-encode fallback (an edited person re-emits shorthand only if it still
// fits). Splitting them would let a person be refused the replay yet handed back
// as shorthand, dropping the very keys the refusal detected.
const isShorthandExpressible = (person: Person): boolean =>
	person.rest === undefined || R.keys(person.rest).length === 0;

const isFaithful = (wire: PersonWire, person: Person): boolean => {
	if (P.isString(wire)) {
		const parsed = parsePersonString(wire);
		return (
			parsed.name === person.name &&
			parsed.email === person.email &&
			parsed.url === person.url &&
			// Without this clause the three named fields match, the wire replays,
			// and any added keys are silently dropped on write — the same
			// stale-provenance corruption the rest of this guard prevents, reached
			// through the one field the shorthand cannot express.
			isShorthandExpressible(person)
		);
	}
	const rest = restOf(wire);
	return (
		wire.name === person.name &&
		wire.email === person.email &&
		wire.url === person.url &&
		sameRest(rest, person.rest)
	);
};

// The modeled fields alone, used to validate the object wire form. Decoding
// through this rather than the class keeps the issue tree identical to what a
// direct class decode produced, while leaving instance construction to the
// transform so the raw object can be remembered.
const PersonFields = S.Struct({
	name: S.String,
	email: S.optionalKey(S.String),
	url: S.optionalKey(S.String),
});

const decodePersonFields = S.decodeUnknownEffect(PersonFields);

const restOf = (raw: { readonly [k: string]: unknown }): Record<string, unknown> => {
	const rest: Record<string, unknown> = {};
	for (const [key, value] of R.toEntries(raw)) {
		if (!KNOWN_KEYS.has(key)) rest[key] = value;
	}
	return rest;
};

// Replay the remembered object verbatim (key order included) while it still
// matches the person; otherwise rebuild it, typed fields winning on collision.
const encodePersonObject = (person: Person): { readonly [k: string]: unknown } => {
	const wire = wireForms.get(person);
	if (wire !== undefined && !P.isString(wire) && isFaithful(wire, person)) return wire;
	const known: Record<string, unknown> = { name: person.name };
	if (person.email !== undefined) known.email = person.email;
	if (person.url !== undefined) known.url = person.url;
	return { ...(person.rest ?? {}), ...known };
};

/**
 * A structured person object with `name`, optional `email` / `url`, and a
 * `rest` catch-all preserving any additional keys across a read/write cycle.
 *
 * @example
 * ```ts
 * import { Person } from "./index.ts";
 * import * as S from "effect/Schema";
 *
 * const ann = S.decodeUnknownSync(Person.FromValue)("Ann <ann@example.com> (https://example.com)");
 * ann.name; // => "Ann"
 * ann.email; // => "ann@example.com"
 * S.encodeSync(Person.FromValue)(ann); // => "Ann <ann@example.com> (https://example.com)"
 * ```
 *
 * @public
 */
export class Person extends S.Class<Person>($I`Person`)({
	/** The person's name. */
	name: S.String.annotateKey({ description: "The person's name." }),
	/** The optional email address. */
	email: S.optionalKey(S.String).annotateKey({ description: "The optional email address." }),
	/** The optional homepage URL. */
	url: S.optionalKey(S.String).annotateKey({ description: "The optional homepage URL." }),
	/** Any additional keys, preserved verbatim and flattened back on encode. */
	rest: S.optionalKey(S.Record(S.String, S.Unknown)).annotateKey({ description: "Any additional keys, preserved verbatim and flattened back on encode." }),
}, $I.annote("Person", { description: "A structured person object with `name`, optional `email` / `url`, and a `rest` catch-all preserving any additional keys across a read/write cycle." })) {
	/**
	 * The object wire codec: an open JSON object ↔ a {@link Person}, partitioning
	 * unknown keys into `rest` and flattening them back on encode so the on-disk
	 * shape never carries a literal `rest` key.
	 */
	static readonly schema: S.Codec<Person, { readonly [k: string]: unknown }> = S.Record(
		S.String,
		S.Unknown,
	).pipe(
		S.decodeTo(
			S.instanceOf(Person),
			// `transformEffect` rather than `transform` because this transform
			// constructs the instance itself — the only way to associate the raw
			// wire object with the resulting `Person` — and so must carry the
			// field validation that the class factory would otherwise perform.
			// The issue tree comes from `PersonFields`, so diagnostics are
			// unchanged from decoding the class directly.
			SchemaTransformation.transformEffect({
				decode: (raw: { readonly [k: string]: unknown }) =>
					decodePersonFields(raw).pipe(
						Effect.mapError((error) => error.issue),
						Effect.map((fields) => {
							const rest = restOf(raw);
							return rememberWire(Person.make({ ...fields, ...(R.keys(rest).length > 0 ? { rest } : {}) }), raw);
						}),
					),
				encode: (person: Person) => Effect.succeed(encodePersonObject(person)),
			}),
		),
	);

	/**
	 * Schema transformation between the `"Name <email> (url)"` shorthand string
	 * and a {@link Person}. Decoding remembers the input text so that encoding
	 * reproduces it verbatim; see {@link Person.wireStringOf}.
	 */
	static readonly FromString: S.Codec<Person, string> = S.String.pipe(
		S.decodeTo(
			S.instanceOf(Person),
			SchemaTransformation.transform({
				decode: (input: string) => rememberWire(parsePersonString(input), input),
				encode: (person: Person) => {
					const wire = wireForms.get(person);
					return P.isString(wire) && isFaithful(wire, person) ? wire : serializePerson(person);
				},
			}),
		),
	);

	/**
	 * The `author` / `contributors` value: either the shorthand string or the
	 * structured object, always decoded to a {@link Person}.
	 *
	 * The wire form is preserved across a round trip — a person read from the
	 * shorthand string encodes back to that string, byte for byte, and one read
	 * from an object encodes back to an object with its unknown keys intact.
	 * Formatting a manifest therefore never rewrites one legal encoding into the
	 * other.
	 *
	 * Provenance belongs to the instance, so a person that is *rebuilt* (rather
	 * than carried through unchanged) has none and encodes in the canonical
	 * object form. Editing an unrelated field of the surrounding `Package`
	 * carries the same person instance through and preserves its encoding.
	 */
	static readonly FromValue: S.Codec<Person, string | { readonly [k: string]: unknown }> = S.Union([
		Person.schema,
		S.String,
	]).pipe(
		S.decodeTo(
			S.instanceOf(Person),
			SchemaTransformation.transform({
				decode: (input: Person | string) =>
					P.isString(input) ? rememberWire(parsePersonString(input), input) : input,
				// Only the string branch is decided here: a person from the object
				// form encodes back through `Person.schema`, which replays its own
				// remembered object verbatim.
				encode: (person: Person): Person | string => {
					const wire = wireForms.get(person);
					if (!P.isString(wire)) return person;
					if (isFaithful(wire, person)) return wire;
					// Edited since it was decoded. Re-emit the shorthand SHAPE rather
					// than upgrading to the object form: a manifest that wrote
					// `"Ann <ann@x.dev>"` should not silently become
					// `{"name":"Ann","email":"new@x.dev"}` because one field changed.
					// Shape fidelity is what this package promises; the object form is
					// the fallback only when the shorthand genuinely cannot carry the
					// value (it gained keys), where preserving data outranks preserving
					// shape.
					return isShorthandExpressible(person) ? serializePerson(person) : person;
				},
			}),
		),
	);

	/**
	 * The shorthand text this person was decoded from, when it was decoded from
	 * the string form and still matches its fields; `None` for a person built
	 * from an object or by hand.
	 *
	 * Exposed so callers can tell which encoding a manifest used without
	 * re-reading the file.
	 *
	 * @param person - the person to inspect
	 * @returns the original shorthand text, or `None`
	 */
	static wireStringOf(person: Person): O.Option<string> {
		const wire = wireForms.get(person);
		return P.isString(wire) && isFaithful(wire, person) ? O.some(wire) : O.none();
	}
}
