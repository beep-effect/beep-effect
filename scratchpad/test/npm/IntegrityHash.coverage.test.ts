import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { CorepackIntegrityHash, InvalidIntegrityHashError, InvalidSriIntegrityHashError } from "../../effected/npm/IntegrityHash.ts";

it.effect("integrity failures describe the input and expected grammar", () => Effect.sync(() => {
  assert.include(InvalidIntegrityHashError.make({ input: "bad" }).message, 'Invalid integrity hash "bad"');
  assert.include(InvalidSriIntegrityHashError.make({ input: "bad" }).message, 'bad');
}));
it.effect("the SRI bridge rejects characters beyond its base64 lookup table", () => Effect.gen(function* () {
  const error = yield* Effect.flip(CorepackIntegrityHash.fromSri("sha512-~~"));
  assert.strictEqual(error.input, "sha512-~~");
}));
