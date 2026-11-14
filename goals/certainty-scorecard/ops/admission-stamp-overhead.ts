/**
 * SCHE-09 slice 2 (PLAN slice 5b) overhead micro-measurement: how much the capacity and host-pressure
 * stamps add to one admission's promotion and release.
 *
 * Run from the repository root:
 *
 *   bun goals/certainty-scorecard/ops/admission-stamp-overhead.ts [--pressure on|off] [--runs 100] [--warmup 10]
 *
 * One process admits `--runs` full-proof requests one after another through `withQualityAdmission`, on the
 * real filesystem, under a disposable admission root in `~/.cache/beep/admission-stamp-overhead/`. Before the
 * first admission the journal is filled with 600 rows in origin/main's format (the size of the workstation's
 * live journal on 2026-11-14), so every rewrite reads and decodes a realistic journal. Memory is a fixed
 * reading (50 GiB available, capacity 8 tokens), run scopes are off, and nothing waits on another holder.
 *
 * `--pressure on` writes a protocol marker with the `pressure` key on, so the stamps read this host's
 * `/proc/pressure` and the cgroup files; `off` (the default) writes no marker, which is the only mode a
 * revision older than the stamps understands. Each run reports, in milliseconds:
 *
 * - promotion: from the admission call to the start of the admitted work (protocol read, ticket, enqueue
 *   row, promotion tick, lease, admitted row);
 * - release: from the end of the admitted work to the call's return (released row, lease removal).
 *
 * It prints one JSON object with n, p50, p95 and max of each, the journal's final row count and bytes, and
 * removes the admission root. It is a single sequential run, not a load test.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  AdmissionRequest,
  admissionJournalPath,
  admissionTokenWeight,
  MemoryStats,
  noAdmissionOriginGate,
  provideRuntimeRootForTesting,
  RuntimeRootChoice,
  withQualityAdmission,
} from "@beep/repo-cli/test/RepoRun";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";

const argument = (name: string, fallback: string): string => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
};

const pressure = argument("--pressure", "off");
const runs = Number(argument("--runs", "100"));
const warmup = Number(argument("--warmup", "10"));
const prefillLifecycles = 200;

const runtimeRoot = join(homedir(), ".cache", "beep", "admission-stamp-overhead", `${process.pid}`);
const admissionRoot = join(runtimeRoot, "beep", "admit");

// One lifecycle in origin/main's bytes (enqueued, admitted, released), with a distinct nonce per copy.
const prefillRows = (index: number): ReadonlyArray<string> => {
  const nonce = `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
  const at = 1_763_000_000_000 + index * 60_000;
  return [
    `{"pid":4242,"procStart":"424242","kind":"full-proof","priority":"verify","originKey":"origin0prefill","checkoutRoot":"/repo/prefill","branch":"feat/prefill","enqueuedAtMillis":${at},"nonce":"${nonce}","schemaVersion":"yeet-admission-journal/v3","_tag":"admission-enqueued","weightTokens":3}`,
    `{"_tag":"admission-admitted","schemaVersion":"yeet-admission-journal/v1","nonce":"${nonce}","pid":4242,"procStart":"424242","kind":"full-proof","weightTokens":3,"priority":"verify","originKey":"origin0prefill","enqueuedAtMillis":${at},"admittedAtMillis":${at + 40}}`,
    `{"checkoutRoot":"/repo/prefill","branch":"feat/prefill","_tag":"admission-released","schemaVersion":"yeet-admission-journal/v3","nonce":"${nonce}","pid":4242,"releasedAtMillis":${at + 30_000},"memoryPeakBytes":17179869184}`,
  ];
};

mkdirSync(admissionRoot, { recursive: true, mode: 0o700 });
writeFileSync(
  join(admissionRoot, "journal.ndjson"),
  `${Array.from({ length: prefillLifecycles }, (_, index) => prefillRows(index).join("\n")).join("\n")}\n`,
  { mode: 0o600 }
);
if (pressure === "on") {
  writeFileSync(
    join(admissionRoot, "protocol.json"),
    '{"schemaVersion":"yeet-admission-protocol/v2","eviction":"off","units":"off","pressure":"on"}\n',
    { mode: 0o600 }
  );
}

const request = AdmissionRequest.make({
  kind: "full-proof",
  weightTokens: admissionTokenWeight("full-proof"),
  priority: "verify",
  originKey: "origin0overhead",
  checkoutRoot: "/repo/overhead",
  branch: "feat/overhead",
  command: "bun goals/certainty-scorecard/ops/admission-stamp-overhead.ts",
});

const MeasurementLayer = Layer.mergeAll(
  BunServices.layer,
  BunCrypto.layer,
  Layer.succeed(
    MemoryStats,
    MemoryStats.of({ availableGib: Effect.succeed(50), totalGib: Effect.succeed(128), ceilingGib: Effect.succeed(128) })
  ),
  Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ BEEP_RUN_SCOPES: "0" }))
);

const nowMillis = () => performance.now();

const admitOnce = Effect.gen(function* () {
  const startedAt = nowMillis();
  let workStartedAt = 0;
  let workEndedAt = 0;
  yield* withQualityAdmission(
    request,
    noAdmissionOriginGate,
    Effect.sync(() => {
      workStartedAt = nowMillis();
      workEndedAt = nowMillis();
    })
  );
  const endedAt = nowMillis();
  return { promotion: workStartedAt - startedAt, release: endedAt - workEndedAt };
});

const percentile = (values: ReadonlyArray<number>, rank: number): number => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(rank * sorted.length) - 1)] ?? 0;
};

const summary = (values: ReadonlyArray<number>) => ({
  n: values.length,
  p50: Number(percentile(values, 0.5).toFixed(2)),
  p95: Number(percentile(values, 0.95).toFixed(2)),
  max: Number(percentile(values, 1).toFixed(2)),
});

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const choice = RuntimeRootChoice.make({ kind: "test-override", root: runtimeRoot });
  for (let index = 0; index < warmup; index++) {
    yield* admitOnce.pipe(provideRuntimeRootForTesting(choice));
  }
  const samples: Array<{ readonly promotion: number; readonly release: number }> = [];
  for (let index = 0; index < runs; index++) {
    samples.push(yield* admitOnce.pipe(provideRuntimeRootForTesting(choice)));
  }
  const journal = yield* fs.readFileString(yield* admissionJournalPath(admissionRoot));
  return {
    pressure,
    runs,
    warmup,
    prefillRows: prefillLifecycles * 3,
    promotionMillis: summary(samples.map((sample) => sample.promotion)),
    releaseMillis: summary(samples.map((sample) => sample.release)),
    journalRows: journal.split("\n").filter((line) => line.length > 0).length,
    journalBytes: Buffer.byteLength(journal),
  };
});

const result = await Effect.runPromise(program.pipe(Effect.provide(MeasurementLayer))).finally(() =>
  rmSync(runtimeRoot, { recursive: true, force: true })
);
process.stdout.write(`${JSON.stringify(result)}\n`);
