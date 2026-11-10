# Host profiles

These are routing records, not live health attestations. Last reconciled:
2026-11-09 (tom-pc-1 gets its SSH/sudo wrapper, a beep-effect checkout registered as a T3 project, GitHub push and update-harnesses coverage; all five hosts at Full access, links and `t3-code` MCP tokens renew by 2027-05-07; grok-bot host in scope; fork T3 build everywhere). The canonical Beep packet is `goals/cloud-agent-readiness` at the
repository containing this skill's real path. Read `SPEC.md` before changing a
boundary. Host-specific receipts are under that packet's `history/` directory.

| Target | T3 route | Ordinary workstation connection | Readiness and boundary |
| --- | --- | --- | --- |
| `beep-worker` | `environmentId: <beep-worker>` (Full access, renew by 2027-05-07; id in the private handoff) | `ssh-beep-worker-yubi` | Existing headless development worker; default wrapper disables forwarding. Runs the fork T3 build as `t3code.service` (pulled from the DankStation mirror by `t3code-fork-pull.timer`; `docs/runbooks/t3code-fleet.md`). Recheck current provider and workload readiness. |
| `tbk-worker` | `environmentId: <tbk-worker>` (Full access, renew by 2027-05-07; id in the private handoff) | `ssh-tbk-worker` | Separate KVM guest, account `worker`, no sudo; initial serialized development verified. Runs the fork T3 build as `t3code.service` on loopback under `agent-runs.slice`, reached through Serve on the guest's own tailnet node; its tagged node has grants only for hub SSH, hub to Serve, and guest to the hub mirror (`history/2026-11-07-tbk-worker-link.md` in `goals/t3code-fleet-rollout`). |
| `dankserver` | `environmentId: <dankserver>` (Full access, renew by 2027-05-07; id in the private handoff) | `ssh-dankserver-worker` | Dedicated bare-metal account `worker`; initial serialized development verified. Runs the fork T3 build as `t3code.service` on loopback (same pull timer), reached through an administrator-owned tailnet-only Serve route on HTTPS 8448. Claude, Codex, Grok and Cursor signed in; Junie registered, not signed in. |
| `tom-pc-1` | `environmentId: <tom-pc-1-wsl>` (Full access, renew by 2027-05-07; id in the private handoff) | `ssh-tom-pc-1-wsl` (account `agent`, no sudo, nothing forwarded); `ssh-tom-pc-1-wsl --admin -tt` for the separate `agentadmin` account with touch-to-sudo | Dedicated WSL distro `t3-agent` (user `agent`, automount and interop off, own tailnet node `tom-pc-1-wsl`), kept alive by the `T3AgentWSL` logon task; runs the fork T3 build as `t3code.service` under `agent-runs.slice` with the same pull timer. Public beep-effect clone with the pinned toolchain, registered as a T3 project; GitHub push through a `gh` login; no 1Password agent credential. Claude, Codex, Grok and Muse signed in; the Cursor CLI is signed in, but T3's Cursor provider needs its own sign-in; Junie and Kimi need Install in T3's Settings → Providers. One job at a time on an in-use PC. Strict tier: no client data in the repo. |
| `grok-bot` (the Grok Bot computer) | `environmentId: <grok-bot>` (Full access, renew by 2027-05-07; id in the private handoff) | `ssh-grok-bot` (Tailscale SSH as `box`; `--admin` forwards the YubiKey agent for `pam_rssh` sudo) | Cursor-hosted Debian 13 microVM, 8 cores / 15 GiB, no systemd, sleeps minutes after the Grok Bot app's computer view closes; in scope since 2026-11-08 (decision `grok-bot-vm-in-scope`). T3 runs as `t3 serve` reconciled from the hub's `grok-bot-ensure.timer` while awake; everything re-runnable from `/workspace/bootstrap`. Attended worker only; see the runbook's grok-bot section. |

## T3 route

A host's T3 route is its `environmentId` as `t3_environment_links` lists it from
the DankStation hub environment (hub and spoke; the hosts do not link to each
other). The `<name>` placeholders above are filled in by
`goals/t3code-fleet-rollout` per host; until a host is listed there, its T3
route does not exist and the SSH wrapper is the only route. Linked environments
is a beta setting that must be on at both ends. The link's access level caps
what a remote thread may do; a full-access link runs unfenced as the remote
worker account, which is acceptable only on hosts already provisioned as agent
workers. Never write an environment id, tailnet name or address into the repo;
they live in the private orchestrator handoff.

## beep-worker

`ssh-beep-worker-yubi --admin -tt` is for explicitly authorized maintenance
only. Its forwarded fleet identity must never enter development jobs. Ordinary
access uses the same hardware key for SSH authentication without forwarding it.

Read `history/2026-10-14-linux-worker-readiness.md` for the original baseline and
the current installed slices for actual limits. Versioned initial proof-slice
settings are in `ops/agent-runs-worker.slice`: 8 GiB aggregate maximum, 200% CPU,
512 tasks and 256 MiB maximum swap. Control/observation has a separate 1 GiB
slice. Do not copy these values to another host or assume they are unchanged.
Use the installed `beep-worker-yeet` wrapper for Beep proof jobs.

## tbk-worker

Read `ops/tbk-worker-runbook.md` and
`history/2026-10-23-tbk-worker-design.md` in the packet.

- Host boundaries (as of 2026-11-07): twelve vCPUs pinned to six physical
  cores, 32 GiB guest RAM, 36 GiB aggregate host ceiling, no host swap,
  dedicated SATA allocation and disk limits. The guard's FULL profile is
  12 vCPU / 300 MiB/s / 20 000 IOPS and its THROTTLE recovery profile
  4 vCPU / 100 MiB/s / 5 000 IOPS; it returns to FULL after five clear
  minutes and only stops the guest for a boundary failure lasting 30 s or a
  sustained host failure. Startup is manual and guarded; protective stops
  never auto-restart.
- Development: one substantive job at a time; rootless Docker; shared agent
  workload slice 8 GiB, 200% CPU, 512 tasks, no swap. Observation is separate.
- Credentials: independently revocable account with read-only access to
  `BEEP_SECRETS` and `tbk-worker-development`; repository-limited GitHub token
  expires November 22, 2026. Cloud tools are installed but
  cloud sign-ins/deployment use is not authorized. Shared-vault credentials
  remain technically readable by worker jobs (D40); no item-level exclusion
  is enforced. Never copy another host's auth files.
- Native Codex/Claude/Grok/Muse inference and four proxy wrappers passed their
  bounded setup checks. Cursor authentication and sandbox startup passed, but
  its Opus subscription was quota-blocked until November 11. Refresh status
  when needed; neither installed tools nor proxy model lists prove inference.
- `ssh-tbk-worker --admin -tt` selects the separate guest administrator and
  guest-only YubiKey identity. `ssh-tbk-ubuntu --admin -tt` reaches the staking
  host for maintenance. Neither is a development session.

## dankserver

Live inventory on 2026-10-23: Ubuntu 26.04.1, four physical cores/eight threads,
16 GiB RAM. Existing monitoring, Phoenix and web services share this host.
The operator chose bare metal rather than a VM. OpenClaw retirement and worker
admission must be recorded separately; do not infer permission to erase its data.

`ssh-dankserver-yubi -tt` is the existing administrative route. It forwards a
privileged SSH identity and the account belongs to sudo and privileged Docker
groups. It is **not** an ordinary agent launch route. Read the
[dankserver control repository](https://github.com/kriegcloud/dankserver).
For local checkout discovery, use Codex Desktop's `list_projects` tool and its
returned project paths when available. If it has no matching local project,
or the tool is unavailable, use bounded directory discovery:

```sh
find "$HOME" -maxdepth 4 -type d -name dankserver -print
```

Verify a candidate's Git origin identifies `kriegcloud/dankserver`, then inspect
its `git status --short` and preserve existing changes. If no matching checkout
is found, or several match, ask the operator which existing checkout to use;
do not create a replacement clone or modify an unverified candidate.

Use `ssh-dankserver-worker` for ordinary work, without an agent forwarded.
If the dedicated workstation SSH agent is missing after a session restart,
initialize it with `ssh-dankserver-yubi -G >/dev/null`, then use the worker
wrapper. The configuration-only invocation loads the existing key handle
without opening an administrative connection. Keep the usual serialized
YubiKey touch and notification route for the worker login.
The root-owned parent budget is 8 GiB RAM, 200% CPU time, no worker swap and
2,048 tasks across worker sessions/services. Its 256 GiB home filesystem uses
the existing root disk. The shared `agent-runs.slice` is smaller: 7 GiB maximum,
6 GiB high threshold, 200% CPU, no swap and 1,024 tasks. Run one substantive job
at a time; background Docker/proxy services share the parent budget.

The boundary checks, rootless Compose probe, frozen Beep installation,
representative package checks, reference graph/query and native Codex inference
and tool-use fixture passed. Codex used `gpt-6.1-sol` with medium reasoning in
its normal workspace-write restriction; an independent recheck passed the
fixture's tests. Native Claude also completed sign-in and a bounded
`claude-fable-5-1` / medium coding fixture, with zero permission denials and
an independent passing test run. Use explicit model/effort flags. Native Grok
authentication and a bounded `grok-4.7` / medium inference check also passed;
its usage record reports `grok-4.7-build`. Cursor is signed in and its required
sandbox started, but Opus inference is quota-blocked until November 11, 2026.
Muse is signed in, but its `muse-wonder-1.0` / medium test returned a subscription
quota error with reset `2026-10-26T00:00:00Z`. Do not buy usage or substitute
models to bypass these limits.

The loopback proxy has separate Codex/Claude/Grok/Meta credentials. `claudex`,
`claudep` and `claudeg` returned exact markers using their approved model/effort
pins. `claudem` is configured but remains unqualified for inference under the
same Meta quota hold. After proxy restart, all four credentials and model
families remained available and all 22 worker-boundary checks passed. Model
listing is persistence evidence, not proof of Meta inference.
Read `history/2026-10-23-dankserver-development.md`
for the evidence boundary. OpenClaw was disabled with its data retained.

The worker's dedicated service account can read `BEEP_SECRETS` and
`dankserver-worker-development`, with no environment or vault-creation access.
Both dedicated worker accounts were corrected and their old accounts revoked
after verification on October 24 UTC. Beep-worker's existing account was
verified to see only `BEEP_SECRETS`. Vault visibility does not authorize using
every credential in it or performing cloud deployments.

## tom-pc-1

A Windows PC whose agent environment is the dedicated WSL distro `t3-agent`
(exploration ruling 2026-11-01, provisioned 2026-11-06): Ubuntu 26.04, Linux
user `agent` with its own credentials, `/mnt/c` automount and Windows interop
off, systemd on, hostname `tom-pc-1-wsl`, its own `tailscaled` node (decision
2026-11-06: the Windows node carries an unrelated Funnel route and gains no T3
listener). The existing `Ubuntu` distro is untouched. A logon scheduled task
(`T3AgentWSL`) keeps the distro running, which is also how it returns after a
reboot. Strict-tier rules apply: no Funnel, a tailnet-only or loopback
listener, no client data in the repo. Provisioning, the T3 service and the
link were `goals/t3code-fleet-rollout` work (now archived); the steps are in
`docs/runbooks/t3code-fleet.md`. The host is reachable only while the PC is on
and its Windows user is signed in.

Access (2026-11-07, receipt
`goals/cloud-agent-readiness/history/2026-11-07-tom-pc-1-wsl-worker-access.md`):
the distro runs its own sshd on its tailnet node, ED25519-SK keys only with
touch required, no password or keyboard-interactive login, no root login, and
`AllowUsers` limited to tailnet source addresses. Authorized keys live under
`/etc/ssh/authorized_keys/`, not in home directories. Two accounts, like
tbk-worker:

- `agent`: the development and T3 service account; no sudo, no agent
  forwarding, local forwards to loopback only. `ssh-tom-pc-1-wsl` logs in here
  with a dedicated distro-only YubiKey identity (its own `ssh-agent`, one key)
  and never forwards it. The PC's drives are not mounted, so the checkout never
  sees the attorney's files.
- `agentadmin`: the separate administrator; `ssh-tom-pc-1-wsl --admin -tt`
  forwards the dedicated agent and sudo authenticates through the same
  `libpam_rssh.so` module as dankserver and tbk (root-owned key file under
  `/etc/security/authorized_keys/`), one more touch per sudo. Account
  passwords are locked, so a missed touch has no password fallback. End the
  administrative shell before launching an agent.

Worker state (2026-11-09, receipt
`goals/cloud-agent-readiness/history/2026-11-09-tom-pc-1-wsl-fleet-parity.md`):
the public beep-effect clone sits at the same home-relative path as on
DankStation and is registered with `t3 project add`, which is what lists the
host in the desktop composer's "Run on". Push goes through a `gh` login for
`agent`; there is no 1Password agent credential, so `BEEP_SECRETS` reads are
not available there. Harness defaults follow the unsupervised child mode in
`docs/runbooks/agent-pools.md`, and every harness carries the host's own
`t3-code` MCP entry. `/update-harnesses` covers the host through
`ssh-tom-pc-1-wsl`.

The PC's own key-auth SSH (`<windows-user>@tom-pc-1`, then `wsl -d t3-agent`)
remains the recovery route if the distro's sshd or Tailscale is down; it is
not an agent launch route. Workloads: 4 CPUs and 8 GiB in the WSL VM,
`agent-runs.slice` at 6 GiB max / 5 GiB high / 300% CPU, one substantive job
at a time.
