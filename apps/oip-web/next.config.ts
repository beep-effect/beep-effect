import * as NodeURL from "node:url";
import { defineBeepNextConfig } from "@beep/repo-configs/next";
import * as Str from "effect/String";
import { oipRedirects } from "./src/config/OipRedirects.ts";

const repoRoot = NodeURL.fileURLToPath(new URL("../..", import.meta.url));

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

const nextConfig = defineBeepNextConfig({
  repoRoot,
  allowedDevOrigins: ["oip-web.beep.localhost", "dankstation.tailc7c348.ts.net"],
  additionalTranspilePackages: ["@beep/hubspot", "@beep/sanity"],
  next: {
    experimental: { useTypeScriptCli: true },
    images: {
      qualities: [50, 60, 75],
    },
    redirects: () => Promise.resolve(oipRedirects()),
    // decision: browser-node-builtin-stubs
    webpack: (config, { isServer, webpack }) => {
      if (!isServer) {
        config.plugins = config.plugins ?? [];
        config.plugins.push(
          new webpack.NormalModuleReplacementPlugin(/^node:/u, (resource: { request: string }) => {
            resource.request = Str.replace(/^node:/u, "")(resource.request);
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

export default nextConfig;
