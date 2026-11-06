# T3 Code Fleet Rollout Spec

## Objective

Every live worker host runs the same fork build of T3 Code as a tailnet-only
systemd service. DankStation reaches each one as a Linked environment, so an
orchestrator in a DankStation T3 session can launch and message threads on
any host.

Graduated from [explorations/t3code-fleet-driver](../../explorations/t3code-fleet-driver/README.md).
Settled decisions are in its [DECISIONS.md](../../explorations/t3code-fleet-driver/DECISIONS.md):
`fork-distribution`, `build-distribution-transport`, `tom-pc-1-environment`,
`grok-bot-box-1`, `link-topology` and `tbk-worker`. Host facts:
[fleet-hosts.md](../../explorations/t3code-fleet-driver/research/fleet-hosts.md).
T3 product facts:
[t3code-capabilities.md](../../explorations/t3code-fleet-driver/research/t3code-capabilities.md).

## Non-Goals

- tbk-worker until the operator releases its protective-stop latch. The
  steps are written down, but they do not run before then.
- grok-bot-box-1, Hyper-V on tom-pc-1, T3 Connect, Tailscale Funnel, and
  any public listener.
- Harness MCP registration (`goals/t3code-harness-mcp`) and spill routing
  (`goals/t3code-spill-routing`).
- Copying provider credentials between hosts. Each host keeps its own
  provider logins.

## Source Hierarchy

1. The operator's 2026-11-01 ask and the exploration's DECISIONS.md.
2. `AGENTS.md`, `CLAUDE.md`, the `remote-development-agents` skill as
   rewritten by `goals/t3-native-orchestration`, and the global YubiKey
   privilege route.
3. This `SPEC.md`.
4. `PLAN.md`.
5. `GOAL.md`.

## Target Surfaces

- DankStation, out of repo: the `update-t3code-source` script gains a
  step that runs after a successful build. It packs the fork's server bundle
  together with a metadata file (fork commit, version, Node range, arch,
  SHA-256) and publishes both on a tailnet-only endpoint. Tailscale Serve on
  a dedicated path or port is acceptable; no Funnel.
- Each host, out of repo: a pull script plus a systemd user timer. It fetches
  the metadata, compares it with the installed stamp, downloads the bundle,
  verifies its SHA-256, installs it, and restarts the host's `t3 service`
  unit. Linger is enabled so the service survives logout. T3's own updater
  is disabled, or verified unable to overwrite the fork build.
- beep-worker: convert the existing `t3code.service` to the fork build and
  the pull timer.
- dankserver: a new install that respects the one-job admission rule and the
  7 GiB `agent-runs.slice`.
- tom-pc-1: a new dedicated WSL distro for agent work. `/mnt/c` automount
  and Windows interop are off, and it has its own Linux user and its own
  credentials. The existing Ubuntu distro is preserved untouched. Prove
  `t3 service` under systemd inside the distro first. If that fails, use the
  desktop app's WSL backend and record that the app must stay open.
- tbk-worker (gated): SSH-forward-only exposure per its network design.
- Every host: Tailscale HTTPS for T3's listener, and hub-and-spoke
  `t3 environment link` from DankStation with full access, with Labs
  "Linked environments" enabled at both ends.
- In repo: a new `t3code-fleet` runbook under the runbooks docs, covering publish and pull,
  per-host install, link and renewal, and rollback to the previous bundle.
  Also the host profiles in `.claude/skills/remote-development-agents/`.

## Constraints

- Every remote action goes through the host's approved route in
  `remote-development-agents`, using its YubiKey wrapper. Privileged local
  steps use `yubi-sudo`. Announce each touch, serialize touches, and follow
  the global retry rules.
- tom-pc-1 is the attorney's in-use PC at the strict telemetry tier. Work
  inside its user's authorization, coordinate anything visible to them, keep
  listeners tailnet-only or loopback, and keep client data out of the repo.
  Restoring a working access route (SSH key authentication is currently
  rejected) is part of this goal's P0.
- The bundle must match each host's architecture and Node range; the pull
  script refuses a mismatch.
- Keep the previous bundle on each host for rollback.
- The public repo carries no tailnet names, addresses, environment IDs,
  pairing codes or tokens.

## Acceptance Criteria

- [ ] A DankStation fork sync publishes a bundle and metadata. Each live
      host's timer installs the bundle unattended, and every host then
      reports the same fork commit.
- [ ] beep-worker, dankserver and tom-pc-1 each run T3 as a service that
      survives a reboot (tom-pc-1: or the recorded desktop-backend
      fallback). Each is reachable over Tailscale HTTPS only.
- [ ] DankStation lists each host as a Linked environment. A thread launched
      from DankStation on each host completes one trivial turn, and a
      sanitized receipt is recorded in `history/`.
- [ ] The tbk-worker steps are written and marked gated.
- [ ] The runbook and host profiles are merged through `/yeet`.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Version parity | Each host's installed stamp equals the published metadata | Equal |
| Service | `systemctl --user is-active` on each host (or the recorded fallback) | active |
| Reachability | Tailscale HTTPS fetch of each host's T3 health endpoint from DankStation | 200 |
| Link round trip | `history/` receipt for each host | One completed turn each |
| Repo | `bun run beep yeet verify` | Passes |

## Stop Conditions

- tom-pc-1 access cannot be restored without the PC user's involvement.
  Report it and hold that host.
- A host needs a sudo or OS change beyond installing T3 and its timer.
  Report it.
- Any spend.
- The same blocker repeats after reasonable investigation.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-11-01 | Build once on DankStation; hosts pull a hash-verified bundle | Same version everywhere, unattended, no per-host touch | Switch hosts to npm `t3` releases |
| 2026-11-01 | tom-pc-1 uses a new WSL distro, superseding the 2026-10-26 Hyper-V design | No Hyper-V enablement or reboot | Enable Hyper-V per the prior design |
| 2026-11-01 | Hub-and-spoke links from DankStation | Fewest links, one place to revoke | Add peer links |

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug t3code-fleet-rollout`; add a `kind: decision` file there, never edit this block._

### dankserver T3 reaches the tailnet through a Serve route, not a wider bind, 2026-11-06

dankserver's T3 service stays bound to 127.0.0.1:3773 under its worker-boundary drop-in. The administrator adds one tailnet-only Tailscale Serve route (HTTPS 8448, proxy to the loopback listener), because port 443 already fronts other services there and the worker account has no Tailscale operator rights. The hub links over the https .ts.net name on that port. No Funnel, no LAN bind, no worker privilege change.

Lane `t3code-fleet-p1b`

Reverse: Run tailscale serve --https=8448 --set-path=/ off on dankserver as the administrator; the worker service keeps its loopback bind either way

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
