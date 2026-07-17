import { decodeNextConfig, defineNextConfig } from "@beep/repo-configs/next";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import type { NextConfig as NextConfigFromNext } from "next";

describe("NextConfig", () => {
  it.effect(
    "decodes user-authored config without invoking function-valued fields",
    Effect.fnUntraced(function* () {
      let headersCalled = false;
      const headers: NonNullable<NextConfigFromNext["headers"]> = () => {
        headersCalled = true;
        return [
          {
            source: "/(.*)",
            headers: [{ key: "x-beep", value: "1" }],
          },
        ];
      };
      const input = {
        allowedDevOrigins: ["oip-web.localhost"],
        cacheComponents: true,
        headers,
        pageExtensions: ["ts", "tsx", "mdx"],
        reactStrictMode: true,
        turbopack: { root: process.cwd() },
        typedRoutes: true,
        experimental: {
          cssChunking: true,
          mcpServer: true,
        },
      } satisfies NextConfigFromNext;

      const decoded = yield* decodeNextConfig(input);

      expect(decoded.allowedDevOrigins).toEqual(["oip-web.localhost"]);
      expect(decoded.headers).toBe(headers);
      expect(headersCalled).toBe(false);
      expect(decoded.experimental?.mcpServer).toBe(true);
    })
  );

  it.effect(
    "strips unknown and internal-only Next.js fields",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeNextConfig({
        reactStrictMode: true,
        configFile: "next.config.ts",
        configOrigin: "next.config.ts",
        _originalRedirects: [],
        experimental: {
          cssChunking: true,
          isExperimentalCompile: true,
          trustHostHeader: true,
        },
      });

      expect(Reflect.has(decoded, "configFile")).toBe(false);
      expect(Reflect.has(decoded, "configOrigin")).toBe(false);
      expect(Reflect.has(decoded, "_originalRedirects")).toBe(false);
      expect(decoded.experimental?.cssChunking).toBe(true);
      expect(Reflect.has(decoded.experimental ?? {}, "isExperimentalCompile")).toBe(false);
      expect(Reflect.has(decoded.experimental ?? {}, "trustHostHeader")).toBe(false);
    })
  );

  it.effect(
    "rejects invalid literal values and documented numeric constraints",
    Effect.fnUntraced(function* () {
      const invalidCrossOrigin = yield* Effect.exit(decodeNextConfig({ crossOrigin: "credentialed" }));
      const invalidStaleTimes = yield* Effect.exit(
        decodeNextConfig({
          experimental: {
            staleTimes: {
              static: 10,
            },
          },
        })
      );

      expect(Exit.isFailure(invalidCrossOrigin)).toBe(true);
      expect(Exit.isFailure(invalidStaleTimes)).toBe(true);
    })
  );

  it("defines a sync validated Next.js config", () => {
    const config = defineNextConfig({
      pageExtensions: ["ts", "tsx"],
      poweredByHeader: false,
      reactCompiler: true,
    } satisfies NextConfigFromNext);

    expect(config.pageExtensions).toEqual(["ts", "tsx"]);
    expect(config.poweredByHeader).toBe(false);
    expect(() => defineNextConfig({ crossOrigin: "credentialed" })).toThrow();
  });
});
