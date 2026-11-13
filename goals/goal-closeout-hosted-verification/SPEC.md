# Goal Closeout Hosted Verification Spec

## Objective

Verify goal completion from hosted GitHub facts after the merge, close goals in one PR, and stop goals-only finals from running unrelated coverage

## Non-Goals

- The coverage planner change (D-cov). It ships as its own PR (PR B) from
  lane `final-check-coverage-scope`; this packet only lists it as a
  supporting PR.
- Any merger guard, merger trace or merger identity read (D-hand).
- A hosted `goals doctor --online` job, any new workflow, new workflow
  permissions or a new token route. The `goals:doctor` lane stays offline;
  the automatic trigger is `yeet sweep --retire` (`research/design-pr-a.md`
  DN-14).
- Writing into archived tombstones (beep-effect-web-alchemy,
  literal-kit-subset-algebra): they get receipt-only verification (DN-23).
- Editing the 38 manifests' declared `yeet-verdict` refs, or re-keying the
  completion declaration digest (DN-9, DN-10).
- Changing `grandfathered` semantics, or the launchers of completed,
  reference or superseded packets.
- Changing the Codex packet launcher generators (`Codex/Findings.packet.ts`,
  `Codex/Security.packet.ts`).
- Changes to `@beep/github`, `apps/labs/lane-cockpit` or any package other
  than `@beep/repo-cli`.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

PR A (rulings D-after, D-hosted, D-red, D-exit, D-done, D-onepr, D-mig;
design: `research/design-pr-a.md`):

- `packages/tooling/tool/cli/src/commands/Goals/`:
  - schemas: `Goals.schemas.ts`, `Decisions.schemas.ts`,
    `CompletionEvidence.schemas.ts`
  - services: `CompletionEvidence.service.ts` (type-only), new
    `RedAttribution.ts`, new `FinalPullRequest.ts`, new `CloseoutCheck.ts`
  - implementation: `CompletionEvidence.ts` (including
    `GoalCompletionIoLive`), `Completion.ts`, `SetStatus.ts`, `Doctor.ts`,
    `Decisions.ts`, `Decisions.projection.ts`, `Bootstrap.ts`,
    `Bootstrap.schemas.ts`, `Graph.ts`, `Graph.projection.ts`,
    `PortfolioIndex.ts`, `ArchiveExecution.service.ts`
- `packages/tooling/tool/cli/src/commands/Session/Session.command.ts` and
  `packages/tooling/tool/cli/src/commands/Lint/ReflectionArtifact.ts`.
- The `yeet sweep --retire` closeout trigger:
  `packages/tooling/tool/cli/src/commands/Yeet/internal/Retire.ts`,
  `Porcelain.ts` and `Retire.schemas.ts`.
- The matching tests under `packages/tooling/tool/cli/test/` (new:
  `goals-red-attribution`, `goals-set-status-closeout`,
  `goals-final-pull-request`, `goals-closeout-check`), the fixture port
  `test/support/CompletionIo.ts` and the three
  `test/fixtures/goals-plan/bootstrap-*.json` goldens.
- `standards/schema-catalog/@beep/repo-cli.generated.jsonc` (regenerated),
  `standards/policy-tools.fingerprint.json` and the goals-doctor and
  knowledge `lint:policy-fingerprint` inputs in `turbo.json` (resealed), and
  `packages/tooling/tool/cli/vitest.config.ts` (the suites that change the
  working directory run isolated).
- Prose: `AGENTS.md` (closeout bullet), `.claude/skills/closeout/SKILL.md`,
  `.claude/skills/reflect/SKILL.md`,
  `.claude/skills/yeet/references/sweep-retire.md`, `goals/README.md`,
  `goals/_template/GOAL.md`, `goals/_template/PLAN.md`.
- Migration: the `ops/manifest.json`, `README.md` and new `decisions/` files
  of the nine non-archived migration packets (`research/map-migration.md`),
  plus any in-window committed closeout that `goals doctor --online` reports
  (`research/design-pr-a.md` §5).
- `GOAL.md` of every packet that is `active` or `paused` after the migration,
  the Bootstrap closeout checklist step in their `PLAN.md`, and any other
  live root prose of theirs that still prescribes `proposedCloseout` or a
  separate adoption PR (generated blocks, `decisions/`, `history/`,
  `research/` and `data/` excluded; `research/design-pr-a.md` S11).
- This packet's own files.

PR B (D-cov; design: `research/design-pr-b.md`, calls C1-C3 confirmed in
`decisions/2026-11-13-pr-b-coverage-planner-rulings.md`):
`Quality/internal/CoverageScope.ts`, `Quality/Tasks.ts`,
`Yeet/internal/FinalCheck.ts`, their tests (new
`coverage-scope-goal-readers.test.ts`, `goal-data-consumer-census.test.ts`,
`quality-tasks.test.ts`, `yeet-final-check.test.ts`) and the yeet skill's
gates reference.

## Constraints

- Design order is schema, then `Context.Service` contract, then
  implementation. Effect v4 APIs only, checked against `.repos/effect`.
  Literal domains use `LiteralKit` (with `.pick`). Collections use
  `effect/HashMap` and `effect/HashSet`. Every generator function uses
  `Effect.fn` or `Effect.fnUntraced`. Memoization uses `effect/Cache`
  `makeWith` with a zero time-to-live for failures (no
  `Effect.cachedFunction` in Effect 4.1.4). Live layers sit in the
  implementation module, never as statics on a type-only service file.
- Completion gates only on hosted facts: merged; every required context
  green at the merged head, or a red attributed in a committed `decisions/`
  file; no outstanding review thread. A failed read is `unknown`, never
  green.
- Attribution and ruling claims count only when committed to `origin/main`
  or to the checkout's `HEAD`; working-tree-only claims print a preview and
  never write a verified receipt (DN-6).
- Online, only settled failures block (`unsatisfied`, structural unknowns, a
  final closed without merging); transient read failures and still-running
  required checks stay advisory (DN-13).
- Stored receipts stay readable. The declaration digest keeps its inputs and
  its `proposedCloseout` label, so the 26 committed closeouts keep matching
  receipts. v1 receipts decode and follow DN-8. Receipts, observations and
  the evaluator input carry attributions in one field, `redAttributions`.
- Decision frontmatter keeps decoding with `onExcessProperty: "error"`. The
  new keys land in the schema before any packet uses them.
- `proposedCloseout` leaves the schema only after the batch migration has
  converted all eight proposals in the same PR. No manifest may still carry
  the key.
- Every touched `GOAL.md` stays at or under 4000 characters by doctor's
  measure (`Str.length`). Completed packets' launchers are not touched.
- `AGENTS.md` is in the prompt-cache prefix: one batched edit.
- No heavy local suites above the load cap. The orchestrator publishes PR A
  with `yeet open`, then runs a scoped local `yeet final-check
  --skip coverage=<reason>` on the content-final head and names the skip in
  the PR body; hosted CI proves coverage (DN-27).
- Step agents never commit, push or publish; each step ends green on its own
  package-scoped tests plus `bun run check`.
- No changeset: `@beep/repo-cli` is changeset-ignored
  (`.changeset/config.json:13`).
- Archived tombstones get receipt-only verification: no manifest, README,
  `decisions/` or SPEC.md writes (DN-23).
- The migration census and the GOAL.md and PLAN.md rewrite are idempotent
  and run again after the last `origin/main` merge, before final-check.

## Acceptance Criteria

- [ ] `goals completion refresh` has no `--readiness-job` flag and does not
      read `.beep/yeet/runs/*/verdict.json`. A final with no local verdict
      verifies from hosted facts alone.
- [ ] A required check that was pending or not yet started at the merge
      counts by the newest run on the merged head. A failed rule-suite
      evaluation with every required context green verifies, and the
      receipt records `ruleSuiteBypassed`.
- [ ] Review threads are a gating hosted fact (`hosted-review-threads`):
      0 outstanding verifies, any outstanding is unsatisfied, a failed read
      is unknown.
- [ ] A red required check (or a required context that never reported a
      run) verifies only when a valid, committed `redAttribution` block in
      the packet's `decisions/` names its context, cause and an existing
      open or merged fix PR. The attribution survives stored-receipt
      re-resolution. Conflicting claims never attribute, and a
      working-tree-only claim never writes a verified receipt.
- [ ] `goals set-status <slug> completed-retained` writes `closeout` naming
      the branch's open PR (or `--final-pr`, or a legacy proposal's final)
      and marks it `final`. A MERGED `--final-pr` binds only with
      `--adopt-merged`. It refuses when no final can be resolved, and when
      the branch's PR would replace a different final that already merged.
      `goals set-status` no longer reads completion receipts.
- [ ] `goals doctor --online` reports as the blocking `closeout-unverified #N`
      a committed closeout whose final merged within 28 days and is
      unsatisfied or structurally unknown, or whose final closed without
      merging. Transient read failures and still-running required checks
      stay advisory. It reports nothing for an open final, and a note for
      an `operatorRuling` or an older final. Offline mode never blocks.
      `closeout-adoption-pending` no longer exists, and a raw
      `proposedCloseout` key is a blocking `manifest-invalid`.
- [ ] `yeet sweep --retire` classifies every touched packet with a committed
      closeout on `origin/main`; a blocking outcome leaves a P0 inbox row in
      the owning clone, and a later verified refresh clears it.
- [ ] The Bootstrap launcher and `goals/_template/GOAL.md` carry the
      three-exit done paragraph (`research/design-pr-a.md` §4.1), and so does
      every `active` or `paused` GOAL.md. Their PLAN.md closeout checklists
      carry the one-PR step 3 (§4.2), and no live root prose of an active or
      paused packet still prescribes `proposedCloseout`. AGENTS.md, the
      closeout and reflect skills, and `goals/README.md` describe the one-PR
      route.
- [ ] The nine non-archived migration packets are each verified and
      adopted, or the reason is recorded in `history/migration-<date>.md`;
      the two archived tombstones get receipt-only refreshes and are listed
      there. No manifest contains `proposedCloseout`, and
      `GoalProposedCloseout` is gone from the schema.
- [ ] This packet closes by the new route: PR A names itself in `closeout`,
      refresh prints plain `verified` after the merge, `goals doctor
      --online` shows no `closeout-unverified`, and the `origin/main` jq
      check passes.
- [ ] PR B (D-cov) has merged and is listed as `supporting`.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/goal-closeout-hosted-verification/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/goal-closeout-hosted-verification/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/goal-closeout-hosted-verification` | Passes |
| Completion and evidence tests | `cd packages/tooling/tool/cli && bunx --bun vitest run test/goals-completion.test.ts test/goals-completion-observation.test.ts test/goals-completion-evidence.test.ts test/goals-completion-kit.test.ts test/goals-completion-receipt-store.test.ts` | Passes |
| Writer, doctor and reader tests | `cd packages/tooling/tool/cli && bunx --bun vitest run test/goals-set-status-stream.test.ts test/goals-set-status-closeout.test.ts test/goals-final-pull-request.test.ts test/goals-closeout-check.test.ts test/goals-doctor.test.ts test/goals-graph.test.ts test/session-ledger.test.ts test/goals-command.test.ts test/reflection-lint.test.ts test/goals-decisions.test.ts test/goals-red-attribution.test.ts` | Passes |
| Sweep trigger tests | `cd packages/tooling/tool/cli && bunx --bun vitest run test/yeet-sweep-retire.test.ts test/yeet-sweep-schemas.test.ts` | Passes |
| Template goldens | `cd packages/tooling/tool/cli && bunx --bun vitest run test/goals-bootstrap-plan.test.ts` (after a reviewed `REGEN_GOLDENS=1` run) | Passes |
| Package proof | `bun run beep quality package-verify @beep/repo-cli` | Passes |
| Schema catalog | `bun run beep lint schema-catalog` | Passes |
| Doctor offline | `bun run beep goals doctor` | `blocking_new=0`, no `goal-md-oversize` |
| Doctor online | `bun run beep goals doctor --online` (after the migration) | 0 introduced blocking findings |
| Proposal census | `jq -e 'has("proposedCloseout")' goals/*/ops/manifest.json` | No `true` |
| Reflection | `bun run beep lint reflection-artifacts` | Passes |
| Own completion | `bun run beep goals completion refresh --slug goal-closeout-hosted-verification` (after merge, from a checkout at `origin/main`) | Prints plain `verified` |
| Done | `git show origin/main:goals/goal-closeout-hosted-verification/ops/manifest.json \| jq -e '.closeout.status == .initiative.status'` | Passes, together with the Own completion row (DN-20) |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add goal-closeout-hosted-verification --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug goal-closeout-hosted-verification`; add a `kind: decision` file there, never edit this block._

### A coverage skip decides before the noop shortcut, 2026-11-13

An operator `--skip coverage=<reason>`, a compute-profile deferral and a route skip, which is everything `skipFor` returns, are evaluated before the in-process coverage probe. The probe runs only when `skipFor(run, "coverage")` is None. A skipped coverage gate therefore stays `skipped` with its own reason in the receipt and in the PR-body naming rule, and never turns into a `passed` noop.

Lane fix/final-check-coverage-goal-readers

Reverse: Evaluate the noop arm before skipFor in runGate and printGatePlan, and probe whenever the coverage gate is requested.

### A final merged over a red required check verifies with attributed reds, 2026-11-13

Operator ruling 2026-11-12. Refresh verifies a final whose merged head has a red required check when every red is named in a decision file under the packet's `decisions/` with its attribution and its fix PR. The receipt lists the reds.

Lane feat/goal-closeout-hosted-verification

Reverse: Refuse red finals again and require a goals-only re-final PR.

### Batch migration, then proposedCloseout leaves the schema, 2026-11-13

Operator ruling 2026-11-12. The change PR re-runs hosted-only refresh over the 8 packets carrying `proposedCloseout` and the 9 at `completion-gate-unknown`. Proposals whose final has merged and verifies are adopted in that PR; unknowns that verify flip to verified. `proposedCloseout` is then removed from the schema; a proposal whose final has not merged is rewritten to the new shape.

Lane feat/goal-closeout-hosted-verification

Reverse: Revert the migration commit and restore the proposedCloseout field in Goals.schemas.ts.

### set-status binds the final PR; a merged PR needs --adopt-merged, 2026-11-13

Agent decision (`research/design-pr-a.md` DN-17, DN-18). DN-17 is amended by orchestrator ruling 2026-11-12.

`goals set-status <slug> completed-retained [--final-pr N [--adopt-merged]]` is the only writer of `closeout`. It picks the final in this order:

1. A raw `proposedCloseout` key's own final, read from the raw manifest JSON so that it still works after the field leaves the schema. A conflicting `--final-pr` is refused.
2. `--final-pr N`: an OPEN PR binds. A MERGED PR binds only with `--adopt-merged`. A CLOSED PR is refused.
3. The checked-out branch's OPEN PR, from `gh pr view`.

Rules (2, OPEN) and (3) refuse when `completionGate.pullRequests` already names a different `final` that has merged, and they print the `--final-pr M --adopt-merged` form. Without a final, the command refuses: "publish first, then rerun". Any other `final` ref is demoted to `supporting`. A grandfathered packet gets a status-only flip. `--adopt-merged` without `--final-pr` is refused. `set-status` no longer reads completion receipts, and `adoptVerifiedCloseout` is deleted.

Once `proposedCloseout` is removed (S10), a raw `proposedCloseout` key in any manifest is a blocking doctor `manifest-invalid` finding that names `bun run beep goals set-status <slug> completed-retained` as the fix.

DN-18: reopening a committed closeout (to `active` or `paused`) deletes `closeout` and demotes its final ref to `supporting`.

Why: this closes the status-only bypass that #2985 and #3132 used. It also stops a later PR from closing a goal by naming an old merged PR, and stops a goals-only follow-up from becoming the final over a work PR that has already merged.

Reverse: restore `adoptVerifiedCloseout` and the status-only path, accept MERGED without the flag, and delete the reopened final ref instead of demoting it.

Lane feat/goal-closeout-hosted-verification

Reverse: Restore adoptVerifiedCloseout and the status-only path, accept MERGED without the flag, and delete reopened final refs.

### Closeout check, views and doctor: window constant, live checker requirements and notes, 2026-11-13

Agent decision taken while implementing S6 of `research/design-pr-a.md` (sections 1.7, 1.8, 2.6, 2.7; DN-13, DN-19).

- The 28-day window lives in `Completion.ts` as `GOAL_CLOSEOUT_WINDOW_DAYS` with the predicate `goalFinalWithinCloseoutWindow`, not in `CloseoutCheck.ts`. The DN-19 session filter in `readGoalCloseoutViews` needs it, and `CloseoutCheck.ts` imports `Completion.ts`, so defining it there would be an import cycle. `CloseoutCheck.ts`, the doctor's legacy pre-check and the session filter all read the one constant.
- `GoalCloseoutCheckerLive` also requires `Digest`: the observation and the stored-receipt read both digest the declaration. The live checker captures its build context and one memoized completion port, so `check` keeps an empty requirement channel.
- `GoalCloseoutCheck.reasons` carries the advisory notes as well as the reasons: an attribution conflict, an attribution naming a context that was neither red nor missing, and a verified `goal-completion-receipt/v1` row. Doctor prints them as notes for the non-blocking outcomes and inside the finding for `transient` and `unverified`.
- Classification follows the section 2.7 order literally: a final closed without merging is `unverified` before the operator-ruling step, so a ruling does not turn it into a note.
- `goalCloseoutView` is now pure (`dual`, no Effect), and `withGoalCompletionIo` is exported from `Completion.ts` so doctor provides one memoized port per online run without `Effect.provide(Layer)`.
- The `phases-terminal-but-active` exemption for proposals goes with the other proposal clauses (DR:816). Until S9 migrates them, an active proposal packet whose phases are all complete reports that blocking finding.

Reverse: move the window constant into `CloseoutCheck.ts` behind a shared leaf module, drop `Digest` from the live checker by passing the declaration digest in, move the notes to a separate `notes` field, let an operator ruling cover a closed-unmerged final, and restore the DR:816 proposal exemption.

Lane feat/goal-closeout-hosted-verification

Reverse: Move the window constant into CloseoutCheck.ts behind a shared leaf, pass the declaration digest into the live checker, split notes from reasons, let a ruling cover a closed-unmerged final, and restore the proposal phase exemption.

### Closeout is one PR and goals doctor blocks on an unverified closeout, 2026-11-13

Operator ruling 2026-11-12. The final PR writes `closeout` directly and names itself as the final PR. After it merges, `goals doctor` verifies from hosted facts and reports an unverified closeout as a blocking finding rather than an advisory. An unmerged final is not a finding.

Lane feat/goal-closeout-hosted-verification

Reverse: Reintroduce proposedCloseout and the packet-state adoption PR; downgrade the doctor finding to advisory.

### Closeout views keep their version tags; the launcher rewrite trims prose and covers PLAN.md checklists, 2026-11-13

Agent decision (`research/design-pr-a.md` DN-19, DN-21), with critic fixes applied.

- DN-19: `session-open/v1` and `goal-explain/v1` keep their version tags while `GoalCloseoutView` is rekeyed on `closeout`. lane-cockpit decodes the session envelope and ignores `goalCloseouts`; nothing else decodes the view. `readGoalCloseoutViews`, used by `session open` and the SessionStart hook, lists only closeouts whose stored receipt is not verified, or whose final merged in the last 28 days. `goals explain` keeps its single-packet view unfiltered. Unfiltered, the session view would print a line and read the receipt store for every committed closeout. The `closeoutChecks` key added to `yeet-retire-sweep-report/v2` follows the same rule.
- DN-21: the GOAL.md rewrite also trims unrelated prose in launchers that overflow 4000 characters, including the T762 "Stop and report before changing public API" paragraph, which contradicts Autonomy. The same pass rewrites the Bootstrap closeout checklist's step 3 in every active or paused PLAN.md (26 verbatim copies at base) to the one-PR text. It also hand-edits the other live root prose of those packets that still prescribes `proposedCloseout` or a separate adoption PR (4 PLAN.md, 4 SPEC.md and 2 other files at base). After S10 a raw `proposedCloseout` key is a blocking `manifest-invalid`, so an agent that followed the old step 3 would turn its own packet red. Generated blocks, `decisions/`, `history/`, `research/`, `data/` and completed or superseded packets keep their bytes, judged by their status on `origin/main` after each merge of it, not at base: a packet `main` closes while PR A is open keeps `main`'s bytes. One exception to S11's prose-only scope: `completionGate.statement` in the two paused turborepo manifests (turborepo-cache-trust-observability, turborepo-quality-cache-adoption) prescribed `proposedCloseout` and a separate adoption PR, and the census flagged both, so they now name the one-PR route; neither packet has a closeout receipt, so the digest change costs nothing. `goals/_template/` and `goals/README.md` ride the same PR. The Codex packet generators do not change. The rewrite script is idempotent and runs again after the last `origin/main` merge, before final-check.

Reverse: bump both tags to v2 and update lane-cockpit, list every closeout again, restore the trimmed prose, and restore the old PLAN.md step 3 text.

Lane feat/goal-closeout-hosted-verification

Reverse: Bump session-open and goal-explain to v2 and update lane-cockpit, list every closeout, restore the trimmed prose and the old PLAN.md step 3 text.

### Attribution and ruling claims count only when committed, 2026-11-13

Agent decision DN-6 (`research/design-pr-a.md`), amended by orchestrator ruling 2026-11-12.

A `redAttribution` or `operatorRuling` claim counts only when its decision file is committed. Committed means present in `origin/main`'s tree, or in the checkout's `HEAD` commit, which is the head of the PR that carries it. A file that exists only in the working tree is shown as a preview (`would verify once committed: <files>`). It never contributes to a stored receipt, to `goals doctor`, or to the `yeet sweep --retire` check.

Each claim carries its `source` (`origin-main`, `head` or `working-tree`). When a counted claim exists only at `HEAD`, refresh prints `verified (claims at HEAD only: <files>; not done until they merge)`. The receipt, the observation and the evaluator input all carry a single field, `redAttributions`, that holds the committed claims. Stored rows therefore re-resolve without the files, and attributed reds survive re-resolution.

Why: a working-tree claim would otherwise write a sticky verified receipt into the store that every clone shares. That receipt would satisfy the done exit without the attribution ever reaching `main`. Counting the PR head lets a decisions-only PR, or PR A's own migration, verify inside its lane. The online checks that run from `main` ignore claims that have not merged.

Reverse: count working-tree claims again and drop the `source` field.

Lane feat/goal-closeout-hosted-verification

Reverse: Count working-tree claims again and drop the claim source field.

### Completion core: unreadable fix PRs, missing fix PRs and v1 rows in lifecycle, 2026-11-13

Agent decision taken while implementing S4 of `research/design-pr-a.md` (DN-5, DN-8).

- DN-5, unreadable fix PR: a committed claim whose fix PR cannot be read is counted whenever it decides something: without it the verdict is not verified, and with it the verdict differs without becoming unsatisfied. That covers a claim that clears a red and a claim that covers a required context that never reported a run (DN-4 `missing`); counting only the first left a missing context structural, so one failed read made `goals doctor --online` block and the sweep raise a P0 row (review finding, 2026-11-13). The observation then adds a gating `hosted-required-checks` check with ref `fix-pull-requests`, outcome `unknown` and detail `fix PR #n unreadable`, and the receipt's `redAttributions` carries the claim. A stored row therefore re-resolves to the same transient unknown, and `goalCompletionUnknownReasons` names it. Keeping the claim out entirely, as the design words it, would make the outcome `unsatisfied` (a known red wins over gaps), which contradicts DN-5's 'a failed read makes the outcome unknown'. When the unreadable claim changes nothing, it stays out and the hosted detail names it.
- DN-5, missing fix PR: the completion port reports a 404 and a network failure as the same `YeetCommandError`, so a missing fix PR reads as unreadable (transient unknown), not as dropped. A fix PR closed without merging is dropped and named in the hosted detail.
- DN-8 in lifecycle: `projectGoalLifecycle` takes a verified v1 row as stored, as `storedGoalCompletion` returns it, instead of re-resolving it under the hosted-only rules. It goes in S6.

Reverse: drop the `fix-pull-requests` check and keep unreadable claims out, decode a missing PR as dropped once the port tells a 404 apart, and re-resolve v1 rows in `projectGoalLifecycle`.

Lane feat/goal-closeout-hosted-verification

Reverse: Drop the fix-pull-requests check and keep unreadable claims out, decode a missing PR as dropped once the port can tell 404 apart, and re-resolve v1 rows in projectGoalLifecycle.

### Completion evidence is hosted facts only, 2026-11-13

Operator ruling 2026-11-12. A final verifies from GitHub alone: the PR is merged, every required check at the merged head succeeded, and no review thread is outstanding. The local `.beep/yeet/runs/<branch>/verdict.json` is advisory. Known limit: GitHub lists rule suites for one month, so an older final can stay unknown and needs the operator-ruling exit.

Lane feat/goal-closeout-hosted-verification

Reverse: Make the yeet-verdict acceptanceEvidence ref gating again in closeoutGateAdmits.

### Completion verifies after the merge, without the pre-merge job timing rule, 2026-11-13

Operator ruling 2026-11-12. `goals completion refresh` re-derives readiness from the merged head at any later time. A readiness job that had not finished before the merge no longer makes a final unverifiable.

Lane feat/goal-closeout-hosted-verification

Reverse: Restore the readiness-job timing check in Goals/Completion.ts readinessRecoveryRefusal.

### Done adds a verified conjunct, amending the done-means-closeout-adopted ruling, 2026-11-13

Agent decision DN-20 (`research/design-pr-a.md`), confirmed by orchestrator ruling 2026-11-12.

This decision amends the operator ruling "Done means closeout adopted on main, in the template and every active packet" (decisions/2026-11-13-done-means-closeout-adopted-on-main-in-the-template-and-every-active-packet.md). That ruling made the done condition the AGENTS.md one: `origin/main`'s manifest has `closeout.status == initiative.status`. This decision adds a verified conjunct to that condition and rewrites the AGENTS.md sentence it pointed to.

The launcher's done paragraph now has three exits:

1. The jq check passes and `goals completion refresh --slug <slug>` prints verified.
2. The jq check passes under an operator ruling recorded in `decisions/` (`operatorRuling`).
3. An operator blocker is reported with evidence.

The same text goes into the Bootstrap template, `goals/_template/GOAL.md`, every active or paused GOAL.md, and the AGENTS.md closeout bullet.

Why: with one-PR closeout the jq check is true as soon as the final merges, so on its own it cannot tell a verified final from an unverified one.

Reverse: restore the jq-only done condition in Bootstrap, `goals/_template`, every rewritten GOAL.md and AGENTS.md, and rely on the `closeout-unverified` finding alone.

Lane feat/goal-closeout-hosted-verification

Reverse: Restore the jq-only done condition in Bootstrap, goals/_template, every rewritten GOAL.md and AGENTS.md.

### Done means closeout adopted on main, in the template and every active packet, 2026-11-13

Operator ruling 2026-11-12. The launcher's done condition becomes the AGENTS.md one: `origin/main`'s manifest has `closeout.status == initiative.status`. The same text is rewritten into GOAL.md of every active or paused packet. Completed packets are untouched.

Lane feat/goal-closeout-hosted-verification

Reverse: Restore the previous done sentence in the template and the rewritten GOAL.md files.

### final-check coverage runs only packages whose tests read goals/, 2026-11-13

Operator ruling 2026-11-12. On a diff confined to goal-packet files, the coverage gate runs only the packages whose tests read `goals/`. With none affected it records 'no affected packages' and passes. Evidence: coverage ran 46 minutes on #3101, a goals-only diff. Ships as its own PR from lane final-check-coverage-scope.

Lane feat/goal-closeout-hosted-verification

Reverse: Restore the previous affected-set computation for goals/ paths.

### final-check records a passed coverage step with reason no affected packages on a noop plan, 2026-11-13

final-check plans coverage in-process with `resolveAffectedCoverageScope(repoRoot, mergeBase)`, the function the `coverage --affected` subprocess calls. It never uses its own changed-file list, which drops deletions. On `noop` the coverage step is recorded as `passed` with reason `no affected packages`, duration 0, and nothing spawns; `--dry-run` prints the same plan. The step is passed rather than skipped because `yeet ready` requires skipped gates to be named in the PR body. A failed probe logs and leaves the subprocess to plan for itself.

Lane fix/final-check-coverage-goal-readers

Reverse: Remove coverageScope and the noop arm from FinalCheck.ts; the coverage step spawns bun run coverage --affected again and logs its own noop.

### GOAL.md gains an operator-ruling exit, 2026-11-13

Operator ruling 2026-11-12. The launcher's done conditions add: an operator ruling recorded under `decisions/` with `origin/main` showing `closeout.status == initiative.status`. A Stop-hook evaluator can check it from one file and one jq line.

Lane feat/goal-closeout-hosted-verification

Reverse: Remove the third exit from the launcher template in Goals/Bootstrap.ts.

### Completion gates only on hosted required checks and review threads, read through one memoized live port, 2026-11-13

Agent decision (`research/design-pr-a.md` DN-7, DN-9, DN-12, DN-25). DN-25 is amended by orchestrator ruling 2026-11-12.

- DN-7: review threads are a gating hosted fact, `hosted-review-threads`. They are read at refresh time through `ReviewThread.list` and `outstanding`: 0 outstanding verifies, more than 0 is unsatisfied, and a failed read is a transient unknown.
- DN-9: the local `.beep/yeet/runs/*/verdict.json` is not read; `readLocalEvidence` is deleted. The 38 declared `yeet-verdict` refs stay in their manifests (so their digests do not change) and gate nothing. Only `GoalHostedEvidenceKind` gates.
- DN-12: the accepted-head manifest no longer gates. The `accepted-declaration` sub-claim becomes a non-gating self-naming check.
- DN-25 (ruling): `GoalCompletionIoLive` is exported from `CompletionEvidence.ts`, next to `GoalMergeTimeEvidenceProviderLive`. `CompletionEvidence.service.ts` stays type-only, which avoids a runtime import cycle. One layer per command run memoizes `ruleSuites` with `Cache.makeWith(lookup, { capacity: 64, timeToLive: (exit) => Exit.isSuccess(exit) ? Duration.infinity : Duration.zero })`, keyed by root and ref, so a failed listing is never replayed. Effect 4.1.4 has no `Effect.cachedFunction`. Merges older than 31 days skip the listing and record `rule-suite-unavailable`. Every new adapter gets a live-layer test.

Reverse: drop the `hosted-review-threads` kind, restore a non-gating `readLocalEvidence`, restore the accepted-head digest reason, and go back to one adapter per read.

Lane feat/goal-closeout-hosted-verification

Reverse: Drop hosted-review-threads, restore a non-gating readLocalEvidence and the accepted-head digest reason, and use one adapter per read.

### Migration keeps the proposals' finals; archived tombstones are verified by receipt only, 2026-11-13

Agent decision (`research/design-pr-a.md` DN-22, DN-23). DN-23 is amended by orchestrator ruling 2026-11-12.

- DN-22: hold-ledger keeps #2755 as final and records #2865 as `supporting`. goal-packet-conflict-free-appends keeps #2869 and records #2874 as `supporting`. Under DN-1 and DN-2, #2755 verifies, and these are the finals the proposals name.
- DN-23 (ruling): the archived tombstones beep-effect-web-alchemy (#2583) and literal-kit-subset-algebra (#2080) get receipt-only verification. Refresh writes a workstation receipt, and nothing writes their manifest, README, `decisions/` or SPEC.md. A tombstone that could verify only with an attribution file stays unverified and is listed in `history/migration-<date>.md`; literal-kit-subset-algebra is expected to be one. The reason is that writing into a tombstone breaks the archive contract and leaves the generated stub out of date.

Migration rules: refresh each packet last, after every manifest write for it, because the digest covers `completionGate` and the closeout slot. Attribution files count once the orchestrator commits them (DN-6). The census and the launcher rewrite run again after the last `origin/main` merge. While PR A is open, the orchestrator holds any old-route adoption PR for the 11 migration packets.

Reverse: switch the finals to #2865 and #2874. For the tombstones, write closeout records with `set-status --final-pr N --adopt-merged`, regenerate the stub with `renderTombstoneReadme`, and add `decisions/**` to `TombstoneKeep.goals`.

Lane feat/goal-closeout-hosted-verification

Reverse: Switch the finals to #2865 and #2874; write tombstone closeouts with --adopt-merged and regenerate their stubs.

### Migration takes main's merge-queue-lab closeout (#3169) instead of adopting #3112, 2026-11-13

The §5 table planned to adopt merge-queue-lab's legacy proposal for #3112. Since base `7a462a27d4f`, `main` closed the packet by the old route: #3146 re-finaled it and #3169 committed `closeout` naming #3169 under the operator ruling in `goals/merge-queue-lab/decisions/2026-11-13-operator-ruling-close-in-one-packet-state-pr.md`, with #3112 and #3146 as `supporting`. Adopting #3112 in this lane would bind a superseded final and conflict with `main` on the manifest, README, SPEC.md and PLAN.md.

S9 instead restores `goals/merge-queue-lab/` from `origin/main` (`ae6ab98b3c6`) byte for byte, so the S12 merge of `origin/main` is clean for that packet and the `proposedCloseout` census passes in the lane. Under the hosted-only rules, `goals completion refresh --slug merge-queue-lab` printed `verified` for #3169 (6 green and 9 skipped required contexts plus 0 of 0 threads).

Lane feat/goal-closeout-hosted-verification

Reverse: Run goals set-status merge-queue-lab active, then goals set-status merge-queue-lab completed-retained --final-pr 3112 --adopt-merged, and refresh.

### Online closeout classification blocks only on settled failures, and yeet sweep --retire runs it, 2026-11-13

Agent decision (`research/design-pr-a.md` DN-13, DN-14, DN-15). DN-13 and DN-14 are amended by orchestrator ruling 2026-11-12.

- DN-13 (ruling: the critic's split is accepted): online, every committed closeout is classified by `Goals/CloseoutCheck.ts`. These are blocking `closeout-unverified #N`: a final merged within the last 28 days that is `unsatisfied`, or `unknown` for a structural reason (`rule-suite-unavailable` inside the window, `inventory-mismatch`, `deleted-ruleset-unrecoverable`, `unsupported-rule-source`, or a required context with no run and no claim); and a final closed without merging, at any age. Transient reasons stay advisory as `completion-gate-unknown`: failed GitHub reads, partial ruleset reads, an unobserved inventory, a failed thread or fix-PR read, and a required run that is still `pending`. An open final gets no finding. A final merged more than 28 days ago that does not verify gets a note. Offline mode never blocks.
- DN-14 (ruling): PR A adds no hosted workflow, and the hosted `goals:doctor` lane stays offline. The automatic trigger is `yeet sweep --retire`. After the retirement and the clone sweep (which fetches `origin`), it classifies every packet the merged branch touched whose `origin/main` manifest has a committed closeout. A blocking outcome appends a P0 `local-shard-failed` row (shard `goal-closeout:<slug>#<N>`) to the owning clone's inbox and prints `[yeet] P0 closeout-unverified ...`. A verified outcome clears that row, and so does `goals completion refresh` printing verified in that clone. The exit status stays 0, because the lane is already gone and the documented `... && cd "$CLONE"` recipe must still run.
- DN-15: the operator-ruling exit is machine-readable, as `operatorRuling: { finalPullRequest }` in decision frontmatter. A committed ruling turns `closeout-unverified` for that final into a note that names the file.

Reverse: block on every unverified committed closeout, transient reasons included; drop the sweep hook, add a main-push workflow step that runs `goals doctor --online` under the App identity, or make the sweep exit 1; drop the `operatorRuling` key.

Lane feat/goal-closeout-hosted-verification

Reverse: Block on every unverified committed closeout; drop the sweep hook or add a hosted online job; drop the operatorRuling key.

### Operator hand-merges goal finals; no merger guard, 2026-11-13

Operator ruling 2026-11-12. PRs #2962, #3101 and #3132 were flipped ready and merged by the operator in the GitHub UI within minutes. That is the operator's right. Completion must tolerate it; no guard or trace is built.

Lane feat/goal-closeout-hosted-verification

Reverse: None needed; this records a fact, not a mechanism.

### PR A is this packet's final, ships without a changeset and publishes through yeet open, 2026-11-13

Agent decision (`research/design-pr-a.md` DN-26, DN-27), with the publishing route from orchestrator ruling 2026-11-12.

- DN-26: this packet closes with PR A as its final. PR B (D-cov, lane `final-check-coverage-scope`) merges first and is recorded as `supporting`. The final must be the last PR to merge.
- DN-27: there is no changeset. Only `@beep/repo-cli` changes, and it is changeset-ignored (`.changeset/config.json:13`). `@beep/github` and `@beep/git` are used but not edited.
- Publishing (ruling): the orchestrator publishes PR A, not the step agents. It runs `bun run beep yeet open --body-file <md>`, then a scoped local `bun run beep yeet final-check --skip coverage=<reason>` on the content-final head, with the reason named in the PR body, then `yeet ready` and `yeet monitor`. `yeet ready` needs a passing final-check receipt for the head, and local repo-cli coverage is a 1191.7 s shard under the load cap; hosted CI proves coverage.

Reverse: ship a goals-only re-final after PR B, add a changeset if a later step edits a published package, and run the full local final-check.

Lane feat/goal-closeout-hosted-verification

Reverse: Ship a goals-only re-final after PR B, add a changeset if a published package changes, and run the full local final-check.

### PR B coverage planner: manifests are packet documents and registry paths run their readers, 2026-11-13

Orchestrator ruling 2026-11-12 on PR B (D-cov, `research/design-pr-b.md`). It confirms calls C1, C2 and C3.

- C1: goal manifests and packet-root prose are packet documents, not goal data. `goalDataConsumerNamesForFile` returns `[]` for any path that matches `S.is(CiGoalDocument)`, so a diff that touches only manifests runs no coverage. That includes `goals/citation-extraction-engine/ops/manifest.json`, which a bare registry prefix would otherwise match to `@beep/law-practice-server`. CI behavior changes for mixed PRs: a code PR that also edits a manifest no longer pulls `@beep/repo-cli` into Test Unit, Coverage Regression, the self-judge exclusions or the scoped baseline writes. The repo-cli suites that read manifests (goals-ops-typecheck, goals-manifest-capabilities, the goals-graph census) then first run on the main push, and goals doctor's ops-script and capability checks are the only pre-merge cover. No local-only manifest suite step is added.
- C2: one registry drives the selection. Exploration registry rows and the lab consumers (`@beep/semantica`, `@beep/ciops`) are included, which keeps parity with hosted Labs coverage.
- C3: the cost shift is accepted. Edits to registry paths run their real readers, so every `goals/*/ops/**/*.ts` edit now runs repo-cli coverage.

Root goals files outside the registry (`goals/tsconfig.ops.json`, `goals/*.baseline.jsonc`) stay out of scope. The PR B design's own call records (C4, C5) remain its step 8. This file covers C1 to C3, so the PR B lane does not need separate files for them.

Reverse: restore the manifest row in `CoverageScope.ts` (C1), drop the exploration and lab rows from the selection (C2), and narrow the `goals/*/ops/**/*.ts` row's effect on coverage (C3).

Lane feat/goal-closeout-hosted-verification

Reverse: Restore the manifest row in CoverageScope.ts, drop exploration and lab rows, and narrow the goals ops row's coverage effect.

### Receipt v2 keeps the declaration digest and drops --readiness-job, 2026-11-13

Agent decision (`research/design-pr-a.md` DN-8, DN-10, DN-11).

- DN-8: new receipts are `goal-completion-receipt/v2`, which adds `merged`, `reviewThreads` and `redAttributions`. A stored v1 row that was verified is returned as it was stored. Any other v1 row re-resolves as unknown, with the note "v1 receipt predates hosted-only rules; rerun refresh". The 26 committed closeouts are not re-refreshed in bulk: a v1 row could only verify under the stricter gating readiness, which already counted threads.
- DN-10: `goalCompletionDeclarationDigest` keeps its inputs. `acceptanceEvidence` stays in, and once `proposedCloseout` is removed the `proposedCloseout` label reads `closeout`. A proposal adopted unchanged therefore keeps its digest. An edit to `completionGate.pullRequests` does change it, so the migration refreshes last.
- DN-11: `--readiness-job` is removed outright, with no deprecation release. Packet decision files cite it only as history.

Reverse: require v2 evidence for v1 rows (or re-refresh all of them), re-key receipts in a later PR, and restore the flag.

Lane feat/goal-closeout-hosted-verification

Reverse: Require v2 evidence for v1 rows or re-refresh them all, re-key receipts later, and restore --readiness-job.

### Red attribution: the redAttribution block, its causes, fix PRs and bypass-caused reds, 2026-11-13

Agent decision (`research/design-pr-a.md` DN-4, DN-5, DN-16, DN-24), with critic fixes applied.

- DN-16: a red is attributed in decision frontmatter as `redAttribution: { finalPullRequest, reds: [{ context, attribution, fixPullRequest }] }`, and only on `kind: decision`. Frontmatter decodes with `onExcessProperty: "error"`, so a misspelt key is rejected.
- DN-4: the causes `inherited`, `introduced` and `mixed` all verify; `unknown` cannot attribute. A claim also covers a required context that never reported a run on the head (`checkRunId: None`), recorded with `observed: missing`. Without this, a bypass-merged final with such a context could never verify. A context whose run is still `pending` cannot be attributed.
- DN-5: the fix PR must exist and be open or merged. This takes one `pulls/{n}` read per distinct fix PR. A missing PR, or one closed without merging, leaves its red unattributed; a failed read is a transient unknown.
- DN-24: a red caused by the bypass merge itself counts as `inherited` when main was red for that context at the merge. Its fix PR is then the episode's `unblocks-main` PR. Otherwise the red is `introduced`, and its fix PR is the first later PR in which the same context passed on a tree containing the merge commit.

Conflicting claims for one context never attribute (fail closed). Gaps still win over attributions.

Reverse: delete the `redAttribution` key, narrow the causes to `inherited` and `mixed`, drop `missing` coverage and the fix-PR read, and rewrite the attribution files.

Lane feat/goal-closeout-hosted-verification

Reverse: Delete the redAttribution key, narrow causes to inherited/mixed, drop missing coverage and the fix-PR read, and rewrite the attribution files.

### Required checks bind to the newest run at the merged head; a bypass is not itself a red, 2026-11-13

Agent decision (`research/design-pr-a.md` DN-1, DN-2, DN-3).

- DN-1: `goals completion refresh` binds each required context to the newest run on the accepted head at the time it runs. Both bounds in `goalRequiredCheckFacts` go: started before the merge and completed before the merge. A run still in progress reads as `pending`, which is a transient unknown. Basis: D-after, and D-hand (a final the operator merged while Heavy checks were still running must verify once they finish). #2755 and #2756 show that the started-before bound matters, because Test Unit first ran after the merge. #3132 is not evidence: every required run completed before its merge.
- DN-2: a failed `required_status_checks` evaluation in the merge-push rule suite (a bypass) is not a red by itself. The reds are the required contexts that are not green at the head. The verdict records `ruleSuiteBypassed`. The rule suite still decides which contexts were required.
- DN-3: `skipped` and `neutral` count as success, matching GitHub's own rule-suite evaluation on #3112, #3027 and #3132.

Reverse: restore both `notAfter` bounds, restore the early `unsatisfied` for `activeRed` and `recoveredRed`, and narrow `successful` to `success`.

Lane feat/goal-closeout-hosted-verification

Reverse: Restore both notAfter bounds in goalRequiredCheckFacts, the early unsatisfied for activeRed/recoveredRed, and success-only counting.

### Review fixes: closeout inbox rows follow main and set-status deletes stale proposals, 2026-11-13

Agent decision taken while fixing the PR A review findings (2026-11-13).

- The `yeet sweep --retire` closeout trigger counts only the claims on `origin/main` (`GoalClaimScope` `origin-main`). It speaks for `main`, and the owning clone's `HEAD` can be any branch, so a claim committed only there could verify a closeout and acknowledge its P0 row while `goals doctor --online` from `main` still blocks (DN-6). `goals completion refresh` and `goals doctor --online` keep the checkout scope, so a PR that adds an attribution still verifies in its own lane.
- `goals completion refresh` clears the `goal-closeout:<slug>#<n>` row for an `operatorRuling` on `origin/main` as well as for a plain `verified`, matching the sweep, which already acknowledges `operator-ruling`. A ruling found only at `HEAD` clears nothing.
- Rows for a final the packet no longer binds are acknowledged: by the sweep for every touched packet whose `origin/main` manifest decodes and binds no final or another final, and by a refresh that closes the new final. Without this, the reopen or rebind that the tools themselves prescribe left the old row open in every session. An absent or unparsable manifest on `main` is left alone. One helper, `updateGoalCloseoutShards`, writes both paths.
- `goals set-status` deletes a stale `proposedCloseout` when it keeps a committed closeout, reopens one, or flips a grandfathered gate, and refuses when the stale proposal names another final than the committed closeout. The doctor guard's remediation (`set-status <slug> completed-retained`) therefore works in every state that can carry the key.

Lane feat/goal-closeout-hosted-verification

Reverse: Read HEAD claims in the sweep again, clear refresh rows only on plain verified, stop acknowledging superseded finals' rows, and keep stale proposedCloseout keys in set-status.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
