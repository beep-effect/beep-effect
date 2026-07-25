# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.

Entries 1-5 were locked at mission scoping; entries 6-14 were resolved in the
2026-07-24 intent interview (recommendation-first grilling, one branch at a
time). The align stage revisits none of these without an explicit recorded
revision entry.
-->

## 2026-07-24 — placement hypothesis (mission-locked)

**Question:** Where does this work live in the repo topology?

**Answer:** Extend `infra/` for deploy stacks; add `packages/drivers/openclaw`
(`@beep/openclaw`) for the SDK/service wrapper; `tooling/*` only if repo-owned
generators/automation emerge.

**Rationale:** Matches `standards/architecture/07-non-slice-families.md`
routing: external SDK/service wrappers are flat `drivers` family; `infra/` is
the established Pulumi workspace. The align stage confirms this formally
against doctrine — starting from these hypotheses, not from scratch.

## 2026-07-24 — one packet, workstation-first (mission-locked)

**Question:** One exploration packet or several; which use case drives?

**Answer:** Single packet. Driving use case = the greenfield workstation
legal agent. dankserver migration is the second goal candidate in MAP.md,
informed by what greenfield proves.

**Rationale:** Greenfield proves the declarative platform on the lowest-risk
target before the migration bets on it.

## 2026-07-24 — OpenClaw layer only (mission-locked)

**Question:** Does the port cover dankserver's full Ansible control plane?

**Answer:** No. Porting base/hardening/storage/monitoring/backups/runner is an
explicit no-go for BRIEF.md. Ansible keeps owning OS-level concerns
indefinitely.

**Rationale:** The openclaw layer is the weak seam; the rest of the control
plane works and is not this packet's problem.

## 2026-07-24 — enabling substrate, firewalled (mission-locked)

**Question:** How does this relate to agentic-professional-runtime product
work?

**Answer:** Enabling substrate — dogfooding ground and ops learning — not
product work. Implementation follows `/effect-first-development` and
`/schema-first-development`.

**Rationale:** The SDK-context contract
(`goals/agentic-professional-runtime/docs/sdk-context-packet-contract.md`)
already positions OpenClaw as a thin adapter over the runtime SDK; the
deployment platform must not grow product semantics.

## 2026-07-24 — secrets posture (mission-locked)

**Question:** How do secrets travel?

**Answer:** 1Password `op://` references everywhere — `/onepassword-secret-refs`
rules, `drivers/onepassword-cli` for typed access, the `infra/` `*SecretRef`
pattern for stacks. Never plaintext in tracked files or state.

**Rationale:** dankserver is already 1Password-native (central ref map,
`op run` systemd wrapper); the repo's infra stacks already model secrets as
`*SecretRef` strings resolved at deploy. Port the pattern, don't reinvent it.

## 2026-07-24 — workstation deploy shape

**Question:** How should the greenfield workstation stack execute deploy steps
(systemd `--user` units, config writes, health checks)?

**Answer:** `command.local.Command` for the workstation target, with all
script/config rendering target-agnostic so the future dankserver stack flips
only the executor to `command.remote`. Deploy target modeled as a tagged union
à la `AiMetricsDeployTarget`.

**Rationale:** The real risk is the declarative rendering layer, not command
transport — AIMetrics already proves the remote path (preflight→apply→health
over Tailscale SSH). Rejected: SSH-to-self via Tailscale (max parity but adds
sshd/key loopback for no rendering-risk coverage); Pulumi Automation API
in-process mutations (most Effect-native but diverges hardest from the proven
pattern and would make the migration a second architecture).

## 2026-07-24 — config ownership vs live-JSON drift

**Question:** What posture toward `~/.openclaw/openclaw.json`, given
OpenClaw's runtime also writes to it (auth profiles, channel state)?

**Answer:** Full-file ownership, research-gated: aspire to render the entire
file from the typed Effect schema, with runtime-mutable state relocated to
whatever separation OpenClaw natively supports (P3 source-dive of
`~/YeeBois/dev/openclaw` decides). If research proves runtime state is
inseparable, fall back explicitly to managed-subset merge — recorded as a
decision revision, not silent drift.

**Rationale:** dankserver's role imperatively patches the live JSON across
~250 tasks — the seam this port exists to kill. Rejected: managed-subset merge
from day one (keeps a merge seam forever); env/flags only (likely too limited
for channels/models/skills).

## 2026-07-24 — channels v1

**Question:** What channel surface does the workstation agent need in v1?

**Answer:** Gateway + local Control UI plus exactly one DM channel (Discord or
Telegram, picked at build time). Voice is an explicit BRIEF no-go.

**Rationale:** One channel proves the channel-config + secret-ref pattern
without dragging the voice stack (cloudflared + Twilio + xAI streaming +
ElevenLabs — the gnarliest chunk of the Ansible role) into a greenfield proof.
Rejected: Control UI only (never exercises channel secrets/auth — the part the
migration needs most); channel parity with dankserver (maximum coverage,
maximum drag).

## 2026-07-24 — models v1

**Question:** What model posture does the v1 config declare?

**Answer:** Hosted frontier model primary; local llama-server registered as an
OpenAI-compatible provider profile. llama-server lifecycle stays out of stack
scope (it already runs on the workstation).

**Rationale:** Proves multi-provider declarative config without new moving
parts, and uses the workstation's real local capacity. Rejected: hosted-only
(skips the multi-provider shape the migration needs); local-first (bets v1
agent quality on local models and pulls llama-server lifecycle into scope).

## 2026-07-24 — legal focus v1

**Question:** What makes the v1 agent "legal-focused" concretely?

**Answer:** Legal-professional persona/system prompt, strict guardrails as
typed config (workspace boundary, tool/command allowlists, confidentiality
posture: no client identifiers in channel traffic), and exactly one benign
proof skill to prove declarative skill installation. Real legal capabilities
arrive later via the SDK-adapter path, firewalled from this packet.

**Rationale:** Keeps the substrate/product firewall intact while still proving
the persona/guardrail/skill config surface. Rejected: wiring existing repo
legal surfaces (USPTO MCP, docketing) now — breaches the firewall; generic
agent with legal framing later — never proves the config surface that makes
the deployment worth porting.

## 2026-07-24 — research clones & vendoring

**Question:** Vendor OpenClaw into `.repos/openclaw/` for this exploration?

**Answer:** No — use the existing clone at `~/YeeBois/dev/openclaw` (pinned
SHA cited in `research/SOURCES.md`). Broader convention: any repo found
valuable for implementation or style — especially anything Effect-involved —
gets cloned to `~/YeeBois/dev/` for the human to inspect, cited pinned.
Vendoring into `.repos/` is deferred as a MAP-level option, triggered only if
the `@beep/openclaw` driver needs in-tree types/fixtures.

**Rationale:** Keeps the public repo lean; the `.gitleaks.toml` allowlist
stays ready if the trigger fires. Rejected: vendor now (repo size + subtree
maintenance before a proven need); docs-only (full-file ownership research
needs source access docs won't answer).

## 2026-07-24 — Pulumi state backend

**Question:** Where does Pulumi state live for the new stacks?

**Answer:** Local file backend + passphrase encryption,
`PULUMI_CONFIG_PASSPHRASE` resolved from 1Password at deploy time — identical
to every existing stack. Remote state is noted in MAP.md as a
dankserver-migration-phase consideration only.

**Rationale:** Decide-by-consistency: ai-metrics, oip-web, and storybook all
use this pattern; single operator, machines owned, tailnet-only. Rejected:
self-managed remote backend (solves a coordination problem that doesn't exist
yet); Pulumi Cloud (third-party dependency, stack metadata off-machine —
awkward against the tailnet-only, 1Password-native posture).

## 2026-07-24 — @beep/openclaw driver v1 scope

**Question:** What does the driver wrap in v1?

**Answer:** Typed `openclaw.json` schema (the crown jewel — what full-file
rendering consumes), a CLI process wrapper in the `onepassword-cli` style
(version query, doctor, service control), and a gateway health probe. Gateway
HTTP/WS API client deferred until a real consumer (the SDK adapter) exists.

**Rationale:** Exactly what the deploy stack consumes; nothing speculative.
Rejected: adding the gateway API client now (no in-repo consumer yet);
schema-only (leaves version pinning and health as untyped shell strings — the
imperative pattern this port retires).

## 2026-07-24 — dankserver bundle patches (migration candidate posture)

**Question:** What happens to the ~100 Ansible tasks that binary-patch
installed OpenClaw bundles (Control UI service worker, xAI providers, gateway
constants, media allowlist)?

**Answer:** Quarantined — the Pulumi migration ports
install/config/units/secrets/plugins only. Bundle patches stay in a shrinking
Ansible remnant, assessed case-by-case for upstreaming or dropping during
migration-goal shaping (which may revise this).

**Rationale:** They are the most fragile, release-coupled part of the role;
porting them would import the worst of the old control plane into the new
stack on day one. Rejected: porting patches declaratively (one control plane,
but version-coupled binary edits as Pulumi resources); full deferral (leaves
the migration candidate's appetite unshapeable in MAP.md).
