import { assert, describe, it } from "@effect/vitest";
import { Effect, Option, Schema } from "effect";
import { Person } from "../../effected/package-json/Person.ts";

describe("Person.FromString", () => {
	it.effect("parses the Name <email> (url) shorthand", () =>
		Effect.gen(function* () {
			const person = yield* Schema.decodeEffect(Person.FromString)("Jane Doe <jane@x.com> (https://x.com)");
			assert.strictEqual(person.name, "Jane Doe");
			assert.strictEqual(person.email, "jane@x.com");
			assert.strictEqual(person.url, "https://x.com");
			assert.strictEqual(
				yield* Schema.encodeUnknownEffect(Person.FromString)(person),
				"Jane Doe <jane@x.com> (https://x.com)",
			);
		}),
	);

	it.effect("parses a bare name", () =>
		Effect.gen(function* () {
			const person = yield* Schema.decodeEffect(Person.FromString)("Solo");
			assert.strictEqual(person.name, "Solo");
			assert.strictEqual(person.email, undefined);
		}),
	);
});

describe("Person.FromValue", () => {
	it.effect("accepts the structured object form", () =>
		Effect.gen(function* () {
			const person = yield* Schema.decodeEffect(Person.FromValue)({ name: "Bob", email: "b@x.com" });
			assert.strictEqual(person.name, "Bob");
			assert.strictEqual(person.email, "b@x.com");
			assert.deepStrictEqual(yield* Schema.encodeUnknownEffect(Person.FromValue)(person), {
				name: "Bob",
				email: "b@x.com",
			});
		}),
	);

	it.effect("accepts the shorthand string form", () =>
		Effect.gen(function* () {
			const person = yield* Schema.decodeEffect(Person.FromValue)("Ann <a@x.com>");
			assert.strictEqual(person.name, "Ann");
			assert.strictEqual(person.email, "a@x.com");
		}),
	);
});

// A formatter must not rewrite legal input into a different-but-equivalent
// encoding, so the wire form a person was read from survives the round trip.
describe("Person wire-form preservation", () => {
	const roundTrip = (input: unknown) =>
		Effect.flatMap(Schema.decodeUnknownEffect(Person.FromValue)(input), (person) =>
			Schema.encodeUnknownEffect(Person.FromValue)(person),
		);

	it.effect("re-encodes the shorthand string as a string, not an object", () =>
		Effect.gen(function* () {
			assert.strictEqual(
				yield* roundTrip("Ann Lee <ann@x.dev> (https://x.dev)"),
				"Ann Lee <ann@x.dev> (https://x.dev)",
			);
		}),
	);

	it.effect("re-encodes a bare-name shorthand as a string", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* roundTrip("Solo"), "Solo");
		}),
	);

	it.effect("replays unusual-but-legal shorthand spacing and ordering verbatim", () =>
		Effect.gen(function* () {
			// Segment order and doubled spaces are not what the canonical
			// serializer would emit, so only verbatim replay reproduces them.
			assert.strictEqual(yield* roundTrip("Ann  (https://x.dev)  <ann@x.dev>"), "Ann  (https://x.dev)  <ann@x.dev>");
		}),
	);

	it.effect("keeps unknown keys on the object form instead of dropping them", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual(yield* roundTrip({ name: "Dee", twitter: "@dee" }), { name: "Dee", twitter: "@dee" });
		}),
	);

	it.effect("preserves the key order of the object form", () =>
		Effect.gen(function* () {
			const encoded = yield* roundTrip({ email: "e@x.dev", name: "Eve" });
			assert.deepStrictEqual(Object.keys(encoded as Record<string, unknown>), ["email", "name"]);
		}),
	);

	it.effect("re-encodes a hand-built person canonically as an object", () =>
		Effect.gen(function* () {
			const person = Person.make({ name: "Ed", email: "ed@x.dev" });
			assert.deepStrictEqual(yield* Schema.encodeUnknownEffect(Person.FromValue)(person), {
				name: "Ed",
				email: "ed@x.dev",
			});
		}),
	);

	it.effect("a rebuilt person loses its provenance and encodes as an object", () =>
		Effect.gen(function* () {
			// Rebuilding produces a new instance with no recorded wire form. Emitting
			// shorthand for it would be inventing an encoding this person was never
			// read in, so the canonical object form wins.
			const person = yield* Schema.decodeEffect(Person.FromValue)("Ann <ann@x.dev>");
			const edited = Person.make({ ...person, email: "new@x.dev" });
			assert.isTrue(Option.isNone(Person.wireStringOf(edited)));
			assert.deepStrictEqual(yield* Schema.encodeUnknownEffect(Person.FromValue)(edited), {
				name: "Ann",
				email: "new@x.dev",
			});
		}),
	);

	it.effect("an explicitly string-typed field re-serializes a rebuilt person canonically", () =>
		Effect.gen(function* () {
			// `FromString` has no object form to fall back to, so it rebuilds the
			// shorthand from the fields rather than replaying stale text.
			const person = yield* Schema.decodeEffect(Person.FromString)("Ann <ann@x.dev>");
			const edited = Person.make({ ...person, email: "new@x.dev" });
			assert.strictEqual(yield* Schema.encodeUnknownEffect(Person.FromString)(edited), "Ann <new@x.dev>");
		}),
	);

	it.effect("reports the shorthand text via wireStringOf, and None for the object form", () =>
		Effect.gen(function* () {
			const fromString = yield* Schema.decodeEffect(Person.FromValue)("Ann <ann@x.dev>");
			const fromObject = yield* Schema.decodeEffect(Person.FromValue)({ name: "Ann", email: "ann@x.dev" });
			assert.deepStrictEqual(Person.wireStringOf(fromString), Option.some("Ann <ann@x.dev>"));
			assert.isTrue(Option.isNone(Person.wireStringOf(fromObject)));
		}),
	);

	it.effect("still rejects a malformed person object", () =>
		Effect.gen(function* () {
			const result = yield* Effect.result(Schema.decodeEffect(Person.FromValue)({ name: 123 }));
			assert.isTrue(result._tag === "Failure");
		}),
	);

	// The degenerate shorthand: an address with no name. silk-release-action's
	// `parseAuthor` hand-roll returns `{ name: undefined, email }` here because
	// its `^([^<(]+)` name pattern needs at least one leading character. Pinning
	// the equivalent behavior is what makes "delete the hand-roll" an
	// evidence-backed claim rather than an assumption — it is the one input
	// where the two implementations could plausibly disagree.
	it.effect("an email-only shorthand yields an empty name, not a failure", () =>
		Effect.gen(function* () {
			const person = yield* Schema.decodeEffect(Person.FromValue)("<dee@example.com>");
			assert.strictEqual(person.email, "dee@example.com");
			assert.strictEqual(person.name, "");
		}),
	);
});

// ─────────────────────────────────────────────────────────────────────────────
// Stale wire provenance
//
// `Person` remembers the wire value each instance was decoded from in a
// WeakMap and replays it on encode, so a manifest round-trips byte-for-byte.
// `Schema.Class` instances are NOT frozen at runtime, so an instance can be
// mutated in place while KEEPING its provenance entry — at which point the
// remembered wire no longer describes the value, and an unguarded replay
// writes the ORIGINAL text back into the manifest. That is silent corruption:
// the edit is accepted, reported as written, and discarded.
//
// The pre-existing tests here could not catch it: they rebuild with
// `Person.make({ ...person, ... })`, which produces a NEW instance carrying no
// provenance, so the replay path is never reached. These mutate in place.
//
// The `isFaithful` guard already existed; what follows is the pin. Removing
// the guard from any one of the three replay sites turns exactly the matching
// case below red.
// ─────────────────────────────────────────────────────────────────────────────
describe("Person — stale wire provenance", () => {
	it.effect("a MUTATED string-decoded person does not re-emit the stale shorthand", () =>
		// THE invariant this block exists for: the edit must reach the manifest,
		// and the superseded text must not. The SHAPE is preserved too — an
		// edited shorthand re-emits as shorthand rather than upgrading the
		// manifest to the object form, which would be a shape-fidelity
		// violation on an otherwise unrelated edit.
		Effect.gen(function* () {
			const person = yield* Schema.decodeEffect(Person.FromValue)("Ann <ann@x.dev>");
			// In place: same instance, so the WeakMap entry survives the edit.
			(person as { email: string }).email = "new@x.dev";
			const encoded = yield* Schema.encodeUnknownEffect(Person.FromValue)(person);
			assert.notStrictEqual(encoded, "Ann <ann@x.dev>", "the stale shorthand must not be replayed");
			assert.strictEqual(encoded, "Ann <new@x.dev>");
		}),
	);

	it.effect("a MUTATED name is reflected too", () =>
		Effect.gen(function* () {
			const person = yield* Schema.decodeEffect(Person.FromValue)("Ann <ann@x.dev>");
			(person as { name: string }).name = "Bea";
			const encoded = yield* Schema.encodeUnknownEffect(Person.FromValue)(person);
			assert.notStrictEqual(encoded, "Ann <ann@x.dev>");
			assert.strictEqual(encoded, "Bea <ann@x.dev>");
		}),
	);

	it.effect("a MUTATED url is reflected too", () =>
		Effect.gen(function* () {
			const person = yield* Schema.decodeEffect(Person.FromValue)("Ann (https://old.dev)");
			(person as { url: string }).url = "https://new.dev";
			const encoded = yield* Schema.encodeUnknownEffect(Person.FromValue)(person);
			assert.notStrictEqual(encoded, "Ann (https://old.dev)");
			assert.strictEqual(encoded, "Ann (https://new.dev)");
		}),
	);

	it.effect("the same guard holds on the FromString codec", () =>
		Effect.gen(function* () {
			const person = yield* Schema.decodeEffect(Person.FromString)("Ann <ann@x.dev>");
			(person as { email: string }).email = "new@x.dev";
			assert.strictEqual(yield* Schema.encodeUnknownEffect(Person.FromString)(person), "Ann <new@x.dev>");
		}),
	);

	it.effect("a MUTATED object-decoded person does not re-emit the stale object", () =>
		Effect.gen(function* () {
			const person = yield* Schema.decodeEffect(Person.FromValue)({ name: "Ann", email: "ann@x.dev" });
			(person as { email: string }).email = "new@x.dev";
			assert.deepStrictEqual<unknown>(yield* Schema.encodeUnknownEffect(Person.FromValue)(person), {
				name: "Ann",
				email: "new@x.dev",
			});
		}),
	);

	it.effect("a mutated REST entry does not re-emit the stale object", () =>
		// `rest` is the half a field-by-field comparison would miss; `sameRest`
		// is what covers it.
		Effect.gen(function* () {
			const person = yield* Schema.decodeEffect(Person.FromValue)({ name: "Ann", twitter: "@ann" });
			(person as { rest: Record<string, unknown> }).rest = { twitter: "@bea" };
			assert.deepStrictEqual<unknown>(yield* Schema.encodeUnknownEffect(Person.FromValue)(person), {
				twitter: "@bea",
				name: "Ann",
			});
		}),
	);

	it.effect("a string-decoded person that GAINS rest keeps it — the shorthand cannot express it", () =>
		// The hole the obvious tests miss. `isFaithful`'s string branch compares
		// name/email/url; `rest` is the one field a shorthand has no syntax for,
		// so without an explicit clause the three named fields still match, the
		// wire replays, and the added keys vanish on write. Same corruption
		// class, reached through the field nobody thinks to check.
		Effect.gen(function* () {
			const person = yield* Schema.decodeEffect(Person.FromValue)("Ann");
			(person as { rest: Record<string, unknown> }).rest = { twitter: "@ann" };
			const encoded = yield* Schema.encodeUnknownEffect(Person.FromValue)(person);
			assert.notStrictEqual(encoded, "Ann", "the shorthand cannot carry rest and must not be replayed");
			// The ONE case where the object form is right: the shorthand genuinely
			// cannot carry the value, so preserving data outranks preserving shape.
			assert.deepStrictEqual<unknown>(encoded, { twitter: "@ann", name: "Ann" });
		}),
	);

	it.effect("an empty rest does NOT defeat the shorthand replay", () =>
		// The other side of that clause: `rest: {}` carries no information, so it
		// must not force an unrelated person out of its shorthand.
		Effect.gen(function* () {
			const person = yield* Schema.decodeEffect(Person.FromValue)("Ann <ann@x.dev>");
			(person as { rest: Record<string, unknown> }).rest = {};
			assert.strictEqual(yield* Schema.encodeUnknownEffect(Person.FromValue)(person), "Ann <ann@x.dev>");
		}),
	);

	it.effect("an UNMUTATED person still round-trips its wire form verbatim", () =>
		// The other direction: the guard must not be so eager that it destroys
		// the provenance replay the WeakMap exists for. Key order included.
		Effect.gen(function* () {
			const shorthand = yield* Schema.decodeEffect(Person.FromValue)("Ann <ann@x.dev> (https://x.dev)");
			assert.strictEqual(
				yield* Schema.encodeUnknownEffect(Person.FromValue)(shorthand),
				"Ann <ann@x.dev> (https://x.dev)",
			);
			const object = yield* Schema.decodeEffect(Person.FromValue)({ twitter: "@ann", name: "Ann" });
			assert.deepStrictEqual<unknown>(yield* Schema.encodeUnknownEffect(Person.FromValue)(object), {
				twitter: "@ann",
				name: "Ann",
			});
		}),
	);
});
