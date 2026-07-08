/**
 * Root layout and static metadata for the oip web app.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { Config, Effect, pipe } from "effect";
import * as O from "effect/Option";
import { headers } from "next/headers";
import { connection } from "next/server";
import { use } from "react";
import { oipSiteContent, oipTwitterHandle } from "@/content";
import { OipAtomProvider } from "@/runtime/OipAtomProvider";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { dual, thunkTrue } from "@beep/utils";

const { metadata: siteMetadata } = oipSiteContent;
const twitterHandle = oipTwitterHandle(oipSiteContent);
const REACT_GRAB_VERSION = "0.1.37";
const REACT_GRAB_INTEGRITY = "sha384-bu1FPBrtnXa6EIFQzS/zbLFeLLKPK06RmfHZYCTbWTXxXVjiIGvjdMjo/jDi+fVu";
const configStringOptionSync = (name: string): O.Option<string> => Effect.runSync(Config.option(Config.string(name)));
const configStringEqualsSync: {
  (name: string, expected: string): boolean;
  (expected: string): (name: string) => boolean;
} = dual(2, (name: string, expected: string): boolean =>
  pipe(
    configStringOptionSync(name),
    O.exists((value) => value === expected)
  )
);
const configStringNotEqualsSync: {
  (name: string, expected: string): boolean;
  (expected: string): (name: string) => boolean;
} = dual(2, (name: string, expected: string): boolean =>
  pipe(
    configStringOptionSync(name),
    O.match({
      onNone: thunkTrue,
      onSome: (value) => value !== expected,
    })
  )
);
const shouldLoadReactGrab =
  configStringEqualsSync("NODE_ENV", "development") && configStringNotEqualsSync("NEXT_PUBLIC_REACT_GRAB", "0");
const shouldLoadVercelInsights =
  configStringEqualsSync("VERCEL", "1") && configStringEqualsSync("NEXT_PUBLIC_ENABLE_VERCEL_INSIGHTS", "1");
const oipThemeToggleScript = `
(() => {
  const oipKey = "oip-theme-mode";
  const muiModeKey = "mui-mode";
  const muiSchemeKey = "mui-color-scheme";
  const isMode = (value) => value === "light" || value === "dark";
  const getItem = (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const setItem = (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  };
  const readMode = () => {
    const storedMode = getItem(oipKey);
    if (isMode(storedMode)) return storedMode;
    const muiMode = getItem(muiModeKey);
    if (isMode(muiMode)) return muiMode;
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  };
  const syncButton = (button, mode) => {
    const isDark = mode === "dark";
    button.dataset.themeMode = mode;
    button.setAttribute("aria-label", "Switch to " + (isDark ? "light" : "dark") + " mode");
    button.setAttribute("aria-pressed", String(isDark));
  };
  const applyRootMode = (mode) => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(mode);
    document.documentElement.style.colorScheme = mode;
    setItem(oipKey, mode);
    setItem(muiModeKey, mode);
    setItem(muiSchemeKey + "-light", "light");
    setItem(muiSchemeKey + "-dark", "dark");
  };
  const syncThemeUi = () => {
    const mode = readMode();
    applyRootMode(mode);
    document.querySelectorAll("[data-oip-theme-toggle]").forEach((button) => syncButton(button, mode));
  };
  const scheduleHydratedSync = () => {
    window.setTimeout(syncThemeUi, 0);
    window.setTimeout(syncThemeUi, 250);
  };
  applyRootMode(readMode());
  const init = () => {
    scheduleHydratedSync();
    document.addEventListener("click", (event) => {
      const target = event.target;
      const button = target instanceof Element ? target.closest("[data-oip-theme-toggle]") : null;
      if (button === null) return;
      const mode = readMode() === "dark" ? "light" : "dark";
      applyRootMode(mode);
      syncButton(button, mode);
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
`;

function VercelInsights() {
  if (!shouldLoadVercelInsights) {
    return null;
  }

  const [{ Analytics }, { SpeedInsights }] = use(
    Promise.all([import("@vercel/analytics/next"), import("@vercel/speed-insights/next")])
  );

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

/**
 * Allows the nonce-bearing root layout to block on request state.
 *
 * Next.js framework config export: opts the route out of blocking-prerender
 * errors (`blocking-prerender-dynamic`). Consumed by the framework, not by
 * application imports.
 *
 * @example
 * ```ts
 * import { instant } from "@beep/oip-web/app/layout"
 *
 * console.log(instant)
 * // false
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const instant = false;

/**
 * Static metadata for the oip web app shell.
 *
 * @example
 * ```ts
 * import { metadata } from "@beep/oip-web/app/layout"
 *
 * console.log(metadata.applicationName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteMetadata.siteUrl),
  title: {
    default: siteMetadata.title,
    template: "%s | OIP",
  },
  description: siteMetadata.description,
  applicationName: "OIP - Oppold IP Law",
  authors: [{ name: "Thomas J. Oppold" }],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteMetadata.siteUrl,
    siteName: siteMetadata.siteName,
    title: siteMetadata.title,
    description: siteMetadata.description,
    locale: "en_US",
    images: [
      {
        url: siteMetadata.ogImage,
        width: 1200,
        height: 630,
        alt: "OIP - patent counsel for the people who build the machines.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteMetadata.title,
    description: siteMetadata.description,
    images: [siteMetadata.ogImage],
    creator: twitterHandle,
    site: twitterHandle,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/oip/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/oip/apple-touch-icon.png",
  },
  keywords: [
    "patent attorney",
    "intellectual property attorney",
    "agricultural equipment patent",
    "patent litigation",
    "patent prosecution",
    "Federal Circuit",
    "PTAB IPR",
    "Thomas J. Oppold",
  ],
  manifest: "/manifest.webmanifest",
  robots: {
    follow: true,
    index: true,
  },
};

/**
 * Root HTML layout for the oip web app.
 *
 * @example
 * ```tsx
 * import RootLayout from "@beep/oip-web/app/layout"
 *
 * const layout = await RootLayout({ children: <main /> })
 * console.log(layout.type)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): Promise<ReactNode> {
  return connection()
    .then(() => headers())
    .then((requestHeaders) => {
      const nonce = requestHeaders.get("x-nonce") ?? undefined;

      return (
        <html lang="en" className="h-full antialiased" suppressHydrationWarning>
          <head>
            <script
              nonce={nonce}
              suppressHydrationWarning
              // biome-ignore lint/security/noDangerouslySetInnerHtml: static theme controller without user input
              dangerouslySetInnerHTML={{ __html: oipThemeToggleScript }}
            />
            {shouldLoadReactGrab && (
              <script
                src={`https://unpkg.com/react-grab@${REACT_GRAB_VERSION}/dist/index.global.js`}
                crossOrigin="anonymous"
                integrity={REACT_GRAB_INTEGRITY}
                nonce={nonce}
                suppressHydrationWarning
              />
            )}
          </head>
          <body className="min-h-full flex flex-col">
            <OipAtomProvider>{children}</OipAtomProvider>
            <VercelInsights />
          </body>
        </html>
      );
    });
}
