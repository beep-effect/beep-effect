/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import * as C from "./DestinationNameReservation.command.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * DestinationNameReservation vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { DestinationNameReservation } from "@beep/documents-domain/aggregates/VaultSync";
 * void DestinationNameReservation;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class DestinationNameReservation extends Domain.Aggregate("DestinationNameReservation", {
  id: V.ReservationKey,
  state: S.NullOr(C.NameClaim),
  initial: null,
  commands: [C.ClaimDestinationName, C.ReleaseDestinationName],
  decide: {
    ClaimDestinationName: (s, c, { id }) =>
      id !== `${c.claim.orgId}:${Str.toLowerCase(Str.trim(c.claim.name))}`
        ? SyncRuleViolation.make({ rule: "wrong-key", evidence: id })
        : s === null
          ? [C.DestinationNameClaimed.make(Struct.omit(c, ["_tag"]))]
          : s.destinationId === c.claim.destinationId
            ? []
            : SyncRuleViolation.make({ rule: "name-held", evidence: id }),
    ReleaseDestinationName: (s, c) =>
      s?.destinationId === c.destinationId ? [C.DestinationNameReleased.make(Struct.omit(c, ["_tag"]))] : [],
  },
  evolve: { DestinationNameClaimed: (_, e) => e.claim, DestinationNameReleased: () => null },
}) {}
