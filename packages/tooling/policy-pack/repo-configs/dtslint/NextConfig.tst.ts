import { defineBeepNextConfig, defineNextConfig } from "@beep/repo-configs/next";
import { describe, expect, it } from "tstyche";
import type { BeepNextConfigOptionsInput, NextConfig, NextConfig as NextConfigSchema } from "@beep/repo-configs/next";
import type { NextConfig as NextConfigFromNext, SizeLimit } from "next";

describe("NextConfig", () => {
  it("derives a model assignable to next.NextConfig", () => {
    expect<NextConfig>().type.toBeAssignableTo<NextConfigFromNext>();
    expect<NextConfigSchema>().type.toBeAssignableTo<NextConfigFromNext>();
  });

  it("accepts representative public Next.js config values", () => {
    const config = defineNextConfig({
      allowedDevOrigins: ["oip-web.localhost"],
      cacheComponents: true,
      headers: () => [
        {
          source: "/(.*)",
          headers: [{ key: "x-beep", value: "1" }],
        },
      ],
      pageExtensions: ["ts", "tsx", "mdx"],
      reactStrictMode: true,
      transpilePackages: ["@beep/ui"],
      turbopack: {
        rules: {
          "*.txt": {
            type: "text",
          },
        },
      },
      typedRoutes: true,
      experimental: {
        cssChunking: "strict",
        mcpServer: true,
        serverActions: {
          bodySizeLimit: "2mb",
        },
      },
    } satisfies NextConfigFromNext);

    expect(config).type.toBeAssignableTo<NextConfigFromNext>();
    expect(config.experimental?.serverActions?.bodySizeLimit).type.toBeAssignableTo<SizeLimit | undefined>();
  });

  it("defines the shared repo-owned Next.js config preset", () => {
    const options = {
      repoRoot: "/repo",
      allowedDevOrigins: ["oip-web.localhost"],
      env: { ANALYZE: "1", NEXT_DISABLE_PWA: "1" },
      additionalTranspilePackages: ["@beep/shared-domain"],
      next: {
        reactStrictMode: true,
      },
    } satisfies BeepNextConfigOptionsInput;

    const config = defineBeepNextConfig(options);

    expect(config).type.toBeAssignableTo<NextConfigFromNext>();
  });
});
