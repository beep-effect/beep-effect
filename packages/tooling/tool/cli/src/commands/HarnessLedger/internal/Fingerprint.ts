/**
 * Capture the current harness fingerprint of a repo root.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  AiMetricsConfigSnapshotInput,
  HarnessFingerprintInput,
  makeAiMetricsConfigSnapshot,
  makeHarnessFingerprint,
} from "@beep/repo-ai-metrics";
import { Effect } from "effect";
import { HarnessLedgerIoError } from "../HarnessLedger.errors.ts";
import type { O } from "@beep/utils";

/**
 * Snapshot the repo's agent-facing config and fingerprint it with the
 * observed model id and reasoning effort (`unknown` when absent).
 *
 * @internal
 * @category use-cases
 * @since 0.0.0
 */
export const captureHarnessFingerprint = Effect.fn("HarnessLedger.captureHarnessFingerprint")(function* (
  repoRoot: string,
  modelId: O.Option<string>,
  reasoningEffort: O.Option<string>
) {
  const snapshot = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot })).pipe(
    Effect.mapError(HarnessLedgerIoError.wrap("Failed to snapshot the repo's agent-facing config."))
  );
  return yield* makeHarnessFingerprint(HarnessFingerprintInput.make({ modelId, reasoningEffort, snapshot })).pipe(
    Effect.mapError(HarnessLedgerIoError.wrap("Failed to compose the harness fingerprint."))
  );
});
