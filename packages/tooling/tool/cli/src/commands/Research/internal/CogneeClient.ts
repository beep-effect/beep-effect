/**
 * Minimal Cognee REST client for research cognify.
 *
 * Talks to the running Cognee API (`COGNEE_API_URL`) with the default-user
 * login flow; card markdown is added per dataset and cognified in one call.
 * Cognee deduplicates added documents by content hash, so re-pushing an
 * unchanged card is a no-op while a changed card lands as fresh content.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Config, Effect, Redacted } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import { ResearchCommandError } from "../Research.errors.js";

const $I = $RepoCliId.create("commands/Research/internal/CogneeClient");

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
 * Connection comes from `COGNEE_API_URL` (required), `COGNEE_API_EMAIL`, and
 * `COGNEE_API_PASSWORD` (defaulting to the Cognee default user).
 *
 * @internal
 * @category utilities
 */
export const cogneeLogin = Effect.fn("CogneeClient.cogneeLogin")(function* (): Effect.fn.Return<
  CogneeConnection,
  ResearchCommandError,
  HttpClient.HttpClient
> {
  const client = yield* HttpClient.HttpClient;
  const apiUrl = yield* Config.string("COGNEE_API_URL").pipe(
    ResearchCommandError.mapError(
      "COGNEE_API_URL is not set; point it at the running Cognee API (e.g. http://100.84.76.60:8010)."
    )
  );
  const email = yield* Effect.orDie(
    Config.string("COGNEE_API_EMAIL").pipe(Config.withDefault("default_user@example.com"))
  );
  const password = yield* Effect.orDie(
    Config.redacted("COGNEE_API_PASSWORD").pipe(Config.withDefault(Redacted.make("default_password")))
  );
  const request = HttpClientRequest.post(`${apiUrl}/api/v1/auth/login`).pipe(
    HttpClientRequest.bodyUrlParams({
      password: Redacted.value(password),
      username: email,
    })
  );
  const response = yield* client.execute(request).pipe(ResearchCommandError.mapError("Cognee login request failed."));
  if (response.status >= 400) {
    const text = yield* response.text.pipe(Effect.orElseSucceed(() => ""));
    return yield* failStatus("login", response.status, text);
  }
  const raw = yield* response.json.pipe(ResearchCommandError.mapError("Cognee login response was not valid JSON."));
  const decoded = yield* decodeLoginResponse(raw).pipe(
    ResearchCommandError.mapError("Cognee login response failed schema validation.")
  );
  return CogneeConnection.make({ apiUrl, token: decoded.access_token });
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
    .pipe(ResearchCommandError.mapError(`Cognee add failed for dataset "${datasetName}".`));
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
  const response = yield* client.execute(request).pipe(ResearchCommandError.mapError("Cognee cognify request failed."));
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
