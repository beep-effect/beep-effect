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
 * RegisterDestination vault sync contract.
 *
 * **Example** (Build a command for dispatch)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const command=V.RegisterDestination.make({orgId:1,workspaceId:1,name:"vault"});
 * console.log(command._tag);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class RegisterDestination extends Domain.Command("RegisterDestination", {
  target: V.DestinationId,
  input: { orgId: S.Int, workspaceId: S.Int, name: S.NonEmptyString },
  events: [E.DestinationRegistered],
  rejects: [SyncRuleViolation],
}) {}
