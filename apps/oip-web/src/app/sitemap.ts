/**
 * Sitemap for oip.law.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { oipSiteContent } from "@/content";
import type { MetadataRoute } from "next";

/**
 * Returns the OIP sitemap.
 *
 * **Example** (Logging first sitemap entry)
 *
 * ```ts
 * import sitemap from "@beep/oip-web/app/sitemap"
 *
 * console.log(sitemap()[0]?.url)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: oipSiteContent.metadata.siteUrl,
      lastModified: "2026-05-14",
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
