import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { HttpRouter } from "effect/unstable/http";
import { ApiLive } from "@/runtime/Layer";

const decodeOpenApiDocument = S.decodeUnknownEffect(
  S.fromJsonString(
    S.Struct({
      openapi: S.String,
    })
  )
);
const decodeUnknownJson = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));

const verifyDocsRoutes = Effect.fn("ApiDocs.test.verifyDocsRoutes")(function* () {
  const webHandler = yield* Effect.acquireRelease(
    Effect.sync(() => HttpRouter.toWebHandler(ApiLive, { disableLogger: true })),
    ({ dispose }) => Effect.promise(dispose)
  );

  const contractSpecResponse = yield* Effect.tryPromise(() =>
    webHandler.handler(new Request("http://api-docs.test/apis/qa-collector/openapi.json"))
  );
  expect(contractSpecResponse.status).toBe(200);
  const contractSpec = yield* Effect.tryPromise(() => contractSpecResponse.text()).pipe(
    Effect.flatMap(decodeOpenApiDocument)
  );
  expect(contractSpec.openapi).toBeTruthy();

  const contractDocsResponse = yield* Effect.tryPromise(() =>
    webHandler.handler(new Request("http://api-docs.test/apis/qa-collector/docs"))
  );
  expect(contractDocsResponse.status).toBe(200);
  expect(contractDocsResponse.headers.get("content-type")).toContain("text/html");
  expect(yield* Effect.tryPromise(() => contractDocsResponse.text())).toContain("api-reference");

  const committedSpecResponse = yield* Effect.tryPromise(() =>
    webHandler.handler(new Request("http://api-docs.test/apis/govinfo-full/openapi.json"))
  );
  expect(committedSpecResponse.status).toBe(200);
  yield* Effect.tryPromise(() => committedSpecResponse.text()).pipe(Effect.flatMap(decodeUnknownJson));

  const committedDocsResponse = yield* Effect.tryPromise(() =>
    webHandler.handler(new Request("http://api-docs.test/apis/govinfo-full/docs"))
  );
  expect(committedDocsResponse.status).toBe(200);
  expect(committedDocsResponse.headers.get("content-security-policy")).toContain("script-src 'self'");
  const committedDocs = yield* Effect.tryPromise(() => committedDocsResponse.text());
  expect(committedDocs).toContain('src="/assets/scalar-api-reference-1.43.5.js"');
  expect(committedDocs).not.toContain("cdn.jsdelivr.net");

  const scalarScriptResponse = yield* Effect.tryPromise(() =>
    webHandler.handler(new Request("http://api-docs.test/assets/scalar-api-reference-1.43.5.js"))
  );
  expect(scalarScriptResponse.status).toBe(200);
  expect(scalarScriptResponse.headers.get("content-type")).toContain("text/javascript");
  const scalarScript = yield* Effect.tryPromise(() => scalarScriptResponse.text());
  expect(scalarScript).toContain("@scalar/api-reference@1.43.5");
  expect(scalarScript.length).toBeGreaterThan(1_000_000);
});

describe("API docs routes", () => {
  it.effect("serves contract docs and committed specifications", () => verifyDocsRoutes().pipe(Effect.scoped));
});
