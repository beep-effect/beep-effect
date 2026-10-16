# Codex headless follow-up — 2026-10-14

Orchestrator provenance: fresh native gpt-6.1-sol / medium, read-only sandbox,
360-second timeout, explicit `env -u SSH_AUTH_SOCK` after an initial launch
exposed a multiplexed SSH agent. Corrected run exited zero, completed eight
command events and a final turn; worker Git status remained clean. This is the
agent report, with broader harness corrections in the combined follow-up receipt.

# Portability follow-up audit

**Result:** installed CLI inspection passes; credential-dependent and detached workflows remain unqualified in this execution profile. The goal and fleet are **not fully ready**.

Eight substantive bounded command batches were used. No fixes, installs, Git changes, agent launches, deployments, credential-file reads, graph refreshes or full tests were performed.

## Execution profile and provenance

- **Source checkout:** `~/YeeBois/projects/beep-effect`, branch `main`, clean before and after.
- **Profile:** read-only filesystem, restricted network, no escalation or alternate execution profile.
- **Administrator socket:** `SSH_AUTH_SOCK` absent.
- **Dependencies:** checkout-local `node_modules` directory, not a symlink; Effect package present.
- **Current provisioning evidence:** copied packet at `~/.cache/beep/readiness/portability-wave2/goals/cloud-agent-readiness`. Read README, SPEC, OPPORTUNITIES and dated qualification histories.
- **Repository evidence:** live AGENTS.md, hooks, MCP configuration and documentation. Copied README/SPEC differ from repository versions; the copied OPPORTUNITIES file has no repository counterpart. Older repository/history statements were not treated as current provisioning state.

## Commands and results

Authentication responses were suppressed.

| Command/check | Result |
|---|---|
| PATH resolution | Core development, agent and cloud CLIs resolve; `serena`, `CLIProxyAPI` and `cliproxyapi` do not |
| `bun --version`; `bunx --version` | Both exit 0, **1.4.2**, matching repository pin |
| Core versions | Node 24.21.0; Git 2.53.0; Rust/Cargo 1.99.0; Python 3.14.8; uv 0.12.23; Docker 29.9.0; systemd 259 |
| `gh --version`; `graft --version` | Exit 0: **2.102.0**, **0.21.1** |
| `bun run beep --help` | Exit 0 |
| `bun run beep yeet --help` | Exit 0 |
| `bun run beep yeet proof-report --json` | Exit 0; ledger belongs to this checkout; zero attempts, `enforcementReady=false` |
| `systemctl --user is-system-running` | Exit **1**: user-bus connection denied, “Operation not permitted” |
| `gh api user >/dev/null` | Exit **1**, success false; stderr also suppressed |
| `gh auth status --json hosts`, suppressed | Exit **0** |
| `op vault list >/dev/null` | Exit **4**, success false; stderr also suppressed |
| `op-doctor`, once | Exit **73**: “Read-only file system”; “could not create doctor temporary directory” |
| `bun run beep models check` | Exit **1**: transport error fetching the remote model catalog |
| Reference/graph presence | `.repos/effect`, `.repos/effect-workspace`, default reference root and `graft/` absent |
| Final Git checks | Status empty; staged and unstaged diff checks exit 0 |

## Earlier findings now resolved

**Verified live:**

- Missing `bunx` provisioning omission: executable exists and matches Bun’s pin.
- Missing Graft executable: version command succeeds; graph qualification remains separate.
- Missing model manifest: file now exists; successful drift checking remains unproven.
- Borrowed-dependency audit shortcut: actual checkout has nonsymlink dependencies and is clean. Proof-report ledger now identifies the intended checkout.
- Old gh compatibility gap: current executable is 2.102.0; structured account-status command succeeds.

**Resolved by current copied receipts, not repeated here:**

- T3 provider launch/authentication and read-only GitHub discovery.
- Azure, Vercel and Wrangler account access.
- Scoped esbuild/workerd installation-script remediation.
- AWS/S3 Pulumi backend access and four-stack discovery.

Those receipts qualify their recorded workflows and contexts, not this sandbox or deployment rights.

## Remaining findings and proposed goal additions

Proposals below were **not implemented or executed**.

| Finding and minimal evidence | Classification | Proposed goal addition / verification |
|---|---|---|
| User-bus access denied; gh API and op probes fail; doctor cannot create temporary storage | **Execution-profile**; auth failure causes unresolved | Tooling owner: separate host authentication from sandbox capability acceptance. Repeat bounded, suppressed probes in each intended profile; retain actual exit codes. |
| Model manifest exists, but `models check` fails on remote catalog transport | **Execution-profile/network limitation**; exact cause unproven | Record catalog reachability separately from routing drift. Verify `timeout 35s bun run beep models check`. |
| Effect references and Graft graph absent | **Host-specific** setup gap | Add workflow-scoped reference/structural-graph qualification. Verify presence with `test -e .repos/effect`, `test -e .repos/effect-workspace`, `test -d graft`; parser/query proof requires a separate authorized audit. |
| MCP configuration requires missing `serena`, a local IDE endpoint and an op-backed server | **Host-specific/inherited** integration assumptions | Define required/optional MCPs per workflow. Verify `command -v serena` where required and actual harness connection status. Bunx availability alone does not prove MCP startup. |
| Hook scripts default to `desktop-ntfy-1` and contain detached notifier launch paths; inspected pulse hooks lack `BEEP_AGENT_HOST` guards | **Inherited** workstation coupling | Add explicit headless capability acceptance; verify recorded SessionStart/Stop behavior in a separate harness. Static inspection is not runtime proof. |
| Updated copied SPEC still contains executable acceptance references to retired bootstrap; retired file absent | **Inherited** contract drift | Reconcile acceptance with `scripts/cloud/bootstrap.sh`. Verify `test -f scripts/cloud/bootstrap.sh` and review retired-command matches in SPEC. |
| Neither checked proxy executable spelling resolves, despite successful proxy-service provisioning receipt | **Host-specific**, naming unresolved | Record canonical executable/service entrypoint and qualify it without guessing aliases. Verify `command -v <documented executable>`. |

No new implementation regression was established. The earlier introduced `bunx` omission and borrowed-dependency shortcut are resolved within the limits above.

## What remains unproven

Fresh frozen installation, representative/full package proof, Graft native parsing and discovery, reference correctness, successful model-route checking, MCP connectivity, trusted headless hook behavior, proxy inference/account-pool parity, detached Yeet jobs, GitHub writes, publish-through-closeout, cloud deployments and other fleet hosts.

The copied packet’s successful host receipts and this profile’s failures describe different execution contexts. **This audit qualifies bounded inspection and installed CLI loading only.**
