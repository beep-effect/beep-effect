# P3 Box-sync browser smoke evidence (2026-07-11)

Agent-run browser smoke per the packet execution note: frontend + sidecar over
HTTP against a temp vault, driving the P3 user flow end to end in fixture mode
(CHAT_AGENT=fixture → DocumentsSyncFixtureLive; no live keys).

## Harness

- Sidecar: `bun run dev:sidecar` with `BEEP_DESKTOP_RPC_SESSION_TOKEN=<random>`,
  `CHAT_DB_PATH=<scratch>/chat-db` (fresh PGlite; sidecar log shows
  "chat sidecar migrations applied" including `20260711000000_documents_sync_state`).
- Webview: `bun run dev -- --port 5273` with `VITE_BEEP_DESKTOP_RPC_SESSION_TOKEN`.
- Driver: headless system Chromium via playwright-core (`smoke.mjs` in this dir);
  Claude-in-Chrome extension was unavailable in this session.

## Flow driven + assertions (script exit: SMOKE PASS)

1. Load app → vault onboarding visible (fresh DB) → `vault-choose` sets the temp
   vault via the web prompt path → intake target mounts.
2. Files placed in the vault tree: `matters/acme/2026-001/02-agreements/msa-v1.txt`
   and `retainer-note.txt`.
3. Sync panel (`vault-sync-panel`): provider `box`, connection `connected`
   (fixture availability probe).
4. `vault-sync-trigger` → engine `syncOnce` over RPC → counts converge:
   `{pending:0, current:6, error:0, conflict:0, queued-ops:0, failed-ops:0, open-conflicts:0}`
   — 6 = 2 files + 4 ancestor folders mirrored into the fixture DMS.
5. Second trigger → idempotent: `current` stays 6, `queued-ops` stays 0.

Screenshots: 01-loaded, 02-onboarding, 03-vault-set, 04-sync-panel,
05-after-sync, 06-second-sync (this directory).

## Observations

- Four `POST /rpc/` 401s at page load before authenticated retries succeed —
  per-client-group first-connect handshake behavior in the pre-existing RPC
  protocol layer (also rejects `/` and `/favicon.ico`); auth is enforced and
  every driven flow succeeded. Not introduced by P3.

## Post-review re-run (same day)

After the adversarial review round (20 confirmed findings fixed — echo
suppression rewrite, idempotency key item-identity, pump wedge fix, terminal
failure recovery, symlink skip, event filtering + payload caps), the smoke was
re-run against the fixed engine reusing the previous run's durable PGlite state
across a sidecar restart: SMOKE PASS with identical converged counts
(current 6, zero errors/conflicts/queued) and idempotent second sync — no
false conflicts from the new echo model over pre-existing durable rows.
