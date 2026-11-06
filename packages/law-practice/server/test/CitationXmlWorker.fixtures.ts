/** Real Bun/Node XML worker replay with existing process/admission controls.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeURL from "node:url";
import { CitationNativeProcessRuntime } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { makeCitationXmlWorker } from "@beep/law-practice-server/internal/Citation/XmlWorker";
import { CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { citationBunTestExecutable, makeCitationNodeTestRuntime } from "./CitationNativeSpawner.fixtures.ts";
import {
  assertCitationWorkerCompositionReleased,
  setupCitationMetadataRuntime,
} from "./CitationRegexWorker.fixtures.ts";
import { readCitationXmlCorpus } from "./CitationXmlBalanceKernel.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
/** @internal @category testing @since 0.0.0 */
export const installCitationXmlWorker = Effect.fn("XmlWorkerTest.install")(function* (kind: CitationNativeRuntimeKind) {
  const setup = yield* setupCitationMetadataRuntime(kind, undefined, true);
  const fs = yield* FileSystem.FileSystem;
  const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "citation-xml-worker-" });
  const runtime =
    kind === "node"
      ? yield* makeCitationNodeTestRuntime(
          NodeURL.fileURLToPath(new URL("../src/internal/Citation/XmlWorker.node.entry.ts", import.meta.url)),
          cwd
        )
      : CitationNativeProcessRuntime.make({
          kind,
          executable: yield* citationBunTestExecutable,
          cwd,
          workerFile: NodeURL.fileURLToPath(new URL("../src/internal/Citation/XmlWorker.entry.ts", import.meta.url)),
        });
  const worker = yield* makeCitationXmlWorker(setup.limits, runtime).pipe(Effect.provideContext(setup.provided));
  return { ...setup, runtime, worker };
});
/** @internal @category testing @since 0.0.0 */
export const replayCitationXmlWorker = Effect.fn("XmlWorkerTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const corpus = yield* readCitationXmlCorpus;
  const setup = yield* installCitationXmlWorker(kind);
  const rows = full
    ? corpus.cases
    : A.filter(corpus.cases, (row) => row.id < 16 || (row.id >= 24 && row.id <= 29) || (row.id >= 37 && row.id <= 42));
  for (const row of rows) {
    const value = yield* setup.worker.balance(CitationPythonUnicodeStorage.make(row.source));
    expect(value, `${kind}:${row.id}`).toBe(row.value);
  }
  yield* assertCitationWorkerCompositionReleased(
    setup.operation,
    setup.admission,
    setup.observed.snapshot,
    rows.length
  );
  const state = yield* setup.worker.snapshot;
  expect(state).toMatchObject({ active: 0, queued: 0, processes: 0, quarantined: 0, closed: false });
});
