import { Git, GitCommandError } from "@beep/git/Git";
import {
  resolveShardScope,
  ShardScope,
  ShardScopeOwner,
  shardScopeIncludes,
  stageGeneratedFiles,
} from "@beep/repo-cli-kit/cli/ShardScope";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";

const json = (value: unknown): string =>
  `${Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(value), identity)}\n`;

// A scratch repository with two workspace members; `files` maps repo-relative paths to contents.
const repository = Effect.fnUntraced(function* (files: Readonly<Record<string, string>>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resolved1 = yield* fs.makeTempDirectoryScoped({ prefix: "beep-shard-scope-" });
  const root = yield* fs.realPath(resolved1);
  for (const [relative, content] of R.toEntries(files)) {
    const file = path.join(root, relative);
    yield* fs.makeDirectory(path.dirname(file), { recursive: true });
    yield* fs.writeFileString(file, content);
  }
  return root;
});

const fixtureFiles = {
  "package.json": json({ name: "@beep/root", private: true, workspaces: ["packages/*"] }),
  "packages/a/package.json": json({ name: "@beep/a" }),
  "packages/b/package.json": json({ name: "@beep/b" }),
};

// Owner by path prefix, the way a schema-first owner resolver attributes files; anything else is the root.
const ownerByPrefix = (root: string) => (absolutePath: string) =>
  Str.startsWith(`${root}/packages/a/`)(absolutePath)
    ? "@beep/a"
    : Str.startsWith(`${root}/packages/b/`)(absolutePath)
      ? "@beep/b"
      : "@beep/root";

layer(NodeServices.layer, { timeout: "30 seconds" })("resolveShardScope", (it) => {
  it.effect("dedupes and sorts owners by package name and skips paths owned by no workspace member", () =>
    Effect.gen(function* () {
      const root = yield* repository(fixtureFiles);
      const scope = yield* resolveShardScope(
        root,
        ["packages/b/src/B.ts", "packages/a/src/Gone.ts", "packages/a/src/A.ts", "scripts/root-only.ts"],
        ownerByPrefix(root)
      );
      expect(scope.owners).toEqual([
        ShardScopeOwner.make({ owner: "@beep/a", directory: "packages/a" }),
        ShardScopeOwner.make({ owner: "@beep/b", directory: "packages/b" }),
      ]);
      expect(scope.skipped).toEqual(["scripts/root-only.ts"]);
    })
  );

  it.effect("returns an empty scope for an empty path list", () =>
    Effect.gen(function* () {
      const root = yield* repository(fixtureFiles);
      const scope = yield* resolveShardScope(root, [], ownerByPrefix(root));
      expect(scope).toEqual(ShardScope.make({ owners: [], skipped: [] }));
    })
  );
});

// A `Git` whose `add` replays the scripted outcomes in order and counts its calls, so the
// index-lock retry policy is observable without a real repository.
const scriptedAdd = Effect.fn("CatalogShardScopeTest.scriptedAdd")(function* (
  outcomes: ReadonlyArray<O.Option<GitCommandError>>
) {
  const calls = yield* Ref.make(0);
  const service = Git.makeTest({
    add: () =>
      Ref.getAndUpdate(calls, (count) => count + 1).pipe(
        Effect.flatMap((index) =>
          O.match(O.flatten(A.get(outcomes, index)), { onNone: () => Effect.void, onSome: Effect.fail })
        )
      ),
  });
  return { calls, service } as const;
});

const gitFailure = (kind: "failed" | "refused", stderr: string) =>
  GitCommandError.make({ kind, args: ["add", "--", "shard"], cwd: "/repo", exitCode: 128, stderr });

const indexLocked = gitFailure("failed", "fatal: Unable to create '/repo/.git/index.lock': File exists.");

describe("stageGeneratedFiles", () => {
  it.effect(
    "does not call git for an empty path list",
    Effect.fn("CatalogShardScopeTest.stageEmpty")(function* () {
      const { calls, service } = yield* scriptedAdd([]);
      yield* stageGeneratedFiles("/repo", []).pipe(Effect.provideService(Git, service));
      const resolved2 = yield* Ref.get(calls);
      expect(resolved2).toBe(0);
    })
  );

  it.effect(
    "retries while another hook holds the index lock",
    Effect.fn("CatalogShardScopeTest.stageRetriesIndexLock")(function* () {
      const { calls, service } = yield* scriptedAdd([O.some(indexLocked), O.some(indexLocked)]);
      const fiber = yield* stageGeneratedFiles("/repo", ["shard"]).pipe(
        Effect.provideService(Git, service),
        Effect.forkChild
      );
      yield* TestClock.adjust(Duration.seconds(1));
      yield* Fiber.join(fiber);
      const resolved3 = yield* Ref.get(calls);
      expect(resolved3).toBe(3);
    })
  );

  it.effect(
    "surfaces any other git failure without retrying",
    Effect.fn("CatalogShardScopeTest.stageNoRetry")(function* () {
      const cases = [
        gitFailure("failed", "fatal: pathspec 'shard' did not match any files"),
        gitFailure("refused", indexLocked.stderr),
      ];
      for (const failure of cases) {
        const { calls, service } = yield* scriptedAdd([O.some(failure)]);
        const error = yield* stageGeneratedFiles("/repo", ["shard"]).pipe(
          Effect.provideService(Git, service),
          Effect.flip
        );
        expect(error).toBe(failure);
        const resolved4 = yield* Ref.get(calls);
        expect(resolved4).toBe(1);
      }
    })
  );
});

describe("shardScopeIncludes", () => {
  it("accepts only files whose owner is in scope, data-first and data-last", () => {
    const scope = ShardScope.make({
      owners: [ShardScopeOwner.make({ owner: "@beep/a", directory: "packages/a" })],
      skipped: [],
    });
    const ownerOf = (absolutePath: string) => (Str.includes("/packages/a/")(absolutePath) ? "@beep/a" : "@beep/b");
    const dataFirst = shardScopeIncludes(scope, ownerOf);
    const dataLast = shardScopeIncludes(ownerOf)(scope);
    for (const includes of [dataFirst, dataLast]) {
      expect(includes("/repo/packages/a/src/A.ts")).toBe(true);
      expect(includes("/repo/packages/b/src/B.ts")).toBe(false);
    }
  });
});
