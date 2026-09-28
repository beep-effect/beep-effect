import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { HttpRouter } from "effect/http";
import * as S from "effect/Schema";
import { Health } from "@/Api";
import { ApiLive } from "@/runtime/Layer";

const decodeHealth = S.decodeUnknownEffect(S.fromJsonString(Health));

const verifyHealth = Effect.fn("ApiDocs.test.verifyHealth")(function* () {
  const webHandler = yield* Effect.acquireRelease(
    Effect.sync(() => HttpRouter.toWebHandler(ApiLive, { disableLogger: true })),
    ({ dispose }) => Effect.promise(dispose)
  );
  const response = yield* Effect.tryPromise(() => webHandler.handler(new Request("http://api-docs.test/health")));
  expect(response.status).toBe(200);
  const health = yield* Effect.tryPromise(() => response.text()).pipe(Effect.flatMap(decodeHealth));

  expect(health.status).toBe("ok");
});

describe("@beep/api-docs", () => {
  it.effect("serves GET /health", verifyHealth);
});
