import {
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
import * as PlatformError from "effect/PlatformError";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as fc from "effect/testing/FastCheck";
import { Command } from "effect/unstable/cli";

const artifacts = [".cache/summaries.json", "INDEX.md", "effects.md", "services.md", ".graph/wiring.json"];
const contents = [
  '{"summaries":{"file":"paid summary"}}\n',
  "# Index\n",
  "# Effects\n",
  "# Services\n",
  '{"crux":"paid crux"}\n',
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
    "plans all three artifact families in order without creating a target graft directory",
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
      ]);
      expect(A.every(plan.entries, (entry) => entry.action === "copy")).toBe(true);
      expect(A.map(plan.entries, (entry) => path.relative(path.join(target, "graft"), entry.targetPath))).toEqual(
        artifacts
      );
      expect(yield* fs.exists(path.join(target, "graft"))).toBe(false);
    })
  );

  it.effect(
    "reports missing INDEX and wiring while retaining other concept nodes",
    Effect.fn(function* () {
      const { fs, source, target, path } = yield* fixture();
      yield* fs.remove(path.join(source, "graft", "INDEX.md"));
      yield* fs.remove(path.join(source, "graft", ".graph"), { recursive: true });
      const sync = yield* GraftCacheSync;
      const report = yield* sync.apply(yield* sync.plan(source, [target]));
      expect(report.skipped).toBe(2);
      expect(report.copied).toBe(3);
      expect(
        A.map(
          A.filter(report.plan.entries, (entry) => entry.action === "skip-missing-source"),
          (entry) => entry.artifact
        )
      ).toEqual(["concepts", "wiring"]);
      expect(yield* fs.exists(path.join(target, "graft", ".graph"))).toBe(false);
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
      expect(report.copied).toBe(5);
      expect(report.skipped).toBe(0);
      expect(report.refused).toBe(0);
      expect(renames).toBe(5);
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
      const sync = yield* GraftCacheSync;
      const plan = yield* sync.plan(source, [target]);
      expect(
        A.map(
          A.filter(plan.entries, (entry) => entry.action === "refuse"),
          (entry) => entry.artifact
        )
      ).toEqual(["summaries", "concepts"]);
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
      expect(plan.entries).toHaveLength(10);
      expect(yield* fs.exists(path.join(target, "graft"))).toBe(false);
      expect(yield* fs.exists(path.join(other, "graft"))).toBe(false);
      const applied = yield* runCommand(["cache", "sync", "--from", source, "--siblings", "--json"]);
      expect(Result.isSuccess(applied.result)).toBe(true);
      expect((yield* decodeReportJson(applied.output[0])).copied).toBe(10);
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
      expect(A.length(A.filter(refusedPlan.entries, (entry) => entry.action === "refuse"))).toBe(5);
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
});
