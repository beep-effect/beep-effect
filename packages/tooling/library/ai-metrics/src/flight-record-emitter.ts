/**
 * Deterministic HookPulse and semantic-witness projection into flight-record candidates.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Defect, LiteralKit, SchemaUtils, Sha256Hex } from "@beep/schema";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  FlightEvidenceReference,
  FlightRecordAttribution,
  FlightRecordCompositionInput,
  FlightRecordMechanical,
  FlightRecordSemantic,
  FlightRecordWriteEvent,
  FlightWaitSpan,
} from "./flight-record.ts";
import { FlightSemanticWitness } from "./flight-semantic-witness.ts";
import { HookPulseEvent, HookPulseV1 } from "./hook-pulse.ts";
import { HookPulseLeaseProjectionInput, projectHookPulseLease } from "./hook-pulse-lease-emitter.ts";
import { AiMetricsIdentityRegistry } from "./identity-registry.ts";
import { hashPublicTextSha256 } from "./privacy.ts";
import { SessionLeaseTombstone } from "./session-lease.ts";
import { OipTaint, weakestEvidenceTier } from "./telemetry-v2.ts";
import type { FlightWaitSpan as FlightWaitSpanType } from "./flight-record.ts";
import type { HookPulseLeaseProjection } from "./hook-pulse-lease-emitter.ts";
import type { SessionLeaseEvent } from "./session-lease.ts";
import type { EvidenceTier } from "./telemetry-v2.ts";

const $I = $RepoAiMetricsId.create("flight-record-emitter");
const flightRecordCandidateSchemaVersion = "telemetry-v2/flight-record-candidate/v1";
const isSha256Hex = S.is(Sha256Hex);

/**
 * All content-free inputs needed to project one hook session into a flight-record candidate.
 *
 * **Details**
 *
 * The registry is the sole attribution authority. A semantic witness and
 * tombstone are optional exact-identity joins; their absence remains explicit
 * rather than causing replay to infer values from neighboring files.
 *
 * **Example** (Inspect the hook-ledger input)
 *
 * ```ts
 * import { FlightRecordProjectionInput } from "@beep/repo-ai-metrics"
 *
 * console.log(FlightRecordProjectionInput.fields.rows)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FlightRecordProjectionInput extends S.Class<FlightRecordProjectionInput>($I`FlightRecordProjectionInput`)(
  {
    rows: S.NonEmptyArray(HookPulseV1),
    registry: AiMetricsIdentityRegistry,
    semanticWitness: S.OptionFromOptionalKey(FlightSemanticWitness).pipe(SchemaUtils.withNoneDefault),
    tombstone: S.OptionFromOptionalKey(SessionLeaseTombstone).pipe(SchemaUtils.withNoneDefault),
    configFingerprint: S.OptionFromOptionalKey(Sha256Hex).pipe(SchemaUtils.withNoneDefault),
    oipTaint: OipTaint,
  },
  $I.annote("FlightRecordProjectionInput", {
    description: "Hook rows, exact optional joins, and canonical registry used to compose one flight candidate.",
  })
) {}

class ReadyFlightRecordCandidate extends S.Class<ReadyFlightRecordCandidate>($I`ReadyFlightRecordCandidate`)(
  {
    status: S.tag("ready"),
    schemaVersion: S.Literal(flightRecordCandidateSchemaVersion),
    input: FlightRecordCompositionInput,
  },
  $I.annote("ReadyFlightRecordCandidate", {
    description: "Fully attributed composition input ready for the telemetry-v2 store.",
  })
) {}

class RejectedFlightRecordCandidate extends S.Class<RejectedFlightRecordCandidate>($I`RejectedFlightRecordCandidate`)(
  S.Struct({
    status: S.tag("rejected"),
    schemaVersion: S.Literal(flightRecordCandidateSchemaVersion),
    event: FlightRecordWriteEvent,
  }).check(
    S.makeFilter((input) => input.event.status !== "accepted", {
      identifier: "RejectedFlightRecordCandidateInvariant",
      title: "Rejected flight-record candidate invariant",
      description: "Prevents an accepted write event from being represented as a rejected candidate.",
      message: "Expected a rejected candidate to carry an invalid or quarantined write event",
    })
  ),
  $I.annote("RejectedFlightRecordCandidate", {
    description: "Content-free invalid or attribution-quarantine event ready for durable append.",
  })
) {}

/**
 * Ready flight-record composition or a durable content-free rejection event.
 *
 * @category models
 * @since 0.0.0
 */
export const FlightRecordCandidate = S.Union([ReadyFlightRecordCandidate, RejectedFlightRecordCandidate]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("FlightRecordCandidate", {
    description: "Deterministic accepted candidate or explicit invalid/quarantine disposition.",
  }),
  SchemaUtils.withStatics(() => ({
    makeReady: (input: FlightRecordCompositionInput): FlightRecordCandidate =>
      ReadyFlightRecordCandidate.make({ schemaVersion: flightRecordCandidateSchemaVersion, input }),
    makeRejected: (event: FlightRecordWriteEvent): FlightRecordCandidate =>
      RejectedFlightRecordCandidate.make({ schemaVersion: flightRecordCandidateSchemaVersion, event }),
  }))
);

/**
 * Decoded flight-record projection outcome.
 *
 * @category models
 * @since 0.0.0
 */
export type FlightRecordCandidate = typeof FlightRecordCandidate.Type;

const FlightRecordEmitterOperation = LiteralKit([
  "project-lease",
  "encode-semantic-witness",
  "hash-semantic-witness",
  "hash-quarantine",
  "hash-record",
]).pipe(
  $I.annoteSchema("FlightRecordEmitterOperation", {
    description: "Projection operation that failed before a candidate could be durably classified.",
  })
);

/**
 * Typed infrastructure failure raised by the flight-record emitter.
 *
 * @category errors
 * @since 0.0.0
 */
export class FlightRecordEmitterError extends S.TaggedError<FlightRecordEmitterError>($I`FlightRecordEmitterError`)(
  "FlightRecordEmitterError",
  {
    cause: Defect({ includeStack: true }),
    message: S.String,
    operation: FlightRecordEmitterOperation,
  },
  $I.annoteError<FlightRecordEmitterError>("FlightRecordEmitterError", {
    description: "Typed lease-projection, encoding, or digest failure while emitting a flight-record candidate.",
  })
) {}

interface WaitProjection {
  readonly violation: O.Option<"terminal-inconsistent">;
  readonly waits: ReadonlyArray<FlightWaitSpanType>;
}

interface AttributionAccepted {
  readonly attribution: FlightRecordAttribution;
  readonly status: "accepted";
}

interface AttributionRejected {
  readonly event: FlightRecordWriteEvent;
  readonly status: "rejected";
}

type AttributionProjection = AttributionAccepted | AttributionRejected;

interface SemanticProjection {
  readonly digest: O.Option<typeof Sha256Hex.Type>;
  readonly semantic: FlightRecordSemantic;
}

const emitterFailure = (
  operation: typeof FlightRecordEmitterOperation.Type,
  message: string,
  cause: unknown
): FlightRecordEmitterError => FlightRecordEmitterError.make({ cause, message, operation });

const unknownSemantic = (): FlightRecordSemantic =>
  FlightRecordSemantic.make({
    objective: { status: "unknown", evidenceTier: "unknown" },
    semanticTurns: [],
    selfReportedTerminalOutcome: "unknown",
    evidenceTier: "unknown",
  });

const invalidCandidate = (
  projection: HookPulseLeaseProjection,
  violation: "schema-invalid" | "terminal-inconsistent"
): FlightRecordCandidate =>
  FlightRecordCandidate.makeRejected(
    FlightRecordWriteEvent.makeInvalid({
      candidateDigest: projection.projectionDigest,
      violations: [violation],
      evidenceTier: projection.evidenceTier,
      oipTaint: projection.oipTaint,
    })
  );

const attributionProjection = Effect.fn("FlightRecordEmitter.attributionProjection")(function* (
  projection: Extract<HookPulseLeaseProjection, { readonly status: "accepted" }>,
  first: HookPulseV1,
  registry: AiMetricsIdentityRegistry
): Effect.fn.Return<AttributionProjection, FlightRecordEmitterError> {
  const roots = A.filter(registry.roots, (root) => root.cloneIdHash === first.cwd);
  const root = A.head(roots);
  const instances = O.match(root, {
    onNone: A.empty,
    onSome: (matchedRoot) =>
      A.filter(
        registry.sourceInstances,
        (instance) => instance.rootId === matchedRoot.rootId && instance.sourceKind === projection.sourceKind
      ),
  });
  const instance = A.head(instances);
  const namespace = O.filter(registry.hashSaltNamespaceId, isSha256Hex);
  const reason =
    A.length(roots) > 1 || A.length(instances) > 1
      ? O.some<"ambiguous-identity">("ambiguous-identity")
      : O.isNone(namespace)
        ? O.some<"namespace-mismatch">("namespace-mismatch")
        : O.isNone(root) || O.isNone(instance) || !isSha256Hex(instance.value.instanceIdHash)
          ? O.some<"missing-identity">("missing-identity")
          : O.none<"ambiguous-identity" | "namespace-mismatch" | "missing-identity">();

  if (O.isSome(reason)) {
    const quarantineRef = yield* hashPublicTextSha256(
      `flight-record-quarantine\u0000${projection.sessionId}\u0000${first.cwd}\u0000${projection.sourceKind}\u0000${reason.value}`
    ).pipe(
      Effect.mapError((cause) =>
        emitterFailure("hash-quarantine", "Failed to hash a flight-record attribution quarantine.", cause)
      )
    );
    return {
      status: "rejected",
      event: FlightRecordWriteEvent.makeQuarantined({
        candidateDigest: projection.projectionDigest,
        quarantineRef,
        reason: reason.value,
        evidenceTier: O.isNone(namespace) ? "unknown" : projection.evidenceTier,
        oipTaint: projection.oipTaint,
      }),
    };
  }

  return {
    status: "accepted",
    attribution: FlightRecordAttribution.make({
      rootId: first.cwd,
      sourceInstanceId: Sha256Hex.make(instance.value.instanceIdHash),
      identityNamespaceId: namespace.value,
      evidenceTier: "derived",
    }),
  };
});

const closeWait = (
  waits: ReadonlyArray<FlightWaitSpanType>,
  event: Extract<SessionLeaseEvent, { readonly event: "wait-closed" }>
): WaitProjection => {
  const opened = A.findFirst(waits, (wait) => wait.status === "open" && wait.waitId === event.waitId);
  if (O.isNone(opened) || opened.value.status !== "open") {
    return { waits, violation: O.some("terminal-inconsistent") };
  }
  const durationMs =
    DateTime.toEpochMillis(event.observedAt) -
    DateTime.toEpochMillis(opened.value.openedAt) -
    event.executionDurationMs;
  if (durationMs < 0) {
    return { waits, violation: O.some("terminal-inconsistent") };
  }
  return {
    violation: O.none(),
    waits: A.map(waits, (wait) =>
      wait.status === "open" && wait.waitId === event.waitId
        ? FlightWaitSpan.makeClosed({
            status: "closed",
            waitId: wait.waitId,
            openedAt: wait.openedAt,
            closedAt: event.observedAt,
            durationMs,
            reason: wait.reason,
            evidenceTier: weakestEvidenceTier(["derived", wait.evidenceTier, event.evidenceTier]),
          })
        : wait
    ),
  };
};

const projectWaits = (
  events: ReadonlyArray<SessionLeaseEvent>,
  terminalAt: O.Option<DateTime.Utc>,
  terminalEvidenceTier: EvidenceTier
): WaitProjection => {
  let state: WaitProjection = { waits: A.empty<FlightWaitSpanType>(), violation: O.none() };
  for (const event of events) {
    if (O.isSome(state.violation)) return state;
    if (event.event === "wait-opened") {
      state = {
        violation: O.none(),
        waits: A.append(
          state.waits,
          FlightWaitSpan.makeOpen({
            status: "open",
            waitId: event.wait.waitId,
            openedAt: event.wait.openedAt,
            reason: event.wait.reason,
            evidenceTier: event.wait.evidenceTier,
          })
        ),
      };
    } else if (event.event === "wait-closed") {
      state = closeWait(state.waits, event);
    }
  }

  return O.match(terminalAt, {
    onNone: () => state,
    onSome: (tombstonedAt) => ({
      violation: state.violation,
      waits: A.map(state.waits, (wait) =>
        wait.status === "open"
          ? FlightWaitSpan.makeTombstoned({
              status: "tombstoned",
              waitId: wait.waitId,
              openedAt: wait.openedAt,
              tombstonedAt,
              reason: wait.reason,
              evidenceTier: weakestEvidenceTier(["reconstructed", wait.evidenceTier, terminalEvidenceTier]),
            })
          : wait
      ),
    }),
  });
};

const phaseFromLastEvent = (event: HookPulseEvent) =>
  HookPulseEvent.$match(event, {
    SessionStart: () => "orchestration" as const,
    PreToolUse: () => "tool-preparation" as const,
    PermissionRequest: () => "hook-policy" as const,
    PostToolUse: () => "result-processing" as const,
    PostToolUseFailure: () => "result-processing" as const,
    Notification: () => "hook-policy" as const,
    UserPromptSubmit: () => "inference" as const,
    Stop: () => "result-processing" as const,
    SessionEnd: () => "none" as const,
    PermissionDenied: () => "hook-policy" as const,
  });

const semanticProjection = Effect.fn("FlightRecordEmitter.semanticProjection")(function* (
  first: HookPulseV1,
  witness: O.Option<FlightSemanticWitness>
): Effect.fn.Return<O.Option<SemanticProjection>, FlightRecordEmitterError> {
  if (O.isNone(witness)) return O.some({ semantic: unknownSemantic(), digest: O.none() });
  const objective = witness.value.semantic.objective;
  if (
    O.isNone(first.invocationId) ||
    first.invocationId.value !== witness.value.invocationId ||
    witness.value.sourceKind !== (first.agentKind === "codex-cli" ? "codex" : "claude") ||
    O.isNone(first.objectiveRef) ||
    objective.status !== "known" ||
    objective.objectiveRef !== first.objectiveRef.value
  ) {
    return O.none();
  }
  const json = yield* FlightSemanticWitness.encodeJsonEffect(witness.value).pipe(
    Effect.mapError((cause) =>
      emitterFailure("encode-semantic-witness", "Failed to encode an exact semantic witness.", cause)
    )
  );
  const digest = yield* hashPublicTextSha256(`flight-semantic-witness\u0000${json}`).pipe(
    Effect.mapError((cause) =>
      emitterFailure("hash-semantic-witness", "Failed to hash an exact semantic witness.", cause)
    )
  );
  return O.some({ semantic: witness.value.semantic, digest: O.some(digest) });
});

/**
 * Project one hook session into a fully attributed flight record or durable refusal event.
 *
 * **Details**
 *
 * Mechanical fields are computed only from hook and lease evidence. Semantic
 * fields come only from an exact wrapper witness; when that channel is absent,
 * the semantic projection is explicitly unknown. Registry ambiguity,
 * correlation mismatch, and impossible wait durations are refused without a
 * nearest-neighbor guess.
 *
 * **Example** (Reference the deterministic emitter)
 *
 * ```ts
 * import { projectHookPulseFlightRecord } from "@beep/repo-ai-metrics"
 *
 * console.log(projectHookPulseFlightRecord)
 * ```
 *
 * @param input - Hook rows and exact content-free evidence joins for one session.
 * @returns A ready store input or invalid/quarantined write event.
 * @category services
 * @since 0.0.0
 */
export const projectHookPulseFlightRecord: (
  input: FlightRecordProjectionInput
) => Effect.Effect<FlightRecordCandidate, FlightRecordEmitterError> = Effect.fn(
  "FlightRecordEmitter.projectHookPulseFlightRecord"
)(function* (input) {
  const projection = yield* projectHookPulseLease(
    HookPulseLeaseProjectionInput.make({ rows: input.rows, oipTaint: input.oipTaint })
  ).pipe(
    Effect.mapError((cause) => emitterFailure("project-lease", "Failed to project the hook session lease.", cause))
  );
  if (projection.status === "quarantined") return invalidCandidate(projection, "schema-invalid");

  const first = input.rows[0];
  const last = input.rows[input.rows.length - 1];
  const observedTerminal = last.hookEvent === "SessionEnd";
  if (
    (observedTerminal && O.isSome(input.tombstone)) ||
    O.exists(
      input.tombstone,
      (tombstone) => tombstone.sessionId !== projection.sessionId || tombstone.sourceKind !== projection.sourceKind
    )
  ) {
    return invalidCandidate(projection, "terminal-inconsistent");
  }

  const attribution = yield* attributionProjection(projection, first, input.registry);
  if (attribution.status === "rejected") return FlightRecordCandidate.makeRejected(attribution.event);

  const semantic = yield* semanticProjection(first, input.semanticWitness);
  if (O.isNone(semantic)) return invalidCandidate(projection, "schema-invalid");

  const terminalAt = observedTerminal ? O.some(last.ts) : O.map(input.tombstone, (tombstone) => tombstone.tombstonedAt);
  const terminalEvidenceTier = O.match(input.tombstone, {
    onNone: () => projection.evidenceTier,
    onSome: (tombstone) => tombstone.evidenceTier,
  });
  const waitProjection = projectWaits(projection.events, terminalAt, terminalEvidenceTier);
  if (O.isSome(waitProjection.violation)) return invalidCandidate(projection, waitProjection.violation.value);

  const terminal = observedTerminal || O.isSome(input.tombstone);
  const hasOpenWait = A.some(waitProjection.waits, (wait) => wait.status === "open");
  const mechanicalTier = weakestEvidenceTier([
    "derived",
    projection.evidenceTier,
    terminalEvidenceTier,
    ...A.map(waitProjection.waits, (wait) => wait.evidenceTier),
  ]);
  const mechanical = FlightRecordMechanical.make({
    startedAt: first.ts,
    lastObservedAt: O.match(input.tombstone, {
      onNone: () => last.ts,
      onSome: (tombstone) => tombstone.lastObservedAt,
    }),
    observedEventCount: A.length(input.rows),
    turnCount: A.length(A.filter(input.rows, (row) => row.hookEvent === "UserPromptSubmit")),
    toolCallCount: A.length(A.filter(input.rows, (row) => row.hookEvent === "PreToolUse")),
    toolFailureCount: A.length(A.filter(input.rows, (row) => row.hookEvent === "PostToolUseFailure")),
    lifecycleState: terminal ? "terminal" : hasOpenWait ? "waiting" : "active",
    activePhase: terminal ? "none" : hasOpenWait ? "hook-policy" : phaseFromLastEvent(last.hookEvent),
    terminalOutcome: terminal ? "unknown" : "none",
    terminalProvenance: observedTerminal
      ? "harness-event"
      : O.isSome(input.tombstone)
        ? "lease-reconciliation"
        : "none",
    waits: waitProjection.waits,
    evidenceTier: mechanicalTier,
  });

  const hookEvidence = FlightEvidenceReference.make({
    kind: "hook-ledger",
    digest: projection.projectionDigest,
    evidenceTier: projection.evidenceTier,
    oipTaint: input.oipTaint,
  });
  const semanticEvidence = O.map(semantic.value.digest, (digest) =>
    FlightEvidenceReference.make({
      kind: "semantic-witness",
      digest,
      evidenceTier: semantic.value.semantic.evidenceTier,
      oipTaint: "clear",
    })
  );
  const configEvidence = O.map(input.configFingerprint, (digest) =>
    FlightEvidenceReference.make({
      kind: "config-snapshot",
      digest,
      evidenceTier: "heuristic",
      oipTaint: "clear",
    })
  );
  const tombstoneEvidence = O.map(input.tombstone, (tombstone) =>
    FlightEvidenceReference.make({
      kind: "session-lease-reconciliation",
      digest: tombstone.sourceEvidenceDigest,
      evidenceTier: tombstone.evidenceTier,
      oipTaint: tombstone.oipTaint,
    })
  );
  const evidenceRefs: A.NonEmptyReadonlyArray<FlightEvidenceReference> = [
    hookEvidence,
    ...A.getSomes([semanticEvidence, configEvidence, tombstoneEvidence]),
  ];
  const config = O.match(input.configFingerprint, {
    onNone: () => ({ status: "unknown" as const, evidenceTier: "unknown" as const }),
    onSome: (fingerprint) => ({ status: "last-known" as const, fingerprint, evidenceTier: "heuristic" as const }),
  });
  const recordId = yield* hashPublicTextSha256(
    `flight-record\u0000${projection.projectionDigest}\u0000${attribution.attribution.rootId}\u0000${attribution.attribution.sourceInstanceId}\u0000${O.getOrElse(semantic.value.digest, () => "unknown")}\u0000${O.getOrElse(input.configFingerprint, () => "unknown")}\u0000${O.match(input.tombstone, { onNone: () => "none", onSome: (tombstone) => tombstone.leaseDigest })}`
  ).pipe(Effect.mapError((cause) => emitterFailure("hash-record", "Failed to hash a flight-record identity.", cause)));

  return FlightRecordCandidate.makeReady(
    FlightRecordCompositionInput.make({
      recordId,
      sessionId: projection.sessionId,
      sourceKind: projection.sourceKind,
      attribution: attribution.attribution,
      instrumentClass: first.instrumentClass,
      config,
      semantic: semantic.value.semantic,
      mechanical,
      evidenceRefs,
    })
  );
});
