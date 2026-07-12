# Professional Desktop — Adversarial QA & Fix Loop

Campaign charter. Autonomous adversarial review-and-fix loop over the entire
`apps/professional-desktop` frontend surface. Codex `gpt-5.6-sol` (effort
`medium`) agents review with browser + screenshot evidence; Claude (session
lead) fixes every confirmed finding itself. Loop exits after **2 consecutive
full rounds with zero unwaived findings**.

Started: 2026-07-11. Branch: `feat/professional-desktop-improvements`.
Plan of record: `~/.claude/plans/i-want-you-to-peaceful-aurora.md`.

## Locked decisions

| Decision | Value |
|---|---|
| Exit criteria | Verified-zero + waiver ledger; findings must be reproducible (screenshot + repro steps); 2 consecutive clean rounds |
| Loop mode | Fully autonomous; waivers reviewed async by user; veto re-opens the loop |
| LLM | Real Anthropic API; chat + filing pinned to `claude-haiku-4-5` |
| Box | Real Box; mirror root `beep-qa-professional-desktop-2026-07` ONLY — everything outside off-limits |
| QA runtime | Chrome at `127.0.0.1:1421` (http transport + RPC session token) primary; Tauri lane for IPC/native |
| Codex browser | Direct `codex` CLI + `chrome@openai-bundled`; companion `task` path only for read-only code-review lanes |
| Chrome | Dedicated QA profile/window; agents touch only tabs they create |
| Browser lanes | Serialized; code-review lanes parallel |
| Combinatorics | Full style×node matrix in headless Lexical harness; browser spot-checks: 32 style combos in paragraph + each node kind with 2–3 mixes |
| Stubs | Pre-waived (see `ledgers/waivers.md`) but stub UX in scope |
| Spikes | `?cosmos-spike`, `?ipc=1` excluded |
| Git | One commit per round; Yeet publish at convergence |

## Environment wiring (verified 2026-07-11)

- Sidecar (`server/main.ts`) env: `CHAT_AGENT=anthropic`, `CHAT_TRANSPORT=http`
  (`.env` sets `ipc` — MUST override for browser stack),
  `BEEP_DESKTOP_RPC_SESSION_TOKEN=<per-launch>` (`server/RpcSessionAuth.ts:21`),
  `CLOUD_BOX_TOKEN=<resolved DMS_BOX_DEVELOPER_TOKEN>` (gate: `src/runtime/Layer.ts:216`),
  `DOCUMENTS_SYNC_BOX_MIRROR_ROOT=beep-qa-professional-desktop-2026-07`
  (driver auto-creates folder under Box root), `AI_ANTHROPIC_MODEL=claude-haiku-4-5`
  (env override added for this campaign), `DOCUMENTS_FILING_MODEL` defaults to haiku already.
- Web: vite :1421 strictPort with `VITE_BEEP_DESKTOP_RPC_SESSION_TOKEN=<same token>`;
  proxies `/rpc`→:3939, `/otlp`→:4318.
- Secrets resolve via `op run --env-file=.env -- <command>` (1Password CLI v2.34).
- Observability: LGTM stack, Grafana :3000, OTLP :4318 (Loki/Tempo/Prometheus/Pyroscope);
  Grafana MCP available to codex and Claude.
- Tauri lane: `bun run --cwd apps/professional-desktop dev:tauri` with `CHAT_TRANSPORT=ipc`.
  Browser/Tauri lanes run in ALTERNATION (stop the http sidecar first) — the
  Tauri shell spawns its own stdio sidecar over the same pglite data dir, so
  concurrent stacks risk contention; alternation removes the risk outright.
- Sidecar relaunch: `<scratchpad>/campaign/launch-sidecar.sh` — mints a fresh
  Box CCG token (~64 min TTL; `box_subject_type=user`) and restarts the
  `beep-professional-desktop-sidecar` systemd user unit. Run at every round
  start and after sidecar-touching fixes. Campaign web unit:
  `beep-professional-desktop-web-qa` (vite :1421). Both reuse the session token
  from the pre-existing fixture stack so the user's :1420 web keeps working.
- Codex browser backend: the in-app browser is unavailable under `codex exec`;
  reviewers use `chrome:control-chrome` (Codex Chrome extension) in the user's
  Chrome, restricted to tabs they create. Invocation:
  `codex exec -c model_reasoning_effort='"medium"' "<prompt>"` (model
  gpt-5.6-sol from global config). Screenshots save fine from that sandbox.
- Box QA folder: `beep-qa-professional-desktop-2026-07` (Box folder id
  399002097087), auto-created by the mirror-root resolver on first probe.

## Reviewer finding protocol

Every codex reviewer, on every finding:
1. Screenshot → `history/round-NN/screenshots/NN-<surface>-<slug>.png`
2. Describe the issue + exact repro steps
3. Locate: react-grab (hover + Ctrl+C in dev build) or exact code path via repo search
4. Recommend a fix
5. Record in the lane report; continue until the lane is exhausted

Waiver + findings ledgers are injected into every reviewer prompt; waived/known
items must not be re-reported.

## Directory map

- `ledgers/findings.md` — master finding inventory (all rounds)
- `ledgers/waivers.md` — pre-waived stubs + taste items; user vetoes here
- `ledgers/backlog.md` — out-of-scope discoveries
- `ledgers/node-coverage.md` — 14 node kinds × 2 render paths checklist
- `history/round-NN/report.md` + `history/round-NN/screenshots/`
