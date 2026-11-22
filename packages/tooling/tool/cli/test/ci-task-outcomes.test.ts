// ROUT-05 slice 2b (goals/certainty-scorecard, PLAN slice 11b): the per-task outcome records a lane job writes
// from its Turbo run summaries, the REST read of a run's record artifacts, and the capture that fills
// `HostedJob.tasks` from them. A seeded failing task is a `task` red, a seeded setup failure (no record) a
// `setup` red, and the captured rows decode under `route-corpus/v1`.

import { fcRuns } from "@beep/fc-runs";
import { GateRecord } from "@beep/gate-report/GateRecord";
import { GateReport, Totals } from "@beep/gate-report/GateReport";
import { GitHubClient } from "@beep/github/GitHubClient";
import { Repo } from "@beep/github/Repo";
import { RetryPolicy } from "@beep/github/Resilience";
import {
  AnyTaskOutcomeRecord,
  ciTaskOutcomesCommand,
  findJobGateRecords,
  GateFeedEntry,
  HostedTaskOutcome,
  RouteCorpusCaptureOptions,
  RouteCorpusReceipt,
  TaskOutcomeRecord,
  TaskOutcomeRecordV2,
  taskOutcomeArtifactPrefix,
  taskOutcomesOf,
  writeTaskOutcomes,
} from "@beep/repo-cli/commands/Ci";
import { makeRouteReadBudget } from "@beep/repo-cli/commands/Ci/RouteBudget";
import { hostedJobRedOrigin } from "@beep/repo-cli/commands/Ci/RouteCensus";
import { makeRouteCorpus, makeRouteGithubRunner, RouteGhRateLimited } from "@beep/repo-cli/commands/Ci/RouteCorpus";
import { layerGithubRest } from "@beep/repo-cli/test/SharedInternals";
import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import { provideScopedLayer } from "@beep/test-utils/Layer";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as Terminal from "effect/Terminal";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import { zipSync } from "fflate";
import type { RouteGhRunner } from "@beep/repo-cli/commands/Ci/RouteCorpus";

const encode = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const decodeRecord = S.decodeUnknownEffect(S.fromJsonString(TaskOutcomeRecord));
const decodeRecordV2 = S.decodeUnknownEffect(S.fromJsonString(TaskOutcomeRecordV2));
const decodeAnyRecord = S.decodeUnknownEffect(S.fromJsonString(AnyTaskOutcomeRecord));
const encodeRecordV2 = S.encodeEffect(S.fromJsonString(TaskOutcomeRecordV2));
const encodeReceipt = S.encodeEffect(S.fromJsonString(RouteCorpusReceipt));
const encodeRecord = S.encodeEffect(S.fromJsonString(TaskOutcomeRecord));
const encodeRecordValue = S.encodeEffect(TaskOutcomeRecord);
const Payload = S.Struct({ requests: S.Int, records: S.Array(TaskOutcomeRecord) });
const decodePayload = S.decodeUnknownEffect(S.fromJsonString(Payload));
const decodeAnyPayload = S.decodeUnknownEffect(
  S.fromJsonString(S.Struct({ requests: S.Int, records: S.Array(AnyTaskOutcomeRecord) }))
);
const isRateLimited = S.is(RouteGhRateLimited);

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

const sameRecordV2 = S.toEquivalence(TaskOutcomeRecordV2);
it.effect.prop(
  "generated task-outcomes/v2 records round-trip through the record codec",
  [Arbitrary.schema(TaskOutcomeRecordV2)],
  Effect.fnUntraced(function* ([generated]) {
    const text = yield* encodeRecordV2(generated);
    const decoded = yield* decodeRecordV2(text);
    assertTrue(sameRecordV2(decoded, generated));
    const again = yield* encodeRecordV2(decoded);
    strictEqual(again, text);
  }),
  { arbitrary: fcRuns(50) }
);

it.effect("the reader decodes a v1 and a v2 record, and refuses an unknown version", () =>
  Effect.gen(function* () {
    const v1 = yield* decodeAnyRecord('{"schemaVersion":"task-outcomes/v1","job":"Labs","tasks":[]}');
    const v2 = yield* decodeAnyRecord(
      '{"schemaVersion":"task-outcomes/v2","job":"Labs","tasks":[],"reports":[{"gate":"test","subject":"@beep/a","record":"packages/a/.beep/gates/test/report.json","log":"packages/a/.beep/gates/test/report.log"}]}'
    );
    deepStrictEqual([v1.schemaVersion, v2.schemaVersion], ["task-outcomes/v1", "task-outcomes/v2"]);
    assertTrue(AnyTaskOutcomeRecord.guards["task-outcomes/v2"](v2));
    deepStrictEqual(
      AnyTaskOutcomeRecord.guards["task-outcomes/v2"](v2) ? A.map(v2.reports, (entry) => entry.record) : [],
      ["packages/a/.beep/gates/test/report.json"]
    );
    const refused = yield* decodeAnyRecord('{"schemaVersion":"task-outcomes/v3","job":"Labs","tasks":[]}').pipe(
      Effect.flip
    );
    strictEqual(refused._tag, "SchemaError");
    // A feed entry's paths stay inside the repository.
    assertTrue(!S.is(GateFeedEntry)({ gate: "test", subject: "@beep/a", record: "../a.json", log: "a.log" }));
  })
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
          // e passed, then a later invocation killed it; f was killed in one and never ran in the other.
          { taskId: "@beep/e#test", execution: { exitCode: 0 } },
          { taskId: "@beep/f#test", execution: { exitCode: null } },
          // g was killed, then passed; h was killed, then failed.
          { taskId: "@beep/g#test", execution: { exitCode: null } },
          { taskId: "@beep/h#test", execution: { exitCode: null } },
        ],
      },
      {
        tasks: [
          { taskId: "@beep/a#test", execution: { exitCode: 0 } },
          { taskId: "@beep/b#test", execution: {} },
          { taskId: "@beep/e#test", execution: { exitCode: null } },
          { taskId: "@beep/f#test" },
          { taskId: "@beep/g#test", execution: { exitCode: 0 } },
          { taskId: "@beep/h#test", execution: { exitCode: 1 } },
        ],
      },
      {},
    ]);
    deepStrictEqual(outcomeRows(rows), [
      "@beep/a#test=fail",
      "@beep/b#test=not-run",
      "@beep/c#test=pass",
      "@beep/d#test=unknown",
      "@beep/e#test=unknown",
      "@beep/f#test=unknown",
      "@beep/g#test=unknown",
      "@beep/h#test=fail",
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
      // The gate records the job wrote: a package record with its log, a root run without one, and files that
      // are not gate records (a bad gate name, a bad run id, one under node_modules).
      const gateReport = (gate: string, subject: string) =>
        GateRecord.make({
          generatedAt: DateTime.makeUnsafe(0),
          report: GateReport.make({
            gate,
            subject,
            itemKind: "test",
            runId: "r1",
            startedAt: DateTime.makeUnsafe(0),
            durationMs: 0,
            inputFingerprint: "x",
            reason: "failed",
            outcome: "some-fail",
            units: [],
            items: [],
            totals: Totals.make({ collected: 1, failed: 1 }),
          }),
        });
      const store = yield* GateRecordStore.make(root);
      const packageTarget = RecordTarget.cases.PackageTarget.make({ packageDir: "packages/a", gate: "test" });
      yield* store.writeLog(packageTarget, Stream.make(new TextEncoder().encode("raw\n")));
      yield* store.writeRecord(packageTarget, gateReport("test", "@beep/a"));
      yield* store.writeRecord(
        RecordTarget.cases.RootTarget.make({ gate: "check", runId: "20261122T100000000Z-0001" }),
        gateReport("check", "@beep/root")
      );
      yield* fs.makeDirectory(path.join(root, "packages", "b", ".beep", "gates", "Bad_Gate"), { recursive: true });
      yield* fs.writeFileString(path.join(root, "packages", "b", ".beep", "gates", "Bad_Gate", "report.json"), "{}");
      yield* fs.makeDirectory(path.join(root, ".beep", "gates", "check"), { recursive: true });
      yield* fs.writeFileString(path.join(root, ".beep", "gates", "check", "-bad run.json"), "{}");
      yield* fs.makeDirectory(path.join(root, "node_modules", "x", ".beep", "gates", "test"), { recursive: true });
      yield* fs.writeFileString(path.join(root, "node_modules", "x", ".beep", "gates", "test", "report.json"), "{}");
      const found = yield* findJobGateRecords(root);
      deepStrictEqual(
        A.map(found, (entry) => [entry.target._tag, entry.report.subject, entry.logBytes]),
        [
          ["RootTarget", "@beep/root", O.none()],
          ["PackageTarget", "@beep/a", O.some(4)],
        ]
      );
      yield* writeTaskOutcomes(root, "Test Unit (unit-a)", out).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnvRecord({ GITHUB_RUN_ID: `${RUN}`, GITHUB_RUN_ATTEMPT: "1" })
        )
      );
      const text = yield* fs.readFileString(path.join(root, out));
      const written = yield* decodeRecordV2(text);
      deepStrictEqual(
        [written.job, written.runId, written.runAttempt, outcomeRows(written.tasks)],
        ["Test Unit (unit-a)", O.some(RUN), O.some(1), ["@beep/a#test=pass", "@beep/b#test=fail"]]
      );
      deepStrictEqual(written.reports, [
        GateFeedEntry.make({
          gate: "check",
          subject: "@beep/root",
          record: ".beep/gates/check/20261122T100000000Z-0001.json",
          log: ".beep/gates/check/20261122T100000000Z-0001.log",
        }),
        GateFeedEntry.make({
          gate: "test",
          subject: "@beep/a",
          record: "packages/a/.beep/gates/test/report.json",
          log: "packages/a/.beep/gates/test/report.log",
        }),
      ]);
      // A gate record that does not decode fails the command: the feed never drops a report silently.
      yield* fs.writeFileString(path.join(root, "packages", "a", ".beep", "gates", "test", "report.json"), "{}");
      const refused = yield* Effect.flip(findJobGateRecords(root));
      strictEqual(refused.message, "packages/a/.beep/gates/test/report.json is not a readable gate-report/v1 record.");
      // A job that stopped before Turbo ran leaves no `.turbo/runs/`: its record has no tasks.
      const bare = yield* fs.makeTempDirectoryScoped({ prefix: "beep-ci-task-outcomes-bare-" });
      const none = yield* writeTaskOutcomes(bare, "Lint (lint-1)", "record.json").pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord({}))
      );
      deepStrictEqual([none.tasks, none.runId, none.reports], [[], O.none(), []]);
    })
  );

  it.effect(
    "the REST runner reads only this attempt's bounded record artifacts and counts every request it sends",
    () =>
      Effect.gen(function* () {
        const recordText = yield* encodeRecord(record("Test Unit (unit-a)", [["@beep/a#test", "fail"]]));
        const otherText = yield* encodeRecord(record("Test Unit (unit-z)", [["@beep/z#test", "pass"]]));
        // Two JSON files and a non-JSON one in one archive: both records are read, in file-name order.
        const archive = zipSync({
          "record.json": new TextEncoder().encode(recordText),
          "a-extra.json": new TextEncoder().encode(otherText),
          "notes.txt": new TextEncoder().encode("ignored"),
          // Compresses to a few kilobytes but inflates past the record bound: it is skipped before it expands, so it
          // never reaches the record decoder (which would refuse it).
          "big.json": new TextEncoder().encode(`{"padding":"${Str.repeat(1_100_000)("a")}"}`),
        });
        const artifacts = {
          total_count: 5,
          artifacts: [
            {
              id: 1,
              name: `task-outcomes-${RUN}-1-test-unit-shard-unit-a`,
              expired: false,
              size_in_bytes: archive.byteLength,
            },
            { id: 2, name: `task-outcomes-${RUN}-1-lint-shard-lint-1`, expired: true, size_in_bytes: 300 },
            { id: 3, name: `task-outcomes-${RUN}-2-test-unit-shard-unit-a`, expired: false, size_in_bytes: 300 },
            { id: 4, name: `unit-coverage-${RUN}-1-unit-a`, expired: false, size_in_bytes: 300 },
            // Named like a record but larger than any record: never downloaded.
            { id: 5, name: `task-outcomes-${RUN}-1-labs-single`, expired: false, size_in_bytes: 2 * 1024 * 1024 },
          ],
        };
        const listing = yield* encode(artifacts);
        const downloads: Array<string> = [];
        // The first listing call fails, so the runner retries it: both listings are counted.
        let listings = 0;
        const fetch: RecordedFetch = Object.assign(
          (input: string | URL | Request): Promise<Response> => {
            const url = new URL(input instanceof Request ? input.url : input);
            const zip = Str.endsWith("/zip")(url.pathname);
            if (zip) downloads.push(url.pathname);
            listings += zip ? 0 : 1;
            const response = zip
              ? new Response(archive, { status: 200, headers: { "content-type": "application/zip" } })
              : listings === 1
                ? new Response("{}", { status: 500, headers: { "content-type": "application/json" } })
                : new Response(listing, { status: 200, headers: { "content-type": "application/json" } });
            Object.defineProperty(response, "url", { value: url.href });
            return Promise.resolve(response);
          },
          { preconnect: () => undefined }
        );
        const run = yield* restRunner(fetch);
        const fiber = yield* Effect.forkChild(run(["run", "task-outcomes", `${RUN}`, "1"], "."));
        yield* TestClock.adjust("5 seconds");
        const text = yield* Fiber.join(fiber);
        const payload = yield* decodePayload(text);
        deepStrictEqual(downloads, ["/repos/example/repo/actions/artifacts/1/zip"]);
        deepStrictEqual(
          [payload.requests, A.map(payload.records, (entry) => [entry.job, outcomeRows(entry.tasks)])],
          [
            3,
            [
              ["Test Unit (unit-z)", ["@beep/z#test=pass"]],
              ["Test Unit (unit-a)", ["@beep/a#test=fail"]],
            ],
          ]
        );
      })
  );

  it.effect("the REST runner reads a v2 record and skips the gate records its artifact carries", () =>
    Effect.gen(function* () {
      const v2 = TaskOutcomeRecordV2.make({
        schemaVersion: "task-outcomes/v2",
        job: "Test Unit (unit-a)",
        runId: O.some(RUN),
        runAttempt: O.some(1),
        tasks: [HostedTaskOutcome.make({ task: "@beep/a#test", outcome: "fail" })],
        reports: [
          GateFeedEntry.make({
            gate: "test",
            subject: "@beep/a",
            record: "packages/a/.beep/gates/test/report.json",
            log: "packages/a/.beep/gates/test/report.log",
          }),
        ],
      });
      const v2Text = yield* encodeRecordV2(v2);
      const bytes = (text: string) => new TextEncoder().encode(text);
      // A v2 artifact holds the record and, at their repository paths, the gate records and logs it indexes.
      const archive = zipSync({
        ".beep/ci-task-outcomes/record.json": bytes(v2Text),
        "packages/a/.beep/gates/test/report.json": bytes('{"version":"gate-report/v1"}'),
        "packages/a/.beep/gates/test/report.log": bytes("raw"),
        ".beep/gates/check/20261122T100000000Z-0001.json": bytes('{"version":"gate-report/v1"}'),
      });
      const listing = yield* encode({
        total_count: 1,
        artifacts: [
          {
            id: 1,
            name: `task-outcomes-${RUN}-1-test-unit-shard-unit-a`,
            expired: false,
            size_in_bytes: archive.byteLength,
          },
        ],
      });
      const fetch: RecordedFetch = Object.assign(
        (input: string | URL | Request): Promise<Response> => {
          const url = new URL(input instanceof Request ? input.url : input);
          const response = Str.endsWith("/zip")(url.pathname)
            ? new Response(archive, { status: 200, headers: { "content-type": "application/zip" } })
            : new Response(listing, { status: 200, headers: { "content-type": "application/json" } });
          Object.defineProperty(response, "url", { value: url.href });
          return Promise.resolve(response);
        },
        { preconnect: () => undefined }
      );
      const run = yield* restRunner(fetch);
      const text = yield* run(["run", "task-outcomes", `${RUN}`, "1"], ".");
      const payload = yield* decodeAnyPayload(text);
      deepStrictEqual(
        A.map(payload.records, (entry) => [entry.schemaVersion, entry.job, outcomeRows(entry.tasks)]),
        [["task-outcomes/v2", "Test Unit (unit-a)", ["@beep/a#test=fail"]]]
      );
    })
  );

  it.effect("counts every listing page an attempt sends, including the pages of an attempt that failed", () =>
    Effect.gen(function* () {
      const recordText = yield* encodeRecord(record("Test Unit (unit-a)", [["@beep/a#test", "fail"]]));
      const archive = zipSync({ "record.json": new TextEncoder().encode(recordText) });
      // 150 artifacts over two pages: page 1 is all other artifacts, page 2 holds the record.
      const other = A.makeBy(100, (i) => ({
        id: 100 + i,
        name: `unit-coverage-${RUN}-1-p${i}`,
        expired: false,
        size_in_bytes: 10,
      }));
      const rest = A.append(
        A.makeBy(49, (i) => ({ id: 300 + i, name: `unit-timings-${RUN}-1-p${i}`, expired: false, size_in_bytes: 10 })),
        {
          id: 1,
          name: `task-outcomes-${RUN}-1-test-unit-shard-unit-a`,
          expired: false,
          size_in_bytes: archive.byteLength,
        }
      );
      const firstPage = yield* encode({ total_count: 150, artifacts: other });
      const secondPage = yield* encode({ total_count: 150, artifacts: rest });
      // The first request for page 2 fails, so the runner retries the whole listing.
      let secondPageCalls = 0;
      const fetch: RecordedFetch = Object.assign(
        (input: string | URL | Request): Promise<Response> => {
          const url = new URL(input instanceof Request ? input.url : input);
          const page = url.searchParams.get("page");
          secondPageCalls += page === "2" ? 1 : 0;
          const json = (body: string, status = 200) =>
            new Response(body, { status, headers: { "content-type": "application/json" } });
          const response = Str.endsWith("/zip")(url.pathname)
            ? new Response(archive, { status: 200, headers: { "content-type": "application/zip" } })
            : page === "2"
              ? secondPageCalls === 1
                ? json("{}", 500)
                : json(secondPage)
              : json(firstPage);
          Object.defineProperty(response, "url", { value: url.href });
          return Promise.resolve(response);
        },
        { preconnect: () => undefined }
      );
      const run = yield* restRunner(fetch);
      const fiber = yield* Effect.forkChild(run(["run", "task-outcomes", `${RUN}`, "1"], "."));
      yield* TestClock.adjust("5 seconds");
      const pagedText = yield* Fiber.join(fiber);
      const payload = yield* decodePayload(pagedText);
      // Attempt 1: pages 1 and 2 (failed). Attempt 2: pages 1 and 2. Then one download.
      deepStrictEqual([payload.requests, A.map(payload.records, (entry) => entry.job)], [5, ["Test Unit (unit-a)"]]);
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
      // A receipt written before the count decodes with no key; continuing from it carries 0 reads, and a window
      // already fully captured reads nothing new.
      const receiptPath = `${root}/corpus/RECEIPTS.json`;
      const legacyText = yield* encodeReceipt(RouteCorpusReceipt.make({ ...receipt, taskOutcomeReads: O.none() }));
      yield* fs.writeFileString(receiptPath, legacyText);
      const continued = yield* corpus.capture(
        RouteCorpusCaptureOptions.make({
          repoRoot: root,
          since: DAY,
          until: O.some(DAY),
          workflows: ["Check"],
          outDir: "corpus",
        })
      );
      deepStrictEqual(continued.taskOutcomeReads, O.some(0));
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

  it.effect("a rate-limited download reports the requests it had sent, and the runner stops there", () =>
    Effect.gen(function* () {
      const recordText = yield* encodeRecord(record("Test Unit (unit-a)", [["@beep/a#test", "fail"]]));
      const archive = zipSync({ "record.json": new TextEncoder().encode(recordText) });
      const listing = yield* encode({
        total_count: 2,
        artifacts: [
          { id: 1, name: `task-outcomes-${RUN}-1-test-unit-shard-unit-a`, expired: false, size_in_bytes: 300 },
          { id: 2, name: `task-outcomes-${RUN}-1-lint-shard-lint-1`, expired: false, size_in_bytes: 300 },
        ],
      });
      const fetch: RecordedFetch = Object.assign(
        (input: string | URL | Request): Promise<Response> => {
          const url = new URL(input instanceof Request ? input.url : input);
          // The first download succeeds; GitHub refuses the second for the rate limit.
          const response = Str.endsWith("/artifacts/2/zip")(url.pathname)
            ? new Response("{}", { status: 429, headers: { "content-type": "application/json", "retry-after": "60" } })
            : Str.endsWith("/zip")(url.pathname)
              ? new Response(archive, { status: 200, headers: { "content-type": "application/zip" } })
              : new Response(listing, { status: 200, headers: { "content-type": "application/json" } });
          Object.defineProperty(response, "url", { value: url.href });
          return Promise.resolve(response);
        },
        { preconnect: () => undefined }
      );
      const run = yield* restRunner(fetch);
      // Any other failure maps to -1, so only the rate-limit refusal can carry the count.
      const requests = yield* run(["run", "task-outcomes", `${RUN}`, "1"], ".").pipe(
        Effect.flip,
        Effect.map((refused) => (isRateLimited(refused) ? refused.requests : -1))
      );
      // One listing page and two downloads were sent before the refusal.
      strictEqual(requests, 3);
    })
  );

  it.effect("the capture adds a rate-limited attempt's requests to the read that follows the wait", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const temp = yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-task-outcomes-limit-" });
      const root = yield* fs.realPath(temp);
      yield* TestClock.setTime(DateTime.makeUnsafe("2026-11-18T12:00:00Z").pipe(DateTime.toEpochMillis));
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
          {
            name: "Test Unit (unit-a)",
            conclusion: "failure",
            startedAt: `${DAY}T08:00:00Z`,
            completedAt: `${DAY}T08:10:00Z`,
            steps: [{ name: "Run Test Unit shard", conclusion: "failure" }],
          },
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
      const outcomes = yield* encode({ requests: 2, records: [] });
      // The reset is reported as already past, so the capture waits only its safety margin.
      const rateLimit = yield* encode({ resources: { core: { reset: 1_794_000_000 } } });
      let readCalls = 0;
      // Lazy, as the real runner is: a retried effect re-runs its body, so the first read is refused and the
      // read after the wait succeeds.
      const refusedOnce = Effect.suspend(() => {
        readCalls += 1;
        return readCalls === 1
          ? Effect.fail(RouteGhRateLimited.make({ command: "gh run task-outcomes", output: "429", requests: 3 }))
          : Effect.succeed(outcomes);
      });
      // The window is one day of one workflow, so every list call is that day's.
      const answers: Readonly<Record<string, Effect.Effect<string, RouteGhRateLimited>>> = {
        api: Effect.succeed(rateLimit),
        list: Effect.succeed(list),
        "task-outcomes": refusedOnce,
      };
      const runGh: RouteGhRunner = (args) =>
        answers[args[0] === "api" ? "api" : (args[1] ?? "")] ?? Effect.succeed(view);
      // A recording budget over the real unmetered one: every admitted label and every metered call is kept.
      const unmetered = yield* makeRouteReadBudget(O.none());
      const admitted: Array<string> = [];
      let meteredCalls = 0;
      const budget = {
        ...unmetered,
        admit: (label: string) => Effect.sync(() => admitted.push(label)).pipe(Effect.andThen(unmetered.admit(label))),
        metered: <A, E, R>(call: Effect.Effect<A, E, R>) =>
          Effect.sync(() => (meteredCalls += 1)).pipe(Effect.andThen(unmetered.metered(call))),
      };
      const corpus = yield* makeRouteCorpus(runGh, budget);
      const fiber = yield* Effect.forkChild(
        corpus.capture(
          RouteCorpusCaptureOptions.make({
            repoRoot: root,
            since: DAY,
            until: O.some(DAY),
            workflows: ["Check"],
            outDir: "corpus",
          })
        )
      );
      // The capture does real file I/O before it sleeps, so keep advancing the clock until it has finished.
      yield* TestClock.adjust("1 second").pipe(Effect.repeat({ until: () => fiber.pollUnsafe() !== undefined }));
      const receipt = yield* Fiber.join(fiber);
      // Three requests before the refusal, two in the read after the wait.
      deepStrictEqual([readCalls, receipt.taskOutcomeReads], [2, O.some(5)]);
      // Both task-outcome attempts are admitted at the reserve (the first, and the retry after the wait) and metered,
      // beside the day's list, the run view and the rate-limit lookup of the wait: 1 + 1 + 1 + 2 metered calls.
      deepStrictEqual(
        [A.filter(admitted, Str.startsWith("gh run task-outcomes")), meteredCalls],
        [[`gh run task-outcomes ${RUN} 1`, `gh run task-outcomes ${RUN} 1`], 5]
      );
    })
  );
});

// The command resolves the checkout it runs in, so it reads this checkout's own `.turbo/runs/` (whatever summaries
// it holds) and writes only to the scratch path it is given.
const CommandLayer = Layer.mergeAll(
  NodeServices.layer,
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
  ),
  TestConsole.layer
);
const runTaskOutcomesCommand = Command.runWith(ciTaskOutcomesCommand, { version: "0.0.0" });

it.layer(CommandLayer, { timeout: "60 seconds" })("ci task-outcomes command", (it) => {
  it.effect("writes a decodable record for the checkout it runs in", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const temp = yield* fs.makeTempDirectoryScoped({ prefix: "beep-ci-task-outcomes-command-" });
      const out = path.join(temp, "out", "record.json");
      yield* runTaskOutcomesCommand(["--job-name", "Labs", "--out", out]);
      const text = yield* fs.readFileString(out);
      const written = yield* decodeRecordV2(text);
      strictEqual(written.job, "Labs");
    })
  );
});
