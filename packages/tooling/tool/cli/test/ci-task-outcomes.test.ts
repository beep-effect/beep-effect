// ROUT-05 slice 2b (goals/certainty-scorecard, PLAN slice 11b): the per-task outcome records a lane job writes
// from its Turbo run summaries, the REST read of a run's record artifacts, and the capture that fills
// `HostedJob.tasks` from them. A seeded failing task is a `task` red, a seeded setup failure (no record) a
// `setup` red, and the captured rows decode under `route-corpus/v1`.

import { fcRuns } from "@beep/fc-runs";
import { GitHubClient } from "@beep/github/GitHubClient";
import { Repo } from "@beep/github/Repo";
import { RetryPolicy } from "@beep/github/Resilience";
import {
  HostedTaskOutcome,
  RouteCorpusCaptureOptions,
  TaskOutcomeRecord,
  taskOutcomeArtifactPrefix,
  taskOutcomesOf,
  writeTaskOutcomes,
} from "@beep/repo-cli/commands/Ci";
import { hostedJobRedOrigin } from "@beep/repo-cli/commands/Ci/RouteCensus";
import { makeRouteCorpus, makeRouteGithubRunner } from "@beep/repo-cli/commands/Ci/RouteCorpus";
import { layerGithubRest } from "@beep/repo-cli/test/SharedInternals";
import { provideScopedLayer } from "@beep/test-utils/Layer";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { zipSync } from "fflate";
import type { RouteGhRunner } from "@beep/repo-cli/commands/Ci/RouteCorpus";

const encode = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const decodeRecord = S.decodeUnknownEffect(S.fromJsonString(TaskOutcomeRecord));
const encodeRecord = S.encodeEffect(S.fromJsonString(TaskOutcomeRecord));
const encodeRecordValue = S.encodeEffect(TaskOutcomeRecord);
const Payload = S.Struct({ requests: S.Int, records: S.Array(TaskOutcomeRecord) });
const decodePayload = S.decodeUnknownEffect(S.fromJsonString(Payload));

const RUN = 9_000_001;
const DAY = "2026-11-17";
const HEAD = Str.repeat(40)("c");

// The production REST runner over a recorded fetch, as in ci-route-corpus.test.ts.
type RecordedFetch = typeof globalThis.fetch;

const restRunner = (fetch: RecordedFetch) =>
  makeRouteGithubRunner.pipe(
    provideScopedLayer(
      layerGithubRest.pipe(
        Layer.provideMerge(
          Layer.mergeAll(
            GitHubClient.layerFromToken({ token: Redacted.make("fixture"), fetch, retry: RetryPolicy.none }),
            Repo.layerFromSlug("example/repo")
          )
        )
      )
    )
  );

const outcomeRows = (rows: ReadonlyArray<HostedTaskOutcome>) => A.map(rows, (row) => `${row.task}=${row.outcome}`);

const record = (job: string, tasks: ReadonlyArray<readonly [string, HostedTaskOutcome["outcome"]]>) =>
  TaskOutcomeRecord.make({
    schemaVersion: "task-outcomes/v1",
    job,
    runId: O.some(RUN),
    runAttempt: O.some(1),
    tasks: A.map(tasks, ([task, outcome]) => HostedTaskOutcome.make({ task, outcome })),
  });

// The record is the wire shape the capture decodes from an artifact, so every value the schema admits must
// survive its JSON codec unchanged.
const sameRecord = S.toEquivalence(TaskOutcomeRecord);
it.effect.prop(
  "generated task-outcome records round-trip through the record codec",
  [Arbitrary.schema(TaskOutcomeRecord)],
  Effect.fnUntraced(function* ([generated]) {
    const text = yield* encodeRecord(generated);
    const decoded = yield* decodeRecord(text);
    assertTrue(sameRecord(decoded, generated));
    const again = yield* encodeRecord(decoded);
    strictEqual(again, text);
  }),
  { arbitrary: fcRuns(50) }
);

it.effect("maps exit codes to outcomes and keeps the strongest evidence across summaries", () =>
  Effect.sync(() => {
    const rows = taskOutcomesOf([
      {
        tasks: [
          { taskId: "@beep/c#test", execution: { exitCode: 0 } },
          { taskId: "@beep/a#test", execution: { exitCode: 2 } },
          { taskId: "@beep/b#test" },
          // Turbo writes a killed task, or a failure with no code, as `exitCode: null`.
          { taskId: "@beep/d#test", execution: { exitCode: null } },
        ],
      },
      {
        tasks: [
          { taskId: "@beep/a#test", execution: { exitCode: 0 } },
          { taskId: "@beep/b#test", execution: {} },
        ],
      },
      {},
    ]);
    deepStrictEqual(outcomeRows(rows), [
      "@beep/a#test=fail",
      "@beep/b#test=not-run",
      "@beep/c#test=pass",
      "@beep/d#test=unknown",
    ]);
    strictEqual(taskOutcomeArtifactPrefix(RUN, 2), `task-outcomes-${RUN}-2-`);
  })
);

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "30 seconds" })("ci task-outcomes", (it) => {
  it.effect("the command writes one record from every run summary, stamped with the run identity", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const temp = yield* fs.makeTempDirectoryScoped({ prefix: "beep-ci-task-outcomes-" });
      const root = yield* fs.realPath(temp);
      const manifest = yield* encode({ name: "fixture", private: true, workspaces: [] });
      yield* fs.writeFileString(path.join(root, "package.json"), manifest);
      yield* fs.makeDirectory(path.join(root, ".turbo", "runs"), { recursive: true });
      const first = yield* encode({ tasks: [{ taskId: "@beep/a#test", execution: { exitCode: 0 } }] });
      const second = yield* encode({ tasks: [{ taskId: "@beep/b#test", execution: { exitCode: 1 } }] });
      yield* fs.writeFileString(path.join(root, ".turbo", "runs", "1.json"), first);
      yield* fs.writeFileString(path.join(root, ".turbo", "runs", "2.json"), second);
      const out = ".beep/ci-task-outcomes/record.json";
      yield* writeTaskOutcomes(root, "Test Unit (unit-a)", out).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnvRecord({ GITHUB_RUN_ID: `${RUN}`, GITHUB_RUN_ATTEMPT: "1" })
        )
      );
      const text = yield* fs.readFileString(path.join(root, out));
      const written = yield* decodeRecord(text);
      deepStrictEqual(
        [written.job, written.runId, written.runAttempt, outcomeRows(written.tasks)],
        ["Test Unit (unit-a)", O.some(RUN), O.some(1), ["@beep/a#test=pass", "@beep/b#test=fail"]]
      );
    })
  );

  it.effect("the REST runner reads only this attempt's unexpired record artifacts and counts its requests", () =>
    Effect.gen(function* () {
      const recordText = yield* encodeRecord(record("Test Unit (unit-a)", [["@beep/a#test", "fail"]]));
      const archive = zipSync({ "record.json": new TextEncoder().encode(recordText) });
      const artifacts = {
        total_count: 4,
        artifacts: [
          { id: 1, name: `task-outcomes-${RUN}-1-test-unit-shard-unit-a`, expired: false },
          { id: 2, name: `task-outcomes-${RUN}-1-lint-shard-lint-1`, expired: true },
          { id: 3, name: `task-outcomes-${RUN}-2-test-unit-shard-unit-a`, expired: false },
          { id: 4, name: `unit-coverage-${RUN}-1-unit-a`, expired: false },
        ],
      };
      const listing = yield* encode(artifacts);
      const downloads: Array<string> = [];
      const fetch: RecordedFetch = Object.assign(
        (input: string | URL | Request): Promise<Response> => {
          const url = new URL(input instanceof Request ? input.url : input);
          const zip = Str.endsWith("/zip")(url.pathname);
          if (zip) downloads.push(url.pathname);
          const response = zip
            ? new Response(archive, { status: 200, headers: { "content-type": "application/zip" } })
            : new Response(listing, { status: 200, headers: { "content-type": "application/json" } });
          Object.defineProperty(response, "url", { value: url.href });
          return Promise.resolve(response);
        },
        { preconnect: () => undefined }
      );
      const run = yield* restRunner(fetch);
      const text = yield* run(["run", "task-outcomes", `${RUN}`, "1"], ".");
      const payload = yield* decodePayload(text);
      deepStrictEqual(downloads, ["/repos/example/repo/actions/artifacts/1/zip"]);
      deepStrictEqual(
        [payload.requests, A.map(payload.records, (entry) => [entry.job, outcomeRows(entry.tasks)])],
        [2, [["Test Unit (unit-a)", ["@beep/a#test=fail"]]]]
      );
    })
  );

  it.effect("the capture fills failed jobs' tasks, so a failed task is `task` and a setup failure `setup`", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const temp = yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-task-outcomes-" });
      const root = yield* fs.realPath(temp);
      yield* TestClock.setTime(DateTime.makeUnsafe("2026-11-18T12:00:00Z").pipe(DateTime.toEpochMillis));
      const step = (name: string, conclusion: string) => ({ name, conclusion });
      const job = (name: string, conclusion: string, steps: ReadonlyArray<{ readonly name: string }>) => ({
        name,
        conclusion,
        startedAt: `${DAY}T08:00:00Z`,
        completedAt: `${DAY}T08:10:00Z`,
        steps,
      });
      const view = yield* encode({
        databaseId: RUN,
        workflowName: "Check",
        event: "pull_request",
        status: "completed",
        conclusion: "failure",
        createdAt: `${DAY}T08:00:00Z`,
        headBranch: "feat/seeded",
        headSha: HEAD,
        attempt: 1,
        jobs: [
          job("Test Unit (unit-a)", "failure", [
            step("Setup monorepo CI", "success"),
            step("Run Test Unit shard", "failure"),
          ]),
          job("Lint (lint-1)", "failure", [step("Setup monorepo CI", "failure"), step("Run Lint shard", "skipped")]),
          job("Test Unit (unit-b) / Test Unit (unit-b)", "failure", [
            step("Run Test Unit shard", "success"),
            step("Upload Unit coverage evidence", "failure"),
          ]),
          job("Test Unit (unit-c)", "success", [step("Run Test Unit shard", "success")]),
        ],
      });
      const list = yield* encode([
        {
          databaseId: RUN,
          workflowName: "Check",
          event: "pull_request",
          status: "completed",
          conclusion: "failure",
          createdAt: `${DAY}T08:00:00Z`,
          updatedAt: `${DAY}T08:20:00Z`,
          headBranch: "feat/seeded",
          headSha: HEAD,
          attempt: 1,
        },
      ]);
      // The Lint shard died in setup before it could write a record; unit-c passed and has one the capture
      // must not attach, since only failed jobs keep tasks.
      const records = yield* Effect.forEach(
        [
          record("Test Unit (unit-a)", [
            ["@beep/a#test", "pass"],
            ["@beep/b#test", "fail"],
          ]),
          record("Test Unit (unit-b)", [["@beep/c#test", "pass"]]),
          record("Test Unit (unit-c)", [["@beep/d#test", "pass"]]),
        ],
        (entry) => encodeRecordValue(entry),
        { concurrency: 1 }
      );
      const outcomes = yield* encode({ requests: 4, records });
      const calls: Array<string> = [];
      const runGh: RouteGhRunner = (args) => {
        calls.push(A.join(args.slice(0, 2), " "));
        return Effect.succeed(
          args[1] === "list"
            ? args[5] === DAY && args[3] === "Check"
              ? list
              : "[]"
            : args[1] === "task-outcomes"
              ? outcomes
              : view
        );
      };
      const corpus = yield* makeRouteCorpus(runGh);
      const receipt = yield* corpus.capture(
        RouteCorpusCaptureOptions.make({
          repoRoot: root,
          since: DAY,
          until: O.some(DAY),
          workflows: ["Check"],
          outDir: "corpus",
        })
      );
      strictEqual(A.length(A.filter(calls, (call) => call === "run task-outcomes")), 1);
      deepStrictEqual(receipt.taskOutcomeReads, O.some(4));
      const loaded = yield* corpus.load(`${root}/corpus/RECEIPTS.json`);
      const jobs = A.flatMap(loaded.runs, (run) => run.jobs);
      deepStrictEqual(
        A.map(jobs, (entry) => [
          entry.name,
          O.getOrNull(hostedJobRedOrigin(entry)),
          O.getOrNull(O.map(entry.tasks, outcomeRows)),
        ]),
        [
          ["Test Unit (unit-a)", "task", ["@beep/a#test=pass", "@beep/b#test=fail"]],
          ["Lint (lint-1)", "setup", null],
          ["Test Unit (unit-b) / Test Unit (unit-b)", "harness", ["@beep/c#test=pass"]],
          ["Test Unit (unit-c)", null, null],
        ]
      );
    })
  );
});
