/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { $DocumentsUseCasesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $DocumentsUseCasesId.create("aggregates/VaultSync/BoxMirror.external");
/**
 * DisconnectReason vault sync orchestration.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { DisconnectReason } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void DisconnectReason;
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const DisconnectReason = LiteralKit(["credentials-missing", "auth-failed", "probe-failed", "unavailable"]).pipe(
  $I.annoteSchema("DisconnectReason", { description: "Why a Box mirror is disconnected." })
);

/**
 * Why a Box mirror is disconnected.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DisconnectReason = typeof DisconnectReason.Type;
/**
 * The adapter-side stage at which a Box call stopped, beside the call name in `operation`.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { MirrorFailureStage } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void MirrorFailureStage;
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const MirrorFailureStage = LiteralKit([
  "local-root",
  "stale-input",
  "intent-mismatch",
  "uncertain-outcome-held",
]).pipe(
  $I.annoteSchema("MirrorFailureStage", {
    description:
      "Where an adapter stopped a Box call: a local precondition, a stale input or a held uncertain outcome.",
  })
);

/**
 * The adapter-side stage at which a Box call stopped.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MirrorFailureStage = typeof MirrorFailureStage.Type;
/**
 * BoxMirrorUnavailable vault sync orchestration.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { BoxMirrorUnavailable } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void BoxMirrorUnavailable;
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export class BoxMirrorUnavailable extends S.TaggedError<BoxMirrorUnavailable, { readonly brand: unique symbol }>()(
  "BoxMirrorUnavailable",
  {
    retryable: S.Boolean,
    disconnectReason: S.NullOr(DisconnectReason),
    operation: V.MirrorOperation,
    stage: S.NullOr(MirrorFailureStage).pipe(
      S.withConstructorDefault(Effect.succeed(null)),
      S.withDecodingDefaultKey(Effect.succeed(null))
    ),
  },
  $I.annote("BoxMirrorUnavailable", { description: "A declared Box boundary failure." })
) {}
const destination = { destinationId: V.DestinationId };
const remote = { remoteId: V.RemoteItemId };
const mutation = { ...destination, operationId: V.OperationId, passId: S.NonEmptyString, generation: S.Int };
const receipt = { ...remote, name: S.String, parentRemoteId: S.NullOr(V.RemoteItemId) };
const upload = { ...mutation, path: V.VaultRelPath, digest: S.String, parentRemoteId: V.RemoteItemId };
const error = BoxMirrorUnavailable;
/**
 * Calls to Box accept path/digest references; adapters read bytes at invocation time.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { BoxMirror } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void BoxMirror;
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export class BoxMirror extends Domain.ExternalSystem("BoxMirror", {
  probe: { args: destination, success: { connected: S.Boolean }, error },
  resolveRoot: { args: { ...destination, name: S.NonEmptyString }, success: remote, error },
  ensureFolder: {
    args: { ...mutation, path: V.VaultRelPath, parentRemoteId: V.RemoteItemId },
    success: receipt,
    error,
  },
  uploadFile: { args: upload, success: receipt, error },
  uploadFileVersion: {
    args: { ...mutation, ...remote, path: V.VaultRelPath, digest: S.String },
    success: receipt,
    error,
  },
  moveItem: {
    args: { ...mutation, ...remote, itemKind: V.SyncItemKind, parentRemoteId: V.RemoteItemId },
    success: receipt,
    error,
  },
  renameItem: {
    args: { ...mutation, ...remote, itemKind: V.SyncItemKind, name: S.NonEmptyString },
    success: receipt,
    error,
  },
  pollEvents: {
    args: { ...destination, position: S.NullOr(S.String) },
    success: {
      position: S.String,
      events: S.Array(
        S.Struct({
          remoteEventId: S.String,
          remoteId: S.NullOr(V.RemoteItemId),
          name: S.NullOr(S.String),
          parentRemoteId: S.NullOr(V.RemoteItemId),
          kind: S.String,
          evidence: V.RemoteEvidence,
        })
      ),
    },
    error,
  },
}) {}
