import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as S from "effect/Schema";
import { Health } from "@/Api";
import { ApiLive } from "@/runtime/Layer";

class HealthTestOperationError extends S.TaggedError<HealthTestOperationError, { readonly brand: unique symbol }>()(
  "HealthTestOperationError",
  { cause: S.Defect({ includeStack: true }) },
  { description: "A failed external operation in health.test.ts." }
) {}

const decodeHealth = S.decodeUnknownEffect(S.fromJsonString(Health));

const verifyHealth = Effect.fn("ApiDocs.test.verifyHealth")(function* () {
  const webHandler = yield* Effect.acquireRelease(
    Effect.sync(() => HttpRouter.toWebHandler(ApiLive, { disableLogger: true })),
    ({ dispose }) => Effect.promise(dispose)
  );
  const response = yield* Effect.tryPromise({
    try: () => webHandler.handler(new Request("http://api-docs.test/health")),
    catch: (cause) => HealthTestOperationError.make({ cause }),
  });
  expect(response.status).toBe(200);
  const health = yield* Effect.tryPromise({
    try: () => response.text(),
    catch: (cause) => HealthTestOperationError.make({ cause }),
  }).pipe(Effect.flatMap(decodeHealth));

  expect(health.status).toBe("ok");
});

describe("@beep/api-docs", () => {
  it.effect("serves GET /health", verifyHealth);
});
