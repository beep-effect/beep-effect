# Qualify every agent harness and surface — specification

## Objective

Enroll declared CLI, desktop and proxy routes without overstating coverage, preserving identity across clones, worktrees and hosts.

## Source hierarchy

User decisions and AGENTS.md govern; then architecture standards, this SPEC, PLAN, GOAL and research evidence. [Adopted brief](../../explorations/agent-observability-rebuild/BRIEF.md) and [decisions](../../explorations/agent-observability-rebuild/DECISIONS.md) are design provenance. Do not treat audit observations as immutable live state.

## Target surfaces

- packages/tooling/library/ai-metrics adapters and route inventory
- packages/drivers/ai-provider-cli and owned launch/hook integrations
- repo-owned workstation and dankserver worker provisioning
- existing user config writers, not untracked hand-edited global configuration

## Scope and constraints

This packet is paused until explicitly launched. Preserve unrelated local work, existing source identities, the masked collector recovery hold and historical archives. Metadata plus curated sanitized examples is the approved collection boundary. Use schema-first Effect code, existing drivers/tooling and architecture observability conventions. Source changes and deployments must have owned tests and rollback. Existing subscriptions only; no new paid endpoints, quota purchases or automatic broad judge runs. Do not revive retired OpenClaw.

Do not infer that an enum, installed app, green service, transport acknowledgment, query result or canary proves every activity source was captured. Unknown and intentionally excluded populations remain explicit. Keep code fixtures synthetic and disposable; do not use real prompts or secrets to make tests convenient.

## Non-goals

- Big-bang replacement, indiscriminate raw transcript collection, or immediate mass backfill.
- New generic tracing UI, one Phoenix project per worktree, or universal productivity scores.
- Claiming deployment or goal completion from packet authoring or local tests alone.
- Deleting user data, removing recovery material or changing protected credentials as a shortcut.

## Acceptance criteria

- [ ] Provide a versioned matrix for Grok, Claude Code CLI, Claude Code desktop runtime, ordinary Claude Desktop/Cowork, Codex CLI, ChatGPT/Codex Desktop, Muse proxy and cursor-agent. Add Junie/remote routes when declared; never silently omit an unsupported surface.
- [ ] For each route separately prove capability, installed configuration, launch observation, normalized metadata and backend receipt; absent or inaccessible evidence remains unknown.
- [ ] Qualify Codex 0.165.0 separate log/trace/metrics configuration and actual runtime overrides. Do not rely on exporter=none as trace evidence or enable every Rust runtime span.
- [ ] Add adapters for managed Grok/Cursor usage and results using documented native events, supported local metadata or controlled launcher receipts; source enum membership is not coverage.
- [ ] Keep Muse requested proxy route, reported harness/model and verified provider identity separate. Never infer upstream identity from a model alias or Claude-formatted event.
- [ ] Preserve intended bounded telemetry context through managed child environments without forwarding secrets or all parent environment variables.
- [ ] Discover all declared clone/worktree roots and source namespaces independently of collector cwd; test worktree creation/retirement and archived/copied sessions.
- [ ] Qualify desktop apps separately from CLI: controlled canary identity and receipt, actual config, home and host evidence, plus explicit unsupported states for inaccessible cloud conversations.
- [ ] Qualify dankserver worker account and each additionally declared remote host through authorized wrappers/config writers. The prior unreadable worker config is not proof of no telemetry.
- [ ] Implement privacy allowlists and bounded field cardinality for every adapter. Native resource/account/body fields must not bypass metadata policy.
- [ ] Run per-route main/clone/worktree/restart/resume/cancellation/child-handoff canaries with exact expected IDs, dedup and a stated acknowledgment boundary.
- [ ] Publish a readable coverage report and rollback per route. Existing held collector and unrelated work stay intact until their own release/cutover gates pass.

## Dependencies

goals/agent-observability-foundation

For downstream work, only already-qualified routes may be used. Design/calibration fixtures can progress before full fleet enrollment; real comparisons cannot imply unqualified coverage.

## Verification matrix

| Gate | Evidence | Required result |
| --- | --- | --- |
| Packet | JSON, links, launcher <=4000 chars, no placeholders | Pass |
| Domain proof | Adapter contract fixtures; versioned config projection tests; privacy and child-env tests; expected-ID canary receipts; source namespace lifecycle tests; touched-package verification and host render tests. | Assigned acceptance demonstrated |
| Privacy | Allowlisted metadata/curated-example review and rejected-field fixtures | No raw content or secret leakage |
| Deployment | Render parity, bounded route canary, read-back, resource ceilings and rollback | Evidence identifies actual routes and receipt boundary |
| Repository quality | Required touched-package verification and Yeet/hosted gates | Current repo policy satisfied |
| Closeout | Final delivery PR readiness/merge evidence and reflection | Only then completed-retained |

## Stop/hold conditions

Missing source access remains an explicit coverage gap; do independent synthetic/design work. Hold dependent rollout on unproven integrity, identity, privacy or resource bounds. Uncertain mutation outcomes must be inspected before replay. New spend requires the operator. Preserve interrupted work and record concrete blockers; do not weaken authentication or data boundaries.

## Decision log

| Date | Decision | Reason | Reversal |
| --- | --- | --- | --- |
| 2026-10-27 | Prepare paused implementation packet | Operator adopted exploration direction and asked for packets, not execution | Revise packet before launch |
| 2026-10-27 | Inherit metadata/curated-example policy | Operator decision D1 | Only explicit policy revision |
| 2026-10-27 | Preserve live state until bounded proof and rollout | Confirmed held collector and incomplete semantics | Revert owned configuration to captured baseline with validated data compatibility |

## Exception ledger

None. Deferred implementation details must be decided with evidence and recorded here, not treated as permission to omit acceptance.
