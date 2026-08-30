# Opportunities — friction receipts

## 2026-08-26 — Semantic delta rejects an uncommitted command addition without naming the dirty-tree cause

- **What happened:** full `bun run beep yeet verify` reached
  `knowledge semantic-delta` after the migration added two Goals subcommands.
  The lane failed with `Static command surface provenance does not match the
  current-checkout command tree.` A direct comparison of the statically
  derived working-tree command graph with the live graph found no difference.
  The mismatch was between the committed HEAD archive, which did not yet
  contain the new commands, and the dirty live checkout.
- **Evidence:** `bun run beep knowledge semantic-delta` reported the mismatch;
  the source-only `KnowledgeCommandSurface.buildStaticCommandTree` projection
  and the live `rootCommand` projection compared equal in the same checkout.
- **What would have prevented it:** when the CLI surface is dirty, either
  derive the semantic-delta HEAD-side static tree from the working tree or
  report that exact-head proof must follow a commit. Include the first command
  path that differs so a real parser drift remains distinguishable.
- **Disposition:** tooling fix — keep the fail-closed parity check, but make
  dirty-worktree attribution explicit.
- **Owner:** knowledge semantic-delta maintainers.

## 2026-08-26 — Named lint lane is parsed as a nonexistent Turbo task

- **What happened:** `bun run beep lint native-runtime`, used as a targeted
  acceptance check, launched the complete 26-step lint coordinator and also
  passed `native-runtime` to Turbo as a task name. The native-runtime policy
  lane itself passed, but the coordinator failed because no Turbo task with
  that name exists.
- **Evidence:** the run reported `lint:native-runtime: done` with zero errors,
  then failed the separate command `bunx turbo run lint ... native-runtime`
  with `Could not find task native-runtime in project`.
- **What would have prevented it:** either expose a documented targeted
  `beep lint native-runtime` subcommand or reject positional lane names before
  starting the full lint coordinator and print the canonical direct command.
- **Disposition:** tooling ergonomics — no source repair was needed for the
  migration, and the canonical full Yeet proof remains authoritative.
- **Owner:** repo-cli lint coordinator maintainers.

## 2026-08-26 — Green happy-path proof did not exercise rollback ownership

- **What happened:** the initial exact-head Yeet proof and focused migration
  tests were green, but the read-only quality panel found that a fleet rollback
  could remove a stream or overwrite manifest bytes created by another writer
  after preflight.
- **Evidence:** round-two findings `QG-001` and `QRL-R2-ERR-004` identified
  unconditional restoration from every planned snapshot. The repaired suite
  now injects a manifest edit during atomic promotion and proves that rollback
  preserves the foreign bytes while returning a visible conflict.
- **What would have prevented it:** mutation-campaign templates should require
  failure injection at each promotion boundary, a successful-mutation ledger,
  expected-byte ownership checks, and an observable cleanup-failure test before
  the first full proof.
- **Disposition:** implementation and test-law improvement applied in this
  packet; candidate for a reusable mutation-campaign checklist.
- **Owner:** repo-cli mutation authors and quality-review workflow maintainers.

## 2026-08-27 — Review-fix proof omits the blocking Fallow audit

- **What happened:** the review-fix tier passed build, check, Effect test-law
  checks, lint, 2,346 unit tests, and full docgen, but the subsequent full
  publication stopped on three introduced complexity findings and one local
  duplication group from `fallow audit`.
- **Evidence:** `bun run beep yeet publish --amend --no-edit --pr` failed its
  `fallow:audit` cheap gate; after extracting inventory reads, migration
  snapshots, promotion, rollback, and report validation into focused helpers,
  `bun run beep quality fallow audit --check --quiet` reported zero introduced
  findings.
- **What would have prevented it:** include the new-only Fallow audit in the
  review-fix tier, or print it as an explicit required pre-publication command
  when changed files are within Fallow's pilot scope.
- **Disposition:** implementation simplified in this packet; tier-composition
  improvement remains for the Yeet quality workflow.
- **Owner:** Yeet review-fix tier maintainers.

## 2026-08-27 — Local publish proof omits the hosted coverage ratchet

- **What happened:** the exact-head local publication proof passed 2,346 unit
  tests, Effect test laws, and every local quality lane, but the hosted
  `Heavy / Coverage Regression` check rejected reduced coverage in
  `Explore/Check.ts` after the fleet-lint integration.
- **Evidence:** hosted run `33042895609`, job `98420264729`, reported branch,
  function, line, and statement regressions for `Explore/Check.ts`. A focused
  fleet-graph command test restored that file to 100 percent across all four
  measures.
- **What would have prevented it:** include the affected coverage ratchet in
  the local publication proof whenever changed packages have a committed
  coverage floor, or name it as an explicit hosted-only gate before push.
- **Disposition:** focused coverage added in this packet; local/hosted proof
  parity remains a Yeet workflow improvement.
- **Owner:** Yeet proof-planning and coverage-ratchet maintainers.

## 2026-08-27 — Multi-file focused coverage overflows during result merge

- **What happened:** a focused Vitest invocation covering the exploration check
  and convention-migration suites completed test execution but overflowed the
  v8-coverage range-tree merger before it could report results.
- **Evidence:** the two-file coverage command failed in
  `@bcoe/v8-coverage`'s `mergeRangeTrees` with `Maximum call stack size
  exceeded`; running each coverage target independently avoids the merge path.
- **What would have prevented it:** make the focused coverage wrapper isolate
  files before aggregating summaries, or detect this merger failure and print
  the independent-invocation fallback.
- **Disposition:** tooling ergonomics — verify both suites independently; no
  product source repair is implied by the merger failure.
- **Owner:** Vitest coverage-lane maintainers.

## 2026-08-27 — Yeet repair rewrites unchanged upstream source

- **What happened:** after rebasing onto the latest `main`, `bun run beep yeet
  repair` applied safe terse-Effect rewrites to an unchanged Semantica source
  file outside this PR's packet-migration scope.
- **Evidence:** the repair left `apps/labs/semantica/src/layers/EvaluatorLive.ts`
  dirty with six helper-reference simplifications even though the branch had no
  patch for that file; the rewrite was restored before publication.
- **What would have prevented it:** scope write-mode repair laws to the branch
  delta, or park and restore rewrites that are byte-identical to the current
  base before the repair starts.
- **Disposition:** workflow fix — keep unrelated upstream cleanup out of this
  PR and publish only the packet receipt.
- **Owner:** Yeet repair-scope maintainers.

## 2026-08-27 — Sandboxed package coverage loses child-process pipe output

- **What happened:** `XDG_RUNTIME_DIR=/tmp bun run coverage --
  --filter=@beep/repo-cli` completed 2,352 tests but failed the package before
  the coverage comparator because the large-output child-process test received
  no captured stdout.
- **Evidence:** `test/step-git-exec.test.ts:102` reported
  `AssertionError: expected +0 to be 1048576 // Object.is equality`. An earlier
  run without the runtime-directory override also failed with
  `EROFS: read-only file system, open
  '/run/user/1000/beep-yeet-proof-locks-...lock'`; the override removed every
  coordinator-lock failure.
- **What would have prevented it:** run package coverage in a host environment
  that permits child-process pipe capture and a writable runtime directory, or
  provide an environment-safe capture fixture for the exact-limit test.
- **Disposition:** environment-only proof friction. The focused migration suite
  remains green, but this sandbox cannot produce the authoritative package
  coverage verdict.
- **Owner:** repo-cli process-test and coverage-lane maintainers.

## 2026-08-27 — Non-recursive `fs.rm` cannot remove-if-empty; the "safe" fix

- **What happened:** a first-pass fix for the Greptile rollback-race finding
  (`PacketMutation.ts` genesis rollback deleting concurrent event data)
  replaced a recursive directory remove with a non-recursive
  `fs.remove(eventsDirectory)`, catching `ENOTEMPTY`/`EEXIST`/`ERR_FS_EISDIR`
  as a safe no-op. Verified against real Node `fs.rm` semantics: without
  `recursive: true`, `fs.rm` throws `ERR_FS_EISDIR` for *any* directory
  target, empty or not — Node cannot distinguish emptiness without the
  recursive flag. Every rollback therefore always hit the caught branch and
  never removed the directory, silently orphaning an empty
  `ops/events/` after any failed genesis seed and permanently blocking retry
  (`applyPacketGenesisSeed` refuses to reseed when the directory still
  exists). A pre-existing committed test that asserted full directory removal
  had been quietly weakened to match the regression instead of catching it.
- **Evidence:** `node -e 'fs.rmSync(emptyDir)'` throws `ERR_FS_EISDIR` on an
  empty directory identically to a non-empty one (reproduced directly).
  `packages/platform/node-shared/src/internal/utils.ts` in the `.repos/effect`
  checkout confirms `ENOTEMPTY` has no explicit `SystemErrorTag` mapping
  either (falls through to `Unknown`), so tag-based matching on `_tag` alone
  cannot even discriminate the case.
- **What would have prevented it:** empirically test load-bearing `fs`
  assumptions against the real runtime instead of pattern-matching on error
  code names, and treat a weakened pre-existing assertion in a "fix" diff as
  a regression signal, not a simplification.
- **Disposition:** fixed by atomically renaming the new `ops/events` directory
  into a unique quarantine under the same `ops/` parent. Rollback validates
  and removes only its owned event inside that private path. A writer that
  targets canonical `ops/events` after the rename creates a separate directory
  that rollback never removes; foreign bytes that arrive before the rename
  remain in quarantine and the failure reports their preservation path.
  Effect v4's `FileSystem.rename` provides the atomic handoff without a direct
  `node:fs` import.
- **Owner:** PacketMutation genesis-rollback maintainers.

## 2026-08-27 — Coverage ratchet holds new files to zero uncovered units

- **What happened:** the "Heavy / Coverage Regression" CI failure reported
  per-metric percentages (e.g. "functions 40.81%") that read like target
  floors to clear. The actual ratchet rule for a file with no baseline
  identity (brand new in the PR) is stricter: any uncovered line, branch, or
  function counts as a regression row, i.e. an effective 100% bar, not the
  quoted percentage. Reaching a higher percentage without reaching zero
  uncovered units still fails the gate.
- **Evidence:** `bun run coverage -- --filter=@beep/repo-cli` continued
  reporting `[coverage-ratchet]` regression rows such as "new file has 18
  uncovered unit(s) at 64.7%" for `PacketMutation.ts` even after test
  additions roughly doubled its function coverage from the original CI
  failure's baseline.
- **What would have prevented it:** have the CI failure message state the
  new-file rule explicitly ("0 uncovered units required") instead of only a
  percentage, so remediation is scoped correctly on the first pass.
- **Disposition:** informational — remediation is "close every uncovered
  unit or get reviewer sign-off on `--write-baseline`," not "raise the
  percentage."
- **Owner:** coverage-ratchet lane maintainers.

## 2026-08-30 — Supplied checkout path omits the repository container directory

- **What happened:** the P3 closeout session opened in the supplied
  `YeeBois/project/beep-effect2` directory, where the packet was absent and Git
  reported `not a git repository`. The live checkout was instead under the
  sibling `YeeBois/projects/beep-effect2` path.
- **Evidence:** reading `goals/packet-convention-migration/GOAL.md` failed with
  `No such file or directory`, and `git status --short --branch` failed with
  `fatal: not a git repository (or any parent up to mount point /)`.
- **What would have prevented it:** resolve the requested packet relative to a
  verified Git root before starting the task, or generate the session working
  directory from the exact owning checkout rather than a hand-entered path.
- **Disposition:** session-routing friction; work continued only in the
  verified sibling checkout, without modifying the empty supplied directory.
- **Owner:** session-launch and checkout-routing maintainers.

## 2026-08-30 — Scheduler status usage requires an undocumented JSON flag

- **What happened:** the operator-prescribed admission probe, `bun run beep
  quality scheduler status`, failed before reporting lane ownership because
  the live CLI requires `--json`.
- **Evidence:** the command printed `ERROR Missing required flag: --json` and
  exited with code 1, although the Yeet/operator guidance names the unflagged
  command as the canonical human-readable status probe.
- **What would have prevented it:** keep the human-readable default accepted,
  or update the operator and Yeet guidance atomically when the JSON flag becomes
  mandatory.
- **Disposition:** CLI/documentation drift; use the explicit `--json` form for
  the live scheduler snapshot.
- **Owner:** quality scheduler CLI and Yeet guidance maintainers.

## 2026-08-30 — Packet launcher requests a same-PR closeout after the PR merged

- **What happened:** P3 was resumed with instructions to monitor the open
  packet PR to merge-ready and then perform P4 on that same PR, but the live
  repository has no open packet-convention PR. The implementation PR had
  already merged while the packet remained marked P3 in progress.
- **Evidence:** `gh pr list --state open` returned only unrelated PR #896;
  `gh pr view 855` reports `state: MERGED`, head
  `feat/packet-convention-migration`, merged on 2026-08-27, while
  `goals/packet-convention-migration/PLAN.md` still says P3 is in progress and
  P4 is pending.
- **What would have prevented it:** make the same-PR closeout flip a blocking
  pre-merge check, and have packet resume validate the referenced PR state
  before presenting P3 as executable.
- **Disposition:** closeout-state drift requiring an explicit recovery ruling;
  a merged PR cannot accept the mandated P4 commit.
- **Owner:** packet closeout and Yeet merge-gate maintainers.

## 2026-08-30 — Merge protection allowed the packet PR past its declared closeout gates

- **What happened:** the historical implementation PR was merged even though
  its final head never reached the packet's declared exact-head merge-readiness
  state. The later closeout session therefore cannot honestly infer P3 success
  from the merged state alone.
- **Evidence:** `gh pr checks 855` reports 28 terminal contexts with failures in
  `Fallow Advisory Envelopes` and `Vercel – oip-web`; the terminal Greptile
  context is neutral/skipped after an internal review error, so the final-head
  score and issue count are unknown. The PR did nevertheless merge at head
  `94c7966fa1`, and all 17 GraphQL review threads are resolved.
- **What would have prevented it:** make the packet completion contract's
  required checks and strict Greptile closeout branch-protection gates, and
  require the same-PR lifecycle flip before merge is enabled.
- **Disposition:** hosted policy gap; merged status is not a substitute for
  terminal green checks and a scored review-bot verdict.
- **Owner:** repository branch protection and Yeet closeout maintainers.

## 2026-08-30 — Isolated recovery worktree cannot run the repo CLI before dependency linking

- **What happened:** the dedicated closeout worktree was created from the
  verified Git head, but its first scheduler probe could not load the repo CLI
  because workspace dependencies were unavailable in that worktree.
- **Evidence:** `bun run beep quality scheduler status --json` failed with
  `Cannot find module '@beep/utils'` from the repo CLI entrypoint.
- **What would have prevented it:** have the worktree bootstrap path link or
  install the owning checkout's verified dependency tree before advertising the
  worktree as command-ready, or make the scheduler probe available outside the
  workspace dependency graph.
- **Disposition:** worktree-bootstrap friction; reuse the existing verified
  dependency tree before running packet checks.
- **Owner:** worktree setup and quality scheduler maintainers.

## 2026-08-30 — Post-merge hook runs before an isolated worktree is command-ready

- **What happened:** fast-forwarding the newly attached recovery branch invoked
  the repository's post-merge version-sync hook before the worktree dependency
  link had been provisioned. The Git update completed, but its validation hook
  could not execute.
- **Evidence:** `git merge --ff-only origin/main` fast-forwarded successfully,
  then `version-sync-check` failed with `Cannot find module '@beep/utils'` from
  the repo CLI entrypoint. The same command surface worked after linking the
  existing verified dependency tree.
- **What would have prevented it:** provision worktree dependencies as part of
  worktree creation, before any checkout/switch/merge operation capable of
  firing repository hooks, or make the hook bootstrap-independent.
- **Disposition:** worktree/hook ordering friction; rerun the affected
  validation through the canonical quality path after provisioning.
- **Owner:** worktree setup and Git-hook maintainers.

## 2026-08-30 — Convention-migration preview cannot construct its PacketEventStore dependency

- **What happened:** the recovery census invoked the packet's canonical second
  preview to prove that no legacy convention work remained. The command failed
  before reporting a plan because its runtime layer did not provide the packet
  event store.
- **Evidence:** `bun run beep goals migrate-conventions --preview` exited 1 with
  `Service not found: @beep/repo-cli/commands/Goals/PacketCore/PacketEventStore/PacketEventStore`.
  In the same checkout, `bun run beep goals set-status --migrate` completed and
  still planned one manifest repair for `gov-legal-data-driver-delivery`.
- **What would have prevented it:** exercise the registered CLI command through
  a runtime-layer smoke test, and compose every PacketCore dependency into the
  migration command's public provider before declaring the campaign reusable.
- **Disposition:** repaired in the recovery branch by providing the shared
  migration layer at the registered command boundary and adding a root-command
  smoke test. The focused suite passes 60 tests, and the live second preview
  now reports zero translations, seeds, issues, assumptions, or fleet findings.
- **Owner:** Goals migration command and PacketCore layer maintainers.

## 2026-08-30 — Reusing a checkout-wide dependency tree crosses worktree source boundaries

- **What happened:** linking the parent checkout's complete `node_modules`
  tree made the isolated worktree command-capable, but workspace-package links
  inside that tree still targeted the parent checkout. A scoped repo-cli check
  therefore compiled a mixture of recovery-worktree and parent-checkout source.
- **Evidence:** `bunx turbo run check --filter=@beep/repo-cli` resolved
  foundation source through the sibling `beep-effect2` checkout and failed an
  unrelated `@beep/duckdb` dependency build on missing runtime types, while the
  worktree's focused migration suite passed 60 tests.
- **What would have prevented it:** bootstrap each worktree with a local frozen
  install whose workspace links target that worktree; reserve a whole-tree
  dependency symlink for read-only commands that cannot traverse workspace
  package links.
- **Disposition:** environment-only mixed-checkout proof failure; replace the
  validated symlink with a worktree-local frozen install and rerun the scoped
  check before attributing source failures.
- **Owner:** worktree dependency-bootstrap maintainers.

## 2026-08-30 — Fleet checks exit successfully while reporting acceptance findings

- **What happened:** both fleet inspection commands completed with exit code 0
  even though their reports still contained findings that block the packet's
  literal zero-finding acceptance contract.
- **Evidence:** `bun run beep explore --check` reported `findings=5`, and the
  repaired `bun run beep goals migrate-conventions --preview` reported three
  violation-severity unreachable references, while both processes exited 0.
- **What would have prevented it:** make `--check` and preview return nonzero
  when blocking or violation findings are present, or add an explicit
  `--fail-on-findings` mode and use it in packet/CI acceptance.
- **Disposition:** proof parsing hazard; this recovery validates the literal
  report counts instead of treating process success as acceptance. After the
  reconciliation, both commands report zero findings.
- **Owner:** Explore check and Goals convention-migration CLI maintainers.

## 2026-08-30 — Package verification exposes opaque failures in unrelated CLI command fixtures

- **What happened:** the required full `@beep/repo-cli` package verifier passed
  build, typecheck, lint setup, and 2,692 tests, but two agent-effectiveness
  command tests failed without printing the underlying fixture command output.
  Diagnosis showed their temp-directory helpers inherited a `TMPDIR` below the
  user cache, which the production private-home-path scanner correctly rejects.
- **Evidence:** `bun run beep quality package-verify @beep/repo-cli` reported
  failures in `agent-effectiveness-command.test.ts` for `emits report-only
  annotation check JSON` and `defaults Phoenix sync to dry-run JSON`; both
  surfaced only `CliReportedExit` messages from the command boundary.
- **What would have prevented it:** have command-fixture failures attach the
  captured stdout/stderr and resolved fixture path to `CliReportedExit`, and
  make privacy-sensitive test fixtures allocate below an explicit safe scratch
  root instead of inheriting an arbitrary `TMPDIR`.
- **Disposition:** reproduced unchanged on the clean current `origin/main`
  checkout and isolated by unsetting `TMPDIR`, so it was an
  environment-sensitive baseline fixture defect rather than a migration
  regression. Both test-only helpers now allocate beneath `/tmp` with cleanup
  unchanged; the CLI and AI-metrics suites pass 25/25 tests under both the
  actual managed `TMPDIR` and an unset `TMPDIR`.
- **Owner:** Agent Effectiveness command tests and package-verification
  diagnostics maintainers.

## 2026-08-30 — Lifecycle closeout left executable framing in the packet README

- **What happened:** the goal launcher itself was converted to retained,
  read-only regression guidance, but the packet README still labeled its
  command block `Launch`, described `GOAL.md` as an execution launcher, and
  called `PLAN.md` active.
- **Evidence:** final-diff review found the stale labels in
  `goals/packet-convention-migration/README.md` after the canonical lifecycle
  had already become `completed-retained`.
- **What would have prevented it:** make lifecycle closeout lint README
  orientation language, not only the generated lifecycle line, and flag active
  launcher or plan labels in retained packets.
- **Disposition:** fixed in the recovery diff by relabeling the command as a
  retained regression entry point and both documents as terminal/read-only
  guidance.
- **Owner:** packet closeout lint and README template maintainers.

## 2026-08-30 — Dirty-worktree cheap gates miss a required product changeset

- **What happened:** the edit-loop cheap-gate proof reported no changed product
  workspaces, but the first authoritative staged publish committed the same
  candidate and then failed because `@beep/repo-ai-metrics` lacked a changeset.
- **Evidence:** before commit, `quality:changeset-status` printed
  `product_workspaces=0`; during `yeet publish --staged-only --pr --monitor`, it
  printed `product_workspaces=2` and `changed product workspaces missing an
  in-range changeset: @beep/repo-ai-metrics`.
- **What would have prevented it:** have dirty-worktree changeset detection
  include staged and unstaged paths relative to the base, or make cheap-gates
  reject an uncommitted candidate instead of returning an incomplete green
  product-workspace census.
- **Disposition:** publish stopped before push. The required AI-metrics patch
  changeset was added and the unpushed recovery commit amended; re-run the
  authoritative publish proof on the corrected head.
- **Owner:** changeset-status and Yeet dirty-worktree preflight maintainers.

## 2026-08-30 — Full coverage proof regresses untouched Yeet branch floors

- **What happened:** the corrected committed-head Yeet proof passed every
  preflight, build, lint, Effect/tsgo, unit, integration, JSDoc, and docgen lane,
  but its repository CLI coverage shard measured two untouched Yeet internals
  below their committed branch floors.
- **Evidence:** `bun run beep yeet verify --collect-all` completed 28 of 29
  lanes and failed only `quality:coverage`; the ratchet reported
  `LaneProofReuse.ts` at `86.84 < 92.1` branches and `Planner.ts` at
  `90.54 < 91.89`, although the CLI shard itself passed 143 test files and
  2,689 tests plus 5 skips.
- **What would have prevented it:** ensure per-file coverage floors are derived
  from a deterministic test/worker configuration, and report whether a
  regressed row belongs to the changed path set so unrelated baseline drift is
  distinguishable from a candidate regression.
- **Disposition:** diagnosed as deterministic inherited-environment drift: the
  full proof injects lane-proof mode and base variables, so the nested coverage
  run did not take the three default branches measured by direct baseline
  generation. Tests now delete those ambient variables around default-contract
  assertions. A focused coverage run under the injected environment observed
  every repaired branch, so the higher committed floors remain intact.
- **Owner:** coverage-ratchet and repository CLI test maintainers.

## 2026-08-30 — Same-origin admission wait is reported as token backpressure

- **What happened:** the repaired exact-head full proof remained first in the
  admission queue even after available capacity was sufficient, because a
  publish proof from another checkout of the same origin still held the
  origin-wide proof lock. The wait message continued to describe machine-budget
  backpressure instead of the actual same-origin serialization.
- **Evidence:** `bun run beep quality scheduler status --json` showed capacity
  recovering from 9 to 10 tokens with 5 active while the queued full proof
  requested 3, yet `bun run beep yeet verify --collect-all` remained at
  position 1 through 195 seconds. Both entries had the same `originKey`; the
  holder was live for roughly 29 minutes, heartbeating, and executing the final
  `ci local` test-tsgo process. The queued ticket nevertheless reported
  `blockedOnOriginAtMillis: 0`.
- **What would have prevented it:** surface the origin lock as an explicit
  admission blocker in status and wait messages, populate its blocked-since
  timestamp, and distinguish it from token or memory pressure. Reduce
  origin-lock hold time by reusing exact-head proof lanes across the serialized
  cheap-gates, pre-push, and CI-parity batteries where their contracts overlap.
- **Disposition:** no dead or stale lease was found, so the active holder was
  left untouched. The not-yet-admitted recovery ticket was canceled to record
  this evidence before amending and requeueing the exact-head candidate.
- **Owner:** Yeet admission scheduler, origin-lock observability, and publish
  proof orchestration maintainers.

## 2026-08-30 — PR body interpolation executes Markdown code spans

- **What happened:** the first manual `gh pr create` attempt passed a Markdown
  body containing backtick code spans through a double-quoted shell argument.
  The shell interpreted those spans as command substitutions, started a
  redundant full Yeet proof, and never created the PR.
- **Evidence:** the command emitted `zsh: command not found` for the exact-head
  SHA and then launched `bun run beep yeet verify --collect-all`; a subsequent
  `gh pr list --head docs/packet-convention-closeout-recovery` returned no PR.
  The accidentally launched proof processes were identified by their exact
  command and terminated without touching other active checkouts.
- **What would have prevented it:** pass multiline PR bodies through
  `gh pr create --body-file -` or another literal stdin/file boundary instead
  of interpolating Markdown into executable shell text.
- **Disposition:** publication-command construction friction; retry through a
  literal stdin body and keep the already authoritative exact-head proof.
- **Owner:** agent shell-command construction and PR publication wrappers.

## 2026-08-30 — Yeet monitor treats deployment quota failures as repairable source defects

- **What happened:** the required hosted `beep yeet monitor` invocation exited
  on three Vercel status failures and opened a local repair session even though
  each failure was an external deployment-account quota condition, not a defect
  in the PR head.
- **Evidence:** `bun run beep yeet monitor --watch --until-event --summary`
  reported first-red capsules for `Vercel – oip-web`, `Vercel –
  oip-web-staging`, and `Vercel – todox`; every status target identified
  `upgradeToPro=build-rate-limit`, while the GitHub Actions checks continued.
- **What would have prevented it:** classify external deployment quota and
  account-status contexts separately from repairable source checks, and let
  monitor wake only on required checks or explicitly actionable providers.
- **Disposition:** hosted-environment noise; do not run repair or retry the
  Vercel contexts, and continue monitoring exact-head required checks and
  review state.
- **Owner:** Yeet hosted-monitor classification and deployment integrations.

## 2026-08-30 — Managed-temp repair hard-codes a POSIX-only fixture root

- **What happened:** the first deterministic repair for privacy-sensitive
  Agent Effectiveness fixtures ignored the managed home-based `TMPDIR` by
  forcing `/tmp`. Greptile correctly identified that the test setup would fail
  on native Windows, while its suggested ambient-temp fallback would recreate
  the original private-home-path rejection on both managed POSIX hosts and
  normal per-user Windows temp directories.
- **Evidence:** PR #900's first Greptile review scored 4/5 and flagged
  `agent-effectiveness.test.ts` at the hard-coded temp root. The production
  scanner rejects `/home/<user>`, `/Users/<user>`, and
  `C:\\Users\\<user>` paths; Effect's default temp-directory implementation
  delegates to the environment-sensitive platform temp resolver.
- **What would have prevented it:** use a shared, injected-platform test helper
  from the first repair: `/tmp` for POSIX and the Windows system-root temp
  directory for `win32`, independent of `TMPDIR`, `TMP`, and `TEMP`. Prove both
  branches without weakening the production privacy scanner.
- **Disposition:** actionable review finding; replace both local literals with
  the shared helper, add Windows/POSIX resolver tests, and rerun the fixtures
  under the actual managed temp environment before re-review.
- **Owner:** shared test utilities and Agent Effectiveness fixture maintainers.

## 2026-08-30 — Shared temp helper passes behavior tests before Effect-LSP rejects its API shape

- **What happened:** the first shared portability helper passed all 28 focused
  behavior tests, but its package build/check failed immediately under the
  Effect language-service rules because it imported `node:path` and exported a
  two-argument function without a pipeable overload.
- **Evidence:** `bunx turbo run check --filter=@beep/test-utils
  --filter=@beep/repo-ai-metrics --filter=@beep/repo-cli` reported
  `effect(nodeBuiltinImport)` for `SystemTemp.ts` and
  `effect(missingPipeableSignature)` for
  `privacySafeSystemTempRootForTesting`; the preceding three-file Vitest run
  passed 28/28 tests.
- **What would have prevented it:** design shared helpers against the configured
  Effect-LSP contract before behavior-only testing: prefer the Effect platform
  surface or simple platform-independent string handling, and use one options
  object when an exported helper does not need data-first/data-last arities.
- **Disposition:** edit-loop API-shape correction; remove the Node path import,
  convert the injected test seam to a single options object, and rerun the same
  scoped check before publication.
- **Owner:** shared test-utility authors and Effect-LSP guidance maintainers.

## 2026-08-30 — Green repo-cli suite prints unscoped failure-shaped fixture output

- **What happened:** the full package-scoped repo-cli test run printed repeated
  `TS2589` failures for `@beep/xai` and `@beep/ui` plus `Failed:` task lines,
  which looked like a live dependency regression while the suite continued for
  several minutes. Those messages were fixture output: the terminal result was
  143 passing files and 2,694 passing tests.
- **Evidence:** `bunx turbo run test --filter=@beep/test-utils
  --filter=@beep/repo-ai-metrics --filter=@beep/repo-cli` emitted
  `@beep/xai#build` and `@beep/ui#build` failure-shaped lines mid-run, then
  completed `3 successful, 3 total` after 4 minutes 32 seconds.
- **What would have prevented it:** capture expected nested-command stderr in
  the owning fixture, or prefix replayed failure samples with the test name and
  an explicit `expected fixture output` marker so operators do not diagnose a
  green suite as a concurrent workspace failure.
- **Disposition:** diagnostic-noise friction only; no xai/ui repair is implied
  by the terminal green package test result.
- **Owner:** repo-cli command-fixture diagnostics and package-test reporting.

## 2026-08-30 — Scoped check passes a new export that full package docgen rejects

- **What happened:** the shared temp helper passed focused formatting,
  typecheck, build, and behavior tests, but an independent final-diff reviewer
  ran the full package verifier and found that its exported JSDoc violated the
  repository documentation law.
- **Evidence:** `bun run beep quality package-verify @beep/test-utils` failed
  docgen on `SystemTemp.ts`: the exported options interface was missing
  `@since`, and both exported value docs used prohibited `@example` carriers
  instead of titled `**Example** (...)` sections. The earlier scoped Turbo
  check had completed 35/35 tasks because it does not include package docgen.
- **What would have prevented it:** include full package verification whenever
  a package barrel gains a new export, or add the JSDoc-law lane to the scoped
  check plan for files under a published `src/` surface.
- **Disposition:** actionable proof-gap repair; bring all three exports onto the
  canonical documentation shape and rerun the full test-utils verifier before
  committing the review iteration.
- **Owner:** package-verification planning and shared test-utility authors.

## 2026-08-30 — Package verifier passes an unnecessary exported data interface

- **What happened:** after the new helper passed scoped check, tests, and the
  full test-utils package verifier, the repo-wide cheap-gate schema-first lane
  rejected its exported options interface as an unmodeled pure-data API.
- **Evidence:** `bun run beep yeet verify --tier cheap-gates` reported
  `PrivacySafeSystemTempRootOptions [exported-interface]` with
  `schema-first-inventory` severity `error`; the preceding
  `package-verify @beep/test-utils` had passed audit and docgen.
- **What would have prevented it:** include schema-first policy in the package
  verifier or scoped package check when a public barrel changes. Avoid exporting
  a configuration shape that exists only to inject platform facts into a pure
  test seam; if it is a genuine public model, define the annotated schema first.
- **Disposition:** API-surface correction; keep the structural options type
  module-private and export only the resolver functions consumers need.
- **Owner:** package-verification composition and shared utility API authors.

## 2026-08-30 — One shared test-helper export fans affected check across 117 packages

- **What happened:** moving the privacy-safe temp resolver into the canonical
  `@beep/test-utils` package made the required affected CI check typecheck nearly
  the entire downstream workspace, even though only two test files consume the
  new helper.
- **Evidence:** `bun run beep ci lane check --affected --base origin/main
  --summarize` selected 117 packages and ran 224 successful Turbo tasks in
  1 minute 36 seconds. It then ran the separate global 952-file Effect-LSP scan
  for another 167 seconds, despite the same scan already passing in cheap gates.
- **What would have prevented it:** give narrow cross-package test helpers a
  leaf support surface with limited reverse dependencies, or let affected proof
  planning distinguish additive test-only exports from runtime dependency
  changes while preserving a fail-closed fallback. Reuse the exact-head global
  Effect scan across cheap-gate and CI-parity invocations.
- **Disposition:** proof-topology bottleneck only; all 224 affected tasks and
  the global Effect scan passed. Keep the shared helper to avoid duplicating a
  privacy boundary, but optimize its downstream proof cost separately.
- **Owner:** test-support package topology and affected-proof planning.

## 2026-08-30 — Recovery PR merges before its active review-fix loop closes

- **What happened:** PR #900 was merged and its remote branch was deleted while
  the active Greptile loop was repairing a valid portability finding. A later
  push recreated the same remote branch with the fixes, but those commits are
  not ancestors of the squash merge on `main` and therefore require a narrow
  follow-up PR.
- **Evidence:** GitHub records PR #900 merged at
  `746ac2836d4a3499b7e323790f75c48cd26cd67e` from head
  `d49d0dd2f9c2ff3e82e5cb119f5714b90a913ae6` on 2026-08-30 at 17:30:02Z.
  Required hosted checks were terminal by 17:17Z, but Greptile was still 4/5
  with an unresolved `/tmp` portability thread; local head
  `b1d2f138058ab9d1d9c215b952f2c4c9d033408d` contains that reviewed repair.
- **What would have prevented it:** make the merge queue require the current
  head's Greptile 5/5 result and zero unresolved review threads, and expose an
  active closeout lease so branch deletion cannot race a publisher's review-fix
  iteration.
- **Disposition:** hosted-concurrency recovery; retain the completed merge of
  #900, reconcile the recreated branch with current `origin/main`, and publish
  only the unmerged review fixes as a follow-up.
- **Owner:** merge admission, review-policy enforcement, and closeout lease
  observability.

## 2026-08-30 — Squash-merged recovery branch obscures the true follow-up diff

- **What happened:** reconciling the recreated recovery branch with current
  `origin/main` initially made the branch appear to delete thousands of lines
  added by newer PRs because its merge base predates #900's squash commit.
  Merging `origin/main` then produced five overlaps between the squash-merged
  recovery baseline and the branch's post-review amendments.
- **Evidence:** before reconciliation, `git diff --stat origin/main HEAD`
  reported 62 changed files and 8,470 deletions. `git merge --no-edit
  origin/main` conflicted in the recovery changeset, `SPEC.md`, this ledger, and
  two Agent Effectiveness fixtures. After resolving against the current-main
  baseline, `git diff --name-status origin/main` reports only the eight intended
  follow-up files.
- **What would have prevented it:** when a squash-merged PR branch is deleted
  during active review repair, recreate a fresh follow-up branch directly from
  the merge commit and apply only the reviewed delta, or provide a Yeet recovery
  command that computes that delta from the merged PR head and current review
  head.
- **Disposition:** resolved publication friction; preserve all newer mainline
  files and carry only the portable temp helper, its consumers, acceptance
  wording, changeset, tests, and contemporaneous ledger additions.
- **Owner:** post-merge review recovery tooling and branch lifecycle guidance.

## 2026-08-30 — Prescribed scheduler probe now requires an unstated flag

- **What happened:** the machine-wide scheduler operator instruction says to
  probe the lane with `bun run beep quality scheduler status`, but the current
  CLI rejects that exact read-only command instead of printing the status.
- **Evidence:** the command exited 1 with `Missing required flag: --json` and
  printed usage showing `--json` as the only command flag, even though the
  operator instruction omits it.
- **What would have prevented it:** make human-readable status the no-flag
  default and keep `--json` optional, or update the canonical operator
  instruction and command examples atomically when the flag becomes required.
- **Disposition:** scheduler-observability friction; retry the probe with
  `--json` and continue package-scoped iteration without entering admission.
- **Owner:** quality-scheduler CLI compatibility and operator documentation.

## 2026-08-30 — Squash follow-up edits an already-landed changeset outside the proof range

- **What happened:** the first post-merge follow-up retained and extended
  #900's changeset file, but cheap gates correctly treated that file as part of
  the base rather than as a new in-range release declaration.
- **Evidence:** `bun run beep yeet verify --tier cheap-gates` refreshed
  `origin/main`, then `quality changeset-status --since origin/main` exited 1
  and reported changed product workspaces `@beep/repo-ai-metrics` and
  `@beep/test-utils` missing an in-range changeset.
- **What would have prevented it:** a post-squash recovery helper should detect
  changeset paths already present in the merge commit and generate a fresh
  follow-up changeset instead of carrying an amendment to the merged file.
- **Disposition:** actionable publication repair; restore the landed changeset
  byte-for-byte and add a new changeset scoped to both follow-up packages.
- **Owner:** changeset-range diagnostics and post-merge review recovery tooling.

## 2026-08-30 — Non-admission Effect scan slows under an admitted full proof

- **What happened:** cheap gates correctly avoided the admission queue, but its
  global Effect-LSP test scan still competed with a concurrently admitted full
  proof and produced no progress output for several minutes.
- **Evidence:** scheduler status showed one active three-token full-proof lease
  and three queued tickets while `cheap-gates:test-tsgo` checked 952 files
  across 135 packages. The scan completed green in 247,006 ms, versus 167
  seconds for the same 952-file lane earlier in this recovery.
- **What would have prevented it:** either account heavyweight non-admission
  scans in the machine capacity model, reuse an exact-tree Effect-LSP result
  across proof commands, or emit periodic file/package progress so slower
  resource sharing is distinguishable from a hang.
- **Disposition:** performance and observability regression only; the scan is
  green and no duplicate was launched.
- **Owner:** quality-scheduler resource accounting, Effect-LSP proof caching,
  and progress reporting.

## 2026-08-30 — Generated-document checks fail transiently without byte drift

- **What happened:** cheap gates failed both generated-document checks even
  though the follow-up has no net changes to their sources or outputs relative
  to `origin/main`. Both canonical writers then reported writes but changed no
  tracked bytes, and immediate standalone checks passed.
- **Evidence:** at `origin/main` `9c0f2eacc760c246fa686fefb911a090b2bd5275`,
  `bun run beep goals index --check` reported `goals/INDEX.md` drift and
  `bun run beep explore atlas --check` exited 1. `git diff --name-status
  origin/main` contained neither goal manifests nor exploration sources before
  those checks. `goals index --write` and `explore atlas --write` left the tree
  unchanged; direct `--check` reruns then both exited 0.
- **What would have prevented it:** report the mismatching path or digest on
  check failure and make projection reads/writes atomic so a transient cache or
  concurrent-read condition cannot masquerade as committed drift.
- **Disposition:** transient proof-orchestration failure; retain no generated
  artifact diff and rely on the immediate green standalone reruns plus a fresh
  cheap-gate pass after the changeset commit.
- **Owner:** goal-index and exploration-atlas check determinism and diagnostics.

## 2026-08-30 — Green local lanes leave six closeout baselines marked stale

- **What happened:** after package checks, cheap gates, and the authoritative
  affected CI lane all passed, the first hosted closeout status still declared
  six local proof inputs stale because changed tests and the opportunity ledger
  postdated their generated baselines or inventory.
- **Evidence:** `bun run beep yeet status --remote` at
  `97e98b5634c126fe505094575861aef8e82b40b9` listed stale
  `coverage-regression`, `jsdoc-totals-ratchet`, `knip-ratchet`,
  `test-typecheck-blindspot`, `goals-doctor`, and
  `jsdoc-documentation-inventory`, while the preceding cheap-gate run and
  affected lane both exited 0.
- **What would have prevented it:** include the closeout staleness audit before
  publication, have the relevant canonical writers participate in repair, or
  allow an exact-head green gate to refresh an unchanged baseline's provenance
  without requiring a late hosted-head reset.
- **Disposition:** actionable closeout repair; run only the canonical writers
  named by status, inspect their byte diffs, and publish one reviewed generated
  update if needed.
- **Owner:** Yeet pre-publication completeness and generated-baseline lifecycle.

## 2026-08-30 — Timestamp staleness repair triggers workspace-wide baseline recomputation

- **What happened:** clearing closeout's stale-baseline markers required
  workspace-wide coverage and JSDoc inventory recomputation even though the
  review fix added one small test helper and two fixture call sites.
- **Evidence:** `bun run coverage:baseline:write` prebuilt 134 packages, ran ten
  uncached weighted coverage shards, and completed in 5 minutes 53 seconds; the
  repo-cli shard alone ran 143 files and 2,694 cases. The writer changed 304
  lines in the coverage baseline. `bun run beep quality jsdoc-inventory` used
  more than one CPU core for about five minutes without progress output and
  changed 411 JSON inventory lines plus its Markdown projection.
- **What would have prevented it:** key staleness to semantic input digests and
  refresh only affected package rows; do not require a workspace-wide remeasure
  merely because a source file's commit or mtime is newer. Cache inventory and
  coverage results by exact tree and emit shard/package progress for silent
  writers.
- **Disposition:** completed canonical baseline repair; retain the generated
  diffs, rerun the fast ratchet checks, and avoid another full workspace
  coverage pass unless a metric gate actually fails.
- **Owner:** coverage/JSDoc baseline provenance, affected recomputation, and
  writer progress telemetry.

## 2026-08-30 — GitHub required-check watch cannot infer the checkout repository

- **What happened:** after optional Vercel failures made the Yeet event watch
  unsuitable for waiting on required checks, the standard GitHub CLI watch
  could not infer a repository from the current checkout.
- **Evidence:** `gh pr checks 906 --required --watch --interval 10` exited 1
  with `No default remote repository has been set`, even though Git has an
  `origin` remote and the current branch tracks its remote counterpart.
- **What would have prevented it:** let the GitHub CLI infer the unique Git
  remote for PR commands, or have Yeet's required-only watch pass the repository
  it already resolved for the open PR.
- **Disposition:** closeout tooling friction; do not mutate user-level GitHub
  configuration, and rerun the read-only watch with explicit
  `--repo beep-effect/beep-effect`.
- **Owner:** Yeet/GitHub CLI repository-context propagation.

## 2026-08-30 — Required-check watch exits before workflows register

- **What happened:** immediately after the final push, the required-only GitHub
  check watcher exited instead of waiting for workflow check suites to be
  created for the new head.
- **Evidence:** `gh pr checks 906 --repo beep-effect/beep-effect --required
  --watch --interval 10` exited 1 with `no required checks reported on the
  'docs/packet-convention-closeout-recovery' branch` even though the previous
  head registered 17 required checks and the new push had just completed.
- **What would have prevented it:** give `--watch` a bounded registration grace
  period, or have Yeet distinguish `zero checks not yet registered` from the
  terminal `workflow configured no required checks` state.
- **Disposition:** hosted-propagation friction; use a bounded retry only for the
  exact no-check message, then hand control to the normal required-check watch.
- **Owner:** GitHub check-watch startup semantics and Yeet hosted monitoring.

## 2026-08-30 — Package verifier misses the module fileoverview required by CI Docgen

- **What happened:** the shared test-utils helper passed the package verifier's
  audit and docgen steps, but the exact affected CI Docgen lane rejected the new
  module's documentation surface.
- **Evidence:** `bun run beep quality package-verify @beep/test-utils` completed
  `ok audit` and `ok docgen`; later, both hosted `Heavy / Docgen` and
  `bun run beep ci lane docgen --base origin/main --head HEAD --mode affected`
  failed with `src/SystemTemp.ts:1 <module fileoverview> missing @since`.
- **What would have prevented it:** make package verification run the same
  module-fileoverview law as `docgen:local`, or have the new-export scaffold add
  the canonical `@packageDocumentation` and `@since` module header.
- **Disposition:** actionable documentation-law repair; add the canonical module
  header, rerun package verification and the exact affected Docgen lane, then
  publish one final reviewed fix.
- **Owner:** package verifier parity, Docgen law composition, and export
  scaffolding.

## 2026-08-30 — Concurrent Docgen callers race on generated examples

- **What happened:** package verification and the affected CI Docgen lane were
  launched concurrently to prove the same `@beep/test-utils` documentation
  repair. The affected lane generated and typechecked the package successfully,
  while package verification failed because its generated examples directory
  became empty during the overlapping run.
- **Evidence:** the concurrent `bun run beep quality package-verify
  @beep/test-utils` process failed with `TS18003: No inputs were found in config
  file 'packages/tooling/test-kit/test-utils/docs/examples/tsconfig.json'`; at
  the same timestamp, `bun run beep ci lane docgen --base origin/main --head
  HEAD --mode affected` reported `@beep/test-utils:docgen` succeeded.
- **What would have prevented it:** serialize Docgen callers per package, or
  generate each invocation's temporary examples in an isolated directory and
  atomically publish the completed result.
- **Disposition:** harness concurrency friction; let the affected lane finish,
  then rerun package verification alone before publication.
- **Owner:** Docgen generated-workspace isolation and package-verifier locking.

## 2026-08-30 — Affected Docgen accepts scratchpad's skipped output, then rejects it during aggregation

- **What happened:** the exact affected Docgen lane completed all 114 selected
  Turbo tasks successfully, including `@beep/test-utils`, but failed afterward
  while aggregating package docs. The scratchpad task had explicitly skipped its
  proof manifest for a focused include run and emitted no output; the aggregator
  nevertheless required generated scratchpad docs.
- **Evidence:** `bun run beep ci lane docgen --base origin/main --head HEAD
  --mode affected` reported `Tasks: 114 successful, 114 total`, warned `no
  output files found for task @beep/scratchpad#docgen`, and then failed with
  `Package "@beep/scratchpad" does not have generated docs. Run "bun run beep
  docgen generate -p scratchpad" first.`
- **What would have prevented it:** make scoped selection and aggregation share
  one typed package-eligibility decision, so an intentional focused-run skip is
  either excluded before Turbo execution or accepted during aggregation.
- **Disposition:** authoritative-lane orchestration friction; inspect the live
  Docgen routing and use its narrowest canonical generation/retry path before
  publishing the final head.
- **Owner:** affected Docgen selection, focused-include semantics, and docs
  aggregation.

## 2026-08-30 — Repo CLI tests emit failure-like fixture output without a progress boundary

- **What happened:** the package-scoped `@beep/repo-cli` test proof emitted
  realistic failure text from its integration fixtures, then continued without
  a clear top-level progress boundary for several minutes. It was interrupted
  at the operator's publish cadence, so its terminal result is not acceptance
  evidence; the paired package check and focused Docgen regression test were
  green.
- **Evidence:** `bunx turbo run test --filter=@beep/repo-cli
  --filter=@beep/test-utils` printed simulated `@beep/xai:build` and
  `@beep/ui:build` TS2589 failures, then continued into temporary Git worktrees
  and hosted-check fixtures for more than four minutes; the scoped check
  completed 34/34 tasks, the focused regression test passed, and
  `@beep/test-utils` completed 22 tests with 3 skipped.
- **What would have prevented it:** prefix captured fixture subprocess output
  as simulated test data and emit periodic top-level test-file progress, so an
  operator can distinguish a real package failure from a long-running fixture.
- **Disposition:** observability friction, not a confirmed product failure;
  rely on the focused test plus the authoritative affected/hosted lanes for the
  final head.
- **Owner:** Repo CLI integration-test output labeling and progress reporting.

## 2026-08-30 — Package verification omits full ESLint JSDoc policy and hosted output hides the finding

- **What happened:** the helper passed package audit, package Docgen, and the
  affected Docgen metadata law, but hosted `Heavy / Lint Policy` failed the
  full-repository ESLint JSDoc step. The hosted policy summary retained only the
  failing child command and exit code, so the actionable diagnostics required
  a local replay.
- **Evidence:** hosted run `33329419656`, job `Heavy / Lint Policy`, reported
  `lint:jsdoc: exit 1` for `bunx eslint . --max-warnings=0` without its child
  output. Local execution of that exact command identified three warnings in
  `packages/tooling/test-kit/test-utils/src/SystemTemp.ts`: missing `@param
  "options"` and two missing `@returns` declarations. `bun run beep quality
  package-verify @beep/test-utils` had completed both audit and Docgen green.
- **What would have prevented it:** include the repository's ESLint JSDoc rules
  in package verification for exported package files, and preserve failing
  child stdout/stderr in the lint-policy summary and GitHub annotation.
- **Disposition:** actionable documentation-law repair plus diagnostic
  observability friction; add the canonical tags and replay ESLint before
  publishing the final head.
- **Owner:** package-verifier lint parity and lint-policy failure reporting.

## 2026-08-30 — Final PR head enters an all-jobs hosted Actions fleet queue

- **What happened:** the final repair head published immediately without using
  local Yeet admission, but its GitHub Actions workflow registered every job
  without acquiring any runner. This can look like the previously investigated
  machine scheduler contention even though it is a separate hosted queue.
- **Evidence:** Actions run `33330826703` for PR #906 head `b968441965` showed
  `23` jobs with status `queued`, `0` running, and only the intentionally skipped
  Build job completed after registration; `bun run beep yeet monitor` had
  already observed the same exact head and only the two optional Vercel reds.
- **What would have prevented it:** surface hosted runner-fleet queue age and
  capacity separately from repository admission state, and let Yeet label a
  registered-but-zero-running workflow as `hosted-runner-queued` rather than a
  generic pending-check state.
- **Disposition:** hosted propagation/capacity friction; publish the ledger-only
  observation while the superseded run is still idle, then monitor the new
  exact head without entering local admission.
- **Owner:** GitHub Actions runner-fleet observability and Yeet hosted-state
  classification.

## 2026-08-30 — Remote closeout discovers three timestamp-stale baselines after hosted Heavy Check passes

- **What happened:** the exact pushed PR head passed hosted `Heavy / Check`,
  but the remote Yeet status still rejected closeout because adding the shared
  `SystemTemp.ts` source made three repository baselines older than their input.
  None of the earlier package-scoped, affected-lane, cheap-gate, or hosted
  Heavy Check results surfaced the stale closeout metadata before publication.
- **Evidence:** `bun run beep yeet status --remote` on PR #906 head
  `89f9a9f990` reported `3 stale, 0 unproven`: `coverage-regression` for
  `standards/coverage.regression-baseline.jsonc`, `knip-ratchet` for
  `standards/knip.regression-baseline.jsonc`, and
  `test-typecheck-blindspot` for
  `standards/test-typecheck.blindspot-baseline.jsonc`, all older than
  `packages/tooling/test-kit/test-utils/src/SystemTemp.ts`.
- **What would have prevented it:** make cheap-gates or the authoritative
  affected CI lane run the same closeout staleness preflight, and have Heavy
  Check fail or annotate when any required baseline is older than a changed
  governed source.
- **Disposition:** actionable closeout repair; regenerate only the three named
  baselines, verify their diffs, and publish a replacement exact head without
  entering local full-Yeet admission.
- **Owner:** Yeet pre-publication staleness parity and hosted Heavy Check gate
  coverage.

## 2026-08-30 — Package-local coverage staleness prescribes a whole-repository baseline rewrite

- **What happened:** Yeet correctly identified a stale coverage baseline after
  the new `@beep/test-utils` helper, but its only rendered repair command was
  the unscoped whole-document writer. That command prebuilt 134 packages and
  launched ten coverage shards even though the changed governed source was
  confined to `@beep/test-utils` and Repo CLI.
- **Evidence:** `bun run beep yeet status --remote` prescribed `bun run
  coverage:baseline:write`; the command reported `coverage:full: prebuild once,
  then 10 weighted in-job shard(s)`, `Running build in 134 packages`, and was
  still executing active package coverage after more than four minutes. The
  baseline header separately documents the narrower supported form `bun run
  coverage -- --filter=<package> --write-baseline`.
- **What would have prevented it:** derive affected coverage packages from the
  same branch diff used by gate staleness and render a safe multi-filter
  regeneration command, falling back to the whole-document writer only when
  affected-package resolution is ambiguous.
- **Disposition:** command-routing and acceptance-latency friction; allow the
  already-running authoritative writer to finish, but do not repeat it for this
  head.
- **Owner:** Yeet coverage-staleness remediation hints and affected-package
  selection.

## 2026-08-30 — Knip baseline writer emits JSONC that the repository formatter rejects

- **What happened:** the canonical Knip baseline writer completed successfully
  with zero findings, but reformatted `normalization.omitted_fields` onto
  multiple lines. The repository's Biome policy requires that three-item array
  on one line, so generator output was immediately non-canonical.
- **Evidence:** `bun run beep quality knip --write-baseline` wrote
  `standards/knip.regression-baseline.jsonc` with zero findings; the subsequent
  `bunx biome check` failed only that file and proposed changing the multiline
  `omitted_fields` array back to `["line", "col", "pos"]`.
- **What would have prevented it:** run generated Knip JSONC through the same
  Biome formatter configuration before the writer reports success, or serialize
  compact arrays in the already-canonical shape.
- **Disposition:** generator-formatting friction; apply the canonical formatter
  and verify the baseline still contains zero findings before publication.
- **Owner:** Knip baseline serialization and generator post-formatting.

## 2026-08-30 — Exploration Atlas check exits silently until an idempotent rewrite

- **What happened:** cheap-gates reported the exploration Atlas check as failed
  without a diagnostic. Running the canonical writer changed no tracked file,
  but the immediately repeated check passed, so there was no reviewable
  projection drift explaining the initial nonzero exit.
- **Evidence:** `bun run beep explore atlas --check` inside cheap-gates exited 1
  with no command output; `bun run beep explore atlas --write` then reported it
  wrote `explorations/ATLAS.md` and README status projections, `git status`
  showed neither file changed, and the next `--check` reported the projections
  current.
- **What would have prevented it:** make check mode compare normalized content
  independently of output mtimes and always print the path and mismatch class
  that caused a nonzero exit; if freshness is intentional, label it separately
  from projection drift.
- **Disposition:** transient projection-check and diagnostic friction; retain no
  projection diff, rerun the check after the final ledger edit, and publish only
  if it remains green.
- **Owner:** exploration projection check determinism and failure diagnostics.

## 2026-08-30 — Full coverage writer updates the PR file but hosted ratchet still compares the old floor

- **What happened:** after Yeet prescribed the whole-repository coverage writer,
  the generated PR diff lowered the changed `Local.ts` row to the locally
  measured values. The next exact-head hosted coverage lane nevertheless
  compared the same measurements with higher floors and failed after more than
  fifteen minutes. Its failure message then prescribed the package-scoped
  writer and explicitly warned never to use the whole-repository writer for a
  per-package drop.
- **Evidence:** commit `906d93ff3c` contains
  `standards/coverage.regression-baseline.jsonc` values `66.99` lines, `67.81`
  statements, and `51.3` branches for
  `packages/tooling/tool/cli/src/commands/Docgen/internal/Local.ts`; PR #906
  Actions job `99312429138` measured those exact values but failed them against
  `68.27`, `68.85`, and `51.35`, then printed `bun run coverage --
  --filter=@beep/repo-cli --write-baseline` and “never run bun run
  coverage:baseline:write for a per-package drop.”
- **What would have prevented it:** make Yeet's staleness repair render the same
  package-scoped command as the hosted ratchet, and explain whether CI
  intentionally ignores PR-authored lower floors until an explicit reviewer
  acceptance marker is present. A baseline writer should also verify that its
  output is the floor the hosted merge-ref lane will actually consume.
- **Disposition:** actionable coverage-acceptance mismatch; inspect the ratchet's
  base-versus-head policy before changing another floor, then prefer restoring
  focused test coverage if lower-floor acceptance is intentionally prohibited.
- **Owner:** coverage baseline writer, ratchet comparison policy, and Yeet
  remediation consistency.

## 2026-08-30 — Temp-repository test harness exposes an unavailable console accessor as an invalid Effect

- **What happened:** the focused coverage-restoration test used the common
  `withTempRepo` fixture and then attempted to inspect `TestConsole.logLines`.
  The production effect completed both canonical and non-canonical aggregation
  paths, but the test failed afterward with an opaque Effect runtime error
  because that fixture does not install the test-console layer.
- **Evidence:** `bunx vitest run packages/tooling/tool/cli/test/docgen.test.ts`
  printed both expected `docgen:local` messages, then failed only the new test
  with `Unknown Error: Fiber.runLoop: Not a valid effect: undefined` at the
  `TestConsole.logLines` read; the neighboring `withTempRepoCommand` fixture is
  the variant that provides captured command-console state.
- **What would have prevented it:** encode the console capability in the
  fixture's environment type or expose a deliberately named capture fixture so
  an unavailable accessor fails at typecheck time instead of becoming
  `yield* undefined` at runtime.
- **Disposition:** test-harness friction; assert the observable aggregate count
  and filesystem outputs under `withTempRepo`, leaving console-capture behavior
  to command-harness tests.
- **Owner:** Repo CLI test fixture capability typing and naming.

## 2026-08-30 — In-progress Actions job logs can return BlobNotFound while the runner is active

- **What happened:** while the final required Lint job remained live, an
  attempt to inspect its partial log for progress failed even though the Jobs
  API still reported the verification step as `in_progress`.
- **Evidence:** `gh api --allow-escape-sequences
  repos/beep-effect/beep-effect/actions/jobs/99317444130/logs` returned HTTP 404
  with Azure storage error `BlobNotFound`; the same job's metadata reported
  `status: in_progress` and active step `Run verification lane` for PR #906.
- **What would have prevented it:** expose streaming in-progress logs through a
  stable endpoint, or have the monitor surface the current Actions step plus a
  clear “partial logs unavailable” state instead of requiring a separate
  download probe.
- **Disposition:** hosted observability friction only; retain the attached
  required-check watcher and wait for the terminal job result.
- **Owner:** Actions log availability and Yeet hosted-progress diagnostics.

## 2026-08-30 — Goal-ledger validation commands are not self-discovering at file scope

- **What happened:** validating the final one-file ledger change hit two local
  command-contract failures: the formatter accepted the path but processed no
  files, and a previously used goal-index command was not a registered Bun
  script in this checkout.
- **Evidence:** `bunx biome check
  goals/packet-convention-migration/research/OPPORTUNITIES.md` exited 1 with
  `No files were processed` and listed the Markdown path as ignored;
  `bun run repo-cli goals index --check` exited 1 with
  `error: Script not found "repo-cli"`. `git diff --check` and
  `bun run beep explore atlas --check` both passed for the same change.
- **What would have prevented it:** document one canonical goal-packet
  validation command that covers Markdown formatting, packet projections, and
  goal indexing, and make invalid legacy aliases print the supported `beep`
  equivalent.
- **Disposition:** validation-discovery friction; use the live root script and
  CLI help to find the supported goal-index route, while treating ignored
  Markdown as outside Biome's configured scope.
- **Owner:** goal tooling command discoverability and Markdown validation scope.

## 2026-08-30 — Bunx Markdown lint resolves to an unconfigured mise shim

- **What happened:** after Biome correctly reported goal Markdown outside its
  scope, the direct Markdown-lint fallback did not launch the package tool; it
  was intercepted by a host shim that had no selected version.
- **Evidence:** `bunx markdownlint-cli2
  goals/packet-convention-migration/research/OPPORTUNITIES.md` exited 1 with
  `mise ERROR No version is set for shim: markdownlint-cli2` and suggested a
  global installation. No installation was attempted.
- **What would have prevented it:** provide a repository-owned Markdown lint
  script with a pinned dependency and documented path filtering, so validation
  does not depend on host shim precedence or a mutable global toolchain.
- **Disposition:** host-tool routing friction; rely on the repository's
  successful diff, goal-index, Atlas, and CI lint gates instead of changing the
  operator's global environment during closeout.
- **Owner:** repository Markdown lint entrypoint and Bunx/mise shim precedence.
