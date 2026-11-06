/**
 * W7b differential: the W7b command-group git and gh sites on `@beep/git` and `@beep/github`, against the pre-W7
 * bodies they replace.
 *
 * W7b of `goals/repo-cli-gh-git-consolidation` moves the census W7b rows (B1-B136) of the Ci, Docgen, Knowledge,
 * Quality, Goals, Holds, Laws, Lint, Runners, Research, Cache, Qa and Refs command groups onto the kit (SPEC D-19).
 * The pre-W7 bodies are frozen under `ops/frozen-w7b/`, copied from the lane base 8602b24203: `Groups.old.ts` holds the
 * git sites over `GitRunners.old.ts` (the generic runners the retirement deletes, inlined verbatim), and the
 * `RouteCorpus`, `Completion`, `CompletionEvidence` and `RepoCards` copies hold the gh sites replayed by
 * `groups-differential-w7.github.ts`.
 *
 * The git half builds real scratch repositories (renames, deletions, a non-ASCII path, untracked and ignored files,
 * a linked origin, a shallow clone, an unborn repository, a directory outside any repository), runs the frozen body
 * and the shipped one on the same state, and compares normalized outcomes: a success is its value, a failure its
 * error tag and exit code where it carries one. Error text is not compared: every migrated site names the kit's argv
 * in its message where it named the frozen argv (SPEC D-10). The gh half runs one fixture world per scenario, old
 * bodies over a scripted `gh`, new ones over the real client and a paginating `fetch`. A difference is classified
 * (an intended shift named in D-19, with its witness scenario) or unclassified; the gate is zero unclassified.
 *
 * Usage (from the repo root):
 *
 *   bun goals/repo-cli-gh-git-consolidation/ops/groups-differential-w7.ts [--out <report.json>]
 *
 * Exit code 1 when any gate fails.
 */
import * as NodeURL from "node:url";
import { Git, GitOptions } from "@beep/git/Git";
import { isDoctestSourcePath } from "@beep/repo-utils/JSDoc/DoctestSource";
import { NodeCrypto, NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constTrue, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { readHeavyAdmissionChangedPaths } from "../../../packages/tooling/tool/cli/src/commands/Ci/HeavyAdmission.ts";
import { ChangeClassifier, ClassifyInput } from "../../../packages/tooling/tool/cli/src/commands/Ci/Route.service.ts";
import { makeRouteGit } from "../../../packages/tooling/tool/cli/src/commands/Ci/RouteCensus.ts";
import { ChangeClassifierLive } from "../../../packages/tooling/tool/cli/src/commands/Ci/RouteClassify.ts";
import { discoverChangedDoctestFilesForTesting } from "../../../packages/tooling/tool/cli/src/commands/Docgen/internal/Doctest.ts";
import { readKnowledgeGitRefNames } from "../../../packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.service.ts";
import {
  KNOWLEDGE_PATH_REMOVAL_LOG,
  knowledgePathRemovalsFromLog,
} from "../../../packages/tooling/tool/cli/src/commands/Knowledge/KnowledgeDoctor.grouping.ts";
import {
  messageGitErrorAdapter,
  scanTrackedTextFiles,
} from "../../../packages/tooling/tool/cli/src/commands/Laws/internal/TrackedTextFiles.ts";
import { MarkdownFencesExecutionError } from "../../../packages/tooling/tool/cli/src/commands/Laws/Laws.errors.ts";
import { readCommitProvenance } from "../../../packages/tooling/tool/cli/src/commands/Qa/Qa.session.ts";
import { collectAuditDiffInputForTesting } from "../../../packages/tooling/tool/cli/src/commands/Quality/FallowQuality.command.ts";
import { laneProofVirtualTreeSha } from "../../../packages/tooling/tool/cli/src/commands/Quality/internal/LaneProofReuse.ts";
import { listGitVisiblePaths } from "../../../packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts";
import { commitVault } from "../../../packages/tooling/tool/cli/src/commands/Research/internal/Daily.ts";
import { VAULT_DIRS } from "../../../packages/tooling/tool/cli/src/commands/Research/internal/Vault.ts";
import { runRepoCommandCapture } from "../../../packages/tooling/tool/cli/src/internal/repo-run/RepoRun.executor.ts";
import * as Old from "./frozen-w7b/Groups.old.ts";
import { githubDifferentialRows } from "./groups-differential-w7.github.ts";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as HashSet from "effect/HashSet";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GitCommandErrorAdapter } from "../../../packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts";
import type { GroupsDifferentialRow } from "./groups-differential-w7.github.ts";

const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));
const argv = process.argv.slice(2);
const outFlag = A.findFirstIndex(argv, (arg) => arg === "--out");

type Services =
  | Git
  | ChildProcessSpawner.ChildProcessSpawner
  | SecureRandom.SecureRandom
  | Digest.Digest
  | FileSystem.FileSystem
  | Path.Path;

// --- shipped reads the sites keep private, re-expressed over the same kit members and options --------------------

// KnowledgeDoctor.service.ts pathRemovalsLive: the shallow probe, then the log on the 64 MiB instance.
const newKnowledgePathRemovals = (cwd: string, treeCommit: string) =>
  Effect.gen(function* () {
    const git = yield* Git;
    const shallow = yield* git.isShallow(cwd).pipe(Effect.option);
    if (O.getOrElse(shallow, constTrue)) return O.none();
    const history = yield* Git.makeWith(GitOptions.make({ maxOutputBytes: 64 * 1024 * 1024 }));
    return yield* history
      .log(cwd, { ...KNOWLEDGE_PATH_REMOVAL_LOG, revisions: [treeCommit] })
      .pipe(Effect.map(knowledgePathRemovalsFromLog), Effect.option);
  });

// Goals/Doctor.ts gitAdvisories: the three advisory reads, each `None` on any failure.
const newGoalsGitReads = (cwd: string) =>
  Effect.gen(function* () {
    const git = yield* Git;
    const shallow = yield* git.isShallow(cwd).pipe(Effect.option);
    const recentPaths = yield* git
      .log(cwd, { since: "21.days", paths: ["goals/"] })
      .pipe(Effect.map(A.flatMap((entry) => entry.paths)), Effect.option);
    const subjects = yield* git
      .log(cwd, { limit: 4000, omitPaths: true })
      .pipe(Effect.map(A.map((entry) => entry.subject)), Effect.option);
    return { shallow, recentPaths, subjects };
  });

// Laws/SchemaTagIdioms.ts listTracked and Lint/OpaqueRoundtrips.ts scan: `Git.lsFiles` mapped to paths.
const newTrackedPaths = (cwd: string, pathspec: ReadonlyArray<string>) =>
  Effect.flatMap(Git, (git) => git.lsFiles(cwd, { pathspec })).pipe(Effect.map(A.map((entry) => entry.path)));

const quietAdapter: GitCommandErrorAdapter<{ readonly _tag: "QualityScriptCommandError"; readonly exitCode?: number }> =
  {
    onSpawnFailure: () => () => ({ _tag: "QualityScriptCommandError" }),
    onNonZeroExit: ({ exitCode }) => ({ _tag: "QualityScriptCommandError", exitCode }),
    onTruncated: O.none(),
  };

// --- normalization ---------------------------------------------------------------------------------------------

const failureView = (error: unknown) => ({
  tag: P.hasProperty(error, "_tag") && P.isString(error._tag) ? error._tag : "unknown",
  ...(P.hasProperty(error, "exitCode") && P.isNumber(error.exitCode) ? { exitCode: error.exitCode } : {}),
});

const same = (value: unknown): unknown => value;
const sortedPaths = (paths: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(A.dedupe(paths), Order.String);
const optionView = <A>(view: (value: A) => unknown) => O.match({ onNone: () => "none", onSome: view });

const outcomeOf = <A, E>(body: Effect.Effect<A, E, Services>, view: (value: A) => unknown) =>
  body.pipe(
    Effect.map((value) => ({ ok: view(value) })),
    Effect.catch((failure) => Effect.succeed({ failed: failureView(failure) }))
  );

// --- scratch repositories ---------------------------------------------------------------------------------------

const run = Effect.fnUntraced(function* (cwd: string, args: ReadonlyArray<string>) {
  const result = yield* runRepoCommandCapture("git", args, cwd);
  if (result.exitCode !== 0) return yield* Effect.die(`fixture git ${A.join(args, " ")} failed: ${result.output}`);
  return Str.trim(result.output);
});

const write = Effect.fnUntraced(function* (cwd: string, file: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.dirname(path.join(cwd, file)), { recursive: true });
  yield* fs.writeFileString(path.join(cwd, file), content);
});

const commitAll = Effect.fnUntraced(function* (cwd: string, message: string) {
  yield* run(cwd, ["add", "-A"]);
  yield* run(cwd, [
    "-c",
    "commit.gpgsign=false",
    "-c",
    "user.email=w7b@example.com",
    "-c",
    "user.name=W7b",
    "commit",
    "--quiet",
    "--allow-empty",
    "-m",
    message,
  ]);
  return yield* run(cwd, ["rev-parse", "HEAD"]);
});

const initRepo = Effect.fnUntraced(function* (cwd: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(cwd, { recursive: true });
  yield* run(cwd, ["-c", "init.defaultBranch=main", "init", "--quiet"]);
  yield* run(cwd, ["config", "user.email", "w7b@example.com"]);
  yield* run(cwd, ["config", "user.name", "W7b"]);
  yield* run(cwd, ["config", "commit.gpgsign", "false"]);
});

// Intended divergences, each recorded in SPEC.md's Decision Log (D-19) with these witness scenarios.
const RAW_PATHS =
  "D-19: the kit reads -z output, so a path with a non-ASCII character arrives raw where the line capture received git's C-quoted form";
const UNBORN_LOG =
  "D-19: Git.log reads an unborn HEAD as an empty history where `git log` exited 128, so the goals doctor judges staleness on an empty window there instead of skipping it (advisory findings only; an unborn clone holds no shipped packet)";
const CLASSIFIED: ReadonlyArray<readonly [site: string, scenario: string, reason: string]> = [
  ["HeavyAdmission.readHeavyAdmissionChangedPaths", "a non-ASCII path", RAW_PATHS],
  ["Doctest.discoverChangedDoctestFiles", "a non-ASCII path", RAW_PATHS],
  ["Doctest.discoverChangedDoctestFiles", "a clean clone", RAW_PATHS],
  ["QualityArtifactSupport.listGitVisiblePaths", "scoped to packages", RAW_PATHS],
  ["QualityArtifactSupport.listGitVisiblePaths", "a non-ASCII path", RAW_PATHS],
  ["Goals.Doctor.gitReads", "unborn repository", UNBORN_LOG],
];

const show = (value: unknown): string => JSON.stringify(value) ?? "undefined";

const gitProgram = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "w7b-differential-" });
  const rows: Array<GroupsDifferentialRow> = [];
  const compare = <A, B, E1, E2>(
    site: string,
    scenario: string,
    oldBody: Effect.Effect<A, E1, Services>,
    newBody: Effect.Effect<B, E2, Services>,
    oldView: (value: A) => unknown = same,
    newView: (value: B) => unknown = same
  ) =>
    Effect.gen(function* () {
      const oldValue = yield* outcomeOf(oldBody, oldView);
      const newValue = yield* outcomeOf(newBody, newView);
      const differs = show(oldValue) !== show(newValue);
      const known = A.findFirst(CLASSIFIED, ([s, sc]) => s === site && sc === scenario);
      rows.push({
        site,
        scenario,
        old: oldValue,
        new: newValue,
        verdict: !differs ? "same" : O.isSome(known) ? "classified" : "unclassified",
        ...(differs && O.isSome(known) ? { note: known.value[2] } : {}),
      });
    });

  // The seed: a branched history with a rename, a deletion, a non-ASCII path and an origin to fetch from.
  const origin = path.join(root, "origin");
  yield* initRepo(origin);
  yield* write(origin, "package.json", '{ "name": "@fixture/root", "workspaces": ["packages/*"] }\n');
  yield* write(origin, "packages/a/package.json", '{ "name": "@fixture/a" }\n');
  yield* write(origin, "packages/a/src/index.ts", "export const a = 1;\n");
  yield* write(origin, "docs/old.md", "# old\n");
  yield* write(origin, "docs/gone.md", "# gone\n");
  yield* write(origin, "goals/demo/README.md", "# demo\n");
  const base = yield* commitAll(origin, "chore: seed");
  yield* run(origin, ["switch", "--quiet", "-c", "feature"]);
  yield* run(origin, ["mv", "docs/old.md", "docs/new.md"]);
  yield* run(origin, ["rm", "--quiet", "docs/gone.md"]);
  yield* write(origin, "packages/a/src/index.ts", "export const a = 2;\n");
  yield* write(origin, "packages/a/src/naïve.ts", "export const naive = true;\n");
  yield* write(origin, "goals/demo/PLAN.md", "# plan\n");
  const head = yield* commitAll(origin, "feat: move and drop");
  yield* run(origin, ["switch", "--quiet", "main"]);

  // A clone that knows origin/main and checks out the feature head, plus dirty and untracked state.
  const work = path.join(root, "work");
  yield* run(root, ["clone", "--quiet", "--branch", "feature", origin, work]);
  yield* run(work, ["config", "user.email", "w7b@example.com"]);
  yield* run(work, ["config", "user.name", "W7b"]);
  yield* write(work, "packages/a/src/dirty.ts", "export const dirty = 1;\n");
  yield* write(work, ".gitignore", "ignored/\n");
  yield* write(work, "ignored/residue.ts", "export const residue = 1;\n");
  const clean = path.join(root, "clean");
  yield* run(root, ["clone", "--quiet", "--branch", "feature", origin, clean]);
  const shallow = path.join(root, "shallow");
  yield* run(root, ["clone", "--quiet", "--depth", "1", "--branch", "feature", `file://${origin}`, shallow]);
  const unborn = path.join(root, "unborn");
  yield* initRepo(unborn);
  const plain = path.join(root, "plain");
  yield* fs.makeDirectory(plain);

  // B1-B4: the change classifier's git reads, over the same resolved shas.
  const classify = (cwd: string, from: string, to: string) =>
    Effect.flatMap(ChangeClassifier, (classifier) =>
      classifier.classify(ClassifyInput.make({ repoRoot: cwd, base: from, head: to }))
    ).pipe(Effect.provide(ChangeClassifierLive));
  for (const [scenario, from, to] of [
    ["a rename, a deletion and an edit", base, head],
    ["an empty range", head, head],
  ] as const) {
    yield* compare(
      "RouteClassify.classifyCommitRange",
      scenario,
      Old.oldClassifyCommitRange(origin, from, to),
      classify(origin, from, to)
    );
  }

  // B6: the route census merge base against origin/main.
  for (const [scenario, ref] of [
    ["the feature head", head],
    ["an unknown object", "f".repeat(40)],
  ] as const) {
    yield* compare(
      "RouteCensus.mergeBase",
      scenario,
      Old.oldRouteMergeBase(work, ref),
      Effect.flatMap(makeRouteGit(work), (git) => git.mergeBase(ref))
    );
  }

  // B12, B13: heavy admission's fetch and merge-base diff.
  yield* compare(
    "HeavyAdmission.readHeavyAdmissionChangedPaths",
    "a non-ASCII path",
    Old.oldHeavyAdmissionChangedPaths("main", work),
    readHeavyAdmissionChangedPaths("main", work),
    sortedPaths,
    sortedPaths
  );
  yield* compare(
    "HeavyAdmission.readHeavyAdmissionChangedPaths",
    "outside a repository",
    Old.oldHeavyAdmissionChangedPaths("main", plain),
    readHeavyAdmissionChangedPaths("main", plain)
  );

  // B15-B17: doctest discovery's committed, dirty and untracked reads, under the site's own filter.
  const oldDoctest = (cwd: string) =>
    Old.oldDoctestChangedPaths(cwd).pipe(
      Effect.flatMap((paths) =>
        Effect.filter(sortedPaths(A.filter(paths, isDoctestSourcePath)), (file) => fs.exists(path.join(cwd, file)))
      )
    );
  yield* compare(
    "Doctest.discoverChangedDoctestFiles",
    "a non-ASCII path",
    oldDoctest(work),
    discoverChangedDoctestFilesForTesting(work)
  );
  yield* compare(
    "Doctest.discoverChangedDoctestFiles",
    "a clean clone",
    oldDoctest(clean),
    discoverChangedDoctestFilesForTesting(clean)
  );

  // B25: the knowledge ref census.
  const refNames = (names: HashSet.HashSet<string>) => A.sort(A.fromIterable(names), Order.String);
  for (const [scenario, cwd] of [
    ["a clone with remote branches", work],
    ["outside a repository", plain],
  ] as const) {
    yield* compare(
      "Knowledge.readKnowledgeGitRefNames",
      scenario,
      Old.oldKnowledgeGitRefNames(cwd),
      readKnowledgeGitRefNames(cwd),
      refNames,
      refNames
    );
  }

  // B18, B19: the knowledge path-removal log from a tree commit.
  const removals = optionView(
    (list: ReadonlyArray<{ readonly path: string; readonly change: string; readonly renamedTo: O.Option<string> }>) =>
      A.map(list, (removal) => [removal.path, removal.change, O.getOrElse(removal.renamedTo, () => "")])
  );
  for (const [scenario, cwd, commit] of [
    ["a rename and a deletion", origin, head],
    ["a shallow clone", shallow, head],
    ["an unknown tree commit", origin, "f".repeat(40)],
  ] as const) {
    yield* compare(
      "KnowledgeDoctor.pathRemovals",
      scenario,
      Old.oldKnowledgePathRemovals(cwd, commit),
      newKnowledgePathRemovals(cwd, commit),
      removals,
      removals
    );
  }

  // B30-B32: the tracked plus visible untracked listings.
  for (const [scenario, cwd, pathspec] of [
    ["a non-ASCII path", work, A.empty<string>()],
    ["scoped to packages", work, ["packages"]],
    ["outside a repository", plain, A.empty<string>()],
  ] as const) {
    yield* compare(
      "QualityArtifactSupport.listGitVisiblePaths",
      scenario,
      Old.oldVisiblePaths(cwd, pathspec),
      listGitVisiblePaths(cwd, pathspec, quietAdapter),
      sortedPaths,
      sortedPaths
    );
  }

  // B42-B44: the audit fallback's tracked and untracked patch input.
  const patchView = (result: { readonly exitCode: number; readonly stdout: string }) => ({
    exitCode: result.exitCode,
    stdout: result.exitCode === 0 ? result.stdout : "",
  });
  for (const [scenario, cwd, ref, context, noRenames] of [
    ["renames and an untracked file", work, base, 3, undefined],
    ["codemod attribution without renames", work, base, 0, true],
    ["an unknown base", work, "nope", 3, undefined],
  ] as const) {
    yield* compare(
      "FallowQuality.collectAuditDiffInput",
      scenario,
      Old.oldAuditDiffInput(cwd, ref, context, noRenames),
      collectAuditDiffInputForTesting(cwd, ref, context, noRenames),
      patchView,
      patchView
    );
  }

  // B46: the lane-proof virtual tree, through a temporary index the real index never sees.
  yield* compare(
    "LaneProofReuse.virtualTreeSha",
    "a dirty clone",
    Old.oldLaneProofVirtualTreeSha(work, "w7b-differential-index").pipe(Effect.map((result) => result.tree)),
    laneProofVirtualTreeSha(work)
  );

  // B66-B68: the goals doctor's advisory history reads.
  const goalsView = (reads: {
    readonly shallow: O.Option<boolean>;
    readonly recentPaths: O.Option<ReadonlyArray<string>>;
    readonly subjects: O.Option<ReadonlyArray<string>>;
  }) => ({
    shallow: optionView(same)(reads.shallow),
    recentPaths: optionView(sortedPaths)(reads.recentPaths),
    subjects: optionView(same)(reads.subjects),
  });
  for (const [scenario, cwd] of [
    ["a branched history", origin],
    ["a shallow clone", shallow],
    ["unborn repository", unborn],
    ["outside a repository", plain],
  ] as const) {
    yield* compare(
      "Goals.Doctor.gitReads",
      scenario,
      Old.oldGoalsGitReads(cwd),
      newGoalsGitReads(cwd),
      goalsView,
      goalsView
    );
  }

  // B70, B71, B75: the Laws and Lint tracked listings.
  const scanned = (cwd: string) =>
    scanTrackedTextFiles({
      cwd,
      gitErrors: messageGitErrorAdapter(MarkdownFencesExecutionError.new),
      mapError: MarkdownFencesExecutionError.mapError,
      isSkipped: () => false,
      scan: (file): ReadonlyArray<string> => [file],
    }).pipe(Effect.map((report) => report.findings));
  yield* compare(
    "TrackedTextFiles.listTrackedRegularFiles",
    "a branched history",
    Old.oldTrackedRegularFiles(origin),
    scanned(origin),
    sortedPaths,
    sortedPaths
  );
  yield* compare(
    "SchemaTagIdioms.listTracked",
    "TypeScript and Markdown pathspecs",
    Old.oldTrackedPaths(work, ["*.ts", "*.md"]),
    newTrackedPaths(work, ["*.ts", "*.md"]),
    sortedPaths,
    sortedPaths
  );
  yield* compare(
    "OpaqueRoundtrips.trackedTests",
    "no test files",
    Old.oldTrackedTestFiles(work),
    newTrackedPaths(work, ["*.test.ts", "*.test.tsx"]),
    sortedPaths,
    sortedPaths
  );

  // B79-B82: the research vault commit, on twin vaults per scenario.
  const makeVault = Effect.fnUntraced(function* (name: string, ignoreState: boolean) {
    const vault = path.join(root, name);
    yield* initRepo(vault);
    if (ignoreState) yield* write(vault, ".gitignore", `${VAULT_DIRS.state}/\n`);
    yield* write(vault, `${VAULT_DIRS.state}/state.json`, "{}\n");
    yield* write(vault, "inbox/note.md", "# note\n");
    return vault;
  });
  const vaultView = (vault: string) => (outcome: unknown) =>
    Effect.gen(function* () {
      const tracked = yield* run(vault, ["ls-files"]);
      const count = yield* runRepoCommandCapture("git", ["rev-list", "--count", "HEAD"], vault);
      return {
        outcome: outcome === "clean" ? "clean" : "done",
        tracked: Str.split("\n")(tracked),
        commits: Str.trim(count.output),
      };
    });
  for (const [scenario, ignoreState] of [
    ["the vault ignores its state", true],
    ["the vault does not ignore its state", false],
  ] as const) {
    const oldVault = yield* makeVault(`vault-old-${ignoreState}`, ignoreState);
    const newVault = yield* makeVault(`vault-new-${ignoreState}`, ignoreState);
    yield* compare(
      "Daily.commitVault",
      scenario,
      Old.oldCommitVault(oldVault, VAULT_DIRS.state).pipe(Effect.flatMap(vaultView(oldVault))),
      commitVault(newVault).pipe(Effect.flatMap(vaultView(newVault)))
    );
  }
  yield* compare(
    "Daily.commitVault",
    "outside a repository",
    Old.oldCommitVault(plain, VAULT_DIRS.state),
    commitVault(plain)
  );

  // B135, B136: QA commit provenance.
  for (const [scenario, cwd] of [
    ["a dirty clone", work],
    ["a clean clone", clean],
    ["unborn repository", unborn],
    ["outside a repository", plain],
  ] as const) {
    yield* compare(
      "Qa.readCommitProvenance",
      scenario,
      Old.oldReadCommitProvenance(cwd),
      readCommitProvenance(cwd),
      same,
      (value) => ({ dirty: value.dirty, sha: value.sha })
    );
  }

  return A.map(rows, (row) => ({
    ...row,
    old: JSON.parse(Str.replaceAll(root, "<tmp>")(show(row.old))) as unknown,
    new: JSON.parse(Str.replaceAll(root, "<tmp>")(show(row.new))) as unknown,
  }));
}).pipe(Effect.scoped);

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const gitRows = yield* gitProgram;
  const githubRows = yield* githubDifferentialRows;
  const rows = A.appendAll(gitRows, githubRows);
  const unclassified = A.filter(rows, (row) => row.verdict === "unclassified");
  const gates = { unclassified: unclassified.length === 0 };
  const report = {
    schemaVersion: "repo-cli-gh-git-consolidation/groups-differential-w7/v1",
    tool: "goals/repo-cli-gh-git-consolidation/ops/groups-differential-w7.ts",
    base: "8602b24203",
    frozen: "ops/frozen-w7b/",
    git: yield* run(repoRoot, ["--version"]),
    counts: {
      scenarios: rows.length,
      git: gitRows.length,
      github: githubRows.length,
      same: A.filter(rows, (row) => row.verdict === "same").length,
      classified: A.filter(rows, (row) => row.verdict === "classified").length,
      unclassified: unclassified.length,
    },
    gates,
    rows,
  };
  const json = JSON.stringify(report, null, 2);
  yield* pipe(
    O.flatMap(outFlag, (index) => A.get(argv, index + 1)),
    O.match({
      onNone: () => Console.log(json),
      onSome: (out) => fs.writeFileString(out, `${json}\n`),
    })
  );
  yield* Console.error(`gates: ${JSON.stringify(gates)} (${JSON.stringify(report.counts)})`);
  for (const row of unclassified) {
    yield* Console.error(`unclassified: ${row.site} / ${row.scenario}\n  old ${show(row.old)}\n  new ${show(row.new)}`);
  }
  if (!gates.unclassified) process.exitCode = 1;
});

NodeRuntime.runMain(
  Layer.build(Layer.provideMerge(Git.layer, Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))).pipe(
    Effect.flatMap((services) => program.pipe(Effect.provide(services))),
    Effect.scoped
  )
);
