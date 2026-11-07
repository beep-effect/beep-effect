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
 * **Example** (Inspect contract)
 * ```ts
 * import { RecordDestinationPoll } from "@beep/documents-domain/aggregates/VaultSync";
 * void RecordDestinationPoll;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class RecordDestinationPoll extends Domain.Command("RecordDestinationPoll", {
  target: V.DestinationId,
  input: { position: S.NullOr(S.String), error: S.NullOr(S.String) },
  events: [E.CursorAdvanced, E.CursorFailed],
  rejects: [SyncRuleViolation],
}) {}
