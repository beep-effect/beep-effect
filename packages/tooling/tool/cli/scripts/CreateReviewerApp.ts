/**
 * Human-operated App registration. Run: bun scripts/github-app/create-beep-reviewer.ts
 * Secret material travels only through memory and the op process's stdin.
 */

import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type * as Context from "effect/Context";

const PORT = 8787;
const MANIFEST_URL = new URL("../../../../../scripts/github-app/beep-reviewer.manifest.json", import.meta.url);

class Conversion extends S.Class<Conversion, { readonly brand: unique symbol }>("ReviewerManifestConversion")({
  id: S.Int,
  client_id: S.NonEmptyString,
  pem: S.RedactedFromValue(S.NonEmptyString),
}) {}
const decodeConversion = S.decodeUnknownEffect(Conversion);
const Json = S.fromJsonString(S.Unknown);
const encodeJson = S.encodeEffect(Json);
const decodeJson = S.decodeUnknownEffect(Json);
const Manifest = S.Record(S.String, S.Unknown);
const decodeManifest = S.decodeUnknownEffect(Manifest);
const headers = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "content-type": "text/html; charset=utf-8",
  "content-security-policy": "default-src 'none'; form-action https://github.com; frame-ancestors 'none'",
};
const page = (body: string, status = 200) => new Response(body, { status, headers });
const validLocalRequest = (request: Request, url: URL) =>
  request.method === "GET" && [`localhost:${PORT}`, `127.0.0.1:${PORT}`].includes(url.host);

const convertAndStore = Effect.fn("ReviewerBootstrap.convertAndStore")(function* (code: string | null) {
  const client = yield* HttpClient.HttpClient;
  const response = yield* client.execute(
    HttpClientRequest.post(`https://api.github.com/app-manifests/${encodeURIComponent(code ?? "")}/conversions`).pipe(
      HttpClientRequest.setHeaders({
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
      })
    )
  );
  if (response.status !== 201) {
    yield* Effect.logError(`[reviewer-bootstrap] Manifest conversion returned HTTP ${response.status}.`);
    return false;
  }
  const converted = yield* decodeConversion(yield* response.json);
  const template = yield* encodeJson({
    title: "beep-reviewer GitHub App",
    category: "API_CREDENTIAL",
    fields: [
      { id: "app_id", label: "app_id", type: "STRING", value: `${converted.id}` },
      { id: "client_id", label: "client_id", type: "STRING", value: converted.client_id },
      { id: "installation_id", label: "installation_id", type: "STRING", value: "" },
      { id: "private_key", label: "private_key", type: "CONCEALED", value: Redacted.value(converted.pem) },
    ],
  });
  // No secret in argv, stdout, stderr, the callback page, or a temporary file.
  // Bun uses a socket for child stdin on Linux. The CLI requires a real pipe
  // to detect a JSON template, so cat bridges the in-memory Blob into one.
  const child = Bun.spawn(["bash", "-o", "pipefail", "-c", "cat | op item create --vault BEEP_SECRETS -"], {
    stdin: new Blob([template]),
    stdout: "ignore",
    stderr: "ignore",
  });
  const status = yield* Effect.promise(() => child.exited);
  if (status !== 0) {
    yield* Effect.logError(
      `[reviewer-bootstrap] 1Password item creation exited ${status}; secret diagnostics suppressed.`
    );
    const doctor = Bun.spawn(["op-doctor"], { stdout: "inherit", stderr: "ignore" });
    yield* Effect.promise(() => doctor.exited);
    return false;
  }
  return true;
});

const renderResult = (result: boolean) =>
  page(
    result
      ? "Stored in 1Password. Stop this server, install the App on beep-effect/beep-effect only, then record installation_id."
      : "Conversion or vault write failed. No secret was printed or saved locally. Inspect the App settings and revoke the generated key before retrying.",
    result ? 200 : 500
  );

// Bridges one Bun request into the captured Effect context; Bun calls it outside any fiber.
const fetchWith =
  (
    context: Context.Context<HttpClient.HttpClient>,
    handle: (request: Request) => Effect.Effect<Response, never, HttpClient.HttpClient>
  ) =>
  (request: Request): Promise<Response> =>
    Effect.runPromise(Effect.provideContext(handle(request), context));

const serve = Effect.gen(function* () {
  const crypto = yield* SecureRandom.SecureRandom;
  const nonce = yield* crypto.uuidV4();
  const manifest = yield* decodeJson(yield* Effect.promise(() => Bun.file(MANIFEST_URL).text())).pipe(
    Effect.flatMap(decodeManifest)
  );
  const manifestJson = yield* encodeJson(manifest);
  const escaped = pipe(
    manifestJson,
    Str.replaceAll("&", "&amp;"),
    Str.replaceAll('"', "&quot;"),
    Str.replaceAll("<", "&lt;")
  );
  const context = yield* Effect.context<HttpClient.HttpClient>();
  let attempted = false;
  const validCallback = (url: URL) =>
    url.pathname === "/callback" &&
    url.searchParams.get("state") === nonce &&
    url.searchParams.has("code") &&
    !attempted;
  const handle = Effect.fnUntraced(function* (request: Request) {
    const url = new URL(request.url);
    if (!validLocalRequest(request, url)) return page("Rejected", 400);
    if (url.pathname === "/") {
      return page(
        `<form method="POST" action="https://github.com/organizations/beep-effect/settings/apps/new?state=${nonce}"><input type="hidden" name="manifest" value="${escaped}"><button>Create beep-reviewer in beep-effect</button></form>`
      );
    }
    if (!validCallback(url)) return page("Invalid or already used callback", 400);
    attempted = true;
    const stored = yield* convertAndStore(url.searchParams.get("code")).pipe(
      Effect.catchCause(() => Effect.succeed(false))
    );
    return renderResult(stored);
  });
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: PORT,
    fetch: fetchWith(context, handle),
    error: () => page("Registration failed; secret diagnostics suppressed.", 500),
  });
  yield* Effect.log(
    `Open http://localhost:${server.port} as kriegcloud. The callback never displays credentials. Ctrl-C stops the server.`
  );
});

const ReviewerBootstrapLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  BunCrypto.layer,
  Logger.layer([Logger.withLeveledConsole(Logger.formatSimple)])
);

await Effect.runPromise(
  ReviewerBootstrapLayer.pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provideContext(serve, context)),
    Effect.scoped
  )
);
