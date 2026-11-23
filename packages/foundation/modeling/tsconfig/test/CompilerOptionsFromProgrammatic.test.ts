import { CompilerOptionsFromProgrammatic } from "@beep/tsconfig/CompilerOptionsFromProgrammatic";
import { TsEnumCodec } from "@beep/tsconfig/TsEnumCodec";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const decode = S.decodeUnknownEffect(CompilerOptionsFromProgrammatic);

const ONE_NUMERIC_PER_FAMILY_WITH_CANONICAL_DECODE: ReadonlyArray<
  readonly [key: string, numeric: number, canonical: string]
> = [
  ["target", 12, "es2025"],
  ["module", 199, "nodenext"],
  ["moduleResolution", 100, "bundler"],
  ["jsx", 4, "react-jsx"],
  ["newLine", 1, "lf"],
  ["moduleDetection", 3, "force"],
];

const ALIAS_CARRYING_NUMERICS_DECODING_TO_LAST_ROW_CANONICAL: ReadonlyArray<
  readonly [key: string, numeric: number, canonical: string]
> = [
  ["module", 5, "es2015"],
  ["moduleResolution", 2, "node10"],
];

describe("CompilerOptionsFromProgrammatic", () => {
  for (const [key, numeric, canonical] of ONE_NUMERIC_PER_FAMILY_WITH_CANONICAL_DECODE) {
    it.effect(`decodes ${key}: ${numeric} to "${canonical}"`, () =>
      Effect.gen(function* () {
        const decoded = yield* decode({ [key]: numeric });
        assert.strictEqual(decoded[key], canonical);
      })
    );
  }

  for (const [key, numeric, canonical] of ALIAS_CARRYING_NUMERICS_DECODING_TO_LAST_ROW_CANONICAL) {
    it.effect(
      `decodes alias-carrying ${key}: ${numeric} to the last-row canonical "${canonical}", never the alias`,
      () =>
        Effect.gen(function* () {
          const decoded = yield* decode({ [key]: numeric });
          assert.strictEqual(decoded[key], canonical);
        })
    );
  }

  it.effect("decodes an object mixing numeric, canonical and case-varying spellings", () =>
    Effect.gen(function* () {
      const decoded = yield* decode({
        target: 12,
        module: "NodeNext",
        moduleResolution: "bundler",
        jsx: 5,
        strict: true,
      });
      assert.strictEqual(decoded.target, "es2025");
      assert.strictEqual(decoded.module, "nodenext");
      assert.strictEqual(decoded.moduleResolution, "bundler");
      assert.strictEqual(decoded.jsx, "react-jsxdev");
      assert.strictEqual(decoded.strict, true);
    })
  );

  it.effect("decodes lib in all three spellings, including case-varying short names", () =>
    Effect.gen(function* () {
      const decoded = yield* decode({
        lib: ["ESNext", "lib.dom.d.ts", "/nix/store/x/typescript/lib/lib.dom.iterable.d.ts"],
      });
      assert.deepStrictEqual(decoded.lib, ["esnext", "dom", "dom.iterable"]);
    })
  );

  it.effect("preserves unknown and dead passthrough keys", () =>
    Effect.gen(function* () {
      const decoded = yield* decode({ target: 12, charset: "utf8", futureOption: 42 });
      assert.strictEqual(decoded.target, "es2025");
      assert.strictEqual(decoded.charset, "utf8");
      assert.strictEqual(decoded.futureOption, 42);
    })
  );

  it.effect("fails decode on a numeric with no table entry rather than passing it through", () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(decode({ target: 9999 }).pipe(Effect.mapError(() => "decode failed")));
      assertExitFailure(result, Cause.fail("decode failed"));
    })
  );

  it.effect("fails decode on an unmappable numeric even alongside valid keys", () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(decode({ target: 12, jsx: 9999 }).pipe(Effect.mapError(() => "decode failed")));
      assertExitFailure(result, Cause.fail("decode failed"));
    })
  );

  it.effect("fails decode on a non-record input", () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(decode("es2025").pipe(Effect.mapError(() => "decode failed")));
      assertExitFailure(result, Cause.fail("decode failed"));
    })
  );

  it.effect("encodes back to the programmatic form", () =>
    Effect.gen(function* () {
      const decoded = yield* decode({ target: 12, module: 199, lib: ["esnext"], strict: true });
      const encoded = yield* S.encodeUnknownEffect(CompilerOptionsFromProgrammatic)(decoded);
      assert.strictEqual(encoded.target, 12);
      assert.strictEqual(encoded.module, 199);
      assert.deepStrictEqual(encoded.lib, ["lib.esnext.d.ts"]);
      assert.strictEqual(encoded.strict, true);
    })
  );

  it("decodes synchronously through Result for a non-Effect caller, the consumer path this codec exists for: a validated result with no cast and no Effect", () => {
    const ok = S.decodeResult(CompilerOptionsFromProgrammatic)({ target: 12, strict: true });
    assertSuccess(
      Result.map(ok, (options) => options.target),
      "es2025"
    );

    const bad = S.decodeResult(CompilerOptionsFromProgrammatic)({ target: 9999 });
    assertFailure(
      Result.mapError(bad, () => "decode failed"),
      "decode failed"
    );
  });
});

describe("CompilerOptionsFromProgrammatic idempotence", () => {
  const CanonicalWithEveryKeyOptionalSoGeneratorWalksSubsets = S.Struct({
    target: S.optionalKey(S.Literals(["es5", "es2015", "es2023", "esnext"])),
    module: S.optionalKey(S.Literals(["commonjs", "es2015", "nodenext", "preserve"])),
    moduleResolution: S.optionalKey(S.Literals(["classic", "node10", "bundler"])),
    jsx: S.optionalKey(S.Literals(["preserve", "react", "react-jsx"])),
    newLine: S.optionalKey(S.Literals(["crlf", "lf"])),
    moduleDetection: S.optionalKey(S.Literals(["auto", "legacy", "force"])),
    lib: S.optionalKey(S.Array(S.Literals(["esnext", "dom", "dom.iterable"])).check(S.isMaxLength(3))),
    strict: S.optionalKey(S.Boolean),
  });

  it.effect.prop(
    "decode leaves already-canonical options unchanged, so mixed and already-normalized options share one door",
    [CanonicalWithEveryKeyOptionalSoGeneratorWalksSubsets],
    ([canonical]) =>
      Effect.gen(function* () {
        const decoded = yield* decode(canonical);
        assert.deepStrictEqual(decoded, canonical);
      })
  );

  it.effect.prop("decode is idempotent", [CanonicalWithEveryKeyOptionalSoGeneratorWalksSubsets], ([canonical]) =>
    Effect.gen(function* () {
      const once = yield* decode(canonical);
      const twice = yield* decode(once);
      assert.deepStrictEqual(twice, once);
    })
  );

  it.effect.prop(
    "decode composes with encodeCompilerOptions, the composition the downstream consumer writes",
    [CanonicalWithEveryKeyOptionalSoGeneratorWalksSubsets],
    ([canonical]) =>
      Effect.gen(function* () {
        const decoded = yield* decode(canonical);
        const programmatic = TsEnumCodec.encodeCompilerOptions(decoded);
        const redecoded = yield* decode(programmatic);
        assert.deepStrictEqual(redecoded, decoded);
      })
  );
});
