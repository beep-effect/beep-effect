import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { $DocumentsUseCasesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
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
 * @category vault-sync
 * @since 0.0.0
 */
export const DisconnectReason = LiteralKit(["credentials-missing", "auth-failed", "probe-failed", "unavailable"]).pipe(
  $I.annoteSchema("DisconnectReason", { description: "Why a Box mirror is disconnected." })
);
/**
 * BoxMirrorUnavailable vault sync orchestration.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { BoxMirrorUnavailable } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void BoxMirrorUnavailable;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class BoxMirrorUnavailable extends S.TaggedError<BoxMirrorUnavailable, { readonly brand: unique symbol }>()(
  "BoxMirrorUnavailable",
  { retryable: S.Boolean, disconnectReason: S.NullOr(DisconnectReason), operation: S.String }
) {}
const destination = { destinationId: V.DestinationId };
const remote = { remoteId: V.RemoteItemId };
const upload = { ...destination, path: V.VaultRelPath, digest: S.String, parentRemoteId: V.RemoteItemId };
const error = BoxMirrorUnavailable;
/**
 * Calls to Box accept path/digest references; adapters read bytes at invocation time.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { BoxMirror } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void BoxMirror;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class BoxMirror extends Domain.ExternalSystem("BoxMirror", {
  resolveRoot: { args: { ...destination, name: S.NonEmptyString }, success: remote, error },
  ensureFolder: {
    args: { ...destination, path: V.VaultRelPath, parentRemoteId: V.RemoteItemId },
    success: remote,
    error,
  },
  uploadFile: { args: upload, success: remote, error },
  uploadFileVersion: {
    args: { ...destination, ...remote, path: V.VaultRelPath, digest: S.String },
    success: remote,
    error,
  },
  moveItem: { args: { ...destination, ...remote, parentRemoteId: V.RemoteItemId }, success: remote, error },
  renameItem: { args: { ...destination, ...remote, name: S.NonEmptyString }, success: remote, error },
  pollEvents: {
    args: { ...destination, position: S.NullOr(S.String) },
    success: {
      position: S.String,
      events: S.Array(
        S.Struct({
          remoteEventId: S.String,
          remoteId: V.RemoteItemId,
          kind: S.String,
          evidence: S.String.check(S.isMaxLength(8192)),
        })
      ),
    },
    error,
  },
}) {}
