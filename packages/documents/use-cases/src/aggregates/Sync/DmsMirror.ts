/**
 * Provider-neutral DMS mirror port for the one-way vault push.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DmsProvider, RemoteItemId, SyncItemKind } from "@beep/documents-domain/values/Sync";
import { $DocumentsUseCasesId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils, UnknownRecord } from "@beep/schema";
import { Context } from "effect";
import * as S from "effect/Schema";
import type { Effect } from "effect";
import type { DmsMirrorUnavailable } from "./Sync.errors.ts";

const $I = $DocumentsUseCasesId.create("aggregates/Sync/DmsMirror");

/**
 * Provider-neutral view of one item stored in the remote DMS.
 *
 * **Example** (Make remote file item)
 *
 * ```ts
 * import { RemoteItemId } from "@beep/documents-domain/values/Sync"
 * import { DmsRemoteItem } from "@beep/documents-use-cases/aggregates/Sync/server"
 * import * as S from "effect/Schema"
 *
 * const item = DmsRemoteItem.make({
 *   itemKind: "file",
 *   name: "complaint.pdf",
 *   remoteId: S.decodeUnknownSync(RemoteItemId)("9001")
 * })
 * console.log(item.name)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class DmsRemoteItem extends S.Class<DmsRemoteItem>($I`DmsRemoteItem`)(
  {
    itemKind: SyncItemKind.annotateKey({
      description: "Whether the remote item is a file or a folder.",
    }),
    name: S.NonEmptyString.annotateKey({
      description: "Item name on the provider side.",
    }),
    parentRemoteId: S.Option(RemoteItemId).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Provider identifier of the remote parent folder; none for the provider mirror root.",
    }),
    remoteId: RemoteItemId.annotateKey({
      description: "Provider item identifier assigned by the DMS.",
    }),
  },
  $I.annote("DmsRemoteItem", {
    description: "Provider-neutral view of one item stored in the remote DMS.",
  })
) {}

/**
 * Provider-neutral kind of remote change reported by the DMS event stream.
 *
 * **Example** (Assert edited event type)
 *
 * ```ts
 * import { DmsEventType } from "@beep/documents-use-cases/aggregates/Sync/server"
 *
 * const eventType: DmsEventType = DmsEventType.Enum.edited
 *
 * if (!DmsEventType.is.edited(eventType)) {
 *   throw new Error("expected edited event type")
 * }
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export const DmsEventType = LiteralKit(["created", "edited", "moved", "renamed", "deleted", "unknown"]).pipe(
  $I.annoteSchema("DmsEventType", {
    description: "Provider-neutral kind of remote change reported by the DMS event stream.",
  })
);

/**
 * Runtime type for {@link DmsEventType}.
 *
 * **Example** (Type event type string)
 *
 * ```ts
 * import type { DmsEventType } from "@beep/documents-use-cases/aggregates/Sync/server"
 *
 * const eventType: DmsEventType = "created"
 * console.log(eventType)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export type DmsEventType = typeof DmsEventType.Type;

/**
 * One provider-neutral remote event observed on the DMS event stream.
 *
 * **Example** (Make remote edited event)
 *
 * ```ts
 * import { DmsRemoteEvent } from "@beep/documents-use-cases/aggregates/Sync/server"
 *
 * const event = DmsRemoteEvent.make({
 *   eventId: "evt-1",
 *   eventType: "edited",
 *   payload: { eventType: "ITEM_MODIFY" }
 * })
 * console.log(event.eventId)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class DmsRemoteEvent extends S.Class<DmsRemoteEvent>($I`DmsRemoteEvent`)(
  {
    eventId: S.NonEmptyString.annotateKey({
      description: "Provider event identifier.",
    }),
    eventType: DmsEventType.annotateKey({
      description: "Provider-neutral kind of remote change.",
    }),
    itemKind: S.Option(SyncItemKind).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Kind of the affected remote item; none when the event omits it.",
    }),
    name: S.Option(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Item name reported by the event; none when the event omits it.",
    }),
    parentRemoteId: S.Option(RemoteItemId).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Provider identifier of the item's parent folder; none when the event omits it.",
    }),
    payload: UnknownRecord.annotateKey({
      description: "Provider event snapshot preserved verbatim for conflict review.",
    }),
    remoteId: S.Option(RemoteItemId).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Provider identifier of the affected remote item; none when the event omits it.",
    }),
  },
  $I.annote("DmsRemoteEvent", {
    description: "One provider-neutral remote event observed on the DMS event stream.",
  })
) {}

/**
 * One page of remote events plus the stream position to resume from.
 *
 * **Example** (Make empty event page)
 *
 * ```ts
 * import { DmsEventPage } from "@beep/documents-use-cases/aggregates/Sync/server"
 *
 * const page = DmsEventPage.make({ entries: [], nextStreamPosition: "now" })
 * console.log(page.entries.length)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class DmsEventPage extends S.Class<DmsEventPage>($I`DmsEventPage`)(
  {
    entries: S.Array(DmsRemoteEvent).annotateKey({
      description: "Remote events in provider stream order.",
    }),
    nextStreamPosition: S.NonEmptyString.annotateKey({
      description: "Opaque provider stream position to resume polling from.",
    }),
  },
  $I.annote("DmsEventPage", {
    description: "One page of remote events plus the stream position to resume from.",
  })
) {}

/**
 * Input for idempotent remote folder creation.
 *
 * **Details**
 *
 * A `none` `parentRemoteId` targets the provider mirror root.
 *
 * **Example** (Make ensure folder input)
 *
 * ```ts
 * import { EnsureFolderInput } from "@beep/documents-use-cases/aggregates/Sync/server"
 *
 * const input = EnsureFolderInput.make({ name: "matters" })
 * console.log(input.name)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class EnsureFolderInput extends S.Class<EnsureFolderInput>($I`EnsureFolderInput`)(
  {
    name: S.NonEmptyString.annotateKey({
      description: "Folder name to ensure under the parent.",
    }),
    parentRemoteId: S.Option(RemoteItemId).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Provider identifier of the parent folder; none targets the provider mirror root.",
    }),
  },
  $I.annote("EnsureFolderInput", {
    description: "Input for idempotent remote folder creation.",
  })
) {}

/**
 * Input for uploading a new remote file.
 *
 * **Details**
 *
 * A `none` `parentRemoteId` targets the provider mirror root.
 *
 * **Example** (Make upload file input)
 *
 * ```ts
 * import { UploadFileInput } from "@beep/documents-use-cases/aggregates/Sync/server"
 *
 * const input = UploadFileInput.make({
 *   content: new Uint8Array([1, 2, 3]),
 *   name: "complaint.pdf"
 * })
 * console.log(input.name)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class UploadFileInput extends S.Class<UploadFileInput>($I`UploadFileInput`)(
  {
    content: S.Uint8Array.annotateKey({
      description: "File bytes to upload.",
    }),
    name: S.NonEmptyString.annotateKey({
      description: "File name to create under the parent.",
    }),
    parentRemoteId: S.Option(RemoteItemId).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Provider identifier of the parent folder; none targets the provider mirror root.",
    }),
  },
  $I.annote("UploadFileInput", {
    description: "Input for uploading a new remote file.",
  })
) {}

/**
 * Input for uploading a new version of an existing remote file.
 *
 * **Example** (Make upload version input)
 *
 * ```ts
 * import { RemoteItemId } from "@beep/documents-domain/values/Sync"
 * import { UploadFileVersionInput } from "@beep/documents-use-cases/aggregates/Sync/server"
 * import * as S from "effect/Schema"
 *
 * const input = UploadFileVersionInput.make({
 *   content: new Uint8Array([1, 2, 3]),
 *   name: "complaint.pdf",
 *   remoteId: S.decodeUnknownSync(RemoteItemId)("9001")
 * })
 * console.log(input.remoteId)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class UploadFileVersionInput extends S.Class<UploadFileVersionInput>($I`UploadFileVersionInput`)(
  {
    content: S.Uint8Array.annotateKey({
      description: "File bytes to upload as the new version.",
    }),
    name: S.NonEmptyString.annotateKey({
      description: "File name accompanying the new version.",
    }),
    remoteId: RemoteItemId.annotateKey({
      description: "Provider identifier of the remote file receiving the version.",
    }),
  },
  $I.annote("UploadFileVersionInput", {
    description: "Input for uploading a new version of an existing remote file.",
  })
) {}

/**
 * Input for moving a remote item to a new parent folder.
 *
 * **Details**
 *
 * A `none` `newParentRemoteId` targets the provider mirror root.
 *
 * **Example** (Make move item input)
 *
 * ```ts
 * import { RemoteItemId } from "@beep/documents-domain/values/Sync"
 * import { MoveItemInput } from "@beep/documents-use-cases/aggregates/Sync/server"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const input = MoveItemInput.make({
 *   itemKind: "file",
 *   newParentRemoteId: O.some(S.decodeUnknownSync(RemoteItemId)("9000")),
 *   remoteId: S.decodeUnknownSync(RemoteItemId)("9001")
 * })
 * console.log(input.itemKind)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class MoveItemInput extends S.Class<MoveItemInput>($I`MoveItemInput`)(
  {
    itemKind: SyncItemKind.annotateKey({
      description: "Whether the moved remote item is a file or a folder.",
    }),
    newParentRemoteId: S.Option(RemoteItemId).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Provider identifier of the destination folder; none targets the provider mirror root.",
    }),
    remoteId: RemoteItemId.annotateKey({
      description: "Provider identifier of the remote item to move.",
    }),
  },
  $I.annote("MoveItemInput", {
    description: "Input for moving a remote item to a new parent folder.",
  })
) {}

/**
 * Input for renaming a remote item in place.
 *
 * **Example** (Make rename item input)
 *
 * ```ts
 * import { RemoteItemId } from "@beep/documents-domain/values/Sync"
 * import { RenameItemInput } from "@beep/documents-use-cases/aggregates/Sync/server"
 * import * as S from "effect/Schema"
 *
 * const input = RenameItemInput.make({
 *   itemKind: "file",
 *   newName: "amended-complaint.pdf",
 *   remoteId: S.decodeUnknownSync(RemoteItemId)("9001")
 * })
 * console.log(input.newName)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class RenameItemInput extends S.Class<RenameItemInput>($I`RenameItemInput`)(
  {
    itemKind: SyncItemKind.annotateKey({
      description: "Whether the renamed remote item is a file or a folder.",
    }),
    newName: S.NonEmptyString.annotateKey({
      description: "New item name to apply.",
    }),
    remoteId: RemoteItemId.annotateKey({
      description: "Provider identifier of the remote item to rename.",
    }),
  },
  $I.annote("RenameItemInput", {
    description: "Input for renaming a remote item in place.",
  })
) {}

/**
 * Input for polling one page of remote events.
 *
 * **Details**
 *
 * A `none` `streamPosition` bootstraps the stream at the provider's "now": the
 * provider returns an empty page whose `nextStreamPosition` is the current
 * stream position, so drift detection starts from bootstrap time.
 *
 * **Example** (Make poll events input)
 *
 * ```ts
 * import { PollEventsInput } from "@beep/documents-use-cases/aggregates/Sync/server"
 * import * as O from "effect/Option"
 *
 * const input = PollEventsInput.make({ streamPosition: O.some("now") })
 * console.log(input.streamPosition._tag)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class PollEventsInput extends S.Class<PollEventsInput>($I`PollEventsInput`)(
  {
    streamPosition: S.Option(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Opaque provider stream position to poll from; none bootstraps at the provider's now.",
    }),
  },
  $I.annote("PollEventsInput", {
    description: "Input for polling one page of remote events.",
  })
) {}

/**
 * Provider-neutral one-way-push DMS mirror port shape.
 *
 * **Details**
 *
 * `ensureFolder` is idempotent: when a folder with the same name already exists
 * under the parent, the existing folder is returned instead of failing. All
 * operations fail with {@link DmsMirrorUnavailable} when the provider cannot
 * complete them.
 *
 * **Example** (Build stub mirror shape)
 *
 * ```ts
 * import {
 *   DmsEventPage,
 *   DmsMirrorUnavailable,
 *   PollEventsInput,
 *   type DmsMirrorShape
 * } from "@beep/documents-use-cases/aggregates/Sync/server"
 * import { Effect } from "effect"
 *
 * const unavailable = () =>
 *   Effect.fail(DmsMirrorUnavailable.make({ provider: "box", reason: "stub mirror", retryable: false }))
 * const mirror: DmsMirrorShape = {
 *   ensureFolder: unavailable,
 *   moveItem: unavailable,
 *   pollEvents: () => Effect.succeed(DmsEventPage.make({ entries: [], nextStreamPosition: "now" })),
 *   renameItem: unavailable,
 *   uploadFile: unavailable,
 *   uploadFileVersion: unavailable
 * }
 *
 * Effect.runPromise(mirror.pollEvents(PollEventsInput.make({}))).then((page) =>
 *   console.log(page.nextStreamPosition)
 * )
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export interface DmsMirrorShape {
  readonly ensureFolder: (input: EnsureFolderInput) => Effect.Effect<DmsRemoteItem, DmsMirrorUnavailable>;
  readonly moveItem: (input: MoveItemInput) => Effect.Effect<DmsRemoteItem, DmsMirrorUnavailable>;
  readonly pollEvents: (input: PollEventsInput) => Effect.Effect<DmsEventPage, DmsMirrorUnavailable>;
  readonly renameItem: (input: RenameItemInput) => Effect.Effect<DmsRemoteItem, DmsMirrorUnavailable>;
  readonly uploadFile: (input: UploadFileInput) => Effect.Effect<DmsRemoteItem, DmsMirrorUnavailable>;
  readonly uploadFileVersion: (input: UploadFileVersionInput) => Effect.Effect<DmsRemoteItem, DmsMirrorUnavailable>;
}

/**
 * Context tag for the provider-neutral DMS mirror port.
 *
 * **Example** (Provide mirror and poll)
 *
 * ```ts
 * import {
 *   DmsEventPage,
 *   DmsMirror,
 *   DmsMirrorUnavailable,
 *   PollEventsInput,
 *   type DmsMirrorShape
 * } from "@beep/documents-use-cases/aggregates/Sync/server"
 * import { Effect } from "effect"
 *
 * const unavailable = () =>
 *   Effect.fail(DmsMirrorUnavailable.make({ provider: "box", reason: "stub mirror", retryable: false }))
 * const mirror: DmsMirrorShape = {
 *   ensureFolder: unavailable,
 *   moveItem: unavailable,
 *   pollEvents: () => Effect.succeed(DmsEventPage.make({ entries: [], nextStreamPosition: "now" })),
 *   renameItem: unavailable,
 *   uploadFile: unavailable,
 *   uploadFileVersion: unavailable
 * }
 *
 * const program = Effect.gen(function* () {
 *   const service = yield* DmsMirror
 *   return yield* service.pollEvents(PollEventsInput.make({}))
 * }).pipe(Effect.provideService(DmsMirror, mirror))
 * console.log(Effect.runSync(program).nextStreamPosition)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class DmsMirror extends Context.Service<DmsMirror, DmsMirrorShape>()($I`DmsMirror`) {}

/**
 * Why a DMS mirror adapter reports the provider as disconnected.
 *
 * **Details**
 *
 * `credentials-missing` means the application never configured provider
 * credentials, so no connection was attempted — the operator fixes it by
 * supplying credentials and restarting. The remaining members classify a
 * probe that ran with credentials configured: `auth-failed` means the
 * provider rejected the configured credentials (typically an expired token),
 * `root-unreachable` means the mirror-root folder could not be listed or
 * created, `transient` means the provider was unreachable or rate limiting
 * and retrying shortly may succeed, and `probe-failed` stays the fallback
 * when the adapter cannot classify the failure. Status surfaces must not
 * tell the operator to set credentials that are already set.
 *
 * **Example** (Guard probe-failed reason)
 *
 * ```ts
 * import { DmsMirrorDisconnectReason } from "@beep/documents-use-cases/aggregates/Sync/server"
 *
 * console.log(DmsMirrorDisconnectReason.is["probe-failed"]("probe-failed")) // true
 * console.log(DmsMirrorDisconnectReason.is["auth-failed"]("probe-failed")) // false
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export const DmsMirrorDisconnectReason = LiteralKit([
  "credentials-missing",
  "auth-failed",
  "root-unreachable",
  "transient",
  "probe-failed",
]).pipe(
  $I.annoteSchema("DmsMirrorDisconnectReason", {
    description: "Why a DMS mirror adapter reports the provider as disconnected.",
  })
);

/**
 * Runtime type for {@link DmsMirrorDisconnectReason}.
 *
 * **Example** (Type disconnect reason string)
 *
 * ```ts
 * import type { DmsMirrorDisconnectReason } from "@beep/documents-use-cases/aggregates/Sync/server"
 *
 * const reason: DmsMirrorDisconnectReason = "credentials-missing"
 * console.log(reason)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export type DmsMirrorDisconnectReason = typeof DmsMirrorDisconnectReason.Type;

/**
 * Connectivity probe result for one DMS mirror adapter.
 *
 * **Details**
 *
 * `rootRemoteId` carries the provider identifier of the resolved mirror-root
 * folder when the adapter could resolve it: the Box adapter reports the ensured
 * root folder id, the deterministic fixture reports its root node, and the
 * app-side disconnected layer reports `none`. Drift detection uses it to
 * normalize root-level parent references (an item directly under the mirror
 * root stores `none` for its parent while the provider event carries the root
 * id).
 *
 * `disconnectReason` distinguishes the honest disconnected states: it is
 * `none` while `connected` is `true`, and carries a
 * {@link DmsMirrorDisconnectReason} when the adapter knows why the provider is
 * unreachable.
 *
 * `probedAt` records when the adapter last actually asked the provider —
 * cached probe answers keep the timestamp of the resolution that produced
 * them, and adapters that never contact a provider (the app-side disconnected
 * layer) report `none`.
 *
 * **Example** (Make connected probe result)
 *
 * ```ts
 * import { DmsMirrorProbe } from "@beep/documents-use-cases/aggregates/Sync/server"
 * import * as O from "effect/Option"
 *
 * const probe = DmsMirrorProbe.make({ connected: true, provider: "box" })
 * console.log(probe.connected && O.isNone(probe.rootRemoteId))
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class DmsMirrorProbe extends S.Class<DmsMirrorProbe>($I`DmsMirrorProbe`)(
  {
    connected: S.Boolean.annotateKey({
      description: "Whether the mirror adapter can reach the provider.",
    }),
    disconnectReason: S.Option(DmsMirrorDisconnectReason).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Why the provider is disconnected; none while the probe reports connected.",
    }),
    probedAt: S.Option(S.DateTimeUtc).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "When the adapter last actually asked the provider; none when no probe has contacted it.",
    }),
    provider: DmsProvider.annotateKey({
      description: "DMS provider the probe describes.",
    }),
    rootRemoteId: S.Option(RemoteItemId).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Provider identifier of the resolved mirror-root folder; none when it could not be resolved.",
    }),
  },
  $I.annote("DmsMirrorProbe", {
    description: "Connectivity probe result for one DMS mirror adapter.",
  })
) {}

/**
 * DMS mirror availability shape; the probe never fails so the app decides how
 * to treat connectivity.
 *
 * **Details**
 *
 * `probe` may answer from an adapter-side cache; `refresh` discards any cached
 * answer and asks the provider now — an operator's explicit "retry connection"
 * must actually re-ask the provider instead of replaying a cached failure.
 * Adapters without caching implement both members as the same effect.
 *
 * **Example** (Build availability shape)
 *
 * ```ts
 * import { DmsMirrorProbe, type DmsMirrorAvailabilityShape } from "@beep/documents-use-cases/aggregates/Sync/server"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const probe = Effect.succeed(
 *   DmsMirrorProbe.make({ connected: false, disconnectReason: O.some("probe-failed"), provider: "box" })
 * )
 * const availability: DmsMirrorAvailabilityShape = { probe, refresh: probe }
 * console.log(Effect.runSync(availability.probe).connected)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export interface DmsMirrorAvailabilityShape {
  readonly probe: Effect.Effect<DmsMirrorProbe>;
  readonly refresh: Effect.Effect<DmsMirrorProbe>;
}

/**
 * Context tag for the DMS mirror availability probe.
 *
 * **Example** (Provide availability and probe)
 *
 * ```ts
 * import {
 *   DmsMirrorAvailability,
 *   DmsMirrorProbe,
 *   type DmsMirrorAvailabilityShape
 * } from "@beep/documents-use-cases/aggregates/Sync/server"
 * import { Effect } from "effect"
 *
 * const probe = Effect.succeed(DmsMirrorProbe.make({ connected: true, provider: "box" }))
 * const availability: DmsMirrorAvailabilityShape = { probe, refresh: probe }
 *
 * const program = Effect.gen(function* () {
 *   const service = yield* DmsMirrorAvailability
 *   return yield* service.probe
 * }).pipe(Effect.provideService(DmsMirrorAvailability, availability))
 * console.log(Effect.runSync(program).provider)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class DmsMirrorAvailability extends Context.Service<DmsMirrorAvailability, DmsMirrorAvailabilityShape>()(
  $I`DmsMirrorAvailability`
) {}
