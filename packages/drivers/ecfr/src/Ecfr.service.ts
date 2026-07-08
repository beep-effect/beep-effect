/**
 * Effect service for the keyless eCFR versioner REST API.
 *
 * The 2nd consumer of the shared transport transformer incubated in
 * `@beep/govinfo`: it builds a raw `HttpClient` on the `HttpClient.mapRequest`
 * path (base-URL prefixing) and threads it through `transport.transformClient`
 * (auth = `NoAuth`, plus rate-limit + retry). Value models + operation
 * descriptors come from the committed `openapi.json` via `src/_generated/*`, so
 * build/check are network-free.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ApiAuth, makeApiTransport } from "@beep/api-transport";
import { $EcfrId } from "@beep/identity";
import { NonNegativeInt, URLStr } from "@beep/schema";
import { O } from "@beep/utils";
import { Config, Context, Effect, Layer } from "effect";
import * as S from "effect/Schema";
import { FetchHttpClient } from "effect/unstable/http";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as RateLimiter from "effect/unstable/persistence/RateLimiter";
import { AgenciesResponse, ECFR_OPERATIONS, TitlesResponse } from "./_generated/Ecfr.generated.ts";
import { ECFR_API_URL, ECFR_RATE_LIMIT, ECFR_RATE_LIMIT_WINDOW, EcfrConfigInput } from "./Ecfr.config.ts";
import { EcfrError, EcfrErrorOptions } from "./Ecfr.errors.ts";
import type { RateLimitSnapshot } from "@beep/api-transport";
import type { EcfrOperationDescriptor } from "./_generated/Ecfr.generated.ts";

const $I = $EcfrId.create("Ecfr.service");

/**
 * Public service shape for the keyless eCFR driver.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import type { EcfrShape } from "@beep/ecfr"
 *
 * const shape: Pick<EcfrShape, "listTitles"> = {
 *   listTitles: Effect.die("example")
 * }
 * console.log(typeof shape.listTitles)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface EcfrShape {
  readonly listAgencies: Effect.Effect<AgenciesResponse, EcfrError>;
  readonly listTitles: Effect.Effect<TitlesResponse, EcfrError>;
  readonly rateLimit: Effect.Effect<O.Option<RateLimitSnapshot>>;
}

class ResolvedConfig extends S.Class<ResolvedConfig>($I`ResolvedConfig`)(
  {
    apiUrl: URLStr,
  },
  $I.annote("ResolvedConfig", {
    description: "Configuration for the eCFR driver.",
  })
) {}

const resolveConfig = (input: EcfrConfigInput): ResolvedConfig => ({
  apiUrl: URLStr.make(input.apiUrl),
});

const decodeStatusOption = S.decodeUnknownOption(NonNegativeInt);

const makeFromResolved = Effect.fnUntraced(function* (config: ResolvedConfig) {
  const transport = yield* makeApiTransport({
    auth: ApiAuth.NoAuth(),
    key: "ecfr",
    rateLimit: { limit: ECFR_RATE_LIMIT, window: ECFR_RATE_LIMIT_WINDOW },
  });

  const httpClient = yield* HttpClient.HttpClient;
  const client = httpClient.pipe(
    transport.transformClient,
    HttpClient.mapRequest(HttpClientRequest.prependUrl(config.apiUrl))
  );

  const runJson = Effect.fnUntraced(function* <A>(
    descriptor: EcfrOperationDescriptor,
    decode: (input: unknown) => Effect.Effect<A, S.SchemaError>
  ): Effect.fn.Return<A, EcfrError> {
    const response = yield* client
      .execute(HttpClientRequest.get(descriptor.path))
      .pipe(Effect.mapError((cause) => EcfrError.of("transport", EcfrErrorOptions.make({ cause: O.some(cause) }))));

    if (response.status < 200 || response.status >= 300) {
      return yield* EcfrError.of(
        "response status",
        EcfrErrorOptions.make({ status: decodeStatusOption(response.status) })
      );
    }

    const body = yield* response.json.pipe(
      Effect.mapError((cause) => EcfrError.of("response decoding", EcfrErrorOptions.make({ cause: O.some(cause) })))
    );
    return yield* decode(body).pipe(
      Effect.mapError((cause) => EcfrError.of("response decoding", EcfrErrorOptions.make({ cause: O.some(cause) }))),
      Effect.withSpan(`Ecfr.${descriptor.operationId}`)
    );
  });

  return Ecfr.of({
    listAgencies: runJson(ECFR_OPERATIONS.listAgencies.descriptor, S.decodeUnknownEffect(AgenciesResponse)),
    listTitles: runJson(ECFR_OPERATIONS.listTitles.descriptor, S.decodeUnknownEffect(TitlesResponse)),
    rateLimit: transport.rateLimit,
  });
});

const makeFromEnvironment = Effect.fnUntraced(function* () {
  const apiUrl = yield* Config.string("ECFR_API_URL").pipe(Config.withDefault(ECFR_API_URL));
  return yield* makeFromResolved({ apiUrl: URLStr.make(apiUrl) });
});

/**
 * Effect service for the keyless eCFR versioner API.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Ecfr } from "@beep/ecfr"
 *
 * const program = Effect.gen(function* () {
 *   const ecfr = yield* Ecfr
 *   return yield* ecfr.listTitles
 * })
 *
 * void program
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Ecfr extends Context.Service<Ecfr, EcfrShape>()($I`Ecfr`) {
  /**
   * Build an eCFR layer from explicit runtime configuration.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (
    config = EcfrConfigInput.make({})
  ): Layer.Layer<Ecfr, never, HttpClient.HttpClient | RateLimiter.RateLimiterStore> =>
    Layer.effect(Ecfr, makeFromResolved(resolveConfig(config)));

  /**
   * Live eCFR layer backed by the platform `fetch` client and an in-memory
   * rate-limiter store. Keyless: no credentials are read or attached.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<Ecfr, EcfrError> = Layer.effect(
    Ecfr,
    makeFromEnvironment().pipe(Effect.mapError(EcfrError.config))
  ).pipe(Layer.provide(FetchHttpClient.layer), Layer.provide(RateLimiter.layerStoreMemory));
}
