/**
 * Home route for the OIP public website.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, Str } from "@beep/utils";
import { Clock, Effect } from "effect";
import * as S from "effect/Schema";
import { headers } from "next/headers";
import { connection } from "next/server";
import { ContactSubmissionStatus } from "@/contact";
import { getOipSiteContent, makeJsonLdGraph, oipTwitterHandle } from "@/content";
import { OipHomePage } from "../components/OipHomePage";
import type { Metadata } from "next";

type HomeProps = {
  readonly searchParams?: Promise<Record<string, ReadonlyArray<string> | string | undefined>>;
};

// TODO(effect-native-migration): model schema
const safeJsonScript = (value: unknown) =>
  Str.replaceAll("<", "\\u003c")(S.encodeUnknownSync(S.UnknownFromJsonString)(value));

/**
 * Allows the search-param aware home route to block during the first render.
 *
 * Next.js framework config export: opts the route out of blocking-prerender
 * errors (`blocking-prerender-dynamic`). Consumed by the framework, not by
 * application imports.
 *
 * @example
 * ```ts
 * import { instant } from "@beep/oip-web/app/page"
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
 * Generates page metadata from runtime OIP content.
 *
 * @example
 * ```ts
 * import { generateMetadata } from "@beep/oip-web/app/page"
 *
 * const metadata = await generateMetadata()
 * console.log(metadata.title)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export function generateMetadata(): Promise<Metadata> {
  return connection()
    .then(() => getOipSiteContent())
    .then((content) => ({
      title: content.metadata.title,
      description: content.metadata.description,
      alternates: {
        canonical: "/",
      },
      openGraph: {
        type: "website",
        url: content.metadata.siteUrl,
        siteName: content.metadata.siteName,
        title: content.metadata.title,
        description: content.metadata.description,
        locale: "en_US",
        images: [
          {
            url: content.metadata.ogImage,
            width: 1200,
            height: 630,
            alt: "OIP - patent counsel for the people who build the machines.",
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: content.metadata.title,
        description: content.metadata.description,
        images: [content.metadata.ogImage],
        creator: oipTwitterHandle(content),
        site: oipTwitterHandle(content),
      },
    }));
}

/**
 * Renders the OIP public home page.
 *
 * @example
 * ```tsx
 * import Home from "@beep/oip-web/app/page"
 *
 * const page = await Home({})
 * console.log(page.type)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export default function Home({ searchParams }: HomeProps) {
  return connection()
    .then(() => Promise.all([searchParams, headers(), getOipSiteContent()]))
    .then(([params, requestHeaders, content]) => {
      const nonce = requestHeaders.get("x-nonce") ?? undefined;
      const contactStatusValue = A.isArray(params?.contact) ? params.contact[0] : params?.contact;
      const contactStatus = O.getOrUndefined(ContactSubmissionStatus.decodeOption(contactStatusValue));
      const initialContactSubmittedAt = Effect.runSync(Clock.currentTimeMillis);

      return (
        <>
          <script
            id="oip-json-ld"
            nonce={nonce}
            suppressHydrationWarning
            type="application/ld+json"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is generated server-side and escaped before injection.
            dangerouslySetInnerHTML={{ __html: safeJsonScript(makeJsonLdGraph(content)) }}
          />
          <OipHomePage
            contactStatus={contactStatus}
            content={content}
            initialContactSubmittedAt={initialContactSubmittedAt}
          />
        </>
      );
    });
}
