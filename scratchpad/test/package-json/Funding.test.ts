// @effect-diagnostics nodeBuiltinImport:skip-file
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

import { readFileSync } from "node:fs";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { Funding, LenientManifest, Package, PackageManifest } from "../../effected/package-json/index.ts";

const Json = Schema.fromJsonString(Schema.Unknown);

const decode = <A, I>(schema: Schema.Codec<A, I>, input: unknown) => Schema.decodeUnknownEffect(schema)(input);
const encode = <A, I>(schema: Schema.Codec<A, I>, value: A) => Schema.encodeUnknownEffect(schema)(value);

const field = Funding.FromField;

describe("Funding.FromField — every encoding decodes to an array", () => {
	it.effect("a bare URL string", () =>
		Effect.gen(function* () {
			const entries = yield* decode(field, "https://example.com/sponsor");
			assert.lengthOf(entries, 1);
			assert.strictEqual(entries[0]?.url, "https://example.com/sponsor");
			assert.isUndefined(entries[0]?.type);
		}),
	);

	it.effect("a single object", () =>
		Effect.gen(function* () {
			const entries = yield* decode(field, { type: "individual", url: "https://example.com/sponsor" });
			assert.lengthOf(entries, 1);
			assert.strictEqual(entries[0]?.type, "individual");
			assert.strictEqual(entries[0]?.url, "https://example.com/sponsor");
		}),
	);

	it.effect("an array of strings", () =>
		Effect.gen(function* () {
			const entries = yield* decode(field, ["https://a.example", "https://b.example"]);
			assert.deepStrictEqual(
				entries.map((entry) => entry.url),
				["https://a.example", "https://b.example"],
			);
		}),
	);

	it.effect("an array of objects", () =>
		Effect.gen(function* () {
			const entries = yield* decode(field, [
				{ type: "github", url: "https://github.com/sponsors/dee" },
				{ type: "patreon", url: "https://patreon.com/dee" },
			]);
			assert.deepStrictEqual(
				entries.map((entry) => entry.type),
				["github", "patreon"],
			);
		}),
	);

	it.effect("a mixed array", () =>
		Effect.gen(function* () {
			const entries = yield* decode(field, ["https://a.example", { type: "github", url: "https://b.example" }]);
			assert.lengthOf(entries, 2);
			assert.isUndefined(entries[0]?.type);
			assert.strictEqual(entries[1]?.type, "github");
		}),
	);
});

describe("Funding.FromField — wire fidelity", () => {
	// The point of the whole design: reading normalizes, writing does not.
	const roundTrip = (wire: unknown) => Effect.flatMap(decode(field, wire), (entries) => encode(field, entries));

	it.effect("a lone bare string stays bare", () =>
		Effect.gen(function* () {
			// The mutant this kills: wrapping in an array on encode.
			assert.deepStrictEqual<unknown>(yield* roundTrip("https://example.com/sponsor"), "https://example.com/sponsor");
		}),
	);

	it.effect("a lone bare object stays bare, verbatim", () =>
		Effect.gen(function* () {
			const wire = { type: "individual", url: "https://example.com/sponsor" };
			assert.deepStrictEqual<unknown>(yield* roundTrip(wire), wire);
		}),
	);

	it.effect("a one-element array stays an array", () =>
		Effect.gen(function* () {
			// The other half of the same promise: an author who wrote the array
			// form must not have it collapsed to a bare value either.
			assert.deepStrictEqual<unknown>(yield* roundTrip(["https://example.com/sponsor"]), [
				"https://example.com/sponsor",
			]);
		}),
	);

	it.effect("a mixed array keeps each entry's own encoding", () =>
		Effect.gen(function* () {
			const wire = ["https://a.example", { type: "github", url: "https://b.example" }];
			assert.deepStrictEqual<unknown>(yield* roundTrip(wire), wire);
		}),
	);

	it.effect("key order inside an object entry survives", () =>
		Effect.gen(function* () {
			// `url` before `type` is legal and a formatter must not reorder it.
			const wire = [{ url: "https://a.example", type: "github" }];
			assert.deepStrictEqual<unknown>((yield* Schema.encodeEffect(Json)(yield* roundTrip(wire))), (yield* Schema.encodeEffect(Json)(wire)));
		}),
	);

	it.effect("a hand-built array has no provenance and encodes as an array", () =>
		Effect.gen(function* () {
			// Provenance must not survive being copied into a hand-built value.
			const built = [Funding.make({ url: "https://example.com/sponsor" })];
			assert.deepStrictEqual<unknown>(yield* encode(field, built), [{ url: "https://example.com/sponsor" }]);
		}),
	);

	it.effect("pushing a second entry into a decoded bare field upgrades it to an array", () =>
		Effect.gen(function* () {
			// Mutated IN PLACE — rebuilding the array would produce a value with no
			// provenance and never reach the replay path at all.
			const entries = yield* decode(field, "https://a.example");
			const mutable = entries as Array<Funding>;
			mutable.push(Funding.make({ url: "https://b.example" }));
			assert.deepStrictEqual<unknown>(yield* encode(field, entries), [
				"https://a.example",
				{ url: "https://b.example" },
			]);
		}),
	);

	it.effect("an entry edited in place is not replayed stale", () =>
		Effect.gen(function* () {
			// `Schema.Class` instances are not frozen; an unguarded replay would
			// write the ORIGINAL wire back and discard the edit.
			const entries = yield* decode(field, "https://old.example");
			const entry = entries[0];
			assert.isDefined(entry);
			(entry as { url: string }).url = "https://new.example";
			assert.deepStrictEqual<unknown>(yield* encode(field, entries), "https://new.example");
		}),
	);

	it.effect("an entry that gains a `type` can no longer be a bare string", () =>
		Effect.gen(function* () {
			// A string has no syntax for `type`; data fidelity outranks shape
			// fidelity in the one case where they conflict.
			const entries = yield* decode(field, "https://example.com/sponsor");
			const entry = entries[0];
			assert.isDefined(entry);
			(entry as { type?: string }).type = "github";
			assert.deepStrictEqual<unknown>(yield* encode(field, entries), {
				type: "github",
				url: "https://example.com/sponsor",
			});
		}),
	);
});

describe("Funding — unknown keys", () => {
	it.effect("collect into `rest` and survive a round trip", () =>
		Effect.gen(function* () {
			const entries = yield* decode(field, [{ url: "https://a.example", platform: "ko-fi" }]);
			assert.deepStrictEqual(entries[0]?.rest, { platform: "ko-fi" });
			assert.deepStrictEqual<unknown>(yield* encode(field, entries), [{ url: "https://a.example", platform: "ko-fi" }]);
		}),
	);

	it.effect("an unknown key added after the decode is not dropped", () =>
		Effect.gen(function* () {
			const entries = yield* decode(field, [{ url: "https://a.example" }]);
			const entry = entries[0];
			assert.isDefined(entry);
			(entry as { rest?: Record<string, unknown> }).rest = { platform: "ko-fi" };
			assert.deepStrictEqual<unknown>(yield* encode(field, entries), [{ url: "https://a.example", platform: "ko-fi" }]);
		}),
	);

	it.effect("there is never a literal `rest` key on the wire", () =>
		Effect.gen(function* () {
			const encoded = yield* encode(field, [Funding.make({ url: "https://a.example", rest: { x: 1 } })]);
			assert.deepStrictEqual<unknown>(encoded, [{ url: "https://a.example", x: 1 }]);
		}),
	);
});

describe("Funding — `url` is required", () => {
	// Unlike `Bugs`, where an email-only entry is legal, an entry with no URL
	// says nothing at all — so it is a decode failure, not a half-populated
	// value.
	it.effect("an object without a url fails to decode", () =>
		Effect.gen(function* () {
			const result = yield* Effect.result(decode(field, [{ type: "github" }]));
			assert.isTrue(result._tag === "Failure");
		}),
	);

	it.effect("a non-string url fails to decode", () =>
		Effect.gen(function* () {
			const result = yield* Effect.result(decode(field, { url: 42 }));
			assert.isTrue(result._tag === "Failure");
		}),
	);

	it.effect("the failure reaches a manifest decode as PackageDecodeError", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(PackageManifest.decode({ name: "pkg", funding: [{ type: "github" }] }));
			assert.strictEqual(error._tag, "PackageDecodeError");
		}),
	);
});

describe("funding — the manifest tiers", () => {
	const fixture = JSON.parse(
		readFileSync(new URL("./fixtures/package-json.input.json", import.meta.url), "utf8"),
	) as Record<string, unknown>;

	it.effect("Package decodes and round-trips a real manifest's funding field", () =>
		Effect.gen(function* () {
			// A real fixture manifest, plus the field the consumer asked for.
			const raw = { ...fixture, private: false, funding: "https://github.com/sponsors/spencerbeggs" };
			const pkg = yield* Package.decode(raw);
			assert.strictEqual(pkg.funding?.[0]?.url, "https://github.com/sponsors/spencerbeggs");
			const encoded = (yield* encode(Package.schema, pkg)) as Record<string, unknown>;
			assert.deepStrictEqual<unknown>(encoded.funding, "https://github.com/sponsors/spencerbeggs");
			// And it is a modeled field now, not an unknown key parked in `rest`.
			assert.isUndefined(pkg.rest?.funding);
		}),
	);

	it.effect("PackageManifest decodes the array form", () =>
		Effect.gen(function* () {
			const manifest = yield* PackageManifest.decode({
				private: true,
				funding: [{ type: "github", url: "https://github.com/sponsors/dee" }, "https://ko-fi.com/dee"],
			});
			assert.lengthOf(manifest.funding ?? [], 2);
			assert.strictEqual(manifest.funding?.[1]?.url, "https://ko-fi.com/dee");
		}),
	);

	it.effect("LenientManifest keeps a well-shaped funding field", () =>
		Effect.gen(function* () {
			const sniffed = yield* LenientManifest.decode({ name: "pkg", funding: ["https://a.example"] });
			assert.deepStrictEqual<unknown>(sniffed.funding, ["https://a.example"]);
			assert.lengthOf(sniffed.issues, 0);
		}),
	);

	it.effect("LenientManifest degrades a malformed funding field instead of failing", () =>
		Effect.gen(function* () {
			const sniffed = yield* LenientManifest.decode({ name: "pkg", funding: 42 });
			assert.isUndefined(sniffed.funding);
			assert.deepStrictEqual<unknown>(sniffed.rest?.funding, 42);
			assert.strictEqual(sniffed.issues[0]?.field, "funding");
		}),
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
			const keys = Object.keys((yield* Schema.decodeEffect(Json)(json)) as Record<string, unknown>);
			assert.isTrue(keys.indexOf("funding") > keys.indexOf("repository"));
			assert.isTrue(keys.indexOf("funding") < keys.indexOf("license"));
		}),
	);

	it.effect("absence stays absence", () =>
		Effect.gen(function* () {
			const pkg = yield* Package.decode({ name: "pkg", version: "1.0.0" });
			assert.isUndefined(pkg.funding);
			assert.isFalse("funding" in ((yield* encode(Package.schema, pkg)) as Record<string, unknown>));
		}),
	);
});
