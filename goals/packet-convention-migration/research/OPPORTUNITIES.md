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
