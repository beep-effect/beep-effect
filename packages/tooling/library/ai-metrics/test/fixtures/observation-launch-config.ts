import { EvidenceRetentionPolicy } from "@beep/repo-ai-metrics/evidence-retention";
import { NativeSchedulePolicy } from "@beep/repo-ai-metrics/native-schedule";
import { ObservationControlPolicy } from "@beep/repo-ai-metrics/observation-control";
import { ObservationLaunchConfig } from "@beep/repo-ai-metrics/observation-launch";
import { ObservationRuntimePolicy } from "@beep/repo-ai-metrics/observation-runtime";
import { PayloadRetentionPolicy } from "@beep/repo-ai-metrics/payload-reclamation";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { Sha256Hex } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";

export const syntheticLaunchSalt = "synthetic-launch-proof-salt";
export const launchFixture = Effect.fn("ObservationLaunchTest.config")(function* (origin = "http://127.0.0.1:9") {
  return ObservationLaunchConfig.make({
    discovery: O.none(),
    intake: TranscriptIntakeConfig.make({
      hostId: Sha256Hex.make(Str.repeat(64)("a")),
      namespaceId: yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(syntheticLaunchSalt)),
      maxPages: 16,
      maxPayloadBytes: 1048576,
      maxDatabasePages: 256,
    }),
    route: {
      routeId: Sha256Hex.make(Str.repeat(64)("b")),
      approvedModels: [],
      usageConvention: "unknown",
      bodyTimeoutMillis: 1000,
    },
    destination: {
      endpoint: `${origin}/v1/traces`,
      backendOrigin: origin,
      project: "synthetic-launch",
      timeoutMillis: 1000,
    },
    ledger: { maxEvents: 64, maxAttempts: 64, maxAttemptsPerEvent: 8 },
    scheduling: NativeSchedulePolicy.make({
      maxEvents: 4,
      retryDelayMillis: 100,
      maxRetryDelayMillis: 1000,
      reconcileDelayMillis: 100,
      tickTimeoutMillis: 1000,
    }),
    runtime: ObservationRuntimePolicy.make({ intervalMillis: 100, cycleTimeoutMillis: 2000, staleAfterMillis: 3000 }),
    control: ObservationControlPolicy.make({ maxActive: 4, drainTimeoutMillis: 5000 }),
    payloadRetention: PayloadRetentionPolicy.make({
      minAgeMillis: 60000,
      minAttemptQuietMillis: 60000,
      maxDispositions: 64,
      expireAfterMillis: O.some(86400000),
    }),
    evidenceRetention: EvidenceRetentionPolicy.make({
      minEpochMillis: 60000,
      minAttemptQuietMillis: 60000,
      maxRecords: 64,
      deadlineMillis: 10000,
    }),
  });
});
