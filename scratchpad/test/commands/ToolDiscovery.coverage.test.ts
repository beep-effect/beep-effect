import { assert, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import { LocalExec } from "../../effected/commands/LocalExec.ts";
import { ScriptedSpawner } from "../../effected/commands/ScriptedSpawner.ts";
import { Tool, VersionFlag, VersionJson } from "../../effected/commands/Tool.ts";
import { ResolvedTool, ToolDiscovery, ToolNotFoundError, ToolRefusedError, ToolVersionMismatchError } from "../../effected/commands/ToolDiscovery.ts";

const withLayer = <R, E2, R2>(layer: Layer.Layer<R, E2, R2>) => <A, E, R3>(program: Effect.Effect<A, E, R3>) =>
  Effect.scopedWith((scope) => Effect.flatMap(Layer.buildWithScope(layer, scope), (context) => Effect.provideContext(program, context)));

it.effect("test double members defect by name and layerTest applies overrides", () => Effect.gen(function* () {
  const service = ToolDiscovery.makeTest();
  const tool = Tool.named("tool");
  for (const [name, effect] of [["resolve", service.resolve(tool)], ["isAvailable", service.isAvailable(tool)], ["invalidate", service.invalidate(tool)], ["invalidateAll", service.invalidateAll]] as const) {
    const exit = yield* Effect.exit(effect);
    if (Exit.isFailure(exit)) {
      assert.isTrue(Cause.hasDies(exit.cause));
      assert.include(Cause.pretty(exit.cause), name);
      assert.include(Cause.pretty(exit.cause), "not stubbed");
    } else assert.fail("expected an unstubbed defect");
  }
  const available = yield* Effect.flatMap(ToolDiscovery, (discovery) => discovery.isAvailable(tool)).pipe(withLayer(ToolDiscovery.layerTest({ isAvailable: () => Effect.succeed(true) })));
  assert.isTrue(available);
}));
it.effect("resolution errors render useful names and local resolutions tolerate missing contexts", () => Effect.sync(() => {
  assert.strictEqual(ToolNotFoundError.make({ tool: "tool", searched: ["global", "local"] }).message, "Tool not found: tool (required global and local)");
  assert.strictEqual(ToolVersionMismatchError.make({ tool: "tool", globalVersion: "1", localVersion: "2" }).message, "Version mismatch for tool: global 1 vs local 2");
  assert.strictEqual(ToolRefusedError.make({ tool: "" }).message, "Refused an empty tool name");
  assert.include(ToolRefusedError.make({ tool: "--bad" }).message, "leading");
  const resolved = ResolvedTool.make({ name: "tool", source: "local", version: O.none(), globalVersion: O.none(), localVersion: O.none(), mismatch: false });
  const command = resolved.command("arg");
  if (ChildProcess.isStandardCommand(command)) {
    assert.strictEqual(command.command, "tool");
    assert.deepStrictEqual(command.args, ["arg"]);
    assert.strictEqual(command.options.cwd, undefined);
  } else assert.fail("expected a standard command");
}));
it.effect("version parsing tolerates unmatched regexes and JSON primitives while preserving presence", () => Effect.gen(function* () {
  for (const [version, stdout] of [[VersionFlag.make({ flag: " --version  ", pattern: "nomatch" }), "1.2.3"], [VersionJson.make({ flag: "info --json", path: "version.value" }), "null"], [VersionJson.make({ flag: "info --json", path: "version.value" }), '{"version":1}']] as const) {
    const layer = ToolDiscovery.layer.pipe(Layer.provide(Layer.mergeAll(LocalExec.layerNone, ScriptedSpawner.make(() => ({ stdout })).layer)));
    const resolved = yield* Effect.flatMap(ToolDiscovery, (service) => service.resolve(Tool.named("tool", { version }))).pipe(withLayer(layer));
    assertNone(resolved.version);
    assert.strictEqual(resolved.source, "global");
  }
}));

it.effect("explicit global and local requirements select their requested copy even on mismatch", () => Effect.gen(function* () {
  for (const source of ["global", "local"] as const) {
    const spawner = ScriptedSpawner.make((command) => ({ stdout: command === "pnpm" ? "2.0.0" : "1.0.0" }));
    const layer = ToolDiscovery.layer.pipe(Layer.provide(Layer.mergeAll(LocalExec.layerFor("pnpm", { directory: "/project" }), spawner.layer)));
    const resolved = yield* Effect.flatMap(ToolDiscovery, (service) => service.resolve(Tool.named("tool", { source }))).pipe(withLayer(layer));
    assert.strictEqual(resolved.source, source);
    assert.isTrue(resolved.mismatch);
    assertSome(resolved.version, source === "global" ? "1.0.0" : "2.0.0");
    const command = resolved.command("arg");
    if (ChildProcess.isStandardCommand(command)) {
      assert.strictEqual(command.command, source === "global" ? "tool" : "pnpm");
      assert.deepStrictEqual(command.args, source === "global" ? ["arg"] : ["exec", "tool", "arg"]);
    } else assert.fail("expected a standard command");
  }
}));
