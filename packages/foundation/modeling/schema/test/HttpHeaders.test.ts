import { fcRuns } from "@beep/fc-runs";
import {
  CrossOriginEmbedderPolicyHeader,
  CrossOriginEmbedderPolicyOption,
} from "@beep/schema/CrossOriginEmbedderPolicy";
import { CrossOriginOpenerPolicyHeader, CrossOriginOpenerPolicyOption } from "@beep/schema/CrossOriginOpenerPolicy";
import {
  CrossOriginResourcePolicyHeader,
  CrossOriginResourcePolicyOption,
} from "@beep/schema/CrossOriginResourcePolicy";
import {
  ContentSecurityPolicyHeader,
  createContentSecurityPolicyOptionHeaderValue,
  createDirectiveValue,
  DocumentDirective,
  FetchDirective,
  getProperHeaderName,
  NavigationDirective,
  ReportingDirective,
} from "@beep/schema/Csp";
import { ExpectCTHeader } from "@beep/schema/ExpectCt";
import { ForceHttpsRedirectHeader } from "@beep/schema/ForceHttpsRedirect";
import { FrameGuardHeader } from "@beep/schema/FrameGuard";
import { NoOpenHeader } from "@beep/schema/NoOpen";
import { NoSniffHeader } from "@beep/schema/NoSniff";
import { PermissionsPolicyHeader } from "@beep/schema/PermissionsPolicy";
import { PermittedCrossDomainPoliciesHeader } from "@beep/schema/PermittedCrossDomainPolicies";
import { ReferrerPolicyHeader } from "@beep/schema/ReferrerPolicy";
import { createHeadersObject, createSecureHeaders, SecureHeaderOptions } from "@beep/schema/SecureHeaderOptions";
import { XSSProtectionHeader } from "@beep/schema/XssProtection";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { ContentSecurityPolicyOption } from "@beep/schema/Csp";

type HeaderLike = {
  readonly name: string;
  readonly value: O.Option<string>;
};

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect.pipe(Effect.orDie));
const runExit = <A, E>(effect: Effect.Effect<A, E>) => Effect.runSyncExit(effect.pipe(Effect.orDie));

const expectHeader = (header: HeaderLike, name: string, value: string | undefined) => {
  expect(header.name).toBe(name);
  expect(O.getOrUndefined(header.value)).toBe(value);
};

const expectSomeHeader = (header: O.Option<HeaderLike>, name: string, value: string) => {
  expect(O.isSome(header)).toBe(true);

  if (O.isSome(header)) {
    expectHeader(header.value, name, value);
  }
};

type CrossOriginCase = {
  readonly label: string;
  readonly headerName: string;
  readonly validValue: string;
  readonly optionArbitrary: fc.Arbitrary<unknown>;
  readonly decodeDisabled: (input: false | undefined) => HeaderLike;
  readonly decodeOption: (input: unknown) => HeaderLike;
  readonly decodeValid: () => HeaderLike;
  readonly createValueValid: () => Effect.Effect<O.Option<string>, never, never>;
  readonly createValid: () => Effect.Effect<O.Option<HeaderLike>, never, never>;
  readonly createInvalid: () => Effect.Effect<O.Option<string>, never, never>;
};

const crossOriginCases: ReadonlyArray<CrossOriginCase> = [
  {
    label: "COEP",
    headerName: "Cross-Origin-Embedder-Policy",
    validValue: "require-corp",
    optionArbitrary: S.toArbitrary(CrossOriginEmbedderPolicyOption)(fc),
    decodeDisabled: (input) => S.decodeSync(CrossOriginEmbedderPolicyHeader)(input),
    decodeOption: S.decodeUnknownSync(CrossOriginEmbedderPolicyHeader),
    decodeValid: () => S.decodeSync(CrossOriginEmbedderPolicyHeader)("require-corp"),
    createValueValid: () => CrossOriginEmbedderPolicyHeader.createValue("require-corp").pipe(Effect.orDie),
    createValid: () => CrossOriginEmbedderPolicyHeader.create("require-corp").pipe(Effect.orDie),
    createInvalid: () => CrossOriginEmbedderPolicyHeader.createValue("invalid" as never).pipe(Effect.orDie),
  },
  {
    label: "COOP",
    headerName: "Cross-Origin-Opener-Policy",
    validValue: "same-origin",
    optionArbitrary: S.toArbitrary(CrossOriginOpenerPolicyOption)(fc),
    decodeDisabled: (input) => S.decodeSync(CrossOriginOpenerPolicyHeader)(input),
    decodeOption: S.decodeUnknownSync(CrossOriginOpenerPolicyHeader),
    decodeValid: () => S.decodeSync(CrossOriginOpenerPolicyHeader)("same-origin"),
    createValueValid: () => CrossOriginOpenerPolicyHeader.createValue("same-origin").pipe(Effect.orDie),
    createValid: () => CrossOriginOpenerPolicyHeader.create("same-origin").pipe(Effect.orDie),
    createInvalid: () => CrossOriginOpenerPolicyHeader.createValue("invalid" as never).pipe(Effect.orDie),
  },
  {
    label: "CORP",
    headerName: "Cross-Origin-Resource-Policy",
    validValue: "same-origin",
    optionArbitrary: S.toArbitrary(CrossOriginResourcePolicyOption)(fc),
    decodeDisabled: (input) => S.decodeSync(CrossOriginResourcePolicyHeader)(input),
    decodeOption: S.decodeUnknownSync(CrossOriginResourcePolicyHeader),
    decodeValid: () => S.decodeSync(CrossOriginResourcePolicyHeader)("same-origin"),
    createValueValid: () => CrossOriginResourcePolicyHeader.createValue("same-origin").pipe(Effect.orDie),
    createValid: () => CrossOriginResourcePolicyHeader.create("same-origin").pipe(Effect.orDie),
    createInvalid: () => CrossOriginResourcePolicyHeader.createValue("invalid" as never).pipe(Effect.orDie),
  },
];

describe("Secure header schemas", () => {
  it("derives cross-origin option examples directly from the source schema", () => {
    const optionArbitrary = S.toArbitrary(CrossOriginEmbedderPolicyOption)(fc);

    fc.assert(
      fc.property(optionArbitrary, (option) => {
        expectHeader(
          S.decodeSync(CrossOriginEmbedderPolicyHeader)(option),
          "Cross-Origin-Embedder-Policy",
          P.isString(option) ? option : undefined
        );
      }),
      fcRuns(25)
    );
  });

  for (const testCase of crossOriginCases) {
    describe(testCase.label, () => {
      it("decodes undefined and false to a disabled header", () => {
        expectHeader(testCase.decodeDisabled(undefined), testCase.headerName, undefined);
        expectHeader(testCase.decodeDisabled(false), testCase.headerName, undefined);
      });

      it("decodes valid input and creates a matching header", () => {
        expectHeader(testCase.decodeValid(), testCase.headerName, testCase.validValue);
        const createdValue = Effect.runSync(
          testCase.createValueValid() as unknown as Effect.Effect<O.Option<string>, never, never>
        );
        expect(createdValue).toEqual(O.some(testCase.validValue));
        expectSomeHeader(
          Effect.runSync(testCase.createValid() as unknown as Effect.Effect<O.Option<HeaderLike>, never, never>),
          testCase.headerName,
          testCase.validValue
        );
      });

      it("derives option examples from the source schema", () => {
        fc.assert(
          fc.property(testCase.optionArbitrary, (option) => {
            expectHeader(testCase.decodeOption(option), testCase.headerName, P.isString(option) ? option : undefined);
          }),
          fcRuns(25)
        );
      });

      it("fails on invalid createValue input", () => {
        expect(
          Exit.isFailure(
            Effect.runSyncExit(testCase.createInvalid() as unknown as Effect.Effect<unknown, never, never>)
          )
        ).toBe(true);
      });
    });
  }

  it.effect("formats Expect-CT tuple options including enforce and report-uri", () =>
    Effect.gen(function* () {
      const encoded = [
        true,
        {
          maxAge: 123,
          enforce: true,
          reportURI: "https://example.com/report",
        },
      ] as const;
      const expected = "max-age=123, enforce, report-uri=https://example.com/report";

      expectHeader(yield* S.decodeEffect(ExpectCTHeader)(encoded), "Expect-CT", expected);
      expect(runExit(ExpectCTHeader.createValue(encoded))).toStrictEqual(Exit.succeed(O.some(expected)));
    })
  );

  it.effect("handles Expect-CT disabled and default-enabled forms", () =>
    Effect.gen(function* () {
      expectHeader(yield* S.decodeEffect(ExpectCTHeader)(undefined), "Expect-CT", undefined);
      expectHeader(yield* S.decodeEffect(ExpectCTHeader)(false), "Expect-CT", undefined);
      expectHeader(yield* S.decodeEffect(ExpectCTHeader)(true), "Expect-CT", "max-age=86400");
      expectHeader(yield* S.decodeEffect(ExpectCTHeader)([true, {}]), "Expect-CT", "max-age=86400");
      expectHeader(yield* S.decodeEffect(ExpectCTHeader)([true, { enforce: false }]), "Expect-CT", "max-age=86400");

      yield* Effect.promise(() =>
        Promise.resolve(expect(run(ExpectCTHeader.createValue())).resolves.toEqual(O.none()))
      );
      yield* Effect.promise(() =>
        Promise.resolve(expect(run(ExpectCTHeader.createValue(false))).resolves.toEqual(O.none()))
      );
      yield* Effect.promise(() =>
        Promise.resolve(expect(run(ExpectCTHeader.createValue(true))).resolves.toEqual(O.some("max-age=86400")))
      );
      expect(O.isNone(yield* Effect.promise(() => Promise.resolve(run(ExpectCTHeader.create(false)))))).toBe(true);
      expect(
        Exit.isFailure(
          runExit(
            ExpectCTHeader.createValue([
              true,
              {
                reportURI: "not-a-url",
              },
            ] as const)
          )
        )
      ).toBe(true);
      expect(Exit.isFailure(runExit(ExpectCTHeader.createValue([true, { maxAge: -1 }] as never)))).toBe(true);
    })
  );

  it.effect("formats HSTS defaults and tuple options", () =>
    Effect.gen(function* () {
      expectHeader(
        yield* S.decodeEffect(ForceHttpsRedirectHeader)(undefined),
        "Strict-Transport-Security",
        "max-age=63072000"
      );
      yield* Effect.promise(() =>
        Promise.resolve(
          expect(
            run(ForceHttpsRedirectHeader.createValue([true, { maxAge: 120, includeSubDomains: true, preload: true }]))
          ).resolves.toEqual(O.some("max-age=120; includeSubDomains; preload"))
        )
      );
      yield* Effect.promise(() =>
        Promise.resolve(expect(run(ForceHttpsRedirectHeader.createValue(false))).resolves.toEqual(O.none()))
      );
      expect(Exit.isFailure(runExit(ForceHttpsRedirectHeader.createValue([true, { maxAge: -1 }] as never)))).toBe(true);
    })
  );

  it.effect("handles HSTS direct, disabled, and sparse tuple forms", () =>
    Effect.gen(function* () {
      expectHeader(yield* S.decodeEffect(ForceHttpsRedirectHeader)(false), "Strict-Transport-Security", undefined);
      expectHeader(
        yield* S.decodeEffect(ForceHttpsRedirectHeader)(true),
        "Strict-Transport-Security",
        "max-age=63072000"
      );
      expectHeader(
        yield* S.decodeEffect(ForceHttpsRedirectHeader)([true, {}]),
        "Strict-Transport-Security",
        "max-age=63072000"
      );
      expectHeader(
        yield* S.decodeEffect(ForceHttpsRedirectHeader)([true, { maxAge: 120 }]),
        "Strict-Transport-Security",
        "max-age=120"
      );

      yield* Effect.promise(() =>
        Promise.resolve(
          expect(run(ForceHttpsRedirectHeader.createValue())).resolves.toEqual(O.some("max-age=63072000"))
        )
      );
      yield* Effect.promise(() =>
        Promise.resolve(
          expect(run(ForceHttpsRedirectHeader.createValue(true))).resolves.toEqual(O.some("max-age=63072000"))
        )
      );
      expect(O.isNone(yield* Effect.promise(() => Promise.resolve(run(ForceHttpsRedirectHeader.create(false)))))).toBe(
        true
      );
    })
  );

  it.effect("formats Frame-Guard allow-from values", () =>
    Effect.gen(function* () {
      const option = ["allow-from", { uri: "https://example.com/frame" }] as const;

      expectHeader(
        yield* S.decodeEffect(FrameGuardHeader)(option),
        "X-Frame-Options",
        "allow-from https://example.com/frame"
      );
      yield* Effect.promise(() =>
        Promise.resolve(
          expect(run(FrameGuardHeader.createValue(option))).resolves.toEqual(
            O.some("allow-from https://example.com/frame")
          )
        )
      );
    })
  );

  it.effect("handles Frame-Guard default, direct, disabled, and invalid allow-from forms", () =>
    Effect.gen(function* () {
      expectHeader(yield* S.decodeEffect(FrameGuardHeader)(undefined), "X-Frame-Options", "deny");
      expectHeader(yield* S.decodeEffect(FrameGuardHeader)(false), "X-Frame-Options", undefined);
      expectHeader(yield* S.decodeEffect(FrameGuardHeader)("deny"), "X-Frame-Options", "deny");
      expectHeader(yield* S.decodeEffect(FrameGuardHeader)("sameorigin"), "X-Frame-Options", "sameorigin");

      yield* Effect.promise(() =>
        Promise.resolve(expect(run(FrameGuardHeader.createValue())).resolves.toEqual(O.some("deny")))
      );
      yield* Effect.promise(() =>
        Promise.resolve(expect(run(FrameGuardHeader.createValue(false))).resolves.toEqual(O.none()))
      );
      yield* Effect.promise(() =>
        Promise.resolve(expect(run(FrameGuardHeader.createValue("sameorigin"))).resolves.toEqual(O.some("sameorigin")))
      );
      expect(O.isNone(yield* Effect.promise(() => Promise.resolve(run(FrameGuardHeader.create(false)))))).toBe(true);
      expect(Exit.isFailure(runExit(FrameGuardHeader.createValue(["allow-from", { uri: "not-a-url" }] as never)))).toBe(
        true
      );
    })
  );

  it.effect("uses secure defaults for NoOpen, NoSniff, and permitted cross-domain policies", () =>
    Effect.gen(function* () {
      expectHeader(yield* S.decodeEffect(NoOpenHeader)(undefined), "X-Download-Options", "noopen");
      expectHeader(yield* S.decodeEffect(NoSniffHeader)(undefined), "X-Content-Type-Options", "nosniff");
      expectHeader(
        yield* S.decodeEffect(PermittedCrossDomainPoliciesHeader)(undefined),
        "X-Permitted-Cross-Domain-Policies",
        "none"
      );

      yield* Effect.promise(() =>
        Promise.resolve(expect(run(NoOpenHeader.createValue())).resolves.toEqual(O.some("noopen")))
      );
      yield* Effect.promise(() =>
        Promise.resolve(expect(run(NoSniffHeader.createValue())).resolves.toEqual(O.some("nosniff")))
      );
      yield* Effect.promise(() =>
        Promise.resolve(expect(run(PermittedCrossDomainPoliciesHeader.createValue())).resolves.toEqual(O.some("none")))
      );
    })
  );

  it.effect("disables and validates one-value security headers", () =>
    Effect.gen(function* () {
      expectHeader(yield* S.decodeEffect(NoOpenHeader)(false), "X-Download-Options", undefined);
      expectHeader(yield* S.decodeEffect(NoSniffHeader)(false), "X-Content-Type-Options", undefined);
      expectHeader(
        yield* S.decodeEffect(PermittedCrossDomainPoliciesHeader)(false),
        "X-Permitted-Cross-Domain-Policies",
        undefined
      );
      expectHeader(yield* S.decodeEffect(NoOpenHeader)("noopen"), "X-Download-Options", "noopen");
      expectHeader(yield* S.decodeEffect(NoSniffHeader)("nosniff"), "X-Content-Type-Options", "nosniff");
      expectHeader(
        yield* S.decodeEffect(PermittedCrossDomainPoliciesHeader)("master-only"),
        "X-Permitted-Cross-Domain-Policies",
        "master-only"
      );

      yield* Effect.promise(() =>
        Promise.resolve(expect(run(NoOpenHeader.createValue(false))).resolves.toEqual(O.none()))
      );
      yield* Effect.promise(() =>
        Promise.resolve(expect(run(NoSniffHeader.createValue(false))).resolves.toEqual(O.none()))
      );
      yield* Effect.promise(() =>
        Promise.resolve(expect(run(PermittedCrossDomainPoliciesHeader.createValue(false))).resolves.toEqual(O.none()))
      );
      expect(O.isNone(yield* Effect.promise(() => Promise.resolve(run(NoOpenHeader.create(false)))))).toBe(true);
      expect(O.isNone(yield* Effect.promise(() => Promise.resolve(run(NoSniffHeader.create(false)))))).toBe(true);
      expect(
        O.isNone(yield* Effect.promise(() => Promise.resolve(run(PermittedCrossDomainPoliciesHeader.create(false)))))
      ).toBe(true);
      yield* Effect.promise(() =>
        Promise.resolve(
          expect(run(PermittedCrossDomainPoliciesHeader.createValue("all"))).resolves.toEqual(O.some("all"))
        )
      );

      expect(Exit.isFailure(runExit(NoOpenHeader.createValue("invalid" as never)))).toBe(true);
      expect(Exit.isFailure(runExit(NoSniffHeader.createValue("invalid" as never)))).toBe(true);
      expect(Exit.isFailure(runExit(PermittedCrossDomainPoliciesHeader.createValue("invalid" as never)))).toBe(true);
    })
  );

  it.effect("formats permissions policy directives and rejects invalid directive names", () =>
    Effect.gen(function* () {
      const option = {
        directives: {
          camera: "none",
          microphone: "self",
          geolocation: '"https://example.com"',
        },
      } as const;

      expectHeader(
        yield* S.decodeEffect(PermissionsPolicyHeader)(option),
        "Permissions-Policy",
        'camera=(), microphone=(self), geolocation=("https://example.com")'
      );
      yield* Effect.promise(() =>
        Promise.resolve(
          expect(run(PermissionsPolicyHeader.createValue(option))).resolves.toEqual(
            O.some('camera=(), microphone=(self), geolocation=("https://example.com")')
          )
        )
      );
      const invalid = runExit(
        PermissionsPolicyHeader.createValue({
          directives: {
            "invalid-directive": "none",
          } as never,
        })
      );
      expect(Exit.isFailure(invalid)).toBe(true);
      expect(
        Exit.isFailure(
          runExit(
            S.decodeEffect(PermissionsPolicyHeader)({
              directives: {
                camera: "none",
                "invalid-directive": "none",
              },
            })
          )
        )
      ).toBe(true);
    })
  );

  it.effect("handles permissions policy disabled, empty, wildcard, and origin-list values", () =>
    Effect.gen(function* () {
      const option = {
        directives: {
          autoplay: "*",
          fullscreen: ["self", '"https://example.com"'],
          payment: '"https://pay.example"',
        },
      } as const;

      expectHeader(yield* S.decodeEffect(PermissionsPolicyHeader)(undefined), "Permissions-Policy", undefined);
      expectHeader(yield* S.decodeEffect(PermissionsPolicyHeader)(false), "Permissions-Policy", undefined);
      expectHeader(yield* S.decodeEffect(PermissionsPolicyHeader)({ directives: {} }), "Permissions-Policy", undefined);
      expectHeader(
        yield* S.decodeEffect(PermissionsPolicyHeader)(option),
        "Permissions-Policy",
        'autoplay=*, fullscreen=(self "https://example.com"), payment=("https://pay.example")'
      );

      yield* Effect.promise(() =>
        Promise.resolve(expect(run(PermissionsPolicyHeader.createValue())).resolves.toEqual(O.none()))
      );
      yield* Effect.promise(() =>
        Promise.resolve(expect(run(PermissionsPolicyHeader.createValue(false))).resolves.toEqual(O.none()))
      );
      yield* Effect.promise(() =>
        Promise.resolve(expect(run(PermissionsPolicyHeader.createValue({ directives: {} }))).resolves.toEqual(O.none()))
      );
      yield* Effect.promise(() =>
        Promise.resolve(
          expect(run(PermissionsPolicyHeader.createValue(option))).resolves.toEqual(
            O.some('autoplay=*, fullscreen=(self "https://example.com"), payment=("https://pay.example")')
          )
        )
      );
      expect(
        O.isNone(yield* Effect.promise(() => Promise.resolve(run(PermissionsPolicyHeader.create({ directives: {} })))))
      ).toBe(true);
    })
  );

  it.effect("joins multiple referrer-policy values and rejects unsafe-url", () =>
    Effect.gen(function* () {
      const option = ["no-referrer", "origin", "strict-origin-when-cross-origin"] as const;

      expectHeader(
        yield* S.decodeEffect(ReferrerPolicyHeader)(option),
        "Referrer-Policy",
        "no-referrer, origin, strict-origin-when-cross-origin"
      );
      yield* Effect.promise(() =>
        Promise.resolve(
          expect(run(ReferrerPolicyHeader.createValue(option))).resolves.toEqual(
            O.some("no-referrer, origin, strict-origin-when-cross-origin")
          )
        )
      );
      expect(Exit.isFailure(runExit(ReferrerPolicyHeader.createValue("unsafe-url" as never)))).toBe(true);
    })
  );

  it.effect("renders X-XSS-Protection modes including report", () =>
    Effect.gen(function* () {
      const reportOption = ["report", { uri: "https://example.com/report" }] as const;

      expectHeader(yield* S.decodeEffect(XSSProtectionHeader)(undefined), "X-XSS-Protection", "1");
      expectHeader(yield* S.decodeEffect(XSSProtectionHeader)(false), "X-XSS-Protection", "0");
      expectHeader(
        yield* S.decodeEffect(XSSProtectionHeader)(reportOption),
        "X-XSS-Protection",
        "1; report=https://example.com/report"
      );

      yield* Effect.promise(() =>
        Promise.resolve(expect(run(XSSProtectionHeader.createValue(false))).resolves.toEqual(O.some("0")))
      );
      yield* Effect.promise(() =>
        Promise.resolve(
          expect(run(XSSProtectionHeader.createValue(reportOption))).resolves.toEqual(
            O.some("1; report=https://example.com/report")
          )
        )
      );
    })
  );

  it.effect("renders CSP values and switches to the report-only header name", () =>
    Effect.gen(function* () {
      const option: ContentSecurityPolicyOption = {
        directives: {
          scriptSrc: "'self'",
          reportURI: "https://example.com/csp",
        },
        reportOnly: true,
      };

      expectHeader(
        yield* S.decodeEffect(ContentSecurityPolicyHeader)(option),
        "Content-Security-Policy-Report-Only",
        "script-src 'self'; report-uri https://example.com/csp"
      );
      yield* Effect.promise(() =>
        Promise.resolve(
          expect(run(ContentSecurityPolicyHeader.createValue(option))).resolves.toEqual(
            O.some("script-src 'self'; report-uri https://example.com/csp")
          )
        )
      );
      expectSomeHeader(
        yield* Effect.promise(() => Promise.resolve(run(ContentSecurityPolicyHeader.create(option)))),
        "Content-Security-Policy-Report-Only",
        "script-src 'self'; report-uri https://example.com/csp"
      );
    })
  );

  it("renders CSP directive helpers across fetch, document, navigation, and reporting directives", () => {
    expect(getProperHeaderName()).toBe("Content-Security-Policy");
    expect(getProperHeaderName(true)).toBe("Content-Security-Policy-Report-Only");
    expect(createDirectiveValue("script-src", ["'self'", "https:"])).toBe("script-src 'self' https:");
    expect(createDirectiveValue(["'self'"])("style-src")).toBe("style-src 'self'");
    expect(FetchDirective.convertToString()).toBe("");
    expect(DocumentDirective.convertToString()).toBe("");
    expect(NavigationDirective.convertToString()).toBe("");
    expect(ReportingDirective.convertToString()).toBe("");

    expect(
      FetchDirective.convertToString({
        defaultSrc: O.some("'self'"),
        "img-src": ["https:"],
        scriptSrc: undefined,
        unknown: "'none'",
      } as never)
    ).toBe("default-src 'self'; img-src https:");
    expect(
      DocumentDirective.convertToString({
        "base-uri": "'self'",
        "plugin-types": ["application/pdf"],
        sandbox: true,
      })
    ).toBe("base-uri 'self'; plugin-types application/pdf; sandbox");
    expect(DocumentDirective.convertToString({ sandbox: "allow-scripts" })).toBe("sandbox allow-scripts");
    expect(
      NavigationDirective.convertToString({
        "form-action": "'self'",
        frameAncestors: ["'none'"],
        "navigate-to": "https://example.com",
      })
    ).toBe("form-action 'self'; frame-ancestors 'none'; navigate-to https://example.com");
    expect(
      ReportingDirective.convertToString({
        "report-uri": [new URL("https://example.com/csp"), "https://example.com/local-report"],
        reportTo: "default-endpoint",
      })
    ).toBe("report-uri https://example.com/csp https://example.com/local-report; report-to default-endpoint");
  });

  it.effect("handles disabled and empty CSP options", () =>
    Effect.gen(function* () {
      expect(createContentSecurityPolicyOptionHeaderValue()).toEqual(O.none());
      expect(createContentSecurityPolicyOptionHeaderValue(false)).toEqual(O.none());
      expect(createContentSecurityPolicyOptionHeaderValue({ directives: { sandbox: true } })).toEqual(
        O.some("sandbox")
      );
      expectHeader(yield* S.decodeEffect(ContentSecurityPolicyHeader)(undefined), "Content-Security-Policy", undefined);
      expectHeader(yield* S.decodeEffect(ContentSecurityPolicyHeader)(false), "Content-Security-Policy", undefined);
      yield* Effect.promise(() =>
        Promise.resolve(expect(run(ContentSecurityPolicyHeader.createValue())).resolves.toEqual(O.none()))
      );
      yield* Effect.promise(() =>
        Promise.resolve(expect(run(ContentSecurityPolicyHeader.createValue(false))).resolves.toEqual(O.none()))
      );
      expect(O.isNone(yield* Effect.promise(() => Promise.resolve(run(ContentSecurityPolicyHeader.create()))))).toBe(
        true
      );
      expect(
        O.isNone(yield* Effect.promise(() => Promise.resolve(run(ContentSecurityPolicyHeader.create(false)))))
      ).toBe(true);

      const emptyDecode = runExit(S.decodeEffect(ContentSecurityPolicyHeader)({ directives: {} }));
      expect(Exit.isFailure(emptyDecode)).toBe(true);
    })
  );
});

describe("Secure header aggregates", () => {
  it.effect("creates the default secure headers object", () =>
    Effect.promise(() =>
      Promise.resolve(
        expect(run(createHeadersObject())).resolves.toEqual({
          "Strict-Transport-Security": "max-age=63072000",
          "X-Frame-Options": "deny",
          "X-Download-Options": "noopen",
          "X-Content-Type-Options": "nosniff",
          "X-Permitted-Cross-Domain-Policies": "none",
          "X-XSS-Protection": "1",
        })
      )
    )
  );

  it.effect("treats omitted, undefined, and schema-constructed empty options identically", () =>
    Effect.gen(function* () {
      const omitted = yield* Effect.promise(() => Promise.resolve(run(createHeadersObject())));
      const explicitUndefined = yield* Effect.promise(() => Promise.resolve(run(createHeadersObject(undefined))));
      const schemaConstructed = yield* Effect.promise(() =>
        Promise.resolve(run(createHeadersObject(SecureHeaderOptions.make({}))))
      );

      expect(explicitUndefined).toEqual(omitted);
      expect(schemaConstructed).toEqual(omitted);
    })
  );

  it.effect("creates customized secure headers and omits disabled values", () =>
    Effect.gen(function* () {
      const result = yield* Effect.promise(() =>
        Promise.resolve(
          run(
            createHeadersObject({
              frameGuard: "sameorigin",
              referrerPolicy: "same-origin",
              noopen: false,
              nosniff: false,
              contentSecurityPolicy: {
                directives: {
                  scriptSrc: "'self'",
                },
              },
              expectCT: [true, { maxAge: 123, reportURI: "https://example.com/report" }],
            })
          )
        )
      );

      expect(result["X-Frame-Options"]).toBe("sameorigin");
      expect(result["Referrer-Policy"]).toBe("same-origin");
      expect(result["Content-Security-Policy"]).toBe("script-src 'self'");
      expect(result["Expect-CT"]).toBe("max-age=123, report-uri=https://example.com/report");
      expect("X-Download-Options" in result).toBe(false);
      expect("X-Content-Type-Options" in result).toBe(false);
    })
  );

  it.effect("creates secure headers in key/value form", () =>
    Effect.gen(function* () {
      const result = yield* Effect.promise(() =>
        Promise.resolve(run(createSecureHeaders({ frameGuard: "sameorigin" })))
      );
      const plain = pipe(
        result,
        A.map((header) => ({
          key: header.key,
          value: header.value,
        }))
      );

      expect(plain).toContainEqual({
        key: "Strict-Transport-Security",
        value: "max-age=63072000",
      });
      expect(plain).toContainEqual({
        key: "X-Frame-Options",
        value: "sameorigin",
      });
      expect(plain).toContainEqual({
        key: "X-Permitted-Cross-Domain-Policies",
        value: "none",
      });
    })
  );

  it.effect("creates default secure headers in key/value form", () =>
    Effect.gen(function* () {
      const result = yield* Effect.promise(() => Promise.resolve(run(createSecureHeaders())));
      const plain = pipe(
        result,
        A.map((header) => ({
          key: header.key,
          value: header.value,
        }))
      );

      expect(plain).toContainEqual({
        key: "Strict-Transport-Security",
        value: "max-age=63072000",
      });
      expect(plain).toContainEqual({
        key: "X-Frame-Options",
        value: "deny",
      });
    })
  );
});
