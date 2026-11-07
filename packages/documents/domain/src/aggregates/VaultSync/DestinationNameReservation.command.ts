import * as Domain from "@alchemy.run/domain";
import * as S from "effect/Schema";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * NameClaim vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { NameClaim } from "@beep/documents-domain/aggregates/VaultSync";
 * void NameClaim;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export const NameClaim = S.Struct({
  destinationId: V.DestinationId,
  orgId: S.Int,
  workspaceId: S.Int,
  name: S.NonEmptyString,
  previousName: S.NullOr(S.String),
});
/** Runtime value accepted by {@link NameClaim}. @category vault-sync @since 0.0.0 */
export type NameClaim = typeof NameClaim.Type;
/**
 * DestinationNameClaimed vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { DestinationNameClaimed } from "@beep/documents-domain/aggregates/VaultSync";
 * void DestinationNameClaimed;
 * ```
 * @category vault-sync
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
 * @category vault-sync
 * @since 0.0.0
 */
export class DestinationNameReleased extends Domain.Event("DestinationNameReleased", {
  destinationId: V.DestinationId,
}) {
  static readonly schemaVersion = 1;
}
/**
 * ClaimDestinationName vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ClaimDestinationName } from "@beep/documents-domain/aggregates/VaultSync";
 * void ClaimDestinationName;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class ClaimDestinationName extends Domain.Command("ClaimDestinationName", {
  target: V.ReservationKey,
  input: { claim: NameClaim },
  events: [DestinationNameClaimed],
  rejects: [SyncRuleViolation],
}) {}
/**
 * ReleaseDestinationName vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ReleaseDestinationName } from "@beep/documents-domain/aggregates/VaultSync";
 * void ReleaseDestinationName;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class ReleaseDestinationName extends Domain.Command("ReleaseDestinationName", {
  target: V.ReservationKey,
  input: { destinationId: V.DestinationId },
  events: [DestinationNameReleased],
  rejects: [SyncRuleViolation],
}) {}
