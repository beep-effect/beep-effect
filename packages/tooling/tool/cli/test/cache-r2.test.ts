import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import {
  CacheR2FleetRequest,
  CacheR2ProbeIo,
  CacheR2ProbeReceipt,
  CacheR2ProbeTarget,
  CacheR2Request,
  CacheR2Response,
  CacheR2TaskCache,
  CacheR2TaskExecution,
  CacheR2TaskRow,
  CacheRuntimeProcess,
  cacheR2Command,
  cacheR2ProbeFixture,
  layerCacheR2ProbeIo,
  runCacheR2Fleet,
  runCacheR2Probe,
  selectCacheR2SummaryTask,
} from "@beep/repo-cli/test/Cache";
import { Sha256HexFromBytes } from "@beep/schema";
import { currentHostPlatform } from "@beep/utils/HostProcess";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Command from "effect/cli/Command";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import { fakeFileInfo, fakeSpawner, fakeSpawnerLayer } from "./helpers/cache-host-fakes.ts";
import type * as HttpClientRequest from "effect/http/HttpClientRequest";
import type * as PlatformError from "effect/PlatformError";
import type * as ChildProcess from "effect/process/ChildProcess";
import type { FakeChild, FakeScript } from "./helpers/cache-host-fakes.ts";

const hashHex = S.decodeEffect(Sha256HexFromBytes);
const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));
const marker = "0123456789abcdef";

// Recorded from the retired probe.py fixture()/write_payloads() for this marker.
const recordedPayloads = [
  ["workstation", 5_740_000, "2f791abf50205f100845ea4c561bd7fcb5d8147f8c3a74bd3f7664c215f799c1"],
  ["workstation", 11_350_000, "889cccc99277f60984c5b183b9384d3b5fb31d7d1cad08e3ca308ad94bee940b"],
  ["aws-ci", 5_740_000, "a6b505ebaaa38a932d229c0428346b51250185f681346600ae916c7d8aa1e8c8"],
  ["aws-ci", 11_350_000, "c679d16d6771a670e25ff4ba247a7f38925c50b6caa18084036fda9da9c40cbf"],
] as const;

describe("R2 probe fixtures", () => {
  it.layer(NodeCrypto.layer)("recorded inputs", (it) => {
    it.effect.each(recordedPayloads)("replays the Python payload for %s at %d bytes", ([label, size, sha256]) =>
      Effect.gen(function* () {
        const body = yield* cacheR2ProbeFixture({ marker, label, size });
        expect(body.length).toBe(size);
        const digest = yield* hashHex(body);
        expect(digest).toBe(sha256);
      })
    );

    it.effect("selects the named task row from a Turbo run summary", () =>
      Effect.gen(function* () {
        const summary = {
          id: "run",
          tasks: [
            { taskId: "@beep/other#lint", task: "lint", hash: "0000", cache: { status: "HIT" } },
            {
              taskId: "//#lint:effect-imports",
              task: "lint:effect-imports",
              hash: "d8326d5593584900",
              cache: { local: false, remote: true, status: "HIT", source: "REMOTE", timeSaved: 280, sha: "abc" },
              execution: { startTime: 1000, endTime: 1280, exitCode: 0, error: null },
            },
          ],
        };
        const text = yield* encodeJson(summary);
        const row = yield* selectCacheR2SummaryTask(text, "lint:effect-imports");
        expect(row.hash).toBe("d8326d5593584900");
        expect(row.cache.remote).toBe(true);
        expect(row.cache.timeSaved).toBe(280);
        expect(row.cache.source).toBe("REMOTE");
        expect(row.execution).toEqual({ startTime: 1000, endTime: 1280, exitCode: 0 });
        const untimed = yield* selectCacheR2SummaryTask(text, "lint");
        expect([untimed.hash, untimed.execution]).toEqual(["0000", {}]);
        const missing = yield* selectCacheR2SummaryTask(text, "lint:effect-imports-markdown").pipe(Effect.exit);
        missing.pipe(Exit.isFailure, assertTrue);
      })
    );
  });
});

interface Stored {
  readonly body: Uint8Array<ArrayBuffer>;
  readonly duration: O.Option<number>;
}

type Scenario = {
  readonly r2Active?: boolean;
  readonly seedStatus?: string;
  readonly readerWrites?: boolean;
  readonly readerReads?: boolean;
  readonly putStatus?: number;
  readonly corruptPayloads?: boolean;
  readonly consumerHash?: string;
  readonly producerStatus?: string;
  readonly ciDuration?: O.Option<number>;
  readonly restoredTimeSaved?: number;
  readonly taskDies?: boolean;
};

const READER_API = "http://127.0.0.1:reader";

const row = (task: string, hash: string, mode: string, cache: Parameters<typeof CacheR2TaskCache.make>[0]) =>
  CacheR2TaskRow.make({
    task,
    hash,
    cache: CacheR2TaskCache.make(cache),
    execution: CacheR2TaskExecution.make({ startTime: 1_000, endTime: 6_000, exitCode: 0 }),
    elapsed_s: 5,
    mode,
  });

const respond = (status: number, body = new Uint8Array(), headers: Record<string, string> = {}) =>
  Effect.succeed(CacheR2Response.make({ status, body, headers, elapsedSeconds: 0.25 }));

const durationHeader = O.match({
  onNone: () => ({}),
  onSome: (duration: number) => ({ "X-Artifact-Duration": `${duration}` }),
});

/**
 * In-memory loopback artifact API shared by the three modes: writes return
 * 201 (or the scenario's status), the reader adapter's API refuses or accepts
 * reads and writes per scenario, and a fresh CI task upload records its
 * execution duration like the adapter does.
 */
const makeIo =
  (store: MutableHashMap.MutableHashMap<string, Stored>, receipts: Array<CacheR2ProbeReceipt>) =>
  (scenario: Scenario): CacheR2ProbeIo["Service"] => {
    const write = (request: CacheR2Request, reader: boolean) => {
      if (reader && scenario.readerWrites !== true) return respond(403);
      MutableHashMap.set(store, request.key, {
        body: new Uint8Array(request.body ?? new Uint8Array()),
        duration: O.none(),
      });
      return respond(scenario.putStatus ?? 201);
    };
    const read = (request: CacheR2Request, reader: boolean) => {
      const found = MutableHashMap.get(store, request.key);
      if (O.isNone(found)) return respond(404);
      if (reader && scenario.readerReads === false) return respond(403);
      const empty = request.method === "HEAD" || (scenario.corruptPayloads === true && request.key !== marker);
      return respond(200, empty ? new Uint8Array() : found.value.body, durationHeader(found.value.duration));
    };
    const request = (request: CacheR2Request) =>
      request.method === "PUT" ? write(request, request.api === READER_API) : read(request, request.api === READER_API);
    const produced = (name: string, mode: string, hash: string, status: string, duration: O.Option<number>) => {
      MutableHashMap.set(store, hash, { body: new Uint8Array([1]), duration });
      return Effect.succeed(row(name, hash, mode, { status }));
    };
    const task = (name: string, label: string, mode: string) => {
      const restored = (hash: string, timeSaved: number) =>
        Effect.succeed(row(name, hash, mode, { status: "HIT", remote: true, timeSaved }));
      return Match.value(label).pipe(
        Match.when("seed", () => produced(name, mode, "seedhash", scenario.seedStatus ?? "MISS", O.some(280))),
        Match.when("ci-consumer", () => restored(scenario.consumerHash ?? "seedhash", 0)),
        Match.when("ci-producer", () =>
          produced(name, mode, "cihash", scenario.producerStatus ?? "MISS", scenario.ciDuration ?? O.some(5_000))
        ),
        Match.orElse(() => restored("cihash", scenario.restoredTimeSaved ?? 5_000))
      );
    };
    return {
      request,
      task: scenario.taskDies === true ? () => Effect.die("task runner crashed") : task,
      readerAdapter: Effect.succeed(READER_API),
      writeReceipt: (receipt) =>
        Effect.sync(() => {
          receipts.push(receipt);
        }),
      r2Active: scenario.r2Active ?? true,
    };
  };

const failureText = <A, E>(exit: Exit.Exit<A, E>) => (Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "succeeded");

type Mode = "seed" | "ci" | "restore";

const runModes = Effect.fnUntraced(function* (
  io: (scenario: Scenario) => CacheR2ProbeIo["Service"],
  prelude: ReadonlyArray<Mode>
) {
  for (const mode of prelude) yield* runCacheR2Probe(mode, marker).pipe(Effect.provideService(CacheR2ProbeIo, io({})));
});

const lastReceipt = (receipts: ReadonlyArray<CacheR2ProbeReceipt>) =>
  O.map(A.last(receipts), (receipt) => [receipt.mode, receipt.status, receipt.failure]);

describe("R2 qualification probe", () => {
  it.layer(NodeCrypto.layer)("modes", (it) => {
    it.effect("carries an exact hash from the workstation to CI and back", () =>
      Effect.gen(function* () {
        const store = MutableHashMap.empty<string, Stored>();
        const receipts: Array<CacheR2ProbeReceipt> = [];
        const io = makeIo(store, receipts);
        const run = (mode: "seed" | "ci" | "restore", scenario: Scenario = {}) =>
          runCacheR2Probe(mode, marker).pipe(Effect.provideService(CacheR2ProbeIo, io(scenario)));
        const seed = yield* run("seed");
        expect(seed.status).toBe("success");
        expect(A.map(seed.payloads ?? [], (payload) => payload.sha256)).toEqual([
          recordedPayloads[0][2],
          recordedPayloads[1][2],
        ]);
        expect(A.map(seed.payloads ?? [], (payload) => payload.hash)).toEqual(["2f791abf50205f10", "889cccc99277f609"]);
        const ci = yield* run("ci");
        expect(ci.status).toBe("success");
        expect(ci.reader_write_rejected).toBe(true);
        expect(ci.uploaded_duration_ms).toBe(5_000);
        expect(ci.consumer?.hash).toBe("seedhash");
        assertNone(MutableHashMap.get(store, "8113b693e8990525"));
        const restore = yield* run("restore");
        expect(restore.status).toBe("success");
        expect(restore.ci?.mode).toBe("ci");
        expect(restore.consumer?.hash).toBe("cihash");
        expect(A.map(receipts, (receipt) => [receipt.mode, receipt.status])).toEqual([
          ["seed", "success"],
          ["ci", "success"],
          ["restore", "success"],
        ]);
      })
    );

    it.effect.each([
      ["inactive adapter", "ci", { r2Active: false }, "R2 adapter is not active; refusing an AWS-cache false positive"],
      ["warm seed", "seed", { seedStatus: "HIT" }, "Seed did not execute freshly"],
      ["rejected payload upload", "seed", { putStatus: 500 }, "Payload upload rejected: 500"],
      ["writable reader", "ci", { readerWrites: true }, "Reader credential wrote an artifact"],
      ["unreadable reader", "ci", { readerReads: false }, "Reader credential cannot read existing artifacts"],
      ["corrupt seed payload", "ci", { corruptPayloads: true }, "Payload integrity mismatch"],
      ["drifted CI consumer", "ci", { consumerHash: "otherhash" }, "CI did not restore the exact workstation hash"],
      ["warm CI producer", "ci", { producerStatus: "HIT" }, "CI producer did not execute freshly"],
      ["unretained duration", "ci", { ciDuration: O.none() }, "Fresh CI upload duration was not retained"],
      ["missing CI receipt", "restore", {}, "CI receipt missing"],
      ["stale restore", "restore", { restoredTimeSaved: 1 }, "Workstation did not restore the fresh CI artifact"],
    ] as const)("records a failed receipt for a %s", ([, mode, scenario, message]) =>
      Effect.gen(function* () {
        const store = MutableHashMap.empty<string, Stored>();
        const receipts: Array<CacheR2ProbeReceipt> = [];
        const io = makeIo(store, receipts);
        const prelude: ReadonlyArray<Mode> = Match.value(mode).pipe(
          Match.when("ci", () => ["seed"] as const),
          Match.when("restore", () => (P.hasProperty(scenario, "restoredTimeSaved") ? (["seed", "ci"] as const) : [])),
          Match.orElse(() => [])
        );
        yield* runModes(io, prelude);
        const exit = yield* runCacheR2Probe(mode, marker).pipe(
          Effect.provideService(CacheR2ProbeIo, io(scenario)),
          Effect.exit
        );
        exit.pipe(Exit.isFailure, assertTrue);
        expect(failureText(exit)).toContain(message);
        assertSome(lastReceipt(receipts), [mode, "failed", message]);
      })
    );

    it.effect.each([
      [
        "seed receipt without its producer",
        "ci",
        '{"mode":"seed","marker":"0123456789abcdef","status":"success"}',
        "Workstation seed receipt omitted its producer",
      ],
      [
        "incomplete CI proof",
        "restore",
        '{"mode":"ci","marker":"0123456789abcdef","status":"failed"}',
        "CI credential proof incomplete",
      ],
      ["malformed stored receipt", "restore", "not a receipt", "Stored probe receipt differs from its schema."],
    ] as const)("refuses a %s", ([, mode, stored, message]) =>
      Effect.gen(function* () {
        const store = MutableHashMap.empty<string, Stored>();
        const receipts: Array<CacheR2ProbeReceipt> = [];
        MutableHashMap.set(store, marker, { body: new TextEncoder().encode(stored), duration: O.none() });
        const exit = yield* runCacheR2Probe(mode, marker).pipe(
          Effect.provideService(CacheR2ProbeIo, makeIo(store, receipts)({})),
          Effect.exit
        );
        expect(failureText(exit)).toContain(message);
        assertSome(lastReceipt(receipts), [mode, "failed", message]);
      })
    );

    it.effect("records a generic failure when the task runner dies", () =>
      Effect.gen(function* () {
        const receipts: Array<CacheR2ProbeReceipt> = [];
        const io = makeIo(MutableHashMap.empty<string, Stored>(), receipts);
        const exit = yield* runCacheR2Probe("seed", marker).pipe(
          Effect.provideService(CacheR2ProbeIo, io({ taskDies: true })),
          Effect.exit
        );
        expect(failureText(exit)).toContain("task runner crashed");
        assertSome(lastReceipt(receipts), ["seed", "failed", "Qualification probe failed"]);
      })
    );
  });
});

const canonical = "https://github.com/beep-effect/beep-effect.git";

const gitIn = Effect.fnUntraced(function* (cwd: string, ...args: ReadonlyArray<string>) {
  const result = yield* CacheRuntimeProcess.runCapturedStreams({
    command: "git",
    args: ["-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", ...args],
    cwd,
  });
  expect(result.exitCode).toBe(0);
});

const fleetFixture = Effect.fnUntraced(function* (exitCode: number) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "cache-r2-fleet-" });
  const parent = yield* fs.realPath(temporary);
  const main = path.join(parent, "beep-effect-main");
  const fork = path.join(parent, "beep-effect-fork");
  for (const clone of [main, fork]) {
    yield* fs.makeDirectory(clone, { recursive: true });
    yield* gitIn(clone, "init", "--quiet", "--template=");
    yield* gitIn(clone, "commit", "--quiet", "--allow-empty", "-m", "init");
  }
  yield* gitIn(main, "remote", "add", "origin", canonical);
  yield* gitIn(fork, "remote", "add", "origin", "https://github.com/someone/beep-effect.git");
  const lane = path.join(parent, "lanes", "lane-a");
  yield* gitIn(main, "worktree", "add", "--quiet", lane, "-b", "lane-a");
  const policy = path.join(main, "packages/tooling/library/repo-cli-kit/src/cli/TurboCache.ts");
  yield* fs.makeDirectory(path.dirname(policy), { recursive: true });
  yield* fs.writeFileString(policy, 'const mode = "local:rw,remote:r"; // BEEP_TURBO_TRUSTED_WRITER\n');
  const calls = path.join(parent, "calls.txt");
  const workstation = path.join(parent, "workstation.sh");
  yield* fs.writeFileString(workstation, `#!/bin/sh\necho "$@" >> "${calls}"\nexit ${exitCode}\n`);
  yield* fs.chmod(workstation, 0o700);
  return { fs, path, parent, main, lane, calls, workstation };
});

describe.skipIf(currentHostPlatform !== "linux")("R2 fleet enrollment", () => {
  it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "60 seconds" })("fleet", (it) => {
    it.effect("plans canonical clones and their worktrees without changing them", () =>
      Effect.gen(function* () {
        const f = yield* fleetFixture(0);
        const output = f.path.join(f.parent, "state", "fleet.json");
        const result = yield* runCacheR2Fleet(
          CacheR2FleetRequest.make({
            roots: [f.parent],
            apply: false,
            output: O.some(output),
            workstation: f.workstation,
          })
        );
        expect(A.map(result.receipt.checkouts, (row) => [row.checkout, row.mode, row.status])).toEqual([
          [f.main, "local:rw,remote:rw", "planned"],
          [f.lane, "local:rw,remote:r", "legacy-use-beep-turbo"],
        ]);
        expect(result.lines).toEqual(["legacy-use-beep-turbo: 1", "planned: 1", "Read-write capable: 1"]);
        expect(result.blocked).toBe(false);
        const called = yield* f.fs.exists(f.calls);
        expect(called).toBe(false);
        const info = yield* f.fs.stat(output);
        expect(info.mode & 0o777).toBe(0o600);
        const written = yield* f.fs.readFileString(output);
        expect(written).toContain('"applied": false');
      })
    );

    it.effect("enrolls supported checkouts through workstation.sh and reports blocks", () =>
      Effect.gen(function* () {
        const enrolled = yield* fleetFixture(0);
        const applied = yield* runCacheR2Fleet(
          CacheR2FleetRequest.make({
            roots: [enrolled.main],
            apply: true,
            output: O.none(),
            workstation: enrolled.workstation,
          })
        );
        expect(A.map(applied.receipt.checkouts, (row) => [row.status, row.exit_code])).toEqual([
          ["enrolled", 0],
          ["legacy-use-beep-turbo", undefined],
        ]);
        const calls = yield* enrolled.fs.readFileString(enrolled.calls);
        expect(Str.trim(calls)).toBe(`enable ${enrolled.main} local:rw,remote:rw`);
        const blocked = yield* fleetFixture(3);
        const refused = yield* runCacheR2Fleet(
          CacheR2FleetRequest.make({
            roots: [blocked.main],
            apply: true,
            output: O.none(),
            workstation: blocked.workstation,
          })
        );
        expect(refused.blocked).toBe(true);
        expect(A.map(refused.receipt.checkouts, (row) => row.status)).toEqual(["blocked", "legacy-use-beep-turbo"]);
      })
    );
  });
});

const liveTarget = (root: string) =>
  CacheR2ProbeTarget.make({ root, api: "http://artifacts.invalid", token: "synthetic-token", team: "team_x!(y)" });

interface LiveScenario {
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly health?: number;
  readonly turboExit?: number;
}

const artifactResponse = (method: string) =>
  Match.value(method).pipe(
    Match.when("PUT", () => new Response(null, { status: 201 })),
    Match.when("HEAD", () => new Response(null, { status: 404 })),
    Match.orElse(() => new Response("stored", { status: 200, headers: { "x-artifact-duration": "280" } }))
  );

// Two new summaries with inverted name and mtime order, plus a non-summary file.
const writeSummaries = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  runs: string,
  task: string
) {
  yield* fs.writeFileString(path.join(runs, "notes.txt"), "not a summary");
  for (const [file, hash, mtime] of [
    ["older.json", "stale-hash", 2_000],
    ["newer.json", "fresh-hash", 9_000],
  ] as const) {
    const text = yield* encodeJson({ tasks: [{ task, hash, cache: { status: "MISS" } }] }).pipe(Effect.orDie);
    yield* fs.writeFileString(path.join(runs, file), text);
    yield* fs.utimes(path.join(runs, file), mtime, mtime);
  }
});

// The probe layer reads the test's own filesystem, path and crypto; only processes and HTTP are faked.
const liveHarness = Effect.fnUntraced(function* (scenario: LiveScenario = {}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "cache-r2-live-" });
  const root = yield* fs.realPath(temporary);
  const runs = path.join(root, ".turbo/runs");
  yield* fs.makeDirectory(runs, { recursive: true });
  const urls: Array<string> = [];
  const requests: Array<HttpClientRequest.HttpClientRequest> = [];
  const spawned: Array<ChildProcess.StandardCommand> = [];
  const client = HttpClient.make((request, url) =>
    Effect.sync(() => {
      urls.push(url.toString());
      requests.push(request);
      const response = Str.endsWith("/management/health")(url.pathname)
        ? new Response(null, { status: scenario.health ?? 200 })
        : artifactResponse(request.method);
      return HttpClientResponse.fromWeb(request, response);
    })
  );
  const spawner = fakeSpawnerLayer((command) =>
    Effect.gen(function* () {
      spawned.push(command);
      if (command.command !== "bun") return { stdout: "reader adapter output" };
      const task = O.getOrElse(O.filter(A.get(command.args, 4), P.isString), () => "");
      yield* writeSummaries(fs, path, runs, task);
      return { stdout: "private turbo output", exitCode: scenario.turboExit ?? 0 };
    })
  );
  const fakes = Layer.mergeAll(spawner, Layer.succeed(HttpClient.HttpClient, client));
  const built = yield* Layer.build(
    layerCacheR2ProbeIo(liveTarget(root), scenario.environment ?? {}).pipe(Layer.provide(fakes))
  );
  const io = Context.get(built, CacheR2ProbeIo);
  return { io, fs, path, root, urls, requests, spawned };
});

const failureMessage = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.map(Effect.exit(effect), (exit) => failureText(exit));

describe("R2 live probe layer", () => {
  it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "30 seconds" })("live", (it) => {
    it.effect("sends the bearer and duration header with a Python-quoted team", () =>
      Effect.gen(function* () {
        const h = yield* liveHarness({ environment: { BEEP_CI_TURBO_R2_ACTIVE: "true", UNSET: undefined } });
        assertTrue(h.io.r2Active);
        const put = yield* h.io.request(CacheR2Request.make({ key: "abc", method: "PUT", body: new Uint8Array([1]) }));
        const got = yield* h.io.request(
          CacheR2Request.make({ key: "abc", method: "GET", api: "http://reader.invalid" })
        );
        const head = yield* h.io.request(CacheR2Request.make({ key: "abc", method: "HEAD" }));
        expect([put.status, got.status, head.status]).toEqual([201, 200, 404]);
        expect(new TextDecoder().decode(got.body)).toBe("stored");
        expect(got.headers["x-artifact-duration"]).toBe("280");
        expect(head.body.length).toBe(0);
        expect(h.urls).toEqual([
          "http://artifacts.invalid/v8/artifacts/abc?teamId=team_x%21%28y%29",
          "http://reader.invalid/v8/artifacts/abc?teamId=team_x%21%28y%29",
          "http://artifacts.invalid/v8/artifacts/abc?teamId=team_x%21%28y%29",
        ]);
        expect(h.requests[0]?.headers).toMatchObject({
          authorization: "Bearer synthetic-token",
          "x-artifact-duration": "1",
        });
      })
    );

    it.effect("runs the scrubbed Turbo task and reads its newest new summary", () =>
      Effect.gen(function* () {
        const h = yield* liveHarness({
          environment: {
            PATH: "/usr/bin",
            OP_SERVICE_ACCOUNT_TOKEN: "x",
            R2_SECRET_ACCESS_KEY: "y",
            CLOUDFLARE_API_TOKEN: "z",
          },
        });
        assertFalse(h.io.r2Active);
        const task = yield* h.io.task("lint:effect-imports", "seed", "remote:w");
        expect([task.task, task.hash, task.mode, task.cache.status]).toEqual([
          "lint:effect-imports",
          "fresh-hash",
          "remote:w",
          "MISS",
        ]);
        const turbo = O.getOrThrow(A.head(h.spawned));
        expect(turbo.options.env).toEqual({ PATH: "/usr/bin", TURBO_CACHE: "remote:w" });
        expect(turbo.args).toContain("--cache=remote:w");
        const log = yield* h.fs.readFileString(h.path.join(h.root, ".beep/r2-cache/seed.private.log"));
        expect(log).toBe("private turbo output");
      })
    );

    it.effect("refuses a Turbo task that exits non-zero", () =>
      Effect.gen(function* () {
        const h = yield* liveHarness({ turboExit: 1 });
        const message = yield* failureMessage(h.io.task("lint:effect-imports", "seed", "remote:w"));
        expect(message).toContain("Qualification task failed: seed");
      })
    );

    it.effect("starts the reader adapter with only the read-only grant", () =>
      Effect.gen(function* () {
        const h = yield* liveHarness({
          environment: { R2_READ_ACCESS_KEY_ID: "reader-key", R2_READ_SECRET_ACCESS_KEY: "reader-secret" },
        });
        const api = yield* Effect.scoped(h.io.readerAdapter);
        expect(api).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
        const adapter = O.getOrThrow(A.head(h.spawned));
        expect(adapter.command).toBe(h.path.join(h.root, "infra/r2-cache/adapter.sh"));
        expect(adapter.args).toEqual(["serve"]);
        expect(adapter.options.env).toMatchObject({
          R2_ACCESS_KEY_ID: "reader-key",
          R2_SECRET_ACCESS_KEY: "reader-secret",
          R2_ADAPTER_PORT: Str.slice(17)(api),
        });
        expect(h.urls).toEqual([`${api}/management/health`]);
      })
    );

    it.effect("refuses the reader proof without the read-only grant", () =>
      Effect.gen(function* () {
        const h = yield* liveHarness();
        const message = yield* h.io.readerAdapter.pipe(Effect.scoped, failureMessage);
        expect(message).toContain("R2_READ_ACCESS_KEY_ID is required for the reader proof");
      })
    );

    it.layer(TestClock.layer(), { timeout: "30 seconds" })("isolated reader readiness clock", (it) => {
      it.effect("gives up on a reader adapter that never becomes healthy", () =>
        Effect.gen(function* () {
          const h = yield* liveHarness({
            health: 503,
            environment: { R2_READ_ACCESS_KEY_ID: "reader-key", R2_READ_SECRET_ACCESS_KEY: "reader-secret" },
          });
          const fiber = yield* Effect.forkChild(h.io.readerAdapter);
          yield* TestClock.adjust(Duration.seconds(30));
          const exit = yield* Fiber.await(fiber);
          expect(failureText(exit)).toContain("Reader adapter did not start");
          expect(h.urls).toHaveLength(100);
        })
      );
    });

    it.effect("writes the private receipt with owner-only permissions", () =>
      Effect.gen(function* () {
        const h = yield* liveHarness();
        yield* h.io.writeReceipt(CacheR2ProbeReceipt.make({ mode: "restore", marker, status: "success" }));
        const file = h.path.join(h.root, ".beep/r2-cache/restore-proof.json");
        const written = yield* h.fs.readFileString(file);
        const info = yield* h.fs.stat(file);
        expect(written).toContain('"status": "success"');
        expect(info.mode & 0o777).toBe(0o600);
      })
    );
  });
});

const runR2 = Command.runWith(cacheR2Command, { version: "0.0.0" });
const withTurboEnvironment = (environment: Readonly<Record<string, string>>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord({ ...environment }));
const turboTuple = { TURBO_API: "http://artifacts.invalid", TURBO_TOKEN: "synthetic-token", TURBO_TEAM: "team_x" };
const consoleLines = Effect.map(TestConsole.logLines, flow(A.filter(P.isString), A.join("\n")));
const errorLines = Effect.map(TestConsole.errorLines, flow(A.filter(P.isString), A.join("\n")));

// The command builds the live layer at `process.cwd()`; this file system keeps every write in memory.
const probeFileSystem = (state: { ran: boolean }, summary: string) =>
  FileSystem.makeNoop({
    makeDirectory: () => Effect.void,
    readDirectory: () => Effect.sync(() => (state.ran ? ["run.json"] : [])),
    stat: () => Effect.succeed(fakeFileInfo(0o600)),
    readFileString: () => Effect.succeed(summary),
    sink: () => Sink.drain,
    writeFileString: () => Effect.void,
    chmod: () => Effect.void,
  });

const acceptingFetch = (calls: Array<string>): typeof globalThis.fetch =>
  Object.assign(
    (input: Parameters<typeof globalThis.fetch>[0]) => {
      calls.push(input instanceof Request ? input.url : `${input}`);
      return Promise.resolve(new Response(null, { status: 201 }));
    },
    { preconnect: () => {} }
  );

const fleetScript =
  (orphan: string, workstation: string, main: string): FakeScript =>
  (command) =>
    Effect.suspend((): Effect.Effect<FakeChild, PlatformError.PlatformError> => {
      if (command.command === workstation) return Effect.fail(ScriptedSpawner.notFound(workstation));
      const words = A.filter(command.args, P.isString);
      if (A.contains(words, "get-url"))
        return Effect.succeed(A.contains(words, orphan) ? { exitCode: 2 } : { stdout: `${canonical}\n` });
      if (A.contains(words, "worktree")) return Effect.succeed({ stdout: `worktree ${main}\n` });
      return Effect.succeed({ stdout: `${Str.repeat(40)("a")}\n` });
    });

describe("R2 command surface", () => {
  it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "60 seconds" })("commands", (it) => {
    it.effect("lists its subcommands and refuses a probe without the Turbo tuple or a valid marker", () =>
      Effect.gen(function* () {
        const missing = yield* runR2(["probe", "seed", "--marker", marker]).pipe(withTurboEnvironment({}), Effect.exit);
        missing.pipe(Exit.isFailure, assertTrue);
        const malformed = yield* runR2(["probe", "seed", "--marker", "not-hex"]).pipe(
          withTurboEnvironment(turboTuple),
          Effect.exit
        );
        malformed.pipe(Exit.isFailure, assertTrue);
        const errors = yield* errorLines;
        expect(errors).toContain("A resolved Turbo API/token/team tuple is required");
        expect(errors).toContain("Marker must be sixteen hexadecimal characters");
        yield* runR2([]);
        const listed = yield* consoleLines;
        expect(listed).toContain("cache r2 commands: probe, fleet");
      })
    );

    it.effect("seeds through the live layer and prints the sanitized receipt", () =>
      Effect.gen(function* () {
        const state = { ran: false };
        const calls: Array<string> = [];
        const summary = yield* encodeJson({
          tasks: [{ task: "lint:effect-imports", hash: "seedhash", cache: { status: "MISS" } }],
        });
        const spawner = fakeSpawner(() =>
          Effect.sync(() => {
            state.ran = true;
            return { stdout: "private turbo output" };
          })
        );
        yield* runR2(["probe", "seed", "--marker", marker]).pipe(
          withTurboEnvironment(turboTuple),
          Effect.provideService(FileSystem.FileSystem, probeFileSystem(state, summary)),
          Effect.provideService(FetchHttpClient.Fetch, acceptingFetch(calls)),
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
        );
        const printed = yield* consoleLines;
        expect(printed).toContain('"status": "success"');
        expect(printed).not.toContain("synthetic-token");
        expect(calls).toHaveLength(3);
        expect(calls[2]).toBe(`http://artifacts.invalid/v8/artifacts/${marker}?teamId=team_x`);
      })
    );

    it.effect("plans and enrolls fleet checkouts, failing when one is blocked", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "cache-r2-fleet-cli-" });
        const parent = yield* fs.realPath(temporary);
        const main = path.join(parent, "beep-effect-main");
        const orphan = path.join(parent, "beep-effect-orphan");
        for (const clone of [main, orphan]) yield* fs.makeDirectory(path.join(clone, ".git"), { recursive: true });
        const policy = path.join(main, "packages/tooling/library/repo-cli-kit/src/cli/TurboCache.ts");
        yield* fs.makeDirectory(path.dirname(policy), { recursive: true });
        yield* fs.writeFileString(policy, 'const mode = "local:rw,remote:r"; // BEEP_TURBO_TRUSTED_WRITER\n');
        const workstation = path.join(process.cwd(), "infra/r2-cache/workstation.sh");
        const spawner = fakeSpawner(fleetScript(orphan, workstation, main));
        const missing = path.join(parent, "missing");
        yield* runR2(["fleet", parent, missing]).pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
        );
        const planned = yield* consoleLines;
        expect(planned).toContain("planned: 1");
        const applied = yield* runR2(["fleet", "--apply", parent, missing]).pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
          Effect.exit
        );
        applied.pipe(Exit.isFailure, assertTrue);
        const enrolled = yield* consoleLines;
        expect(enrolled).toContain("blocked: 1");
        expect(enrolled).toContain("Read-write capable: 1");
      })
    );
  });
});
