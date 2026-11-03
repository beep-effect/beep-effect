import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Person } from "@beep/package-json/Person";
import { assert, describe, it } from "@effect/vitest";
import { assertDefined, assertExitSuccess, assertNone, assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";

describe("Person — own __proto__ extension fidelity", () => {
  it.effect("both object codecs preserve an own data key through a modeled-field edit", () =>
    Effect.gen(function* () {
      const json = S.fromJsonString(S.Record(S.String, S.Unknown));
      const text = '{"name":"Ada","__proto__":{"keep":1},"team":"docs"}';
      const input = yield* S.decodeEffect(json)(text);
      assert.isTrue(R.has(input, "__proto__"));
      for (const codec of [Person.schema, Person.FromValue]) {
        const person = yield* S.decodeEffect(codec)(input);
        const rest = person.rest;
        assertDefined(rest);
        assert.isTrue(R.has(rest, "__proto__"));
        assert.deepStrictEqual(R.get(rest, "__proto__"), O.some({ keep: 1 }));
        assert.strictEqual(Object.getPrototypeOf(rest), Object.prototype);
        assert.deepStrictEqual(R.keys(rest), ["__proto__", "team"]);
        const argument = S.encodeUnknownEffect(json);
        const value4 = yield* S.encodeEffect(codec)(person);
        const value1 = yield* argument(value4);
        assert.strictEqual(value1, text);
        Object.assign(person, { name: "Grace" } satisfies Partial<Person>);
        const encoded = yield* S.encodeEffect(codec)(person);
        assertTrue(P.isObject(encoded));
        assert.isTrue(R.has(encoded, "__proto__"));
        assert.deepStrictEqual(R.get(encoded, "__proto__"), O.some({ keep: 1 }));
        assert.strictEqual(Object.getPrototypeOf(encoded), Object.prototype);
        assert.deepStrictEqual(encoded, { ...input, name: "Grace" });
      }
    })
  );
});

describe("Person.FromString", () => {
  it.effect("parses the Name <email> (url) shorthand", () =>
    Effect.gen(function* () {
      const person = yield* S.decodeEffect(Person.FromString)("Jane Doe <jane@x.com> (https://x.com)");
      assert.strictEqual(person.name, "Jane Doe");
      assert.strictEqual(person.email, "jane@x.com");
      assert.strictEqual(person.url, "https://x.com");
      const value2 = yield* S.encodeUnknownEffect(Person.FromString)(person);
      assert.strictEqual(value2, "Jane Doe <jane@x.com> (https://x.com)");
    })
  );

  it.effect("parses a bare name", () =>
    Effect.gen(function* () {
      const person = yield* S.decodeEffect(Person.FromString)("Solo");
      assert.strictEqual(person.name, "Solo");
      assert.strictEqual(person.email, undefined);
    })
  );
});

describe("Person.FromValue", () => {
  it.effect("accepts the structured object form", () =>
    Effect.gen(function* () {
      const person = yield* S.decodeEffect(Person.FromValue)({ name: "Bob", email: "b@x.com" });
      assert.strictEqual(person.name, "Bob");
      assert.strictEqual(person.email, "b@x.com");
      const value3 = yield* S.encodeUnknownEffect(Person.FromValue)(person);
      assert.deepStrictEqual(value3, {
        name: "Bob",
        email: "b@x.com",
      });
    })
  );

  it.effect("accepts the shorthand string form", () =>
    Effect.gen(function* () {
      const person = yield* S.decodeEffect(Person.FromValue)("Ann <a@x.com>");
      assert.strictEqual(person.name, "Ann");
      assert.strictEqual(person.email, "a@x.com");
    })
  );
});

// A formatter must not rewrite legal input into a different-but-equivalent
// encoding, so the wire form a person was read from survives the round trip.
describe("Person wire-form preservation", () => {
  const roundTrip = (input: unknown) =>
    Effect.flatMap(S.decodeUnknownEffect(Person.FromValue)(input), (person) =>
      S.encodeUnknownEffect(Person.FromValue)(person)
    );

  it.effect("re-encodes the shorthand string as a string, not an object", () =>
    Effect.gen(function* () {
      const roundTrip4 = yield* roundTrip("Ann Lee <ann@x.dev> (https://x.dev)");
      assert.strictEqual(roundTrip4, "Ann Lee <ann@x.dev> (https://x.dev)");
    })
  );

  it.effect("re-encodes a bare-name shorthand as a string", () =>
    Effect.gen(function* () {
      const roundTrip5 = yield* roundTrip("Solo");
      assert.strictEqual(roundTrip5, "Solo");
    })
  );

  it.effect("replays unusual-but-legal shorthand spacing and ordering verbatim", () =>
    Effect.gen(function* () {
      // Segment order and doubled spaces are not what the canonical
      // serializer would emit, so only verbatim replay reproduces them.
      const roundTrip6 = yield* roundTrip("Ann  (https://x.dev)  <ann@x.dev>");
      assert.strictEqual(roundTrip6, "Ann  (https://x.dev)  <ann@x.dev>");
    })
  );

  it.effect("keeps unknown keys on the object form instead of dropping them", () =>
    Effect.gen(function* () {
      const roundTrip7 = yield* roundTrip({ name: "Dee", twitter: "@dee" });
      assert.deepStrictEqual(roundTrip7, { name: "Dee", twitter: "@dee" });
    })
  );

  it.effect("preserves the key order of the object form", () =>
    Effect.gen(function* () {
      const encoded = yield* roundTrip({ email: "e@x.dev", name: "Eve" });
      assertTrue(P.isObject(encoded));
      assert.deepStrictEqual(R.keys(encoded), ["email", "name"]);
    })
  );

  it.effect("re-encodes a hand-built person canonically as an object", () =>
    Effect.gen(function* () {
      const person = Person.make({ name: "Ed", email: "ed@x.dev" });
      const value8 = yield* S.encodeUnknownEffect(Person.FromValue)(person);
      assert.deepStrictEqual(value8, {
        name: "Ed",
        email: "ed@x.dev",
      });
    })
  );

  it.effect("a rebuilt person loses its provenance and encodes as an object", () =>
    Effect.gen(function* () {
      // Rebuilding produces a new instance with no recorded wire form. Emitting
      // shorthand for it would be inventing an encoding this person was never
      // read in, so the canonical object form wins.
      const person = yield* S.decodeEffect(Person.FromValue)("Ann <ann@x.dev>");
      const edited = Person.make({ ...person, email: "new@x.dev" });
      assertNone(Person.wireStringOf(edited));
      const value9 = yield* S.encodeUnknownEffect(Person.FromValue)(edited);
      assert.deepStrictEqual(value9, {
        name: "Ann",
        email: "new@x.dev",
      });
    })
  );

  it.effect("an explicitly string-typed field re-serializes a rebuilt person canonically", () =>
    Effect.gen(function* () {
      // `FromString` has no object form to fall back to, so it rebuilds the
      // shorthand from the fields rather than replaying stale text.
      const person = yield* S.decodeEffect(Person.FromString)("Ann <ann@x.dev>");
      const edited = Person.make({ ...person, email: "new@x.dev" });
      const value10 = yield* S.encodeUnknownEffect(Person.FromString)(edited);
      assert.strictEqual(value10, "Ann <new@x.dev>");
    })
  );

  it.effect("reports the shorthand text via wireStringOf, and None for the object form", () =>
    Effect.gen(function* () {
      const fromString = yield* S.decodeEffect(Person.FromValue)("Ann <ann@x.dev>");
      const fromObject = yield* S.decodeEffect(Person.FromValue)({ name: "Ann", email: "ann@x.dev" });
      assert.deepStrictEqual(Person.wireStringOf(fromString), O.some("Ann <ann@x.dev>"));
      assertNone(Person.wireStringOf(fromObject));
    })
  );

  it.effect("still rejects a malformed person object", () =>
    Effect.gen(function* () {
      const result = yield* S.decodeEffect(Person.FromValue)({ name: 123 }).pipe(
        Effect.flip,
        Effect.asVoid,
        Effect.exit
      );
      assertExitSuccess(result, undefined);
    })
  );

  // The degenerate shorthand: an address with no name. silk-release-action's
  // `parseAuthor` hand-roll returns `{ name: undefined, email }` here because
  // its `^([^<(]+)` name pattern needs at least one leading character. Pinning
  // the equivalent behavior is what makes "delete the hand-roll" an
  // evidence-backed claim rather than an assumption — it is the one input
  // where the two implementations could plausibly disagree.
  it.effect("an email-only shorthand yields an empty name, not a failure", () =>
    Effect.gen(function* () {
      const person = yield* S.decodeEffect(Person.FromValue)("<dee@example.com>");
      assert.strictEqual(person.email, "dee@example.com");
      assert.strictEqual(person.name, "");
    })
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
      const person = yield* S.decodeEffect(Person.FromValue)("Ann <ann@x.dev>");
      // In place: same instance, so the WeakMap entry survives the edit.
      Object.assign(person, { email: "new@x.dev" } satisfies Partial<Person>);
      const encoded = yield* S.encodeUnknownEffect(Person.FromValue)(person);
      assert.notStrictEqual(encoded, "Ann <ann@x.dev>", "the stale shorthand must not be replayed");
      assert.strictEqual(encoded, "Ann <new@x.dev>");
    })
  );

  it.effect("a MUTATED name is reflected too", () =>
    Effect.gen(function* () {
      const person = yield* S.decodeEffect(Person.FromValue)("Ann <ann@x.dev>");
      Object.assign(person, { name: "Bea" } satisfies Partial<Person>);
      const encoded = yield* S.encodeUnknownEffect(Person.FromValue)(person);
      assert.notStrictEqual(encoded, "Ann <ann@x.dev>");
      assert.strictEqual(encoded, "Bea <ann@x.dev>");
    })
  );

  it.effect("a MUTATED url is reflected too", () =>
    Effect.gen(function* () {
      const person = yield* S.decodeEffect(Person.FromValue)("Ann (https://old.dev)");
      Object.assign(person, { url: "https://new.dev" } satisfies Partial<Person>);
      const encoded = yield* S.encodeUnknownEffect(Person.FromValue)(person);
      assert.notStrictEqual(encoded, "Ann (https://old.dev)");
      assert.strictEqual(encoded, "Ann (https://new.dev)");
    })
  );

  it.effect("the same guard holds on the FromString codec", () =>
    Effect.gen(function* () {
      const person = yield* S.decodeEffect(Person.FromString)("Ann <ann@x.dev>");
      Object.assign(person, { email: "new@x.dev" } satisfies Partial<Person>);
      const value11 = yield* S.encodeUnknownEffect(Person.FromString)(person);
      assert.strictEqual(value11, "Ann <new@x.dev>");
    })
  );

  it.effect("a MUTATED object-decoded person does not re-emit the stale object", () =>
    Effect.gen(function* () {
      const person = yield* S.decodeEffect(Person.FromValue)({ name: "Ann", email: "ann@x.dev" });
      Object.assign(person, { email: "new@x.dev" } satisfies Partial<Person>);
      const value12 = yield* S.encodeUnknownEffect(Person.FromValue)(person);
      assert.deepStrictEqual<unknown>(value12, {
        name: "Ann",
        email: "new@x.dev",
      });
    })
  );

  it.effect("a mutated REST entry does not re-emit the stale object", () =>
    // `rest` is the half a field-by-field comparison would miss; `sameRest`
    // is what covers it.
    Effect.gen(function* () {
      const person = yield* S.decodeEffect(Person.FromValue)({ name: "Ann", twitter: "@ann" });
      Object.assign(person, { rest: { twitter: "@bea" } } satisfies Partial<Person>);
      const value13 = yield* S.encodeUnknownEffect(Person.FromValue)(person);
      assert.deepStrictEqual<unknown>(value13, {
        twitter: "@bea",
        name: "Ann",
      });
    })
  );

  it.effect("a string-decoded person that GAINS rest keeps it — the shorthand cannot express it", () =>
    // The hole the obvious tests miss. `isFaithful`'s string branch compares
    // name/email/url; `rest` is the one field a shorthand has no syntax for,
    // so without an explicit clause the three named fields still match, the
    // wire replays, and the added keys vanish on write. Same corruption
    // class, reached through the field nobody thinks to check.
    Effect.gen(function* () {
      const person = yield* S.decodeEffect(Person.FromValue)("Ann");
      Object.assign(person, { rest: { twitter: "@ann" } } satisfies Partial<Person>);
      const encoded = yield* S.encodeUnknownEffect(Person.FromValue)(person);
      assert.notStrictEqual(encoded, "Ann", "the shorthand cannot carry rest and must not be replayed");
      // The ONE case where the object form is right: the shorthand genuinely
      // cannot carry the value, so preserving data outranks preserving shape.
      assert.deepStrictEqual<unknown>(encoded, { twitter: "@ann", name: "Ann" });
    })
  );

  it.effect("an empty rest does NOT defeat the shorthand replay", () =>
    // The other side of that clause: `rest: {}` carries no information, so it
    // must not force an unrelated person out of its shorthand.
    Effect.gen(function* () {
      const person = yield* S.decodeEffect(Person.FromValue)("Ann <ann@x.dev>");
      Object.assign(person, { rest: {} } satisfies Partial<Person>);
      const value14 = yield* S.encodeUnknownEffect(Person.FromValue)(person);
      assert.strictEqual(value14, "Ann <ann@x.dev>");
    })
  );

  it.effect("an UNMUTATED person still round-trips its wire form verbatim", () =>
    // The other direction: the guard must not be so eager that it destroys
    // the provenance replay the WeakMap exists for. Key order included.
    Effect.gen(function* () {
      const shorthand = yield* S.decodeEffect(Person.FromValue)("Ann <ann@x.dev> (https://x.dev)");
      const value15 = yield* S.encodeUnknownEffect(Person.FromValue)(shorthand);
      assert.strictEqual(value15, "Ann <ann@x.dev> (https://x.dev)");
      const object = yield* S.decodeEffect(Person.FromValue)({ twitter: "@ann", name: "Ann" });
      const value16 = yield* S.encodeUnknownEffect(Person.FromValue)(object);
      assert.deepStrictEqual<unknown>(value16, {
        twitter: "@ann",
        name: "Ann",
      });
    })
  );
});

describe("Person shorthand property", () => {
  it.effect.prop(
    "a generated plain name round-trips through the shorthand codec unchanged",
    [S.String.check(S.isPattern(/^[A-Za-z][A-Za-z .-]{0,12}[A-Za-z]$/))],
    ([name]) =>
      Effect.gen(function* () {
        const person = yield* S.decodeEffect(Person.FromString)(name);
        assert.strictEqual(person.name, name);
        const value17 = yield* S.encodeEffect(Person.FromString)(person);
        assert.strictEqual(value17, name);
      }),
    { arbitrary: fcRuns(50) }
  );
});
