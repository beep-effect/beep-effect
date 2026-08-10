/**
 * Robots policy for oip.law.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { oipSiteContent } from "@/content";
import type { MetadataRoute } from "next";

/**
 * Returns the robots policy for OIP.
 *
 * **Example** (Logging robots rules array)
 *
 * ```ts
 * import robots from "@beep/oip-web/app/robots"
 *
 * console.log(robots().rules)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${oipSiteContent.metadata.siteUrl}/sitemap.xml`,
  };
}
