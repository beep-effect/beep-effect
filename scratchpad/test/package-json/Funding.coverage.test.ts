import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Funding } from "../../effected/package-json/Funding.ts";
it.effect("FromValue preserves spelling and rebuilds remembered objects when url or type changes", () => Effect.gen(function* () {
  const original = yield* S.decodeEffect(Funding.FromValue)({url: "old", type: "github", custom: 42});
  assert.deepStrictEqual(yield* S.encodeEffect(Funding.FromValue)(original), {url: "old", type: "github", custom: 42});
  const urlChanged = Funding.make({url: "new", type: "github", rest: {custom: 42}});
  Funding.rememberWire(urlChanged, {url: "old", type: "github", custom: 42});
  assert.deepStrictEqual(yield* S.encodeEffect(Funding.FromValue)(urlChanged), {url: "new", type: "github", custom: 42});
  const typeChanged = Funding.make({url: "old", type: "other"});
  Funding.rememberWire(typeChanged, {url: "old", type: "github"});
  assert.deepStrictEqual(yield* S.encodeEffect(Funding.FromValue)(typeChanged), {url: "old", type: "other"});
}));
