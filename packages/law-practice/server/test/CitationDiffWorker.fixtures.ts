import * as NodeURL from "node:url";
import { makeCitationDiffWorker } from "@beep/law-practice-server/internal/Citation/DiffWorker";
import {
  CitationNativeProcessAdmission,
  makeCitationNativeProcessAdmission,
} from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import { CitationNativeProcessRuntime } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import { readCitationDiffCorpus } from "./CitationDiffCorpus.fixtures.ts";
import { makeCitationNodeTestRuntime, makeCitationObservedSpawner } from "./CitationNativeSpawner.fixtures.ts";
import type { CitationDiffKernelFailure } from "@beep/law-practice-server/internal/Citation/DiffKernel";
import type { CitationDiffWorkerFailure } from "@beep/law-practice-server/internal/Citation/DiffWorkerProtocol";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import type { CitationSpanDiffStep } from "@beep/law-practice-server/internal/Citation/SpanOffsets";
import type { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";

/** Use the actual runtime entry without creating another admission owner. */
export const makeCitationDiffTestRuntime = Effect.fn("DiffWorkerTest.runtime")(function* (
  kind: CitationNativeRuntimeKind,
  cwd: string
) {
  const runtime =
    kind === "node"
      ? yield* makeCitationNodeTestRuntime(
          NodeURL.fileURLToPath(new URL("../src/internal/Citation/DiffWorker.node.entry.ts", import.meta.url)),
          cwd
        )
      : CitationNativeProcessRuntime.make({
          kind,
          executable: process.execPath,
          cwd,
          workerFile: NodeURL.fileURLToPath(new URL("../src/internal/Citation/DiffWorker.entry.ts", import.meta.url)),
        });
  return runtime;
});
export const makeCitationDiffWorkerFixture = Effect.fn("DiffWorkerTest.fixture")(function* (
  kind: CitationNativeRuntimeKind,
  policy: unknown
) {
  const fs = yield* FileSystem.FileSystem;
  const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "citation-diff-worker-" });
  const runtime = yield* makeCitationDiffTestRuntime(kind, cwd);
  const admission = yield* makeCitationNativeProcessAdmission(policy);
  const observed = yield* makeCitationObservedSpawner();
  const worker = yield* makeCitationDiffWorker(policy, runtime).pipe(
    Effect.provideService(CitationNativeProcessAdmission, admission),
    Effect.provideService(ChildProcessSpawner, observed.spawner)
  );
  return { worker, admission, observed };
});
export const replayCitationDiffWorker = Effect.fn("DiffWorkerTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const corpus = yield* readCitationDiffCorpus();
  const limits = (yield* defaultCitationEnginePolicy).limits;
  const { worker, admission, observed } = yield* makeCitationDiffWorkerFixture(kind, limits);
  const rows = full ? corpus.maps : A.filter(corpus.maps, (_, index) => index < 4 || index >= corpus.maps.length - 4);
  for (const row of rows) {
    const evaluation = worker.evaluate(row.before, row.after) satisfies Effect.Effect<
      ReadonlyArray<CitationSpanDiffStep>,
      CitationDiffKernelFailure | CitationDiffWorkerFailure | CitationSafetyLimitExceeded
    >;
    const actual = yield* evaluation;
    expect(actual).toEqual(row.steps);
  }
  const counts = yield* observed.snapshot;
  expect(counts).toEqual({ spawned: rows.length, confirmed: rows.length });
  const state = yield* admission.snapshot;
  expect(state).toMatchObject({ active: 0, regexActive: 0, queued: 0, quarantined: 0 });
  const physical = yield* worker.snapshot;
  expect(physical).toMatchObject({ processes: 0, quarantined: 0 });
});
