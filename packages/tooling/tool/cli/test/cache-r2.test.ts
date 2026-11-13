import {
  CacheR2FleetRequest,
  CacheR2ProbeIo,
  CacheR2Response,
  CacheR2TaskCache,
  CacheR2TaskExecution,
  CacheR2TaskRow,
  CacheRuntimeProcess,
  cacheR2ProbeFixture,
  runCacheR2Fleet,
  runCacheR2Probe,
  selectCacheR2SummaryTask,
} from "@beep/repo-cli/test/Cache";
import { Sha256HexFromBytes } from "@beep/schema";
import { currentHostPlatform } from "@beep/utils/HostProcess";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { CacheR2ProbeReceipt, CacheR2Request } from "@beep/repo-cli/test/Cache";

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
};

const row = (task: string, hash: string, mode: string, cache: Parameters<typeof CacheR2TaskCache.make>[0]) =>
  CacheR2TaskRow.make({
    task,
    hash,
    cache: CacheR2TaskCache.make(cache),
    execution: CacheR2TaskExecution.make({ startTime: 1_000, endTime: 6_000, exitCode: 0 }),
    elapsed_s: 5,
    mode,
  });

/**
 * In-memory loopback artifact API shared by the three modes: writes return
 * 201, the reader adapter's API refuses or accepts writes per scenario, and a
 * fresh CI task upload records its execution duration like the adapter does.
 */
const makeIo =
  (store: MutableHashMap.MutableHashMap<string, Stored>, receipts: Array<CacheR2ProbeReceipt>) =>
  (scenario: Scenario): CacheR2ProbeIo["Service"] => {
    const respond = (status: number, body = new Uint8Array(), headers: Record<string, string> = {}) =>
      Effect.succeed(CacheR2Response.make({ status, body, headers, elapsedSeconds: 0.25 }));
    const request = (request: CacheR2Request) => {
      const reader = request.api === "http://127.0.0.1:reader";
      const found = MutableHashMap.get(store, request.key);
      if (request.method === "PUT") {
        if (reader && scenario.readerWrites !== true) return respond(403);
        MutableHashMap.set(store, request.key, {
          body: new Uint8Array(request.body ?? new Uint8Array()),
          duration: O.none(),
        });
        return respond(201);
      }
      if (O.isNone(found)) return respond(404);
      return respond(
        200,
        request.method === "HEAD" ? new Uint8Array() : found.value.body,
        O.match(found.value.duration, {
          onNone: () => ({}),
          onSome: (duration) => ({ "X-Artifact-Duration": `${duration}` }),
        })
      );
    };
    const task = (name: string, label: string, mode: string) => {
      const restored = (hash: string, timeSaved: number) =>
        Effect.succeed(row(name, hash, mode, { status: "HIT", remote: true, timeSaved }));
      if (label === "seed") {
        MutableHashMap.set(store, "seedhash", { body: new Uint8Array([0]), duration: O.some(280) });
        return Effect.succeed(row(name, "seedhash", mode, { status: scenario.seedStatus ?? "MISS" }));
      }
      if (label === "ci-consumer") return restored("seedhash", 0);
      if (label === "ci-producer") {
        MutableHashMap.set(store, "cihash", { body: new Uint8Array([1]), duration: O.some(5_000) });
        return Effect.succeed(row(name, "cihash", mode, { status: "MISS" }));
      }
      return restored("cihash", 5_000);
    };
    return {
      request,
      task,
      readerAdapter: Effect.succeed("http://127.0.0.1:reader"),
      writeReceipt: (receipt) =>
        Effect.sync(() => {
          receipts.push(receipt);
        }),
      r2Active: scenario.r2Active ?? true,
    };
  };

const failureText = <A, E>(exit: Exit.Exit<A, E>) => (Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "succeeded");

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
      ["writable reader", "ci", { readerWrites: true }, "Reader credential wrote an artifact"],
      ["missing CI receipt", "restore", {}, "CI receipt missing"],
    ] as const)("records a failed receipt for a %s", ([, mode, scenario, message]) =>
      Effect.gen(function* () {
        const store = MutableHashMap.empty<string, Stored>();
        const receipts: Array<CacheR2ProbeReceipt> = [];
        const io = makeIo(store, receipts);
        if (mode === "ci") yield* runCacheR2Probe("seed", marker).pipe(Effect.provideService(CacheR2ProbeIo, io({})));
        const exit = yield* runCacheR2Probe(mode, marker).pipe(
          Effect.provideService(CacheR2ProbeIo, io(scenario)),
          Effect.exit
        );
        exit.pipe(Exit.isFailure, assertTrue);
        expect(failureText(exit)).toContain(message);
        const last = A.last(receipts);
        assertSome(
          O.map(last, (receipt) => [receipt.mode, receipt.status, receipt.failure]),
          [mode, "failed", message]
        );
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
