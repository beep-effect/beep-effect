# Fallow introduced-complexity closeout — 2026-10-14

The preceding worker run identified introduced complexity in recovery readLocked
and model bindingProblem. The operator supplied the R1-landed relay. Verified
09b24dba55 on origin/main and merged main once as 3dd9e7d6f5. Model-routing
conflicts resolve to main's seeds, schema and service; protected model literals,
workstation manifest and generated blocks were not rewritten. Main already
extracts the absent-model problem, so the model service exactly matches main.
The branch's Muse test assertion now uses main's muse.opt-in role spelling.

At 83658c6ab5, recovery separates systemd observation, empty-terminal predicates,
invocation compatibility and evidence-to-result construction. A schema-tagged
absent/terminal evidence model preserves the difference between missing units
and decoded observations. The locked read still observes the unit, checks the
recorded identity, and finalizes in the same order. Unknown or live evidence
refuses recovery; no success or failure evidence is invented. Existing guards
and idempotent publication remain covered by the full 104 proof-job regressions.

All 121 proof-job/model-check tests pass. Package quick lint/type checks pass.
After the merge, the checkout needed the new tsc-rs dependency and fresh ai-sync /
technical-drawing declarations; frozen install and a bounded ten-task dependency
build repaired these artifacts without source changes. The new main's nonblocking
hook warnings in baseline files and Skills DiffLines docs are inherited.

A clean-head Fallow audit against origin/main passed with zero findings. Raw
local audit/build outputs remain private; the [sanitized receipt](../research/2026-10-14-fallow-closeout.json)
records the check. No suppression, inventory exemption or relaxed threshold was
added.

## Worker synchronization and proof

Backed up all eight machine-specific configuration files before source
fast-forward. Applied their saved edits by three-way merge against the incoming
source: seven remained byte-identical, AGENTS.md retained the Graft patch on top
of main's policy. Backups and result manifest are private at
~/.cache/beep/readiness-main-merge-backup. No pending authentication was required.

A clean disposable worktree installed the frozen lockfile and submitted real
serial cheap gates with a fifteen-minute ceiling and unchanged proof/control
slice limits. The first run at 83658c6ab5 finished normally with failure / wait exit 1. All
Fallow gates passed, including audit with zero findings and health, but the
merged main's cache-policy gate detected turbo.json source drift from the
reviewed configuration. The width is consumed only by the top-level gate
orchestrator; Turbo tasks do not consume it. At bc1ff53d58 removed its unnecessary
Turbo pass-through declaration, restoring the reviewed config exactly. The
setting still travels through the proof service's BEEP_ forwarding. Local cache
policy reports zero blocking findings and 1,335 unassessed cached computations;
this does not certify all cache reuse. No baseline fingerprint or rule was
weakened to conceal the drift.

A fresh complete detached run at bc1ff53d5857f9b70edffc4bef3970d175f3caf6 passed
the entire cheap-gate tier. Job 7d824a2f-ef10-4748-a6fa-7884fa0e438d finished
successfully in 613,502 ms; normal systemd finalization preserved exit status 0,
published its result and job wait returned 0. The one-lane setting remained in
the detached environment. Observed service peak during the run was 7,352,356,864
bytes, below the unchanged 7 GiB soft / 8 GiB hard limits; that observation is
not a claim of the final maximum after unit collection. No pressure relief,
reset-failed, cancellation or manual job-record edit was needed.

The submission used --base HEAD on a clean disposable branch; the real gates
still checked the full repository, and Fallow audit compared against refreshed
origin/main. This qualifies worker execution and the complete cheap tier. It
is not a heavy/full Yeet proof, hosted CI, publication or reboot acceptance.
The final verification source is bc1ff53d58; later receipt-only commits retain
that provenance instead of pretending to have rerun every gate on their new
hashes.

The first and final runs are archived separately under ~/.cache/beep/fallow-proof
as first-evidence.tgz and final-evidence.tgz. Each archive was compared against
its original .beep and Turbo summaries before cleanup. Direct local audit,
install and dependency-build logs remain private. Removed only the owned clean
proof worktree and branch after verifying no process holders. Host available
memory returned to about 10 GiB. Configuration backups and preserved edits
remain in place; no push, PR or external message was sent.
