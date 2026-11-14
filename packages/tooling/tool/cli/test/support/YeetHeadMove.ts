import { Git } from "@beep/git/Git";
import { runRepoCommandCapture } from "@beep/repo-cli/test/RepoRun";
import { RepoRunContext } from "@beep/repo-cli/test/Yeet";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { recordedGithub, restPullRequest } from "./YeetGithub.ts";
import type { GithubAnswer } from "./YeetGithub.ts";
export const git = Effect.fn("HeadMoveTest.git")(function* (
  root: string,
  args: ReadonlyArray<string>,
  env?: Record<string, string>
) {
  const result = yield* runRepoCommandCapture("git", args, root, env);
  expect(result.exitCode, result.output).toBe(0);
  return Str.trim(result.output);
});
const PROBE = "explorations/stacked-pr-adoption/research/";
export const FILE_A = `${PROBE}stack-probe-a.md`;
export const FILE_B = `${PROBE}stack-probe-b.md`;
const fixture = Effect.fn("HeadMoveTest.fixture")(function* (name: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = yield* path.fromFileUrl(new URL(`../fixtures/yeet-head-move/${name}`, import.meta.url));
  return yield* fs.readFileString(file);
});
export const init = Effect.fn("HeadMoveTest.init")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-head-move-" });
  yield* git(root, ["init", "--quiet", "-b", "main"]);
  yield* git(root, ["config", "user.name", "Lane Author"]);
  yield* git(root, ["config", "user.email", "lane@example.invalid"]);
  yield* git(root, ["config", "commit.gpgsign", "false"]);
  return root;
});
const committerName = (email: string): string =>
  email === "noreply@github.com" ? "GitHub" : email === "lane@example.invalid" ? "Lane Author" : "octocat";
// Write one blob into the scratch index, or drop the path when its contents are none.
const stageFile = Effect.fn("HeadMoveTest.stageFile")(function* (
  root: string,
  file: string,
  contents: O.Option<string>
) {
  if (O.isNone(contents)) return yield* git(root, ["update-index", "--force-remove", "--", file]);
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const scratch = path.join(root, "blob-input");
  yield* fs.writeFileString(scratch, contents.value);
  const blob = yield* git(root, ["hash-object", "-w", "--", scratch]);
  return yield* git(root, ["update-index", "--add", "--cacheinfo", `100644,${blob},${file}`]);
});
// Insert a gpgsig header into an unsigned commit object and store the signed copy.
const signCommit = Effect.fn("HeadMoveTest.signCommit")(function* (root: string, unsigned: string, signature: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const object = yield* git(root, ["cat-file", "commit", unsigned]);
  const signed = Str.replace("\n\n", `\ngpgsig ${signature}\n\n`)(object);
  const input = path.join(root, "commit-input");
  yield* fs.writeFileString(input, `${signed}\n`);
  return yield* git(root, ["hash-object", "-t", "commit", "-w", input]);
});
// Plumbing keeps every branch as an object, independent of the worktree/index state.
// No mutation here runs against the linked source checkout.
export const commit = Effect.fn("HeadMoveTest.commit")(function* (
  root: string,
  parents: ReadonlyArray<string>,
  files: Readonly<Record<string, O.Option<string>>>,
  message: string,
  date = "2026-11-09T20:23:48-06:00",
  email = "lane@example.invalid",
  committedAt = "2026-11-10T02:46:01Z",
  signature: O.Option<string> = email === "noreply@github.com"
    ? O.some("-----BEGIN PGP SIGNATURE-----\n fixture\n -----END PGP SIGNATURE-----")
    : O.none<string>()
) {
  const first = A.head(parents);
  yield* git(root, O.isSome(first) ? ["read-tree", first.value] : ["read-tree", "--empty"]);
  yield* Effect.forEach(R.toEntries(files), ([file, contents]) => stageFile(root, file, contents), { discard: true });
  const tree = yield* git(root, ["write-tree"]);
  const unsigned = yield* git(
    root,
    ["commit-tree", tree, ...A.flatMap(parents, (parent) => ["-p", parent]), "-m", message],
    {
      GIT_AUTHOR_NAME: "Stack Probe Author",
      GIT_AUTHOR_EMAIL: "stack-probe@users.noreply.github.com",
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_NAME: committerName(email),
      GIT_COMMITTER_EMAIL: email,
      GIT_COMMITTER_DATE: committedAt,
    }
  );
  return yield* O.match(signature, {
    onNone: () => Effect.succeed(unsigned),
    onSome: (value) => signCommit(root, unsigned, value),
  });
});
export const stack = Effect.fn("HeadMoveTest.stack")(function* () {
  const root = yield* init();
  const a = yield* fixture("stack-probe-a.md");
  const b = yield* fixture("stack-probe-b.md");
  const m1 = yield* fixture("layer-1.txt");
  const m2 = yield* fixture("layer-2.txt");
  const m3 = yield* fixture("layer-3.txt");
  const ms = yield* fixture("squash.txt");
  const main = yield* commit(root, [], { "main.md": O.some("main\n") }, "main");
  const l1 = yield* commit(root, [main], { [FILE_A]: O.some(a) }, m1, "2026-11-09T20:23:46-06:00");
  const l2 = yield* commit(root, [l1], { [FILE_B]: O.some(b) }, m2);
  const l3 = yield* commit(root, [l2], { [FILE_A]: O.none(), [FILE_B]: O.none() }, m3, "2026-11-09T20:23:49-06:00");
  const moved = yield* commit(root, [main], { "main.md": O.some("main moved\n") }, "main moving");
  const squash = yield* commit(
    root,
    [moved],
    { [FILE_A]: O.some(a) },
    ms,
    "2026-11-09T21:45:57-05:00",
    "noreply@github.com"
  );
  const c2 = yield* commit(
    root,
    [squash],
    { [FILE_B]: O.some(b) },
    m2,
    undefined,
    "12345+octocat@users.noreply.github.com"
  );
  const c3 = yield* commit(
    root,
    [c2],
    { [FILE_A]: O.none(), [FILE_B]: O.none() },
    m3,
    "2026-11-09T20:23:49-06:00",
    "12345+octocat@users.noreply.github.com"
  );
  const restackBase = yield* commit(root, [squash], { "main.md": O.some("main moved again\n") }, "main moving again");
  const r2 = yield* commit(
    root,
    [restackBase],
    { [FILE_B]: O.some(b) },
    m2,
    undefined,
    "noreply@github.com",
    "2026-11-10T02:54:18Z"
  );
  const r3 = yield* commit(
    root,
    [r2],
    { [FILE_A]: O.none(), [FILE_B]: O.none() },
    m3,
    "2026-11-09T20:23:49-06:00",
    "noreply@github.com",
    "2026-11-10T02:54:18Z"
  );
  return { root, main, l1, l2, l3, moved, squash, c2, c3, restackBase, r2, r3, a, b, m2, m3 };
});

export const rewriteWindowScenario = Effect.fn("HeadMoveTest.rewriteWindowScenario")(function* () {
  const s = yield* stack();
  const context = RepoRunContext.make({
    repoRoot: s.root,
    cwd: s.root,
    base: s.squash,
    head: s.c2,
    branch: "probe",
    originalArgv: [],
    packetDir: ".beep/yeet",
    turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
  });
  const pull = restPullRequest({
    number: 3050,
    head: { ref: "probe", sha: s.c2 },
    base: { ref: "main", sha: s.squash },
  });
  const routes: Readonly<Record<string, GithubAnswer>> = {
    "{repo}": { body: {} },
    "{repo}/pulls/3050/commits": { body: [{ commit: { message: "feat: layer" } }] },
    "{repo}/pulls/3050": { body: pull },
    "{repo}/pulls": { body: [pull] },
    "{repo}/rules/branches/main": { body: [] },
    "{repo}/issues/3050/timeline": {
      body: [
        { event: "ready_for_review", created_at: "2026-11-10T02:25:19Z" },
        { event: "head_ref_force_pushed", created_at: "2026-11-10T02:46:04Z", commit_id: s.c2 },
      ],
    },
    "{repo}/activity": {
      body: [
        { activity_type: "force_push", before: s.l2, after: s.c2, timestamp: "2026-11-10T02:46:02Z" },
        {
          activity_type: "branch_creation",
          before: Str.repeat(40)("0"),
          after: s.l2,
          timestamp: "2026-11-10T02:24:10Z",
        },
      ],
    },
  };
  const github = recordedGithub((call) => {
    const fixed = R.get(routes, call.path);
    if (O.isSome(fixed)) return fixed.value;
    if (Str.endsWith("/check-suites")(call.path))
      return {
        body: {
          check_suites: [
            { created_at: Str.includes(s.c2)(call.path) ? "2026-11-10T02:46:04Z" : "2026-11-10T02:24:10Z" },
          ],
        },
      };
    if (Str.endsWith("/check-runs")(call.path)) return { body: { check_runs: [], total_count: 0 } };
    if (Str.endsWith("/actions/runs")(call.path)) return { body: { workflow_runs: [], total_count: 0 } };
    if (Str.endsWith("/status")(call.path)) return { body: { statuses: [], total_count: 0 } };
    return undefined;
  });
  return { s, context, github, target: { prNumber: 3050, headSha: s.c2 } };
});

/** The hostile config's attributes file, inside a scratch checkout. */
const HOSTILE_ATTRIBUTES = ".git/hostile.attributes";

/**
 * Every setting here changes what an unpinned `git diff` prints. `diff.relative` is a no-op at the
 * top level and stays in to prove it; the `hostile` driver reaches every path through the
 * attributes file.
 */
export const hostileGitConfig = (root: string): ReadonlyArray<readonly [string, string]> => [
  ["color.ui", "always"],
  ["color.diff", "always"],
  ["diff.renames", "copies"],
  ["diff.relative", "true"],
  ["diff.ignoreSubmodules", "all"],
  ["diff.submodule", "log"],
  ["diff.external", "true"],
  ["diff.noprefix", "true"],
  ["diff.mnemonicPrefix", "true"],
  ["diff.context", "0"],
  ["diff.interHunkContext", "10"],
  ["diff.algorithm", "histogram"],
  ["diff.indentHeuristic", "false"],
  ["core.abbrev", "4"],
  ["core.attributesFile", `${root}/${HOSTILE_ATTRIBUTES}`],
  ["diff.hostile.textconv", "cksum <"],
  ["diff.hostile.binary", "true"],
  ["diff.hostile.algorithm", "patience"],
];

/** Route every path of a scratch checkout through the `hostile` diff driver. */
export const writeHostileGitAttributes = Effect.fn("HeadMoveTest.writeHostileGitAttributes")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.writeFileString(path.join(root, HOSTILE_ATTRIBUTES), "* diff=hostile\n");
});

/** Apply the hostile config and its attributes file to a scratch checkout. */
export const configureHostileGit = Effect.fn("HeadMoveTest.configureHostileGit")(function* (root: string) {
  yield* writeHostileGitAttributes(root);
  yield* Effect.forEach(hostileGitConfig(root), ([key, value]) => git(root, ["config", key, value]), {
    discard: true,
  });
});

// Real git subprocesses must observe the same filesystem the fixture builder writes.
export const yeetRealGitTestLayer = Layer.mergeAll(
  NodeServices.layer,
  NodeCrypto.layer,
  Git.layer.pipe(Layer.provide(NodeServices.layer))
);
