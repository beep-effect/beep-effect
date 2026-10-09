import { assert, describe, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { CatalogResolver } from "../../effected/npm/index.ts";

describe("CatalogResolver", () => {
	layer(CatalogResolver.noop)("no-op default layer", (it) => {
		it.effect("rangeOf returns none for the default catalog", () =>
			Effect.gen(function* () {
				const resolver = yield* CatalogResolver;
				const range = yield* resolver.rangeOf("effect", O.none());
				assert.isTrue(O.isNone(range));
			}),
		);

		it.effect("rangeOf returns none for a named catalog", () =>
			Effect.gen(function* () {
				const resolver = yield* CatalogResolver;
				const range = yield* resolver.rangeOf("typescript", O.some("build"));
				assert.isTrue(O.isNone(range));
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
			rangeOf: Effect.fn("CatalogResolver.rangeOf")((packageName: string, catalog: O.Option<string>) =>
				Effect.succeed(
					O.fromUndefinedOr(catalogs.get(O.getOrElse(catalog, () => "default"))?.get(packageName)),
				),
			),
		});

		layer(StubCatalogResolver)((it) => {
			it.effect("resolves a package in the default catalog", () =>
				Effect.gen(function* () {
					const resolver = yield* CatalogResolver;
					const range = yield* resolver.rangeOf("effect", O.none());
					assert.deepStrictEqual(range, O.some("^4.0.0"));
				}),
			);

			it.effect("resolves a package in a named catalog", () =>
				Effect.gen(function* () {
					const resolver = yield* CatalogResolver;
					const range = yield* resolver.rangeOf("typescript", O.some("build"));
					assert.deepStrictEqual(range, O.some("^5.9.0"));
				}),
			);

			it.effect("returns none for an unknown package", () =>
				Effect.gen(function* () {
					const resolver = yield* CatalogResolver;
					const range = yield* resolver.rangeOf("does-not-exist", O.none());
					assert.isTrue(O.isNone(range));
				}),
			);
		});
	});
});
