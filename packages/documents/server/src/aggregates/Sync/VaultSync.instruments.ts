/**
 * Instrument declarations owned by `@beep/documents-server` for vault sync:
 * the `VaultSyncApi.command` and `VaultSyncApi.read` boundary spans, the
 * `VaultSyncPass.run` and `VaultSyncPass.step` saga spans, the `BoxMirror.call`
 * adapter span, the Session spans, and the `documents.vault_sync.*` keys they
 * carry.
 *
 * **Details**
 *
 * Every key follows the D17 redaction rules: no key carries a path, a name,
 * evidence, a digest or a cursor. Literal keys are allowed at `shape-only`;
 * the opaque identifiers (`destination_id`, `operation_id`,
 * `request_correlation_id`) are allowed from `standard` up, so a
 * `StrictDesktop` host keeps the shape of a call and drops every identifier.
 * Each span lists only the keys it carries at `shape-only`; the identifiers
 * it adds at `standard` are named in its description.
 * Kernel spans (`Domain.send`, `Domain.decide` and the rest) nest under these
 * boundary spans; their names are library internals and stay out of the
 * catalog.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { MirrorFailureStage, VaultSyncDestinationIdAttribute } from "@beep/documents-use-cases/aggregates/VaultSync";
import { $DocumentsServerId } from "@beep/identity/packages";
import {
  AttributeKey,
  AttributeKeyName,
  InstrumentDeclarations,
  PackageName,
  SignalKind,
  SpanInstrument,
  SpanName,
} from "@beep/observability/catalog";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { BoxMirrorUnavailable } from "@beep/documents-use-cases/aggregates/VaultSync";
import type { CardinalityClass, SpanKind } from "@beep/observability/catalog";

const $I = $DocumentsServerId.create("aggregates/Sync/VaultSync.instruments");

const owner = PackageName.make("@beep/documents-server");

/**
 * The seven commands the vault-sync Api exposes, the value of
 * `documents.vault_sync.command`.
 *
 * **Example** (Check a command tag)
 *
 * ```ts
 * import { VaultSyncApiCommand } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(VaultSyncApiCommand.is.RequestVaultSync("RequestVaultSync")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VaultSyncApiCommand = LiteralKit([
  "RequestVaultSync",
  "ProbeDestination",
  "ClaimDestinationName",
  "RecordConflict",
  "PauseDestination",
  "ResumeDestination",
  "ReviewConflict",
]).pipe(
  $I.annoteSchema("VaultSyncApiCommand", {
    description: "Command tag of the vault-sync Api, as a span attribute value.",
  })
);

/**
 * Runtime type for {@link VaultSyncApiCommand}.
 *
 * @category models
 * @since 0.0.0
 */
export type VaultSyncApiCommand = typeof VaultSyncApiCommand.Type;

/**
 * The four Views the vault-sync Api exposes, the value of
 * `documents.vault_sync.view`.
 *
 * **Example** (Read a View name)
 *
 * ```ts
 * import { VaultSyncApiView } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(VaultSyncApiView.Enum.VaultSyncStatus) // "VaultSyncStatus"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VaultSyncApiView = LiteralKit([
  "VaultSyncStatus",
  "OpenConflicts",
  "DestinationList",
  "OperationQueue",
]).pipe(
  $I.annoteSchema("VaultSyncApiView", {
    description: "View name of the vault-sync Api, as a span attribute value.",
  })
);

/**
 * Runtime type for {@link VaultSyncApiView}.
 *
 * @category models
 * @since 0.0.0
 */
export type VaultSyncApiView = typeof VaultSyncApiView.Type;

/**
 * How a View is read, the value of `documents.vault_sync.read_mode`.
 *
 * **Example** (Read a read mode)
 *
 * ```ts
 * import { VaultSyncReadMode } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(VaultSyncReadMode.Enum.watch) // "watch"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VaultSyncReadMode = LiteralKit(["get", "snapshot", "list", "watch", "events"]).pipe(
  $I.annoteSchema("VaultSyncReadMode", {
    description: "Read method of a vault-sync View, as a span attribute value.",
  })
);

/**
 * Runtime type for {@link VaultSyncReadMode}.
 *
 * @category models
 * @since 0.0.0
 */
export type VaultSyncReadMode = typeof VaultSyncReadMode.Type;

/**
 * The durable activities of one vault-sync pass, the value of
 * `documents.vault_sync.pass_step`.
 *
 * **Example** (Read a pass step)
 *
 * ```ts
 * import { VaultSyncPassStep } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(VaultSyncPassStep.Enum.scan) // "scan"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VaultSyncPassStep = LiteralKit([
  "refreshProbe",
  "probe",
  "scan",
  "plan",
  "pump",
  "pollStart",
  "poll",
]).pipe(
  $I.annoteSchema("VaultSyncPassStep", {
    description: "Durable activity of a vault-sync pass, as a span attribute value.",
  })
);

/**
 * Runtime type for {@link VaultSyncPassStep}.
 *
 * @category models
 * @since 0.0.0
 */
export type VaultSyncPassStep = typeof VaultSyncPassStep.Type;

/**
 * The eight `BoxMirror` operations, the value of
 * `documents.vault_sync.box_operation`.
 *
 * **Example** (Read a Box operation)
 *
 * ```ts
 * import { VaultSyncBoxOperation } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(VaultSyncBoxOperation.Enum.uploadFile) // "uploadFile"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VaultSyncBoxOperation = LiteralKit(["probe", ...V.MirrorOperation.literals]).pipe(
  $I.annoteSchema("VaultSyncBoxOperation", {
    description: "BoxMirror operation, as a span attribute value.",
  })
);

/**
 * Runtime type for {@link VaultSyncBoxOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type VaultSyncBoxOperation = typeof VaultSyncBoxOperation.Type;

/**
 * Where a `BoxMirror` call failed, the value of
 * `documents.vault_sync.box_failure`: an adapter stage, or `remote` when Box
 * itself failed.
 *
 * **Example** (Read a failure place)
 *
 * ```ts
 * import { VaultSyncBoxFailure } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(VaultSyncBoxFailure.Enum.remote) // "remote"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VaultSyncBoxFailure = LiteralKit([...MirrorFailureStage.literals, "remote"]).pipe(
  $I.annoteSchema("VaultSyncBoxFailure", {
    description: "Adapter stage or remote side where a BoxMirror call failed, as a span attribute value.",
  })
);

/**
 * Runtime type for {@link VaultSyncBoxFailure}.
 *
 * @category models
 * @since 0.0.0
 */
export type VaultSyncBoxFailure = typeof VaultSyncBoxFailure.Type;

/**
 * Terminal outcomes of a vault-sync boundary span other than a rule
 * violation, which is recorded as `SyncRuleViolation:<rule>`.
 *
 * **Example** (Read an outcome)
 *
 * ```ts
 * import { VaultSyncOutcome } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(VaultSyncOutcome.Enum.accepted) // "accepted"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VaultSyncOutcome = LiteralKit(["accepted", "ScopeDenied", "failed", "interrupted", "defect"]).pipe(
  $I.annoteSchema("VaultSyncOutcome", {
    description: "Terminal outcome of a vault-sync span, other than a named rule violation.",
  })
);

/**
 * Runtime type for {@link VaultSyncOutcome}.
 *
 * @category models
 * @since 0.0.0
 */
export type VaultSyncOutcome = typeof VaultSyncOutcome.Type;

/**
 * The `documents.vault_sync.*` attribute keys, by field. `destinationId` is
 * declared by `@beep/documents-use-cases`, whose `VaultSyncRequests.start`
 * span carries it; the rest are declared here.
 *
 * **Example** (Read an attribute key)
 *
 * ```ts
 * import { VaultSyncAttribute } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(VaultSyncAttribute.transport) // "documents.vault_sync.transport"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VaultSyncAttribute = {
  transport: AttributeKeyName.make("documents.vault_sync.transport"),
  command: AttributeKeyName.make("documents.vault_sync.command"),
  view: AttributeKeyName.make("documents.vault_sync.view"),
  readMode: AttributeKeyName.make("documents.vault_sync.read_mode"),
  outcome: AttributeKeyName.make("documents.vault_sync.outcome"),
  destinationId: VaultSyncDestinationIdAttribute,
  operationId: AttributeKeyName.make("documents.vault_sync.operation_id"),
  requestCorrelationId: AttributeKeyName.make("documents.vault_sync.request_correlation_id"),
  probeOnly: AttributeKeyName.make("documents.vault_sync.probe_only"),
  passStep: AttributeKeyName.make("documents.vault_sync.pass_step"),
  boxOperation: AttributeKeyName.make("documents.vault_sync.box_operation"),
  boxFailure: AttributeKeyName.make("documents.vault_sync.box_failure"),
  itemsObserved: AttributeKeyName.make("documents.vault_sync.items_observed"),
  operationsSucceeded: AttributeKeyName.make("documents.vault_sync.operations_succeeded"),
  conflicts: AttributeKeyName.make("documents.vault_sync.conflicts"),
} as const;

const ruleOutcome = (rule: V.SyncRule) => `SyncRuleViolation:${rule}` as const;

const ruleOf = (error: unknown): O.Option<V.SyncRule> =>
  P.isTagged(error, "SyncRuleViolation") && P.hasProperty(error, "rule")
    ? O.liftPredicate(error.rule, S.is(V.SyncRule))
    : O.none();

const failureOutcome = (error: unknown): string =>
  O.getOrElse(O.map(ruleOf(error), ruleOutcome), () =>
    P.isTagged(error, "ScopeDenied") ? VaultSyncOutcome.Enum.ScopeDenied : VaultSyncOutcome.Enum.failed
  );

const causeOutcome = <E>(cause: Cause.Cause<E>): string =>
  Cause.hasInterruptsOnly(cause)
    ? VaultSyncOutcome.Enum.interrupted
    : O.match(Cause.findErrorOption(cause), { onNone: () => VaultSyncOutcome.Enum.defect, onSome: failureOutcome });

/**
 * The bounded outcome a vault-sync span records for an exit: `accepted`, a
 * failure tag (`ScopeDenied`, `SyncRuleViolation:<rule>`, `failed`), or
 * `interrupted` / `defect`. Never the error's message or payload.
 *
 * **Example** (Classify exits)
 *
 * ```ts
 * import { vaultSyncOutcomeOf } from "@beep/documents-server/aggregates/Sync"
 * import * as Exit from "effect/Exit"
 *
 * console.log(vaultSyncOutcomeOf(Exit.void)) // "accepted"
 * console.log(vaultSyncOutcomeOf(Exit.die("boom"))) // "defect"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const vaultSyncOutcomeOf = <A, E>(exit: Exit.Exit<A, E>): string =>
  Exit.match(exit, { onSuccess: () => VaultSyncOutcome.Enum.accepted, onFailure: causeOutcome });

/**
 * Records {@link vaultSyncOutcomeOf} on the current span when `self` exits.
 * Apply it inside the span it annotates.
 *
 * **Example** (Record the outcome of a traced effect)
 *
 * ```ts
 * import { annotateVaultSyncOutcome } from "@beep/documents-server/aggregates/Sync"
 * import * as Effect from "effect/Effect"
 *
 * const traced = Effect.void.pipe(annotateVaultSyncOutcome, Effect.withSpan("VaultSyncApi.command"))
 * void traced
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const annotateVaultSyncOutcome = <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.onExit(self, (exit) => Effect.annotateCurrentSpan(VaultSyncAttribute.outcome, vaultSyncOutcomeOf(exit)));

/**
 * Where a `BoxMirror` failure stopped: its adapter stage, or `remote` when it
 * came back from Box.
 *
 * **Example** (Classify a remote failure)
 *
 * ```ts
 * import { vaultSyncBoxFailureOf } from "@beep/documents-server/aggregates/Sync"
 * import { BoxMirrorUnavailable } from "@beep/documents-use-cases/aggregates/VaultSync"
 *
 * const failure = BoxMirrorUnavailable.make({ retryable: true, disconnectReason: null, operation: "pollEvents", stage: null })
 * console.log(vaultSyncBoxFailureOf(failure)) // "remote"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const vaultSyncBoxFailureOf = (failure: BoxMirrorUnavailable): VaultSyncBoxFailure =>
  failure.stage ?? VaultSyncBoxFailure.Enum.remote;

const outcomeValues = A.appendAll(VaultSyncOutcome.literals, A.map(V.SyncRule.literals, ruleOutcome));

const literalKey = (
  key: AttributeKeyName,
  values: A.NonEmptyReadonlyArray<string>,
  description: string,
  cardinality: CardinalityClass = "static"
) =>
  AttributeKey.make({
    key,
    type: "string",
    signals: [SignalKind.Enum.span],
    cardinality,
    minTier: "shape-only",
    values: O.some(values),
    owner,
    description,
  });

const identifierKey = (key: AttributeKeyName, description: string) =>
  AttributeKey.make({
    key,
    type: "string",
    signals: [SignalKind.Enum.span],
    cardinality: "unbounded",
    minTier: "standard",
    values: O.none(),
    owner,
    description,
  });

const countKey = (key: AttributeKeyName, description: string) =>
  AttributeKey.make({
    key,
    type: "int",
    signals: [SignalKind.Enum.span],
    cardinality: "unbounded",
    minTier: "shape-only",
    values: O.none(),
    owner,
    description,
  });

const span = (name: string, kind: SpanKind, attributes: ReadonlyArray<AttributeKeyName>, description: string) =>
  SpanInstrument.make({
    name: SpanName.make(name),
    owner,
    family: "slice",
    attributes,
    minTier: "shape-only",
    description,
    kind,
  });

const K = VaultSyncAttribute;
const sessionAttributes = [K.transport, K.outcome];

/**
 * Vault-sync declarations: the `documents.vault_sync.*` keys and the
 * boundary, pass, adapter and Session spans that carry them.
 *
 * **Example** (List the declared spans)
 *
 * ```ts
 * import { VaultSyncInstruments } from "@beep/documents-server/aggregates/Sync"
 *
 * console.log(VaultSyncInstruments.instruments.map((instrument) => instrument.name))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VaultSyncInstruments = InstrumentDeclarations.make({
  attributes: [
    literalKey(K.transport, V.TransportKind.literals, "Verified transport the vault-sync call arrived on."),
    literalKey(K.command, VaultSyncApiCommand.literals, "Vault-sync Api command a boundary span serves."),
    literalKey(K.view, VaultSyncApiView.literals, "Vault-sync Api View a read boundary span serves."),
    literalKey(K.readMode, VaultSyncReadMode.literals, "How a vault-sync View is read."),
    literalKey(
      K.outcome,
      outcomeValues,
      "Terminal outcome of a vault-sync span: accepted, a failure tag or a named rule violation.",
      "bounded"
    ),
    identifierKey(K.operationId, "Hashed OperationId a vault-sync pump step pushes."),
    identifierKey(K.requestCorrelationId, "Validated request correlation token of a vault-sync Api call."),
    AttributeKey.make({
      key: K.probeOnly,
      type: "boolean",
      signals: [SignalKind.Enum.span],
      cardinality: "static",
      minTier: "shape-only",
      values: O.none(),
      owner,
      description: "Whether a vault-sync pass only refreshes the Box probe.",
    }),
    literalKey(K.passStep, VaultSyncPassStep.literals, "Durable activity of a vault-sync pass."),
    literalKey(K.boxOperation, VaultSyncBoxOperation.literals, "BoxMirror operation an adapter call runs."),
    literalKey(
      K.boxFailure,
      VaultSyncBoxFailure.literals,
      "Adapter stage or remote side where a BoxMirror call failed."
    ),
    countKey(K.itemsObserved, "Local vault entries a pass scan observed."),
    countKey(K.operationsSucceeded, "Box operations a pass completed."),
    countKey(K.conflicts, "Remote conflicts a pass recorded."),
  ],
  instruments: [
    span(
      "VaultSyncApi.command",
      "internal",
      [K.transport, K.command, K.outcome],
      "Serves one vault-sync Api command on any transport, around the Session and the kernel send; from standard up it also carries destination_id and request_correlation_id."
    ),
    span(
      "VaultSyncApi.read",
      "internal",
      [K.transport, K.view, K.readMode, K.outcome],
      "Serves one vault-sync View read or subscription on any transport, around the Session; from standard up it also carries destination_id and request_correlation_id."
    ),
    span(
      "VaultSyncPass.run",
      "internal",
      [K.probeOnly, K.operationsSucceeded, K.conflicts, K.outcome],
      "Runs one durable vault-sync pass for a destination; from standard up it also carries destination_id."
    ),
    span(
      "VaultSyncPass.step",
      "internal",
      [K.passStep, K.itemsObserved, K.outcome],
      "Runs one durable activity of a vault-sync pass, under its activity span; a pump step carries operation_id from standard up."
    ),
    span("BoxMirror.call", "client", [K.boxOperation, K.boxFailure, K.outcome], "Runs one BoxMirror operation."),
    span("VaultSyncSession.resolve", "internal", sessionAttributes, "Resolves the verified vault-sync request."),
    span("VaultSyncSession.grants", "internal", sessionAttributes, "Reads the caller's live vault-sync grants."),
    span("VaultSyncSession.scope", "internal", sessionAttributes, "Resolves the scope an Api call targets."),
    span("VaultSyncSession.registered", "internal", sessionAttributes, "Reads a registered destination's scope."),
    span("VaultSyncSession.revoked", "internal", sessionAttributes, "Waits for the caller's grants to be revoked."),
    span("VaultSync.deliveryCheck", "internal", sessionAttributes, "Re-authorizes one delivered View frame."),
  ],
});
