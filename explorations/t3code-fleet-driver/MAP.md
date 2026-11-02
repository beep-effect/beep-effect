# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `t3-native-orchestration` | Delete beep's agent-to-agent messaging stack and its packets; rewrite the orchestrator, handoff, remote-worker and closeout skills and runbooks around T3 Code's MCP tools; clean local leftovers after merge | none | Deletion: `beep agent-message` (repo-cli `commands/AgentMessage/`), `@beep/ai-provider-cli` session half, `@beep/t3-code`, ai-metrics `observation-launch-*`, per [removal-map](research/removal-map.md); regeneration: `beep delete-package --rewrite-packets`, `beep skills relock`, lint/coverage/cache baselines. Rewrites: `.claude/skills/{orchestrate,operator-handoff,remote-development-agents,closeout}`, `docs/runbooks/{agent-notifications,agent-pools}.md`, `AGENTS.md` ([inventory](research/repo-inventory.md)). T3 side: product tools, no repo code |
| `t3code-fleet-rollout` | Run the fork build of T3 Code as a tailnet-only systemd service on every worker host, distributed by a DankStation publish + host pull, linked hub-and-spoke | `t3-native-orchestration` (host profiles land in the rewritten `remote-development-agents`) | Existing `~/.local/bin/update-t3code-source` + `t3code-source-update.timer` (extend: pack + publish); beep-worker's existing `t3code.service`; `t3 service install`, `t3 serve --tailscale-serve`, `t3 environment link` (product, [capabilities](research/t3code-capabilities.md)); host routes in `remote-development-agents`. NET-NEW: tailnet-only bundle endpoint and per-host pull timer (host-side scripts, out of repo; runbook in repo) |
| `t3code-harness-mcp` | Register `t3-hub` (DankStation environment, Full-access OAuth) in every harness that runs outside T3 on every host; prove no double-load; renewal reminders for 30-day grants and links | `t3code-fleet-rollout` for remote hosts (DankStation can start immediately) | Harness `mcp add` CLIs and config files ([surfaces](research/harness-mcp-surfaces.md)); reminder timers (`docs/runbooks/systemd-timers.md`). No repo writer: `agent-config-canonicalization` stays an INBOX item |
| `t3code-spill-routing` | Advisory rule in `orchestrate`: read host pressure before substantive work and launch on the next host in spill order through T3 when DankStation is constrained | `t3-native-orchestration`, `t3code-fleet-rollout` | Palantiri `host-pressure` parcel (`bun run beep palantiri parcel host-pressure --json`); 7-day PSI baseline ([fleet-hosts](research/fleet-hosts.md)); T3 `t3_thread_launch`/`delegate_task` with `environmentId`. NET-NEW: threshold table + rule text only |

Gated candidates (re-entry points; not graduated now):

| Slug | Gate |
| --- | --- |
| tbk-worker leg of `t3code-fleet-rollout` | Operator releases tbk-worker's protective-stop latch |
| `t3code-spill-dispatcher` (automatic dispatch) | The advisory rule has run long enough to show a real need |
| grok-bot-box-1 as a Grok-only sandbox | Operator wants it and grants tailnet access |

## Sequencing

1. `t3-native-orchestration` comes first. It is repo-only, clears the
   competing stack, and gives the other goals one set of skills to extend.
   It can be launched from a T3 session on DankStation today.
2. `t3code-fleet-rollout` comes next. It is host operations and depends on
   the rewritten `remote-development-agents` for host profiles. beep-worker
   goes first because it already runs T3, then dankserver, then tom-pc-1.
3. `t3code-harness-mcp` can start on DankStation in parallel with step 2;
   the other hosts follow as each one comes up.
4. `t3code-spill-routing` comes last. It needs live hosts to route to and an
   explanation for the MemAvailable-0 sample before the thresholds are set.

## First Vertical Slice

`t3-native-orchestration` lands as one PR. After it merges:
- `rg -n 'agent-message|agent_message|@beep/t3-code' --glob '!**/history/**'`
  returns only retirement records;
- `vp`/CI gates are green;
- an orchestrator session in T3 on DankStation follows the new `orchestrate`
  skill to launch a Codex thread and a Claude thread, exchange a
  send/reply/ack through `t3_thread_send`/`t3_thread_wait`, and record the
  receipt in the goal's `history/`.

## Open Risks Inherited From The Brief

- Linked environments are a beta. If a link is unreliable, fall back to
  per-environment client connections and record it; never build a relay.
- T3 OAuth covers a whole environment. Full-access links go only to
  provisioned worker hosts.
- `t3 service` under systemd in WSL is unproven. If it fails, the desktop
  app stays open on tom-pc-1.
- The bundle depends on architecture and Node version. Pin the Node range in
  the published metadata.
- T3's own updater must not overwrite the fork build on hosts; disable or
  verify it.
- Provider credentials stay each host's own logins.
- Deleting `explorations/cross-provider-agent-communication` breaks this
  packet's relative links to it. Goal 1 rewrites them as `retired:<slug>`
  plus a commit permalink.
- `t3-hub` at user scope may double-load inside T3-launched sessions. Check
  this before rolling out beyond DankStation.
