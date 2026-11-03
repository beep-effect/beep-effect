import { Git } from "@beep/git/Git";
import { collectTsgoWorkspaceScanDiagnosticsForTesting } from "@beep/repo-cli/commands/Quality/Quality.command";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { assertInclude } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";

const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

// Spelled in pieces so this file never carries a literal directive for the scan to reject.
const directive = A.join(["@effect", "diagnostics"], "-");

const basePlugin = {
  name: "@effect/language-service",
  diagnosticSeverity: { floatingEffect: "error" },
};

const runGit = (cwd: string, args: ReadonlyArray<string>, env: Record<string, string>): void => {
  const result = Bun.spawnSync(["git", ...args], { cwd, env, stderr: "pipe", stdout: "pipe" });
  if (result.exitCode !== 0) {
    throw new Error(`git ${A.join(args, " ")} failed: ${result.stderr.toString()}`);
  }
};

// Git runs against real directories, so each test resolves its temp root through the native
// file system (realPath) and seeds files relative to it.
const scratchCheckout = Effect.fnUntraced(function* (tmpDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = path.join(tmpDir, "home");
  yield* fs.makeDirectory(home, { recursive: true });
  const env = {
    PATH: Bun.env.PATH ?? "",
    HOME: home,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  };
  const write = Effect.fnUntraced(function* (relativePath: string, text: string) {
    const filePath = path.join(tmpDir, relativePath);
    yield* fs.makeDirectory(path.dirname(filePath), { recursive: true });
    yield* fs.writeFileString(filePath, text);
  });
  const writeJson = Effect.fnUntraced(function* (relativePath: string, value: unknown) {
    yield* write(relativePath, yield* encodeJson(value));
  });
  return { env, path, write, writeJson };
});

layer(Layer.provideMerge(Git.layer, Layer.mergeAll(NodeServices.layer, BunCrypto.layer)), { timeout: "30 seconds" })(
  "lint:tsgo-rules git visibility",
  (it) => {
    it.effect(
      "skips git-ignored residue but checks tracked and untracked files",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-tsgo-visibility-" }));
        const { env, path, write, writeJson } = yield* scratchCheckout(tmpDir);
        const repoRoot = path.join(tmpDir, "repo");

        yield* write("repo/.gitignore", "scratchpad/residue/\nscratchpad/kept/\npackages/app/local/\n");
        yield* writeJson("repo/tsconfig.base.json", { compilerOptions: { plugins: [basePlugin] } });
        yield* writeJson("repo/packages/app/tsconfig.json", { extends: "../../tsconfig.base.json" });
        yield* write("repo/packages/app/src/main.ts", `// ${directive}-next-line floatingEffect:off\n`);
        // Ignored residue: a broken profile and a rejected directive that a fresh checkout never has.
        yield* writeJson("repo/scratchpad/residue/tsconfig.json", { compilerOptions: { plugins: [] } });
        yield* write("repo/packages/app/local/probe.ts", `// ${directive}-next-line floatingEffect:off\n`);
        // Visible drift: an untracked config git does not ignore, and a tracked config under an ignore rule.
        yield* write("repo/scratchpad/fresh/tsconfig.json", "{}");
        yield* write("repo/scratchpad/kept/tsconfig.json", "{}");
        yield* Effect.sync(() => {
          runGit(repoRoot, ["init", "-b", "main"], env);
          runGit(repoRoot, ["add", "-f", "scratchpad/kept/tsconfig.json"], env);
        });

        const scan = yield* collectTsgoWorkspaceScanDiagnosticsForTesting({ basePlugin, repoRoot });

        expect(scan.pluginProfileDiagnostics).toEqual([
          "scratchpad/fresh/tsconfig.json: tsconfig extends chain does not reach tsconfig.base.json",
          "scratchpad/kept/tsconfig.json: tsconfig extends chain does not reach tsconfig.base.json",
        ]);
        expect(scan.disabledDirectives).toEqual(["packages/app/src/main.ts:1"]);
      })
    );

    it.effect(
      "fails instead of passing vacuously when git answers for an enclosing work tree",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-tsgo-nested-" }));
        const { env, path, write, writeJson } = yield* scratchCheckout(tmpDir);
        const parentRoot = path.join(tmpDir, "parent");
        const repoRoot = path.join(parentRoot, "export");

        // A git-less copy of the repository inside a checkout that ignores it lists nothing.
        yield* write("parent/.gitignore", "export/\n");
        yield* writeJson("parent/export/tsconfig.base.json", { compilerOptions: { plugins: [basePlugin] } });
        yield* write("parent/export/scratchpad/drift/tsconfig.json", "{}");
        yield* Effect.sync(() => runGit(parentRoot, ["init", "-b", "main"], env));

        const error = yield* Effect.flip(collectTsgoWorkspaceScanDiagnosticsForTesting({ basePlugin, repoRoot }));

        assertInclude(error.message, "does not list tsconfig.base.json");
      })
    );
  }
);
