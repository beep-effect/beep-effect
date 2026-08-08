/**
 * Governed egress layer factory.
 *
 * Produces the `FetchHttpClient.Fetch` reference, which is what makes this a
 * boundary rather than a convention: every `HttpClient` built from
 * `FetchHttpClient.layer` resolves that reference per request, including
 * clients constructed inside drivers that otherwise seal their own transport.
 *
 * **Where this layer must be provided.** Into the graph that builds the
 * `HttpClient` the governed handlers use. Measured behaviour (2026-07-27, see
 * `goals/agent-execution-authority/history/pr6-fetch-reach-spike.md`):
 * `HttpClient.layerMergedContext` captures its own build context and merges it
 * with the request-time context at execute time, so the override rides with the
 * client layer and reaches handlers whose own context never contains it.
 *
 * **What must not happen.** That same merge gives the *request-time* context
 * precedence, so a `Fetch` provided per request silently displaces this one for
 * every dispatch behind it. No middleware or request-scoped layer in a
 * transport that mounts governed tools may provide `FetchHttpClient.Fetch`.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { Layer } from "effect";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { makeGovernedEgressFetch } from "./GovernedEgress.fetch.ts";
import type { EpistemicConfig } from "@beep/epistemic-config/server";
import type { ExecutionLedger } from "@beep/epistemic-use-cases/ExecutionLedger";
import type { GovernedEgressOptions } from "./GovernedEgress.fetch.ts";

/**
 * Grant specification plus optional transport override accepted by {@link GovernedEgressLive}.
 *
 * **Details**
 *
 * `baseFetch` exists for tests, which need to observe what the boundary let
 * through without reaching the network. Production omits it and the platform
 * `fetch` is used.
 *
 * **Example** (Build egress layer with options)
 *
 * ```ts
 * import { GovernedEgressOptions } from "@beep/epistemic-server/GovernedEgress"
 * import type { GovernedEgressLiveOptions } from "@beep/epistemic-server/GovernedEgress"
 * import { GrantOperation, GrantPurpose, GrantResource } from "@beep/epistemic-domain/values/ExecutionGrant"
 * import { Duration } from "effect"
 *
 * const live: GovernedEgressLiveOptions = {
 *   grant: GovernedEgressOptions.make({
 *     grantTtl: Duration.hours(12),
 *     operation: GrantOperation.make("http-egress"),
 *     purpose: GrantPurpose.make("ontology-provenance-publication"),
 *     resource: GrantResource.make("ontology-workspace")
 *   })
 * }
 * console.log(live.grant.operation)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface GovernedEgressLiveOptions {
  readonly baseFetch?: typeof globalThis.fetch | undefined;
  readonly grant: GovernedEgressOptions;
}

/**
 * Build the governed egress `Fetch` layer from composition-root options.
 *
 * @example
 * ```ts
 * import { GovernedEgressLive, GovernedEgressOptions } from "@beep/epistemic-server/GovernedEgress"
 * import { GrantOperation, GrantPurpose, GrantResource } from "@beep/epistemic-domain/values/ExecutionGrant"
 * import { Duration, Layer } from "effect"
 *
 * const egress = GovernedEgressLive({
 *   grant: GovernedEgressOptions.make({
 *     grantTtl: Duration.hours(12),
 *     operation: GrantOperation.make("http-egress"),
 *     purpose: GrantPurpose.make("ontology-provenance-publication"),
 *     resource: GrantResource.make("ontology-workspace")
 *   })
 * })
 * console.log(Layer.isLayer(egress))
 * // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
// `Fetch` is a `Context.Reference`, and a Reference's identifier is `never` —
// it always resolves, defaulting to the platform fetch — so this layer's output
// type is `never`. That is exactly why the override is a policy decision and
// not a type-checked requirement: nothing fails to compile when it is missing,
// which is what the transport test exists to catch.
export const GovernedEgressLive = ({
  grant,
  baseFetch,
}: GovernedEgressLiveOptions): Layer.Layer<never, never, ExecutionLedger | EpistemicConfig> =>
  Layer.effect(FetchHttpClient.Fetch, makeGovernedEgressFetch(grant, baseFetch));
