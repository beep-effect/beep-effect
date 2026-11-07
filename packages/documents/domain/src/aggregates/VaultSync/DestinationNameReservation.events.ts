/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import { $DocumentsDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as V from "./Values.ts";

const $I = $DocumentsDomainId.create("aggregates/VaultSync/DestinationNameReservation.command");
/**
 * NameClaim vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { NameClaim } from "@beep/documents-domain/aggregates/VaultSync";
 * void NameClaim;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const NameClaim = S.Struct({
  destinationId: V.DestinationId,
  orgId: S.Int,
  workspaceId: S.Int,
  name: S.NonEmptyString,
  previousName: S.NullOr(S.String),
}).pipe($I.annoteSchema("NameClaim", { description: "NameClaim persisted vault sync value." }));
/**
 * Runtime value accepted by {@link NameClaim}.
 *
 * @category aggregates
 * @since 0.0.0
 */
export type NameClaim = typeof NameClaim.Type;
/**
 * DestinationNameClaimed vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { DestinationNameClaimed } from "@beep/documents-domain/aggregates/VaultSync";
 * void DestinationNameClaimed;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class DestinationNameClaimed extends Domain.Event("DestinationNameClaimed", { claim: NameClaim }) {
  static readonly schemaVersion = 1;
}
/**
 * DestinationNameReleased vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { DestinationNameReleased } from "@beep/documents-domain/aggregates/VaultSync";
 * void DestinationNameReleased;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class DestinationNameReleased extends Domain.Event("DestinationNameReleased", {
  destinationId: V.DestinationId,
}) {
  static readonly schemaVersion = 1;
}
