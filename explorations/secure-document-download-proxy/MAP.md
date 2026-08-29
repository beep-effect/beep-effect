# Secure Document Delivery — Map

## Candidate Goal Packets

| Order | Slug | Mission | Depends on / gate | Capability disposition |
| --- | --- | --- | --- | --- |
| **FIRST — GRADUATES NOW** | [`secure-document-delivery`](../../goals/secure-document-delivery/README.md) | Deliver an incubated provider-neutral mint/resolve/revoke capability and the authenticated desktop route, proven by one authorized fixture-backed USPTO OA PDF. | Docketing approval-spine consumer edge; live fetch blocked by guarded-fetch rebinding harness. | Reuse the live bricks below; document envelope, lifecycle ports/store contract, route, and product adapters are **NET-NEW**. |
| GATED | `secure-document-box-origin` | Adapt an authorized Box document reference without moving intake authorization or provenance into delivery. | `goals/legal-document-intake`; first goal landed; two-importer promotion gate evaluated. | Reuse `packages/drivers/box/src/Box.streaming.ts`; adapter is **NET-NEW**. |
| GATED | `secure-document-viewer-integration` | Render delivered documents without weakening cache, session, revocation, or navigation rules. | Packaged-webview HTTP proof and a named product consumer. | Existing desktop UI is reusable; secure viewer/session integration is **NET-NEW**. |
| GATED | `secure-document-additional-origins` | Add separately authorized docketing/documents/time-tracking origins through provider-owned drivers. | Two real consumer pulls and guarded-fetch harness for every live remote origin. | Drivers may be reused; every origin adapter and consumer policy remains **NET-NEW** until named. |

The exploration is `graduated`; the three intentionally unscaffolded candidates
remain re-entry points. A satisfied gate reopens this packet at `decompose`
rather than spawning a goal directly.

## Cross-References and Ownership Fences

| Related packet | Relationship |
| --- | --- |
| `explorations/ingestion-security-secret-governance` credential-crypto lane | Hard fence: this packet owns document-link envelopes and serving-key custody only; the credential vault owns credential-record crypto. No codec, keyset, or custody implementation is shared. |
| `explorations/ingestion-security-secret-governance` guarded-fetch lane | Live USPTO, Box, or other remote fetch is gated on its DNS-rebinding/redirect harness proving pinned connect-time address enforcement. |
| `goals/law-docketing-patent-spine` | First consumer: owns matter/document authorization, provenance, approval workflow, and the authorized USPTO OA provider reference. |

## Sequencing

1. Graduate `secure-document-delivery` now. P0 settles the threat model,
   tamper/known-answer/rotation envelope proof, packaged keyring portability,
   and the HTTP Range/HEAD policy before public contracts harden.
2. Implement the incubated foundation capability, desktop PGlite/custody/HTTP
   bindings, and law-practice/documents authorization adapters for one fixture.
3. Verify the complete security matrix and keep live fetch blocked until the
   rebinding harness lands.
4. Graduate Box, viewer, or additional origins only on a named consumer pull.
   Promote the incubated capability only after two real importers prove its
   provider-neutral seam.

## First Vertical Slice

Given an attorney-approved USPTO/ODP File-Wrapper office-action reference from
the docketing spine, mint a purpose-bound opaque token; seal and persist its
mapping; authorize the active desktop session/audience; resolve the fixture
through the USPTO adapter; and stream one bounded `application/pdf` response.
Missing, expired, revoked, unauthorized, malformed, tampered, wrong-AAD, and
wrong-version cases all return the identical 404. The proof is deterministic
and network-free.

## Capability Check

| Component | Exact existing surface | Disposition |
| --- | --- | --- |
| USPTO document fetch | `packages/drivers/uspto/src/Uspto.service.ts` — `UsptoShape.downloadDocument` and `Uspto.downloadDocument` | **REUSE** behind an authorized provider-reference adapter; never move fetch into the capability. |
| Box byte streaming and URL guard | `packages/drivers/box/src/Box.streaming.ts` — `downloads.downloadFile`, `BoxByteStream`, and `assertAllowedRemoteUrl` use | **REUSE LATER** for the gated Box origin. |
| Generic custody interface candidate | `node_modules/@azure/msal-node-extensions/types/persistence/IPersistence.d.ts` plus `PersistenceCreator.d.ts`; executable precedent at `packages/drivers/m365/src/M365.auth.ts` | **ADAPT** behind **NET-NEW** `ServingKeyCustody`; no `@beep/m365` import. |
| AES-GCM technique precedent | `packages/tooling/library/ai-metrics/src/archive.ts` — `AiMetricsRawArchiveKey`, 96-bit nonce, WebCrypto encrypt/decrypt | **REUSE TECHNIQUE**, not codec; document-link envelope is **NET-NEW**. |
| Authenticated loopback sidecar | `apps/professional-desktop/server/main.ts` — `RpcServer.layerProtocolHttp`, `BunHttpServer.layer({ hostname: "127.0.0.1" ... })`; `apps/professional-desktop/server/RpcSessionAuth.ts` — per-launch bearer/session middleware | **EXTEND** with a separately composed document route, Host/audience checks, and no permissive RPC CORS. |
| Desktop persistence | `apps/professional-desktop/src/runtime/Pglite.ts` — `PgliteDrizzleLive`; `Migrations.ts` boot migrations; catalog `@electric-sql/pglite` 0.5.4 | **EXTEND** through the capability persistence port; mapping table and migration are **NET-NEW**. |
| Product authorization adapters | `packages/law-practice/server` and `packages/documents/server` | **NET-NEW** adapters; authorization/provenance stay consumer-owned. |
| Delivery domain and ports | No `packages/foundation/capability/secure-document-delivery` exists | **NET-NEW, INCUBATED** until two real importers. |

## Open Risks Inherited From the Brief

- Packaged-webview cache/auth/referrer behavior may force a custom-protocol
  fallback; it may not weaken the response/security contract.
- Packaged keyring behavior may reject `@azure/msal-node-extensions` as the
  first custody adapter; the port and failure posture remain binding.
- Range/HEAD policy, bounded streaming, cancellation, and upstream fetch count
  must be explicit before P1.
- Consumer TTLs and revocation UX remain consumer policy under capability
  maximum and lifecycle predicates.
- Live remote proof remains blocked by the guarded-fetch rebinding harness.
