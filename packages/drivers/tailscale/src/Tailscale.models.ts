/**
 * Data models for the Tailscale CLI driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TailscaleId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $TailscaleId.create("Tailscale.models");
const tailnetIpv4Pattern =
  /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.(?:0|[1-9]\d?|1\d{2}|2[0-4]\d|25[0-5])\.(?:0|[1-9]\d?|1\d{2}|2[0-4]\d|25[0-5])$/u;

/**
 * IPv4 address in Tailscale's `100.64.0.0/10` carrier-grade NAT range.
 *
 * **Example** (Make Tailnet IPv4 address)
 *
 * ```ts
 * import { TailnetIpv4Address } from "@beep/tailscale/Tailscale.models"
 *
 * const address = TailnetIpv4Address.make("100.100.100.100")
 * console.log(address) // "100.100.100.100"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TailnetIpv4Address = S.String.check(
  S.isPattern(tailnetIpv4Pattern, {
    identifier: "TailnetIpv4Address",
    title: "Tailnet IPv4 address",
    description: "An IPv4 address in Tailscale's 100.64.0.0/10 range.",
    message: "Expected a Tailscale IPv4 address in 100.64.0.0/10",
  })
).pipe(
  $I.annoteSchema("TailnetIpv4Address", {
    description: "An IPv4 address assigned from Tailscale's 100.64.0.0/10 range.",
  })
);

/**
 * Runtime type for {@link TailnetIpv4Address}.
 *
 * **Example** (Type a Tailnet IPv4)
 *
 * ```ts
 * import type { TailnetIpv4Address } from "@beep/tailscale/Tailscale.models"
 *
 * const address: TailnetIpv4Address = "100.64.0.1"
 * console.log(address)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TailnetIpv4Address = typeof TailnetIpv4Address.Type;

/**
 * `Self` payload decoded from `tailscale status --json`.
 *
 * **Example** (Create Self status payload)
 *
 * ```ts
 * import { TailscaleStatusSelf } from "@beep/tailscale/Tailscale.models"
 *
 * const self = TailscaleStatusSelf.make({ DNSName: "desktop.tail.ts.net." })
 * console.log(self.DNSName)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class TailscaleStatusSelf extends S.Class<TailscaleStatusSelf>($I`TailscaleStatusSelf`)(
  {
    DNSName: S.String.pipe(S.optionalKey).annotateKey({
      description: "MagicDNS name reported for the local Tailscale node, when present.",
    }),
    TailscaleIPs: S.String.pipe(S.Array, S.optionalKey).annotateKey({
      description: "IP address strings reported for the local Tailscale node.",
    }),
  },
  $I.annote("TailscaleStatusSelf", {
    description: "Validated local-node subset of the `tailscale status --json` payload.",
  })
) {}

/**
 * Top-level payload decoded from `tailscale status --json`.
 *
 * **Example** (Create status JSON payload)
 *
 * ```ts
 * import { TailscaleStatusJson, TailscaleStatusSelf } from "@beep/tailscale/Tailscale.models"
 *
 * const status = TailscaleStatusJson.make({ Self: TailscaleStatusSelf.make({}) })
 * console.log(status.Self)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class TailscaleStatusJson extends S.Class<TailscaleStatusJson>($I`TailscaleStatusJson`)(
  {
    Self: S.optionalKey(TailscaleStatusSelf).annotateKey({
      description: "Local-node status payload, when Tailscale reports one.",
    }),
  },
  $I.annote("TailscaleStatusJson", {
    description: "Decoded subset of the `tailscale status --json` response.",
  })
) {}

/**
 * Normalized Tailscale facts used by application runtimes.
 *
 * **Example** (Create normalized Tailscale status)
 *
 * ```ts
 * import { TailscaleStatus } from "@beep/tailscale/Tailscale.models"
 * import * as O from "effect/Option"
 *
 * const status = TailscaleStatus.make({
 *   magicDnsName: O.some("desktop.tail.ts.net"),
 *   tailnetIpv4Addresses: ["100.100.100.100"]
 * })
 * console.log(status.tailnetIpv4Addresses)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TailscaleStatus extends S.Class<TailscaleStatus>($I`TailscaleStatus`)(
  {
    magicDnsName: S.OptionFromNullOr(S.String).annotateKey({
      description: "Normalized MagicDNS name without a trailing root dot, when available.",
    }),
    tailnetIpv4Addresses: S.Array(TailnetIpv4Address).annotateKey({
      description: "Tailscale IPv4 addresses assigned to the local node.",
    }),
  },
  $I.annote("TailscaleStatus", {
    description: "Normalized MagicDNS and Tailnet IPv4 facts for the local node.",
  })
) {}
