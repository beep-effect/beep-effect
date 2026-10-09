import { ReferenceWorkspace, referenceWorkspaceLayer } from "@beep/repo-cli/commands/Refs";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";

const writeExecutable = Effect.fn("SetupEffectRefTest.writeExecutable")(function* (filePath: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(filePath, content);
  yield* fs.chmod(filePath, 0o755);
});
it.layer(NodeServices.layer, { timeout: "30 seconds" })("setup-effect-ref", (it) => {
  for (const useDefault of [false, true]) {
    it.effect(`provisions reference links idempotently with the ${useDefault ? "default" : "relative"} root`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "setup-effect-ref-test-" });
        const path = yield* Path.Path;
        const ambientPath = yield* Config.String("PATH");
        const setupScriptPath = yield* path.fromFileUrl(
          new URL("../../../../../scripts/references.json", import.meta.url)
        );
        const binDir = path.join(tempDir, "bin");
        const repoRoot = path.join(tempDir, "repo");
        const workingDirectory = path.join(tempDir, "working");
        const home = path.join(tempDir, "home");
        const gitLog = path.join(home, "git.log");
        const realpathLog = path.join(tempDir, "realpath.log");
        yield* Effect.forEach(
          [binDir, repoRoot, workingDirectory, home],
          (directory) => fs.makeDirectory(directory, { recursive: true }),
          { discard: true }
        );
        yield* writeExecutable(
          path.join(binDir, "git"),
          [
            "#!/bin/sh",
            'printf "%s\\n" "$*" >> "$HOME/git.log"',
            '[ "$1" = "clone" ] || exit 92',
            "for argument do target=$argument; done",
            'mkdir -p "$target/.git"',
            "",
          ].join("\n")
        );
        yield* writeExecutable(
          path.join(binDir, "realpath"),
          '#!/bin/sh\nprintf "called\\n" >> "$REALPATH_LOG"\nexit 91\n'
        );
        const canonicalTempDir = yield* fs.realPath(tempDir);
        const expectedRoot = useDefault
          ? path.join(canonicalTempDir, "home", "YeeBois", "references", "effect")
          : path.join(canonicalTempDir, "working", "effect reference");
        yield* fs.makeDirectory(path.join(repoRoot, "scripts"));
        yield* fs.writeFileString(
          path.join(repoRoot, "scripts", "references.json"),
          yield* fs.readFileString(setupScriptPath)
        );
        const run = Effect.fn("SetupEffectRefTest.run")(function* () {
          const operation = ReferenceWorkspace.use(
            Effect.fnUntraced(function* (workspace) {
              const root = yield* workspace.resolveRoot(
                home,
                useDefault ? O.none() : O.some(path.join(workingDirectory, "missing-segment/../effect reference"))
              );
              return yield* workspace.provision(home, repoRoot, root);
            })
          );
          const lines = yield* Layer.build(referenceWorkspaceLayer(repoRoot)).pipe(
            Effect.flatMap((context) => operation.pipe(Effect.provide(context))),
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromUnknown({ HOME: home, PATH: `${binDir}:${ambientPath}` })
            ),
            Effect.scoped
          );
          return { stderr: lines.filter((line) => line.startsWith("warning:")).join("\n"), stdout: lines.join("\n") };
        });
        const links = [
          "effect",
          "effect-tsgo",
          "ai-plugin-marketplace-manager",
          "okfit",
          "tsdoctor",
          "effected",
          "pluginfinity",
          "vitest-agent",
          "t3code",
          "opencode",
          "alchemy",
          "effect-workspace",
        ];
        const assertLinks = Effect.fn("SetupEffectRefTest.assertLinks")(function* () {
          for (const name of links) {
            expect(yield* fs.readLink(path.join(repoRoot, ".repos", name))).toBe(
              name === "effect-workspace" ? expectedRoot : path.join(expectedRoot, name)
            );
          }
        });
        expect((yield* run()).stderr).toBe("");
        yield* assertLinks();
        const clones = yield* fs.readFileString(gitLog);
        expect(clones).toBe(
          [
            `clone --quiet --branch main -- git@github.com:Effect-TS/effect.git ${expectedRoot}/effect`,
            `clone --quiet --branch main -- git@github.com:Effect-TS/tsgo.git ${expectedRoot}/effect-tsgo`,
            `clone --quiet --branch main -- git@github.com:spencerbeggs/ai-plugin-marketplace-manager.git ${expectedRoot}/ai-plugin-marketplace-manager`,
            `clone --quiet --branch main -- git@github.com:spencerbeggs/okfit.git ${expectedRoot}/okfit`,
            `clone --quiet --branch main -- git@github.com:spencerbeggs/tsdoctor.git ${expectedRoot}/tsdoctor`,
            `clone --quiet --branch main -- git@github.com:spencerbeggs/effected.git ${expectedRoot}/effected`,
            `clone --quiet --branch main -- git@github.com:spencerbeggs/pluginfinity.git ${expectedRoot}/pluginfinity`,
            `clone --quiet --branch main -- git@github.com:spencerbeggs/vitest-agent.git ${expectedRoot}/vitest-agent`,
            `clone --quiet --branch main -- https://github.com/pingdotgg/t3code.git ${expectedRoot}/t3code`,
            `clone --quiet --branch v2 -- https://github.com/anomalyco/opencode.git ${expectedRoot}/opencode`,
            `clone --quiet --branch main -- https://github.com/alchemy-run/alchemy.git ${expectedRoot}/alchemy`,
            "",
          ].join("\n")
        );
        const before = yield* Effect.forEach(links, (name) => fs.stat(path.join(repoRoot, ".repos", name)));
        const second = yield* run();
        expect(second.stderr).toBe("");
        expect(second.stdout).not.toContain("cloning");
        expect(second.stdout).not.toContain("relinking");
        yield* assertLinks();
        expect(yield* fs.readFileString(gitLog)).toBe(clones);
        expect(yield* Effect.forEach(links, (name) => fs.stat(path.join(repoRoot, ".repos", name)))).toEqual(before);

        // A linked worktree has a .git file; even dirty content must survive.
        const gitEntry = path.join(expectedRoot, "effect", ".git");
        yield* fs.remove(gitEntry, { recursive: true });
        yield* fs.writeFileString(gitEntry, "gitdir: elsewhere\n");
        const dirtyFile = path.join(expectedRoot, "effect", "dirty.txt");
        yield* fs.writeFileString(dirtyFile, "preserve me\n");
        for (const name of links) {
          const link = path.join(repoRoot, ".repos", name);
          yield* fs.remove(link);
          yield* fs.symlink(path.join(tempDir, "missing-old-target"), link);
        }
        expect((yield* run()).stderr).toBe("");
        yield* assertLinks();
        expect(yield* fs.readFileString(gitLog)).toBe(clones);
        expect(yield* fs.readFileString(dirtyFile)).toBe("preserve me\n");
        expect(yield* fs.readFileString(gitEntry)).toBe("gitdir: elsewhere\n");

        for (const name of links) {
          const link = path.join(repoRoot, ".repos", name);
          yield* fs.remove(link);
          yield* fs.makeDirectory(link);
          yield* fs.writeFileString(path.join(link, "keep"), name);
        }
        const collisions = yield* run();
        for (const name of links) {
          expect(collisions.stderr).toContain(`.repos/${name} exists and is not a symlink`);
          expect(yield* fs.readFileString(path.join(repoRoot, ".repos", name, "keep"))).toBe(name);
        }
        expect(yield* fs.readFileString(gitLog)).toBe(clones);
        expect(yield* fs.exists(realpathLog)).toBe(false);
      })
    );
  }
});
