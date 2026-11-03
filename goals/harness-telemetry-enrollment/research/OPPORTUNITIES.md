# Enrollment friction and improvements

## 2026-11-03 — Bound canary tooling to accepted architecture

PR2663 Repo Sanity reported missing `AiProviderCliSession` and observation claim APIs after main PR2594 intentionally retired them. The local prototype had passed on its recorded older base. Preserve those receipts, remove the incompatible active prototype, refresh exact selected-source admission, and adapt retained collector provenance through a narrow native observation path. Never restore the retired session dispatcher.

Prevention: compare current architecture decisions and the actual imported API surface before a real-harness launch; let hosted compile failures identify revision drift without treating historical synthetic success as current collection proof. Publish coherent corrections while other route work proceeds.

## 2026-11-03 — Personal desktop capability boundary

Claude Desktop/Cowork uses Personal Pro/Max. Organization-admin Cowork OTel requires Team/Enterprise. Preserve this explicit capability gap and investigate supported local engine metadata separately. Do not infer model usage from connection presence or collect Electron conversation storage. No plan upgrade is authorized.
