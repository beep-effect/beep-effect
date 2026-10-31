/**
 * Private push observations shared by outbox execution and drift polling.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as DomainSyncOperation from "@beep/documents-domain/entities/SyncOperation";
import { RemoteItemId } from "@beep/documents-domain/values/Sync";
import { DmsEventType } from "@beep/documents-use-cases/aggregates/Sync/server";
import { $DocumentsServerId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as F from "effect/Function";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $DocumentsServerId.create("aggregates/Sync/VaultPush.model");
const SyncOperationType = DomainSyncOperation.SyncOperationType;

/**
 * Provider echo classes shared by the push and poll phases.
 * Content covers create/upload/version pushes; moved and renamed map one-to-one.
 *
 * **Example** (Classify a provider echo)
 *
 * ```ts
 * import { EchoClass } from "./VaultPush.model.ts"
 * EchoClass.is.content("content") // true
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const EchoClass = LiteralKit(["content", "moved", "renamed"]).pipe(
  $I.annoteSchema("EchoClass", {
    description:
      "Echo equivalence class linking push verbs to the provider event types they\nemit: `content` covers create/upload/version pushes (providers report them\nas `created` or `edited`); `moved` and `renamed` map one-to-one.",
  })
);
/**
 * Runtime echo class represented by {@link EchoClass}.
 * @internal
 * @category models
 * @since 0.0.0
 */
export type EchoClass = typeof EchoClass.Type;

/**
 * Classify the provider echo expected after a successful push.
 *
 * **Example** (Classify a provider echo)
 *
 * ```ts
 * import { echoClassForOperation } from "./VaultPush.model.ts"
 * echoClassForOperation("uploadFile") // "content"
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const echoClassForOperation = (operationType: DomainSyncOperation.SyncOperationType): EchoClass =>
  SyncOperationType.match(operationType, {
    createFolder: F.constant(EchoClass.Enum.content),
    moveItem: F.constant(EchoClass.Enum.moved),
    renameItem: F.constant(EchoClass.Enum.renamed),
    uploadFile: F.constant(EchoClass.Enum.content),
    uploadFileVersion: F.constant(EchoClass.Enum.content),
  });

/**
 * Classify an event that may be a provider echo.
 *
 * **Example** (Classify a provider echo)
 *
 * ```ts
 * import { echoClassForEvent } from "./VaultPush.model.ts"
 * import * as O from "effect/Option"
 * O.isNone(echoClassForEvent("deleted")) // true
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const echoClassForEvent = (eventType: DmsEventType): O.Option<EchoClass> =>
  DmsEventType.match(eventType, {
    created: () => O.some<EchoClass>(EchoClass.Enum.content),
    deleted: O.none<EchoClass>,
    edited: () => O.some<EchoClass>(EchoClass.Enum.content),
    moved: () => O.some<EchoClass>(EchoClass.Enum.moved),
    renamed: () => O.some<EchoClass>(EchoClass.Enum.renamed),
    unknown: O.none<EchoClass>,
  });

/**
 * One successful push recorded during the current pass; polled events consume
 * these to suppress the provider echoing our own verbs.
 *
 * **Example** (Record a content push)
 *
 * ```ts
 * import { RemoteItemId } from "@beep/documents-domain/values/Sync"
 * import { ContentPushRecord } from "./VaultPush.model.ts"
 * ContentPushRecord.make({ remoteId: RemoteItemId.make("file-1") }).echoClass // "content"
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class ContentPushRecord extends S.Opaque<ContentPushRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    echoClass: S.tag("content"),
    remoteId: RemoteItemId,
  }).pipe(
    $I.annoteSchema("ContentPushRecord", {
      description: "A successful content push awaiting its provider echo.",
    })
  )
) {}

/**
 * Successful move whose provider echo is expected in this pass.
 *
 * **Example** (Record a move)
 *
 * ```ts
 * import { RemoteItemId } from "@beep/documents-domain/values/Sync"
 * import { MovedPushRecord } from "./VaultPush.model.ts"
 * MovedPushRecord.make({ remoteId: RemoteItemId.make("file-1") }).echoClass // "moved"
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class MovedPushRecord extends S.Opaque<MovedPushRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    echoClass: S.tag("moved"),
    remoteId: RemoteItemId,
  }).pipe(
    $I.annoteSchema("MovedPushRecord", {
      description: "A successful move awaiting its provider echo.",
    })
  )
) {}

/**
 * Successful rename whose provider echo is expected in this pass.
 *
 * **Example** (Record a rename)
 *
 * ```ts
 * import { RemoteItemId } from "@beep/documents-domain/values/Sync"
 * import { RenamedPushRecord } from "./VaultPush.model.ts"
 * RenamedPushRecord.make({ remoteId: RemoteItemId.make("file-1") }).echoClass // "renamed"
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class RenamedPushRecord extends S.Opaque<RenamedPushRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    echoClass: S.tag("renamed"),
    remoteId: RemoteItemId,
  }).pipe(
    $I.annoteSchema("RenamedPushRecord", {
      description: "A successful rename awaiting its provider echo.",
    })
  )
) {}

/**
 * Successful same-pass pushes consumed by remote drift polling.
 *
 * **Example** (Classify a provider echo)
 *
 * ```ts
 * import { RemoteItemId } from "@beep/documents-domain/values/Sync"
 * import * as S from "effect/Schema"
 * import { makePushRecord, PushRecord } from "./VaultPush.model.ts"
 * S.is(PushRecord)(makePushRecord("content", RemoteItemId.make("remote-file"))) // true
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const PushRecord = S.Union([ContentPushRecord, MovedPushRecord, RenamedPushRecord]).pipe(
  S.toTaggedUnion("echoClass"),
  $I.annoteSchema("PushRecord", {
    description:
      "One successful push recorded during the current pass; polled events consume these to suppress the provider echoing our own verbs",
  })
);
/**
 * Runtime push observation represented by {@link PushRecord}.
 * @internal
 * @category models
 * @since 0.0.0
 */
export type PushRecord = typeof PushRecord.Type;

/**
 * Record a successful push without storing provider payloads.
 *
 * **Example** (Classify a provider echo)
 *
 * ```ts
 * import { RemoteItemId } from "@beep/documents-domain/values/Sync"
 * import { makePushRecord } from "./VaultPush.model.ts"
 * makePushRecord("content", RemoteItemId.make("remote-file"))
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const makePushRecord: {
  (echoClass: EchoClass, remoteId: RemoteItemId): PushRecord;
  (remoteId: RemoteItemId): (echoClass: EchoClass) => PushRecord;
} = dual(
  2,
  (echoClass: EchoClass, remoteId: RemoteItemId): PushRecord =>
    EchoClass.match(echoClass, {
      content: () => ContentPushRecord.make({ remoteId }),
      moved: () => MovedPushRecord.make({ remoteId }),
      renamed: () => RenamedPushRecord.make({ remoteId }),
    })
);
