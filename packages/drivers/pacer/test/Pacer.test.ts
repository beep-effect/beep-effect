import { fcRuns, provideScopedLayer } from "@beep/test-utils";
/**
 * Tests for the PACER driver.
 *
 * Two styles, per the repo's preference for generated-over-hardcoded data:
 *  - **Generated samples** (`Arbitrary.schema` + `Arbitrary.sampleEffect`) for
 *    schema round-trips, plus property checks for status/loginResult mappings.
 *  - **End-to-end** (`it.effect`) for the auth → search → logout spine and the
 *    typed error paths over the deterministic mock transport.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Pacer from "@beep/pacer";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import { Cause, Deferred, Effect, Exit, Fiber, Layer, Match, pipe, Redacted, Ref, Stream } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpStatus from "effect/http/HttpStatus";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const cfg = Pacer.mockPacerConfig();
const initialToken = Str.repeat(128)("Q");
const rotatedToken = Str.repeat(128)("R");
const encodeUnknownJson = S.encodeEffect(UnknownFromJsonString);

const mockLayer = (options: Parameters<typeof Pacer.makePacerMockHttpClient>[0] = {}) =>
  Pacer.makePacerLayer(cfg, Pacer.makePacerMockHttpClient(options)).full;

const roundTrips = Effect.fn("PacerTest.roundTrips")(function* <Schema extends S.Constraint>(
  schema: Schema,
  value: Schema["Type"]
) {
  const encoded = yield* S.encodeEffect(schema)(value);
  const decoded = yield* S.decodeUnknownEffect(schema)(encoded);
  expect(yield* S.encodeEffect(schema)(decoded)).toEqual(encoded);
});

const sampleSchemaValues = <Schema extends S.Constraint>(schema: Schema, seed: number) =>
  Arbitrary.sampleEffect(Arbitrary.schema(schema), { count: 24, seed });

const CourtCaseSearchDtoArbitrary = Arbitrary.schema(Pacer.CourtCaseSearchDto);

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
      yield* assertRoundTrips(Pacer.CourtCaseSearchDto, yield* sampleSchemaValues(Pacer.CourtCaseSearchDto, 1001));
    })
  );

  it.effect(
    "PartySearchDto round-trips",
    Effect.fnUntraced(function* () {
      yield* assertRoundTrips(Pacer.PartySearchDto, yield* sampleSchemaValues(Pacer.PartySearchDto, 1002));
    })
  );

  it.effect(
    "CaseReportList round-trips",
    Effect.fnUntraced(function* () {
      yield* assertRoundTrips(Pacer.CaseReportList, yield* sampleSchemaValues(Pacer.CaseReportList, 1003));
    })
  );

  it.effect(
    "ReportInfoType round-trips",
    Effect.fnUntraced(function* () {
      yield* assertRoundTrips(Pacer.ReportInfoType, yield* sampleSchemaValues(Pacer.ReportInfoType, 1004));
    })
  );

  it.effect.prop(
    "CourtCaseSearchDto arbitrary values round-trip",
    [CourtCaseSearchDtoArbitrary],
    ([value]) => roundTrips(Pacer.CourtCaseSearchDto, value),
    { arbitrary: fcRuns() }
  );
});

describe("PACER error mappings (property-based)", () => {
  const statusArbitrary = Arbitrary.schema(
    S.Literals([
      HttpStatus.fromLiteral("BadRequest"),
      HttpStatus.fromLiteral("Unauthorized"),
      HttpStatus.fromLiteral("NotFound"),
      HttpStatus.fromLiteral("NotAcceptable"),
      HttpStatus.fromLiteral("TooManyRequests"),
      HttpStatus.fromLiteral("InternalServerError"),
      HttpStatus.fromLiteral("ServiceUnavailable"),
    ])
  );

  const expectedPclReason = (status: number): Pacer.PacerPclErrorReason =>
    Match.value(status).pipe(
      Match.when(HttpStatus.fromLiteral("BadRequest"), () => Pacer.PacerPclErrorReason.Enum["bad-request"]),
      Match.when(HttpStatus.fromLiteral("Unauthorized"), () => Pacer.PacerPclErrorReason.Enum.unauthorized),
      Match.when(HttpStatus.fromLiteral("NotFound"), () => Pacer.PacerPclErrorReason.Enum["not-found"]),
      Match.when(HttpStatus.fromLiteral("NotAcceptable"), () => Pacer.PacerPclErrorReason.Enum["invalid-parameter"]),
      Match.when(HttpStatus.fromLiteral("TooManyRequests"), () => Pacer.PacerPclErrorReason.Enum["too-many-requests"]),
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
    },
    { arbitrary: fcRuns(100) }
  );

  it.prop(
    "fromLoginResult maps any loginResult code to the right typed PacerAuthError",
    { code: Arbitrary.schema(S.Literals(["0", "1", "13", "7", "99"])) },
    ({ code }) => {
      const error = Pacer.PacerAuthError.fromLoginResult(code);
      const expected =
        code === "1" ? "redaction-flag-required" : code === "13" ? "invalid-credentials" : "login-failed";
      expect(error.reason).toBe(expected);
      expect(error.loginResult).toBe(code);
    },
    { arbitrary: fcRuns(100) }
  );
});

describe("PACER end-to-end (mock transport)", () => {
  it.layer(mockLayer(), { timeout: "10 seconds" })("happy path", (it) =>
    it.effect(
      "streams every /cases/find page and decodes /parties/find",
      Effect.fnUntraced(function* () {
        const pcl = yield* Pacer.PclClient;
        const cases = yield* Stream.runCollect(pcl.streamCases(Pacer.CourtCaseSearchDto.make({}))).pipe(
          Effect.withSpan("PacerTest.pages.collect")
        );
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
  it.layer(mockLayer({ requestHeaders, requireClientCode: true, rotateNextGenCso: rotatedToken }), {
    timeout: "10 seconds",
  })("token/header behavior", (it) =>
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

  const authRequestBodies = Ref.makeUnsafe<ReadonlyArray<unknown>>([]);
  it.layer(Pacer.makePacerLayer(cfg, Pacer.makePacerMockHttpClient({ requestBodies: authRequestBodies })).auth, {
    timeout: "10 seconds",
  })("auth request body", (it) =>
    it.effect(
      "encodes login/logout request bodies without Effect Option internals",
      Effect.fnUntraced(function* () {
        const auth = yield* Pacer.PacerAuth;
        const token = yield* auth.login;
        yield* auth.logout(token);
        const bodies = yield* Ref.get(authRequestBodies);
        expect(bodies).toEqual([
          {
            clientCode: "MOCK-CLIENT-CODE",
            loginId: "mock-login-id",
            password: "mock-password",
          },
          {
            nextGenCSO: initialToken,
          },
        ]);
        const bodiesJson = yield* encodeUnknownJson(bodies);
        expect(bodiesJson).not.toContain("_tag");
        expect(bodiesJson).not.toContain("_id");
      })
    )
  );

  const deletedReportIds = Ref.makeUnsafe<ReadonlyArray<number>>([]);
  it.layer(mockLayer({ deletedReportIds }), { timeout: "10 seconds" })("batch success", (it) =>
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

  it.effect.each(["success", "failed"])(
    "deletes the report when polling is interrupted (delete %s)",
    Effect.fnUntraced(function* (deleteReport) {
      const deleted = yield* Ref.make<ReadonlyArray<number>>([]);
      const polling = yield* Deferred.make<void>();
      const transport = Layer.effect(
        HttpClient.HttpClient,
        Effect.gen(function* () {
          const client = yield* HttpClient.HttpClient;
          return HttpClient.transform(client, (response, request) =>
            Str.includes("/cases/download/status/")(request.url)
              ? Deferred.succeed(polling, undefined).pipe(Effect.andThen(Effect.never))
              : response
          );
        })
      ).pipe(
        Layer.provide(
          Pacer.makePacerMockHttpClient({
            deletedReportIds: deleted,
            deleteReport: deleteReport === "failed" ? "failed" : "success",
          })
        )
      );
      yield* provideScopedLayer(Pacer.makePacerLayer(cfg, transport).full)(
        Effect.gen(function* () {
          const pcl = yield* Pacer.PclClient;
          const fiber = yield* pcl.downloadCases(Pacer.CourtCaseSearchDto.make({})).pipe(Effect.forkChild);
          // Reaching status proves acquisition completed. No timing-based race or real endpoint.
          yield* Deferred.await(polling).pipe(Effect.withSpan("PacerTest.batch.pollingStarted"));
          yield* Fiber.interrupt(fiber).pipe(Effect.withSpan("PacerTest.batch.interruptAndCleanup"));
          expect(Exit.hasInterrupts(yield* Fiber.await(fiber))).toBe(true);
          expect(yield* Ref.get(deleted)).toEqual([Pacer.DEFAULT_REPORT_ID]);
        })
      );
    })
  );

  it.effect(
    "deletes the report when polling defects and preserves the defect",
    Effect.fnUntraced(function* () {
      const deleted = yield* Ref.make<ReadonlyArray<number>>([]);
      const defect = "controlled polling defect";
      const transport = Layer.effect(
        HttpClient.HttpClient,
        Effect.gen(function* () {
          const client = yield* HttpClient.HttpClient;
          return HttpClient.transform(client, (response, request) =>
            Str.includes("/cases/download/status/")(request.url) ? Effect.die(defect) : response
          );
        })
      ).pipe(Layer.provide(Pacer.makePacerMockHttpClient({ deletedReportIds: deleted })));
      yield* provideScopedLayer(Pacer.makePacerLayer(cfg, transport).full)(
        Effect.gen(function* () {
          const pcl = yield* Pacer.PclClient;
          assertExitFailure(
            yield* Effect.exit(pcl.downloadCases(Pacer.CourtCaseSearchDto.make({}))),
            Cause.die(defect)
          );
          expect(yield* Ref.get(deleted)).toEqual([Pacer.DEFAULT_REPORT_ID]);
        })
      );
    })
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

  it.layer(Pacer.makePacerLayer(cfg, Pacer.makePacerMockHttpClient({ logout: "invalid" })).auth, {
    timeout: "10 seconds",
  })("logout failure", (it) =>
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

  it.layer(Pacer.makePacerLayer(cfg, Pacer.makePacerMockHttpClient({ auth: "invalid" })).auth, {
    timeout: "10 seconds",
  })("auth failure", (it) =>
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

  it.layer(mockLayer({ cases: "invalid-parameter" }), { timeout: "10 seconds" })("pcl validation error", (it) =>
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

  it.layer(mockLayer({ cases: "never-last" }), { timeout: "10 seconds" })("pagination cap", (it) =>
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
  it.layer(mockLayer({ batch: "failed", deletedReportIds: failedBatchDeletedReportIds }), { timeout: "10 seconds" })(
    "batch failure",
    (it) =>
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
  it.layer(mockLayer({ deleteReport: "failed", deletedReportIds: cleanupFailureDeletedReportIds }), {
    timeout: "10 seconds",
  })("batch cleanup failure", (it) =>
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
  it.layer(mockLayer({ reportId: "abc", deletedReportPathSegments: invalidReportDeletedSegments }), {
    timeout: "10 seconds",
  })("invalid report id cleanup", (it) =>
    it.effect(
      "downloadCases rejects invalid report ids after best-effort delete cleanup",
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

  const pathReportDeletedSegments = Ref.makeUnsafe<ReadonlyArray<string>>([]);
  it.layer(mockLayer({ reportId: "../abc?token=value", deletedReportPathSegments: pathReportDeletedSegments }), {
    timeout: "10 seconds",
  })("path-shaped report id cleanup", (it) =>
    it.effect(
      "downloadCases encodes cleanup report ids as a single path segment",
      Effect.fnUntraced(function* () {
        const pcl = yield* Pacer.PclClient;
        const error = yield* Effect.flip(pcl.downloadCases(Pacer.CourtCaseSearchDto.make({})));
        expect(error._tag).toBe("PacerPclError");
        expect(error.reason).toBe("server-error");
        expect(error.cause).toBe("invalid reportId from server");
        expect(yield* Ref.get(pathReportDeletedSegments)).toEqual(["..%2Fabc%3Ftoken%3Dvalue"]);
      })
    )
  );

  const invalidNumberReportDeletedSegments = Ref.makeUnsafe<ReadonlyArray<string>>([]);
  it.layer(mockLayer({ reportId: 3.14, deletedReportPathSegments: invalidNumberReportDeletedSegments }), {
    timeout: "10 seconds",
  })("fractional report id cleanup", (it) =>
    it.effect(
      "downloadCases rejects fractional server report ids after best-effort delete cleanup",
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

  it.layer(mockLayer({ deleteReport: "failed" }), { timeout: "10 seconds" })("direct batch cleanup failure", (it) =>
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
