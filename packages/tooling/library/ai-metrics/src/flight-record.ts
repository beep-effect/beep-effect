/**
 * Privacy-safe telemetry-v2 flight-record write contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit, NonNegNum, SchemaUtils, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as S from "effect/Schema";
import { AiMetricsTranscriptSource } from "./models.ts";
import {
  ActivePhase,
  combineOipTaints,
  EvidenceTier,
  InstrumentClass,
  LifecycleState,
  OipTaint,
  TerminalOutcome,
  WaitReason,
  weakestEvidenceTier,
} from "./telemetry-v2.ts";

const $I = $RepoAiMetricsId.create("flight-record");
const flightRecordSchemaVersion = "telemetry-v2/flight-record/v1";

const FlightObjectiveStatus = LiteralKit(["known", "unknown"]);

class KnownFlightObjective extends S.Class<KnownFlightObjective>($I`KnownFlightObjective`)(
  {
    status: S.tag(FlightObjectiveStatus.Enum.known),
    objectiveRef: Sha256Hex,
    evidenceTier: EvidenceTier,
  },
  $I.annote("KnownFlightObjective", {
    description: "Content-addressed objective supplied by the semantic flight-record channel.",
  })
) {}

class UnknownFlightObjective extends S.Class<UnknownFlightObjective>($I`UnknownFlightObjective`)(
  {
    status: S.tag(FlightObjectiveStatus.Enum.unknown),
    evidenceTier: S.Literal(EvidenceTier.Enum.unknown),
  },
  $I.annote("UnknownFlightObjective", {
    description: "Explicit absence of an attributable objective, without a guessed or free-text replacement.",
  })
) {}

const FlightObjective = S.Union([KnownFlightObjective, UnknownFlightObjective]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("FlightObjective", {
    description: "Known content-addressed objective or an explicit unknown objective.",
  })
);

class FlightSemanticTurn extends S.Class<FlightSemanticTurn>($I`FlightSemanticTurn`)(
  {
    turnId: Sha256Hex,
    sequence: S.Natural,
    lifecycleState: LifecycleState,
    activePhase: ActivePhase,
    selfReportedTerminalOutcome: TerminalOutcome,
    evidenceTier: EvidenceTier,
  },
  $I.annote("FlightSemanticTurn", {
    description: "Content-free semantic labels supplied for one turn, with no mechanical timing or count fields.",
  })
) {}

/**
 * Agent-authored half of a flight record.
 *
 * **Details**
 *
 * This contract has no timestamps, durations, event counts, tool counts, or
 * computed wait gaps. Those belong exclusively to
 * {@link FlightRecordMechanical}, so the later emitter service can accept this
 * semantic input without granting the agent authorship over mechanical facts.
 *
 * **Example** (Represent unavailable semantic evidence honestly)
 *
 * ```ts
 * import { FlightRecordSemantic } from "@beep/repo-ai-metrics"
 *
 * const semantic = FlightRecordSemantic.make({
 *   objective: { status: "unknown", evidenceTier: "unknown" },
 *   semanticTurns: [],
 *   selfReportedTerminalOutcome: "unknown",
 *   evidenceTier: "unknown"
 * })
 * console.log(semantic.objective.status) // "unknown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FlightRecordSemantic extends S.Class<FlightRecordSemantic>($I`FlightRecordSemantic`)(
  S.Struct({
    objective: FlightObjective,
    semanticTurns: S.Array(FlightSemanticTurn),
    selfReportedTerminalOutcome: TerminalOutcome,
    evidenceTier: EvidenceTier,
  }).check(
    S.makeFilter(
      (input) =>
        input.evidenceTier ===
        weakestEvidenceTier([input.objective.evidenceTier, ...A.map(input.semanticTurns, (turn) => turn.evidenceTier)]),
      {
        identifier: "FlightRecordSemanticEvidenceTierInvariant",
        title: "Flight-record semantic evidence-tier invariant",
        description: "Requires the semantic projection to carry the weakest evidence tier of its objective and turns.",
        message: "Expected semantic evidenceTier to equal the weakest objective or turn tier",
      }
    )
  ),
  $I.annote("FlightRecordSemantic", {
    description: "Agent-authored content-free objective, turn labels, and self-reported terminal outcome.",
  })
) {}

const FlightWaitStatus = LiteralKit(["open", "closed", "tombstoned"]);

class OpenFlightWait extends S.Class<OpenFlightWait>($I`OpenFlightWait`)(
  {
    status: S.tag(FlightWaitStatus.Enum.open),
    waitId: Sha256Hex,
    openedAt: S.DateTimeUtcFromString,
    reason: WaitReason,
    evidenceTier: EvidenceTier,
  },
  $I.annote("OpenFlightWait", {
    description: "Mechanically observed wait bracket that has not received terminal evidence.",
  })
) {}

class ClosedFlightWait extends S.Class<ClosedFlightWait>($I`ClosedFlightWait`)(
  {
    status: S.tag(FlightWaitStatus.Enum.closed),
    waitId: Sha256Hex,
    openedAt: S.DateTimeUtcFromString,
    closedAt: S.DateTimeUtcFromString,
    durationMs: NonNegNum,
    reason: WaitReason,
    evidenceTier: EvidenceTier,
  },
  $I.annote("ClosedFlightWait", {
    description: "Mechanically closed wait bracket with a computed non-negative duration.",
  })
) {}

class TombstonedFlightWait extends S.Class<TombstonedFlightWait>($I`TombstonedFlightWait`)(
  {
    status: S.tag(FlightWaitStatus.Enum.tombstoned),
    waitId: Sha256Hex,
    openedAt: S.DateTimeUtcFromString,
    tombstonedAt: S.DateTimeUtcFromString,
    reason: WaitReason,
    evidenceTier: EvidenceTier,
  },
  $I.annote("TombstonedFlightWait", {
    description: "Unclosed wait bracket retained with explicit tombstone provenance instead of a guessed close.",
  })
) {}

/**
 * Mechanical wait bracket in open, closed, or tombstoned state.
 *
 * **Example** (Decode an open wait without inventing a duration)
 *
 * ```ts
 * import { FlightWaitSpan } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const result = S.decodeUnknownResult(FlightWaitSpan)({
 *   status: "open",
 *   waitId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
 *   openedAt: "2026-09-03T12:00:00.000Z",
 *   reason: "tool-permission",
 *   evidenceTier: "observed"
 * })
 * console.log(result._tag) // "Success"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FlightWaitSpan = S.Union([OpenFlightWait, ClosedFlightWait, TombstonedFlightWait]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("FlightWaitSpan", {
    description: "Tagged mechanical wait bracket that cannot attach close fields to an open wait.",
  }),
  SchemaUtils.withStatics(() => ({
    makeOpen: (input: Parameters<typeof OpenFlightWait.make>[0]): FlightWaitSpan => OpenFlightWait.make(input),
    makeClosed: (input: Parameters<typeof ClosedFlightWait.make>[0]): FlightWaitSpan => ClosedFlightWait.make(input),
    makeTombstoned: (input: Parameters<typeof TombstonedFlightWait.make>[0]): FlightWaitSpan =>
      TombstonedFlightWait.make(input),
  }))
);

/**
 * Decoded flight-record wait span.
 *
 * @see {@link FlightWaitSpan} for the runtime tagged union.
 * @category models
 * @since 0.0.0
 */
export type FlightWaitSpan = typeof FlightWaitSpan.Type;

const TerminalProvenance = LiteralKit([
  "harness-event",
  "transcript-reconstruction",
  "lease-reconciliation",
  "none",
  "unknown",
]);

const mechanicalTerminalIsConsistent = (input: {
  readonly lifecycleState: LifecycleState;
  readonly terminalOutcome: TerminalOutcome;
  readonly terminalProvenance: typeof TerminalProvenance.Type;
}): boolean => {
  const isTerminal = LifecycleState.is.terminal(input.lifecycleState);
  const hasOutcome = Bool.not(TerminalOutcome.is.none(input.terminalOutcome));
  const hasProvenance = Bool.not(TerminalProvenance.is.none(input.terminalProvenance));
  return Bool.match(isTerminal, {
    onFalse: () => Bool.not(hasOutcome) && Bool.not(hasProvenance),
    onTrue: () => hasOutcome && hasProvenance,
  });
};

/**
 * Hook- or transcript-derived half of a flight record.
 *
 * **Example** (Represent a terminal mechanical observation)
 *
 * ```ts
 * import { FlightRecordMechanical } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const mechanical = S.decodeUnknownSync(FlightRecordMechanical)({
 *   startedAt: "2026-09-03T12:00:00.000Z",
 *   lastObservedAt: "2026-09-03T12:01:00.000Z",
 *   observedEventCount: 4,
 *   turnCount: 1,
 *   toolCallCount: 1,
 *   toolFailureCount: 0,
 *   lifecycleState: "terminal",
 *   activePhase: "none",
 *   terminalOutcome: "completed",
 *   terminalProvenance: "harness-event",
 *   waits: [],
 *   evidenceTier: "derived"
 * })
 * console.log(mechanical.toolCallCount) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FlightRecordMechanical extends S.Class<FlightRecordMechanical>($I`FlightRecordMechanical`)(
  S.Struct({
    startedAt: S.DateTimeUtcFromString,
    lastObservedAt: S.DateTimeUtcFromString,
    observedEventCount: S.Natural,
    turnCount: S.Natural,
    toolCallCount: S.Natural,
    toolFailureCount: S.Natural,
    lifecycleState: LifecycleState,
    activePhase: ActivePhase,
    terminalOutcome: TerminalOutcome,
    terminalProvenance: TerminalProvenance,
    waits: S.Array(FlightWaitSpan),
    evidenceTier: EvidenceTier,
  }).check(
    S.makeFilterGroup(
      [
        S.makeFilter(mechanicalTerminalIsConsistent, {
          identifier: "FlightRecordMechanicalTerminalInvariant",
          title: "Flight-record mechanical terminal invariant",
          description:
            "Requires terminal state, outcome, and provenance to agree without conflating tombstones with outcomes.",
          message:
            "Expected terminal state to carry an outcome and provenance, and non-terminal state to carry neither",
        }),
        S.makeFilter(
          (input) =>
            input.evidenceTier ===
            weakestEvidenceTier([input.evidenceTier, ...A.map(input.waits, (wait) => wait.evidenceTier)]),
          {
            identifier: "FlightRecordMechanicalEvidenceTierInvariant",
            title: "Flight-record mechanical evidence-tier invariant",
            description: "Prevents the mechanical observation from outranking any wait evidence it contains.",
            message: "Expected mechanical evidenceTier to be no stronger than every wait tier",
          }
        ),
      ],
      {
        identifier: "FlightRecordMechanicalInvariants",
        title: "Flight-record mechanical invariants",
        description: "Checks terminal consistency and weakest-link evidence propagation.",
      }
    )
  ),
  $I.annote("FlightRecordMechanical", {
    description: "Mechanically derived timestamps, counts, lifecycle, waits, and canonical terminal outcome.",
  })
) {}

const FlightConfigStatus = LiteralKit(["observed", "last-known", "unknown"]);

class ObservedFlightConfig extends S.Class<ObservedFlightConfig>($I`ObservedFlightConfig`)(
  {
    status: S.tag(FlightConfigStatus.Enum.observed),
    fingerprint: Sha256Hex,
    evidenceTier: EvidenceTier,
  },
  $I.annote("ObservedFlightConfig", {
    description: "Configuration fingerprint observed for the represented session.",
  })
) {}

class LastKnownFlightConfig extends S.Class<LastKnownFlightConfig>($I`LastKnownFlightConfig`)(
  {
    status: S.tag(FlightConfigStatus.Enum["last-known"]),
    fingerprint: Sha256Hex,
    evidenceTier: S.Literal(EvidenceTier.Enum.heuristic),
  },
  $I.annote("LastKnownFlightConfig", {
    description: "Last-known configuration fingerprint retained as explicitly heuristic evidence.",
  })
) {}

class UnknownFlightConfig extends S.Class<UnknownFlightConfig>($I`UnknownFlightConfig`)(
  {
    status: S.tag(FlightConfigStatus.Enum.unknown),
    evidenceTier: S.Literal(EvidenceTier.Enum.unknown),
  },
  $I.annote("UnknownFlightConfig", {
    description: "Explicit absence of a session configuration fingerprint.",
  })
) {}

const FlightConfigAttribution = S.Union([ObservedFlightConfig, LastKnownFlightConfig, UnknownFlightConfig]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("FlightConfigAttribution", {
    description: "Observed, last-known, or explicitly unknown session configuration fingerprint.",
  })
);

/**
 * Canonical root and source-instance attribution for a flight record.
 *
 * **Example** (Reference registry identities without embedding paths)
 *
 * ```ts
 * import { FlightRecordAttribution } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const attribution = S.decodeUnknownSync(FlightRecordAttribution)({
 *   rootId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
 *   sourceInstanceId: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
 *   identityNamespaceId: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
 *   evidenceTier: "derived"
 * })
 * console.log(attribution.evidenceTier) // "derived"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FlightRecordAttribution extends S.Class<FlightRecordAttribution>($I`FlightRecordAttribution`)(
  {
    rootId: Sha256Hex,
    sourceInstanceId: Sha256Hex,
    identityNamespaceId: Sha256Hex,
    evidenceTier: EvidenceTier,
  },
  $I.annote("FlightRecordAttribution", {
    description: "Hash-only canonical root, source instance, and identity-namespace attribution.",
  })
) {}

const FlightEvidenceKind = LiteralKit([
  "hook-ledger",
  "semantic-witness",
  "session-lease-reconciliation",
  "transcript",
  "config-snapshot",
  "ingest-manifest",
  "yeet-exhibit",
]);

/**
 * Content-addressed evidence contributing to a flight record.
 *
 * **Example** (Reference a hook ledger without retaining its path)
 *
 * ```ts
 * import { FlightEvidenceReference } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const evidence = S.decodeUnknownSync(FlightEvidenceReference)({
 *   kind: "hook-ledger",
 *   digest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
 *   evidenceTier: "derived",
 *   oipTaint: "unknown"
 * })
 * console.log(evidence.kind) // "hook-ledger"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FlightEvidenceReference extends S.Class<FlightEvidenceReference>($I`FlightEvidenceReference`)(
  {
    kind: FlightEvidenceKind,
    digest: Sha256Hex,
    evidenceTier: EvidenceTier,
    oipTaint: OipTaint,
  },
  $I.annote("FlightEvidenceReference", {
    description: "Bounded evidence kind, content digest, provenance tier, and confidentiality taint.",
  })
) {}

/**
 * Inputs supplied to the telemetry-v2 service when it composes a flight record.
 *
 * **Details**
 *
 * The semantic and mechanical projections remain distinct fields, while the
 * record-wide evidence tier and OIP taint are deliberately absent. The service
 * derives those two values from the supplied projections and evidence
 * references, so an emitter cannot promote either one.
 *
 * **Example** (Inspect the structural split)
 *
 * ```ts
 * import { FlightRecordCompositionInput } from "@beep/repo-ai-metrics"
 *
 * console.log("semantic" in FlightRecordCompositionInput.fields) // true
 * console.log("mechanical" in FlightRecordCompositionInput.fields) // true
 * console.log("evidenceTier" in FlightRecordCompositionInput.fields) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FlightRecordCompositionInput extends S.Class<FlightRecordCompositionInput>(
  $I`FlightRecordCompositionInput`
)(
  {
    recordId: Sha256Hex,
    sessionId: Sha256Hex,
    sourceKind: AiMetricsTranscriptSource,
    attribution: FlightRecordAttribution,
    instrumentClass: InstrumentClass,
    config: FlightConfigAttribution,
    semantic: FlightRecordSemantic,
    mechanical: FlightRecordMechanical,
    evidenceRefs: S.NonEmptyArray(FlightEvidenceReference),
  },
  $I.annote("FlightRecordCompositionInput", {
    description: "Separate semantic and mechanical inputs from which the telemetry-v2 service derives a flight record.",
  })
) {}

/**
 * Composed telemetry-v2 flight record.
 *
 * **Details**
 *
 * Private identifiers, objectives, configuration, and evidence are represented
 * only by SHA-256 references. No field can hold prompt, command, tool-argument,
 * tool-result, or filesystem-path content. Schema checks prevent the composed
 * record from upgrading either evidence tier or OIP taint.
 *
 * **Example** (Decode a privacy-safe record)
 *
 * ```ts
 * import { FlightRecord } from "@beep/repo-ai-metrics"
 *
 * console.log(FlightRecord.decodeJsonEffect('{"schemaVersion":"telemetry-v2/flight-record/v1"}'))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FlightRecord extends S.Class<FlightRecord>($I`FlightRecord`)(
  S.Struct({
    schemaVersion: S.Literal(flightRecordSchemaVersion),
    recordId: Sha256Hex,
    sessionId: Sha256Hex,
    sourceKind: AiMetricsTranscriptSource,
    attribution: FlightRecordAttribution,
    instrumentClass: InstrumentClass,
    config: FlightConfigAttribution,
    semantic: FlightRecordSemantic,
    mechanical: FlightRecordMechanical,
    evidenceRefs: S.NonEmptyArray(FlightEvidenceReference),
    evidenceTier: EvidenceTier,
    oipTaint: OipTaint,
  }).check(
    S.makeFilterGroup(
      [
        S.makeFilter(
          (input) =>
            input.evidenceTier ===
            weakestEvidenceTier([
              input.attribution.evidenceTier,
              input.config.evidenceTier,
              input.semantic.evidenceTier,
              input.mechanical.evidenceTier,
              ...A.map(input.evidenceRefs, (evidence) => evidence.evidenceTier),
            ]),
          {
            identifier: "FlightRecordEvidenceTierInvariant",
            title: "Flight-record evidence-tier invariant",
            description:
              "Requires the record to inherit the weakest tier of every contributing projection and reference.",
            message: "Expected evidenceTier to equal the weakest contributing evidence tier",
          }
        ),
        S.makeFilter(
          (input) => input.oipTaint === combineOipTaints(A.map(input.evidenceRefs, (evidence) => evidence.oipTaint)),
          {
            identifier: "FlightRecordOipTaintInvariant",
            title: "Flight-record OIP taint invariant",
            description: "Requires the record to preserve the most restrictive OIP taint from its evidence chain.",
            message: "Expected oipTaint to preserve the most restrictive evidence-reference taint",
          }
        ),
      ],
      {
        identifier: "FlightRecordInvariants",
        title: "Flight-record invariants",
        description: "Checks weakest-link evidence and OIP confidentiality propagation.",
      }
    )
  ),
  $I.annote("FlightRecord", {
    description: "Privacy-safe composition of agent semantic input and mechanically derived session evidence.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(FlightRecord);
  static readonly encodeEffect = S.encodeUnknownEffect(FlightRecord);
  static readonly decodeResult = S.decodeUnknownResult(FlightRecord);
  static readonly encodeResult = S.encodeResult(FlightRecord);
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(FlightRecord));
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(FlightRecord));
}

const FlightRecordViolationCode = LiteralKit([
  "schema-invalid",
  "mechanical-semantic-boundary",
  "evidence-tier-promotion",
  "privacy-field",
  "terminal-inconsistent",
]);
const AttributionFailureReason = LiteralKit(["missing-identity", "ambiguous-identity", "namespace-mismatch"]);
const FlightRecordWriteStatus = LiteralKit(["accepted", "invalid", "quarantined"]);

class AcceptedFlightRecordWrite extends S.Class<AcceptedFlightRecordWrite>($I`AcceptedFlightRecordWrite`)(
  {
    status: S.tag(FlightRecordWriteStatus.Enum.accepted),
    record: FlightRecord,
  },
  $I.annote("AcceptedFlightRecordWrite", {
    description: "Accepted telemetry-v2 flight record ready for durable append.",
  })
) {}

class InvalidFlightRecordWrite extends S.Class<InvalidFlightRecordWrite>($I`InvalidFlightRecordWrite`)(
  {
    status: S.tag(FlightRecordWriteStatus.Enum.invalid),
    candidateDigest: Sha256Hex,
    violations: S.NonEmptyArray(FlightRecordViolationCode),
    evidenceTier: EvidenceTier,
    oipTaint: OipTaint,
  },
  $I.annote("InvalidFlightRecordWrite", {
    description: "Content-free receipt for a rejected flight-record candidate.",
  })
) {}

class QuarantinedFlightRecordWrite extends S.Class<QuarantinedFlightRecordWrite>($I`QuarantinedFlightRecordWrite`)(
  {
    status: S.tag(FlightRecordWriteStatus.Enum.quarantined),
    candidateDigest: Sha256Hex,
    quarantineRef: Sha256Hex,
    reason: AttributionFailureReason,
    evidenceTier: EvidenceTier,
    oipTaint: OipTaint,
  },
  $I.annote("QuarantinedFlightRecordWrite", {
    description:
      "Content-free receipt for a candidate whose canonical identity could not be resolved without guessing.",
  })
) {}

/**
 * Durable write event for an accepted, invalid, or unattributed flight-record candidate.
 *
 * **Example** (Quarantine unresolved attribution)
 *
 * ```ts
 * import { FlightRecordWriteEvent } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const isWriteEvent = S.is(FlightRecordWriteEvent)
 * console.log(isWriteEvent({ status: "quarantined" })) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FlightRecordWriteEvent = S.Union([
  AcceptedFlightRecordWrite,
  InvalidFlightRecordWrite,
  QuarantinedFlightRecordWrite,
]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("FlightRecordWriteEvent", {
    description: "Accepted record or content-free invalid/quarantine receipt, preventing silent decoder drops.",
  }),
  SchemaUtils.withStatics((schema) => ({
    decodeJsonEffect: S.decodeUnknownEffect(S.fromJsonString(schema)),
    encodeJsonEffect: S.encodeUnknownEffect(S.fromJsonString(schema)),
    makeAccepted: (record: FlightRecord): FlightRecordWriteEvent => AcceptedFlightRecordWrite.make({ record }),
    makeInvalid: (input: Parameters<typeof InvalidFlightRecordWrite.make>[0]): FlightRecordWriteEvent =>
      InvalidFlightRecordWrite.make(input),
    makeQuarantined: (input: Parameters<typeof QuarantinedFlightRecordWrite.make>[0]): FlightRecordWriteEvent =>
      QuarantinedFlightRecordWrite.make(input),
  }))
);

/**
 * Decoded telemetry-v2 flight-record write event.
 *
 * @see {@link FlightRecordWriteEvent} for the runtime tagged union.
 * @category models
 * @since 0.0.0
 */
export type FlightRecordWriteEvent = typeof FlightRecordWriteEvent.Type;
