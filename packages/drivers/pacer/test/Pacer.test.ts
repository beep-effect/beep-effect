/**
 * Tests for the PACER driver.
 *
 * Two styles, per the repo's preference for generated-over-hardcoded data:
 *  - **Generated samples** (`Schema.toArbitrary` + `FastCheck.sample`) for
 *    schema round-trips, plus property checks for status/loginResult mappings.
 *  - **End-to-end** (`it.effect`) for the auth → search → logout spine and the
 *    typed error paths over the deterministic mock transport.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Pacer from "@beep/pacer";
import * as HttpStatus from "@beep/schema/HttpStatus";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Match, pipe, Redacted, Ref, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";

const cfg = Pacer.mockPacerConfig();
const initialToken = Str.repeat(128)("Q");
const rotatedToken = Str.repeat(128)("R");

const mockLayer = (options: Parameters<typeof Pacer.makePacerMockHttpClient>[0] = {}) =>
  Pacer.makePacerLayer(cfg, Pacer.makePacerMockHttpClient(options)).full;

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const roundTrips = Effect.fn("PacerTest.roundTrips")(function* <Schema extends S.Constraint>(
  schema: Schema,
  value: Schema["Type"]
) {
  const encoded = yield* S.encodeEffect(schema)(value);
  const decoded = yield* S.decodeUnknownEffect(schema)(encoded);
  expect(yield* S.encodeEffect(schema)(decoded)).toEqual(encoded);
});

const sampleSchemaValues = <Schema extends S.Constraint>(schema: Schema, seed: number): ReadonlyArray<Schema["Type"]> =>
  fc.sample(S.toArbitrary(schema), { numRuns: 24, seed });

const CourtCaseSearchDtoArbitrary = S.toArbitrary(Pacer.CourtCaseSearchDto);

const assertRoundTrips = Effect.fn("PacerTest.assertRoundTrips")(function* <Schema extends S.Constraint>(
  schema: Schema,
  values: ReadonlyArray<Schema["Type"]>
) {
  yield* Effect.forEach(values, (value) => roundTrips(schema, value), { discard: true });
});

const findFirstCasesPage = Effect.fnUntraced(function* () {
  const pcl = yield* Pacer.PclClient;
  yield* pcl.findCasesPage(Pacer.CourtCaseSearchDto.make({}), 0);
});

describe("PACER schema round-trips (generated)", () => {
  it.effect(
    "CourtCaseSearchDto round-trips",
    Effect.fnUntraced(function* () {
      yield* assertRoundTrips(Pacer.CourtCaseSearchDto, sampleSchemaValues(Pacer.CourtCaseSearchDto, 1001));
    })
  );

  it.effect(
    "PartySearchDto round-trips",
    Effect.fnUntraced(function* () {
      yield* assertRoundTrips(Pacer.PartySearchDto, sampleSchemaValues(Pacer.PartySearchDto, 1002));
    })
  );

  it.effect(
    "CaseReportList round-trips",
    Effect.fnUntraced(function* () {
      yield* assertRoundTrips(Pacer.CaseReportList, sampleSchemaValues(Pacer.CaseReportList, 1003));
    })
  );

  it.effect(
    "ReportInfoType round-trips",
    Effect.fnUntraced(function* () {
      yield* assertRoundTrips(Pacer.ReportInfoType, sampleSchemaValues(Pacer.ReportInfoType, 1004));
    })
  );

  it("CourtCaseSearchDto arbitrary values round-trip", () =>
    fc.assert(
      fc.property(CourtCaseSearchDtoArbitrary, (value) => Effect.runSync(roundTrips(Pacer.CourtCaseSearchDto, value)))
    ));
});

describe("PACER error mappings (property-based)", () => {
  const statusArbitrary = fc.constantFrom(
    HttpStatus.BadRequest.literal,
    HttpStatus.Unauthorized.literal,
    HttpStatus.NotFound.literal,
    HttpStatus.NotAcceptable.literal,
    HttpStatus.TooManyRequests.literal,
    HttpStatus.InternalServerError.literal,
    HttpStatus.ServiceUnavailable.literal
  );

  const expectedPclReason = (status: number): Pacer.PacerPclErrorReason =>
    Match.value(status).pipe(
      Match.when(HttpStatus.BadRequest.literal, () => Pacer.PacerPclErrorReason.Enum["bad-request"]),
      Match.when(HttpStatus.Unauthorized.literal, () => Pacer.PacerPclErrorReason.Enum.unauthorized),
      Match.when(HttpStatus.NotFound.literal, () => Pacer.PacerPclErrorReason.Enum["not-found"]),
      Match.when(HttpStatus.NotAcceptable.literal, () => Pacer.PacerPclErrorReason.Enum["invalid-parameter"]),
      Match.when(HttpStatus.TooManyRequests.literal, () => Pacer.PacerPclErrorReason.Enum["too-many-requests"]),
      Match.orElse(() => Pacer.PacerPclErrorReason.Enum["server-error"])
    );

  it.prop(
    "fromStatus maps any HTTP status to the right typed PacerPclError",
    { status: statusArbitrary },
    ({ status }) => {
      const error = Pacer.PacerPclError.fromStatus(status);
      expect(error._tag).toBe("PacerPclError");
      expect(error.reason).toBe(expectedPclReason(status));
      expect(error.status).toBe(status);
    }
  );

  it.prop(
    "fromLoginResult maps any loginResult code to the right typed PacerAuthError",
    { code: fc.constantFrom("0", "1", "13", "7", "99") },
    ({ code }) => {
      const error = Pacer.PacerAuthError.fromLoginResult(code);
      const expected =
        code === "1" ? "redaction-flag-required" : code === "13" ? "invalid-credentials" : "login-failed";
      expect(error.reason).toBe(expected);
      expect(error.loginResult).toBe(code);
    }
  );
});

describe("PACER end-to-end (mock transport)", () => {
  it.layer(mockLayer())("happy path", (it) =>
    it.effect(
      "streams every /cases/find page and decodes /parties/find",
      Effect.fnUntraced(function* () {
        const pcl = yield* Pacer.PclClient;
        const cases = yield* Stream.runCollect(pcl.streamCases(Pacer.CourtCaseSearchDto.make({})));
        expect(cases.length).toBe(Pacer.PACER_MOCK_TOTAL_CASES);
        const parties = yield* pcl.findParties(Pacer.PartySearchDto.make({ lastName: O.some("Henderson") }));
        expect(
          pipe(
            parties.content,
            O.getOrElse(() => [])
          ).length
        ).toBe(1);
      })
    )
  );

  const requestHeaders = Ref.makeUnsafe<ReadonlyArray<Readonly<Record<string, string>>>>([]);
  it.layer(mockLayer({ requestHeaders, requireClientCode: true, rotateNextGenCso: rotatedToken }))(
    "token/header behavior",
    (it) =>
      it.effect(
        "injects client-code and rotates X-NEXT-GEN-CSO from PCL responses",
        Effect.fnUntraced(function* () {
          const pcl = yield* Pacer.PclClient;
          const session = yield* Pacer.PacerSession;
          yield* pcl.findCasesPage(Pacer.CourtCaseSearchDto.make({}), 0);
          yield* pcl.findCasesPage(Pacer.CourtCaseSearchDto.make({}), 1);
          const token = yield* Ref.get(session.tokenRef);
          expect(Redacted.value(token)).toBe(rotatedToken);
          const headers = yield* Ref.get(requestHeaders);
          expect(A.some(headers, (header) => header["x-client-code"] === "MOCK-CLIENT-CODE")).toBe(true);
          expect(A.some(headers, (header) => header["x-next-gen-cso"] === initialToken)).toBe(true);
          expect(A.some(headers, (header) => header["x-next-gen-cso"] === rotatedToken)).toBe(true);
        })
      )
  );

  const deletedReportIds = Ref.makeUnsafe<ReadonlyArray<number>>([]);
  it.layer(mockLayer({ deletedReportIds }))("batch success", (it) =>
    it.effect(
      "runs the batch download lifecycle and deletes the report on exit",
      Effect.fnUntraced(function* () {
        const pcl = yield* Pacer.PclClient;
        const downloaded = yield* pcl.downloadCases(
          Pacer.CourtCaseSearchDto.make({ caseNumberFull: O.some("1:2002bk20340") })
        );
        expect(downloaded.length).toBe(Pacer.PACER_MOCK_DOWNLOAD_CASES);
        expect(yield* Ref.get(deletedReportIds)).toEqual([Pacer.DEFAULT_REPORT_ID]);
      })
    )
  );

  it.effect(
    "logs out through the session finalizer",
    Effect.fnUntraced(function* () {
      const logoutCount = yield* Ref.make(0);
      const logoutTokens = yield* Ref.make<ReadonlyArray<string>>([]);
      yield* provideScopedLayer(mockLayer({ logoutCount, logoutTokens, rotateNextGenCso: rotatedToken }))(
        findFirstCasesPage()
      );
      expect(yield* Ref.get(logoutCount)).toBe(1);
      expect(yield* Ref.get(logoutTokens)).toEqual([rotatedToken]);
    })
  );

  it.layer(Pacer.makePacerLayer(cfg, Pacer.makePacerMockHttpClient({ logout: "invalid" })).auth)(
    "logout failure",
    (it) =>
      it.effect(
        "logout maps body-level cso-logout failure to a typed PacerAuthError",
        Effect.fnUntraced(function* () {
          const auth = yield* Pacer.PacerAuth;
          const token = yield* auth.login;
          const error = yield* Effect.flip(auth.logout(token));
          expect(error._tag).toBe("PacerAuthError");
          expect(error.reason).toBe("invalid-credentials");
        })
      )
  );

  it.layer(Pacer.makePacerLayer(cfg, Pacer.makePacerMockHttpClient({ auth: "invalid" })).auth)("auth failure", (it) =>
    it.effect(
      "login maps loginResult 13 to a typed PacerAuthError",
      Effect.fnUntraced(function* () {
        const auth = yield* Pacer.PacerAuth;
        const error = yield* Effect.flip(auth.login);
        expect(error._tag).toBe("PacerAuthError");
        expect(error.reason).toBe("invalid-credentials");
      })
    )
  );

  it.layer(mockLayer({ cases: "invalid-parameter" }))("pcl validation error", (it) =>
    it.effect(
      "maps HTTP 406 to a typed PacerPclError",
      Effect.fnUntraced(function* () {
        const pcl = yield* Pacer.PclClient;
        const error = yield* Effect.flip(pcl.findCasesPage(Pacer.CourtCaseSearchDto.make({}), 0));
        expect(error._tag).toBe("PacerPclError");
        expect(error.reason).toBe("invalid-parameter");
        expect(error.status).toBe(406);
      })
    )
  );

  it.layer(mockLayer({ cases: "never-last" }))("pagination cap", (it) =>
    it.effect(
      "fails when pagination exceeds the hard page cap",
      Effect.fnUntraced(function* () {
        const pcl = yield* Pacer.PclClient;
        const error = yield* Stream.runDrain(pcl.streamCases(Pacer.CourtCaseSearchDto.make({}))).pipe(Effect.flip);
        expect(error._tag).toBe("PacerPclError");
        expect(error.reason).toBe("server-error");
        expect(error.cause).toBe("pagination exceeded max pages");
      })
    )
  );

  const failedBatchDeletedReportIds = Ref.makeUnsafe<ReadonlyArray<number>>([]);
  it.layer(mockLayer({ batch: "failed", deletedReportIds: failedBatchDeletedReportIds }))("batch failure", (it) =>
    it.effect(
      "downloadCases fails with a typed PacerPclError when the report FAILS and still deletes the report",
      Effect.fnUntraced(function* () {
        const pcl = yield* Pacer.PclClient;
        const error = yield* Effect.flip(pcl.downloadCases(Pacer.CourtCaseSearchDto.make({})));
        expect(error._tag).toBe("PacerPclError");
        expect(error.reason).toBe("server-error");
        expect(yield* Ref.get(failedBatchDeletedReportIds)).toEqual([Pacer.DEFAULT_REPORT_ID]);
      })
    )
  );

  const cleanupFailureDeletedReportIds = Ref.makeUnsafe<ReadonlyArray<number>>([]);
  it.layer(mockLayer({ deleteReport: "failed", deletedReportIds: cleanupFailureDeletedReportIds }))(
    "batch cleanup failure",
    (it) =>
      it.effect(
        "downloadCases returns successful results when best-effort delete cleanup fails",
        Effect.fnUntraced(function* () {
          const pcl = yield* Pacer.PclClient;
          const downloaded = yield* pcl.downloadCases(Pacer.CourtCaseSearchDto.make({}));
          expect(downloaded.length).toBe(Pacer.PACER_MOCK_DOWNLOAD_CASES);
          expect(yield* Ref.get(cleanupFailureDeletedReportIds)).toEqual([Pacer.DEFAULT_REPORT_ID]);
        })
      )
  );

  const invalidReportDeletedSegments = Ref.makeUnsafe<ReadonlyArray<string>>([]);
  it.layer(mockLayer({ reportId: "abc", deletedReportPathSegments: invalidReportDeletedSegments }))(
    "invalid report id cleanup",
    (it) =>
      it.effect(
        "downloadCases still attempts delete cleanup when the server returns an invalid report id",
        Effect.fnUntraced(function* () {
          const pcl = yield* Pacer.PclClient;
          const error = yield* Effect.flip(pcl.downloadCases(Pacer.CourtCaseSearchDto.make({})));
          expect(error._tag).toBe("PacerPclError");
          expect(error.reason).toBe("server-error");
          expect(error.cause).toBe("invalid reportId from server");
          expect(yield* Ref.get(invalidReportDeletedSegments)).toEqual(["abc"]);
        })
      )
  );

  const invalidNumberReportDeletedSegments = Ref.makeUnsafe<ReadonlyArray<string>>([]);
  it.layer(mockLayer({ reportId: 3.14, deletedReportPathSegments: invalidNumberReportDeletedSegments }))(
    "fractional report id cleanup",
    (it) =>
      it.effect(
        "downloadCases attempts delete cleanup for fractional server report ids before failing validation",
        Effect.fnUntraced(function* () {
          const pcl = yield* Pacer.PclClient;
          const error = yield* Effect.flip(pcl.downloadCases(Pacer.CourtCaseSearchDto.make({})));
          expect(error._tag).toBe("PacerPclError");
          expect(error.reason).toBe("server-error");
          expect(error.cause).toBe("invalid reportId from server");
          expect(yield* Ref.get(invalidNumberReportDeletedSegments)).toEqual(["3.14"]);
        })
      )
  );

  it.layer(mockLayer({ deleteReport: "failed" }))("direct batch cleanup failure", (it) =>
    it.effect(
      "deleteCaseReport surfaces delete failures when called directly",
      Effect.fnUntraced(function* () {
        const pcl = yield* Pacer.PclClient;
        const error = yield* Effect.flip(pcl.deleteCaseReport(Pacer.DEFAULT_REPORT_ID));
        expect(error._tag).toBe("PacerPclError");
        expect(error.reason).toBe("server-error");
        expect(error.status).toBe(500);
      })
    )
  );
});
