import {
  BeepNextMdxConfig,
  BeepNextPwaConfig,
  composeNextConfig,
  DEFAULT_BEEP_SECURE_HEADERS,
  decodeBeepNextConfigEnv,
  defineBeepNextConfig,
  makeBeepNextBaseConfig,
  makeSecureHeaders,
  SecureHeadersConfig,
} from "@beep/repo-configs/next";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as Equal from "effect/Equal";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { NextConfig } from "next";

const expectRoundTrip = <Schema extends S.Top & S.ConstraintEncoder<unknown> & S.ConstraintDecoder<unknown>>(
  schema: Schema,
  value: Schema["Type"]
) => {
  const encoded = Result.getOrThrow(S.encodeResult(schema)(value));
  const decoded = Result.getOrThrow(S.decodeUnknownResult(schema)(encoded));

  expect(Equal.equals(decoded, value)).toBe(true);
};

describe("Shared Next.js config preset", () => {
  it.effect(
    "decodes only the env toggles owned by the shared preset",
    Effect.fnUntraced(function* () {
      const env = yield* decodeBeepNextConfigEnv({
        ANALYZE: "1",
        NEXT_DISABLE_PWA: "0",
        OTHER_VALUE: "ignored",
      });

      expect(env).toEqual({
        ANALYZE: "1",
        NEXT_DISABLE_PWA: "0",
      });
      expect(Reflect.has(env, "OTHER_VALUE")).toBe(false);
    })
  );

  it("builds the current shared base config with additive app overrides", () => {
    const config = makeBeepNextBaseConfig({
      repoRoot: "/repo",
      allowedDevOrigins: ["oip-web.localhost"],
      additionalPageExtensions: ["mdoc"],
      additionalTranspilePackages: ["@beep/shared-domain"],
      additionalOptimizePackageImports: ["@beep/ui"],
      next: {
        pageExtensions: ["tsx", "story.tsx"],
        transpilePackages: ["@beep/ui"],
        experimental: {
          optimizePackageImports: ["@mui/material"],
        },
      },
    });

    expect(config.allowedDevOrigins).toEqual(["oip-web.localhost"]);
    expect(config.pageExtensions).toEqual(["ts", "tsx", "md", "mdx", "mdoc", "story.tsx"]);
    expect(config.transpilePackages).toEqual([
      "@beep/ui",
      "@beep/identity",
      "@beep/schema",
      "@beep/utils",
      "@beep/shared-domain",
    ]);
    expect(config.experimental?.optimizePackageImports).toContain("@base-ui/react");
    expect(config.experimental?.optimizePackageImports).toContain("@mui/material");
    expect(config.agentRules).toBe(false);
    expect(config.turbopack?.root).toBe("/repo");
    expect(config.typescript?.tsconfigPath).toBe("tsconfig.next.json");
    expect(Object.getOwnPropertyNames(config.experimental ?? {})).not.toContain("pipe");
    expect(Object.getOwnPropertyNames(config.typescript ?? {})).not.toContain("pipe");
  });

  it("keeps omitted repo-owned list options byte-equivalent to explicit empty lists", () => {
    const omitted = makeBeepNextBaseConfig({
      repoRoot: "/repo",
      allowedDevOrigins: ["oip-web.localhost"],
    });
    const explicitEmpty = makeBeepNextBaseConfig({
      repoRoot: "/repo",
      allowedDevOrigins: ["oip-web.localhost"],
      additionalPageExtensions: [],
      additionalTranspilePackages: [],
      additionalOptimizePackageImports: [],
    });

    expect(omitted).toEqual(explicitEmpty);
  });

  it("adds secure headers without invoking app headers during construction", () =>
    Effect.gen(function* () {
      let headersCalled = false;
      const config = defineBeepNextConfig({
        repoRoot: "/repo",
        allowedDevOrigins: ["oip-web.localhost"],
        mdx: false,
        pwa: false,
        bundleAnalyzer: false,
        next: {
          headers() {
            headersCalled = true;
            return Promise.resolve([
              {
                source: "/custom",
                headers: [{ key: "X-App", value: "1" }],
              },
            ]);
          },
        },
      });

      expect(headersCalled).toBe(false);
      const headers = yield* Effect.promise(() => Promise.resolve(config.headers?.()));

      expect(headersCalled).toBe(true);
      expect(headers?.[0]?.source).toBe("/(.*)");
      expect(headers?.[0]?.headers).toContainEqual({
        key: "X-Content-Type-Options",
        value: "nosniff",
      });
      expect(headers?.[1]).toEqual({
        source: "/custom",
        headers: [{ key: "X-App", value: "1" }],
      });
    }));

  it("can disable every shared feature wrapper explicitly", () => {
    const config = defineBeepNextConfig({
      repoRoot: "/repo",
      allowedDevOrigins: ["oip-web.localhost"],
      securityHeaders: false,
      mdx: false,
      pwa: false,
      bundleAnalyzer: false,
    });

    expect(config.headers).toBeUndefined();
    expect(config.webpack).toBeUndefined();
  });

  it("applies secure-header object defaults through the schema", () => {
    const config = Result.getOrThrow(S.decodeUnknownResult(SecureHeadersConfig)({}));

    expect(makeSecureHeaders(config)).toEqual(DEFAULT_BEEP_SECURE_HEADERS);
  });

  it("round-trips defaulted shared feature schemas", () => {
    fc.assert(
      fc.property(S.toArbitrary(BeepNextMdxConfig), (value) => expectRoundTrip(BeepNextMdxConfig, value)),
      {
        numRuns: 25,
      }
    );
    fc.assert(
      fc.property(S.toArbitrary(BeepNextPwaConfig), (value) => expectRoundTrip(BeepNextPwaConfig, value)),
      {
        numRuns: 25,
      }
    );
    fc.assert(
      fc.property(S.toArbitrary(SecureHeadersConfig), (value) => expectRoundTrip(SecureHeadersConfig, value)),
      {
        numRuns: 25,
      }
    );
  });

  it("composes plugin helpers in explicit left-to-right order", () => {
    let events: ReadonlyArray<string> = A.empty();
    const makePlugin =
      (name: string) =>
      (config: NextConfig): NextConfig => {
        events = A.append(events, name);
        return config;
      };

    const config = composeNextConfig({}, [makePlugin("mdx"), makePlugin("pwa"), makePlugin("analyzer")]);

    expect(config).toEqual({});
    expect(events).toEqual(["mdx", "pwa", "analyzer"]);
  });

  it("supports data-last composition for pipeline use", () => {
    const config = composeNextConfig([
      (current) => ({
        ...current,
        poweredByHeader: false,
      }),
    ])({ reactStrictMode: true });

    expect(config).toEqual({
      poweredByHeader: false,
      reactStrictMode: true,
    });
  });
});
