/**
 * Deterministic in-memory `HttpClient` layer for the PACER driver.
 *
 * Routes on the request URL and returns schema-derived bodies from
 * `Pacer.mock-data.ts` (generated via `Schema.toArbitrary`, not hardcoded
 * JSON), so both the auth and PCL services run with no network and no
 * credentials. Options select the auth + cases error scenarios.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PacerId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Unknown } from "@beep/schema/Unknown";
import { O } from "@beep/utils";
import { Effect, Layer, Number as N, pipe, Ref } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import { CsoLogoutRequest } from "./CsoAuth.models.ts";
import {
  authInvalidBody,
  authSuccessBody,
  DEFAULT_REPORT_ID,
  defaultCasePages,
  defaultPartyBody,
  downloadResultsBody,
  invalidParameterBody,
  logoutBody,
  logoutInvalidBody,
  loopingCaseReportBody,
  reportInfoBody,
} from "./Pacer.mock-data.ts";

const $I = $PacerId.create("pacer/transport/Mock");

type MockRequest = Parameters<Parameters<typeof HttpClient.make>[0]>[0];

const MockIntFromString = S.FiniteFromString.pipe(S.check(S.isInt()), SchemaUtils.withCodecStatics);
const encodeJsonString = Unknown.encodeUnknownEffectFromJsonString;
const decodeJsonString = Unknown.decodeUnknownEffectFromJsonString;
const decodeLogoutRequestJson = S.decodeUnknownEffect(S.fromJsonString(CsoLogoutRequest));

/**
 * Authentication behavior served by the PACER mock transport.
 *
 * **Example** (Log success auth option)
 *
 * ```ts
 * import { PacerAuthOption } from "@beep/pacer"
 *
 * console.log(PacerAuthOption.Enum.success)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const PacerAuthOption = LiteralKit(["success", "invalid"]).pipe(
  $I.annoteSchema("PacerAuthOption", {
    description: "cso-auth behavior.",
  })
);

/**
 * Type for {@link PacerAuthOption}.
 *
 * **Example** (Assign invalid auth type)
 *
 * ```ts
 * import { PacerAuthOption } from "@beep/pacer"
 * import type { PacerAuthOption as PacerAuthOptionType } from "@beep/pacer"
 *
 * const option: PacerAuthOptionType = PacerAuthOption.Enum.invalid
 * console.log(option)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export type PacerAuthOption = typeof PacerAuthOption.Type;

/**
 * Batch lifecycle behavior served by the PACER mock transport.
 *
 * **Example** (Log complete batch option)
 *
 * ```ts
 * import { PacerBatchOption } from "@beep/pacer"
 *
 * console.log(PacerBatchOption.Enum.complete)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const PacerBatchOption = LiteralKit(["complete", "failed"]).pipe(
  $I.annoteSchema("PacerBatchOption", {
    description: "Batch job terminal status.",
  })
);

/**
 * Type for {@link PacerBatchOption}.
 *
 * **Example** (Assign failed batch type)
 *
 * ```ts
 * import { PacerBatchOption } from "@beep/pacer"
 * import type { PacerBatchOption as PacerBatchOptionType } from "@beep/pacer"
 *
 * const option: PacerBatchOptionType = PacerBatchOption.Enum.failed
 * console.log(option)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export type PacerBatchOption = typeof PacerBatchOption.Type;

/**
 * Stored report deletion behavior served by the PACER mock transport.
 *
 * **Example** (Log success delete option)
 *
 * ```ts
 * import { PacerDeleteReportOption } from "@beep/pacer"
 *
 * console.log(PacerDeleteReportOption.Enum.success)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const PacerDeleteReportOption = LiteralKit(["success", "failed"]).pipe(
  $I.annoteSchema("PacerDeleteReportOption", {
    description: "/cases/reports/:reportId delete behavior.",
  })
);

/**
 * Type for {@link PacerDeleteReportOption}.
 *
 * **Example** (Assign failed delete type)
 *
 * ```ts
 * import { PacerDeleteReportOption } from "@beep/pacer"
 * import type { PacerDeleteReportOption as PacerDeleteReportOptionType } from "@beep/pacer"
 *
 * const option: PacerDeleteReportOptionType = PacerDeleteReportOption.Enum.failed
 * console.log(option)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export type PacerDeleteReportOption = typeof PacerDeleteReportOption.Type;

/**
 * Logout behavior served by the PACER mock transport.
 *
 * **Example** (Log success logout option)
 *
 * ```ts
 * import { PacerLogoutOption } from "@beep/pacer"
 *
 * console.log(PacerLogoutOption.Enum.success)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const PacerLogoutOption = LiteralKit(["success", "invalid"]).pipe(
  $I.annoteSchema("PacerLogoutOption", {
    description: "cso-logout behavior.",
  })
);

/**
 * Type for {@link PacerLogoutOption}.
 *
 * **Example** (Assign invalid logout type)
 *
 * ```ts
 * import { PacerLogoutOption } from "@beep/pacer"
 * import type { PacerLogoutOption as PacerLogoutOptionType } from "@beep/pacer"
 *
 * const option: PacerLogoutOptionType = PacerLogoutOption.Enum.invalid
 * console.log(option)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export type PacerLogoutOption = typeof PacerLogoutOption.Type;

/**
 * Case search behavior served by the PACER mock transport.
 *
 * **Example** (Log invalid-parameter cases option)
 *
 * ```ts
 * import { PacerCasesOption } from "@beep/pacer"
 *
 * console.log(PacerCasesOption.Enum["invalid-parameter"])
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const PacerCasesOption = LiteralKit(["success", "invalid-parameter", "unauthorized", "never-last"]).pipe(
  $I.annoteSchema("PacerCasesOption", {
    description: "/cases/find behavior.",
  })
);

/**
 * Type for {@link PacerCasesOption}.
 *
 * **Example** (Assign never-last cases type)
 *
 * ```ts
 * import { PacerCasesOption } from "@beep/pacer"
 * import type { PacerCasesOption as PacerCasesOptionType } from "@beep/pacer"
 *
 * const option: PacerCasesOptionType = PacerCasesOption.Enum["never-last"]
 * console.log(option)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export type PacerCasesOption = typeof PacerCasesOption.Type;

/**
 * Selects which scenario the mock serves.
 *
 * **Example** (Make unauthorized mock options)
 *
 * ```ts
 * import { PacerMockOptions } from "@beep/pacer"
 *
 * const options = PacerMockOptions.make({ cases: "unauthorized" })
 * console.log(options.cases)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacerMockOptions extends S.Class<PacerMockOptions>($I`PacerMockOptions`)(
  {
    /**
     * cso-auth behavior. Defaults to `"success"`.
     */
    auth: PacerAuthOption.pipe(
      SchemaUtils.withKeyDefaults(PacerAuthOption.Enum.success),
      S.annotateKey({
        description: "cso-auth behavior. Defaults to `'success'`.",
        default: "success",
      })
    ),
    /**
     * /cases/find behavior. Defaults to `'success'`.
     */
    cases: PacerCasesOption.pipe(
      SchemaUtils.withKeyDefaults(PacerCasesOption.Enum.success),
      S.annotateKey({
        description: "/cases/find behavior. Defaults to `'success'`.",
        default: "success",
      })
    ),
    /**
     * Batch job terminal status. Defaults to `"complete"`.
     */
    batch: PacerBatchOption.pipe(
      SchemaUtils.withKeyDefaults(PacerBatchOption.Enum.complete),
      S.annotateKey({
        description: "Batch job terminal status. Defaults to `'complete'`.",
        default: "complete",
      })
    ),
    /**
     * /cases/reports/:reportId delete behavior. Defaults to `"success"`.
     */
    deleteReport: PacerDeleteReportOption.pipe(
      SchemaUtils.withKeyDefaults(PacerDeleteReportOption.Enum.success),
      S.annotateKey({
        description: "/cases/reports/:reportId delete behavior. Defaults to `'success'`.",
        default: "success",
      })
    ),
    /**
     * cso-logout behavior. Defaults to `"success"`.
     */
    logout: PacerLogoutOption.pipe(
      SchemaUtils.withKeyDefaults(PacerLogoutOption.Enum.success),
      S.annotateKey({
        description: "cso-logout behavior. Defaults to `'success'`.",
        default: "success",
      })
    ),
  },
  $I.annote("PacerMockOptions", {
    description: "Selects which scenario the mock serves.",
  })
) {}

interface PacerMockRuntimeOptions {
  readonly deletedReportIds?: Ref.Ref<ReadonlyArray<number>>;
  readonly deletedReportPathSegments?: Ref.Ref<ReadonlyArray<string>>;
  readonly logoutCount?: Ref.Ref<number>;
  readonly logoutTokens?: Ref.Ref<ReadonlyArray<string>>;
  readonly reportId?: number | string;
  readonly requestBodies?: Ref.Ref<ReadonlyArray<unknown>>;
  readonly requestHeaders?: Ref.Ref<ReadonlyArray<Readonly<Record<string, string>>>>;
  readonly requireClientCode?: boolean;
  readonly rotateNextGenCso?: string;
}

type PacerMockOptionsInput = typeof PacerMockOptions.Encoded & PacerMockRuntimeOptions;

interface PacerMockRouteContext {
  readonly casePages: ReadonlyArray<Effect.Effect<unknown, S.SchemaError>>;
  readonly options: PacerMockOptionsInput;
  readonly partyBody: Effect.Effect<unknown, S.SchemaError>;
  readonly request: MockRequest;
  readonly resolved: PacerMockOptions;
  readonly url: URL;
}

const resolveMockOptions = (options: PacerMockOptionsInput): PacerMockOptions => PacerMockOptions.make(options);

const jsonResponse = (
  request: MockRequest,
  status: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {}
): Effect.Effect<HttpClientResponse.HttpClientResponse> =>
  encodeJsonString(body).pipe(
    Effect.map((json) =>
      HttpClientResponse.fromWeb(
        request,
        new Response(json, { status, headers: { "content-type": "application/json", ...headers } })
      )
    ),
    Effect.orDie
  );

const recordRequestHeaders = (options: PacerMockOptionsInput, request: MockRequest): Effect.Effect<void> =>
  options.requestHeaders === undefined ? Effect.void : Ref.update(options.requestHeaders, A.append(request.headers));

const recordRequestBody = (options: PacerMockOptionsInput, request: MockRequest): Effect.Effect<void> =>
  pipe(
    O.fromUndefinedOr(options.requestBodies),
    O.match({
      onNone: () => Effect.void,
      onSome: (bodies) =>
        request.body._tag === "Uint8Array"
          ? decodeJsonString(new TextDecoder().decode(request.body.body)).pipe(
              Effect.flatMap((body) => Ref.update(bodies, A.append(body))),
              Effect.orDie
            )
          : Effect.void,
    })
  );

const tracedRequest = (options: PacerMockOptionsInput, request: MockRequest): Effect.Effect<void> =>
  Effect.all([recordRequestHeaders(options, request), recordRequestBody(options, request)], { discard: true });

const recordLogoutToken = (options: PacerMockOptionsInput, request: MockRequest): Effect.Effect<void> =>
  pipe(
    O.fromUndefinedOr(options.logoutTokens),
    O.match({
      onNone: () => Effect.void,
      onSome: (tokens) =>
        request.body._tag === "Uint8Array"
          ? decodeLogoutRequestJson(new TextDecoder().decode(request.body.body)).pipe(
              Effect.flatMap((body) => Ref.update(tokens, A.append(body.nextGenCSO))),
              Effect.orDie
            )
          : Effect.void,
    })
  );

const lastPathSegment = (path: string): O.Option<string> =>
  pipe(Str.split("/")(path), A.filter(Str.isNonEmpty), A.last);

const decodedLastPathInt = (path: string): O.Option<number> =>
  pipe(lastPathSegment(path), O.flatMap(MockIntFromString.decodeOption));

const selectedReportId = (options: PacerMockOptionsInput): number | string =>
  pipe(
    O.fromUndefinedOr(options.reportId),
    O.getOrElse(() => DEFAULT_REPORT_ID)
  );

const selectedPage = (pageCount: number, rawPage: string | null): number =>
  pipe(
    O.fromNullishOr(rawPage),
    O.orElse(() => O.some("0")),
    O.flatMap(MockIntFromString.decodeOption),
    O.map(N.clamp({ minimum: 0, maximum: pageCount - 1 })),
    O.getOrElse(() => 0)
  );

const responseFromEncodedBody = (
  request: MockRequest,
  status: number,
  body: Effect.Effect<unknown, S.SchemaError>,
  headers: Readonly<Record<string, string>> = {}
): Effect.Effect<HttpClientResponse.HttpClientResponse> =>
  body.pipe(
    Effect.orDie,
    Effect.flatMap((encoded) => jsonResponse(request, status, encoded, headers))
  );

const withTrace = <A, E, R>(
  options: PacerMockOptionsInput,
  request: MockRequest,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> => tracedRequest(options, request).pipe(Effect.andThen(effect));

const mockAuthResponse = (
  resolved: PacerMockOptions,
  request: MockRequest
): Effect.Effect<HttpClientResponse.HttpClientResponse> =>
  responseFromEncodedBody(request, 200, resolved.auth === "invalid" ? authInvalidBody : authSuccessBody);

const mockLogoutResponse = (
  options: PacerMockOptionsInput,
  resolved: PacerMockOptions,
  request: MockRequest
): Effect.Effect<HttpClientResponse.HttpClientResponse> => {
  const recordLogout = options.logoutCount === undefined ? Effect.void : Ref.update(options.logoutCount, N.increment);
  const responseBody = resolved.logout === "invalid" ? logoutInvalidBody : logoutBody;
  return recordLogout.pipe(
    Effect.andThen(recordLogoutToken(options, request)),
    Effect.andThen(responseFromEncodedBody(request, 200, responseBody))
  );
};

const mockDownloadStatusResponse = (
  options: PacerMockOptionsInput,
  resolved: PacerMockOptions,
  request: MockRequest,
  path: string
): Effect.Effect<HttpClientResponse.HttpClientResponse> => {
  const id = pipe(
    decodedLastPathInt(path),
    O.getOrElse(() => selectedReportId(options))
  );
  const status = resolved.batch === "failed" ? "FAILED" : "COMPLETED";
  return responseFromEncodedBody(request, 200, reportInfoBody(id, status));
};

const recordDeletedReport = (options: PacerMockOptionsInput, path: string): Effect.Effect<void> =>
  Effect.all(
    [
      pipe(
        lastPathSegment(path),
        O.match({
          onNone: () => Effect.void,
          onSome: (segment) =>
            options.deletedReportPathSegments === undefined
              ? Effect.void
              : Ref.update(options.deletedReportPathSegments, A.append(segment)),
        })
      ),
      pipe(
        decodedLastPathInt(path),
        O.match({
          onNone: () => Effect.void,
          onSome: (reportId) =>
            options.deletedReportIds === undefined
              ? Effect.void
              : Ref.update(options.deletedReportIds, A.append(reportId)),
        })
      ),
    ],
    { discard: true }
  );

const mockDeleteReportResponse = (
  options: PacerMockOptionsInput,
  resolved: PacerMockOptions,
  request: MockRequest,
  path: string
): Effect.Effect<HttpClientResponse.HttpClientResponse> => {
  const status = resolved.deleteReport === "failed" ? 500 : 204;
  return recordDeletedReport(options, path).pipe(
    Effect.as(HttpClientResponse.fromWeb(request, new Response(null, { status })))
  );
};

const missingRequiredClientCode = (options: PacerMockOptionsInput, request: MockRequest): boolean =>
  options.requireClientCode === true &&
  !pipe(O.fromUndefinedOr(request.headers["x-client-code"]), O.exists(Str.isNonEmpty));

const rotatedTokenHeaders = (options: PacerMockOptionsInput): Readonly<Record<string, string>> =>
  O.getSomesStruct({ "x-next-gen-cso": O.fromUndefinedOr(options.rotateNextGenCso) });

const mockCaseFindResponse = (context: PacerMockRouteContext): Effect.Effect<HttpClientResponse.HttpClientResponse> => {
  const { casePages, options, request, resolved, url } = context;
  if (missingRequiredClientCode(options, request) || resolved.cases === "invalid-parameter") {
    return jsonResponse(request, 406, invalidParameterBody);
  }
  if (resolved.cases === "unauthorized") {
    return jsonResponse(request, 401, { error: "unauthorized" });
  }
  const page = selectedPage(A.length(casePages), url.searchParams.get("page"));
  if (resolved.cases === "never-last") {
    return responseFromEncodedBody(request, 200, loopingCaseReportBody(page));
  }
  const pageBody = pipe(
    A.get(casePages, page),
    O.orElse(() => A.head(casePages)),
    O.getOrElse(() => Effect.succeed(invalidParameterBody))
  );
  return responseFromEncodedBody(request, 200, pageBody, rotatedTokenHeaders(options));
};

const mockPclResponse = (context: PacerMockRouteContext): Effect.Effect<HttpClientResponse.HttpClientResponse> => {
  const { options, partyBody, request, resolved, url } = context;
  const path = url.pathname;
  if (Str.includes("/cases/download/status/")(path)) {
    return mockDownloadStatusResponse(options, resolved, request, path);
  }
  if (Str.includes("/cases/download/")(path)) {
    return responseFromEncodedBody(request, 200, downloadResultsBody);
  }
  if (Str.endsWith("/cases/download")(path)) {
    return responseFromEncodedBody(request, 200, reportInfoBody(selectedReportId(options), "RUNNING"));
  }
  if (Str.includes("/cases/reports/")(path)) {
    return mockDeleteReportResponse(options, resolved, request, path);
  }
  if (Str.endsWith("/cases/find")(path)) {
    return mockCaseFindResponse(context);
  }
  return Str.endsWith("/parties/find")(path)
    ? responseFromEncodedBody(request, 200, partyBody)
    : jsonResponse(request, 404, { error: "not found", path });
};

const mockResponse = (context: PacerMockRouteContext): Effect.Effect<HttpClientResponse.HttpClientResponse> => {
  const { options, request, resolved, url } = context;
  const path = url.pathname;
  if (Str.endsWith("/services/cso-auth")(path)) {
    return mockAuthResponse(resolved, request);
  }
  return Str.endsWith("/services/cso-logout")(path)
    ? mockLogoutResponse(options, resolved, request)
    : mockPclResponse(context);
};

/**
 * Build a mock `HttpClient` layer for the chosen scenario. The case pages and
 * party rows are sampled from their schemas once per layer.
 *
 * **Example** (Build success mock client)
 *
 * ```ts
 * import { makePacerLayer, makePacerMockHttpClient, mockPacerConfig } from "@beep/pacer"
 *
 * const layers = makePacerLayer(mockPacerConfig(), makePacerMockHttpClient({ cases: "success" }))
 * console.log(Boolean(layers.full))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makePacerMockHttpClient = (options: PacerMockOptionsInput = {}): Layer.Layer<HttpClient.HttpClient> => {
  const resolved = resolveMockOptions(options);
  const casePages = defaultCasePages();
  const partyBody = defaultPartyBody;
  return Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request, url) =>
      withTrace(options, request, mockResponse({ casePages, options, partyBody, request, resolved, url }))
    )
  );
};

/**
 * The default happy-path mock `HttpClient` layer.
 *
 * **Example** (Use default mock client)
 *
 * ```ts
 * import { makePacerLayer, mockPacerConfig, PacerMockHttpClient } from "@beep/pacer"
 *
 * const layers = makePacerLayer(mockPacerConfig(), PacerMockHttpClient)
 * console.log(Boolean(layers.auth))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PacerMockHttpClient: Layer.Layer<HttpClient.HttpClient> = makePacerMockHttpClient();
