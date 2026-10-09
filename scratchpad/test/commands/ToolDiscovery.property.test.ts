import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ResolvedSource, ResolvedTool, ToolNotFoundError, ToolVersionMismatchError, ToolRefusedError, ToolResolutionFailure } from "../../effected/commands/ToolDiscovery.ts";
import * as Layer from "effect/Layer";
import { LocalExec } from "../../effected/commands/LocalExec.ts";
import { ScriptedSpawner } from "../../effected/commands/ScriptedSpawner.ts";
import { Tool, VersionFlag, VersionJson } from "../../effected/commands/Tool.ts";
import { ToolDiscovery } from "../../effected/commands/ToolDiscovery.ts";
import { assertSome } from "@effect/vitest/utils";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(`${name}: decode(encode(x)) preserves x and never fails`, [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(equivalent(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("ToolDiscovery schema property floor", () => {
  roundTrips("ResolvedSource", ResolvedSource);
  roundTrips("ResolvedTool", ResolvedTool);
  roundTrips("ToolNotFoundError", ToolNotFoundError);
  roundTrips("ToolVersionMismatchError", ToolVersionMismatchError);
  roundTrips("ToolRefusedError", ToolRefusedError);
  roundTrips("ToolResolutionFailure", ToolResolutionFailure);
});


const withLayer = <R, E2, R2>(layer: Layer.Layer<R, E2, R2>) => <A, E, R3>(program: Effect.Effect<A, E, R3>) =>
  Effect.scopedWith((scope) => Effect.flatMap(Layer.buildWithScope(layer, scope), (context) => Effect.provideContext(program, context)));
const discover = (stdout: string, version: VersionFlag | VersionJson) => {
  const layer = ToolDiscovery.layer.pipe(Layer.provide(Layer.mergeAll(LocalExec.layerNone, ScriptedSpawner.make(() => ({ stdout })).layer)));
  return Effect.flatMap(ToolDiscovery, (service) => service.resolve(Tool.named("tool", { version }))).pipe(withLayer(layer));
};
it.effect.prop("flag version parsing is stable under canonical rendering and keeps every version component", [Arbitrary.schema(S.Struct({ major: S.Int.check(S.isBetween({ minimum: 0, maximum: 999 })), minor: S.Int.check(S.isBetween({ minimum: 0, maximum: 999 })), patch: S.Int.check(S.isBetween({ minimum: 0, maximum: 999 })) }))], ([value]) => Effect.gen(function* () {
  const version = `${value.major}.${value.minor}.${value.patch}`;
  const probe = VersionFlag.make({ flag: "--version" });
  const parsed = yield* discover(`tool version ${version}\n`, probe);
  assertSome(parsed.version, version);
  const canonical = yield* discover(version, probe);
  assertSome(canonical.version, version);
  assert.deepStrictEqual(canonical.version, parsed.version);
}), runs);
it.effect.prop("JSON version parsing preserves nested strings through JSON stringify/parse fidelity", [Arbitrary.schema(S.String)], ([value]) => Effect.gen(function* () {
  const codec = S.fromJsonString(S.Struct({ tool: S.Struct({ version: S.String }) }));
  const probe = VersionJson.make({ flag: "info --json", path: "tool.version" });
  const text = yield* S.encodeEffect(codec)({ tool: { version: value } });
  const parsed = yield* discover(text, probe);
  assertSome(parsed.version, value);
  const canonical = yield* S.encodeEffect(codec)(yield* S.decodeEffect(codec)(text));
  assert.strictEqual(yield* S.encodeEffect(codec)(yield* S.decodeEffect(codec)(canonical)), canonical);
  assertSome((yield* discover(canonical, probe)).version, value);
}), runs);
