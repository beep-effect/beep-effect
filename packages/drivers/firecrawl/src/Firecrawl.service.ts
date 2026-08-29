/**
 * Effect service boundary for the Firecrawl v2 SDK.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FirecrawlId } from "@beep/identity/packages";
import { O as OptionUtils } from "@beep/utils";
import { Cause, Config, Context, Effect, Layer, pipe, Queue, Redacted, Result, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FirecrawlClient } from "firecrawl";
import { FIRECRAWL_API_URL, FirecrawlConfigInput } from "./Firecrawl.config.ts";
import { FirecrawlError } from "./Firecrawl.errors.ts";
import * as M from "./Firecrawl.models.ts";
import type { FirecrawlClientOptions } from "firecrawl";
import type { FirecrawlMethodName } from "./Firecrawl.errors.ts";

const $I = $FirecrawlId.create("Firecrawl.service");

type FirecrawlSdkWatcherEventName = "document" | "done" | "error" | "snapshot";
type FirecrawlSdkWatcherListener = (payload: unknown) => void;

/**
 * Minimal watcher contract consumed by {@link Firecrawl.makeLayerFromClient}.
 *
 * @example
 * ```ts
 * import type { FirecrawlSdkWatcher } from "@beep/firecrawl"
 *
 * const watcher: FirecrawlSdkWatcher = {
 *   close: () => undefined,
 *   off: () => watcher,
 *   on: () => watcher,
 *   start: () => Promise.resolve()
 * }
 *
 * console.log(watcher)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type FirecrawlSdkWatcher = {
  readonly close: () => void;
  readonly off: (eventName: FirecrawlSdkWatcherEventName, listener: FirecrawlSdkWatcherListener) => FirecrawlSdkWatcher;
  readonly on: (eventName: FirecrawlSdkWatcherEventName, listener: FirecrawlSdkWatcherListener) => FirecrawlSdkWatcher;
  readonly start: () => Promise<void>;
};

/**
 * Minimal Firecrawl SDK client contract used by the driver service.
 *
 * @example
 * ```ts
 * import type { FirecrawlSdkClient } from "@beep/firecrawl"
 *
 * type Method = keyof FirecrawlSdkClient
 *
 * const method: Method = "scrape"
 * console.log(method)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type FirecrawlSdkClient = {
  readonly agent: (request: M.FirecrawlAgentWaitRequest) => Promise<M.FirecrawlAgentStatusData>;
  readonly batchScrape: (
    urls: Array<string>,
    options?: M.FirecrawlBatchScrapeWaitOptions
  ) => Promise<M.FirecrawlBatchScrapeJobData>;
  readonly browser: (options?: M.FirecrawlBrowserOptions) => Promise<M.FirecrawlBrowserCreateData>;
  readonly browserExecute: (
    sessionId: string,
    request: M.FirecrawlBrowserExecuteRequest
  ) => Promise<M.FirecrawlBrowserExecuteData>;
  readonly cancelAgent: (jobId: string) => Promise<boolean>;
  readonly cancelBatchScrape: (jobId: string) => Promise<boolean>;
  readonly cancelCrawl: (jobId: string) => Promise<boolean>;
  readonly crawl: (url: string, request?: M.FirecrawlCrawlWaitOptions) => Promise<M.FirecrawlCrawlJobData>;
  readonly crawlParamsPreview: (url: string, prompt: string) => Promise<Record<string, unknown>>;
  readonly createMonitor: (request: M.FirecrawlCreateMonitorRequest) => Promise<M.FirecrawlMonitorData>;
  readonly deleteBrowser: (sessionId: string) => Promise<M.FirecrawlBrowserDeleteData>;
  readonly deleteMonitor: (monitorId: string) => Promise<boolean>;
  readonly getActiveCrawls: () => Promise<M.FirecrawlActiveCrawlsData>;
  readonly getAgentStatus: (jobId: string) => Promise<M.FirecrawlAgentStatusData>;
  readonly getBatchScrapeErrors: (jobId: string) => Promise<M.FirecrawlCrawlErrorsData>;
  readonly getBatchScrapeStatus: (
    jobId: string,
    pagination?: M.FirecrawlPaginationConfig
  ) => Promise<M.FirecrawlBatchScrapeJobData>;
  readonly getConcurrency: () => Promise<M.FirecrawlConcurrencyData>;
  readonly getCrawlErrors: (crawlId: string) => Promise<M.FirecrawlCrawlErrorsData>;
  readonly getCrawlStatus: (
    jobId: string,
    pagination?: M.FirecrawlPaginationConfig
  ) => Promise<M.FirecrawlCrawlJobData>;
  readonly getCreditUsage: () => Promise<M.FirecrawlCreditUsageData>;
  readonly getCreditUsageHistorical: (byApiKey?: boolean) => Promise<M.FirecrawlCreditUsageHistoricalData>;
  readonly getMonitor: (monitorId: string) => Promise<M.FirecrawlMonitorData>;
  readonly getMonitorCheck: (
    monitorId: string,
    checkId: string,
    options?: M.FirecrawlGetMonitorCheckOptions
  ) => Promise<M.FirecrawlMonitorCheckDetailData>;
  readonly getQueueStatus: () => Promise<M.FirecrawlQueueStatusData>;
  readonly getTokenUsage: () => Promise<M.FirecrawlTokenUsageData>;
  readonly getTokenUsageHistorical: (byApiKey?: boolean) => Promise<M.FirecrawlTokenUsageHistoricalData>;
  readonly interact: (jobId: string, request: M.FirecrawlInteractRequest) => Promise<M.FirecrawlInteractData>;
  readonly listBrowsers: (options?: M.FirecrawlListBrowsersOptions) => Promise<M.FirecrawlBrowserListData>;
  readonly listMonitorChecks: (
    monitorId: string,
    options?: M.FirecrawlListMonitorChecksOptions
  ) => Promise<M.FirecrawlMonitorCheckListData>;
  readonly listMonitors: (options?: M.FirecrawlListMonitorsOptions) => Promise<M.FirecrawlMonitorListData>;
  readonly map: (url: string, options?: M.FirecrawlMapOptions) => Promise<M.FirecrawlMapData>;
  readonly parse: (file: M.FirecrawlParseFile, options?: M.FirecrawlParseOptions) => Promise<M.FirecrawlDocument>;
  readonly runMonitor: (monitorId: string) => Promise<M.FirecrawlMonitorCheckData>;
  readonly scrape: (url: string, options?: M.FirecrawlScrapeOptions) => Promise<M.FirecrawlDocument>;
  readonly search: (query: string, request?: M.FirecrawlSearchOptions) => Promise<M.FirecrawlSearchData>;
  readonly startAgent: (request: M.FirecrawlAgentRequest) => Promise<M.FirecrawlAgentResponseData>;
  readonly startBatchScrape: (
    urls: Array<string>,
    options?: M.FirecrawlBatchScrapeOptions
  ) => Promise<M.FirecrawlBatchScrapeResponseData>;
  readonly startCrawl: (url: string, request?: M.FirecrawlCrawlOptions) => Promise<M.FirecrawlCrawlResponseData>;
  readonly stopInteraction: (jobId: string) => Promise<M.FirecrawlStopInteractionData>;
  readonly updateMonitor: (
    monitorId: string,
    request: M.FirecrawlUpdateMonitorRequest
  ) => Promise<M.FirecrawlMonitorData>;
  readonly watcher: (jobId: string, options?: M.FirecrawlWatcherOptions) => FirecrawlSdkWatcher;
};

/**
 * Public Firecrawl service shape.
 *
 * @example
 * ```ts
 * import type { FirecrawlShape } from "@beep/firecrawl"
 *
 * type FirecrawlMethod = keyof FirecrawlShape
 *
 * const method: FirecrawlMethod = "scrape"
 * console.log(method)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type FirecrawlShape = {
  readonly agent: (payload: M.FirecrawlAgentPayload) => Effect.Effect<M.FirecrawlAgentSuccess, FirecrawlError>;
  readonly batchScrape: (
    payload: M.FirecrawlBatchScrapePayload
  ) => Effect.Effect<M.FirecrawlBatchScrapeSuccess, FirecrawlError>;
  readonly browser: (payload: M.FirecrawlBrowserPayload) => Effect.Effect<M.FirecrawlBrowserSuccess, FirecrawlError>;
  readonly browserExecute: (
    payload: M.FirecrawlBrowserExecutePayload
  ) => Effect.Effect<M.FirecrawlBrowserExecuteSuccess, FirecrawlError>;
  readonly cancelAgent: (
    payload: M.FirecrawlCancelAgentPayload
  ) => Effect.Effect<M.FirecrawlCancelAgentSuccess, FirecrawlError>;
  readonly cancelBatchScrape: (
    payload: M.FirecrawlCancelBatchScrapePayload
  ) => Effect.Effect<M.FirecrawlCancelBatchScrapeSuccess, FirecrawlError>;
  readonly cancelCrawl: (
    payload: M.FirecrawlCancelCrawlPayload
  ) => Effect.Effect<M.FirecrawlCancelCrawlSuccess, FirecrawlError>;
  readonly crawl: (payload: M.FirecrawlCrawlPayload) => Effect.Effect<M.FirecrawlCrawlSuccess, FirecrawlError>;
  readonly crawlParamsPreview: (
    payload: M.FirecrawlCrawlParamsPreviewPayload
  ) => Effect.Effect<M.FirecrawlCrawlParamsPreviewSuccess, FirecrawlError>;
  readonly createMonitor: (
    payload: M.FirecrawlCreateMonitorPayload
  ) => Effect.Effect<M.FirecrawlCreateMonitorSuccess, FirecrawlError>;
  readonly deleteBrowser: (
    payload: M.FirecrawlDeleteBrowserPayload
  ) => Effect.Effect<M.FirecrawlDeleteBrowserSuccess, FirecrawlError>;
  readonly deleteMonitor: (
    payload: M.FirecrawlDeleteMonitorPayload
  ) => Effect.Effect<M.FirecrawlDeleteMonitorSuccess, FirecrawlError>;
  readonly getActiveCrawls: (
    payload: M.FirecrawlGetActiveCrawlsPayload
  ) => Effect.Effect<M.FirecrawlGetActiveCrawlsSuccess, FirecrawlError>;
  readonly getAgentStatus: (
    payload: M.FirecrawlGetAgentStatusPayload
  ) => Effect.Effect<M.FirecrawlGetAgentStatusSuccess, FirecrawlError>;
  readonly getBatchScrapeErrors: (
    payload: M.FirecrawlGetBatchScrapeErrorsPayload
  ) => Effect.Effect<M.FirecrawlGetBatchScrapeErrorsSuccess, FirecrawlError>;
  readonly getBatchScrapeStatus: (
    payload: M.FirecrawlGetBatchScrapeStatusPayload
  ) => Effect.Effect<M.FirecrawlGetBatchScrapeStatusSuccess, FirecrawlError>;
  readonly getConcurrency: (
    payload: M.FirecrawlGetConcurrencyPayload
  ) => Effect.Effect<M.FirecrawlGetConcurrencySuccess, FirecrawlError>;
  readonly getCrawlErrors: (
    payload: M.FirecrawlGetCrawlErrorsPayload
  ) => Effect.Effect<M.FirecrawlGetCrawlErrorsSuccess, FirecrawlError>;
  readonly getCrawlStatus: (
    payload: M.FirecrawlGetCrawlStatusPayload
  ) => Effect.Effect<M.FirecrawlGetCrawlStatusSuccess, FirecrawlError>;
  readonly getCreditUsage: (
    payload: M.FirecrawlGetCreditUsagePayload
  ) => Effect.Effect<M.FirecrawlGetCreditUsageSuccess, FirecrawlError>;
  readonly getCreditUsageHistorical: (
    payload: M.FirecrawlGetCreditUsageHistoricalPayload
  ) => Effect.Effect<M.FirecrawlGetCreditUsageHistoricalSuccess, FirecrawlError>;
  readonly getMonitor: (
    payload: M.FirecrawlGetMonitorPayload
  ) => Effect.Effect<M.FirecrawlGetMonitorSuccess, FirecrawlError>;
  readonly getMonitorCheck: (
    payload: M.FirecrawlGetMonitorCheckPayload
  ) => Effect.Effect<M.FirecrawlGetMonitorCheckSuccess, FirecrawlError>;
  readonly getQueueStatus: (
    payload: M.FirecrawlGetQueueStatusPayload
  ) => Effect.Effect<M.FirecrawlGetQueueStatusSuccess, FirecrawlError>;
  readonly getTokenUsage: (
    payload: M.FirecrawlGetTokenUsagePayload
  ) => Effect.Effect<M.FirecrawlGetTokenUsageSuccess, FirecrawlError>;
  readonly getTokenUsageHistorical: (
    payload: M.FirecrawlGetTokenUsageHistoricalPayload
  ) => Effect.Effect<M.FirecrawlGetTokenUsageHistoricalSuccess, FirecrawlError>;
  readonly interact: (payload: M.FirecrawlInteractPayload) => Effect.Effect<M.FirecrawlInteractSuccess, FirecrawlError>;
  readonly listBrowsers: (
    payload: M.FirecrawlListBrowsersPayload
  ) => Effect.Effect<M.FirecrawlListBrowsersSuccess, FirecrawlError>;
  readonly listMonitorChecks: (
    payload: M.FirecrawlListMonitorChecksPayload
  ) => Effect.Effect<M.FirecrawlListMonitorChecksSuccess, FirecrawlError>;
  readonly listMonitors: (
    payload: M.FirecrawlListMonitorsPayload
  ) => Effect.Effect<M.FirecrawlListMonitorsSuccess, FirecrawlError>;
  readonly map: (payload: M.FirecrawlMapPayload) => Effect.Effect<M.FirecrawlMapSuccess, FirecrawlError>;
  readonly parse: (payload: M.FirecrawlParsePayload) => Effect.Effect<M.FirecrawlParseSuccess, FirecrawlError>;
  readonly runMonitor: (
    payload: M.FirecrawlRunMonitorPayload
  ) => Effect.Effect<M.FirecrawlRunMonitorSuccess, FirecrawlError>;
  readonly scrape: (payload: M.FirecrawlScrapePayload) => Effect.Effect<M.FirecrawlScrapeSuccess, FirecrawlError>;
  readonly search: (payload: M.FirecrawlSearchPayload) => Effect.Effect<M.FirecrawlSearchSuccess, FirecrawlError>;
  readonly startAgent: (
    payload: M.FirecrawlStartAgentPayload
  ) => Effect.Effect<M.FirecrawlStartAgentSuccess, FirecrawlError>;
  readonly startBatchScrape: (
    payload: M.FirecrawlStartBatchScrapePayload
  ) => Effect.Effect<M.FirecrawlStartBatchScrapeSuccess, FirecrawlError>;
  readonly startCrawl: (
    payload: M.FirecrawlStartCrawlPayload
  ) => Effect.Effect<M.FirecrawlStartCrawlSuccess, FirecrawlError>;
  readonly stopInteraction: (
    payload: M.FirecrawlStopInteractionPayload
  ) => Effect.Effect<M.FirecrawlStopInteractionSuccess, FirecrawlError>;
  readonly updateMonitor: (
    payload: M.FirecrawlUpdateMonitorPayload
  ) => Effect.Effect<M.FirecrawlUpdateMonitorSuccess, FirecrawlError>;
  readonly watcher: (payload: M.FirecrawlWatcherPayload) => Stream.Stream<M.FirecrawlWatcherEvent, FirecrawlError>;
};

type ResolvedFirecrawlConfig = {
  readonly apiKey: Redacted.Redacted<string>;
  readonly apiUrl: string;
  readonly backoffFactor: O.Option<number>;
  readonly maxRetries: O.Option<number>;
  readonly timeoutMs: O.Option<number>;
};

const normalizeBaseUrl = Str.replace(/\/+$/, "");

const optionOrUndefined = <A>(option: O.Option<A>): A | undefined => O.getOrUndefined(option);

const decodeWith = <A>(
  method: FirecrawlMethodName,
  schema: S.Decoder<A>,
  value: unknown,
  reason: "request encoding" | "response decoding"
): Effect.Effect<A, FirecrawlError> =>
  S.decodeUnknownEffect(schema)(value).pipe(
    Effect.mapError((cause) =>
      FirecrawlError.fromReason(reason, {
        cause,
        method,
      })
    )
  );

const successData = (data: unknown): Record<string, unknown> => ({ data });

const diagnosticsFor = (event: string, error: FirecrawlError): Readonly<Record<string, unknown>> => ({
  event,
  provider: "firecrawl",
  reason: error.reason,
  ...OptionUtils.getSomesStruct({
    method: error.method,
    status: error.status,
  }),
});

const logDriverFailure =
  (event: string) =>
  (error: FirecrawlError): Effect.Effect<void> =>
    Effect.logDebug(diagnosticsFor(event, error));

const runSdkCall = <Payload, Success>(
  method: FirecrawlMethodName,
  payloadSchema: S.Decoder<Payload>,
  successSchema: S.Decoder<Success>,
  payload: Payload,
  invoke: (payload: Payload) => Promise<unknown>
): Effect.Effect<Success, FirecrawlError> =>
  decodeWith(method, payloadSchema, payload, "request encoding").pipe(
    Effect.flatMap((decoded) =>
      Effect.tryPromise({
        try: () => invoke(decoded),
        catch: (cause) => FirecrawlError.fromUnknown(method, cause),
      })
    ),
    Effect.flatMap((result) => decodeWith(method, successSchema, result, "response decoding")),
    Effect.tapError(logDriverFailure("firecrawl.driver_failure")),
    Effect.withSpan(`firecrawl.${method}`, {
      attributes: {
        "firecrawl.method": method,
      },
    })
  );

const readProperty = (value: unknown, key: PropertyKey): O.Option<unknown> =>
  P.isObject(value)
    ? O.fromUndefinedOr(
        Result.getOrElse(
          Result.try(() => Reflect.get(value, key)),
          () => undefined
        )
      )
    : O.none();

const readString = (value: unknown, key: PropertyKey): O.Option<string> =>
  pipe(readProperty(value, key), O.filter(P.isString));

const watcherErrorText = (payload: unknown): string =>
  pipe(
    O.firstSomeOf([readString(payload, "error"), readString(payload, "message"), readString(payload, "name")]),
    O.getOrElse(() => (P.isString(payload) ? payload : "watcher error"))
  );

const emitWatcherEvent = <Event extends M.FirecrawlWatcherEvent>(
  queue: Queue.Queue<M.FirecrawlWatcherEvent, FirecrawlError | Cause.Done>,
  method: FirecrawlMethodName,
  schema: S.Decoder<Event>,
  value: unknown
): void => {
  const result = S.decodeUnknownResult(schema)(value);

  if (Result.isSuccess(result)) {
    Queue.offerUnsafe(queue, result.success);
    return;
  }

  Queue.failCauseUnsafe(
    queue,
    Cause.fail(
      FirecrawlError.fromReason("response decoding", {
        cause: result.failure,
        method,
      })
    )
  );
};

const makeWatcherStream = (
  method: FirecrawlMethodName,
  watcher: FirecrawlSdkWatcher
): Stream.Stream<M.FirecrawlWatcherEvent, FirecrawlError> =>
  Stream.callback<M.FirecrawlWatcherEvent, FirecrawlError>((queue) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const onDocument = (payload: unknown) =>
          emitWatcherEvent(queue, method, M.FirecrawlWatcherDocumentEvent, {
            document: payload,
            type: "document",
          });
        const onSnapshot = (payload: unknown) =>
          emitWatcherEvent(queue, method, M.FirecrawlWatcherSnapshotEvent, {
            snapshot: payload,
            type: "snapshot",
          });
        const onDone = (payload: unknown) => {
          emitWatcherEvent(queue, method, M.FirecrawlWatcherDoneEvent, {
            ...OptionUtils.getSomesStruct({
              completed: pipe(readProperty(payload, "completed"), O.filter(P.isNumber)),
              creditsUsed: pipe(readProperty(payload, "creditsUsed"), O.filter(P.isNumber)),
              data: readProperty(payload, "data"),
              id: readString(payload, "id"),
              status: readString(payload, "status"),
              total: pipe(readProperty(payload, "total"), O.filter(P.isNumber)),
            }),
            type: "done",
          });
          Queue.endUnsafe(queue);
        };
        const onError = (payload: unknown) => {
          emitWatcherEvent(queue, method, M.FirecrawlWatcherErrorEvent, {
            ...OptionUtils.getSomesStruct({
              id: readString(payload, "id"),
              status: readString(payload, "status"),
            }),
            error: watcherErrorText(payload),
            type: "error",
          });
          Queue.endUnsafe(queue);
        };

        watcher.on("document", onDocument);
        watcher.on("snapshot", onSnapshot);
        watcher.on("done", onDone);
        watcher.on("error", onError);

        return { onDocument, onDone, onError, onSnapshot };
      }),
      ({ onDocument, onDone, onError, onSnapshot }) =>
        Effect.sync(() => {
          watcher.off("document", onDocument);
          watcher.off("snapshot", onSnapshot);
          watcher.off("done", onDone);
          watcher.off("error", onError);
          watcher.close();
        })
    ).pipe(
      Effect.flatMap(() =>
        Effect.tryPromise({
          try: () => watcher.start(),
          catch: (cause) => FirecrawlError.fromUnknown(method, cause),
        })
      )
    )
  );

const resolveConfig = Effect.fn("Firecrawl.resolveConfig")(function* (input: FirecrawlConfigInput) {
  const apiKey = yield* pipe(
    O.fromUndefinedOr(input.apiKey),
    O.match({
      onNone: () =>
        Effect.fail(
          FirecrawlError.fromReason("config", {
            cause: "missing FIRECRAWL_API_KEY",
          })
        ),
      onSome: Effect.succeed,
    })
  );

  return {
    apiKey,
    apiUrl: normalizeBaseUrl(input.apiUrl ?? FIRECRAWL_API_URL),
    backoffFactor: O.fromUndefinedOr(input.backoffFactor),
    maxRetries: O.fromUndefinedOr(input.maxRetries),
    timeoutMs: O.fromUndefinedOr(input.timeoutMs),
  };
});

const makeSdkClient = (config: ResolvedFirecrawlConfig): FirecrawlSdkClient => {
  const options: FirecrawlClientOptions = {
    apiKey: Redacted.value(config.apiKey),
    apiUrl: config.apiUrl,
    ...OptionUtils.getSomesStruct({
      backoffFactor: config.backoffFactor,
      maxRetries: config.maxRetries,
      timeoutMs: config.timeoutMs,
    }),
  };

  return new FirecrawlClient(options);
};

const makeService = (client: FirecrawlSdkClient): FirecrawlShape => ({
  agent: (payload) =>
    runSdkCall("agent", M.FirecrawlAgentPayload, M.FirecrawlAgentSuccess, payload, (decoded) =>
      client.agent(decoded.request).then(successData)
    ),
  batchScrape: (payload) =>
    runSdkCall("batchScrape", M.FirecrawlBatchScrapePayload, M.FirecrawlBatchScrapeSuccess, payload, (decoded) =>
      client.batchScrape(A.fromIterable(decoded.urls), optionOrUndefined(decoded.options)).then(successData)
    ),
  browser: (payload) =>
    runSdkCall("browser", M.FirecrawlBrowserPayload, M.FirecrawlBrowserSuccess, payload, (decoded) =>
      client.browser(optionOrUndefined(decoded.options)).then(successData)
    ),
  browserExecute: (payload) =>
    runSdkCall(
      "browserExecute",
      M.FirecrawlBrowserExecutePayload,
      M.FirecrawlBrowserExecuteSuccess,
      payload,
      (decoded) => client.browserExecute(decoded.sessionId, decoded.request).then(successData)
    ),
  cancelAgent: (payload) =>
    runSdkCall("cancelAgent", M.FirecrawlCancelAgentPayload, M.FirecrawlCancelAgentSuccess, payload, (decoded) =>
      client.cancelAgent(decoded.jobId).then((cancelled) => ({ cancelled }))
    ),
  cancelBatchScrape: (payload) =>
    runSdkCall(
      "cancelBatchScrape",
      M.FirecrawlCancelBatchScrapePayload,
      M.FirecrawlCancelBatchScrapeSuccess,
      payload,
      (decoded) => client.cancelBatchScrape(decoded.jobId).then((cancelled) => ({ cancelled }))
    ),
  cancelCrawl: (payload) =>
    runSdkCall("cancelCrawl", M.FirecrawlCancelCrawlPayload, M.FirecrawlCancelCrawlSuccess, payload, (decoded) =>
      client.cancelCrawl(decoded.jobId).then((cancelled) => ({ cancelled }))
    ),
  crawl: (payload) =>
    runSdkCall("crawl", M.FirecrawlCrawlPayload, M.FirecrawlCrawlSuccess, payload, (decoded) =>
      client.crawl(decoded.url, optionOrUndefined(decoded.request)).then(successData)
    ),
  crawlParamsPreview: (payload) =>
    runSdkCall(
      "crawlParamsPreview",
      M.FirecrawlCrawlParamsPreviewPayload,
      M.FirecrawlCrawlParamsPreviewSuccess,
      payload,
      (decoded) => client.crawlParamsPreview(decoded.url, decoded.prompt).then(successData)
    ),
  createMonitor: (payload) =>
    runSdkCall("createMonitor", M.FirecrawlCreateMonitorPayload, M.FirecrawlCreateMonitorSuccess, payload, (decoded) =>
      client.createMonitor(decoded.request).then(successData)
    ),
  deleteBrowser: (payload) =>
    runSdkCall("deleteBrowser", M.FirecrawlDeleteBrowserPayload, M.FirecrawlDeleteBrowserSuccess, payload, (decoded) =>
      client.deleteBrowser(decoded.sessionId).then(successData)
    ),
  deleteMonitor: (payload) =>
    runSdkCall("deleteMonitor", M.FirecrawlDeleteMonitorPayload, M.FirecrawlDeleteMonitorSuccess, payload, (decoded) =>
      client.deleteMonitor(decoded.monitorId).then((deleted) => ({ deleted }))
    ),
  getActiveCrawls: (payload) =>
    runSdkCall("getActiveCrawls", M.FirecrawlGetActiveCrawlsPayload, M.FirecrawlGetActiveCrawlsSuccess, payload, () =>
      client.getActiveCrawls().then(successData)
    ),
  getAgentStatus: (payload) =>
    runSdkCall(
      "getAgentStatus",
      M.FirecrawlGetAgentStatusPayload,
      M.FirecrawlGetAgentStatusSuccess,
      payload,
      (decoded) => client.getAgentStatus(decoded.jobId).then(successData)
    ),
  getBatchScrapeErrors: (payload) =>
    runSdkCall(
      "getBatchScrapeErrors",
      M.FirecrawlGetBatchScrapeErrorsPayload,
      M.FirecrawlGetBatchScrapeErrorsSuccess,
      payload,
      (decoded) => client.getBatchScrapeErrors(decoded.jobId).then(successData)
    ),
  getBatchScrapeStatus: (payload) =>
    runSdkCall(
      "getBatchScrapeStatus",
      M.FirecrawlGetBatchScrapeStatusPayload,
      M.FirecrawlGetBatchScrapeStatusSuccess,
      payload,
      (decoded) => client.getBatchScrapeStatus(decoded.jobId, optionOrUndefined(decoded.pagination)).then(successData)
    ),
  getConcurrency: (payload) =>
    runSdkCall("getConcurrency", M.FirecrawlGetConcurrencyPayload, M.FirecrawlGetConcurrencySuccess, payload, () =>
      client.getConcurrency().then(successData)
    ),
  getCrawlErrors: (payload) =>
    runSdkCall(
      "getCrawlErrors",
      M.FirecrawlGetCrawlErrorsPayload,
      M.FirecrawlGetCrawlErrorsSuccess,
      payload,
      (decoded) => client.getCrawlErrors(decoded.crawlId).then(successData)
    ),
  getCrawlStatus: (payload) =>
    runSdkCall(
      "getCrawlStatus",
      M.FirecrawlGetCrawlStatusPayload,
      M.FirecrawlGetCrawlStatusSuccess,
      payload,
      (decoded) => client.getCrawlStatus(decoded.jobId, optionOrUndefined(decoded.pagination)).then(successData)
    ),
  getCreditUsage: (payload) =>
    runSdkCall("getCreditUsage", M.FirecrawlGetCreditUsagePayload, M.FirecrawlGetCreditUsageSuccess, payload, () =>
      client.getCreditUsage().then(successData)
    ),
  getCreditUsageHistorical: (payload) =>
    runSdkCall(
      "getCreditUsageHistorical",
      M.FirecrawlGetCreditUsageHistoricalPayload,
      M.FirecrawlGetCreditUsageHistoricalSuccess,
      payload,
      (decoded) => client.getCreditUsageHistorical(optionOrUndefined(decoded.byApiKey)).then(successData)
    ),
  getMonitor: (payload) =>
    runSdkCall("getMonitor", M.FirecrawlGetMonitorPayload, M.FirecrawlGetMonitorSuccess, payload, (decoded) =>
      client.getMonitor(decoded.monitorId).then(successData)
    ),
  getMonitorCheck: (payload) =>
    runSdkCall(
      "getMonitorCheck",
      M.FirecrawlGetMonitorCheckPayload,
      M.FirecrawlGetMonitorCheckSuccess,
      payload,
      (decoded) =>
        client.getMonitorCheck(decoded.monitorId, decoded.checkId, optionOrUndefined(decoded.options)).then(successData)
    ),
  getQueueStatus: (payload) =>
    runSdkCall("getQueueStatus", M.FirecrawlGetQueueStatusPayload, M.FirecrawlGetQueueStatusSuccess, payload, () =>
      client.getQueueStatus().then(successData)
    ),
  getTokenUsage: (payload) =>
    runSdkCall("getTokenUsage", M.FirecrawlGetTokenUsagePayload, M.FirecrawlGetTokenUsageSuccess, payload, () =>
      client.getTokenUsage().then(successData)
    ),
  getTokenUsageHistorical: (payload) =>
    runSdkCall(
      "getTokenUsageHistorical",
      M.FirecrawlGetTokenUsageHistoricalPayload,
      M.FirecrawlGetTokenUsageHistoricalSuccess,
      payload,
      (decoded) => client.getTokenUsageHistorical(optionOrUndefined(decoded.byApiKey)).then(successData)
    ),
  interact: (payload) =>
    runSdkCall("interact", M.FirecrawlInteractPayload, M.FirecrawlInteractSuccess, payload, (decoded) =>
      client.interact(decoded.jobId, decoded.args).then(successData)
    ),
  listBrowsers: (payload) =>
    runSdkCall("listBrowsers", M.FirecrawlListBrowsersPayload, M.FirecrawlListBrowsersSuccess, payload, (decoded) =>
      client.listBrowsers(optionOrUndefined(decoded.options)).then(successData)
    ),
  listMonitorChecks: (payload) =>
    runSdkCall(
      "listMonitorChecks",
      M.FirecrawlListMonitorChecksPayload,
      M.FirecrawlListMonitorChecksSuccess,
      payload,
      (decoded) => client.listMonitorChecks(decoded.monitorId, optionOrUndefined(decoded.options)).then(successData)
    ),
  listMonitors: (payload) =>
    runSdkCall("listMonitors", M.FirecrawlListMonitorsPayload, M.FirecrawlListMonitorsSuccess, payload, (decoded) =>
      client.listMonitors(optionOrUndefined(decoded.options)).then(successData)
    ),
  map: (payload) =>
    runSdkCall("map", M.FirecrawlMapPayload, M.FirecrawlMapSuccess, payload, (decoded) =>
      client.map(decoded.url, optionOrUndefined(decoded.options)).then(successData)
    ),
  parse: (payload) =>
    runSdkCall("parse", M.FirecrawlParsePayload, M.FirecrawlParseSuccess, payload, (decoded) =>
      client.parse(decoded.file, optionOrUndefined(decoded.options)).then(successData)
    ),
  runMonitor: (payload) =>
    runSdkCall("runMonitor", M.FirecrawlRunMonitorPayload, M.FirecrawlRunMonitorSuccess, payload, (decoded) =>
      client.runMonitor(decoded.monitorId).then(successData)
    ),
  scrape: (payload) =>
    runSdkCall("scrape", M.FirecrawlScrapePayload, M.FirecrawlScrapeSuccess, payload, (decoded) =>
      client.scrape(decoded.url, optionOrUndefined(decoded.options)).then(successData)
    ),
  search: (payload) =>
    runSdkCall("search", M.FirecrawlSearchPayload, M.FirecrawlSearchSuccess, payload, (decoded) =>
      client.search(decoded.query, optionOrUndefined(decoded.request)).then(successData)
    ),
  startAgent: (payload) =>
    runSdkCall("startAgent", M.FirecrawlStartAgentPayload, M.FirecrawlStartAgentSuccess, payload, (decoded) =>
      client.startAgent(decoded.request).then(successData)
    ),
  startBatchScrape: (payload) =>
    runSdkCall(
      "startBatchScrape",
      M.FirecrawlStartBatchScrapePayload,
      M.FirecrawlStartBatchScrapeSuccess,
      payload,
      (decoded) =>
        client.startBatchScrape(A.fromIterable(decoded.urls), optionOrUndefined(decoded.options)).then(successData)
    ),
  startCrawl: (payload) =>
    runSdkCall("startCrawl", M.FirecrawlStartCrawlPayload, M.FirecrawlStartCrawlSuccess, payload, (decoded) =>
      client.startCrawl(decoded.url, optionOrUndefined(decoded.request)).then(successData)
    ),
  stopInteraction: (payload) =>
    runSdkCall(
      "stopInteraction",
      M.FirecrawlStopInteractionPayload,
      M.FirecrawlStopInteractionSuccess,
      payload,
      (decoded) => client.stopInteraction(decoded.jobId).then(successData)
    ),
  updateMonitor: (payload) =>
    runSdkCall("updateMonitor", M.FirecrawlUpdateMonitorPayload, M.FirecrawlUpdateMonitorSuccess, payload, (decoded) =>
      client.updateMonitor(decoded.monitorId, decoded.request).then(successData)
    ),
  watcher: (payload) =>
    Stream.unwrap(
      decodeWith("watcher", M.FirecrawlWatcherPayload, payload, "request encoding").pipe(
        Effect.flatMap((decoded) =>
          Effect.try({
            try: () => client.watcher(decoded.jobId, optionOrUndefined(decoded.options)),
            catch: (cause) => FirecrawlError.fromUnknown("watcher", cause),
          })
        ),
        Effect.map((watcher) => makeWatcherStream("watcher", watcher)),
        Effect.tapError(logDriverFailure("firecrawl.watcher_failure")),
        Effect.withSpan("firecrawl.watcher", {
          attributes: {
            "firecrawl.method": "watcher",
          },
        })
      )
    ),
});

/**
 * Effect service for the Firecrawl v2 SDK.
 *
 * @example
 * ```ts
 * import { Firecrawl, FirecrawlConfigInput } from "@beep/firecrawl"
 * import { Redacted } from "effect"
 *
 * const layer = Firecrawl.makeLayer(
 *   FirecrawlConfigInput.make({
 *     apiKey: Redacted.make("fc-test-key")
 *   })
 * )
 *
 * console.log(layer)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Firecrawl extends Context.Service<Firecrawl, FirecrawlShape>()($I`Firecrawl`) {
  /**
   * Build a Firecrawl layer from explicit runtime configuration.
   *
   * @example
   * ```ts
   * import { Firecrawl, FirecrawlConfigInput } from "@beep/firecrawl"
   * import { Redacted } from "effect"
   *
   * const layer = Firecrawl.makeLayer(
   *   FirecrawlConfigInput.make({
   *     apiKey: Redacted.make("fc-test-key")
   *   })
   * )
   *
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (config: FirecrawlConfigInput): Layer.Layer<Firecrawl, FirecrawlError> =>
    Layer.effect(
      Firecrawl,
      Effect.gen(function* () {
        const resolved = yield* resolveConfig(config);
        return Firecrawl.of(makeService(makeSdkClient(resolved)));
      })
    );

  /**
   * Build a Firecrawl layer from a test or alternate SDK client.
   *
   * @example
   * ```ts
   * import { Firecrawl } from "@beep/firecrawl"
   * import type { FirecrawlSdkClient } from "@beep/firecrawl"
   *
   * const makeLayer = (client: FirecrawlSdkClient) => Firecrawl.makeLayerFromClient(client)
   * console.log(makeLayer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayerFromClient = (client: FirecrawlSdkClient): Layer.Layer<Firecrawl> =>
    Layer.succeed(Firecrawl, Firecrawl.of(makeService(client)));

  /**
   * Live Firecrawl layer backed by Effect Config values.
   *
   * @example
   * ```ts
   * import { Firecrawl } from "@beep/firecrawl"
   *
   * console.log(Firecrawl.layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<Firecrawl, FirecrawlError> = Layer.effect(
    Firecrawl,
    Effect.gen(function* () {
      const apiKey = yield* Config.redacted("FIRECRAWL_API_KEY");
      const apiUrl = yield* Config.string("FIRECRAWL_API_URL").pipe(Config.withDefault(FIRECRAWL_API_URL));
      const backoffFactor = yield* Config.number("FIRECRAWL_BACKOFF_FACTOR").pipe(Config.option);
      const maxRetries = yield* Config.number("FIRECRAWL_MAX_RETRIES").pipe(Config.option);
      const timeoutMs = yield* Config.number("FIRECRAWL_TIMEOUT_MS").pipe(Config.option);
      const resolved = yield* resolveConfig(
        FirecrawlConfigInput.make({
          apiKey,
          apiUrl,
          ...OptionUtils.getSomesStruct({
            backoffFactor,
            maxRetries,
            timeoutMs,
          }),
        })
      );

      return Firecrawl.of(makeService(makeSdkClient(resolved)));
    }).pipe(Effect.mapError((cause) => FirecrawlError.fromReason("config", { cause })))
  );
}
