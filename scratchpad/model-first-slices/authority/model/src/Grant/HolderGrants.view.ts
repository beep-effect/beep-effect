import * as Domain from "@alchemy.run/domain";
import { GrantId, PrincipalId } from "@proto/kernel/Ids";
import * as A from "effect/Array";
import * as Initial from "@proto/kernel/Initial";
import * as S from "effect/Schema";
import { Grant } from "./Grant.aggregate.ts";

/** What a holder's index starts as and holds: the grants issued to them and not yet revoked or expired. */
const HolderGrantsState = S.Struct({
  grants: Initial.empty(GrantId, { description: "The grants the principal holds; none at first." }),
});

/**
 * Which grants each principal holds, issued and not yet revoked or expired:
 * an index the trusted boundary reads to find a caller's grants. The truth
 * of each grant stays with its aggregate, which the boundary reads too.
 *
 * **Gotchas**
 *
 * Eventually consistent, like every view: a grant issued a moment ago may
 * not be listed yet. Revocation does not wait for it, since the boundary
 * confirms every listed grant against the aggregate.
 *
 * @category views
 * @since 0.0.0
 */
export class HolderGrants extends Domain.View(
  "HolderGrants",
  {
    from: [Grant],
    key: PrincipalId,
    keyOf: { Grant: ({ event }) => event.holder },
    state: HolderGrantsState,
    initial: HolderGrantsState.make({}),
    evolve: {
      GrantIssued: (view, _event, { source }) => ({ grants: A.union(view.grants, [source.id]) }),
      GrantRevoked: (view, _event, { source }) => ({ grants: A.difference(view.grants, [source.id]) }),
      GrantExpired: (view, _event, { source }) => ({ grants: A.difference(view.grants, [source.id]) }),
    },
  },
  { description: "The grants each principal holds, as an index for the trusted boundary." },
) {}
