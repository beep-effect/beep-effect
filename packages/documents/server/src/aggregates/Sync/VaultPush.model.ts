/**
 * Private push observations shared by outbox execution and drift polling.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as DomainSyncOperation from "@beep/documents-domain/entities/SyncOperation";
import { DmsEventType } from "@beep/documents-use-cases/aggregates/Sync/server";
import { $DocumentsServerId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as F from "effect/Function";
import * as O from "effect/Option";

const $I = $DocumentsServerId.create("aggregates/Sync/VaultPush.model");
const SyncOperationType = DomainSyncOperation.SyncOperationType;

/**
 * Provider echo classes shared by the push and poll phases.
 * Content covers create/upload/version pushes; moved and renamed map one-to-one.
 *
 * **Example** (Classify a provider echo)
 *
 * ```ts
 * import { EchoClass } from "@beep/documents-server/aggregates/Sync"
 * EchoClass.is.content("content") // true
 * ```
 *
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
 * import { echoClassForOperation } from "@beep/documents-server/aggregates/Sync"
 * echoClassForOperation("uploadFile") // "content"
 * ```
 *
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
 * import { echoClassForEvent } from "@beep/documents-server/aggregates/Sync"
 * import * as O from "effect/Option"
 * O.isNone(echoClassForEvent("deleted")) // true
 * ```
 *
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
