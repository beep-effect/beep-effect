import { assert, it, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { TsconfigExtendsError, TsconfigLoader } from "../../effected/tsconfig-json/TsconfigLoader.ts";
import { TsconfigParseError } from "../../effected/tsconfig-json/TsconfigJson.ts";

it.effect("all extends errors expose the reason and resolution context", () => Effect.gen(function* () {
  const fields = { path: "/app/tsconfig.json", target: "/base.json", chain: ["/app/tsconfig.json", "/base.json"] };
  assert.strictEqual(TsconfigExtendsError.make({ ...fields, reason: "not-found" }).message, 'cannot resolve extends target "/base.json" from "/app/tsconfig.json"');
  assert.strictEqual(TsconfigExtendsError.make({ ...fields, reason: "cycle" }).message, 'extends cycle re-entering "/base.json" via /app/tsconfig.json -> /base.json');
  assert.strictEqual(TsconfigExtendsError.make({ ...fields, reason: "depth" }).message, 'extends chain exceeded depth 32 at "/app/tsconfig.json"');
  assert.strictEqual(TsconfigExtendsError.make({ ...fields, reason: "empty" }).message, 'empty extends target in "/app/tsconfig.json"');
  assert.strictEqual(TsconfigParseError.make({ path: "", cause: "invalid" }).message, "failed to parse tsconfig.json");
  assert.strictEqual(TsconfigParseError.make({ path: "/app/tsconfig.json", cause: "invalid" }).message, 'failed to parse tsconfig.json at "/app/tsconfig.json"');
}));

layer(Layer.mergeAll(MemoryFileSystem.layerWith({
  "/app/base.json": '{"compilerOptions":{"target":"ES2024","strict":true}}',
  "/app/tsconfig.json": '{"extends":"./base.json","compilerOptions":{"noEmit":true}}',
}), Path.layer), { timeout: "30 seconds" })("effective compiler options", (it) => {
  it.effect("projects the merged options after enum decoding", () => Effect.gen(function* () {
    const options = yield* TsconfigLoader.compilerOptions("/app/tsconfig.json");
    assert.deepStrictEqual(options, { target: "es2024", strict: true, noEmit: true });
  }));
});
