# Host profiles

These are routing records, not live health attestations. Last reconciled:
2026-10-24. The canonical Beep packet is `goals/cloud-agent-readiness` at the
repository containing this skill's real path. Read `SPEC.md` before changing a
boundary. Host-specific receipts are under that packet's `history/` directory.

| Target | Ordinary workstation connection | Readiness and boundary |
| --- | --- | --- |
| `beep-worker` | `ssh-beep-worker-yubi` | Existing headless development worker; default wrapper disables forwarding. Recheck current provider and workload readiness. |
| `tbk-worker` | `ssh-tbk-worker` | Separate KVM guest, account `worker`, no sudo; initial serialized development verified. Only DankStation has admitted inbound SSH. |
| `dankserver` | `ssh-dankserver-worker` | Dedicated bare-metal account `worker`; initial serialized development verified. Codex/Claude/Grok are available; Cursor/Muse have recorded quota holds. |

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

- Host boundaries: four vCPUs on two physical cores, 32 GiB guest RAM, 36 GiB
  aggregate host ceiling, no host swap, dedicated SATA allocation and disk
  limits. Startup is manual and guarded; protective stops never auto-restart.
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
