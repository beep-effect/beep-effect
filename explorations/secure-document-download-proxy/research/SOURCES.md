# Secure Document Download Proxy — Sources & Provenance

Provenance ledger for this packet: it traces every porting decision back to the
mined gold nugget (with upstream repo + `file:line`), the upstream repo license,
the external research citation, and the in-repo `@beep/*` brick it composes. This
packet derives from the gold-intake cluster **"Secure document download proxy
(opaque TTL-gated links)"** (2 verified nuggets).

- **Cluster:** Secure document download proxy (opaque TTL-gated links)
- **Route:** `new-exploration` (primaryTarget `secure-document-download-proxy`, targetExists=false) · wave **P2** (P1=0, P2=2, P3=0) · themeSpan `[desktop-portal]`
- **Gold-intake provenance:**
  [`_gold-intake/ROUTING.md`](../../_gold-intake/ROUTING.md) ·
  [`_gold-intake/routing.json`](../../_gold-intake/routing.json) ·
  [`_gold-intake/GOLD_SYNTHESIS.md`](../../_gold-intake/GOLD_SYNTHESIS.md) §
  "Desktop & document portal" › "Secure local document fetch via opaque,
  expiring links" (GOLD_SYNTHESIS.md:1355)
- **Packet codex review:**
  [`reviews/2026-06-29-codex-research.md`](../reviews/2026-06-29-codex-research.md)
  (research gate-1: 3 blocking + 4 advisory, folded into RESEARCH.md)

---

## 1. Mined source corpus (gold nuggets)

| Nugget | Title | Upstream (repo) | Source (file:line) | Theme | Priority | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| `patents-mcp-server#11` | Edge-gated resource route with strict-UUID guard serving private, no-store PDFs | patents-mcp-server (T1) | `src/resources/routes.ts:17-36` | desktop-portal | P2 | **Clean-room reimplement from pattern** (upstream repo identity/license UNVERIFIED; nugget is generic Express middleware — do not copy the file) |
| `uspto_pfw_mcp#11` | Secure local download proxy with encrypted opaque links (Fernet/DPAPI) | uspto_pfw_mcp (T1) | `src/patent_filewrapper_mcp/proxy/secure_link_cache.py:24-55` | desktop-portal | P2 | **Port-with-attribution** (MIT, verified) — port the *structure* (opaque-id → encrypted store row, TTL auto-expiry, server-held key); reimplement the crypto on the in-repo AES-GCM brick, not a vendored token lib |

Both nuggets are `verified`, `recommendation: port`, `gapStatus: gap`, and
converge on the same self-contained capability. Both share the final beep target
"apps/professional-desktop sidecar secure resource route + @beep/uspto document
download proxy". This is a single-cluster packet (not a split), so there are no
sibling-shared nuggets.

### How these inform this packet

**Edge-gated serve route (`patents-mcp-server#11`).** *Take the security
contract, leave the transport.* The load-bearing pattern is the gate ordering:
validate the `.pdf` suffix and a strict v4 UUID *before any fs access*, stream
with `cache-control: private, no-store`, and 404 on expired/missing. The
upstream comment captures the model — "access control at the edge; UUID+TTL is
in-app defense-in-depth." The UUID-only basename removes every
attacker-controlled path component (structural anti-traversal), and the
identical 404 for expired-vs-never-existed is deliberate existence opacity.
Caveat carried into Constraints: the Express `GET /resources/:file` does **not**
map 1:1 to the desktop — implement it as a route on the existing Bun sidecar
`HttpRouter` (Q6 recommended) rather than copying middleware, and back the regex
pre-filter with a branded `Schema` decode plus a store lookup (the regex is a
pre-filter, never authorization).

**Encrypted opaque-link store (`uspto_pfw_mcp#11`).** *Take the
opaque-reference + TTL + server-held-key structure, leave Fernet/SQLite/DPAPI as
literal tech.* The contract is: store the real app/document ids encrypted in a
backing table, issue opaque non-business-revealing URLs, auto-expire, and keep the
API key server-side. The upstream seven-day default is historical source context
only and is **not inherited**. Port the shape onto repo-native bricks: the
in-repo AES-256-GCM + `Redacted` seal (Q5), the desktop PGlite/Drizzle store
(Q8), and the M365 OS-backed at-rest key wrapping (Q7) — not the Python Fernet
codec or a raw SQLite file. The hybrid both sources imply (opaque UUID in the
URL backed by an encrypted store row with `expires_at`/`revoked_at`) is the
recommended token model in Q4: it gives the 7-day TTL *and* instant revocation.

---

## 2. Upstream repositories & licenses

| Repo | Tier | License | Port discipline | What we take |
| --- | --- | --- | --- | --- |
| `patents-mcp-server` | T1 | MIT (bundle); **packet-local note: upstream repo identity/license for this specific `src/resources/routes.ts` file UNVERIFIED** | **Clean-room reimplement from the captured pattern — do not copy the file** | The edge-route security model: `.pdf` + strict-v4-UUID gate before fs access, `private, no-store` PDFs, 404-on-expired existence opacity |
| `uspto_pfw_mcp` | T1 | MIT (verified via `gh api .../license`) | **Port-with-attribution** (permissive) — structure may be ported with credit | `SecureLinkCache` shape: encrypted opaque-id → real-id store rows, configurable TTL auto-expiry (default 7d), server-held key, opaque non-revealing URLs |

> **Cautions (echoed from the source bundle):**
> - Pairs with `@beep/uspto` File-Wrapper download + the desktop portal; **keep
>   keys server-side (no key on the desktop renderer/LLM)**.
> - **P2** — depends on the uspto driver depth + desktop sidecar.
>
> **License nuance (from RESEARCH.md "Porting-source licenses").** The
> `uspto_pfw_mcp` `SecureLinkCache` half is confirmed MIT and portable. The
> `patents-mcp-server` `src/resources/routes.ts` edge-route nugget could **not**
> have its upstream repo identity or license confirmed during research (candidate
> repos are Python FastMCP with no TS `resources/routes.ts`); the route is
> generic Express middleware fully captured in the nugget, so treat that file's
> license as **UNVERIFIED → reimplement from the pattern, do not copy**. The
> bundle records the cluster's `patents-mcp-server` tier as MIT; the packet-local
> verification note above is the binding instruction for this one file.

---

## 3. External research sources

External landscape citations actually present in this packet's
[`RESEARCH.md`](../RESEARCH.md) and the two `research/*.md` subtopic files
([`edge-gated-resource-route-and-stand-alone-vs-attach.md`](./edge-gated-resource-route-and-stand-alone-vs-attach.md),
[`opaque-ttl-link-token-cryptography.md`](./opaque-ttl-link-token-cryptography.md)):

**Standards / RFCs**
- UUID format (v4 version nibble + variant, 122 bits randomness), RFC 9562 — https://www.rfc-editor.org/rfc/rfc9562.html
- HTTP caching (`no-store` MUST-NOT-store, `private` shared-cache rule), RFC 9111 — https://www.rfc-editor.org/rfc/rfc9111.html
- `Cache-Control` reference (`no-store` ≠ `no-cache`, BFCache) — https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control
- W3C TAG capability-URL hygiene (unguessable id, no PII in URL, HMAC if hashing) — https://www.w3.org/2001/tag/doc/capability-urls/
- Referrer best practices (mitigate `Referer` leakage) — https://web.dev/articles/referrer-best-practices

**Token / crypto format landscape**
- Fernet spec (AES-128-CBC + HMAC-SHA256, TTL at decode, no key rotation) — https://github.com/fernet/spec/blob/master/Spec.md · https://cryptography.io/en/latest/fernet/
- Branca spec (XChaCha20-Poly1305, base62) — https://github.com/tuupola/branca-spec/blob/master/README.md
- PASETO v3/v4 rationale (no algorithm confusion) — https://github.com/paseto-standard/paseto-spec/blob/master/docs/Rationale-V3-V4.md
- JWT vs opaque tokens (alternatives to JWTs) — https://www.scottbrady.io/jose/alternatives-to-jwts · https://zitadel.com/blog/jwt-vs-opaque-tokens · https://nordicapis.com/jwt-vs-opaque-tokens-choosing-the-right-token-for-api-security/
- `iron-webcrypto` (WebCrypto-native, `ttl` + rotation support, PBKDF2-iterations=1 caveat) — https://github.com/brc-dd/iron-webcrypto/blob/main/README.md
- `jose` JWE (`dir`+`A256GCM`) — https://www.npmjs.com/package/jose
- `@noble/ciphers` (`xchacha20poly1305`, 0-dep, audited) — https://github.com/paulmillr/noble-ciphers/blob/main/README.md
- UUIDs designed for uniqueness not secrecy — https://fastuuid.com/learn-about-uuids/uuid-security/
- UUID validation: regex validates format, not authorization — https://www.dev-toolbox.tech/tools/regex-cheat-sheet/examples/regex-for-uuid-validation

**Signed-URL precedents**
- Google Cloud Storage signed URLs — https://docs.cloud.google.com/storage/docs/access-control/signed-urls
- AWS presigned-URL best practices — https://docs.aws.amazon.com/pdfs/prescriptive-guidance/latest/presigned-url-best-practices/presigned-url-best-practices.pdf

**Key custody / desktop boundary**
- Effect `Redacted` (in-process log guard) — https://effect.website/docs/data-types/redacted/
- Windows DPAPI `ProtectedData` (`CurrentUser`) — https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.protecteddata
- `tauri-plugin-keyring` (Keychain / Secret Service / Credential Manager) — https://github.com/charlesportwoodii/tauri-plugin-keyring
- Tauri Stronghold deprecated/being removed in v3 — https://v2.tauri.app/plugin/stronghold/

**Tauri serve-boundary options**
- Tauri custom protocols (wry) — https://deepwiki.com/tauri-apps/wry/4.1-custom-protocols · https://docs.rs/tauri/latest/tauri/struct.Builder.html
- Asset protocol + `convertFileSrc` (wrong tool — fs-path scopes, no per-response headers) — https://v2.tauri.app/security/asset-protocol/
- `tauri-plugin-localhost` (docs warn "considerable security risks") — https://v2.tauri.app/plugin/localhost/

---

## 4. In-repo capability references

`@beep/*` bricks this packet composes (from the bundle `secondaryTargets` and the
RESEARCH "In-Repo Capability Inventory"):

| Capability | Package / path | Status |
| --- | --- | --- |
| Origin-fetch verb + SSRF guard — `downloadDocument` returns `Effect<Uint8Array, UsptoError>`, key as `O.Option<Redacted.Redacted<string>>`, calls `assertAllowedRemoteUrl` before any request | `@beep/uspto` — `packages/drivers/uspto/src/Uspto.service.ts` (47/281, 65/322, 253, 285), `Uspto.models.ts:215` | **reuse** (first origin to gate; preserve the fail-closed same-host guard) |
| Shared SSRF guard reused across drivers | `@beep/schema` — `packages/foundation/modeling/schema/src/SafeRemoteHost.ts:366-415` (DNS caveats `:13-31`); also used by `@beep/box` `Box.streaming.ts:670` | **reuse** (store provider refs/closures, never raw URLs) |
| AES-256-GCM seal/unseal + `Redacted` key precedent — `crypto.subtle` `AES-GCM`, 12-byte nonce, `AiMetricsRawArchiveKey = S.RedactedFromValue` | `packages/tooling/library/ai-metrics/src/archive.ts` (importKey:160, encrypt:287, decrypt:380, nonce:172-174, key:103-118) | **reuse / extend** (the Fernet analog — encrypt the id-mapping, not the bytes) |
| Forwarding-proxy-with-TTL precedent (bounded, TTL-aware edge) | `packages/tooling/tool/cli/src/commands/Graphiti/internal/ProxyServices.ts` (635, 704) + security test | **reference** (pattern only) |
| Idiomatic HTTP route / response shapes — `HttpApiEndpoint`, `HttpServerResponse` | `@beep/govinfo` `Search.http.ts:4`; `@beep/observability` `server/HttpApiTelemetry.ts`, `Prometheus.ts` | **reuse** |
| Desktop PGlite/Drizzle runtime + boot migrations (live catalog `@electric-sql/pglite@0.5.4`; `0.4.6` is legacy alias only) | `apps/professional-desktop/src/runtime/Pglite.ts` (`PgliteDrizzleLive`), `Migrations.ts`; backed by `@beep/pglite`, `@effect/sql`, `drizzle-orm` | **extend** (add the mapping table to the existing migration bundle) |
| Table/id modeling bricks | `EntityTable.models.ts` (`packages/drivers/drizzle/`), `EntityId` (`packages/shared/domain/src/entity/EntityId.ts`), `$I` composer (`packages/foundation/modeling/identity/src/Id.ts`) | **reuse** |
| Branded UUID + v4 insert helper | `@beep/schema` — `String.ts:16-39` (branded `UUID` via `S.isUUID()`), `Model/Model.uuid.ts:71-96` (`Model.UuidV4Insert`/`WithGenerate`) | **reuse / extend** (derive `StrictUuidV4PdfBasename` only if strict-v4 + `.pdf` decode needed) |
| `Redacted` repo-wide idiom (key never in logs/traces/URL) | `@beep/uspto`, `@beep/sanity` (`Sanity.{service,config,errors}.ts`), ai-metrics archive key | **reuse** |
| Generic OS-backed persistence interface and executable precedent — `IPersistence`, `PersistenceCreator`, `DataProtectionScope.CurrentUser`, `usePlaintextFileOnLinux:false` | `node_modules/@azure/msal-node-extensions/types/persistence/{IPersistence,PersistenceCreator}.d.ts`; `packages/drivers/m365/src/M365.auth.ts` | **adapt behind NET-NEW `ServingKeyCustody`** (no `@beep/m365` import; packaged proof required) |
| Per-launch authenticated loopback HTTP edge | `apps/professional-desktop/server/main.ts` (`RpcServer.layerProtocolHttp`, Bun hostname `127.0.0.1`); `server/RpcSessionAuth.ts` | **extend** with a document route separate from RPC CORS plus Host/audience and identical-404 policy |
| Generic HTTP header schema kit | `@beep/schema` — `Http/Http.headers.shared.ts` | **reference** (substrate; no first-class `Cache-Control` builder — NET-NEW) |

**NET-NEW (no in-repo brick — see RESEARCH "Gaps (NOT FOUND)"):**
- The document/resource serve route (`GET /resources/:file`) — extends the existing sidecar `HttpRouter`, but the route itself is net-new.
- The encrypted opaque-link store table + mint/lookup/revoke service (`id → enc_payload, expires_at, revoked_at`).
- A first-class `Cache-Control: private, no-store` response-header builder.
- A document-specific `ServingKeyCustody` port (the installed generic
  `IPersistence` interface is an adapter candidate, not the capability contract).
- The token/seal codec itself (no Fernet/Branca/PASETO/XChaCha20 impl — build on the archive.ts AES-GCM + `Redacted` pattern; `@noble/ciphers` is absent).

---

## 5. Cross-links & provenance

- **Cluster id:** Secure document download proxy (opaque TTL-gated links) ·
  bundle `route: new-exploration`, `wave: P2`, `themeSpan: [desktop-portal]`.
  The bundle records **no crossref** entries — this is a self-contained
  new-exploration packet (no sibling packets, `alreadyCovered: []`).
- **Gold-intake source:**
  [`_gold-intake/GOLD_SYNTHESIS.md`](../../_gold-intake/GOLD_SYNTHESIS.md) §
  "Secure local document fetch via opaque, expiring links" (line 1355);
  routing in [`_gold-intake/ROUTING.md`](../../_gold-intake/ROUTING.md) and
  [`_gold-intake/routing.json`](../../_gold-intake/routing.json).
- **Packet artifacts:** [`CAPTURE.md`](../CAPTURE.md) (gold-intake seed) ·
  [`RESEARCH.md`](../RESEARCH.md) (External Landscape + In-Repo Inventory +
  Constraints, Codex gate-1 folded) · [`DECISIONS.md`](../DECISIONS.md) (Q1-Q8
  pre-drafted, open for `/grill-with-docs`) ·
  [`README.md`](../README.md) (Next Open Question = Q6).
- **Research subtopics:**
  [`research/edge-gated-resource-route-and-stand-alone-vs-attach.md`](./edge-gated-resource-route-and-stand-alone-vs-attach.md)
  · [`research/opaque-ttl-link-token-cryptography.md`](./opaque-ttl-link-token-cryptography.md).
- **Codex review:**
  [`reviews/2026-06-29-codex-research.md`](../reviews/2026-06-29-codex-research.md).
- **Secondary wiring targets (from bundle):** `apps/professional-desktop`
  (serve route + PGlite store binding host) and `packages/drivers/uspto` (first
  origin gated). Provider-agnostic mint/gate/seal logic is recommended to live
  in a new capability package, not in either target (DECISIONS Q1-Q2).
