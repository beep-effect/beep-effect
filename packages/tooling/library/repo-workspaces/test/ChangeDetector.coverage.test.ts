import { Git } from "@beep/git";
import { MemoryFileSystem } from "@beep/memfs";
import { ChangeDetectionError, ChangeDetectionOptions, ChangeDetector } from "@beep/repo-workspaces/ChangeDetector";
import { WorkspaceDiscovery } from "@beep/repo-workspaces/WorkspaceDiscovery";
import { WorkspaceRoot } from "@beep/repo-workspaces/WorkspaceRoot";
import { assert, describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";

const base = Layer.mergeAll(
  Path.layer,
  MemoryFileSystem.layerWith({
    "/repo/package.json": '{"name":"root","workspaces":["packages/*"]}',
    "/repo/packages/core/package.json": '{"name":"core","version":"1.0.0"}',
  })
);
const roots = WorkspaceRoot.layer.pipe(Layer.provide(base));
const discovery = WorkspaceDiscovery.layer({ cwd: "/repo" }).pipe(Layer.provide(roots), Layer.provide(base));
const git = Git.layerTest({ changedFiles: () => Effect.succeed(["/repo/packages/core/index.ts"]) });
const detector = ChangeDetector.layer.pipe(Layer.provide(git), Layer.provide(discovery));

describe("ChangeDetector coverage", () => {
  it.effect("renders the failed operation", () =>
    Effect.sync(() => {
      assert.strictEqual(
        ChangeDetectionError.make({ operation: "resolve", cause: "missing" }).message,
        "Change detection failed during resolve"
      );
    })
  );
  it.layer(detector, { timeout: "30 seconds" })((it) => {
    it.effect("keeps absolute git paths absolute and resolves explicit affected-package options", () =>
      Effect.gen(function* () {
        const service = yield* ChangeDetector;
        const options = ChangeDetectionOptions.make({ base: "main" });
        const changedPackages1 = yield* service.changedPackages(options);
        assert.deepStrictEqual(
          A.map(changedPackages1, (pkg) => pkg.name),
          ["core"]
        );
        const affectedPackages2 = yield* service.affectedPackages(options);
        assert.deepStrictEqual(
          A.map(affectedPackages2, (pkg) => pkg.name),
          ["core"]
        );
      })
    );
  });
});

describe("ChangeDetectionOptions JSON Schema key annotations", () => {
  it("emits the base key annotation in toJsonSchemaDocument because annotateKey runs before withDecodingDefaultKey", () => {
    expect(S.toJsonSchemaDocument(ChangeDetectionOptions).definitions).toMatchObject({
      "@beep/repo-workspaces/ChangeDetector/ChangeDetectionOptions": {
        properties: {
          base: {
            allOf: expect.arrayContaining([
              { title: "ChangeDetectionOptions.base", description: "The ref to compare against." },
            ]),
          },
        },
      },
    });
  });
});
