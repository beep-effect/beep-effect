import * as Domain from "@alchemy.run/domain";
import { AuthorityModel } from "./Authority.model.ts";

/**
 * What callers of the authority context reach. `OpenDelegation` and
 * `ExpireGrant` are not served: only the model's own policies send them.
 *
 * @category apis
 * @since 0.0.0
 */
export class AuthorityApi extends Domain.Api(
  "AuthorityApi",
  {
    model: AuthorityModel,
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
