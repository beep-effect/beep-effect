# Secure Document Download Proxy — Research

<!--
Stage 1. Synthesized 2026-06-29 from research/*.md subtopic files. Two halves:
external landscape (cited) and in-repo inventory (compose bricks, mark gaps
NOT FOUND). Raw per-subtopic detail lives in research/<subtopic>.md.
-->

## 2026-07-14 Amendment — Live Desktop Runtime and Ratified Boundaries

This amendment supersedes the stale June runtime statements below where they
conflict. The root catalog and professional-desktop app now resolve
`@electric-sql/pglite` **0.5.4** (`package.json`,
`apps/professional-desktop/package.json`); `0.4.6` remains only under the
explicit `@electric-sql/pglite-legacy-046` alias. The existing
`PgliteDrizzleLive` and boot-migration path remains the correct binding target.

The sidecar HTTP surface also postdates the June research: `main.ts` binds Bun
to `127.0.0.1`, and `RpcSessionAuth.ts` supplies a per-launch redacted bearer
token plus request middleware. The document route will extend that authenticated
edge while remaining separate from permissive RPC CORS and adding Host,
session/audience, and identical-404 document semantics.

Alignment further rejected the upstream seven-day default: TTL is
consumer-supplied and purpose-bound under a packet-owned maximum. Live provider
fetch is fixture-only until the ingestion-security DNS-rebinding harness passes.

## External Landscape

Two convergent porting sources frame the wedge: an edge-gated `GET /resources/:file`
route (strict-UUID guard, `private, no-store` PDFs, 404-on-expired) and a
`SecureLinkCache` (encrypted opaque-id → real-id mapping, TTL auto-expiry,
server-held key). Raw detail:
[research/edge-gated-resource-route-and-stand-alone-vs-attach.md](research/edge-gated-resource-route-and-stand-alone-vs-attach.md)
and [research/opaque-ttl-link-token-cryptography.md](research/opaque-ttl-link-token-cryptography.md).

**The edge-route security model.** The strict v4-UUID gate
(`^[0-9a-f]{8}-...-4[0-9a-f]{3}-[89ab]...$`) pins the version nibble to `4` and
variant to `[89ab]`; these positions are normative in RFC 4122 / RFC 9562
(https://www.rfc-editor.org/rfc/rfc9562.html). The regex is a *cheap pre-filter,
not the authorization* — the same vendor source warns "regex can validate the
format but cannot guarantee uniqueness, security…always parse with a trusted
library" (https://www.dev-toolbox.tech/tools/regex-cheat-sheet/examples/regex-for-uuid-validation).
Paired with a `.pdf` suffix guard *before any fs access*, the UUID-only basename
removes every attacker-controlled path component (the structural anti-traversal
defense). `Cache-Control: private, no-store` is RFC 9111 normative: `no-store` =
"a cache MUST NOT store any part of…the response"; `private` = "a shared cache
MUST NOT store" (https://www.rfc-editor.org/rfc/rfc9111.html). `no-store` is the
load-bearing directive for private PDFs and also suppresses BFCache; note
`no-store` ≠ `no-cache` (https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control).
404-on-expired/missing is deliberate opacity (expired vs never-existed are
indistinguishable, leaking no existence signal).

**Token format landscape (encrypt the id-mapping, not the bytes).** Fernet (the
Python original) is AES-128-CBC + HMAC-SHA256, base64url, with TTL checked
*at decode* (not embedded) and **no key-rotation mechanism in spec**
(https://github.com/fernet/spec/blob/master/Spec.md,
https://cryptography.io/en/latest/fernet/). There is no maintained Effect/TS
Fernet, so a port means reimplement or pick a TS-native equivalent:
- **Branca** (XChaCha20-Poly1305 AEAD, base62) — spec is sound but the canonical
  JS lib is `branca@0.5.0`, last published 2022-04-27, ~4 years stale
  (https://github.com/tuupola/branca-spec/blob/master/README.md). Treat spec as
  portable; do not adopt the package.
- **PASETO v4.local** (XChaCha20 + keyed-BLAKE2b) — strong "no algorithm
  confusion" design, but `paseto@3.1.4` (2023-04-27) is stale and not
  OAuth-compatible (https://github.com/paseto-standard/paseto-spec/blob/master/docs/Rationale-V3-V4.md,
  https://www.scottbrady.io/jose/alternatives-to-jwts).
- **iron-webcrypto** — `2.0.0` published 2025-11-25, MIT, **actively maintained**;
  WebCrypto-native (Node 20+/Deno/Bun/CF Workers), first-class `ttl` option +
  password-`id` key rotation, powers `iron-session`. Default cipher AES-256-CBC +
  HMAC-SHA256 (not AEAD); **PBKDF2 iterations default to 1** — acceptable *only*
  because the "password" is a high-entropy server key, not a human secret
  (https://github.com/brc-dd/iron-webcrypto/blob/main/README.md).
- **JWE via `jose`** (`6.2.3`, 2026-04, maintained) — `dir`+`A256GCM` gives an
  AEAD sealed token, but JWE is verbose/OAuth-shaped and leaks header structure;
  overkill for a short, non-revealing local URL
  (https://www.npmjs.com/package/jose, https://zitadel.com/blog/jwt-vs-opaque-tokens).
- **HMAC-signed URL** (SigV4/GCS/NGINX `secure_link`) — signs, does *not* encrypt
  the embedded path/ids, so it fails the "non-business-revealing" bar unless the
  path is already opaque; best practice is *short* TTL (~15 min), conflicting with
  the "default 7 days" requirement, and long-lived signed URLs are hard to revoke
  (https://docs.cloud.google.com/storage/docs/access-control/signed-urls,
  https://docs.aws.amazon.com/pdfs/prescriptive-guidance/latest/presigned-url-best-practices/presigned-url-best-practices.pdf).
- **`@noble/ciphers`** — `2.2.0` (2026-04-11, MIT, 0 deps, audited, PGP-signed)
  exports `xchacha20poly1305` directly, the exact Branca/PASETO-v4 primitive — the
  zero-dep path to an in-house sealed token without the stale packages
  (https://github.com/paulmillr/noble-ciphers/blob/main/README.md). WebCrypto
  `AES-256-GCM` (already in `crypto.subtle`) is an even-lighter native AEAD.

**Opaque-id vs sealed-token, the core tradeoff.** A v4 UUID has 122 bits of
randomness (https://www.rfc-editor.org/rfc/rfc9562.html) — unguessable enough for
a capability id, but "UUIDs were designed for uniqueness, not secrecy"
(https://fastuuid.com/learn-about-uuids/uuid-security/). **Opaque/reference token**
(UUID + store row): compact, non-revealing, *immediate revocation*, but needs a
stateful lookup per request. **Stateless sealed token**: self-contained, no DB,
but cannot be revoked before expiry without reintroducing state
(https://nordicapis.com/jwt-vs-opaque-tokens-choosing-the-right-token-for-api-security/).
Recommended hybrid (matches both porting sources): opaque UUIDv4 in the URL,
backed by an *encrypted store row* holding real ids + `expires_at` — gives 7d TTL
*and* instant revocation. W3C TAG capability-URL hygiene reinforces: unguessable
RNG id, **no business/PII in the URL**, HMAC (not raw hash) if hashing, mitigate
`Referer` leakage (https://www.w3.org/2001/tag/doc/capability-urls/,
https://web.dev/articles/referrer-best-practices).

**Key custody & desktop boundary.** Boundary precision (Codex gate-1): the
sidecar is itself a desktop process spawned by the Tauri shell
(`apps/professional-desktop/src-tauri/src/lib.rs:420-451` injects `CHAT_DB_PATH`,
`CHAT_AGENT`, `CHAT_TRANSPORT`, and sometimes `AI_ANTHROPIC_API_KEY`), so a key
living in the sidecar *does* reach "the desktop". The real boundary is
renderer/LLM/tooling vs the privileged sidecar process plus OS key storage: the
key never reaches the renderer, LLM, logs, or URL — it is held only in the
privileged sidecar process and wrapped at rest by OS-backed storage. Effect
`Redacted` is the in-process guard (logs print `<redacted>`, `Redacted.value` is
the explicit unwrap) (https://effect.website/docs/data-types/redacted/). At-rest key wrapping: Windows
DPAPI (`CryptProtectData`/`CurrentUser`, master key under
`%APPDATA%\Microsoft\Protect\{SID}`) is the original's option but **Windows-only**
(https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.protecteddata).
Cross-platform analog for a Tauri desktop is the OS keyring via
`tauri-plugin-keyring` (macOS Keychain / Linux Secret Service / Windows Credential
Manager) (https://github.com/charlesportwoodii/tauri-plugin-keyring).
**Tauri Stronghold is deprecated/being removed in v3 — do not adopt it**; prefer
the OS keyring (https://v2.tauri.app/plugin/stronghold/).

**Tauri serve-boundary options.** Correction (Codex gate-1): the desktop *does*
have an HTTP edge — the Bun sidecar already serves
`RpcServer.layerProtocolHttp({ path: "/rpc" })` on loopback `:3939` with permissive
CORS (`apps/professional-desktop/server/main.ts:9-13,51-68`), launched with
`CHAT_TRANSPORT=http` unless IPC is selected
(`apps/professional-desktop/src-tauri/src/lib.rs:445-448`), already CSP-permitted
(`apps/professional-desktop/src-tauri/tauri.conf.json:23`) and dev-proxied
(`apps/professional-desktop/vite.config.ts:39-44`). What is missing is a
*document/resource route*, not an HTTP edge. Four candidates: (1) **existing Bun
sidecar HTTP route** — add a `GET /resources/:file` handler to the sidecar's
`HttpRouter`, reusing the live listener; this is the most direct path but inherits
the sidecar's current `allowedOrigins: ["*"]` CORS posture (`server/main.ts:55-60`),
which must be tightened before bearer-PDF capability URLs ride the same listener.
(2) **custom URI-scheme protocol** (`register_uri_scheme_protocol` / async variant)
— the handler returns `Result<HttpResponse,…>` and *can set Cache-Control and
return 404* before fs access (https://deepwiki.com/tauri-apps/wry/4.1-custom-protocols,
https://docs.rs/tauri/latest/tauri/struct.Builder.html); (3) **asset protocol +
`convertFileSrc`** is wrong tool — it exposes filesystem-path scopes, no TTL/opaque
indirection, no per-response headers
(https://v2.tauri.app/security/asset-protocol/); (4) **`tauri-plugin-localhost`**
hosts a *second* real listener but Tauri's docs warn it "brings considerable
security risks…use the default custom protocol implementation"
(https://v2.tauri.app/plugin/localhost/).

**Porting-source licenses.** `john-walkoe/uspto_pfw_mcp` (`SecureLinkCache`,
Fernet/SQLite/DPAPI) is **MIT** (verified via `gh api .../license`) — the
link-cache half is portable. The `patents-mcp-server` `src/resources/routes.ts`
edge-route nugget could **not** have its upstream repo identity or license
confirmed (candidate repos are Python FastMCP, no TS `resources/routes.ts`); the
route is generic Express middleware fully captured in the nugget, so re-porting
from source is unnecessary, but treat that file's license as **UNVERIFIED →
reimplement from the pattern, do not copy**.

## In-Repo Capability Inventory

Already present to compose against (verified via `rg`/`ls`, 2026-06-29):

- **Origin-fetch verb already exists** — `@beep/uspto`
  (`packages/drivers/uspto/src/Uspto.service.ts`): `downloadDocument(downloadUrl:
  string) => Effect<Uint8Array, UsptoError>` (line 47/281) and `getDocuments`
  (line 65/322); the API key is held server-side as
  `O.Option<Redacted.Redacted<string>>` and injected via header
  (`Redacted.value(key)`, line 253). The document ref carries an optional
  `downloadUrl: S.optionalKey(S.String)`
  (`packages/drivers/uspto/src/Uspto.models.ts:215`). This is the first concrete
  origin to gate; the gating pattern is provider-agnostic. **Crucially, the existing
  capability is fail-closed SSRF-guarded** (Codex gate-1): `downloadDocument` calls
  `assertAllowedRemoteUrl(downloadUrl, …)` before any request
  (`Uspto.service.ts:9,285`) and enforces same-USPTO-host so the credential cannot
  leak to an arbitrary host; the same `@beep/schema` guard
  (`packages/foundation/modeling/schema/src/SafeRemoteHost.ts:366-415`, DNS caveats
  at `:13-31`) is reused by `@beep/box`
  (`packages/drivers/box/src/Box.streaming.ts:670`). A provider-agnostic proxy must
  preserve this — store provider document *references* or provider-owned fetch
  closures, NOT raw origin URLs that a later generic fetch path dereferences without
  the driver guard.
- **An in-repo AES-256-GCM seal/unseal precedent already exists** — the strongest
  reusable brick:
  `packages/tooling/library/ai-metrics/src/archive.ts` encrypts payloads with
  `globalThis.crypto.subtle` `AES-GCM` (`importKey` raw, line 160; `encrypt`
  line 287; `decrypt` line 380), a random 12-byte nonce via
  `crypto.getRandomValues` (line 172-174), stores `{ nonceBase64, … }` as a
  Schema model (line 65), and holds the key as a **`Redacted` base64 32-byte
  `AiMetricsRawArchiveKey` = `S.RedactedFromValue`** (line 103-118), unwrapped
  via `Redacted.value` + `Encoding.decodeBase64`. This is exactly the
  "encrypt-a-small-payload-with-a-server-held-Redacted-key" half of
  `SecureLinkCache`, idiomatic and in-repo — the Fernet analog should follow this,
  not a new dependency.
- **An in-repo forwarding-proxy-with-TTL precedent exists** — the CLI Graphiti
  proxy: `packages/tooling/tool/cli/src/commands/Graphiti/internal/ProxyServices.ts`
  forwards responses with concurrency-slot accounting (`settleForwardedResponse`,
  line 635) and a `dependencyHealthTtlMs` cache check (line 704), with a dedicated
  security test (`packages/tooling/tool/cli/test/graphiti-proxy-security.test.ts`)
  exercising header forwarding and content-length bounding. Pattern reference for
  a bounded, TTL-aware edge.
- **HTTP route / response shapes are idiomatic** — `HttpApiEndpoint` from
  `effect/unstable/httpapi` is used by `@beep/govinfo`
  (`packages/drivers/govinfo/src/domain/contracts/Search/Search.http.ts:4`);
  `HttpServerResponse` server precedents live in `@beep/observability`
  (`packages/foundation/capability/observability/src/server/HttpApiTelemetry.ts`,
  `Prometheus.ts`). A schema-validated path-param route with a branded strict-UUID
  decode → typed 404 + `Cache-Control` response is well-supported.
- **Backing link store is repo-native; target the desktop's actual PGlite
  runtime** (2026-07-14 correction) — the professional-desktop sidecar consumes
  catalog `@electric-sql/pglite` **`0.5.4`** (`package.json:47`,
  `apps/professional-desktop/package.json:86`) and retains `0.4.6` only through
  the `@electric-sql/pglite-legacy-046` alias. The sidecar already owns a
  file-backed runtime — `makeBundledPgliteLayer` + `PgliteDrizzleLive`
  (`apps/professional-desktop/src/runtime/Pglite.ts:252-279`) over the `@beep/pglite`
  driver — with a bundled migration set applied on boot
  (`apps/professional-desktop/src/runtime/Migrations.ts`). The link-store table
  should be a Drizzle table added to that existing `PgliteDrizzleLive` + migration
  bundle, or a separate store chosen with an explicit migration/storage-compat
  rationale — not a bespoke SQLite file and not a second PGlite store.
  `@effect/sql` driver packages (`packages/drivers/pglite`, `packages/drivers/postgres`)
  and `drizzle-orm` (`package.json:156`) back this; table-modeling precedent:
  `EntityTable.models.ts` (`packages/drivers/drizzle/src/index.ts`),
  `EntityId` (`packages/shared/domain/src/entity/EntityId.ts`), and the `$I` identity
  composer (`packages/foundation/modeling/identity/src/Id.ts`).
- **Crypto/id primitives present, including repo-native UUID modeling** —
  `@noble/hashes@^2.2.0` (HMAC-SHA256/BLAKE2b, `package.json:77`) and `uuid@^14.0.1`
  (`package.json:230`, catalog-pinned, v4 via `crypto.getRandomValues` CSPRNG). Do
  not start from the raw `uuid` package alone (Codex gate-1): `@beep/schema` already
  exports a branded `UUID` string schema
  (`packages/foundation/modeling/schema/src/String.ts:16-39`, via `S.isUUID()`) and
  a `Model.UuidV4Insert` / `Model.UuidV4WithGenerate` v4 insert helper
  (`packages/foundation/modeling/schema/src/Model/Model.uuid.ts:71-96`, exported at
  `Model/index.ts:34`). Note `S.isUUID()` validates *general* RFC 4122, not
  strict-v4 — derive a named `StrictUuidV4PdfBasename` schema from `String.UUID`
  only if the route must reject non-v4 UUIDs and enforce the `.pdf` suffix in one
  decoded path-param model, documenting why the general schema is insufficient.
- **`Redacted` is a repo-wide idiom** — used in `@beep/uspto`, `@beep/sanity`
  (`packages/drivers/sanity/src/Sanity.{service,config,errors}.ts`), and the
  ai-metrics archive key. The "key never lands in logs" guard is established.
- **Generic HTTP header schema kit** — `@beep/schema`
  `packages/foundation/modeling/schema/src/Http/Http.headers.shared.ts` (header
  name normalization helpers). Useful substrate, but see gap below.
- **Desktop sidecar exposes BOTH an HTTP and an IPC transport** (Codex gate-1
  correction — it is not IPC-only) — `apps/professional-desktop/server/main.ts`
  selects transport by `CHAT_TRANSPORT` (default `http`): the `http` path serves
  `RpcServer.layerProtocolHttp({ path: "/rpc" })` on loopback `:3939` with permissive
  CORS (`main.ts:51-68`); the `ipc` path streams ndjson rpc frames over stdout,
  guarded by `server/IpcStdoutGuard.{prelude.ts,ts}` and bridged to the webview by
  `src/transport/{TauriIpcSocket.ts,IpcChatClient.ts}`. Either channel can host a
  gated serve; the HTTP listener is already live and CSP-/proxy-wired.
- **An OS-backed secret-persistence precedent already exists** (Codex gate-1) —
  `@beep/m365` is not just a comment: `packages/drivers/m365/src/M365.auth.ts:124-146`
  implements `buildCachePlugin`, which dynamically imports `@azure/msal-node-extensions`
  (installed `5.3.0`, MIT — `node_modules/@azure/msal-node-extensions/package.json:2-8`),
  calls `PersistenceCreator.createPersistence` with
  `dataProtectionScope: Ext.DataProtectionScope.CurrentUser`, `serviceName: "beep-m365"`,
  and `usePlaintextFileOnLinux: false`. This is a concrete DPAPI/Keychain/libsecret
  at-rest precedent to inventory before reaching for a Tauri keyring plugin — shape
  should decide whether to extract a small service around it (Bun/Node side) or
  choose a Tauri/Rust keyring with a stated reason.

### Gaps (NOT FOUND)

- **NO document/resource route on the desktop** (Codex gate-1 correction — the HTTP
  edge itself already exists; see the sidecar bullet above). The Bun sidecar serves
  only the `/rpc` group; there is no `GET /resources/:file` document route.
  Separately, no *Tauri-native* serve boundary is registered:
  `apps/professional-desktop/src-tauri/Cargo.toml` declares only
  `tauri-plugin-{log,shell,updater}` (lines 20-22); no `tauri-plugin-localhost`, no
  `register_uri_scheme_protocol`, no asset-protocol handler. The serve route is
  net-new, but it can extend the existing sidecar `HttpRouter` rather than stand up
  a new edge.
- **NO `@noble/ciphers` dependency.** NOT FOUND in any `package.json` — an AEAD
  (XChaCha20-Poly1305) sealed-token would require adding it, *or* reuse the
  existing WebCrypto `AES-256-GCM` archive pattern instead (preferred — no new dep).
- **NO *generic* keyring/keychain/DPAPI service abstraction.** NOT FOUND — there is
  no reusable in-repo keyring service. (Codex gate-1 correction: this is *not* merely
  a comment in `@beep/m365` — that package has executable OS-backed secret
  persistence; see the M365 precedent brick above.) A generic key-storage service and
  at-rest master-key wrapping (whether reusing the M365
  `@azure/msal-node-extensions` path in the Bun sidecar or a Tauri/Rust
  `tauri-plugin-keyring` path) is net-new.
- **NO Fernet/Branca/PASETO/XChaCha20 token implementation.** NOT FOUND. The
  encrypted opaque-link store (`SecureLinkCache` analog) is net-new (build on the
  archive.ts AES-GCM + Redacted pattern).
- **NO opaque-link / TTL link-store table or service.** NOT FOUND — no
  `id → enc_payload, expires_at, revoked_at` table or mint/lookup/revoke service
  exists.
- **NO first-class `Cache-Control` response-header builder.** NOT FOUND — only the
  generic header-name kit above; `private, no-store` must be set explicitly on the
  response.
- **NO `m365-document-ingest` goal directory.** NOT FOUND — referenced in
  `goals/m365-driver/SPEC.md` Non-Goals but no such packet was inventoried;
  confirm it does not later claim a serve-route.

## Constraints

**Routing decision (provisional, from edge-route subtopic) — STAND ALONE.** The
secure-download proxy should be its own thin, provider-agnostic capability packet,
not attached: (a) `goals/m365-driver/SPEC.md` is a *read-only Graph driver* that
explicitly defers delivery ("No document-portal ingest wiring…that is the
`m365-document-ingest` follow-on"); (b) `goals/file-processing-capability/SPEC.md`
is an *extraction substrate* with zero download/serve scope; (c) burying the gate
inside `@beep/uspto` would couple a cross-cutting delivery concern to one origin
and violate the driver-boundary rule (a driver wraps an external API; it does not
own a desktop serve route); (d) `apps/professional-desktop` is the *wiring host*
(register the protocol/IPC verb) but not the home for the reusable mint+gate logic.

**Licensing gravity.**
- `john-walkoe/uspto_pfw_mcp` `SecureLinkCache` — **MIT (verified)**: portable,
  may port the structure.
- `patents-mcp-server` `src/resources/routes.ts` edge route — **license/source
  UNVERIFIED**: reimplement from the captured pattern (generic Express
  middleware), **do not copy** the file.
- New runtime deps to weigh: `iron-webcrypto` (MIT), `@noble/ciphers` (MIT),
  `jose` (MIT) — all MIT, none AGPL/commercial; preferred default is **no new dep**
  (reuse the in-repo WebCrypto AES-256-GCM seal).
- **Key-storage dependency, if the Tauri path is chosen** (Codex gate-1): the repo
  does *not* currently depend on `tauri-plugin-keyring` (confirmed absent via
  `rg "tauri-plugin-keyring|keyring-core"` over `apps packages package.json bun.lock`;
  `src-tauri/Cargo.toml:19-22` lists only `tauri`, `tauri-plugin-{log,shell,updater}`).
  Adopting it adds a new Rust/Tauri dependency with its own license, maintenance,
  per-platform, and transitive crate surface (the `keyring` crate path) that must be
  vetted. The lower-friction alternative is the already-installed M365
  `@azure/msal-node-extensions` (MIT, `5.3.0`) precedent for the Bun-sidecar side.

**Deprecations / dates.**
- **Tauri Stronghold — deprecated, slated for removal in Tauri v3** (do not adopt;
  use OS keyring instead).
- `branca@0.5.0` last published **2022-04-27** (stale ~4y) — do not vendor.
- `paseto@3.1.4` last published **2023-04-27** (stale) — do not vendor.
- (For contrast, maintained: `iron-webcrypto@2.0.0` 2025-11-25,
  `@noble/ciphers@2.2.0` 2026-04-11, `jose@6.2.3` 2026-04.)

**Auth / secret / offline boundaries (locked by the threat model).**
- Server-side-only key custody: the encryption key + real app/document ids live in
  the sidecar; the LLM/agent and renderer receive **only** the opaque
  `…/<uuid>.pdf` URL. Guard the key with `Redacted` (no key in logs/traces).
- No business identifiers or PII in the URL (W3C TAG); the UUID is the only
  basename, gating `.pdf` + strict-v4 *before* fs access.
- `Cache-Control: private, no-store` on every served response (RFC 9111); 404 on
  expired/missing (existence opacity).
- TTL is consumer-supplied and purpose-bound under a packet-owned maximum; the
  upstream seven-day default is **not inherited**. Expiry is enforced *both* by store query
  (`expires_at > now AND revoked_at IS NULL`) and by the edge 404; revocation =
  set `revoked_at` (the opaque-token advantage).
- Local-first / offline: keep the link store in the **sidecar process**, not the
  renderer (IDB/Dexie in the renderer would contradict "key/server-side").

**Routing / boundary cautions.**
- The Express `GET /resources/:file` does **not** map 1:1. Extend the existing
  authenticated loopback Bun HTTP edge with a document route separate from RPC
  CORS. Custom protocol remains fallback only. **Spike needed:** whether each platform webview
  (WKWebView / WebView2 / WebKitGTK) honors `no-store`/BFCache suppression for
  *custom-scheme* responses is UNVERIFIED against a primary per-platform source.
- **Preserve the SSRF guard** (Codex gate-1) — the existing origin-fetch verb is
  fail-closed via `@beep/schema` `assertAllowedRemoteUrl` + provider same-host check
  (`Uspto.service.ts:285`). The proxy must store provider document refs or
  provider-owned fetch closures and reuse `assertAllowedRemoteUrl`, never persist raw
  URLs that a generic fetch later dereferences unguarded.
- The strict-UUID regex is a pre-filter, not authorization — back it with a branded
  `Schema` decode *and* the store lookup; never let the regex stand alone.
- `iron-webcrypto` PBKDF2 iterations default to 1 — acceptable only with a
  high-entropy 32+ byte server key; never feed it a low-entropy secret.
- `uuid@14` v4 relies on a CSPRNG (`crypto.getRandomValues`); confirm the sidecar
  runtime provides one, or mint the id from `crypto.randomUUID()` / a 32-byte
  `getRandomValues` — UNVERIFIED for the exact Bun-sidecar runtime.
- Tauri desktop runtime assumed (vs Electron/Next) for the OS-keyring
  recommendation — UNVERIFIED in this pass; `apps/professional-desktop/src-tauri`
  exists, so Tauri is likely, but confirm before locking the keyring path.

---

_Codex gate-1 folded 2026-06-29: 3 blocking + 4 advisory addressed._
