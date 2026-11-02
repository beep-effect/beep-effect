# Repo capability inventory: T3 Code as the fleet messaging substrate

Dated 2026-11-01. Read from the main checkout at `83d38d46f1` (read-only).
Scope: orchestration, the orchestrator role, handoffs, cross-provider
messaging, session bridges, remote/worker dispatch, closeout and compute
signals. Verdicts: **edit** (text or code must change), **extend** (add a
route/kind/section, keep the rest), **unaffected**. Cites are `path:line`
relative to the repo root.

## Skills

Mirroring: `.claude/skills/` is the only source. `.agents/skills` and
`.agents/agents` are symlinks to `.claude/skills` / `.claude/agents`, and
Codex discovers skills through `.agents/skills` (`.codex/config.toml:3-5`).
`bun run beep skills update` owns the `.codex/config.toml` `[[skills.config]]`
table (renderer `packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:800`,
`:812`; 38 entries, one per skill) and `skills-lock.json` (each local skill
lists `.claude/skills/<n>` + `.agents/skills/<n>` as `installedTargets`).
`CLAUDE.md` is a symlink to `AGENTS.md`. `.junie/skills/` holds one symlink
(`adhd`); Junie does not get the orchestration skills. `.grok/` holds only
`workflows/omi-model-port.rhai`; no Grok skill mirror exists in-repo (NOT
FOUND). `remote-development-agents` is also installed globally for Claude and
Codex through a symlink to a retained canonical checkout under
`~/.local/share/beep/worker-skill-source/` (skill text says so at
`.claude/skills/remote-development-agents/SKILL.md:16-19`). Editing a skill
body in `.claude/skills` updates every in-repo harness at once; a new skill
also needs `beep skills update` for the Codex table and lock.

| Skill | Today | Cross-session messaging today | Verdict |
| --- | --- | --- | --- |
| `orchestrate` (`SKILL.md`, 330 lines; `HANDOFF.template.md`; `gate.sh`) | The orchestrator role: take-over, run, hand-off; files under `~/.cache/beep/orchestrator/` and `~/.local/state/beep/` (`SKILL.md:143-155`). | Route table picks per session type: Claude `SendMessage`, Codex `collaboration.send_message`/`followup_task`, T3 via `agent-message attach-t3` + peer wrapper, managed `agent_message_*` MCP, manual (`SKILL.md:15-27`). Long T3 section (`:36-94`) already names `orchestrator_capabilities`, `t3_thread_configuration`, launch/interrupt rules (`:78-88`). Managed tool table (`:96-141`). Broadcast/briefs "through the authorized route" (`:166`, `:191-196`, `:301-308`). | **edit**: make T3 the default route row, collapse the provider-specific rows to fallbacks, add remote T3 environments as addresses, add host selection/spill. |
| `orchestrate/HANDOFF.template.md` | Private handoff format. | "Communication routes" table (`:75-83`) and "Broadcast" (`:85-94`) are provider-neutral. | **extend**: columns for T3 environment + thread id + host; recipe row for the T3 MCP endpoint per host. |
| `operator-handoff` (120 lines) | One-command take-over/hand-off that runs the orchestrate procedures. Gate clone default `beep-effect11` (`SKILL.md:14-15`). | Broadcast only to units the routes table authorizes (`:64-73`); explicitly names `local_…` Desktop routes and forbids resuming dormant Codex Desktop tasks. | **edit**: broadcast/re-arm through T3 thread sends; re-arm T3 attachments (`attach-t3` workers) in step 4 (`:48-63`). |
| `remote-development-agents` (94 + `references/hosts.md` 115 + `jobs.md` 104) | Select beep-worker / tbk-worker / dankserver, SSH via wrappers, one bounded `systemd-run --user` job per host in `agent-runs.slice`, receipts (`SKILL.md:21-60`; `jobs.md:26-40`). | None: job receipts and SSH only. No T3 mention in skill or references (rg: 0 hits). | **edit/extend**: add "dispatch through the host's T3 environment" as the preferred launch for agent turns; keep systemd jobs for quality/yeet work. grok-bot-box-1 and tom-pc-1 have no host profile (NOT FOUND in `hosts.md`). |
| `closeout` (90) | AskUserQuestion / request_user_input stopping-point shape. | Orchestrator updates handoff with each unit's route and delivery holds; ACK is not takeover (`SKILL.md:13-18`). | **edit (small)**: route names in `:13-18`. |
| `yeet` (SKILL 1513 lines incl. refs) | Publish/monitor/merge-gate. | Defers coordination to orchestrate; messages carry no merge authority (`SKILL.md:14-17`). Dead-owner wave notifier + `yeet resume <pr>` reads a session registry of Claude/Codex ids (`references/monitor-and-inbox.md:131-148`). | **extend**: `yeet resume` / dead-owner escalation could target a T3 thread instead of spawning a notifier; skill text otherwise **unaffected**. |
| `explore` (141) | Exploration packet lifecycle. | None. | **unaffected**. |
| Others with hits (`ontology-*`, `sparql-expert`, `crispen`, `atom-reactivity`, `browser-qa-loop`) | Matches are "orchestration" in unrelated senses. | None. | **unaffected**. |

## Goals/explorations already shipped

### `goals/agent-message-router` (completed-retained; merged as #1571, `479c53e387`)

- Mission: local durable message contract, transactional SQLite delivery
  store, routing with per-session capabilities, policy fingerprints and
  explicit ambiguous recovery (`README.md:21-22`).
- Shipped CLI: `bun run beep agent-message` with `list register grant send
  reply inbox inspect settlement acknowledge resolve-ambiguity recover watch
  tools serve observation peer attach-t3`
  (`packages/tooling/tool/cli/src/commands/AgentMessage/AgentMessage.command.ts:257-277`).
  Every command takes an explicit private `--state-dir`.
- Peer MCP tools: `agent_message_{send,reply,inbox,acknowledge,inspect,discover}`
  (`.claude/skills/orchestrate/SKILL.md:118-125`).
- Evidence: 44 store/schema tests; one deferred P2 (R1: contradictory
  trusted-host metadata can consume send quota) in `research/FOLLOW-UPS.md`.
- Messaging model: Beep owns the mailbox; providers are endpoints. Direct
  addresses only; role addresses unsupported at dispatch (exploration
  `MAP.md:26-29`).
- Verdict: **extend/keep** as the durable receipt layer, or **demote** if T3
  native `t3_thread_send` becomes the substrate (decision needed, see Gaps).

### `goals/agent-session-bridges` (completed-retained; same PR #1571)

- Mission: compose managed and attached T3-owned sessions with the router;
  bounded repo task delegation without global role takeover (`README.md:22-23`).
- Managed adapters: Codex app-server, Claude stream input, Grok ACP; Cursor a
  classified blocked cell (`SPEC.md:48-57`). Reuses `@beep/acp`
  (`packages/drivers/acp`) and `@beep/ai-provider-cli`.
- **T3 adapter**: `@beep/t3-code` (`packages/drivers/t3-code`, ~670 lines).
  Effect `Context.Service` `T3Code` (`src/T3Code.service.ts:326`) speaking
  JSON-RPC MCP over HTTP with a bearer. Calls `t3_thread_configuration`,
  `t3_project_read`, `t3_thread_read`, `t3_thread_send` (mode `queue` only),
  `t3_thread_wait`, `t3_thread_interrupt` (`:240-299`). No launch call.
  **URL is pinned to loopback**: `^http://(127.0.0.1|[::1]):port/mcp$`
  (`src/T3Code.service.ts:32`), so a remote T3 needs an SSH forward or a
  driver change.
- `agent-message attach-t3 --state-dir --profile-file` enrolls one idle owned T3
  thread (`AgentMessage.attached.command.ts:50-75`). It **hardcodes** the model
  pins (`gpt-6.1-sol` / `claude-opus-5-5`, medium, `full-access`) instead of
  reading the models manifest (`:61-71`).
- Evidence: Codex↔Grok 39.9 s and Codex↔Claude 56.2 s autonomous exchanges;
  T3 Codex↔T3 Claude one-file audit delegation in both directions
  (`SPEC.md:154-162`). Read→send policy race recorded; no atomic
  compare-and-send in T3 (`SPEC.md:88`, `:172`).
- Still gated: separate Desktop-app attachment, browser bridge, **remote
  federation**, fleet-wide role/handoff changes (`SPEC.md:16`).
- Verdict: **extend**: remote endpoints, launch, per-host profiles.

### `explorations/cross-provider-agent-communication` (graduated two goals)

- `MAP.md:7-14`: queued candidates `agent-existing-session-enrollment`
  (T3-owned gate fired; separate apps queued), `agent-browser-session-bridge`,
  **`orchestrator-live-coordination`** (owner/role routing, reviews, reds,
  handoff), **`agent-communication-federation`** (remote-host routing, gateway,
  optional A2A). Deferred: cross-host delivery (`MAP.md:31-36`).
- `research/T3CODE-QUALIFICATION.md:86-94`: native T3 MCP proof
  (`orchestrator_capabilities`, `t3_thread_configuration`, `t3_thread_send`,
  `t3_thread_interrupt`, `t3_thread_launch`). `research/T3CODE-OPTIONS.md`,
  `NATIVE-DESKTOP-OPTIONS.md` compare hosts.
- `research/2026-10-21-codex-remote-control-bridge.md:3-8`: tom-pc-1 route is
  a loopback `codex app-server` WebSocket over an SSH forward with a capability
  token; spike scripts in `research/spike/codex-remote-bridge/`. Not T3.
- Verdict: the two queued candidates are exactly this packet's scope; this
  packet **supersedes or reopens** them at `decompose` (`MAP.md:34`).

### `goals/orchestrator-handoff` (active)

- Codifies the role (`README.md:9-13`); its artifacts are the orchestrate skill,
  the template, and `bun run beep session {open,note,register add|list}`.
- Register unit kinds: `desktop-session in-process-agent codex-lane
  background-job systemd-unit external-person`
  (`packages/tooling/tool/cli/src/commands/Session/Register.schemas.ts:61-67`,
  semantics `:30-48`). No T3 thread / remote-environment kind.
- Skill follow-ups list `beep session handoff` renderer, `register convert`
  (`.claude/skills/orchestrate/SKILL.md:321-330`).
- Verdict: **extend**: add a `t3-thread` kind (address = environment + thread).

### `goals/cloud-agent-readiness` (active)

- Linux workers ready for agent work (`README.md:16`). T3 is already a remote
  backend on beep-worker: `t3code.service` user unit on loopback 3773,
  published tailnet-only via Tailscale Serve, DankStation's T3 client paired,
  beep-effect added with `t3 project add`
  (`history/2026-10-14-linux-worker-readiness.md:138-168`). T3 nightly enables
  Codex/Claude/Cursor/Grok/Muse there; default new thread Codex
  `gpt-6.1-sol` medium (`history/2026-10-14-t3-provider-qualification.md:5-18`).
  A T3 MCP-launched Codex thread ran on beep-worker; MCP needs its own OAuth/PKCE
  client, not the environment access token
  (`history/2026-10-14-t3-remote-smoke.md:1-20`).
- tbk-worker design lists T3 as an extra explicit workflow, not enabled
  (`history/2026-10-23-tbk-worker-design.md:333`). dankserver: no T3 receipt
  found.
- Verdict: **extend**: per-host T3 readiness rows (dankserver, tbk-worker,
  grok-bot-box-1, tom-pc-1).

### Fleet goals

| Packet | State | Relevance | Verdict |
| --- | --- | --- | --- |
| `goals/fleet-mirror` | completed-retained | Read-only view of all checkouts sharing the origin. | unaffected (input to host/lane choice) |
| `goals/fleet-root-registry` | active, P0 | Fleet-root setting + seat/lane registry. | extend: seats could carry T3 environment ids |
| `goals/lane-bootstrap` | active, P0 | `beep worktree add` creates/registers lanes. | extend: register the lane as a T3 project |
| `goals/fleet-telemetry-tailnet` | active, P0 not started | Tailnet ingest gateway and dashboards. | extend: the cross-host pressure feed |
| `goals/agent-pool-picker` | paused | `beep agent-pool pick` prints the lane command. | extend: print a T3 launch instead of a CLI argv |
| `explorations/cloud-environment-fanout` | research | Vendor cloud VMs, `codex cloud exec` (`docs/runbooks/cloud-environments.md:186-190`). | unaffected (vendor clouds are not T3 hosts) |
| `explorations/fleet-coordination`, `agent-fleet-layout` | graduated | Same-workstation clone collisions. | unaffected |
| `explorations/remote-skill-activation-conformance` | parked | Remote skill loading. | possibly relevant if remote T3 agents must load beep skills |

## Docs/runbooks

| Path | Today | Messaging today | Verdict |
| --- | --- | --- | --- |
| `docs/runbooks/agent-messaging.md` (304) | Local agent-message mailbox: startup, send/observe, delivery/recovery, disposal (`:1-16`). | "Existing T3-owned threads" (`:253-304`): attach-t3, peer wrapper, queue-only, read→send race, no blind resend. | **edit**: reframe around T3 as primary; add remote environments; keep recovery semantics. |
| `docs/runbooks/agent-notifications.md` (97) | Permission-request desktop notifications for Claude/Codex hooks. | "T3 Code and Grok: no automatic integration in this hook" (`:50-53`). | **extend**: T3 surfaces its own approvals; decide whether the hook routes to T3. |
| `docs/runbooks/agent-permission-continuity.md` (184) | Desktop continuation permission traps. | `send_message_to_thread` continuation caveats (`:10`, `:35`). | **edit (small)**: add T3 runtime-mode/policy readback as the continuity check. |
| `docs/runbooks/agent-pools.md` (641) | Pool order, launch recipes, meters (`:5-45`). | Workers never delegate onward; orchestrator owns launches (`:33`, `:44-45`). | **extend**: T3 launch recipes per provider/host. |
| `docs/runbooks/systemd-timers.md` (195) | Research/refs timers. | None; references the upstream t3code clone (`:27`). | unaffected |
| `docs/runbooks/cloud-environments.md` (225) | Vendor cloud VMs. | Orchestrator submits `codex cloud exec` (`:186-190`). | unaffected |
| `docs/product/workspace-substrate.md` (96) | Product vision; names T3 Code as a unified surface (`:21`). | None. | unaffected |
| `AGENTS.md` "Autonomy" | One orchestrator; role via orchestrate skill + `session open` (`AGENTS.md:256-262`). | Implicit. | **edit (small)**: name T3 as the session-messaging route. |
| `AGENTS.md` constrained compute | Push to hosted CI after a 10-minute admission/gate wait (`AGENTS.md:291-298`); heavy work in `agent-runs.slice` (`:308-312`). | n/a | **extend**: add "spill agent turns to a remote T3 host" beside "push to hosted CI". |

Runbooks searched and NOT FOUND: a remote/worker runbook under
`docs/runbooks/` (worker procedures live in the skill and in
`goals/cloud-agent-readiness/ops/`, e.g. `tbk-worker-runbook.md`).

## Handoff / ledger mechanism (used by operator-handoff)

- `~/.cache/beep/orchestrator/HANDOFF.md` (hand-written from the template),
  `briefs/*.md`, `STATE.md` journal; `~/.local/state/beep/sessions/<repo>.jsonl`
  (role holder, `session note --role orchestrator`) and
  `~/.local/state/beep/orchestrator/<repo>.jsonl` (register)
  (`.claude/skills/orchestrate/SKILL.md:145-155`).
- CLI: `packages/tooling/tool/cli/src/commands/Session/` (`Session.command.ts:281`,
  `Register.command.ts:93`, `:177`, `:248`; `SessionLedger.service.ts`,
  `Continuity.*`). SessionStart hook prints `session open`
  (`.claude/hooks/session-ledger.sh`).
- Nothing commits; handoff names machines and sessions
  (`.claude/skills/operator-handoff/SKILL.md:119-120`).
- Verdict: **extend** (register kind, route column); mechanism unchanged.

## Routing + model manifest

- Doctrine: `AGENTS.md` "Volume pools" (`AGENTS.md:8-60`); records in
  `goals/agent-pool-doctrine/history/` (2026-10-01 chains, 2026-10-14 refresh,
  2026-10-18 Codex as Claude step 2). Goal state: active.
- Manifest: `~/.config/beep/models.yaml` (outside the repo;
  `packages/tooling/tool/cli/src/commands/Models/Models.paths.ts:74`), seeded
  from `Models.seed.ts:200` (bindings) and `:237` (superseded). `beep models
  check/apply` in `Models.command.ts`; `beep accounts` in
  `commands/Accounts/` (quota meters, TUI).
- Surfaces: `codex-cli codex-plugin proxy-workflow cursor-seat grok-cli
  claude-code jetbrains-codex junie-cli`
  (`Models.manifest.schemas.ts:142-151`). **No T3 surface** (NOT FOUND); T3
  thread model selections (`modelSelection.options` effort ids) are a distinct
  effort vocabulary (`AgentMessage.attached.command.ts:62-70`).
- Verdict: **extend**: add a `t3-code` surface so `beep models check` can audit
  T3 provider instances and the attach profile stops hardcoding pins.

## Compute signals

- **Palantiri `host-pressure` parcel** (exists, local host only):
  `packages/tooling/library/palantiri/src/HostPressure.ts:50-55`; parses
  `/proc/pressure/{cpu,memory,io}` lines (`some`/`full`, avg10/avg60/avg300,
  total; `HostPressure.models.ts:36`, `:63`, `:94-182`), plus `/proc/meminfo`
  and scheduler admission slots (`:258`, `:400`). Freshness bound 1 minute,
  keyed by host. Read with `bun run beep palantiri parcel host-pressure
  [--json]` or the `palantiri mcp` stdio server
  (`commands/Palantiri/Palantiri.command.ts:380-397`; parcel registry
  `Parcels.service.ts:218`, `:469`). Sibling `account-headroom` parcel covers
  quota.
- **Quality scheduler admission**: machine-budget backpressure with a
  journal (`packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts:1728`,
  `AdmissionJournal.ts`, `commands/Ci/HeavyAdmission.ts`); `beep-heavy`
  wrapper; `agent-runs.slice` limits per host (`hosts.md:21-24`, `:35-36`,
  `:83`).
- **Policy that reads a signal**: only the operator's 10-minute
  "constrained compute → hosted CI" rule (`AGENTS.md:291-298`). It reads a wait
  time, not PSI. No rule spills agent turns to another host (NOT FOUND).
- **Remote pressure**: no cross-host reader. Palantiri reads the local `/proc`
  only; `fleet-telemetry-tailnet` (P0) is the planned transport (NOT FOUND as
  shipped).

## Edit candidates

| Path | Change | Why |
| --- | --- | --- |
| `.claude/skills/orchestrate/SKILL.md:15-141` | Rewrite the route table and T3 section so T3 (`t3_thread_send`/`launch`/`wait`, per environment) is the default; keep native `SendMessage`/Codex collab and managed `agent_message_*` as fallbacks; add host selection. | Core of the ask; today T3 is one row of five. |
| `.claude/skills/orchestrate/HANDOFF.template.md:75-94` | Add environment/host + thread columns; T3 recipe lines. | Successor must reach T3 threads from files alone. |
| `.claude/skills/operator-handoff/SKILL.md:48-73` | Re-arm attach-t3 workers / T3 MCP clients; broadcast through T3. | Take-over currently assumes native/Desktop routes. |
| `.claude/skills/remote-development-agents/SKILL.md:21-60`, `references/hosts.md` | Add "launch the agent turn in the host's T3 environment"; add grok-bot-box-1 and tom-pc-1 profiles (or state they are out of scope). | Remote dispatch is SSH + systemd only; two target hosts absent. |
| `.claude/skills/closeout/SKILL.md:13-18` | Route wording. | Consistency. |
| `.claude/skills/yeet/references/monitor-and-inbox.md:131-148` | Optional: dead-owner wave resumes a T3 thread. | Codex owners always escalate today (`:146-147`). |
| `docs/runbooks/agent-messaging.md` | Lead with T3; remote environments; keep recovery rules. | It is the runbook the skills link to. |
| `docs/runbooks/agent-notifications.md:50-53` | Decide T3 approval/notification integration. | Stated gap. |
| `docs/runbooks/agent-pools.md` | T3 launch recipes per provider and host. | Launch recipes are per-CLI today. |
| `AGENTS.md:256-262`, `:291-298` | Name T3 as the messaging route; add a remote-spill clause next to constrained compute. | Always-loaded law. |
| `packages/drivers/t3-code/src/T3Code.service.ts:32` | Allow an authenticated remote origin (or document SSH forward as the only path); add `t3_thread_launch`. | Loopback pin blocks remote hosts; no launch op. |
| `packages/tooling/tool/cli/src/commands/AgentMessage/AgentMessage.attached.command.ts:61-71` | Read pins from the models manifest. | Hardcoded models drift from `beep models`. |
| `packages/tooling/tool/cli/src/commands/Session/Register.schemas.ts:61-67` | Add a `t3-thread` (or `remote-environment`) kind. | Register cannot express T3 units. |
| `packages/tooling/tool/cli/src/commands/Models/Models.manifest.schemas.ts:142-151` | Add a `t3-code` surface. | T3 provider settings are unaudited. |
| `explorations/cross-provider-agent-communication/MAP.md:13-14` | Point `orchestrator-live-coordination` / `agent-communication-federation` at this packet. | Avoid two owners of the same gate. |

## Gaps

- **Substrate decision**: T3 native messaging (`t3_thread_send`) vs. Beep's
  durable mailbox over T3 (`attach-t3`). The shipped design keeps Beep grants
  and receipts on top and treats T3 OAuth as broader authority
  (`docs/runbooks/agent-messaging.md:298-304`). Choose one primary.
- **Remote T3**: only beep-worker has a T3 service receipt. No receipts for
  dankserver, tbk-worker (listed as not enabled), grok-bot-box-1 (appears only
  as a telemetry host in `explorations/observability-palantiri/RESEARCH.md:139`),
  or tom-pc-1 (Codex app-server bridge, Windows, not T3). Federation is an
  explicit deferred gate.
- **Driver**: loopback-only URL, queue-only send, no launch, no multi-environment
  config. MCP auth per environment is OAuth/PKCE, not the pairing token.
- **Role addresses** remain unsupported at dispatch (`MAP.md:26-29`); the
  orchestrator still addresses sessions directly.
- **No cross-host compute signal** and no rule that spills agent turns off the
  workstation; PSI exists locally only.
- **No T3 surface** in the model manifest; no `t3-thread` register kind.
- **Junie/Grok** get no orchestration skills in-repo (`.junie/skills` has only
  `adhd`; no `.grok` skills), so T3-hosted Grok threads rely on `AGENTS.md`.
- **Notifications**: T3 approvals are not wired to the sequence-break hook.
- NOT FOUND: a Beep CLI command that wraps T3 launch; a `HANDOFF.md`
  renderer (`beep session handoff` is a listed follow-up only).
