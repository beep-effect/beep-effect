import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { DependencyResolutionError, WorkspaceResolver } from "@beep/npm-spec/WorkspaceResolver";
import { assert, describe, it } from "@effect/vitest";
import { assertDefined, assertNone, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const equivalent = S.toEquivalence(DependencyResolutionError);

describe("WorkspaceResolver property floor", () => {
  it.effect.prop(
    "DependencyResolutionError: decoding an encoded error succeeds and preserves its value",
    [Arbitrary.schema(DependencyResolutionError)],
    ([error]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(DependencyResolutionError)(error);
        const decoded = yield* S.decodeEffect(DependencyResolutionError)(encoded);
        assertTrue(equivalent(decoded, error));
        const value1 = yield* S.encodeEffect(DependencyResolutionError)(decoded);
        assert.deepStrictEqual(value1, encoded);
        assert.strictEqual(decoded.message, error.message);
      }),
    runs
  );

  it.effect.prop(
    "encoding an originating Error preserves its name, message and stack",
    [Arbitrary.schema(S.String), Arbitrary.schema(S.String)],
    ([specifier, message]) =>
      Effect.gen(function* () {
        const cause = new Error(message);
        const stack = cause.stack;
        assertDefined(stack);
        const error = DependencyResolutionError.make({ specifier, cause });
        const encoded = yield* S.encodeEffect(DependencyResolutionError)(error);
        assert.strictEqual(error.cause, cause);
        assert.deepStrictEqual(encoded.cause, { name: cause.name, message, stack });
        const decoded = yield* S.decodeEffect(DependencyResolutionError)(encoded);
        const value2 = yield* S.encodeEffect(DependencyResolutionError)(decoded);
        assert.deepStrictEqual(value2, encoded);
        assert.strictEqual(decoded.specifier, specifier);
        assert.strictEqual(decoded.reason, "mechanism");
      }),
    runs
  );

  it.effect.prop(
    "legacy wire errors default to mechanism and keep the specifier and structured cause",
    [Arbitrary.schema(S.String), Arbitrary.schema(S.Json)],
    ([specifier, cause]) =>
      Effect.gen(function* () {
        const decoded = yield* S.decodeEffect(DependencyResolutionError)({
          _tag: "DependencyResolutionError",
          specifier,
          cause,
        });
        assert.strictEqual(decoded.reason, "mechanism");
        assert.strictEqual(decoded.specifier, specifier);
        assert.deepStrictEqual(decoded.cause, cause);
        assert.strictEqual(decoded.message, `Failed to resolve dependency specifier "${specifier}"`);
      }),
    runs
  );

  it.layer(WorkspaceResolver.noop, { timeout: "30 seconds" })("no-op resolver", (it) => {
    it.effect.prop(
      "every package name resolves successfully to None on repeated calls",
      [Arbitrary.schema(S.String)],
      ([packageName]) =>
        Effect.gen(function* () {
          const resolver = yield* WorkspaceResolver;
          const versionOf3 = yield* resolver.versionOf(packageName);
          assertNone(versionOf3);
          const versionOf4 = yield* resolver.versionOf(packageName);
          assertNone(versionOf4);
        }),
      runs
    );
  });
});
