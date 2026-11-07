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
 * RenameDestination vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { RenameDestination } from "@beep/documents-domain/aggregates/VaultSync";
 * void RenameDestination;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class RenameDestination extends Domain.Command("RenameDestination", {
  target: V.DestinationId,
  input: { name: S.NonEmptyString, previousName: S.String },
  events: [E.DestinationRenamed],
  rejects: [SyncRuleViolation],
}) {}
