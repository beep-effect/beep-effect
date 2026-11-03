---
name: remote-development-agents
description: >
  Run development and coding-agent work on beep-worker, tbk-worker, dankserver
  or tom-pc-1. Use for selecting a worker, choosing its T3 or SSH route,
  launching a bounded job, observing an existing remote job, or collecting its
  result. Covers host-specific readiness, YubiKey access, credential boundaries
  and durable job receipts.
---

# Remote development agents

Use the existing worker, account and limits; this skill does not provision hosts,
grant credentials, expose services, authorize delegation or authorize a merge.
The user's task and the repository's instructions still determine allowed work.

Read [host profiles](references/hosts.md), then
[job operations](references/jobs.md). Resolve these relative to this skill's
real path, including when it is installed globally through a symlink. The
versioned source belongs to Beep; each target checkout supplies its own rules.

## Workflow

1. **Select and verify the target.** Confirm hostname, ordinary worker account,
   current readiness and limits. Do not treat a dated setup receipt as a current
   health check. Do not send work to `tbk-ubuntu`: its development target is the
   separate `tbk-worker` guest. Dankserver admits one substantive job at a time
   under its smaller budget; its profile records provider proof and quota holds.
2. **Pick the route, then connect without administrative forwarding.** A host
   whose T3 environment is linked (its row in the profiles table names a T3
   route and `t3_environment_links` lists it) is driven from this T3 session:
   `orchestrator_capabilities` with that `environmentId`, then `delegate_task`
   with `target.environmentId` (and `projectId`) or `t3_thread_launch` with
   `environmentId`; `t3_thread_send`, `t3_thread_wait` and `t3_thread_read`
   carry the same id. Until `goals/t3code-fleet-rollout` links a host, or for
   the shell steps a T3 thread cannot do, use the profile's canonical
   workstation SSH wrapper. Announce hardware touches; serialize requests to the
   physical key. Resume a pending terminal instead of opening another. Retry
   expired authentication at most three times, never an uncertain mutation.
   Administration uses a separate shell and only the approved identity. Close
   that shell before running an agent. Never attach an agent to a privileged
   Docker socket or inherit an administrative SSH agent.
3. **Establish ownership.** Read the remote checkout's `AGENTS.md`, branch, dirty
   state, remote, existing jobs and task ledger. Preserve others' changes. Use an
   isolated worktree when the task requires one; do not silently take over an
   occupied checkout or an existing agent conversation.
4. **Prepare a bounded brief.** Name the exact checkout, objective, permitted
   edits, acceptance checks, publication boundary and receipt location. Use
   `gpt-6.1-sol` with medium reasoning for substantive Codex work. Check the
   current approved provider routing before choosing another lane; a normal
   failure is not a reason to switch models or buy additional usage.
5. **Launch and capture identity.** Start one substantive job at a time in the
   admitted shared user slice, with finite runtime and explicit limits. Record
   its systemd unit, the repository's durable job ID, or (on the T3 route) the
   `taskId` and thread `link` that `delegate_task` returned, immediately. Remove
   administrative and secret-service environment variables from the child to
   prevent ambient inheritance; this does not revoke worker-owned vault access.
   Fail closed if the user manager or required slice is unavailable.
6. **Observe the same job.** Poll its recorded identity, not a replacement
   invocation: on the T3 route, wait for the completion to wake you, then
   `task_status` or `t3_thread_read` with the recorded `environmentId`. A disconnected SSH session does not mean the job failed. Inspect
   exit status, resource failures, changed files and the requested acceptance
   evidence. Keep provider quota, authentication, inference and tool execution
   as separate claims. Stop only a job owned by this task.
7. **Return evidence and close access.** Report host, checkout/commit, job ID,
   outcome, checks and remaining limits. Save sanitized receipts before cleaning
   up the transient unit. Keep worktrees and credentials until their applicable
   retention/retirement workflow permits removal. Update the task ledger. Use
   Beep's Yeet workflow for Beep publication; pushing, mergeability and merging
   are separate states.

## Credentials and recovery

All three worker accounts can read every item in `BEEP_SECRETS` through their
approved `op` shim. Jobs run as that same account and can also read its protected
service-account store. Mode 0600 and environment cleanup do not isolate secrets
from same-user jobs. Shared-vault administrative, deployment and review-signing
credentials retain their upstream powers; use only what the task authorizes.
D40 records the operator-approved broad grant and how to revoke or narrow it.
Do not describe task-use restrictions as technical credential denial.

- Use the host's approved `op` shim from `PATH`; verification reads go to
  `/dev/null`. On an agent-side failure run `op-doctor` once, then stop that path
  if the exact operation still fails. Do not repair it through desktop sign-in.
- Never print environments, raw vault items, authentication files or process
  argument lists. Probe only required presence, permissions or status fields.
- For sensitive human text, read the globally installed
  `plasma-sensitive-entry` skill. Local YubiKey wrappers, remote wrappers and
  approved agent secret routes take precedence. No secrets in chat or prompts.
- Keep development servers on loopback. Any forwarding or network exception
  must fit the task's authorization and the host profile. A working SSH session
  does not authorize public exposure or access to other fleet machines.
- On a tbk protective stop, follow its runbook and leave the guest stopped.
  Never relax the guard, start the VM directly or restart staking services.

## Examples

- “Run the package checks on tbk-worker”: use ordinary guest access, verify its
  shared slice, launch one bounded job, and return its exact exit/check receipt.
- “Continue the build after SSH disconnected”: inspect the original unit or
  Yeet job ID and resulting files before deciding whether any retry is needed.
- “Use dankserver for an agent”: use the dedicated worker login and its
  qualified route from its profile; verify the current host budget and provider status.
  The administrative login and an installed CLI alone are insufficient.
