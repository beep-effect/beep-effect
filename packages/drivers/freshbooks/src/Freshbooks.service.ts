/**
 * Effect service for the FreshBooks read API — identity resolution and
 * schema-decoded clients / invoices / payments verbs over `FetchHttpClient`.
 *
 * Token acquisition and single-use refresh-token rotation are owned by
 * {@link FreshbooksAuth}; this service consumes a valid bearer from it for
 * every call. Only read verbs are exposed — no write, delivery, or webhook
 * surface. Invoice-PDF retrieval is gated on the P0 endpoint-validation spike
 * (`goals/freshbooks-driver/history/`) and is intentionally absent until that
 * spike's live half validates the endpoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FreshbooksId } from "@beep/identity";
import { O } from "@beep/utils";
import { Config, Context, Effect, Layer, pipe } from "effect";
import * as S from "effect/Schema";
import { FetchHttpClient } from "effect/unstable/http";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import { FreshbooksBaseUrl, FreshbooksConfigInput } from "./Freshbooks.config.ts";
import { FreshbooksError } from "./Freshbooks.errors.ts";
import { FreshbooksDecode, FreshbooksPagination } from "./Freshbooks.models.ts";
import { FreshbooksAuth, FreshbooksTokenStore, makeFreshbooksAuth } from "./Freshbooks.token.ts";
import type { Redacted } from "effect";
import type { FreshbooksAccountId } from "./Freshbooks.config.ts";
import type {
  FreshbooksClient,
  FreshbooksClientId,
  FreshbooksIdentity,
  FreshbooksInvoice,
  FreshbooksInvoiceId,
  FreshbooksPage,
  FreshbooksPayment,
  FreshbooksPaymentId,
} from "./Freshbooks.models.ts";
import type { FreshbooksAuthShape } from "./Freshbooks.token.ts";

const $I = $FreshbooksId.create("Freshbooks.service");

/**
 * FreshBooks per-page cap. FreshBooks silently limits list results to 100 rows
 * regardless of the requested `per_page` (P0 spike, Request Limits page).
 *
 * **Example** (Log the per-page cap)
 *
 * ```ts
 * import { FRESHBOOKS_MAX_PER_PAGE } from "@beep/freshbooks"
 *
 * console.log(FRESHBOOKS_MAX_PER_PAGE) // 100
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FRESHBOOKS_MAX_PER_PAGE = 100;

/**
 * Resolved runtime configuration for the FreshBooks services.
 *
 * **Example** (Make resolved config)
 *
 * ```ts
 * import { ResolvedFreshbooksConfig } from "@beep/freshbooks"
 * import { Redacted } from "effect"
 *
 * const config = ResolvedFreshbooksConfig.make({
 *   clientId: "dev-client-id",
 *   clientSecret: Redacted.make("dev-client-secret"),
 *   redirectUri: "https://localhost:8443/callback",
 *   apiUrl: "https://api.freshbooks.com",
 *   authUrl: "https://auth.freshbooks.com",
 *   headers: {}
 * })
 *
 * console.log(config.apiUrl) // "https://api.freshbooks.com"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResolvedFreshbooksConfig extends S.Class<ResolvedFreshbooksConfig>($I`ResolvedFreshbooksConfig`)(
  {
    clientId: S.NonEmptyString,
    clientSecret: S.Redacted(S.String),
    redirectUri: S.String,
    apiUrl: FreshbooksBaseUrl,
    authUrl: FreshbooksBaseUrl,
    headers: S.Record(S.String, S.String),
  },
  $I.annote("ResolvedFreshbooksConfig", {
    description: "Resolved runtime configuration for the FreshBooks services.",
  })
) {}

/**
 * Resolve a {@link FreshbooksConfigInput} into a {@link ResolvedFreshbooksConfig}.
 *
 * **Example** (Resolve config input)
 *
 * ```ts
 * import { FreshbooksConfigInput, resolveConfig } from "@beep/freshbooks"
 * import { Redacted } from "effect"
 *
 * const resolved = resolveConfig(
 *   FreshbooksConfigInput.make({
 *     clientId: "dev-client-id",
 *     clientSecret: Redacted.make("dev-client-secret"),
 *     redirectUri: "https://localhost:8443/callback"
 *   })
 * )
 *
 * console.log(resolved)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const resolveConfig = Effect.fn("Freshbooks.resolveConfig")(
  function* (input: FreshbooksConfigInput) {
    const apiUrl = yield* S.decodeEffect(FreshbooksBaseUrl)(input.apiUrl);
    const authUrl = yield* S.decodeEffect(FreshbooksBaseUrl)(input.authUrl);

    return ResolvedFreshbooksConfig.make({
      clientId: input.clientId,
      clientSecret: input.clientSecret,
      redirectUri: input.redirectUri,
      apiUrl,
      authUrl,
      headers: input.headers,
    });
  },
  Effect.mapError((cause) => FreshbooksError.fromReason("config", { cause }))
);

// Options accepted by the FreshBooks list verbs. Kept internal: consumers pass
// an object literal (e.g. `{ page: 2 }`) without naming the type.
type ListOptions = {
  readonly page?: number;
};

/**
 * Public FreshBooks read-service shape.
 *
 * **Example** (Name the service key)
 *
 * ```ts
 * import { Freshbooks } from "@beep/freshbooks"
 *
 * console.log(Freshbooks.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type FreshbooksShape = {
  readonly accessToken: Effect.Effect<Redacted.Redacted<string>, FreshbooksError>;
  readonly getIdentity: Effect.Effect<FreshbooksIdentity, FreshbooksError>;
  readonly listClients: (
    accountId: FreshbooksAccountId,
    options?: ListOptions
  ) => Effect.Effect<FreshbooksPage<FreshbooksClient>, FreshbooksError>;
  readonly getClient: (
    accountId: FreshbooksAccountId,
    clientId: FreshbooksClientId
  ) => Effect.Effect<FreshbooksClient, FreshbooksError>;
  readonly listInvoices: (
    accountId: FreshbooksAccountId,
    options?: ListOptions
  ) => Effect.Effect<FreshbooksPage<FreshbooksInvoice>, FreshbooksError>;
  readonly getInvoice: (
    accountId: FreshbooksAccountId,
    invoiceId: FreshbooksInvoiceId
  ) => Effect.Effect<FreshbooksInvoice, FreshbooksError>;
  readonly listPayments: (
    accountId: FreshbooksAccountId,
    options?: ListOptions
  ) => Effect.Effect<FreshbooksPage<FreshbooksPayment>, FreshbooksError>;
  readonly getPayment: (
    accountId: FreshbooksAccountId,
    paymentId: FreshbooksPaymentId
  ) => Effect.Effect<FreshbooksPayment, FreshbooksError>;
};

const listQuery = (options: ListOptions | undefined): string => {
  const page = options?.page ?? 1;
  return `?page=${page}&per_page=${FRESHBOOKS_MAX_PER_PAGE}`;
};

const accountBase = (config: ResolvedFreshbooksConfig, accountId: FreshbooksAccountId): string =>
  `${config.apiUrl}/accounting/account/${accountId}`;

const authorizedGet = Effect.fn("authorizedGet")(function* (
  auth: FreshbooksAuthShape,
  client: HttpClient.HttpClient,
  config: ResolvedFreshbooksConfig,
  resource: string,
  url: string
) {
  const token = yield* auth.accessToken;
  const request = pipe(
    HttpClientRequest.get(url),
    HttpClientRequest.accept("application/json"),
    HttpClientRequest.setHeaders(config.headers),
    (base) => HttpClientRequest.bearerToken(base, token)
  );
  const response = yield* client
    .execute(request)
    .pipe(Effect.mapError((cause) => FreshbooksError.fromReason("transport", { cause, resource, url })));
  // Non-2xx (including a short-burst 429 with Retry-After) surfaces as a typed
  // error carrying the status; retry/backoff and reconciliation belong to the
  // consuming reconciler rather than every read verb, so the caller can
  // observe and schedule the retry with the server-provided delay.
  if (response.status < 200 || response.status >= 300) {
    return yield* FreshbooksError.fromReason("response status", { resource, status: response.status, url });
  }
  return yield* response.json.pipe(
    Effect.mapError((cause) => FreshbooksError.fromReason("response decoding", { cause, resource, url }))
  );
});

const decodeAt = <A>(
  resource: string,
  url: string,
  decode: (body: unknown) => Effect.Effect<A, S.SchemaError>,
  body: unknown
): Effect.Effect<A, FreshbooksError> =>
  decode(body).pipe(
    Effect.mapError((cause) => FreshbooksError.fromReason("response decoding", { cause, resource, url }))
  );

const makeService = (
  client: HttpClient.HttpClient,
  config: ResolvedFreshbooksConfig,
  auth: FreshbooksAuthShape
): FreshbooksShape => {
  const runGet = (resource: string, url: string): Effect.Effect<unknown, FreshbooksError> =>
    authorizedGet(auth, client, config, resource, url);

  return {
    accessToken: auth.accessToken,
    getIdentity: Effect.gen(function* () {
      const url = `${config.apiUrl}/auth/api/v1/users/me`;
      const body = yield* runGet("identity", url);
      const decoded = yield* decodeAt("identity", url, FreshbooksDecode.identity, body);
      return decoded.response;
    }),
    listClients: Effect.fn("Freshbooks.listClients")(function* (accountId, options) {
      const url = `${accountBase(config, accountId)}/users/clients${listQuery(options)}`;
      const body = yield* runGet("clients", url);
      const decoded = yield* decodeAt("clients", url, FreshbooksDecode.clients, body);
      const { clients, ...pagination } = decoded.response.result;
      return { items: clients, pagination: FreshbooksPagination.make(pagination) };
    }),
    getClient: Effect.fn("Freshbooks.getClient")(function* (accountId, clientId) {
      const url = `${accountBase(config, accountId)}/users/clients/${clientId}`;
      const body = yield* runGet("clients", url);
      const decoded = yield* decodeAt("clients", url, FreshbooksDecode.client, body);
      return decoded.response.result.client;
    }),
    listInvoices: Effect.fn("Freshbooks.listInvoices")(function* (accountId, options) {
      const url = `${accountBase(config, accountId)}/invoices/invoices${listQuery(options)}`;
      const body = yield* runGet("invoices", url);
      const decoded = yield* decodeAt("invoices", url, FreshbooksDecode.invoices, body);
      const { invoices, ...pagination } = decoded.response.result;
      return { items: invoices, pagination: FreshbooksPagination.make(pagination) };
    }),
    getInvoice: Effect.fn("Freshbooks.getInvoice")(function* (accountId, invoiceId) {
      const url = `${accountBase(config, accountId)}/invoices/invoices/${invoiceId}`;
      const body = yield* runGet("invoices", url);
      const decoded = yield* decodeAt("invoices", url, FreshbooksDecode.invoice, body);
      return decoded.response.result.invoice;
    }),
    listPayments: Effect.fn("Freshbooks.listPayments")(function* (accountId, options) {
      const url = `${accountBase(config, accountId)}/payments/payments${listQuery(options)}`;
      const body = yield* runGet("payments", url);
      const decoded = yield* decodeAt("payments", url, FreshbooksDecode.payments, body);
      const { payments, ...pagination } = decoded.response.result;
      return { items: payments, pagination: FreshbooksPagination.make(pagination) };
    }),
    getPayment: Effect.fn("Freshbooks.getPayment")(function* (accountId, paymentId) {
      const url = `${accountBase(config, accountId)}/payments/payments/${paymentId}`;
      const body = yield* runGet("payments", url);
      const decoded = yield* decodeAt("payments", url, FreshbooksDecode.payment, body);
      return decoded.response.result.payment;
    }),
  };
};

/**
 * Effect service for the FreshBooks read API.
 *
 * **Example** (Build FreshBooks layer)
 *
 * ```ts
 * import { Freshbooks, FreshbooksConfigInput } from "@beep/freshbooks"
 * import { Redacted } from "effect"
 *
 * const layer = Freshbooks.makeLayer(
 *   FreshbooksConfigInput.make({
 *     clientId: "dev-client-id",
 *     clientSecret: Redacted.make("dev-client-secret"),
 *     redirectUri: "https://localhost:8443/callback"
 *   })
 * )
 *
 * console.log(layer)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Freshbooks extends Context.Service<Freshbooks, FreshbooksShape>()($I`Freshbooks`) {
  /**
   * Build a FreshBooks layer from explicit runtime configuration. Requires an
   * ambient {@link FreshbooksTokenStore} for token persistence.
   *
   * **Example** (Build layer from config)
   *
   * ```ts
   * import { Freshbooks, FreshbooksConfigInput } from "@beep/freshbooks"
   * import { Redacted } from "effect"
   *
   * const layer = Freshbooks.makeLayer(
   *   FreshbooksConfigInput.make({
   *     clientId: "dev-client-id",
   *     clientSecret: Redacted.make("dev-client-secret"),
   *     redirectUri: "https://localhost:8443/callback"
   *   })
   * )
   *
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (
    config: FreshbooksConfigInput
  ): Layer.Layer<Freshbooks, FreshbooksError, HttpClient.HttpClient | FreshbooksTokenStore> =>
    Layer.effect(
      Freshbooks,
      Effect.gen(function* () {
        const client = yield* HttpClient.HttpClient;
        const store = yield* FreshbooksTokenStore;
        const resolved = yield* resolveConfig(config);
        const auth = yield* makeFreshbooksAuth(client, resolved, store);
        return Freshbooks.of(makeService(client, resolved, auth));
      })
    );

  /**
   * Live FreshBooks layer backed by ambient Effect Config values. Requires an
   * ambient {@link FreshbooksTokenStore}; the HTTP client is provided.
   *
   * **Example** (Log live FreshBooks layer)
   *
   * ```ts
   * import { Freshbooks } from "@beep/freshbooks"
   *
   * console.log(Freshbooks.layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<Freshbooks, FreshbooksError, FreshbooksTokenStore> = Layer.effect(
    Freshbooks,
    Effect.gen(function* () {
      const clientId = yield* Config.string("FRESHBOOKS_CLIENT_ID");
      const clientSecret = yield* Config.redacted("FRESHBOOKS_CLIENT_SECRET");
      const redirectUri = yield* Config.string("FRESHBOOKS_REDIRECT_URI");
      const apiUrl = yield* Config.string("FRESHBOOKS_API_URL").pipe(Config.option);
      const authUrl = yield* Config.string("FRESHBOOKS_AUTH_URL").pipe(Config.option);
      const client = yield* HttpClient.HttpClient;
      const store = yield* FreshbooksTokenStore;
      const resolved = yield* resolveConfig(
        FreshbooksConfigInput.make({
          clientId,
          clientSecret,
          redirectUri,
          ...O.getSomesStruct({ apiUrl, authUrl }),
        })
      );
      const auth = yield* makeFreshbooksAuth(client, resolved, store);
      return Freshbooks.of(makeService(client, resolved, auth));
    }).pipe(Effect.mapError((cause) => FreshbooksError.fromReason("config", { cause }))) as Effect.Effect<
      FreshbooksShape,
      FreshbooksError,
      HttpClient.HttpClient | FreshbooksTokenStore
    >
  ).pipe(Layer.provide(FetchHttpClient.layer));
}

/**
 * Build a standalone {@link FreshbooksAuth} layer from explicit configuration.
 * Requires an ambient {@link FreshbooksTokenStore} and HTTP client.
 *
 * **Example** (Build auth layer)
 *
 * ```ts
 * import { FreshbooksConfigInput } from "@beep/freshbooks"
 * import { makeFreshbooksAuthLayer } from "@beep/freshbooks"
 * import { Redacted } from "effect"
 *
 * const layer = makeFreshbooksAuthLayer(
 *   FreshbooksConfigInput.make({
 *     clientId: "dev-client-id",
 *     clientSecret: Redacted.make("dev-client-secret"),
 *     redirectUri: "https://localhost:8443/callback"
 *   })
 * )
 *
 * console.log(layer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeFreshbooksAuthLayer = (
  config: FreshbooksConfigInput
): Layer.Layer<FreshbooksAuth, FreshbooksError, HttpClient.HttpClient | FreshbooksTokenStore> =>
  Layer.effect(
    FreshbooksAuth,
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const store = yield* FreshbooksTokenStore;
      const resolved = yield* resolveConfig(config);
      return FreshbooksAuth.of(yield* makeFreshbooksAuth(client, resolved, store));
    })
  );
