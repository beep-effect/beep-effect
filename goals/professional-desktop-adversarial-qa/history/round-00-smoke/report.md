# Round 00 — Phase 0 environment bring-up & mechanism smoke (2026-07-11)

Every campaign mechanism proven end-to-end before round 1.

## Mechanisms proven

| mechanism | result | evidence |
|---|---|---|
| codex gpt-5.6-sol medium → Chrome extension → app → labeled screenshot in packet | ✅ | `screenshots/01-app-loaded.png` |
| Real Anthropic LLM round-trip (haiku-pinned via new `AI_ANTHROPIC_MODEL` env) | ✅ natural reply, not fixture echo | `screenshots/02-real-llm-reply.png` |
| Token-gated full RPC over HTTP (`BEEP_DESKTOP_RPC_SESSION_TOKEN` on :3939, `VITE_…` on :1421) | ✅ auth_enabled: true; ontology/sync/intake RPCs served | sidecar journal |
| Real Box sync: connected badge + Sync now + QA folder auto-created | ✅ after fixing F-000-01 | `screenshots/04-vault-sync-connected.png`, `05-after-sync.png`; Box folder 399002097087 |
| Box CCG token minting (~64 min TTL, autonomous refresh via launch-sidecar.sh) | ✅ | round-start relaunch protocol |
| Grafana/LGTM debugging (Tempo trace pinpointed the Box decode failure) | ✅ | trace 68a452caf08711b411eeaf2461bc9e6e |
| In-app codex browser under `codex exec` | ❌ unavailable — Chrome extension backend is the campaign path | charter note |

## Environment changes (campaign infrastructure)

- `packages/drivers/anthropic`: new `AI_ANTHROPIC_MODEL` env override for the
  default language-model layer (campaign pins `claude-haiku-4-5`; default
  unchanged). Typecheck + tests green.
- Transient systemd user units: `beep-professional-desktop-sidecar`
  (CHAT_AGENT=anthropic, http, Box CCG token, session token) and
  `beep-professional-desktop-web-qa` (vite :1421). Pre-existing fixture stack's
  session token reused so the user's :1420 web stays functional.

## Findings (see ledgers/findings.md)

- **F-000-01 (P1, fixed)** — real Box sync never worked: Box SDK materializes
  absent response fields as `undefined`-valued keys; exact-optional generated
  schemas rejected every final-page listing; mirror-root probe failed silently
  to "disconnected". Fixed with `pruneUndefined` response normalization in
  `packages/drivers/box/src/internal/Box.runtime.ts` (driver tests green;
  live probe + UI verified). Generator-level `S.optional` alternative rejected:
  it triggers TS2589 type-depth blowup across the 90k-line generated file.
- **F-000-02 (P3, open)** — BoxError discards schema issue trees
  (`cause: Some("SchemaError")`), forcing standalone repros for decode bugs.
- **F-000-03 (P2, open)** — sidebar thread dates render "Dec 31" for threads
  created today.

## Carry-forward

- Round 1 fixes: F-000-02, F-000-03 (verify first).
- react-grab not yet smoke-tested; reviewers instructed to fall back to code
  search if it misbehaves.
- Style×node matrix harness build in flight (harness-builder agent).
