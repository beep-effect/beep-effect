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
  ContentSecurityPolicyOptionStruct,
  createContentSecurityPolicyOptionHeaderValue,
  createDirectiveValue,
  DocumentDirective,
  FetchDirective,
  getProperHeaderName,
  NavigationDirective,
  ReportingDirective,
} from "@beep/schema/Csp";
import { ExpectCTHeader } from "@beep/schema/ExpectCt";
import { ForceHttpsRedirectConfig, ForceHttpsRedirectHeader } from "@beep/schema/ForceHttpsRedirect";
import { FrameGuardAllowFromConfig, FrameGuardHeader } from "@beep/schema/FrameGuard";
import { NoOpenHeader } from "@beep/schema/NoOpen";
import { NoSniffHeader } from "@beep/schema/NoSniff";
import { PermissionsPolicyHeader } from "@beep/schema/PermissionsPolicy";
import { PermittedCrossDomainPoliciesHeader } from "@beep/schema/PermittedCrossDomainPolicies";
import { ReferrerPolicyHeader } from "@beep/schema/ReferrerPolicy";
import * as HeaderErrors from "@beep/schema/SecureHeaderError";
import { createHeadersObject, createSecureHeaders, SecureHeaderOptions } from "@beep/schema/SecureHeaderOptions";
import { XSSProtectionHeader, XSSProtectionReportConfig } from "@beep/schema/XssProtection";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertExitSuccess, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { ContentSecurityPolicyOption } from "@beep/schema/Csp";

// Hoisted guards: the repo forbids compiling a schema guard inside a test body.
const isCrossOriginEmbedderPolicyError = S.is(HeaderErrors.CrossOriginEmbedderPolicyError);
const isCrossOriginOpenerPolicyError = S.is(HeaderErrors.CrossOriginOpenerPolicyError);
const isCrossOriginResourcePolicyError = S.is(HeaderErrors.CrossOriginResourcePolicyError);
const isExpectCtError = S.is(HeaderErrors.ExpectCtError);
const isForceHttpsRedirectError = S.is(HeaderErrors.ForceHttpsRedirectError);
const isFrameGuardError = S.is(HeaderErrors.FrameGuardError);
const isNoOpenError = S.is(HeaderErrors.NoOpenError);
const isNoSniffError = S.is(HeaderErrors.NoSniffError);
const isPermissionsPolicyError = S.is(HeaderErrors.PermissionsPolicyError);
const isPermittedCrossDomainPoliciesError = S.is(HeaderErrors.PermittedCrossDomainPoliciesError);
const isReferrerPolicyError = S.is(HeaderErrors.ReferrerPolicyError);

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
    isError: isCrossOriginEmbedderPolicyError,
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
    isError: isCrossOriginOpenerPolicyError,
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
    isError: isCrossOriginResourcePolicyError,
  },
];

describe("Secure header schemas", () => {
  it.effect.prop(
    "derives cross-origin option examples directly from the source schema",
    [CrossOriginEmbedderPolicyOption],
    Effect.fnUntraced(function* ([option]) {
      const decodedCrossOriginEmbedderPolicyHeaderEffect = yield* decodeCrossOriginEmbedderPolicyHeaderEffect(option);
      expectHeader(
        decodedCrossOriginEmbedderPolicyHeaderEffect,
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
      if (Exit.isFailure(result) && Exit.hasFails(result)) {
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
          const decodedDisabled = yield* testCase.decodeDisabled(undefined);
          expectHeader(decodedDisabled, testCase.headerName, undefined);
          const decodedDisabled1 = yield* testCase.decodeDisabled(false);
          expectHeader(decodedDisabled1, testCase.headerName, undefined);
        })
      );

      it.effect(
        "decodes valid input and creates a matching header",
        Effect.fnUntraced(function* () {
          const decodedValid = yield* testCase.decodeValid();
          expectHeader(decodedValid, testCase.headerName, testCase.validValue);
          const createdValue = yield* testCase.createValueValid();
          assertSome(createdValue, testCase.validValue);
          const createdValid = yield* testCase.createValid();
          expectSomeHeader(createdValid, testCase.headerName, testCase.validValue);
        })
      );

      it.effect.prop(
        "derives option examples from the source schema",
        [testCase.optionArbitrary],
        Effect.fnUntraced(function* ([option]) {
          const decodedOption = yield* testCase.decodeOption(option);
          expectHeader(decodedOption, testCase.headerName, P.isString(option) ? option : undefined);
        }),
        { arbitrary: fcRuns(25) }
      );

      it.effect(
        "fails on invalid createValue input",
        Effect.fnUntraced(function* () {
          const flip2 = yield* Effect.flip(testCase.createInvalid());
          pipe(flip2, testCase.isError, assertTrue);
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

      const decodedExpectCTHeader = yield* decodeExpectCTHeader(encoded);
      expectHeader(decodedExpectCTHeader, "Expect-CT", expected);
      const exit3 = yield* Effect.exit(ExpectCTHeader.createValue(encoded).pipe(Effect.orDie));
      assertExitSuccess(exit3, O.some(expected));
    })
  );

  it.effect("handles Expect-CT disabled and default-enabled forms", () =>
    Effect.gen(function* () {
      const decodedExpectCTHeader4 = yield* decodeExpectCTHeader(undefined);
      expectHeader(decodedExpectCTHeader4, "Expect-CT", undefined);
      const decodedExpectCTHeader5 = yield* decodeExpectCTHeader(false);
      expectHeader(decodedExpectCTHeader5, "Expect-CT", undefined);
      const decodedExpectCTHeader6 = yield* decodeExpectCTHeader(true);
      expectHeader(decodedExpectCTHeader6, "Expect-CT", "max-age=86400");
      const decodedExpectCTHeader7 = yield* decodeExpectCTHeader([true, {}]);
      expectHeader(decodedExpectCTHeader7, "Expect-CT", "max-age=86400");
      const decodedExpectCTHeader8 = yield* decodeExpectCTHeader([true, { enforce: false }]);
      expectHeader(decodedExpectCTHeader8, "Expect-CT", "max-age=86400");

      const pipe9 = yield* ExpectCTHeader.createValue().pipe(Effect.orDie);
      assertNone(pipe9);
      const pipe10 = yield* ExpectCTHeader.createValue(false).pipe(Effect.orDie);
      assertNone(pipe10);
      const pipe11 = yield* ExpectCTHeader.createValue(true).pipe(Effect.orDie);
      assertSome(pipe11, "max-age=86400");
      const pipe12 = yield* ExpectCTHeader.create(false).pipe(Effect.orDie);
      pipe(pipe12, assertNone);
      const flip13 = yield* Effect.flip(
        ExpectCTHeader.createValue([
          true,
          {
            reportURI: "not-a-url",
          },
        ] as const)
      );
      pipe(flip13, isExpectCtError, assertTrue);
      const flip14 = yield* Effect.flip(ExpectCTHeader.createValue([true, { maxAge: -1 }] as never));
      pipe(flip14, isExpectCtError, assertTrue);
    })
  );

  it.effect("formats HSTS defaults and tuple options", () =>
    Effect.gen(function* () {
      const decodedForceHttpsRedirectHeader = yield* decodeForceHttpsRedirectHeader(undefined);
      expectHeader(decodedForceHttpsRedirectHeader, "Strict-Transport-Security", "max-age=63072000");
      const pipe15 = yield* ForceHttpsRedirectHeader.createValue([
        true,
        ForceHttpsRedirectConfig.make({ maxAge: 120, includeSubDomains: true, preload: true }),
      ]).pipe(Effect.orDie);
      assertSome(pipe15, "max-age=120; includeSubDomains; preload");
      const pipe16 = yield* ForceHttpsRedirectHeader.createValue(false).pipe(Effect.orDie);
      assertNone(pipe16);
      const flip17 = yield* Effect.flip(ForceHttpsRedirectHeader.createValue([true, { maxAge: -1 }] as never));
      pipe(flip17, isForceHttpsRedirectError, assertTrue);
    })
  );

  it.effect("handles HSTS direct, disabled, and sparse tuple forms", () =>
    Effect.gen(function* () {
      const decodedForceHttpsRedirectHeader18 = yield* decodeForceHttpsRedirectHeader(false);
      expectHeader(decodedForceHttpsRedirectHeader18, "Strict-Transport-Security", undefined);
      const decodedForceHttpsRedirectHeader19 = yield* decodeForceHttpsRedirectHeader(true);
      expectHeader(decodedForceHttpsRedirectHeader19, "Strict-Transport-Security", "max-age=63072000");
      const decodedForceHttpsRedirectHeader20 = yield* decodeForceHttpsRedirectHeader([true, {}]);
      expectHeader(decodedForceHttpsRedirectHeader20, "Strict-Transport-Security", "max-age=63072000");
      const decodedForceHttpsRedirectHeader21 = yield* decodeForceHttpsRedirectHeader([true, { maxAge: 120 }]);
      expectHeader(decodedForceHttpsRedirectHeader21, "Strict-Transport-Security", "max-age=120");

      const pipe22 = yield* ForceHttpsRedirectHeader.createValue().pipe(Effect.orDie);
      assertSome(pipe22, "max-age=63072000");
      const pipe23 = yield* ForceHttpsRedirectHeader.createValue(true).pipe(Effect.orDie);
      assertSome(pipe23, "max-age=63072000");
      const pipe24 = yield* ForceHttpsRedirectHeader.create(false).pipe(Effect.orDie);
      pipe(pipe24, assertNone);
    })
  );

  it.effect("formats Frame-Guard allow-from values", () =>
    Effect.gen(function* () {
      const option = ["allow-from", FrameGuardAllowFromConfig.make({ uri: "https://example.com/frame" })] as const;

      const decodedFrameGuardHeader = yield* decodeFrameGuardHeader(option);
      expectHeader(decodedFrameGuardHeader, "X-Frame-Options", "allow-from https://example.com/frame");
      const pipe25 = yield* FrameGuardHeader.createValue(option).pipe(Effect.orDie);
      assertSome(pipe25, "allow-from https://example.com/frame");
    })
  );

  it.effect("handles Frame-Guard default, direct, disabled, and invalid allow-from forms", () =>
    Effect.gen(function* () {
      const decodedFrameGuardHeader26 = yield* decodeFrameGuardHeader(undefined);
      expectHeader(decodedFrameGuardHeader26, "X-Frame-Options", "deny");
      const decodedFrameGuardHeader27 = yield* decodeFrameGuardHeader(false);
      expectHeader(decodedFrameGuardHeader27, "X-Frame-Options", undefined);
      const decodedFrameGuardHeader28 = yield* decodeFrameGuardHeader("deny");
      expectHeader(decodedFrameGuardHeader28, "X-Frame-Options", "deny");
      const decodedFrameGuardHeader29 = yield* decodeFrameGuardHeader("sameorigin");
      expectHeader(decodedFrameGuardHeader29, "X-Frame-Options", "sameorigin");

      const pipe30 = yield* FrameGuardHeader.createValue().pipe(Effect.orDie);
      assertSome(pipe30, "deny");
      const pipe31 = yield* FrameGuardHeader.createValue(false).pipe(Effect.orDie);
      assertNone(pipe31);
      const pipe32 = yield* FrameGuardHeader.createValue("sameorigin").pipe(Effect.orDie);
      assertSome(pipe32, "sameorigin");
      const pipe33 = yield* FrameGuardHeader.create(false).pipe(Effect.orDie);
      pipe(pipe33, assertNone);
      const flip34 = yield* Effect.flip(FrameGuardHeader.createValue(["allow-from", { uri: "not-a-url" }] as never));
      pipe(flip34, isFrameGuardError, assertTrue);
    })
  );

  it.effect("fails header decoding when a configured report or allow-from URI is invalid", () =>
    Effect.gen(function* () {
      const exit35 = yield* Effect.exit(decodeFrameGuardHeader(["allow-from", { uri: "not-a-url" }]));
      pipe(exit35, Exit.isFailure, assertTrue);
      const exit36 = yield* Effect.exit(decodeExpectCTHeader([true, { reportURI: "not-a-url" }]));
      pipe(exit36, Exit.isFailure, assertTrue);
      const exit37 = yield* Effect.exit(decodeXSSProtectionHeader(["report", { uri: "not-a-url" }]));
      pipe(exit37, Exit.isFailure, assertTrue);
    })
  );

  it.effect("uses secure defaults for NoOpen, NoSniff, and permitted cross-domain policies", () =>
    Effect.gen(function* () {
      const decodedNoOpenHeader = yield* decodeNoOpenHeader(undefined);
      expectHeader(decodedNoOpenHeader, "X-Download-Options", "noopen");
      const decodedNoSniffHeader = yield* decodeNoSniffHeader(undefined);
      expectHeader(decodedNoSniffHeader, "X-Content-Type-Options", "nosniff");
      const decodedPermittedCrossDomainPoliciesHeader = yield* decodePermittedCrossDomainPoliciesHeader(undefined);
      expectHeader(decodedPermittedCrossDomainPoliciesHeader, "X-Permitted-Cross-Domain-Policies", "none");

      const pipe38 = yield* NoOpenHeader.createValue().pipe(Effect.orDie);
      assertSome(pipe38, "noopen");
      const pipe39 = yield* NoSniffHeader.createValue().pipe(Effect.orDie);
      assertSome(pipe39, "nosniff");
      const pipe40 = yield* PermittedCrossDomainPoliciesHeader.createValue().pipe(Effect.orDie);
      assertSome(pipe40, "none");
    })
  );

  it.effect("disables and validates one-value security headers", () =>
    Effect.gen(function* () {
      const decodedNoOpenHeader41 = yield* decodeNoOpenHeader(false);
      expectHeader(decodedNoOpenHeader41, "X-Download-Options", undefined);
      const decodedNoSniffHeader42 = yield* decodeNoSniffHeader(false);
      expectHeader(decodedNoSniffHeader42, "X-Content-Type-Options", undefined);
      const decodedPermittedCrossDomainPoliciesHeader43 = yield* decodePermittedCrossDomainPoliciesHeader(false);
      expectHeader(decodedPermittedCrossDomainPoliciesHeader43, "X-Permitted-Cross-Domain-Policies", undefined);
      const decodedNoOpenHeader44 = yield* decodeNoOpenHeader("noopen");
      expectHeader(decodedNoOpenHeader44, "X-Download-Options", "noopen");
      const decodedNoSniffHeader45 = yield* decodeNoSniffHeader("nosniff");
      expectHeader(decodedNoSniffHeader45, "X-Content-Type-Options", "nosniff");
      const decodedPermittedCrossDomainPoliciesHeader46 =
        yield* decodePermittedCrossDomainPoliciesHeader("master-only");
      expectHeader(decodedPermittedCrossDomainPoliciesHeader46, "X-Permitted-Cross-Domain-Policies", "master-only");

      const pipe47 = yield* NoOpenHeader.createValue(false).pipe(Effect.orDie);
      assertNone(pipe47);
      const pipe48 = yield* NoSniffHeader.createValue(false).pipe(Effect.orDie);
      assertNone(pipe48);
      const pipe49 = yield* PermittedCrossDomainPoliciesHeader.createValue(false).pipe(Effect.orDie);
      assertNone(pipe49);
      const pipe50 = yield* NoOpenHeader.create(false).pipe(Effect.orDie);
      pipe(pipe50, assertNone);
      const pipe51 = yield* NoSniffHeader.create(false).pipe(Effect.orDie);
      pipe(pipe51, assertNone);
      const pipe52 = yield* PermittedCrossDomainPoliciesHeader.create(false).pipe(Effect.orDie);
      pipe(pipe52, assertNone);
      const pipe53 = yield* PermittedCrossDomainPoliciesHeader.createValue("all").pipe(Effect.orDie);
      assertSome(pipe53, "all");

      const flip54 = yield* Effect.flip(NoOpenHeader.createValue("invalid" as never));
      pipe(flip54, isNoOpenError, assertTrue);
      const flip55 = yield* Effect.flip(NoSniffHeader.createValue("invalid" as never));
      pipe(flip55, isNoSniffError, assertTrue);
      const flip56 = yield* Effect.flip(PermittedCrossDomainPoliciesHeader.createValue("invalid" as never));
      pipe(flip56, isPermittedCrossDomainPoliciesError, assertTrue);
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

      const decodedPermissionsPolicyHeader = yield* decodePermissionsPolicyHeader(option);
      expectHeader(
        decodedPermissionsPolicyHeader,
        "Permissions-Policy",
        'camera=(), microphone=(self), geolocation=("https://example.com")'
      );
      const pipe57 = yield* PermissionsPolicyHeader.createValue(option).pipe(Effect.orDie);
      assertSome(pipe57, 'camera=(), microphone=(self), geolocation=("https://example.com")');
      const invalid = yield* Effect.flip(
        PermissionsPolicyHeader.createValue({
          directives: {
            "invalid-directive": "none",
          } as never,
        })
      );
      pipe(invalid, isPermissionsPolicyError, assertTrue);
      const flip58 = yield* Effect.flip(
        decodePermissionsPolicyHeader({
          directives: {
            camera: "none",
            "invalid-directive": "none",
          },
        })
      );
      pipe(flip58, S.isSchemaError, assertTrue);
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

      const decodedPermissionsPolicyHeader59 = yield* decodePermissionsPolicyHeader(undefined);
      expectHeader(decodedPermissionsPolicyHeader59, "Permissions-Policy", undefined);
      const decodedPermissionsPolicyHeader60 = yield* decodePermissionsPolicyHeader(false);
      expectHeader(decodedPermissionsPolicyHeader60, "Permissions-Policy", undefined);
      const decodedPermissionsPolicyHeader61 = yield* decodePermissionsPolicyHeader({ directives: {} });
      expectHeader(decodedPermissionsPolicyHeader61, "Permissions-Policy", undefined);
      const decodedPermissionsPolicyHeader62 = yield* decodePermissionsPolicyHeader(option);
      expectHeader(
        decodedPermissionsPolicyHeader62,
        "Permissions-Policy",
        'autoplay=*, fullscreen=(self "https://example.com"), payment=("https://pay.example")'
      );

      const pipe63 = yield* PermissionsPolicyHeader.createValue().pipe(Effect.orDie);
      assertNone(pipe63);
      const pipe64 = yield* PermissionsPolicyHeader.createValue(false).pipe(Effect.orDie);
      assertNone(pipe64);
      const pipe65 = yield* PermissionsPolicyHeader.createValue({ directives: {} }).pipe(Effect.orDie);
      assertNone(pipe65);
      const pipe66 = yield* PermissionsPolicyHeader.createValue(option).pipe(Effect.orDie);
      assertSome(pipe66, 'autoplay=*, fullscreen=(self "https://example.com"), payment=("https://pay.example")');
      const pipe67 = yield* PermissionsPolicyHeader.create({ directives: {} }).pipe(Effect.orDie);
      pipe(pipe67, assertNone);
    })
  );

  it.effect("joins multiple referrer-policy values and rejects unsafe-url", () =>
    Effect.gen(function* () {
      const option = ["no-referrer", "origin", "strict-origin-when-cross-origin"] as const;

      const decodedReferrerPolicyHeader = yield* decodeReferrerPolicyHeader(option);
      expectHeader(
        decodedReferrerPolicyHeader,
        "Referrer-Policy",
        "no-referrer, origin, strict-origin-when-cross-origin"
      );
      const pipe68 = yield* ReferrerPolicyHeader.createValue(option).pipe(Effect.orDie);
      assertSome(pipe68, "no-referrer, origin, strict-origin-when-cross-origin");
      const flip69 = yield* Effect.flip(ReferrerPolicyHeader.createValue("unsafe-url" as never));
      pipe(flip69, isReferrerPolicyError, assertTrue);
    })
  );

  it.effect("renders X-XSS-Protection modes including report", () =>
    Effect.gen(function* () {
      const reportOption = ["report", XSSProtectionReportConfig.make({ uri: "https://example.com/report" })] as const;

      const decodedXSSProtectionHeader = yield* decodeXSSProtectionHeader(undefined);
      expectHeader(decodedXSSProtectionHeader, "X-XSS-Protection", "1");
      const decodedXSSProtectionHeader70 = yield* decodeXSSProtectionHeader(false);
      expectHeader(decodedXSSProtectionHeader70, "X-XSS-Protection", "0");
      const decodedXSSProtectionHeader71 = yield* decodeXSSProtectionHeader(reportOption);
      expectHeader(decodedXSSProtectionHeader71, "X-XSS-Protection", "1; report=https://example.com/report");

      const pipe72 = yield* XSSProtectionHeader.createValue(false).pipe(Effect.orDie);
      assertSome(pipe72, "0");
      const pipe73 = yield* XSSProtectionHeader.createValue(reportOption).pipe(Effect.orDie);
      assertSome(pipe73, "1; report=https://example.com/report");
    })
  );

  it.effect("renders CSP values and switches to the report-only header name", () =>
    Effect.gen(function* () {
      const option: ContentSecurityPolicyOption = ContentSecurityPolicyOptionStruct.make({
        directives: {
          scriptSrc: "'self'",
          reportURI: "https://example.com/csp",
        },
        reportOnly: true,
      });

      const decodedContentSecurityPolicyHeader = yield* decodeContentSecurityPolicyHeader(option);
      expectHeader(
        decodedContentSecurityPolicyHeader,
        "Content-Security-Policy-Report-Only",
        "script-src 'self'; report-uri https://example.com/csp"
      );
      const pipe74 = yield* ContentSecurityPolicyHeader.createValue(option).pipe(Effect.orDie);
      assertSome(pipe74, "script-src 'self'; report-uri https://example.com/csp");
      const pipe75 = yield* ContentSecurityPolicyHeader.create(option).pipe(Effect.orDie);
      expectSomeHeader(
        pipe75,
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
      assertSome(
        createContentSecurityPolicyOptionHeaderValue(
          ContentSecurityPolicyOptionStruct.make({ directives: { sandbox: true } })
        ),
        "sandbox"
      );
      const decodedContentSecurityPolicyHeader76 = yield* decodeContentSecurityPolicyHeader(undefined);
      expectHeader(decodedContentSecurityPolicyHeader76, "Content-Security-Policy", undefined);
      const decodedContentSecurityPolicyHeader77 = yield* decodeContentSecurityPolicyHeader(false);
      expectHeader(decodedContentSecurityPolicyHeader77, "Content-Security-Policy", undefined);
      const pipe78 = yield* ContentSecurityPolicyHeader.createValue().pipe(Effect.orDie);
      assertNone(pipe78);
      const pipe79 = yield* ContentSecurityPolicyHeader.createValue(false).pipe(Effect.orDie);
      assertNone(pipe79);
      const pipe80 = yield* ContentSecurityPolicyHeader.create().pipe(Effect.orDie);
      pipe(pipe80, assertNone);
      const pipe81 = yield* ContentSecurityPolicyHeader.create(false).pipe(Effect.orDie);
      pipe(pipe81, assertNone);

      const emptyDecode = yield* Effect.flip(decodeContentSecurityPolicyHeader({ directives: {} }));
      pipe(emptyDecode, S.isSchemaError, assertTrue);
    })
  );
});

describe("Secure header aggregates", () => {
  it.effect("creates the default secure headers object", () =>
    Effect.gen(function* () {
      const pipe82 = yield* createHeadersObject().pipe(Effect.orDie);
      return expect(pipe82).toEqual({
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
      const result = yield* createHeadersObject(
        SecureHeaderOptions.make({
          frameGuard: "sameorigin",
          referrerPolicy: "same-origin",
          noopen: false,
          nosniff: false,
          contentSecurityPolicy: ContentSecurityPolicyOptionStruct.make({
            directives: {
              scriptSrc: "'self'",
            },
          }),
          expectCT: [true, { maxAge: 123, reportURI: "https://example.com/report" }],
        })
      ).pipe(Effect.orDie);

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
      const result = yield* createSecureHeaders(SecureHeaderOptions.make({ frameGuard: "sameorigin" })).pipe(
        Effect.orDie
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
