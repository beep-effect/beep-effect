# Agent and Linux Development Readiness Spec

> Bootstrap history: references to `scripts/cloud-session-setup.sh` below record
> the original 2026-10-01 acceptance. That script is retired by workstream C;
> current bootstrap is `scripts/cloud/bootstrap.sh`. Packet lifecycle is unchanged.

## Objective

A fresh hosted agent container that holds only this repository's checkout and
the host's default tooling reaches, by running one documented command, a green
`bun install --frozen-lockfile` and a working `bun run beep --help`; its
session hooks and MCP expectations match the host it is on; and a cloud
session has a documented, repeatable end state (pushed branch, PR opened
through the GitHub API, proof output in the PR body) with a named operator-side
closeout. Every known denial (bun installer host, Effect snapshot registry) is
surfaced by a preflight that names the remedy instead of failing silently.

## Non-Goals

- Moving Effect from the `pkg.pr.new` snapshot to a published release, or
  vendoring the snapshot tarballs into the repo.
- Running recorded browser QA (`beep qa record`), the OBS lane, or any
  desktop-gated acceptance from a cloud container.
- Putting secrets into cloud containers: no 1Password service account, no
  `op://` env files, no provider keys.
- Replacing Yeet or adding a GitHub-App token mode to it (recorded as a
  follow-up candidate, D4).
- Cursor and Codex lanes; the volume-pool order in `AGENTS.md` stays as is.
- Provisioning the `.repos/effect` reference workspace in the cloud (tracked
  as an optional P1 extension; not acceptance).

## Source Hierarchy

1. The operator's requests of 2026-10-01 and 2026-10-14 that created and expanded this packet.
2. `AGENTS.md`, `CLAUDE.md`, and the required skills (`yeet`,
   `effect-first-development`).
3. `standards/ARCHITECTURE.md`, `standards/git-worktrees.md`,
   `docs/runbooks/agent-pools.md`, `docs/runbooks/typescript-toolchain.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. `research/` and `history/` in this packet.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `scripts/cloud-session-setup.sh` (new): toolchain bootstrap and preflight.
- `.bun-version`, `.bun-linux-x64.sha256`: read only; never edited here.
- `.claude/settings.json`, `.claude/hooks/*`, the graft hook helper (retired 2026-10-28):
  host-aware guards.
- `.mcp.json`: unchanged unless a host-scoped enable/disable mechanism exists;
  otherwise the runbook records which servers are workstation-only.
- `AGENTS.md`: one new section, "Cloud sessions".
- A new `cloud-sessions.md` runbook under `docs/runbooks/` and a cross-link from
  `docs/README.md` and `docs/runbooks/agent-pools.md`.
- `docs/ROADMAP.md`: one Lane 3 accelerator row for this packet.
- `packages/tooling/library/ai-metrics`: only if a `cloud` host literal is the
  cheapest way to keep pulse rows flowing (D3); otherwise untouched.
- This packet.

## Constraints

- The setup script is idempotent, safe on a workstation, and never modifies a
  tracked file; it writes only under `~/.cache/beep/`, `node_modules/`, and
  bun's own `~/.bun/bin` (only when the caller's bun already lives there;
  never a mise shim or other toolchain-managed directory).
- The pinned bun comes from the repo's own pins: version from `.bun-version`,
  archive digest from `.bun-linux-x64.sha256`. A digest mismatch is a hard
  failure.
- The script never calls `https://bun.sh/install` (denied by the default cloud
  network policy, probe F2) and never `cp`s over a running binary (F5).
- Preflight exit codes are stable and documented; a denied host exits `78`
  (configuration error, the same convention the 1Password shim uses) with the
  host name and the remedy on one line.
- Host detection is explicit: hooks read `BEEP_AGENT_HOST`; nothing guesses
  from paths, hostnames, or proxy files.
- No new MCP server, no new always-loaded prompt surface beyond the one
  `AGENTS.md` section; keep that section under 40 lines (context economy).
- Public repo: the runbook and evidence carry no tokens, session ids, machine
  ids, or absolute home paths.

## Decisions

| Id | Decision | Rationale |
| --- | --- | --- |
| D1 | The pinned bun is provisioned from the GitHub release archive verified against `.bun-linux-x64.sha256`, with `npm install bun@<.bun-version>` as the fallback route. | Both routes were proven on 2026-10-01 (F3, F4); the installer host is denied (F2); the digest is already tracked for CI's baked-runner path. |
| D2 | `pkg.pr.new` reachability is an environment precondition surfaced by preflight, not worked around in the repo. | The snapshot is 34 lockfile entries (F6); vendoring or mirroring is a dependency-policy change outside this packet. A loud, named failure beats a silent partial install (F6, F7). |
| D3 | Hooks and docs key off `BEEP_AGENT_HOST=cloud`, set in the environment's variables; the setup script writes it into `~/.cache/beep/cloud-env.sh` only when invoked with `--host cloud`, never unconditionally. Desktop-only effects (graft session-start, the desktop pulse notifier) no-op under it; pulse rows keep flowing if the writer already tolerates a new host kind, else the literal is added in the same PR. | Heuristics drift; an explicit variable is testable and documented. The evidence loop wants cloud rows, not silence. |
| D4 | A cloud session's end state is: proof commands run and quoted in the PR body, branch pushed, PR opened or updated through the GitHub API, `ready-for-heavy` requested in the PR body. The yeet `monitor --until-ready` loop, the `ready-for-heavy` label, and `sweep --retire` stay operator-side until yeet runs without `gh` and systemd. | `GH_TOKEN` is invalid in the container (F8) and there is no user bus (F9). Recording the handoff is cheaper and safer than a token mode designed under deadline. |
| D5 | No secret enters a cloud container. Packets whose proof requires an `op://` env file or a live external credential are outside the cloud lane and the runbook says so. | F10; `AGENTS.md` 1Password law. |
| D6 | Cloud credits are a fourth meter in the pool runbook (Opus, Cursor, Codex, cloud). The pool order itself is unchanged. | Spending is real and expiring; the runbook is where meters live. |
| D7 | Workstation-only MCP servers (`serena`, `webstorm`, `phoenix`, `phoenix-docs`, `chrome-devtools`) are documented as expected-failing in the cloud unless a host-scoped enable mechanism exists in `.claude/settings.json`; if one does, it is used, and `.mcp.json` is not forked. | F11; keep the tool surface stable within a session (context economy). |

## Acceptance Criteria

- [ ] From a fresh container with the checkout and default tooling only, and
      with `pkg.pr.new` allowed by the environment, `bash scripts/cloud-session-setup.sh`
      exits `0`, after which `bun --version` equals `.bun-version`,
      `node_modules/effect/package.json` exists, and `bun run beep --help`
      exits `0`. When the caller's `bun` is `~/.bun/bin/bun` (the cloud
      container's case) binaries land there and no PATH change is needed. In
      every other case (no `bun`, a mise-managed or otherwise relocated `bun`,
      or `--host cloud` passed) the caller first
      `source ~/.cache/beep/cloud-env.sh` (never the setup script itself),
      and the script's final line says so.
- [ ] `bash scripts/cloud-session-setup.sh --check` on a container that denies
      `pkg.pr.new` exits `78` and prints the denied host and the remedy
      ("add pkg.pr.new to the environment's allowed domains") without changing
      anything.
- [ ] On a workstation that already satisfies the pins, the script is a no-op
      beyond `bun install --frozen-lockfile` and exits `0`.
- [ ] With `BEEP_AGENT_HOST=cloud`, SessionStart and Stop hooks emit no error
      lines, the desktop notifier does not fire, and `graft` session-start is
      skipped; without it, behavior is byte-identical to today.
- [ ] `AGENTS.md` has a "Cloud sessions" section that states the host
      variable, the setup command, the can/cannot rubric (secrets, systemd,
      `gh`, recorded QA, corpora), and the D4 end state; the new `cloud-sessions.md` runbook under `docs/runbooks/`
      carries the operator checklist (environment setup script text, allowed
      domains, variables) and the closeout handoff; `docs/ROADMAP.md` carries
      the accelerator row.
- [ ] One dated note under `history/` records a real cloud session running the
      full loop: setup → `bun run beep quality package-verify <pkg> --quick` on
      one package → push → PR opened through the API.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/cloud-agent-readiness/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/cloud-agent-readiness/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/cloud-agent-readiness scripts AGENTS.md docs .claude` | Passes |
| Script lint | `shellcheck scripts/cloud-session-setup.sh` | No findings |
| Script no-op on satisfied host | `bash scripts/cloud-session-setup.sh && git status --porcelain` | Exit `0`; no tracked changes |
| Preflight on denied host | `bash scripts/cloud-session-setup.sh --check` in the cloud before the allowlist | Exit `78`; names `pkg.pr.new` |
| Full bootstrap in the cloud | `bash scripts/cloud-session-setup.sh --host cloud && source ~/.cache/beep/cloud-env.sh && bun run beep --help` after the allowlist | Exit `0` |
| Hook guard | `BEEP_AGENT_HOST=cloud bash .claude/hooks/hook-pulse.sh < /dev/null; echo $?` and the SessionStart transcript of a cloud session | Exit `0`; no error lines |
| Pulse conformance (only if D3 adds a literal) | `bun run beep quality package-verify @beep/repo-ai-metrics --quick` | Green |
| Reflection artifact | `bun run beep lint reflection-artifacts` | Green |
| Docs cross-links | `rg -n "cloud-sessions.md" docs/README.md docs/runbooks/agent-pools.md AGENTS.md` | Each file links the runbook |

## Stop Conditions

- The environment cannot be configured to allow `pkg.pr.new` (D2): report
  with the preflight output; do not vendor or mirror the snapshot.
- `.bun-linux-x64.sha256` does not match the release archive for the pinned
  version: report; do not relax the digest check.
- The hook guard would require guessing the host (D3): report instead.
- Verification requires a credential, cost, destructive side effect, or policy
  approval not named here.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Yeet closeout stays operator-side | D4 end state | operator | `gh` token invalid and no user bus in the container (F8, F9) | Yeet gains a `gh`-free, systemd-free publish and monitor path |

## Managed Linux scope expansion — 2026-10-14

This section extends the objective to make the operator's Linux machines usable
for beep-effect development and agent work. The cloud-only non-goals and D4/D5
continue to apply to ephemeral cloud containers; they do not prohibit the
explicitly authorized credentials and native Codex tools on managed Linux hosts.

### Decisions

| Id | Decision | Reason and reversal |
| --- | --- | --- |
| D8 | Rename the display title to Agent and Linux Development Readiness; retain the packet path and initiative id. | Broader scope without breaking launchers or historical links; reverse by restoring the display title. |
| D9 | Inventory the workstation's actual executable paths, versions, managers, and authentication routes before provisioning each host. Repository pins outrank workstation global versions. | A copied dotfiles directory is not a reproducible toolchain; change host configuration through dated receipts and saved originals. |
| D10 | Managed Linux originally permitted reuse of the workstation 1Password service account. D19 and D40 supersede reuse for both tbk-worker and dankserver: each has its own independently revocable account. Transfer credentials directly over authenticated SSH into mode-0600 storage, preserve the canonical PATH shim, and suppress secret verification output. | D40 defines current vault access for both workers. File mode 0600 excludes other local users, not agents running as the owning worker. No raw secrets, token-bearing config, session ids, or credential files enter the public repository. |
| D11 | Use hardware-backed OpenSSH and remote sudo through a forwarded admin agent, matching dankserver's live pam_rssh configuration. Agent workloads receive neither the forwarded admin socket nor blanket passwordless sudo. Applications are reachable over the tailnet, with explicit port bindings/rules or Tailscale Serve and no public Funnel by default. | Ergonomic administration with bounded access; retain a verified recovery session and saved PAM/SSH configuration before tightening access. |
| D12 | Keep staking services on tbk-ubuntu bare metal. Development requires an isolated guest with explicit CPU/RAM/I/O limits and separate storage. Do not mount or copy host staking credential files, host Docker sockets or host/fleet administrative agents into it. Guest administration is scoped by D23; vault access is separately governed by D40. | Resource and network boundaries preserve validator operation. D40 permits full shared-vault reads and therefore supersedes a categorical claim that the guest cannot obtain broader credentials through that vault. Initial sizing remains provisional until measured; stop the guest to reverse deployment. |
| D13 | Use a KVM virtual machine for the tbk-ubuntu development worker; accepted by the operator on 2026-10-23. | A separate guest kernel strengthens the isolation boundary. Host resource contention and hypervisor exposure still require D12 controls. Manager selection is D14, initial sizing D16, conditional storage allocation D17 and network policy D18. Reverse by stopping and removing only the guest's owned resources. |
| D14 | Manage the tbk-ubuntu KVM guest with libvirt/QEMU; accepted by the operator on 2026-10-23. | Whole-domain CPU budgets and explicit memory and disk I/O controls fit D12. Verify installed-version support and effective host limits before workload admission. The accidental LXD installation was confirmed unused and removed through authenticated privileged access; see the host upgrade checkpoint. |
| D15 | Start the tbk-ubuntu guest as a command-line worker for agents, builds, tests, containers and web services, accessed through SSH and the tailnet; accepted by the operator on 2026-10-23. | The initial guest does not need the desktop additions qualified on beep-worker. A later desktop addition is a separate workflow and resource decision. Subsequent decisions define allocation and access boundaries. |
| D16 | Start the guest with 4 vCPUs and 32 GiB of guest RAM, with a host-enforced CPU budget; accepted by the operator on 2026-10-23. | A measured first allocation leaves headroom for staking. vCPUs are not dedicated physical cores. D24 defines the CPU ceiling and placement; define and verify QEMU overhead allowance, memory/swap behavior and I/O limits during implementation. An increase toward 8 vCPUs / 48 GiB requires representative workload and validator evidence followed by an explicit allocation decision. |
| D17 | Allocate a 512 GiB guest disk from verified unused capacity on the old Ubuntu SATA SSD, preserving its existing 100 GiB system volume; accepted conditionally by the operator on 2026-10-23. | Privileged LVM inventory must confirm sufficient free extents and drive-health checks must support reuse before allocation. Resolve the disk by stable identity. The active staking NVMe, backup volume and ZFS-signature disks are excluded. No existing filesystem, partition or logical volume may be erased under this decision. If the checks fail, return to the storage decision. |
| D18 | Give the guest a dedicated network and Tailscale identity. Approved operator devices may initiate SSH/development connections; public-internet development egress and established replies are allowed. Guest-initiated access to the host's private/control services, LAN and other tailnet machines is denied except explicit workflow exceptions; accepted by the operator on 2026-10-23. | Enforce boundaries outside the guest using host network policy and receiving-peer Tailscale policy, covering IPv4/IPv6 and narrowly scoped bootstrap services. NAT alone is insufficient. No public application exposure, subnet-router or exit-node role. Preserve existing staking/Docker connectivity and prove both allowed and denied paths before admission. |
| D19 | Give the tbk guest a dedicated, independently revocable read-only 1Password account; accepted on 2026-10-23. The original development-only vault scope and exclusions of staking, host/Tailscale administration and broader fleet credentials were superseded by the explicit full-vault grant in D40. | Independent identity, secure delivery, the approved shim and suppressed verification remain required. Current shared-vault access is not a technical exclusion of administrative or deployment credentials. Use remains limited to the authorized task; D40 records the actual boundary and reversal. |
| D20 | Use Ubuntu Server 26.04 LTS for the guest; accepted by the operator on 2026-10-23. | Matches the release family qualified on beep-worker. Use an official verified image, then repository-pinned tooling and actual workflow proofs. |
| D21 | Before VM provisioning, upgrade the existing tbk-ubuntu and dankserver hosts to the offered stable Ubuntu 26.04 LTS release; requested and clarified by the operator on 2026-10-23. | Initial checks found both hosts on 24.04.5 with 26.04.1 offered. Upgrade one at a time with preserved access/configuration and post-reboot service checks; track execution in the dated host upgrade checkpoint. The local CachyOS workstation is outside this request. Preserve the agreed guest design and return to it after host maintenance. |
| D22 | Configure tbk-ubuntu host SSH and sudo with the existing hardware-backed key and dedicated agent used by dankserver and beep-worker; requested by the operator on 2026-10-23. Provide workstation command `ssh-tbk-ubuntu`, with explicit `--admin` mode for agent forwarding and normal mode without forwarding. | Use the verified live `libpam_rssh.so` route with root-owned sudo keys, host-key verification and Plasma notification ownership. Prove a temporary loopback SSH listener, then fresh normal-port SSH/sudo and legacy-key rejection before retiring recovery access. Restore checkpointed authentication files to reverse. This is host administration; it grants no host agent or credentials to the guest. |
| D23 | Use a distinct guest-only SSH credential on the operator's existing YubiKey, loaded into a separate agent containing only that credential. Forward that agent only for explicit guest administration and touch-to-sudo; normal development sessions receive no forwarded agent. Accepted by the operator on 2026-10-23. | Resolves D11/D12 for this guest without forwarding the host/fleet identity. Authorize the new public key only on the guest, with a root-owned sudo key file and separate administration/workload identities. Enroll and prove the credential during guest setup; acceptance is not proof of creation. Revoke the guest key and remove its agent/authorization to reverse. |
| D24 | Confine the four-vCPU VM to two physical host cores and their four hardware threads, with one aggregate ceiling of four logical CPUs' worth of runtime for the VM and its supporting processes. The host remains eligible to use all ten physical cores. Accepted by the operator on 2026-10-23. | Recheck sibling topology before selecting CPU IDs. Enforce the common budget and allowed CPU set outside the guest, covering startup, vCPU/emulator/I/O threads and dedicated helpers; inspect actual cgroups and placement under load before admission. This is not exclusive core reservation and does not eliminate shared cache, memory-bandwidth or I/O contention. Lower the budget or stop the guest to reverse; expansion requires new evidence and an allocation decision. |
| D25 | Keep 32 GiB of guest RAM within a 36 GiB aggregate host-memory ceiling for the VM and its supporting processes, with no host swap and no automatic restart after a memory-limit failure. Accepted by the operator on 2026-10-23. | The initial 4 GiB overhead allowance must be measured under representative load before admission. A hard-limit failure can terminate the VM and lose running work; the boundary prioritizes containing guest memory use. Verify effective hierarchical limits, helper membership and failure behavior. Reclaim pressure may begin below the ceiling; guest-internal swap is a separate decision. Stop the VM to reverse enforcement safely; increasing the ceiling requires a new allocation decision. |
| D26 | Limit the guest disk to 100 MiB/s and 5,000 I/O operations per second for reads and writes combined, with no additional burst allowance. Accepted by the operator on 2026-10-23. | Enforce outside the guest and prove both ceilings using disposable guest-owned data. Apply the budget across all admitted guest disks and account for provisioning writes separately. D17's existing SATA system volume, staking NVMe and backup/ZFS disks remain excluded. Measure development performance and validator/host health before considering an increase; lower the limits or stop the guest to reverse safely. |
| D27 | Keep VM startup manual after host reboot and require healthy host/Rocket Pool checks before starting. A host-side guard automatically stops only the VM after sustained client-health failures or severe host pressure: request graceful shutdown, wait up to 60 seconds, then force power-off if still running. Require investigation and explicit restart after a protective stop; no automatic restart. Accepted by the operator on 2026-10-23. | Guest work may be lost on forced shutdown. Calibrate persistence/thresholds against actual host telemetry, treat stale/missing readings explicitly and prove the guard using synthetic signals without disrupting validators. Verify actual stopped state. The guard must never stop, restart, reconfigure or delete staking services/data. Stop the guest before changing guard policy; keep the resource limits and manual-start boundary in place until a replacement is verified. |
| D28 | Initially admit inbound Tailscale connections to the VM only from DankStation, for SSH and explicitly exposed development services. Accepted by the operator on 2026-10-23. | Network admission does not grant an SSH key or administrator role. D18's restrictions on guest-initiated host/LAN/tailnet connections and D23's separate guest identity remain in force. Resolve the verified device identity during implementation and prove both allowed and denied paths. Adding another source device requires an explicit scope decision; remove the admission to reverse. |
| D29 | Initially admit individually audited repository, registry and coding-provider credentials to the dedicated development vault; accepted on 2026-10-23. D40 later permits reading every existing item in BEEP_SECRETS, superseding individual admission as a technical read boundary for that shared vault. | Audit newly added dedicated-vault credentials and their provider permissions. Cloud sign-ins, deployment and unrelated credential use remain unauthorized without a specific task decision, even where D40 makes a credential technically readable. Labels, installation and successful reads do not grant permission to use it. |
| D30 | Use beep-worker's documented headless development environment as the tbk guest baseline, as requested by the operator on 2026-10-23. Reuse its tool, authentication and qualification patterns with current repository pins and guest-sized budgets. The operator subsequently confirmed the same tools with coding credentials initially; cloud-account sign-ins remain deferred under D29. | Includes development runtimes, rootless containers, native coding agents, the local proxy, GitHub workflows, bounded reference tooling and headless/reboot checks. D15's command-line scope, D18/D28 network restrictions, D19/D29 credential boundaries, D23 guest-only administration and D24–D27 resource/lifecycle controls still apply. The baseline is capability parity; old versions, account caches, broad service-account access, desktop additions and host-specific settings are not a deployment recipe. Cloud utilities may be installed without authentication. Reverse individual additions through saved configuration and owned services. |
| D31 | Implement D17 with a new 544 GiB host logical volume on the verified spare SATA extents, containing a dedicated ext4 filesystem and one 512 GiB raw guest image. The 32 GiB difference provides filesystem and setup headroom. Agent implementation choice, 2026-10-23; host storage and verified image provisioned, first boot and bounded tests recorded in the setup receipt. | A file-backed image avoids exposing historical contents of newly allocated raw extents. Use preallocation, reapply it after image conversion, verify target size/allocation and zero-read behavior, and keep discard disabled so guest trims do not release its reserved capacity. Recheck stable device/free extents and preserve LVM metadata before creation; use bounded preparation I/O. Existing volumes remain excluded. Reverse by stopping the VM, preserving required guest work, then removing only the newly owned image, mount and LV through an explicitly scoped cleanup. |
| D32 | Apply the prepared Tailscale policy for the worker, accepted by the operator and saved on 2026-10-23. Only DankStation may initiate guest TCP 22; the guest receives its own worker tag and no outbound peer grant. Use explicit approved device and service destinations. | Existing current-device access is retained; future service tags require explicit rules. The 32 tests passed the save gate and persisted policy semantically matches the approved candidate. Preserve the private original and version-history recovery route. Real guest path tests and host-side LAN/control isolation passed; retain those controls for every workload. |
| D33 | Require 60 consecutive healthy seconds before manual VM startup, then stop after 90 seconds of sustained client failure, missing health readings or severe host pressure. Accepted by the operator on 2026-10-23. | Start with a 16 GiB available-memory floor and sustained memory/disk-stall checks; require 48 GiB available before starting. Preserve D27's graceful shutdown, forced power-off after 60 seconds and no automatic restart. Prove short-fault recovery, sustained-fault stopping and stale-reading rejection synthetically before first boot. Loss of resource or network boundaries fails closed immediately. |
| D34 | Enroll the worker in the existing tailnet with only its worker tag. The operator approved the final device connection on 2026-10-23. | Live device and admin-console checks confirm the exact tag. DankStation SSH succeeds; guest-initiated host/workstation SSH is denied over both address families, and unapproved host-to-guest SSH is denied. Keep service exposure limited to the accepted SSH rule until a specific exception is approved. |
| D35 | Created the guest-specific read-only service account and development vault on 2026-10-23 with no environment or vault-creation access. Its original single-vault scope was replaced by D40. | The token was delivered privately into mode-0600 worker-owned storage, with human-only recovery. Identity, inventory, PATH and absence of inherited credential environment variables passed; these checks do not isolate same-user jobs from the credential store. D36 remains the repository-specific GitHub helper scope. |
| D36 | Initial GitHub credential is limited to the Beep repository: code, issue and pull-request editing plus Actions-result reads. Operator accepted on 2026-10-23. | No repository administration, secret management or workflow-file editing. The operator approved final creation and dedicated-vault storage. The token was created with expiration November 22, 2026; authenticated API reads and a Git push dry run pass. The worker resolves it through the vault rather than a duplicate Git credential file. |

### Fleet continuation decisions — 2026-10-23

| ID | Decision | Evidence and boundary |
| --- | --- | --- |
| D37 | Install a globally discoverable remote-development-agents skill, with versioned source in Beep. Operator accepted. | Source is `.claude/skills/remote-development-agents`. Both global skill directories now link to a retained sparse Beep checkout at `~/.local/share/beep/worker-skill-source`, independent of the task worktree. Keep it pinned to a verified published revision and advance it to the merge commit during closeout. Host profiles distinguish dated proof from current readiness. |
| D38 | Use bare metal for dankserver development. Retire its unused OpenClaw gateway, reviewer, authenticated browser, voice tunnel and container while preserving their data and backups. Operator accepted. | Monitoring, Phoenix and both web services remain. Dedicated worker account has no sudo or privileged Docker access. Shared-kernel isolation is weaker than tbk's KVM boundary. |
| D39 | Start dankserver's worker at 8 GiB aggregate RAM, two CPUs' worth of time, no swap and one substantive job at a time; use a new 256 GiB development filesystem on the existing root disk. Operator accepted. | Root-owned user-slice limits and a preallocated loop filesystem are provisioned. NVMe, backup and monitoring storage are not reformatted. The filesystem caps home storage, not every host temporary directory. |
| D40 | The operator explicitly approved separate replacement accounts for tbk-worker and dankserver with read-only access to all of BEEP_SECRETS plus each worker development vault, no environment access and no vault-creation permission. | This supersedes reuse under D10 and the development-only/exclusion assumptions in D12/D19/D29/D35. Any job running as the worker can read its 0600 service-account store or invoke the approved op shim and obtain every shared-vault item, including any cloud, fleet-administration or review-signing credentials present. Clearing OP variables prevents ambient inheritance; it does not enforce item-level or per-job credential isolation. Read-only vault access does not reduce stored credentials' upstream powers. Unrelated use, cloud sign-ins/deployment and privileged administration remain task-authorization restrictions, not technical denials. Both replacements passed exact two-vault membership and storage/environment checks; recovery is human-only and predecessors are revoked. Beep-worker sees BEEP_SECRETS only. Revoke the affected account or replace it with a narrower vault grant to reduce technical access; no such scope change is made here. |
| D41 | Make `beep-reviewer` advisory: remove its required check from `main` ruleset 10240248, which also deactivates the `yeet merge` / `merge-gate` reviewer gate. Operator accepted on 2026-10-26 after the Grok quota behind the reviewer ran out and blocked every merge. | Applied with `kriegcloud`'s gh login; the 16 other required checks, conditions and both bypass actors were diffed unchanged and the prior ruleset was saved before the PUT. `beep reviewer ruleset release --apply` repeats the switch. Reverse with `BEEP_REVIEWER_APP_ID=5321138 beep reviewer ruleset require --apply` once the reviewer runs on a healthy quota. |

### Linux acceptance criteria

- [ ] A sanitized inventory records each target host's role, OS, CPU/RAM/storage,
      installed tool paths and versions, package managers, readiness and blockers.
- [ ] beep-worker has verified Tailscale connectivity, fresh hardware-backed SSH,
      sudo requiring a fresh YubiKey touch, fail2ban, controlled inbound access,
      security updates without forced reboot, and a tested recovery path.
- [ ] Git, build dependencies, Rust/Cargo, Python/uv, Node 24/nvm, pinned Bun,
      Docker Compose/Buildx, Codex, Claude, Cursor, Grok, Muse and CLIProxyAPI are installed from official
      sources, configured for interactive and noninteractive shells, and checked
      with actual commands. Install optional tools only for a named workflow.
- [ ] Docker runs a disposable container and a representative compose service;
      expose services only on loopback or the approved tailnet surface. Choose
      rootless operation for agent work where compatible, and document exceptions.
- [ ] 1Password uses the approved shim and service-account lane, tested with the
      actual required op operation and output suppressed. GitHub push/PR access,
      private registry pulls, and agent provider access each have separate proofs
      or a concrete human-authentication blocker. Installation is not sign-in.
- [ ] A clean beep-effect checkout installs with the frozen lockfile using repo
      pins, runs `bun run beep --help`, and completes a representative package
      proof. The receipt distinguishes environment failures from source failures.
- [ ] Each Linux machine is marked ready only for the workflows actually proven;
      tbk-ubuntu is not marked a development worker based on spare RAM alone.

### Additional verification and closure

Record dated sanitized receipts under `history/` for Linux installation,
authentication, package proof, resource limits, and recovery. Extend the existing
PR/mergeable/reflection gate to cover these criteria. Do not mark the original
cloud phases complete as a side effect of Linux setup. The operator excluded
staking backup work from this task; do not add it as a setup approval gate.

### Agent and proxy parity amendment

The operator explicitly included Grok, Muse and CLIProxyAPI on 2026-10-14.
Inventory native agent and proxy authentication separately: one does not prove
the other. Preserve the workstation's sanctioned model routes, including native
Codex and direct Claude defaults, and opt-in proxy wrappers. A proxy model
catalog is discovery evidence, not proof of inference or every account pool.
Account-pool sizes must be recorded; do not imply that the worker has all of the
workstation's provider accounts after authenticating one account per provider.
Do not copy session stores, private corpora or token-bearing configs wholesale.
For infrastructure utilities, record exact authenticated AWS/ECR and other
required operations separately from installing their CLI binaries.

### Workstation scan and headless friction acceptance

- Inventory installed development/cloud/agent CLIs, package managers, wrappers,
  headless services and portable agent configuration on DankStation. Assume they
  belong on admitted workers unless a documented compatibility, ownership or
  host-specific reason changes that decision. Include Azure, Vercel, Cloudflare,
  Cursor, Grok, Muse and CLIProxyAPI explicitly.
- CLI/agent/headless parity is the default baseline. Chrome as default browser,
  1Password Desktop, the workstation's ChatGPT/Codex desktop application and T3
  Code are explicit GUI additions; the operator handles Google/extension sign-in.
- After setup, run bounded headless agent sessions in a disposable checkout.
  Require command/evidence-backed friction reports covering Yeet, authentication,
  PATH, systemd, desktop hooks and absolute workstation assumptions. No forwarded
  admin agent, secret-store inspection, cloud mutations or staking access.
- Record introduced, inherited, host-specific and unsupported-workflow findings
  separately in research/OPPORTUNITIES.md; add owners, remedies, verification
  commands and reversibility to the plan before claiming environment independence.
- This is repo-operations work under the tooling family, not new product language
  or a foundation/shared package. Keep goal-specific host evidence in this packet;
  any reusable typed CLI changes belong in existing tooling ownership boundaries.

### PR #1750 mergeability continuation (2026-10-20)

Continue the existing published branch by merging current main, preserving its
history and the worker evidence already recorded. Reconcile documentation and
regenerate catalogs with the owning commands. No worker synchronization or
remote provisioning is required to qualify this repository change. Reversal
is a revert of the integration commit; the previous branch tip is b6f027e178e0.
The requested endpoint is mergeable, with the PR left open. Existing host and
provider qualification gaps remain bounded by their recorded evidence.
