import { $RepoCliId } from "@beep/identity/packages";
import { TsconfigSyncPlan } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan";
import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import { FsUtilsLive, findRepoRoot, jsonStringifyPretty } from "@beep/repo-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliId.create("test/verification-layer1-turbo");
const Projection = S.Record(S.String, S.Unknown).pipe(
  $I.annoteSchema("Projection", { description: "Root manifest fields retained by the generated projection." })
);
const Summary = S.Struct({
  turboVersion: S.String,
  tasks: S.Array(S.Struct({ taskId: S.String, task: S.String, hash: S.String, package: S.String })),
}).pipe(
  $I.annoteSchema("Summary", { description: "Pinned Turbo task identities and hashes for mutation comparison." })
);
const decodeSummary = S.decodeEffect(S.fromJsonString(Summary));
const decodeProjection = S.decodeEffect(S.fromJsonString(Projection));
const PlatformLayer = FsUtilsLive.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)));
const projectionFile = "standards/root-package.projection.generated.json";
// A full tracked-tree copy and three whole-workspace dry runs are deliberately opt-in.
const fullProofEnabled = Effect.runSync(Config.Boolean("BEEP_LAYER1_DRYRUN").pipe(Config.withDefault(false)));
const writeFile = Effect.fn("Layer1Test.writeFile")(function* (root: string, file: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(root, file);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.writeFileString(target, content);
});
const writeJson = Effect.fn("Layer1Test.writeJson")(function* (root: string, file: string, value: unknown) {
  const content = yield* jsonStringifyPretty(value);
  yield* writeFile(root, file, `${content}\n`);
});

it.layer(PlatformLayer, { timeout: "180 seconds", buildPerTest: true })("verification Layer 1", (it) => {
  it.effect(
    "projects all non-catalog fields and repairs missing or stale output",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repo = yield* findRepoRoot();
      const scratch = path.join(repo, ".beep");
      yield* fs.makeDirectory(scratch, { recursive: true });
      const root = yield* fs.makeTempDirectoryScoped({ directory: scratch, prefix: "layer1-projection-" });
      yield* fs.makeDirectory(path.join(root, "standards"));
      const manifest = {
        zFutureField: { enabled: true },
        scripts: { check: "echo check" },
        name: "fixture",
        catalog: { biome: "1" },
      };
      yield* writeJson(root, "package.json", manifest);
      const planned = yield* TsconfigSyncPlan.planRootPackageProjectionSync(root);
      const change = O.getOrThrow(planned);
      const projection = yield* decodeProjection(change.content);
      expect(projection).toEqual({ name: "fixture", scripts: manifest.scripts, zFutureField: manifest.zFutureField });
      expect(R.keys(projection)).toEqual(["name", "scripts", "zFutureField"]);
      yield* writeFile(root, projectionFile, change.content);
      const planned0 = yield* TsconfigSyncPlan.planRootPackageProjectionSync(root);
      expect(O.isNone(planned0)).toBe(true);
      yield* writeJson(root, "package.json", { ...manifest, catalog: { biome: "2" } });
      const planned1 = yield* TsconfigSyncPlan.planRootPackageProjectionSync(root);
      expect(O.isNone(planned1)).toBe(true);
      yield* writeJson(root, "package.json", { ...manifest, scripts: { check: "echo changed" } });
      const planned2 = yield* TsconfigSyncPlan.planRootPackageProjectionSync(root);
      expect(O.isSome(planned2)).toBe(true);
      yield* writeFile(root, projectionFile, "{}\n");
      const planned3 = yield* TsconfigSyncPlan.planRootPackageProjectionSync(root);
      expect(O.isSome(planned3)).toBe(true);
    })
  );

  it.effect.skipIf(!fullProofEnabled)(
    "isolates a non-root catalog bump and packet markdown under pinned Turbo on a full tracked-tree copy",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repo = yield* findRepoRoot();
      const scratch = path.join(repo, ".beep");
      yield* fs.makeDirectory(scratch, { recursive: true });
      const root = yield* fs.makeTempDirectoryScoped({ directory: scratch, prefix: "layer1-dryrun-" });
      const tracked = yield* StepExec.runCaptured({
        command: "git",
        args: ["ls-files", "-z"],
        cwd: repo,
        source: "stdout",
      });
      expect(tracked.exitCode).toBe(0);
      const files = A.filter(Str.split(tracked.output, "\0"), Str.isNonEmpty);
      yield* Effect.forEach(
        files,
        Effect.fnUntraced(function* (file) {
          const source = path.join(repo, file);
          if (!(yield* fs.exists(source))) return;
          const info = yield* fs.stat(source);
          if (info.type !== "File") return;
          const target = path.join(root, file);
          yield* fs.makeDirectory(path.dirname(target), { recursive: true });
          yield* fs.copyFile(source, target);
        }),
        { concurrency: 16, discard: true }
      );
      yield* fs.copyFile(path.join(repo, projectionFile), path.join(root, projectionFile));
      const init = yield* StepExec.runCaptured({ command: "git", args: ["init", "-q"], cwd: root, source: "stdout" });
      expect(init.exitCode).toBe(0);
      const dry = Effect.fnUntraced(function* () {
        const run = yield* StepExec.runCaptured({
          command: path.join(repo, "node_modules/.bin/turbo"),
          args: ["run", "build", "check", "lint", "--dry=json"],
          cwd: root,
          source: "stdout",
          timeout: "60 seconds",
          env: { TURBO_TELEMETRY_DISABLED: "1" },
          extendEnv: true,
        });
        expect(run.exitCode, run.output).toBe(0);
        const summary = yield* decodeSummary(run.output);
        expect(summary.turboVersion).toBe("2.11.10");
        return summary.tasks;
      });
      const baseline = yield* dry();
      const hashes = HashMap.fromIterable(A.map(baseline, (task) => [task.taskId, task.hash] as const));
      const changed = (tasks: typeof baseline) =>
        A.filter(tasks, (task) => !O.contains(HashMap.get(hashes, task.taskId), task.hash));
      const packet = "goals/verification-route/SPEC.md";
      const originalPacket = yield* fs.readFileString(path.join(root, packet));
      yield* writeFile(root, packet, `${originalPacket}\nLayer 1 packet mutation.\n`);
      const packetTasks = yield* dry();
      const packetChanges = changed(packetTasks);
      expect(A.length(A.filter(packetChanges, (task) => task.task === "build" || task.task === "check"))).toBe(0);
      yield* writeFile(root, packet, originalPacket);
      const manifestText = yield* fs.readFileString(path.join(root, "package.json"));
      const manifest = yield* S.decodeEffect(S.fromJsonString(S.Struct({ catalog: S.Record(S.String, S.String) })))(
        manifestText
      );
      // A catalog entry outside the root's own dependencies: a bump of a root dependency (Biome is a
      // root devDependency) changes turbo's root external-dependency hash and invalidates every task,
      // whatever the inputs say (research/slice-2-layer1-dryrun.md).
      const dependency = "@duckdb/node-api";
      const version = O.getOrThrow(R.get(manifest.catalog, dependency));
      const bumpedVersion = `${version}-layer1-proof`;
      yield* writeFile(
        root,
        "package.json",
        Str.replace(`"${dependency}": "${version}"`, `"${dependency}": "${bumpedVersion}"`)(manifestText)
      );
      const lock = yield* fs.readFileString(path.join(root, "bun.lock"));
      // Lockfile-only hash probe; no install and no registry or integrity claim.
      const bumpedLock = A.join(
        A.map(Str.split(lock, "\n"), (line) =>
          Str.includes(`"${dependency}`)(line) ? Str.replaceAll(version, bumpedVersion)(line) : line
        ),
        "\n"
      );
      yield* writeFile(root, "bun.lock", bumpedLock);
      const catalogTasks = yield* dry();
      const catalogChanges = changed(catalogTasks);
      const dependents = yield* Effect.forEach(
        A.filter(files, Str.endsWith("/package.json")),
        Effect.fnUntraced(function* (file) {
          const text = yield* fs.readFileString(path.join(root, file));
          const pkg = yield* S.decodeEffect(
            S.fromJsonString(
              S.Struct({
                name: S.optionalKey(S.String),
                dependencies: S.optionalKey(S.Record(S.String, S.Unknown)),
                devDependencies: S.optionalKey(S.Record(S.String, S.Unknown)),
              })
            )
          )(text);
          return pkg.name !== undefined &&
            (R.has(pkg.dependencies ?? {}, dependency) || R.has(pkg.devDependencies ?? {}, dependency))
            ? O.some(pkg.name)
            : O.none<string>();
        }),
        { concurrency: 16 }
      );
      const names = A.getSomes(dependents);
      // The dependents' own tasks change, plus tasks downstream of them through ^build; the rest of
      // the graph keeps its hash, where the raw root manifest input used to invalidate all of it.
      expect(A.every(names, (name) => A.some(catalogChanges, (task) => task.package === name))).toBe(true);
      expect(A.length(catalogChanges) * 10).toBeLessThan(A.length(baseline));
    }),
    180_000
  );
});
