import { it } from "@beep/test-runner";
import { afterEach, describe, expect, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as S from "effect/Schema";
import { ApiLive } from "@/runtime/Layer";

class DocsRoutesTestOperationError extends S.TaggedError<
  DocsRoutesTestOperationError,
  { readonly brand: unique symbol }
>()(
  "DocsRoutesTestOperationError",
  { cause: S.Defect({ includeStack: true }) },
  { description: "A failed external operation in Docs.routes.test.ts." }
) {}

const decodeOpenApiDocument = S.decodeUnknownEffect(
  S.fromJsonString(
    S.Struct({
      openapi: S.String,
    })
  )
);
const decodeUnknownJson = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
const scalarScriptModuleUrl = new URL(
  "./internal/httpApiScalar.js",
  import.meta.resolve("effect/http-api/HttpApiScalar")
).href;

const verifyDocsRoutes = Effect.fn("ApiDocs.test.verifyDocsRoutes")(function* () {
  const webHandler = yield* Effect.acquireRelease(
    Effect.sync(() => HttpRouter.toWebHandler(ApiLive, { disableLogger: true })),
    ({ dispose }) => Effect.promise(dispose)
  );

  const contractSpecResponse = yield* Effect.tryPromise({
    try: () => webHandler.handler(new Request("http://api-docs.test/apis/qa-collector/openapi.json")),
    catch: (cause) => DocsRoutesTestOperationError.make({ cause }),
  });
  expect(contractSpecResponse.status).toBe(200);
  const contractSpec = yield* Effect.tryPromise({
    try: () => contractSpecResponse.text(),
    catch: (cause) => DocsRoutesTestOperationError.make({ cause }),
  }).pipe(Effect.flatMap(decodeOpenApiDocument));
  expect(contractSpec.openapi).toBeTruthy();

  const contractDocsResponse = yield* Effect.tryPromise({
    try: () => webHandler.handler(new Request("http://api-docs.test/apis/qa-collector/docs")),
    catch: (cause) => DocsRoutesTestOperationError.make({ cause }),
  });
  expect(contractDocsResponse.status).toBe(200);
  expect(contractDocsResponse.headers.get("content-type")).toContain("text/html");
  const tryPromise1 = yield* Effect.tryPromise({
    try: () => contractDocsResponse.text(),
    catch: (cause) => DocsRoutesTestOperationError.make({ cause }),
  });
  expect(tryPromise1).toContain("api-reference");

  const committedSpecResponse = yield* Effect.tryPromise({
    try: () => webHandler.handler(new Request("http://api-docs.test/apis/govinfo-full/openapi.json")),
    catch: (cause) => DocsRoutesTestOperationError.make({ cause }),
  });
  expect(committedSpecResponse.status).toBe(200);
  yield* Effect.tryPromise({
    try: () => committedSpecResponse.text(),
    catch: (cause) => DocsRoutesTestOperationError.make({ cause }),
  }).pipe(Effect.flatMap(decodeUnknownJson));

  const committedDocsResponse = yield* Effect.tryPromise({
    try: () => webHandler.handler(new Request("http://api-docs.test/apis/govinfo-full/docs")),
    catch: (cause) => DocsRoutesTestOperationError.make({ cause }),
  });
  expect(committedDocsResponse.status).toBe(200);
  expect(committedDocsResponse.headers.get("content-security-policy")).toContain("script-src 'self'");
  const committedDocs = yield* Effect.tryPromise({
    try: () => committedDocsResponse.text(),
    catch: (cause) => DocsRoutesTestOperationError.make({ cause }),
  });
  expect(committedDocs).toContain('src="/assets/scalar-api-reference-1.43.5.js"');
  expect(committedDocs).not.toContain("cdn.jsdelivr.net");

  const scalarScriptResponse = yield* Effect.tryPromise({
    try: () => webHandler.handler(new Request("http://api-docs.test/assets/scalar-api-reference-1.43.5.js")),
    catch: (cause) => DocsRoutesTestOperationError.make({ cause }),
  });
  expect(scalarScriptResponse.status).toBe(200);
  expect(scalarScriptResponse.headers.get("content-type")).toContain("text/javascript");
  const scalarScript = yield* Effect.tryPromise({
    try: () => scalarScriptResponse.text(),
    catch: (cause) => DocsRoutesTestOperationError.make({ cause }),
  });
  expect(scalarScript).toContain("@scalar/api-reference@1.43.5");
  expect(scalarScript.length).toBeGreaterThan(1_000_000);
});

describe("API docs routes", () => {
  afterEach(() => vi.doUnmock(scalarScriptModuleUrl));

  it.effect("serves contract docs and committed specifications", verifyDocsRoutes);

  it.effect("returns a server error when the local Scalar script cannot be loaded", () =>
    Effect.gen(function* () {
      vi.doMock(scalarScriptModuleUrl, () => {
        throw DocsRoutesTestOperationError.make({ cause: "unavailable bundled Scalar script" });
      });
      const webHandler = yield* Effect.acquireRelease(
        Effect.sync(() => HttpRouter.toWebHandler(ApiLive, { disableLogger: true })),
        ({ dispose }) => Effect.promise(dispose)
      );
      const response = yield* Effect.promise(() =>
        webHandler.handler(new Request("http://api-docs.test/assets/scalar-api-reference-1.43.5.js"))
      );
      expect(response.status).toBe(500);
    })
  );
});
