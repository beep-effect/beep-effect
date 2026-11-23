import { N3TurtleCodecLive } from "@beep/n3";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { LegalSeedFreezeJson, observeLegalSeeds } from "./support/LegalSeedFreeze.ts";

class LegalSeedFreezeFixtureReadError extends S.TaggedError<
  LegalSeedFreezeFixtureReadError,
  { readonly brand: unique symbol }
>()(
  "LegalSeedFreezeFixtureReadError",
  { cause: S.Defect({ includeStack: true }) },
  { description: "A failed fixture read in LegalSeedFreeze.test.ts." }
) {}

const frozen = Effect.tryPromise({
  try: () => Bun.file("test/fixtures/legal-seed-freeze.json").text(),
  catch: (cause) => LegalSeedFreezeFixtureReadError.make({ cause }),
}).pipe(Effect.flatMap(S.decodeEffect(LegalSeedFreezeJson)), Effect.orDie);

it.layer(Layer.mergeAll(Digest.layerWebCrypto, N3TurtleCodecLive))("legal seed freeze before the pack move", (it) => {
  it.effect(
    "keeps every legal scheme and concept IRI, notation and seed file digest frozen",
    Effect.fnUntraced(function* () {
      const observed = yield* observeLegalSeeds("src/seed");
      const fixture = yield* frozen;
      expect(observed.schemes).toEqual(fixture.schemes);
      expect(observed.files).toEqual(fixture.files);
    })
  );
  it.effect(
    "records the legal-intake rendering parity against the seed",
    Effect.fnUntraced(function* () {
      const observed = yield* observeLegalSeeds("src/seed");
      const fixture = yield* frozen;
      expect(observed.turtleParses).toEqual(fixture.turtleParses);
      expect(observed.legalIntakeParity).toEqual(fixture.legalIntakeParity);
    })
  );
});
