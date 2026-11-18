import * as Domain from "@alchemy.run/domain";
import { Hop, Invocation, Provenance } from "@proto/kernel/Invocation";
import { ReadmissionRefused } from "@proto/kernel/ReadmissionRefused.rejection";

/**
 * Party's port to the authority context: re-admit an event's provenance for
 * the next hop. Every policy and saga step that sends a command asks first,
 * and sends under the invocation it gets back, so a revocation or a lapsed
 * accountability counts at the very next hop.
 *
 * @category external systems
 * @since 0.0.0
 */
export class Authority extends Domain.ExternalSystem(
  "Authority",
  {
    readmit: {
      args: { provenance: Provenance, hop: Hop },
      success: Invocation,
      error: ReadmissionRefused,
    },
  },
  { description: "Re-admits a provenance for its next hop from live grants, or refuses." },
) {}
