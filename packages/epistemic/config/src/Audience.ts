/**
 * Destination-to-audience resolution.
 *
 * Audience is derived from the destination, never declared by the caller — a
 * prompt-injected agent that could name its own audience could name the
 * friendlier one. The rule is loopback-versus-not: a destination that resolves
 * to the local host is observable only by the local workspace, and everything
 * else is observable by the external network.
 *
 * This is why `local-workspace` is not degenerate for network egress in v1:
 * the desktop sidecar itself is bound to loopback, so a governed request to it
 * classifies differently from a request that leaves the machine.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { SinkAudience } from "@beep/epistemic-domain/values/ExecutionGrant";
import * as A from "effect/Array";
import * as Str from "effect/String";
import type { SinkDestination } from "@beep/epistemic-domain/values/ExecutionGrant";

const loopbackHosts: ReadonlyArray<string> = ["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0"];

const hostOf = (destination: string): string => {
  try {
    return new URL(destination).hostname;
  } catch {
    return Str.toLowerCase(Str.trim(destination));
  }
};

/**
 * Classify a destination's audience.
 *
 * **Details**
 *
 * Loopback destinations resolve to `local-workspace`; every other destination,
 * including anything unparseable, resolves to `external-network`. Unparseable
 * input deliberately takes the stricter branch so a malformed destination can
 * never buy a weaker classification.
 *
 * **Example** (Local versus external destinations)
 *
 * ```ts
 * import { resolveSinkAudience } from "@beep/epistemic-config/server"
 * import { SinkDestination } from "@beep/epistemic-domain/values/ExecutionGrant"
 *
 * console.log(resolveSinkAudience(SinkDestination.decodeUnknownSync("http://127.0.0.1:3939")))
 * // "local-workspace"
 * console.log(resolveSinkAudience(SinkDestination.decodeUnknownSync("https://registry.example")))
 * // "external-network"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const resolveSinkAudience = (destination: SinkDestination): SinkAudience =>
  A.contains(loopbackHosts, Str.toLowerCase(hostOf(destination)))
    ? SinkAudience.Enum["local-workspace"]
    : SinkAudience.Enum["external-network"];
