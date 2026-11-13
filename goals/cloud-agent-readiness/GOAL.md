# GOAL: agent and Linux development readiness

Scope includes managed Linux workers and fresh hosted agent containers
(operator, 2026-10-14); the packet keeps its path and id.

Read AGENTS.md and this packet's README.md, SPEC.md, PLAN.md and
ops/manifest.json first. SPEC.md is normative. Read the historical cloud probe
and current scripts/cloud/bootstrap.sh before changing cloud behavior.

Outcome: fresh cloud containers can install, prove and publish with explicit
host awareness and a documented closeout handoff. Managed Linux workers have
verified secure access, repo-pinned development tools, approved authentication,
and a real beep-effect package proof. Installed tools alone are not readiness.

Scope:
- Preserve original cloud acceptance and decisions D1-D7; expired credit dates
  and old script names are history.
- Add Linux workstreams L0-L4 and managed Linux decisions: inventory this workstation,
  provision beep-worker, assess dankserver, and admit a tbk-ubuntu worker only
  through an isolated guest with measured CPU/RAM/I/O limits.
- Install/configure Git, build tools, Rust/Cargo, Python/uv, Node 24/nvm,
  repo-pinned Bun, Docker Compose/Buildx, Codex, Claude, Cursor, Grok, Muse and CLIProxyAPI from official
  sources. Prove noninteractive shell operation and representative workflows.
- Use approved 1Password accounts. TBK and dankserver have independent read-only
  accounts for all BEEP_SECRETS items plus their development vaults (D40).
  Deliver and verify credentials per D10. Never print, commit, or copy
  resolved secrets into reports; follow AGENTS.md failure handling.
- Match dankserver's live hardware-backed OpenSSH and pam_rssh sudo, with a
  root-owned allowed-key file. Keep admin-agent forwarding out of agent jobs.
  Prove fresh SSH and sudo before retiring recovery/bootstrap access.
- Development apps run on the tailnet using explicit bindings/rules or Serve.
  No public Funnel by default. Prefer rootless Docker where compatible.
- Preserve staking services on tbk-ubuntu bare metal. Do not copy host credential
  files, Docker sockets or admin agents into the guest. D40 (worker vault
  reads) and D23 (guest-only administration keys) apply.
  Staking backups are excluded from this task.

Workflow:
1. Inspect branch, unrelated edits, active work and actual host state.
2. Record tool paths, versions, managers and sanitized authentication status;
   repo pins outrank this workstation's global versions.
3. Save changed access configuration and keep a live recovery session. Serialize
   hardware authentication and follow the bounded retry guidance.
4. Provision only the named surfaces; do not wholesale-copy home directories,
   dotfiles, Docker credentials, provider sessions or SSH private keys.
5. Separate tool installation, authentication, runtime health, package proof
   and fleet readiness in dated receipts under history/.
6. Run a clean frozen dependency install, bun run beep --help and one
   representative package verification on each admitted development worker.
7. Reconcile cloud and Linux acceptance and publish through Yeet. Do not mark
   unrelated original cloud phases complete because Linux provisioning
   succeeded.

Verification:
- GOAL.md remains at most 4000 characters.
- ops/manifest.json parses; git diff --check passes for packet changes.
- Each host has the SPEC.md evidence and a concrete readiness/blocker status.
- Cloud bootstrap and hook checks remain required for their original surface.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug cloud-agent-readiness` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/cloud-agent-readiness/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
