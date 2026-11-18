import * as Domain from "@alchemy.run/domain";
import { GrantTerms } from "@proto/kernel/Capability";
import { DelegationId, PrincipalId, RunId } from "@proto/kernel/Ids";
import { GrantRef, Hop, Provenance } from "@proto/kernel/Invocation";
import * as S from "effect/Schema";

/**
 * The authority context refused the run's grant, and why.
 *
 * @category errors
 * @since 0.0.0
 */
export class GrantDenied extends S.TaggedError<GrantDenied, { readonly brand: unique symbol }>()("GrantDenied", { reason: S.String }) {}

/**
 * The runs context's port to the authority context: grant a run a narrowed
 * delegation and a live accountable human, as the re-admitted requester.
 *
 * @category external systems
 * @since 0.0.0
 */
export class Authority extends Domain.ExternalSystem(
  "Authority",
  {
    grantRun: {
      args: {
        provenance: Provenance,
        hop: Hop,
        source: GrantRef,
        delegation: DelegationId,
        run: RunId,
        terms: GrantTerms,
      },
      success: { delegation: DelegationId, accountable: PrincipalId, provenance: Provenance },
      error: GrantDenied,
    },
  },
  { description: "Grants a run a narrowed delegation and an accountable human, or refuses." },
) {}
