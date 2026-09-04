# Live Spike Harness — one-time grant + read-only probes

The P0 live half needs exactly one interactive step (FreshBooks has no
client-credentials grant). Everything else is scripted and read-only.

## Operator steps (once)

1. In the FreshBooks developer portal (`https://my.freshbooks.com/#/developer`),
   edit the dev app "Oppold IP Law Development" and add this line to the
   Redirect URIs field (URIs are one per line; keep the existing lines):

   ```text
   https://localhost:8443/callback
   ```

   FreshBooks requires exact-match HTTPS redirects; localhost is permitted
   for development (see the spike report's OAuth section).

2. Run the harness (below), open the authorize URL it prints, log in, click
   **Authorize**, and accept the browser's self-signed-certificate warning
   on the localhost redirect. The script does the rest and prints a
   redacted summary for the spike report addendum.

## Harness

Materialize the script below as `freshbooks-spike.ts` in a scratch
directory, plus an env file `freshbooks-dev.env`:

```text
FRESHBOOKS_CLIENT_ID="op://BEEP_SECRETS/BEEP_SECRETS/PAYMENTS_DEV_FRESHBOOKS_CLIENT_ID"
FRESHBOOKS_CLIENT_SECRET="op://BEEP_SECRETS/BEEP_SECRETS/PAYMENTS_DEV_FRESHBOOKS_CLIENT_SECRET"
```

Run:

```sh
op run --env-file=freshbooks-dev.env -- bun freshbooks-spike.ts
```

Token state persists to `~/.local/state/beep-freshbooks/dev-token.json`
(created `0600`; write-then-rename so the rotated refresh token is durable
before any further call). Token values are never printed. If a token file
already exists, the grant is skipped and the script goes straight to the
probes — safe to re-run.

```ts
/* freshbooks-spike.ts — P0 read-only spike for goals/freshbooks-driver */
import { chmodSync, existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const AUTH = "https://auth.freshbooks.com";
const API = "https://api.freshbooks.com";
const PORT = 8443;
const REDIRECT = `https://localhost:${PORT}/callback`;
const STATE_DIR = join(homedir(), ".local/state/beep-freshbooks");
const TOKEN_FILE = join(STATE_DIR, "dev-token.json");
const CLIENT_ID = process.env.FRESHBOOKS_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.FRESHBOOKS_CLIENT_SECRET ?? "";
if (CLIENT_ID === "" || CLIENT_SECRET === "") throw new Error("missing client env (run under op run)");
mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });

type Tokens = { access_token: string; refresh_token: string; expires_in: number; [k: string]: unknown };
const persist = (tokens: Tokens): void => {
  const tmp = `${TOKEN_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify({ ...tokens, obtained_at: Date.now() }), { mode: 0o600 });
  renameSync(tmp, TOKEN_FILE);
  chmodSync(TOKEN_FILE, 0o600);
};
const tokenCall = async (body: Record<string, string>): Promise<Tokens> => {
  const res = await fetch(`${API}/auth/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT, ...body }),
  });
  const json = (await res.json()) as Tokens;
  console.log(`token call grant=${body.grant_type}: status=${res.status} keys=[${Object.keys(json).sort().join(", ")}] expires_in=${json.expires_in}`);
  if (!res.ok) throw new Error(`token call failed: ${res.status} ${JSON.stringify(json).slice(0, 200)}`);
  persist(json);
  return json;
};

const ensureCert = async (): Promise<{ cert: string; key: string }> => {
  const cert = join(STATE_DIR, "localhost.crt");
  const key = join(STATE_DIR, "localhost.key");
  if (!existsSync(cert)) {
    const p = Bun.spawnSync(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key,
      "-out", cert, "-days", "30", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost"]);
    if (p.exitCode !== 0) throw new Error(`openssl failed: ${p.stderr.toString()}`);
  }
  return { cert, key };
};

const acquire = async (): Promise<Tokens> => {
  if (existsSync(TOKEN_FILE)) return JSON.parse(await Bun.file(TOKEN_FILE).text()) as Tokens;
  const { cert, key } = await ensureCert();
  console.log("\nOpen and authorize:\n");
  console.log(`${AUTH}/oauth/authorize/?response_type=code&redirect_uri=${encodeURIComponent(REDIRECT)}&client_id=${CLIENT_ID}\n`);
  const code = await new Promise<string>((resolve) => {
    const server = Bun.serve({
      port: PORT,
      tls: { cert: Bun.file(cert), key: Bun.file(key) },
      fetch(req) {
        const url = new URL(req.url);
        const c = url.searchParams.get("code");
        if (url.pathname === "/callback" && c !== null) {
          setTimeout(() => { server.stop(); resolve(c); }, 50);
          return new Response("Code received - you can close this tab.", { status: 200 });
        }
        return new Response("waiting for /callback?code=...", { status: 404 });
      },
    });
  });
  return tokenCall({ grant_type: "authorization_code", code });
};

const interestingHeaders = (h: Headers): string =>
  [...h.entries()].filter(([k]) => /ratelimit|retry-after|x-request/i.test(k)).map(([k, v]) => `${k}=${v}`).join(" ") || "(none)";

const main = async (): Promise<void> => {
  let tokens = await acquire();
  const get = async (path: string, accept = "application/json"): Promise<Response> =>
    fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: accept } });

  const me = await get("/auth/api/v1/users/me");
  const meJson = (await me.json()) as { response?: Record<string, unknown> } & Record<string, unknown>;
  const identity = (meJson.response ?? meJson) as Record<string, unknown>;
  console.log(`/me: status=${me.status} wrapped=${"response" in meJson} keys=[${Object.keys(identity).sort().slice(0, 12).join(", ")}]`);
  const memberships = (identity.business_memberships ?? []) as Array<{ business: { id: number; account_id: string | null; name: string } }>;
  const business = memberships.map((m) => m.business).find((b) => b.account_id !== null);
  if (business === undefined || business.account_id === null) throw new Error("no business with an account_id on this identity");
  const accountId = business.account_id;
  console.log(`business: id(int)=${business.id} account_id(string)=${accountId} name=${business.name}`);

  for (const [label, path] of [
    ["clients", `/accounting/account/${accountId}/users/clients?per_page=2`],
    ["invoices", `/accounting/account/${accountId}/invoices/invoices?per_page=2`],
    ["payments", `/accounting/account/${accountId}/payments/payments?per_page=2`],
  ] as const) {
    const res = await get(path);
    const body = (await res.json()) as { response?: { result?: Record<string, unknown> } };
    const result = body.response?.result ?? {};
    console.log(`${label}: status=${res.status} resultKeys=[${Object.keys(result).sort().join(", ")}] headers: ${interestingHeaders(res.headers)}`);
    if (label === "invoices") {
      const invoices = (result.invoices ?? []) as Array<{ id: number }>;
      const invoiceId = invoices[0]?.id;
      if (invoiceId === undefined) { console.log("PDF probe skipped: no invoices on dev account — create one draft invoice and re-run"); continue; }
      const pdf = await get(`/accounting/account/${accountId}/invoices/invoices/${invoiceId}/pdf`, "application/pdf");
      const bytes = new Uint8Array(await pdf.arrayBuffer());
      const magic = new TextDecoder().decode(bytes.slice(0, 8));
      console.log(`PDF /pdf route: status=${pdf.status} content-type=${pdf.headers.get("content-type")} bytes=${bytes.length} magic=${JSON.stringify(magic)} headers: ${interestingHeaders(pdf.headers)}`);
      const alt = await get(`/accounting/account/${accountId}/invoices/invoices/${invoiceId}`, "application/pdf");
      console.log(`PDF accept-header variant: status=${alt.status} content-type=${alt.headers.get("content-type")}`);
    }
  }

  const oldRefresh = tokens.refresh_token;
  tokens = await tokenCall({ grant_type: "refresh_token", refresh_token: oldRefresh });
  const replay = await fetch(`${API}/auth/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "refresh_token", client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT, refresh_token: oldRefresh }),
  });
  console.log(`replay of consumed refresh token: status=${replay.status} body=${(await replay.text()).slice(0, 160)}`);
  const postRotate = await get("/auth/api/v1/users/me");
  console.log(`post-rotation /me with new bearer: status=${postRotate.status}`);
};

await main();
```

## What gets recorded

Only shapes, statuses, headers, and byte counts go into the spike report
addendum. Account/business ids print to the local console for operator
confirmation but stay out of the committed report; token values never leave
the `0600` state file.
