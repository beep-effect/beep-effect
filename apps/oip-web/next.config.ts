import { fileURLToPath } from "node:url";
import { defineBeepNextConfig } from "@beep/repo-configs/next";
import { oipRedirects } from "./src/config/OipRedirects.ts";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), screen-wake-lock=(), usb=(), xr-spatial-tracking=()",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
  {
    key: "Origin-Agent-Cluster",
    value: "?1",
  },
];

export default defineBeepNextConfig({
  repoRoot,
  allowedDevOrigins: ["oip-web.localhost", "dankstation.tailc7c348.ts.net"],
  additionalTranspilePackages: ["@beep/hubspot", "@beep/sanity"],
  next: {
    images: {
      qualities: [50, 60, 75],
    },
    redirects: () => Promise.resolve(oipRedirects()),
    // The production/PWA build uses webpack (`build:pwa`), which cannot bundle
    // `node:*` builtins that leak into the client graph via @beep/schema ->
    // @beep/utils (NodeUrl/Path). Those helpers are server-only and never run on
    // the client, so for the client bundle we strip the `node:` scheme and stub
    // the builtins to an empty module. Turbopack (`build`) resolves these
    // natively and ignores this hook.
    webpack: (config, { isServer, webpack }) => {
      if (!isServer) {
        config.plugins = config.plugins ?? [];
        config.plugins.push(
          new webpack.NormalModuleReplacementPlugin(/^node:/u, (resource: { request: string }) => {
            resource.request = resource.request.replace(/^node:/u, "");
          })
        );
        config.resolve = config.resolve ?? {};
        config.resolve.fallback = {
          ...config.resolve.fallback,
          fs: false,
          module: false,
          path: false,
          url: false,
        };
      }
      return config;
    },
  },
  securityHeaders: {
    headers: securityHeaders,
  },
  pwa: {
    swSrc: "src/app/sw.ts",
    swDest: "public/sw.js",
  },
  env: process.env,
});
