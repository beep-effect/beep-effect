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

<!-- GATE B entries below: resolved 2026-07-24 in the post-adversarial-review
grilling. Entries marked REVISES supersede the correspondingly named earlier
entry. Four entries are prototype-gated: the graduated goal's P0 gauntlet
must confirm them, and a failed prototype re-opens the decision in the goal's
decision log. -->

## 2026-07-24 — OS-enforced config immutability (REVISES: config ownership)

**Question:** How is strict config ownership enforced at the OS level, given
the adversarial review proved `OPENCLAW_NIX_MODE=1` is an in-process policy
check that any direct file write bypasses?

**Answer:** Root-owned, hash-versioned config root —
`/etc/beep/openclaw/<content-hash>/openclaw.json`, mode 0644 root:root —
with `OPENCLAW_CONFIG_PATH` pointed at it, `OPENCLAW_NIX_MODE=1` retained as
defense-in-depth, and an independent drift audit (preflight hash check plus
recurring canary). The privileged install step joins the existing
`loginctl enable-linger` bootstrap. Prototype-gated: filesystem bypass/drift
spike.

**Rationale:** The gateway runs as the user, so user-level permissions cannot
protect a user-owned file from the user's own processes; nix's real
guarantee is the read-only store, mirrored here with plain root-owned
directories. Rejected: guard-plus-drift-repair only (leaves the
agent-edits-own-config window open between audits); `chattr +i` on the user
file (fragile toggling, no hash-versioned generations).

## 2026-07-24 — OpenClawGeneration state machine (RESHAPES: solution sketch)

**Question:** What binds package, config, unit, workspace artifacts, skills,
and plugins into one deployable revision, and how do upgrades avoid the
SQLite-migration rollback trap?

**Answer:** `OpenClawGeneration` becomes the stack's central concept: one
hash-versioned revision binding package version, rendered config, systemd
unit, workspace artifacts (SOUL.md/persona), pinned+integrity-checked
skills, and plugins. Upgrade is a staged state machine: stage side-by-side →
validate with the candidate binary → stop gateway → snapshot shared and
per-agent SQLite (including WAL) → switch one pointer → start → acceptance
probes → commit or restore. Irreversible DB migrations are pre-classified
and operator-gated. Prototype-gated: upgrade + failed-health rollback spike.

**Rationale:** SQLite schemas migrate on ordinary open and stamp
`user_version`; older binaries refuse migrated state, so naive rollback
strands the deployment. Skills are workspace mutations with their own
lockfile, not config fields. Rejected: config-only generations (leaves the
rollback trap at the package boundary); deferring the concept to the goal
(MAP would sequence work on a falsified sketch).

## 2026-07-24 — desired-intent schema + render adapters (REVISES: driver v1 scope)

**Question:** What schema contract does `@beep/openclaw` own, given the
effective upstream config contract is plugin-set-dependent and the schema
export is lossy past size caps?

**Answer:** The driver owns a small, stable desired-intent Effect schema (our
deployment intent: gateway, agent identity, one channel, providers,
guardrails, skills) plus a versioned render adapter that emits
`openclaw.json` for the pinned OpenClaw version. Acceptance is the candidate
binary's plugin-aware `config validate` plus negative fixtures; CI fails if
the schema export contains lossy placeholders for extensions we declare.
Version bumps touch the adapter, not consumers.

**Rationale:** A hand-maintained mirror of upstream's contract can never
prove coverage and churns with every release; the stack only needs OUR
intent rendered correctly and validated by the exact pinned binary.
Rejected: tracking upstream schema as closely as possible (lossy-by-design
export, permanent treadmill); validate-only with no typed intent (abandons
schema-first law on our own surface).

## 2026-07-24 — applicator contracts + identity binding (REVISES: workstation deploy shape)

**Question:** How does workstation-vs-remote apply get modeled, given local
and SSH `systemd --user` applies have different privilege/session contracts
and `command.local` proves neither drift nor target identity?

**Answer:** Renderers stay 100% shared and pure. Two explicit applicator
contracts (workstation-local, remote-SSH), each declaring target user/UID,
runtime directory, bus reachability, linger ownership, and privilege
boundary. Preflight tests the exact non-interactive context the apply uses
AND binds the stack to target identity (`/etc/machine-id` + hostname + UID),
failing before mutation on mismatch. Drift audit runs as a read-only step
outside Command resources. Prototype-gated: non-interactive user-manager
apply spike.

**Rationale:** "Flip only the executor" understates real differences: linger
is privileged, the user manager and `XDG_RUNTIME_DIR`/DBus must exist, and a
local stack silently no-ops on the wrong machine. Rejected: keeping decision
6 as-is (rediscovers enumerated failure modes live); SSH-to-self (reverses
P1 for a loopback dependency without removing the linger/identity work).

## 2026-07-24 — secrets bootstrap exception + rotation surface (EXTENDS: secrets posture)

**Question:** How do we handle (a) the 1Password service-account token that
cannot itself be an op:// reference and (b) same-reference rotation being
invisible to config hashes?

**Answer:** A recorded bootstrap exception: a tightly scoped
`OP_SERVICE_ACCOUNT_TOKEN` delivered as a root-owned systemd credential
(`LoadCredential`), provisioned out-of-band, never via Pulumi
inputs/outputs/state, with a rotation and revocation runbook; preflight runs
`op whoami` in the exact service environment. Rotation becomes an
operational surface: post-rotation `openclaw secrets reload`,
degraded-reload alerting, and an authenticated model/channel probe — all in
the acceptance-probe set. Prototype-gated: same-ref rotation/reload spike.

**Rationale:** OpenClaw resolves SecretRefs eagerly and only `secrets
reload` refreshes them; content hashes cannot see rotation. Rejected:
desktop-app integration (fails locked/absent — incompatible with unattended
boot); porting the `op run` env wrapper as-is (plaintext env for process
lifetime, restart-only rotation — strictly weaker than native refs).

## 2026-07-24 — v1 DM channel is Telegram (REFINES: channels v1)

**Question:** Which DM channel does v1 declare, now that the channel's
writeback paths get live-tested under immutable config?

**Answer:** Telegram, with `configWrites: false` rendered so its writeback
surfaces (supergroup migration, defaultTo target writeback) take their
graceful skip paths — verified live in the channel-under-guard portion of
the prototype gauntlet. Discord is a no-go until the dankserver-migration
goal.

**Rationale:** Single bot-token secret ref, no privileged-intents ceremony,
and its writeback surfaces are precisely mapped with file:line citations in
the adversarial review — the skip-path test has known targets. Rejected:
Discord (higher-unknown writeback surface, heavier setup); deferring to
build time (leaves the first-slice prototype unspecifiable in MAP).

## 2026-07-24 — state backup mitigation (REVISES: Pulumi state backend)

**Question:** Does the single-disaster-domain problem (local Pulumi state +
application state + sole operator on one workstation) get mitigated now?

**Answer:** The local passphrase backend stands (consistency with every
existing stack), and the apply runbook gains an automated encrypted
off-machine state backup step (state file to dankserver over Tailscale;
passphrase remains only in 1Password). SQLite generation snapshots leave the
machine the same way. The remote-backend decision explicitly re-opens at the
dankserver-migration goal.

**Rationale:** Command-backed resources cannot reconstruct lost state via
refresh, so backup is cheap insurance against an orphaned deployment.
Rejected: standing up a remote backend now (reverses a fresh consistency
decision, adds a service dependency to a workstation-only v1); accepting the
risk unmitigated.

## 2026-07-24 — prototypes are the goal's P0 gauntlet (CLOSES: research openQuestions)

**Question:** Do the four gating prototypes run inside this exploration
before shaping, or as phase 0 of the graduated goal?

**Answer:** Goal P0. The four spikes — filesystem bypass/drift,
non-interactive user-manager apply, same-ref rotation/reload, and
upgrade-plus-failed-health rollback across SQLite schema stamps — become the
graduated goal's phase P0 and hard-gate all implementation phases. Each
GATE B decision above records its gating prototype; a failed prototype
re-opens that decision in the goal's decision log. The exploration's
openQuestions close as explicitly-deferred-with-rationale, satisfying the
graduation definition-of-ready.

**Rationale:** Explorations are docs-only; the goal packet is where code
(even disposable code) lives, and the spikes get built properly there
anyway. Rejected: spiking during P4 (blocks shape/decompose for days inside
a docs surface); splitting only the filesystem spike forward (it is the
least uncertain of the four).
