/**
 * Web app manifest for the oip web app shell.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { MetadataRoute } from "next";

/**
 * Returns the static web manifest for oip web.
 *
 * **Example** (Logging the manifest name)
 *
 * ```ts
 * import manifest from "@beep/oip-web/app/manifest"
 *
 * console.log(manifest().name)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OIP - Oppold IP Law",
    short_name: "OIP",
    description: "Patent counsel for the people who build the machines.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f1e7",
    theme_color: "#11100e",
    categories: ["business", "legal", "productivity"],
    shortcuts: [
      {
        name: "Contact",
        short_name: "Contact",
        url: "/?source=pwa#contact",
        icons: [{ src: "/oip/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Practice areas",
        short_name: "Practice",
        url: "/?source=pwa#practice",
        icons: [{ src: "/oip/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Recent matters",
        short_name: "Matters",
        url: "/?source=pwa#matters",
        icons: [{ src: "/oip/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    icons: [
      {
        src: "/oip/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/oip/apple-touch-icon-dark.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/oip/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/oip/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/oip/icon-192-dark.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/oip/icon-512-dark.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
