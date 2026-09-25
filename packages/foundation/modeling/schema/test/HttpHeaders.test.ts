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
import * as HeaderErrors from "@beep/schema/SecureHeaderError";
import { createHeadersObject, createSecureHeaders, SecureHeaderOptions } from "@beep/schema/SecureHeaderOptions";
import { XSSProtectionHeader } from "@beep/schema/XssProtection";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertExitSuccess, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { Effect, Exit, pipe } from "effect";
import * as Cause from "effect/Cause";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import type { ContentSecurityPolicyOption } from "@beep/schema/Csp";

const decodeContentSecurityPolicyHeader = S.decodeEffect(ContentSecurityPolicyHeader);
const decodeExpectCTHeader = S.decodeEffect(ExpectCTHeader);
const decodeForceHttpsRedirectHeader = S.decodeEffect(ForceHttpsRedirectHeader);
const decodeFrameGuardHeader = S.decodeEffect(FrameGuardHeader);
const decodeNoOpenHeader = S.decodeEffect(NoOpenHeader);
const decodeNoSniffHeader = S.decodeEffect(NoSniffHeader);
const decodePermissionsPolicyHeader = S.decodeEffect(PermissionsPolicyHeader);
const decodePermittedCrossDomainPoliciesHeader = S.decodeEffect(PermittedCrossDomainPoliciesHeader);
const decodeReferrerPolicyHeader = S.decodeEffect(ReferrerPolicyHeader);
const decodeXSSProtectionHeader = S.decodeEffect(XSSProtectionHeader);
const decodeCrossOriginEmbedderPolicyHeaderEffect = S.decodeEffect(CrossOriginEmbedderPolicyHeader);
const decodeCrossOriginOpenerPolicyHeaderEffect = S.decodeEffect(CrossOriginOpenerPolicyHeader);
const decodeCrossOriginResourcePolicyHeaderEffect = S.decodeEffect(CrossOriginResourcePolicyHeader);
const encodeCrossOriginEmbedderPolicyHeaderEffect = S.encodeEffect(CrossOriginEmbedderPolicyHeader);

type HeaderLike = {
  readonly name: string;
  readonly value: O.Option<string>;
};

const expectHeader = (header: HeaderLike, name: string, value: string | undefined) => {
  expect(header.name).toBe(name);
  expect(O.getOrUndefined(header.value)).toBe(value);
};

const expectSomeHeader = (header: O.Option<HeaderLike>, name: string, value: string) => {
  pipe(header, O.isSome, assertTrue);

  if (O.isSome(header)) {
    expectHeader(header.value, name, value);
  }
};

type CrossOriginCase = {
  readonly label: string;
  readonly headerName: string;
  readonly validValue: string;
  readonly optionArbitrary: Arbitrary.Arbitrary<unknown>;
  readonly decodeDisabled: (input: false | undefined) => Effect.Effect<HeaderLike, S.SchemaError>;
  readonly decodeOption: (input: unknown) => Effect.Effect<HeaderLike, S.SchemaError>;
  readonly decodeValid: () => Effect.Effect<HeaderLike, S.SchemaError>;
  readonly createValueValid: () => Effect.Effect<O.Option<string>, never, never>;
  readonly createValid: () => Effect.Effect<O.Option<HeaderLike>, never, never>;
  readonly createInvalid: () => Effect.Effect<O.Option<string>, HeaderErrors.Error>;
  readonly isError: (value: unknown) => boolean;
};

const crossOriginCases: ReadonlyArray<CrossOriginCase> = [
  {
    label: "COEP",
    headerName: "Cross-Origin-Embedder-Policy",
    validValue: "require-corp",
    optionArbitrary: Arbitrary.schema(CrossOriginEmbedderPolicyOption),
    decodeDisabled: decodeCrossOriginEmbedderPolicyHeaderEffect,
    decodeOption: S.decodeUnknownEffect(CrossOriginEmbedderPolicyHeader),
    decodeValid: () => decodeCrossOriginEmbedderPolicyHeaderEffect("require-corp"),
    createValueValid: () => CrossOriginEmbedderPolicyHeader.createValue("require-corp").pipe(Effect.orDie),
    createValid: () => CrossOriginEmbedderPolicyHeader.create("require-corp").pipe(Effect.orDie),
    createInvalid: () => CrossOriginEmbedderPolicyHeader.createValue("invalid" as never),
    isError: S.is(HeaderErrors.CrossOriginEmbedderPolicyError),
  },
  {
    label: "COOP",
    headerName: "Cross-Origin-Opener-Policy",
    validValue: "same-origin",
    optionArbitrary: Arbitrary.schema(CrossOriginOpenerPolicyOption),
    decodeDisabled: decodeCrossOriginOpenerPolicyHeaderEffect,
    decodeOption: S.decodeUnknownEffect(CrossOriginOpenerPolicyHeader),
    decodeValid: () => decodeCrossOriginOpenerPolicyHeaderEffect("same-origin"),
    createValueValid: () => CrossOriginOpenerPolicyHeader.createValue("same-origin").pipe(Effect.orDie),
    createValid: () => CrossOriginOpenerPolicyHeader.create("same-origin").pipe(Effect.orDie),
    createInvalid: () => CrossOriginOpenerPolicyHeader.createValue("invalid" as never),
    isError: S.is(HeaderErrors.CrossOriginOpenerPolicyError),
  },
  {
    label: "CORP",
    headerName: "Cross-Origin-Resource-Policy",
    validValue: "same-origin",
    optionArbitrary: Arbitrary.schema(CrossOriginResourcePolicyOption),
    decodeDisabled: decodeCrossOriginResourcePolicyHeaderEffect,
    decodeOption: S.decodeUnknownEffect(CrossOriginResourcePolicyHeader),
    decodeValid: () => decodeCrossOriginResourcePolicyHeaderEffect("same-origin"),
    createValueValid: () => CrossOriginResourcePolicyHeader.createValue("same-origin").pipe(Effect.orDie),
    createValid: () => CrossOriginResourcePolicyHeader.create("same-origin").pipe(Effect.orDie),
    createInvalid: () => CrossOriginResourcePolicyHeader.createValue("invalid" as never),
    isError: S.is(HeaderErrors.CrossOriginResourcePolicyError),
  },
];

describe("Secure header schemas", () => {
  it.effect.prop(
    "derives cross-origin option examples directly from the source schema",
    [CrossOriginEmbedderPolicyOption],
    Effect.fnUntraced(function* ([option]) {
      expectHeader(
        yield* decodeCrossOriginEmbedderPolicyHeaderEffect(option),
        "Cross-Origin-Embedder-Policy",
        P.isString(option) ? option : undefined
      );
    }),
    { arbitrary: fcRuns(25) }
  );

  it.effect(
    "rejects encoding a normalized COEP header back to its one-way input boundary",
    Effect.fnUntraced(function* () {
      const header = yield* decodeCrossOriginEmbedderPolicyHeaderEffect("require-corp");
      const result = yield* Effect.exit(encodeCrossOriginEmbedderPolicyHeaderEffect(header));
      pipe(result, Exit.hasFails, assertTrue);
      if (Exit.hasFails(result)) {
        expect(pipe(result.cause, Cause.findErrorOption, O.getOrThrow).message).toContain(
          "Encoding CrossOriginEmbedderPolicyHeader back to the original input is not supported"
        );
      }
    })
  );

  for (const testCase of crossOriginCases) {
    describe(testCase.label, () => {
      it.effect(
        "decodes undefined and false to a disabled header",
        Effect.fnUntraced(function* () {
          expectHeader(yield* testCase.decodeDisabled(undefined), testCase.headerName, undefined);
          expectHeader(yield* testCase.decodeDisabled(false), testCase.headerName, undefined);
        })
      );

      it.effect(
        "decodes valid input and creates a matching header",
        Effect.fnUntraced(function* () {
          expectHeader(yield* testCase.decodeValid(), testCase.headerName, testCase.validValue);
          const createdValue = yield* testCase.createValueValid();
          assertSome(createdValue, testCase.validValue);
          expectSomeHeader(yield* testCase.createValid(), testCase.headerName, testCase.validValue);
        })
      );

      it.effect.prop(
        "derives option examples from the source schema",
        [testCase.optionArbitrary],
        Effect.fnUntraced(function* ([option]) {
          expectHeader(
            yield* testCase.decodeOption(option),
            testCase.headerName,
            P.isString(option) ? option : undefined
          );
        }),
        { arbitrary: fcRuns(25) }
      );

      it.effect(
        "fails on invalid createValue input",
        Effect.fnUntraced(function* () {
          pipe(yield* Effect.flip(testCase.createInvalid()), testCase.isError, assertTrue);
        })
      );
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

      expectHeader(yield* decodeExpectCTHeader(encoded), "Expect-CT", expected);
      assertExitSuccess(yield* Effect.exit(ExpectCTHeader.createValue(encoded).pipe(Effect.orDie)), O.some(expected));
    })
  );

  it.effect("handles Expect-CT disabled and default-enabled forms", () =>
    Effect.gen(function* () {
      expectHeader(yield* decodeExpectCTHeader(undefined), "Expect-CT", undefined);
      expectHeader(yield* decodeExpectCTHeader(false), "Expect-CT", undefined);
      expectHeader(yield* decodeExpectCTHeader(true), "Expect-CT", "max-age=86400");
      expectHeader(yield* decodeExpectCTHeader([true, {}]), "Expect-CT", "max-age=86400");
      expectHeader(yield* decodeExpectCTHeader([true, { enforce: false }]), "Expect-CT", "max-age=86400");

      assertNone(yield* ExpectCTHeader.createValue().pipe(Effect.orDie));
      assertNone(yield* ExpectCTHeader.createValue(false).pipe(Effect.orDie));
      assertSome(yield* ExpectCTHeader.createValue(true).pipe(Effect.orDie), "max-age=86400");
      pipe(yield* ExpectCTHeader.create(false).pipe(Effect.orDie), O.isNone, assertTrue);
      pipe(
        yield* Effect.flip(
          ExpectCTHeader.createValue([
            true,
            {
              reportURI: "not-a-url",
            },
          ] as const)
        ),
        S.is(HeaderErrors.ExpectCtError),
        assertTrue
      );
      pipe(
        yield* Effect.flip(ExpectCTHeader.createValue([true, { maxAge: -1 }] as never)),
        S.is(HeaderErrors.ExpectCtError),
        assertTrue
      );
    })
  );

  it.effect("formats HSTS defaults and tuple options", () =>
    Effect.gen(function* () {
      expectHeader(yield* decodeForceHttpsRedirectHeader(undefined), "Strict-Transport-Security", "max-age=63072000");
      assertSome(
        yield* ForceHttpsRedirectHeader.createValue([
          true,
          { maxAge: 120, includeSubDomains: true, preload: true },
        ]).pipe(Effect.orDie),
        "max-age=120; includeSubDomains; preload"
      );
      assertNone(yield* ForceHttpsRedirectHeader.createValue(false).pipe(Effect.orDie));
      pipe(
        yield* Effect.flip(ForceHttpsRedirectHeader.createValue([true, { maxAge: -1 }] as never)),
        S.is(HeaderErrors.ForceHttpsRedirectError),
        assertTrue
      );
    })
  );

  it.effect("handles HSTS direct, disabled, and sparse tuple forms", () =>
    Effect.gen(function* () {
      expectHeader(yield* decodeForceHttpsRedirectHeader(false), "Strict-Transport-Security", undefined);
      expectHeader(yield* decodeForceHttpsRedirectHeader(true), "Strict-Transport-Security", "max-age=63072000");
      expectHeader(yield* decodeForceHttpsRedirectHeader([true, {}]), "Strict-Transport-Security", "max-age=63072000");
      expectHeader(
        yield* decodeForceHttpsRedirectHeader([true, { maxAge: 120 }]),
        "Strict-Transport-Security",
        "max-age=120"
      );

      assertSome(yield* ForceHttpsRedirectHeader.createValue().pipe(Effect.orDie), "max-age=63072000");
      assertSome(yield* ForceHttpsRedirectHeader.createValue(true).pipe(Effect.orDie), "max-age=63072000");
      pipe(yield* ForceHttpsRedirectHeader.create(false).pipe(Effect.orDie), O.isNone, assertTrue);
    })
  );

  it.effect("formats Frame-Guard allow-from values", () =>
    Effect.gen(function* () {
      const option = ["allow-from", { uri: "https://example.com/frame" }] as const;

      expectHeader(yield* decodeFrameGuardHeader(option), "X-Frame-Options", "allow-from https://example.com/frame");
      assertSome(
        yield* FrameGuardHeader.createValue(option).pipe(Effect.orDie),
        "allow-from https://example.com/frame"
      );
    })
  );

  it.effect("handles Frame-Guard default, direct, disabled, and invalid allow-from forms", () =>
    Effect.gen(function* () {
      expectHeader(yield* decodeFrameGuardHeader(undefined), "X-Frame-Options", "deny");
      expectHeader(yield* decodeFrameGuardHeader(false), "X-Frame-Options", undefined);
      expectHeader(yield* decodeFrameGuardHeader("deny"), "X-Frame-Options", "deny");
      expectHeader(yield* decodeFrameGuardHeader("sameorigin"), "X-Frame-Options", "sameorigin");

      assertSome(yield* FrameGuardHeader.createValue().pipe(Effect.orDie), "deny");
      assertNone(yield* FrameGuardHeader.createValue(false).pipe(Effect.orDie));
      assertSome(yield* FrameGuardHeader.createValue("sameorigin").pipe(Effect.orDie), "sameorigin");
      pipe(yield* FrameGuardHeader.create(false).pipe(Effect.orDie), O.isNone, assertTrue);
      pipe(
        yield* Effect.flip(FrameGuardHeader.createValue(["allow-from", { uri: "not-a-url" }] as never)),
        S.is(HeaderErrors.FrameGuardError),
        assertTrue
      );
    })
  );

  it.effect("uses secure defaults for NoOpen, NoSniff, and permitted cross-domain policies", () =>
    Effect.gen(function* () {
      expectHeader(yield* decodeNoOpenHeader(undefined), "X-Download-Options", "noopen");
      expectHeader(yield* decodeNoSniffHeader(undefined), "X-Content-Type-Options", "nosniff");
      expectHeader(
        yield* decodePermittedCrossDomainPoliciesHeader(undefined),
        "X-Permitted-Cross-Domain-Policies",
        "none"
      );

      assertSome(yield* NoOpenHeader.createValue().pipe(Effect.orDie), "noopen");
      assertSome(yield* NoSniffHeader.createValue().pipe(Effect.orDie), "nosniff");
      assertSome(yield* PermittedCrossDomainPoliciesHeader.createValue().pipe(Effect.orDie), "none");
    })
  );

  it.effect("disables and validates one-value security headers", () =>
    Effect.gen(function* () {
      expectHeader(yield* decodeNoOpenHeader(false), "X-Download-Options", undefined);
      expectHeader(yield* decodeNoSniffHeader(false), "X-Content-Type-Options", undefined);
      expectHeader(
        yield* decodePermittedCrossDomainPoliciesHeader(false),
        "X-Permitted-Cross-Domain-Policies",
        undefined
      );
      expectHeader(yield* decodeNoOpenHeader("noopen"), "X-Download-Options", "noopen");
      expectHeader(yield* decodeNoSniffHeader("nosniff"), "X-Content-Type-Options", "nosniff");
      expectHeader(
        yield* decodePermittedCrossDomainPoliciesHeader("master-only"),
        "X-Permitted-Cross-Domain-Policies",
        "master-only"
      );

      assertNone(yield* NoOpenHeader.createValue(false).pipe(Effect.orDie));
      assertNone(yield* NoSniffHeader.createValue(false).pipe(Effect.orDie));
      assertNone(yield* PermittedCrossDomainPoliciesHeader.createValue(false).pipe(Effect.orDie));
      pipe(yield* NoOpenHeader.create(false).pipe(Effect.orDie), O.isNone, assertTrue);
      pipe(yield* NoSniffHeader.create(false).pipe(Effect.orDie), O.isNone, assertTrue);
      pipe(yield* PermittedCrossDomainPoliciesHeader.create(false).pipe(Effect.orDie), O.isNone, assertTrue);
      assertSome(yield* PermittedCrossDomainPoliciesHeader.createValue("all").pipe(Effect.orDie), "all");

      pipe(
        yield* Effect.flip(NoOpenHeader.createValue("invalid" as never)),
        S.is(HeaderErrors.NoOpenError),
        assertTrue
      );
      pipe(
        yield* Effect.flip(NoSniffHeader.createValue("invalid" as never)),
        S.is(HeaderErrors.NoSniffError),
        assertTrue
      );
      pipe(
        yield* Effect.flip(PermittedCrossDomainPoliciesHeader.createValue("invalid" as never)),
        S.is(HeaderErrors.PermittedCrossDomainPoliciesError),
        assertTrue
      );
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
        yield* decodePermissionsPolicyHeader(option),
        "Permissions-Policy",
        'camera=(), microphone=(self), geolocation=("https://example.com")'
      );
      assertSome(
        yield* PermissionsPolicyHeader.createValue(option).pipe(Effect.orDie),
        'camera=(), microphone=(self), geolocation=("https://example.com")'
      );
      const invalid = yield* Effect.flip(
        PermissionsPolicyHeader.createValue({
          directives: {
            "invalid-directive": "none",
          } as never,
        })
      );
      pipe(invalid, S.is(HeaderErrors.PermissionsPolicyError), assertTrue);
      pipe(
        yield* Effect.flip(
          decodePermissionsPolicyHeader({
            directives: {
              camera: "none",
              "invalid-directive": "none",
            },
          })
        ),
        S.isSchemaError,
        assertTrue
      );
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

      expectHeader(yield* decodePermissionsPolicyHeader(undefined), "Permissions-Policy", undefined);
      expectHeader(yield* decodePermissionsPolicyHeader(false), "Permissions-Policy", undefined);
      expectHeader(yield* decodePermissionsPolicyHeader({ directives: {} }), "Permissions-Policy", undefined);
      expectHeader(
        yield* decodePermissionsPolicyHeader(option),
        "Permissions-Policy",
        'autoplay=*, fullscreen=(self "https://example.com"), payment=("https://pay.example")'
      );

      assertNone(yield* PermissionsPolicyHeader.createValue().pipe(Effect.orDie));
      assertNone(yield* PermissionsPolicyHeader.createValue(false).pipe(Effect.orDie));
      assertNone(yield* PermissionsPolicyHeader.createValue({ directives: {} }).pipe(Effect.orDie));
      assertSome(
        yield* PermissionsPolicyHeader.createValue(option).pipe(Effect.orDie),
        'autoplay=*, fullscreen=(self "https://example.com"), payment=("https://pay.example")'
      );
      pipe(yield* PermissionsPolicyHeader.create({ directives: {} }).pipe(Effect.orDie), O.isNone, assertTrue);
    })
  );

  it.effect("joins multiple referrer-policy values and rejects unsafe-url", () =>
    Effect.gen(function* () {
      const option = ["no-referrer", "origin", "strict-origin-when-cross-origin"] as const;

      expectHeader(
        yield* decodeReferrerPolicyHeader(option),
        "Referrer-Policy",
        "no-referrer, origin, strict-origin-when-cross-origin"
      );
      assertSome(
        yield* ReferrerPolicyHeader.createValue(option).pipe(Effect.orDie),
        "no-referrer, origin, strict-origin-when-cross-origin"
      );
      pipe(
        yield* Effect.flip(ReferrerPolicyHeader.createValue("unsafe-url" as never)),
        S.is(HeaderErrors.ReferrerPolicyError),
        assertTrue
      );
    })
  );

  it.effect("renders X-XSS-Protection modes including report", () =>
    Effect.gen(function* () {
      const reportOption = ["report", { uri: "https://example.com/report" }] as const;

      expectHeader(yield* decodeXSSProtectionHeader(undefined), "X-XSS-Protection", "1");
      expectHeader(yield* decodeXSSProtectionHeader(false), "X-XSS-Protection", "0");
      expectHeader(
        yield* decodeXSSProtectionHeader(reportOption),
        "X-XSS-Protection",
        "1; report=https://example.com/report"
      );

      assertSome(yield* XSSProtectionHeader.createValue(false).pipe(Effect.orDie), "0");
      assertSome(
        yield* XSSProtectionHeader.createValue(reportOption).pipe(Effect.orDie),
        "1; report=https://example.com/report"
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
        yield* decodeContentSecurityPolicyHeader(option),
        "Content-Security-Policy-Report-Only",
        "script-src 'self'; report-uri https://example.com/csp"
      );
      assertSome(
        yield* ContentSecurityPolicyHeader.createValue(option).pipe(Effect.orDie),
        "script-src 'self'; report-uri https://example.com/csp"
      );
      expectSomeHeader(
        yield* ContentSecurityPolicyHeader.create(option).pipe(Effect.orDie),
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
      assertNone(createContentSecurityPolicyOptionHeaderValue());
      assertNone(createContentSecurityPolicyOptionHeaderValue(false));
      assertSome(createContentSecurityPolicyOptionHeaderValue({ directives: { sandbox: true } }), "sandbox");
      expectHeader(yield* decodeContentSecurityPolicyHeader(undefined), "Content-Security-Policy", undefined);
      expectHeader(yield* decodeContentSecurityPolicyHeader(false), "Content-Security-Policy", undefined);
      assertNone(yield* ContentSecurityPolicyHeader.createValue().pipe(Effect.orDie));
      assertNone(yield* ContentSecurityPolicyHeader.createValue(false).pipe(Effect.orDie));
      pipe(yield* ContentSecurityPolicyHeader.create().pipe(Effect.orDie), O.isNone, assertTrue);
      pipe(yield* ContentSecurityPolicyHeader.create(false).pipe(Effect.orDie), O.isNone, assertTrue);

      const emptyDecode = yield* Effect.flip(decodeContentSecurityPolicyHeader({ directives: {} }));
      pipe(emptyDecode, S.isSchemaError, assertTrue);
    })
  );
});

describe("Secure header aggregates", () => {
  it.effect("creates the default secure headers object", () =>
    Effect.gen(function* () {
      return expect(yield* createHeadersObject().pipe(Effect.orDie)).toEqual({
        "Strict-Transport-Security": "max-age=63072000",
        "X-Frame-Options": "deny",
        "X-Download-Options": "noopen",
        "X-Content-Type-Options": "nosniff",
        "X-Permitted-Cross-Domain-Policies": "none",
        "X-XSS-Protection": "1",
      });
    })
  );

  it.effect("treats omitted, undefined, and schema-constructed empty options identically", () =>
    Effect.gen(function* () {
      const omitted = yield* createHeadersObject();
      const explicitUndefined = yield* createHeadersObject(undefined);
      const schemaConstructed = yield* createHeadersObject(SecureHeaderOptions.make({}));

      expect(explicitUndefined).toEqual(omitted);
      expect(schemaConstructed).toEqual(omitted);
    }).pipe(Effect.orDie)
  );

  it.effect("creates customized secure headers and omits disabled values", () =>
    Effect.gen(function* () {
      const result = yield* createHeadersObject({
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
      }).pipe(Effect.orDie);

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
      const result = yield* createSecureHeaders({ frameGuard: "sameorigin" }).pipe(Effect.orDie);
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
      const result = yield* createSecureHeaders().pipe(Effect.orDie);
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
