import * as Domain from "@alchemy.run/domain";
import { GrantTerms } from "@proto/kernel/Capability";
import { GrantId, PrincipalId } from "@proto/kernel/Ids";
import { carry } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { Session } from "@proto/kernel/Session.middleware";
import { TermsWiden } from "../TermsWiden.rejection.ts";
import { GrantNotActive } from "./GrantNotActive.rejection.ts";

/**
 * The fact: an active grant's terms now reach less far.
 *
 * @category events
 * @since 0.0.0
 */
export class GrantNarrowed extends Domain.Event("GrantNarrowed", carry({ holder: PrincipalId, terms: GrantTerms })) {}

/**
 * Narrow an active grant: fewer operations, a smaller resource, an earlier expiry.
 *
 * @category commands
 * @since 0.0.0
 */
export class NarrowGrant extends Domain.Command(
  "NarrowGrant",
  {
    target: GrantId,
    middleware: [Session],
    input: { terms: GrantTerms },
    events: [GrantNarrowed],
    rejects: [GrantNotActive, TermsWiden, MissingGrant],
  },
  { description: "Narrow an active grant's operations, resource or expiry. It can never widen." },
) {}
