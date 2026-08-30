/**
 * Root layout and static metadata for the Todox app.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

/**
 * Static metadata for the Todox app shell.
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
  title: "@beep/todox",
  description: "Minimal Next.js app",
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
      <body>{children}</body>
    </html>
  );
}
