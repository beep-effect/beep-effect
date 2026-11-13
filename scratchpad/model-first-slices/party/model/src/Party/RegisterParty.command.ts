import * as Domain from "@alchemy.run/domain";
import "@proto/kernel/Audience";
import { Actor } from "@proto/kernel/Actor";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
import { PartyId } from "./Party.id.ts";

/**
 * Refused: a party id is registered once.
 *
 * @category rejections
 * @since 0.0.0
 */
export class PartyAlreadyRegistered extends Domain.Rejection(
  "PartyAlreadyRegistered",
  {},
  { httpApiStatus: 409, description: "This party id is already registered." },
) {}

/**
 * The fact: a party exists in the registering actor's org.
 *
 * @category events
 * @since 0.0.0
 */
export class PartyRegistered extends Domain.Event("PartyRegistered", {
  name: S.String,
  by: Actor,
}) {}

/**
 * Register a party in the caller's org.
 *
 * @category commands
 * @since 0.0.0
 */
export class RegisterParty extends Domain.Command(
  "RegisterParty",
  {
    target: PartyId,
    middleware: [Session],
    input: { name: S.String },
    events: [PartyRegistered],
    rejects: [PartyAlreadyRegistered],
  },
  { description: "Register a party, by name, in the caller's organization.", audience: "intake" },
) {}
