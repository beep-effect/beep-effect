/**
 * Whole-account cohort cutover contracts.
 *
 * **Details**
 *
 * Server-authoritative cutover state is distinct from universal memory
 * membership and task-intelligence workflow mode. This module owns the
 * account-wide legacy, migrating, and new transition, plus the accepted lossy
 * rollback that can strand new-backend writes.
 *
 * @since 0.0.0
 */
import { sql } from "drizzle-orm";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  Model,
  accountGenerationDefault,
  boundedText,
  nonNegativeInt,
  nonNegativeIntCheck,
  optionalBool,
  optionalBoundedText,
  optionalNonNegativeInt,
  optionalNull,
  optionalStableId,
  pg,
  stableIdCheck,
  textBoundsCheck,
} from "./Kit.ts";

const $I = $ScratchpadId.create("beep/AccountCutover");

/**
 * Persisted cutover schema version.
 *
 * **Details**
 *
 * Python asserts `ACCOUNT_CUTOVER_SCHEMA_VERSION == 1`. The literal stays 1
 * so this port cannot drift from that config constant.
 *
 * **Example** (Read the version)
 *
 * ```ts
 * import { accountCutoverSchemaVersion } from "@beep/scratchpad/beep/AccountCutover"
 *
 * console.log(accountCutoverSchemaVersion) // 1
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const accountCutoverSchemaVersion = 1;

const schemaVersionLiteral = S.Literal(accountCutoverSchemaVersion).pipe(
  S.withConstructorDefault(Effect.succeed(accountCutoverSchemaVersion)),
  pg.integer(),
  pg.columnName("schema_version"),
);

const schemaVersionAtLeastOne = S.Int.check(S.isGreaterThanOrEqualTo(1)).pipe(
  S.withConstructorDefault(Effect.succeed(1)),
  pg.integer(),
  pg.columnName("schema_version"),
);

const boolDefault = (column: string, value: boolean) =>
  S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(value)), pg.boolean(), pg.columnName(column));

/**
 * Legal whole-account cutover states.
 *
 * **Details**
 *
 * `rolled_back_stranded` means the account returned to the legacy data plane
 * after `new`. New-backend writes may stay stranded and are not reconciled.
 *
 * **Gotchas**
 *
 * The state names the account plane. It does not change the other fields on
 * the cutover document, so it stays one literal field rather than a tagged union.
 *
 * **Example** (Decode a stranded rollback)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AccountCutoverState } from "@beep/scratchpad/beep/AccountCutover"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(AccountCutoverState)("rolled_back_stranded"))
 * console.log(decoded) // "rolled_back_stranded"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AccountCutoverState = LiteralKit(["legacy", "migrating", "new", "rolled_back_stranded"]).pipe(
  $I.annoteSchema("AccountCutoverState", {
    description: "Whole-account cutover state: legacy, migrating, new, or a lossy stranded rollback.",
  }),
);

/**
 * Decoded whole-account cutover state.
 *
 * @see {@link AccountCutoverState} for the runtime schema and stranded-rollback meaning.
 * @category type-level
 * @since 0.0.0
 */
export type AccountCutoverState = typeof AccountCutoverState.Type;

/**
 * Encoded form of {@link AccountCutoverState}.
 *
 * @see {@link AccountCutoverState} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type AccountCutoverStateEncoded = S.Codec.Encoded<typeof AccountCutoverState>;

const stateColumn = (column: string, value: AccountCutoverState) =>
  AccountCutoverState.pipe(S.withConstructorDefault(Effect.succeed(value)), pg.text(), pg.columnName(column));

const requiredState = (column: string) => AccountCutoverState.pipe(pg.text(), pg.columnName(column));

/**
 * Server instruction for legacy offline and outbox queues.
 *
 * **Details**
 *
 * `drain` is only legal before the migration fence, while the legacy plane is
 * still writable. `quarantine` applies once the account enters `migrating`.
 *
 * **Example** (Decode quarantine)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { OfflineQueueInstruction } from "@beep/scratchpad/beep/AccountCutover"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(OfflineQueueInstruction)("quarantine"))
 * console.log(decoded) // "quarantine"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OfflineQueueInstruction = LiteralKit(["none", "drain", "quarantine"]).pipe(
  $I.annoteSchema("OfflineQueueInstruction", {
    description: "Client offline-queue instruction: none, drain, or quarantine.",
  }),
);

/**
 * Decoded offline-queue instruction.
 *
 * @see {@link OfflineQueueInstruction} for when drain and quarantine are legal.
 * @category type-level
 * @since 0.0.0
 */
export type OfflineQueueInstruction = typeof OfflineQueueInstruction.Type;

/**
 * Encoded form of {@link OfflineQueueInstruction}.
 *
 * @see {@link OfflineQueueInstruction} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type OfflineQueueInstructionEncoded = S.Codec.Encoded<typeof OfflineQueueInstruction>;

const queueColumn = (column: string, value: OfflineQueueInstruction) =>
  OfflineQueueInstruction.pipe(S.withConstructorDefault(Effect.succeed(value)), pg.text(), pg.columnName(column));

const optionalQueue = (column: string) =>
  optionalNull(OfflineQueueInstruction).pipe(pg.text(), pg.columnName(column));

/**
 * Fail-closed client surface before product traffic.
 *
 * **Example** (Decode a forced upgrade)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AccountCutoverClientAction } from "@beep/scratchpad/beep/AccountCutover"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(AccountCutoverClientAction)("force_upgrade"))
 * console.log(decoded) // "force_upgrade"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AccountCutoverClientAction = LiteralKit(["none", "force_upgrade", "migration_maintenance"]).pipe(
  $I.annoteSchema("AccountCutoverClientAction", {
    description: "Fail-closed client action shown before product traffic is allowed.",
  }),
);

/**
 * Decoded client action.
 *
 * @see {@link AccountCutoverClientAction} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type AccountCutoverClientAction = typeof AccountCutoverClientAction.Type;

/**
 * Encoded form of {@link AccountCutoverClientAction}.
 *
 * @see {@link AccountCutoverClientAction} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type AccountCutoverClientActionEncoded = S.Codec.Encoded<typeof AccountCutoverClientAction>;

/**
 * Forward-migration checkpoint phases on the legacy-side seam.
 *
 * **Example** (Decode the exporting phase)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AccountCutoverCheckpointPhase } from "@beep/scratchpad/beep/AccountCutover"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(AccountCutoverCheckpointPhase)("exporting"))
 * console.log(decoded) // "exporting"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AccountCutoverCheckpointPhase = LiteralKit([
  "not_started",
  "inventory",
  "offline_queue_fenced",
  "exporting",
  "importing",
  "verifying",
  "cutover_ready",
  "completed",
  "failed",
  "paused",
]).pipe(
  $I.annoteSchema("AccountCutoverCheckpointPhase", {
    description: "Legacy-side forward-migration checkpoint phase.",
  }),
);

/**
 * Decoded checkpoint phase.
 *
 * @see {@link AccountCutoverCheckpointPhase} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type AccountCutoverCheckpointPhase = typeof AccountCutoverCheckpointPhase.Type;

/**
 * Encoded form of {@link AccountCutoverCheckpointPhase}.
 *
 * @see {@link AccountCutoverCheckpointPhase} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type AccountCutoverCheckpointPhaseEncoded = S.Codec.Encoded<typeof AccountCutoverCheckpointPhase>;

const phaseColumn = (column: string, value: AccountCutoverCheckpointPhase) =>
  AccountCutoverCheckpointPhase.pipe(
    S.withConstructorDefault(Effect.succeed(value)),
    pg.text(),
    pg.columnName(column),
  );

const optionalPhase = (column: string) =>
  optionalNull(AccountCutoverCheckpointPhase).pipe(pg.text(), pg.columnName(column));

/**
 * Minimum supported build for one client platform.
 *
 * **Example** (Require a build floor)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { PlatformMinimumBuild } from "@beep/scratchpad/beep/AccountCutover"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(PlatformMinimumBuild)({ platform: "ios", minimumSupportedBuild: 40 }),
 * )
 * console.log(decoded.platform) // "ios"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PlatformMinimumBuild extends Model<PlatformMinimumBuild>("PlatformMinimumBuild")(
  {
    platform: boundedText("platform", { minLength: 1, maxLength: 32 }),
    minimumSupportedBuild: nonNegativeInt("minimum_supported_build"),
  },
  $I.annote("PlatformMinimumBuild", {
    description: "Minimum supported client build for one platform during cutover.",
  }),
  (columns) => [
    textBoundsCheck("platform", { minLength: 1, maxLength: 32 })(columns.platform),
    nonNegativeIntCheck("minimum_supported_build")(columns.minimumSupportedBuild),
  ],
) {}

/**
 * Encoded form of {@link PlatformMinimumBuild}.
 *
 * @see {@link PlatformMinimumBuild} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PlatformMinimumBuild {
  export type Encoded = S.Codec.Encoded<typeof PlatformMinimumBuild>;
}

/**
 * Opaque forward-migration manifest identity without user content.
 *
 * **Example** (Construct the not-started summary)
 *
 * ```ts
 * import { AccountCutoverManifestSummary } from "@beep/scratchpad/beep/AccountCutover"
 *
 * const summary = AccountCutoverManifestSummary.make({})
 * console.log(summary.checkpointPhase) // "not_started"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AccountCutoverManifestSummary extends Model<AccountCutoverManifestSummary>(
  "AccountCutoverManifestSummary",
)(
  {
    manifestId: optionalStableId("manifest_id"),
    schemaVersion: schemaVersionAtLeastOne,
    checkpointPhase: phaseColumn("checkpoint_phase", "not_started"),
    checkpointToken: optionalBoundedText("checkpoint_token", { maxLength: 128 }),
    destinationBackendBound: boolDefault("destination_backend_bound", false),
    strandedNewData: boolDefault("stranded_new_data", false),
  },
  $I.annote("AccountCutoverManifestSummary", {
    description: "Opaque forward-migration manifest identity. It carries no user content.",
  }),
  (columns) => [
    stableIdCheck("manifest_id")(columns.manifestId),
    pg.Table.check("schema_version_ge")(sql<boolean>`${columns.schemaVersion} >= 1`),
    textBoundsCheck("checkpoint_token", { maxLength: 128 })(columns.checkpointToken),
  ],
) {}

/**
 * Encoded form of {@link AccountCutoverManifestSummary}.
 *
 * @see {@link AccountCutoverManifestSummary} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AccountCutoverManifestSummary {
  export type Encoded = S.Codec.Encoded<typeof AccountCutoverManifestSummary>;
}

/**
 * Persisted server-authoritative cutover document.
 *
 * **Details**
 *
 * The document records the account-wide plane, generation counters, offline
 * queue instruction, and forward-migration checkpoint. Field presence does not
 * change with `state`.
 *
 * **Example** (Store a legacy account)
 *
 * ```ts
 * import { AccountCutoverRecord } from "@beep/scratchpad/beep/AccountCutover"
 *
 * const record = AccountCutoverRecord.make({ uid: "user-1" })
 * console.log(record.state) // "legacy"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AccountCutoverRecord extends Model<AccountCutoverRecord>("AccountCutoverRecord")(
  {
    schemaVersion: schemaVersionLiteral,
    uid: boundedText("uid", { minLength: 1 }),
    state: stateColumn("state", "legacy"),
    accountGeneration: accountGenerationDefault("account_generation"),
    uiGeneration: accountGenerationDefault("ui_generation"),
    apiGeneration: accountGenerationDefault("api_generation"),
    strandedNewData: boolDefault("stranded_new_data", false),
    offlineQueueInstruction: queueColumn("offline_queue_instruction", "none"),
    checkpointPhase: phaseColumn("checkpoint_phase", "not_started"),
    checkpointToken: optionalBoundedText("checkpoint_token", { maxLength: 128 }),
    manifestId: optionalStableId("manifest_id"),
    destinationBackendBound: boolDefault("destination_backend_bound", false),
  },
  $I.annote("AccountCutoverRecord", {
    description: "Persisted server-authoritative whole-account cutover document.",
  }),
  (columns) => [
    textBoundsCheck("uid", { minLength: 1 })(columns.uid),
    nonNegativeIntCheck("account_generation")(columns.accountGeneration),
    nonNegativeIntCheck("ui_generation")(columns.uiGeneration),
    nonNegativeIntCheck("api_generation")(columns.apiGeneration),
    textBoundsCheck("checkpoint_token", { maxLength: 128 })(columns.checkpointToken),
    stableIdCheck("manifest_id")(columns.manifestId),
  ],
) {}

/**
 * Encoded form of {@link AccountCutoverRecord}.
 *
 * @see {@link AccountCutoverRecord} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AccountCutoverRecord {
  export type Encoded = S.Codec.Encoded<typeof AccountCutoverRecord>;
}

/**
 * Storage document for a cutover record.
 *
 * **Details**
 *
 * Keys stay on the Python wire. Optional ids are JSON null when absent.
 * `schema_version` is {@link accountCutoverSchemaVersion}, not a second copy
 * that callers can drift.
 *
 * @see {@link persistedPayload} for the builder.
 * @category type-level
 * @since 0.0.0
 */
export interface AccountCutoverPersistedPayload {
  readonly schema_version: typeof accountCutoverSchemaVersion;
  readonly uid: string;
  readonly state: AccountCutoverState;
  readonly account_generation: number;
  readonly ui_generation: number;
  readonly api_generation: number;
  readonly stranded_new_data: boolean;
  readonly offline_queue_instruction: OfflineQueueInstruction;
  readonly checkpoint_phase: AccountCutoverCheckpointPhase;
  readonly checkpoint_token: string | null;
  readonly manifest_id: string | null;
  readonly destination_backend_bound: boolean;
}

/**
 * Builds the hand-written storage document for a cutover record.
 *
 * **Details**
 *
 * This is not a schema encode. Python `persisted_payload` copies enum values
 * and the config schema version into a dict, including null checkpoint and
 * manifest fields. Those nulls are preserved here.
 *
 * **Example** (Include a null checkpoint)
 *
 * ```ts
 * import { AccountCutoverRecord, persistedPayload } from "@beep/scratchpad/beep/AccountCutover"
 *
 * const payload = persistedPayload(AccountCutoverRecord.make({ uid: "user-1" }))
 * console.log(payload.checkpoint_token) // null
 * console.log(payload.schema_version) // 1
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const persistedPayload = (record: AccountCutoverRecord): AccountCutoverPersistedPayload => ({
  schema_version: accountCutoverSchemaVersion,
  uid: record.uid,
  state: record.state,
  account_generation: record.accountGeneration,
  ui_generation: record.uiGeneration,
  api_generation: record.apiGeneration,
  stranded_new_data: record.strandedNewData,
  offline_queue_instruction: record.offlineQueueInstruction,
  checkpoint_phase: record.checkpointPhase,
  checkpoint_token: O.getOrNull(record.checkpointToken),
  manifest_id: O.getOrNull(record.manifestId),
  destination_backend_bound: record.destinationBackendBound,
});

/**
 * Authenticated bootstrap projection for bridge clients.
 *
 * **Details**
 *
 * Defaults keep legacy writes, product traffic, and auth bootstrap reachable.
 * `minimumSupportedBuilds` constructs as an empty tuple. `migration` constructs
 * as a not-started manifest summary.
 *
 * **Example** (Construct the open bootstrap)
 *
 * ```ts
 * import { AccountCutoverControl } from "@beep/scratchpad/beep/AccountCutover"
 *
 * const control = AccountCutoverControl.make({})
 * console.log(control.legacyWritesAllowed) // true
 * console.log(control.clientAction) // "none"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AccountCutoverControl extends Model<AccountCutoverControl>("AccountCutoverControl")(
  {
    schemaVersion: schemaVersionLiteral,
    state: stateColumn("state", "legacy"),
    accountGeneration: accountGenerationDefault("account_generation"),
    uiGeneration: accountGenerationDefault("ui_generation"),
    apiGeneration: accountGenerationDefault("api_generation"),
    clientAction: AccountCutoverClientAction.pipe(
      S.withConstructorDefault(Effect.succeed<AccountCutoverClientAction>("none")),
      pg.text(),
      pg.columnName("client_action"),
    ),
    offlineQueueInstruction: queueColumn("offline_queue_instruction", "none"),
    strandedNewData: boolDefault("stranded_new_data", false),
    legacyWritesAllowed: boolDefault("legacy_writes_allowed", true),
    productTrafficAllowed: boolDefault("product_traffic_allowed", true),
    authBootstrapReachable: boolDefault("auth_bootstrap_reachable", true),
    minimumSupportedBuilds: S.Array(PlatformMinimumBuild).pipe(
      S.withConstructorDefault(Effect.sync(() => [])),
      pg.jsonb(),
      pg.columnName("minimum_supported_builds"),
    ),
    migration: AccountCutoverManifestSummary.pipe(
      S.withConstructorDefault(Effect.sync(() => AccountCutoverManifestSummary.make({}))),
      pg.jsonb(),
      pg.columnName("migration"),
    ),
  },
  $I.annote("AccountCutoverControl", {
    description: "Authenticated bootstrap and control projection for bridge clients.",
  }),
  (columns) => [
    nonNegativeIntCheck("account_generation")(columns.accountGeneration),
    nonNegativeIntCheck("ui_generation")(columns.uiGeneration),
    nonNegativeIntCheck("api_generation")(columns.apiGeneration),
  ],
) {}

/**
 * Encoded form of {@link AccountCutoverControl}.
 *
 * @see {@link AccountCutoverControl} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AccountCutoverControl {
  export type Encoded = S.Codec.Encoded<typeof AccountCutoverControl>;
}

/**
 * Operator or coordinator transition request.
 *
 * **Details**
 *
 * Optional instructions stay unset until the coordinator sends them. A present
 * null decodes as none, the same as a missing key.
 *
 * **Example** (Request a move to migrating)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AccountCutoverTransitionRequest } from "@beep/scratchpad/beep/AccountCutover"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(AccountCutoverTransitionRequest)({
 *     targetState: "migrating",
 *     expectedAccountGeneration: 0,
 *     reason: "fence",
 *   }),
 * )
 * console.log(decoded.targetState) // "migrating"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AccountCutoverTransitionRequest extends Model<AccountCutoverTransitionRequest>(
  "AccountCutoverTransitionRequest",
)(
  {
    targetState: requiredState("target_state"),
    expectedAccountGeneration: nonNegativeInt("expected_account_generation"),
    nextAccountGeneration: optionalNonNegativeInt("next_account_generation"),
    strandedNewData: optionalBool("stranded_new_data"),
    offlineQueueInstruction: optionalQueue("offline_queue_instruction"),
    checkpointPhase: optionalPhase("checkpoint_phase"),
    checkpointToken: optionalBoundedText("checkpoint_token", { maxLength: 128 }),
    manifestId: optionalStableId("manifest_id"),
    reason: boundedText("reason", { minLength: 1, maxLength: 64 }),
  },
  $I.annote("AccountCutoverTransitionRequest", {
    description: "Internal operator or coordinator request to move an account between cutover states.",
  }),
  (columns) => [
    nonNegativeIntCheck("expected_account_generation")(columns.expectedAccountGeneration),
    nonNegativeIntCheck("next_account_generation")(columns.nextAccountGeneration),
    textBoundsCheck("checkpoint_token", { maxLength: 128 })(columns.checkpointToken),
    stableIdCheck("manifest_id")(columns.manifestId),
    textBoundsCheck("reason", { minLength: 1, maxLength: 64 })(columns.reason),
  ],
) {}

/**
 * Encoded form of {@link AccountCutoverTransitionRequest}.
 *
 * @see {@link AccountCutoverTransitionRequest} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AccountCutoverTransitionRequest {
  export type Encoded = S.Codec.Encoded<typeof AccountCutoverTransitionRequest>;
}
