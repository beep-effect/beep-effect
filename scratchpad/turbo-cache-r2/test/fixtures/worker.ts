import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Redacted from "effect/Redacted";
import * as Str from "effect/String";

import { bindReadWriteBucket } from "../../bucket.js";
import { artifactHandler } from "../../protocol.js";

const forbiddenStorage = () => Effect.die("Unauthorized request reached storage");

export default class CacheFixture extends Cloudflare.Worker<CacheFixture>()(
  "CacheFixture",
  {
    compatibility: { date: "2026-05-28", flags: ["nodejs_compat"] },
    dev: { port: 0 },
    main: import.meta.url,
  },
  Effect.gen(function* fixture() {
    const bucket = yield* Cloudflare.R2.Bucket("CacheFixtureBucket");
    const bind = yield* bindReadWriteBucket;
    const storage = yield* bind(bucket);

    const credentials = [
      { team: "alpha", token: Effect.succeed(Redacted.make("test-only-alpha")) },
      { team: "beta", token: Effect.succeed(Redacted.make("test-only-beta")) },
    ];

    const handle = artifactHandler({ bucket: storage, credentials });

    const proveAuth = artifactHandler({
      bucket: { get: forbiddenStorage, head: forbiddenStorage, put: forbiddenStorage },
      credentials,
    });

    return {
      fetch: Effect.gen(function* fixtureFetch() {
        const incoming = yield* HttpServerRequest.HttpServerRequest;
        const request = yield* HttpServerRequest.toWeb(incoming);
        const url = new URL(request.url);
        const authProof = Str.startsWith("/auth-proof/")(url.pathname);
        url.pathname = Str.replace("/auth-proof", "")(url.pathname);

        const response = yield* authProof ? proveAuth(new Request(url.href, request)) : handle(request);

        return HttpServerResponse.fromWeb(response);
      }).pipe(Effect.orDie),
    };
  }),
) {}
