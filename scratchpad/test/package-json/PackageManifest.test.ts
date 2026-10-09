// The presence-lenient manifest model. The four probe rows from #286 are
// pinned explicitly — the first three flip from the strict model's behavior,
// the fourth deliberately does not:
//
//   private root (no name/version)   PackageManifest OK   (Package still rejects)
//   name only                        PackageManifest OK
//   name+version                     PackageManifest OK
//   nonsemver version ("1.0")        PackageManifest REJECT — lenient about
//                                    ABSENCE, strict about shape when present.

import { assert, describe, it } from "@effect/vitest";
import { Effect, HashMap, Schema } from "effect";
import { Package } from "../../effected/package-json/Package.ts";
import { PackageManifest } from "../../effected/package-json/PackageManifest.ts";

const PRIVATE_ROOT = {
	private: true,
	packageManager: "pnpm@11.2.0",
	devEngines: { runtime: { name: "node", version: "24.9.1" } },
} as const;

describe("PackageManifest.decode", () => {
	// Probe row 1: the idiomatic monorepo root manifest — no name, no version.
	it.effect("decodes the private workspace-root shape", () =>
		Effect.gen(function* () {
			const manifest = yield* PackageManifest.decode(PRIVATE_ROOT);
			assert.isTrue(manifest.isPrivate);
			assert.strictEqual(manifest.name, undefined);
			assert.strictEqual(manifest.version, undefined);
			assert.strictEqual(manifest.packageManager?.name, "pnpm");
			assert.strictEqual(manifest.packageManager?.range, "11.2.0");
			assert.isTrue(manifest.packageManager?.isExact);
			const runtime = manifest.devEngines?.runtime;
			assert.isTrue(runtime !== undefined && !Array.isArray(runtime));
		}),
	);

	// The strictness contrast, pinned: the strict model still rejects it.
	it.effect("Package.decode still rejects the private workspace-root shape", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(Package.decode(PRIVATE_ROOT));
			assert.strictEqual(error._tag, "PackageDecodeError");
		}),
	);

	// Probe row 2: name without version.
	it.effect("decodes a name-only manifest", () =>
		Effect.gen(function* () {
			const manifest = yield* PackageManifest.decode({ name: "my-root", private: true });
			assert.strictEqual(manifest.name, "my-root");
			assert.strictEqual(manifest.version, undefined);
		}),
	);

	// Probe row 3: the fully publishable shape decodes here too.
	it.effect("decodes a name+version manifest with typed fields", () =>
		Effect.gen(function* () {
			const manifest = yield* PackageManifest.decode({
				name: "my-pkg",
				version: "1.2.3",
				dependencies: { effect: "^4.0.0" },
			});
			assert.strictEqual(manifest.name, "my-pkg");
			assert.strictEqual(manifest.version?.toString(), "1.2.3");
			assert.strictEqual(HashMap.size(manifest.dependencies), 1);
		}),
	);

	// Probe row 4: presence is still validated — a nonsemver version fails
	// typed. Total tolerance is the decode-free path's job, not this model's:
	// a SemVer-typed field cannot carry "1.0", and silently dropping the field
	// (npm's loose-reader behavior) would break round-trip fidelity.
	it.effect("rejects a present nonsemver version", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(PackageManifest.decode({ private: true, version: "1.0" }));
			assert.strictEqual(error._tag, "PackageDecodeError");
		}),
	);

	it.effect("rejects a present malformed name", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(PackageManifest.decode({ name: "Not A Name", private: true }));
			assert.strictEqual(error._tag, "PackageDecodeError");
		}),
	);

	// The consumer's supported input: a range pin, which the strict
	// PackageManager rejects, decodes here with its exactness tracked.
	it.effect("decodes a range packageManager pin and tracks exactness", () =>
		Effect.gen(function* () {
			const manifest = yield* PackageManifest.decode({ private: true, packageManager: "pnpm@^11.20.0" });
			assert.strictEqual(manifest.packageManager?.range, "^11.20.0");
			assert.isFalse(manifest.packageManager?.isExact);
		}),
	);

	it.effect("rejects a present garbage packageManager", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(PackageManifest.decode({ private: true, packageManager: "pnpm@garbage" }));
			assert.strictEqual(error._tag, "PackageDecodeError");
		}),
	);
});

describe("PackageManifest wire fidelity", () => {
	it.effect("preserves unknown top-level fields through rest and flattens them on encode", () =>
		Effect.gen(function* () {
			const manifest = yield* PackageManifest.decode({
				...PRIVATE_ROOT,
				pnpm: { overrides: { effect: "4.0.0-beta.107" } },
				customField: "kept",
			});
			assert.deepStrictEqual(manifest.rest?.customField, "kept");
			const encoded = Schema.encodeUnknownSync(PackageManifest.schema)(manifest) as Record<string, unknown>;
			assert.strictEqual(encoded.customField, "kept");
			assert.isFalse("rest" in encoded);
		}),
	);

	// Absent name/version stay absent — the encode invents nothing, and the
	// range packageManager re-encodes byte-identically.
	it.effect("encodes the private root without inventing name or version", () =>
		Effect.gen(function* () {
			const manifest = yield* PackageManifest.decode({ private: true, packageManager: "pnpm@^11.20.0" });
			const encoded = Schema.encodeUnknownSync(PackageManifest.schema)(manifest) as Record<string, unknown>;
			assert.isFalse("name" in encoded);
			assert.isFalse("version" in encoded);
			assert.strictEqual(encoded.packageManager, "pnpm@^11.20.0");
			assert.strictEqual(encoded.private, true);
		}),
	);

	it.effect("toJsonString serializes the private root", () =>
		Effect.gen(function* () {
			const manifest = yield* PackageManifest.decode(PRIVATE_ROOT);
			const text = manifest.toJsonString();
			const parsed = JSON.parse(text) as Record<string, unknown>;
			assert.strictEqual(parsed.packageManager, "pnpm@11.2.0");
			assert.isFalse("name" in parsed);
			assert.isFalse("dependencies" in parsed);
			assert.isTrue(text.endsWith("\n"));
		}),
	);
});
