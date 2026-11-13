import * as Domain from "@alchemy.run/domain";
import { OrgId } from "@proto/kernel/Ids";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
import { PartiesMerged } from "./MergeParties.command.ts";
import { PartyId } from "./Party.id.ts";
import { PartyRegistered } from "./RegisterParty.command.ts";

/**
 * A party as it is now: its org, its name, and every party merged into it.
 *
 * @category models
 * @since 0.0.0
 */
export const EffectivePartyState = S.Struct({
  org: S.NullOr(OrgId),
  name: S.NullOr(S.String),
  absorbed: S.Array(PartyId),
});
/**
 * @category models
 * @since 0.0.0
 */
export type EffectivePartyState = typeof EffectivePartyState.Type;

/**
 * The state of a party nobody has registered yet.
 *
 * @category models
 * @since 0.0.0
 */
export const EffectivePartyInitial: EffectivePartyState = { org: null, name: null, absorbed: [] };

/**
 * The `EffectiveParty` view's read contract, with no aggregate behind it.
 *
 * **Gotchas**
 *
 * Interim (D9): `events` lists the model view's emitted events in the
 * aggregate's order; the parity test checks.
 *
 * @category reads
 * @since 0.0.0
 */
export class EffectivePartyRead extends Domain.View("EffectiveParty", {
  from: [],
  key: PartyId,
  state: EffectivePartyState,
  initial: EffectivePartyInitial,
  events: [PartyRegistered, PartiesMerged],
  middleware: [Session],
  rejects: [MissingGrant],
}) {}
