/**
 * Governed tier gate layer factory.
 *
 * A factory rather than a constant because the granted operations, sink, and
 * grant metadata are composition-root data: the app entrypoint that already
 * imports both the governed toolkit and this slice supplies them, and neither
 * slice ever names the other. The layer keeps `ExecutionLedger` and
 * `EpistemicConfig` as open requirements so the composition root chooses the
 * ledger adapter — and so a test can inject a failing ledger to prove the
 * write-ahead refusal without a database.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { TierGate } from "@beep/mcp-kit";
import { Layer } from "effect";
import { makeGovernedTierGate } from "./GovernedTierGate.gate.ts";
import type { EpistemicConfig } from "@beep/epistemic-config/server";
import type { ExecutionLedger } from "@beep/epistemic-use-cases/ExecutionLedger";
import type { GovernedTierGateOptions } from "./GovernedTierGate.gate.ts";

/**
 * Build the governed `TierGate` layer from composition-root options.
 *
 * @example
 * ```ts
 * import { GovernedTierGateLive, GovernedTierGateOptions } from "@beep/epistemic-server/GovernedTierGate"
 * import { ExecutionSink, GrantOperation, GrantPurpose, GrantResource, SinkDestination } from "@beep/epistemic-domain/values/ExecutionGrant"
 * import { Duration, Layer } from "effect"
 *
 * const gate = GovernedTierGateLive(GovernedTierGateOptions.make({
 *   grantTtl: Duration.hours(12),
 *   operations: [GrantOperation.make("ontology_propose_change_batch")],
 *   purpose: GrantPurpose.make("ontology-workspace-mutation"),
 *   resource: GrantResource.make("ontology-workspace"),
 *   sink: ExecutionSink.make({
 *     audience: "local-workspace",
 *     destination: SinkDestination.make("workspace://ontology"),
 *     sinkClass: "mcp-write"
 *   })
 * }))
 * console.log(Layer.isLayer(gate))
 * // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const GovernedTierGateLive = (
  options: GovernedTierGateOptions
): Layer.Layer<TierGate, never, ExecutionLedger | EpistemicConfig> =>
  Layer.effect(TierGate, makeGovernedTierGate(options));
