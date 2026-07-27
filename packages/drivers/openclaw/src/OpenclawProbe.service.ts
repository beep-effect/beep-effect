/**
 * HTTP liveness and readiness probes for the OpenClaw gateway.
 *
 * Probes never fail: any 2xx response maps to `healthy` while non-2xx
 * responses, transport failures, and timeouts collapse to `unreachable`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, Number as N, pipe } from "effect";
import * as O from "effect/Option";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { OPENCLAW_HTTP_PROBE_TIMEOUT } from "./Openclaw.config.ts";
import { OpenclawHttpProbe } from "./Openclaw.models.ts";
import type { Duration } from "effect";
import type { HttpClientResponse } from "effect/unstable/http";

const defaultProbeHost = "127.0.0.1";

const probeEndpoint = Effect.fnUntraced(function* (input: {
  readonly host: string;
  readonly path: string;
  readonly port: number;
  readonly timeout: Duration.Input;
}): Effect.fn.Return<OpenclawHttpProbe, never, HttpClient.HttpClient> {
  const client = yield* HttpClient.HttpClient;
  const endpoint = `http://${input.host}:${input.port}${input.path}`;
  const response = yield* client
    .execute(HttpClientRequest.get(endpoint))
    .pipe(Effect.timeoutOption(input.timeout), Effect.orElseSucceed(O.none<HttpClientResponse.HttpClientResponse>));
  const healthy = pipe(
    response,
    O.map((httpResponse) => N.between(httpResponse.status, { minimum: 200, maximum: 299 })),
    O.getOrElse(() => false)
  );

  return OpenclawHttpProbe.make({
    endpoint,
    httpStatus: O.map(response, (httpResponse) => httpResponse.status),
    status: healthy ? "healthy" : "unreachable",
  });
});

/**
 * Probe the OpenClaw gateway liveness endpoint over loopback HTTP.
 *
 * @example
 * ```ts
 * import { probeOpenclawLiveness } from "@beep/openclaw/OpenclawProbe.service"
 *
 * const program = probeOpenclawLiveness({ port: 19031 })
 * console.log(program)
 * ```
 *
 * @effects Performs one HTTP GET request and converts transport failure or timeout to `unreachable`.
 * @category clients
 * @since 0.0.0
 */
export const probeOpenclawLiveness = Effect.fn("Openclaw.probeLiveness")(function* (input: {
  readonly host?: string | undefined;
  readonly path?: string | undefined;
  readonly port: number;
  readonly timeout?: Duration.Input | undefined;
}): Effect.fn.Return<OpenclawHttpProbe, never, HttpClient.HttpClient> {
  return yield* probeEndpoint({
    host: input.host ?? defaultProbeHost,
    path: input.path ?? "/health",
    port: input.port,
    timeout: input.timeout ?? OPENCLAW_HTTP_PROBE_TIMEOUT,
  });
});

/**
 * Probe the OpenClaw gateway readiness endpoint over loopback HTTP.
 *
 * The default `/ready` path is the fallback readiness literal; upstream also
 * serves `/readyz` and `/healthz`, which callers can select via `path`.
 *
 * @example
 * ```ts
 * import { probeOpenclawReadiness } from "@beep/openclaw/OpenclawProbe.service"
 *
 * const program = probeOpenclawReadiness({ path: "/readyz", port: 19031 })
 * console.log(program)
 * ```
 *
 * @effects Performs one HTTP GET request and converts transport failure or timeout to `unreachable`.
 * @category clients
 * @since 0.0.0
 */
export const probeOpenclawReadiness = Effect.fn("Openclaw.probeReadiness")(function* (input: {
  readonly host?: string | undefined;
  readonly path?: string | undefined;
  readonly port: number;
  readonly timeout?: Duration.Input | undefined;
}): Effect.fn.Return<OpenclawHttpProbe, never, HttpClient.HttpClient> {
  return yield* probeEndpoint({
    host: input.host ?? defaultProbeHost,
    path: input.path ?? "/ready",
    port: input.port,
    timeout: input.timeout ?? OPENCLAW_HTTP_PROBE_TIMEOUT,
  });
});
