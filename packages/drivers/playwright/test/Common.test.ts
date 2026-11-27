import { Browser } from "@beep/playwright/Browser";
import { Dialog, Download, FileChooser, Request, Response, Worker as WorkerService } from "@beep/playwright/Common";
import { PlaywrightSpawner } from "@beep/playwright/PlaywrightSpawner";
import { assert, describe, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { chromium, chromiumInstalled, launchOptions } from "./support/Chromium.ts";
import type { RequestShape } from "@beep/playwright/Common";
import type { PageShape } from "@beep/playwright/Page";

const fakeOrigin = "http://common.test";

const serveFakeOrigin = (page: PageShape) =>
  page
    .use((p) =>
      p.route(`${fakeOrigin}/**`, (route) =>
        Str.endsWith("/fail")(route.request().url())
          ? route.abort()
          : route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>common</title>" })
      )
    )
    .pipe(Effect.andThen(page.goto(`${fakeOrigin}/`)));

const nextRequestTo = (page: PageShape, path: string) =>
  page.eventStream("request").pipe(
    Stream.filter((request: RequestShape) => Str.endsWith(path)(request.url())),
    Stream.runHead,
    Effect.flatMap(Effect.fromOption),
    Effect.forkChild
  );

describe.skipIf(!chromiumInstalled)("Common", () => {
  layer(PlaywrightSpawner.layer(chromium, launchOptions), { timeout: "60 seconds" })((it) => {
    it.effect("Request.postDataJSON parses, skips an empty body, and fails on invalid JSON", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();
        yield* serveFakeOrigin(page);

        const jsonFiber = yield* nextRequestTo(page, "/api/json");
        const emptyFiber = yield* nextRequestTo(page, "/api/empty");
        const invalidFiber = yield* nextRequestTo(page, "/api/invalid");
        yield* page.evaluate(`(async () => {
          await fetch("/api/json", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hello: "world" }) });
          await fetch("/api/empty");
          await fetch("/api/invalid", { method: "POST", headers: { "content-type": "text/plain" }, body: "not json" });
        })()`);
        const json = yield* Fiber.join(jsonFiber);
        const empty = yield* Fiber.join(emptyFiber);
        const invalid = yield* Fiber.join(invalidFiber);

        const parsed = yield* json.postDataJSON;
        const absent = yield* empty.postDataJSON;
        assert.deepStrictEqual(parsed, O.some({ hello: "world" }));
        assert.isTrue(O.isNone(absent));

        const failure = yield* invalid.postDataJSON.pipe(Effect.flip);
        assert.strictEqual(failure._tag, "PlaywrightError");
        assert.strictEqual(failure.reason, "Unknown");
        assert.isTrue(P.isError(failure.cause));
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("Request nullable reads map null to None and values to Some", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();
        yield* serveFakeOrigin(page);

        const withBodyFiber = yield* nextRequestTo(page, "/api/body");
        const abortedFiber = yield* nextRequestTo(page, "/api/fail");
        const failedFiber = yield* page.eventStream("requestfailed").pipe(Stream.runHead, Effect.forkChild);
        yield* page.evaluate(`(async () => {
          await fetch("/api/body", { method: "POST", body: "hello" });
          await fetch("/api/fail").catch(() => undefined);
        })()`);
        const withBody = yield* Fiber.join(withBodyFiber);
        const aborted = yield* Fiber.join(abortedFiber);
        const failed = yield* Fiber.join(failedFiber).pipe(Effect.flatMap(Effect.fromOption));

        assert.deepStrictEqual(withBody.postData(), O.some("hello"));
        assert.deepStrictEqual(
          O.map(withBody.postDataBuffer(), (buffer) => buffer.toString("utf8")),
          O.some("hello")
        );
        assert.isTrue(O.isNone(withBody.failure()));

        assert.isTrue(O.isNone(aborted.postData()));
        assert.isTrue(O.isNone(aborted.postDataBuffer()));
        assert.isTrue(O.isSome(failed.failure()));
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("Request and Response", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.use((p) =>
          p.route(`${fakeOrigin}/`, (route) =>
            route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>common</title>" })
          )
        );

        const requestFiber = yield* page.eventStream("request").pipe(Stream.runHead, Effect.forkChild);
        const responseFiber = yield* page.eventStream("response").pipe(Stream.runHead, Effect.forkChild);

        yield* page.goto(`${fakeOrigin}/`);

        const request = yield* Fiber.join(requestFiber).pipe(Effect.flatMap(Effect.fromOption));
        const response = yield* Fiber.join(responseFiber).pipe(Effect.flatMap(Effect.fromOption));
        const providedRequest = yield* Request.pipe(Effect.provideService(Request, request));
        assert.strictEqual(providedRequest, request);
        const providedResponse = yield* Response.pipe(Effect.provideService(Response, response));
        assert.strictEqual(providedResponse, response);

        assert.isTrue(Str.includes("common.test")(request.url()));
        assert.strictEqual(request.method(), "GET");
        assert.isTrue(request.isNavigationRequest());

        assert.isTrue(Str.includes("common.test")(response.url()));
        assert.isTrue(response.ok());
        assert.strictEqual(response.status(), 200);
        assert.isDefined(response.headers()["content-type"]);
        assert.isTrue(Str.includes("common.test")(response.request().url()));

        const requestResponse = yield* request.response;
        assert.deepStrictEqual(
          O.map(requestResponse, (r) => r.url()),
          O.some(response.url())
        );
        assert.deepStrictEqual(
          O.map(request.existingResponse(), (r) => r.url()),
          O.some(response.url())
        );

        const httpVersion = yield* response.httpVersion;
        assert.isTrue(Str.isNonEmpty(httpVersion));
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("Worker", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        const workerFiber = yield* page.eventStream("worker").pipe(Stream.runHead, Effect.forkChild);

        yield* page.evaluate(
          `new Worker(URL.createObjectURL(new Blob(['console.log("worker")'], { type: "application/javascript" })))`
        );

        const worker = yield* Fiber.join(workerFiber).pipe(Effect.flatMap(Effect.fromOption));
        const providedWorker = yield* WorkerService.pipe(Effect.provideService(WorkerService, worker));
        assert.strictEqual(providedWorker, worker);

        assert.isTrue(Str.startsWith("blob:")(worker.url()));
        const result = yield* worker.evaluate(() => 1 + 1);
        assert.strictEqual(result, 2);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("Dialog", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        const dialogFiber = yield* page.eventStream("dialog").pipe(Stream.runHead, Effect.forkChild);
        const pageDialogClosedFiber = yield* page.eventStream("dialogclosed").pipe(Stream.runHead, Effect.forkChild);
        const contextDialogClosedFiber = yield* page
          .context()
          .eventStream("dialogclosed")
          .pipe(Stream.runHead, Effect.forkChild);

        yield* page.evaluate(`setTimeout(() => alert("hello world"), 10)`);

        const dialog = yield* Fiber.join(dialogFiber).pipe(Effect.flatMap(Effect.fromOption));
        const providedDialog = yield* Dialog.pipe(Effect.provideService(Dialog, dialog));
        assert.strictEqual(providedDialog, dialog);

        assert.strictEqual(dialog.message(), "hello world");
        assert.strictEqual(dialog.type(), "alert");

        yield* dialog.accept();

        const pageClosedDialog = yield* Fiber.join(pageDialogClosedFiber).pipe(Effect.flatMap(Effect.fromOption));
        const contextClosedDialog = yield* Fiber.join(contextDialogClosedFiber).pipe(Effect.flatMap(Effect.fromOption));
        assert.strictEqual(pageClosedDialog.message(), "hello world");
        assert.strictEqual(contextClosedDialog.message(), "hello world");
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("FileChooser", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.setContent('<input type="file" id="fileinput" />');

        const fileChooserFiber = yield* page.eventStream("filechooser").pipe(Stream.runHead, Effect.forkChild);

        yield* page.locator("#fileinput").click();

        const fileChooser = yield* Fiber.join(fileChooserFiber).pipe(Effect.flatMap(Effect.fromOption));
        const providedFileChooser = yield* FileChooser.pipe(Effect.provideService(FileChooser, fileChooser));
        assert.strictEqual(providedFileChooser, fileChooser);

        assert.isFalse(fileChooser.isMultiple());
        assert.isNotNull(fileChooser.element());
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("Download", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.setContent(
          '<a id="download" href="data:application/octet-stream,hello world" download="test.txt">Download</a>'
        );

        const downloadFiber = yield* page.eventStream("download").pipe(Stream.runHead, Effect.forkChild);

        yield* page.locator("#download").click();

        const download = yield* Fiber.join(downloadFiber).pipe(Effect.flatMap(Effect.fromOption));
        const providedDownload = yield* Download.pipe(Effect.provideService(Download, download));
        assert.strictEqual(providedDownload, download);

        assert.strictEqual(download.suggestedFilename(), "test.txt");
        assert.isTrue(Str.startsWith("data:")(download.url()));

        const text = yield* download.stream.pipe(Stream.decodeText(), Stream.runCollect, Effect.map(A.join("")));

        assert.strictEqual(text, "hello world");
      }).pipe(PlaywrightSpawner.withBrowser)
    );
  });
});
