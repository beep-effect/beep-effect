/**
 * Human-operated registration of the `beep-knowledge-mint` GitHub App.
 * Run: bun scripts/github-app/create-beep-knowledge-mint.ts (through the human launcher).
 * Secret material travels only through memory and the op process's stdin.
 */
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Match from "effect/Match";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";

const PORT = 8787;
const MANIFEST_URL = new URL("../../../../../scripts/github-app/beep-knowledge-mint.manifest.json", import.meta.url);
const ITEM_TITLE = "beep-knowledge-mint GitHub App";

class MintConversion extends S.Opaque<MintConversion, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.Int,
    slug: S.NonEmptyString,
    client_id: S.NonEmptyString,
    pem: S.RedactedFromValue(S.NonEmptyString),
  }).annotate({ identifier: "KnowledgeMintManifestConversion" })
) {}
const decodeConversion = S.decodeUnknownEffect(MintConversion);
const Json = S.fromJsonString(S.Unknown);
const encodeJson = S.encodeEffect(Json);
const decodeJson = S.decodeUnknownEffect(Json);
const decodeManifest = S.decodeUnknownEffect(S.Record(S.String, S.Unknown));

const headers = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "content-type": "text/html; charset=utf-8",
  "content-security-policy": "default-src 'none'; form-action https://github.com; frame-ancestors 'none'",
};
const page = (body: string, status = 200) => new Response(body, { status, headers });

/** The outcome of one callback, safe to show: no credential, payload, or exception text. */
type Outcome =
  | { readonly _tag: "Stored"; readonly slug: string; readonly appId: number }
  | { readonly _tag: "ConversionFailed"; readonly status: number }
  | { readonly _tag: "StoreFailed"; readonly slug: string; readonly exitCode: number }
  | { readonly _tag: "Failed" };

const renderTemplate = (converted: MintConversion) =>
  encodeJson({
    title: ITEM_TITLE,
    category: "API_CREDENTIAL",
    fields: [
      { id: "app_id", label: "app_id", type: "STRING", value: `${converted.id}` },
      { id: "client_id", label: "client_id", type: "STRING", value: converted.client_id },
      { id: "installation_id", label: "installation_id", type: "STRING", value: "" },
      { id: "slug", label: "slug", type: "STRING", value: converted.slug },
      { id: "private_key", label: "private_key", type: "CONCEALED", value: Redacted.value(converted.pem) },
    ],
  });

const convertAndStore = Effect.fn("KnowledgeMint.convertAndStore")(function* (code: string) {
  const client = yield* HttpClient.HttpClient;
  const response = yield* client.execute(
    HttpClientRequest.post(`https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`).pipe(
      HttpClientRequest.setHeaders({ accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" })
    )
  );
  if (response.status !== 201) {
    return { _tag: "ConversionFailed", status: response.status } satisfies Outcome;
  }
  const converted = yield* decodeConversion(yield* response.json);
  const template = yield* renderTemplate(converted);
  // No secret in argv, stdout, stderr, the callback page, or a temporary file.
  // Bun uses a socket for child stdin on Linux. The CLI requires a real pipe
  // to detect a JSON template, so cat bridges the in-memory Blob into one.
  const child = Bun.spawn(["bash", "-o", "pipefail", "-c", "cat | op item create --vault BEEP_SECRETS -"], {
    stdin: new Blob([template]),
    stdout: "ignore",
    stderr: "ignore",
  });
  const exitCode = yield* Effect.promise(() => child.exited);
  if (exitCode !== 0) {
    // One safe, count-only diagnosis for the operator; a missing op-doctor changes nothing.
    yield* Effect.tryPromise(() => Bun.spawn(["op-doctor"], { stdout: "inherit", stderr: "ignore" }).exited).pipe(
      Effect.ignore
    );
  }
  return exitCode === 0
    ? ({ _tag: "Stored", slug: converted.slug, appId: converted.id } satisfies Outcome)
    : ({ _tag: "StoreFailed", slug: converted.slug, exitCode } satisfies Outcome);
});

const runCallback = (code: string): Promise<Outcome> =>
  Effect.runPromise(
    convertAndStore(code).pipe(
      Effect.provide(FetchHttpClient.layer),
      Effect.catchCause(() => Effect.succeed<Outcome>({ _tag: "Failed" }))
    )
  );

const report = (outcome: Outcome): Response =>
  Match.valueTags(outcome, {
    Stored: (outcome) => {
      console.log(
        `[knowledge-mint] Stored "${ITEM_TITLE}" in BEEP_SECRETS for App ${outcome.slug} (app_id ${outcome.appId}). Install it, record installation_id, then press Ctrl-C.`
      );
      return page(
        `Stored in 1Password as "${ITEM_TITLE}" (App ${outcome.slug}). Install it on beep-effect/beep-effect only, record installation_id, then stop the launcher with Ctrl-C.`
      );
    },
    ConversionFailed: (outcome) => {
      console.error(`[knowledge-mint] Manifest conversion returned HTTP ${outcome.status}; nothing was stored.`);
      return page(
        `Manifest conversion returned HTTP ${outcome.status}. Nothing was stored. Check the App registration page before starting over.`,
        500
      );
    },
    StoreFailed: (outcome) => {
      console.error(
        `[knowledge-mint] App ${outcome.slug} was registered, but 1Password item creation exited ${outcome.exitCode}; secret diagnostics suppressed. Do not reload the callback.`
      );
      return page(
        `App ${outcome.slug} was registered, but storing it in 1Password failed (exit ${outcome.exitCode}). Do not reload this page: the code is single-use. Revoke the new App's generated private key, delete the uninstalled registration, then start the launcher again.`,
        500
      );
    },
    Failed: () => {
      console.error(
        "[knowledge-mint] Conversion or vault write failed; diagnostics suppressed. Do not reload the callback."
      );
      return page(
        "Conversion or vault write failed. No secret was printed or saved locally. Do not reload this page. Inspect the App settings, revoke any generated key, and delete an uninstalled new registration before retrying.",
        500
      );
    },
  });

/**
 * Builds the loopback request handler for one registration attempt.
 *
 * **Details**
 *
 * `/` serves a form that POSTs the manifest to the beep-effect organization's App registration
 * page with a random `state`. `/callback` accepts exactly one request whose `state` matches,
 * exchanges the code, and stores the credentials through the op process's stdin. Any other
 * host, method, path, state, or a second callback is rejected.
 *
 * @param nonce - Random state value bound into the registration form and checked on callback.
 * @param manifestJson - Serialized App manifest posted to GitHub.
 * @returns A fetch handler for `Bun.serve`.
 */
export const makeKnowledgeMintHandler = (nonce: string, manifestJson: string) => {
  const escaped = manifestJson.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
  let attempted = false;
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (request.method !== "GET" || ![`localhost:${PORT}`, `127.0.0.1:${PORT}`].includes(url.host)) {
      return page("Rejected", 400);
    }
    if (url.pathname === "/") {
      return page(
        `<form method="POST" action="https://github.com/organizations/beep-effect/settings/apps/new?state=${nonce}"><input type="hidden" name="manifest" value="${escaped}"><button>Create beep-knowledge-mint in beep-effect</button></form>`
      );
    }
    const code = url.searchParams.get("code");
    if (url.pathname !== "/callback" || url.searchParams.get("state") !== nonce || code === null || attempted) {
      return page("Invalid or already used callback", 400);
    }
    attempted = true;
    return report(await runCallback(code));
  };
};

/**
 * Starts the loopback registration server and prints the URL to open.
 *
 * @returns Nothing; the server runs until the human stops it with Ctrl-C.
 */
export const startKnowledgeMintRegistration = async (): Promise<void> => {
  const manifest = await Effect.runPromise(
    decodeJson(await Bun.file(MANIFEST_URL).text()).pipe(Effect.flatMap(decodeManifest))
  );
  const manifestJson = await Effect.runPromise(encodeJson(manifest));
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: PORT,
    fetch: makeKnowledgeMintHandler(crypto.randomUUID(), manifestJson),
    error: () => page("Registration failed; secret diagnostics suppressed.", 500),
  });
  console.log(
    `[knowledge-mint] Listening. Open http://localhost:${server.port} in Chrome as kriegcloud. The callback never displays credentials. Ctrl-C stops the server.`
  );
};
