import {
  FileSizeSuffix,
  Header,
  ImageConfig,
  ImageConfigComplete,
  LoggingConfig,
  Middleware,
  Redirect,
  RedirectStatusCodeValue,
  Rewrite,
  RouteHas,
  SassOptions,
  SizeLimit,
} from "@beep/repo-configs/next";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import { Effect, Exit, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Equal from "effect/Equal";
import * as S from "effect/Schema";

const decodeUnknownImageConfigComplete = S.decodeUnknownEffect(ImageConfigComplete);
const decodeUnknownRedirect = S.decodeUnknownEffect(Redirect);
const decodeUnknownRouteHas = S.decodeUnknownEffect(RouteHas);

const decodeRewrite = S.decodeUnknownEffect(Rewrite);
const decodeHeader = S.decodeUnknownEffect(Header);
const decodeMiddleware = S.decodeUnknownEffect(Middleware);
const decodeLoggingConfig = S.decodeUnknownEffect(LoggingConfig);
const decodeSassOptions = S.decodeUnknownEffect(SassOptions);

const expectRoundTrip = <Schema extends S.Top & S.ConstraintEncoder<unknown> & S.ConstraintDecoder<unknown>>(
  schema: Schema,
  value: Schema["Type"]
) => {
  const encoded = Result.getOrThrow(S.encodeResult(schema)(value));
  const decoded = Result.getOrThrow(S.decodeUnknownResult(schema)(encoded));

  assertTrue(Equal.equals(decoded, value));
};

describe("Next shared schemas", () => {
  it("accepts Next.js file size suffixes and size limits", () => {
    expect(Result.getOrThrow(S.decodeResult(FileSizeSuffix)("kb"))).toBe("kb");
    expect(Result.getOrThrow(S.decodeResult(FileSizeSuffix)("MB"))).toBe("MB");
    expect(Result.getOrThrow(S.decodeResult(SizeLimit)(1024))).toBe(1024);
    expect(Result.getOrThrow(S.decodeResult(SizeLimit)("1.5gb"))).toBe("1.5gb");
  });

  it("rejects malformed size suffixes and size limit strings", () => {
    assertNone(S.decodeUnknownOption(FileSizeSuffix)("xb"));
    assertNone(S.decodeUnknownOption(FileSizeSuffix)("mbps"));
    assertNone(S.decodeOption(SizeLimit)(-1));
    assertNone(S.decodeOption(SizeLimit)("-2KB"));
    assertNone(S.decodeUnknownOption(SizeLimit)("1"));
    assertNone(S.decodeUnknownOption(SizeLimit)("1xb"));
    assertNone(S.decodeUnknownOption(SizeLimit)("mb"));
  });

  it.prop(
    "FileSizeSuffix: round-trips schema-derived primitive values",
    [Arbitrary.schema(FileSizeSuffix)],
    ([value]) => {
      expectRoundTrip(FileSizeSuffix, value);
    },
    { arbitrary: fcRuns(25) }
  );

  it.prop(
    "SizeLimit: round-trips schema-derived primitive values",
    [Arbitrary.schema(SizeLimit)],
    ([value]) => {
      expectRoundTrip(SizeLimit, value);
    },
    { arbitrary: fcRuns(25) }
  );
});

describe("Next route schemas", () => {
  const routeHasArbitrary = Arbitrary.schema(RouteHas);

  it.effect("accepts route predicates and public route config shapes", () =>
    Effect.gen(function* () {
      expect(Result.getOrThrow(S.decodeResult(RouteHas)({ type: "header", key: "x-beep", value: "1" }))).toEqual({
        type: "header",
        key: "x-beep",
        value: "1",
      });
      expect(Result.getOrThrow(S.decodeResult(RouteHas)({ type: "host", value: "example.com" }))).toEqual({
        type: "host",
        value: "example.com",
      });
      expect(
        yield* decodeRewrite({
          source: "/old",
          destination: "/new",
          has: [{ type: "query", key: "draft" }],
          internal: true,
          regex: "^/old$",
        })
      ).toEqual({
        source: "/old",
        destination: "/new",
        has: [{ type: "query", key: "draft" }],
      });
      expect(
        yield* decodeHeader({
          source: "/secure",
          headers: [{ key: "x-frame-options", value: "deny" }],
          internal: true,
        })
      ).toEqual({
        source: "/secure",
        headers: [{ key: "x-frame-options", value: "deny" }],
      });
      expect(
        Result.getOrThrow(S.decodeResult(Redirect)({ source: "/old", destination: "/new", permanent: true }))
      ).toEqual({
        source: "/old",
        destination: "/new",
        permanent: true,
      });
      expect(
        Result.getOrThrow(S.decodeResult(Redirect)({ source: "/old", destination: "/new", statusCode: 307 }))
      ).toEqual({
        source: "/old",
        destination: "/new",
        statusCode: 307,
      });
      expect(yield* decodeMiddleware({ source: "/admin/:path*", locale: false })).toEqual({
        source: "/admin/:path*",
        locale: false,
      });
    })
  );

  it.prop(
    "RouteHas: decodes schema-derived route predicates",
    [routeHasArbitrary],
    ([predicate]) => {
      const decoded = Result.getOrThrow(S.decodeResult(RouteHas)(predicate));
      expect(decoded).toEqual(predicate);
    },
    { arbitrary: fcRuns(25) }
  );

  it.prop(
    "RedirectStatusCodeValue: round-trips redirect status-code values",
    [Arbitrary.schema(RedirectStatusCodeValue)],
    ([value]) => {
      expectRoundTrip(RedirectStatusCodeValue, value);
    },
    { arbitrary: fcRuns(25) }
  );

  it.prop(
    "Rewrite: round-trips route object schemas that do not contain never fields",
    [Arbitrary.schema(Rewrite)],
    ([value]) => {
      expectRoundTrip(Rewrite, value);
    },
    { arbitrary: fcRuns(25) }
  );

  it.prop(
    "Header: round-trips route object schemas that do not contain never fields",
    [Arbitrary.schema(Header)],
    ([value]) => {
      expectRoundTrip(Header, value);
    },
    { arbitrary: fcRuns(25) }
  );

  it.prop(
    "Middleware: round-trips route object schemas that do not contain never fields",
    [Arbitrary.schema(Middleware)],
    ([value]) => {
      expectRoundTrip(Middleware, value);
    },
    { arbitrary: fcRuns(25) }
  );

  it.effect("rejects invalid route discriminators and redirect mode mixing", () =>
    Effect.gen(function* () {
      assertTrue(
        Exit.isFailure(yield* Effect.exit(decodeUnknownRouteHas({ type: "host", key: "host", value: "example.com" })))
      );
      assertTrue(
        Exit.isFailure(yield* Effect.exit(decodeRewrite({ source: "/old", destination: "/new", basePath: true })))
      );
      assertTrue(
        Exit.isFailure(
          yield* Effect.exit(
            decodeUnknownRedirect({
              source: "/old",
              destination: "/new",
              permanent: true,
              statusCode: 308,
            })
          )
        )
      );
    })
  );
});

describe("Next image schemas", () => {
  it.prop(
    "ImageConfigComplete: round-trips schema-derived complete image configs",
    [Arbitrary.schema(ImageConfigComplete)],
    ([value]) => {
      expectRoundTrip(ImageConfigComplete, value);
    },
    { arbitrary: fcRuns(25) }
  );

  it.prop(
    "ImageConfig: round-trips schema-derived partial image configs",
    [Arbitrary.schema(ImageConfig)],
    ([value]) => {
      expectRoundTrip(ImageConfig, value);
    },
    { arbitrary: fcRuns(25) }
  );

  it.effect("rejects out-of-domain image quality values", () =>
    Effect.gen(function* () {
      assertTrue(
        Exit.isFailure(
          yield* Effect.exit(
            decodeUnknownImageConfigComplete({
              deviceSizes: [640],
              imageSizes: [32],
              loader: "default",
              path: "/_next/image",
              loaderFile: "",
              disableStaticImages: false,
              minimumCacheTTL: 0,
              formats: ["image/webp"],
              maximumDiskCacheSize: undefined,
              maximumRedirects: 0,
              maximumResponseBody: 0,
              dangerouslyAllowLocalIP: false,
              dangerouslyAllowSVG: false,
              contentSecurityPolicy: "",
              contentDispositionType: "attachment",
              localPatterns: undefined,
              remotePatterns: [],
              qualities: [101],
              unoptimized: false,
              customCacheHandler: false,
            })
          )
        )
      );
    })
  );
});

describe("Next config primitive schemas", () => {
  it.effect("accepts logging config with empty incoming request options", () =>
    Effect.gen(function* () {
      expect(yield* decodeLoggingConfig({ incomingRequests: {} })).toEqual({
        incomingRequests: {},
      });
    })
  );
});

describe("Next compiler schemas", () => {
  it.effect("accepts Sass options with implementation and package-specific passthrough keys", () =>
    Effect.gen(function* () {
      const options = {
        implementation: "sass",
        silenceDeprecations: ["legacy-js-api"],
      };
      expect(yield* decodeSassOptions(options)).toEqual(options);
    })
  );

  it.effect("rejects non-object Sass options and non-string implementations", () =>
    Effect.gen(function* () {
      assertTrue(Exit.isFailure(yield* Effect.exit(decodeSassOptions(["sass"]))));
      assertTrue(Exit.isFailure(yield* Effect.exit(decodeSassOptions({ implementation: false }))));
    })
  );
});
