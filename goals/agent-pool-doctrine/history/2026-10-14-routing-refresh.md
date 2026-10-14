# 2026-10-14 — Routing refresh: Fable orchestrator, review panel, Junie volume pool

## Directive

Operator rulings of 2026-10-14, made in a grilling session over a live audit of
CLIProxyAPI, every harness configuration and the routing manifest. They amend the
[2026-10-01 policy](./2026-10-01-fallback-chains.md); its chains, rules and
"no silent substitution" law stand.

| # | Decision | Reason | Reversal |
| --- | --- | --- | --- |
| R1 | Claude Code orchestrator = `claude-fable-5-1` medium; every Claude child (Agent tool, Workflow, fallback step, QA judge) stays `claude-opus-5-5` medium. | The live default was already Fable and the session-routing doctrine already named Fable for orchestration; children carry the volume, so the scarce Anthropic quota goes to judgment only. | Set the `orchestrator` × `claude-code` binding back to `claude-opus-5-5` and re-adopt. |
| R2 | Codex default stays `gpt-6.1-sol` medium; the 2026-10-14 picker drift to `gpt-6-sol`/high is reverted and `gpt-6-sol` is superseded. | The Codex catalog labels `gpt-6-sol` "Previous generation workhorse". | Edit the binding. |
| R3 | `gpt-6-astra` leaves the superseded list and becomes the `review.panel` Codex member at xhigh, beside `claude-fable-5-1` xhigh and `grok-4.7` xhigh. | Astra is the catalog's frontier tier above Sol, not Sol's predecessor; the repository-simplification-confidence panel already uses it. | Drop the `review.panel` bindings. |
| R4 | Grok CLI default effort back to medium; `claudeg`, `research.web` and `jsdoc.migrate-titles` move to `grok-4.7`; `grok-4.6` is superseded. | Effort drift (xhigh) contradicted the fallback pin; `grok-4.7` passed an x_search probe through the proxy. | Re-pin `grok-4.6`. |
| R5 | `muse.opt-in` role: `muse-wonder-1.0` medium via `claudem`, never in a fallback chain; `muse-spark-1.3` superseded. | Wonder was routable and unbound; probe answered as Muse Wonder. | Re-pin Spark in `claudem`. |
| R6 | `child.lightweight` → `gpt-6-luna` (from `gpt-5.6-luna`). Not `gpt-6.1-sol`: the Haiku slot carries titles, compaction and quick Explore children, which must stay on the fast tier. | Current-generation fast tier; probe passed. | Re-pin `gpt-5.6-luna`. |
| R7 | Cursor: `fallback.cursor` → `claude-opus-5-5-medium`, `cursor.review` → `claude-opus-5-5-high`; `graft.deep` → `claude-opus-5-5` through the proxy. | The `-medium`/`-high` ids are now listed and init as "Claude Opus 5.5 300K Medium/High" (same seat as the bare id); the proxy routes `claude-opus-5-5`, closing the 2026-09-27 registry gap. | Re-pin the old ids. |
| R8 | Junie becomes a **volume pool**: `junie.volume` on a new `junie-cli` surface pins the strongest model the JetBrains route accepts, preferred for bounded implementation, exploration and second-opinion review lanes while JetBrains AI Pro credits remain in the cycle. Not a fallback step; Junie never delegates onward. `junie.default` tracks the interactive launch model (`gemini-3-flash-preview`). | JetBrains AI Pro is a paid pool the operator never exhausts; using it is quota arbitrage. | Drop the Junie bindings. |
| R9 | `bun run beep accounts` gains a Junie/JetBrains AI row so spend-down decisions read real remaining credits. | R8 needs a meter. | Remove the provider. |

## Verified identifiers (2026-10-14)

| Intended | Verified id | Route | Evidence |
| --- | --- | --- | --- |
| Grok 4.7 with X search | `grok-4.7` | CLIProxyAPI, xAI OAuth, `x_search` injected | `/v1/messages` → `model: grok-4.7-build`, returned a dated X post with a status URL |
| Muse Wonder 1.0 | `muse-wonder-1.0(medium)` | CLIProxyAPI, Meta OAuth | `/v1/messages` → `model: muse-wonder-1.0`, "Muse Wonder" |
| GPT-6 Luna | `gpt-6-luna` | CLIProxyAPI, ChatGPT OAuth | `/v1/messages` → `model: gpt-6-luna` |
| Cursor Opus 5.5 medium / high | `claude-opus-5-5-medium`, `claude-opus-5-5-high` | `cursor-agent` 2026.10.14 | stream-json init "Claude Opus 5.5 300K Medium" / "… High", result `success` |
| Proxy Opus 5.5 | `claude-opus-5-5` | CLIProxyAPI 8.0.17-dankstation.1 | listed by `/v1/models` (62 ids) |

Gap: `cursor-agent --sandbox enabled` fails on this host (AppArmor); the probes ran
`--sandbox disabled` in an empty workspace. The Cursor lane recipe still requires
the sandbox for real lanes; that remediation belongs to the cloud-agent-readiness
packet.

## What changed

- Manifest vocabulary: roles `review.panel`, `muse.opt-in`, `junie.default`,
  `junie.volume`; surface `junie-cli` (effort low/medium/high).
- Seed bindings and superseded list per R1–R8; new targets for `claudem` and
  `~/.junie/settings.json`; Junie's `AGENTS.md` receives the routing-doctrine block.
- Repo literals the check flagged: `JSDocMigrateTitles.ts`, and the JSDoc model
  examples in `Provenance.ts`, `Resume.ts`, `QualityWorkerEval.ts`.
- Missing generated blocks inserted in `docs/runbooks/graft-local-recovery.md` and
  the `browser-qa-loop` skill and judge prompt.
- Home (backed up as `*.bak-20261014-model-routing`): Claude settings, Codex
  config, Grok config, `~/.zshrc` wrappers, Graft env, RustRover agent rollouts,
  `~/.claude/CLAUDE.md`, `~/.claude/rules/working-style.md`, `~/.codex/AGENTS.md`,
  `~/.junie/AGENTS.md`, the CLIProxyAPI config comment and `DANKSTATION.md`.

## R10 — accounts poller and the Junie login

`bun run beep accounts` reads proxy logins and never refreshes them. Junie is different: it
keeps its JetBrains login in the OS Secret Service (`service=junie-cli`) and persists only a
stale access token, refreshing in memory on every start. The Junie provider therefore refreshes
in memory too (`POST https://oauth.account.jetbrains.com/oauth2/token`, `client_id=junie-cli`)
and reads `GET https://ingrazzio-cloud-prod.labs.jb.gg/auth/test` (`balanceLeft`,
`balanceUnit`, `licenseType`). Verified 2026-10-14: the keyring item was last modified
2026-09-25 although Junie refreshed on later runs, and a refresh returned the same refresh
token; the balance call answered `active: true`, `licenseType: AIP`, unit `CREDITS`. A rotated
refresh token in a response aborts the poll; nothing is ever written back.

Review round 1 on #1715 tightened the order: the poller tries a cached access token (60 s expiry
skew), then the stored one, and spends a refresh grant only when `auth/test` answers 401/403, so
`accounts watch` costs about one grant per token lifetime instead of one per poll. Rotation,
`invalid_grant` and an inactive licence are `NeedsLogin`; timeouts stay `Failed` and keep the
last good reading.
