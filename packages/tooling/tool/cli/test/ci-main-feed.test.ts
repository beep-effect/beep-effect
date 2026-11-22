import {
  downloadFeedArtifact,
  FEED_ARTIFACT_BYTES_MAX,
  FeedArtifactRef,
  lookupMainFeed,
  MainFeed,
  MainFeedRequest,
  MainFeedResult,
  readFeedArchive,
} from "@beep/repo-cli/commands/Ci";
import { describe, it } from "@effect/vitest";
import { assertInclude, assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { zipSync } from "fflate";
import artifactByName from "./fixtures/ci-gate-reports/artifact-by-name.json" with { type: "json" };
import runsAtMergeBase from "./fixtures/ci-gate-reports/main-runs-at-merge-base.json" with { type: "json" };
import runsOnBranch from "./fixtures/ci-gate-reports/main-runs-branch.json" with { type: "json" };
import { bytes, feedZip, gateRecordJson, gateReport, packageEntry, v1Json, v2Json } from "./support/FeedFixtures.ts";
import { provideBuilt, restRoutes, routeTable } from "./support/RestRoutes.ts";

const MERGE_BASE = "bc49cb60e1f5d3a7c2b8946d0f1e2a3b4c5d6e7f";
const ANCESTOR = "4e3343774cc5a1b2c3d4e5f6a7b8c9d0e1f2a3b4";
const filler = (n: number) => `${Str.repeat(39)("0")}${n}`;
const ANCESTORS = [filler(1), "9a1c0de2b3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8", filler(2), ANCESTOR, filler(3)];
const PACKAGE = "packages/tooling/tool/cli";

const redRecord = gateRecordJson(
  gateReport({ gate: "test", subject: "@beep/repo-cli", messages: ["expected 2 to be 3", "expected [] to be empty"] })
);
const greenCheck = gateRecordJson(gateReport({ gate: "check", subject: "@beep/repo-cli", messages: [] }));
const testEntry = packageEntry({ packageDir: PACKAGE, gate: "test", subject: "@beep/repo-cli" });
const checkEntry = packageEntry({ packageDir: PACKAGE, gate: "check", subject: "@beep/repo-cli" });
const lostEntry = packageEntry({ packageDir: "packages/lost", gate: "test", subject: "@beep/lost" });

const unitE = feedZip({
  recordJson: v2Json({ job: "Test Unit (unit-e)", reports: [checkEntry, testEntry, lostEntry] }),
  files: {
    [testEntry.record]: redRecord,
    [testEntry.log]: Str.repeat(10)("raw vitest output\n"),
    [checkEntry.record]: greenCheck,
  },
});

const request = (overrides: Partial<Parameters<typeof MainFeedRequest.make>[0]> = {}) =>
  MainFeedRequest.make({
    mergeBase: MERGE_BASE,
    ancestors: ANCESTORS,
    jobs: ["test-unit-shard-unit-e"],
    gates: [],
    ...overrides,
  });

const isRuns = (url: URL) => Str.endsWith("/actions/workflows/check.yml/runs")(url.pathname);
const isListing = (url: URL) => Str.endsWith("/artifacts")(url.pathname);
const isZip = (url: URL) => Str.endsWith("/zip")(url.pathname);

const artifactNamed = (name: string, id: number, expired = false) => ({
  total_count: 1,
  artifacts: [{ ...artifactByName.artifacts[0]!, id, name, expired }],
});

const mainRoutes = (options: {
  readonly atMergeBase: unknown;
  readonly onBranch?: unknown;
  readonly listing?: (name: string) => unknown;
  readonly zip?: (id: string) => Uint8Array;
}) => {
  const onBranch = options.onBranch ?? { workflow_runs: [] };
  const listing = options.listing ?? (() => artifactByName);
  const zip = options.zip ?? (() => unitE);
  return routeTable([
    [isRuns, (url) => ({ json: url.searchParams.has("head_sha") ? options.atMergeBase : onBranch })],
    [isListing, (url) => ({ json: listing(url.searchParams.get("name") ?? "") })],
    [isZip, (url) => ({ zip: zip(Str.split(url.pathname, "/").at(-2) ?? "") })],
  ]);
};

const atMergeBaseHit = {
  workflow_runs: [
    { ...runsAtMergeBase.workflow_runs[0]!, id: 45042981300, conclusion: null, created_at: "2026-11-22T12:00:00Z" },
    {
      ...runsAtMergeBase.workflow_runs[0]!,
      id: 45042981200,
      conclusion: "success",
      created_at: "2026-11-22T11:50:00Z",
      run_attempt: 2,
    },
    runsAtMergeBase.workflow_runs[0]!,
  ],
};

const hitOf = (result: MainFeedResult) =>
  MainFeedResult.match(result, {
    MainFeedHit: (hit) => hit,
    MainFeedMiss: (miss) => {
      throw new Error(`expected a hit, got a miss after ${miss.requests} requests`);
    },
  });

describe("main feed lookup", () => {
  it.effect("returns main's reports at the merge base in three REST requests, red reports included", () => {
    const transport = restRoutes(
      mainRoutes({ atMergeBase: atMergeBaseHit, listing: (name) => artifactNamed(name, 14763290472) })
    );
    return Effect.gen(function* () {
      const found = yield* lookupMainFeed(request());
      const result = hitOf(found);
      strictEqual(result.distance, 0);
      strictEqual(result.sha, MERGE_BASE);
      strictEqual(result.runId, 45042981200);
      strictEqual(result.runAttempt, 2);
      strictEqual(result.requests, 3);
      assertTrue(result.requests <= 5);
      strictEqual(transport.calls.length, 3);
      assertTrue(A.every(transport.calls, (url) => !Str.includes("graphql")(url.pathname)));
      const runs = transport.calls[0]!;
      deepStrictEqual(
        [runs.searchParams.get("head_sha"), runs.searchParams.get("event"), runs.searchParams.get("status")],
        [MERGE_BASE, "push", "completed"]
      );
      strictEqual(transport.calls[1]!.searchParams.get("name"), "task-outcomes-45042981200-2-test-unit-shard-unit-e");
      const job = result.jobs[0]!;
      strictEqual(job.artifact, "task-outcomes-45042981200-2-test-unit-shard-unit-e");
      deepStrictEqual(
        A.map(job.reports, (found) => [found.entry.gate, found.record.report.outcome]),
        [
          ["check", "all-pass"],
          ["test", "some-fail"],
        ]
      );
      const red = job.reports[1]!;
      strictEqual(red.record.report.items.length, 2);
      assertSome(red.logBytes, 180);
      assertNone(job.reports[0]!.logBytes);
      deepStrictEqual(result.missing, []);
    }).pipe(provideBuilt(transport.layer));
  });

  it.effect("walks to the nearest first-parent ancestor with a run in four requests", () => {
    const transport = restRoutes(
      mainRoutes({
        atMergeBase: runsAtMergeBase,
        onBranch: runsOnBranch,
        listing: (name) => artifactNamed(name, 14763290472),
      })
    );
    return Effect.gen(function* () {
      const found = yield* lookupMainFeed(request({ gates: ["test"] }));
      const result = hitOf(found);
      strictEqual(result.sha, ANCESTOR);
      strictEqual(result.distance, 4);
      strictEqual(result.runId, 45042229032);
      strictEqual(result.requests, 4);
      strictEqual(transport.calls.length, 4);
      const listing = transport.calls[1]!;
      deepStrictEqual(
        [listing.searchParams.get("branch"), listing.searchParams.get("created"), listing.searchParams.has("head_sha")],
        ["main", "<=2026-11-22T11:40:12Z", false]
      );
      deepStrictEqual(
        A.map(result.jobs[0]!.reports, (found) => [found.entry.gate, found.record.report.reason]),
        [["test", "failed"]]
      );
    }).pipe(provideBuilt(transport.layer));
  });

  it.effect("misses when the merge base ran nothing and no ancestor was given", () => {
    const transport = restRoutes(mainRoutes({ atMergeBase: runsAtMergeBase }));
    return Effect.gen(function* () {
      const result = yield* lookupMainFeed(request({ ancestors: [] }));
      deepStrictEqual(result, MainFeedResult.cases.MainFeedMiss.make({ reason: "no-main-run", requests: 1 }));
    }).pipe(provideBuilt(transport.layer));
  });

  it.effect(
    "misses when no ancestor in the one page has a run, and lists without a bound when the merge base has none",
    () => {
      const transport = restRoutes(mainRoutes({ atMergeBase: { workflow_runs: [] }, onBranch: runsOnBranch }));
      return Effect.gen(function* () {
        const result = yield* lookupMainFeed(request({ ancestors: [filler(7), filler(8)] }));
        deepStrictEqual(result, MainFeedResult.cases.MainFeedMiss.make({ reason: "no-main-run", requests: 2 }));
        assertTrue(!transport.calls[1]!.searchParams.has("created"));
      }).pipe(provideBuilt(transport.layer));
    }
  );

  it.effect("names jobs without an artifact, reads v1 artifacts as no reports, and spends two requests per job", () => {
    const transport = restRoutes(
      mainRoutes({
        atMergeBase: { workflow_runs: [{ ...atMergeBaseHit.workflow_runs[1]!, run_attempt: undefined }] },
        listing: (name) =>
          Str.endsWith("-gone")(name)
            ? { total_count: 0, artifacts: [] }
            : Str.endsWith("-expired")(name)
              ? artifactNamed(name, 3, true)
              : Str.endsWith("-labs-single")(name)
                ? artifactNamed(name, 2)
                : artifactNamed(name, 1),
        zip: (id) => (id === "2" ? zipSync({ "record.json": bytes(v1Json("Labs")) }) : unitE),
      })
    );
    return Effect.gen(function* () {
      const found = yield* lookupMainFeed(
        request({ jobs: ["test-unit-shard-unit-e", "gone", "labs-single", "lint-expired"], gates: ["test"] })
      );
      const result = hitOf(found);
      deepStrictEqual(
        A.map(result.jobs, (job) => [job.job, job.reports.length]),
        [
          ["test-unit-shard-unit-e", 1],
          ["labs-single", 0],
        ]
      );
      deepStrictEqual(result.missing, ["gone", "lint-expired"]);
      strictEqual(result.runAttempt, 1);
      strictEqual(transport.calls[1]!.searchParams.get("name"), "task-outcomes-45042981200-1-test-unit-shard-unit-e");
      strictEqual(result.requests, 1 + 2 + 1 + 2 + 1);
    }).pipe(provideBuilt(transport.layer));
  });

  it.effect("fails with a CiCommandError when GitHub refuses", () => {
    const transport = restRoutes(() => ({ json: { message: "Server Error" }, status: 500 }));
    return Effect.gen(function* () {
      const error = yield* Effect.flip(lookupMainFeed(request()));
      strictEqual(error._tag, "CiCommandError");
      assertInclude(error.message, "main's gate reports");
    }).pipe(provideBuilt(transport.layer));
  });

  it.effect("serves the lookup through the MainFeed service", () => {
    const transport = restRoutes(mainRoutes({ atMergeBase: runsAtMergeBase }));
    return Effect.gen(function* () {
      const feed = yield* MainFeed;
      const result = yield* feed.lookup(request({ ancestors: [] }));
      strictEqual(result._tag, "MainFeedMiss");
    }).pipe(provideBuilt(Layer.provide(MainFeed.layer, transport.layer)));
  });
});

describe("feed artifact reader", () => {
  it.effect("refuses a body that is not a zip, and a zip with no task-outcome record", () =>
    Effect.gen(function* () {
      const notZip = yield* Effect.flip(readFeedArchive(bytes("not a zip"), "a", () => true));
      assertInclude(notZip.message, "is not a zip archive");
      const noRecord = yield* Effect.flip(
        readFeedArchive(
          zipSync({ "notes.json": bytes('{"note":1}'), ".beep/gates/test/1.json": bytes(redRecord) }),
          "b",
          () => true
        )
      );
      assertInclude(noRecord.message, "holds no task-outcome record");
      const padding = bytes(Str.repeat(1024 * 1024)(" "));
      const bomb = yield* Effect.flip(
        readFeedArchive(
          zipSync({
            "record.json": bytes(v1Json("Labs")),
            ...R.fromEntries(A.makeBy(8, (index) => [`pad-${index}.json`, padding] as const)),
          }),
          "bomb",
          () => true
        )
      );
      assertInclude(bomb.message, "declares more than 8388608 bytes of JSON entries");
    })
  );

  it.effect("lists an indexed record that is missing or not a gate record as unreadable", () =>
    Effect.gen(function* () {
      const broken = feedZip({
        recordJson: v2Json({ job: "Lint", reports: [testEntry, checkEntry] }),
        files: {
          [testEntry.record]: '{"version":"gate-report/v2"}',
        },
      });
      const feed = yield* readFeedArchive(broken.buffer as ArrayBuffer, "c", () => true);
      deepStrictEqual(feed.unreadable, [testEntry.record, checkEntry.record]);
      deepStrictEqual(feed.reports, []);
      strictEqual(feed.record.job, "Lint");
    })
  );

  it.effect("refuses an expired or oversized artifact before any request", () => {
    const transport = restRoutes(() => ({ json: {} }));
    return Effect.gen(function* () {
      const ref = (expired: boolean, size: number) =>
        FeedArtifactRef.make({ id: 1, name: "task-outcomes-1-1-x", expired, size_in_bytes: size });
      const expired = yield* Effect.flip(downloadFeedArtifact(ref(true, 1), () => true));
      const oversized = yield* Effect.flip(downloadFeedArtifact(ref(false, FEED_ARTIFACT_BYTES_MAX + 1), () => true));
      assertInclude(expired.message, "expired");
      assertInclude(oversized.message, `${FEED_ARTIFACT_BYTES_MAX}`);
      strictEqual(transport.calls.length, 0);
      const failed = yield* pipe(
        downloadFeedArtifact(ref(false, 1), () => true),
        Effect.flip,
        provideBuilt(restRoutes(() => ({ json: {}, status: 500 })).layer)
      );
      assertInclude(failed.message, "Failed to download artifact");
    }).pipe(provideBuilt(transport.layer));
  });
});
