import { assert, describe, it, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import {
	CatalogAssemblyError,
	CatalogResolver,
	DependencyResolutionError,
	Manifest,
	ManifestDecodeError,
	UnresolvedDependencyError,
	WorkspaceResolver,
} from "../../effected/npm/index.ts";

describe("Manifest.decode and the wire codec", () => {
	it.effect("partitions the four dependency fields into typed members and everything else into rest", () =>
		Effect.gen(function* () {
			const manifest = yield* Manifest.decode({
				name: "app",
				version: "0.1.0",
				scripts: { build: "tsc" },
				dependencies: { effect: "^4.0.0" },
				devDependencies: { typescript: "^6.0.0" },
			});
			assert.deepStrictEqual(manifest.dependencies, { effect: "^4.0.0" });
			assert.deepStrictEqual(manifest.devDependencies, { typescript: "^6.0.0" });
			assert.strictEqual(manifest.peerDependencies, undefined);
			assert.strictEqual(manifest.optionalDependencies, undefined);
			assert.deepStrictEqual(manifest.rest, { name: "app", version: "0.1.0", scripts: { build: "tsc" } });
		}),
	);

	it.effect("round-trips unknown top-level fields with no literal rest key on the wire", () =>
		Effect.gen(function* () {
			const input = {
				name: "app",
				version: "0.1.0",
				private: true,
				exports: { ".": "./index.js" },
				dependencies: { effect: "catalog:" },
				pnpm: { overrides: {} },
			};
			const manifest = yield* Manifest.decode(input);
			const record = manifest.toRecord();
			assert.isFalse("rest" in record);
			assert.deepStrictEqual(record, input);
		}),
	);

	it.effect("a manifest with no dependency fields at all round-trips through an empty typed surface", () =>
		Effect.gen(function* () {
			const manifest = yield* Manifest.decode({ name: "app", license: "MIT" });
			assert.isFalse(manifest.needsResolution);
			assert.deepStrictEqual(manifest.toRecord(), { name: "app", license: "MIT" });
		}),
	);

	it.effect("a non-record dependency field fails typed as ManifestDecodeError, never a SchemaError", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(Manifest.decode({ dependencies: "oops" }));
			assert.instanceOf(error, ManifestDecodeError);
			assert.strictEqual(error._tag, "ManifestDecodeError");
			assert.strictEqual(error.message, "Failed to decode manifest");
		}),
	);

	it.effect("a non-string dependency value fails typed as ManifestDecodeError", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(Manifest.decode({ dependencies: { effect: 42 } }));
			assert.instanceOf(error, ManifestDecodeError);
		}),
	);

	it.effect("a non-record input fails typed as ManifestDecodeError", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(Manifest.decode("not a manifest"));
			assert.instanceOf(error, ManifestDecodeError);
		}),
	);
});

describe("Manifest.needsResolution", () => {
	it("is true when any dependency field carries a catalog: specifier", () => {
		assert.isTrue(Manifest.make({ dependencies: { effect: "catalog:" } }).needsResolution);
		assert.isTrue(Manifest.make({ devDependencies: { typescript: "catalog:build" } }).needsResolution);
	});

	it("is true when any dependency field carries a workspace: specifier", () => {
		assert.isTrue(Manifest.make({ peerDependencies: { "@x/a": "workspace:*" } }).needsResolution);
		assert.isTrue(Manifest.make({ optionalDependencies: { "@x/b": "workspace:^1.0.0" } }).needsResolution);
	});

	it("is false when every specifier is a plain range, tag, or other protocol", () => {
		assert.isFalse(
			Manifest.make({
				dependencies: { effect: "^4.0.0", lodash: "latest", local: "file:../x" },
				devDependencies: { typescript: "^6.0.0" },
			}).needsResolution,
		);
	});

	it("is false for a manifest with no dependency fields at all", () => {
		assert.isFalse(Manifest.make({}).needsResolution);
		assert.isFalse(Manifest.make({ rest: { name: "app", version: "0.1.0" } }).needsResolution);
	});
});

// Stub resolvers over fixed maps — the pattern real consumers follow. Provided
// via Layer.succeed on the service classes; no platform layer is needed.
const catalogs = new Map<string, Map<string, string>>([
	["default", new Map([["effect", "^4.0.0"]])],
	["build", new Map([["typescript", "^6.0.0"]])],
]);
const versions = new Map<string, string>([
	["@x/a", "1.2.3"],
	["@x/b", "2.0.0"],
	["@x/c", "3.1.0"],
	["@x/d", "4.5.6"],
	["charts", "5.0.0"],
]);
const StubResolvers = Layer.mergeAll(
	Layer.succeed(CatalogResolver, {
		rangeOf: Effect.fn("CatalogResolver.rangeOf")((packageName: string, catalog: O.Option<string>) =>
			Effect.succeed(
				O.fromUndefinedOr(catalogs.get(O.getOrElse(catalog, () => "default"))?.get(packageName)),
			),
		),
	}),
	Layer.succeed(WorkspaceResolver, {
		versionOf: Effect.fn("WorkspaceResolver.versionOf")((packageName: string) =>
			Effect.succeed(O.fromUndefinedOr(versions.get(packageName))),
		),
	}),
);

describe("Manifest.resolve", () => {
	layer(StubResolvers)((it) => {
		it.effect("projects a mixed manifest and preserves everything else", () =>
			Effect.gen(function* () {
				const manifest = yield* Manifest.decode({
					name: "app",
					version: "0.1.0",
					scripts: { build: "tsc" },
					dependencies: { effect: "catalog:", "@x/a": "workspace:*", lodash: "^4.17.0" },
					devDependencies: { typescript: "catalog:build", "@x/b": "workspace:^" },
					peerDependencies: { "@x/c": "workspace:~" },
					optionalDependencies: { "@x/d": "workspace:4.0.0" },
				});
				const snapshot = manifest.toRecord();

				const resolved = yield* manifest.resolve();

				assert.deepStrictEqual(resolved.toRecord(), {
					name: "app",
					version: "0.1.0",
					scripts: { build: "tsc" },
					dependencies: { effect: "^4.0.0", "@x/a": "1.2.3", lodash: "^4.17.0" },
					devDependencies: { typescript: "^6.0.0", "@x/b": "^2.0.0" },
					peerDependencies: { "@x/c": "~3.1.0" },
					optionalDependencies: { "@x/d": "4.0.0" },
				});
				// A fresh instance: the input is not mutated, and the result is not it.
				assert.notStrictEqual(resolved, manifest);
				assert.notStrictEqual(resolved.dependencies, manifest.dependencies);
				assert.deepStrictEqual(manifest.toRecord(), snapshot);
				// rest rides through resolution unchanged.
				assert.deepStrictEqual(resolved.rest, manifest.rest);
			}),
		);

		it.effect("a manifest with nothing to resolve round-trips its dependency fields", () =>
			Effect.gen(function* () {
				const manifest = yield* Manifest.decode({ name: "plain", dependencies: { effect: "^4.0.0" } });
				const resolved = yield* manifest.resolve();
				assert.deepStrictEqual(resolved.toRecord(), manifest.toRecord());
			}),
		);

		it.effect("a catalog: specifier with no catalog entry fails typed as UnresolvedDependencyError", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(Manifest.make({ dependencies: { react: "catalog:" } }).resolve());
				assert.instanceOf(error, UnresolvedDependencyError);
				assert.strictEqual(error.field, "dependencies");
				assert.strictEqual(error.dependency, "react");
				assert.strictEqual(error.specifier, "catalog:");
				assert.strictEqual(error.reason, "catalog-entry-missing");
			}),
		);

		it.effect("a workspace: specifier naming no workspace package fails typed as UnresolvedDependencyError", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(Manifest.make({ devDependencies: { "@x/nope": "workspace:*" } }).resolve());
				assert.instanceOf(error, UnresolvedDependencyError);
				assert.strictEqual(error.field, "devDependencies");
				assert.strictEqual(error.dependency, "@x/nope");
				assert.strictEqual(error.specifier, "workspace:*");
				assert.strictEqual(error.reason, "workspace-package-missing");
			}),
		);

		// pnpm publish semantics for the alias form: the dep key is the alias,
		// the specifier names the TARGET workspace package, and the published
		// form is `npm:<target>@<projected>` against the TARGET's version.
		it.effect("an alias-form workspace: specifier resolves the target's version into an npm: alias", () =>
			Effect.gen(function* () {
				const resolved = yield* Manifest.make({
					dependencies: { viz: "workspace:@x/a@*", plot: "workspace:charts@^" },
					devDependencies: { graph: "workspace:@x/b@~", pinned: "workspace:charts@2.0.0" },
				}).resolve();
				assert.deepStrictEqual(resolved.dependencies, {
					viz: "npm:@x/a@1.2.3",
					plot: "npm:charts@^5.0.0",
				});
				assert.deepStrictEqual(resolved.devDependencies, {
					graph: "npm:@x/b@~2.0.0",
					pinned: "npm:charts@2.0.0",
				});
			}),
		);

		it.effect("an alias form whose target is missing fails typed naming the TARGET package", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(Manifest.make({ dependencies: { viz: "workspace:@x/nope@*" } }).resolve());
				assert.instanceOf(error, UnresolvedDependencyError);
				assert.strictEqual(error.field, "dependencies");
				// The missing package is the alias TARGET, not the map key…
				assert.strictEqual(error.dependency, "@x/nope");
				// …and the original specifier is preserved verbatim.
				assert.strictEqual(error.specifier, "workspace:@x/nope@*");
				assert.strictEqual(error.reason, "workspace-package-missing");
			}),
		);

		it.effect("the error union is discriminable via catchTags", () =>
			Effect.gen(function* () {
				const outcome = yield* Manifest.make({ dependencies: { react: "catalog:" } })
					.resolve()
					.pipe(
						Effect.catchTags({
							CatalogAssemblyError: (e) => Effect.succeed(`assembly:${e.source}`),
							DependencyResolutionError: (e) => Effect.succeed(`resolution:${e.specifier}`),
							UnresolvedDependencyError: (e) => Effect.succeed(`unresolved:${e.dependency}:${e.reason}`),
						}),
					);
				assert.strictEqual(outcome, "unresolved:react:catalog-entry-missing");
			}),
		);
	});

	// A CatalogResolver whose assembly failed: the typed CatalogAssemblyError
	// must pass through resolve untouched — never re-wrapped or defected.
	const assemblyFailure = CatalogAssemblyError.make({
		source: "manifest",
		path: "pnpm-workspace.yaml",
		cause: new Error("unreadable"),
	});
	const FailingResolvers = Layer.mergeAll(
		Layer.succeed(CatalogResolver, { rangeOf: Effect.fn("CatalogResolver.rangeOf")(() => Effect.fail(assemblyFailure)) }),
		Layer.succeed(WorkspaceResolver, {
			versionOf: Effect.fn("WorkspaceResolver.versionOf")(() =>
				Effect.fail(DependencyResolutionError.make({ specifier: "workspace:*", cause: "broken" })),
			),
		}),
	);

	layer(FailingResolvers)((it) => {
		it.effect("a CatalogAssemblyError from the resolver passes through typed", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(Manifest.make({ dependencies: { effect: "catalog:" } }).resolve());
				assert.instanceOf(error, CatalogAssemblyError);
				assert.strictEqual(error, assemblyFailure);
			}),
		);

		it.effect("a DependencyResolutionError from the resolver passes through typed", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(Manifest.make({ dependencies: { "@x/a": "workspace:*" } }).resolve());
				assert.instanceOf(error, DependencyResolutionError);
			}),
		);

		it.effect("catchTags discriminates the assembly failure from the unresolved case", () =>
			Effect.gen(function* () {
				const outcome = yield* Manifest.make({ dependencies: { effect: "catalog:" } })
					.resolve()
					.pipe(
						Effect.catchTags({
							CatalogAssemblyError: (e) => Effect.succeed(`assembly:${e.source}`),
							DependencyResolutionError: (e) => Effect.succeed(`resolution:${e.specifier}`),
							UnresolvedDependencyError: (e) => Effect.succeed(`unresolved:${e.dependency}`),
						}),
					);
				assert.strictEqual(outcome, "assembly:manifest");
			}),
		);
	});
});

describe("Manifest.toRecord", () => {
	it("flattens rest back to the top level alongside the dependency fields", () => {
		const manifest = Manifest.make({
			dependencies: { effect: "^4.0.0" },
			rest: { name: "app", version: "0.1.0" },
		});
		const record = manifest.toRecord();
		assert.isFalse("rest" in record);
		assert.deepStrictEqual(record, { dependencies: { effect: "^4.0.0" }, name: "app", version: "0.1.0" });
	});

	it("a manifest built without rest encodes to just its dependency fields", () => {
		const manifest = Manifest.make({ dependencies: { effect: "^4.0.0" } });
		assert.deepStrictEqual(manifest.toRecord(), { dependencies: { effect: "^4.0.0" } });
	});

	it("a typed field wins over a rest entry smuggling the same key", () => {
		const manifest = Manifest.make({
			dependencies: { effect: "^4.0.0" },
			rest: { dependencies: { shadow: "1.0.0" }, name: "app" },
		});
		assert.deepStrictEqual(manifest.toRecord(), { dependencies: { effect: "^4.0.0" }, name: "app" });
	});
});

describe("UnresolvedDependencyError", () => {
	it("renders a catalog-flavored message from structured fields", () => {
		const error = UnresolvedDependencyError.make({
			field: "dependencies",
			dependency: "react",
			specifier: "catalog:ui",
			reason: "catalog-entry-missing",
		});
		assert.strictEqual(error._tag, "UnresolvedDependencyError");
		assert.strictEqual(error.message, 'No catalog entry for "react" (declared as "catalog:ui" in dependencies)');
	});

	it("renders a workspace-flavored message from structured fields", () => {
		const error = UnresolvedDependencyError.make({
			field: "devDependencies",
			dependency: "@x/nope",
			specifier: "workspace:*",
			reason: "workspace-package-missing",
		});
		assert.strictEqual(
			error.message,
			'No workspace package named "@x/nope" (declared as "workspace:*" in devDependencies)',
		);
	});
});
