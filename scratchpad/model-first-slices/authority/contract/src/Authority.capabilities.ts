import { Capability } from "@proto/kernel/Capability";
import { CapabilityId } from "@proto/kernel/Ids";
import { IssueGrant } from "./Grant/IssueGrant.command.ts";
import { NarrowGrant } from "./Grant/NarrowGrant.command.ts";
import { RevokeGrant } from "./Grant/RevokeGrant.command.ts";

/**
 * Administer grants in an org: issue, narrow and revoke them. Delegating a
 * grant needs no capability: only its holder may, and only narrower.
 *
 * @category capabilities
 * @since 0.0.0
 */
export const AuthorityGrants = Capability.make({
  id: CapabilityId.make("authority.grants"),
  operations: [IssueGrant.tag, NarrowGrant.tag, RevokeGrant.tag],
  description: "Issue, narrow and revoke grants in an organization.",
});

/**
 * Every capability the authority context defines: the file's designated
 * primary export, as `PartyCapabilities` is Party's.
 *
 * @category capabilities
 * @since 0.0.0
 */
export const AuthorityCapabilities = [AuthorityGrants] as const;
