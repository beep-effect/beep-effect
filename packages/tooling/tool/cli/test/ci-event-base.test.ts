import {
  CI_LANE_DEFAULT_BASE,
  CiEventBaseEventCommit,
  CiEventBaseFacts,
  CiEventBaseMergeFirstParent,
  CiEventBasePullRequestBase,
  readCiEventBaseFacts,
  renderCiEventBase,
  resolveCiEventBase,
  resolveCiEventBaseAt,
  resolveCiLaneBase,
} from "@beep/repo-cli/commands/Ci";
import { resolveCiCoverageArtifactPlan } from "@beep/repo-cli/commands/Quality/Tasks";
import { runRepoCommandCapture } from "@beep/repo-cli/test/RepoRun";
import { describe, expect, it } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { NodeCommandTestLayer } from "./support/CommandTest.ts";

// Pull-request runs diff against the checked-out merge commit's first parent,
// not pull_request.base.sha: PR #3228's run 43386625727 planned all 24 Test
// Unit shards from two main commits its stale base.sha counted as its own.

type FactFields = Parameters<typeof CiEventBaseFacts.make>[0];

const pullRequestFacts = (overrides: Partial<FactFields> = {}) =>
  CiEventBaseFacts.make({
    eventName: O.some("pull_request"),
    eventSha: O.some("merge"),
    eventBaseSha: O.some("stale-base"),
    eventHeadSha: O.some("head"),
    checkoutSha: "merge",
    checkoutParents: ["base", "head"],
    ...overrides,
  });

describe("resolveCiEventBase", () => {
  it.effect("takes the first parent of the verified merge-ref checkout", () =>
    Effect.gen(function* () {
      const base = yield* resolveCiEventBase(pullRequestFacts());
      deepStrictEqual(base, CiEventBaseMergeFirstParent.make({ sha: "base", eventBaseSha: O.some("stale-base") }));
    })
  );

  it.effect.each([
    {
      scenario: "a non-merge checkout",
      overrides: { checkoutSha: "head", checkoutParents: ["fork-point"] },
      gap: "HEAD head is not GITHUB_SHA merge",
    },
    {
      scenario: "an unset GITHUB_SHA",
      overrides: { eventSha: O.none() },
      gap: "HEAD merge is not GITHUB_SHA (unset)",
    },
    {
      scenario: "a single-parent GITHUB_SHA",
      overrides: { checkoutParents: ["base"] },
      gap: "HEAD has 1 parent(s), not the two of a merge commit",
    },
    {
      scenario: "an octopus merge",
      overrides: { checkoutParents: ["base", "head", "other"] },
      gap: "HEAD has 3 parent(s), not the two of a merge commit",
    },
    {
      scenario: "a parent mismatch",
      overrides: { eventHeadSha: O.some("other-head") },
      gap: "HEAD's second parent head is not pull_request.head.sha other-head",
    },
    {
      scenario: "an unset head sha",
      overrides: { eventHeadSha: O.none() },
      gap: "HEAD's second parent head is not pull_request.head.sha (unset)",
    },
  ] as const)("keeps pull_request.base.sha for $scenario", ({ overrides, gap }) =>
    Effect.gen(function* () {
      const base = yield* resolveCiEventBase(pullRequestFacts(overrides));
      deepStrictEqual(base, CiEventBasePullRequestBase.make({ sha: "stale-base", gap }));
    })
  );

  it.effect("refuses a pull request whose proof fails without a pull_request.base.sha", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        resolveCiEventBase(pullRequestFacts({ eventBaseSha: O.none(), checkoutParents: ["base"] }))
      );
      expect(error.message).toBe(
        "--event-base cannot prove a pull-request base: HEAD has 1 parent(s), not the two of a merge commit, and pull_request.base.sha is unset."
      );
    })
  );

  it.effect("uses a push event's own GITHUB_SHA", () =>
    Effect.gen(function* () {
      const base = yield* resolveCiEventBase(
        pullRequestFacts({
          eventName: O.some("push"),
          eventSha: O.some("pushed"),
          eventBaseSha: O.none(),
          eventHeadSha: O.none(),
          checkoutSha: "pushed",
          checkoutParents: ["previous"],
        })
      );
      deepStrictEqual(base, CiEventBaseEventCommit.make({ sha: "pushed" }));
    })
  );

  it.effect.each([
    { scenario: "a push", eventName: O.some("push") },
    { scenario: "a local run", eventName: O.none() },
  ] as const)("refuses $scenario without GITHUB_SHA", ({ eventName }) =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(resolveCiEventBase(pullRequestFacts({ eventName, eventSha: O.none() })));
      expect(error.message).toBe("--event-base needs GITHUB_SHA outside a pull_request event; pass --base.");
    })
  );
});

describe("renderCiEventBase", () => {
  it.each([
    [
      CiEventBaseMergeFirstParent.make({ sha: "base", eventBaseSha: O.some("stale-base") }),
      "[ci] base base: first parent of the pull request merge commit; pull_request.base.sha stale-base differs",
    ],
    [
      CiEventBaseMergeFirstParent.make({ sha: "base", eventBaseSha: O.some("base") }),
      "[ci] base base: first parent of the pull request merge commit; pull_request.base.sha base is the same commit",
    ],
    [
      CiEventBaseMergeFirstParent.make({ sha: "base", eventBaseSha: O.none() }),
      "[ci] base base: first parent of the pull request merge commit; pull_request.base.sha is unset",
    ],
    [
      CiEventBasePullRequestBase.make({ sha: "stale-base", gap: "HEAD has 1 parent(s)" }),
      "[ci] base stale-base: pull_request.base.sha, because HEAD has 1 parent(s)",
    ],
    [CiEventBaseEventCommit.make({ sha: "pushed" }), "[ci] base pushed: GITHUB_SHA of a non-pull-request event"],
  ] as const)("renders %#", (base, line) => {
    expect(renderCiEventBase(base)).toBe(line);
  });
});

const GIT_ENV = { GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
const GIT_IDENTITY = [
  "-c",
  "user.name=Event Base",
  "-c",
  "user.email=event-base@example.invalid",
  "-c",
  "commit.gpgsign=false",
];
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const withEnvironment = (env: Record<string, string>) =>
  Effect.provideService(
    ConfigProvider.ConfigProvider,
    ConfigProvider.fromUnknown({ BEEP_COVERAGE_RUN_ID: "1", BEEP_COVERAGE_RUN_ATTEMPT: "1", ...env })
  );

// A workspace with two coverage owners. Main changes a global coverage input
// while a pull request edits @beep/foo and merges that main; main then moves
// on before GitHub merges the pull request: the shape of PR #3228.
const fixture = Effect.fn("CiEventBaseTest.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "ci-event-base-" });
  const git = Effect.fn("CiEventBaseTest.git")(function* (...args: ReadonlyArray<string>) {
    const result = yield* runRepoCommandCapture("git", [...GIT_IDENTITY, ...args], root, GIT_ENV);
    expect(result.exitCode).toBe(0);
    return Str.trim(result.output);
  });
  const write = Effect.fn("CiEventBaseTest.write")(function* (file: string, text: string) {
    yield* fs.makeDirectory(path.dirname(path.join(root, file)), { recursive: true });
    yield* fs.writeFileString(path.join(root, file), text);
  });
  const writeJson = Effect.fn("CiEventBaseTest.writeJson")(function* (file: string, value: unknown) {
    const text = yield* encodeJson(value);
    yield* write(file, text);
  });
  const commit = Effect.fn("CiEventBaseTest.commit")(function* (file: string, text: string) {
    yield* write(file, text);
    yield* git("add", "--all");
    yield* git("commit", "--quiet", "--no-verify", "-m", `edit ${file}`);
    return yield* git("rev-parse", "HEAD");
  });
  // GitHub's refs/pull/N/merge: the base commit merged with the pull request head.
  const mergeRef = Effect.fn("CiEventBaseTest.mergeRef")(function* (base: string, head: string) {
    yield* git("switch", "--quiet", "--detach", base);
    yield* git("merge", "--quiet", "--no-ff", "--no-edit", head);
    return yield* git("rev-parse", "HEAD");
  });

  yield* writeJson("package.json", { name: "@beep/root", private: true, workspaces: ["packages/*"] });
  for (const name of ["foo", "bar"]) {
    yield* writeJson(`packages/${name}/package.json`, {
      name: `@beep/${name}`,
      private: true,
      scripts: { coverage: "vitest run --coverage" },
    });
    yield* write(`packages/${name}/src/${name}.ts`, `export const ${name} = 0;\n`);
  }
  yield* write(".github/workflows/check.yml", "name: Check\n");
  yield* git("init", "--quiet", "--template=", "--initial-branch=main", ".");
  yield* git("add", "--all");
  yield* git("commit", "--quiet", "--no-verify", "-m", "initial");
  const m0 = yield* git("rev-parse", "HEAD");

  yield* git("switch", "--quiet", "-c", "feature");
  yield* commit("packages/foo/src/foo.ts", "export const foo = 1;\n");
  yield* git("switch", "--quiet", "main");
  const m1 = yield* commit(".github/workflows/check.yml", "name: Check\non: push\n");
  yield* git("switch", "--quiet", "feature");
  yield* git("merge", "--quiet", "--no-ff", "--no-edit", "main");
  const head = yield* git("rev-parse", "HEAD");
  yield* git("switch", "--quiet", "main");
  const m2 = yield* commit("packages/bar/src/bar.ts", "export const bar = 2;\n");
  const merge = yield* mergeRef(m2, head);
  return { root, git, commit, mergeRef, m0, m1, m2, head, merge };
});

const pullRequestEnvironment = (merge: string, base: string, head: string) => ({
  GITHUB_EVENT_NAME: "pull_request",
  GITHUB_SHA: merge,
  BEEP_CI_PR_BASE_SHA: base,
  BEEP_CI_PR_HEAD_SHA: head,
});

const plannedOwners = (root: string, base: string) =>
  resolveCiCoverageArtifactPlan(root, ["--affected"], base).pipe(
    withEnvironment({}),
    Effect.map((plan) => ({
      scoped: plan.scoped,
      owners: A.map(plan.owners, (owner) => owner.packageName),
      baseSha: plan.identity.baseSha,
    }))
  );

const LiveLayer = Layer.merge(NodeCommandTestLayer, TestConsole.layer);

it.layer(LiveLayer, { timeout: "120 seconds" })("event base over a real merge checkout", (it) => {
  it.effect("plans only the pull request's own package after it merged a global-input change from main", () =>
    Effect.gen(function* () {
      const { root, m0, m2, head, merge } = yield* fixture();
      const base = yield* resolveCiEventBaseAt(root).pipe(withEnvironment(pullRequestEnvironment(merge, m0, head)));
      deepStrictEqual(base, CiEventBaseMergeFirstParent.make({ sha: m2, eventBaseSha: O.some(m0) }));
      const lines = yield* TestConsole.logLines;
      expect(lines).toContain(renderCiEventBase(base));

      const resolved = yield* plannedOwners(root, base.sha);
      expect(resolved).toEqual({ scoped: true, owners: ["@beep/foo"], baseSha: m2 });
      // The event base counts main's own commits as the pull request's: the
      // check.yml edit forces the full fallback, as on run 43386625727.
      const stale = yield* plannedOwners(root, m0);
      expect(stale).toEqual({ scoped: false, owners: ["@beep/bar", "@beep/foo"], baseSha: m0 });
    })
  );

  it.effect("keeps the full fallback when the pull request itself edits a global input", () =>
    Effect.gen(function* () {
      const { root, git, commit, mergeRef, m0, m2 } = yield* fixture();
      yield* git("switch", "--quiet", "feature");
      const head = yield* commit(".github/workflows/check.yml", "name: Check\non: pull_request\n");
      const merge = yield* mergeRef(m2, head);
      const base = yield* resolveCiEventBaseAt(root).pipe(withEnvironment(pullRequestEnvironment(merge, m0, head)));
      expect(base.sha).toBe(m2);
      const planned = yield* plannedOwners(root, base.sha);
      expect(planned).toEqual({ scoped: false, owners: ["@beep/bar", "@beep/foo"], baseSha: m2 });
    })
  );

  it.effect("resolves the same base on a re-run after main moved", () =>
    Effect.gen(function* () {
      const { root, git, m0, m2, head, merge } = yield* fixture();
      const env = withEnvironment(pullRequestEnvironment(merge, m0, head));
      const first = yield* resolveCiEventBaseAt(root).pipe(env);
      // A re-run keeps GITHUB_SHA and the payload; main and origin/main move on.
      const moved = yield* git("commit-tree", `${m2}^{tree}`, "-p", m2, "-m", "main moves");
      yield* git("update-ref", "refs/heads/main", moved);
      yield* git("update-ref", "refs/remotes/origin/main", moved);
      const rerun = yield* resolveCiEventBaseAt(root).pipe(env);
      deepStrictEqual(rerun, first);
      expect(rerun.sha).toBe(m2);
    })
  );

  it.effect("falls back to pull_request.base.sha off the merge commit", () =>
    Effect.gen(function* () {
      const { root, git, m0, m1, head, merge } = yield* fixture();
      // The pull request head is itself a merge of main, so it has two parents too.
      yield* git("switch", "--quiet", "--detach", head);
      const facts = yield* readCiEventBaseFacts(root).pipe(withEnvironment(pullRequestEnvironment(merge, m0, head)));
      expect(facts.checkoutParents).toHaveLength(2);
      expect(facts.checkoutParents[1]).toBe(m1);
      const offMerge = yield* resolveCiEventBase(facts);
      deepStrictEqual(
        offMerge,
        CiEventBasePullRequestBase.make({ sha: m0, gap: `HEAD ${head} is not GITHUB_SHA ${merge}` })
      );
      // Even named as GITHUB_SHA, its second parent is main's commit, not the head.
      const named = yield* resolveCiEventBaseAt(root).pipe(withEnvironment(pullRequestEnvironment(head, m0, head)));
      deepStrictEqual(
        named,
        CiEventBasePullRequestBase.make({
          sha: m0,
          gap: `HEAD's second parent ${m1} is not pull_request.head.sha ${head}`,
        })
      );
    })
  );

  it.effect("reads a root commit as parentless and a push as its own commit", () =>
    Effect.gen(function* () {
      const { root, git, m0 } = yield* fixture();
      yield* git("switch", "--quiet", "--detach", m0);
      const env = { GITHUB_EVENT_NAME: "push", GITHUB_SHA: m0, BEEP_CI_PR_BASE_SHA: "", BEEP_CI_PR_HEAD_SHA: "" };
      const facts = yield* readCiEventBaseFacts(root).pipe(withEnvironment(env));
      deepStrictEqual(
        facts,
        CiEventBaseFacts.make({
          eventName: O.some("push"),
          eventSha: O.some(m0),
          eventBaseSha: O.none(),
          eventHeadSha: O.none(),
          checkoutSha: m0,
          checkoutParents: [],
        })
      );
      const base = yield* resolveCiEventBase(facts);
      deepStrictEqual(base, CiEventBaseEventCommit.make({ sha: m0 }));
    })
  );

  it.effect("fails when the checkout has no HEAD commit", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "ci-event-base-empty-" });
      const init = yield* runRepoCommandCapture("git", ["init", "--quiet", "--template=", "."], root, GIT_ENV);
      expect(init.exitCode).toBe(0);
      const error = yield* Effect.flip(readCiEventBaseFacts(root));
      expect(error.message).toBe(`--event-base could not resolve HEAD in ${root}.`);
    })
  );
});

it.layer(LiveLayer, { timeout: "60 seconds" })("resolveCiLaneBase", (it) => {
  it.effect("keeps --base, or the default, without --event-base", () =>
    Effect.gen(function* () {
      const fallback = yield* resolveCiLaneBase(O.none(), false);
      expect(fallback).toBe(CI_LANE_DEFAULT_BASE);
      const explicit = yield* resolveCiLaneBase(O.some("origin/feature"), false);
      expect(explicit).toBe("origin/feature");
    })
  );

  it.effect("refuses --base beside --event-base", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(resolveCiLaneBase(O.some("origin/main"), true));
      expect(error.message).toBe(
        "--event-base resolves the base from the workflow event; it cannot be combined with --base."
      );
    })
  );

  it.effect("resolves --event-base from the checkout this process runs in", () =>
    Effect.gen(function* () {
      const resolved = yield* resolveCiLaneBase(O.none(), true).pipe(
        withEnvironment({ GITHUB_EVENT_NAME: "push", GITHUB_SHA: "pushed-sha" })
      );
      expect(resolved).toBe("pushed-sha");
      const lines = yield* TestConsole.logLines;
      expect(lines).toContain("[ci] base pushed-sha: GITHUB_SHA of a non-pull-request event");
    })
  );

  it.effect("check.yml coverage lanes pass --event-base instead of a precomputed base", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const source = yield* fs.readFileString(
        path.resolve(import.meta.dirname, "../../../../../.github/workflows/check.yml")
      );
      expect(source).not.toContain("BEEP_COVERAGE_BASE_SHA");
      expect(source).toContain("bun run beep ci lane test-unit --plan-partitions --affected --event-base");
      // Labs, the Test Unit shards and Coverage Regression share one shape.
      expect(A.length(Str.split(source, "shape_args=(--event-base)")) - 1).toBe(3);
    })
  );
});
