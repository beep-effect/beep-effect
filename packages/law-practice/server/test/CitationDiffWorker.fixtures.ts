import * as NodeURL from "node:url";
import { makeCitationDiffWorker as makeOwnedCitationDiffWorker } from "@beep/law-practice-server/internal/Citation/DiffWorker";
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
import { ownCitationTestConfiguration } from "./CitationConfigurationOwnership.fixtures.ts";
import { readCitationDiffCorpus } from "./CitationDiffCorpus.fixtures.ts";
import { makeCitationTestScaffoldBinding } from "./CitationInvocation.fixtures.ts";
import { makeCitationBundledTestRuntime, makeCitationObservedSpawner } from "./CitationNativeSpawner.fixtures.ts";
import type { CitationAdmissionFailure } from "@beep/law-practice-server/internal/Citation/Admission";
import type { CitationDiffKernelFailure } from "@beep/law-practice-server/internal/Citation/DiffKernel";
import type { CitationDiffWorkerFailure } from "@beep/law-practice-server/internal/Citation/DiffWorkerProtocol";
import type { CitationInvocation } from "@beep/law-practice-server/internal/Citation/Invocation";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import type { CitationSpanDiffStep } from "@beep/law-practice-server/internal/Citation/SpanOffsets";
import type { CitationEngineLimits, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";

// Own the fixture configuration through the engine boundary before the direct install.
const makeCitationDiffWorker = Effect.fnUntraced(function* (
  a0: Parameters<typeof makeOwnedCitationDiffWorker>[0],
  a1: unknown,
  a2?: Parameters<typeof makeOwnedCitationDiffWorker>[2]
) {
  const o1 = yield* ownCitationTestConfiguration(CitationNativeProcessRuntime, a1);
  return yield* makeOwnedCitationDiffWorker(a0, o1, a2);
});

/** Prepare a trusted diff bundle in the caller's scoped directory using the actual selected executable.
 *
 * **Example** (Prepare an isolated Bun worker)
 * ```ts
 * import * as Effect from "effect/Effect";
 * import * as FileSystem from "effect/FileSystem";
 * import { makeCitationDiffTestRuntime } from "./CitationDiffWorker.fixtures.ts";
 * const prepared = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem;
 *   const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "citation-diff-example-" });
 *   return yield* makeCitationDiffTestRuntime("bun", cwd);
 * });
 * ```
 * @internal @category testing @since 0.0.0
 */
export const makeCitationDiffTestRuntime = Effect.fn("DiffWorkerTest.runtime")(
  (kind: CitationNativeRuntimeKind, cwd: string) =>
    makeCitationBundledTestRuntime(
      kind,
      NodeURL.fileURLToPath(
        kind === "node"
          ? new URL("../src/internal/Citation/DiffWorker.node.entry.ts", import.meta.url)
          : new URL("../src/internal/Citation/DiffWorker.entry.ts", import.meta.url)
      ),
      cwd
    )
);
export const makeCitationDiffWorkerFixture = Effect.fn("DiffWorkerTest.fixture")(function* (
  kind: CitationNativeRuntimeKind,
  policy: CitationEngineLimits,
  useDmp = true
) {
  const fs = yield* FileSystem.FileSystem;
  const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "citation-diff-worker-" });
  const runtime = yield* makeCitationDiffTestRuntime(kind, cwd);
  const admission = yield* makeCitationNativeProcessAdmission(policy);
  const observed = yield* makeCitationObservedSpawner();
  const worker = yield* makeCitationDiffWorker(policy, runtime, useDmp).pipe(
    Effect.flatMap((stage) =>
      makeCitationTestScaffoldBinding(policy).pipe(Effect.map((bind) => ({ ...stage, evaluate: bind(stage.evaluate) })))
    ),
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
      CitationAdmissionFailure | CitationDiffKernelFailure | CitationDiffWorkerFailure | CitationSafetyLimitExceeded,
      CitationInvocation
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
