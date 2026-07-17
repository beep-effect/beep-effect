/**
 * Request proxy for dynamic OIP response security.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { randomUUID } from "node:crypto";
import { A } from "@beep/utils";
import { Config, Effect, pipe } from "effect";
import * as O from "effect/Option";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const configStringOptionSync = (name: string): O.Option<string> => Effect.runSync(Config.option(Config.string(name)));
const configStringEqualsSync = (name: string, expected: string): boolean =>
  pipe(
    configStringOptionSync(name),
    O.exists((value) => value === expected)
  );
const isDevelopment = !configStringEqualsSync("NODE_ENV", "production");
const developmentScriptSources = isDevelopment ? " 'unsafe-eval' https://unpkg.com" : "";
const developmentStyleSources = isDevelopment ? " https://fonts.googleapis.com" : "";
const developmentFontSources = isDevelopment ? " https://fonts.gstatic.com" : "";
const developmentConnectSources = isDevelopment
  ? " http://localhost:* https://*.localhost:* ws: wss: https://react-grab.com https://www.react-grab.com"
  : "";
const vercelLiveSource = " https://vercel.live";

const buildCspHeader = (nonce: string): string =>
  A.join(
    [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'${developmentScriptSources}`,
      `script-src-elem 'self' 'nonce-${nonce}'${vercelLiveSource}${developmentScriptSources}`,
      "style-src 'self' 'unsafe-inline'",
      `style-src-elem 'self' 'unsafe-inline'${developmentStyleSources}`,
      "style-src-attr 'unsafe-inline'",
      `img-src 'self' data: blob:${vercelLiveSource}`,
      `font-src 'self' data:${developmentFontSources}`,
      "media-src 'self'",
      `connect-src 'self' https://vitals.vercel-insights.com https://*.vercel-insights.com${vercelLiveSource} https://api.sanity.io https://*.api.sanity.io https://*.apicdn.sanity.io https://api.hsforms.com https://forms.hsforms.com https://api.hubapi.com${developmentConnectSources}`,
      "manifest-src 'self'",
      "worker-src 'self' blob:",
      "base-uri 'self'",
      "form-action 'self'",
      `frame-src${vercelLiveSource}`,
      "frame-ancestors 'none'",
      "object-src 'none'",
      ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
    ],
    "; "
  );

const withCsp = (cspHeader: string) => (response: NextResponse) => {
  response.headers.set("Content-Security-Policy", cspHeader);
  return response;
};

/**
 * Adds a per-request CSP nonce to OIP document responses.
 *
 * @example
 * ```ts
 * import type { NextRequest, NextResponse } from "next/server"
 * import { proxy } from "@beep/oip-web/proxy"
 *
 * const handler: (request: NextRequest) => NextResponse = proxy
 * console.log(typeof handler)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export function proxy(request: NextRequest): NextResponse {
  const nonce = btoa(randomUUID());
  const cspHeader = buildCspHeader(nonce);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("Content-Security-Policy", cspHeader);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-url", request.url);

  return withCsp(cspHeader)(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  );
}

/**
 * Route matcher for the OIP CSP proxy.
 *
 * @example
 * ```ts
 * import { config } from "@beep/oip-web/proxy"
 *
 * console.log(config.matcher[0]?.source)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|workbox-.*|oip/.*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
