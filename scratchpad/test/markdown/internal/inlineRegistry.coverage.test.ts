import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { inlineDialect } from "../../../effected/markdown/internal/inlineRegistry.ts";

it.effect("reports unsupported runtime dialects as programmer errors", () => Effect.sync(() => {
  assert.throws(() => Reflect.apply(inlineDialect, undefined, ["unsupported"]), /unknown markdown dialect: unsupported/);
}));
