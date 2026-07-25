# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. The exploration is shaped when the human says
this file matches the picture in their head.

STATUS: DRAFT SKELETON (pre-seeded during research for the P3 oracle review).
The shape stage revises this with the human; appetite is theirs to set.
-->

## Problem

Running OpenClaw well is imperative, drift-prone ops. dankserver's Ansible
openclaw role is 4790 lines / 252 tasks that patch live `openclaw.json`
through the CLI, binary-patch installed bundles, and hand-manage plugins,
versions, and channel secrets. The community independently confirms the
premise: config breaks on updates, agents edit their own config, and the
folklore mitigations (git-tracked config, `.last-good` backups,
"config set only" rules) are people hand-rolling a declarative owner
([`research/x-com-field-notes.md`](./research/x-com-field-notes.md)).

Meanwhile this repo already has an Effect-native Pulumi workspace with a
proven schema-decoded-config + secret-ref + preflight→apply→health pattern
(`infra/src/AIMetrics.ts`), and OpenClaw itself ships the declarative seams we
need: an immutable-config mode (`OPENCLAW_NIX_MODE=1`), config
schema/validate, runtime `op://` secret resolution, and lockfile-based skill
installs ([`RESEARCH.md`](./RESEARCH.md)).

Why now: a new professional, legal-focused agent is wanted on the workstation
— greenfield ground to prove the declarative platform before migrating
dankserver's openclaw layer onto it. Enabling substrate for
agentic-professional-runtime (dogfooding + ops learning), firewalled from
product work.

## Appetite

DRAFT — to be set by the human at shape. Proposed frame: one focused build
cycle for the workstation slice (driver schema + stack + deployed healthy
agent), with the dankserver migration as a separate, second goal that spends
its own budget. If the workstation slice threatens to exceed its cycle, cut
channel count or the proof skill — never the immutable-config posture or the
typed schema, which are the point.

## Solution Sketch

Two artifacts, one pattern (decisions 1, 6, 7, 13):

1. **`packages/drivers/openclaw` (`@beep/openclaw`)** — flat drivers-family
   wrapper, role files like `onepassword-cli`/`tailscale`:
   - `OpenClaw.config.ts`: typed Effect Schema for the `openclaw.json`
     subtree we declare (gateway, agent identity/persona wiring, one DM
     channel, model providers incl. a local OpenAI-compat profile, tool
     allowlists/sandbox guardrails, skills). Secret-bearing fields are typed
     as `OnePasswordReference` — refs are data, values never appear.
   - `OpenClaw.service.ts`: CLI process wrapper (version query, doctor,
     config validate, service control) in the ChildProcessSpawner style.
   - Gateway health probe (RPC health snapshot / `openclaw health`).
2. **`infra/openclaw` Pulumi project + `infra/src/OpenClaw.ts`** — stack in
   the AIMetrics mold: `S.Class`-decoded `openclaw:*` Pulumi config → pure
   target-agnostic renderers (config JSON, systemd `--user` unit with
   `OPENCLAW_NIX_MODE=1` + `OPENCLAW_CONFIG_PATH`, SOUL.md/persona
   artifacts) → executor chain (preflight → apply → health) that runs
   `command.local.Command` for the workstation target and later
   `command.remote.Command` for dankserver. Content-hash triggers; local
   passphrase state; `PULUMI_CONFIG_PASSPHRASE` from 1Password.

Ownership posture: **strict declarative** — the stack renders the entire
declared config file and turns on the immutable-config guard, so the runtime
(and the agent) cannot mutate it; runtime-mutable state lives wherever
upstream puts it under that mode (config-internals dive maps this
precisely). The dankserver migration inherits the renderers and flips the
executor; its bridge option is split ownership via upstream's include
mechanism if strict mode proves too aggressive for a live install.

The agent itself (v1): legal-professional persona (SOUL.md), strict guardrail
config (workspace boundary, tool/command allowlists, no client identifiers in
channel traffic), Control UI + one DM channel, hosted primary model + local
llama-server provider profile, exactly one benign proof skill installed
declaratively.

## Rabbit Holes

- **The runtime config-writer matrix.** Which subsystems write
  `openclaw.json`, and what breaks when the guard refuses them (auth-profile
  rotation? channel pairing?). The config-internals dive +
  a live prototype answer this; do not design around guesses.
- **Non-interactive systemd `--user`**: linger, `XDG_RUNTIME_DIR`, DBus
  session availability when Pulumi applies from a shell that isn't the
  desktop session. AIMetrics solved this for SSH; local needs its own check.
- **JSON5 vs JSON**: upstream reads JSON5 but its own writer re-serializes to
  JSON; our renderer must pick a canonical form and stick to it.
- **Version migrations**: `openclaw doctor` performs config migrations that
  the immutable guard blocks — upgrades become "bump declared version +
  re-render config against the new schema", which needs an explicit runbook.
- **Preview fidelity**: `command.*` resources make `pulumi preview` weaker
  than real providers; content-hash triggers mitigate but don't eliminate.
- **Schema drift vs upstream**: the Effect schema must track upstream's
  TypeBox/JSON schema across releases; `openclaw config schema` +
  `config validate` in CI is the containment.

## No-Gos

- Porting dankserver's OS-level Ansible (base/hardening/storage/monitoring/
  backups/runner) — Ansible keeps owning OS concerns indefinitely.
- Voice (cloudflared/Twilio/streaming/ElevenLabs) in the greenfield build.
- llama-server lifecycle management (it already runs; we only reference it).
- Gateway HTTP/WS API client in the driver (no consumer yet).
- dankserver bundle patches — quarantined to a shrinking Ansible remnant.
- Real legal capabilities (USPTO MCP, docketing, …) — they arrive via the
  SDK-adapter path, not this substrate packet.
- Plaintext secrets anywhere: tracked files, Pulumi state, rendered configs.
