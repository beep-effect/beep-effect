/**
 * Filesystem observations consumed by vault reconciliation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DocumentContentDigest } from "@beep/documents-domain/aggregates/Document";
import { SyncItem } from "@beep/documents-domain/entities/SyncItem";
import { VaultRelPath } from "@beep/documents-domain/values/Sync";
import { $DocumentsServerId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $DocumentsServerId.create("aggregates/Sync/VaultScan.model");

/**
 * A regular file admitted by the vault reader, with the digest and size of its bytes.
 *
 * **Example** (Describe an observed file)
 * ```ts
 * import { DocumentContentDigest } from "@beep/documents-domain/aggregates/Document"
 * import { VaultRelPath } from "@beep/documents-domain/values/Sync"
 * import { ObservedFile } from "./VaultScan.model.ts"
 *
 * const file = ObservedFile.make({
 *   digest: DocumentContentDigest.make("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
 *   relPath: VaultRelPath.make("notes/readme.md"),
 *   sizeBytes: 12,
 * })
 * ```
 * @internal
 * @category models
 * @since 0.0.0
 */
export class ObservedFile extends S.Opaque<ObservedFile, { readonly brand: unique symbol }>()(
  S.Struct({
    digest: DocumentContentDigest,
    relPath: VaultRelPath,
    sizeBytes: S.Natural,
  }).pipe($I.annoteSchema("ObservedFile", { description: "A safely read regular vault file." }))
) {}

/**
 * A visible directory discovered within the canonical vault root.
 *
 * **Example** (Describe an observed folder)
 * ```ts
 * import { VaultRelPath } from "@beep/documents-domain/values/Sync"
 * import { ObservedFolder } from "./VaultScan.model.ts"
 *
 * const folder = ObservedFolder.make({ relPath: VaultRelPath.make("notes") })
 * ```
 * @internal
 * @category models
 * @since 0.0.0
 */
export class ObservedFolder extends S.Opaque<ObservedFolder, { readonly brand: unique symbol }>()(
  S.Struct({ relPath: VaultRelPath }).pipe(
    $I.annoteSchema("ObservedFolder", { description: "A visible directory within the canonical vault root." })
  )
) {}

/**
 * The filesystem snapshot reconciled with tracked sync items before uploads are queued.
 *
 * **Example** (Represent an empty vault)
 * ```ts
 * import { VaultScanObservation } from "./VaultScan.model.ts"
 *
 * const empty = VaultScanObservation.make({ files: [], folders: [] })
 * ```
 * @internal
 * @category models
 * @since 0.0.0
 */
export class VaultScanObservation extends S.Opaque<VaultScanObservation, { readonly brand: unique symbol }>()(
  S.Struct({
    files: S.Array(ObservedFile),
    folders: S.Array(ObservedFolder),
  }).pipe($I.annoteSchema("VaultScanObservation", { description: "Files and folders observed by a safe vault scan." }))
) {}

/**
 * Tracked paths and remaining move candidates threaded through one file scan.
 *
 * **Example** (Start reconciliation without tracked items)
 * ```ts
 * import * as HashMap from "effect/HashMap"
 * import { VaultScanFileState } from "./VaultScan.model.ts"
 *
 * const state = VaultScanFileState.make({
 *   itemsByPath: HashMap.empty(),
 *   missingFileItems: [],
 * })
 * ```
 * @internal
 * @category models
 * @since 0.0.0
 */
export class VaultScanFileState extends S.Opaque<VaultScanFileState, { readonly brand: unique symbol }>()(
  S.Struct({
    itemsByPath: S.HashMap(S.String, SyncItem),
    missingFileItems: S.Array(SyncItem),
  }).pipe(
    $I.annoteSchema("VaultScanFileState", {
      description: "Tracked paths and unused move candidates for one local file reconciliation pass.",
    })
  )
) {}
