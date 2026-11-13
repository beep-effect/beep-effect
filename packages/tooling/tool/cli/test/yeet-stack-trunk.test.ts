// Trunk health for slice C's `stack-only-on-green-main` decision: each
// required context's newest completed evidence on first-parent trunk history.
import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git } from "@beep/git/Git";
import {
  decideYeetTrunkHealth,
  MergeGateCheckRun,
  RepoRunContext,
  readYeetTrunkHealth,
  TurboPlanSnapshot,
  YEET_TRUNK_HEALTH_COMMIT_LIMIT,
  YeetTrunkCommitChecks,
  YeetTrunkHealth,
} from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { assertSome, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import { recordedGithub } from "./support/YeetGithub.ts";
import type { GithubAnswer, GithubCall } from "./support/YeetGithub.ts";

const sha = (index: number) => Str.repeat(40)(`${index % 10}`);

const run = (id: number, name: string, conclusion: string | null, status = "completed") =>
  MergeGateCheckRun.make({ id, name, status, conclusion });

const commit = (index: number, ...runs: ReadonlyArray<MergeGateCheckRun>) =>
  YeetTrunkCommitChecks.make({ sha: sha(index), runs });

const green = (index: number) => YeetTrunkHealth.cases.Green.make({ sha: sha(index) });

const unknownDetail = YeetTrunkHealth.match({
  Green: () => "green",
  Red: () => "red",
  Unknown: ({ detail }) => detail,
});

describe("decideYeetTrunkHealth", () => {
  it("is green when every required context's newest evidence passed", () => {
    deepStrictEqual(
      decideYeetTrunkHealth(
        ["Lint", "Test Unit"],
        [commit(1, run(1, "Lint", "success"), run(2, "Test Unit", "skipped"))]
      ),
      green(1)
    );
  });

  it("is red at the trunk head, naming every red context sorted", () => {
    const commits = [
      commit(1, run(5, "Test Unit", "failure")),
      commit(2, run(3, "Lint", "timed_out"), run(4, "Check", "success")),
    ];
    deepStrictEqual(
      decideYeetTrunkHealth(["Test Unit", "Lint", "Check"], commits),
      YeetTrunkHealth.cases.Red.make({ sha: sha(1), contexts: ["Lint", "Test Unit"] })
    );
  });

  it("skips cancelled, stale and unfinished runs for older evidence", () => {
    const commits = [
      commit(1, run(9, "Lint", "cancelled"), run(8, "Check", null, "in_progress")),
      commit(2, run(7, "Lint", "stale")),
      commit(3, run(2, "Lint", "success"), run(1, "Check", "neutral")),
    ];
    deepStrictEqual(decideYeetTrunkHealth(["Lint", "Check"], commits), green(1));
    deepStrictEqual(
      decideYeetTrunkHealth(["Lint"], [commit(1, run(9, "Lint", "cancelled")), commit(2, run(1, "Lint", "failure"))]),
      YeetTrunkHealth.cases.Red.make({ sha: sha(1), contexts: ["Lint"] })
    );
  });

  it("takes the newest run of a context on one commit, so a re-run wins by id", () => {
    deepStrictEqual(
      decideYeetTrunkHealth(["Lint"], [commit(1, run(6, "Lint", "success"), run(5, "Lint", "failure"))]),
      green(1)
    );
    deepStrictEqual(
      decideYeetTrunkHealth(["Lint"], [commit(1, run(5, "Lint", "success"), run(6, "Lint", "failure"))]),
      YeetTrunkHealth.cases.Red.make({ sha: sha(1), contexts: ["Lint"] })
    );
  });

  it("is unknown while a required context has no evidence in the commits read", () => {
    deepStrictEqual(
      decideYeetTrunkHealth(["Lint", "Test Unit"], [commit(1, run(1, "Lint", "success")), commit(2)]),
      YeetTrunkHealth.cases.Unknown.make({ detail: "no completed run of Test Unit in the newest 2 trunk commit(s)" })
    );
  });

  it("is unknown with no required context or no commit", () => {
    deepStrictEqual(
      decideYeetTrunkHealth([], [commit(1, run(1, "Lint", "success"))]),
      YeetTrunkHealth.cases.Unknown.make({ detail: "the trunk's rulesets declare no required status context" })
    );
    deepStrictEqual(
      decideYeetTrunkHealth(["Lint"], []),
      YeetTrunkHealth.cases.Unknown.make({ detail: "no trunk commit was read" })
    );
  });
});

const context = RepoRunContext.make({
  base: "origin/main",
  branch: "feat/child",
  cwd: "/repo",
  head: "HEAD",
  originalArgv: [],
  packetDir: ".beep/yeet",
  repoRoot: "/repo",
  turbo: TurboPlanSnapshot.make({ graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }),
});

const rules = (...contexts: ReadonlyArray<string>): GithubAnswer => ({
  body: [
    {
      type: "required_status_checks",
      parameters: { required_status_checks: A.map(contexts, (name) => ({ context: name })) },
    },
  ],
});

const checkRunsAnswer = (...runs: ReadonlyArray<MergeGateCheckRun>): GithubAnswer => ({
  body: {
    total_count: A.length(runs),
    check_runs: A.map(runs, (entry) => ({
      id: entry.id,
      name: entry.name,
      status: entry.status,
      conclusion: entry.conclusion,
    })),
  },
});

// The trunk's first-parent history `git rev-list` prints, and the check runs on each commit.
const trunk = (
  options: {
    readonly required?: GithubAnswer;
    readonly revList?: { readonly exit: number; readonly stdout: string };
    readonly runs: (index: number) => GithubAnswer;
  },
  commitCount = 5
) => {
  const shas = A.makeBy(commitCount, (i) => sha(i + 1));
  const github = recordedGithub((call: GithubCall) => {
    if (call.path === "{repo}/rules/branches/main") return options.required ?? rules("Lint", "Test Unit");
    return O.match(
      A.findFirstIndex(shas, (entry) => call.path === `{repo}/commits/${entry}/check-runs`),
      { onNone: () => undefined, onSome: (i) => options.runs(i + 1) }
    );
  });
  const spawner = ScriptedSpawner.make((command, args) =>
    command === "git" && A.contains(args, "rev-list")
      ? (options.revList ?? { exit: 0, stdout: A.join(shas, "\n") })
      : { exit: 1, stdout: "" }
  );
  const read = readYeetTrunkHealth(context, "main").pipe(
    github.provide,
    Effect.provideServiceEffect(Git, Git.make),
    provideSpawner(spawner)
  );
  const checkRunReads = () => A.filter(github.calls, (call) => Str.endsWith("/check-runs")(call.path));
  return { read, spawner, checkRunReads };
};

describe("readYeetTrunkHealth", () => {
  it.effect("walks first-parent history and stops once every required context has evidence", () =>
    Effect.gen(function* () {
      const fixture = trunk({
        runs: (index) =>
          index === 1
            ? checkRunsAnswer(run(10, "Lint", "cancelled"))
            : index === 2
              ? checkRunsAnswer(run(8, "Lint", "success"))
              : checkRunsAnswer(run(5, "Test Unit", "success")),
      });
      const health = yield* fixture.read;
      deepStrictEqual(health, green(1));
      expect(fixture.checkRunReads()).toHaveLength(3);
      const revList = A.findFirst(fixture.spawner.spawns, (spawn) => A.contains(spawn.args, "rev-list"));
      assertSome(
        O.map(revList, (spawn) => A.join(spawn.args, " ")),
        `rev-list --max-count=${YEET_TRUNK_HEALTH_COMMIT_LIMIT} --first-parent origin/main`
      );
    })
  );

  it.effect("keeps reading past the first red so the verdict names every red context", () =>
    Effect.gen(function* () {
      const fixture = trunk({
        runs: (index) =>
          index === 1 ? checkRunsAnswer(run(9, "Lint", "failure")) : checkRunsAnswer(run(3, "Test Unit", "failure")),
      });
      const health = yield* fixture.read;
      deepStrictEqual(health, YeetTrunkHealth.cases.Red.make({ sha: sha(1), contexts: ["Lint", "Test Unit"] }));
      expect(fixture.checkRunReads()).toHaveLength(2);
    })
  );

  it.effect("is unknown when the walk runs out before a context has evidence", () =>
    Effect.gen(function* () {
      const fixture = trunk({ runs: () => checkRunsAnswer(run(1, "Lint", "success")) }, 3);
      const health = yield* fixture.read;
      deepStrictEqual(
        health,
        YeetTrunkHealth.cases.Unknown.make({ detail: "no completed run of Test Unit in the newest 3 trunk commit(s)" })
      );
      expect(fixture.checkRunReads()).toHaveLength(3);
    })
  );

  it.effect("turns every failed read into unknown with the reason", () =>
    Effect.gen(function* () {
      const failedRules = yield* trunk({
        required: { status: 500, body: { message: "boom" } },
        runs: () => checkRunsAnswer(),
      }).read;
      expect(unknownDetail(failedRules)).toMatch(/^main's required status contexts could not be read: /u);

      const failedHistory = yield* trunk({ revList: { exit: 128, stdout: "" }, runs: () => checkRunsAnswer() }).read;
      expect(unknownDetail(failedHistory)).toMatch(/^origin\/main's first-parent history could not be listed: /u);

      const failedRuns = trunk({ runs: () => ({ status: 500, body: { message: "boom" } }) });
      const unreadable = yield* failedRuns.read;
      expect(unknownDetail(unreadable)).toContain(
        `the check runs of main commit ${Str.slice(0, 10)(sha(1))} could not be read: `
      );
      expect(failedRuns.checkRunReads()).toHaveLength(1);
    })
  );

  it.effect("reads no history when the trunk declares no required context", () =>
    Effect.gen(function* () {
      const fixture = trunk({ required: { body: [] }, runs: () => checkRunsAnswer() });
      const health = yield* fixture.read;
      deepStrictEqual(
        health,
        YeetTrunkHealth.cases.Unknown.make({ detail: "the trunk's rulesets declare no required status context" })
      );
      expect(fixture.spawner.spawns).toHaveLength(0);
      expect(fixture.checkRunReads()).toHaveLength(0);
    })
  );
});
