import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ProcessGuard, type ProcessGuardHost } from "../../effected/engine/ProcessGuard.ts";
import { deliberatelyInvalid } from "./deliberatelyInvalid.ts";

class Stackless extends S.TaggedError<Stackless>()("Stackless", { message: S.String }) {}

describe("ProcessGuard reporting boundaries", () => {
  it.effect("formats an Error without a stack using its message", () =>
    Effect.gen(function* () {
      const reports: Array<string> = [];
      let reject: (reason: unknown) => void = () => { throw "listener not installed"; };
      const host: ProcessGuardHost = {
        on: (...[event, listener]:
          | [event: "uncaughtException", listener: (error: Error, origin: string) => void]
          | [event: "unhandledRejection", listener: (reason: unknown) => void]) => {
          if (event === "unhandledRejection") reject = listener;
        },
        emit: () => undefined,
        stderr: { write: (chunk) => reports.push(chunk) },
        exit: (): never => { throw "unexpected exit"; },
      };
      yield* Effect.promise(() => ProcessGuard.run({
        label: "guard",
        host,
        policy: { onUncaught: "exit", onRejection: "log" },
        load: () => Promise.resolve(),
      }));
      const error = Stackless.make({ message: "stackless failure" });
      Reflect.deleteProperty(error, "stack");
      assert.strictEqual(error.stack, undefined);
      reject(error);
      assert.deepStrictEqual(reports, ["guard: unhandledRejection: stackless failure\n"]);
    }),
  );
  it.effect("a synchronous load throw is reported and exits with code one even under log policy", () =>
    Effect.gen(function* () {
      const reports: Array<string> = [];
      const exits: Array<number | undefined> = [];
      const host: ProcessGuardHost = {
        on: () => undefined,
        emit: () => undefined,
        stderr: { write: (chunk) => reports.push(chunk) },
        exit: (code): never => { exits.push(code); throw "exit sentinel"; },
      };
      const result = yield* Effect.promise(() => ProcessGuard.run({
        label: "guard",
        host,
        policy: { onUncaught: "exitBeforeConnect", onRejection: "log" },
        load: () => { throw "synchronous load failure"; },
      }).then(
        () => ({ status: "resolved" as const }),
        (reason: unknown) => ({ status: "rejected" as const, reason }),
      ));
      assert.deepStrictEqual(result, { status: "rejected", reason: "exit sentinel" });
      assert.deepStrictEqual(reports, ["guard: startup failed: synchronous load failure\n"]);
      assert.deepStrictEqual(exits, [1]);
    }),
  );

  it.effect("a synchronous load throw still returns a Promise when the host exit returns", () =>
    Effect.gen(function* () {
      const reports: Array<string> = [];
      const exits: Array<number | undefined> = [];
      const host = deliberatelyInvalid<ProcessGuardHost>({
        on: () => undefined,
        emit: () => undefined,
        stderr: { write: (chunk: string) => reports.push(chunk) },
        exit: (code?: number) => { exits.push(code); },
      });
      const result = ProcessGuard.run({
        label: "guard",
        host,
        policy: { onUncaught: "exitBeforeConnect", onRejection: "log" },
        load: () => { throw "synchronous load failure"; },
      });
      assert.instanceOf(result, Promise);
      assert.deepStrictEqual(reports, ["guard: startup failed: synchronous load failure\n"]);
      assert.deepStrictEqual(exits, [1]);
      assert.isUndefined(yield* Effect.promise(() => result));
      assert.deepStrictEqual(reports, ["guard: startup failed: synchronous load failure\n"]);
      assert.deepStrictEqual(exits, [1]);
    }),
  );

  it.effect("reports an unformattable rejection without hiding it or exiting under log policy", () =>
    Effect.gen(function* () {
      const reports: Array<string> = [];
      const exits: Array<number | undefined> = [];
      let reject: (reason: unknown) => void = () => { throw "listener not installed"; };
      const host: ProcessGuardHost = {
        on: (...[event, listener]:
          | [event: "uncaughtException", listener: (error: Error, origin: string) => void]
          | [event: "unhandledRejection", listener: (reason: unknown) => void]) => {
          if (event === "unhandledRejection") reject = listener;
        },
        emit: () => undefined,
        stderr: { write: (chunk) => reports.push(chunk) },
        exit: (code): never => { exits.push(code); throw "unexpected exit"; },
      };
      yield* Effect.promise(() => ProcessGuard.run({
        label: "guard",
        host,
        policy: { onUncaught: "exit", onRejection: "log" },
        load: (control) => {
          control.useFormat(() => { throw "formatter failed"; });
          return Promise.resolve();
        },
      }));
      reject({ [Symbol.toPrimitive]: () => { throw "coercion failed"; } });
      assert.deepStrictEqual(reports, ["guard: unhandledRejection: <unformattable error value>\n"]);
      assert.deepStrictEqual(exits, []);
    }),
  );

  it.effect("rejects with the registration failure and never starts loading", () =>
    Effect.gen(function* () {
      let loaded = false;
      const host: ProcessGuardHost = {
        on: () => { throw "registration failed"; },
        emit: () => undefined,
        stderr: { write: () => undefined },
        exit: (): never => { throw "unexpected exit"; },
      };
      const result = yield* Effect.promise(() => ProcessGuard.run({
        label: "guard",
        host,
        load: () => { loaded = true; return Promise.resolve(); },
      }).then(
        () => ({ status: "resolved" as const }),
        (reason: unknown) => ({ status: "rejected" as const, reason }),
      ));
      assert.deepStrictEqual(result, { status: "rejected", reason: "registration failed" });
      assert.strictEqual(loaded, false);
    }),
  );
});
