# Headless portability follow-up — 2026-10-14

## Outcome and provenance

Fresh native Codex and Claude audits completed on beep-worker's clean `main`
checkout at b43a4098 with its independent dependency directory. The current
readiness packet was copied into a private cache as audit context; it was not
silently substituted into the older worker checkout. The documentation branch
on DankStation remains separate. Neither agent changed worker Git state.

Successful CLI inspection does not establish full development, detached-job,
publishing or fleet readiness. Full reports:

- [Codex follow-up](2026-10-14-headless-codex-follow-up.md).
- [Claude follow-up](2026-10-14-headless-claude-follow-up.md).

## Launch correction and harness limits

The first pair of runs inherited SSH_AUTH_SOCK from the reused SSH master even
though each new ssh invocation used `-a`. An independent presence probe
confirmed this. Both first runs finished; their results are not accepted as
socket-free workload proof. Reran each native agent under explicit
`env -u SSH_AUTH_SOCK`. Independently checked the running timeout processes'
environment keys without printing values: both lacked SSH_AUTH_SOCK. Corrected
agent reports also confirm absence. T3's existing UnsetEnvironment drop-in is
unchanged; a shell environment fix is not proof that every user service strips
the variable or that other discoverable sockets cannot be reached.

Both models and efforts were pinned: gpt-6.1-sol/medium and
claude-opus-5-5/medium. Each run had a 360-second timeout. Corrected Codex
completed eight command events and a final turn with exit zero. Corrected
Claude exited zero, reported no agent error and its model usage matched Opus
5.5. Its report disclosed a temporary-file write and a transient systemd probe,
outside the requested read-only/no-job limits. Do not treat plan mode as an OS
sandbox or that probe as detached Yeet qualification. Claude also reported
eight command batches plus a packet read, so the batch budget was not strictly
enforced. Keep these deviations visible in future audit harness design.

## Profile comparison

| Check | Codex read-only sandbox | Claude plan profile |
| --- | --- | --- |
| CLI/help loading, bunx, gh upgrade | Pass | Pass |
| Independent dependencies and clean checkout | Pass | Pass |
| Workload SSH_AUTH_SOCK | Absent after correction | Absent after correction |
| GitHub API, 1Password vault listing | Fail; restricted profile, responses suppressed | Pass; responses suppressed |
| User-systemd access | Denied | Running; linger enabled |
| Model-policy check | Catalog transport failure | Eight findings |
| Graft executable | Present, version passes | Present, version passes |
| Effect references / checkout graph | Absent | Absent |

The sandbox failures do not invalidate the earlier direct account/service
receipts. The same workflows require explicit capability acceptance per profile.
The read-only op-doctor follow-up still cannot create diagnostic temporary
storage. No protections were loosened to make its probe pass.

## Resolved and remaining findings

Resolved within the inspected checkout: missing bunx, missing Graft executable,
missing model manifest, borrowed dependency-directory shortcut, old gh, and
ambiguous ledger ownership. Binary availability does not prove MCP startup,
Graft parsing/querying or frozen-install reproducibility in this run.

Remaining goal work:

1. Qualify Graft's native parser/structural graph and provision Effect references
   through the approved route. References are absent; the planner proposes deep
   builds forbidden by agent policy. Do not execute those plans blindly.
2. Reconcile model-policy drift. A bounded orchestrator check on DankStation
   also exited one, with ten findings including the same seven repository
   findings. Worker-specific home.codex.config locator failure remains
   unattributed; a failed locator does not prove the effort pin is wrong.
3. Define required/optional MCPs and prove actual connections. Serena is missing;
   IDE/HTTP endpoints and op-backed launchers need workflow-specific acceptance.
4. Qualify detached Yeet with a bounded real lifecycle. agent-runs.slice is
   absent; help/report commands are not completion proof.
5. Document managed-host capabilities, notifier/hook behavior and project trust.
   Static path/guard searches do not demonstrate a failing runtime workflow;
   distinguish legitimate examples from executable absolute-path coupling.
6. Reconcile retired bootstrap commands in executable acceptance, keeping
   historical references intact. Preserve the older dirty audit worktree until
   its contents and ownership have been inventoried.
7. Enforce workload agent-environment hygiene in SSH wrappers and user services.
   Claude observed a local desktop agent in the user-manager environment; its
   identity and key contents were not qualified. No global agent was stopped.

Codex's guessed proxy binary spellings were unresolved. Orchestrator follow-up
verified the actual canonical `cli-proxy-api` executable resolves and its user
service is active. This is a naming/documentation issue, not proof the proxy is
missing. Fresh inference and account-pool parity remain separate.

No model candidate was adopted, no reference deep build ran, and no deployment,
GitHub write, full test suite or publish/merge flow was performed. The goal
remains active with explicit follow-up rather than a fleet-ready claim.
