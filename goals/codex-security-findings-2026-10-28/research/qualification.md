# Qualification evidence — 2026-10-28

Baseline: `2c59e073c8`. Exact capture identities and full-detail evidence are
recorded in the findings. This is implementation proof, not external closure.

| Check | Observed result |
| --- | --- |
| ACP stderr tests | 12 passed |
| Scanner and model recovery tests | 71 passed across two files |
| Skill recovery tests | 71 passed |
| Worktree retirement tests | 13 passed, including post-capture late-write preservation |
| Bridge policy and actual entrypoints | 3 passed; remote plaintext refused before token lookup |
| PowerShell parsing | All deployment scripts parse under installed PowerShell |
| ACP package verification | Audit and docgen pass |
| Hub package verification | Audit passes; app has no docgen target |
| CLI package verification | First run exposed introduced inference/service-context errors; fixed. Full rerun pending |
| CLI source check | Pass after those corrections |
| Windows pipe runtime | Pending the new Windows CI job; Linux parsing does not prove Windows IPC behavior |

The named-pipe fix checks the security descriptor from the connected handle,
not a separately opened name or a permissive ACL entry. Microsoft's
[PipeStream.GetAccessControl documentation](https://learn.microsoft.com/en-us/dotnet/api/system.io.pipes.pipestream.getaccesscontrol?view=netframework-4.8.1)
and [Roslyn's ownership check](https://source.dot.net/VBCSCompiler/src/roslyn/src/Compilers/Shared/NamedPipeUtil.cs.html)
provide the platform contract and a production precedent. The receiver sets its
owner explicitly. The test uses synthetic bytes and kernel objects owned by the
current user or a distinct administrator-group SID; it does not provision local
accounts or claim a deployed multi-account exploit reproduction.

All Cloud findings remain New until merged-revision verification. No real
credential, live service configuration, user data or deployment was changed.

## Local compute boundary

The default CLI package proof remained pending beyond ten minutes and was
interrupted under the repository constrained-compute rule. The quick package
verification passed lint and check (10.4 s and 23.3 s). Hosted checks remain the
authoritative completion proof. The first default run's source typing failures
were introduced and corrected; no diagnostic policy or baseline was weakened.

Yeet repair's terse-helper output lists repository-wide audit candidates.
These are not established required-gate failures. Optional cleanup was kept
outside the security diff; its scratch lane was archive-retired. Actual gate
results determine any needed inherited-failure repair.

## Hosted qualification

PR #2333 is published at `44debfb814`. The first Windows job failed before
tests because a historical ontology archive name contains a colon, which
Windows cannot materialize. The workflow now checks out only the deployment
scripts needed for this test. This preserves the full repository and does not
disable Windows path protections. Runtime qualification awaits the rerun.

CLI and ACP package-owned test compilation artifacts both record exitCode 0
and no diagnostics. The symlinked-parent recovery regression was rerun after
the captured-service binding correction and passed (one selected, 70 skipped).

The collected publication proof exceeded ten minutes and was interrupted.
The documented direct-push fallback preserved the normal pre-push runtime
check and opened a draft with ready-for-heavy. Hosted checks remain mandatory.
The user manager is unavailable, so the readiness monitor runs attached.
