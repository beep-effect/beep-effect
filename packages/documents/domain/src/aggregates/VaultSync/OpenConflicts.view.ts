/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as H from "effect/HashMap";
import * as S from "effect/Schema";
import { ScopeDenied } from "./Session.context.ts";
import { authorizeVaultSync, Session } from "./Session.middleware.ts";
import { SyncConflict } from "./SyncConflict.aggregate.ts";
import { ConflictRecord } from "./SyncConflict.command.ts";
import { SyncDestination } from "./SyncDestination.aggregate.ts";
/**
 * OpenConflicts pure read contract; transport authorization is supplied by the hosting Api.
 *
 * **Example** (Inspect read contract)
 * ```ts
 * import { OpenConflicts } from "@beep/documents-domain/aggregates/VaultSync";
 * void OpenConflicts.definition;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class OpenConflicts extends Domain.View("OpenConflicts", {
  middleware: [Session],
  rejects: [ScopeDenied],
  validate: (request) => authorizeVaultSync("OpenConflicts." + request.mode, { key: request.key }),
  from: [SyncConflict],
  key: SyncDestination,
  state: S.HashMap(S.String, ConflictRecord),
  initial: H.empty(),
  keyOf: { SyncConflict: ({ event }) => SyncDestination.ref(event.record.destinationId) },
  evolve: {
    ConflictRecorded: (s, e) => H.set(s, e.record.remoteEventId, e.record),
    ConflictReviewed: (s, e) => H.remove(s, e.record.remoteEventId),
  },
}) {}
