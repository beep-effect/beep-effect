import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import {
  boundFailingRegion,
  CiFailuresTarget,
  CiRunJob,
  ciFailuresCommand,
  FAILED_JOB_ARTIFACT_DOWNLOADS_MAX,
  FeedArtifactRef,
  printCiFailures,
  rankFeedArtifacts,
  runCiFailures,
} from "@beep/repo-cli/commands/Ci";
import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import { agentBudget } from "@beep/repo-gate-run/GateConsole";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, it } from "@effect/vitest";
import { assertInclude, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Stdio from "effect/Stdio";
import * as Str from "effect/String";
import * as Terminal from "effect/Terminal";
import * as TestConsole from "effect/testing/TestConsole";
import { zipSync } from "fflate";
import recordedJobs from "./fixtures/ci-gate-reports/run-jobs.json" with { type: "json" };
import { bytes, feedZip, gateRecordJson, gateReport, packageEntry, v1Json, v2Json } from "./support/FeedFixtures.ts";
import { provideBuilt, restRoutes } from "./support/RestRoutes.ts";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import type { RestReply } from "./support/RestRoutes.ts";

const RUN = 45042229032;
const HEAD = "4e3343774cc5a1b2c3d4e5f6a7b8c9d0e1f2a3b4";
const PACKAGE = "packages/tooling/tool/cli";

const runWire = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: "Check",
  workflow_id: 180254693,
  head_sha: HEAD,
  head_branch: "feat/demo",
  status: "completed",
  conclusion: "failure",
  created_at: "2026-11-22T10:58:03Z",
  run_attempt: 2,
  ...overrides,
});

const testEntry = packageEntry({ packageDir: PACKAGE, gate: "test", subject: "@beep/repo-cli" });
const reportedZip = feedZip({
  recordJson: v2Json({ job: "Test Unit (repo-cli-8)", reports: [testEntry] }),
  files: {
    [testEntry.record]: gateRecordJson(
      gateReport({ gate: "test", subject: "@beep/repo-cli", messages: ["expected 2 to be 3"] })
    ),
    [testEntry.log]: "raw\n",
  },
});

const artifact = (id: number, name: string, expired = false) => ({
  id,
  name,
  expired,
  size_in_bytes: 512,
});

const stamped = (lines: ReadonlyArray<string>) =>
  A.join(
    A.map(lines, (line) => `2026-11-22T10:40:00.0000000Z ${line}`),
    "\n"
  );
const boundedEndpointLog = stamped([
  "##[group]Run bun install",
  "installed",
  "##[group]Run bun run beep ci lane test-integration",
  "Error: connect ECONNREFUSED 127.0.0.1:5432",
  "##[error]Process completed with exit code 1.",
  "Post job cleanup.",
]);
const unboundedEndpointLog = stamped(["##[group]Run checks", "no marker here"]);

const ghLogFailed = A.join(
  [
    "Lint (lint-2)\tRun lane\t2026-11-22T10:05:00.0000000Z lint: packages/a/src/x.ts:3:1 noUnusedVariables",
    "Lint (lint-2)\tRun lane\t2026-11-22T10:05:01.0000000Z ##[error]Process completed with exit code 1.",
  ],
  "\n"
);

const isPath = (suffix: string) => (url: URL) => Str.endsWith(suffix)(url.pathname);

const runRoutes =
  (options: {
    readonly jobs: unknown;
    readonly artifacts: ReadonlyArray<unknown>;
    readonly zips: Record<string, Uint8Array>;
  }) =>
  (url: URL): RestReply => {
    if (isPath(`/actions/runs/${RUN}`)(url)) return { json: runWire(RUN) };
    if (isPath("/jobs")(url)) return { json: options.jobs };
    if (isPath("/artifacts")(url))
      return { json: { total_count: options.artifacts.length, artifacts: options.artifacts } };
    if (isPath("/zip")(url)) {
      const id = Str.split(url.pathname, "/").at(-2) ?? "";
      return id in options.zips ? { zip: options.zips[id]! } : { text: "not a zip" };
    }
    if (isPath("/actions/jobs/104/logs")(url)) return { text: boundedEndpointLog };
    if (isPath("/actions/jobs/106/logs")(url)) return { text: unboundedEndpointLog };
    return { json: { message: "Not Found" }, status: 404 };
  };

const ghSpawner = (answers: Record<string, { readonly stdout: string; readonly exit: number }>) =>
  ScriptedSpawner.make((_command, args) => {
    const job = args[3] ?? "";
    return answers[job] ?? { exit: 1, stderr: "run is still in progress; logs will be available when it is complete" };
  });

const lineOf = (lines: ReadonlyArray<string>, needle: string): number =>
  O.getOrElse(A.findFirstIndex(lines, Str.includes(needle)), () => -1);

const CommandSupport = Layer.mergeAll(
  Stdio.layerTest({ stdinIsTerminal: Effect.succeed(false), stdoutIsTerminal: Effect.succeed(false) }),
  Layer.succeed(
    Terminal.Terminal,
    Terminal.make({
      columns: Effect.succeed(80),
      rows: Effect.succeed(24),
      size: Effect.die("unused"),
      readInput: Effect.die("unused"),
      readLine: Effect.die("unused"),
      display: () => Effect.void,
    })
  )
);

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, CommandSupport), { timeout: "60 seconds" })(
  "ci failures",
  (it) => {
    it.effect("prints reports for a reported job, the bounded region for the others, and records the run", () => {
      const transport = restRoutes(
        runRoutes({
          jobs: recordedJobs,
          artifacts: [
            artifact(1, `task-outcomes-${RUN}-2-test-unit-shard-repo-cli-8`),
            artifact(2, `task-outcomes-${RUN}-2-lint-shard-lint-2`),
            artifact(3, `task-outcomes-${RUN}-2-test-integration-shard-integration-1`),
            artifact(4, `task-outcomes-${RUN}-1-test-unit-shard-repo-cli-8`),
            artifact(5, `task-outcomes-${RUN}-2-docs-policy-single`, true),
            artifact(6, `turbo-summary-verify-lint`),
          ],
          zips: { "1": reportedZip, "2": zipSync({ "record.json": bytes(v1Json("Lint (lint-2)")) }) },
        })
      );
      const spawner = ghSpawner({ "103": { stdout: ghLogFailed, exit: 0 } });
      return Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const temp = yield* fs.makeTempDirectoryScoped({ prefix: "beep-ci-failures-" });
        const root = yield* fs.realPath(temp);
        const lines = yield* printCiFailures(root, CiFailuresTarget.cases.RunTarget.make({ runId: RUN }));
        const text = A.join(lines, "\n");
        assertInclude(
          lines[0]!,
          `run ${RUN} attempt 2 (Check) at ${HEAD}: 4 failed jobs; record .beep/gates/run/${RUN}-2.json`
        );
        assertInclude(text, `reports: artifact task-outcomes-${RUN}-2-test-unit-shard-repo-cli-8 (no log fetched)`);
        assertInclude(text, "expected 2 to be 3");
        assertTrue(A.every(spawner.spawns, (spawn) => spawn.args[3] !== "102"));
        assertTrue(A.every(transport.calls, (url) => !Str.includes("/jobs/102/")(url.pathname)));
        const lint = A.drop(lines, lineOf(lines, "== job Lint (lint-2)"));
        assertInclude(lint[1]!, "run Check #45042229032");
        assertInclude(lint[2]!, "noUnusedVariables");
        strictEqual(lint[1], lint[5]);
        assertInclude(lint[4]!, `full log: .beep/gates/run/${RUN}-2.log (`);
        const integration = A.drop(lines, lineOf(lines, "== job Test Integration"));
        assertInclude(integration[2]!, "Run bun run beep ci lane test-integration");
        assertInclude(text, "ECONNREFUSED");
        assertTrue(!Str.includes("installed")(text));
        assertInclude(text, "Docs Policy: the failing step could not be bounded; full log: .beep/gates/run/");
        const store = yield* GateRecordStore.make(root);
        const record = yield* store.readRecord(RecordTarget.cases.RootTarget.make({ gate: "run", runId: `${RUN}-2` }));
        strictEqual(record.report.gate, "run");
        strictEqual(record.report.units.length, 6);
        const saved = yield* fs.readFileString(path.join(root, `.beep/gates/run/${RUN}-2.log`));
        assertInclude(saved, "==> job Lint (lint-2) (103)");
        assertInclude(saved, "installed");
        assertInclude(saved, "no marker here");
        assertTrue(!Str.includes("==> job Test Unit")(saved));
        assertTrue(A.every(transport.calls, (url) => !Str.includes("graphql")(url.pathname)));
        deepStrictEqual(
          A.map(A.filter(transport.calls, isPath("/zip")), (url) => url.pathname),
          [
            "/repos/example/repo/actions/artifacts/1/zip",
            "/repos/example/repo/actions/artifacts/3/zip",
            "/repos/example/repo/actions/artifacts/2/zip",
          ]
        );
      }).pipe(provideSpawner(spawner), provideBuilt(transport.layer));
    });

    it.effect(
      "reads a pull request's newest failed runs, stops downloading once every job is joined, and says when a log is unreadable",
      () => {
        const jobs = {
          total_count: 1,
          jobs: [
            {
              id: 201,
              name: "Test Unit (unit-a)",
              status: "completed",
              conclusion: "failure",
              steps: [{ name: "Run lane", status: "completed", conclusion: "failure", number: 1 }],
            },
          ],
        };
        const quietJobs = {
          total_count: 1,
          jobs: [{ id: 301, name: "Build", status: "completed", conclusion: "success", steps: [] }],
        };
        const transport = restRoutes((url) => {
          if (isPath("/pulls/77")(url)) return { json: { head: { sha: HEAD } } };
          if (isPath("/actions/runs")(url)) {
            return {
              json: {
                workflow_runs: [
                  runWire(500, { created_at: "2026-11-22T09:00:00Z" }),
                  runWire(501, { created_at: "2026-11-22T10:00:00Z" }),
                  runWire(600, { workflow_id: 2, conclusion: "success" }),
                  runWire(700, {
                    workflow_id: 3,
                    conclusion: null,
                    status: "in_progress",
                    run_attempt: undefined,
                    name: null,
                    head_branch: "",
                  }),
                ],
              },
            };
          }
          if (isPath("/runs/501/jobs")(url)) return { json: jobs };
          if (isPath("/runs/700/jobs")(url)) return { json: quietJobs };
          if (isPath("/artifacts")(url)) {
            return {
              json: {
                total_count: 2,
                artifacts: [
                  artifact(11, "task-outcomes-501-2-test-unit-shard-unit-a"),
                  artifact(12, "task-outcomes-501-2-test-unit-shard-unit-b"),
                ],
              },
            };
          }
          if (isPath("/artifacts/11/zip")(url)) {
            return { zip: feedZip({ recordJson: v2Json({ job: "Test Unit (unit-a)", reports: [] }), files: {} }) };
          }
          return { json: { message: "Not Found" }, status: 404 };
        });
        const spawner = ghSpawner({});
        return Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const temp = yield* fs.makeTempDirectoryScoped({ prefix: "beep-ci-failures-pr-" });
          const root = yield* fs.realPath(temp);
          const lines = yield* printCiFailures(root, CiFailuresTarget.cases.PullTarget.make({ number: 77 }));
          const text = A.join(lines, "\n");
          assertInclude(text, "run 501 attempt 2 (Check)");
          assertTrue(!Str.includes("run 500 ")(text));
          assertTrue(!Str.includes("run 600 ")(text));
          assertInclude(text, "run 700 attempt 1 (workflow 3) at");
          assertInclude(text, ": no failed job");
          assertInclude(text, "Test Unit (unit-a): no log yet (gh refused and the job log endpoint failed)");
          deepStrictEqual(
            A.map(A.filter(transport.calls, isPath("/zip")), (url) => url.pathname),
            ["/repos/example/repo/actions/artifacts/11/zip"]
          );
          assertTrue(!(yield* fs.exists(`${root}/.beep/gates/run/501-2.log`)));
          const recorded = yield* fs.exists(`${root}/.beep/gates/run/501-2.json`);
          assertTrue(recorded);
        }).pipe(provideSpawner(spawner), provideBuilt(transport.layer));
      }
    );

    it.effect("says so when a pull request's head has no failed or running run", () => {
      const transport = restRoutes((url) =>
        isPath("/pulls/8")(url)
          ? { json: { head: { sha: HEAD } } }
          : { json: { workflow_runs: [runWire(1, { conclusion: "success" })] } }
      );
      return Effect.gen(function* () {
        const lines = yield* printCiFailures(".", CiFailuresTarget.cases.PullTarget.make({ number: 8 }));
        deepStrictEqual(lines, ["no failed or running workflow run at the pull request's head"]);
      }).pipe(provideSpawner(ghSpawner({})), provideBuilt(transport.layer));
    });

    it.effect("fails with a CiCommandError when the run, its jobs or its artifacts cannot be read", () =>
      Effect.gen(function* () {
        const run = CiFailuresTarget.cases.RunTarget.make({ runId: RUN });
        const refused = yield* printCiFailures(".", run).pipe(
          Effect.flip,
          provideBuilt(restRoutes(() => ({ json: {}, status: 500 })).layer)
        );
        assertInclude(refused.message, "workflow runs");
        const noJobs = yield* printCiFailures(".", run).pipe(
          Effect.flip,
          provideBuilt(
            restRoutes((url) => (isPath(`/runs/${RUN}`)(url) ? { json: runWire(RUN) } : { json: {}, status: 500 }))
              .layer
          )
        );
        assertInclude(noJobs.message, "jobs");
        const noArtifacts = yield* printCiFailures(".", run).pipe(
          Effect.flip,
          provideBuilt(
            restRoutes((url) =>
              isPath(`/runs/${RUN}`)(url)
                ? { json: runWire(RUN) }
                : isPath("/jobs")(url)
                  ? { json: recordedJobs }
                  : { json: {}, status: 500 }
            ).layer
          )
        );
        assertInclude(noArtifacts.message, "artifacts");
      }).pipe(provideSpawner(ghSpawner({})))
    );

    it.effect("reports a record it cannot write as a CiCommandError", () => {
      const transport = restRoutes(runRoutes({ jobs: recordedJobs, artifacts: [], zips: {} }));
      return Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const temp = yield* fs.makeTempDirectoryScoped({ prefix: "beep-ci-failures-ro-" });
        const root = yield* fs.realPath(temp);
        yield* fs.writeFileString(`${root}/.beep`, "not a directory");
        const error = yield* Effect.flip(printCiFailures(root, CiFailuresTarget.cases.RunTarget.make({ runId: RUN })));
        assertInclude(error.message, `Failed to record run ${RUN} under .beep/gates/run/${RUN}-2.json`);
      }).pipe(provideSpawner(ghSpawner({})), provideBuilt(transport.layer));
    });

    it.effect("the command needs exactly one of --run and --pr, and runs one", () => {
      const byRun = runRoutes({ jobs: { total_count: 0, jobs: [] }, artifacts: [], zips: {} });
      const transport = restRoutes((url) =>
        isPath("/pulls/77")(url)
          ? { json: { head: { sha: HEAD } } }
          : isPath("/actions/runs")(url)
            ? { json: { workflow_runs: [] } }
            : byRun(url)
      );
      const repoRoot = Effect.succeed(".");
      const run = (flags: { readonly run?: number; readonly pr?: number }) =>
        runCiFailures({ run: O.fromUndefinedOr(flags.run), pr: O.fromUndefinedOr(flags.pr), repoRoot }).pipe(
          provideBuilt(transport.layer)
        );
      const live = Command.runWith(ciFailuresCommand, { version: "0.0.0" });
      return Effect.gen(function* () {
        const neither = yield* Effect.exit(live([]));
        strictEqual(neither._tag, "Failure");
        const both = yield* Effect.exit(run({ run: 1, pr: 2 }));
        strictEqual(both._tag, "Failure");
        const errors = yield* TestConsole.errorLines;
        deepStrictEqual(A.dedupe(A.map(errors, String)), ["[ci] Pass exactly one of --run <id> and --pr <number>."]);
        yield* run({ run: RUN });
        const logs = yield* TestConsole.logLines;
        assertTrue(A.some(A.map(logs, String), Str.includes(`run ${RUN} attempt 2 (Check) at ${HEAD}: no failed job`)));
        yield* run({ pr: 77 });
        const prLogs = yield* TestConsole.logLines;
        assertTrue(A.some(A.map(prLogs, String), Str.includes("no failed or running workflow run")));
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), provideSpawner(ghSpawner({})));
    });
  }
);

describe("failing-region bounds", () => {
  it("keeps the region's tail within core's agent budget and counts what it left out", () => {
    const region = A.join(
      A.makeBy(400, (index) => `line ${index} ${Str.repeat(60)("x")}`),
      "\n"
    );
    const kept = boundFailingRegion(region, 400);
    assertTrue(A.join(kept, "\n").length <= agentBudget.maxChars - 400);
    assertInclude(kept[0]!, "earlier lines in the full log");
    assertInclude(kept.at(-1)!, "line 399");
    const long = boundFailingRegion(100)(Str.repeat(1000)("y"));
    strictEqual(long[0]!.length, agentBudget.maxLineChars);
    assertTrue(Str.endsWith("...")(long[0]!));
    deepStrictEqual(boundFailingRegion("short", 0), ["short"]);
  });

  it("ranks only this attempt's live artifacts that share a word with a failed job, at most the cap", () => {
    const job = CiRunJob.make({ id: 1, name: "Test Unit (unit-a)", status: "completed", conclusion: "failure" });
    const ref = (id: number, name: string) => FeedArtifactRef.make({ id, name, expired: false, size_in_bytes: 1 });
    const many = A.makeBy(FAILED_JOB_ARTIFACT_DOWNLOADS_MAX + 2, (index) =>
      ref(index + 10, `task-outcomes-9-1-unit-${index}`)
    );
    const ranked = rankFeedArtifacts({
      prefix: "task-outcomes-9-1-",
      artifacts: [
        ref(1, "task-outcomes-9-1-nix-shell-single"),
        ref(2, "task-outcomes-9-1-test-unit-shard-unit-a"),
        ...many,
      ],
      jobs: [job],
    });
    strictEqual(ranked[0]!.id, 2);
    strictEqual(ranked.length, FAILED_JOB_ARTIFACT_DOWNLOADS_MAX);
    assertTrue(A.every(ranked, (found) => found.id !== 1));
  });
});
