import { identity } from "effect/Function";
// `funding` — the manifest field a consumer reaches for when it wants to put a
// sponsor link beside a maintainer's name.
//
// The motivating evidence is the tsdoctor docs site, which credits maintainers
// and wants the funding link next to them; before this the field was unmodeled
// on every tier and landed in `rest` untyped.
//
// Two contracts are under test and they pull against each other:
//
//   READ  — `Funding.FromField` always yields an ARRAY, whichever of npm's
//           three encodings the manifest used, so no consumer branches on
//           arity.
//   WRITE — wire fidelity, the package's hard requirement: a formatter must
//           not rewrite one legal encoding into another. A bare entry
//           re-encodes bare, NOT as a one-element array, and a string entry
//           re-encodes as that exact string.

import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Funding, LenientManifest, Package, PackageManifest } from "@beep/package-json";
import { assert, describe, it } from "@effect/vitest";
import { assertDefined, assertExitSuccess, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { fixtureText } from "./support/fixtureText.ts";

const Json = S.fromJsonString(S.Unknown);
const JsonObject = S.fromJsonString(S.Record(S.String, S.Unknown));

const decode = <A, I>(schema: S.Codec<A, I>, input: unknown) => S.decodeUnknownEffect(schema)(input);
const encode = <A, I>(schema: S.Codec<A, I>, value: A) => S.encodeUnknownEffect(schema)(value);

const field = Funding.FromField;

describe("Funding — own __proto__ extension fidelity", () => {
  it.effect("FromValue and bare/array FromField preserve an own data key after a URL edit", () =>
    Effect.gen(function* () {
      const text = '{"url":"https://old.example","__proto__":{"keep":1},"platform":"ko-fi"}';
      const input = yield* S.decodeEffect(JsonObject)(text);
      assert.isTrue(R.has(input, "__proto__"));
      const value = yield* decode(Funding.FromValue, input);
      const bare = yield* decode(field, input);
      const array = yield* decode(field, [input, "https://second.example"]);
      const bareEntry = bare[0];
      const arrayEntry = array[0];
      assertDefined(bareEntry);
      assertDefined(arrayEntry);
      for (const entry of [value, bareEntry, arrayEntry]) {
        const rest = entry.rest;
        assertDefined(rest);
        assert.isTrue(R.has(rest, "__proto__"));
        assert.deepStrictEqual(R.get(rest, "__proto__"), O.some({ keep: 1 }));
        assert.strictEqual(Object.getPrototypeOf(rest), Object.prototype);
        assert.deepStrictEqual(R.keys(rest), ["__proto__", "platform"]);
      }
      const argument = S.encodeEffect(Json);
      const encoded1 = yield* encode(Funding.FromValue, value);
      const value1 = yield* argument(encoded1);
      assert.strictEqual(value1, text);
      const argument1 = S.encodeEffect(Json);
      const encoded2 = yield* encode(field, bare);
      const value2 = yield* argument1(encoded2);
      assert.strictEqual(value2, text);
      const argument2 = S.encodeEffect(Json);
      const encoded3 = yield* encode(field, array);
      const value3 = yield* argument2(encoded3);
      assert.strictEqual(value3, `[${text},"https://second.example"]`);
      for (const entry of [value, bareEntry, arrayEntry]) {
        Object.assign(entry, { url: "https://new.example" } satisfies Partial<Funding>);
      }
      const encodedValue = yield* encode(Funding.FromValue, value);
      const encodedBare = yield* encode(field, bare);
      const encodedArray = yield* encode(field, array);
      assertTrue(A.isArray(encodedArray));
      for (const encoded of [encodedValue, encodedBare, encodedArray[0]]) {
        assertTrue(P.isObject(encoded));
        assert.isTrue(R.has(encoded, "__proto__"));
        assert.deepStrictEqual(R.get(encoded, "__proto__"), O.some({ keep: 1 }));
        assert.strictEqual(Object.getPrototypeOf(encoded), Object.prototype);
        assert.deepStrictEqual(encoded, { ...input, url: "https://new.example" });
      }
      assert.strictEqual(encodedArray[1], "https://second.example");
    })
  );
});

// One remembered-wire case: a bare object entry, or the same entry first in a
// two-entry array, whose `rest` is then cleared or loses one key.
const SECOND_ENTRY = "https://second.example";

const deletionPersists = Effect.fnUntraced(function* (array: boolean, clear: boolean) {
  const wrap = (entry: unknown): unknown => (array ? [entry, SECOND_ENTRY] : entry);
  const text = '{"remove":2,"url":"https://fund.example","keep":1}';
  const input = yield* S.decodeEffect(JsonObject)(text);
  const entries = yield* decode(field, wrap(input));
  const argument3 = S.encodeEffect(Json);
  const encoded4 = yield* encode(field, entries);
  const value4 = yield* argument3(encoded4);
  assert.strictEqual(value4, array ? `[${text},"${SECOND_ENTRY}"]` : text);
  const entry = entries[0];
  assertDefined(entry);
  const rest: Record<string, unknown> | undefined = entry.rest;
  assertDefined(rest);
  if (clear) Object.assign(entry, { rest: {} } satisfies Partial<Funding>);
  else delete rest.remove;
  const expected = wrap({ url: "https://fund.example", ...(clear ? {} : { keep: 1 }) });
  const encoded = yield* encode(field, entries);
  assert.deepStrictEqual<unknown>(encoded, expected);
  const value5 = yield* S.encodeEffect(Json)(encoded);
  const value19 = yield* S.encodeEffect(Json)(expected);
  assert.strictEqual(value5, value19);
});

describe("Funding — extension deletions invalidate remembered-wire replay", () => {
  const cases = A.flatMap([false, true], (array) => A.map([false, true], (clear) => [array, clear] as const));
  for (const [array, clear] of cases) {
    it.effect(`${array ? "array" : "bare object"}: ${clear ? "clearing rest" : "deleting one key"} persists`, () =>
      deletionPersists(array, clear)
    );
  }

  it.effect("an inherited name and an undefined extension still count as additions", () =>
    Effect.gen(function* () {
      const additions: ReadonlyArray<Record<string, unknown>> = [
        { toString: Object.prototype.toString },
        { absent: undefined },
      ];
      for (const rest of additions) {
        const entries = yield* decode(field, { url: "https://fund.example", keep: 1 });
        const entry = entries[0];
        assertDefined(entry);
        Object.assign(entry, { rest } satisfies Partial<Funding>);
        const encoded = yield* encode(field, entries);
        assertTrue(P.isObject(encoded));
        assert.deepStrictEqual(encoded, { url: "https://fund.example", ...rest });
        assert.deepStrictEqual(R.keys(encoded), ["url", ...R.keys(rest)]);
      }
    })
  );
});

describe("Funding.FromField — every encoding decodes to an array", () => {
  it.effect("a bare URL string", () =>
    Effect.gen(function* () {
      const entries = yield* decode(field, "https://example.com/sponsor");
      assert.lengthOf(entries, 1);
      assert.strictEqual(entries[0]?.url, "https://example.com/sponsor");
      assert.isUndefined(entries[0]?.type);
    })
  );

  it.effect("a single object", () =>
    Effect.gen(function* () {
      const entries = yield* decode(field, { type: "individual", url: "https://example.com/sponsor" });
      assert.lengthOf(entries, 1);
      assert.strictEqual(entries[0]?.type, "individual");
      assert.strictEqual(entries[0]?.url, "https://example.com/sponsor");
    })
  );

  it.effect("an array of strings", () =>
    Effect.gen(function* () {
      const entries = yield* decode(field, ["https://a.example", "https://b.example"]);
      assert.deepStrictEqual(
        A.map(entries, (entry) => entry.url),
        ["https://a.example", "https://b.example"]
      );
    })
  );

  it.effect("an array of objects", () =>
    Effect.gen(function* () {
      const entries = yield* decode(field, [
        { type: "github", url: "https://github.com/sponsors/dee" },
        { type: "patreon", url: "https://patreon.com/dee" },
      ]);
      assert.deepStrictEqual(
        A.map(entries, (entry) => entry.type),
        ["github", "patreon"]
      );
    })
  );

  it.effect("a mixed array", () =>
    Effect.gen(function* () {
      const entries = yield* decode(field, ["https://a.example", { type: "github", url: "https://b.example" }]);
      assert.lengthOf(entries, 2);
      assert.isUndefined(entries[0]?.type);
      assert.strictEqual(entries[1]?.type, "github");
    })
  );
});

describe("Funding.FromField — wire fidelity", () => {
  // The point of the whole design: reading normalizes, writing does not.
  const roundTrip = (wire: unknown) => Effect.flatMap(decode(field, wire), (entries) => encode(field, entries));

  it.effect("a lone bare string stays bare", () =>
    Effect.gen(function* () {
      // The mutant this kills: wrapping in an array on encode.
      const roundTrip6 = yield* roundTrip("https://example.com/sponsor");
      assert.deepStrictEqual<unknown>(roundTrip6, "https://example.com/sponsor");
    })
  );

  it.effect("a lone bare object stays bare, verbatim", () =>
    Effect.gen(function* () {
      const wire = { type: "individual", url: "https://example.com/sponsor" };
      const roundTrip7 = yield* roundTrip(wire);
      assert.deepStrictEqual<unknown>(roundTrip7, wire);
    })
  );

  it.effect("a one-element array stays an array", () =>
    Effect.gen(function* () {
      // The other half of the same promise: an author who wrote the array
      // form must not have it collapsed to a bare value either.
      const roundTrip8 = yield* roundTrip(["https://example.com/sponsor"]);
      assert.deepStrictEqual<unknown>(roundTrip8, ["https://example.com/sponsor"]);
    })
  );

  it.effect("a mixed array keeps each entry's own encoding", () =>
    Effect.gen(function* () {
      const wire = ["https://a.example", { type: "github", url: "https://b.example" }];
      const roundTrip9 = yield* roundTrip(wire);
      assert.deepStrictEqual<unknown>(roundTrip9, wire);
    })
  );

  it.effect("key order inside an object entry survives", () =>
    Effect.gen(function* () {
      // `url` before `type` is legal and a formatter must not reorder it.
      const wire = [{ url: "https://a.example", type: "github" }];
      const argument4 = S.encodeEffect(Json);
      const roundTrip5 = yield* roundTrip(wire);
      const value10 = yield* argument4(roundTrip5);
      const value20 = yield* S.encodeEffect(Json)(wire);
      assert.deepStrictEqual<unknown>(value10, value20);
    })
  );

  it.effect("a hand-built array has no provenance and encodes as an array", () =>
    Effect.gen(function* () {
      // Provenance must not survive being copied into a hand-built value.
      const built = [Funding.make({ url: "https://example.com/sponsor" })];
      const encoded11 = yield* encode(field, built);
      assert.deepStrictEqual<unknown>(encoded11, [{ url: "https://example.com/sponsor" }]);
    })
  );

  it.effect("pushing a second entry into a decoded bare field upgrades it to an array", () =>
    Effect.gen(function* () {
      // Mutated IN PLACE — rebuilding the array would produce a value with no
      // provenance and never reach the replay path at all.
      const entries = yield* decode(field, "https://a.example");
      const mutable = entries;
      assertTrue(A.isArray(mutable));
      mutable.push(Funding.make({ url: "https://b.example" }));
      const encoded12 = yield* encode(field, entries);
      assert.deepStrictEqual<unknown>(encoded12, ["https://a.example", { url: "https://b.example" }]);
    })
  );

  it.effect("an entry edited in place is not replayed stale", () =>
    Effect.gen(function* () {
      // `Schema.Class` instances are not frozen; an unguarded replay would
      // write the ORIGINAL wire back and discard the edit.
      const entries = yield* decode(field, "https://old.example");
      const entry = entries[0];
      assertDefined(entry);
      Object.assign(entry, { url: "https://new.example" } satisfies Partial<Funding>);
      const encoded13 = yield* encode(field, entries);
      assert.deepStrictEqual<unknown>(encoded13, "https://new.example");
    })
  );

  it.effect("an entry that gains a `type` can no longer be a bare string", () =>
    Effect.gen(function* () {
      // A string has no syntax for `type`; data fidelity outranks shape
      // fidelity in the one case where they conflict.
      const entries = yield* decode(field, "https://example.com/sponsor");
      const entry = entries[0];
      assertDefined(entry);
      Object.assign(entry, { type: "github" } satisfies Partial<Funding>);
      const encoded14 = yield* encode(field, entries);
      assert.deepStrictEqual<unknown>(encoded14, {
        type: "github",
        url: "https://example.com/sponsor",
      });
    })
  );
});

describe("Funding — unknown keys", () => {
  it.effect("collect into `rest` and survive a round trip", () =>
    Effect.gen(function* () {
      const entries = yield* decode(field, [{ url: "https://a.example", platform: "ko-fi" }]);
      assert.deepStrictEqual(entries[0]?.rest, { platform: "ko-fi" });
      const encoded15 = yield* encode(field, entries);
      assert.deepStrictEqual<unknown>(encoded15, [{ url: "https://a.example", platform: "ko-fi" }]);
    })
  );

  it.effect("an unknown key added after the decode is not dropped", () =>
    Effect.gen(function* () {
      const entries = yield* decode(field, [{ url: "https://a.example" }]);
      const entry = entries[0];
      assertDefined(entry);
      Object.assign(entry, { rest: { platform: "ko-fi" } } satisfies Partial<Funding>);
      const encoded16 = yield* encode(field, entries);
      assert.deepStrictEqual<unknown>(encoded16, [{ url: "https://a.example", platform: "ko-fi" }]);
    })
  );

  it.effect("there is never a literal `rest` key on the wire", () =>
    Effect.gen(function* () {
      const encoded = yield* encode(field, [Funding.make({ url: "https://a.example", rest: { x: 1 } })]);
      assert.deepStrictEqual<unknown>(encoded, [{ url: "https://a.example", x: 1 }]);
    })
  );
});

describe("Funding — `url` is required", () => {
  // Unlike `Bugs`, where an email-only entry is legal, an entry with no URL
  // says nothing at all — so it is a decode failure, not a half-populated
  // value.
  it.effect("an object without a url fails to decode", () =>
    Effect.gen(function* () {
      const result = yield* decode(field, [{ type: "github" }]).pipe(Effect.flip, Effect.asVoid, Effect.exit);
      assertExitSuccess(result, undefined);
    })
  );

  it.effect("a non-string url fails to decode", () =>
    Effect.gen(function* () {
      const result = yield* decode(field, { url: 42 }).pipe(Effect.flip, Effect.asVoid, Effect.exit);
      assertExitSuccess(result, undefined);
    })
  );

  it.effect("the failure reaches a manifest decode as PackageDecodeError", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(PackageManifest.decode({ name: "pkg", funding: [{ type: "github" }] }));
      assert.strictEqual(error._tag, "PackageDecodeError");
    })
  );
});

describe("funding — the manifest tiers", () => {
  const fixture: unknown = Result.getOrThrowWith(
    S.decodeResult(S.fromJsonString(S.Unknown))(fixtureText("package-json.input.json")),
    identity
  );
  assertTrue(P.isObject(fixture));

  it.effect("Package decodes and round-trips a real manifest's funding field", () =>
    Effect.gen(function* () {
      // A real fixture manifest, plus the field the consumer asked for.
      const raw = { ...fixture, private: false, funding: "https://github.com/sponsors/spencerbeggs" };
      const pkg = yield* Package.decode(raw);
      assert.strictEqual(pkg.funding?.[0]?.url, "https://github.com/sponsors/spencerbeggs");
      const encoded = yield* encode(Package.schema, pkg);
      assert.deepStrictEqual<unknown>(encoded.funding, "https://github.com/sponsors/spencerbeggs");
      // And it is a modeled field now, not an unknown key parked in `rest`.
      assert.isUndefined(pkg.rest?.funding);
    })
  );

  it.effect("PackageManifest decodes the array form", () =>
    Effect.gen(function* () {
      const manifest = yield* PackageManifest.decode({
        private: true,
        funding: [{ type: "github", url: "https://github.com/sponsors/dee" }, "https://ko-fi.com/dee"],
      });
      assert.lengthOf(manifest.funding ?? [], 2);
      assert.strictEqual(manifest.funding?.[1]?.url, "https://ko-fi.com/dee");
    })
  );

  it.effect("LenientManifest keeps a well-shaped funding field", () =>
    Effect.gen(function* () {
      const sniffed = yield* LenientManifest.decode({ name: "pkg", funding: ["https://a.example"] });
      assert.deepStrictEqual<unknown>(sniffed.funding, ["https://a.example"]);
      assert.lengthOf(sniffed.issues, 0);
    })
  );

  it.effect("LenientManifest degrades a malformed funding field instead of failing", () =>
    Effect.gen(function* () {
      const sniffed = yield* LenientManifest.decode({ name: "pkg", funding: 42 });
      assert.isUndefined(sniffed.funding);
      assert.deepStrictEqual<unknown>(sniffed.rest?.funding, 42);
      assert.strictEqual(sniffed.issues[0]?.field, "funding");
    })
  );

  it.effect("funding lands in npm's canonical key position", () =>
    Effect.gen(function* () {
      const json = (yield* Package.decode({
        name: "pkg",
        version: "1.0.0",
        funding: "https://a.example",
        license: "MIT",
        repository: "dee/pkg",
      })).toJsonString();
      const value17 = yield* S.decodeEffect(JsonObject)(json);
      const keys = R.keys(value17);
      assert.isTrue(keys.indexOf("funding") > keys.indexOf("repository"));
      assert.isTrue(keys.indexOf("funding") < keys.indexOf("license"));
    })
  );

  it.effect("absence stays absence", () =>
    Effect.gen(function* () {
      const pkg = yield* Package.decode({ name: "pkg", version: "1.0.0" });
      assert.isUndefined(pkg.funding);
      assert.isFalse("funding" in (yield* encode(Package.schema, pkg)));
    })
  );
});

describe("Funding — string shorthand property", () => {
  it.effect.prop(
    "a generated bare-string field decodes to one entry and re-encodes as the same string",
    [S.String],
    ([url]) =>
      Effect.gen(function* () {
        const entries = yield* decode(field, url);
        assert.strictEqual(entries[0]?.url, url);
        const encoded18 = yield* encode(field, entries);
        assert.strictEqual(encoded18, url);
      }),
    { arbitrary: fcRuns(50) }
  );
});
