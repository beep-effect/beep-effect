# Agent and Linux Development Readiness Plan

> Bootstrap history: references to `scripts/cloud-session-setup.sh` below record
> the original 2026-10-01 acceptance. That script is retired by workstream C;
> current bootstrap is `scripts/cloud/bootstrap.sh`. Packet lifecycle is unchanged.

## Status

Status: `in-progress` — P0 and P1 complete 2026-10-01 (PR #1378); P3 complete
2026-11-02 on #2486 (SPEC D42). P2, P4, P5 and P6 remain; see
[`history/2026-11-01-fleet-cloud-setup.md`](./history/2026-11-01-fleet-cloud-setup.md).

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Probe a fresh cloud container and record every failure with its command. | [`research/2026-10-01-container-probe.md`](./research/2026-10-01-container-probe.md) (F1–F15) exists; decisions D1–D7 are written into `SPEC.md`. |
| P1 Toolchain bootstrap | complete | `scripts/cloud-session-setup.sh`: pinned bun (D1), preflight for denied hosts (D2), frozen install with CI's retry, post-install assertion. | Acceptance rows 1–3 pass; `shellcheck` clean; the script runs green on a workstation and in the cloud once `pkg.pr.new` is allowed. |
| P2 Harness host awareness | pending | `BEEP_AGENT_HOST=cloud` guards in `.claude/hooks/*` and `graft-hooks.cjs`; MCP expectations recorded (D3, D7). | Acceptance row 4 passes; pulse conformance green if a literal was added. |
| P3 Publish handoff | complete | Document and exercise the D4 end state from a cloud session: proof → push → PR via API → `ready-for-heavy` requested in the body; operator closeout steps named. | Met by #2486 (merged 2026-11-02 as `43d0a511`): [`history/2026-11-01-claude-cloud-smoke.md`](./history/2026-11-01-claude-cloud-smoke.md) shows the loop on `@beep/types` (acceptance row 6). |
| P4 Doctrine | pending | `AGENTS.md` cloud section (now "Cloud Environments"), the existing [`docs/runbooks/cloud-environments.md`](../../docs/runbooks/cloud-environments.md) runbook (SPEC D42: no separate `cloud-sessions.md`), cross-links, roadmap accelerator row, fourth meter in `agent-pools.md` (D6). | Acceptance row 5 passes against the current names; docs cross-link check green. |
| P5 Yeet: PR to mergeable | pending | Publish through yeet (operator-side per D4) and drive the PR to mergeable: required checks green, review threads answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P6 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

Phase ids here match `ops/manifest.json` `phases[]` exactly.

## P1 — Toolchain bootstrap, in detail

1. Read `.bun-version`; if `bun --version` already matches, skip to step 4.
2. Download `https://github.com/oven-sh/bun/releases/download/bun-v<ver>/bun-linux-x64.zip`
   into `~/.cache/beep/bun/<ver>/`; verify `sha256sum` against
   `.bun-linux-x64.sha256`; on mismatch, fail (stop condition). If the download
   is denied, fall back to `npm install --prefix ~/.cache/beep/bun-npm bun@<ver>`
   (F4). If both are denied, exit `78` naming `github.com` and `registry.npmjs.org`.
3. Put the binary on `PATH` for the rest of the script and print the
   `export PATH=…` line the caller sources. When `~/.bun/bin/bun` exists and is
   busy (F5), rename the new binary over it (`mv`), never `cp`.
4. Preflight `pkg.pr.new`: a `GET` of one real snapshot URL from
   `package.json` through the proxy (the site root is never probed); any
   non-2xx/3xx status exits `78` with the remedy line. `--check` stops here and reports every probe
   (bun version, bun route, `pkg.pr.new`, `gh auth status`, user bus, `op`).
5. `bun install --frozen-lockfile`, three attempts with the same backoff CI uses
   (`.github/actions/setup-monorepo-ci/action.yml`).
6. Assert every catalog package pinned to `pkg.pr.new` in `package.json` is
   present under `node_modules/` and `bun run beep --help` exits `0`;
   otherwise exit non-zero naming the missing packages (never report success
   on a silent partial install, F6).
7. Write `BEEP_AGENT_HOST=cloud` into the env file only when `--host cloud`
   was passed; never infer it. Binaries land in `~/.bun/bin` only when the
   caller's `bun` already lives there (so the caller's PATH needs no change);
   with no `bun`, or a mise-managed or otherwise relocated one, they land in
   `~/.cache/beep/bin` and the caller sources the env file, which the script's
   final line says.

Optional extension, not acceptance: `--with-effect-ref` runs
`scripts/setup-effect-ref.sh` with `BEEP_REFERENCES_ROOT=~/.cache/beep/references`
so the v3↔v4 validation rule can be honored in the cloud (F13).

## P2 — Harness host awareness, in detail

- `hook-pulse.sh`: when `BEEP_AGENT_HOST=cloud`, skip the desktop notifier and
  keep writing rows. Check `HookPulseV1` for a host field; add the `cloud`
  literal only if the writer would otherwise fail its conformance test.
- `graft-hooks.cjs session-start` / `stop`: exit `0` immediately when
  `BEEP_AGENT_HOST=cloud` and `graft/` is absent.
- `packet-projections.sh`: already non-blocking; leave it, but make it skip
  when `node_modules/effect` is absent so it does not spend the SessionStart
  timeout on a known failure.
- Research whether `.claude/settings.json` can scope `.mcp.json` servers per
  host; if not, D7's runbook table is the answer.

## P3 — Publish handoff, in detail

The cloud session that proves this packet is the evidence: run the setup
script, run `bun run beep quality package-verify @beep/repo-ai-metrics --quick`
(or the package P2 touched), quote the output in the PR body, push, open the
PR through the GitHub API, and record the note under `history/`. The operator
then runs the yeet closeout from a workstation (`monitor --until-ready`,
`ready-for-heavy`, `sweep --retire`), per D4.

## P6 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo **tooling**
   (what worked, what didn't, what was frustrating, what you wished existed), the
   **implementation** (improvement opportunities), and the **goal/prompt** (would
   you revise it to be clearer/easier/more efficient?). Capture TODOs worth
   codifying. Its YAML frontmatter must validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`, so a missing/invalid reflection blocks closeout).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Record friction receipts in the active research packet's ledger the moment
  they happen (repo law), redacted for a public repo.

## Verification Commands

```sh
test "$(wc -m < goals/cloud-agent-readiness/GOAL.md)" -le 4000
jq . goals/cloud-agent-readiness/ops/manifest.json
rg -n "cloud-agent-readiness|GOAL.md|agentLaunchers|packetAnchorDocument" goals/cloud-agent-readiness
git diff --check -- goals/cloud-agent-readiness
shellcheck scripts/cloud-session-setup.sh
bash scripts/cloud-session-setup.sh --check
bun run beep lint reflection-artifacts
```

## Managed Linux workstreams — added 2026-10-14

| Phase | Status | Work | Exit |
| --- | --- | --- | --- |
| L0 Inventory | complete (beep-worker) | Compare workstation tooling and live host state; record exact sudo mechanism on dankserver. | Sanitized inventory with explicit reuse decisions. |
| L1 Access and hardening | complete (beep-worker) | Finish beep-worker tailnet enrollment, pam_rssh YubiKey sudo and OpenSSH hardening; verify fresh access before retiring bootstrap access. | Fresh SSH and sudo proofs plus recovery receipt. |
| L2 Tools and authentication | in-progress | Install language/build/container/agent tools and the approved 1Password shim; reuse the authorized service account securely; prove required provider and registry operations. | Version, runtime and authentication receipts with remaining human sign-ins named. |
| L3 Development proof | complete (beep-worker) | Clean checkout, frozen install, Beep CLI and representative package verification; document resource budgets and tailnet development access. | Real package proof on each admitted worker. |
| L4 Fleet closeout | pending | Reconcile Linux and cloud acceptance, PR readiness and reflection. | All admitted surfaces proven or explicitly recorded as blocked; existing closeout gate passes. |

Staking host provisioning stays isolated from its running validators. Do not
migrate them to VMs, install a development stack on the staking host, or expose
its credentials as a shortcut to making a worker ready.

### Staking-host worker continuation — 2026-10-23

Priority change: the operator requested stable 26.04 LTS host upgrades first
(D21). Both upgrades and post-reboot recovery are now verified, including fresh
tbk hardware administration and successful Rocket Pool attestations. Evidence is in the
[host upgrade checkpoint](./history/2026-10-23-host-os-upgrades.md). Preserve
unrelated changes in the dankserver control-plane checkout.

The operator accepted a KVM guest (D13) managed by libvirt/QEMU (D14),
initially serving command-line and web workflows (D15), with 4 vCPUs and
32 GiB guest RAM (D16). A 512 GiB disk may use verified free extents on the
old Ubuntu SATA SSD while preserving existing data (D17).
Restricted guest networking is accepted (D18): operator inbound access and
public-internet egress, with private host/LAN/tailnet initiation denied by default.
D19 originally required a dedicated development-only 1Password account.
D40 later expanded its readable credential scope as described below.
D29 initially admitted repository, registry and coding-provider credentials.
D40 supersedes the vault membership: each dedicated worker account can read
`BEEP_SECRETS` plus its own development vault. The replacements were verified
and the old accounts revoked. Shared-vault visibility does not authorize
using every credential or performing cloud deployments.
D30 uses beep-worker's documented headless environment as the implementation
baseline; the operator confirmed the same tools with coding credentials
initially, deferring cloud-account sign-ins. Reuse the existing setup and recovery receipts, refresh repository
pins and official installers at provisioning time, and size internal worker
concurrency for this guest's four-vCPU/32-GiB allocation.
Continue the design interview one decision at a time, recording accepted
choices in SPEC and dated evidence in
[the setup checkpoint](./history/2026-10-23-tbk-worker-design.md).

Current checkpoint: the guest is provisioned, bounded and enrolled. Live
isolation and graceful/forced protective-stop tests pass. Repository installation
and representative quick checks pass; dedicated vault and scoped GitHub access
are verified. One real I/O-pressure stop was investigated without relaxing any
limit. Numerical shutdown diagnostics, guest restart checks, bounded Effect
reference graph/query proof and native/proxy provider sign-ins now pass. Four
native providers and all four proxy wrappers return successful inference;
Cursor's approved Opus model remains quota-blocked until November 11 after
its targeted AppArmor prerequisite was repaired. Full provider tool execution,
broader reference indexing, host-reboot recovery and parallel capacity retain
their separate acceptance boundaries. Keep heavy work serialized. See the
[operating runbook](./ops/tbk-worker-runbook.md).

1. Manager selected: libvirt/QEMU. Verify enforceable CPU, memory and disk I/O
   limits on the installed version before admitting guest workloads. D24 limits
   the VM to two physical cores and their four sibling threads, with one combined
   four-logical-CPU runtime ceiling. Recheck topology and verify startup/runtime
   cgroups, thread placement and dedicated helpers before admission.
2. Initial CPU/RAM and conditional storage allocation selected. D31 implements
   the 512 GiB guest disk as a preallocated raw image in a new 544 GiB SATA
   filesystem/LV. Verify free extents, stable disk identity and drive health
   immediately before allocating storage. Preserve LVM metadata and account
   for filesystem reserved space; reapply image preallocation after conversion.
   Guest OS is Ubuntu Server 26.04 LTS (D20). D23 resolves guest administration:
   enroll a guest-only hardware key and separate agent; forward it only during
   explicit administration, never to normal development sessions.
   D25 sets a 36 GiB total host-memory ceiling, no host swap and no automatic
   restart after memory-limit failure. Verify the initial 4 GiB overhead
   allowance for the 32 GiB guest and all supporting processes under load.
   D26 sets combined disk limits of 100 MiB/s and 5,000 operations per second,
   with no extra burst allowance. Qualify read/write enforcement using only
   disposable guest-owned data, including the provisioning write path.
   Maintain D40 full-vault access and its task-use restrictions, and
   verify D18 network policy, with D28
   admitting only DankStation as the initial inbound source. A live tailnet
   audit informed the explicit approved device/service destinations,
   admitting only DankStation-to-guest TCP 22. Keep the new guest tagged from
   enrollment. The operator approved and saved this policy on 2026-10-23 (D32).
   Its 32 tests passed the save gate; saved JSON semantically matches the approved
   candidate. Real guest allowed/denied paths and host-side LAN/control
   isolation passed (D32/D34); retain these controls. Qualification also covers
   the accepted CPU/memory/disk controls. D27 keeps startup manual after reboot,
   requires healthy pre-start checks and authorizes a host-side protective stop
   of the VM only. Verify graceful shutdown, the 60-second forced-stop deadline,
   stale/missing telemetry handling and explicit restart with synthetic signals.
   D33 requires 60 consecutive healthy seconds before startup and 90 seconds
   of sustained health failure before the stop sequence. Loss of isolation or
   resource limits fails closed immediately.
3. Privileged administration was verified and the unintended, unused LXD
   installation was removed through that route (see the setup checkpoint).
   After the host upgrade, D22's fresh hardware SSH and sudo checks passed.
   The workstation's `ssh-tbk-ubuntu` wrapper is installed; `--admin` explicitly
   forwards its dedicated agent. Do not use Docker or LXD membership to bypass
   the host's authentication policy.
4. Measure host and validator baseline, provision the bounded guest, and prove
   its restrictions plus recovery under a representative development workload.
5. Qualify tools and actual workflows inside the guest using L2/L3 acceptance
   and D30's beep-worker baseline: development runtimes, rootless Docker,
   native agents and local proxy, GitHub/registry access, bounded local reference
   tooling, clean checkout/package proof, detached jobs and recovery. Requalify
   noninteractive and user-service PATH/credential resolution. Do not copy the
   old machine's caches, fleet credentials, resource allowances or desktop
   dependencies. Keep cloud CLI installation distinct from account admission.

No disk with existing LVM, ZFS or backup use is a disposable target merely
because it is unmounted or mostly empty. Staking backup work remains excluded.

## Workstation parity and headless qualification

1. Scan DankStation's CLI/version/manager/wrapper/service surfaces; decide reuse
   from live evidence and architecture doctrine, not copied home directories.
2. Install the admitted baseline and explicit GUI additions on beep-worker;
   separate install/configuration/authentication/runtime proof for every row.
3. Run bounded headless sessions without an admin agent in a disposable checkout.
   Collect reports and logs; reconcile Yeet/docs/config assumptions against this
   host rather than silently teaching agents DankStation's absolute commands.
4. Convert friction into named additions in this plan and the normative spec.
   Commit progress on feat/linux-agent-readiness; publish only through repo gates.

## Findings-driven additions (headless wave 1)

| Owner / work item | Required proof | State |
| --- | --- | --- |
| Linux bootstrap: bunx, native dependencies, model manifest, GUI launch PATH and project trust | Fresh SSH/GUI command resolution and fresh headless startup | in-progress; bunx fixed |
| Audit harness: independent dependencies and correct ledger attribution | Independent frozen install; intended checkout/state root identified | pending |
| Managed-host capabilities: systemd/network/write/desktop availability | Same probes per admitted execution profile | pending |
| MCP workflow matrix and connector authentication | Expected tools connect; optional IDE tools do not stall headless startup | Seven read-only worker tool paths and native Codex calls pass; Stately OAuth, optional IDE/browser/outbox workflows and Claude quota rerun remain open |
| Graft and Effect references | Structural graph and reference query, without deep-model work | worker Beep/Effect and scoped federation qualified; eleven member graphs fresh; Alchemy parse coverage and aggregate resource limits remain open |
| Current bootstrap and closeout doctrine | Retired commands historical only; one closeout boundary per host | pending |
| Detached Yeet qualification | Bounded job/slice lifecycle and terminal receipt | partial: complete serial cheap-gate tier passes with normal detached finalization and wait 0; guarded terminal recovery and cancellation also proven; heavy/full proof remains open; repeat boot, guarded proxy startup and headless GitHub credential retrieval pass |
| Cloud credentials: Azure/Vercel/Cloudflare/AWS/Pulumi | Actual output-suppressed authenticated operation per selected account/project | complete for worker read-only access: Azure/Vercel/Cloudflare checks, AWS identity/state bucket, and S3 Pulumi stack discovery pass; deployments remain separate |
