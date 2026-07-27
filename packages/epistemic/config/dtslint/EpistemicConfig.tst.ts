import { defaultPolicyRevision, EpistemicServerConfig, resolveSinkAudience } from "@beep/epistemic-config/server";
import { SinkDestination } from "@beep/epistemic-domain/values/ExecutionGrant";
import { expect } from "tstyche";
import type { SinkAudience } from "@beep/epistemic-domain/values/ExecutionGrant";

expect(
  EpistemicServerConfig.make({
    destinationAllowlist: [SinkDestination.fromUnknown("https://registry.example")],
    policyRevision: defaultPolicyRevision,
  })
).type.toBe<EpistemicServerConfig>();

// The resolver is total over destinations and closed over the audience domain:
// there is no third branch a future contributor can fall through into.
expect(resolveSinkAudience(SinkDestination.fromUnknown("https://registry.example"))).type.toBe<SinkAudience>();
