/**
 * Execution-authority configuration test layers and grant fixtures.
 *
 * The fixture grant set is a deliverable, not a convenience: the acceptance
 * test asserts a chained ledger, so the grant-set digest it is evaluated
 * against has to be byte-stable across runs. Everything here is therefore
 * pinned — the frozen instant, the expiry, and the destinations — and nothing
 * reads the clock.
 *
 * @packageDocumentation
 * @category testing
 * @since 0.0.0
 */

import { ExecutionGrant, SinkDestination } from "@beep/epistemic-domain/values/ExecutionGrant";
import { addGrant, emptyDraftGrantSet, freezeGrantSet } from "@beep/epistemic-domain/values/GrantSet";
import { DateTime, Layer, Result } from "effect";
import * as S from "effect/Schema";
import { defaultPolicyRevision, EpistemicConfig, EpistemicServerConfig } from "./ServerConfig.ts";
import type { FrozenGrantSet } from "@beep/epistemic-domain/values/GrantSet";

/**
 * Destination the fixture grant authorizes for external network egress.
 *
 * **Example** (Log allowed destination URL)
 *
 * ```ts
 * import { fixtureAllowedDestination } from "@beep/epistemic-config/test"
 *
 * console.log(fixtureAllowedDestination) // "https://registry.example"
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const fixtureAllowedDestination = SinkDestination.fromUnknown("https://registry.example");

/**
 * Destination the fixture grant deliberately omits, so a denial has something
 * concrete to be a denial *of*.
 *
 * **Example** (Log denied destination URL)
 *
 * ```ts
 * import { fixtureDeniedDestination } from "@beep/epistemic-config/test"
 *
 * console.log(fixtureDeniedDestination) // "https://attacker.example"
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const fixtureDeniedDestination = SinkDestination.fromUnknown("https://attacker.example");

/**
 * Instant the fixture grant set is sealed at. Pinned so the digest is stable.
 *
 * **Example** (Convert freeze time to epoch)
 *
 * ```ts
 * import { fixtureFrozenAt } from "@beep/epistemic-config/test"
 * import { DateTime } from "effect"
 *
 * console.log(DateTime.toEpochMillis(fixtureFrozenAt)) // 0
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const fixtureFrozenAt = DateTime.makeUnsafe(0);

const fixtureGrant = S.decodeUnknownSync(ExecutionGrant)({
  budget: { maxToolCalls: null },
  expiresAt: 86_400_000,
  operation: "ontology_publish_provenance",
  policyRevision: defaultPolicyRevision,
  principal: { component: "Runtime", kind: "System" },
  purpose: "provenance-publication",
  resource: "ontology-workspace",
  sink: {
    audience: "external-network",
    destination: fixtureAllowedDestination,
    sinkClass: "network-egress",
  },
});

/**
 * Deterministic frozen grant set: one grant, for one operation, against one
 * external destination, under the default policy revision.
 *
 * **Example** (Verify frozen grant digest)
 *
 * ```ts
 * import { fixtureFrozenGrantSet } from "@beep/epistemic-config/test"
 * import { verifyFrozenGrantSetDigest } from "@beep/epistemic-domain/values/GrantSet"
 *
 * console.log(verifyFrozenGrantSetDigest(fixtureFrozenGrantSet)) // true
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const fixtureFrozenGrantSet: FrozenGrantSet = freezeGrantSet(
  Result.getOrThrow(addGrant(emptyDraftGrantSet(defaultPolicyRevision), fixtureGrant)),
  fixtureFrozenAt
);

/**
 * Configuration value matching {@link fixtureFrozenGrantSet}: the fixture
 * grant's destination is allowlisted, the attacker destination is not.
 *
 * **Example** (Check allowlist length)
 *
 * ```ts
 * import { testEpistemicConfig } from "@beep/epistemic-config/test"
 *
 * console.log(testEpistemicConfig.destinationAllowlist.length) // 1
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const testEpistemicConfig = EpistemicServerConfig.make({
  destinationAllowlist: [fixtureAllowedDestination],
  policyRevision: defaultPolicyRevision,
});

/**
 * Static execution-authority configuration layer built from an explicit value.
 *
 * **Example** (Build layer from config)
 *
 * ```ts
 * import { makeEpistemicConfigTest, testEpistemicConfig } from "@beep/epistemic-config/test"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(makeEpistemicConfigTest(testEpistemicConfig))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeEpistemicConfigTest = (config: EpistemicServerConfig) => Layer.succeed(EpistemicConfig, config);

/**
 * Static execution-authority configuration layer carrying {@link testEpistemicConfig}.
 *
 * **Example** (Confirm static config layer)
 *
 * ```ts
 * import { EpistemicConfigTest } from "@beep/epistemic-config/test"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(EpistemicConfigTest)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EpistemicConfigTest = makeEpistemicConfigTest(testEpistemicConfig);
