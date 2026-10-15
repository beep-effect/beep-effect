/**
 * Human-operated App registration. Run: bun scripts/github-app/create-beep-reviewer.ts
 * Secret material travels only through memory and the op process's stdin.
 */
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";

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
const nonce = crypto.randomUUID();
const manifest = await Effect.runPromise(
  decodeJson(
    await Bun.file(new URL("../../../../../scripts/github-app/beep-reviewer.manifest.json", import.meta.url)).text()
  ).pipe(Effect.flatMap(decodeManifest))
);
const manifestJson = await Effect.runPromise(encodeJson(manifest));
const escaped = manifestJson.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
let attempted = false;
const headers = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "content-type": "text/html; charset=utf-8",
  "content-security-policy": "default-src 'none'; form-action https://github.com; frame-ancestors 'none'",
};
const validLocalRequest = (request: Request, url: URL) =>
  request.method === "GET" && ["localhost:8787", "127.0.0.1:8787"].includes(url.host);
const validCallback = (url: URL) =>
  url.pathname === "/callback" && url.searchParams.get("state") === nonce && url.searchParams.has("code") && !attempted;
const convertAndStore = (code: string | null) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const response = yield* client.execute(
        HttpClientRequest.post(
          `https://api.github.com/app-manifests/${encodeURIComponent(code ?? "")}/conversions`
        ).pipe(
          HttpClientRequest.setHeaders({
            accept: "application/vnd.github+json",
            "x-github-api-version": "2022-11-28",
          })
        )
      );
      if (response.status !== 201) {
        console.error(`[reviewer-bootstrap] Manifest conversion returned HTTP ${response.status}.`);
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
        console.error(`[reviewer-bootstrap] 1Password item creation exited ${status}; secret diagnostics suppressed.`);
        const doctor = Bun.spawn(["op-doctor"], { stdout: "inherit", stderr: "ignore" });
        yield* Effect.promise(() => doctor.exited);
        return false;
      }
      return true;
    }).pipe(
      Effect.provide(FetchHttpClient.layer),
      Effect.catchCause(() => Effect.succeed(false))
    )
  );
const renderResult = (result: boolean) =>
  new Response(
    result
      ? "Stored in 1Password. Stop this server, install the App on beep-effect/beep-effect only, then record installation_id."
      : "Conversion or vault write failed. No secret was printed or saved locally. Inspect the App settings and revoke the generated key before retrying.",
    { status: result ? 200 : 500, headers }
  );
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 8787,
  async fetch(request) {
    const url = new URL(request.url);
    if (!validLocalRequest(request, url)) return new Response("Rejected", { status: 400, headers });
    if (url.pathname === "/")
      return new Response(
        `<form method="POST" action="https://github.com/organizations/beep-effect/settings/apps/new?state=${nonce}"><input type="hidden" name="manifest" value="${escaped}"><button>Create beep-reviewer in beep-effect</button></form>`,
        { headers }
      );
    if (!validCallback(url)) return new Response("Invalid or already used callback", { status: 400, headers });
    attempted = true;
    return renderResult(await convertAndStore(url.searchParams.get("code")));
  },
  error() {
    return new Response("Registration failed; secret diagnostics suppressed.", { status: 500, headers });
  },
});
console.log(
  `Open http://localhost:${server.port} as kriegcloud. The callback never displays credentials. Ctrl-C stops the server.`
);
