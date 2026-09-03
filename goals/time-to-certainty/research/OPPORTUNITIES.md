# time-to-certainty — friction ledger

Record friction at the moment it happens (what you were doing, evidence, what would have
prevented it). Public repo: redact secrets, replace absolute home paths with `~`, drop
session/machine ids, quote only the minimal identifying error text.

## 2026-09-03 — The tsgo task handoff named the policy lint as the synthetic-config executor

- **Doing:** designing the C3 tsgo-tests Turbo seam from the named implementation and routing files.
- **Evidence:** the handoff named `commands/Lint/PackageTestTypecheck.ts`, but the scanner that writes
  synthetic tsconfigs and aggregates tsgo results lives in `commands/Quality/Quality.command.ts`;
  `package-test-typecheck` is the separate blind-spot baseline lint.
- **Would have prevented it:** name both surfaces explicitly in the lane brief: the
  `quality test-tsgo` execution command and the `package-test-typecheck` policy/hash-task identity.

## 2026-09-03 — Turbo omits configured tasks that have no package script from run summaries

- **Doing:** proving that a centrally declared per-package task could supply the ledger's required
  `.turbo/runs/<run-id>.json` `tasks[].hash` without editing every test-owning package manifest.
- **Evidence:** `turbo run transit --filter=@beep/types --dry=json` reported a hash for the configured
  task, while the same real run with `--summarize` wrote an empty `tasks` array and warned that no
  package had a matching task.
- **Would have prevented it:** state in the C3 ruling that run-summary hashes require a matching
  package script, and decide whether the one-time workspace-manifest migration is part of the lane.

## 2026-09-03 — One shared Turbo task script amplified into 131 package releases

- **Doing:** validating the package-script migration required for real per-package run-summary
  hashes.
- **Evidence:** `beep quality changeset-status` classified the 138 test-owning manifest edits as
  five lab paths and 133 versioned product workspaces; after the two configured package ignores,
  131 release-tracked packages had to be named by an in-range changeset.
- **Would have prevented it:** seed the task script in package templates before the C3 migration,
  or explicitly budget the one-time multi-package release in the ruling and lane handoff.

## 2026-09-03 — Reaper rename claims disappeared from every recovery scan

- **Doing:** adversarially reviewing the admission reaper's atomic dead-ticket and dead-lease claim
  before extending B6 death journaling.
- **Evidence:** the reaper renamed `*.json` state to a `.reap-claim-*` suffix, while the only later
  directory scan filtered exclusively for names ending in `.json`; a crash after rename therefore
  hid the sole lifecycle authority before either required journal sink was acknowledged.
- **Would have prevented it:** define claims as schema-decoded, nonce-keyed outbox records in a
  dedicated scanned directory; persist each sink acknowledgement; and delete a claim only after all
  required terminal outputs are durably complete.

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

## 2026-09-03 — Two inherited hosted reds blocked every open PR for an afternoon

- **Doing:** driving the A5b (#978) and html-coverage (#983) PRs to merge-ready.
- **Evidence:** both PRs failed JSDoc Ratchet with `no-root-package-import: 3771 > 3770 (+1)`; the
  extra violation was a doctest import of the `@beep/schema` package root in
  `packages/foundation/modeling/md/src/Md.safe.ts`, merged on main in #949, so the ratchet was red
  on main itself and on every merge ref. The fix PR (#985) then failed Heavy / Docgen on
  `@beep/md` for two bare re-export statements that predate it; running `beep docgen check` by
  hand showed the same latent failure in eight more packages (bare `export { VERSION }` lines from
  #971 and older export lists), each waiting for the next PR that touches its package.
- **Would have prevented it:** the ratchet and the docgen check are both cheap and precise, but
  they run only on hosted merge refs and only for packages in the changed scope, so a defect
  merged in one PR surfaces as an unrelated red on the next; the packet's B3 (cheap precise gates
  first, on every merge to main) and A4's reason-carrying ack ledger make the inheritance visible
  at the moment it lands rather than one PR later.

## 2026-09-03 — Escaped commit-message newlines reached commitlint literally

- **Doing:** committing the C3 review fixes with the required wrapped body and co-author trailer.
- **Evidence:** commitlint rejected first a body containing literal `\\n` text and then two
  unwrapped paragraphs as lines longer than 100 characters.
- **Would have prevented it:** pass each short wrapped line as a separate `git commit -m` argument
  instead of encoding newlines or relying on the commit tool to wrap paragraphs.

## 2026-09-03 — Noninteractive shells omitted the systemd user-bus environment

- **Doing:** launching the required exact-head package and coverage proofs in detached systemd
  user scopes.
- **Evidence:** every launch stopped before creating a scope with `XDG_RUNTIME_DIR not defined` even
  though the current user's runtime directory and bus socket were present.
- **Would have prevented it:** make the proof launcher derive and export the current user's runtime
  directory and bus address before calling `systemd-run --user`.

## 2026-09-03 — Path validation did not fence journal lock reclamation

- **Doing:** closing A5c review on exclusive, generation-fenced admission-journal lock recovery.
- **Evidence:** PR #993 review thread `PRRT_kwDOPbO_N86fFah3` showed that a reclaimer validated the
  lock path and only later renamed it; a replacement generation published between those operations
  could be moved to a tombstone and deleted.
- **Would have prevented it:** take the lock path into a reclaimer-owned tombstone before inspecting
  its generation, restore a displaced generation with a no-clobber hard link, and require every
  journal publisher to revalidate its acquired lock generation at the publication boundary.

## 2026-09-03 — Per-file coverage attributed an indirect callee change to an untouched command

- **Doing:** restoring the A5c hosted coverage ratchet after the scheduler recovery suite was green.
- **Evidence:** PR #993 changed admission reap, promotion, and reconciliation behavior, but the
  per-file ratchet reported `Quality.command.ts` below its committed floor even though that file had
  no diff; scheduler tests no longer reached enough of the command adapters that call those paths.
- **Would have prevented it:** extend A4's environment-only and attribution taxonomy with an
  `indirect` kind that records an untouched caller whose coverage changed because its callee or
  driving fixture changed, so the ratchet identifies the causal PR without presenting the caller
  as a direct source regression.
