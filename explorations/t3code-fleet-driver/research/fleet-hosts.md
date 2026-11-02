# Fleet host inventory for the T3 Code fleet driver — 2026-11-01

Read-only discovery for the plan: install T3 Code on each host, reach every host
over the tailnet, and spill beep-effect agent work off DankStation when it is
compute-constrained.

Evidence labels:

- **repo**: a cited path in this repository.
- **probed 2026-11-01**: observed live from DankStation today with commands that
  cannot prompt (`tailscale status --json`, TCP connects, HTTP `HEAD`, one
  Tailscale SSH attempt with key auth and agents disabled). No remote command ran
  on any host, nothing was written remotely, and no sudo was used.
- **private receipt**: an operator-local record outside this repository under
  `~/.local/state/beep/`. It is summarized here without account names, device
  identifiers or addresses.

No YubiKey-gated SSH was attempted. The canonical wrappers run with
`-F /dev/null`, so they never reuse a multiplexed session, and every connection
needs a physical touch. Those hosts are marked "needs touch" and rely on repo
receipts.

## Host matrix

| Host | Role / purpose | OS / arch | Cores / RAM | Tailnet (probed 2026-11-01) | Access route (touch?) | node / bun / agent CLIs | T3 server notes / blockers |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DankStation | Operator workstation and orchestrator; the "spill from" host | CachyOS, x86_64 | Threadripper 9970X, 32C/64T; 125 GiB RAM, 47 GiB swap (probed) | online (self); Tailscale SSH server off | local | full set (local) | T3 desktop app already listening on loopback :3773 and published tailnet-only through Tailscale Serve on :443 (probed). Not a spill target |
| beep-worker | Primary headless Linux dev worker (former attorney Windows desktop, now Ubuntu) | Ubuntu 26.04.1, x86_64 (repo) | **unknown** (no repo record; not probed) | online, direct path, untagged | `ssh-beep-worker` → `ssh-beep-worker-yubi` (FIDO key, no forwarding); `--admin` forwards for sudo. **Needs touch** | node 24.21, bun 1.4.2, codex, claude, grok, muse, cursor-agent, CLIProxyAPI (repo, 2026-10-14) | **T3 already installed and running**: `t3code.service` enabled under default.target and survives reboot (private receipt, 2026-10-27). :3773 answered HTTP 200 over the tailnet (probed). T3 remote Codex smoke passed (repo). Cursor/Grok/Muse disabled in T3 provider settings |
| tbk-worker | Isolated KVM guest on the staking host (tbk-ubuntu) for dev jobs | Ubuntu guest, x86_64 (repo) | 4 vCPU (2 physical cores), 32 GiB guest (repo) | **offline** since 2026-10-26, `tag:tbk-worker` (probed) | `ssh-tbk-worker` (guest-only FIDO key, account without sudo). **Needs touch** | Node 24.22.1, pinned Bun, native agents + proxy wrappers (repo) | Guest is protectively stopped with its I/O-pressure latch preserved; it must not be started by an agent. Tailnet admission is DankStation→guest TCP 22 only; dev services must bind loopback and use SSH `-L` (repo D28). A T3 server there would be reachable only through an SSH forward |
| dankserver | Homelab: monitoring stack, Phoenix, web services; bare-metal dedicated worker account for one job at a time | Ubuntu 26.04.1, x86_64 (repo) | 4C/8T i7-7700K, 15–16 GiB RAM, about 10–12 GiB free (repo) | online, direct path, untagged | `ssh-dankserver-worker` (FIDO, no forwarding). `ssh-dankserver-yubi` is admin only (forwards a privileged agent). **Needs touch** | Node 24.22.1, Bun 1.4.4; Codex, Claude and Grok inference qualified; Cursor and Muse quota-held (repo) | No T3 installed (:3773 closed, probed). Smallest budget: 7 GiB `agent-runs.slice`, 200% CPU, shared with Docker and proxy. T3 server plus an agent turn would compete with Prometheus/Grafana/Phoenix. Admission is one substantive job at a time |
| grok-bot-box-1 | Tagged bot host (`tag:grok-bot`), enrolled 2026-10-09. Most likely the Grok Bot persistent cloud computer joined to the tailnet (inference, see notes) | Linux (tailnet-reported); distro/arch unknown | unknown | online, relayed (no direct path), **Tailscale SSH server enabled** (probed) | Tailscale SSH: the policy **refused the operator user** (probed). No workstation wrapper or `~/.ssh/config` block. Not touch-gated | unknown | TCP 22 open; 443 and 3773 closed (probed). No repo doc says what runs there (`explorations/observability-palantiri/research/harness-emitters-and-web-ci.md:162`). Feasibility is low; see notes |
| tom-pc-1 | The attorney's Windows workstation (strict "shape-only" telemetry tier); proposed capped background dev worker | Windows 11 Pro, x86_64 | i7-9700K 8C/8T; 64 GiB RAM, about 40 GiB free at sampling; about 1.25 TiB free NVMe (private receipt, 2026-10-26) | online, relayed, untagged; OS hostname differs from the tailnet label (probed) | OpenSSH for Windows 9.5 is running, but **non-interactive key auth was rejected** on 2026-10-26 (private receipt). Its 2026-10-21 BatchMode route has since stopped working. The working control path is a Codex Desktop remote-control task (Full access / approval never, re-verified per task). Not touch-gated | WSL 2.7.10 with one existing Ubuntu 26.04 distro: Node 22.22.1, npm 9.2, gcc 15.2, Python 3.14.4; capped at 4 CPU / 8 GB / 2 GB swap. Windows-side Codex CLI 0.160.1 on Node 24 (repo, 2026-10-21). bun and other agent CLIs unknown | TCP 22 and 443 open, 3773 closed (probed). What answers on 443 was not checked. Operator ruling: a dedicated **Hyper-V VM**, not the existing WSL (private receipt). All seven Hyper-V features are disabled; a no-reboot enablement script is prepared but has not run, and the reboot needs coordination with the PC's user. A "new WSL environment" conflicts with that ruling and needs a decision |

Also on the tailnet, not in scope: `ai` (Linux, untagged, unexplained; :443 serves
a web app that redirects to `/chat`), `muse` (OS not reported), `tbk-ubuntu`
(staking host, never a dev target), a phone and a tablet.

## Per-host notes

### DankStation

- T3 desktop (AppImage build from the operator's fork, rebuilt daily by
  `t3code-source-update.timer`) owns loopback :3773. Tailscale Serve publishes
  it tailnet-only on :443. Serve has five other tailnet-only routes and no Funnel
  routes (probed 2026-11-01).
- DankStation's own capability map carries `funnel`, `https`, `is-admin`,
  `is-owner` and `ssh`. The Tailscale SSH server is off (`RunSSH=false`), so
  inbound shells use OpenSSH.
- `explorations/observability-palantiri/research/fleet-and-hub.md` §1 records a
  MagicDNS misconfiguration (resolved and NetworkManager wired incorrectly). A
  fleet driver that resolves full MagicDNS names on DankStation should verify it
  first. Short tailnet labels resolved fine today for TCP probes.

### beep-worker

- Repo: `.claude/skills/remote-development-agents/references/hosts.md`,
  `goals/cloud-agent-readiness/history/2026-10-14-linux-worker-readiness.md`
  (tool versions, Tailscale enrollment, UFW SSH only on tailscale0, fail2ban,
  rootless Docker, CLIProxyAPI, `op` shim), and
  `goals/cloud-agent-readiness/history/2026-10-14-t3-remote-smoke.md` (a
  T3-owned Codex thread ran on beep-worker, driven through the T3 MCP plus web UI
  at the worker's tailnet origin; four shell approvals were handled in Chrome).
  T3 Code 0.0.45 was installed from the upstream amd64 release with its SHA256
  verified (2026-10-14 receipt, desktop follow-up).
- Private receipt (2026-10-27): the host runs as a server. Suspend and
  hibernate are disabled, linger is on, and `t3code.service`, Docker,
  CLIProxyAPI and a systemd-managed `beep-codex-daemon.service` (Codex remote
  control, pinned 0.162.1) all start before any graphical login. A real reboot
  passed. The daemon runs inside `agent-runs.slice` (8 GiB, 200% CPU, 512
  tasks).
- 2026-11-01 health look: reachable with its documented slice limits. Its
  `main` checkout is stale and carries unrelated local edits, which must be
  preserved (`goals/cloud-agent-readiness/history/2026-11-01-fleet-cloud-setup.md`).
- Credential boundary: the account reads all of `BEEP_SECRETS` through the `op`
  shim, and same-user jobs can read it too (SPEC D40). Environment scrubbing is
  not isolation.
- Blockers for T3: none for installation, which already exists. Open items: T3
  version currency against the fork, the T3 provider toggles for
  Cursor/Grok/Muse, and core count/RAM, which have never been recorded.

### tbk-worker

- Repo: `goals/cloud-agent-readiness/ops/tbk-worker-runbook.md`,
  `goals/cloud-agent-readiness/history/2026-10-23-tbk-worker-design.md`
  (D18/D23–D30), `ops/ssh-tbk-worker.sh`.
- The guest is down (offline since 2026-10-26, probed). Startup is manual and
  guarded. A protective stop never auto-restarts, and agents must never start
  the VM or relax the guard.
- Network posture blocks the T3-over-tailnet model: inbound only from
  DankStation to TCP 22, no Serve, no Funnel, and guest-initiated tailnet
  traffic blocked. T3 there needs an SSH local forward, or a scoped D28
  amendment admitting a T3 port from DankStation.
- Its repository-limited GitHub token expires 2026-11-22. Cursor Opus is
  quota-held until 2026-11-11.

### dankserver

- Repo: `references/hosts.md` (dankserver section),
  `goals/cloud-agent-readiness/history/2026-10-23-dankserver-development.md`,
  `goals/cloud-agent-readiness/history/2026-10-23-host-os-upgrades.md`. Control
  plane is the separate `kriegcloud/dankserver` repository.
- Dedicated worker account: no sudo, no privileged Docker, a 256 GiB ext4 home
  image, and a root-owned parent budget of 8 GiB, no swap, 200% CPU and 2,048
  tasks. `agent-runs.slice` is 7 GiB max / 6 GiB high, 200% CPU, 1,024 tasks.
- Live today: tailnet online with a direct path. :443 and :22 are open and
  :3773 is closed (probed). An existing multiplexed SSH master to dankserver's
  **administrative** login is live on DankStation. It was deliberately left
  unused, because the skill forbids admin routes for agent work and the session
  belongs to someone else.
- Blockers for T3: the tight memory budget shared with production monitoring.
  T3's own server process plus one agent turn must fit inside the 7 GiB slice,
  so treat dankserver as an overflow-of-last-resort target. Expose T3 through
  Serve only after a decision, since the host also runs a cloudflared tunnel and
  carries Funnel capability.

### grok-bot-box-1

- Live today: tailnet online through a DERP relay (no direct path).
  `tag:grok-bot` is the only such tag. The node publishes Tailscale SSH host
  keys, so it runs `tailscale up --ssh`. A key-less, agent-less Tailscale SSH
  attempt was answered with "tailnet policy does not permit you to SSH as user
  ..." for the operator's user. No other user name was guessed.
- Repo: `explorations/observability-palantiri/research/fleet-and-hub.md` §1
  ("bot host", not a hub) and
  `explorations/observability-palantiri/research/harness-emitters-and-web-ci.md:162`
  ("NOT FOUND: no repo code or doc describes what runs on that box").
- Inference, unverified: `explorations/grok-bot-automation/research/lanes/g1-grok-bot-facts.md`
  describes Grok Bot's persistent cloud computer as one Cursor-hosted Firecracker
  microVM per user (Linux, non-root, US-hosted, shared by all Bots, installed
  packages "replaceable", only `/workspace` durable). Its private-networks docs
  allow Tailscale on that computer (line 349). The node's enrollment timing,
  tag, relayed path and lack of a workstation wrapper fit a Bot computer joined
  to the tailnet. They do not fit a homelab box.
- Feasibility for a T3 server, if it is the Bot VM:
  - **Low.** There is no published CPU/RAM, toolchain or OS image (g1 line 167).
    Packages may be wiped on image rebuilds, and the VM is shared by every Bot
    on the account with no isolation between Bots.
  - The Bot cannot call OpenAI/Anthropic as a documented feature (g1 line 161).
    Native Codex/Claude CLIs would need credentials placed on a third-party
    hosted VM, which the grok-bot-automation spark explicitly rejects ("without
    granting a shared hosted VM local credentials, publishing authority, or
    merge authority").
  - The Bot runtime cannot attach to `grok agent serve` or the CLI relay
    (g1 lines 347–349).
  - At best it is a Grok-only, reach-in-through-Tailscale-SSH sandbox. It is not
    a spill target for beep-effect work with secrets.
  - If it is instead an operator-owned VM, it needs a Tailscale SSH policy rule
    (or an OpenSSH key) before anything else.

### tom-pc-1

- Repo: `explorations/observability-palantiri/DECISIONS.md` (2026-10-14:
  the attorney's workstation, strict shape-only tier, untagged, so it fails
  closed to shape-only. The console "Funnel" badge is a policy grant; what
  tom-pc-1 itself serves was never checked).
  `explorations/cross-provider-agent-communication/research/2026-10-21-codex-remote-control-bridge.md`
  covers the qualified Codex app-server bridge: loopback WebSocket on the PC,
  SSH `-L` tunnel, capability token held only on the workstation with a digest
  on the PC, `readOnly` / `never` policy.
- Private receipt (2026-10-26/27): OpenSSH for Windows 9.5 runs automatically
  and the known host key verified. **Non-interactive local key authentication
  was rejected** with no agent forwarded and no password prompt, so BatchMode SSH
  no longer works. Direct `wsl -l -v` over SSH was therefore not attempted
  today, and doing so through the 1Password SSH agent could also raise a desktop
  approval prompt. Control currently goes through a ChatGPT/Codex Desktop
  remote-control task whose effective permissions (Full access /
  danger-full-access / approval never) were verified for one task and build
  only.
- WSL state (private receipt): WSL 2.7.10, one current-user distro "Ubuntu"
  (WSL2) that was upgraded to Ubuntu 26.04 LTS on operator direction, with
  package and systemd health passing. It has Node 22.22.1 and build/Python tools
  and is capped at 4 CPU / 8 GB / 2 GB swap. It was stopped at inventory and
  running after the follow-up. **Preserve it; it is not the selected worker.**
  No `.wslconfig` was present at first inventory, and the cap was added later.
  No Docker Desktop. Power plan Balanced; AC sleep never; DC sleep 10 min.
- Accepted design (private receipt): a dedicated Hyper-V VM with 2 vCPU, 8 GiB
  fixed RAM and a 128 GiB disk. It runs one job at a time as capped background
  work while Windows is in use, with a manual Pause and an automatic protective
  stop. The I/O budget, pressure thresholds and pause/resume semantics are
  still pending. Hyper-V is fully disabled today. The prepared
  `Enable-TomHyperV-NoRestart.ps1` requires an elevated token and UAC, has not
  been transferred or run, and a reboot must be coordinated with the PC's user.
- Blockers for T3 or WSL on tom-pc-1:
  1. Decide between a new WSL distro and the accepted Hyper-V VM.
     - A second WSL distro shares the WSL2 utility VM and the existing global
       4 CPU / 8 GB cap with the preserved Ubuntu. That cap is per-user and
       applies to all distros.
     - WSL needs no Hyper-V enablement or reboot, but gives weaker isolation
       from the attorney's Windows session and data (`/mnt/c` automount).
  2. Restore an agent access route. SSH key auth is currently rejected and the
     Desktop remote task is per-task authorized.
  3. Strict-tier posture: no Funnel on this host, a shape-only telemetry gate,
     and client data stays out of the repo (Palantiri D2/D3). A T3 server here
     must bind loopback or tailnet-only and must not be published through Funnel.
  4. Identify what currently answers on TCP 443 (probed open) before adding
     another listener.
  5. Separate credentials: do not inherit other workers' vault grants or
     identities (private receipt).

## DankStation compute signal (for "spill when constrained")

Source units (probed 2026-11-01):

- `~/.config/systemd/user/beep-psi-sample.timer`: `OnBootSec=45s`,
  `OnUnitActiveSec=30s`, `AccuracySec=5s`. It was active at the probe.
- `beep-psi-sample.service` (oneshot, `background.slice`). Its original
  `ExecStart=~/.local/bin/beep-psi-sample` is **overridden** by drop-in
  `99-workstation-light-sampling.conf`. That drop-in is a 2026-09-15 recovery
  containment that avoids per-process smaps scans after a kernel fault, and it
  runs a small Python sampler from `~/workstation-diagnostics/2026-09-15/pressure-recorder-containment/`.
- **Live output**: `.../pressure-recorder-containment/safe-pressure.jsonl`,
  append-only with **no rotation**: 109,415 lines, about 73 MiB, growing about
  2,880 lines a day. One JSON object per tick:

  ```json
  {"time": "<UTC ISO-8601>", "boot_id": "<uuid>", "taint": 0,
   "memory": {"MemAvailable": "<n> kB", "SwapTotal": "<n> kB", "SwapFree": "<n> kB"},
   "pressure": {"cpu": "<raw /proc/pressure/cpu text: some/full avg10 avg60 avg300 total>",
                "memory": "<raw text>", "io": "<raw text>"},
   "cpu_tctl_c": 74.25,
   "edac": {"<mc path>/ce_count": 0, "<mc path>/ue_count": 0}}
  ```

  PSI values are the raw two-line kernel strings, so a consumer must parse them.
- The original script (no longer running) wrote a compact text line to
  `~/.local/state/beep-psi/psi.log` (ring-trimmed) and a runtime snapshot to
  `runtime.json` / `runtime-history.ndjson`. Those files are **stale since
  2026-09-15**. A router must not read them.

Baseline from the last 7 days (22,938 samples, 2026-10-25 → 2026-11-02 UTC):

| Signal | p50 | p90 | p99 | max |
| --- | --- | --- | --- | --- |
| cpu `some` avg60 (%) | 0.35 | 8.7 | 30.5 | 88.9 |
| memory `full` avg60 (%) | 0.01 | 0.89 | 4.3 | 36.1 |
| io `full` avg60 (%) | 0.4 | 2.5 | 9.2 | 46.9 |
| MemAvailable (GiB) | 49.6 | 25.5 (p10) | 13.5 (p1) | min reads 0.0 |

The cpu `some` avg60 value exceeded 20% in 3% of samples and 40% in 0.4%. The
memory `full` avg60 value exceeded 5% in 0.7%. At least one sample read
MemAvailable 0, which needs a look before it is used as a threshold input.
Static capacity: 64 logical CPUs, 125 GiB RAM, 47 GiB swap (about 23 GiB in use
at the probe). This machine also has an io_uring per-UID memlock ceiling that
presents as unexplained ENOMEM (operator machine notes). The PSI sampler does
not capture io_uring ring counts in its contained form.

Implications for the routing policy: the signal exists and is fresh every 30 s.
Usable spill triggers are sustained cpu `some` avg60 above the p99 band, memory
`full` avg60 above about 5%, or MemAvailable below about 13 GiB. The router
should read the newest line and treat a stale `time` (more than 90 s old) as
"unknown, do not spill on this basis".

## Unknowns

1. beep-worker CPU model, core count and RAM. Never recorded; the 2026-10-14
   Palantiri lane failed host-key verification.
2. What grok-bot-box-1 is: the Grok Bot cloud computer or an operator VM. Also
   its OS, size and toolchain, and which Tailscale SSH users the policy admits.
3. The installed T3 version on beep-worker, whether it tracks the operator's
   fork, and its current provider enablement.
4. What answers on tom-pc-1 TCP 443, and whether any Funnel route is active on it.
5. Whether tom-pc-1 should get a new WSL distro or the accepted Hyper-V VM, and
   how a second distro would coexist with the preserved Ubuntu under the shared
   WSL cap.
6. The tom-pc-1 agent access route after key-auth rejection. Whether the
   Windows OpenSSH key route should be repaired, and with which identity.
7. Whether bun and the Claude/Grok/Cursor CLIs exist on tom-pc-1 (Windows side
   or WSL).
8. tbk-worker restart eligibility. The latch is held; this is an operator
   decision, never an agent's.
9. dankserver headroom with a T3 server resident. No measurement exists of T3
   server memory under the 7 GiB slice.
10. Whether the tailnet policy admits DankStation to T3 ports on each host
    (beep-worker :3773 answered; tbk-worker is admitted only on 22 by design).
11. Current provider quota state per host. Cursor Opus holds lift 2026-11-11 per
    repo; Muse was held as of 2026-10-26. Neither has been re-verified today.
12. The MemAvailable = 0 sample(s) in the PSI log: whether a real exhaustion
    event or a sampler artifact.
