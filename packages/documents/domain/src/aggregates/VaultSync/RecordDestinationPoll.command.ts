/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as S from "effect/Schema";
import * as E from "./SyncDestination.events.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * RecordDestinationPoll vault sync contract.
 *
 * **Example** (Build a command for dispatch)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const command=V.RecordDestinationPoll.make({position:"cursor-1",error:null});
 * console.log(command._tag);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class RecordDestinationPoll extends Domain.Command("RecordDestinationPoll", {
  target: V.DestinationId,
  input: { position: S.NullOr(S.String), error: S.NullOr(V.MirrorOperation) },
  events: [E.CursorAdvanced, E.CursorFailed],
  rejects: [SyncRuleViolation],
}) {}
