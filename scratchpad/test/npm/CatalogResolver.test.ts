import { assert, describe, layer } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { CatalogResolver } from "../../effected/npm/index.ts";

describe("CatalogResolver", () => {
	layer(CatalogResolver.noop)("no-op default layer", (it) => {
		it.effect("rangeOf returns none for the default catalog", () =>
			Effect.gen(function* () {
				const resolver = yield* CatalogResolver;
				const range = yield* resolver.rangeOf("effect", Option.none());
				assert.isTrue(Option.isNone(range));
			}),
		);

		it.effect("rangeOf returns none for a named catalog", () =>
			Effect.gen(function* () {
				const resolver = yield* CatalogResolver;
				const range = yield* resolver.rangeOf("typescript", Option.some("build"));
				assert.isTrue(Option.isNone(range));
			}),
		);
	});

	describe("stub implementation", () => {
		// A test double resolving a fixed catalog map proves the contract is
		// implementable and that rangeOf threads packageName + catalog through
		// correctly — the pattern real consumers (e.g. @effected/workspaces) follow.
		const catalogs = new Map<string, Map<string, string>>([
			["default", new Map([["effect", "^4.0.0"]])],
			["build", new Map([["typescript", "^5.9.0"]])],
		]);
		const StubCatalogResolver = Layer.succeed(CatalogResolver, {
			rangeOf: (packageName, catalog) =>
				Effect.succeed(
					Option.fromUndefinedOr(catalogs.get(Option.getOrElse(catalog, () => "default"))?.get(packageName)),
				),
		});

		layer(StubCatalogResolver)((it) => {
			it.effect("resolves a package in the default catalog", () =>
				Effect.gen(function* () {
					const resolver = yield* CatalogResolver;
					const range = yield* resolver.rangeOf("effect", Option.none());
					assert.deepStrictEqual(range, Option.some("^4.0.0"));
				}),
			);

			it.effect("resolves a package in a named catalog", () =>
				Effect.gen(function* () {
					const resolver = yield* CatalogResolver;
					const range = yield* resolver.rangeOf("typescript", Option.some("build"));
					assert.deepStrictEqual(range, Option.some("^5.9.0"));
				}),
			);

			it.effect("returns none for an unknown package", () =>
				Effect.gen(function* () {
					const resolver = yield* CatalogResolver;
					const range = yield* resolver.rangeOf("does-not-exist", Option.none());
					assert.isTrue(Option.isNone(range));
				}),
			);
		});
	});
});
