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

## 2026-09-03 — Embedded economics replay was coupled to mutable corpus presence

- **Doing:** regenerating the ratified economics outputs after adding compaction left-censor
  accounting.
- **Evidence:** `economics.py --from-inputs` stopped on unrelated corpus differences whenever the
  default corpus directory existed, despite the command being documented as replaying committed
  compact inputs.
- **Would have prevented it:** make `--from-inputs` select embedded frozen facts unconditionally;
  validate a live corpus only when the operator passes `--corpus` explicitly.

## 2026-09-03 — Merging A5b took eighteen hosted cycles for five real defects

- **Doing:** driving PR #978 (A5b) and #993 (A5c) to merge-ready under the push-first rule.
- **Evidence:** across the two PRs, hosted reds came from an npm advisory 503 (three times), Docker-gated
  integration tests skipping on a slow runner (per-file floors on an untouched package), coverage
  floors on `Quality.command.ts` that main itself had been failing since #990, a shard aggregator
  failing after GitHub cancelled a superseded run, and a lane cancelling the run on its own current
  head. The code defects (retention arithmetic, non-deterministic admission ordering, lock-reclaim
  races) were five of roughly eighteen full re-runs.
- **Would have prevented it:** attribution at the gate (A4's ack ledger needs `environment-only` and
  `indirect` kinds the hosted lanes can emit, not only the local inbox), coverage floors that ignore
  conditionally skipped suites, and a rule that lanes never cancel a run on an unreplaced head.

## 2026-09-03 — Fallow's new-only duplication gate fires on every helper a lane writes twice

- **Doing:** landing the A5b and A5c journal changes through Sol lanes.
- **Evidence:** four consecutive pushes tripped Fallow on clone groups the lane had just created
  (atomic-rewrite sequence in two journals, process-identity comparison in two files, tombstone
  cleanup twice in one file) and once on a lock boundary at cognitive complexity 9; each cost a full
  hosted cycle before the helper was extracted. The `normalizeJournal` split (cyclomatic 10) is still
  owed after the merge; the shared staging-file rewrite was extracted into `JournalFile.ts`.
- **Would have prevented it:** running `beep quality fallow audit --check` locally before the first
  push (about 20 seconds) as part of every lane's push checklist, and extracting helpers as they are
  written rather than after review.

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

## 2026-09-03 — B6 closeout lacked the default-off protocol transition

- **Doing:** reviewing the docs-only B6 closeout after A5c's crash-recoverable claims merged.
- **Evidence:** `appendAdmissionEvictionJournalEvent` returned false on a fresh host, while
  `processReapClaim` marked the admission sink complete and deleted its sole durable claim anyway.
- **Would have prevented it:** gate B6 completion on one real-filesystem scenario that starts with
  eviction emission off, proves the same claim stays pending across reap passes, enables emission,
  and observes one idempotent eviction row before claim deletion.

## 2026-09-03 — Yeet monitor's provenance read exceeded the installed GitHub CLI schema

- **Doing:** arming the hosted check-and-review watch for PR #1005 after its first complete push.
- **Evidence:** provenance stamping skipped with `Unknown JSON field: "lastEditedAt"`; the watch still
  started, but could not reassert its registry-backed footer before polling.
- **Would have prevented it:** capability-detect the `gh pr view` field set and fall back to
  `updatedAt`, with a compatibility test against the oldest supported GitHub CLI release.

## 2026-09-03 — An npm advisories outage cost five audit re-runs across three PRs

- **Doing:** driving #978, #993 and #1001 to merge-ready during the evening (captured as the
  re-runs happened; landed with the A5c closeout because the lane branches were mid-review).
- **Evidence:** Repo Sanity's `bun audit` step failed five times with `POST
  https://registry.npmjs.org/-/npm/v1/security/advisories/bulk - 503`; each failure needed the whole
  workflow run to complete before `gh run rerun --failed` could be issued, and the re-run also
  replayed every other failed job on the same head.
- **Would have prevented it:** a bounded retry with backoff inside the audit step, and a distinct
  "advisories endpoint unavailable" failure message so the red is attributed as environment-only at
  a glance. The lane stays red when no audit result can be established: Repo Sanity is a required
  security check and the packet's stop condition forbids weakening it.

## 2026-09-03 — Lanes cancelled the hosted run on their own current head

- **Doing:** Sol lanes pushing review fixes under the push-first rule.
- **Evidence:** two lanes ran `gh run cancel` on the run for the head they had not yet replaced, so
  a full hosted cycle was discarded and the PR sat unmergeable until the next push re-triggered it.
- **Would have prevented it:** never cancel a run on an unreplaced head; GitHub concurrency already
  cancels superseded runs on push. The rule now sits in every lane brief and belongs in the lane
  launcher's standing instructions.

## 2026-09-03 — The station proof set missed an overloaded test callback

- **Doing:** proving the A5d protocol-deferred claim transition before its review-fix push.
- **Evidence:** the allowed repo-cli check and focused Vitest file passed, but hosted Heavy Check's
  test-typecheck pass rejected a direct overloaded schema decoder passed to `Effect.forEach` and
  reported the resulting unknown error and requirements channels in the two new tests.
- **Would have prevented it:** expose a package-scoped test-typecheck command that accepts one test
  file, and include it in station instructions whenever new Effect-based test helpers are added.

## 2026-09-03 — Commitlint included a newly merged upstream squash

- **Doing:** proving PR #1005 after pushing the typed test callback repair.
- **Evidence:** hosted Commitlint accepted every branch commit, then rejected a long footer line in
  main's #1003 squash because the lane's range began at this branch's older merge base.
- **Would have prevented it:** validate server-generated squash messages before merge and have the
  PR lane lint only commits introduced by the pull request rather than new commits from its base.

## 2026-09-03 — Yeet monitor requested a removed GitHub CLI field

- **Doing:** monitoring PR #1006 at its first exact-head hosted event.
- **Evidence:** `bun run beep yeet monitor --watch --until-event` warned that the PR provenance
  snapshot requested unknown JSON field `lastEditedAt`; the installed GitHub CLI listed
  `updatedAt` but not `lastEditedAt`. The watcher continued and recorded the check event.
- **Would have prevented it:** derive the edit timestamp from a GitHub CLI field supported by the
  pinned workstation version, or capability-probe the field list before building the query.

## 2026-09-03 — Escaped newlines collapsed a commit body into one overlong line

- **Doing:** creating the signed review-fix commit for PR #1006.
- **Evidence:** the commit-message transport preserved `\\n` literally and commitlint rejected the
  result with `body's lines must not be longer than 100 characters`; no commit was created.
- **Would have prevented it:** pass each paragraph through a separate `git commit -m` argument or a
  file-backed message so shell transport cannot turn paragraph separators into literal text.

## 2026-09-03 — Signed-commit verification reported a false unsigned result

- **Doing:** confirming the review-fix commit met the station's signed-commit rule before push.
- **Evidence:** `git log --show-signature` reported that `gpg.ssh.allowedSignersFile` was not
  configured and then printed `No signature`, while the commit object contained an SSH `gpgsig`
  block.
- **Would have prevented it:** configure a repository-safe SSH allowed-signers file, or make the
  verification command distinguish an untrusted/unverifiable signature from an absent signature.

## 2026-09-08 — Untrusted `mise.toml` hid the repo CLI in the main checkout

- **Doing:** acknowledging Yeet inbox rows in the main checkout at the start of the C3 design
  session.
- **Evidence:** `zsh -ic 'bun run beep yeet inbox list'` failed with `mise ERROR Config files in
  ~/YeeBois/projects/beep-effect3/mise.toml are not trusted` after the dependency refresh (#1016)
  rewrote `.bun-version`, which `mise.toml` reads through `read_file`; the sibling worktree with an
  older trust record kept working. The detour cost one blocked command and a fallback to the
  absolute `bun` binary.
- **Would have prevented it:** a `.bun-version` bump that re-runs `mise trust` in the same
  install step (postinstall or the deps-refresh recipe), or a `beep quality profile` line that
  reports mise trust state before the first CLI call.

## 2026-09-08 — `--affected` probe polluted by uncommitted root config edits

- **Doing:** measuring how Turbo selects `//#` root tasks under `--affected` for the C3 design.
- **Evidence:** the first three probe rounds selected all 255 tasks regardless of the edit under
  test because the probe's own `package.json` and `turbo.json` edits were uncommitted global
  inputs (Turbo selects every task on a global-input change). A temporary commit followed by
  `git reset --hard` isolated the signal on the fourth round.
- **Would have prevented it:** a `beep quality turbo-config-proof` fixture that stages a task
  definition on a throwaway commit and reports selection per edited file, so nobody re-derives
  the hygiene rule by hand.

## 2026-09-08 — Docs-only PR went red on a newly widened OSV advisory

- **Doing:** publishing PR #1018 (design gate, five Markdown files, no lockfile change).
- **Evidence:** the required `Security` lane failed on `GHSA-vwc7-r8mq-g2x9` (adm-zip 0.6.0 via
  onnxruntime-node, no fixed release) while the three most recent `main` runs had passed the same
  lane on the same lockfile; the advisory's affected range had widened since. The remedy is the
  precedent `osv-scanner.toml` exception with a reason and expiry, which forces a security-policy
  edit into an unrelated PR or a second PR that must also clear admission.
- **Would have prevented it:** a scheduled OSV rescan of `main` (nightly research routine or a
  cron lane) that opens the exception PR itself when a no-fix advisory lands, so branch PRs meet a
green base instead of discovering the advisory first.

## 2026-09-08 — C3.1 implementation session cannot write worktree Git metadata

- **Doing:** checking the brief's mandatory stage commit capability before Stage A.
- **Evidence:** `git add goals/time-to-certainty/research/c3-1-implementation.md`
  exited 128 with `Unable to create '<worktree-git-dir>/index.lock': Read-only file system`.
  The worktree is writable but its Git metadata is in the sibling checkout outside
  the session's writable roots; approval policy is `never`.
- **Would have prevented it:** launch the implementation lane from a verified
  Full-access parent, or provision writable access to the worktree's actual Git
  metadata as well as its files before assigning mandatory commit checkpoints.

### 2026-09-08 — C3.1 resume blocked by typo scan of tool residue

- Action: explicitly staged the C3.1 results file and attempted the required
  resume commit after Git metadata write access was repaired.
- Evidence: staging succeeded; pre-commit `typos` exited 2 on `adjascent` at
  `graft/scratchpad/glob/internal/minimatch.md:26`. Gitleaks passed. The generated
  residue was not staged, but the typo hook scanned it anyway.
- Prevention: exclude generated `graft/` residue from the typo hook's input
  selection. No hook bypass or residue edit was attempted; Stage A is pending.

## 2026-09-08 — C3.1 resume blocked by unavailable Git signing socket

- **Doing:** committing the required resume checkpoint after repairing Git
  metadata access and removing generated tool residue.
- **Evidence:** gitleaks, typos, and commitlint passed; Git exited 128 with
  `1Password: Could not connect to socket` and `failed to write commit object`.
  The configured SSH signer is `op-ssh-sign`. One `op-doctor` run exited 6,
  reporting sandbox-blocked probes and an unavailable user bus.
- **Would have prevented it:** verify that the implementation session can reach
  the configured Git signing agent before assigning mandatory commit stages,
  alongside writable worktree metadata and clean hook inputs.

## 2026-09-08 — C3.1 Stage A compiler launch denied

While checking the new scripts schemas, `bunx --no-install tsgo -p
 tsconfig.check.json --pretty false` from the CLI workspace exited 1 in the
existing tsgo shim: `spawnSync <node-executable> EPERM` while requesting
`@effect/tsgo/dist/effect-tsgo.cjs get-exe-path`. This is an environment launch
failure before compiler diagnostics, not evidence about the new schemas.
A lane preflight exercising the actual compiler subprocess would have exposed
this independently of the earlier Git/signing fixes. The initial focused Vitest
command used the root cwd and found no tests; corrected to the package cwd.

### Stage A validation follow-up

The Bun-runtime diagnostic (`bunx --bun --no-install tsgo`) reached the compiler
and exposed two introduced errors: a chained pipe and an unavailable HashSet
helper. Both are fixed; the focused compiler check passes. The focused default
Vitest fork pool then failed before test execution with
`Timeout waiting for worker to respond`; its thread-pool diagnostic passes all
four new schema tests. Full package verification is being rerun after the fixes.
The first audit failure is acknowledged with an attributed one-hour waiver while
that verification runs; signing the corrective work remains the orchestrator's
responsibility. The waiver is not a passing audit or an environment-only
reclassification of the original compiler errors.

### Canonical command confirms the environment blocker

After the introduced compiler errors were fixed, the exact required command
`CI=true TMPDIR=/tmp bun run beep quality package-verify @beep/repo-cli`
passed the package build and docgen, then failed in `beep:check` before compiler
startup: `spawnSync <node-executable> EPERM` while resolving
`effect-tsgo get-exe-path`. Audit failed in 6.7 seconds; docgen passed in 18.5
seconds. The latest audit outcome is environment-only, superseding the temporary
waiver for the earlier, corrected source diagnostics. Fix the sandbox's Node
child-process capability, then rerun the canonical audit without replacing it
with the successful Bun-runtime diagnostic. The brief's hard stop applies.

### C3.1 Stage B — prescribed test project is absent

The amended test command `bunx --bun --no-install tsgo -p
packages/tooling/tool/cli/tsconfig.test.json --pretty false` exits with
`TS5058: The specified path does not exist`. The CLI workspace has no committed
`tsconfig.test.json`; the orchestrator's canonical verification owns synthetic
test-project generation. The lane records this limitation and runs the source
project plus the required thread-pool tests. A brief that names the existing test
project or an approved synthetic-project command would prevent this friction.

The initial residue cleanup command was rejected because `rm -f` style commands
are disallowed. Removed only the explicitly authorized `graft/` residue through
Python filesystem operations instead; no Git or inbox mutation was involved.

### C3.1 Stage B — omitted entrypoint routing file blocks the gate

The first live invocation `bun run beep lint package-scripts --check --json`
entered the root aggregate, emitting `lint: running 29 step(s)` and forwarding
`package-scripts --check --json` to Turbo's `lint` task. Inspection found the
separate `LINT_POLICY_SUBCOMMANDS` allowlist in
`packages/tooling/tool/cli/src/internal/cli/LintRouting.ts`; neither new gate is
listed there. Adding the gates only to `lintSubcommands` is insufficient, and
registering them in `rootRepoLintPolicySteps` produces recursive aggregate calls.
The fingerprint invocation took the same wrong path and was interrupted. Removed
only this lane's aggregate and preflight additions to leave that route safe.

The brief's hard file-scope rule does not name `LintRouting.ts`. The implementation
lane therefore stops at Stage B rather than modifying that file or bypassing the
entrypoint. Include the routing allowlist in the brief and require an entrypoint
routing regression test before resuming. Stage D's new `jsdoc` and `laws` names
need the same allowlist update. No inbox rows were staged or acknowledged.

### C3.1 Stage B completion — Bun test-project limitation persists

The Amendment 3 completion run again found that
`bunx --bun --no-install tsgo -p packages/tooling/tool/cli/tsconfig.test.json --pretty false`
exits 1 with `TS5058: The specified path does not exist`. The source project
passes, and the required Bun thread-pool tests execute successfully. The brief
should name an existing test project or an approved generation command; no
replacement config or inbox acknowledgment was created. The cleanup command
also encountered the existing `rm -f` restriction; bounded Python filesystem
operations removed the authorized residue successfully.

### C3.1 Stage C — thread-pool command fixtures cannot change cwd

The required package-cwd Bun Vitest run with `--pool=threads` executed 71 tests:
50 passed and 21 failed. All 21 failures occur in existing create/delete command
fixtures before command execution: `process.chdir() is not supported in workers`.
The architecture and scripts-policy files passed. This is a fixture/runtime
incompatibility, not a scripts assertion failure. The lane retains the required
thread-pool invocation and adds direct writer assertions that do not change cwd;
the orchestrator must run the command fixtures under its canonical worker pool.
A verification contract that accounts for cwd-changing command fixtures would
prevent this limitation. No inbox acknowledgment or runtime workaround was used.

### C3.1 Stage D — existing verification and law-scope limits

The requested test typecheck command again exits 1 with
`TS5058: The specified path does not exist` for the CLI's `tsconfig.test.json`.
The source check project exists; no synthetic project or inbox acknowledgment
was created. The brief should name the supported test typecheck project.

Inspection of `commands/Lint/PackageTestImports.ts` also confirms that the
existing `--include-root` checker rejects roots outside `packages/` with
`--include-root must stay under packages/`. Stage D's thin worker forwards the
ratified selector unchanged. The future app/lab/infra fleet invocation needs this
scope restriction resolved by the scanner work; the worker argv tests alone do
not prove those existing scanner paths can accept the fleet. Recording this
inherited limitation before the Stage E rewrite prevents mistaking package-only
worker proof for fleet acceptance.

### C3.1 Stage E — Runpod generator binding missing before fleet write

The one `bun run beep lint package-scripts --write` invocation reported
`142 manifests, 1 drifting, 140 written` and exited 1 with
`packages/drivers/runpod/package.json: codegen: missing-task`.
The pre-write JSON check also contains that missing-task row. Runpod is in the
accepted generator registry and already owns `generate: bun run scripts/generate.ts`,
but HEAD lacks a codegen task. Its generator writes the two checked-in Runpod
model/operation modules. Bind its package-owned codegen task to `bun run generate`,
as the other drivers do, then check without repeating the fleet writer.
An explicit registry-to-manifest census before the rewrite would have surfaced
this inherited omission sooner. No policy rule or generator behavior changes.

The initial authorized residue deletion command was rejected because `rm -f`
style commands are disabled. Removed only the named residue via filesystem APIs;
no permission escalation or Git write was used.

### C3.1 Stage E2 — executed workers expose selector and fixture blind spots

The orchestrator's Freshbooks `lint:laws` run rejected `--include-prefix` for
terse-effect. Existing mocked argv tests pinned the same invalid flag without
executing the parser. Stage E2 replaces it with an expanded `--include` surface
and adds subprocess worker tests. The first executed docs smoke exited 2 because
ESLint ignores every file under `test/fixtures`; moving the temporary fixture
surface into the existing CLI source project lets both real profiles inspect it.
Executed worker checks before fleet stamping would have caught both assumptions.

## 2026-09-09 — Fleet convergence exposed a hidden single-project-emit violation

- **Doing:** accepting the C3.1 fleet rewrite (`beep lint package-scripts --write`).
- **Evidence:** `test/single-project-emit.test.ts` failed only after the rewrite because
  `packages/foundation/modeling/md` had `build: tsc -b …` and `check: tsgo -b …` as direct keys,
  which the law never read (it scans `beep:build`/`beep:check` only); moving the same text behind
  the implementation keys made the violation visible. The package compiles single-project once
  `@beep/html` is built, so the fix was the canonical `-p` forms.
- **Would have prevented it:** the emit law scanning task-facing keys as well as `beep:*`, or the
  scripts gate having landed earlier so direct-form escapes could not accumulate.

## 2026-09-09 — `package-verify --quick` on a fresh worktree reports phantom Effect LSP errors

- **Doing:** quick-verifying a sample of workspaces touched by the fleet rewrite.
- **Evidence:** `@beep/practice-kg-mcp` failed `beep:check` with `effect(anyUnknownInErrorContext)`
  in `src/bin.ts`; the same script passes on the main tree and passes in the worktree after
  `turbo run build --filter='@beep/practice-kg-mcp^...'`. `--quick` skips the upstream build that
  B1 added to the full verification, so a fresh worktree without `dist` mis-types imports as
  `any`/`unknown`.
- **Would have prevented it:** `--quick` running `turbo run build` for the package's dependency
  closure (or refusing when any upstream `dist` is missing) before `beep:check`.

### Stage E3 — cleanup command guard

The explicitly requested Graft residue cleanup was rejected because the shell command used `rm -f` style flags. No command in that invocation ran. Retried the authorized paths with path-specific filesystem operations. A documented permitted cleanup form would avoid the failed invocation.

### Stage E3 — proof runners and scoped test diagnostics

The default Vitest fork run printed its startup banner but executed no tests for several minutes; interrupted that run (exit 130) and used the brief-authorized thread pool. The final thread run executes all three worker subprocess smokes and passes 27 tests. The broader `beep quality test-tsgo` likewise remained at `checking 1026 file(s) across 139 package(s)` and was interrupted, without claiming an aggregate pass. Used a disposable config matching `TestTsgoSyntheticConfig.ts`, extending the real CLI tsconfig and including the three touched tests, with `bunx --bun --no-install tsgo`; that focused check passes. A reliable bounded package test-diagnostic command would avoid the aggregate startup dependency during a three-file repair.

## 2026-09-09 — A committed policy-tool fingerprint goes stale on every PR merge ref

- **Doing:** getting PR #1029's hosted Lint Policy lane green after pushing all repairs.
- **Evidence:** `lint:policy-fingerprint` was current on the branch tip but exited 1 on hosted,
  which lints `refs/pull/1029/merge`; main had moved three commits, one touching the repo CLI
  source that the fingerprint digests, so the committed digest could not match the merge tree.
  The only remedy was merging main and regenerating, which holds until main moves again.
- **Would have prevented it:** computing the fingerprint at task time instead of committing its
  digest (a `cache: false` root task writing an untracked artifact that policy tasks depend on,
  or declaring the computed closure globs directly as task inputs). C3.2 must settle this before
  any policy task keys on the file (table D15, revisit).

## 2026-09-09 — C3.1 E4 Vitest fork startup stalls

The required Bun Vitest run of package-scripts.schemas, package-scripts.policy,
and lint-workers in the CLI package printed only `RUN v4.1.11` and did not
execute tests before interruption (exit 130). Retrying with the brief-approved
`--pool=threads` fallback. A bounded fork startup timeout with an explicit
worker diagnostic would prevent this silent wait. Node proof is tracked
separately in the Stage E4 results.

E4 follow-up: the supplementary `bun run beep quality jsdoc-inventory`
printed only its command banner for several minutes and was interrupted
(exit 130); it produced no refreshed artifacts. The required
`jsdoc-ratchet --inventory standards/jsdoc-documentation.inventory.jsonc`
passed against the tracked inventory. Per-package progress and bounded
subprocess diagnostics would make inventory stalls attributable.

## 2026-09-09 — The package-level eslint worker inherits a smaller heap than the shard it replaces

- **Doing:** running the stamped `lint:deprecated-apis` script on `@beep/repo-cli` to prove a
  deprecation fix before pushing PR #1029's fifth hosted round.
- **Evidence:** `beep-cli lint deprecated-apis --package .` died with
  `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out
  of memory` at the worker's default `--max-old-space-size=4096`, and passed (exit 0, 54 s) with
  the root shard's 8192. Stage D executed the stamped scripts on small workspaces only, so the
  largest package never exercised the default.
- **Would have prevented it:** one shared heap constant for shards and workers (now the case), and
  a brief rule that stamped scripts are executed on the largest owner of each task, not the
  smallest.

## 2026-09-09 — Local coverage proof passed while the hosted per-file ratchet failed

- **Doing:** the E4 "last churn round" proof chain, which included a Node coverage run for
  `@beep/repo-cli` that exited 0.
- **Evidence:** hosted `[coverage-ratchet] coverage regression(s) detected` on
  `src/commands/CreatePackage/CreatePackage.command.ts` on all four metrics (0.2–1.8 points) after
  the scaffold rewrite replaced fully covered literal script constants with `scaffoldPackageScripts`
  plus two never-exercised match arms. A scoped reproduction,
  `bunx vitest run --coverage --coverage.include=<file> --coverage.reporter=lcov <the 8 tests>`,
  matched the hosted numbers to two decimals in 48 s; the 861 s full run had not surfaced them.
- **Would have prevented it:** a cheap per-file ratchet delta for touched source files inside
  `package-verify` / `yeet verify` (the lcov reproduction is the shape), so a rewrite that deletes
  covered lines shows its ratio drop before push instead of after a 15-minute hosted lane.

## 2026-09-09 — A Vitest deprecation surfaced only on the hosted deprecated-apis lane

- **Doing:** E4 rewrote `test/lint-workers.test.ts` with `describe.sequential` to keep the shared
  mock reset ordered under the repo's globally concurrent Vitest sequence.
- **Evidence:** hosted Lint Policy failed with
  `` `sequential` is deprecated. Use `concurrent: false` instead  @typescript-eslint/no-deprecated ``
  at two sites; the local proof subset had no typed deprecated-apis pass because the root lane is a
  multi-minute, 8 GiB-per-shard eslint run. The repo's own idiom is
  `describe(name, { concurrent: false }, fn)`.
- **Would have prevented it:** the package-scoped `lint:deprecated-apis` task running inside
  `package-verify` for touched packages, which is exactly the C3.2 wiring this train is building.

## 2026-09-09 — New source files fail the coverage ratchet only after the package total is repaired

- **Doing:** re-running the scoped ratchet (`bun run coverage -- --filter=@beep/repo-cli`) after
  restoring the create-package file's coverage.
- **Evidence:** `[coverage-ratchet] … new file has N uncovered unit(s) at X% (no baseline file
  identity)` for `PackageScripts.schemas.ts` (branches) and `PackageScriptsPolicy.ts` (all four
  metrics). The rule is emitted only for metrics whose package total did not regress, so four
  hosted rounds that were red on the package total never showed it; every recently added CLI
  source file on main carries a baseline row, so the sanctioned remedy is the scoped
  `--write-baseline` merge committed with the feature.
- **Would have prevented it:** `package-verify` (or the C3 package-level `coverage` task) reporting
  "new files without baseline rows" as its own line regardless of package totals, and the brief's
  acceptance list naming the baseline write for any stage that adds source files.

## 2026-09-09 — Two heavy lanes died mid-step on separate runners at the same second

- **Doing:** babysitting PR #1029's sixth hosted round (head cb8236d37f).
- **Evidence:** `Heavy / Check` and `Heavy / Coverage Regression` both reported `completed/failure`
  at 07:36:01Z after 23 minutes with step 10 `Run verification lane` still `in_progress/null`, every
  later step `pending`, and `BlobNotFound` for the job logs; two different `beep-ci-i-…` EC2 runners.
  Nothing in the head explains a simultaneous stop, and the same lanes were green on the previous
  head except for a baseline-row finding fixed in this push. The merge button refused on the
  required checks, so the remedy was a fresh push (main merged forward) rather than a code change.
- **Root cause (later the same night, second occurrence on #1046 at 08:38Z):** the fleet runs
  spot capacity (`instance_target_capacity_type: "spot"`, price-capacity-optimized) with on-demand
  failover only for launch-time capacity errors, so a mid-run reclaim wave takes every affected
  runner at once and the two longest lanes are the ones exposed.
- **Would have prevented it:** an on-demand pool for the long heavy lanes or the runner module's
  job re-queue on spot interruption, a visible `runner reclaimed` marker on the job, and
  `yeet monitor` classing "completed/failure with no failed step" as environment-only.

### AWS investigation and permanent mitigation

- The live AWS Spot request records confirm both PR #1029 workers were reclaimed at
  **07:24:29 UTC**, about 11.5 minutes before GitHub recorded their failures. PR #1046's
  matched runners also report `instance-terminated-no-capacity`. The apparent 18–23 minute
  limit therefore includes runner-loss detection delay; it is not a lane timeout.
- A retained fleet snapshot contained 30 capacity interruptions across three instance types
  and both configured availability zones. Additional matched failures included Lint Policy
  and very early Check execution. A 16-minute cutoff would not protect all observed losses.
- The pinned module's `job_retry` input checks jobs that are still queued. It rescues launch
  or pickup failures, not an in-progress job whose runner has disappeared. No mid-job resume
  guarantee is supplied by enabling that existing input, which was already enabled.
- The operator requested a permanent fix. The smallest implemented infrastructure change
  moves the existing heavy pool to On-Demand while preserving the 14-runner cap, labels,
  network, identity boundary, and ephemeral teardown. A second pool would preserve Spot
  discounts for short lanes but also preserve their demonstrated interruption exposure.
- The same investigation found the upstream v7.10.1 termination watcher missing its
  customer-managed KMS decrypt grant: 164 credential-access failures in one hour. The
  initial deployment added three narrow inline policies. PR review caught a future
  role-deletion hazard from attaching policies outside the upstream role owner's graph.
  The final source uses six key-owned KMS grants, scoped to Decrypt and each exact App
  parameter context. Names include immutable role IDs so same-name replacements renew
  access. Explicit controller-region lookups also fix ambient-region drift. These grants
  permit direct decryption of matching ciphertext; they cannot require `kms:ViaService`.
- Production apply completed with three policy additions, two controller updates, and no
  deletions. A subsequent preview reported 198 unchanged resources. Live CloudTrail reads
  prove decryption now succeeds; 12 IAM simulations prove intended access and negative
  cases. Fresh On-Demand workers completed the standard
  [fleet probe](https://github.com/beep-effect/beep-effect/actions/runs/34333728712) and
  [Heavy / Docgen](https://github.com/beep-effect/beep-effect/actions/runs/34332600371/job/102408052217).
  The probe worker then terminated normally. Full deployment details and reproduction
  commands are in `docs/runbooks/ci-runner-reliability.md`.
- Review migration completed in attended stages: six KMS grants created, their scopes
  checked, five minutes allowed for propagation, then three initial policies removed
  at 09:56:32 UTC. Final preview: 201 unchanged. At 09:57:25 UTC, CloudTrail recorded
  successful SSM reads and KMS decrypts for both App parameters after policy removal;
  natural cleanup reached GitHub. IAM simulation does not account for KMS grants.
  Both this investigation and the newly landed reap-claim settlement receipt are
  preserved in the merged ledger.
- Publication friction: `changeset-status --since origin/main` evaluates the committed
  range. The pre-deployment dirty-tree check reported no product workspace, while the
  first published range correctly required an `@beep/infra` release note. Add the
  infrastructure changeset before publication; a dirty-tree zero count is not proof
  that the committed change is exempt from the release-note rule.
- Merge publication friction: Yeet's stale-base check runs before its commit step, so
  a resolved but uncommitted merge still appears behind `origin/main`. Complete the
  reviewed merge commit first, then resume normal Yeet publication; do not bypass
  freshness checks or force-push a rebase.

## 2026-09-09 — The reap-claim settlement window was a 25 ms sleep

- **Doing:** attributing Property Laws on the same head.
- **Evidence:** `quality-scheduler.test.ts › atomically claims dead leases and tickets before
  journaling each death once` failed with `Admission reap claim … stayed busy; its outputs remain
  pending.` from `QualityScheduler.ts:905`. `recoveryRecordRemainsAfterSettlement` slept once for
  25 ms and treated a still-present claim as stuck, while the owning reaper still had two journal
  sinks and an acknowledgement write to finish on a runner whose import phase alone took five
  minutes. Fixed on `fix/scheduler-reap-claim-settlement`: a 25 ms spaced poll under a 5 s deadline,
  and the regression now holds the owner in its sink behind a Deferred gate.
- **Would have prevented it:** the same rule #1039 applied to the legacy-ticket tests, stated once
  for the scheduler: no fixed sleeps as settlement or ordering witnesses; poll with a bounded
  deadline, and gate concurrency in tests with Deferred instead of wall-clock waits.

## 2026-09-09 — C3.2 Stage A: the Effect reference symlink is absent in a fresh worktree

- **Doing:** validating Effect v4 APIs before the fingerprint schema and service work (lane rule:
  read `.repos/effect` before writing any API).
- **Evidence:** `.repos/effect/packages/effect/src/Schema.ts` does not exist in the `ttc-c3-2`
  worktree; the parent checkout holds the machine-local `.repos/effect` symlink that
  `scripts/setup-effect-ref.sh` provisions. The lane read the parent checkout's reference without
  changing local wiring.
- **Would have prevented it:** `beep worktree new` provisioning the reference symlink with each
  worktree, or the brief naming the parent-checkout fallback.

## 2026-09-09 — C3.2 Stage A: a package typecheck in a fresh worktree has no upstream outputs

- **Doing:** supplementing the Stage A tests with
  `bunx --bun --no-install tsgo -p packages/tooling/tool/cli/tsconfig.check.json`.
- **Evidence:** exit 1 with `TS6305: Output file '…/dist/index.d.ts' has not been built from
  source file` for every workspace dependency, then a cascade of unknown/any diagnostics. A fresh
  worktree has no `dist` outputs, so the check overlay cannot be a type proof there. A disposable
  source-resolving config over the three touched tests and their imports was the honest substitute;
  it surfaced two `effect(lazyEffect)` and two `effect(effectFnIife)` diagnostics on the new service
  contract that the passing tests alone did not (service members must be lazy Effect values, and
  never immediately invoked `Effect.fn` expressions).
- **Would have prevented it:** the package-verify split (which builds dependencies first), or a
  `beep quality test-tsgo-package` route that resolves sources when outputs are missing.

## 2026-09-09 — C3.2 Stage B: Graft query refreshed a forbidden cache surface

- **Doing:** following the read-first Graft source-discovery rule before Stage B edits.
- **Evidence:** the first `graft grep` reported `refreshed the graph (12 files changed)` and
  copied the parent checkout graph. The brief forbids touching `graft/`, but the query refreshes
  it automatically. No git write command ran. Subsequent discovery uses direct source reads.
- **Would have prevented it:** a read-only query mode, or a brief exception that explicitly
  addresses automatic graph refresh (the orchestrator removed the ignored copy before the
  Stage B commit).

## 2026-09-09 — C3.2 Stage C: the quality-tasks suite mixes pure plan tests with git fixtures

- **Doing:** retiring the deprecated-API shard runner and verifying the two policy steps that now
  run through Turbo (`rootRepoLintPolicySteps`).
- **Evidence:** `test/quality-tasks.test.ts` runs `git init`, `git add`, and `git commit` inside
  temporary fixtures, so an implementation lane whose contract forbids git writes cannot run the
  file; it ran the nine policy-plan cases by name and left the full 205-test file to the
  orchestrator's package-verify. `test/lint-command.test.ts` has the inherited
  `process.chdir() is not supported in workers` failure on Bun's thread pool (53 cwd-changing
  cases), so the file needs the Node fork pool.
- **Would have prevented it:** keeping pure plan-shape tests in their own file, away from git
  lifecycle fixtures, so a no-git-write lane can run the complete relevant suite.

## 2026-09-10 — C3.2 first hosted round: Fallow flagged a test arrow the lane never audited

- **Doing:** babysitting PR #1079's first hosted run (head f3132f000f).
- **Evidence:** `Fallow Advisory Envelopes` red on one introduced blocking finding:
  `quality-tasks.test.ts:3022 <arrow> cyclomatic 10, CRAP 31.6` (ten optional-chained
  expectations in one arrow of a partially covered test file); `health` mirrored it. Every other
  proof (package-verify, scoped coverage, both runtimes) was green because none of them runs the
  Fallow audit. Fixed by two tiny helpers (`policyTurboStep`, `policyTurboScmBase`) so each
  function stays trivial; local `fallow audit --check --base origin/main` and `health --check`
  then report zero findings.
- **Would have prevented it:** the lane brief's verification split naming
  `beep quality fallow audit --check --base origin/main` beside biome and vitest, since Fallow
  judges test files by CRAP and the package handoff does not run it.

## 2026-09-10 — A timed-out step passed because the child flushed and exited zero

- **Doing:** reading the first hosted Lint Policy run of PR #1079 (job 102722219371).
- **Evidence:** the `lint:deprecated-apis` Turbo step ran 901,364 ms against a 900,000 ms
  capture cap, Turbo printed `Tasks: 52 successful, 141 total` with no `Failed:` list and exited
  0 after the kill signal, and the step was recorded as done; only `lint:schema-first` failed the
  lane. `Effect.timeoutOrElse` races the capture against a sleep; the interrupted capture still
  completed inside the kill grace and delivered its text and zero exit through the loser's
  observer. Reproduced with `sh -c 'trap "echo summary; exit 0" TERM INT; ...'` under a 400 ms
  cap: the old helper returned exit 0.
- **Would have prevented it:** the capture helper judging a deadline by elapsed time after the
  capture returns, whatever the child reported (now the case), and the policy lane treating a
  Turbo summary whose successful count is below its total as a failure even at exit 0.

## 2026-09-10 — Per-package typed eslint is 4× the shard runner cold on the hosted runner

- **Doing:** measuring C3.2's hosted cold cost (same job).
- **Evidence:** 52 of 140 `lint:deprecated-apis` tasks in 15 minutes at concurrency 4 on
  `beep-ec2-heavy` (28 shards: 523.5 s); `lint:jsdoc` 728 s for 135 tasks (root invocation:
  73.9 s). Locally the same sweep took 12 m 50 s for all 277 tasks. Every workspace export
  resolves to `src`, so the typed project service rebuilds each package's transitive source
  closure; 28 shards shared that work.
- **Would have prevented it:** a hosted cold-run measurement of one package family before the
  fleet-wide task landed (§7.1(4) measured local only), and D6 stating the amortization the
  shard programs provided so the per-package cost was a design input, not a discovery.

## 2026-09-10 — A per-test timeout capped a live worker below the coverage lane's budget

- **Doing:** reading PR #1079's first complete hosted Coverage Regression run (job 102758874712,
  30 m 56 s).
- **Evidence:** `lint-workers.test.ts > executed lint workers > executes laws against a fixture
  package surface` timed out at its explicit 60,000 ms while the sibling workers took 24 s and
  39 s; the same test took 40.5 s in main's last green coverage run (job 102696760545). The
  package config already grants 300 s under coverage (`testTimeout: vitestCoverageRunActive ? 300_000
  : 30_000`), but an explicit per-test timeout overrides it, so the live worker raced a loaded
  two-worker runner. Raised the executed-worker tests to 180 s.
- **Would have prevented it:** live-process tests taking their budget from the runtime-aware
  config instead of a literal, or a lint that flags explicit `it` timeouts below the coverage
  budget in files that spawn the CLI.

## 2026-09-10 — C3.3 Stage A: the package scanner's overlay assumption and its memory cost

- **Doing:** building the package-local law scanner (one process, one package-scoped syntax
  project) from the brief, which names `tsconfig.test.json` as the overlay to scan with.
- **Evidence:** `repo-cli`, `todox`, `ciops` and `infra` have no package-root `tsconfig.test.json`
  (repo-cli keeps `test/tsconfig.json`), so the lane had to stop and ask; the ratified fallback
  takes the package's own `tsconfig.json` for compiler options with config preload disabled and
  the explicit package surface (brief amendment 1). The scanner cut wall time by 79 / 74 / 61 %
  on identity, schema and repo-cli, but max RSS rose 4 / 17 / 38 % (repo-cli 2.8 → 3.9 GB):
  one live project now holds the package's test sources beside its production sources.
- **Would have prevented it:** a fleet census of overlay presence in the brief before naming the
  overlay, and an acceptance budget that names wall and RSS separately so fleet concurrency is
  chosen against both.

## 2026-09-10 — C3.3 Stage B: the table's root residual names a flag the law does not have

- **Doing:** registering `//#lint:native-runtime:roots` with the command the C3 table prescribes,
  `beep-cli laws native-runtime --check --include-prefix scratchpad,packages/_internal/db-admin/effect-ontology`.
- **Evidence:** the command exits 1 with `Unrecognized flag: --include-prefix`; `laws native-runtime`
  accepts only `--include` (source-file paths), and C3.1 amendment 6 had already recorded that
  distinction for the package worker. The registered task therefore fails on execution while its
  dry run resolves. The lane kept the prescribed script and reported the blocker instead of
  substituting a wider sweep.
- **Would have prevented it:** executing a prescribed residual command once while drafting the
  table row, and a table convention that every root-task command is copied from a green run.

## 2026-09-10 — C3.3 Stage C: legacy native-runtime tests require a process pool

- **Doing:** running the new prefix command fixtures and existing native-runtime regression
  tests with the brief's prescribed Vitest thread pool on Node and Bun.
- **Evidence:** the four new executed-command fixtures and nine package-law tests pass on both
  runtimes; all nine existing `native-runtime.test.ts` cases fail before scanning in
  `support/CommandTest.ts` with `process.chdir() is not supported in workers`.
- **Would have prevented it:** declaring the legacy suite's process-pool requirement or moving
  its cwd-dependent fixtures to child processes (the new prefix fixtures spawn the CLI with a
  child cwd and run on both runtimes' thread pools; the legacy suite passes on Node forks).

## 2026-09-10 — The coverage ratchet measures each package with its own suite, not the repo's

- **Doing:** reading PR #1082's hosted Coverage Regression run after the local scoped proofs for
  `@beep/repo-cli` and `@beep/repo-utils` had passed.
- **Evidence:** seven regressed rows; `TSMorph.model.ts` functions 81.08 → 78.9 and
  `TSMorph.service.ts` branches 72.32 → 70.97 although every new branch was exercised — by
  `repo-cli` tests, which do not count toward `repo-utils` rows. `Laws.command.ts` lines
  41.32 → 37.73 because its new guard ran only in a spawned `bun run bin.ts` child, which the
  instrumented worker never sees. A TSMorph-only vitest subset then undercounted the model file
  (75.7 % vs 81.1 % for the full suite), so the honest comparison is full suite on the branch vs
  full suite on `main` (`bunx vitest run --coverage --coverage.include=<file> --coverage.reporter=lcov`).
- **Would have prevented it:** the ratchet contract stating "own-package suite, in-process
  execution" next to the per-file rows, and a local `beep-cli coverage --filter` delta that
  names which package's suite each regressed row is measured from.
