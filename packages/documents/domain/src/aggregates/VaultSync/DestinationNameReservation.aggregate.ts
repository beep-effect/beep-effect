/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import * as C from "./DestinationNameReservation.command.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * DestinationNameReservation vault sync contract.
 *
 * **Example** (Address one aggregate stream)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const ref=V.DestinationNameReservation.ref(V.reservationKey({ orgId: 1, name: "vault" }));
 * console.log(ref.id);
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
    ClaimDestinationName: (s, c, { id }) => {
      if (id !== V.reservationKey(c.claim)) return SyncRuleViolation.make({ rule: "wrong-key", evidence: id });
      if (s !== null && s.destinationId !== c.claim.destinationId)
        return SyncRuleViolation.make({ rule: "name-held", evidence: id });
      return s?.name === c.claim.name ? [] : [C.DestinationNameClaimed.make(Struct.omit(c, ["_tag"]))];
    },
    ReleaseDestinationName: (s, c) =>
      s?.destinationId === c.destinationId ? [C.DestinationNameReleased.make(Struct.omit(c, ["_tag"]))] : [],
  },
  evolve: { DestinationNameClaimed: (_, e) => e.claim, DestinationNameReleased: () => null },
}) {}
