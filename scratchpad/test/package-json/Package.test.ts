import { assert, describe, it } from "@effect/vitest";
import { Effect, Equal, HashMap, Option, Schema } from "effect";
import { Dependency } from "../../effected/package-json/Dependency.ts";
import { Package, PackageDecodeError } from "../../effected/package-json/Package.ts";

const Json = Schema.fromJsonString(Schema.Unknown);

const minimal = { name: "my-pkg", version: "1.0.0" };
const full = {
	name: "@scope/my-pkg",
	version: "2.1.0",
	description: "A package",
	private: true,
	type: "module" as const,
	main: "./index.js",
	license: "MIT",
	dependencies: { lodash: "^4.0.0" },
	devDependencies: { vitest: "^1.0.0" },
	peerDependencies: { effect: "^3.0.0" },
	scripts: { test: "vitest run" },
};

describe("Package.decode + getters", () => {
	it.effect("exposes name, version (SemVer) and scalar getters", () =>
		Effect.gen(function* () {
			const pkg = yield* Package.decode(minimal);
			assert.strictEqual(pkg.name, "my-pkg");
			assert.strictEqual(pkg.version.major, 1);
			assert.isFalse(pkg.isScoped);
			assert.isFalse(pkg.isESM);
			assert.isFalse(pkg.isPrivate);
			assert.strictEqual(pkg.description, undefined);
		}),
	);

	it.effect("detects scoped, ESM and private packages", () =>
		Effect.gen(function* () {
			const pkg = yield* Package.decode(full);
			assert.isTrue(pkg.isScoped);
			assert.isTrue(pkg.isESM);
			assert.isTrue(pkg.isPrivate);
			assert.strictEqual(pkg.description, "A package");
			assert.strictEqual(pkg.license, "MIT");
		}),
	);

	it.effect("hasDependency finds entries across all maps", () =>
		Effect.gen(function* () {
			const pkg = yield* Package.decode(full);
			assert.isTrue(pkg.hasDependency("lodash"));
			assert.isTrue(pkg.hasDependency("vitest"));
			assert.isTrue(pkg.hasDependency("effect"));
			assert.isFalse(pkg.hasDependency("nonexistent"));
		}),
	);

	it.effect("dependency getters return Dependency instances carrying kind", () =>
		Effect.gen(function* () {
			const pkg = yield* Package.decode({
				name: "p",
				version: "1.0.0",
				dependencies: { lodash: "^4.0.0", local: "workspace:*" },
				devDependencies: { vitest: "^1.0.0" },
				peerDependencies: { effect: "^3.0.0" },
				peerDependenciesMeta: { effect: { optional: true } },
				optionalDependencies: { fsevents: "^2.0.0" },
			});
			const lodash = Option.getOrThrow(HashMap.get(pkg.getDependencies(), "lodash"));
			assert.instanceOf(lodash, Dependency);
			assert.strictEqual(lodash.kind, "prod");
			const local = Option.getOrThrow(HashMap.get(pkg.getDependencies(), "local"));
			assert.isTrue(local.isWorkspace);
			assert.isTrue(local.isUnresolved);
			const peer = Option.getOrThrow(HashMap.get(pkg.getPeerDependencies(), "effect"));
			assert.strictEqual(peer.kind, "peer");
			assert.isTrue(peer.isOptional);
			const opt = Option.getOrThrow(HashMap.get(pkg.getOptionalDependencies(), "fsevents"));
			assert.strictEqual(opt.kind, "optional");
		}),
	);
});

describe("Package mutation statics", () => {
	it.effect("setVersion returns a new Package (immutable) in both call styles", () =>
		Effect.gen(function* () {
			const pkg = yield* Package.decode(minimal);
			const updated = yield* Package.setVersion(pkg, "2.0.0");
			assert.strictEqual(updated.version.major, 2);
			assert.strictEqual(pkg.version.major, 1);
			const curried = yield* Package.setVersion("3.0.0")(pkg);
			assert.strictEqual(curried.version.major, 3);
		}),
	);

	it.effect("setVersion fails for invalid semver", () =>
		Effect.gen(function* () {
			const pkg = yield* Package.decode(minimal);
			const error = yield* Effect.flip(Package.setVersion(pkg, "not-valid"));
			assert.strictEqual(error._tag, "InvalidVersionError");
		}),
	);

	it.effect("setName updates and fails for invalid names", () =>
		Effect.gen(function* () {
			const pkg = yield* Package.decode(minimal);
			const updated = yield* Package.setName(pkg, "new-name");
			assert.strictEqual(updated.name, "new-name");
			assert.strictEqual(pkg.name, "my-pkg");
			const error = yield* Effect.flip(Package.setName(pkg, "INVALID NAME"));
			assert.strictEqual(error._tag, "InvalidPackageNameError");
		}),
	);

	it.effect("setLicense updates and fails for invalid SPDX", () =>
		Effect.gen(function* () {
			const pkg = yield* Package.decode(minimal);
			const updated = yield* Package.setLicense(pkg, "MIT");
			assert.strictEqual(updated.license, "MIT");
			const error = yield* Effect.flip(Package.setLicense(pkg, "NOT-A-LICENSE"));
			assert.strictEqual(error._tag, "InvalidSpdxLicenseError");
		}),
	);

	it.effect("dependency and script mutations work in pipe and data-first styles", () =>
		Effect.gen(function* () {
			const base = yield* Package.decode(minimal);
			const withDep = base.pipe(Package.addDependency("x", "^1.0.0"));
			assert.isTrue(withDep.hasDependency("x"));
			assert.instanceOf(withDep, Package);
			assert.isFalse(base.hasDependency("x"));

			const withDev = Package.addDevDependency("vitest", "^1.0.0")(base);
			assert.isTrue(HashMap.has(withDev.devDependencies, "vitest"));
			const removedDev = Package.removeDevDependency(withDev, "vitest");
			assert.isFalse(HashMap.has(removedDev.devDependencies, "vitest"));

			const withPeer = Package.addPeerDependency(base, "effect", "^3.0.0");
			assert.isTrue(HashMap.has(withPeer.peerDependencies, "effect"));
			const withOpt = Package.addOptionalDependency(base, "fsevents", "^2.0.0");
			assert.isTrue(HashMap.has(withOpt.optionalDependencies, "fsevents"));

			const withScript = Package.setScript(base, "build", "tsc");
			assert.deepStrictEqual(HashMap.get(withScript.scripts, "build"), Option.some("tsc"));
			const removedScript = Package.removeScript(withScript, "build");
			assert.isTrue(HashMap.has(removedScript.scripts, "build") === false);
		}),
	);
});

describe("Package wire transform + rest", () => {
	it.effect("decodes a minimal object to a Package instance", () =>
		Effect.gen(function* () {
			const pkg = yield* Package.decode(minimal);
			assert.instanceOf(pkg, Package);
			assert.strictEqual(pkg.version.toString(), "1.0.0");
		}),
	);

	it.effect("preserves unknown fields through round-trip and never serializes a rest key", () =>
		Effect.gen(function* () {
			const decoded = yield* Package.decode({ name: "p", version: "1.0.0", customField: "kept", arr: [1, 2, 3] });
			assert.deepStrictEqual(decoded.rest, { customField: "kept", arr: [1, 2, 3] });
			const encoded = (yield* Schema.encodeUnknownEffect(Package.schema)(decoded)) as Record<string, unknown>;
			assert.strictEqual(encoded.customField, "kept");
			assert.deepStrictEqual(encoded.arr, [1, 2, 3]);
			assert.isFalse("rest" in encoded);
		}),
	);

	it.effect("carries an own __proto__ manifest key through round-trip without prototype pollution", () =>
		Effect.gen(function* () {
			// JSON.parse defines `__proto__` as an OWN data property — exactly what
			// a hostile or merely odd manifest on disk produces. The wire transform
			// must store it as data (null-prototype rest record), never assign it
			// (which on a plain object MUTATES the prototype and loses the key).
			const raw = (yield* Schema.decodeEffect(Json)(
				'{"name":"proto-carrier","version":"1.0.0","__proto__":{"polluted":true},"custom":"kept"}',
			)) as Record<string, unknown>;

			const decoded = yield* Package.decode(raw);
			const restProto = Object.getOwnPropertyDescriptor(decoded.rest, "__proto__");
			assert.deepStrictEqual(restProto?.value, { polluted: true });
			// No pollution anywhere: fresh objects must not have inherited the key.
			assert.isFalse("polluted" in {});
			assert.isUndefined(({} as Record<string, unknown>).polluted);

			const encoded = (yield* Schema.encodeUnknownEffect(Package.schema)(decoded)) as Record<string, unknown>;
			const encodedProto = Object.getOwnPropertyDescriptor(encoded, "__proto__");
			assert.deepStrictEqual(encodedProto?.value, { polluted: true });
			assert.strictEqual(encoded.custom, "kept");
			assert.isFalse("rest" in encoded);
			// Byte-level: the serialized manifest still carries the key as data.
			assert.include((yield* Schema.encodeEffect(Json)(encoded)), '"__proto__":{"polluted":true}');
		}),
	);

	it.effect("a typed field wins over a rest entry smuggling the same key", () =>
		Effect.gen(function* () {
			const decoded = yield* Package.decode({ name: "p", version: "1.0.0", description: "real" });
			// A decode never lands a known key in `rest`; only a hand-built patch
			// can smuggle one. The typed member must win on encode.
			const smuggled = decoded.copyWith({ rest: { description: "shadow", other: 1 } });
			const encoded = (yield* Schema.encodeUnknownEffect(Package.schema)(smuggled)) as Record<string, unknown>;
			assert.strictEqual(encoded.description, "real");
			assert.strictEqual(encoded.other, 1);
			assert.isFalse("rest" in encoded);
		}),
	);

	it.effect("gives structural equality to independently decoded instances", () =>
		Effect.gen(function* () {
			const a = yield* Package.decode(minimal);
			const b = yield* Package.decode(minimal);
			assert.isTrue(Equal.equals(a, b));
		}),
	);

	it.effect("supports .extend() pulling a typed field out of rest", () =>
		Effect.gen(function* () {
			class ToolPackage extends Package.extend<ToolPackage>("ToolPackage")({
				myTool: Schema.optionalKey(Schema.String),
			}) {}
			const wire = Package.wireFor(ToolPackage);
			const decoded = yield* Schema.decodeEffect(wire)({
				name: "p",
				version: "1.0.0",
				myTool: "configured",
				other: 1,
			});
			assert.strictEqual(decoded.myTool, "configured");
			assert.deepStrictEqual(decoded.rest, { other: 1 });
			const encoded = (yield* Schema.encodeUnknownEffect(wire)(decoded)) as Record<string, unknown>;
			assert.strictEqual(encoded.myTool, "configured");
			assert.strictEqual(encoded.other, 1);
		}),
	);
});

describe("Package.decode failures", () => {
	it.effect("normalizes a decode failure to a typed PackageDecodeError with structured cause", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(Package.decode({ name: "BAD NAME!!", version: "not-semver" }));
			assert.instanceOf(error, PackageDecodeError);
			assert.strictEqual(error._tag, "PackageDecodeError");
			assert.isDefined(error.cause);
		}),
	);
});

describe("Package.toJsonString", () => {
	it.effect("serializes with canonical key order, empty-map stripping and a trailing newline", () =>
		Effect.gen(function* () {
			const pkg = yield* Package.decode(full);
			const json = pkg.toJsonString();
			assert.isTrue(json.endsWith("\n"));
			const parsed = (yield* Schema.decodeEffect(Json)(json)) as Record<string, unknown>;
			const keys = Object.keys(parsed);
			assert.isTrue(keys.indexOf("name") < keys.indexOf("version"));
			assert.isTrue(keys.indexOf("version") < keys.indexOf("description"));
			assert.isTrue(keys.indexOf("scripts") < keys.indexOf("dependencies"));
			// unset dependency maps do not appear
			assert.isFalse("optionalDependencies" in parsed);
		}),
	);
});
