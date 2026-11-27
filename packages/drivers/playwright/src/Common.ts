/**
 * Effect-aware wrappers for Playwright requests, responses, workers, dialogs,
 * file choosers, and downloads.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PlaywrightId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Stream from "effect/Stream";
import { makeFrame } from "./Frame.ts";
import { useHelper } from "./internal/use.ts";
import { makePage } from "./Page.ts";
import { wrapError } from "./PlaywrightError.ts";
import type {
  Dialog as CoreDialog,
  Download as CoreDownload,
  FileChooser as CoreFileChooser,
  Request as CoreRequest,
  Response as CoreResponse,
  Worker as CoreWorker,
  ElementHandle,
} from "playwright";
import type { FrameShape } from "./Frame.ts";
import type { PageShape } from "./Page.ts";
import type { PlaywrightError } from "./PlaywrightError.ts";
import type { PageFunction } from "./PlaywrightTypes.ts";

const $I = $PlaywrightId.create("Common");

/**
 * A network request made by a page, with asynchronous reads as Effects and nullable reads as Options.
 *
 * @category models
 * @since 0.0.0
 */
export interface RequestShape {
  /**
   * An object with all the request HTTP headers associated with this request. The header names are lower-cased.
   *
   * @see {@link CoreRequest.allHeaders} for the wrapped Playwright method.
   */
  readonly allHeaders: Effect.Effect<Awaited<ReturnType<CoreRequest["allHeaders"]>>, PlaywrightError>;
  /**
   * Returns the matching Response object, or none if the response was not received yet.
   *
   * @see {@link CoreRequest.existingResponse} for the wrapped Playwright method.
   */
  readonly existingResponse: () => O.Option<ResponseShape>;
  /**
   * Returns none unless this request was a failed one.
   *
   * @see {@link CoreRequest.failure} for the wrapped Playwright method.
   */
  readonly failure: () => O.Option<NonNullable<ReturnType<CoreRequest["failure"]>>>;
  /**
   * Returns the Frame that initiated this request.
   *
   * @see {@link CoreRequest.frame} for the wrapped Playwright method.
   */
  readonly frame: Effect.Effect<FrameShape, PlaywrightError>;
  /**
   * An object with the request HTTP headers. The header names are lower-cased.
   *
   * @see {@link CoreRequest.headers} for the wrapped Playwright method.
   */
  readonly headers: () => ReturnType<CoreRequest["headers"]>;
  /**
   * An array with all the request HTTP headers associated with this request.
   *
   * @see {@link CoreRequest.headersArray} for the wrapped Playwright method.
   */
  readonly headersArray: Effect.Effect<Awaited<ReturnType<CoreRequest["headersArray"]>>, PlaywrightError>;
  /**
   * Returns the value of the header matching the name. The name is case insensitive.
   *
   * @see {@link CoreRequest.headerValue} for the wrapped Playwright method.
   */
  readonly headerValue: (name: string) => Effect.Effect<O.Option<string>, PlaywrightError>;
  /**
   * Whether this request is driving frame's navigation.
   *
   * @see {@link CoreRequest.isNavigationRequest} for the wrapped Playwright method.
   */
  readonly isNavigationRequest: () => boolean;
  /**
   * Request's method (GET, POST, etc.)
   *
   * @see {@link CoreRequest.method} for the wrapped Playwright method.
   */
  readonly method: () => string;
  /**
   * Request's post body, if any.
   *
   * @see {@link CoreRequest.postData} for the wrapped Playwright method.
   */
  readonly postData: () => O.Option<string>;
  /**
   * Request's post body in a binary form, if any.
   *
   * @see {@link CoreRequest.postDataBuffer} for the wrapped Playwright method.
   */
  readonly postDataBuffer: () => O.Option<NonNullable<ReturnType<CoreRequest["postDataBuffer"]>>>;
  /**
   * Returns parsed request's body for form-urlencoded and JSON requests.
   *
   * @see {@link CoreRequest.postDataJSON} for the wrapped Playwright method.
   */
  readonly postDataJSON: Effect.Effect<
    O.Option<NonNullable<Awaited<ReturnType<CoreRequest["postDataJSON"]>>>>,
    PlaywrightError
  >;
  /**
   * Request that was redirected by the server to this one, if any.
   *
   * @see {@link CoreRequest.redirectedFrom} for the wrapped Playwright method.
   */
  readonly redirectedFrom: () => O.Option<RequestShape>;
  /**
   * New request issued by the browser if the server responded with redirect.
   *
   * @see {@link CoreRequest.redirectedTo} for the wrapped Playwright method.
   */
  readonly redirectedTo: () => O.Option<RequestShape>;
  /**
   * Contains the request's resource type as it was perceived by the rendering engine.
   *
   * @see {@link CoreRequest.resourceType} for the wrapped Playwright method.
   */
  readonly resourceType: () => string;
  /**
   * Returns the matching Response object, or none if the response was not received due to error.
   *
   * @see {@link CoreRequest.response} for the wrapped Playwright method.
   */
  readonly response: Effect.Effect<O.Option<ResponseShape>, PlaywrightError>;
  /**
   * Returns the ServiceWorker that initiated this request.
   *
   * @see {@link CoreRequest.serviceWorker} for the wrapped Playwright method.
   */
  readonly serviceWorker: () => O.Option<WorkerShape>;
  /**
   * Returns resource size information for given request.
   *
   * @see {@link CoreRequest.sizes} for the wrapped Playwright method.
   */
  readonly sizes: Effect.Effect<Awaited<ReturnType<CoreRequest["sizes"]>>, PlaywrightError>;
  /**
   * Returns resource timing information for given request.
   *
   * @see {@link CoreRequest.timing} for the wrapped Playwright method.
   */
  readonly timing: () => ReturnType<CoreRequest["timing"]>;
  /**
   * URL of the request.
   *
   * @see {@link CoreRequest.url} for the wrapped Playwright method.
   */
  readonly url: () => string;
}

/**
 * Service for a {@link RequestShape}.
 *
 * **Example** (Read the provided request)
 *
 * ```ts
 * import { Request } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 *
 * const describeRequest = Effect.gen(function* () {
 *   const request = yield* Request
 *   return `${request.method()} ${request.url()}`
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Request extends Context.Service<Request, RequestShape>()($I`Request`) {}

/**
 * Creates a `Request` from a Playwright `Request` instance.
 *
 * **Example** (Wrap a page's next request)
 *
 * ```ts
 * import { makeRequest } from "@beep/playwright"
 * import type { Page } from "playwright"
 *
 * const nextRequestUrl = async (page: Page) => makeRequest(await page.waitForRequest("**")).url()
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeRequest = (request: CoreRequest): RequestShape => {
  const use = useHelper(request);

  return Request.of({
    allHeaders: use((r) => r.allHeaders()),
    existingResponse: () => O.fromNullishOr(request.existingResponse()).pipe(O.map(makeResponse)),
    failure: () => O.fromNullishOr(request.failure()),
    frame: Effect.try({ try: () => makeFrame(request.frame()), catch: wrapError }),
    headerValue: Effect.fn("Request.headerValue")((name) =>
      use((r) => r.headerValue(name)).pipe(Effect.map(O.fromNullishOr))
    ),
    headers: () => request.headers(),
    headersArray: use((r) => r.headersArray()),
    isNavigationRequest: () => request.isNavigationRequest(),
    method: () => request.method(),
    postData: () => O.fromNullishOr(request.postData()),
    postDataBuffer: () => O.fromNullishOr(request.postDataBuffer()),
    postDataJSON: Effect.try({ try: () => request.postDataJSON(), catch: wrapError }).pipe(Effect.map(O.fromNullishOr)),
    redirectedFrom: () => O.fromNullishOr(request.redirectedFrom()).pipe(O.map(makeRequest)),
    redirectedTo: () => O.fromNullishOr(request.redirectedTo()).pipe(O.map(makeRequest)),
    resourceType: () => request.resourceType(),
    response: use((r) => r.response()).pipe(Effect.map(O.fromNullishOr), Effect.map(O.map(makeResponse))),
    serviceWorker: () => O.fromNullishOr(request.serviceWorker()).pipe(O.map(makeWorker)),
    sizes: use((r) => r.sizes()),
    timing: () => request.timing(),
    url: () => request.url(),
  });
};

/**
 * A network response received by a page, with body reads as Effects and nullable reads as Options.
 *
 * @category models
 * @since 0.0.0
 */
export interface ResponseShape {
  /**
   * An object with all the response HTTP headers associated with this response.
   *
   * @see {@link CoreResponse.allHeaders} for the wrapped Playwright method.
   */
  readonly allHeaders: Effect.Effect<Awaited<ReturnType<CoreResponse["allHeaders"]>>, PlaywrightError>;
  /**
   * Returns the buffer with response body.
   *
   * @see {@link CoreResponse.body} for the wrapped Playwright method.
   */
  readonly body: Effect.Effect<Awaited<ReturnType<CoreResponse["body"]>>, PlaywrightError>;
  /**
   * Waits for this response to finish, returns the request failure error text if any.
   *
   * @see {@link CoreResponse.finished} for the wrapped Playwright method.
   */
  readonly finished: Effect.Effect<Awaited<ReturnType<CoreResponse["finished"]>>, PlaywrightError>;
  /**
   * Returns the Frame that initiated this response.
   *
   * @see {@link CoreResponse.frame} for the wrapped Playwright method.
   */
  readonly frame: Effect.Effect<FrameShape, PlaywrightError>;
  /**
   * Whether this Response was fulfilled by a Service Worker's Fetch Handler.
   *
   * @see {@link CoreResponse.fromServiceWorker} for the wrapped Playwright method.
   */
  readonly fromServiceWorker: () => boolean;
  /**
   * An object with the response HTTP headers. The header names are lower-cased.
   *
   * @see {@link CoreResponse.headers} for the wrapped Playwright method.
   */
  readonly headers: () => ReturnType<CoreResponse["headers"]>;
  /**
   * An array with all the response HTTP headers associated with this response.
   *
   * @see {@link CoreResponse.headersArray} for the wrapped Playwright method.
   */
  readonly headersArray: Effect.Effect<Awaited<ReturnType<CoreResponse["headersArray"]>>, PlaywrightError>;
  /**
   * Returns the value of the header matching the name. The name is case insensitive.
   *
   * @see {@link CoreResponse.headerValue} for the wrapped Playwright method.
   */
  readonly headerValue: (name: string) => Effect.Effect<O.Option<string>, PlaywrightError>;
  /**
   * Returns all values of the headers matching the name. The name is case insensitive.
   *
   * @see {@link CoreResponse.headerValues} for the wrapped Playwright method.
   */
  readonly headerValues: (
    name: string
  ) => Effect.Effect<Awaited<ReturnType<CoreResponse["headerValues"]>>, PlaywrightError>;
  /**
   * Returns the HTTP version of the response.
   *
   * @see {@link CoreResponse.httpVersion} for the wrapped Playwright method.
   */
  readonly httpVersion: Effect.Effect<Awaited<ReturnType<CoreResponse["httpVersion"]>>, PlaywrightError>;
  /**
   * Returns the JSON representation of response body.
   *
   * @see {@link CoreResponse.json} for the wrapped Playwright method.
   */
  readonly json: Effect.Effect<Awaited<ReturnType<CoreResponse["json"]>>, PlaywrightError>;
  /**
   * Whether the response was successful (status in the range 200-299).
   *
   * @see {@link CoreResponse.ok} for the wrapped Playwright method.
   */
  readonly ok: () => boolean;
  /**
   * Returns the matching Request object.
   *
   * @see {@link CoreResponse.request} for the wrapped Playwright method.
   */
  readonly request: () => RequestShape;
  /**
   * Returns SSL and other security information, if any.
   *
   * @see {@link CoreResponse.securityDetails} for the wrapped Playwright method.
   */
  readonly securityDetails: Effect.Effect<
    O.Option<NonNullable<Awaited<ReturnType<CoreResponse["securityDetails"]>>>>,
    PlaywrightError
  >;
  /**
   * Returns the IP address and port of the server, if any.
   *
   * @see {@link CoreResponse.serverAddr} for the wrapped Playwright method.
   */
  readonly serverAddr: Effect.Effect<
    O.Option<NonNullable<Awaited<ReturnType<CoreResponse["serverAddr"]>>>>,
    PlaywrightError
  >;
  /**
   * Contains the status code of the response (e.g., 200 for a success).
   *
   * @see {@link CoreResponse.status} for the wrapped Playwright method.
   */
  readonly status: () => number;
  /**
   * Contains the status text of the response (e.g. usually an "OK" for a success).
   *
   * @see {@link CoreResponse.statusText} for the wrapped Playwright method.
   */
  readonly statusText: () => string;
  /**
   * Returns the text representation of response body.
   *
   * @see {@link CoreResponse.text} for the wrapped Playwright method.
   */
  readonly text: Effect.Effect<Awaited<ReturnType<CoreResponse["text"]>>, PlaywrightError>;
  /**
   * Contains the URL of the response.
   *
   * @see {@link CoreResponse.url} for the wrapped Playwright method.
   */
  readonly url: () => string;
}

/**
 * Service for a {@link ResponseShape}.
 *
 * **Example** (Read the provided response body)
 *
 * ```ts
 * import { Response } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 *
 * const body = Effect.gen(function* () {
 *   const response = yield* Response
 *   return response.ok() ? yield* response.text : ""
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Response extends Context.Service<Response, ResponseShape>()($I`Response`) {}

/**
 * Creates a `Response` from a Playwright `Response` instance.
 *
 * **Example** (Wrap a page's next response)
 *
 * ```ts
 * import { makeResponse } from "@beep/playwright"
 * import type { Page } from "playwright"
 *
 * const nextStatus = async (page: Page) => makeResponse(await page.waitForResponse("**")).status()
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeResponse = (response: CoreResponse): ResponseShape => {
  const use = useHelper(response);

  return Response.of({
    allHeaders: use((r) => r.allHeaders()),
    body: use((r) => r.body()),
    finished: use((r) => r.finished()),
    frame: Effect.try({ try: () => makeFrame(response.frame()), catch: wrapError }),
    fromServiceWorker: () => response.fromServiceWorker(),
    headers: () => response.headers(),
    headersArray: use((r) => r.headersArray()),
    headerValue: Effect.fn("Response.headerValue")((name) =>
      use((r) => r.headerValue(name)).pipe(Effect.map(O.fromNullishOr))
    ),
    headerValues: Effect.fn("Response.headerValues")((name) => use((r) => r.headerValues(name))),
    httpVersion: use((r) => r.httpVersion()),
    json: use((r) => r.json()),
    ok: () => response.ok(),
    request: () => makeRequest(response.request()),
    securityDetails: use((r) => r.securityDetails()).pipe(Effect.map(O.fromNullishOr)),
    serverAddr: use((r) => r.serverAddr()).pipe(Effect.map(O.fromNullishOr)),
    status: () => response.status(),
    statusText: () => response.statusText(),
    text: use((r) => r.text()),
    url: () => response.url(),
  });
};

/**
 * A web or service worker started by a page.
 *
 * @category models
 * @since 0.0.0
 */
export interface WorkerShape {
  /**
   * Evaluates a function in the worker context and returns its result.
   *
   * @see {@link CoreWorker.evaluate} for the wrapped Playwright method.
   */
  readonly evaluate: <R, Arg = void>(
    pageFunction: PageFunction<Arg, R>,
    arg?: Arg
  ) => Effect.Effect<R, PlaywrightError>;
  /**
   * The URL of the worker script.
   *
   * @see {@link CoreWorker.url} for the wrapped Playwright method.
   */
  readonly url: () => string;
}

/**
 * Service for a {@link WorkerShape}.
 *
 * **Example** (Evaluate in the provided worker)
 *
 * ```ts
 * import { Worker } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 *
 * const sum = Effect.gen(function* () {
 *   const worker = yield* Worker
 *   return yield* worker.evaluate(() => 1 + 1)
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Worker extends Context.Service<Worker, WorkerShape>()($I`Worker`) {}

/**
 * Creates a `Worker` from a Playwright `Worker` instance.
 *
 * **Example** (Wrap a page's first worker)
 *
 * ```ts
 * import { makeWorker } from "@beep/playwright"
 * import type { Page } from "playwright"
 *
 * const firstWorkerUrl = (page: Page) => page.workers().map(makeWorker).at(0)?.url()
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeWorker = (worker: CoreWorker): WorkerShape => {
  const use = useHelper(worker);

  return Worker.of({
    evaluate: Effect.fn("Worker.evaluate")(<R, Arg>(pageFunction: PageFunction<Arg, R>, arg?: Arg) =>
      use((w) =>
        w.evaluate<R, Arg | undefined>(
          pageFunction as unknown as Parameters<typeof w.evaluate<R, Arg | undefined>>[0],
          arg
        )
      )
    ),
    url: () => worker.url(),
  });
};

/**
 * A JavaScript dialog (`alert`, `confirm`, `prompt` or `beforeunload`) opened by a page.
 *
 * @category models
 * @since 0.0.0
 */
export interface DialogShape {
  /**
   * Returns when the dialog has been accepted.
   *
   * @param promptText - A text to enter in prompt. Does not cause any effects if the dialog's type is not prompt.
   * @see {@link CoreDialog.accept} for the wrapped Playwright method.
   */
  readonly accept: (promptText?: string) => Effect.Effect<void, PlaywrightError>;
  /**
   * If dialog is prompt, returns default prompt value. Otherwise, returns empty string.
   *
   * @see {@link CoreDialog.defaultValue} for the wrapped Playwright method.
   */
  readonly defaultValue: () => string;
  /**
   * Returns when the dialog has been dismissed.
   *
   * @see {@link CoreDialog.dismiss} for the wrapped Playwright method.
   */
  readonly dismiss: Effect.Effect<void, PlaywrightError>;
  /**
   * A message displayed in the dialog.
   *
   * @see {@link CoreDialog.message} for the wrapped Playwright method.
   */
  readonly message: () => string;
  /**
   * The page that initiated this dialog, if available.
   *
   * @see {@link CoreDialog.page} for the wrapped Playwright method.
   */
  readonly page: () => O.Option<PageShape>;
  /**
   * Returns dialog's type, can be one of `alert`, `beforeunload`, `confirm` or `prompt`.
   *
   * @see {@link CoreDialog."type"} for the wrapped Playwright method.
   */
  readonly type: () => string;
}

/**
 * Service for a {@link DialogShape}.
 *
 * **Example** (Accept the provided dialog)
 *
 * ```ts
 * import { Dialog } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 *
 * const accepted = Effect.gen(function* () {
 *   const dialog = yield* Dialog
 *   yield* dialog.accept()
 *   return dialog.message()
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Dialog extends Context.Service<Dialog, DialogShape>()($I`Dialog`) {}

/**
 * Creates a `Dialog` from a Playwright `Dialog` instance.
 *
 * **Example** (Dismiss every dialog of a page)
 *
 * ```ts
 * import { makeDialog } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 * import type { Page } from "playwright"
 *
 * const dismissDialogs = (page: Page) =>
 *   page.on("dialog", (dialog) => Effect.runFork(makeDialog(dialog).dismiss))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeDialog = (dialog: CoreDialog): DialogShape => {
  const use = useHelper(dialog);

  return Dialog.of({
    accept: Effect.fn("Dialog.accept")((promptText) => use((d) => d.accept(promptText))),
    defaultValue: () => dialog.defaultValue(),
    dismiss: use((d) => d.dismiss()),
    message: () => dialog.message(),
    page: () => O.fromNullishOr(dialog.page()).pipe(O.map(makePage)),
    type: () => dialog.type(),
  });
};

/**
 * A file chooser opened by a page, typically by clicking a file input.
 *
 * @category models
 * @since 0.0.0
 */
export interface FileChooserShape {
  /**
   * Returns input element associated with this file chooser.
   *
   * @see {@link CoreFileChooser.element} for the wrapped Playwright method.
   */
  readonly element: () => ElementHandle;
  /**
   * Returns whether this file chooser accepts multiple files.
   *
   * @see {@link CoreFileChooser.isMultiple} for the wrapped Playwright method.
   */
  readonly isMultiple: () => boolean;
  /**
   * Returns page this file chooser belongs to.
   *
   * @see {@link CoreFileChooser.page} for the wrapped Playwright method.
   */
  readonly page: () => PageShape;
  /**
   * Sets the value of the file input this chooser is associated with.
   *
   * @see {@link CoreFileChooser.setFiles} for the wrapped Playwright method.
   */
  readonly setFiles: (
    files: Parameters<CoreFileChooser["setFiles"]>[0],
    options?: Parameters<CoreFileChooser["setFiles"]>[1]
  ) => Effect.Effect<void, PlaywrightError>;
}

/**
 * Service for a {@link FileChooserShape}.
 *
 * **Example** (Choose a file in the provided chooser)
 *
 * ```ts
 * import { FileChooser } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 *
 * const chosen = Effect.gen(function* () {
 *   const fileChooser = yield* FileChooser
 *   yield* fileChooser.setFiles("fixtures/notes.txt")
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FileChooser extends Context.Service<FileChooser, FileChooserShape>()($I`FileChooser`) {}

/**
 * Creates a `FileChooser` from a Playwright `FileChooser` instance.
 *
 * **Example** (Wrap a page's next file chooser)
 *
 * ```ts
 * import { makeFileChooser } from "@beep/playwright"
 * import type { Page } from "playwright"
 *
 * const acceptsMany = async (page: Page) => makeFileChooser(await page.waitForEvent("filechooser")).isMultiple()
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeFileChooser = (fileChooser: CoreFileChooser): FileChooserShape => {
  const use = useHelper(fileChooser);

  return FileChooser.of({
    element: () => fileChooser.element(),
    isMultiple: () => fileChooser.isMultiple(),
    page: () => makePage(fileChooser.page()),
    setFiles: Effect.fn("FileChooser.setFiles")((files, options) => use((f) => f.setFiles(files, options))),
  });
};

/**
 * A file download started by a page, with its data available as a stream.
 *
 * @category models
 * @since 0.0.0
 */
export interface DownloadShape {
  /**
   * Cancels a download. Does not fail if the download is already finished or canceled.
   *
   * @see {@link CoreDownload.cancel} for the wrapped Playwright method.
   */
  readonly cancel: Effect.Effect<void, PlaywrightError>;
  /**
   * Deletes the downloaded file. Will wait for the download to finish if necessary.
   *
   * @see {@link CoreDownload.delete} for the wrapped Playwright method.
   */
  readonly delete: Effect.Effect<void, PlaywrightError>;
  /**
   * Returns the download error, if any. Will wait for the download to finish if necessary.
   *
   * @see {@link CoreDownload.failure} for the wrapped Playwright method.
   */
  readonly failure: Effect.Effect<O.Option<string>, PlaywrightError>;
  /**
   * Get the page that the download belongs to.
   *
   * @see {@link CoreDownload.page} for the wrapped Playwright method.
   */
  readonly page: () => PageShape;
  /**
   * Returns the path to the downloaded file for a successful download. Will wait for the download to finish if
   * necessary.
   *
   * @see {@link CoreDownload.path} for the wrapped Playwright method.
   */
  readonly path: Effect.Effect<O.Option<string>, PlaywrightError>;
  /**
   * Copy the download to a user-specified path. It is safe to call this method while the download is still in
   * progress. Will wait for the download to finish if necessary.
   *
   * @see {@link CoreDownload.saveAs} for the wrapped Playwright method.
   */
  readonly saveAs: (path: string) => Effect.Effect<void, PlaywrightError>;
  /**
   * A stream of the download data.
   *
   * @see {@link CoreDownload.createReadStream} for the wrapped Playwright method.
   */
  readonly stream: Stream.Stream<Uint8Array, PlaywrightError>;
  /**
   * Returns suggested filename for this download.
   *
   * @see {@link CoreDownload.suggestedFilename} for the wrapped Playwright method.
   */
  readonly suggestedFilename: () => string;
  /**
   * Returns downloaded url.
   *
   * @see {@link CoreDownload.url} for the wrapped Playwright method.
   */
  readonly url: () => string;
  /**
   * Runs any promise-based method on the underlying Playwright `Download`, for functionality this service does not
   * expose directly.
   *
   * @see {@link CoreDownload} for the wrapped Playwright download.
   */
  readonly use: <R>(f: (download: CoreDownload) => Promise<R>) => Effect.Effect<R, PlaywrightError>;
}

/**
 * Service for a {@link DownloadShape}.
 *
 * **Example** (Read the provided download as text)
 *
 * ```ts
 * import { Download } from "@beep/playwright"
 * import * as Effect from "effect/Effect"
 * import * as Stream from "effect/Stream"
 *
 * const contents = Effect.gen(function* () {
 *   const download = yield* Download
 *   return yield* download.stream.pipe(Stream.decodeText(), Stream.mkString)
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Download extends Context.Service<Download, DownloadShape>()($I`Download`) {}

/**
 * Creates a `Download` from a Playwright `Download` instance.
 *
 * **Example** (Save a page's next download)
 *
 * ```ts
 * import { makeDownload } from "@beep/playwright"
 * import type { Page } from "playwright"
 *
 * const saveNext = async (page: Page) => makeDownload(await page.waitForEvent("download")).saveAs("out.bin")
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeDownload = (download: CoreDownload): DownloadShape => {
  const use = useHelper(download);

  return Download.of({
    cancel: use((d) => d.cancel()),
    stream: use((d) => d.createReadStream()).pipe(
      Effect.map((readable) => Stream.fromAsyncIterable<Uint8Array, PlaywrightError>(readable, wrapError)),
      Stream.unwrap
    ),
    delete: use((d) => d.delete()),
    failure: use((d) => d.failure()).pipe(Effect.map(O.fromNullishOr)),
    page: () => makePage(download.page()),
    path: use((d) => d.path()).pipe(Effect.map(O.fromNullishOr)),
    saveAs: Effect.fn("Download.saveAs")((path) => use((d) => d.saveAs(path))),
    suggestedFilename: () => download.suggestedFilename(),
    url: () => download.url(),
    use,
  });
};
