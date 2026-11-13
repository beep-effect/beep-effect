import * as Domain from "@alchemy.run/domain";
import { OrgId } from "@proto/kernel/Ids";
import { carry } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
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
 * The fact: a party exists in an org.
 *
 * @category events
 * @since 0.0.0
 */
export class PartyRegistered extends Domain.Event("PartyRegistered", carry({ org: OrgId, name: S.String })) {}

/**
 * Register a party, by name, in an org.
 *
 * @category commands
 * @since 0.0.0
 */
export class RegisterParty extends Domain.Command(
  "RegisterParty",
  {
    target: PartyId,
    middleware: [Session],
    input: { org: OrgId, name: S.String },
    events: [PartyRegistered],
    rejects: [PartyAlreadyRegistered, MissingGrant],
  },
  { description: "Register a party, by name, in an organization." },
) {}
