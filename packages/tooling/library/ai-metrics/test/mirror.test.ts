import {
  AiMetricsDeployTarget,
  AiMetricsMirrorBundleManifest,
  AiMetricsMirrorLatestPointer,
  AiMetricsMirrorOmittedDataClass,
  AiMetricsMirrorPrivacyProof,
  AiMetricsMirrorStatus,
  aiMetricsMirrorPayloadContainsJsonStringPrefix,
} from "@beep/repo-ai-metrics";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

const privacyProof = AiMetricsMirrorPrivacyProof.make({
  checkedTokens: ["dataRoot"],
  forbiddenMatches: [],
  omittedTables: ["ai_metrics_raw_archive_objects"],
  safe: true,
});

it.effect("preserves the mirror-status.json wire shape", () =>
  Effect.gen(function* () {
    const encoded = yield* AiMetricsMirrorStatus.encodeJsonEffect(
      AiMetricsMirrorStatus.make({
        bundleId: "p7-mirror-1",
        createdAtEpochMillis: 1_717_000_000_000,
        remoteRoot: "/srv/data/ai-metrics/p7-derived-mirror",
        rowCounts: { ai_metrics_turns: 120 },
        target: AiMetricsDeployTarget.Enum.dankserver,
      })
    );

    expect(encoded).toBe(
      '{"bundleId":"p7-mirror-1","createdAtEpochMillis":1717000000000,"mirrorStatusSchemaVersion":"beep.ai_metrics.mirror_status.v1","remoteRoot":"/srv/data/ai-metrics/p7-derived-mirror","rowCounts":{"ai_metrics_turns":120},"syncStatus":"not_synced","target":"dankserver"}'
    );
  })
);

it.effect("preserves the latest.json wire shape", () =>
  Effect.gen(function* () {
    const encoded = yield* AiMetricsMirrorLatestPointer.encodeJsonEffect(
      AiMetricsMirrorLatestPointer.make({
        bundleDir: "/data/mirror/bundles/p7-mirror-1",
        bundleId: "p7-mirror-1",
      })
    );

    expect(encoded).toBe('{"bundleDir":"/data/mirror/bundles/p7-mirror-1","bundleId":"p7-mirror-1"}');
  })
);

it.effect("preserves the manifest.json wire shape", () =>
  Effect.gen(function* () {
    const encoded = yield* AiMetricsMirrorBundleManifest.encodeJsonEffect(
      AiMetricsMirrorBundleManifest.make({
        bundleId: "p7-mirror-1",
        createdAtEpochMillis: 1_717_000_000_000,
        includedTables: ["ai_metrics_turns"],
        omittedDataClasses: AiMetricsMirrorOmittedDataClass.Options,
        omittedTables: ["ai_metrics_raw_archive_objects"],
        p6ProofPreserved: true,
        privacyProof,
        remoteRoot: "/srv/data/ai-metrics/p7-derived-mirror",
        rowCounts: { ai_metrics_turns: 120 },
        target: AiMetricsDeployTarget.Enum.dankserver,
      })
    );

    expect(encoded).toBe(
      '{"bundleId":"p7-mirror-1","createdAtEpochMillis":1717000000000,"includedTables":["ai_metrics_turns"],"mirrorStatusSchemaVersion":"beep.ai_metrics.mirror_status.v1","omittedDataClasses":["raw_transcript_bodies","encrypted_raw_archive_objects","raw_archive_paths","local_source_paths","local_storage_paths","prompt_output_text","secret_values"],"omittedTables":["ai_metrics_raw_archive_objects"],"p6ProofPreserved":true,"privacyProof":{"checkedTokens":["dataRoot"],"forbiddenMatches":[],"omittedTables":["ai_metrics_raw_archive_objects"],"safe":true},"remoteRoot":"/srv/data/ai-metrics/p7-derived-mirror","rowCounts":{"ai_metrics_turns":120},"schemaVersion":"beep.ai_metrics.mirror_bundle.v1","sourceDataClass":"workstation_local_sanitized_derived_storage","target":"dankserver"}'
    );
  })
);

it.effect("rejects exact and extended local paths in JSON payloads", () =>
  Effect.gen(function* () {
    expect(
      yield* aiMetricsMirrorPayloadContainsJsonStringPrefix('{"remoteRoot":"/tmp/ai-metrics"}', "/tmp/ai-metrics")
    ).toBe(true);
    expect(
      yield* aiMetricsMirrorPayloadContainsJsonStringPrefix('{"remoteRoot":"/tmp/ai-metrics/sub"}', "/tmp/ai-metrics")
    ).toBe(true);
  })
);
