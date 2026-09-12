/**
 * Root layout, direction contract, and static metadata for the Todox site.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { meta, nav } from "@/content/copy";
import { TodoxAtomProvider } from "@/runtime/TodoxAtomProvider";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

/**
 * The Impeccable direction contract for the current world, emitted as an HTML
 * comment that is the first child of the document body so it survives the
 * production build and can be audited.
 *
 * **Example** (Find the direction key)
 *
 * ```ts
 * import { directionContract } from "@/app/layout"
 *
 * console.log(directionContract.includes("evergreen-ledger"))
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const directionContract = `<!--
DIRECTION CONTRACT
THESIS: A standard product site for an advisor runtime, in the firm's own palette: deep-green ink and a mint glow on parchment, forest bands where the product runs. Refuses neon-AI gradients, chat mockups, hero metrics.
OWN-WORLD: Parchment ground with green ink; forest-dark bands carrying a mint glow; Fraunces display, Geist body, Martian Mono for records; hairline rules instead of cards; pill buttons; one evidence graph.
STORY: A firm leader mid AI-evaluation reads the pitch, sees a claim become a reviewed record with a receipt, understands control and evidence, and requests a demo.
FIRST VIEWPORT: Sticky nav; forest hero with the headline left, lede, two pill buttons, and the evidence graph glowing right; parchment pillars below the fold.
FORM: Evergreen Ledger, pinned by the brief (dark green + parchment); key evergreen-ledger.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
-->`;

/**
 * Static metadata for the Todox site.
 *
 * **Example** (Read the application title)
 *
 * ```ts
 * import { metadata } from "@/app/layout"
 *
 * console.log(metadata.title)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://todox.ai"),
  title: meta.title,
  description: meta.description,
  openGraph: {
    title: meta.title,
    description: meta.socialLine,
    siteName: "Todox",
    type: "website",
    url: "https://todox.ai",
  },
  twitter: {
    card: "summary_large_image",
    title: meta.title,
    description: meta.socialLine,
  },
};

/**
 * Builds the shared HTML shell for every Todox route.
 *
 * **Example** (Render the application shell)
 *
 * ```ts
 * import RootLayout from "@/app/layout"
 *
 * const layout = RootLayout({ children: "content" })
 * console.log(layout.type)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div
          hidden
          aria-hidden="true"
          data-direction-contract
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static build-time direction contract, no user input
          dangerouslySetInnerHTML={{ __html: directionContract }}
        />
        <link rel="preload" href="/fonts/Fraunces-Variable.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Geist-Variable.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link
          rel="preload"
          href="/fonts/MartianMono-Variable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <a className="sr-only" href={nav.secondary.href}>
          Skip to how it works
        </a>
        <TodoxAtomProvider>{children}</TodoxAtomProvider>
      </body>
    </html>
  );
}
