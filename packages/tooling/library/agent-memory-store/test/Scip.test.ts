import { ScipDefinition, ScipRange, ScipSymbol, SymbolResolution } from "@beep/agent-memory-store";
import { PosixPath, Sha256Hex } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const symbol = ScipSymbol.make("scip-typescript npm @beep/schema 0.0.0 src/`Sha256.ts`/Sha256Hex.");
const definition = ScipDefinition.make({
  relativePath: PosixPath.make("src/Sha256.ts"),
  range: ScipRange.make({ startLine: 3, startCharacter: 13, endLine: 3, endCharacter: 22 }),
});

const resolutions: ReadonlyArray<SymbolResolution> = [
  SymbolResolution.cases.live.make({ symbol, definition }),
  SymbolResolution.cases.reverify.make({
    symbol,
    definition,
    expectedSpanHash: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
    actualSpanHash: Sha256Hex.make("1111111111111111111111111111111111111111111111111111111111111111"),
  }),
  SymbolResolution.cases.unresolved.make({ symbol }),
];

describe("SymbolResolution", () => {
  it.effect.prop(
    "round-trips arbitrary SCIP ranges",
    [Arbitrary.schema(ScipRange)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(ScipRange)(value);
        const decoded = yield* S.decodeEffect(ScipRange)(encoded);
        expect(decoded).toEqual(value);
      }),
    { arbitrary: { runs: 50 } }
  );

  it.effect(
    "round-trips every resolution and keeps the definition of a resolved symbol",
    Effect.fnUntraced(function* () {
      const decoded = yield* Effect.forEach(resolutions, (resolution) =>
        Effect.flatMap(S.encodeEffect(SymbolResolution)(resolution), S.decodeUnknownEffect(SymbolResolution))
      );
      expect(decoded).toEqual(resolutions);
      expect(A.map(decoded, (resolution) => resolution.liveness)).toEqual(["live", "reverify", "unresolved"]);
    })
  );

  it.effect(
    "rejects a live resolution without its definition",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(S.decodeUnknownEffect(SymbolResolution)({ liveness: "live", symbol }));
      assertInstanceOf(error, S.SchemaError);
    })
  );
});
