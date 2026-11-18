import * as Cloudflare from "@alchemy.run/cloudflare";
import { bindReadWriteBucket } from "@beep/infra-turbo-cache/Bucket";
import { artifactHandler, Credential } from "@beep/infra-turbo-cache/Protocol";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Redacted from "effect/Redacted";
import * as Str from "effect/String";

const forbiddenStorage = () => Effect.die("Unauthorized request reached storage");

/** Fixed test-only tokens: `alpha` writes and reads its team, `beta-reader` only reads team `beta`. */
export const fixtureCredentials: ReadonlyArray<Credential> = [
  Credential.make({
    team: "alpha",
    principal: "alpha-writer",
    access: "write",
    token: Effect.succeed(Redacted.make("test-only-alpha")),
  }),
  Credential.make({
    team: "beta",
    principal: "beta-writer",
    access: "write",
    token: Effect.succeed(Redacted.make("test-only-beta")),
  }),
  Credential.make({
    team: "beta",
    principal: "beta-reader",
    access: "read",
    token: Effect.succeed(Redacted.make("test-only-beta-reader")),
  }),
];

/**
 * A Worker serving the protocol over a local R2 bucket. Paths under
 * `/auth-proof/` reach a handler whose storage dies, proving a refused request
 * never touches the bucket.
 */
export default class ProtocolWorker extends Cloudflare.Worker<ProtocolWorker>()(
  "ProtocolWorker",
  {
    compatibility: { date: "2026-05-28", flags: ["nodejs_compat"] },
    dev: { port: 0 },
    main: import.meta.url,
  },
  Effect.gen(function* () {
    const bucket = yield* Cloudflare.R2.Bucket("ProtocolWorkerBucket");
    const bind = yield* bindReadWriteBucket;
    const storage = yield* bind(bucket);
    const handle = artifactHandler({ bucket: storage, credentials: fixtureCredentials });
    const proveAuth = artifactHandler({
      bucket: { get: forbiddenStorage, head: forbiddenStorage, put: forbiddenStorage },
      credentials: fixtureCredentials,
    });

    return {
      fetch: Effect.gen(function* () {
        const incoming = yield* HttpServerRequest.HttpServerRequest;
        const request = yield* HttpServerRequest.toWeb(incoming);
        const url = new URL(request.url);
        const authProof = Str.startsWith("/auth-proof/")(url.pathname);
        url.pathname = Str.replace("/auth-proof", "")(url.pathname);
        const response = yield* authProof ? proveAuth(new Request(url.href, request)) : handle(request);
        return HttpServerResponse.fromWeb(response);
      }).pipe(Effect.orDie),
    };
  })
) {}
