# Codex research-gate critique — secure-document-download-proxy (2026-06-29)

## Blocking

1. "**NO HTTP edge / custom URI-scheme protocol on the desktop.** NOT FOUND — `apps/professional-desktop/src-tauri/Cargo.toml` declares only `tauri-plugin-{log,shell,updater}` (lines 20-22); no `tauri-plugin-localhost`, no `register_uri_scheme_protocol`, no asset-protocol handler. The edge boundary is net-new (custom-protocol or IPC verb)."

   This is false as written. It is true that no Tauri custom protocol or `tauri-plugin-localhost` is registered, but the desktop already has a Bun sidecar HTTP edge. The current sidecar defaults to HTTP, serves `RpcServer.layerProtocolHttp({ path: "/rpc" })`, and is launched by Tauri with `CHAT_TRANSPORT=http` unless IPC is selected. The research therefore omits the most direct existing approach: extend the existing sidecar `HttpRouter` with a document route, or deliberately reject that option because of its security tradeoffs.

   Repo evidence: `apps/professional-desktop/server/main.ts:9-13` documents default `http` transport on loopback `:3939`; `apps/professional-desktop/server/main.ts:51-68` builds `RpcServer.layerProtocolHttp`, permissive CORS, and `BunHttpServer.layer({ port: PORT })`; `apps/professional-desktop/src-tauri/src/lib.rs:445-448` sets `CHAT_TRANSPORT` to `http` when not IPC; `apps/professional-desktop/src-tauri/tauri.conf.json:23` already permits `http://127.0.0.1:3939` in CSP; `apps/professional-desktop/vite.config.ts:39-44` proxies `/rpc` to that loopback sidecar.

   Concrete fix: change the gap to "no document/resource route exists" rather than "no HTTP edge exists". Add a fourth boundary option: existing Bun sidecar HTTP route. If that option is rejected, say why, and carry forward the existing `allowedOrigins: ["*"]` CORS risk before putting bearer PDF capability URLs behind the same listener.

2. "**NO keyring/keychain/DPAPI service abstraction.** NOT FOUND — the only brush with OS secret storage is a *comment* in `@beep/m365` (`packages/drivers/m365/src/M365.auth.ts:7`) noting the MSAL token cache is optionally encrypted via `@azure/msal-node-extensions` (\"DPAPI / Keychain / libsecret\"); there is no reusable in-repo keyring service. At-rest master-key wrapping (DPAPI / `tauri-plugin-keyring`) is net-new."

   The "only brush is a comment" part is wrong, and that makes the gap inventory too coarse. `@beep/m365` has executable code that dynamically imports `@azure/msal-node-extensions`, creates a persistence cache, sets `DataProtectionScope.CurrentUser`, and disables plaintext Linux storage. The absence of a reusable service abstraction is real, but the repo already has a concrete OS-backed secret persistence precedent that should be inventoried before recommending a Tauri keyring plugin.

   Repo evidence: `packages/drivers/m365/src/M365.auth.ts:124-146` implements `buildCachePlugin`; lines `129-141` import `@azure/msal-node-extensions`, call `PersistenceCreator.createPersistence`, set `dataProtectionScope: Ext.DataProtectionScope.CurrentUser`, `serviceName: "beep-m365"`, and `usePlaintextFileOnLinux: false`. The package is already cataloged in `package.json:6`, and local metadata shows `node_modules/@azure/msal-node-extensions/package.json:2-8` is `@azure/msal-node-extensions` `5.3.0`, MIT.

   Concrete fix: split the finding into "no generic keyring service" and "existing M365 encrypted token-cache precedent". Shape should decide whether to extract a small repo service around that precedent, use it directly where the sidecar is Node/Bun-compatible, or choose a Tauri/Rust keyring path with a stated reason.

3. "**Backing link store is repo-native** — `@electric-sql/pglite@0.5.3` is a root dependency (`package.json:44`); `@effect/sql` driver packages exist at `packages/drivers/pglite` and `packages/drivers/postgres`; `drizzle-orm` is in the catalog (`package.json:156`). Table-modeling precedent: `EntityTable.models.ts` (`packages/drivers/drizzle/src/EntityTable.models.ts`), `EntityId` (`packages/shared/domain/src/entity/EntityId.ts`), and the `$I` identity composer (`packages/foundation/modeling/identity/src/Id.ts`). The link store can be a normal Effect `@effect/sql` table, not a bespoke SQLite file."

   The general repo-native direction is right, but the version and runtime target are incomplete for this desktop packet. The professional desktop sidecar does not simply consume the root catalog's `@electric-sql/pglite@0.5.3`; the app pins `@electric-sql/pglite` `0.4.6`, keeps a `legacy-053` alias, and imports bundled PGlite assets from `node_modules/@electric-sql/pglite`. It also already owns a file-backed `PgliteDrizzleLive` layer and migration bundle. Treating the link store as an abstract new `@effect/sql` table misses the concrete app-local storage and migration path that implementation must use or intentionally avoid.

   Repo evidence: root `package.json:44` says `@electric-sql/pglite` `0.5.3`, but `apps/professional-desktop/package.json:68-69` pins `@electric-sql/pglite` `0.4.6` plus `@electric-sql/pglite-legacy-053`; `bun.lock:2629-2631` resolves both `0.4.6` and `0.5.3`; `node_modules/@electric-sql/pglite/package.json:2-3` reports installed `0.4.6`. `apps/professional-desktop/src/runtime/Pglite.ts:4-13` says this is the in-process PGlite database for the desktop sidecar; `apps/professional-desktop/src/runtime/Pglite.ts:252-279` builds `makeBundledPgliteLayer` and `PgliteDrizzleLive`; `apps/professional-desktop/src/runtime/Migrations.ts:47-165` contains the bundled migration SQL.

   Concrete fix: revise the store recommendation to target the existing professional-desktop `PgliteDrizzleLive` plus migration bundle, or explicitly choose a separate store with a migration/storage-compatibility rationale. Do not cite only root `@electric-sql/pglite@0.5.3` as the effective desktop runtime.

## Advisory

1. "**Key custody & desktop boundary.** Server-side key never reaches the desktop/LLM; Effect `Redacted` is the in-process guard (logs print `<redacted>`, `Redacted.value` is the explicit unwrap)."

   The trust-boundary language is technically imprecise for this repo. The sidecar is a desktop process launched by the Tauri shell, so the key necessarily reaches "the desktop" if it lives in the sidecar. The real boundary is renderer/LLM/tooling versus privileged sidecar process plus OS key storage. Leaving the phrase as-is will confuse implementation and threat modeling.

   Repo evidence: `apps/professional-desktop/src-tauri/src/lib.rs:420-451` spawns the bundled `sidecar` process and injects `CHAT_DB_PATH`, `CHAT_AGENT`, `CHAT_TRANSPORT`, and sometimes `AI_ANTHROPIC_API_KEY`; `apps/professional-desktop/server/main.ts:1-17` identifies that Bun process as the desktop sidecar and describes HTTP/IPC transports; `apps/professional-desktop/src/transport/TauriIpcSocket.ts:3-11` frames IPC as a bridge between the webview and sidecar.

   Concrete fix: rewrite this as "the key never reaches the renderer, LLM, logs, or URL; it is held only in the privileged sidecar process and wrapped at rest by OS-backed storage."

2. "**Origin-fetch verb already exists** — `@beep/uspto` (`packages/drivers/uspto/src/Uspto.service.ts`): `downloadDocument(downloadUrl: string) => Effect<Uint8Array, UsptoError>` (line 47/281) and `getDocuments` (line 65/322); the API key is held server-side as `O.Option<Redacted.Redacted<string>>` and injected via header (`Redacted.value(key)`, line 253)."

   This is sound but underspecified for a security research gate. The important existing capability is not just "download bytes"; it is the fail-closed SSRF and credential-leak guard around caller-supplied `downloadUrl`. A provider-agnostic proxy that stores arbitrary origin URLs must preserve this pattern, or it can accidentally bypass the protection already present in the driver.

   Repo evidence: `packages/drivers/uspto/src/Uspto.service.ts:281-291` calls `assertAllowedRemoteUrl` before any request and enforces same-USPTO-host so the credential cannot leak to arbitrary hosts; `packages/foundation/modeling/schema/src/SafeRemoteHost.ts:1-31` documents the shared SSRF guard and its DNS caveats; `packages/foundation/modeling/schema/src/SafeRemoteHost.ts:366-415` exports `assertAllowedRemoteUrl`; `packages/drivers/box/src/Box.streaming.ts:654-670` shows another driver using the same guard with DNS resolution.

   Concrete fix: add `@beep/schema` `SafeRemoteHost.assertAllowedRemoteUrl` and provider same-origin checks to the capability inventory and constraints. The secure proxy should store provider document references or provider-owned fetch closures, not raw URLs that a generic fetch path later dereferences without the driver guard.

3. "**Crypto/id primitives present** — `@noble/hashes@^2.2.0` (HMAC-SHA256/BLAKE2b, `package.json:77`) and `uuid@^14.0.1` (`package.json:230`, catalog-pinned). v4 via `crypto.getRandomValues` (CSPRNG)."

   (Update 2026-10-20: the repository no longer uses the `uuid` package. Random UUIDs come from the `effect/crypto/SecureRandom` service's `uuidV4`, name-based ids are built on the `effect/crypto/Digest` service's `digest`, and the root and effect-ontology biome configs reject `uuid` imports.)

   This misses repo-native UUID modeling. At review time the repo exported a branded UUID string schema and a UUID-v4 insert helper under `@beep/schema`, so the next step should not have started from the raw `uuid` package alone. If the URL guard truly requires *strict v4 string* validation, derive a named strict-v4 schema and document why the general UUID schema is insufficient.

   Repo evidence at review time: `@beep/schema` `String.ts` exported a branded `UUID` using `S.isUUID()` (retired for upstream `effect/Schema` in #1343), and the `Model.uuid.ts` helpers, which imported `uuid` and generated v4 bytes by default, were deleted in #720.

   Concrete fix: validate with upstream `effect/Schema` `S.isUUID()`, or `S.isUUID(4)` for strict v4, and mint ids with the `effect/crypto/SecureRandom` service's `uuidV4`. Add a separate `StrictUuidV4PdfBasename` schema only if the route must reject non-v4 UUIDs and enforce the `.pdf` suffix in one decoded path-param model.

4. "Cross-platform analog for a Tauri desktop is the OS keyring via `tauri-plugin-keyring` (macOS Keychain / Linux Secret Service / Windows Credential Manager)."

   The licensing section omits the Rust/Tauri dependency it recommends. The repo does not currently depend on `tauri-plugin-keyring`, so adopting it would be a new dependency with its own license, maintenance, platform, and transitive crate surface. The research flags licenses for JS crypto options but not for the keyring plugin path.

   Repo evidence: `apps/professional-desktop/src-tauri/Cargo.toml:19-22` lists only `tauri`, `tauri-plugin-log`, `tauri-plugin-shell`, and `tauri-plugin-updater`; `rg "tauri-plugin-keyring|keyring-core" apps packages package.json bun.lock` returned no repo dependency; `RESEARCH.md:230-232` lists only `iron-webcrypto`, `@noble/ciphers`, and `jose` under "New runtime deps to weigh".

   Concrete fix: add a license/maintenance check for `tauri-plugin-keyring` and its transitive keyring crate path, or make the M365 `@azure/msal-node-extensions` precedent the default key-storage candidate for the Bun sidecar.

## Confirmed sound

1. "**An in-repo AES-256-GCM seal/unseal precedent already exists** — the strongest reusable brick: `packages/tooling/library/ai-metrics/src/archive.ts` encrypts payloads with `globalThis.crypto.subtle` `AES-GCM`..."

   Confirmed. Repo evidence: `packages/tooling/library/ai-metrics/src/archive.ts:115-117` defines `AiMetricsRawArchiveKey` as `S.RedactedFromValue`; `archive.ts:143-160` unwraps and imports the raw key for `AES-GCM`; `archive.ts:173` uses `crypto.getRandomValues`; `archive.ts:286-287` encrypts with `AES-GCM`; `archive.ts:380` decrypts with `AES-GCM`. This is a real local pattern to reuse before adding crypto dependencies.

2. "**NO `@noble/ciphers` dependency.** NOT FOUND in any `package.json` — an AEAD (XChaCha20-Poly1305) sealed-token would require adding it, or reuse the existing WebCrypto `AES-256-GCM` archive pattern instead (preferred — no new dep)."

   Confirmed. Repo evidence: `package.json:77` catalogs `@noble/hashes`, but `rg "@noble/ciphers" package.json bun.lock apps packages --glob "package.json"` produced no manifest dependency; `node_modules/@noble/ciphers` is absent. The "reuse AES-GCM first" recommendation is consistent with the local dependency surface.

3. "**NO first-class `Cache-Control` response-header builder.** NOT FOUND — only the generic header-name kit above; `private, no-store` must be set explicitly on the response."

   Confirmed. Repo evidence: `rg "CacheControl|Cache-Control|cache-control|no-store|private" packages/foundation/modeling/schema/src packages/foundation/capability/observability/src packages/drivers packages/agents apps/professional-desktop --glob "**/src/**/*.{ts,tsx}"` found only generic/private/security-context hits plus `packages/foundation/modeling/schema/src/Http/Http.headers.shared.ts:144` referencing `wrapArray("cache-control")`; no first-class `Cache-Control` builder exists.

4. "**NO `m365-document-ingest` goal directory.** NOT FOUND — referenced in `goals/m365-driver/SPEC.md` Non-Goals but no such packet was inventoried; confirm it does not later claim a serve-route."

   Confirmed. Repo evidence: `find goals -maxdepth 2 -type d -name m365-document-ingest -print` produced no directory; `goals/m365-driver/SPEC.md:26-27` names `m365-document-ingest` only as the deferred follow-on.

5. "**Already present to compose against (verified via `rg`/`ls`, 2026-06-29):**"

   Confirmed for the cited `@beep/*` package aliases and concrete inventory paths. Repo evidence: `rg -o "@beep/[A-Za-z0-9_-]+" RESEARCH.md | sort -u` yielded `@beep/govinfo`, `@beep/m365`, `@beep/observability`, `@beep/sanity`, `@beep/schema`, and `@beep/uspto`; package manifests exist at `packages/drivers/govinfo/package.json:2`, `packages/drivers/m365/package.json:2`, `packages/foundation/capability/observability/package.json:2`, `packages/drivers/sanity/package.json:2`, `packages/foundation/modeling/schema/package.json:2`, and `packages/drivers/uspto/package.json:2`. The cited Sanity files also exist as `packages/drivers/sanity/src/Sanity.config.ts`, `Sanity.errors.ts`, and `Sanity.service.ts`.
