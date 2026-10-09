import { assert, describe, it } from "@effect/vitest";
import { CatalogAssemblyError, CatalogResolver, Default as NpmDefault, WorkspaceResolver } from "../../effected/npm/index.ts";
import { Effect, HashMap, Layer, Option } from "effect";
import { Package } from "../../effected/package-json/Package.ts";

const workspaceOf = (versions: Record<string, string>): Layer.Layer<WorkspaceResolver> =>
	Layer.succeed(WorkspaceResolver, {
		versionOf: (name) => Effect.succeed(Option.fromUndefinedOr(versions[name])),
	});

const catalogOf = (ranges: Record<string, string>): Layer.Layer<CatalogResolver> =>
	Layer.succeed(CatalogResolver, {
		rangeOf: (name, catalog) =>
			Effect.succeed(Option.fromUndefinedOr(ranges[Option.getOrElse(catalog, () => "")] ?? ranges[name])),
	});

const decodeDeps = (deps: Record<string, string>) =>
	Package.decode({ name: "p", version: "1.0.0", dependencies: deps });

describe("Package.resolve", () => {
	it.effect("rewrites workspace: and catalog: via the provided resolvers", () =>
		Effect.gen(function* () {
			const pkg = yield* decodeDeps({ lib: "workspace:^", effect: "catalog:", lodash: "^4.0.0" });
			const resolved = yield* Package.resolve(pkg).pipe(
				Effect.provide(Layer.mergeAll(workspaceOf({ lib: "1.2.3" }), catalogOf({ effect: "^3.10.0" }))),
			);
			assert.deepStrictEqual(HashMap.get(resolved.dependencies, "lib"), Option.some("^1.2.3"));
			assert.deepStrictEqual(HashMap.get(resolved.dependencies, "effect"), Option.some("^3.10.0"));
			assert.deepStrictEqual(HashMap.get(resolved.dependencies, "lodash"), Option.some("^4.0.0"));
		}),
	);

	it.effect("leaves specifiers untouched with the no-op default layers", () =>
		Effect.gen(function* () {
			const pkg = yield* decodeDeps({ lib: "workspace:*" });
			const resolved = yield* Package.resolve(pkg).pipe(Effect.provide(NpmDefault));
			assert.deepStrictEqual(HashMap.get(resolved.dependencies, "lib"), Option.some("workspace:*"));
		}),
	);

	it.effect("applies every workspace: modifier form", () =>
		Effect.gen(function* () {
			const pkg = yield* decodeDeps({
				star: "workspace:*",
				tilde: "workspace:~",
				caret: "workspace:^",
				explicit: "workspace:2.5.0",
			});
			const resolved = yield* Package.resolve(pkg).pipe(
				Effect.provide(
					Layer.mergeAll(
						workspaceOf({ star: "1.2.3", tilde: "1.2.3", caret: "1.2.3", explicit: "1.2.3" }),
						CatalogResolver.noop,
					),
				),
			);
			assert.deepStrictEqual(HashMap.get(resolved.dependencies, "star"), Option.some("1.2.3"));
			assert.deepStrictEqual(HashMap.get(resolved.dependencies, "tilde"), Option.some("~1.2.3"));
			assert.deepStrictEqual(HashMap.get(resolved.dependencies, "caret"), Option.some("^1.2.3"));
			assert.deepStrictEqual(HashMap.get(resolved.dependencies, "explicit"), Option.some("2.5.0"));
		}),
	);

	it.effect("resolves a named catalog", () =>
		Effect.gen(function* () {
			const pkg = yield* decodeDeps({ react: "catalog:react17" });
			const resolved = yield* Package.resolve(pkg).pipe(
				Effect.provide(Layer.mergeAll(WorkspaceResolver.noop, catalogOf({ react17: "^17.0.0" }))),
			);
			assert.deepStrictEqual(HashMap.get(resolved.dependencies, "react"), Option.some("^17.0.0"));
		}),
	);

	// The alias form gets the shared @effected/npm publish semantics: the dep
	// key is the alias, the TARGET package's version is looked up, and the
	// published form is `npm:<target>@<projected>`.
	it.effect("projects an alias-form workspace: specifier to pnpm's npm: publish alias", () =>
		Effect.gen(function* () {
			const pkg = yield* decodeDeps({ viz: "workspace:@x/charts@*", plot: "workspace:charts@^" });
			const resolved = yield* Package.resolve(pkg).pipe(
				Effect.provide(Layer.mergeAll(workspaceOf({ "@x/charts": "2.0.0", charts: "1.5.0" }), CatalogResolver.noop)),
			);
			assert.deepStrictEqual(HashMap.get(resolved.dependencies, "viz"), Option.some("npm:@x/charts@2.0.0"));
			assert.deepStrictEqual(HashMap.get(resolved.dependencies, "plot"), Option.some("npm:charts@^1.5.0"));
		}),
	);

	// The widened error channel: a CatalogResolver whose assembly failed
	// surfaces its typed CatalogAssemblyError through Package.resolve untouched
	// — never re-wrapped or defected. Mirrors @effected/npm's identity pin.
	it.effect("a CatalogAssemblyError from the resolver passes through typed and unwrapped", () =>
		Effect.gen(function* () {
			const assemblyFailure = new CatalogAssemblyError({
				source: "manifest",
				path: "pnpm-workspace.yaml",
				cause: new Error("unreadable"),
			});
			const pkg = yield* decodeDeps({ effect: "catalog:" });
			const error = yield* Package.resolve(pkg).pipe(
				Effect.provide(
					Layer.mergeAll(
						WorkspaceResolver.noop,
						Layer.succeed(CatalogResolver, { rangeOf: () => Effect.fail(assemblyFailure) }),
					),
				),
				Effect.flip,
			);
			assert.instanceOf(error, CatalogAssemblyError);
			assert.strictEqual(error, assemblyFailure);
		}),
	);
});
