import { DependencyResolutionError, WorkspaceResolver } from "@beep/npm-spec/WorkspaceResolver";
import { assert, describe, it, layer } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { deliberatelyInvalid } from "./support/deliberatelyInvalid.ts";

describe("WorkspaceResolver", () => {
  layer(WorkspaceResolver.noop, { timeout: "30 seconds" })("no-op default layer", (it) => {
    it.effect("versionOf returns none", () =>
      Effect.gen(function* () {
        const resolver = yield* WorkspaceResolver;
        const version = yield* resolver.versionOf("@effected/semver");
        assertNone(version);
      })
    );
  });

  describe("stub implementation", () => {
    // A test double resolving a fixed workspace map proves the contract is
    // implementable and that versionOf threads packageName through correctly.
    const versions = HashMap.make(["@effected/semver", "0.1.0"], ["@effected/jsonc", "0.2.0"]);
    const StubWorkspaceResolver = Layer.succeed(WorkspaceResolver, {
      versionOf: Effect.fn("WorkspaceResolver.versionOf")((packageName: string) =>
        Effect.succeed(HashMap.get(versions, packageName))
      ),
    });

    layer(StubWorkspaceResolver)((it) => {
      it.effect("resolves a known workspace package", () =>
        Effect.gen(function* () {
          const resolver = yield* WorkspaceResolver;
          const version = yield* resolver.versionOf("@effected/semver");
          assertSome(version, "0.1.0");
        })
      );

      it.effect("returns none for an unknown workspace package", () =>
        Effect.gen(function* () {
          const resolver = yield* WorkspaceResolver;
          const version = yield* resolver.versionOf("@effected/nope");
          assertNone(version);
        })
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

    it.effect("encodes the originating cause stack", () =>
      Effect.gen(function* () {
        const cause = new Error("catalog not found");
        const stack = cause.stack;
        if (stack === undefined) assert.fail("expected the originating Error stack");
        const encoded = yield* S.encodeEffect(DependencyResolutionError)(
          DependencyResolutionError.make({ specifier: "catalog:", cause })
        );
        assert.deepStrictEqual(encoded.cause, { name: cause.name, message: cause.message, stack });
      })
    );

    it("preserves an Error cause without stringifying it", () => {
      const cause = new Error("catalog not found");
      const error = DependencyResolutionError.make({ specifier: "catalog:", cause });

      assert.strictEqual(error.cause, cause);
      assert.isTrue(error.cause instanceof Error);
      if (!(error.cause instanceof Error)) assert.fail("expected an Error cause");
      assert.strictEqual(error.cause.message, "catalog not found");
    });

    it.effect("fails an effect through the typed error channel", () =>
      Effect.gen(function* () {
        const result = yield* DependencyResolutionError.make({ specifier: "catalog:", cause: "unresolved" }).pipe(
          Effect.fail,
          Effect.flip
        );
        assert.strictEqual(result._tag, "DependencyResolutionError");
        assert.strictEqual(result.cause, "unresolved");
      })
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
        'Failed to resolve dependency specifier "workspace:@x/bare": the workspace member declares no version'
      );
    });

    it("rejects a reason outside the literal union", () => {
      assert.throws(() =>
        DependencyResolutionError.make({
          specifier: "workspace:x",
          reason: deliberatelyInvalid<"mechanism" | "no-version">("bogus"),
          cause: undefined,
        })
      );
    });

    it("the decoder also rejects a reason outside the literal union", () => {
      assert.throws(() =>
        Result.getOrThrow(
          S.decodeUnknownResult(DependencyResolutionError)({
            _tag: "DependencyResolutionError",
            specifier: "workspace:x",
            reason: "bogus",
            cause: undefined,
          })
        )
      );
    });

    it("decodes an error encoded before reason existed as a mechanism failure", () => {
      const decoded = Result.getOrThrow(
        S.decodeResult(DependencyResolutionError)({
          _tag: "DependencyResolutionError",
          specifier: "catalog:",
          cause: "unresolved",
        })
      );
      assert.strictEqual(decoded.reason, "mechanism");
    });
  });
});

describe("DependencyResolutionError properties", () => {
  it.effect.prop("a no-version error round-trips through its encoded form", [S.String], ([specifier]) =>
    Effect.gen(function* () {
      const error = DependencyResolutionError.make({ specifier, reason: "no-version", cause: undefined });
      const encoded = yield* S.encodeEffect(DependencyResolutionError)(error);
      const decoded = yield* S.decodeEffect(DependencyResolutionError)(encoded);
      assert.strictEqual(decoded.specifier, specifier);
      assert.strictEqual(decoded.reason, "no-version");
    })
  );
});
