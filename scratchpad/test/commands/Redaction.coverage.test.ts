import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import { Redaction } from "../../effected/commands/Redaction.ts";

it.effect("custom flags are case insensitive and preserve non-secret assignments", () => Effect.sync(() => {
  assert.deepStrictEqual(Redaction.scrubArgs(new Array<string>(1)), [""]);
  assert.deepStrictEqual(Redaction.scrubArgs(["--Private=value", "--plain=value", "--PRIVATE", "second"], { flags: ["--PRIVATE"] }), ["--Private=***", "--plain=value", "--PRIVATE", "***"]);
  const instance: unknown = Reflect.construct(Redaction, []);
  assert.strictEqual(Object.getPrototypeOf(instance), Redaction.prototype);
  if (P.isObject(instance)) assert.deepStrictEqual(Object.keys(instance), []);
  else assert.fail("expected an object instance");
}));
