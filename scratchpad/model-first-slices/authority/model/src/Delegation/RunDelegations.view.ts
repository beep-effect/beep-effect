import * as Domain from "@alchemy.run/domain";
import { DelegationId, RunId } from "@proto/kernel/Ids";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { Delegation } from "./Delegation.aggregate.ts";

/**
 * Which delegations each agent run holds: the index the trusted boundary
 * reads for an agent caller. The boundary confirms each one, and its
 * parent grant, against their aggregates.
 *
 * @category views
 * @since 0.0.0
 */
export class RunDelegations extends Domain.View(
  "RunDelegations",
  {
    from: [Delegation],
    key: RunId,
    keyOf: { Delegation: ({ event }) => event.holder },
    state: S.Struct({ delegations: S.Array(DelegationId) }),
    initial: { delegations: [] },
    evolve: {
      DelegationOpened: (view, _event, { source }) => ({ delegations: A.union(view.delegations, [source.id]) }),
      DelegationRevoked: (view, _event, { source }) => ({ delegations: A.difference(view.delegations, [source.id]) }),
    },
  },
  { description: "The delegations each agent run holds, as an index for the trusted boundary." },
) {}
