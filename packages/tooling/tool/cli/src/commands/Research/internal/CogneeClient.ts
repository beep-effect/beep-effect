/**
 * Minimal Cognee REST client for research cognify.
 *
 * Talks to the running Cognee API with the default-user login flow; card
 * markdown is added per dataset and cognified in one call. Cognee
 * deduplicates added documents by content hash, so re-pushing an unchanged
 * card is a no-op while a changed card lands as fresh content.
 *
 * Connection settings come from the environment variables named by
 * {@link COGNEE_ENV}; the research timers load them from the EnvironmentFile
 * named by `RESEARCH_ENV_FILE_HINT`.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Email } from "@beep/schema";
import { Config, Effect, Redacted } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import { ResearchCommandError } from "../Research.errors.ts";
import { RESEARCH_ENV_FILE_HINT } from "./ResearchEnv.ts";
import type * as HttpClientError from "effect/unstable/http/HttpClientError";

const $I = $RepoCliId.create("commands/Research/internal/CogneeClient");

/**
 * Environment variable names that configure the Cognee connection.
 *
 * `apiUrl` is required; `email` and `password` fall back to Cognee's default
 * user when unset.
 *
 * **Example** (Read the API URL variable name)
 *
 * ```ts
 * import { COGNEE_ENV } from "@beep/repo-cli/commands/Research/internal/CogneeClient"
 *
 * console.log(COGNEE_ENV.apiUrl) // "COGNEE_API_URL"
 * ```
 *
 * @internal
 * @category utilities
 */
export const COGNEE_ENV = {
  apiUrl: "COGNEE_API_URL",
  email: "COGNEE_API_EMAIL",
  password: "COGNEE_API_PASSWORD",
} as const;

const DEFAULT_COGNEE_EMAIL = S.decodeSync(Email)("default_user@example.com");
const DEFAULT_COGNEE_PASSWORD = "default_password";

/**
 * Message used when no Cognee connection is configured: `research daily`
 * skips cognify with it and `research cognify` fails with it.
 *
 * **Example** (Skip reason names the variable and the file)
 *
 * ```ts
 * import { COGNEE_CREDENTIALS_MISSING } from "@beep/repo-cli/commands/Research/internal/CogneeClient"
 *
 * console.log(COGNEE_CREDENTIALS_MISSING.includes("COGNEE_API_URL")) // true
 * console.log(COGNEE_CREDENTIALS_MISSING.includes(".config/beep-research/env")) // true
 * ```
 *
 * @internal
 * @category utilities
 */
export const COGNEE_CREDENTIALS_MISSING = `no Cognee credentials configured; set ${COGNEE_ENV.apiUrl} in ${RESEARCH_ENV_FILE_HINT}`;

/**
 * Message used when Cognee settings are present but fail validation, for
 * example a malformed `COGNEE_API_EMAIL`.
 *
 * **Example** (Validation failure names every variable)
 *
 * ```ts
 * import { COGNEE_SETTINGS_INVALID } from "@beep/repo-cli/commands/Research/internal/CogneeClient"
 *
 * console.log(COGNEE_SETTINGS_INVALID.includes("COGNEE_API_EMAIL")) // true
 * ```
 *
 * @internal
 * @category utilities
 */
export const COGNEE_SETTINGS_INVALID = `Cognee settings failed validation; check ${COGNEE_ENV.apiUrl}, ${COGNEE_ENV.email}, and ${COGNEE_ENV.password} in ${RESEARCH_ENV_FILE_HINT}.`;

/**
 * Message used when `COGNEE_API_URL` would carry the login credentials in
 * cleartext: only `https://`, or `http://` on a loopback host, is accepted.
 *
 * **Example** (Insecure URL message names the variable)
 *
 * ```ts
 * import { COGNEE_API_URL_INSECURE } from "@beep/repo-cli/commands/Research/internal/CogneeClient"
 *
 * console.log(COGNEE_API_URL_INSECURE.includes("COGNEE_API_URL")) // true
 * console.log(COGNEE_API_URL_INSECURE.includes("https://")) // true
 * ```
 *
 * @internal
 * @category utilities
 */
export const COGNEE_API_URL_INSECURE = `${COGNEE_ENV.apiUrl} must use https:// (http:// is accepted only on a loopback host such as 127.0.0.1 or localhost) so the Cognee login credentials are never sent in cleartext.`;

const LOOPBACK_HOSTS: ReadonlyArray<string> = ["localhost", "127.0.0.1", "[::1]"];
const decodeUnknownURLOption = S.decodeUnknownOption(S.URLFromString);
const isLoopbackHost = (hostname: string): boolean =>
  A.contains(LOOPBACK_HOSTS, hostname) || Str.endsWith(".localhost")(hostname) || Str.startsWith("127.")(hostname);
const isCogneeApiUrl = (input: unknown): input is string =>
  O.exists(
    decodeUnknownURLOption(input),
    (url) => url.protocol === "https:" || (url.protocol === "http:" && isLoopbackHost(url.hostname))
  );
const filterCogneeApiUrl = S.makeFilter(isCogneeApiUrl, {
  message: "Cognee API URL must use https, or http on a loopback host",
  arbitraryConstraint: { patterns: [{ source: "^https://[a-z]{1,12}\\.example(?::[0-9]{2,4})?$", flags: "" }] },
});

/**
 * Cognee API URL that never carries the login credentials in cleartext:
 * `https://` anywhere, or `http://` only on a loopback host.
 *
 * **Example** (Loopback http is accepted, remote http is not)
 *
 * ```ts
 * import { CogneeApiUrl } from "@beep/repo-cli/commands/Research/internal/CogneeClient"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CogneeApiUrl)("http://127.0.0.1:8010")) // true
 * console.log(S.is(CogneeApiUrl)("https://cognee.example.com")) // true
 * console.log(S.is(CogneeApiUrl)("http://cognee.example.com")) // false
 * ```
 *
 * @internal
 * @category validation
 */
export const CogneeApiUrl = S.String.check(filterCogneeApiUrl);
const decodeCogneeApiUrl = S.decodeUnknownEffect(CogneeApiUrl);

/**
 * One markdown card queued for a Cognee dataset.
 *
 * @internal
 * @category models
 */
export class CogneeCardUpload extends S.Class<CogneeCardUpload>($I`CogneeCardUpload`)(
  {
    content: S.String,
    fileName: S.String,
  },
  $I.annote("CogneeCardUpload", {
    title: "Cognee Card Upload",
    description: "One markdown card queued for upload to a Cognee dataset.",
  })
) {}

/**
 * Cognee connection settings resolved from the environment.
 *
 * **Example** (Build settings with a redacted password)
 *
 * ```ts
 * import { CogneeSettings } from "@beep/repo-cli/commands/Research/internal/CogneeClient"
 * import { Email } from "@beep/schema"
 * import { Redacted } from "effect"
 * import * as S from "effect/Schema"
 *
 * const settings = CogneeSettings.make({
 *   apiUrl: "http://127.0.0.1:8010",
 *   email: S.decodeSync(Email)("default_user@example.com"),
 *   password: Redacted.make("default_password")
 * })
 * console.log(settings.apiUrl) // "http://127.0.0.1:8010"
 * console.log(Redacted.isRedacted(settings.password)) // true
 * ```
 *
 * @internal
 * @category models
 */
export class CogneeSettings extends S.Class<CogneeSettings>($I`CogneeSettings`)(
  {
    apiUrl: CogneeApiUrl,
    email: Email,
    password: S.Redacted(S.String),
  },
  $I.annote("CogneeSettings", {
    title: "Cognee Settings",
    description: "Cognee API URL plus the login email and redacted password research cognify authenticates with.",
  })
) {}

/**
 * Resolved Cognee connection settings.
 *
 * @internal
 * @category models
 */
export class CogneeConnection extends S.Class<CogneeConnection>($I`CogneeConnection`)(
  {
    apiUrl: S.String,
    token: S.String,
  },
  $I.annote("CogneeConnection", {
    title: "Cognee Connection",
    description: "Resolved Cognee API URL and bearer token used by research cognify.",
  })
) {}

class LoginResponse extends S.Class<LoginResponse>($I`LoginResponse`)(
  { access_token: S.String },
  $I.annote("LoginResponse", {
    title: "Login Response",
    description: "Cognee login response containing the bearer access token.",
  })
) {}
const decodeLoginResponse = S.decodeUnknownEffect(LoginResponse);

class CogneeRawSettings extends S.Class<CogneeRawSettings>($I`CogneeRawSettings`)(
  {
    apiUrl: S.String,
    email: Email,
    password: S.Redacted(S.String),
  },
  $I.annote("CogneeRawSettings", {
    description: "Cognee environment values as read, before the API URL transport check.",
  })
) {}

const readRawCogneeSettings: Effect.Effect<O.Option<CogneeRawSettings>, ResearchCommandError> = Effect.gen(
  function* () {
    const apiUrl = (yield* Config.String(COGNEE_ENV.apiUrl).pipe(Config.option)).pipe(
      O.map(Str.trim),
      O.filter(Str.isNonEmpty)
    );
    if (O.isNone(apiUrl)) {
      return O.none();
    }
    const email = yield* Config.schema(Email, COGNEE_ENV.email).pipe(Config.withDefault(DEFAULT_COGNEE_EMAIL));
    const password = yield* Config.Redacted(COGNEE_ENV.password).pipe(
      Config.withDefault(Redacted.make(DEFAULT_COGNEE_PASSWORD))
    );
    return O.some(CogneeRawSettings.make({ apiUrl: apiUrl.value, email, password }));
  }
).pipe(ResearchCommandError.mapError(COGNEE_SETTINGS_INVALID));

const secureCogneeSettings = (raw: CogneeRawSettings): Effect.Effect<CogneeSettings, ResearchCommandError> =>
  decodeCogneeApiUrl(raw.apiUrl).pipe(
    ResearchCommandError.mapError(COGNEE_API_URL_INSECURE),
    Effect.map((apiUrl) => CogneeSettings.make({ apiUrl, email: raw.email, password: raw.password }))
  );

/**
 * Read the Cognee connection settings from the environment.
 *
 * `None` when `COGNEE_API_URL` is unset or blank; the caller decides whether
 * that skips cognify (the daily pipeline) or fails it (an explicit cognify).
 * A URL that would send the credentials in cleartext fails with
 * {@link COGNEE_API_URL_INSECURE}.
 *
 * **Example** (No URL configured resolves to None)
 *
 * ```ts
 * import { readCogneeSettings } from "@beep/repo-cli/commands/Research/internal/CogneeClient"
 * import { ConfigProvider, Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = readCogneeSettings.pipe(
 *   Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({})))
 * )
 * console.log(O.isNone(Effect.runSync(program))) // true
 * ```
 *
 * @internal
 * @category utilities
 */
export const readCogneeSettings: Effect.Effect<
  O.Option<CogneeSettings>,
  ResearchCommandError
> = readRawCogneeSettings.pipe(
  Effect.flatMap(
    O.match({
      onNone: () => Effect.succeed(O.none<CogneeSettings>()),
      onSome: (raw) => Effect.asSome(secureCogneeSettings(raw)),
    })
  ),
  Effect.withSpan("CogneeClient.readCogneeSettings")
);

const describeCause = (cause: unknown, depth: number): string => {
  if (!(cause instanceof Error)) {
    return String(cause);
  }
  const nested = cause.cause;
  return depth < 2 && nested !== undefined && nested !== null
    ? `${cause.message}: ${describeCause(nested, depth + 1)}`
    : cause.message;
};

/**
 * Render an HTTP client failure with its transport cause, so a refused
 * connection reads as such in the journal instead of a bare "request failed".
 *
 * @param error - HTTP client failure raised by `HttpClient.execute`.
 * @returns The error message followed by the transport cause chain when present.
 */
const describeHttpFailure = (error: HttpClientError.HttpClientError): string => {
  const cause = P.hasProperty(error.reason, "cause") ? error.reason.cause : undefined;
  return cause === undefined ? error.message : `${error.message}: ${describeCause(cause, 0)}`;
};

const requestFailed =
  (label: string, apiUrl: string) =>
  (error: HttpClientError.HttpClientError): ResearchCommandError =>
    ResearchCommandError.new(error, `Cognee ${label} request to ${apiUrl} failed: ${describeHttpFailure(error)}`);

const failStatus = Effect.fn("CogneeClient.failStatus")(function* (
  label: string,
  status: number,
  text: string
): Effect.fn.Return<never, ResearchCommandError> {
  return yield* ResearchCommandError.make({
    message: `Cognee ${label} returned ${status}: ${Str.slice(0, 300)(text)}`,
  });
});

/**
 * Log in to the Cognee API and return a bearer token.
 *
 * **Example** (Describe a login program)
 *
 * ```ts
 * import { CogneeSettings, cogneeLogin } from "@beep/repo-cli/commands/Research/internal/CogneeClient"
 * import { Email } from "@beep/schema"
 * import { Effect, Redacted } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = cogneeLogin(
 *   CogneeSettings.make({
 *     apiUrl: "http://127.0.0.1:8010",
 *     email: S.decodeSync(Email)("default_user@example.com"),
 *     password: Redacted.make("default_password")
 *   })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @internal
 * @category utilities
 */
export const cogneeLogin = Effect.fn("CogneeClient.cogneeLogin")(function* (
  settings: CogneeSettings
): Effect.fn.Return<CogneeConnection, ResearchCommandError, HttpClient.HttpClient> {
  const client = yield* HttpClient.HttpClient;
  const request = HttpClientRequest.post(`${settings.apiUrl}/api/v1/auth/login`).pipe(
    HttpClientRequest.bodyUrlParams({
      password: Redacted.value(settings.password),
      username: Redacted.value(settings.email),
    })
  );
  // The credentials go to the configured origin only: a redirect is surfaced
  // instead of followed, so a downgrade to another host or to http never
  // resends them.
  const response = yield* client
    .execute(request)
    .pipe(
      Effect.provideService(FetchHttpClient.RequestInit, { redirect: "manual" }),
      Effect.mapError(requestFailed("login", settings.apiUrl))
    );
  if (response.status === 0 || (response.status >= 300 && response.status < 400)) {
    return yield* ResearchCommandError.make({
      message: `Cognee login at ${settings.apiUrl} answered with a redirect (${response.status}); refusing to resend credentials to another location.`,
    });
  }
  if (response.status >= 400) {
    const text = yield* response.text.pipe(Effect.orElseSucceed(() => ""));
    return yield* failStatus("login", response.status, text);
  }
  const raw = yield* response.json.pipe(ResearchCommandError.mapError("Cognee login response was not valid JSON."));
  const decoded = yield* decodeLoginResponse(raw).pipe(
    ResearchCommandError.mapError("Cognee login response failed schema validation.")
  );
  return CogneeConnection.make({ apiUrl: settings.apiUrl, token: decoded.access_token });
});

/**
 * Add markdown cards to a Cognee dataset via multipart upload.
 *
 * @internal
 * @category utilities
 */
export const cogneeAdd = Effect.fn("CogneeClient.cogneeAdd")(function* (
  connection: CogneeConnection,
  datasetName: string,
  uploads: ReadonlyArray<CogneeCardUpload>
): Effect.fn.Return<void, ResearchCommandError, HttpClient.HttpClient> {
  const client = yield* HttpClient.HttpClient;
  const formData = new FormData();
  formData.append("datasetName", datasetName);
  for (const upload of uploads) {
    formData.append("data", new Blob([upload.content], { type: "text/markdown" }), upload.fileName);
  }
  const request = HttpClientRequest.post(`${connection.apiUrl}/api/v1/add`).pipe(
    HttpClientRequest.setHeader("Authorization", `Bearer ${connection.token}`),
    HttpClientRequest.bodyFormData(formData)
  );
  const response = yield* client
    .execute(request)
    .pipe(Effect.mapError(requestFailed(`add (dataset "${datasetName}")`, connection.apiUrl)));
  if (response.status >= 400) {
    const text = yield* response.text.pipe(Effect.orElseSucceed(() => ""));
    return yield* failStatus(`add (dataset "${datasetName}")`, response.status, text);
  }
  yield* response.text.pipe(Effect.ignore);
});

/**
 * Run cognify over the named datasets.
 *
 * @internal
 * @category utilities
 */
export const cogneeCognify = Effect.fn("CogneeClient.cogneeCognify")(function* (
  connection: CogneeConnection,
  datasets: ReadonlyArray<string>,
  runInBackground: boolean
): Effect.fn.Return<void, ResearchCommandError, HttpClient.HttpClient> {
  const client = yield* HttpClient.HttpClient;
  const request = HttpClientRequest.post(`${connection.apiUrl}/api/v1/cognify`).pipe(
    HttpClientRequest.setHeader("Authorization", `Bearer ${connection.token}`),
    HttpClientRequest.bodyJsonUnsafe({ datasets: [...datasets], runInBackground })
  );
  const response = yield* client.execute(request).pipe(Effect.mapError(requestFailed("cognify", connection.apiUrl)));
  if (response.status >= 400) {
    const text = yield* response.text.pipe(Effect.orElseSucceed(() => ""));
    return yield* failStatus("cognify", response.status, text);
  }
  yield* response.text.pipe(Effect.ignore);
});

/**
 * Map a card source type onto its Cognee dataset name.
 *
 * @internal
 * @param sourceType - Knowledge-card source type.
 * @returns Cognee dataset name for that source type.
 * @category utilities
 */
export const datasetForSourceType = (sourceType: string): string =>
  sourceType === "link" ? "kb_inbox" : `kb_${sourceType.replaceAll("-", "_")}s`;
