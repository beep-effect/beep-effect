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
import { fcRuns } from "@beep/test-utils";
import { Effect, Exit, Result } from "effect";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import { describe, expect, it } from "vitest";

const decodeUnknownImageConfigComplete = S.decodeUnknownEffect(ImageConfigComplete);
const decodeUnknownRedirect = S.decodeUnknownEffect(Redirect);
const decodeUnknownRouteHas = S.decodeUnknownEffect(RouteHas);

const decodeRewrite = S.decodeUnknownEffect(Rewrite);
const decodeHeader = S.decodeUnknownEffect(Header);
const decodeMiddleware = S.decodeUnknownEffect(Middleware);
const decodeLoggingConfig = S.decodeUnknownEffect(LoggingConfig);
const decodeSassOptions = S.decodeUnknownEffect(SassOptions);

const exit = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(Effect.exit(effect));

const expectRoundTrip = <Schema extends S.Top & S.ConstraintEncoder<unknown> & S.ConstraintDecoder<unknown>>(
  schema: Schema,
  value: Schema["Type"]
) => {
  const encoded = Result.getOrThrow(S.encodeResult(schema)(value));
  const decoded = Result.getOrThrow(S.decodeUnknownResult(schema)(encoded));

  expect(Equal.equals(decoded, value)).toBe(true);
};

describe("Next shared schemas", () => {
  it("accepts Next.js file size suffixes and size limits", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        expect(FileSizeSuffix.decodeUnknownSync("kb")).toBe("kb");
        expect(FileSizeSuffix.decodeUnknownSync("MB")).toBe("MB");
        expect(SizeLimit.decodeUnknownSync(1024)).toBe(1024);
        expect(SizeLimit.decodeUnknownSync("1.5gb")).toBe("1.5gb");
      })
    ));

  it("rejects malformed size suffixes and size limit strings", () => {
    expect(O.isNone(FileSizeSuffix.decodeUnknownOption("xb"))).toBe(true);
    expect(O.isNone(FileSizeSuffix.decodeUnknownOption("mbps"))).toBe(true);
    expect(O.isNone(SizeLimit.decodeUnknownOption(-1))).toBe(true);
    expect(O.isNone(SizeLimit.decodeUnknownOption("-2KB"))).toBe(true);
    expect(O.isNone(SizeLimit.decodeUnknownOption("1"))).toBe(true);
    expect(O.isNone(SizeLimit.decodeUnknownOption("1xb"))).toBe(true);
    expect(O.isNone(SizeLimit.decodeUnknownOption("mb"))).toBe(true);
  });

  it("round-trips schema-derived primitive values", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([Arbitrary.schema(FileSizeSuffix)]),
          ([value]) => {
            expectRoundTrip(FileSizeSuffix, value);
            return true;
          },
          fcRuns(25)
        )
      )._tag
    ).toBe("Passed");
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([Arbitrary.schema(SizeLimit)]),
          ([value]) => {
            expectRoundTrip(SizeLimit, value);
            return true;
          },
          fcRuns(25)
        )
      )._tag
    ).toBe("Passed");
  });
});

describe("Next route schemas", () => {
  const routeHasArbitrary = Arbitrary.schema(RouteHas);

  it("accepts route predicates and public route config shapes", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        expect(RouteHas.decodeUnknownSync({ type: "header", key: "x-beep", value: "1" })).toEqual({
          type: "header",
          key: "x-beep",
          value: "1",
        });
        expect(RouteHas.decodeUnknownSync({ type: "host", value: "example.com" })).toEqual({
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
        expect(Redirect.decodeUnknownSync({ source: "/old", destination: "/new", permanent: true })).toEqual({
          source: "/old",
          destination: "/new",
          permanent: true,
        });
        expect(Redirect.decodeUnknownSync({ source: "/old", destination: "/new", statusCode: 307 })).toEqual({
          source: "/old",
          destination: "/new",
          statusCode: 307,
        });
        expect(yield* decodeMiddleware({ source: "/admin/:path*", locale: false })).toEqual({
          source: "/admin/:path*",
          locale: false,
        });
      })
    ));

  it("decodes schema-derived route predicates", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([routeHasArbitrary]),
          ([predicate]) => {
            const decoded = RouteHas.decodeUnknownSync(predicate);

            expect(decoded).toEqual(predicate);

            return true;
          },
          fcRuns(25)
        )
      )._tag
    ).toBe("Passed");
  });

  it("round-trips redirect status-code values", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([Arbitrary.schema(RedirectStatusCodeValue)]),
          ([value]) => {
            expectRoundTrip(RedirectStatusCodeValue, value);
            return true;
          },
          fcRuns(25)
        )
      )._tag
    ).toBe("Passed");
  });

  it("round-trips route object schemas that do not contain never fields", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([Arbitrary.schema(Rewrite)]),
          ([value]) => {
            expectRoundTrip(Rewrite, value);
            return true;
          },
          fcRuns(25)
        )
      )._tag
    ).toBe("Passed");
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([Arbitrary.schema(Header)]),
          ([value]) => {
            expectRoundTrip(Header, value);
            return true;
          },
          fcRuns(25)
        )
      )._tag
    ).toBe("Passed");
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([Arbitrary.schema(Middleware)]),
          ([value]) => {
            expectRoundTrip(Middleware, value);
            return true;
          },
          fcRuns(25)
        )
      )._tag
    ).toBe("Passed");
  });

  it("rejects invalid route discriminators and redirect mode mixing", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        expect(
          Exit.isFailure(
            yield* Effect.promise(() =>
              Promise.resolve(exit(decodeUnknownRouteHas({ type: "host", key: "host", value: "example.com" })))
            )
          )
        ).toBe(true);
        expect(
          Exit.isFailure(
            yield* Effect.promise(() =>
              Promise.resolve(exit(decodeRewrite({ source: "/old", destination: "/new", basePath: true })))
            )
          )
        ).toBe(true);
        expect(
          Exit.isFailure(
            yield* Effect.promise(() =>
              Promise.resolve(
                exit(
                  decodeUnknownRedirect({
                    source: "/old",
                    destination: "/new",
                    permanent: true,
                    statusCode: 308,
                  })
                )
              )
            )
          )
        ).toBe(true);
      })
    ));
});

describe("Next image schemas", () => {
  it("round-trips schema-derived complete image configs", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([Arbitrary.schema(ImageConfigComplete)]),
          ([value]) => {
            expectRoundTrip(ImageConfigComplete, value);
            return true;
          },
          fcRuns(25)
        )
      )._tag
    ).toBe("Passed");
  });

  it("round-trips schema-derived partial image configs", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([Arbitrary.schema(ImageConfig)]),
          ([value]) => {
            expectRoundTrip(ImageConfig, value);
            return true;
          },
          fcRuns(25)
        )
      )._tag
    ).toBe("Passed");
  });

  it("rejects out-of-domain image quality values", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        expect(
          Exit.isFailure(
            yield* Effect.promise(() =>
              Promise.resolve(
                exit(
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
            )
          )
        ).toBe(true);
      })
    ));
});

describe("Next config primitive schemas", () => {
  it("accepts logging config with empty incoming request options", () =>
    Effect.runPromise(
      Effect.promise(() =>
        Promise.resolve(
          expect(Effect.runPromise(decodeLoggingConfig({ incomingRequests: {} }))).resolves.toEqual({
            incomingRequests: {},
          })
        )
      )
    ));
});

describe("Next compiler schemas", () => {
  it("accepts Sass options with implementation and package-specific passthrough keys", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const options = {
          implementation: "sass",
          silenceDeprecations: ["legacy-js-api"],
        };
        expect(yield* decodeSassOptions(options)).toEqual(options);
      })
    ));

  it("rejects non-object Sass options and non-string implementations", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        expect(Exit.isFailure(yield* Effect.promise(() => Promise.resolve(exit(decodeSassOptions(["sass"])))))).toBe(
          true
        );
        expect(
          Exit.isFailure(
            yield* Effect.promise(() => Promise.resolve(exit(decodeSassOptions({ implementation: false }))))
          )
        ).toBe(true);
      })
    ));
});
