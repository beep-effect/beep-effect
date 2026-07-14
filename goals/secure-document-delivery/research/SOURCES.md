# Secure Document Delivery — Sources & Provenance

- **Source exploration:** `explorations/secure-document-download-proxy`.
- **Primary ledger:**
  `explorations/secure-document-download-proxy/research/SOURCES.md`.
- **Research amendment:**
  `explorations/secure-document-download-proxy/RESEARCH.md#2026-07-14-amendment--live-desktop-runtime-and-ratified-boundaries`.

This implementation ledger reproduces the source corpus and the ratified
dispositions. The exploration ledger remains primary if details diverge.

## 1. Mined Source Corpus

| Source | Upstream | Location | Theme | Disposition |
| --- | --- | --- | --- | --- |
| `patents-mcp-server#11` | patents-mcp-server | `src/resources/routes.ts:17-36` | Strict-route, identical-404, private/no-store PDF contract | **Clean-room reference only**: the specific source identity/license is unverified; do not copy. |
| `uspto_pfw_mcp#11` | uspto_pfw_mcp | `src/patent_filewrapper_mcp/proxy/secure_link_cache.py:24-55` | Encrypted opaque mapping, TTL, server-held key | **Port structure with attribution** (MIT); do not port Fernet/SQLite/DPAPI literally or inherit its seven-day default. |

Take the gate ordering, opacity, revocable stateful mapping, and server-held-key
shape. Reimplement the document-specific envelope and route from repo-native
primitives and the ratified contract.

## 2. Upstream Repositories and Licenses

| Repo/package | License | Port discipline | What is usable |
| --- | --- | --- | --- |
| `patents-mcp-server` route source | UNVERIFIED for the cited file | Clean-room/reference only | Security requirements, never source code. |
| `uspto_pfw_mcp` | MIT verified in source exploration | Port-with-attribution | Opaque-id to encrypted-row lifecycle shape. |
| `@azure/msal-node-extensions` | MIT; already installed | Adapter candidate after packaged proof | Generic `IPersistence`/`PersistenceCreator`, not M365 coupling. |
| Tauri Stronghold | Deprecated for Tauri v3 | Reject | Nothing. |

## 3. External Research Sources

- RFC 9562 UUID format/randomness — https://www.rfc-editor.org/rfc/rfc9562.html
- RFC 9111 HTTP caching — https://www.rfc-editor.org/rfc/rfc9111.html
- W3C TAG capability-URL hygiene — https://www.w3.org/2001/tag/doc/capability-urls/
- Referrer policy guidance — https://web.dev/articles/referrer-best-practices
- Effect `Redacted` — https://effect.website/docs/data-types/redacted/
- Tauri asset protocol — https://v2.tauri.app/security/asset-protocol/
- Tauri localhost plugin warning — https://v2.tauri.app/plugin/localhost/
- Tauri Stronghold deprecation context — https://v2.tauri.app/plugin/stronghold/
- AWS presigned-URL practices — https://docs.aws.amazon.com/pdfs/prescriptive-guidance/latest/presigned-url-best-practices/presigned-url-best-practices.pdf
- Google Cloud signed URLs — https://docs.cloud.google.com/storage/docs/access-control/signed-urls

Additional Fernet/Branca/PASETO/JWE/keyring landscape URLs remain reproduced in
the primary exploration ledger; none authorizes a new dependency in this goal.

## 4. In-Repo Capability References

| Capability | Exact path | Disposition |
| --- | --- | --- |
| USPTO File-Wrapper download | `packages/drivers/uspto/src/Uspto.service.ts` — `UsptoShape.downloadDocument`, `Uspto.downloadDocument` | **REUSE** in provider adapter; never generic raw-URL fetch. |
| Box download stream | `packages/drivers/box/src/Box.streaming.ts` — `BoxByteStream`, `downloads.downloadFile`, `assertAllowedRemoteUrl` | **REUSE LATER** for gated Box origin. |
| Guarded remote URL precedent | `packages/foundation/modeling/schema/src/SafeRemoteHost.ts` | **REFERENCE**, but live use remains blocked by connect-time rebinding harness. |
| AES-256-GCM technique | `packages/tooling/library/ai-metrics/src/archive.ts` — `AiMetricsRawArchiveKey`, 96-bit nonce, WebCrypto encrypt/decrypt | **REUSE TECHNIQUE**; document codec/envelope is **NET-NEW**. |
| Generic OS persistence interface | `node_modules/@azure/msal-node-extensions/types/persistence/IPersistence.d.ts`, `PersistenceCreator.d.ts` | **ADAPT** behind **NET-NEW** `ServingKeyCustody`, packaged proof required. |
| Executable OS persistence precedent | `packages/drivers/m365/src/M365.auth.ts` | **REFERENCE ONLY**; do not import `@beep/m365`. |
| Authenticated loopback HTTP | `apps/professional-desktop/server/main.ts`, `RpcSessionAuth.ts` | **EXTEND** with isolated document route, Host/audience rules, and identical 404. |
| Desktop PGlite/Drizzle | `apps/professional-desktop/src/runtime/Pglite.ts` (`PgliteDrizzleLive`), `Migrations.ts`; root catalog PGlite 0.5.4 | **EXTEND**; mapping schema/migration is **NET-NEW**. |
| Product authorization adapters | `packages/law-practice/server`, `packages/documents/server` | **NET-NEW adapters**; product authorization/provenance remains here. |
| Delivery capability | `packages/foundation/capability/secure-document-delivery` | **NET-NEW, INCUBATED** until two real importers. |

## 5. Cross-Links and Provenance

- Source brief:
  `explorations/secure-document-download-proxy/BRIEF.md`.
- Ratified decisions and rejected options:
  `explorations/secure-document-download-proxy/DECISIONS.md`.
- Candidate fan-out and capability check:
  `explorations/secure-document-download-proxy/MAP.md`.
- Credential-crypto fence and guarded-fetch gate:
  `explorations/ingestion-security-secret-governance/MAP.md` and
  `DECISIONS.md`.
- First consumer authorization spine:
  `goals/law-docketing-patent-spine`.
- Codex research critique folded into the source packet:
  `explorations/secure-document-download-proxy/reviews/2026-06-29-codex-research.md`.
