# Post-main headless parity audit — 2026-10-14

Bounded native Codex inspection and direct host probes pass at
`37216960412ea464bbc74900fafae02f72097984`. The installed worker model manifest
does not decode under the merged CLI; an isolated main-seed check passes. This
is partial runtime acceptance, not full workstation or fleet readiness.

## Execution and results

The worker readiness checkout remains `feat/linux-agent-readiness`. Its seven
tracked configuration edits and untracked `.grok/config.toml` remain present.
The root main checkout and running services were not changed. Workload launches
explicitly removed `SSH_AUTH_SOCK` even though the transport reused an SSH master.

Native `codex exec` used `gpt-6.1-sol`, medium reasoning, the read-only sandbox,
JSON events and a finite 180-second timeout. It completed exactly four shell
batches, emitted a final report and `turn.completed`, and exited zero. It did
not edit repository files, launch other agents or run proof jobs.

| Check | Result |
| --- | --- |
| Host and source | beep-worker, exact expected SHA |
| Runtime versions | Node 24.21.0, Bun 1.4.2, Python 3.14.8, Rust 1.99.0 |
| Native Codex | 0.162.1; ChatGPT login status passes; fresh inference succeeds |
| Native tool paths | codex, cursor-agent, grok, muse, graft, docker, op and gh found |
| SSH workload socket | Absent in the agent inspection |
| Beep and Yeet help | Both exit zero inside the read-only agent profile |
| GitHub authentication | Direct host `gh auth status` exits zero |
| Rootless Docker | Direct host `docker info` exits zero, output suppressed |
| T3 backend | Existing user service active |
| Graft executable | Version 0.21.1 |

Direct authentication, Docker and service probes are host-profile evidence;
they were not repeated inside Codex's restricted profile. No 1Password secret
operation or doctor was needed; executable availability is the only new op
claim. No fresh Cursor, Grok, Muse, Claude or T3 provider inference was run.

## Model manifest compatibility gap

The ordinary worker `bun run beep models check` exits one before catalog checks:
the merged RoutingRole schema rejects an installed binding role. The worker
manifest still spells the opt-in role `muse.optin`; main expects `muse.opt-in`.
After replacing only that spelling in an in-memory comparison, the installed
manifest is byte-identical to the bundled main seed.

Generated a separate main seed at the private audit path with `models init
--manifest`, then checked it with `models check --manifest --report-dir`.
That check exits zero with **zero findings across 360 catalog models**. Its
router-for-me, Codex cache, Grok cache, Cursor and proxy-v1-models overlays all
answer, and its catalog diff has no changes. Routable older-model candidates
are proposals only; no model substitution was performed.

The installed manifest remains unchanged, respecting the R1 relay's ownership
boundary. Next: deploy the main-owned seed through the backup-producing CLI
adoption path, then rerun the ordinary check. Do not edit model literals,
generated policy tables or seed source to accommodate the old role spelling.

## MCP startup friction

The native session stderr records a Box MCP transport authentication failure:
the service reports that an access token was not found. The session still
completes successfully. The agent's final report observes no shell failures
and explicitly says MCP connectivity was not tested; the orchestrator's
startup-log inspection adds this separate finding.

The inspected native config declares node_repl and graft; this audit does not
establish the source of the additional Box startup connection. Trace its app
or connector ownership before changing configuration or starting an auth flow.
Do not classify the entire MCP matrix as passing from a successful agent turn.

## Evidence and remaining scope

Private worker evidence lives under `~/.cache/beep/readiness/post-main/`:
launch prompt, native JSON events, stderr, final report, ordinary model-check
output, isolated main seed and canonical model-check reports. These are retained
outside Git. The installed manifest SHA-256 remains
`2ad15578833e8d60a93f897879c4374e64334a5881a4be9cc7977ac90492bf63`;
the isolated main seed is
`cb1b05476db9cc4ff280d40d57bd2041899b24c01791d995ed265b4ff3f9a16b`.

This receipt supplements the prior complete serial cheap-gate proof; it does
not rerun that tier. Installed-manifest adoption, Box connector qualification,
other-provider post-main inference, reboot recovery, heavy/full proof and
concurrent capacity remain open. No credentials, deployments, publication,
package installations, service restarts or shared policy assets were changed.
