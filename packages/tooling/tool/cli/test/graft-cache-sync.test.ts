import {
  GraftCacheArtifact,
  GraftCacheSync,
  GraftCacheSyncLive,
  GraftCacheSyncPlan,
  GraftCacheSyncPlanEntry,
  GraftCacheSyncReport,
  graftCommand,
} from "@beep/repo-cli/commands/Graft";
import { CommandJsonOutput } from "@beep/repo-cli/test/Cli";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { expect, layer, it as propertyTest } from "@effect/vitest";
import { Console, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as PlatformError from "effect/PlatformError";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as fc from "effect/testing/FastCheck";
import { Command } from "effect/unstable/cli";

const artifacts = [
  ".cache/summaries.json",
  "INDEX.md",
  "effects.md",
  "services.md",
  ".graph/wiring.json",
  "manifest.json",
];
const contents = [
  '{"summaries":{"file":"paid summary"}}\n',
  "# Index\n",
  "# Effects\n",
  "# Services\n",
  '{"crux":"paid crux"}\n',
  // Mirrors a real deep-layer index: per-file digests plus concept nodes whose
  // sources are nested cards the sync deliberately leaves to the structural rebuild.
  '{"version":1,"model":"test-model","repoDigest":"test-digest","files":[{"path":"src/file.ts","hash":"0a1b2c3d"}],"nodes":[{"slug":"effects","name":"Effects","type":"system","sources":["src/file.ts"]}]}\n',
];

const fixture = Effect.fn("GraftCacheSyncTest.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "graft-cache-sync-test-" });
  const source = path.join(directory, "beep-effect6");
  const target = path.join(directory, "beep-effect2");
  yield* fs.makeDirectory(path.join(source, ".git"), { recursive: true });
  yield* fs.makeDirectory(target);
  yield* fs.writeFileString(path.join(target, ".git"), "gitdir: untouched\n");
  yield* fs.writeFileString(path.join(target, "README.md"), "tracked content\n");
  yield* Effect.forEach(
    artifacts,
    Effect.fn("GraftCacheSyncTest.seed")(function* (relative, index) {
      const file = path.join(source, "graft", relative);
      yield* fs.makeDirectory(path.dirname(file), { recursive: true });
      yield* fs.writeFileString(file, contents[index] ?? "");
    })
  );
  yield* fs.makeDirectory(path.join(source, "graft", "src"));
  yield* fs.writeFileString(path.join(source, "graft", "src", "file.ts.md"), "do not seed this card\n");
  return { fs, path, directory, source, target };
});

const DeepLayerManifest = S.Struct({
  version: S.Number,
  model: S.String,
  repoDigest: S.String,
  files: S.Array(S.Struct({ path: S.String, hash: S.String })),
  nodes: S.Array(S.Struct({ slug: S.String, name: S.String, type: S.String, sources: S.Array(S.String) })),
});
const decodeManifest = S.decodeUnknownEffect(S.fromJsonString(DeepLayerManifest));

const decodePlanJson = S.decodeUnknownEffect(S.fromJsonString(GraftCacheSyncPlan));
const decodeReportJson = S.decodeUnknownEffect(S.fromJsonString(GraftCacheSyncReport));

const testLayer = GraftCacheSyncLive.pipe(Layer.provideMerge(NodeServices.layer));

const runCommand = Effect.fn("GraftCacheSyncTest.runCommand")(function* (args: ReadonlyArray<string>) {
  const current = yield* Console.Console;
  let output: ReadonlyArray<unknown> = [];
  const result = yield* Effect.result(
    Command.runWith(graftCommand, { version: "test", renderErrors: false })(args).pipe(
      Effect.provideService(Console.Console, {
        ...current,
        log: (...values: ReadonlyArray<unknown>) => {
          output = A.appendAll(output, values);
        },
      }),
      Effect.provideService(CommandJsonOutput, (text) =>
        Effect.sync(() => {
          output = A.append(output, text);
        })
      )
    )
  );
  return { result, output };
});

const assertReportRoundTrip = Effect.fn("GraftCacheSyncTest.assertReportRoundTrip")(function* (
  report: GraftCacheSyncReport
) {
  const codec = S.fromJsonString(GraftCacheSyncReport);
  const json = yield* S.encodeEffect(codec)(report);
  const decoded = yield* S.decodeEffect(codec)(json);
  // JSON omits explicitly undefined optional reasons; their values still round-trip.
  expect(decoded).toEqual(report);
});

propertyTest("round-trips arbitrary reports without losing plan entries, reasons, or counters", () =>
  fc.assert(
    fc.asyncProperty(S.toArbitrary(GraftCacheSyncReport)(fc), (report) =>
      Effect.runPromise(assertReportRoundTrip(report))
    )
  )
);

layer(testLayer)("Graft cache sync", (it) => {
  it.effect(
    "plans all four artifact families in order without creating a target graft directory",
    Effect.fn(function* () {
      const { fs, source, target, path } = yield* fixture();
      const sync = yield* GraftCacheSync;
      const plan = yield* sync.plan(source, [target, target]);
      expect(A.map(plan.entries, (entry) => entry.artifact)).toEqual([
        "summaries",
        "concepts",
        "concepts",
        "concepts",
        "wiring",
        "manifest",
      ]);
      expect(A.every(plan.entries, (entry) => entry.action === "copy")).toBe(true);
      expect(A.filter(plan.entries, (entry) => GraftCacheArtifact.is.manifest(entry.artifact))).toEqual([
        expect.objectContaining({
          artifact: "manifest",
          action: "copy",
          sourcePath: path.join(source, "graft", "manifest.json"),
          targetPath: path.join(target, "graft", "manifest.json"),
        }),
      ]);
      expect(A.map(plan.entries, (entry) => path.relative(path.join(target, "graft"), entry.targetPath))).toEqual(
        artifacts
      );
      expect(yield* fs.exists(path.join(target, "graft"))).toBe(false);
    })
  );

  it.effect(
    "plans 25 populated clones with 300 root concepts with at most 104 directory reads",
    Effect.fn(function* () {
      const { fs, source, target, path, directory } = yield* fixture();
      const targetCount = 25;
      const conceptCount = 300;
      // The shared fixture already has INDEX.md and two root concept nodes.
      yield* Effect.forEach(
        A.range(1, conceptCount - 3),
        (index) => fs.writeFileString(path.join(source, "graft", `concept-${index}.md`), "# Concept\n"),
        { concurrency: 16 }
      );
      const targets = A.prepend(
        A.map(A.range(1, targetCount - 1), (index) => path.join(directory, `clone-${index}`)),
        target
      );
      yield* Effect.forEach(
        targets,
        Effect.fn(function* (root) {
          yield* fs.makeDirectory(root, { recursive: true });
          yield* fs.writeFileString(path.join(root, ".git"), "gitdir: untouched\n");
          yield* fs.copy(path.join(source, "graft"), path.join(root, "graft"));
        }),
        { concurrency: 4 }
      );
      let directoryReads = 0;
      let realPaths = 0;
      let stats = 0;
      const countingFs = Layer.succeed(
        FileSystem.FileSystem,
        FileSystem.FileSystem.of({
          "~effect/platform/FileSystem": fs["~effect/platform/FileSystem"],
          access: fs.access,
          copy: fs.copy,
          copyFile: fs.copyFile,
          chmod: fs.chmod,
          chown: fs.chown,
          glob: fs.glob,
          exists: fs.exists,
          link: fs.link,
          makeDirectory: fs.makeDirectory,
          makeTempDirectory: fs.makeTempDirectory,
          makeTempDirectoryScoped: fs.makeTempDirectoryScoped,
          makeTempFile: fs.makeTempFile,
          makeTempFileScoped: fs.makeTempFileScoped,
          open: fs.open,
          readDirectory: Effect.fnUntraced(function* (name, options) {
            directoryReads += 1;
            return yield* fs.readDirectory(name, options);
          }),
          readFile: fs.readFile,
          readFileString: fs.readFileString,
          readLink: fs.readLink,
          realPath: Effect.fnUntraced(function* (name) {
            realPaths += 1;
            return yield* fs.realPath(name);
          }),
          remove: fs.remove,
          rename: fs.rename,
          sink: fs.sink,
          stat: Effect.fnUntraced(function* (name) {
            stats += 1;
            return yield* fs.stat(name);
          }),
          stream: fs.stream,
          symlink: fs.symlink,
          truncate: fs.truncate,
          utimes: fs.utimes,
          watch: fs.watch,
          writeFile: fs.writeFile,
          writeFileString: fs.writeFileString,
        })
      );
      const plan = yield* GraftCacheSync.use((sync) => sync.plan(source, targets)).pipe(
        provideScopedLayer(Layer.fresh(GraftCacheSyncLive).pipe(Layer.provide(countingFs)))
      );
      expect(plan.entries).toHaveLength(targetCount * (conceptCount + 3));
      expect(A.every(plan.entries, (entry) => entry.action === "copy")).toBe(true);
      // Exactly root, graft, .cache and .graph once per clone, including source.
      expect(directoryReads).toBe((targetCount + 1) * 4); // 104, independent of entry count.
      // Each artifact and its three parents once, plus each clone's root/.git probe.
      expect(realPaths).toBe((targetCount + 1) * (conceptCount + 7));
      expect(stats).toBe(realPaths);
    }),
    15_000
  );

  it.effect(
    "fails with GraftCacheSourceError when a source artifact directory cannot be listed",
    Effect.fn(function* () {
      const { fs, source, target, path } = yield* fixture();
      const graph = path.join(source, "graft", ".graph");
      yield* fs.chmod(graph, 0o000);
      const sync = yield* GraftCacheSync;
      const failure = yield* Effect.flip(sync.plan(source, [target])).pipe(
        Effect.ensuring(Effect.orDie(fs.chmod(graph, 0o755)))
      );
      expect(failure._tag).toBe("GraftCacheSourceError");
      expect(Str.includes(graph)(failure.path)).toBe(true);
    })
  );

  it.effect(
    "refuses every artifact of a target whose graft directory cannot be listed",
    Effect.fn(function* () {
      const { fs, source, target, path } = yield* fixture();
      const graft = path.join(target, "graft");
      yield* fs.makeDirectory(graft);
      yield* fs.chmod(graft, 0o000);
      const sync = yield* GraftCacheSync;
      // The first artifact records the listing failure; the rest replay it.
      const plan = yield* sync.plan(source, [target]).pipe(Effect.ensuring(Effect.orDie(fs.chmod(graft, 0o755))));
      expect(plan.entries).toHaveLength(artifacts.length);
      expect(A.every(plan.entries, (entry) => entry.action === "refuse")).toBe(true);
      expect(A.every(plan.entries, (entry) => Str.includes(graft)(entry.reason ?? ""))).toBe(true);
    })
  );

  it.effect(
    "keeps the copied manifest a usable deep-layer index while nested cards stay with the structural rebuild",
    Effect.fn(function* () {
      const { fs, source, target, path } = yield* fixture();
      const sync = yield* GraftCacheSync;
      yield* sync.apply(yield* sync.plan(source, [target]));
      const manifest = yield* decodeManifest(yield* fs.readFileString(path.join(target, "graft", "manifest.json")));
      expect(manifest.files).toHaveLength(1);
      expect(manifest.nodes).toHaveLength(1);
      const node = manifest.nodes[0];
      expect(node?.sources).toEqual(["src/file.ts"]);
      // The root concept card the node stands for travelled with the manifest.
      expect(yield* fs.exists(path.join(target, "graft", `${node?.slug}.md`))).toBe(true);
      // Its nested per-file card is regenerated by the target's own `graft build`, never copied.
      expect(yield* fs.exists(path.join(target, "graft", "src", "file.ts.md"))).toBe(false);
      expect(manifest.files[0]?.path).toBe("src/file.ts");
    })
  );

  it.effect(
    "deduplicates a canonical target and its symlink alias without changing entry order",
    Effect.fn(function* () {
      const { fs, source, target, path, directory } = yield* fixture();
      yield* fs.makeDirectory(path.join(target, "graft"));
      yield* fs.writeFileString(path.join(target, "graft", "stale.md"), "# Stale\n");
      const alias = path.join(directory, "target-alias");
      yield* fs.symlink(target, alias);
      const sync = yield* GraftCacheSync;
      const single = yield* sync.plan(source, [target]);
      expect(single.entries).toHaveLength(artifacts.length + 1);
      expect((yield* sync.plan(source, [target, alias])).entries).toEqual(single.entries);
      expect((yield* sync.plan(source, [alias, target])).entries).toEqual(single.entries);
    })
  );

  it.effect(
    "reports missing INDEX, wiring, and manifest while retaining other concept nodes",
    Effect.fn(function* () {
      const { fs, source, target, path } = yield* fixture();
      yield* fs.remove(path.join(source, "graft", "INDEX.md"));
      yield* fs.remove(path.join(source, "graft", ".graph"), { recursive: true });
      yield* fs.remove(path.join(source, "graft", "manifest.json"));
      const sync = yield* GraftCacheSync;
      const report = yield* sync.apply(yield* sync.plan(source, [target]));
      expect(report.skipped).toBe(3);
      expect(report.copied).toBe(3);
      expect(
        A.map(
          A.filter(report.plan.entries, (entry) => entry.action === "skip-missing-source"),
          (entry) => entry.artifact
        )
      ).toEqual(["concepts", "wiring", "manifest"]);
      expect(A.filter(report.plan.entries, (entry) => GraftCacheArtifact.is.manifest(entry.artifact))).toEqual([
        expect.objectContaining({
          artifact: "manifest",
          action: "skip-missing-source",
          reason: "Source artifact is missing.",
        }),
      ]);
      expect(yield* fs.exists(path.join(target, "graft", ".graph"))).toBe(false);
      expect(yield* fs.exists(path.join(target, "graft", "manifest.json"))).toBe(false);
    })
  );

  it.effect(
    "fails when the source has no summaries cache or git marker",
    Effect.fn(function* () {
      const { fs, source, target, path } = yield* fixture();
      const sync = yield* GraftCacheSync;
      yield* fs.remove(path.join(source, "graft", ".cache", "summaries.json"));
      const missingTier = yield* Effect.flip(sync.plan(source, [target]));
      expect(missingTier._tag).toBe("GraftCacheSourceError");
      yield* fs.remove(path.join(source, ".git"), { recursive: true });
      expect((yield* Effect.flip(sync.plan(source, [target])))._tag).toBe("GraftCacheSourceError");
    })
  );

  it.effect(
    "refuses non-git targets and never creates their graft directory",
    Effect.fn(function* () {
      const { fs, source, target, path } = yield* fixture();
      yield* fs.remove(path.join(target, ".git"));
      const sync = yield* GraftCacheSync;
      const plan = yield* sync.plan(source, [target]);
      expect(A.every(plan.entries, (entry) => entry.action === "refuse")).toBe(true);
      expect((yield* Effect.flip(sync.apply(plan)))._tag).toBe("GraftCacheTargetError");
      expect(yield* fs.exists(path.join(target, "graft"))).toBe(false);
    })
  );

  it.effect(
    "refuses the source itself, aliases, and overlapping clone roots in both directions",
    Effect.fn(function* () {
      const { fs, source, path, directory } = yield* fixture();
      const nested = path.join(source, "nested");
      const alias = path.join(directory, "alias");
      yield* fs.makeDirectory(path.join(nested, ".git"), { recursive: true });
      yield* fs.makeDirectory(path.join(directory, ".git"));
      yield* fs.symlink(source, alias);
      const sync = yield* GraftCacheSync;
      const plan = yield* sync.plan(source, [source, alias, nested, directory]);
      expect(A.every(plan.entries, (entry) => entry.action === "refuse")).toBe(true);
      expect((yield* Effect.flip(sync.apply(plan)))._tag).toBe("GraftCacheTargetError");
    })
  );

  it.effect(
    "discovers only matching sibling directories containing .git and excludes source aliases",
    Effect.fn(function* () {
      const { fs, source, target, path, directory } = yield* fixture();
      const matching = path.join(directory, "beep-effect-extra");
      yield* fs.makeDirectory(path.join(matching, ".git"), { recursive: true });
      yield* fs.makeDirectory(path.join(directory, "beep-effect-no-git"));
      yield* fs.makeDirectory(path.join(directory, "unrelated", ".git"), { recursive: true });
      yield* fs.writeFileString(path.join(directory, "beep-effect-file"), "not a directory");
      yield* fs.symlink(source, path.join(directory, "beep-effect-alias"));
      const sync = yield* GraftCacheSync;
      expect(yield* sync.discoverSiblings(source)).toEqual([matching, target]);
    })
  );

  it.effect(
    "copies exact bytes with sibling-temp atomic replacement and preserves clone files and cards",
    Effect.fn(function* () {
      const { fs, source, target, path } = yield* fixture();
      yield* fs.makeDirectory(path.join(target, "graft", "src"), { recursive: true });
      yield* fs.writeFileString(path.join(target, "graft", "src", "existing.md"), "target card\n");
      yield* fs.writeFileString(path.join(target, "graft", "INDEX.md"), "old index\n");
      yield* fs.writeFileString(path.join(target, "graft", "manifest.json"), "old manifest\n");
      const binary = new Uint8Array([0, 255, 1, 128, 10]);
      yield* fs.writeFile(path.join(source, "graft", ".graph", "wiring.json"), binary);
      let renames = 0;
      const observedFs = FileSystem.FileSystem.of({
        ...fs,
        rename: Effect.fn("GraftCacheSyncTest.rename")(function* (temporary, destination) {
          expect(path.dirname(temporary)).toBe(path.dirname(destination));
          expect(Str.startsWith(".graft-cache-sync-")(path.basename(temporary))).toBe(true);
          if (path.basename(destination) === "INDEX.md") {
            expect(yield* fs.readFileString(destination)).toBe("old index\n");
          }
          if (Eq.equals(path.basename(destination), "manifest.json")) {
            expect(yield* fs.readFileString(destination)).toBe("old manifest\n");
          }
          expect(yield* fs.readFile(temporary)).toEqual(
            yield* fs.readFile(path.join(source, path.relative(target, destination)))
          );
          renames += 1;
          yield* fs.rename(temporary, destination);
        }),
      });
      const report = yield* GraftCacheSync.use(
        Effect.fn(function* (sync) {
          return yield* sync.apply(yield* sync.plan(source, [target]));
        })
      ).pipe(
        provideScopedLayer(Layer.fresh(GraftCacheSyncLive)),
        Effect.provideService(FileSystem.FileSystem, observedFs)
      );
      expect(report.copied).toBe(6);
      expect(report.skipped).toBe(0);
      expect(report.refused).toBe(0);
      expect(renames).toBe(6);
      let total = 0;
      for (const relative of artifacts) {
        const bytes = yield* fs.readFile(path.join(source, "graft", relative));
        expect(yield* fs.readFile(path.join(target, "graft", relative))).toEqual(bytes);
        total += bytes.byteLength;
      }
      expect(report.bytes).toBe(total);
      const files = yield* fs.readDirectory(path.join(target, "graft"), { recursive: true });
      expect(A.some(files, Str.includes(".tmp"))).toBe(false);
      expect(yield* fs.exists(path.join(target, "graft", "src", "file.ts.md"))).toBe(false);
      expect(yield* fs.readFileString(path.join(target, "graft", "src", "existing.md"))).toBe("target card\n");
      expect(yield* fs.readFileString(path.join(target, ".git"))).toBe("gitdir: untouched\n");
      expect(yield* fs.readFileString(path.join(target, "README.md"))).toBe("tracked content\n");
    })
  );

  it.effect(
    "cleans up a failed atomic replacement and preserves the previous destination",
    Effect.fn(function* () {
      const { fs, source, target, path } = yield* fixture();
      yield* fs.makeDirectory(path.join(target, "graft", ".cache"), { recursive: true });
      const destination = path.join(target, "graft", ".cache", "summaries.json");
      yield* fs.writeFileString(destination, "previous summaries\n");
      const failingFs = FileSystem.FileSystem.of({
        ...fs,
        rename: Effect.fn("GraftCacheSyncTest.failedRename")(() =>
          Effect.fail(
            PlatformError.badArgument({
              module: "FileSystem",
              method: "rename",
              description: "injected rename failure",
            })
          )
        ),
      });
      const failure = yield* GraftCacheSync.use(
        Effect.fn(function* (sync) {
          return yield* Effect.flip(sync.apply(yield* sync.plan(source, [target])));
        })
      ).pipe(
        provideScopedLayer(Layer.fresh(GraftCacheSyncLive)),
        Effect.provideService(FileSystem.FileSystem, failingFs)
      );
      expect(failure._tag).toBe("GraftCacheIoError");
      expect(yield* fs.readFileString(destination)).toBe("previous summaries\n");
      expect(yield* fs.readDirectory(path.dirname(destination))).toEqual(["summaries.json"]);
      expect(yield* fs.readFileString(path.join(source, "graft", ".cache", "summaries.json"))).toBe(contents[0]);
    })
  );

  it.effect(
    "refuses symlinked graft directories and does not write into another clone",
    Effect.fn(function* () {
      const { fs, source, target, path } = yield* fixture();
      yield* fs.symlink(path.join(source, "graft"), path.join(target, "graft"));
      const sync = yield* GraftCacheSync;
      const plan = yield* sync.plan(source, [target]);
      expect(A.every(plan.entries, (entry) => entry.action === "refuse")).toBe(true);
      expect((yield* Effect.flip(sync.apply(plan)))._tag).toBe("GraftCacheTargetError");
    })
  );

  it.effect(
    "refuses dangling and internal symlinks in artifact parents and leaf files",
    Effect.fn(function* () {
      const { fs, source, target, path } = yield* fixture();
      yield* fs.makeDirectory(path.join(target, "graft"));
      yield* fs.symlink(path.join(target, "missing"), path.join(target, "graft", ".cache"));
      yield* fs.symlink(path.join(target, "README.md"), path.join(target, "graft", "INDEX.md"));
      yield* fs.symlink(path.join(target, "README.md"), path.join(target, "graft", "manifest.json"));
      const sync = yield* GraftCacheSync;
      const plan = yield* sync.plan(source, [target]);
      expect(
        A.map(
          A.filter(plan.entries, (entry) => entry.action === "refuse"),
          (entry) => entry.artifact
        )
      ).toEqual(["summaries", "concepts", "manifest"]);
      expect((yield* Effect.flip(sync.apply(plan)))._tag).toBe("GraftCacheTargetError");
      expect(yield* fs.readFileString(path.join(target, "README.md"))).toBe("tracked content\n");
      expect(yield* fs.exists(path.join(target, "missing"))).toBe(false);
    })
  );

  it.effect(
    "rejects stale and forged plans before writing any files",
    Effect.fn(function* () {
      const { fs, source, target, path } = yield* fixture();
      const sync = yield* GraftCacheSync;
      const plan = yield* sync.plan(source, [target]);
      const forged = GraftCacheSyncPlan.make({
        ...plan,
        entries: A.map(plan.entries, (entry) =>
          GraftCacheSyncPlanEntry.make({ ...entry, targetPath: path.join(target, "README.md") })
        ),
      });
      expect((yield* Effect.flip(sync.apply(forged)))._tag).toBe("GraftCacheTargetError");
      yield* fs.symlink(path.join(source, "graft"), path.join(target, "graft"));
      expect((yield* Effect.flip(sync.apply(plan)))._tag).toBe("GraftCacheTargetError");
      expect(yield* fs.readFileString(path.join(target, "README.md"))).toBe("tracked content\n");
    })
  );

  it.effect(
    "accepts repeated --to flags, emits schema JSON, and makes dry run read-only",
    Effect.fn(function* () {
      const { fs, source, target, path, directory } = yield* fixture();
      const other = path.join(directory, "beep-effect3");
      yield* fs.makeDirectory(path.join(other, ".git"), { recursive: true });
      const preview = yield* runCommand([
        "cache",
        "sync",
        "--from",
        source,
        "--to",
        target,
        "--to",
        other,
        "--dry-run",
        "--json",
      ]);
      expect(Result.isSuccess(preview.result)).toBe(true);
      expect(preview.output).toHaveLength(1);
      const plan = yield* decodePlanJson(preview.output[0]);
      expect(plan.entries).toHaveLength(12);
      expect(yield* fs.exists(path.join(target, "graft"))).toBe(false);
      expect(yield* fs.exists(path.join(other, "graft"))).toBe(false);
      const applied = yield* runCommand(["cache", "sync", "--from", source, "--siblings", "--json"]);
      expect(Result.isSuccess(applied.result)).toBe(true);
      const report = yield* decodeReportJson(applied.output[0]);
      expect(report.copied).toBe(12);
      expect(A.filter(report.plan.entries, (entry) => GraftCacheArtifact.is.manifest(entry.artifact))).toHaveLength(2);
    })
  );

  it.effect(
    "renders manifest copies and totals in the human-readable report",
    Effect.fn(function* () {
      const { source, target, path } = yield* fixture();
      const applied = yield* runCommand(["cache", "sync", "--from", source, "--to", target]);
      expect(Result.isSuccess(applied.result)).toBe(true);
      expect(applied.output).toHaveLength(1);
      expect(applied.output[0]).toEqual(
        expect.stringContaining(`copy manifest ${path.join(target, "graft", "manifest.json")}`)
      );
      expect(applied.output[0]).toEqual(
        expect.stringContaining("Copied: 6; removed: 0; skipped: 0; refused: 0; bytes:")
      );
    })
  );

  it.effect(
    "fails conflicting or absent destination flags and prints refusals before failure",
    Effect.fn(function* () {
      const { fs, source, target, path } = yield* fixture();
      const both = yield* runCommand(["cache", "sync", "--from", source, "--to", target, "--siblings"]);
      const neither = yield* runCommand(["cache", "sync", "--from", source]);
      expect(Result.isFailure(both.result)).toBe(true);
      expect(Result.isFailure(neither.result)).toBe(true);
      yield* fs.remove(path.join(target, ".git"));
      const refused = yield* runCommand(["cache", "sync", "--from", source, "--to", target, "--json"]);
      expect(Result.isFailure(refused.result)).toBe(true);
      const refusedPlan = yield* decodePlanJson(refused.output[0]);
      expect(A.length(A.filter(refusedPlan.entries, (entry) => entry.action === "refuse"))).toBe(6);
      expect(yield* fs.exists(path.join(target, "graft"))).toBe(false);
    })
  );

  it.effect(
    "removes root concept nodes the source no longer has and leaves cards alone",
    Effect.fn(function* () {
      const { fs, source, target, path } = yield* fixture();
      yield* fs.makeDirectory(path.join(target, "graft", "src"), { recursive: true });
      yield* fs.writeFileString(path.join(target, "graft", "stale.md"), "# Stale\n");
      yield* fs.writeFileString(path.join(target, "graft", "src", "file.ts.md"), "target card\n");
      const sync = yield* GraftCacheSync;
      const plan = yield* sync.plan(source, [target]);
      const removals = A.filter(plan.entries, (entry) => entry.action === "remove");
      expect(A.map(removals, (entry) => entry.targetPath)).toEqual([path.join(target, "graft", "stale.md")]);
      const report = yield* sync.apply(plan);
      expect(report.removed).toBe(1);
      expect(yield* fs.exists(path.join(target, "graft", "stale.md"))).toBe(false);
      expect(yield* fs.readFileString(path.join(target, "graft", "src", "file.ts.md"))).toBe("target card\n");
      expect(yield* fs.readFileString(path.join(target, "graft", "effects.md"))).toBe("# Effects\n");
    })
  );

  it.effect(
    "skips dangling sibling links instead of aborting discovery",
    Effect.fn(function* () {
      const { fs, source, target, path, directory } = yield* fixture();
      yield* fs.symlink(path.join(directory, "nowhere"), path.join(directory, "beep-effect9"));
      yield* fs.writeFileString(path.join(directory, "beep-effect-notes.md"), "not a clone\n");
      const sync = yield* GraftCacheSync;
      expect(yield* sync.discoverSiblings(source)).toEqual([target]);
    })
  );

  it.effect(
    "prints usage for the bare graft and cache commands",
    Effect.fn(function* () {
      const root = yield* runCommand([]);
      const cache = yield* runCommand(["cache"]);
      expect(Result.isSuccess(root.result)).toBe(true);
      expect(Result.isSuccess(cache.result)).toBe(true);
      expect(A.some(root.output, (line) => Str.includes("cache sync")(String(line)))).toBe(true);
      expect(A.some(cache.output, (line) => Str.includes("--siblings")(String(line)))).toBe(true);
    })
  );
});
