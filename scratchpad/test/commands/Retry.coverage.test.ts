import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import { CommandFailedError } from "../../effected/commands/Run.ts";
import { Retry } from "../../effected/commands/Retry.ts";
import { ScriptedSpawner } from "../../effected/commands/ScriptedSpawner.ts";

it.effect("extra retry patterns inspect platform causes and absent streams without retrying timeouts", () => Effect.sync(() => {
  const policy = Retry.transient({ times: 4, also: ["ENOENT"] });
  assert.strictEqual(policy.times, 4);
  const missing = CommandFailedError.make({ kind: "spawn", command: "missing", args: [], cause: ScriptedSpawner.notFound("missing") });
  assert.isTrue(policy.while(missing));
  assert.isFalse(Retry.transient().while(missing));
  assert.isFalse(policy.while(CommandFailedError.make({ kind: "nonZero", command: "tool", args: [] })));
  assert.isFalse(policy.while(CommandFailedError.make({ kind: "timeout", command: "tool", args: [], stderr: "ENOENT" })));
  assert.isTrue(policy.while(CommandFailedError.make({ kind: "nonZero", command: "tool", args: [], stdout: "ECONNRESET" })));
}));

it.effect("Retry runtime namespace constructor creates an empty instance", () => Effect.sync(() => {
  const instance: unknown = Reflect.construct(Retry, []);
  assert.strictEqual(Object.getPrototypeOf(instance), Retry.prototype);
  if (P.isObject(instance)) assert.deepStrictEqual(Object.keys(instance), []);
  else assert.fail("expected an object instance");
}));
