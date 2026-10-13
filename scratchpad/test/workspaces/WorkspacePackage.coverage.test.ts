import { assert, describe, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { WorkspaceManifestError, WorkspacePackage } from "../../effected/workspaces/WorkspacePackage.ts";
import { platform } from "./fixtures.ts";

const pkg = WorkspacePackage.make({
  name: "@scope/member",
  path: "/repo/member",
  packageJsonPath: "/repo/member/package.json",
  relativePath: "member",
  workspaceRoot: "/repo",
  dependencies: { shared: "prod", prod: "1" },
  devDependencies: { shared: "dev", dev: "2" },
  peerDependencies: { shared: "peer", peer: "3" },
  optionalDependencies: { shared: "optional", optional: "4" },
});

describe("WorkspacePackage observable methods", () => {
  it.effect("dependency lookup falls back through every dependency kind", () =>
    Effect.sync(() => {
      assert.isTrue(pkg.hasPeerDependency("peer"));
      assert.isTrue(pkg.hasOptionalDependency("optional"));
      assertSome(pkg.dependencyVersion("dev"), "2");
      assertSome(pkg.dependencyVersion("peer"), "3");
      assertSome(pkg.dependencyVersion("optional"), "4");
      assertSome(pkg.dependencyVersion("shared"), "prod");
      const manifest = pkg.toWorkspaceManifest();
      assert.strictEqual(manifest.name, pkg.name);
      assert.deepStrictEqual(manifest.dependencies, pkg.dependencies);
      assert.deepStrictEqual(manifest.devDependencies, pkg.devDependencies);
      assert.deepStrictEqual(manifest.peerDependencies, pkg.peerDependencies);
      assert.deepStrictEqual(manifest.optionalDependencies, pkg.optionalDependencies);
    }),
  );
  it.layer(platform({ "/repo/member/package.json": '{"name":"@scope/member","version":"1.2.3"}' }), { timeout: "30 seconds" })((it) => {
    it.effect("instance manifest decodes the strict file", () =>
      Effect.gen(function* () {
        const manifest = yield* pkg.manifest();
        assert.strictEqual(manifest.name, "@scope/member");
        assert.strictEqual(manifest.version?.toString(), "1.2.3");
      }),
    );
  });
  it.layer(platform({ "/repo/member/package.json": "{" }), { timeout: "30 seconds" })((it) => {
    it.effect("invalid JSON reports the decode path and message", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(pkg.manifest());
        assert.instanceOf(error, WorkspaceManifestError);
        assert.strictEqual(error.message, "Failed to decode package.json at /repo/member/package.json");
      }),
    );
  });
  it.layer(platform({ "/repo/member/package.json": '{"name":"@scope/member","version":"bad"}' }), { timeout: "30 seconds" })((it) => {
    it.effect("a valid JSON manifest with invalid semver fails strict decoding", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(pkg.manifest());
        assert.strictEqual(error.kind, "decode");
        assert.strictEqual(error.packageJsonPath, pkg.packageJsonPath);
      }),
    );
  });
  it.layer(platform({}), { timeout: "30 seconds" })((it) => {
    it.effect("a missing file reports the read path and message", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(pkg.manifest());
        assert.strictEqual(error.message, "Failed to read package.json at /repo/member/package.json");
      }),
    );
  });
});
