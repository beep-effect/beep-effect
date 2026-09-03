# time-to-certainty — friction ledger

Record friction at the moment it happens (what you were doing, evidence, what would have
prevented it). Public repo: redact secrets, replace absolute home paths with `~`, drop
session/machine ids, quote only the minimal identifying error text.

## 2026-09-03 — A chained review fix committed and pushed past a red test

- **Doing:** closing a Greptile thread on the economics script by patching a validation branch,
  running the script's unit tests and default replay, then committing and pushing in one shell
  chain.
- **Evidence:** the chain ran the tests and the replay for their output only; neither result gated
  the commit, so a commit with one erroring test and a replay that had exited non-zero was pushed
  to the public PR branch. A follow-up commit fixed the test; the replay had failed only because
  the worktree was dirty from the previous regeneration.
- **Would have prevented it:** gate every chained commit on the test and replay exit codes
  (`&&` chains, never sequential lines), and regenerate outputs from a clean tree before the
  validation that compares the worktree with HEAD.

## 2026-09-03 — Economics replay depended on private capture state

- **Doing:** reviewing the measurement lane's clean-clone reproducibility before ratification.
- **Evidence:** `research/scripts/economics.py` required two untracked JSON captures and selected
  its frozen corpus through a fixed sibling-checkout path, so a clean clone stopped before
  producing the published economics.
- **Would have prevented it:** require committed, redacted, size-bounded reproduction fixtures; a
  repository-relative corpus default with an explicit fallback; and a clean-clone replay gate for
  every measurement artifact.

## 2026-09-03 — A Monitor watchdog matched its own command line and never exited

- **Doing:** closing out the ship-velocity successor PR after its Codex lane had finished.
- **Evidence:** the watchdog's exit test was a process-name search for the Codex command string;
  the search also matched the watchdog's own shell, so the task stayed listed as running after the
  process it watched was gone. A sibling `pkill` with the same pattern had earlier killed the
  calling shell.
- **Would have prevented it:** anchor process searches to the program name or watch a pid captured
  at launch; never search for a substring that appears in the searcher's own command line.

## 2026-09-03 — Three agent-launched processes died with no journal entry anywhere

- **Doing:** running the ship-velocity closeout lanes as detached Codex processes and a detached
  Yeet publish.
- **Evidence:** two Codex sessions and one `nohup` publish ended mid tool-call; the scheduler
  journal, the user journal, the OOM killer's log, and the Codex rollout recorded nothing. The only
  long process that survived ran in its own systemd user scope with its own session and its prompt
  on stdin.
- **Would have prevented it:** a detached job surface that puts every agent-submitted proof in its
  own scope with a durable id and journals its termination (SPEC B5/B6).
