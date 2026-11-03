# Enrollment friction and improvements

## 2026-11-03 — Bound canary tooling to accepted architecture

PR2663 Repo Sanity reported missing `AiProviderCliSession` and observation claim APIs after main PR2594 intentionally retired them. The local prototype had passed on its recorded older base. Preserve those receipts, remove the incompatible active prototype, refresh exact selected-source admission, and adapt retained collector provenance through a narrow native observation path. Never restore the retired session dispatcher.

Prevention: compare current architecture decisions and the actual imported API surface before a real-harness launch; let hosted compile failures identify revision drift without treating historical synthetic success as current collection proof. Publish coherent corrections while other route work proceeds.

## 2026-11-03 — Personal desktop capability boundary

Claude Desktop/Cowork uses Personal Pro/Max. Organization-admin Cowork OTel requires Team/Enterprise. Preserve this explicit capability gap and investigate supported local engine metadata separately. Do not infer model usage from connection presence or collect Electron conversation storage. No plan upgrade is authorized.

## 2026-11-03 — Native override parsing and current catalogs

The native CLI applies dotted override keys by literal path splitting; quoted project paths in a dotted key did not address the exact project. Use one projects table value with the exact cwd key. A native isolated regression distinguishes the incorrect quoted path from the corrected table; portable tests parse actual argv and preserve the original admission refusal for quote/backslash paths. Retain these parser-specific receipts rather than assuming TOML key syntax applies to CLI path parsing.

Shared-symbol discovery and generated schema/instrumentation catalogs must follow current package source and barrels. Retired catalogs and old session APIs are historical evidence, not current implementation inputs. Regenerate canonical companions for the owned source and inspect every generated delta before accepting it.

A separate workflow-permission repair was needed for hosted check startup. A passing local command did not establish that hosted workflows started or passed. Keep that supporting CI repair and exact-head hosted receipts separate from native runtime and collection proof.
