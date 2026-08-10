/**
 * DMS sync value objects.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocumentsDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $DocumentsDomainId.create("values/Sync/Sync.values");

/**
 * Document management system provider receiving the one-way vault mirror.
 *
 * **Details**
 *
 * The P3 Box-sync phase supports only `"box"`; the P6 phase extends this
 * family with `"m365"`.
 *
 * **Example** (Decode box provider value)
 *
 * ```ts
 * import { DmsProvider } from "@beep/documents-domain/values/Sync"
 * import * as S from "effect/Schema"
 *
 * const provider = S.decodeUnknownSync(DmsProvider)("box")
 * console.log(provider)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const DmsProvider = LiteralKit(["box"]).pipe(
  $I.annoteSchema("DmsProvider", {
    description: "Document management system provider receiving the one-way vault mirror.",
  })
);

/**
 * Type for {@link DmsProvider}.
 *
 * **Example** (Annotate box provider type)
 *
 * ```ts
 * import { DmsProvider } from "@beep/documents-domain/values/Sync"
 *
 * const provider: DmsProvider = "box"
 * console.log(provider)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type DmsProvider = typeof DmsProvider.Type;

/**
 * Vault-root-relative POSIX path; never absolute.
 *
 * **Example** (Decode relative vault path)
 *
 * ```ts
 * import { VaultRelPath } from "@beep/documents-domain/values/Sync"
 * import * as S from "effect/Schema"
 *
 * const path = S.decodeUnknownSync(VaultRelPath)("matters/client-default/complaint.pdf")
 * console.log(path)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const VaultRelPath = S.NonEmptyString.pipe(
  S.brand("VaultRelPath"),
  $I.annoteSchema("VaultRelPath", {
    description: "Vault-root-relative POSIX path; never absolute.",
  })
);

/**
 * Type for {@link VaultRelPath}.
 *
 * **Example** (Type vault relative path)
 *
 * ```ts
 * import { VaultRelPath } from "@beep/documents-domain/values/Sync"
 * import * as S from "effect/Schema"
 *
 * const path: VaultRelPath = S.decodeUnknownSync(VaultRelPath)("matters/client-default/complaint.pdf")
 * console.log(path)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type VaultRelPath = typeof VaultRelPath.Type;

/**
 * Provider-neutral identifier for an item stored in the remote DMS.
 *
 * **Example** (Decode remote item id)
 *
 * ```ts
 * import { RemoteItemId } from "@beep/documents-domain/values/Sync"
 * import * as S from "effect/Schema"
 *
 * const remoteId = S.decodeUnknownSync(RemoteItemId)("1234567890")
 * console.log(remoteId)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const RemoteItemId = S.NonEmptyString.pipe(
  S.brand("RemoteItemId"),
  $I.annoteSchema("RemoteItemId", {
    description: "Provider-neutral identifier for an item stored in the remote DMS.",
  })
);

/**
 * Type for {@link RemoteItemId}.
 *
 * **Example** (Type remote item id)
 *
 * ```ts
 * import { RemoteItemId } from "@beep/documents-domain/values/Sync"
 * import * as S from "effect/Schema"
 *
 * const remoteId: RemoteItemId = S.decodeUnknownSync(RemoteItemId)("1234567890")
 * console.log(remoteId)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type RemoteItemId = typeof RemoteItemId.Type;

/**
 * Kind of vault item mirrored to the DMS.
 *
 * **Example** (Decode file item kind)
 *
 * ```ts
 * import { SyncItemKind } from "@beep/documents-domain/values/Sync"
 * import * as S from "effect/Schema"
 *
 * const kind = S.decodeUnknownSync(SyncItemKind)("file")
 * console.log(kind)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const SyncItemKind = LiteralKit(["file", "folder"]).pipe(
  $I.annoteSchema("SyncItemKind", {
    description: "Kind of vault item mirrored to the DMS.",
  })
);

/**
 * Type for {@link SyncItemKind}.
 *
 * **Example** (Annotate folder item kind)
 *
 * ```ts
 * import { SyncItemKind } from "@beep/documents-domain/values/Sync"
 *
 * const kind: SyncItemKind = "folder"
 * console.log(kind)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type SyncItemKind = typeof SyncItemKind.Type;
