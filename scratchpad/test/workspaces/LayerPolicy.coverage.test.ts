import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { LayerPolicy, LayerPolicyError } from "../../effected/workspaces/LayerPolicy.ts";

describe("LayerPolicy diagnostics coverage", () => {
  it.effect("rejects non-object policies with a typed decode failure", () => Effect.gen(function* () {
    for (const input of [null, [], "policy", 1]) {
      const error = yield* Effect.flip(LayerPolicy.decode(input));
      assert.strictEqual(error.reason, "decode");
      assert.include(error.message, "does not match the LayerPolicy shape");
    }
  }));
  it.effect("renders read, JSON and decode errors with optional paths and details", () => Effect.sync(() => {
    assert.strictEqual(LayerPolicyError.make({ reason: "read", path: "/policy", cause: "absent" }).message,
      "Could not read the layer policy at /policy");
    assert.strictEqual(LayerPolicyError.make({ reason: "json", cause: "invalid" }).message,
      "The layer policy is not valid JSON");
    for (const cause of ["invalid", new Error("")]) {
      assert.strictEqual(LayerPolicyError.make({ reason: "decode", path: "/policy", cause }).message,
        "The layer policy at /policy does not match the LayerPolicy shape");
    }
    assert.strictEqual(LayerPolicyError.make({ reason: "decode", cause: new Error("missing layers") }).message,
      "The layer policy does not match the LayerPolicy shape: missing layers");
  }));
  it.layer(MemoryFileSystem.layerWith({ "/broken": "{", "/null": "null" }), { timeout: "30 seconds" })((it) => {
    it.effect("load errors retain their path and readable diagnostic", () => Effect.gen(function* () {
      assert.strictEqual((yield* Effect.flip(LayerPolicy.load("/missing"))).message, "Could not read the layer policy at /missing");
      assert.strictEqual((yield* Effect.flip(LayerPolicy.load("/broken"))).message, "The layer policy at /broken is not valid JSON");
      const invalid = yield* Effect.flip(LayerPolicy.load("/null"));
      assert.strictEqual(invalid.path, "/null");
      assert.include(invalid.message, "does not match the LayerPolicy shape");
    }));
  });
});
