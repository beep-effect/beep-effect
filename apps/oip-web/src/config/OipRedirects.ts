/**
 * OIP redirect configuration exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { Redirect } from "next/dist/lib/load-custom-routes";

/**
 * Returns the canonical OIP redirect table for legacy OPIP compatibility.
 *
 * **Example** (Basic function invocation)
 *
 * ```ts
 * import { oipRedirects } from "@beep/oip-web/config/OipRedirects"
 *
 * const redirects = oipRedirects()
 * console.log(redirects.length)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const oipRedirects = (): Array<Redirect> => [
  {
    source: "/opip/:path*",
    destination: "/oip/:path*",
    permanent: true,
  },
  {
    source: "/:path*",
    destination: "https://oip.law/:path*",
    permanent: true,
    has: [{ type: "host", value: "opip.law" }],
  },
  {
    source: "/:path*",
    destination: "https://oip.law/:path*",
    permanent: true,
    has: [{ type: "host", value: "www.opip.law" }],
  },
  {
    source: "/:path*",
    destination: "https://oip.law/:path*",
    permanent: true,
    has: [{ type: "host", value: "www.oip.law" }],
  },
  {
    source: "/:path*",
    destination: "https://staging.oip.law/:path*",
    permanent: false,
    has: [{ type: "host", value: "staging.opip.law" }],
  },
];
