/**
 * W7c differential: the Worktree group's git and gh sites on `@beep/git` and `@beep/github`, against the bodies
 * they replace.
 *
 * W7c of `goals/repo-cli-gh-git-consolidation` moves the census rows W1-W34 (`research/w7-site-census-2026-11-03.md`)
 * off the generic runners: the removal service's preservation probes, archive ref, residue patch, removal, prune,
 * branch CAS delete and merge-driver config; the `worktree new` / `doctor` steps; the reap classifier's probes and
 * `gh pr list` reads; and the residue terminal-lane facts (SPEC D-20). The pre-W7 bodies are frozen under
 * `ops/frozen-w7c/`, from the lane base 8602b24203, with the generic runners inlined (`GitRunners.old.ts`) because the
 * retirement step deletes them.
 *
 * Every git scenario builds real scratch repositories (a bare origin, a clone with linked, dirty, detached and
 * submodule worktrees, a pruned upstream, a dangling `origin/HEAD`, a non-repository) and runs the frozen body and the
 * shipped kit route on the same state. The shipped route is the exact member call and error fold the site now runs
 * (private site code is mirrored line for line; the exported entry points run as shipped). The gh scenarios serve
 * one fixture pull-request table to both sides: the frozen `gh pr list` bodies through a scripted `gh` that applies
 * `--state` and `--limit` the way the CLI does, the shipped bodies through a `fetch` that answers the REST route.
 *
 * Outcomes are projected onto what the caller reads. A preservation error is compared on its tag, step, path and
 * failure message up to ` Command:` (the command line after it names the argv that ran, which is the kit's argv
 * now); a command error on its tag, message and exit code. A difference is classified (an intended shift named in
 * D-20, with this scenario as its witness) or unclassified. The gate is zero unclassified.
 *
 * Usage (from the repo root):
 *
 *   bun goals/repo-cli-gh-git-consolidation/ops/worktree-differential-w7.ts [--out <report.json>]
 *
 * Exit code 1 when any gate fails.
 */
import * as NodeURL from "node:url";
import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { NodeCrypto, NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { WorktreeReapPullRequest } from "../../../packages/tooling/tool/cli/src/commands/Worktree/Reap.service.ts";
import { WorktreePreservationError } from "../../../packages/tooling/tool/cli/src/commands/Worktree/Worktree.errors.ts";
import {
  branchPullRequests,
  mergedPullRequestsForBranch,
  worktreeGitErrorAdapter,
} from "../../../packages/tooling/tool/cli/src/commands/Worktree/Worktree.service.ts";
import { GithubTransportFetch } from "../../../packages/tooling/tool/cli/src/internal/github/GithubIdentity.ts";
import { adaptGitKitError, patientGit } from "../../../packages/tooling/tool/cli/src/internal/repo-run/index.ts";
import { runRepoCommandCapture } from "../../../packages/tooling/tool/cli/src/internal/repo-run/RepoRun.executor.ts";
import * as OldReap from "./frozen-w7c/Reap.old.ts";
import * as OldLane from "./frozen-w7c/ResidueTerminalLaneLive.old.ts";
import * as OldCommand from "./frozen-w7c/WorktreeCommand.old.ts";
import * as Old from "./frozen-w7c/WorktreeService.old.ts";
import type { GitInvocation } from "@beep/git/GitCommand";
import type { GitKitError } from "../../../packages/tooling/tool/cli/src/internal/repo-run/index.ts";

const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));
const argv = process.argv.slice(2);
const outFlag = A.findFirstIndex(argv, (arg) => arg === "--out");

// --- the shipped kit routes, mirrored from the W7c site code ---------------------------------------------------

const fold =
  (invocation: GitInvocation, step: WorktreePreservationError["step"], failMessage: string, path?: string) =>
  (error: GitKitError) =>
    adaptGitKitError(error, invocation, Old.preservationErrorAdapter(step, failMessage, path));

const newCountCommits = (targetPath: string, revision: string, step: WorktreePreservationError["step"]) =>
  Effect.flatMap(Git, (git) =>
    git
      .revListCount(targetPath, revision)
      .pipe(
        Effect.mapError((error) =>
          adaptGitKitError(
            error,
            GitCommand.revListCount(revision),
            Old.preservationErrorAdapter(step, `Failed to count commits in ${revision}.`, targetPath)
          )
        )
      )
  );

const newRefExists = (targetPath: string, ref: string, step: WorktreePreservationError["step"], failMessage: string) =>
  Effect.flatMap(Git, (git) =>
    git
      .forEachRef(targetPath, { patterns: [ref] })
      .pipe(
        Effect.mapError(fold(GitCommand.forEachRef([ref]), step, failMessage, targetPath)),
        Effect.map(A.some((entry) => entry.ref === ref))
      )
  );

const newResolveOriginDefaultBranch = (targetPath: string) =>
  Effect.gen(function* () {
    const git = yield* Git;
    const named = yield* git
      .defaultBranch(targetPath, { remote: "origin" })
      .pipe(
        Effect.mapError(
          fold(GitCommand.defaultBranch("origin"), "inspect-origin-main", "Failed to inspect origin/HEAD.", targetPath)
        )
      );
    const resolved = yield* O.match(named, {
      onNone: () => Effect.succeedNone,
      onSome: (name) =>
        newRefExists(
          targetPath,
          `refs/remotes/origin/${name}`,
          "inspect-origin-main",
          "Failed to inspect origin/HEAD."
        ).pipe(Effect.map((exists) => (exists ? O.some(name) : O.none<string>()))),
    });
    return O.getOrElse(resolved, () => "main");
  });

const newUpstream = (targetPath: string, branchName: string) =>
  Effect.flatMap(Git, (git) =>
    git
      .upstream(targetPath, branchName)
      .pipe(
        Effect.mapError(
          fold(
            GitCommand.upstream(branchName),
            "inspect-upstream",
            `Failed to inspect the upstream for ${branchName}.`,
            targetPath
          )
        ),
        Effect.map(O.getOrElse(() => ""))
      )
  );

const newCreateArchiveRef = (mainCheckout: string, archiveRef: string, head: string) =>
  Effect.flatMap(Git, (git) =>
    git
      .updateRef(mainCheckout, archiveRef, { create: head })
      .pipe(
        Effect.mapError((error) =>
          P.isTagged("GitCommandError")(error) && error.kind === "refused"
            ? fold(
                GitCommand.checkRefFormat(archiveRef),
                "create-archive-ref",
                `Archive ref ${archiveRef} was not accepted by git check-ref-format.`
              )(error)
            : fold(
                GitCommand.updateRef(archiveRef, { create: head }),
                "create-archive-ref",
                `Could not create archive ref ${archiveRef}.`
              )(error)
        )
      )
  );

const newCommonDir = (cwd: string, failMessage: string) =>
  Effect.flatMap(Git, (git) =>
    git
      .commonDir(cwd)
      .pipe(Effect.mapError(adaptGitKitError(GitCommand.commonDir(), worktreeGitErrorAdapter(failMessage))))
  );

const REMOVAL_STATUS_OPTIONS = { untrackedFiles: "all", ignoreSubmodules: "none" } as const;

const newInspectRemovalChanges = (targetPath: string, failMessage: string) =>
  Effect.flatMap(Git, (git) =>
    git.status(targetPath, REMOVAL_STATUS_OPTIONS).pipe(
      Effect.mapBoth({
        onFailure: adaptGitKitError(GitCommand.status(REMOVAL_STATUS_OPTIONS), worktreeGitErrorAdapter(failMessage)),
        onSuccess: A.map((entry) => entry.toLine({ renames: "arrow" })),
      })
    )
  );

const DIRTY_SUBMODULE_SCRIPT =
  'status=$(git status --porcelain --untracked-files=all --ignore-submodules=all) || exit $?; test -z "$status" || printf "%s\\0" "$displaypath"';

const newAssertNoDirtySubmodules = (targetPath: string) =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const git = yield* Git;
    yield* git
      .submoduleStatus(targetPath, { recursive: true })
      .pipe(
        Effect.mapError(
          fold(
            GitCommand.submoduleStatus([], true),
            "inspect-submodules",
            "Failed to inspect recursive submodule state.",
            targetPath
          )
        )
      );
    const patient = yield* patientGit;
    const output = yield* patient
      .submoduleForeach(targetPath, DIRTY_SUBMODULE_SCRIPT, { recursive: true, quiet: true })
      .pipe(
        Effect.mapError(
          fold(
            GitCommand.submoduleForeach(DIRTY_SUBMODULE_SCRIPT, true, true),
            "inspect-submodules",
            "Failed to inspect initialized submodules for uncommitted work.",
            targetPath
          )
        )
      );
    const dirty = A.head(A.filter(Str.split(output, "\0"), Str.isNonEmpty));
    if (O.isSome(dirty)) {
      return yield* WorktreePreservationError.new(
        "inspect-submodules",
        `Submodule ${dirty.value} has uncommitted work; commit or clean it before retrying archive retirement.`,
        { path: path.join(targetPath, dirty.value) }
      );
    }
  });

const RESIDUE_PATCH_OPTIONS = { base: "HEAD", binary: true } as const;

const newTrackedPatch = (targetPath: string) =>
  Effect.flatMap(patientGit, (git) =>
    git
      .diffPatch(targetPath, RESIDUE_PATCH_OPTIONS)
      .pipe(
        Effect.mapError(
          fold(
            GitCommand.diffPatch(RESIDUE_PATCH_OPTIONS),
            "inspect-residue",
            "Failed to capture tracked worktree residue.",
            targetPath
          )
        )
      )
  );

const newRemoveWorktree = (mainCheckout: string, targetPath: string, force: boolean) =>
  Effect.flatMap(patientGit, (git) =>
    git
      .worktreeRemove(mainCheckout, targetPath, { force })
      .pipe(
        Effect.mapError(
          adaptGitKitError(
            GitCommand.worktreeRemove(targetPath, force),
            worktreeGitErrorAdapter("Failed to remove the git worktree.")
          )
        )
      )
  );

const newPrune = (mainCheckout: string) =>
  Effect.flatMap(Git, (git) =>
    git
      .worktreePrune(mainCheckout)
      .pipe(
        Effect.mapError(
          adaptGitKitError(
            GitCommand.worktreePrune(),
            worktreeGitErrorAdapter("Failed to prune git worktree metadata.")
          )
        )
      )
  );

const newDeleteArchivedBranch = (mainCheckout: string, branchName: string, head: string) =>
  Effect.flatMap(Git, (git) =>
    git
      .updateRef(mainCheckout, `refs/heads/${branchName}`, { delete: head })
      .pipe(
        Effect.mapError(
          adaptGitKitError(
            GitCommand.updateRef(`refs/heads/${branchName}`, { delete: head }),
            worktreeGitErrorAdapter(
              `Failed to delete archived branch ${branchName}: it no longer points at the archived head ${head}.`
            )
          )
        ),
        Effect.as(true)
      )
  );

const MERGE_DRIVER_CONFIG = {
  name: "Regenerate pure repository projections",
  driver: "bash scripts/regenerate-merge-driver.sh %O %A %B %P",
  recursive: "binary",
} as const;

const newWriteMergeDriverConfig = (checkout: string) =>
  Effect.flatMap(Git, (git) =>
    Effect.forEach(
      Object.entries(MERGE_DRIVER_CONFIG),
      ([key, value]) =>
        git
          .configSet(checkout, `merge.regenerate.${key}`, value)
          .pipe(
            Effect.mapError(
              adaptGitKitError(
                GitCommand.configSet(`merge.regenerate.${key}`, value),
                worktreeGitErrorAdapter("Cannot install projection merge driver.")
              )
            )
          ),
      { discard: true }
    )
  );

const ORIGIN_MAIN_REFSPEC = "+main:refs/remotes/origin/main";

const newRefreshOriginMain = (cwd: string) =>
  Effect.gen(function* () {
    const git = yield* Git;
    const patient = yield* patientGit;
    return yield* patient.fetch(cwd, { remote: "origin", ref: ORIGIN_MAIN_REFSPEC }).pipe(
      Effect.mapError(
        adaptGitKitError(
          GitCommand.fetch("origin", ORIGIN_MAIN_REFSPEC),
          worktreeGitErrorAdapter("Failed to fetch origin/main for the new worktree.")
        )
      ),
      Effect.as("fetched" as const),
      Effect.catchTag("WorktreeCommandError", () =>
        git
          .revParse(cwd, "refs/remotes/origin/main", { peel: "commit" })
          .pipe(
            Effect.mapError(
              adaptGitKitError(
                GitCommand.revParse("refs/remotes/origin/main", { peel: "commit" }),
                worktreeGitErrorAdapter("Failed to fetch origin/main and no usable tracking base exists.")
              )
            ),
            Effect.as("stale-tracking" as const)
          )
      )
    );
  });

const newResolveBase = (cwd: string, base: string) =>
  Effect.flatMap(Git, (git) =>
    git
      .revParse(cwd, base, { peel: "commit" })
      .pipe(
        Effect.mapError(
          adaptGitKitError(
            GitCommand.revParse(base, { peel: "commit" }),
            worktreeGitErrorAdapter("Failed to resolve the worktree base.")
          )
        )
      )
  );

const newAddAtBase = (cwd: string, targetPath: string, branch: string, baseSha: string) =>
  Effect.flatMap(patientGit, (git) =>
    git
      .worktreeAdd(cwd, targetPath, { ref: baseSha, newBranch: branch })
      .pipe(
        Effect.mapError(
          adaptGitKitError(
            GitCommand.worktreeAdd(targetPath, baseSha, false, false, branch),
            worktreeGitErrorAdapter("Failed to add the git worktree.")
          )
        )
      )
  );

const newDoctorChangeCount = (cwd: string) =>
  Effect.flatMap(Git, (git) =>
    git.status(cwd).pipe(
      Effect.mapBoth({
        onFailure: adaptGitKitError(GitCommand.status(), worktreeGitErrorAdapter(`Failed to inspect ${cwd}.`)),
        onSuccess: A.length,
      })
    )
  );

// The prune dry run is a KEEP (W23): it moves from `runGitOutput` onto `runRepoCommandCapture`, as shipped.
const newPruneDryRun = (cwd: string) =>
  runRepoCommandCapture("git", ["worktree", "prune", "--dry-run"], cwd).pipe(
    Effect.mapError(
      () => ({ _tag: "WorktreeCommandError", message: "Failed to compute prunable worktrees." }) as const
    ),
    Effect.flatMap((capture) =>
      capture.exitCode === 0
        ? Effect.succeed(A.filter(Str.split(capture.output, "\n"), Str.isNonEmpty))
        : Effect.fail({
            _tag: "WorktreeCommandError",
            message: `Failed to compute prunable worktrees. (exit ${capture.exitCode}).`,
            exitCode: capture.exitCode,
          } as const)
    )
  );

const newUpdateSubmodules = (cwd: string) =>
  Effect.flatMap(patientGit, (git) =>
    git
      .submoduleUpdate(cwd, { init: true, recursive: true })
      .pipe(
        Effect.mapError(
          adaptGitKitError(
            GitCommand.submoduleUpdate(true, undefined, [], { recursive: true }),
            worktreeGitErrorAdapter("Failed to update submodules in the new worktree.")
          )
        )
      )
  );

const newMergeDriverLine = (cwd: string) =>
  Effect.flatMap(Git, (git) =>
    git.configList(cwd, { scope: "local" }).pipe(
      Effect.mapBoth({
        onFailure: adaptGitKitError(
          GitCommand.configList(undefined, "local"),
          worktreeGitErrorAdapter("Cannot inspect local merge-driver config.")
        ),
        onSuccess: (entries) =>
          O.map(
            A.findFirst(entries, (entry) => entry.key === "merge.regenerate.driver"),
            (entry) => `${entry.key}=${entry.value}`
          ),
      })
    )
  );

// Reap (W27-W30) and the terminal-lane facts (W31-W34): every failure answers `None`.
const newHeadProbe = (cwd: string) => Effect.flatMap(Git, (git) => git.revParse(cwd, "HEAD")).pipe(Effect.option);

const newDirtyProbe = (cwd: string) =>
  Effect.flatMap(Git, (git) => git.status(cwd, REMOVAL_STATUS_OPTIONS)).pipe(
    Effect.map(A.isReadonlyArrayNonEmpty),
    Effect.option
  );

const newIdleFacts = (cwd: string) =>
  Effect.gen(function* () {
    const git = yield* Git;
    const commits = yield* git.log(cwd, { limit: 1, omitPaths: true }).pipe(Effect.option);
    const headPath = yield* git.gitDir(cwd, { path: "HEAD" }).pipe(Effect.option);
    return {
      commitMillis: O.flatMap(commits, (entries) =>
        O.map(A.head(entries), (entry) => DateTime.toEpochMillis(entry.committedAt))
      ),
      headPath: O.map(headPath, Str.trim),
    };
  });

const oldIdleFacts = (cwd: string) =>
  Effect.gen(function* () {
    const commit = yield* runRepoCommandCapture("git", ["log", "-1", "--format=%ct", "HEAD"], cwd).pipe(Effect.option);
    const headPath = yield* runRepoCommandCapture(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-path", "HEAD"],
      cwd
    ).pipe(Effect.option);
    const ok = <T extends { readonly exitCode: number; readonly output: string }>(capture: O.Option<T>) =>
      O.flatMap(capture, (value) => (value.exitCode === 0 ? O.some(Str.trim(value.output)) : O.none()));
    return {
      commitMillis: O.map(
        O.flatMap(ok(commit), (text) => (/^\d+$/.test(text) ? O.some(Number(text)) : O.none())),
        (seconds) => seconds * 1_000
      ),
      headPath: ok(headPath),
    };
  });

const newLayoutFacts = (checkout: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const git = yield* Git;
    const toplevel = yield* fs.realPath(yield* git.repoRoot(checkout));
    const gitDir = yield* fs.realPath(yield* git.gitDir(checkout));
    const commonDir = yield* fs.realPath(yield* git.commonDir(checkout));
    return { toplevel, gitDir, commonDir };
  }).pipe(Effect.option);

const newLaneFacts = (checkout: string) =>
  Effect.flatMap(Git, (git) =>
    Effect.all({
      branch: git.currentBranch(checkout).pipe(Effect.option, Effect.map(O.flatten)),
      head: git.revParse(checkout, "HEAD").pipe(Effect.option),
      clean: git
        .status(checkout, { noOptionalLocks: true, ...REMOVAL_STATUS_OPTIONS })
        .pipe(Effect.map(A.isReadonlyArrayEmpty), Effect.option),
    })
  );

// The shipped reap lister: the newest row of one state, merged rows being the closed ones that merged,
// decoded fail-closed (a head that is not a full object id answers none).
const decodeReapRow = S.decodeUnknownEffect(WorktreeReapPullRequest);

const newReapRows = (cwd: string, branch: string, state: "merged" | "open") =>
  branchPullRequests(cwd, branch, state === "open" ? "open" : "closed").pipe(
    Effect.flatMap(
      O.match({
        onNone: () => Effect.succeedNone,
        onSome: (rows) =>
          Effect.forEach(
            A.take(
              A.filter(rows, (row) => state === "open" || row.merged),
              1
            ),
            (row) => decodeReapRow({ number: row.number, headRefOid: row.headSha })
          ).pipe(Effect.map(A.map((row) => ({ number: row.number, headRefOid: row.headRefOid }))), Effect.option),
      })
    )
  );

// --- the fixture pull-request table both gh sides read ----------------------------------------------------------

type FixturePr = {
  readonly number: number;
  readonly head: string;
  readonly sha: string;
  readonly state: "open" | "closed";
  readonly merged: boolean;
};

const sha = (digit: string) => Str.repeat(40)(digit);

// Newest first, as both `gh pr list` and the REST listing order them.
const TABLE: ReadonlyArray<FixturePr> = [
  { number: 9, head: "feat/reused", sha: sha("c"), state: "closed", merged: false },
  { number: 8, head: "feat/reused", sha: sha("b"), state: "closed", merged: true },
  { number: 7, head: "feat/reused", sha: sha("a"), state: "closed", merged: true },
  { number: 6, head: "feat/open", sha: sha("d"), state: "open", merged: false },
  { number: 5, head: "feat/open", sha: sha("e"), state: "closed", merged: true },
  { number: 4, head: "feat/bad-row", sha: "not-a-sha", state: "closed", merged: true },
];

type GhWorld = { readonly failing: boolean };

const flagValue = (args: ReadonlyArray<string>, flag: string) =>
  O.flatMap(
    A.findFirstIndex(args, (arg) => arg === flag),
    (index) => A.get(args, index + 1)
  );

// `gh pr list --head <b> --state <open|closed|merged> --json number,headRefOid --limit <n>`.
const ghSpawner = (world: GhWorld) =>
  ScriptedSpawner.make((command, args) => {
    if (command !== "gh" || args[0] !== "pr") return { exit: 1, stderr: "unexpected spawn" };
    if (world.failing) return { exit: 1, stderr: "HTTP 502: Bad Gateway" };
    const head = O.getOrElse(flagValue(args, "--head"), () => "");
    const state = O.getOrElse(flagValue(args, "--state"), () => "open");
    const limit = Number(O.getOrElse(flagValue(args, "--limit"), () => "30"));
    const rows = A.filter(
      TABLE,
      (row) => row.head === head && (state === "merged" ? row.merged : row.state === state && !row.merged)
    );
    return {
      stdout: JSON.stringify(A.map(A.take(rows, limit), (row) => ({ number: row.number, headRefOid: row.sha }))),
    };
  });

const restRow = (row: FixturePr) => ({
  number: row.number,
  node_id: `PR_${row.number}`,
  title: `fixture ${row.number}`,
  body: "",
  state: row.state,
  draft: false,
  merged: row.merged,
  merged_at: row.merged ? "2026-11-01T10:00:00Z" : null,
  head: { ref: row.head, sha: row.sha },
  base: { ref: "main", sha: sha("0") },
  html_url: `https://github.com/beep/repo/pull/${row.number}`,
  user: { login: "fixture" },
  labels: [],
  created_at: "2026-11-01T09:00:00Z",
  updated_at: "2026-11-01T10:00:00Z",
});

const restFetch = (world: GhWorld) =>
  Object.assign(
    (input: string | URL | Request): Promise<Response> => {
      const url = new URL(input instanceof Request ? input.url : input instanceof URL ? input.href : input);
      if (world.failing) {
        return Promise.resolve(new Response(JSON.stringify({ message: "Bad Gateway" }), { status: 502 }));
      }
      const head = Str.replace(/^beep:/u, "")(url.searchParams.get("head") ?? "");
      const state = url.searchParams.get("state") ?? "open";
      const rows = A.filter(TABLE, (row) => row.head === head && (state === "all" || row.state === state));
      const response = new Response(JSON.stringify(A.map(rows, restRow)), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
      return Promise.resolve(Object.defineProperty(response, "url", { value: url.href }));
    },
    { preconnect: () => undefined }
  );

const ghAuthToken = ScriptedSpawner.make((command, args) =>
  `${command} ${A.join(args, " ")}` === "gh auth token" ? { stdout: "ghs_fixture\n" } : { exit: 1, stderr: "no" }
);

const withRest =
  (world: GhWorld) =>
  <A2, E, R>(program: Effect.Effect<A2, E, R>) =>
    program.pipe(
      Effect.provideService(GithubTransportFetch, O.some(restFetch(world))),
      Effect.provide(ghAuthToken.layer),
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ GH_REPO: "beep/repo" }))
    );

// --- scratch repositories ---------------------------------------------------------------------------------------

const git = Effect.fnUntraced(function* (cwd: string, args: ReadonlyArray<string>) {
  const result = yield* runRepoCommandCapture(
    "git",
    ["-c", "user.email=w7c@example.com", "-c", "user.name=W7c", "-c", "commit.gpgsign=false", ...args],
    cwd
  );
  if (result.exitCode !== 0) return yield* Effect.die(`fixture git ${A.join(args, " ")} failed: ${result.output}`);
  return Str.trim(result.output);
});

const commit = Effect.fnUntraced(function* (cwd: string, file: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.writeFileString(path.join(cwd, file), content);
  yield* git(cwd, ["add", "-A"]);
  yield* git(cwd, ["commit", "--quiet", "-m", file]);
  return yield* git(cwd, ["rev-parse", "HEAD"]);
});

// --- projection and classification ------------------------------------------------------------------------------

interface Row {
  readonly new: unknown;
  readonly old: unknown;
  readonly scenario: string;
  readonly site: string;
}

// Twin fixtures name their refs, branches and paths after the side that wrote them; that token is not an outcome.
const sideless = (rendered: string): string => Str.replace(/(?<=[-/])(old|new)\b/gu, "<side>")(rendered);
type Classified = Row & { readonly verdict: string };

const projectError = (error: unknown): unknown => {
  if (!P.isObject(error) || !P.hasProperty(error, "_tag")) return { _tag: "unknown" };
  const record = error as {
    readonly _tag: string;
    readonly message?: string;
    readonly step?: string;
    readonly path?: string;
    readonly exitCode?: number;
  };
  const message = record.message ?? "";
  const cut = Str.indexOf(" Command:")(message);
  return record._tag === "WorktreePreservationError"
    ? {
        _tag: record._tag,
        step: record.step,
        path: record.path,
        message: O.match(cut, { onNone: () => message, onSome: (index) => Str.slice(0, index)(message) }),
      }
    : { _tag: record._tag, message, exitCode: record.exitCode };
};

const outcome = <A2, E, R>(effect: Effect.Effect<A2, E, R>, project: (value: A2) => unknown = (value) => value) =>
  effect.pipe(
    Effect.map((value) => ({ ok: project(value) })),
    Effect.catch((error) => Effect.succeed({ err: projectError(error) }))
  );

// Intended divergences, each recorded in SPEC.md's Decision Log (D-20) with these witness scenarios.
const CLASSIFIED: ReadonlyArray<readonly [site: string, scenario: string, reason: string]> = [
  [
    "inspectRemovalChanges lines (W10)",
    "dirty lane",
    "D-20: the lines are the kit's StatusEntry.toLine (raw, unquoted paths), and the first line keeps its leading status column, which the old merged, trimmed capture cut; every caller reads only the count, which is equal",
  ],
];

const show = (value: unknown): string => JSON.stringify(value) ?? "undefined";

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "w7c-differential-" }));
  const rows: Array<Row> = [];
  const record = (site: string, scenario: string, oldValue: unknown, newValue: unknown) =>
    Effect.sync(() => {
      rows.push({ site, scenario, old: oldValue, new: newValue });
    });
  const pair = <A1, A2, E1, R1, E2, R2>(
    site: string,
    scenario: string,
    oldEffect: Effect.Effect<A1, E1, R1>,
    newEffect: Effect.Effect<A2, E2, R2>,
    project?: (value: A1 | A2) => unknown
  ) =>
    Effect.gen(function* () {
      const oldValue = yield* outcome(oldEffect, project);
      const newValue = yield* outcome(newEffect, project);
      yield* record(site, scenario, oldValue, newValue);
    });

  // A bare origin, a clone pushed to it, origin/HEAD pointing at main.
  const origin = path.join(root, "origin.git");
  const repo = path.join(root, "repo");
  const plain = path.join(root, "plain");
  yield* fs.makeDirectory(origin);
  yield* fs.makeDirectory(repo);
  yield* fs.makeDirectory(plain);
  yield* git(origin, ["init", "--quiet", "--bare", "-b", "main"]);
  yield* git(repo, ["init", "--quiet", "-b", "main"]);
  const c1 = yield* commit(repo, "README.md", "# w7c\n");
  yield* git(repo, ["remote", "add", "origin", origin]);
  yield* git(repo, ["push", "--quiet", "--set-upstream", "origin", "main"]);
  yield* git(repo, ["remote", "set-head", "origin", "main"]);
  yield* git(repo, ["branch", "develop"]);
  yield* git(repo, ["push", "--quiet", "origin", "develop"]);
  // A linked lane with two unpushed commits and a live upstream.
  const lane = path.join(root, "lane");
  yield* git(repo, ["worktree", "add", "--quiet", "-b", "feat/lane", lane]);
  yield* git(lane, ["push", "--quiet", "--set-upstream", "origin", "feat/lane"]);
  yield* commit(lane, "lane.txt", "one\n");
  const laneHead = yield* commit(lane, "lane.txt", "two\n");
  // A lane whose upstream was pruned, a lane with no upstream, a detached checkout.
  const pruned = path.join(root, "pruned");
  yield* git(repo, ["worktree", "add", "--quiet", "-b", "feat/pruned", pruned]);
  yield* git(pruned, ["push", "--quiet", "--set-upstream", "origin", "feat/pruned"]);
  yield* git(repo, ["update-ref", "-d", "refs/remotes/origin/feat/pruned"]);
  const local = path.join(root, "local");
  yield* git(repo, ["worktree", "add", "--quiet", "-b", "feat/local", local]);
  const detached = path.join(root, "detached");
  yield* git(repo, ["worktree", "add", "--quiet", "--detach", detached, c1]);
  // A dirty lane: modified, staged rename, untracked, a spaced path, a binary file.
  const dirty = path.join(root, "dirty");
  yield* git(repo, ["worktree", "add", "--quiet", "-b", "feat/dirty", dirty]);
  yield* fs.writeFileString(path.join(dirty, "kept.txt"), "kept\n");
  yield* fs.writeFile(path.join(dirty, "blob.bin"), new Uint8Array([0, 1, 2, 255]));
  yield* git(dirty, ["add", "kept.txt", "blob.bin"]);
  yield* git(dirty, ["commit", "--quiet", "-m", "dirty base"]);
  yield* fs.writeFileString(path.join(dirty, "README.md"), "# changed\n");
  yield* git(dirty, ["mv", "kept.txt", "moved.txt"]);
  yield* fs.writeFile(path.join(dirty, "blob.bin"), new Uint8Array([9, 8, 7, 0, 255]));
  yield* fs.writeFileString(path.join(dirty, "with space.txt"), "spaced\n");
  // A clone whose origin/HEAD dangles, one without origin/HEAD, one whose origin/HEAD names develop.
  const dangling = path.join(root, "dangling");
  yield* git(root, ["clone", "--quiet", origin, dangling]);
  yield* git(dangling, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/gone"]);
  const headless = path.join(root, "headless");
  yield* git(root, ["clone", "--quiet", origin, headless]);
  yield* git(headless, ["remote", "set-head", "origin", "--delete"]);
  const developHead = path.join(root, "develop-head");
  yield* git(root, ["clone", "--quiet", origin, developHead]);
  yield* git(developHead, ["remote", "set-head", "origin", "develop"]);

  // --- Worktree.service probes (W2-W5) ---
  for (const [scenario, cwd, revision] of [
    ["unpushed range", lane, "origin/main..HEAD"],
    ["whole history", lane, "HEAD"],
    ["upstream range", lane, "refs/remotes/origin/feat/lane..HEAD"],
    ["unknown revision", lane, "refs/remotes/origin/nope..HEAD"],
    ["outside a repository", plain, "HEAD"],
  ] as const) {
    yield* pair(
      "countCommits (W2)",
      scenario,
      Old.countCommits(cwd, revision, "inspect-origin-main"),
      newCountCommits(cwd, revision, "inspect-origin-main")
    );
  }
  for (const [scenario, cwd, ref] of [
    ["existing remote-tracking ref", lane, "refs/remotes/origin/main"],
    ["prefix of a nested ref only", lane, "refs/remotes/origin/feat"],
    ["missing ref", lane, "refs/remotes/origin/feat/pruned"],
    ["outside a repository", plain, "refs/remotes/origin/main"],
  ] as const) {
    yield* pair(
      "refExists (W3)",
      scenario,
      Old.refExists(cwd, ref, "inspect-upstream", "Failed to resolve the upstream."),
      newRefExists(cwd, ref, "inspect-upstream", "Failed to resolve the upstream.")
    );
  }
  for (const [scenario, cwd] of [
    ["origin/HEAD names main", repo],
    ["origin/HEAD names develop", developHead],
    ["dangling origin/HEAD", dangling],
    ["no origin/HEAD", headless],
    ["outside a repository", plain],
  ] as const) {
    yield* pair(
      "resolveOriginDefaultBranch (W4)",
      scenario,
      Old.resolveOriginDefaultBranch(cwd),
      newResolveOriginDefaultBranch(cwd)
    );
  }
  for (const [scenario, cwd, branch] of [
    ["live upstream", lane, "feat/lane"],
    ["pruned upstream", pruned, "feat/pruned"],
    ["no upstream", local, "feat/local"],
    ["branch that does not exist", lane, "feat/none"],
    ["outside a repository", plain, "feat/lane"],
  ] as const) {
    yield* pair("upstream (W5)", scenario, Old.upstreamRef(cwd, branch), newUpstream(cwd, branch));
  }

  // --- archive ref create (W6, W7): each side writes its own ref so neither sees the other's write ---
  const refFor = (side: string, scenario: string) => `refs/archive/worktrees/${scenario}/${side}`;
  for (const scenario of ["fresh"]) {
    const oldRef = refFor("old", scenario);
    const newRef = refFor("new", scenario);
    const oldValue = yield* outcome(Old.createArchiveRef(repo, oldRef, laneHead));
    const newValue = yield* outcome(newCreateArchiveRef(repo, newRef, laneHead));
    yield* record(
      "createArchiveRef (W6, W7)",
      "fresh archive ref",
      {
        ...oldValue,
        points: yield* git(repo, ["rev-parse", oldRef]),
      },
      { ...newValue, points: yield* git(repo, ["rev-parse", newRef]) }
    );
  }
  yield* pair(
    "createArchiveRef (W6, W7)",
    "archive ref already exists",
    Old.createArchiveRef(repo, refFor("old", "fresh"), c1),
    newCreateArchiveRef(repo, refFor("new", "fresh"), c1)
  );
  yield* pair(
    "createArchiveRef (W6, W7)",
    "refname check-ref-format rejects",
    Old.createArchiveRef(repo, "refs/archive/worktrees/bad..name/x", laneHead),
    newCreateArchiveRef(repo, "refs/archive/worktrees/bad..name/x", laneHead)
  );

  // --- common dir, removal status, submodules, residue patch (W8-W13) ---
  for (const [scenario, cwd] of [
    ["main checkout", repo],
    ["linked worktree", lane],
    ["outside a repository", plain],
  ] as const) {
    yield* pair(
      "commonDir (W8, W9)",
      scenario,
      Old.commonDir(cwd, "Could not resolve the target Git directory."),
      newCommonDir(cwd, "Could not resolve the target Git directory.")
    );
  }
  for (const [scenario, cwd] of [
    ["clean lane", local],
    ["dirty lane", dirty],
    ["outside a repository", plain],
  ] as const) {
    yield* pair(
      "inspectRemovalChanges count (W10)",
      scenario,
      Old.inspectRemovalChanges(cwd, worktreeGitErrorAdapter(`Failed to inspect ${cwd}.`)),
      newInspectRemovalChanges(cwd, `Failed to inspect ${cwd}.`),
      A.length
    );
    yield* pair(
      "inspectRemovalChanges lines (W10)",
      scenario,
      Old.inspectRemovalChanges(cwd, worktreeGitErrorAdapter(`Failed to inspect ${cwd}.`)),
      newInspectRemovalChanges(cwd, `Failed to inspect ${cwd}.`)
    );
  }

  // A lane with an initialized local submodule, clean then dirty.
  const subSource = path.join(root, "sub-source");
  yield* fs.makeDirectory(subSource);
  yield* git(subSource, ["init", "--quiet", "-b", "main"]);
  yield* commit(subSource, "lib.txt", "lib\n");
  const subLane = path.join(root, "sub-lane");
  yield* git(repo, ["worktree", "add", "--quiet", "-b", "feat/sub", subLane]);
  yield* git(subLane, ["-c", "protocol.file.allow=always", "submodule", "add", "--quiet", subSource, "vendor/lib"]);
  yield* git(subLane, ["commit", "--quiet", "-m", "add submodule"]);
  for (const [scenario, cwd, dirtySub] of [
    ["no submodules", local, false],
    ["clean submodule", subLane, false],
    ["dirty submodule", subLane, true],
    ["outside a repository", plain, false],
  ] as const) {
    if (dirtySub) yield* fs.writeFileString(path.join(subLane, "vendor", "lib", "lib.txt"), "changed\n");
    yield* pair(
      "assertNoDirtySubmodules (W11, W12)",
      scenario,
      Old.assertNoDirtySubmodules(cwd),
      newAssertNoDirtySubmodules(cwd)
    );
  }
  for (const [scenario, cwd] of [
    ["clean lane", local],
    ["dirty lane with a binary change", dirty],
    ["outside a repository", plain],
  ] as const) {
    yield* pair("trackedPatch (W13)", scenario, Old.trackedPatch(cwd), newTrackedPatch(cwd));
  }

  // --- removal, prune, branch CAS delete, merge-driver config (W14-W17): twin fixtures per side ---
  for (const [scenario, makeDirty, force] of [
    ["clean worktree", false, false],
    ["dirty worktree without force", true, false],
    ["dirty worktree with force", true, true],
  ] as const) {
    const results: Array<unknown> = [];
    for (const side of ["old", "new"] as const) {
      const target = path.join(root, `rm-${side}-${results.length}-${force}-${makeDirty}`);
      yield* git(repo, ["worktree", "add", "--quiet", "--detach", target, c1]);
      if (makeDirty) yield* fs.writeFileString(path.join(target, "scratch.txt"), "scratch\n");
      const removal = side === "old" ? Old.removeWorktree(repo, target, force) : newRemoveWorktree(repo, target, force);
      const value = yield* outcome(removal, () => "removed");
      results.push({ ...value, exists: yield* fs.exists(target) });
    }
    yield* record("removeWorktree (W14)", scenario, results[0], results[1]);
  }
  yield* pair(
    "removeWorktree (W14)",
    "path that is not a worktree",
    Old.removeWorktree(repo, path.join(root, "nope"), false),
    newRemoveWorktree(repo, path.join(root, "nope"), false)
  );
  {
    const results: Array<unknown> = [];
    for (const side of ["old", "new"] as const) {
      const gone = path.join(root, `gone-${side}`);
      yield* git(repo, ["worktree", "add", "--quiet", "--detach", gone, c1]);
      yield* fs.remove(gone, { recursive: true });
      const value =
        side === "old"
          ? yield* outcome(Old.pruneWorktreeMetadata(repo), () => "pruned")
          : yield* outcome(newPrune(repo), () => "pruned");
      results.push({
        ...value,
        stillListed: Str.includes(`gone-${side}`)(yield* git(repo, ["worktree", "list", "--porcelain"])),
      });
    }
    yield* record("pruneWorktreeMetadata (W15)", "registration whose directory is gone", results[0], results[1]);
  }
  yield* pair("pruneWorktreeMetadata (W15)", "outside a repository", Old.pruneWorktreeMetadata(plain), newPrune(plain));
  for (const [scenario, moved] of [
    ["branch still at the archived head", false],
    ["branch advanced past the archived head", true],
  ] as const) {
    const results: Array<unknown> = [];
    for (const side of ["old", "new"] as const) {
      const branch = `feat/cas-${side}-${moved}`;
      yield* git(repo, ["branch", branch, c1]);
      if (moved) yield* git(repo, ["update-ref", `refs/heads/${branch}`, laneHead]);
      const value =
        side === "old"
          ? yield* outcome(Old.deleteArchivedBranch(repo, branch, c1))
          : yield* outcome(newDeleteArchivedBranch(repo, branch, c1));
      const left = yield* runRepoCommandCapture(
        "git",
        ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`],
        repo
      );
      results.push({ ...value, branchLeft: left.exitCode === 0 });
    }
    yield* record("deleteArchivedBranch (W16)", scenario, results[0], results[1]);
  }
  {
    const results: Array<unknown> = [];
    for (const side of ["old", "new"] as const) {
      const checkout = path.join(root, `config-${side}`);
      yield* git(repo, ["worktree", "add", "--quiet", "--detach", checkout, c1]);
      const value =
        side === "old"
          ? yield* outcome(Old.writeMergeDriverConfig(checkout))
          : yield* outcome(newWriteMergeDriverConfig(checkout));
      const driver = yield* git(checkout, ["config", "--get", "merge.regenerate.driver"]);
      const recursive = yield* git(checkout, ["config", "--get", "merge.regenerate.recursive"]);
      results.push({ ...value, driver, recursive });
      // The two sides share the clone's local config: clear it so the second side writes from scratch.
      yield* git(checkout, ["config", "--remove-section", "merge.regenerate"]);
    }
    yield* record("writeMergeDriverConfig (W17)", "linked worktree", results[0], results[1]);
  }
  yield* pair(
    "writeMergeDriverConfig (W17)",
    "outside a repository",
    Old.writeMergeDriverConfig(plain),
    newWriteMergeDriverConfig(plain)
  );

  // --- Worktree.command steps (W18-W25) ---
  const noOrigin = path.join(root, "no-origin");
  yield* fs.makeDirectory(noOrigin);
  yield* git(noOrigin, ["init", "--quiet", "-b", "main"]);
  yield* commit(noOrigin, "a.txt", "a\n");
  const staleClone = path.join(root, "stale-clone");
  yield* git(root, ["clone", "--quiet", origin, staleClone]);
  yield* git(staleClone, ["remote", "set-url", "origin", path.join(root, "missing-origin.git")]);
  for (const [scenario, cwd] of [
    ["fetch succeeds", repo],
    ["fetch fails, tracking commit exists", staleClone],
    ["fetch fails, no tracking commit", noOrigin],
  ] as const) {
    yield* pair("refreshOriginMain (W18, W19)", scenario, OldCommand.refreshOriginMain(cwd), newRefreshOriginMain(cwd));
  }
  for (const [scenario, base] of [
    ["origin/main", "origin/main"],
    ["a tag-less sha", c1],
    ["unknown base", "refs/heads/does-not-exist"],
  ] as const) {
    yield* pair("resolveBase (W20)", scenario, OldCommand.resolveBase(repo, base), newResolveBase(repo, base));
  }
  {
    const results: Array<unknown> = [];
    for (const side of ["old", "new"] as const) {
      const target = path.join(root, `added-${side}`);
      const branch = `feat/added-${side}`;
      const value = yield* outcome(
        side === "old" ? OldCommand.addAtBase(repo, target, branch, c1) : newAddAtBase(repo, target, branch, c1)
      );
      results.push({
        ...value,
        head: yield* git(target, ["rev-parse", "HEAD"]),
        branch: yield* git(target, ["branch", "--show-current"]),
      });
    }
    yield* record("addAtBase (W21)", "new branch at the base", results[0], results[1]);
  }
  yield* pair(
    "addAtBase (W21)",
    "branch already exists",
    OldCommand.addAtBase(repo, path.join(root, "added-again-old"), "feat/lane", c1),
    newAddAtBase(repo, path.join(root, "added-again-new"), "feat/lane", c1)
  );
  for (const [scenario, cwd] of [
    ["clean lane", local],
    ["dirty lane", dirty],
    ["outside a repository", plain],
  ] as const) {
    yield* pair("doctorChangeCount (W22)", scenario, OldCommand.doctorChangeCount(cwd), newDoctorChangeCount(cwd));
  }
  {
    const gone = path.join(root, "gone-dry");
    yield* git(repo, ["worktree", "add", "--quiet", "--detach", gone, c1]);
    yield* fs.remove(gone, { recursive: true });
    yield* pair(
      "pruneDryRun (W23 KEEP)",
      "one prunable registration",
      OldCommand.pruneDryRun(repo),
      newPruneDryRun(repo)
    );
    yield* git(repo, ["worktree", "prune"]);
    yield* pair("pruneDryRun (W23 KEEP)", "nothing to prune", OldCommand.pruneDryRun(repo), newPruneDryRun(repo));
  }
  yield* pair(
    "updateSubmodules (W24)",
    "no .gitmodules",
    OldCommand.updateSubmodules(local),
    newUpdateSubmodules(local)
  );
  yield* pair(
    "updateSubmodules (W24)",
    "local submodule",
    OldCommand.updateSubmodules(subLane),
    newUpdateSubmodules(subLane)
  );
  yield* pair("mergeDriverLine (W25)", "driver absent", OldCommand.mergeDriverLine(repo), newMergeDriverLine(repo));
  yield* Old.writeMergeDriverConfig(repo);
  yield* pair("mergeDriverLine (W25)", "driver installed", OldCommand.mergeDriverLine(repo), newMergeDriverLine(repo));
  yield* pair(
    "mergeDriverLine (W25)",
    "outside a repository",
    OldCommand.mergeDriverLine(plain),
    newMergeDriverLine(plain)
  );

  // --- Reap probes (W27-W30) and the terminal-lane facts (W31-W34) ---
  for (const [scenario, cwd] of [
    ["linked lane", lane],
    ["detached checkout", detached],
    ["dirty lane", dirty],
    ["main checkout", repo],
    ["outside a repository", plain],
  ] as const) {
    yield* pair("reap head probe (W27)", scenario, OldReap.headProbe(cwd), newHeadProbe(cwd));
    yield* pair("reap idle facts (W28, W29)", scenario, oldIdleFacts(cwd), newIdleFacts(cwd));
    yield* pair("reap dirty probe (W30)", scenario, OldReap.dirtyProbe(cwd), newDirtyProbe(cwd));
    yield* pair("lane layout facts (W31)", scenario, OldLane.layoutFacts(cwd), newLayoutFacts(cwd));
    yield* pair("lane branch/head/clean facts (W32-W34)", scenario, OldLane.laneFacts(cwd), newLaneFacts(cwd));
  }
  // The idle reading as reap computes it, on both sides, against one clock.
  yield* pair(
    "reap readIdleHours (W28, W29)",
    "linked lane",
    OldReap.readIdleHours(lane, 2_000_000_000_000),
    Effect.gen(function* () {
      const facts = yield* newIdleFacts(lane);
      const head = yield* fs.stat(O.getOrThrow(facts.headPath));
      const newest = Math.max(O.getOrThrow(facts.commitMillis), O.getOrThrow(head.mtime).getTime());
      return { hours: O.some((2_000_000_000_000 - newest) / 3_600_000), failed: false };
    })
  );

  // --- gh sites (W1, W26) over one fixture table ---
  for (const [scenario, branch, failing] of [
    ["reused branch: two merged and a newer closed", "feat/reused", false],
    ["open and merged", "feat/open", false],
    ["no pull requests", "feat/none", false],
    ["undecodable row", "feat/bad-row", false],
    ["GitHub unavailable", "feat/reused", true],
  ] as const) {
    const world: GhWorld = { failing };
    yield* pair(
      "mergedPullRequestsForBranch (W1)",
      scenario,
      Old.mergedPullRequestsForBranch(repo, branch).pipe(Effect.provide(ghSpawner(world).layer)),
      mergedPullRequestsForBranch(repo, branch).pipe(withRest(world)),
      O.map(A.map((row) => ({ number: row.number, headRefOid: row.headRefOid })))
    );
    for (const state of ["open", "merged"] as const) {
      yield* pair(
        `reap pull-request rows, ${state} (W26)`,
        scenario,
        OldReap.ghPrList(repo, branch, state).pipe(
          Effect.map(OldReap.plainRows),
          Effect.provide(ghSpawner(world).layer)
        ),
        newReapRows(repo, branch, state).pipe(withRest(world))
      );
    }
  }

  const classified: ReadonlyArray<Classified> = A.map(rows, (row) => {
    if (sideless(show(row.old)) === sideless(show(row.new))) return { ...row, verdict: "same" };
    const known = A.findFirst(CLASSIFIED, ([site, scenario]) => site === row.site && scenario === row.scenario);
    return { ...row, verdict: O.match(known, { onNone: () => "unclassified", onSome: ([, , reason]) => reason }) };
  });
  const unclassified = A.filter(classified, (row) => row.verdict === "unclassified");
  const gates = { unclassified: unclassified.length === 0 };
  const report = {
    tool: "goals/repo-cli-gh-git-consolidation/ops/worktree-differential-w7.ts",
    commit: yield* git(repoRoot, ["rev-parse", "HEAD"]),
    git: yield* git(repoRoot, ["--version"]),
    scenarios: classified.length,
    same: A.filter(classified, (row) => row.verdict === "same").length,
    classified: A.filter(classified, (row) => row.verdict !== "same" && row.verdict !== "unclassified").length,
    unclassified: unclassified.length,
    gates,
    rows: A.map(classified, (row) => ({
      site: row.site,
      scenario: row.scenario,
      verdict: row.verdict,
      old: Str.replaceAll(root, "<tmp>")(show(row.old)),
      new: Str.replaceAll(root, "<tmp>")(show(row.new)),
    })),
  };
  const json = JSON.stringify(report, null, 2);
  yield* O.match(
    O.flatMap(outFlag, (index) => A.get(argv, index + 1)),
    {
      onNone: () => Console.log(json),
      onSome: (out) => fs.writeFileString(out, `${json}\n`),
    }
  );
  yield* Console.error(`gates: ${JSON.stringify(gates)} (${report.same} same, ${report.classified} classified)`);
  if (!gates.unclassified) process.exitCode = 1;
}).pipe(Effect.scoped);

NodeRuntime.runMain(
  Layer.build(Layer.provideMerge(Git.layer, Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))).pipe(
    Effect.flatMap((services) => program.pipe(Effect.provide(services))),
    Effect.scoped
  )
);
