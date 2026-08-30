import {
  AiMetricsForwarderInput,
  AiMetricsForwarderOtlpExported,
  AiMetricsForwarderRunResult,
  AiMetricsForwarderTimerInput,
} from "@beep/repo-ai-metrics/forwarder";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Encoding, Redacted } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const encodeForwarderInput = S.encodeUnknownEffect(AiMetricsForwarderInput);
const encodeForwarderTimerInput = S.encodeUnknownEffect(AiMetricsForwarderTimerInput);

describe("@beep/repo-ai-metrics forwarder schema invariants", () => {
  it.effect("preserves optional wire keys while carrying absence as Option", () =>
    Effect.gen(function* () {
      const input = AiMetricsForwarderInput.make({
        homeDir: "/home/dev",
        rawArchiveKey: Redacted.make(Encoding.encodeBase64(new Uint8Array(32).fill(13))),
        repoRoot: "/repo",
      });
      const encodedInput = yield* encodeForwarderInput(input);

      expect(O.isNone(input.hashSalt)).toBe(true);
      expect(encodedInput).not.toHaveProperty("hashSalt");
      expect(encodedInput).not.toHaveProperty("dataRoot");
      expect(encodedInput).not.toHaveProperty("sinceEpochMillis");

      const timerInput = AiMetricsForwarderTimerInput.make({
        command: ["/usr/bin/bun"],
        lockPath: "/tmp/forwarder.lock",
        statusPath: "/tmp/forwarder.json",
        workingDirectory: "/repo",
      });
      const encodedTimerInput = yield* encodeForwarderTimerInput(timerInput);
      expect(encodedTimerInput).not.toHaveProperty("hashSaltSecretRef");
      expect(encodedTimerInput).not.toHaveProperty("rawArchiveKeySecretRef");
    })
  );

  it.effect("omits absent result fields and defaults OTLP discriminators", () =>
    Effect.gen(function* () {
      const result = AiMetricsForwarderRunResult.make({
        archiveObjectCount: 0,
        configSnapshotId: "config-1",
        duckDbPath: "/data/ai-metrics.duckdb",
        ingestRunId: "forwarder-1",
        parquetExportMode: "none",
        parquetTables: [],
        rawArchiveDir: "/data/raw",
        sourceFileCount: 0,
        target: "local",
        turnCount: 0,
      });
      const json = yield* AiMetricsForwarderRunResult.encodeJsonEffect(result);

      expect(json).not.toContain('"otlpExport"');
      expect(json).not.toContain('"parquetExportDir"');
      expect(
        AiMetricsForwarderOtlpExported.make({
          endpointTraceUrl: "http://127.0.0.1:6006/v1/traces",
          ingestRunId: "forwarder-1",
          sessionSpanCount: 0,
          spanCount: 0,
          target: "local",
          turnSpanCount: 0,
        }).status
      ).toBe("exported");
    })
  );
});
