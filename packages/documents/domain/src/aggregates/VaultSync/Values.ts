/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DocumentsDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Cuid, cuid } from "@beep/schema/Cuid";
import { Sha256Hex } from "@beep/schema/Sha256";
import * as PublicEntityId from "@beep/shared-domain/entity/PublicEntityId";
import { SyncConflictId, SyncItemId, SyncOperationId } from "@beep/shared-domain/identity/Documents";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";

export { RemoteItemId, SyncItemKind, VaultRelPath } from "../../values/Sync/Sync.values.ts";

const utf8 = new TextEncoder();
const destinationIdPrefix = "documents_sync_destination_";
const $I = $DocumentsDomainId.create("aggregates/VaultSync/Values");
/**
 * ItemId vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ItemId } from "@beep/documents-domain/aggregates/VaultSync";
 * void ItemId;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const ItemId = PublicEntityId.factory(SyncItemId);
/**
 * Runtime value accepted by {@link ItemId}.
 *
 * @category aggregates
 * @since 0.0.0
 */
export type ItemId = typeof ItemId.Type;
/**
 * OperationId vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OperationId } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationId;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const OperationId = PublicEntityId.factory(SyncOperationId);
/**
 * Runtime value accepted by {@link OperationId}.
 *
 * @category aggregates
 * @since 0.0.0
 */
export type OperationId = typeof OperationId.Type;
/**
 * ConflictId vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ConflictId } from "@beep/documents-domain/aggregates/VaultSync";
 * void ConflictId;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const ConflictId = PublicEntityId.factory(SyncConflictId);
/**
 * Runtime value accepted by {@link ConflictId}.
 *
 * @category aggregates
 * @since 0.0.0
 */
export type ConflictId = typeof ConflictId.Type;
/**
 * Opaque minted vault sync destination identity.
 *
 * **Details**
 *
 * A destination id is the fixed prefix `documents_sync_destination_` followed by
 * a CUID. Decoding rejects any other string, so a user-entered destination name
 * can never become an aggregate id, View key, URL segment or saga key. New ids
 * come from {@link mintDestinationId}; the cutover genesis mints one per
 * destination.
 *
 * **Example** (Validate an opaque destination id)
 * ```ts
 * import { DestinationId } from "@beep/documents-domain/aggregates/VaultSync";
 * import * as S from "effect/Schema";
 * console.log(S.is(DestinationId)("documents_sync_destination_a1")); // true
 * console.log(S.is(DestinationId)("vault")); // false
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const DestinationId = S.TemplateLiteral([destinationIdPrefix, Cuid]).pipe(
  S.brand("SyncDestinationId"),
  $I.annoteSchema("DestinationId", {
    description: "Opaque minted vault sync destination identity: a fixed prefix and a CUID.",
  })
);
/**
 * Runtime value accepted by {@link DestinationId}.
 *
 * @category aggregates
 * @since 0.0.0
 */
export type DestinationId = typeof DestinationId.Type;
/**
 * Build a destination id from an existing CUID.
 *
 * **Example** (Build a destination id from a CUID)
 * ```ts
 * import { makeDestinationId } from "@beep/documents-domain/aggregates/VaultSync";
 * import { Cuid } from "@beep/schema/Cuid";
 * console.log(makeDestinationId(Cuid.make("a1"))); // "documents_sync_destination_a1"
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const makeDestinationId = (id: Cuid): DestinationId => DestinationId.make(`${destinationIdPrefix}${id}`);
/**
 * Mint a fresh destination id from the CUID generator.
 *
 * **Example** (Mint a destination id)
 * ```ts
 * import { mintDestinationId } from "@beep/documents-domain/aggregates/VaultSync";
 * const program = mintDestinationId;
 * void program;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const mintDestinationId = Effect.map(cuid, makeDestinationId);
/**
 * Org-qualified destination name reservation key.
 *
 * **Details**
 *
 * The key is `${orgId}:${sha256hex(normalizedName)}`. The name is hashed so it
 * never reaches `domain.id`, `domain.stream`, driver spans or rejection
 * evidence. Build keys only through {@link reservationKey}.
 *
 * **Example** (Validate a reservation key)
 * ```ts
 * import { ReservationKey } from "@beep/documents-domain/aggregates/VaultSync";
 * import * as S from "effect/Schema";
 * console.log(S.is(ReservationKey)("1:vault")); // false
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const ReservationKey = S.TemplateLiteral([S.Int, ":", Sha256Hex]).pipe(
  S.brand("DestinationNameReservationKey"),
  $I.annoteSchema("ReservationKey", { description: "Org id and the SHA-256 hex of the normalized destination name." })
);
/**
 * Runtime value accepted by {@link ReservationKey}.
 *
 * @category aggregates
 * @since 0.0.0
 */
export type ReservationKey = typeof ReservationKey.Type;
/**
 * Normalize a destination name for uniqueness: trimmed and lowercased.
 *
 * **Example** (Normalize a destination name)
 * ```ts
 * import { normalizeDestinationName } from "@beep/documents-domain/aggregates/VaultSync";
 * console.log(normalizeDestinationName(" Vault ")); // "vault"
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const normalizeDestinationName: (name: string) => string = flow(Str.trim, Str.toLowerCase);
/**
 * Build the reservation key for one org and destination name.
 *
 * **Details**
 *
 * Synchronous and deterministic, so pure decide and policy code can call it.
 * It accepts any value carrying `orgId` and `name`, such as a `NameClaim` or a
 * registered destination state.
 *
 * **Example** (Key a destination name)
 * ```ts
 * import { reservationKey } from "@beep/documents-domain/aggregates/VaultSync";
 * console.log(reservationKey({ orgId: 1, name: " Vault " }) === reservationKey({ orgId: 1, name: "vault" })); // true
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const reservationKey = ({ orgId, name }: { readonly orgId: number; readonly name: string }): ReservationKey =>
  ReservationKey.make(`${orgId}:${bytesToHex(sha256(utf8ToBytes(normalizeDestinationName(name))))}`);
/**
 * OrgKey vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OrgKey } from "@beep/documents-domain/aggregates/VaultSync";
 * void OrgKey;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const OrgKey = S.NonEmptyString.pipe(
  S.brand("VaultSyncOrgKey"),
  $I.annoteSchema("OrgKey", { description: "Organization view key." })
);
/**
 * Runtime value accepted by {@link OrgKey}.
 *
 * @category aggregates
 * @since 0.0.0
 */
export type OrgKey = typeof OrgKey.Type;
/**
 * OperationType vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OperationType } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationType;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const OperationType = LiteralKit([
  "ensureFolder",
  "uploadFile",
  "uploadFileVersion",
  "moveItem",
  "renameItem",
]).pipe(
  $I.annoteSchema("OperationType", { description: "One-way mirror operations; deletion is deliberately absent." })
);
/**
 * Runtime value accepted by {@link OperationType}.
 *
 * @category aggregates
 * @since 0.0.0
 */
export type OperationType = typeof OperationType.Type;
/**
 * Closed vocabulary of the remote mirror calls a vault sync failure can name.
 *
 * **Details**
 *
 * Mirror adapters report a failure by the call that failed, never by vendor
 * text. Operation failures, cursor failures and destination polls carry this
 * value, so the Views that expose them cannot carry free adapter text.
 *
 * **Example** (Check a mirror operation name)
 * ```ts
 * import { MirrorOperation } from "@beep/documents-domain/aggregates/VaultSync";
 * import * as S from "effect/Schema";
 * console.log(S.is(MirrorOperation)("pollEvents"));
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const MirrorOperation = LiteralKit([
  "resolveRoot",
  "ensureFolder",
  "uploadFile",
  "uploadFileVersion",
  "moveItem",
  "renameItem",
  "pollEvents",
]).pipe($I.annoteSchema("MirrorOperation", { description: "The remote mirror call a vault sync failure names." }));
/**
 * Runtime value accepted by {@link MirrorOperation}.
 *
 * @category aggregates
 * @since 0.0.0
 */
export type MirrorOperation = typeof MirrorOperation.Type;
/**
 * Closed vocabulary of the reasons a queued operation can be superseded.
 *
 * **Example** (Check a supersede reason)
 * ```ts
 * import { SupersedeReason } from "@beep/documents-domain/aggregates/VaultSync";
 * import * as S from "effect/Schema";
 * console.log(S.is(SupersedeReason)("kind-replaced"));
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const SupersedeReason = LiteralKit(["kind-replaced", "review-heal"]).pipe(
  $I.annoteSchema("SupersedeReason", { description: "Why a queued vault sync operation was superseded." })
);
/**
 * Runtime value accepted by {@link SupersedeReason}.
 *
 * @category aggregates
 * @since 0.0.0
 */
export type SupersedeReason = typeof SupersedeReason.Type;
/**
 * OperationStatus vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OperationStatus } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationStatus;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const OperationStatus = LiteralKit(["queued", "leased", "retrying", "succeeded", "failed", "superseded"]).pipe(
  $I.annoteSchema("OperationStatus", { description: "Distinct terminal failure and supersession." })
);
/**
 * Runtime value accepted by {@link OperationStatus}.
 *
 * @category aggregates
 * @since 0.0.0
 */
export type OperationStatus = typeof OperationStatus.Type;
/**
 * ItemStatus vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ItemStatus } from "@beep/documents-domain/aggregates/VaultSync";
 * void ItemStatus;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const ItemStatus = LiteralKit(["pending", "synced", "drifted", "error"]).pipe(
  $I.annoteSchema("ItemStatus", { description: "Local mirror progress." })
);
/**
 * Runtime value accepted by {@link ItemStatus}.
 *
 * @category aggregates
 * @since 0.0.0
 */
export type ItemStatus = typeof ItemStatus.Type;
/**
 * Remote evidence limited to 8 KiB of UTF-8, including multibyte characters.
 *
 * **Example** (Validate bounded evidence)
 * ```ts
 * import {RemoteEvidence} from "@beep/documents-domain/aggregates/VaultSync";
 * import * as S from "effect/Schema";
 * const valid=S.is(RemoteEvidence)("remote rename");
 * void valid;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const RemoteEvidence = S.String.check(
  S.makeFilter((value) => utf8.encode(value).byteLength <= 8192, {
    identifier: "RemoteEvidenceBytes",
    title: "Bounded remote evidence",
    description: "At most 8192 UTF-8 bytes.",
    message: "Remote evidence exceeds 8 KiB.",
  })
).pipe($I.annoteSchema("RemoteEvidence", { description: "Bounded remote evidence snapshot." }));
/**
 * Remote evidence value.
 *
 * @category aggregates
 * @since 0.0.0
 */
export type RemoteEvidence = typeof RemoteEvidence.Type;
