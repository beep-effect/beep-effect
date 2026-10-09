import { assert, it } from "@effect/vitest";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { CliError, CliOutput } from "effect/cli";
import { routeHelpOnUsageError } from "../../../effected/cli/internal/HelpRouting.ts";

it.effect("all console delegates release held help before forwarding their exact arguments", () => Effect.gen(function* () {
  const events: Array<readonly [string, ReadonlyArray<unknown>]> = [];
  const capture = (name: string) => (...args: ReadonlyArray<unknown>): void => { events.push([name, args]); };
  const sink: Console.Console = {
    assert: capture("assert"), clear: capture("clear"), count: capture("count"), countReset: capture("countReset"),
    debug: capture("debug"), dir: capture("dir"), dirxml: capture("dirxml"), group: capture("group"),
    groupCollapsed: capture("groupCollapsed"), groupEnd: capture("groupEnd"), info: capture("info"),
    table: capture("table"), time: capture("time"), timeEnd: capture("timeEnd"), timeLog: capture("timeLog"),
    trace: capture("trace"), warn: capture("warn"), log: capture("log"), error: capture("error"),
  };
  const calls: ReadonlyArray<readonly [string, ReadonlyArray<unknown>, (console: Console.Console) => void]> = [
    ["assert", [false, "bad"], c => c.assert(false, "bad")], ["clear", [], c => c.clear()],
    ["count", ["x"], c => c.count("x")], ["countReset", ["x"], c => c.countReset("x")],
    ["debug", ["x", 2], c => c.debug("x", 2)], ["dir", [{ x: 1 }, { depth: 2 }], c => c.dir({ x: 1 }, { depth: 2 })],
    ["dirxml", ["x"], c => c.dirxml("x")], ["group", ["x"], c => c.group("x")],
    ["groupCollapsed", ["x"], c => c.groupCollapsed("x")], ["groupEnd", [], c => c.groupEnd()],
    ["info", ["x"], c => c.info("x")], ["table", [[1], ["x"]], c => c.table([1], ["x"])],
    ["time", ["x"], c => c.time("x")], ["timeEnd", ["x"], c => c.timeEnd("x")],
    ["timeLog", ["x", 2], c => c.timeLog("x", 2)], ["trace", ["x"], c => c.trace("x")], ["warn", ["x"], c => c.warn("x")],
  ];
  const program = Effect.gen(function* () {
    const formatter = yield* CliOutput.Formatter;
    const console = yield* Console.Console;
    const help = formatter.formatHelpDoc({ usage: "app", description: "", flags: [], args: [], annotations: Context.empty() });
    const error = CliError.UserError.make({ cause: "bad" });
    const delegate = CliOutput.defaultFormatter({ colors: false });
    assert.strictEqual(formatter.formatCliError(error), delegate.formatCliError(error));
    assert.strictEqual(formatter.formatError(error), delegate.formatError(error));
    assert.strictEqual(formatter.formatVersion("app", "1"), delegate.formatVersion("app", "1"));
    for (const [name, args, call] of calls) {
      console.log(help);
      const before = events.length;
      call(console);
      assert.deepStrictEqual(events.slice(before), [["log", [help]], [name, args]]);
    }
    const errors = formatter.formatErrors([error]);
    console.log(help); console.error(errors);
    assert.deepStrictEqual(events.slice(-2), [["error", [help]], ["error", [errors]]]);
    console.log(help); console.error(1);
    assert.deepStrictEqual(events.slice(-2), [["log", [help]], ["error", [1]]]);
    console.log(help); console.error(errors, "extra");
    assert.deepStrictEqual(events.slice(-2), [["log", [help]], ["error", [errors, "extra"]]]);
    console.log(help); console.log(help, "extra");
    assert.deepStrictEqual(events.slice(-2), [["log", [help]], ["log", [help, "extra"]]]);
    console.log(1); assert.deepStrictEqual(events.slice(-1), [["log", [1]]]);
    console.log(help);
    return help;
  });
  const help = yield* routeHelpOnUsageError(program).pipe(Effect.provideService(Console.Console, sink));
  assert.deepStrictEqual(events.slice(-1), [["log", [help]]]);
}));
