/**
 * Typed PCL client derived from the `Pcl.api.ts` HttpApi definition via
 * `HttpApiClient.make`, plus a pagination stream over `/cases/find`.
 *
 * The derived client is base-URL-prefixed and, on every request, has the
 * current `nextGenCSO` token (read from {@link PacerSession}) injected as the
 * `X-NEXT-GEN-CSO` header (plus optional `X-CLIENT-CODE`). Any fresh token PACER
 * returns in the `X-NEXT-GEN-CSO` response header is written back to the
 * session Ref. Failures (status codes, decode errors) are mapped to the typed
 * {@link PacerPclError}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PacerId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { Context, Duration, Effect, Layer, pipe, Redacted, Ref, Result, Schedule, Stream, Tuple } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientError from "effect/unstable/http/HttpClientError";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import { HttpApiClient } from "effect/unstable/httpapi";
import { PacerPclError } from "./Pacer.errors.ts";
import { pacerCauseMessage } from "./Pacer.http.ts";
import { NextGenCsoToken, ReportStatus } from "./Pacer.tokens.ts";
import { PacerSession } from "./PacerAuth.service.ts";
import { PclHttpApi } from "./Pcl.api.ts";
import type { PacerConfig } from "./Pacer.config.ts";
import type {
  CaseReportList,
  CaseResult,
  CourtCaseSearchDto,
  PartyReportList,
  PartySearchDto,
  ReportInfoType,
} from "./Pcl.models.ts";

const $I = $PacerId.create("pacer/pcl/PclClient.service");

type ReportIdValue = ReportInfoType["reportId"];

const ReportId = S.Union([S.Int, S.FiniteFromString.pipe(S.check(S.isInt()))]).pipe(
  $I.annoteSchema("PacerReportId", {
    description: "PCL batch report id accepted as a number or numeric string.",
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownOption"])
);

const invalidReportIdError = (): PacerPclError =>
  PacerPclError.fromReason("server-error", { cause: "invalid reportId from server" });

const formatReportDeletePathSegment = (reportId: ReportIdValue): O.Option<string> =>
  P.isNumber(reportId)
    ? pipe(
        ReportId.decodeUnknownOption(reportId),
        O.map((value) => `${value}`)
      )
    : pipe(O.liftPredicate(Str.isNonEmpty)(reportId), O.map(globalThis.encodeURIComponent), O.filter(Str.isNonEmpty));

const formatServerReportDeletePathSegment = (reportId: ReportIdValue): O.Option<string> =>
  P.isNumber(reportId)
    ? pipe(
        S.decodeOption(S.Finite)(reportId),
        O.map((value) => globalThis.encodeURIComponent(`${value}`))
      )
    : pipe(O.liftPredicate(Str.isNonEmpty)(reportId), O.map(globalThis.encodeURIComponent), O.filter(Str.isNonEmpty));

/** Max status polls before a batch download is treated as timed out (~10s at 200ms). */
const POLL_MAX_ATTEMPTS = 50;

const POLL_SCHEDULE = Schedule.spaced(Duration.millis(200)).pipe(Schedule.upTo({ times: POLL_MAX_ATTEMPTS }));

/** Per-request timeout so a hung PACER endpoint can never block the program forever. */
const REQUEST_TIMEOUT = Duration.seconds(30);

/** Hard cap on pagination, guarding against a server that never sets `pageInfo.last`. */
const PAGINATION_MAX_PAGES = 1000;

const extractResponseStatus = (value: unknown): O.Option<number> =>
  P.hasProperty(value, "response") && P.hasProperty(value.response, "status") && P.isNumber(value.response.status)
    ? O.some(value.response.status)
    : O.none();

const extractStatus = (error: unknown): O.Option<number> =>
  HttpClientError.isHttpClientError(error)
    ? pipe(
        extractResponseStatus(error.reason),
        O.orElse(() => extractResponseStatus(error))
      )
    : extractResponseStatus(error);

const isTaggedDecodeFailure = P.or(
  P.isTagged("SchemaError"),
  P.or(P.isTagged("DecodeError"), P.isTagged("EmptyBodyError"))
);

const isDecodeFailure = (error: unknown): boolean =>
  isTaggedDecodeFailure(error) ||
  (HttpClientError.isHttpClientError(error) &&
    (error.reason._tag === "DecodeError" || error.reason._tag === "EmptyBodyError"));

const isTerminalReportStatus = (status: ReportStatus): boolean =>
  status === ReportStatus.Enum.COMPLETED || status === ReportStatus.Enum.FAILED;

const mapPclFailure = (error: unknown): PacerPclError => {
  if (S.is(PacerPclError)(error)) {
    return error;
  }
  const status = extractStatus(error);
  if (O.exists(status, (value) => value < 200 || value >= 300)) {
    return PacerPclError.fromStatus(O.getOrThrow(status));
  }
  if (isDecodeFailure(error)) {
    return PacerPclError.fromReason("response-decoding", { cause: pacerCauseMessage(error) });
  }
  return O.match(status, {
    onNone: () => PacerPclError.fromReason("transport", { cause: pacerCauseMessage(error) }),
    onSome: PacerPclError.fromStatus,
  });
};

/** Apply the shared per-request timeout and map any failure to a typed PacerPclError. */
const callPcl = <A, E>(effect: Effect.Effect<A, E>): Effect.Effect<A, PacerPclError> =>
  effect.pipe(Effect.timeout(REQUEST_TIMEOUT), Effect.mapError(mapPclFailure));

const makeInjectingClient = (
  base: HttpClient.HttpClient,
  cfg: PacerConfig,
  tokenRef: Ref.Ref<Redacted.Redacted<NextGenCsoToken>>
): HttpClient.HttpClient =>
  base.pipe(
    HttpClient.mapRequestEffect((request) =>
      Ref.get(tokenRef).pipe(
        Effect.map((token) => {
          const withToken = HttpClientRequest.setHeader(request, "X-NEXT-GEN-CSO", Redacted.value(token)).pipe(
            HttpClientRequest.accept("application/json")
          );
          return O.match(cfg.clientCode, {
            onNone: () => withToken,
            onSome: (code) => HttpClientRequest.setHeader(withToken, "X-CLIENT-CODE", code),
          });
        })
      )
    ),
    HttpClient.transformResponse((effect) =>
      effect.pipe(
        Effect.tap((response) => {
          const fresh = response.headers["x-next-gen-cso"];
          return P.isString(fresh) && Str.isNonEmpty(fresh)
            ? Ref.set(tokenRef, Redacted.make(NextGenCsoToken.make(fresh)))
            : Effect.void;
        })
      )
    )
  );

interface PclClientShape {
  /** Download the full result set of a completed batch case job. */
  readonly caseDownloadResults: (reportId: number) => Effect.Effect<CaseReportList, PacerPclError>;
  /** Poll the status of a batch case download job. */
  readonly caseDownloadStatus: (reportId: number) => Effect.Effect<ReportInfoType, PacerPclError>;
  /** Delete a stored batch report job (PACER caps stored jobs, so this is mandatory). */
  readonly deleteCaseReport: (reportId: number) => Effect.Effect<void, PacerPclError>;
  /** Full batch lifecycle: start → poll until COMPLETED → download → always delete. */
  readonly downloadCases: (payload: CourtCaseSearchDto) => Effect.Effect<ReadonlyArray<CaseResult>, PacerPclError>;
  /** Fetch a single page of `/cases/find` (0-based page). */
  readonly findCasesPage: (payload: CourtCaseSearchDto, page: number) => Effect.Effect<CaseReportList, PacerPclError>;
  /** Fetch a page of `/parties/find` (0-based page, defaults to 0). */
  readonly findParties: (payload: PartySearchDto, page?: number) => Effect.Effect<PartyReportList, PacerPclError>;
  /** Start an asynchronous batch case download; returns the report job metadata. */
  readonly startCaseDownload: (payload: CourtCaseSearchDto) => Effect.Effect<ReportInfoType, PacerPclError>;
  /** Stream every `/cases/find` result across pages until `pageInfo.last`. */
  readonly streamCases: (payload: CourtCaseSearchDto) => Stream.Stream<CaseResult, PacerPclError>;
}

/**
 * Typed PCL client service derived from {@link PclHttpApi}.
 *
 * **Example** (Creating mock pacer layers)
 *
 * ```ts
 * import { makePacerLayer, makePacerMockHttpClient, mockPacerConfig } from "@beep/pacer"
 *
 * const layers = makePacerLayer(mockPacerConfig(), makePacerMockHttpClient())
 * console.log(Boolean(layers.pcl))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PclClient extends Context.Service<PclClient, PclClientShape>()($I`PclClient`) {
  /**
   * Build a layer; requires an `HttpClient` and an authenticated `PacerSession`.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (cfg: PacerConfig): Layer.Layer<PclClient, never, HttpClient.HttpClient | PacerSession> =>
    Layer.effect(
      PclClient,
      Effect.gen(function* () {
        const session = yield* PacerSession;
        // A token-injecting client for the raw DELETE (httpapi has no DELETE here).
        const injected = makeInjectingClient(yield* HttpClient.HttpClient, cfg, session.tokenRef);
        const client = yield* HttpApiClient.make(PclHttpApi, {
          baseUrl: cfg.pclBaseUrl,
          transformClient: (base) => makeInjectingClient(base, cfg, session.tokenRef),
        });

        const findCasesPage = (payload: CourtCaseSearchDto, page: number) =>
          callPcl(client.pcl.findCases({ payload, query: { page } }));

        const findParties = (payload: PartySearchDto, page = 0) =>
          callPcl(client.pcl.findParties({ payload, query: { page } }));

        const streamCases = (payload: CourtCaseSearchDto): Stream.Stream<CaseResult, PacerPclError> =>
          Stream.paginate(0, (page: number) =>
            page >= PAGINATION_MAX_PAGES
              ? Effect.fail(PacerPclError.fromReason("server-error", { cause: "pagination exceeded max pages" }))
              : findCasesPage(payload, page).pipe(
                  Effect.map((report) => {
                    const content = O.getOrElse(report.content, () => []);
                    const hasMore = pipe(
                      report.pageInfo,
                      O.flatMap((pageInfo) => pageInfo.last),
                      O.exists((last) => !last)
                    );
                    return Tuple.make(content, hasMore ? O.some(page + 1) : O.none<number>());
                  })
                )
          );

        const startCaseDownload = (payload: CourtCaseSearchDto) => callPcl(client.pcl.startCaseDownload({ payload }));

        const caseDownloadStatus = (reportId: number) =>
          callPcl(client.pcl.caseDownloadStatus({ params: { reportId } }));

        const caseDownloadResults = (reportId: number) =>
          callPcl(client.pcl.caseDownloadResults({ params: { reportId } }));

        const deleteCaseReportByPathSegment = (reportId: string): Effect.Effect<void, PacerPclError> =>
          callPcl(
            injected.execute(
              HttpClientRequest.make("DELETE")(`${cfg.pclBaseUrl}/pcl-public-api/rest/cases/reports/${reportId}`)
            )
          ).pipe(
            Effect.flatMap((response) =>
              response.status >= 200 && response.status < 300
                ? Effect.void
                : Effect.fail(PacerPclError.fromStatus(response.status))
            )
          );

        const deleteCaseReport = (reportId: number): Effect.Effect<void, PacerPclError> =>
          O.match(formatReportDeletePathSegment(reportId), {
            onNone: () => Effect.fail(invalidReportIdError()),
            onSome: deleteCaseReportByPathSegment,
          });

        const pollUntilComplete = (reportId: number): Effect.Effect<ReportInfoType, PacerPclError> =>
          caseDownloadStatus(reportId).pipe(
            Effect.repeat({
              schedule: POLL_SCHEDULE,
              until: (info) => O.exists(info.status, isTerminalReportStatus),
            }),
            Effect.filterOrFail(
              (info) => O.exists(info.status, isTerminalReportStatus),
              () => PacerPclError.fromReason("server-error", { cause: "report polling timed out" })
            )
          );

        const cleanupReport = (reportId: ReportIdValue): Effect.Effect<void, PacerPclError> =>
          O.match(formatServerReportDeletePathSegment(reportId), {
            onNone: (): Effect.Effect<void, PacerPclError> => Effect.void,
            onSome: deleteCaseReportByPathSegment,
          }).pipe(Effect.tapError((error) => Effect.logWarning(`Pacer PCL report cleanup failed: ${error.reason}`)));

        const withReportCleanup = Effect.fnUntraced(function* <A>(
          reportId: ReportIdValue,
          effect: Effect.Effect<A, PacerPclError>
        ) {
          const result = yield* Effect.result(effect);
          yield* cleanupReport(reportId).pipe(Effect.ignore);
          return yield* Result.match(result, {
            onFailure: (error) => Effect.fail(error),
            onSuccess: Effect.succeed,
          });
        });

        const downloadCases: PclClientShape["downloadCases"] = Effect.fnUntraced(function* (
          payload: CourtCaseSearchDto
        ) {
          const started = yield* startCaseDownload(payload);
          return yield* withReportCleanup(
            started.reportId,
            Effect.gen(function* () {
              const reportId = yield* Effect.fromOption(ReportId.decodeUnknownOption(started.reportId), () =>
                invalidReportIdError()
              );
              const completed = yield* pollUntilComplete(reportId);
              if (O.contains(completed.status, ReportStatus.Enum.FAILED)) {
                return yield* PacerPclError.fromReason("server-error", { cause: "report failed" });
              }
              const report = yield* caseDownloadResults(reportId);
              return O.getOrElse(report.content, () => []);
            })
          );
        });

        return PclClient.of({
          findCasesPage,
          findParties,
          streamCases,
          startCaseDownload,
          caseDownloadStatus,
          caseDownloadResults,
          deleteCaseReport,
          downloadCases,
        });
      })
    );
}
