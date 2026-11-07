import { ReferenceWorkspace, referenceWorkspaceLayer } from "@beep/repo-cli/commands/Refs";
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";

const writeExecutable = Effect.fn("SetupEffectRefTest.writeExecutable")(function* (filePath: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(filePath, content);
  yield* fs.chmod(filePath, 0o755);
});
it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "30 seconds" })("setup-effect-ref", (it) => {
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
          A.join(
            [
              "#!/bin/sh",
              'printf "%s\\n" "$*" >> "$HOME/git.log"',
              '[ "$1" = "clone" ] || exit 92',
              "for argument do target=$argument; done",
              'mkdir -p "$target/.git"',
              "",
            ],
            "\n"
          )
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
        const argument1 = path.join(repoRoot, "scripts", "references.json");
        const readFileString1 = yield* fs.readFileString(setupScriptPath);
        yield* fs.writeFileString(argument1, readFileString1);
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
          return {
            stderr: A.join(
              A.filter(lines, (line) => Str.startsWith("warning:")(line)),
              "\n"
            ),
            stdout: A.join(lines, "\n"),
          };
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
          "goals-archive",
          "effect-workspace",
        ];
        const assertLinks = Effect.fn("SetupEffectRefTest.assertLinks")(function* () {
          for (const name of links) {
            const readLink1 = yield* fs.readLink(path.join(repoRoot, ".repos", name));
            expect(readLink1).toBe(name === "effect-workspace" ? expectedRoot : path.join(expectedRoot, name));
          }
        });
        expect((yield* run()).stderr).toBe("");
        yield* assertLinks();
        const clones = yield* fs.readFileString(gitLog);
        expect(clones).toBe(
          A.join(
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
              `clone --quiet --branch main -- git@github.com:beep-effect/beep-effect-goals-archive.git ${expectedRoot}/goals-archive`,
              "",
            ],
            "\n"
          )
        );
        const before = yield* Effect.forEach(links, (name) => fs.stat(path.join(repoRoot, ".repos", name)));
        const second = yield* run();
        expect(second.stderr).toBe("");
        expect(second.stdout).not.toContain("cloning");
        expect(second.stdout).not.toContain("relinking");
        yield* assertLinks();
        const readFileString2 = yield* fs.readFileString(gitLog);
        expect(readFileString2).toBe(clones);
        const forEach3 = yield* Effect.forEach(links, (name) => fs.stat(path.join(repoRoot, ".repos", name)));
        expect(forEach3).toEqual(before);

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
        const readFileString4 = yield* fs.readFileString(gitLog);
        expect(readFileString4).toBe(clones);
        const readFileString5 = yield* fs.readFileString(dirtyFile);
        expect(readFileString5).toBe("preserve me\n");
        const readFileString6 = yield* fs.readFileString(gitEntry);
        expect(readFileString6).toBe("gitdir: elsewhere\n");

        for (const name of links) {
          const link = path.join(repoRoot, ".repos", name);
          yield* fs.remove(link);
          yield* fs.makeDirectory(link);
          yield* fs.writeFileString(path.join(link, "keep"), name);
        }
        const collisions = yield* run();
        for (const name of links) {
          expect(collisions.stderr).toContain(`.repos/${name} exists and is not a symlink`);
          const readFileString7 = yield* fs.readFileString(path.join(repoRoot, ".repos", name, "keep"));
          expect(readFileString7).toBe(name);
        }
        const readFileString8 = yield* fs.readFileString(gitLog);
        expect(readFileString8).toBe(clones);
        const exists9 = yield* fs.exists(realpathLog);
        expect(exists9).toBe(false);
      })
    );
  }
});
