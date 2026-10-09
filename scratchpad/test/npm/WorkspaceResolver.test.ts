import { assert, describe, it, layer } from "@effect/vitest";
import { Effect, Layer, Option, Result, Schema } from "effect";
import { DependencyResolutionError, WorkspaceResolver } from "../../effected/npm/index.ts";

describe("WorkspaceResolver", () => {
	layer(WorkspaceResolver.noop)("no-op default layer", (it) => {
		it.effect("versionOf returns none", () =>
			Effect.gen(function* () {
				const resolver = yield* WorkspaceResolver;
				const version = yield* resolver.versionOf("@effected/semver");
				assert.isTrue(Option.isNone(version));
			}),
		);
	});

	describe("stub implementation", () => {
		// A test double resolving a fixed workspace map proves the contract is
		// implementable and that versionOf threads packageName through correctly.
		const versions = new Map<string, string>([
			["@effected/semver", "0.1.0"],
			["@effected/jsonc", "0.2.0"],
		]);
		const StubWorkspaceResolver = Layer.succeed(WorkspaceResolver, {
			versionOf: Effect.fn("WorkspaceResolver.versionOf")((packageName: string) =>
				Effect.succeed(Option.fromUndefinedOr(versions.get(packageName))),
			),
		});

		layer(StubWorkspaceResolver)((it) => {
			it.effect("resolves a known workspace package", () =>
				Effect.gen(function* () {
					const resolver = yield* WorkspaceResolver;
					const version = yield* resolver.versionOf("@effected/semver");
					assert.deepStrictEqual(version, Option.some("0.1.0"));
				}),
			);

			it.effect("returns none for an unknown workspace package", () =>
				Effect.gen(function* () {
					const resolver = yield* WorkspaceResolver;
					const version = yield* resolver.versionOf("@effected/nope");
					assert.isTrue(Option.isNone(version));
				}),
			);
		});
	});

	describe("DependencyResolutionError", () => {
		it("preserves a structured cause and renders its message", () => {
			const cause = { kind: "missing" as const, packageName: "@effected/semver" };
			const error = DependencyResolutionError.make({ specifier: "workspace:*", cause });

			assert.strictEqual(error._tag, "DependencyResolutionError");
			assert.strictEqual(error.specifier, "workspace:*");
			// cause is kept structured, not folded into a string.
			assert.deepStrictEqual(error.cause, cause);
			assert.strictEqual(typeof error.message, "string");
			assert.match(error.message, /workspace:\*/);
			assert.isTrue(error instanceof Error);
		});

		it("preserves an Error cause without stringifying it", () => {
			const cause = new Error("catalog not found");
			const error = DependencyResolutionError.make({ specifier: "catalog:", cause });

			assert.strictEqual(error.cause, cause);
			assert.isTrue(error.cause instanceof Error);
			assert.strictEqual((error.cause as Error).message, "catalog not found");
		});

		it.effect("fails an effect through the typed error channel", () =>
			Effect.gen(function* () {
				const result = yield* Effect.flip(
					Effect.fail(DependencyResolutionError.make({ specifier: "catalog:", cause: "unresolved" })),
				);
				assert.strictEqual(result._tag, "DependencyResolutionError");
				assert.strictEqual(result.cause, "unresolved");
			}),
		);

		it("defaults reason to mechanism, so existing call sites keep their meaning", () => {
			const error = DependencyResolutionError.make({ specifier: "catalog:", cause: new Error("boom") });
			assert.strictEqual(error.reason, "mechanism");
			assert.strictEqual(error.message, 'Failed to resolve dependency specifier "catalog:"');
		});

		it("a no-version failure carries the reason, no cause, and says so in its message", () => {
			const error = DependencyResolutionError.make({
				specifier: "workspace:@x/bare",
				reason: "no-version",
				cause: undefined,
			});
			assert.strictEqual(error.reason, "no-version");
			assert.isUndefined(error.cause);
			assert.strictEqual(
				error.message,
				'Failed to resolve dependency specifier "workspace:@x/bare": the workspace member declares no version',
			);
		});

		it("rejects a reason outside the literal union", () => {
			assert.throws(() =>
				DependencyResolutionError.make({ specifier: "workspace:x", reason: "bogus" as never, cause: undefined }),
			);
		});

		it("decodes an error encoded before reason existed as a mechanism failure", () => {
			const decoded = Result.getOrThrow(Schema.decodeResult(DependencyResolutionError)({
				_tag: "DependencyResolutionError",
				specifier: "catalog:",
				cause: "unresolved",
			}));
			assert.strictEqual(decoded.reason, "mechanism");
		});
	});
});
