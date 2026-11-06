// Frozen at 8602b24203: only the wire decoders and read expressions replayed by the differential.
// Import paths rebased; read expressions below retain the original argv and decoders.
import * as S from "effect/Schema";
import { GoalObservedCheckRun } from "../../../../packages/tooling/tool/cli/src/commands/Goals/CompletionEvidence.schemas.ts";
import { readGoalCompletionGit, readGoalCompletionGithub, readGoalCompletionJson } from "./CompletionEvidence.old.ts";
export const Pull = S.Struct({
  created_at: S.DateTimeUtcFromString,
  number: S.Int,
  merged: S.Boolean,
  merged_at: S.OptionFromNullOr(S.DateTimeUtcFromString),
  merge_commit_sha: S.OptionFromNullOr(S.NonEmptyString),
  head: S.Struct({ sha: S.NonEmptyString }),
  base: S.Struct({ ref: S.NonEmptyString, repo: S.Struct({ full_name: S.NonEmptyString }) }),
});
export const Commit = S.Struct({
  sha: S.NonEmptyString,
  parents: S.Array(S.Struct({ sha: S.NonEmptyString })),
  commit: S.Struct({ tree: S.Struct({ sha: S.NonEmptyString }) }),
});
export const CheckPages = S.Array(S.Struct({ check_runs: S.Array(GoalObservedCheckRun) }));
export const TimelinePages = S.Struct({ event: S.String, created_at: S.optionalKey(S.DateTimeUtcFromString) }).pipe(
  S.Array,
  S.Array
);

export const manifestAtHead = (root: string, head: string, slug: string) =>
  readGoalCompletionGit(root, ["show", `${head}:goals/${slug}/ops/manifest.json`]);
export const originUrl = (root: string) => readGoalCompletionGit(root, ["remote", "get-url", "origin"]);
export const hostedManifest = (root: string, head: string, slug: string) =>
  readGoalCompletionGithub(root, [
    "api",
    `repos/{owner}/{repo}/contents/goals/${slug}/ops/manifest.json?ref=${head}`,
    "-H",
    "Accept: application/vnd.github.raw+json",
  ]);
export const pullRequest = (root: string, number: number) =>
  readGoalCompletionJson(root, ["api", `repos/{owner}/{repo}/pulls/${number}`], Pull);
export const commit = (root: string, sha: string) =>
  readGoalCompletionJson(
    root,
    [
      "api",
      `repos/{owner}/{repo}/commits/${sha}`,
      "--jq",
      "{sha: .sha, parents: [.parents[] | {sha: .sha}], commit: {tree: {sha: .commit.tree.sha}}}",
    ],
    Commit
  );
export const checkRuns = (root: string, head: string) =>
  readGoalCompletionJson(
    root,
    ["api", `repos/{owner}/{repo}/commits/${head}/check-runs?per_page=100&filter=all`, "--paginate", "--slurp"],
    CheckPages
  );
export const timeline = (root: string, number: number) =>
  readGoalCompletionJson(
    root,
    ["api", `repos/{owner}/{repo}/issues/${number}/timeline?per_page=100`, "--paginate", "--slurp"],
    TimelinePages
  );
export const checkSuites = (root: string, head: string) =>
  readGoalCompletionJson(
    root,
    ["api", `repos/{owner}/{repo}/commits/${head}/check-suites?per_page=100`, "--paginate", "--slurp"],
    S.Struct({ check_suites: S.Array(S.Struct({ created_at: S.DateTimeUtcFromString })) }).pipe(S.Array)
  );
