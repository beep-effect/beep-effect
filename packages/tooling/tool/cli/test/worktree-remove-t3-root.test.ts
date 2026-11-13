import { Git } from "@beep/git/Git";
import {
  T3_WORKTREES_RELATIVE_ROOT,
  WorktreeRemovalRequest,
  WorktreeRemovalService,
  WorktreeRemovalServiceLive,
  worktreeCommand,
} from "@beep/repo-cli/commands/Worktree";
import {
  ConfiguredFleetRoots,
  FleetRootEntry,
  worktreeRemovalCandidates,
  worktreeRemovalRoots,
} from "@beep/repo-cli/test/Worktree";
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

// T3 Code adds each lane as a linked worktree at `<home>/.t3/worktrees/<clone name>/<lane>`.
// The removal fence admits such a lane only when it is registered to the same clone;
// a stray directory there, a lane of another clone, or the clone itself still refuses.

const gitLayer = Git.layer.pipe(Layer.provide(NodeServices.layer));
const platformLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer);
const testLayer = Layer.mergeAll(
  platformLayer,
  TestConsole.layer,
  WorktreeRemovalServiceLive.pipe(Layer.provide(platformLayer))
);

const FENCE_REFUSAL = "Removal target must be an exact registered worktree";

const runGitText = Effect.fn("WorktreeRemoveT3RootTest.runGitText")(function* (
  cwd: string,
  args: ReadonlyArray<string>
) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "inherit",
  });
  const output = yield* handle.stdout.pipe(Stream.decodeText(), Stream.mkString);
  const exitCode = yield* handle.exitCode;
  expect(exitCode).toBe(0);
  return Str.trim(output);
});

// A clone named `main` whose only commit is on origin/main, so archive mode has
// nothing to preserve.
const makeClone = Effect.fn("WorktreeRemoveT3RootTest.makeClone")(function* (tmp: string, name: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const clone = path.join(tmp, name);
  const origin = path.join(tmp, `${name}-origin.git`);
  yield* fs.makeDirectory(clone, { recursive: true });
  yield* fs.makeDirectory(origin, { recursive: true });
  yield* runGitText(origin, ["init", "--bare", "-b", "main"]);
  yield* runGitText(clone, ["init", "-b", "main"]);
  yield* Effect.forEach([origin, clone], (root) =>
    Effect.forEach(
      [
        ["config", "user.email", "worktree-remove-t3-root-test@example.com"],
        ["config", "user.name", "Worktree Remove T3 Root Test"],
        ["config", "commit.gpgsign", "false"],
      ],
      (args) => runGitText(root, args)
    )
  );
  yield* fs.writeFileString(path.join(clone, "README.md"), "# scratch\n");
  yield* runGitText(clone, ["add", "README.md"]);
  yield* runGitText(clone, ["commit", "-m", "init"]);
  yield* runGitText(clone, ["remote", "add", "origin", origin]);
  yield* runGitText(clone, ["push", "--set-upstream", "origin", "main"]);
  return clone;
});

const withFixture = Effect.fnUntraced(function* <A, E, R>(
  use: (fixture: {
    readonly tmp: string;
    readonly repoRoot: string;
    readonly t3Root: string;
    readonly env: Record<string, string>;
  }) => Effect.Effect<A, E, R>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const scratch = yield* fs.makeTempDirectoryScoped({ prefix: "worktree-remove-t3-root-test-" });
  const tmp = yield* fs.realPath(scratch);
  const repoRoot = yield* makeClone(tmp, "main");
  const t3Root = path.join(tmp, T3_WORKTREES_RELATIVE_ROOT, "main");
  yield* fs.makeDirectory(t3Root, { recursive: true });
  const env = { HOME: tmp, BEEP_WORKTREE_RESIDUE_ROOT: path.join(tmp, "test-residue") };
  return yield* use({ tmp, repoRoot, t3Root, env }).pipe(
    Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }))
  );
});

// Point the `process.cwd` override the command resolves its clone from at
// `cwd` until the test's scope closes.
const overrideCwd = Effect.fnUntraced(function* (cwd: string) {
  const previous = process.cwd;
  process.cwd = () => cwd;
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      process.cwd = previous;
    })
  );
});

const removeRequest = (repoRoot: string, name: string, targetPath: string) =>
  WorktreeRemovalRequest.make({
    name,
    targetPath,
    mainCheckout: repoRoot,
    branch: O.none(),
    archive: true,
    deleteBranch: false,
    expectedHead: O.none(),
  });

const refusal = Effect.fn("WorktreeRemoveT3RootTest.refusal")(function* (request: WorktreeRemovalRequest) {
  const service = yield* WorktreeRemovalService;
  const error = yield* Effect.flip(service.remove(request));
  return error.message;
});

describe("worktree removal roots", () => {
  it.layer(Path.layer)((it) => {
    it.effect("lists managed, nested and T3 roots, then fleet roots with their prefixes", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const configured = ConfiguredFleetRoots.make({
          source: "file",
          roots: [
            FleetRootEntry.make({ path: "/p", namePrefix: "beep-effect" }),
            FleetRootEntry.make({ path: "/home/u/.t3/worktrees/beep-effect" }),
          ],
        });
        const roots = worktreeRemovalRoots({
          path,
          mainCheckout: "/p/beep-effect",
          home: O.some("/home/u"),
          configured: O.some(configured),
        });
        deepStrictEqual(
          A.map(roots, (root) => [root.kind, root.path, root.namePrefix ?? ""]),
          [
            ["managed", "/p/beep-effect-worktrees", ""],
            ["nested", "/p/beep-effect/.claude/worktrees", ""],
            ["t3", "/home/u/.t3/worktrees/beep-effect", ""],
            ["fleet", "/p", "beep-effect"],
          ]
        );
        deepStrictEqual(
          A.map(worktreeRemovalCandidates({ path, roots, name: "lane" }), (candidate) => candidate.target),
          [
            "/p/beep-effect-worktrees/lane",
            "/p/beep-effect/.claude/worktrees/lane",
            "/home/u/.t3/worktrees/beep-effect/lane",
          ]
        );
        const relativeHome = worktreeRemovalRoots({
          path,
          mainCheckout: "/p/beep-effect",
          home: O.some("~"),
          configured: O.none(),
        });
        deepStrictEqual(
          A.map(relativeHome, (root) => root.kind),
          ["managed", "nested"]
        );
      })
    );
  });
});

describe("worktree remove under the T3 root", { concurrent: false }, () => {
  it.layer(testLayer, { timeout: "60 seconds" })((it) => {
    it.effect("retires a registered T3 lane by name and deletes its branch", () =>
      withFixture(({ repoRoot, t3Root }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const lane = path.join(t3Root, "lane");
          yield* runGitText(repoRoot, ["worktree", "add", "-b", "t3/lane", lane]);
          yield* overrideCwd(repoRoot);
          yield* Command.runWith(worktreeCommand, { version: "0.0.0" })([
            "remove",
            "lane",
            "--archive",
            "--delete-branch",
          ]);
          const exists = yield* fs.exists(lane);
          expect(exists).toBe(false);
          const branches = yield* runGitText(repoRoot, ["branch", "--list", "t3/lane"]);
          expect(branches).toBe("");
        })
      )
    );

    it.effect("refuses a directory under the T3 root that is not a registered worktree", () =>
      withFixture(({ repoRoot, t3Root }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const ghost = path.join(t3Root, "ghost");
          yield* fs.makeDirectory(ghost);
          yield* fs.writeFileString(path.join(ghost, "keep.txt"), "kept\n");
          const message = yield* refusal(removeRequest(repoRoot, "ghost", ghost));
          expect(message).toContain(FENCE_REFUSAL);
          const kept = yield* fs.exists(path.join(ghost, "keep.txt"));
          expect(kept).toBe(true);
        })
      )
    );

    it.effect("refuses a lane under the T3 root that belongs to a different Git common directory", () =>
      withFixture(({ tmp, repoRoot, t3Root }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const other = yield* makeClone(path.join(tmp, "elsewhere"), "main");
          const foreign = path.join(t3Root, "foreign");
          yield* runGitText(other, ["worktree", "add", "-b", "t3/foreign", foreign]);
          const message = yield* refusal(removeRequest(repoRoot, "foreign", foreign));
          expect(message).toContain(FENCE_REFUSAL);
          const exists = yield* fs.exists(foreign);
          expect(exists).toBe(true);
          const listed = yield* runGitText(other, ["worktree", "list", "--porcelain"]);
          expect(listed).toContain(foreign);
        })
      )
    );

    it.effect("refuses the clone itself when a configured fleet root contains it", () =>
      withFixture(({ tmp, repoRoot, env }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const message = yield* refusal(removeRequest(repoRoot, "main", repoRoot)).pipe(
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromEnv({ env: { ...env, BEEP_FLEET_ROOTS: tmp } })
            )
          );
          expect(message).toContain(FENCE_REFUSAL);
          const exists = yield* fs.exists(repoRoot);
          expect(exists).toBe(true);
        })
      )
    );
  });
});
