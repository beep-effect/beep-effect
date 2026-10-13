import { assert, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import { CatalogResolver, WorkspaceResolver } from "../../effected/npm/index.ts";
import { Package, PackageDecodeError } from "../../effected/package-json/Package.ts";
it.effect("dependency getters and removals preserve the original package", () => Effect.gen(function* () {
  const pkg = yield* Package.decode({name: "p", version: "1.0.0", dependencies: {a: "1"}, devDependencies: {b: "2"}, peerDependencies: {c: "3"}, optionalDependencies: {d: "4"}});
  assertSome(HashMap.get(pkg.getDevDependencies(), "b").pipe(EffectOptionMap), "dev");
  assertSome(HashMap.get(pkg.getPeerDependencies(), "c").pipe(EffectOptionalMap), false);
  assert.strictEqual(HashMap.size(Package.removeDependency(pkg, "a").dependencies), 0);
  assert.strictEqual(HashMap.size(Package.removePeerDependency("c")(pkg).peerDependencies), 0);
  assert.strictEqual(HashMap.size(Package.removeOptionalDependency(pkg, "d").optionalDependencies), 0);
  assertSome(HashMap.get(pkg.dependencies, "a"), "1");
  assert.strictEqual(PackageDecodeError.make({cause: new Error("bad")}).message, "Failed to decode package.json");
}));
import * as O from "effect/Option";
import { Dependency } from "../../effected/package-json/Dependency.ts";
const EffectOptionMap = O.map((dependency: Dependency) => dependency.kind);
const EffectOptionalMap = O.map((dependency: Dependency) => dependency.isOptional);
it.layer(Layer.mergeAll(CatalogResolver.noop, WorkspaceResolver.noop), {timeout: "30 seconds"})((it) => {
  it.effect("missing catalog entries preserve unresolved specifiers", () => Effect.gen(function* () {
    const pkg = yield* Package.decode({name: "p", version: "1.0.0", dependencies: {a: "catalog:missing"}});
    const resolved = yield* Package.resolve(pkg);
    assertSome(HashMap.get(resolved.dependencies, "a"), "catalog:missing");
  }));
});
it.effect("serialization propagates schema failures from a corrupted runtime instance", () => Effect.gen(function* () {
  const pkg = yield* Package.decode({name: "p", version: "1.0.0"});
  Object.defineProperty(pkg, "private", {value: "invalid"});
  assert.throws(() => pkg.toJsonString(), /boolean/);
}));
