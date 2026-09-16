# Decisions

Grilling log for the align stage. Newest round last. Each entry: Question / Answer / Rationale
(rejected options included). `ops/manifest.json` `openQuestions` mirrors the remaining frontier.

## 2026-09-16 — Round 1

### D1 — Packet home

**Question.** Where is this captured and decided? The Cursor lane already exists as tsgo-045 D13, and
`explorations/INBOX.md` carries an overlapping `agent-config-canonicalization` bullet.

**Answer.** A new exploration packet, `explorations/cursor-agent-pool/`, with tsgo-045 D13 and the
INBOX bullet linked as prior art.

**Rationale.** Pool-order doctrine is repo-wide; burying it in a package-sweep goal packet hides it.
Folding into canonicalization would tie a small routing decision to a one-manifest-many-harnesses
compiler nobody has started. Rejected: extend tsgo-045 D13; fold into agent-config-canonicalization.

### D2 — Codification surface

**Question.** Where does the tier rule live so every agent follows it?

**Answer.** Doctrine now, CLI later. Amend the `AGENTS.md` "Token-heavy Codex work" section into a
pool-ordered rule and add `docs/runbooks/agent-pools.md` with the exact lane recipes. A meter-reading
`beep agent-pool pick` command is a graduated goal, not a blocker.

**Rationale.** The rule must bind agents on the next session; a CLI takes a PR train. Rejected:
doctrine only (no automation ever); CLI first (delays the binding rule).

### D3 — Gate semantics

**Question.** How is "Codex above 5%" evaluated headlessly?

**Answer.** Meter read with probe fallback. The Codex app-server protocol exposes
`account/rateLimits/read` (and an `account/rateLimits/updated` notification), confirmed from
`codex app-server generate-json-schema` on 2026-09-16, so the Codex side is machine-readable. Where no
meter exists (Cursor, pending L3), a cheap probe run whose usage-limit error counts as "below floor".

**Rationale.** A reserve cannot be honoured by fail-over alone, and requiring meters on both pools
would block the rule on Cursor's opaque metering. Rejected: probe-on-failure only; meter-read only.

### D4 — Seat axis inside Cursor

**Question.** When quality and drain rate conflict, which wins? Ultra meters two buckets: Cursor
Models (Composer 2.5, Cursor Grok 4.6) and Other Models (Fable 5.1, Sol, Kimi K3, Opus 5).

**Answer.** Quality-first, bucket-aware. Implementation lanes take the strongest Other-Models seat
(Sol xhigh or Fable 5.1 xhigh, id locked after the L3 cost report). Mechanical Luna-class work drains
the separate Cursor-Models bucket (Cursor Grok 4.6 / Composer 2.5) so both allowances get used.

**Rationale.** The pool exists to replace Astra, so the volume seat must be Astra-class; the second
bucket is otherwise wasted. Rejected: drain-rate first (lower ceiling for the job that matters);
Fable-only (fastest burn, ignores the free second bucket).

## 2026-09-16 — Round 2

### D5 — Graduation shape

**Question.** What does the exploration graduate into?

**Answer.** Two goals, doctrine first. Goal A: pool-order doctrine in `AGENTS.md`,
`docs/runbooks/agent-pools.md`, the Cursor lane recipe promoted out of tsgo-045, and the `.cursor/`
parity configs. Goal B, queued behind A: `beep agent-pool pick` reading the Codex app-server
rate-limit method plus whatever Cursor meter L3 finds.

**Rationale.** Time-to-first-merge for the binding rule, with the automation owned rather than
parked. Rejected: one goal (long single train); doctrine PR with no goal (parity and meter unowned).

### D6 — Proxy route

**Question.** D13 rejected a CLIProxyAPI Cursor executor; Cursor therefore cannot be a Workflow child
model. Re-open or lock?

**Answer.** Locked: Cursor is a Bash lane only, driven via `cursor-agent -p`. Workflow children keep
routing to proxy models (Astra, Luna, Grok). L4 still records any community Cursor-as-provider adapters
and Cursor's terms stance, for the record only.

**Rationale.** No upstream executor exists, the API is undocumented, and the terms risk is real.
Rejected: research a provider adapter; evaluate `cursor-agent worker` as a second dispatch surface
(may return as a MAP candidate if L1 shows a job-dispatch path).

### D7 — Floors and tier 3

**Question.** What are the Cursor floor and the behaviour when both pools are dry?

**Answer.** 5% per bucket, then hold. Cursor is available while the target bucket (Other Models for
implementation, Cursor Models for mechanical) holds more than 5%. With Codex and Cursor both below
floor, lanes queue and the operator is notified; Fable children are never the fallback; grok-4.6 lanes
stay reserved for research-class work.

**Rationale.** Keeps a reserve for urgent judgment work and keeps the Grok pool for what it is best
at. Rejected: fall through to Grok editing lanes; 0% floors with fail-over on error.

### D8 — What "Codex" means

**Question.** Three ChatGPT subscriptions back Codex: the `codex` CLI login plus the OAuth
credentials admitted to CLIProxyAPI. Which meter defines "Codex available"?

**Answer.** Union of accounts. Codex is available if any admitted account is above 5%. The CLI
account is read via `account/rateLimits/read`; proxy accounts via the CLIProxyAPI management API if it
exposes quota, else via a probe. The picker also names which credential a lane should use.

**Rationale.** Headroom on any account is headroom. Rejected: CLI account only; proxy-first union
(would demote `codex exec`, the proven lane, to fallback).

## 2026-09-16 — Round 3

### D9 — Parity gate

**Question.** How much config parity with the Claude/Codex lanes gates Cursor taking real shards?

**Answer.** Metrics hooks gate; the rest follows. Goal A must ship a `.cursor/hooks.json` firing the
same pulse/law hooks so Cursor lanes appear in ai-metrics and the Yeet inbox backpressure. Subagents,
skills discovery, and MCP mirroring also land in Goal A but do not block first admission.

**Rationale.** An invisible lane cannot be measured or back-pressured; the other surfaces improve
quality but not safety. Rejected: full parity gate (slow); no gate (blind lanes).

### D10 — Entry point

**Question.** Who applies the pool rule at launch time?

**Answer.** Orchestrator by doctrine, picker later. Goal A: the orchestrating agent reads the
`AGENTS.md` rule and the runbook and chooses the lane by hand (meter or probe). Goal B:
`beep agent-pool pick` prints the full launch command and orchestrators run it. The codex-companion
plugin stays Codex-only and is simply not used when Codex is below floor.

**Rationale.** Keeps doctrine out of a third-party plugin and avoids a throwaway wrapper.
Rejected: teach the codex plugin; ship an agent-lane shell wrapper under `scripts/` now.

### D11 — NO ZDR seats

**Question.** Cursor marks every Fable seat "NO ZDR". Acceptable?

**Answer.** Acceptable, with the corpus rule. The repo is public, so retention of repo content is
fine. Nothing from the out-of-repo corpus, client documents, or secrets ever enters a Cursor lane
prompt. Fable seats stay eligible.

**Rationale.** Matches the existing hygiene rule for the corpus; excluding Fable would cap the volume
tier. Rejected: avoid NO ZDR seats; wait for L3.

### D12 — Home for reusable lane recipes

**Question.** Where do packet-independent lane recipes live?

**Answer.** Runbook only. `docs/runbooks/agent-pools.md` carries the canonical recipe per pool
(`codex exec`, `cursor-agent`, grok-4.6 proxy lane) with copy-paste blocks; goal packets keep their
task-specific prompt files and cite the runbook.

**Rationale.** One doctrine surface, no template renderer to maintain. Rejected: a prompt
template directory under `.agents/`; keep citing tsgo-045 (a sweep packet that will close).

## Open (blocked on research lanes)

- Seat ids per tier (volume / review / mechanical) and their buckets — L3.
- Cursor hook event mapping to the repo's pulse hooks; headless firing — L2, then an empirical
  hooks smoke test in this worktree.
- Headless read of "Cursor usage available" — L3 (and L4 field reports).

## 2026-09-16 — Round 4

### D13 — Hooks gate satisfied, gaps recorded

**Question.** Headless smoke: sessionStart, preToolUse, postToolUse, postToolUseFailure,
beforeShellExecution, afterShellExecution, afterFileEdit, sessionEnd fire under `-p`; `stop`,
`beforeSubmitPrompt`, and any Notification analogue do not. Does that satisfy D9?

**Answer.** Yes, with recorded gaps. Admit Cursor lanes once pre/post tool, failure, and session
start/end pulses flow; the runbook records Stop→sessionEnd as a stand-in and UserPromptSubmit and
Notification as GAPs. Wait attribution stays comparable only within the cursor-cli harness.

**Rationale.** The events that carry the effectiveness signal (tool brackets, failures, session
bounds) all fire. Rejected: hold for `stop` parity; lower the gate to session pulses only.

### D14 — Pulse writer shape

**Question.** Cursor delivers the same snake_case stdin keys the pulse script reads but camelCase
event names, and the ledger's agent-kind and event literals are closed. How is the writer built?

**Answer.** Adapter plus literal extension. `.cursor/hooks/hook-pulse.sh` maps camelCase to
PascalCase and passes `agentKind cursor-cli`, then runs the shared jq body. `HookPulseAgentKind`
gains `"cursor-cli"` and the conformance test in `@beep/repo-ai-metrics` covers it. The same pattern
serves law-pulse (`afterFileEdit`) and yeet-inbox (`preToolUse` deny).

**Rationale.** One ledger, one schema, smallest diff. Rejected: a separate Cursor writer and schema
(second ledger to read); deduplicate the three copies first (right long-term, delays Goal A; log as a
Goal A stretch or Goal B chore).

### D15 — Dogfood

**Question.** The live Codex meter reads 100% used until 2026-09-19 09:22Z, so the Cursor pool is
the volume pool today. Dispatch Goal A's implementation to a Cursor lane?

**Answer.** Yes. Once shaped and decomposed, Fable orchestrates and a `cursor-agent -p --sandbox
enabled` lane on the seat L3 recommends writes the runbook, the `AGENTS.md` amendment, the hooks
adapter, and the agents mirror in this worktree. The first pool-rule PR is itself the proof.

**Rationale.** Proof over assertion, and the rule says so. Rejected: plan only; Fable implements.

## 2026-09-16 — Round 5 (research-informed)

### D16 — Seat map (revises D4)

**Question.** L4 field reports (2+ sources): the Cursor Models bucket is consumed first and spills
into Other Models; Composer 2.5 is a harness-trained implementer at $0.50/$2.50 per M; Kimi K3 on
Cursor loops and burns Other Models; Fable 5.1 is $10/$50 per M and Opus/Fable-class seats exhaust
Ultra's Other Models (about $400 API value, single-source) in days. Astra is absent. Revise D4?

**Answer.** Revised. Volume implementation = `composer-2.5` (never a `-fast` id: 6x input price).
Long-horizon self-testing shards = `cursor-grok-4.6-xhigh`. Review and adversarial verification =
`gpt-5.6-sol-xhigh` from Other Models under a per-cycle budget. `claude-fable-5-1-*` and `kimi-k3-*`
are excluded from lanes. D4's "quality-first" intent survives only in the review tier.

**Rationale.** A pool that lasts the cycle beats a ceiling that empties it in days; the harness-trained
implementer is what the volume tier needs. Rejected: keep Sol xhigh for volume; hybrid by shard size
(most rules to write).

### D17 — Cursor meter

**Question.** No official per-account usage endpoint exists; community meters use private
`api2.cursor.sh` endpoints or session cookies, which Cursor staff classed with unofficial proxies
(abuse enforcement up to account ban, 2026-08-10). stream-json carries no usage events.

**Answer.** Fail-open, detect on exit. Cursor counts as available; a lane that exits nonzero with a
quota or limit message in stderr marks the pool below floor for the session and the orchestrator holds
(D7). The dashboard stays the human meter. No scraper ships in this public repo.

**Rationale.** The only meters are terms-risky and unshareable. Rejected: a git-ignored local meter
script (account-ban risk); wait for an official API before shipping the rule.

## 2026-09-16 — Round 6 (research-informed)

### D18 — Review seat

**Question.** Which Other-Models seat takes review and adversarial verification? Sol xhigh Index ~47 /
TB 40%; Opus 5 Coding Agent index 60, ZDR, $5/$25; Fable 5.1 $10/$50, NO ZDR.

**Answer.** `claude-opus-5-thinking-high` primary, `gpt-5.6-sol-xhigh` fallback.

**Rationale.** Best quality per dollar in the bucket, ZDR, same family the orchestrator reasons with.
Rejected: keep Sol (diversity, lower index); Fable 5.1 xhigh (2x price, fastest burn).

### D19 — Hooks path

**Question.** Cursor can load `.claude/settings.json` hooks via the account-flagged third-party loader,
but that skips PostToolUseFailure, Notification, PermissionRequest, PermissionDenied, and Cloud Agents
load only a native file. How does Goal A wire pulses?

**Answer.** Native `.cursor/hooks.json` with the D14 adapter; the third-party loader stays off.

**Rationale.** Covers failure pulses, works headless and in Cloud Agents, no feature flag, no
double-firing. Rejected: loader only; both with dedupe.

### D20 — Agents mirror

**Question.** Cursor auto-discovers `.claude/agents/*.md` (not `.codex/agents/*.toml`) and supports
`model`, `readonly`, `is_background` frontmatter. Does Goal A mirror the seven agents?

**Answer.** Discovery only; add `.cursor/agents/<name>.md` only where a Cursor model pin pays (read-only
explorers on `composer-2.5`, `readonly: true`). Skills need nothing (`.claude/skills` and
`.agents/skills` are discovered).

**Rationale.** No second copy to keep in sync. Rejected: full mirror; no Cursor-specific agents.

### D21 — Committed deny list

**Question.** The sandbox does not block the git binary; a project `.cursor/cli.json` deny wins over
`--force`. Commit a deny list?

**Answer.** Yes: `Shell(git)`, `Shell(sudo)`, `Shell(pkexec)`. The no-git rule becomes structural and
YubiKey prompts cannot hang headless runs; the orchestrator stages by name, as today.

**Rationale.** Structural beats prompt-only; the interactive cost (no git from Cursor in this repo) is
accepted. Rejected: sudo/pkexec only; no committed list.

**Amended 2026-09-16 (PR #1162 review, P1).** `Shell(commandBase)` matches only the first token, so
`/usr/bin/git`, `env git`, and `bash -lc "git ..."` bypass `cli.json`. Added a second layer:
`.cursor/hooks/deny-shell.sh` on `beforeShellExecution` with `failClosed: true`, denying any token
whose basename is git/sudo/pkexec. `cli.json` stays as the documented first line.

## Align closed 2026-09-16

Frontier empty after six rounds (D1–D21). Carried into shape: D7's 5% Cursor floor is a human
dashboard check under D17 (no readable meter); L3's warning that Cursor-Models spill can zero Other
Models is the reason the floor exists.

## Graduated 2026-09-16

Shape and map confirmed by Benjamin. Goals: `goals/agent-pool-doctrine` (active) and
`goals/agent-pool-picker` (paused, gated on A). Dogfood (D15) ran the same day: see
`history/2026-09-16-goal-a-slice-lane.md`.
