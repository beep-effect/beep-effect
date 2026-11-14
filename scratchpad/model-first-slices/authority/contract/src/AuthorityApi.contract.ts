import * as Domain from "@alchemy.run/domain";
import * as Catalog from "@proto/contract-kit/Catalog";
import { AssignAccountability } from "./Accountability/AssignAccountability.command.ts";
import { ReleaseAccountability } from "./Accountability/ReleaseAccountability.command.ts";
import { NarrowDelegation } from "./Delegation/NarrowDelegation.command.ts";
import { RevokeDelegation } from "./Delegation/RevokeDelegation.command.ts";
import { DelegateGrant } from "./Grant/DelegateGrant.command.ts";
import { IssueGrant } from "./Grant/IssueGrant.command.ts";
import { NarrowGrant } from "./Grant/NarrowGrant.command.ts";
import { RevokeGrant } from "./Grant/RevokeGrant.command.ts";

/**
 * Everything of the authority context a client can call, with no aggregate behind it.
 *
 * @category contracts
 * @since 0.0.0
 */
export const AuthorityCatalog = Catalog.make({
  name: "Authority",
  commands: [
    IssueGrant,
    NarrowGrant,
    RevokeGrant,
    DelegateGrant,
    NarrowDelegation,
    RevokeDelegation,
    AssignAccountability,
    ReleaseAccountability,
  ],
  views: [],
  queries: [],
});

/**
 * The authority context's client contract: the same RPC group as the
 * model's `AuthorityApi`.
 *
 * @category contracts
 * @since 0.0.0
 */
export class AuthorityContract extends Domain.Api(
  "AuthorityContract",
  {
    model: AuthorityCatalog,
    commands: [
      "IssueGrant",
      "NarrowGrant",
      "RevokeGrant",
      "DelegateGrant",
      "NarrowDelegation",
      "RevokeDelegation",
      "AssignAccountability",
      "ReleaseAccountability",
    ],
    views: [],
    queries: [],
    streams: [],
  },
  { description: "Issue, narrow, delegate and revoke grants; take and release accountability for agent runs." },
) {}
