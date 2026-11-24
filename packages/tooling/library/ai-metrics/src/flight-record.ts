/**
 * Privacy-safe telemetry-v2 flight-record write contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils, Sha256Hex } from "@beep/schema";
import * as Arbitrary from "effect/Arbitrary";
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

/**
 * **Example** (Reference an objective by its content hash)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { KnownFlightObjective } from "@beep/repo-ai-metrics/flight-record"
 *
 * const objective = S.decodeUnknownSync(KnownFlightObjective)({
 *   status: "known",
 *   objectiveRef: "1".repeat(64),
 *   evidenceTier: "derived"
 * })
 *
 * console.log(objective.evidenceTier) // => "derived"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnownFlightObjective extends S.Opaque<KnownFlightObjective, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag(FlightObjectiveStatus.Enum.known),
    objectiveRef: Sha256Hex,
    evidenceTier: EvidenceTier,
  }).pipe(
    $I.annoteSchema("KnownFlightObjective", {
      description: "Content-addressed objective supplied by the semantic flight-record channel.",
    })
  )
) {}

/**
 * **Example** (Admit that no objective was attributable)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FlightRecordSemantic, UnknownFlightObjective } from "@beep/repo-ai-metrics/flight-record"
 *
 * const semantic = FlightRecordSemantic.make({
 *   objective: UnknownFlightObjective.make({ evidenceTier: "unknown" }),
 *   semanticTurns: [],
 *   selfReportedTerminalOutcome: "unknown",
 *   evidenceTier: "unknown"
 * })
 *
 * console.log(S.is(UnknownFlightObjective)(semantic.objective)) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnknownFlightObjective extends S.Opaque<UnknownFlightObjective, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag(FlightObjectiveStatus.Enum.unknown),
    evidenceTier: S.tag(EvidenceTier.Enum.unknown),
  }).pipe(
    $I.annoteSchema("UnknownFlightObjective", {
      description: "Explicit absence of an attributable objective, without a guessed or free-text replacement.",
    })
  )
) {}

const FlightObjective = S.Union([KnownFlightObjective, UnknownFlightObjective]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("FlightObjective", {
    description: "Known content-addressed objective or an explicit unknown objective.",
  })
);

/**
 * **Example** (Label one turn without recording its content)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FlightSemanticTurn } from "@beep/repo-ai-metrics/flight-record"
 *
 * const turn = S.decodeUnknownSync(FlightSemanticTurn)({
 *   turnId: "2".repeat(64),
 *   sequence: 0,
 *   lifecycleState: "active",
 *   activePhase: "tool-execution",
 *   selfReportedTerminalOutcome: "none",
 *   evidenceTier: "observed"
 * })
 *
 * console.log(turn.activePhase) // => "tool-execution"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FlightSemanticTurn extends S.Opaque<FlightSemanticTurn, { readonly brand: unique symbol }>()(
  S.Struct({
    turnId: Sha256Hex,
    sequence: S.Natural,
    lifecycleState: LifecycleState,
    activePhase: ActivePhase,
    selfReportedTerminalOutcome: TerminalOutcome,
    evidenceTier: EvidenceTier,
  }).pipe(
    $I.annoteSchema("FlightSemanticTurn", {
      description: "Content-free semantic labels supplied for one turn, with no mechanical timing or count fields.",
    })
  )
) {}

/**
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
export class FlightRecordSemantic extends S.Opaque<FlightRecordSemantic, { readonly brand: unique symbol }>()(
  S.Struct({
    objective: FlightObjective,
    semanticTurns: S.Array(FlightSemanticTurn),
    selfReportedTerminalOutcome: TerminalOutcome,
    evidenceTier: EvidenceTier,
  })
    .check(
      S.makeFilter(
        (input) =>
          input.evidenceTier ===
          weakestEvidenceTier([
            input.objective.evidenceTier,
            ...A.map(input.semanticTurns, (turn) => turn.evidenceTier),
          ]),
        {
          identifier: "FlightRecordSemanticEvidenceTierInvariant",
          title: "Flight-record semantic evidence-tier invariant",
          description:
            "Requires the semantic projection to carry the weakest evidence tier of its objective and turns.",
          message: "Expected semantic evidenceTier to equal the weakest objective or turn tier",
        }
      )
    )
    .pipe(
      $I.annoteSchema("FlightRecordSemantic", {
        description: "Agent-authored content-free objective, turn labels, and self-reported terminal outcome.",
      })
    )
) {}

const FlightWaitStatus = LiteralKit(["open", "closed", "tombstoned"]);

/**
 * **Example** (Keep a pending permission wait open without a duration)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FlightWaitSpan, OpenFlightWait } from "@beep/repo-ai-metrics/flight-record"
 *
 * const wait = S.decodeUnknownSync(OpenFlightWait)({
 *   status: "open",
 *   waitId: "3".repeat(64),
 *   openedAt: "2026-10-14T09:00:00.000Z",
 *   reason: "tool-permission",
 *   evidenceTier: "observed"
 * })
 *
 * console.log(FlightWaitSpan.guards.open(wait)) // => true
 * console.log("durationMs" in wait) // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenFlightWait extends S.Opaque<OpenFlightWait, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag(FlightWaitStatus.Enum.open),
    waitId: Sha256Hex,
    openedAt: S.DateTimeUtcFromString,
    reason: WaitReason,
    evidenceTier: EvidenceTier,
  }).pipe(
    $I.annoteSchema("OpenFlightWait", {
      description: "Mechanically observed wait bracket that has not received terminal evidence.",
    })
  )
) {}

/**
 * **Example** (Close a wait with its measured duration)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ClosedFlightWait } from "@beep/repo-ai-metrics/flight-record"
 *
 * const wait = S.decodeUnknownSync(ClosedFlightWait)({
 *   status: "closed",
 *   waitId: "3".repeat(64),
 *   openedAt: "2026-10-14T09:00:00.000Z",
 *   closedAt: "2026-10-14T09:00:42.000Z",
 *   durationMs: 42_000,
 *   reason: "tool-permission",
 *   evidenceTier: "derived"
 * })
 *
 * console.log(wait.durationMs / 1000) // => 42
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClosedFlightWait extends S.Opaque<ClosedFlightWait, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag(FlightWaitStatus.Enum.closed),
    waitId: Sha256Hex,
    openedAt: S.DateTimeUtcFromString,
    closedAt: S.DateTimeUtcFromString,
    durationMs: S.Finite.check(S.isGreaterThanOrEqualTo(0)),
    reason: WaitReason,
    evidenceTier: EvidenceTier,
  }).pipe(
    $I.annoteSchema("ClosedFlightWait", {
      description: "Mechanically closed wait bracket with a computed non-negative duration.",
    })
  )
) {}

/**
 * **Example** (Retire a wait that never closed)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FlightWaitSpan, TombstonedFlightWait } from "@beep/repo-ai-metrics/flight-record"
 *
 * const wait = S.decodeUnknownSync(TombstonedFlightWait)({
 *   status: "tombstoned",
 *   waitId: "4".repeat(64),
 *   openedAt: "2026-10-14T09:00:00.000Z",
 *   tombstonedAt: "2026-10-14T11:00:00.000Z",
 *   reason: "idle-input",
 *   evidenceTier: "reconstructed"
 * })
 *
 * console.log(FlightWaitSpan.isAnyOf(["closed", "tombstoned"])(wait)) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TombstonedFlightWait extends S.Opaque<TombstonedFlightWait, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag(FlightWaitStatus.Enum.tombstoned),
    waitId: Sha256Hex,
    openedAt: S.DateTimeUtcFromString,
    tombstonedAt: S.DateTimeUtcFromString,
    reason: WaitReason,
    evidenceTier: EvidenceTier,
  }).pipe(
    $I.annoteSchema("TombstonedFlightWait", {
      description: "Unclosed wait bracket retained with explicit tombstone provenance instead of a guessed close.",
    })
  )
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
  })
);

/**
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
export class FlightRecordMechanical extends S.Opaque<FlightRecordMechanical, { readonly brand: unique symbol }>()(
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
  })
    .check(
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
    )
    .pipe(
      $I.annoteSchema("FlightRecordMechanical", {
        description: "Mechanically derived timestamps, counts, lifecycle, waits, and canonical terminal outcome.",
      })
    )
) {}

const FlightConfigStatus = LiteralKit(["observed", "last-known", "unknown"]);

/**
 * **Example** (Attribute a session to its observed config fingerprint)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ObservedFlightConfig } from "@beep/repo-ai-metrics/flight-record"
 *
 * const config = S.decodeUnknownSync(ObservedFlightConfig)({
 *   status: "observed",
 *   fingerprint: "5".repeat(64),
 *   evidenceTier: "observed"
 * })
 *
 * console.log(config.status) // => "observed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObservedFlightConfig extends S.Opaque<ObservedFlightConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag(FlightConfigStatus.Enum.observed),
    fingerprint: Sha256Hex,
    evidenceTier: EvidenceTier,
  }).pipe(
    $I.annoteSchema("ObservedFlightConfig", {
      description: "Configuration fingerprint observed for the represented session.",
    })
  )
) {}

/**
 * **Example** (Reject a last-known fingerprint claimed as observed)
 *
 * ```ts
 * import * as Exit from "effect/Exit"
 * import * as S from "effect/Schema"
 * import { LastKnownFlightConfig } from "@beep/repo-ai-metrics/flight-record"
 *
 * const decode = S.decodeUnknownExit(LastKnownFlightConfig)
 * const fingerprint = "5".repeat(64)
 *
 * console.log(Exit.isSuccess(decode({ status: "last-known", fingerprint, evidenceTier: "heuristic" }))) // => true
 * console.log(Exit.isSuccess(decode({ status: "last-known", fingerprint, evidenceTier: "observed" }))) // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LastKnownFlightConfig extends S.Opaque<LastKnownFlightConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag(FlightConfigStatus.Enum["last-known"]),
    fingerprint: Sha256Hex,
    evidenceTier: S.tag(EvidenceTier.Enum.heuristic),
  }).pipe(
    $I.annoteSchema("LastKnownFlightConfig", {
      description: "Last-known configuration fingerprint retained as explicitly heuristic evidence.",
    })
  )
) {}

/**
 * **Example** (Record that no config fingerprint exists)
 *
 * ```ts
 * import { UnknownFlightConfig } from "@beep/repo-ai-metrics/flight-record"
 *
 * const config = UnknownFlightConfig.make({ evidenceTier: "unknown" })
 *
 * console.log(config.status) // => "unknown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnknownFlightConfig extends S.Opaque<UnknownFlightConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag(FlightConfigStatus.Enum.unknown),
    evidenceTier: S.tag(EvidenceTier.Enum.unknown),
  }).pipe(
    $I.annoteSchema("UnknownFlightConfig", {
      description: "Explicit absence of a session configuration fingerprint.",
    })
  )
) {}

const FlightConfigAttribution = S.Union([ObservedFlightConfig, LastKnownFlightConfig, UnknownFlightConfig]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("FlightConfigAttribution", {
    description: "Observed, last-known, or explicitly unknown session configuration fingerprint.",
  })
);

/**
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
export class FlightRecordAttribution extends S.Opaque<FlightRecordAttribution, { readonly brand: unique symbol }>()(
  S.Struct({
    rootId: Sha256Hex,
    sourceInstanceId: Sha256Hex,
    identityNamespaceId: Sha256Hex,
    evidenceTier: EvidenceTier,
  }).pipe(
    $I.annoteSchema("FlightRecordAttribution", {
      description: "Hash-only canonical root, source instance, and identity-namespace attribution.",
    })
  )
) {}

const FlightEvidenceKind = LiteralKit([
  "hook-ledger",
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
export class FlightEvidenceReference extends S.Opaque<FlightEvidenceReference, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: FlightEvidenceKind,
    digest: Sha256Hex,
    evidenceTier: EvidenceTier,
    oipTaint: OipTaint,
  }).pipe(
    $I.annoteSchema("FlightEvidenceReference", {
      description: "Bounded evidence kind, content digest, provenance tier, and confidentiality taint.",
    })
  )
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
export class FlightRecordCompositionInput extends S.Opaque<
  FlightRecordCompositionInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    recordId: Sha256Hex,
    sessionId: Sha256Hex,
    sourceKind: AiMetricsTranscriptSource,
    attribution: FlightRecordAttribution,
    instrumentClass: InstrumentClass,
    config: FlightConfigAttribution,
    semantic: FlightRecordSemantic,
    mechanical: FlightRecordMechanical,
    evidenceRefs: S.NonEmptyArray(FlightEvidenceReference),
  }).pipe(
    $I.annoteSchema("FlightRecordCompositionInput", {
      description:
        "Separate semantic and mechanical inputs from which the telemetry-v2 service derives a flight record.",
    })
  )
) {}

const FlightRecordSemanticArbitrary = Arbitrary.schema(S.Struct(FlightRecordSemantic.fields)).pipe(
  Arbitrary.map((value) =>
    FlightRecordSemantic.make({
      ...value,
      evidenceTier: weakestEvidenceTier([
        value.objective.evidenceTier,
        ...A.map(value.semanticTurns, (turn) => turn.evidenceTier),
      ]),
    })
  )
);

// Constructive terminal reconciliation: rejection-filtering random
// state/outcome/provenance triples exhausts the discard budget under seed
// rotation, so the generator makes each triple consistent instead.
const FlightRecordMechanicalArbitrary = Arbitrary.schema(S.Struct(FlightRecordMechanical.fields)).pipe(
  Arbitrary.map((value) => {
    const isTerminal = LifecycleState.is.terminal(value.lifecycleState);
    return FlightRecordMechanical.make({
      ...value,
      terminalOutcome: Bool.match(isTerminal, {
        onFalse: () => TerminalOutcome.Enum.none,
        onTrue: () =>
          TerminalOutcome.is.none(value.terminalOutcome) ? TerminalOutcome.Enum.unknown : value.terminalOutcome,
      }),
      terminalProvenance: Bool.match(isTerminal, {
        onFalse: () => TerminalProvenance.Enum.none,
        onTrue: () =>
          TerminalProvenance.is.none(value.terminalProvenance)
            ? TerminalProvenance.Enum.unknown
            : value.terminalProvenance,
      }),
      evidenceTier: weakestEvidenceTier([value.evidenceTier, ...A.map(value.waits, (wait) => wait.evidenceTier)]),
    });
  })
);

/**
 * Generates composition inputs with consistent lifecycle and evidence attribution.
 *
 * **Example** (Sample flight-record composition inputs)
 * ```ts
 * import { FlightRecordCompositionInputArbitrary } from "@beep/repo-ai-metrics"
 * import * as Arbitrary from "effect/Arbitrary"
 * console.log(Arbitrary.sampleEffect(FlightRecordCompositionInputArbitrary, { count: 3 }))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const FlightRecordCompositionInputArbitrary = Arbitrary.all([
  Arbitrary.schema(
    S.Struct({ ...FlightRecordCompositionInput.fields, semantic: S.Undefined, mechanical: S.Undefined })
  ),
  FlightRecordSemanticArbitrary,
  FlightRecordMechanicalArbitrary,
]).pipe(
  Arbitrary.map(([base, semantic, mechanical]) => FlightRecordCompositionInput.make({ ...base, semantic, mechanical }))
);

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
export class FlightRecord extends S.Opaque<FlightRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag(flightRecordSchemaVersion),
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
  })
    .check(
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
    )
    .pipe(
      $I.annoteSchema("FlightRecord", {
        description: "Privacy-safe composition of agent semantic input and mechanically derived session evidence.",
      })
    )
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

/**
 * **Example** (Tell an accepted write apart from a receipt)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AcceptedFlightRecordWrite, FlightRecordWriteEvent } from "@beep/repo-ai-metrics/flight-record"
 *
 * const event = S.decodeUnknownSync(FlightRecordWriteEvent)({
 *   status: "invalid",
 *   candidateDigest: "6".repeat(64),
 *   violations: ["privacy-field"],
 *   evidenceTier: "derived",
 *   oipTaint: "clear"
 * })
 *
 * console.log(S.is(AcceptedFlightRecordWrite)(event)) // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AcceptedFlightRecordWrite extends S.Opaque<AcceptedFlightRecordWrite, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag(FlightRecordWriteStatus.Enum.accepted),
    record: FlightRecord,
  }).pipe(
    $I.annoteSchema("AcceptedFlightRecordWrite", {
      description: "Accepted telemetry-v2 flight record ready for durable append.",
    })
  )
) {}

/**
 * **Example** (Receipt a rejected candidate by digest only)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { InvalidFlightRecordWrite } from "@beep/repo-ai-metrics/flight-record"
 *
 * const receipt = S.decodeUnknownSync(InvalidFlightRecordWrite)({
 *   status: "invalid",
 *   candidateDigest: "6".repeat(64),
 *   violations: ["mechanical-semantic-boundary", "evidence-tier-promotion"],
 *   evidenceTier: "derived",
 *   oipTaint: "clear"
 * })
 *
 * console.log(receipt.violations.length) // => 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InvalidFlightRecordWrite extends S.Opaque<InvalidFlightRecordWrite, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag(FlightRecordWriteStatus.Enum.invalid),
    candidateDigest: Sha256Hex,
    violations: S.NonEmptyArray(FlightRecordViolationCode),
    evidenceTier: EvidenceTier,
    oipTaint: OipTaint,
  }).pipe(
    $I.annoteSchema("InvalidFlightRecordWrite", {
      description: "Content-free receipt for a rejected flight-record candidate.",
    })
  )
) {}

/**
 * **Example** (Quarantine a candidate with ambiguous identity)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FlightRecordWriteEvent, QuarantinedFlightRecordWrite } from "@beep/repo-ai-metrics/flight-record"
 *
 * const receipt = S.decodeUnknownSync(QuarantinedFlightRecordWrite)({
 *   status: "quarantined",
 *   candidateDigest: "6".repeat(64),
 *   quarantineRef: "7".repeat(64),
 *   reason: "ambiguous-identity",
 *   evidenceTier: "derived",
 *   oipTaint: "tainted"
 * })
 *
 * console.log(FlightRecordWriteEvent.guards.quarantined(receipt)) // => true
 * console.log(receipt.reason) // => "ambiguous-identity"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QuarantinedFlightRecordWrite extends S.Opaque<
  QuarantinedFlightRecordWrite,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    status: S.tag(FlightRecordWriteStatus.Enum.quarantined),
    candidateDigest: Sha256Hex,
    quarantineRef: Sha256Hex,
    reason: AttributionFailureReason,
    evidenceTier: EvidenceTier,
    oipTaint: OipTaint,
  }).pipe(
    $I.annoteSchema("QuarantinedFlightRecordWrite", {
      description:
        "Content-free receipt for a candidate whose canonical identity could not be resolved without guessing.",
    })
  )
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
  SchemaUtils.withStatics(() => ({
    makeAccepted: (record: FlightRecord): FlightRecordWriteEvent => AcceptedFlightRecordWrite.make({ record }),
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

/**
 * FlightRecordWriteEvent encoded as one JSON string, the line format the telemetry-v2 store
 * appends and reads back.
 *
 * **Example** (Round-trip a flight-record write line)
 *
 * ```ts
 * import { FlightRecordWriteEventJson } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownEffect(FlightRecordWriteEventJson)
 * console.log(typeof decode) // "function"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FlightRecordWriteEventJson = S.fromJsonString(FlightRecordWriteEvent);
