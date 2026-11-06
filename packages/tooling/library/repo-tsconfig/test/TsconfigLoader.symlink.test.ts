import { resolveExtendsTarget } from "@beep/repo-tsconfig/internal/extendsTarget";
import { TsconfigExtendsError, TsconfigLoader } from "@beep/repo-tsconfig/TsconfigLoader";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, layer } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

/**
 * A real temporary workspace whose package is linked into `node_modules`, the shape bun and pnpm
 * workspaces produce:
 *
 * - `packages/base/tsconfig.base.json`: the shared base;
 * - `packages/lib/tsconfig.json`: extends the base RELATIVELY (`../base/tsconfig.base.json`);
 * - `app/node_modules/lib`: a symlink to `packages/lib`;
 * - `app/linked`: a symlink to `packages/lib`, reached by a relative `extends`.
 *
 * @param root - The real (symlink-free) temporary directory to build it in.
 */
const linkedWorkspace = Effect.fnUntraced(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const write = Effect.fnUntraced(function* (relative: string, text: string) {
    const file = path.join(root, relative);
    yield* fs.makeDirectory(path.dirname(file), { recursive: true });
    yield* fs.writeFileString(file, text);
  });
  yield* write("packages/base/tsconfig.base.json", '{"compilerOptions":{"strict":true}}');
  yield* write("packages/lib/package.json", '{"name":"lib"}');
  yield* write("packages/lib/tsconfig.json", '{"extends":"../base/tsconfig.base.json"}');
  yield* write("app/tsconfig.json", '{"extends":"lib/tsconfig.json"}');
  yield* write("app/tsconfig.relative.json", '{"extends":"./linked/tsconfig.json"}');
  yield* fs.makeDirectory(path.join(root, "app/node_modules"), { recursive: true });
  yield* fs.symlink(path.join(root, "packages/lib"), path.join(root, "app/node_modules/lib"));
  yield* fs.symlink(path.join(root, "packages/lib"), path.join(root, "app/linked"));
});

layer(NodeServices.layer, { timeout: "30 seconds" })(
  "TsconfigLoader, symlinked extends targets on a real filesystem",
  (it) => {
    it.effect("realpaths a package target, so the linked config's relative extends resolves", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const madeTempDirectoryScoped = yield* fs.makeTempDirectoryScoped({ prefix: "repo-tsconfig-symlink-" });
        const root = yield* fs.realPath(madeTempDirectoryScoped);
        yield* linkedWorkspace(root);
        const target = yield* resolveExtendsTarget("lib/tsconfig.json", path.join(root, "app/tsconfig.json"));
        assertSome(target, path.join(root, "packages/lib/tsconfig.json"));

        const resolved = yield* TsconfigLoader.resolve(path.join(root, "app/tsconfig.json"));
        assert.deepStrictEqual(resolved.extendedPaths, [
          path.join(root, "packages/base/tsconfig.base.json"),
          path.join(root, "packages/lib/tsconfig.json"),
          path.join(root, "app/tsconfig.json"),
        ]);
        assert.strictEqual(resolved.compilerOptions.strict, true);
      })
    );

    it.effect("keeps a relative target as written, so its own relative extends resolves from the link", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const madeTempDirectoryScoped1 = yield* fs.makeTempDirectoryScoped({ prefix: "repo-tsconfig-symlink-" });
        const root = yield* fs.realPath(madeTempDirectoryScoped1);
        yield* linkedWorkspace(root);
        const configPath = path.join(root, "app/tsconfig.relative.json");
        const target = yield* resolveExtendsTarget("./linked/tsconfig.json", configPath);
        assertSome(target, path.join(root, "app/linked/tsconfig.json"));

        // tsc keeps the relative path unresolved too, so `../base` from `app/linked` is missing.
        const error = yield* Effect.flip(TsconfigLoader.resolve(configPath));
        assert.instanceOf(error, TsconfigExtendsError);
        assert.strictEqual(error.reason, "not-found");
        assert.strictEqual(error.path, path.join(root, "app/linked/tsconfig.json"));
        assert.isTrue(A.contains(error.chain, configPath));
      })
    );
  }
);
