# Design: PR A, hosted-fact completion and one-PR closeout

Scope: rulings D-after, D-hosted, D-red, D-exit, D-done, D-onepr and D-mig
(`../decisions/2026-11-13-*.md:8`). D-hand needs no mechanism. D-cov ships
separately as PR B from lane `final-check-coverage-scope`
(`design-pr-b.md`).

This file is the single implementation contract for PR A. Revision 2
(2026-11-13) applies every accepted finding of the two critic passes and the
orchestrator rulings of 2026-11-12. §10 maps each finding to the section
that absorbs it, and §10.1 records a step-by-step re-check of the file lists
against the tests that each change breaks. Agent decisions are recorded as decision files in
`../decisions/` (§0 names each file).

Inputs are the five maps in this directory. Line citations are to this
worktree at base `7a462a27d4f` and use the map legends:

| Short | Path |
| --- | --- |
| `C` | `packages/tooling/tool/cli/src/commands/Goals/Completion.ts` |
| `CE` | `packages/tooling/tool/cli/src/commands/Goals/CompletionEvidence.ts` |
| `CES` | `packages/tooling/tool/cli/src/commands/Goals/CompletionEvidence.schemas.ts` |
| `CESv` | `packages/tooling/tool/cli/src/commands/Goals/CompletionEvidence.service.ts` |
| `GS` | `packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts` |
| `DS` | `packages/tooling/tool/cli/src/commands/Goals/Decisions.schemas.ts` |
| `DP` | `packages/tooling/tool/cli/src/commands/Goals/Decisions.projection.ts` |
| `DR` | `packages/tooling/tool/cli/src/commands/Goals/Doctor.ts` |
| `SS` | `packages/tooling/tool/cli/src/commands/Goals/SetStatus.ts` |
| `BS` | `packages/tooling/tool/cli/src/commands/Goals/Bootstrap.ts` |
| `BSS` | `packages/tooling/tool/cli/src/commands/Goals/Bootstrap.schemas.ts` |
| `RE` | `packages/tooling/tool/cli/src/commands/Yeet/internal/Retire.ts` |
| `PO` | `packages/tooling/tool/cli/src/commands/Yeet/internal/Porcelain.ts` |
| `LSP` | `packages/tooling/tool/cli/src/commands/Yeet/internal/LocalShardPoison.ts` |
| `RT` | `packages/drivers/github/src/ReviewThread.ts` |

Test paths are relative to `packages/tooling/tool/cli/test/`.

The per-step test command runs from the package directory,
`cd packages/tooling/tool/cli`. `bun run test` runs `bunx --bun vitest run`,
and `bun run check` runs `tsrs` over `src` and `test`
(`packages/tooling/tool/cli/package.json`, `beep:test` and `beep:check`).
Effect is 4.1.4 (`node_modules/effect/package.json`); every API named here
was checked against `node_modules/effect/dist/*.d.ts`.

---

## 0. Decisions this design takes

The rulings leave these choices open. Rows marked **ruling** were amended by
the orchestrator on 2026-11-12. The last column names the decision file
(`../decisions/2026-11-13-<topic>.md`) that records the row.

| Id | Choice | Why | Reversal | File |
| --- | --- | --- | --- | --- |
| DN-1 | A required check binds to the **newest run on the accepted head when refresh runs**. The started-before-merge bound (`CE:411`) and the completed-before-merge bound (`CE:426`) both go. A run still in progress is `pending` and reads as unknown (transient, §2.7). | D-after: refresh "re-derives readiness from the merged head at any later time", and D-hand: a final the operator merged while Heavy checks still ran must verify once they finish. `CE:411` matters in practice: #2755 and #2756 stay unknown under it, because Test Unit first ran after the merge (`map-migration.md:153-154`). #3132 is **not** evidence for removing `CE:426` (every required run completed before its merge). Whether the hand-merged #2962 and #3101 depended on `CE:426` is unverified; nothing below relies on it. | Restore both `notAfter` bounds in `goalRequiredCheckFacts`. | required-checks-bind |
| DN-2 | A failed `required_status_checks` evaluation in the merge-push rule suite (a bypass) is **not itself a red**. The reds are the required contexts that are not green at the head under DN-1. The verdict records `ruleSuiteBypassed: true`. | D-hosted's test is "every required check at the merged head succeeded". The rule suite stays the source of truth for **which** contexts were required (`CE:645-816`). | Restore the early `unsatisfied` for `activeRed` and `recoveredRed` (`CE:528-529`, `CE:562`). | required-checks-bind |
| DN-3 | `skipped` and `neutral` still count as success (`CE:388-389`). | GitHub's own rule suite counted the seven path-skipped contexts as passing on #3112, #3027 and #3132 (`map-migration.md:163-165`). | Narrow `successful` to `success`. | required-checks-bind |
| DN-4 | A red attributed as `inherited`, `introduced` or `mixed` verifies; `unknown` cannot attribute. A claim also covers a required context that **never reported a run** on the head (`checkRunId: None`, GitHub's "expected"); the fact is recorded with `observed: missing`. A context whose run is still `pending` cannot be attributed. | D-red does not restrict the cause. A bypass merge can leave a required context with no run at all; without `missing` such a final could never verify through D-red. | Narrow `GoalAttributedRedCause` to `inherited` and `mixed`; drop `missing` coverage. | red-attribution |
| DN-5 | The fix PR must exist on GitHub and be open or merged. Refresh makes one `pulls/{n}` read per distinct fix PR, through `GoalCompletionIo.pullRequest`, whose decoder gains `state`. A missing PR, or one closed without merging, leaves its red unattributed. A failed read makes the outcome unknown (transient). | Catches a mistyped number; costs one REST read. | Drop the read and accept any positive integer. | red-attribution |
| DN-6 **ruling** | Claims count only when **committed**: the decision file is in `origin/main`'s tree, or in the checkout's `HEAD` commit (the head of the PR that carries it). A working-tree-only file prints a preview and never counts toward a stored receipt, doctor or sweep. Each claim carries its `source`; refresh prints the sources, and when a counted claim exists only at `HEAD` it prints `verified (claims at HEAD only: <files>; not done until they merge)`. Receipt, observation and evaluator input carry one field, `redAttributions`, holding the committed claims, so stored rows re-resolve without the files. | Critic: a working-tree claim could otherwise write a sticky verified receipt into the store every clone shares. The ruling admits the PR head so a PR that adds an attribution (or PR A's migration) can verify in its own lane. | Count working-tree claims again. | committed-claims |
| DN-7 | Review threads are read when refresh runs, through `ReviewThread.list` and `outstanding` (`RT:647-648`, `RT:820-832`). 0 outstanding is verified, more than 0 is unsatisfied, a failed read is unknown (transient). | GitHub exposes no resolution time (`RT:407-413`). A human comment left after the merge blocks until it is answered, which matches "fix findings where they are found". | Drop the `hosted-review-threads` kind. | hosted-only-gating |
| DN-8 | New receipts are `goal-completion-receipt/v2`, adding `merged`, `reviewThreads` and `redAttributions`. A stored v1 row that was verified is returned as stored (not re-resolved). Any other v1 row re-resolves as `unknown`, and doctor names it "v1 receipt predates hosted-only rules; rerun refresh". The 26 committed closeouts are not mass re-refreshed. | A v1 row could only verify under the stricter gating `yeet-verdict` readiness, which already counted threads (`C:462-466`). Rule suites older than a month cannot be re-read. | Require v2 evidence for v1 rows too, or re-refresh all of them. | receipt-v2 |
| DN-9 | The local verdict is **not read**: `readLocalEvidence` goes (`C:488-551`). The declared `yeet-verdict` refs stay in the 38 manifests and do nothing. Gating applies only to `GoalHostedEvidenceKind`. | "Advisory" in D-hosted only needs it to be non-gating. Leaving the manifests alone keeps their digests (`C:295-302`). | Restore a reduced `readLocalEvidence` that records `gating: false`. | hosted-only-gating |
| DN-10 | `goalCompletionDeclarationDigest` keeps its inputs (`C:292-304`). `acceptanceEvidence` stays in, and the `proposedCloseout` key label reads `closeout` only after S10. | Every stored receipt keeps matching (`C:964`). A proposal adopted unchanged keeps its digest; a `completionGate.pullRequests` edit does change it (§5 rule 1). | Re-key receipts in a later PR. | receipt-v2 |
| DN-11 | `--readiness-job` is removed outright, with no deprecation release. | Packet decision files cite it only as history (`map-completion.md:534-535`). | Restore the flag (`C:1307-1313`). | receipt-v2 |
| DN-12 | The accepted-head manifest stops gating: the "accepted-head declaration digest unobserved" reason goes (`C:184-186`). The `accepted-declaration` sub-claim stays non-gating and becomes a self-naming check: the raw head manifest names #N through `closeout`, a legacy `proposedCloseout`, or a `final` entry in `completionGate.pullRequests`. | D-hosted names exactly three gating facts. This removes the digest trap (`map-completion.md:377-386`). | Restore the reason. | hosted-only-gating |
| DN-13 **ruling** | Online, a committed closeout is classified (§2.7). **Blocking** `closeout-unverified #N`: a final merged in the last 28 days that is `unsatisfied`, or `unknown` for a structural reason; and a final closed without merging, at any age. **Advisory** `completion-gate-unknown`: transient reasons only (failed GitHub reads, partial ruleset reads, a required run still `pending`). An open final gets nothing; a final merged more than 28 days ago and not verified gets a note. Offline never blocks. | DN-13's own rule made a transport failure advisory; the first draft let it block. A closed, unmerged final can never merge, which is not the in-flight case D-onepr exempts. GitHub lists rule suites for one month. | Block on every unverified committed closeout, transient reasons included. | online-classification |
| DN-14 **ruling** | No hosted online job and no new workflow in PR A; the hosted `goals:doctor` lane stays offline (`package.json:426`). The automatic trigger is `yeet sweep --retire`: after the retirement and the clone sweep (which fetches `origin`), it classifies every packet the merged branch touched whose `origin/main` manifest carries a committed `closeout`. A blocking outcome appends a P0 `local-shard-failed` row (shard `goal-closeout:<slug>#<N>`) to the owning clone's inbox and prints `[yeet] P0 closeout-unverified …`. A verified outcome, or `goals completion refresh` printing verified in that clone, clears the row. Transient outcomes print an advisory. The exit status stays 0. | Critic: default doctor is offline and nothing ran `--online`, so the blocking finding was never reached. The sweep already names the packets the branch touched (`RE:577-597`) and runs after every merge. The lane is gone by then, and the documented `… && bun run beep yeet sweep --retire && cd "$CLONE"` recipe must still return the shell to the clone. Reading rule suites needs `administration` permission, which a pull-request `GITHUB_TOKEN` lacks (not verified live). | Drop the sweep hook; or add a main-push workflow step running `goals doctor --online` under the App identity; or make the sweep exit 1. | online-classification |
| DN-15 | The operator-ruling exit can be read by a machine. Decision frontmatter gains `operatorRuling: { finalPullRequest }`. A committed ruling (DN-6) turns `closeout-unverified` for that final into a note naming the file, in doctor and in the sweep. | D-exit: one file plus one jq line, checkable by a Stop hook. | Drop the key and go back to prose-only rulings. | online-classification |
| DN-16 | Red attribution is the frontmatter block `redAttribution: { finalPullRequest, reds: [{ context, attribution, fixPullRequest }] }`. `kind` stays `decision`, so the block also renders in the SPEC log. | `pullRequest` already means the lane PR (`DS:164-167`). Frontmatter decodes with `onExcessProperty: "error"` (`DP:126`), so a misspelt key is rejected. | Delete the key. | red-attribution |
| DN-17 **ruling** | The bind writer is `goals set-status <slug> completed-retained [--final-pr N [--adopt-merged]]`. It picks the final in this order: (1) a raw `proposedCloseout` key's final, read from the raw JSON so it still works after S10, refusing a conflicting `--final-pr`; (2) `--final-pr N`: OPEN binds, MERGED binds only with `--adopt-merged`, CLOSED refuses; (3) the checked-out branch's OPEN PR from `gh pr view` (`Yeet/internal/closeout/GhCollect.ts:390-397`). (2) with an OPEN PR and (3) refuse when `completionGate.pullRequests` already names a different `final` that is MERGED, and name the `--final-pr M --adopt-merged` form. Without a final it refuses with "publish first, then rerun". It demotes any other `final` ref to `supporting`. A grandfathered packet gets a status-only flip. `--adopt-merged` without `--final-pr` is refused. After S10, a raw `proposedCloseout` key is a blocking doctor `manifest-invalid` that names `goals set-status <slug> completed-retained`. | Closes the bypass at `SS:477-482` that #2985 and #3132 relied on (`map-schema-status-doctor.md:279-300`). Critic: an unflagged MERGED `--final-pr` lets any later PR close a goal by naming an old merged PR, and a goals-only follow-up could become the final over a merged work PR. | Restore `adoptVerifiedCloseout` and the status-only path; accept MERGED without the flag. | bind-writer |
| DN-18 | Reopening a committed closeout (`active` or `paused`) deletes `closeout` and demotes its final ref to `supporting`. | Keeps history without a proposal shape. | Delete the ref instead. | bind-writer |
| DN-19 | `session-open/v1` and `goal-explain/v1` keep their version tags while `GoalCloseoutView` changes shape. `readGoalCloseoutViews` (session open and the SessionStart hook) lists only closeouts whose stored receipt is not verified, or whose final merged in the last 28 days; `goals explain`'s single-packet view stays unfiltered. | `apps/labs/lane-cockpit/src/Lanes.ts:109-113` decodes the `session-open/v1` envelope and ignores `goalCloseouts`; no other consumer decodes the view. Critic: rekeyed on `closeout`, session open would print a line and read the receipt store for every committed closeout (26 today, growing). | Bump both tags to v2 and update lane-cockpit; list every closeout. | closeout-views-and-launchers |
| DN-20 **ruling** | The launcher's done paragraph has three exits: (1) the jq passes **and** `goals completion refresh` prints verified; (2) the jq passes under an operator ruling in `decisions/`; (3) an operator blocker is reported with evidence. This **amends** the D-done ruling ("done means closeout adopted on main") and its AGENTS.md reference by adding the verified conjunct. | With one-PR closeout the jq is true as soon as the final merges, so the jq alone cannot tell verified from unverified (`map-template-docs.md:413-417`). | Restore the jq-only done condition in Bootstrap, `goals/_template`, every rewritten GOAL.md and AGENTS.md. | done-adds-verified |
| DN-21 | The GOAL.md rewrite also trims unrelated prose in launchers that overflow 4000 characters, including the T762 "Stop and report before changing public API" paragraph, which contradicts Autonomy (`AGENTS.md:164-179`). The same pass rewrites the Bootstrap closeout checklist's step 3 in every active or paused PLAN.md to the §4.2 text, and hand-edits the other live root prose of those packets that still prescribes `proposedCloseout` or a separate adoption PR (S11). Generated blocks, `decisions/`, `history/`, `research/`, `data/` and completed packets keep their bytes. `goals/_template/` and `goals/README.md` ride the same PR. The Codex packet generators (`Codex/Findings.packet.ts:518-578`, `Codex/Security.packet.ts:86-99`) are unchanged. The rewrite script is idempotent and re-runs after the last `origin/main` merge (S12). | Doctor's `goal-md-oversize` check is blocking (`DR:1053-1062`). Packets bootstrapped on `main` while PR A is open would otherwise keep the old text. After S10 a raw `proposedCloseout` key is a blocking `manifest-invalid`, so an agent following an old PLAN.md step 3 would turn its own packet red. | Restore the trimmed prose and resize by hand; restore the old PLAN.md step 3 text. | closeout-views-and-launchers |
| DN-22 | hold-ledger keeps #2755 as final and records #2865 as `supporting`. goal-packet-conflict-free-appends keeps #2869 and records #2874 as `supporting`. | Under DN-1 and DN-2, #2755 verifies (`map-migration.md:204-220`). The proposals name these finals. | Switch the finals to #2865 and #2874. | migration-finals-and-tombstones |
| DN-23 **ruling** | The archived tombstones (beep-effect-web-alchemy #2583, literal-kit-subset-algebra #2080) get **receipt-only** verification: refresh writes a workstation receipt, and nothing writes their manifest, README, `decisions/` or SPEC.md. A tombstone that could verify only with an attribution file stays unverified and is listed in the migration history note. | Critic: writing `closeout`, `decisions/` and a new SPEC.md into a tombstone breaks the archive contract and leaves the generated stub saying "No closeout record". | Write closeout records through `set-status --final-pr N --adopt-merged`, regenerate the stub with `renderTombstoneReadme` (`ArchiveExecution.service.ts:660`) and add `decisions/**` to `TombstoneKeep.goals`. | migration-finals-and-tombstones |
| DN-24 | When a red comes from the bypass merge itself (runs cancelled or queued): if main was red for that context when the final merged, the cause is `inherited` and the fix PR is the red episode's `unblocks-main` PR. Otherwise the cause is `introduced` and the fix PR is the first later PR whose same required context passed on a tree that contains the final's merge commit. | D-red needs a fix PR for every red (`map-migration.md:358-360`). | Rewrite the decision files. | red-attribution |
| DN-25 **ruling** | `GoalCompletionIoLive` is exported from `CompletionEvidence.ts`, next to `GoalMergeTimeEvidenceProviderLive` (`CE:833`). `CompletionEvidence.service.ts` stays type-only. One layer per command run; it memoizes `ruleSuites` with `Cache.makeWith(lookup, { capacity: 64, timeToLive: (exit) => Exit.isSuccess(exit) ? Duration.infinity : Duration.zero })` keyed `` `${root}\u0000${ref}` ``, so a failed listing is not replayed. A merge older than 31 days skips the listing and records `rule-suite-unavailable`. Every new adapter gets a live-layer test. | The listing re-pages a month of suites for every packet (`CE:214-224`; about 10 pages, `map-migration.md:118-129`). `Effect.cachedFunction` does not exist in Effect 4.1.4, and `effect/Cache` caches failures unless the TTL says otherwise. A `static layerLive` on the service class would create a runtime import cycle (TDZ) and a Fallow circular-dependency regression. | Go back to one adapter per read. | hosted-only-gating |
| DN-26 | This packet closes with PR A as its final. PR B merges first and is recorded as `supporting`. | The final must be the last PR to merge. | Ship a goals-only re-final. | pr-a-final |
| DN-27 **ruling** | No changeset: only `@beep/repo-cli` changes, and it is ignored (`.changeset/config.json:13`); `@beep/github` is used, not edited. The orchestrator publishes: `yeet open`, then a scoped local `yeet final-check --skip coverage=<reason>` on the content-final head with the reason named in the PR body, then `yeet ready`. | `yeet ready` needs a passing local final-check receipt for the head; local repo-cli coverage is a 1191.7 s shard under the load cap. | Add a changeset if a later step edits `@beep/github`; run the full local final-check. | pr-a-final |

---

## 1. Schemas (`Goals.schemas.ts`, `Decisions.schemas.ts`, `CompletionEvidence.schemas.ts`)

The repo order is schema, then service, then implementation. Every shape
below is a named `S.Opaque` with `$I.annoteSchema`. Literal domains use
`LiteralKit` and `.pick`. Array defaults use the existing
`ArrayKeyDefaultEmpty` (`GS:20`), which sets both a constructor default and a
decoding default, so adding such a field never breaks an existing `.make()`.
Guards are derived with `S.is(...)`.

### 1.1 Evidence kinds

```ts
// GS:236-243 gains one literal.
export const GoalAcceptanceEvidenceKind = LiteralKit([
  "hosted-required-checks",
  "hosted-review-threads",
  "yeet-verdict",
  "proof-fact",
  "packet-history",
]);
// The only kinds that may gate (DN-9). Callers test with S.is(GoalHostedEvidenceKind).
export const GoalHostedEvidenceKind = GoalAcceptanceEvidenceKind.pick([
  "hosted-required-checks",
  "hosted-review-threads",
]);
```

No exhaustive `Record` over the kind exists (`rg GoalAcceptanceEvidenceKind`
finds only `GS:236-250` and `GS:362`).

### 1.2 Attribution and ruling, as authored in a decision file

```ts
export const GoalAttributedRedCause = GoalRedAttribution.pick(["inherited", "introduced", "mixed"]); // GS:315

export class GoalAttributedRed extends S.Opaque<GoalAttributedRed, { readonly brand: unique symbol }>()(
  S.Struct({
    context: S.NonEmptyString,               // exact GoalRequiredCheckFact.context
    attribution: GoalAttributedRedCause,
    fixPullRequest: S.Int.check(S.isGreaterThan(0)),
  })
) {}

export class GoalRedAttributionBlock extends S.Opaque<GoalRedAttributionBlock, { readonly brand: unique symbol }>()(
  S.Struct({
    finalPullRequest: S.Int.check(S.isGreaterThan(0)),
    reds: S.NonEmptyArray(GoalAttributedRed),
  }).check(GoalRedAttributionUniqueContexts, GoalRedAttributionFixIsNotFinal) // named S.makeFilter checks
) {}

export class GoalOperatorRuling extends S.Opaque<GoalOperatorRuling, { readonly brand: unique symbol }>()(
  S.Struct({ finalPullRequest: S.Int.check(S.isGreaterThan(0)) })
) {}
```

`Decisions.schemas.ts` imports these; `Goals.schemas.ts` imports nothing from
Decisions (`GS:18-28`, `DS:12-15`), so there is no import cycle.
`GoalDecisionFrontmatter` (`DS:188-197`) gains:

```ts
redAttribution: S.optionalKey(GoalRedAttributionBlock),
operatorRuling: S.optionalKey(GoalOperatorRuling),
```

and a struct check `GoalDecisionClaimKind`: both keys only on
`kind: decision` (a checkpoint renders into PLAN.md, `DP:92`).

Example file (one per final):

```yaml
---
title: "Final #2966 merged over four cancelled Heavy checks"
date: 2026-11-14
lane: "feat/goal-closeout-hosted-verification"
reversal: "Delete this file; goals completion refresh reports #2966 unsatisfied again."
redAttribution:
  finalPullRequest: 2966
  reds:
    - { context: "Heavy / Check", attribution: inherited, fixPullRequest: 2994 }
    - { context: "Heavy / Test Integration", attribution: inherited, fixPullRequest: 2994 }
---

Evidence: run URLs, the main commit where the red began, and why the final merged over it.
```

### 1.3 Claims (reader output, observation and receipt input)

One claim shape travels end to end: reader, observation, receipt and
evaluator input all carry `redAttributions: ReadonlyArray<GoalRedAttributionClaim>`
(DN-6). Per-run facts are derived from it by the evaluator (§1.4), never
stored under a second name.

```ts
// Where the decision file was found. "origin-main" and "head" are committed (DN-6).
export const GoalClaimSource = LiteralKit(["origin-main", "head", "working-tree"]);
export const GoalCommittedClaimSource = GoalClaimSource.pick(["origin-main", "head"]);

export class GoalRedAttributionClaim extends S.Opaque<...>()(S.Struct({
  context: S.NonEmptyString,
  attribution: GoalAttributedRedCause,
  fixPullRequest: S.Int.check(S.isGreaterThan(0)),
  decisionFile: S.NonEmptyString,        // repo-relative path
  source: GoalClaimSource,
})) {}
export class GoalOperatorRulingClaim extends S.Opaque<...>()(S.Struct({
  finalPullRequest: S.Int.check(S.isGreaterThan(0)),
  decisionFile: S.NonEmptyString,
  source: GoalClaimSource,
})) {}
export class GoalAttributionConflict extends S.Opaque<...>()(S.Struct({
  context: S.NonEmptyString,
  decisionFiles: S.NonEmptyArray(S.NonEmptyString),
})) {}
export class GoalClaimSet extends S.Opaque<...>()(S.Struct({
  redAttributions: ArrayKeyDefaultEmpty(GoalRedAttributionClaim),   // already filtered to one final
  operatorRulings: ArrayKeyDefaultEmpty(GoalOperatorRulingClaim),
  conflicts: ArrayKeyDefaultEmpty(GoalAttributionConflict),         // fail closed, see 2.2
})) {}
export class GoalCompletionClaims extends S.Opaque<...>()(S.Struct({
  committed: GoalClaimSet.pipe(S.withConstructorDefault(Effect.succeed(GoalClaimSet.make({})))),
  preview: GoalClaimSet.pipe(S.withConstructorDefault(Effect.succeed(GoalClaimSet.make({})))), // committed plus working tree
})) {}
```

`GoalCompletionClaims.make({})` is the empty value every default below uses.

### 1.4 Verdict facts

```ts
export const GoalAttributedRedObservation = LiteralKit(["red", "missing"]); // missing: no run on the head (DN-4)

export class GoalAttributedRedFact extends S.Opaque<...>()(S.Struct({
  context: S.NonEmptyString,
  checkRunId: S.OptionFromNullOr(S.Finite),     // None exactly when observed = missing
  conclusion: GoalCheckConclusion,              // "unknown" for missing
  observed: GoalAttributedRedObservation,
  attribution: GoalAttributedRedCause,
  fixPullRequest: S.Int.check(S.isGreaterThan(0)),
  decisionFile: S.NonEmptyString,
  source: GoalClaimSource,
})) {}

export class GoalReviewThreadTally extends S.Opaque<...>()(S.Struct({
  total: S.Int.check(S.isGreaterThanOrEqualTo(0)),
  outstanding: S.Int.check(S.isGreaterThanOrEqualTo(0)),
})) {}
```

- `GoalCompletionEvidenceVerified` (`GS:826-835`) gains
  `attributedReds: ArrayKeyDefaultEmpty(GoalAttributedRedFact)` and
  `ruleSuiteBypassed: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false)), S.withDecodingDefaultKey(Effect.succeed(false)))`.
  Both defaults are required so the existing `.make({ facts: relevant })` at `CE:565`
  still compiles after S1. `facts` stays at "all relevant facts", attributed
  reds included, so the min-1 check at `GS:830` still holds when every
  context is red.
- `GoalCompletionEvidenceUnsatisfied` (`GS:855-864`): `reds` now holds only
  **unattributed** reds. `ruleSuiteRed` stays, for information only (DN-2).

### 1.5 Receipt v2

```ts
export const GoalCompletionReceiptVersion = LiteralKit([
  "goal-completion-receipt/v1",
  "goal-completion-receipt/v2",
]);
// GoalCompletionReceipt (GS:1008-1033):
schemaVersion: GoalCompletionReceiptVersion.pipe(S.withConstructorDefault(Effect.succeed("goal-completion-receipt/v2"))),
merged: S.OptionFromNullOr(S.Boolean).pipe(S.withConstructorDefault(Effect.succeedNone), S.withDecodingDefaultKey(Effect.succeed(null))),
reviewThreads: S.OptionFromNullOr(GoalReviewThreadTally).pipe(/* same defaults */),
redAttributions: ArrayKeyDefaultEmpty(GoalRedAttributionClaim),   // committed claims only (DN-6)
```

`merged` lets doctor tell an open final apart from an unreadable one
(`map-schema-status-doctor.md:114-122`). `C:252` still passes
`schemaVersion: "goal-completion-receipt/v1"` until S4 changes it; the
literal stays valid.

### 1.6 Wire decoder (`CES:161-171`, step S3)

`GoalCompletionPull` gains `state: LiteralKit(["open", "closed"])`, required
on decode (GitHub always sends it). The test fixture port fills it from
`merged` when a fixture omits it (§2.1), so no existing fixture changes.

### 1.7 Closeout record, view and checks

- `closeoutGateAdmits` (`GS:1535-1541`) drops the `yeet-verdict` clause
  (`GS:1537`). It keeps "not grandfathered" and "matches any declared final"
  (D-hosted reversal target). The two filter messages (`GS:1559-1560`,
  `GS:1583-1584`) and the record and verification docs (`GS:1308-1373`) lose
  "gating Yeet readiness evidence". Step S1.
- `GoalCloseoutView` (`GS:1395-1406`) becomes
  `{ packet, closeout: GoalCloseoutRecord, verification: GoalCloseoutVerification }`.
  `goalCloseoutVerification` (`GS:1427-1434`) goes. `renderGoalCloseoutView`
  (`GS:1469-1472`) keeps its name and delegates to
  `renderGoalCloseoutRecordView` (`GS:1498-1505`). Step S6.
- Removal (step S10, after the migration): `GoalProposedCloseout`
  (`GS:1297-1306`), the field (`GS:1783`), `GoalProposedCloseoutCheck`
  (`GS:1543-1562`) and its entry in `.check` (`GS:1807`), the "no proposal"
  clause in `GoalCloseoutRecordCheck` (`GS:1575`),
  `renderGoalProposedCloseout` (`GS:1530-1531`), and the `proposedCloseout ??`
  in `goalPullRequestRefs` (`GS:1850`). Manifests keep decoding with unknown
  keys ignored (`MODELED_GOAL_MANIFEST_KEYS`, `BSS:750`), so the raw-key
  guards in §2.6 and DN-17 read the raw JSON.

### 1.8 Closeout check (new `Goals/CloseoutCheck.ts`, step S6)

```ts
export const GoalCloseoutCheckOutcome = LiteralKit([
  "final-open",       // merged = false, state open: D-onepr, no finding
  "verified",
  "operator-ruling",  // not verified, committed operatorRuling for #N
  "beyond-window",    // merged more than 28 days ago, not verified: note
  "transient",        // advisory completion-gate-unknown
  "unverified",       // blocking closeout-unverified
]);
export const GoalCloseoutCheckBlocking = GoalCloseoutCheckOutcome.pick(["unverified"]);

export class GoalCloseoutCheck extends S.Opaque<...>()(S.Struct({
  packet: S.NonEmptyString,
  finalPullRequest: S.Int.check(S.isGreaterThan(0)),
  outcome: GoalCloseoutCheckOutcome,
  reasons: ArrayKeyDefaultEmpty(S.String),
  attributedReds: ArrayKeyDefaultEmpty(GoalAttributedRedFact),
  rulingFile: S.OptionFromNullOr(S.NonEmptyString),
})) {}
```

---

## 2. Service contracts

### 2.1 `GoalCompletionIo` (`CESv:42-87`) and `GoalCompletionIoLive` (`CE`)

```ts
// CESv, type-only as today:
readonly reviewThreads: (root: string, number: number) => Effect.Effect<ReviewThreads, YeetCommandError>;

// CE, next to GoalMergeTimeEvidenceProviderLive (CE:833):
export const memoizeGoalCompletionRuleSuites: (
  port: GoalCompletionIo["Service"]
) => Effect.Effect<GoalCompletionIo["Service"]>;
export const GoalCompletionIoLive: Layer.Layer<GoalCompletionIo, never, ChildProcessSpawner.ChildProcessSpawner>;
// = Layer.effect(GoalCompletionIo, Effect.flatMap(goalCompletionIo(), memoizeGoalCompletionRuleSuites))
```

- The live `reviewThreads` builds `ReviewThread.layer` (`RT:740-760`) inside
  the existing `github(root, ...)` helper (`CE:102-115`), where `GitHubClient`
  and `Repo` are already provided, and returns `ReviewThread.list(number)`.
- `memoizeGoalCompletionRuleSuites` builds
  `Cache.makeWith((key: string) => port.ruleSuites(...splitKey(key)), { capacity: 64, timeToLive: (exit) => Exit.isSuccess(exit) ? Duration.infinity : Duration.zero })`
  and returns `{ ...port, ruleSuites: (root, ref) => Cache.get(cache, `${root}\u0000${ref}`) }`.
  `Cache.makeWith` takes the lookup first and the options second
  (`effect/dist/Cache.d.ts:176`); `Duration.zero` and `Duration.infinity`
  exist (`Duration.d.ts:333`, `:349`).
- `goalCompletionIo()` already prefers a provided service (`CE:95-96`), so
  `refresh`, `doctor` and the sweep check only add
  `Effect.provide(GoalCompletionIoLive)` around a whole run. `Effect.provide`
  builds the layer in the caller's context (`Layer.buildWithScope`,
  `effect/dist/internal/layer.js:6`), so when a test provides a fixture port
  outside the run, `goalCompletionIo()` finds that fixture and the memo wraps
  it. Existing tests keep their fixtures.
- `CompletionEvidence.service.ts` keeps only types: no `layerLive` static,
  because the service file importing `CompletionEvidence.ts` back would be a
  runtime cycle in which both modules do top-level work.
- The fixture in `test/support/CompletionIo.ts` gains a `reviewThreads` route
  that **defaults to an empty thread list**, and its `pulls/{n}` route fills
  `state` from `merged` when the fixture omits it. Otherwise every existing
  observation fixture would turn unknown or fail to decode.

### 2.2 `GoalCompletionClaimsReader` (new `Goals/RedAttribution.ts`)

```ts
export class GoalSourcedDecision extends S.Opaque<...>()(S.Struct({
  path: S.NonEmptyString, source: GoalClaimSource, text: S.String,
})) {}
export const goalCompletionClaims: (decisions: ReadonlyArray<GoalSourcedDecision>, finalPullRequest: number) => GoalCompletionClaims; // pure
export const committedGoalCompletionClaims: (claims: GoalCompletionClaims) => GoalClaimSet;          // = claims.committed
export class GoalCompletionClaimsReader extends Context.Service<GoalCompletionClaimsReader, {
  readonly read: (root: string, slug: string, finalPullRequest: number) => Effect.Effect<GoalCompletionClaims>;
}>()($I`GoalCompletionClaimsReader`) {
  static readonly layer: Layer.Layer<GoalCompletionClaimsReader, never, FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner>;
  static readonly layerTest: (claims: GoalCompletionClaims) => Layer.Layer<GoalCompletionClaimsReader>;
}
export const readGoalCompletionClaims: (root: string, slug: string, finalPullRequest: number) => Effect.Effect<GoalCompletionClaims, never, ...>; // provided-or-live, like goalCompletionIo
```

The live reader collects `goals/<slug>/decisions/*.md` from three sources:

1. `origin-main`: `Git.lsTree(root, "origin/main", { pathspec: [dir] })`, then
   `Git.show(root, "origin/main", path)` (`packages/drivers/git/src/Git.ts:3447`,
   `:3944`). The reader never fetches; callers run after a fetch (the
   sweep's `fetch-prune`, or the closeout skill's instruction).
2. `head`: the same two calls at `HEAD`.
3. `working-tree`: `FileSystem` over `<root>/goals/<slug>/decisions/`.

`Git` is built inside the reader with `Effect.provideServiceEffect(Git, Git.make)`,
as `CE:124-130` does, so callers need no `Git` layer. A failed git read
contributes no files from that source; it never fails the read.

Matching rules, all in the pure function:

1. Parse each distinct `(path, text)` with `parseGoalDecision` (`DP:186`).
   Invalid files never attribute. Identical claims from several sources
   collapse to the strongest source (`origin-main`, then `head`, then
   `working-tree`).
2. `committed` uses only `origin-main` and `head` decisions; `preview` uses
   all three.
3. Within each set, collect reds by `context` in an `effect/HashMap`. If two
   files give the same context different values, the context goes into
   `conflicts` and is not attributed (fail closed).
4. `operatorRulings` holds every valid `operatorRuling` whose
   `finalPullRequest` matches.

The reader does not use Doctor's decision reader, because `Doctor.ts`
already imports `Completion.ts`, and importing it back would create a cycle.

### 2.3 `GoalFinalPullRequestResolver` (new `Goals/FinalPullRequest.ts`)

```ts
export const GoalFinalPullRequestState = LiteralKit(["OPEN", "MERGED", "CLOSED"]);
export class GoalFinalPullRequestCandidate extends S.Opaque<...>()(S.Struct({
  number: S.Int.check(S.isGreaterThan(0)), state: GoalFinalPullRequestState, headRefName: S.NonEmptyString,
})) {}
export class GoalFinalPullRequestResolver extends Context.Service<GoalFinalPullRequestResolver, {
  readonly forBranch: (root: string) => Effect.Effect<O.Option<GoalFinalPullRequestCandidate>>;
  readonly byNumber: (root: string, number: number) => Effect.Effect<O.Option<GoalFinalPullRequestCandidate>>;
}>()($I`GoalFinalPullRequestResolver`) {
  static readonly layer: Layer.Layer<GoalFinalPullRequestResolver, never, ChildProcessSpawner.ChildProcessSpawner>;
  static readonly layerTest: (candidates: ReadonlyArray<GoalFinalPullRequestCandidate>) => Layer.Layer<GoalFinalPullRequestResolver>;
}
```

The live implementation runs `gh pr view [n] --json number,state,headRefName`,
the route at `Yeet/internal/closeout/GhCollect.ts:390-397` (`KEEP (D-13)`).
A non-zero exit or undecodable JSON is `None`. It is the only process
boundary `set-status` gains.

### 2.4 Pure evaluator (`CE:506-583`)

`GoalCompletionEvidenceInput` (`CES:131-145`) gains
`redAttributions: ArrayKeyDefaultEmpty(GoalRedAttributionClaim)`, and the
caller passes only committed, fix-validated claims. The new
`decideGoalCompletionEvidence`:

1. `relevant`: facts for the required contexts, bound to the accepted head,
   computed under DN-1.
2. `reds`: relevant facts whose outcome is `unsatisfied`. `missing`: required
   contexts whose fact has `checkRunId: None`. A context with a run that is
   still `pending` is neither.
3. A claim attributes a red or a missing context with the same `context`.
   Reds split into `attributed` and `unattributed`.
4. If any red is unattributed, return `unsatisfied { reds: unattributed, ruleSuiteRed }`.
   A known contrary fact wins over gaps, as today.
5. Compute gaps as `CE:530-560` does today, except that
   `required-check-unobserved` counts a context as covered when it is
   verified **or** attributed (red or missing). If any gap remains, return
   `unknown`. Gaps win over attributions: without the inventory, nobody
   knows which contexts were required.
6. Otherwise return
   `verified { facts: relevant, attributedReds, ruleSuiteBypassed: activeRed || recoveredRed }`.

A claim naming a context that is neither red nor missing does nothing in the
evaluator; §2.7 reports it as a stale attribution note.

`describeGoalCompletionEvidence` (`CE:585-592`) adds
`attributed: Heavy / Check (inherited, fix #2994, decisions/<file>); ...` and
`bypassed` when `ruleSuiteBypassed`, which satisfies "the receipt lists the
reds" (D-red).

### 2.5 Completion API (`C`)

- `observeGoalCompletion(root, slug, manifest, final, claims: GoalCompletionClaims = GoalCompletionClaims.make({}))`
  (`C:627-633`). The `readinessJob` parameter goes; the new fifth parameter
  has a default, so the only other `src` caller (`DR:1503`) keeps compiling
  in S4. `GoalCompletionObservation` (`C:83-107`) gains
  `redAttributions` (constructor default empty) and
  `reviewThreads: S.Option(GoalReviewThreadTally)` (constructor default
  none).
- Fix-PR validation (DN-5) runs inside `observeGoalCompletion`: one
  `io.pullRequest` per distinct `fixPullRequest` in `claims.committed`;
  claims whose PR is missing or `state: closed` with `merged: false` are
  dropped and named in the hosted detail; a failed read keeps the claim out
  and adds the transient reason "fix PR #n unreadable".
- **Blocker fix.** `hostedRequiredOutcome` (`C:595-604`) derives the
  `hosted-required-checks` outcome from the verdict alone:
  `verified` → `verified`, `unsatisfied` → `unsatisfied`, `unknown` →
  `unknown`. Today it turns `unknown` whenever any fact is not green, which
  would keep every attributed red unknown.
- `goalCompletionVerdict` (`C:130-140`) and `goalCompletionUnknownReasons`
  (`C:174-195`) add `"redAttributions"` to their `Pick`, and the verdict input
  passes it through. `goalCompletionUnknownReasons` and `overallOutcome`
  (`C:197-215`) filter gating evidence with
  `check.ref.gating && S.is(GoalHostedEvidenceKind)(check.ref.kind)`. Both
  hosted kinds must be present for the outcome to be verified; a missing kind
  adds the reason "no <kind> evidence".
- `GoalCompletionVerifier.resolve` keeps its signature (`C:230-268`) and
  writes v2 with `merged`, `reviewThreads` and `redAttributions`.
- `storedGoalCompletion` (`C:949-996`): a v1 row whose outcome is verified is
  returned as stored; any other row is re-resolved, mapping
  `redAttributions` and `reviewThreads` from the receipt explicitly (not by
  spread alone, so the mapping is tested). Its "definite" filter
  (`C:968-978`) also accepts `hosted-review-threads`.
- `refresh` (`C:1251-1287`) provides `GoalCompletionIoLive` once, reads claims
  through `readGoalCompletionClaims`, and observes with `claims`. It writes
  the receipt from the committed observation. It prints attributed reds with
  their sources, the operator-ruling note, and a remediation hint for any
  outcome that is not verified; when the outcome is not verified and
  `claims.preview` differs from `claims.committed`, it re-runs the pure
  verdict with the preview set and prints
  `would verify once committed: <files>` (nothing is stored). A verified
  outcome whose counted claims include a `head`-only claim prints
  `verified (claims at HEAD only: <files>; not done until they merge)`.
  This replaces `adoptionHint` (`C:1211-1216`).

### 2.6 Doctor (`DR`)

New blocking kind: `closeout-unverified`. `closeout-adoption-pending`
(`DR:142`) is removed from the `LiteralKit` and from
`VALIDATION_REQUIREMENTS_BY_FINDING_KIND` (`BSS:752-790`, `:768`), and the
Record gains `"closeout-unverified": ["doctor-clean"]` in the same step.

Online, every committed closeout goes through `readGoalCloseoutCheck`
(§2.7). The outcome maps to findings:

| `GoalCloseoutCheck.outcome` | Finding |
| --- | --- |
| `final-open` | none; note "final #N open" (D-onepr) |
| `verified` | none; note lists attributed reds, a v1 note when the stored row is v1 |
| `operator-ruling` | none; note "closed by operator ruling `<file>`" (D-exit) |
| `beyond-window` | note "beyond the rule-suite window" (DN-13) |
| `transient` | advisory `completion-gate-unknown` with the reasons |
| `unverified` | **blocking** `closeout-unverified`, key `<slug> closeout-unverified #N` (built by `finding()`, `DR:253-266`) |

Offline, findings come from the stored receipt and are advisory only, never
blocking. A legacy `completed-retained` row with a final but no `closeout`
keeps its advisory findings (`DR:1253-1277`, `DR:1561-1573`); online it also
takes the `pulls/{n}` 28-day pre-check, and a row beyond the window skips
the full observation, thread read included. An attribution conflict, or an
attribution naming a context that was not red or missing, is an advisory
note.

After S10, a raw `proposedCloseout` key in any manifest is a blocking
`manifest-invalid`: "legacy proposedCloseout; run
`bun run beep goals set-status <slug> completed-retained` to bind its
final". Blocking findings go through the existing ratchet
(`DR:1717-1741`). The baseline is `findings: []`
(`goals/goals-doctor.baseline.jsonc`), so a new blocking finding fails with
exit 1.

### 2.7 `GoalCloseoutChecker` (new `Goals/CloseoutCheck.ts`)

```ts
export const GOAL_CLOSEOUT_WINDOW_DAYS = 28;
export const goalCloseoutShard: (slug: string, finalPullRequest: number) => string; // "goal-closeout:<slug>#<n>"
export const goalCompletionTransient: (receipt: GoalCompletionReceipt) => boolean;   // pure
export const classifyGoalCloseout: (input: {
  readonly packet: string;
  readonly finalPullRequest: number;
  readonly pull: O.Option<GoalCompletionPull>;      // None: the pre-check read failed
  readonly now: DateTime.Utc;
  readonly receipt: O.Option<GoalCompletionReceipt>; // None when not observed (open, closed, beyond window)
  readonly claims: GoalClaimSet;                     // committed
}) => GoalCloseoutCheck; // pure
export class GoalCloseoutChecker extends Context.Service<GoalCloseoutChecker, {
  readonly check: (root: string, slug: string, manifest: GoalManifest) => Effect.Effect<O.Option<GoalCloseoutCheck>>;
}>()($I`GoalCloseoutChecker`) {
  static readonly layerTest: (checks: ReadonlyArray<GoalCloseoutCheck>) => Layer.Layer<GoalCloseoutChecker>;
}
export const GoalCloseoutCheckerLive: Layer.Layer<GoalCloseoutChecker, never, ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path>;
export const readGoalCloseoutCheck: (root: string, slug: string, manifest: GoalManifest) => Effect.Effect<O.Option<GoalCloseoutCheck>, never, ...>; // provided-or-live
```

`check` returns `None` when the manifest has no committed `closeout` or is
grandfathered. Otherwise it reads `pulls/{n}` first, then observes only when
the final merged inside the window, with claims from §2.2.

Classification order:

1. Pre-check read failed: `transient`.
2. `state: open`: `final-open`. `state: closed` and not merged: `unverified`
   ("final #N closed without merging; bind a new final or reopen the
   packet"), at any age.
3. Merged more than 28 days ago: `beyond-window`, unless a stored verified
   receipt exists (then `verified`).
4. Observation verified: `verified`.
5. A committed `operatorRuling` for #N: `operator-ruling`.
6. `goalCompletionTransient(receipt)`: `transient`. Transient means every
   unknown reason is one of: the gaps `network-failure`,
   `partial-ruleset-reads` and `inventory-unobserved`; a failed review-thread
   read; a failed fix-PR read; merge facts unobserved; a required context
   whose run is still `pending`. Nothing `unsatisfied` is transient.
7. Otherwise `unverified`: `unsatisfied` (an unattributed red, an outstanding
   thread), or `unknown` for a structural reason
   (`rule-suite-unavailable` inside the window, `inventory-mismatch`,
   `deleted-ruleset-unrecoverable`, `unsupported-rule-source`, a required
   context with no run and no claim).

Doctor (§2.6) and the sweep trigger (§2.8) are the only consumers, so the
two cannot drift apart.

### 2.8 `yeet sweep --retire` closeout trigger (`RE`, `PO`)

```ts
// RE, next to activePacketsOnBranch (RE:577-597):
export const touchedPacketsOnBranch: (plan: YeetRetirePlan, state: SweepGitState) => Effect.Effect<ReadonlyArray<string>, never, Git | ChildProcessSpawner.ChildProcessSpawner>;
export const checkTouchedCloseouts: (cloneRoot: string, slugs: ReadonlyArray<string>) => Effect.Effect<ReadonlyArray<GoalCloseoutCheck>, never, ...>;
export const renderCloseoutChecks: (checks: ReadonlyArray<GoalCloseoutCheck>) => string;
```

- `touchedPacketsOnBranch` is the slug half of `activePacketsOnBranch`
  (same union of the PR's file list and the branch diff, `RE:515-540`);
  `activePacketsOnBranch` filters it.
- In `retireThenSweep` (`PO:336-366`), after `executeSweep` (whose
  `fetch-prune` step refreshed `origin/main`) and before
  `printRetireReport`: for each touched slug, read
  `Git.show(cloneRoot, "origin/main", "goals/<slug>/ops/manifest.json")`,
  decode it, and run `readGoalCloseoutCheck(cloneRoot, slug, manifest)` under
  `GoalCompletionIoLive`. `--plan` skips the check.
- A blocking outcome calls `recordYeetLocalShardOutcome` (`LSP:82-120`) on
  the owning clone with
  `{ shard: goalCloseoutShard(slug, n), exitCode: 1, command: "bun run beep goals completion refresh --slug <slug>", headSha: <origin/main sha> }`,
  which appends a P0 `local-shard-failed` row that the inbox hook shows in
  every session in the clone. A verified outcome records `exitCode: 0`,
  which acknowledges an earlier row for the same shard. `transient` and
  notes print only.
- `goals completion refresh` printing verified records the same `exitCode: 0`
  outcome for that shard in the checkout where it runs (`C` imports `LSP`;
  `LSP`'s import closure reaches no `Completion.ts` or `Doctor.ts`, checked).
- `YeetRetireSweepReport` (`Retire.schemas.ts:188-200`) gains
  `closeoutChecks: ArrayKeyDefaultEmpty(GoalCloseoutCheck)`; the tag stays
  `yeet-retire-sweep-report/v2` because the key is additive (the DN-19
  rule). The text report prints one line per check:
  `[yeet] P0 closeout-unverified goals/<slug> #<n>: <reasons>; fix with a redAttribution or operatorRuling decision file on main`.
- `renderActivePackets` (`RE:613-621`) words its advice for the one-PR
  route: "if the merged PR was the goal's final, bind it with
  `goals set-status <slug> completed-retained --final-pr <n> --adopt-merged`".
- The exit status stays 0 (DN-14).

`Completion.ts` and `Doctor.ts` reach none of `Retire.ts`, `Porcelain.ts`,
`Sweep.ts` or the inbox modules (import closures checked), so
`CloseoutCheck.ts` importing `Completion.ts` and being imported by `RE` is
cycle-free.

---

## 3. Implementation steps

The steps are ordered. A step marked ∥ runs in parallel with the other ∥
steps of its group, and their **file sets are disjoint** (checked below each
group). Every step ends green on its own test command plus `bun run check`.

When ∥ steps share one worktree, a step's `bun run check` also sees a
sibling's half-done edits. Attribute any error by file owner first; if it is
in a sibling's file, rerun after the sibling settles instead of fixing it.

### Group 1 (sequential)

**S1. Schema contracts.**
- Files:
  - `src/commands/Goals/Goals.schemas.ts` (sections 1.1-1.5, plus the 1.7 `closeoutGateAdmits` relax)
  - `src/commands/Goals/Decisions.schemas.ts` (frontmatter keys and `GoalDecisionClaimKind`)
  - `test/goals-completion.test.ts` (decode expectations at `:679`, `:724` flip to success; receipt v1 and v2 rows decode)
  - `test/goals-decisions.test.ts` (accept `redAttribution` and `operatorRuling`; reject them on a checkpoint, a misspelt key, duplicate contexts, and a fix equal to the final)
- Green on its own: every new field has a constructor default (`ruleSuiteBypassed` both defaults, §1.4), so `CE:565` and `C:252` compile unchanged.
- Test: `bunx --bun vitest run test/goals-completion.test.ts test/goals-decisions.test.ts && bun run check`

### Group 2 (∥, each after S1; S8 may also start before S1)

**S2 ∥. Claims reader and authoring.**
- Files:
  - new `src/commands/Goals/RedAttribution.ts` (section 2.2)
  - `src/commands/Goals/Decisions.projection.ts`: `renderEntry` (`DP:232-239`) adds "Attributed reds for #N: …" and "Operator ruling closes #N".
  - `src/commands/Goals/Decisions.ts`: the `add` command (`Decisions.ts:381-399`) gains `--final <n>`, repeatable `--attribute-red "<context>=<cause>#<fix>"` and `--operator-ruling`, which needs `--final`.
  - new `test/goals-red-attribution.test.ts`:
    - pure: match by final; a conflict fails closed; an invalid file never attributes; ruling claims; identical claims collapse to the strongest source; `committed` excludes working-tree files, `preview` includes them
    - live layer over a temp git repository: no `decisions/` directory; an invalid file; a file committed and copied to `refs/remotes/origin/main`; a file committed at `HEAD` only; an untracked working-tree file; a missing `origin/main` ref contributes nothing
    - `layerTest` returns its claims
  - `test/goals-decisions.test.ts` (render and the new `add` flags)
- Test: `bunx --bun vitest run test/goals-red-attribution.test.ts test/goals-decisions.test.ts && bun run check`

**S3 ∥. Evidence evaluator and port.**
- Files:
  - `src/commands/Goals/CompletionEvidence.schemas.ts` (input `redAttributions`; `GoalCompletionPull.state`)
  - `src/commands/Goals/CompletionEvidence.ts`:
    - `goalRequiredCheckFacts` per DN-1 (`CE:398-447`)
    - `decideGoalCompletionEvidence` per 2.4
    - describe
    - live `reviewThreads`
    - `memoizeGoalCompletionRuleSuites` and `GoalCompletionIoLive` (2.1)
    - the 31-day skip in `readMergeRuleSuite` (`CE:362-386`; the request already carries `mergedAt`)
  - `src/commands/Goals/CompletionEvidence.service.ts` (the `reviewThreads` port type only)
  - `test/support/CompletionIo.ts` (`reviewThreads` route defaulting empty; `state` filled from `merged`)
  - `test/goals-completion-evidence.test.ts`
    - An attributed twin of the head-bound red at `:258-265`.
    - DN-2 flips two cases. `:266-280` (a failed `required_status_checks`
      evaluation in a bypass suite, every context green) now verifies with
      `ruleSuiteBypassed`. In `:301-315`, the `complete` case (a deleted
      ruleset whose history shows it gated the merge, every context green)
      now verifies with `ruleSuiteBypassed`; `partial` and `unrecoverable`
      stay `unknown`.
    - A `missing` context covered by a claim verifies; a `pending` one does not.
    - Gaps win over attributions.
    - A conflicting claim does not attribute.
    - `skipped` counts as success.
  - `test/goals-completion.test.ts`, only `:221-263` ("a legacy receipt row
    with a recovered version and no history fails closed as gating"): under
    DN-2 the recovered red no longer returns `unsatisfied`. Both resolutions
    now verify with `ruleSuiteBypassed`: the old code reached `CE:562` only
    with no gap, so every context is green. The legacy row's `history` still
    decodes as `gating`, and the case asserts that the legacy row resolves
    exactly like the fresh one. That keeps the fail-closed intent.
  - `test/goals-completion-kit.test.ts`:
    - the thread read through the fixture
    - `memoizeGoalCompletionRuleSuites` over a counting fake port: one lookup per key, a second key looks up again, a failed lookup is retried
    - `GoalCompletionIoLive` built under `scriptedSpawner` (`test/support/GithubLedgerFakes.ts:40`) with every process exiting 1: `reviewThreads` and `ruleSuites` fail with `YeetCommandError`, and a second `ruleSuites` call spawns again
  - `test/goals-completion-observation.test.ts`, only the two evaluator-pinning cases:
    - `:587-591`: a run pending at merge now counts by its eventual conclusion.
    - `:625-633`: a rerun after the merge now supersedes, per DN-1.
- Green on its own: `GoalCompletionEvidenceInput.make` at `C:134` needs no new key (array default). The inline port at `test/goals-completion-observation.test.ts:564` spreads `fixtureIo(text)`, so it inherits the new `reviewThreads` route and compiles unchanged.
- Test: `bunx --bun vitest run test/goals-completion-evidence.test.ts test/goals-completion.test.ts test/goals-completion-kit.test.ts test/goals-completion-observation.test.ts && bun run check`

**S5 ∥. Bind writer.**
- Files:
  - `src/commands/Goals/SetStatus.ts`:
    - Delete `adoptVerifiedCloseout` (`SS:421-450`) and the `readGoalCloseoutView` import (`SS:38`); `set-status` no longer reads receipts.
    - The new `bindCloseout` branch in `closeoutTransition` (`SS:477-482`) implements DN-17, reading `proposedCloseout` from the raw manifest JSON.
    - It edits `closeout`, the whole `completionGate.pullRequests` array (adds `{N, final}`, demotes any other `final`, removes a duplicate `supporting` N), and deletes a raw `proposedCloseout` key.
    - `reopenCommittedCloseout` (`SS:452-475`) implements DN-18.
    - Add `--final-pr` and `--adopt-merged` beside `SS:566-577` and update the module doc (`SS:1-22`).
    - The existing decode check (`SS:502-509`) still guards the write.
  - new `src/commands/Goals/FinalPullRequest.ts` (section 2.3)
  - `test/goals-set-status-stream.test.ts`: `:88-123` becomes "a proposal adopts its own final"; `:125-161` becomes "reopen demotes"
  - new `test/goals-set-status-closeout.test.ts` (through `GoalFinalPullRequestResolver.layerTest`):
    - open PR resolved from the branch
    - refusal with no PR, a CLOSED PR, a conflicting `--final-pr`, a MERGED `--final-pr` without `--adopt-merged`
    - MERGED accepted with `--adopt-merged`
    - the branch's open PR refused when `pullRequests` already names a different MERGED final
    - an old open final demoted
    - grandfathered status-only flip
    - `--preview` prints the bind
  - new `test/goals-final-pull-request.test.ts`: `GoalFinalPullRequestResolver.layer` under `scriptedSpawner` for OPEN, MERGED, CLOSED, a non-zero exit and malformed JSON, for both `forBranch` and `byNumber`
  - `test/packet-core-set-status-input.test.ts`: `--adopt-merged` without `--final-pr`, and a `--final-pr` that is not a positive integer, are rejected before any packet read or process spawn. The file's spawner already dies on any spawn.
- Test: `bunx --bun vitest run test/goals-set-status-stream.test.ts test/goals-set-status-closeout.test.ts test/goals-final-pull-request.test.ts test/packet-core-set-status-input.test.ts && bun run check`

**S7 ∥. Other proposal readers.**
- Files:
  - `src/commands/Goals/PortfolioIndex.ts` (`:297-308`, record only)
  - `src/commands/Goals/ArchiveExecution.service.ts` (`:759-763`, record only)
  - `src/commands/Lint/ReflectionArtifact.ts` (`:269-285`: only `closeout` keeps a packet in the gate, and the status comes from `initiative.status`)
  - `test/goals-command.test.ts` (`:311-313`, `:343-357`, and the `GoalProposedCloseout` and `renderGoalProposedCloseout` imports at `:9` and `:18`, which S10 removes from the schema module)
  - `test/reflection-lint.test.ts` (`:142-163`)
- Test: `bunx --bun vitest run test/goals-command.test.ts test/reflection-lint.test.ts && bun run check`

**S8 ∥. Templates and prose (no code dependency).**
- Files:
  - `src/commands/Goals/Bootstrap.ts` (`:333-338`, `:434-437`; `:53-54`, which still says "publish --pr")
  - `test/fixtures/goals-plan/bootstrap-{full,minimal,report-first}.json` (regenerated)
  - `goals/_template/GOAL.md` (`:61-63`)
  - `goals/_template/PLAN.md` (`:47-48`)
  - `goals/README.md` (`:174`, `:203-240`, `:273-277`)
  - `AGENTS.md` (`:388-396`)
  - `.claude/skills/closeout/SKILL.md` (`:76-79`)
  - `.claude/skills/reflect/SKILL.md` (`:24-30`)
  - `.claude/skills/yeet/references/sweep-retire.md` (`:70-77`)

  The text is in section 4. The prose describes S10's sweep check, which
  lands in the same PR.
- Test: `REGEN_GOLDENS=1 bunx --bun vitest run test/goals-bootstrap-plan.test.ts`, review the three fixture diffs, then `bunx --bun vitest run test/goals-bootstrap-plan.test.ts test/goals-materialize.test.ts && bun run beep skills update --check && bun run check`

Disjointness, Group 2: S2 owns `RedAttribution.ts`, `Decisions.ts`,
`Decisions.projection.ts` and two tests; S3 owns the three
`CompletionEvidence*` files, `test/support/CompletionIo.ts` and four tests
(`goals-completion.test.ts` among them; S1, its earlier owner, has
finished); S5 owns `SetStatus.ts`, `FinalPullRequest.ts` and four tests; S7
owns `PortfolioIndex.ts`, `ArchiveExecution.service.ts`,
`ReflectionArtifact.ts` and two tests; S8 owns `Bootstrap.ts`, fixtures and
prose. No path appears twice. S5 only imports `PortfolioIndex.ts` (S7's),
which is a compile coupling, not a shared edit.

A test file may pass from one step to a later **sequential** step (S1 to S3
to S4 for `goals-completion.test.ts`; S4 to S6 to S10 for
`goals-doctor.test.ts`). It is never shared inside a parallel group.

### Group 3

**S4. Completion core (after S2, S3).**
- Files:
  - `src/commands/Goals/Completion.ts`:
    - Delete the recovery path: `Recovery`, `RecoveryFacts`, `recoverReadiness`, `readinessRecoveryRefusal`, `readLocalEvidence` (`C:313-551`), the local branch of `readDeclaredEvidence` (`C:571-589`), the flag and its validation (`C:1255-1262`, `C:1307-1313`), and the imports used only by those (`C:10`, `C:25`, `C:27`, `C:28`, `C:30`, `C:31`).
    - Add `hosted-review-threads` evidence next to `hostedRef` (`C:68`, `C:716-723`), with a fixed ref.
    - The `hostedRequiredOutcome` blocker fix, fix-PR validation, gating and the `Pick` changes of 2.5; DN-12.
    - Receipt v2 and DN-8 in `storedGoalCompletion`.
    - `refresh` per 2.5; `observeGoalCompletion`'s fifth parameter defaults to empty claims.
    - `projectGoalLifecycle` loses only its `readiness` conjunct for now (`C:1055-1071`).
  - `test/goals-completion.test.ts`:
    - Resolver fixture `:94-134` gains thread evidence.
    - Lifecycle cases `:604` and `:605-616` now adopt.
    - Add attributed-red and outstanding-thread candidates.
  - `test/goals-completion-observation.test.ts`:
    - Delete the recovery matrix `:1064-1181` and the flag test `:1040-1050`.
    - Add: local verdict ignored; threads 0 verified, >0 unsatisfied, read failure unknown; fix PR missing or closed leaves the red unattributed; an open final is unsatisfied with `merged = false`.
    - Add, through `observeGoalCompletion` with a fixture red plus a matching committed claim: the final verifies and the receipt lists the attributed red (the blocker's regression test).
    - Add: a working-tree-only claim leaves the stored receipt unsatisfied and refresh prints the preview line; a `head`-only claim prints the "not done until they merge" line.
  - `test/goals-completion-receipt-store.test.ts`: v1 verified stays verified; v1 unsatisfied re-resolves as unknown; a v2 verified row with attributed reds re-resolves verified with its `redAttributions` intact.
  - `test/goals-completion-evidence.test.ts`, only if a call site there passed the removed `readinessJob` argument (none does at base: `:183`, `:543`).
  - `test/goals-doctor.test.ts`, only the stored-receipt cases, which offline doctor re-resolves through `storedGoalCompletion`:
    - `:296-420`. DN-12 removes the "accepted-head declaration digest unobserved" reason, and DN-9 removes the `gating evidence yeet-verdict "merge-ready" unknown` reason. These rows are v1 and verified, so DN-8 returns them as stored, and they print no completion finding. The rewritten rows are a v1 verified row (no finding), a v2 row with only `hosted-required-checks` evidence (unknown: "no hosted-review-threads evidence"), and a v2 row with an unknown `yeet-verdict` beside both hosted kinds (no finding).
    - `:533-700`. These v1 `unsatisfied` and `unknown` rows now re-resolve as `unknown` with the DN-8 note. Each case moves to a v2 row so it keeps its intent (a known red stays `completion-gate-unsatisfied`; unreadable merge facts and `rule-suite-unavailable` stay `completion-gate-unknown` with their wording), and one v1 row asserts the DN-8 note.
- Green on its own: `DR:1503` passes four arguments and keeps compiling. Every test that re-resolves a stored receipt is in this step's command; S6 takes over `goals-doctor.test.ts` afterwards.
- Test: `bunx --bun vitest run test/goals-completion.test.ts test/goals-completion-observation.test.ts test/goals-completion-receipt-store.test.ts test/goals-completion-evidence.test.ts test/goals-doctor.test.ts && bun run check`

### Group 4

**S6. Closeout check, views and doctor (after S4).**
- Files:
  - new `src/commands/Goals/CloseoutCheck.ts` (sections 1.8 and 2.7)
  - `src/commands/Goals/Goals.schemas.ts` (the view part of 1.7)
  - `src/commands/Goals/Completion.ts`:
    - Delete `projectGoalLifecycle` and `readGoalLifecycle` (`C:1017-1099`).
    - Rekey `goalCloseoutView`, `readGoalCloseoutView` and `readGoalCloseoutViews` on `closeout` (`C:1126-1199`); `readGoalCloseoutViews` filters per DN-19.
  - `src/commands/Goals/Doctor.ts`:
    - The 2.6 mapping over `readGoalCloseoutCheck`, the legacy-row pre-check, and `GoalCompletionIoLive` provided once per online run.
    - `completedManifest` drops its proposal clause (`DR:1249`); also `DR:816`, `DR:1261` and `DR:1507`.
    - Delete the adoption block (`DR:1514-1543`) and `closeout-adoption-pending` from the kind list (`DR:142`).
    - Rewrite the module doc (`DR:1-15`).
  - `src/commands/Goals/Bootstrap.schemas.ts` (`:768`: remove the old key, add `"closeout-unverified": ["doctor-clean"]`)
  - `src/commands/Goals/Graph.ts`: `:100-113` passes manifests only; `operativeStatuses` is optional (`Graph.projection.ts:171-183`, per `map-schema-status-doctor.md:241`). Also `:229-236`.
  - `src/commands/Goals/Graph.projection.ts` (`:762`)
  - `src/commands/Session/Session.command.ts` (`:215-239`)
  - new `test/goals-closeout-check.test.ts`: every classification branch of 2.7 through the pure `classifyGoalCloseout`; `goalCompletionTransient` for each transient and structural reason; `readGoalCloseoutCheck` through the fixture port (pre-check skip beyond the window, observation inside it); `GoalCloseoutChecker.layerTest`; `GoalCloseoutCheckerLive` under the fixture port; `goalCloseoutShard`
  - `test/goals-doctor.test.ts` (S4 has already rewritten the stored-receipt cases at base `:296-420` and `:533-700`):
    - Remove the proposal cases `:207-252`, `:421-532` and `:759-831`.
    - `:253-293` stays advisory offline.
    - One case per row of the 2.6 table, a closed-unmerged final blocking, an in-window transient advisory, the ratchet exit 1 with the key carrying #N, and offline never blocking.
  - `test/goals-graph.test.ts` (`:11`, `:15`, `:449-490`)
  - `test/session-ledger.test.ts` (`:480-507`, plus the DN-19 filter)
  - `test/goals-completion.test.ts` (view blocks `:518-730`)
  - `test/goals-completion-observation.test.ts` (online doctor, `:971-1010`)
- Test: `bunx --bun vitest run test/goals-closeout-check.test.ts test/goals-doctor.test.ts test/goals-graph.test.ts test/session-ledger.test.ts test/goals-completion.test.ts test/goals-completion-observation.test.ts && bun run check`

### Group 5

**S9. Batch migration (after S4, S5, S6, S7).** Procedure in section 5.
- Files: the nine non-archived migration packets' `ops/manifest.json`,
  `README.md` and new `decisions/*.md` files, plus the SPEC.md and PLAN.md
  blocks regenerated by `goals decisions write`; any in-window committed
  closeout outside the 11 that §5 step 7 treats; and
  `goals/goal-closeout-hosted-verification/history/migration-<date>.md`,
  which holds the outcome table. The two archived tombstones are not
  written (DN-23).
- The claims reader counts committed files only (DN-6). The agent writes the
  files and leaves the tree dirty; the orchestrator commits them, and the
  step's final refreshes and its tests run on that commit.
- Test (on the committed S9 state):
  - `bun run beep goals doctor` (offline, 0 new blocking)
  - `bun run beep goals doctor --online` (0 introduced blocking)
  - `jq -e 'has("proposedCloseout")' goals/*/ops/manifest.json` must print no `true`
  - `cd packages/tooling/tool/cli && bunx --bun vitest run test/goals-manifest-capabilities.test.ts test/goals-graph.test.ts test/goals-ops-typecheck.test.ts`

### Group 6 (∥, after S9)

**S10 ∥. Post-migration enforcement: remove `proposedCloseout`, guard the raw key, wire the sweep trigger.**
- Files:
  - `src/commands/Goals/Goals.schemas.ts` (the removal list in 1.7)
  - `src/commands/Goals/Completion.ts` (digest `C:301` reads `gate.closeout` under the old label `proposedCloseout`, per DN-10; `refresh` clears the shard row on verified, 2.8)
  - `src/commands/Goals/SetStatus.ts` (drop the `GoalProposedCloseout` type import; the raw-key read and deletion stay)
  - `src/commands/Goals/Doctor.ts` (the raw-key `manifest-invalid` guard, 2.6)
  - `src/commands/Yeet/internal/Retire.ts` (`touchedPacketsOnBranch`, `checkTouchedCloseouts`, `renderCloseoutChecks`, the `renderActivePackets` wording)
  - `src/commands/Yeet/internal/Porcelain.ts` (the call in `retireThenSweep` and both print paths)
  - `src/commands/Yeet/internal/Retire.schemas.ts` (`closeoutChecks`)
  - `test/goals-completion.test.ts` and `test/goals-completion-observation.test.ts` (`:1110`, residual proposal fixtures; refresh clears the row)
  - `test/goals-set-status-stream.test.ts` (a raw legacy key still binds its own final)
  - `test/goals-doctor.test.ts` (raw key gives blocking `manifest-invalid`)
  - `test/yeet-sweep-retire.test.ts` (through `GoalCloseoutChecker.layerTest`: a blocking check appends one P0 row to the clone inbox and the report says so; a verified check acknowledges an earlier row; a transient check prints an advisory; `--plan` runs no check; the exit status stays 0)
  - `test/yeet-sweep-schemas.test.ts` (a v2 report without `closeoutChecks` still decodes)
  - `test/yeet-scripted-process.test.ts` (`touchedPacketsOnBranch` next to the existing `activePacketsOnBranch` case at `:1390-1420`: an archived or completed packet is touched but not active)
  - `standards/schema-catalog/@beep/repo-cli.generated.jsonc` (from `bun run beep lint schema-catalog --write`; it also picks up S1-S6 schema changes)
- Test: `rg -n 'proposedCloseout|GoalProposedCloseout' packages/tooling/tool/cli/src` shows only the digest label, the raw-key read and deletion in `SetStatus.ts`, and the doctor guard; `bunx --bun vitest run test/goals-completion.test.ts test/goals-completion-observation.test.ts test/goals-set-status-stream.test.ts test/goals-doctor.test.ts test/yeet-sweep-retire.test.ts test/yeet-sweep-schemas.test.ts test/yeet-scripted-process.test.ts && bun run check && bun run beep lint schema-catalog`

**S11 ∥. Launcher and checklist rewrite (after S8, S9).**
- Files, all in packets whose `initiative.status` is `active` or `paused` **after** the migration (about 90: 98 today, less the 8 adopted proposals), this packet included:
  - `goals/*/GOAL.md`: the done paragraph (§4.1). This packet's GOAL.md Scope placeholders (`GOAL.md:23-24`) are filled from SPEC.md here.
  - `goals/*/PLAN.md`: the Bootstrap closeout checklist's step 3 (the old `BS:434-437` text, from "3. Update `README.md`" through "from a proposal.") becomes the §4.2 text. At base, 26 packets that stay active or paused after S9 carry it verbatim.
  - Hand edits to the remaining live root prose of those packets that still tells an agent to write `proposedCloseout` or open a separate adoption PR. At base (outside generated blocks) that is 4 PLAN.md files (agent-rating-critique-fixes, knowledge-freshness-audit, turborepo-cache-trust-observability, turborepo-quality-cache-adoption), 4 SPEC.md files (the same four packets) and `turborepo-quality-cache-adoption/{PAUSED-HANDOFF,OPERATIONAL-SCOPE}.md`. This packet's own files describe the removal and keep their text.
  - Never edited: generated `beep:decisions` blocks, `decisions/`, `history/`, `research/` and `data/`, and completed, reference or superseded packets (the 8 adopted migration packets included). Those keep their bytes. `goals/_template/` carries `initiative.status: active` but belongs to S8 (it uses `<slug>` placeholders), so the script skips it.
- Procedure: the rewrite contract in `map-template-docs.md:513-534`, extended to the PLAN.md block, run as an idempotent scratchpad script (a second run changes nothing) that is not committed and is kept for the S12 re-run. The T762 preamble shrinks. The ~10 over-budget packets get hand trims (DN-21). The live-prose hand edits come from `rg -l 'proposedCloseout|adoption PR|packet-state PR'` over the active and paused packets with the exclusions above.
- Test:
  - every touched GOAL.md has `Str.length ≤ 4000`, and `LC_ALL=C wc -m` is reported as a warning
  - `bun run beep goals doctor` (no `goal-md-oversize`, no `decision-log-drift`)
  - the `rg` census above, run over the active and paused packets and reviewed by hand, shows no remaining instruction to write `proposedCloseout` or open a separate adoption PR outside this packet
  - `git diff --check -- goals`
  - a second script run produces an empty diff

Disjointness, Group 6: S10 touches only `src/**`, `test/**` and the schema
catalog. S11 touches only live `.md` prose under `goals/*/`, and never a
manifest, a test or a source file.

Why S11 also edits PLAN.md: after S10, a raw `proposedCloseout` key is a
blocking `manifest-invalid`. An agent that follows an unrewritten PLAN.md
step 3 ("a typed `proposedCloseout`") would write the key and turn its own
packet red.

### Group 7 (orchestrator)

**S12. Package proof and publish.** No source files.
1. Merge `origin/main` into the lane. For every lane-modified file of a
   packet that is not `active` or `paused` on `origin/main` (closed by `main`
   while PR A was open), `git checkout origin/main -- <file>` and confirm
   `git diff origin/main -- goals/<slug>` is empty: DN-21 keeps closed
   packets' bytes by their status on `main`, not at base. Re-run the S9
   `proposedCloseout` census and the S11 script; migrate any proposal or
   rewrite any launcher that arrived from `main` (including packets `main`
   added), and treat any new in-window committed closeout that
   `goals doctor --online` reports. While PR A is open, the orchestrator
   holds old-route adoption PRs for the 11 migration packets. The current
   list is in `history/migration-2026-11-13.md`.
2. `bun run beep goals manifest --write` (this packet's `researchReports`)
3. `bun run beep quality package-verify @beep/repo-cli`
4. `bun run docgen:local`
5. `bun run beep lint schema-catalog`
6. `bun run beep goals decisions check`
7. `bun run beep skills update --check`
8. `bun run beep yeet open --body-file <md>` opens the draft with
   `ready-for-heavy`. Then S13 steps 1-3 land in the content-final wave.
9. On the content-final head: `bun run beep yeet final-check --skip coverage=<reason>`
   (repo-cli coverage is a 1191.7 s shard, `map-coverage.md:15-19`), the
   reason named in the PR body via `yeet gh pr body`, then `yeet ready`,
   then `yeet monitor --until-ready --detach`.

**S13. This packet's closeout.** See section 6.

---

## 4. Exact text

### 4.1 Launcher done paragraph (`BS:333-338`)

Template literal:

```ts
The final PR carries the reflection and writes \`closeout\` naming itself. Done
only when this passes and \`goals completion refresh --slug ${input.slug}\` prints
verified, when this passes under an operator ruling in \`decisions/\`, or when an
operator blocker is reported with evidence:
\`git show origin/main:goals/${input.slug}/ops/manifest.json | jq -e '.closeout.status == .initiative.status'\`
`;
```

Rendered, it is 367 characters plus twice the slug. T2703 is 437 plus three
times the slug, so every T2703 packet shrinks. The same text, with `<slug>`,
replaces `goals/_template/GOAL.md:61-63` and is written into every active or
paused GOAL.md in S11.

### 4.2 PLAN checklist step 3 (`BS:434-437`, and `goals/_template/PLAN.md:47-48` with `<slug>`)

```text
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status <slug> completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug <slug>` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).
```

### 4.3 `AGENTS.md:388-396`

```text
- Goal closeout is one PR: once the final PR is open,
  `goals set-status <slug> completed-retained` writes the `closeout` record
  naming it, and that commit ships with the work and the reflection. After
  the merge, `goals completion refresh --slug <slug>` verifies it from hosted
  facts alone, at any later time: merged; every required check green at the
  merged head, or each red named with its cause and fix PR in a committed
  `decisions/` file (`redAttribution`); no outstanding review thread.
  `goals doctor --online` and `yeet sweep --retire` (a P0 inbox row) block on
  a merged, unverified closeout. A goal is done once `origin/main`'s manifest
  has `closeout.status == initiative.status` and refresh prints verified, or
  a `decisions/` file records the operator's ruling (`operatorRuling`);
  GitHub lists rule suites for one month, so an older unverified final needs
  that ruling.
```

AGENTS.md is in the prompt-cache prefix (`AGENTS.md:436-438`), so this is
its only edit in PR A.

### 4.4 `.claude/skills/closeout/SKILL.md:76-79`

```text
- `Verify the <slug> closeout (Recommended)` — after a goal's final PR merges:
  `goals completion refresh --slug <slug>`, then `goals doctor --online`.
  `yeet sweep --retire` runs the same check and leaves a P0 inbox row when it
  fails. A red required check needs a committed `redAttribution` decision
  file naming it with its cause and fix PR; a final GitHub can no longer
  verify needs an `operatorRuling` decision file. A goal is not done, and
  `/goal` must not stop, until it verifies or an operator ruling closes it.
- `Archive the <slug> packet (Recommended)` — after the closeout verifies:
```

The rest of the archive bullet is unchanged.

### 4.5 `.claude/skills/reflect/SKILL.md:24-30`

```text
- **Automatic (P3 Close):** the agent closing a goal packet writes one before
  running `goals set-status <slug> completed-retained` in the final PR. That
  is the canonical completed status; legacy `complete` is migration input,
  not a live lifecycle value. Packets with `reflectionRequired: true` are
  gated, and a committed closeout also keeps the packet in the reflection
  gate. A missing or invalid required reflection blocks closeout.
```

### 4.6 `goals/README.md`

- `:174`: "once the adoption PR merges" becomes "once the closeout verifies".
- `:203-240` becomes:

```text
A goal is **achieved** only when hosted facts verify its final delivery PR:
the PR merged; every required check at the merged head succeeded (the
newest run per required context; `skipped` and `neutral` count), or each red
is named in a committed `decisions/` file's `redAttribution` block with its
cause (`inherited`, `introduced` or `mixed`) and fix PR; and no review thread
is outstanding. The local Yeet verdict is not read.

Closeout is one PR. Once the final PR is open, run
`bun run beep goals set-status <slug> completed-retained`. It writes
`"closeout": { "status": "completed-retained", "finalPullRequest": 1234 }`
with `initiative.status` to match and marks #1234 `final` in
`completionGate.pullRequests`. A PR that already merged binds only with
`--final-pr 1234 --adopt-merged`. After the merge,
`bun run beep goals completion refresh --slug <slug>` re-derives the facts at
any later time and appends a workstation receipt. `goals doctor --online`
reports a merged, unverified closeout as the blocking `closeout-unverified`,
and `yeet sweep --retire` raises the same check as a P0 inbox row for the
packets the merged branch touched. GitHub lists rule suites for one month; a
final it can no longer verify closes only through an operator ruling,
recorded as an `operatorRuling: { finalPullRequest: 1234 }` block in a
`decisions/` file.
```

- `:273-277`: add "`wc -m` counts bytes under `LC_ALL=C`; doctor measures
  characters" (`map-template-docs.md:79-83`).

### 4.7 `.claude/skills/yeet/references/sweep-retire.md:70-77`

```text
  Both the plan and the report name every goal packet the retired branch
  touched whose lifecycle is still `active` and whose manifest carries no
  `statusNote` or `blockedBy` saying why it stays open (`[yeet] packet still
  active after merge: goals/<slug> …`, `activePackets` in JSON). If the merged
  PR was the goal's final, bind it in a follow-up PR with
  `bun run beep goals set-status <slug> completed-retained --final-pr <n> --adopt-merged`;
  otherwise record a `statusNote`. `bun run beep goals doctor` applies the
  same deferral and keeps flagging the packet as `active-after-merge` while a
  merge commit cites the slug and nobody touches it.

  The report (not `--plan`) also checks every touched packet whose
  `origin/main` manifest has a committed `closeout`, with the same online
  classification as `goals doctor --online` (`closeoutChecks` in JSON). A
  merged, unverified closeout appends a P0 inbox row to the owning clone
  (shard `goal-closeout:<slug>#<n>`) and prints `[yeet] P0
  closeout-unverified goals/<slug> #<n>: …`; the exit status stays 0 because
  the lane is already gone. Fix it with a `redAttribution` or
  `operatorRuling` decision file on `main`; `goals completion refresh --slug
  <slug>` printing verified in that clone clears the row. A transient read
  failure or a still-running required check prints an advisory instead.
```

---

## 5. Migration procedure (S9)

This runs from the PR A branch with S1-S7 in place. Every refresh is a
hosted read. Outcomes are recorded in `history/migration-<date>.md`
(numbers, file names and digests only).

Rules:

1. **Refresh last.** The declaration digest covers `completionGate`
   (`pullRequests` included) and the closeout slot (`C:292-304`). Run each
   packet's final refresh after every manifest write for that packet, and
   record in the history note that the stored receipt matches the
   post-migration digest.
2. **Committed claims only.** Attribution files count once committed
   (DN-6). Before the orchestrator's commit, refresh prints the preview line;
   the final refresh runs after the commit.
3. **Tombstones are read-only** (DN-23).
4. **Idempotent.** Each command is safe to repeat; S12 re-runs the census
   after the last `origin/main` merge.

Steps:

1. Run `bun run beep goals completion refresh --slug <slug>` for each packet
   below, as a first read.
2. For each red packet:
   1. Collect the evidence: `gh pr checks <n>` and the red episode's
      `unblocks-main` PR.
   2. Write the attribution with
      `bun run beep goals decisions add <slug> --title "Final #N merged over <contexts>" --reversal "Delete this file; refresh reports #N unsatisfied again." --final N --attribute-red "<context>=<cause>#<fix>" … --body "<evidence>"`,
      following DN-24.
3. Apply the `pullRequests` fixes (DN-22).
4. Adopt with `bun run beep goals set-status <slug> completed-retained`. The
   writer takes the proposal's own final (DN-17 rule 1).
5. `goals decisions add` regenerates the SPEC.md and PLAN.md blocks; run
   `bun run beep goals decisions check`.
6. The orchestrator commits. Then run the final refresh for every packet;
   each non-archived packet must print `verified`, or the history note
   records why not.
7. Run `bun run beep goals doctor --online`. Any **in-window committed
   closeout outside the 11** that classifies `unverified` gets the same
   treatment in this PR: an attribution file, or an `operatorRuling` file
   only where a recorded operator ruling exists (cite it). The 26 existing
   closeouts include finals from early November
   (`map-schema-status-doctor.md:138-140`); #2985 (three packets) and #3132
   used the status-only bypass.
8. Prove the census: no manifest has `proposedCloseout`.

| Packet | Final | Expected under PR A rules | Action |
| --- | --- | --- | --- |
| citation-extraction-engine | #2966 | 4 reds: Heavy / Check, Heavy / Test Integration, Heavy / Docgen, Heavy / Doctest were cancelled before the merge (`map-migration.md:183-192`) | Attribution decision. Lead: `goals/citation-extraction-engine/SPEC.md:396-398` names #2994 as the `unblocks-main` PR for ep70 (verify it). Adopt, commit, refresh. |
| goal-packet-conflict-free-appends | #2869 | clean (`map-migration.md:194-202`) | Add #2874 as `supporting` (DN-22), adopt, refresh. |
| hold-ledger | #2755 | clean under DN-1 and DN-2: Test Unit went green after the merge; the bypass is recorded (`map-migration.md:204-220`) | Fix `pullRequests` (`goals/hold-ledger/ops/manifest.json:40-43`): one `{2755, final}`, add `{2865, supporting}`. Adopt, refresh. |
| lejeune-demo-corpus-and-ontology | #2756 | clean under DN-1 and DN-2 (`map-migration.md:222-227`) | Adopt, refresh. |
| merge-queue-lab | #3112 | clean, 7 skipped (DN-3) | Adopt, refresh. |
| packet-archive-mechanics | #2998 | clean | Adopt, refresh. |
| research-intake-2026-11 | #2963 | 4 reds: queued at merge, cancelled 17 min later (`map-migration.md:241-248`) | Attribution decision (DN-24), adopt, commit, refresh. |
| scripts-to-beep-cli | #3027 | clean, 7 skipped | Adopt, refresh. |
| alchemy-vault-sync-slice | #3132 | clean; `closeout` is already committed (`goals/alchemy-vault-sync-slice/ops/manifest.json:227-230`) | Refresh only (writes a v2 receipt). |
| beep-effect-web-alchemy (archived) | #2583 | clean; one resolved thread | Receipt-only refresh. No writes (DN-23). |
| literal-kit-subset-algebra (archived) | #2080 | 7 reds under ruleset version 53390820: 5 Heavy runs cancelled, then Lint and Test Unit failed (`map-migration.md:274-290`) | Receipt-only refresh. It cannot verify without an attribution file, so it stays unverified and the history note lists it (DN-23). |

---

## 6. How this packet closes by the new route (S13)

1. PR B (lane `final-check-coverage-scope`, D-cov) merges first. PR A records
   it as `supporting` in this packet's `completionGate.pullRequests` (DN-26).
2. At content-final, `/reflect goal-closeout-hosted-verification` writes
   `history/reflections/<date>-<agent>.md`. Then run
   `bun run beep lint reflection-artifacts`.
3. Once `yeet open` has opened PR A as a draft (S12 step 8), run
   `bun run beep goals set-status goal-closeout-hosted-verification completed-retained`.
   It resolves PR A from the branch, writes `closeout` naming PR A, flips
   `initiative.status`, `lifecycle` and the README Lifecycle line, and marks
   PR A `final`. Set the P0-P4 phase statuses in the same commit and push it
   in the content-final wave.
4. S12 step 9: scoped `yeet final-check --skip coverage=<reason>`, then
   `yeet ready`, then `yeet monitor --until-ready --detach`, then merge. The
   operator may also hand-merge (D-hand).
5. After the merge, from a checkout at `origin/main`, run
   `bun run beep goals completion refresh --slug goal-closeout-hosted-verification`.
   It must print `verified`. A red needs only a decisions-only PR with a
   `redAttribution` block (D-red), not a re-final; refresh must print plain
   `verified` once that PR merges. Then run
   `bun run beep goals doctor --online` and confirm there is no
   `closeout-unverified`. `yeet sweep --retire` from PR A's lane runs the
   same check for every packet PR A touched and must leave no P0 row.
6. Done when
   `git show origin/main:goals/goal-closeout-hosted-verification/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
   passes **and** step 5 printed verified (exit 1 of 4.1).

---

## 7. Changeset

None. `@beep/repo-cli` is ignored (`.changeset/config.json:13`) and
`private: true`. No other workspace package's `src` changes: `@beep/github`
(`RT`) and `@beep/git` are used, not edited, and `apps/labs/lane-cockpit` is
untouched (DN-19).

---

## 8. Test plan

| Layer | Cases | Owner step |
| --- | --- | --- |
| Schema decode | new frontmatter keys accepted on `decision` and rejected on `checkpoint`; duplicate contexts; fix equal to final; receipt v1 and v2 rows decode; a closeout without `yeet-verdict` decodes | S1 |
| Claims | pure matching, conflicts, sources, committed versus preview; live layer over a temp git repository | S2 |
| Evaluator | DN-1 newest run (pending at merge, then green; post-merge rerun supersedes; still running is unknown); DN-2 bypass with every context green verifies with `ruleSuiteBypassed` (`goals-completion-evidence.test.ts:266-280`, the `complete` case of `:301-315`, and `goals-completion.test.ts:221-263` flip); DN-3 skipped; attributed red and attributed missing context verify; an unattributed red stays unsatisfied; gaps win over attributions; the gap-driven deleted-ruleset cases keep their outcomes (`goals-completion-evidence.test.ts:290-300`, `:329-360`, `:361-375`, `:420-444`), and so do the newest-run cases at `:472-511` | S3 |
| Port | thread read through the fixture; memo once per key, failure retried; `GoalCompletionIoLive` built and failing cleanly under a scripted spawner; skip after 31 days | S3 |
| Observation and outcome | the blocker regression (fixture red plus claim verifies through `observeGoalCompletion`); local verdict ignored; threads 0, >0 and failed; fix PR missing or closed; open final; v1 rules from DN-8; v2 re-resolution keeps `redAttributions`; working-tree preview; `head`-only line; no `--readiness-job` flag; offline doctor's stored-receipt wording under DN-8, DN-9 and DN-12 | S4 |
| Writer and resolver | the S5 list; resolver live layer under a scripted spawner; flag-shape refusals before any read or spawn | S5 |
| Closeout check and doctor | every 2.7 branch; every 2.6 row; ratchet exit 1 on a new `closeout-unverified #N`; offline never blocks; session view filter | S6 |
| Readers | INDEX row, archive tombstone, reflection gate keyed on `closeout` | S7 |
| Templates | golden fixtures regenerated and reviewed; `skills update --check` | S8 |
| Migration | outcomes recorded; doctor online 0 introduced; jq census | S9 |
| Enforcement | `rg` census; raw-key guard; sweep trigger rows and acks; `touchedPacketsOnBranch`; report decode; schema catalog | S10 |
| Launchers and checklists | doctor `goal-md-oversize` clean; per-file `Str.length`; live-prose `rg` census; idempotent second run | S11 |
| Package | `quality package-verify @beep/repo-cli`, `docgen:local`, scoped local final-check, hosted CI | S12 |

No step runs the full repo suite locally. Hosted CI is the authoritative
proof. `yeet ready` refuses without a passing local `yeet final-check`
receipt for the head, so the orchestrator runs it scoped on the
content-final head with `--skip coverage=<reason>` under the load cap and
names the skip in the PR body (S12 step 9).

New source files (`RedAttribution.ts`, `FinalPullRequest.ts`,
`CloseoutCheck.ts`) have a test for every exported unit, live layers
included, so the coverage ratchet sees no uncovered unit.

---

## 9. Risks

1. **DN-1 can launder and is not monotonic.** A rerun after the merge can
   turn a red green. A later rerun that flakes can turn a verified final
   unsatisfied when doctor or the sweep observes online. Stored verified
   receipts stay sticky (`C:979-985`), but the online checks read live.
2. **The `GITHUB_TOKEN` claim is unverified.** DN-14 assumes a workflow
   token cannot read rule suites. If it can, a hosted online job becomes
   cheap and DN-14's reversal should be revisited.
3. **The first online doctor run and the first sweep can go red.** Existing
   in-window committed closeouts outside the 11 may classify `unverified`,
   among them #2985 (three packets) and #3132. S9 step 7 treats them in the
   same PR; S12 step 1 repeats it after the last `main` merge.
4. **literal-kit-subset-algebra stays unverified.** As an archived tombstone
   it gets no attribution file (DN-23), and doctor raises nothing because it
   has no committed closeout. Only an operator ruling recorded in the
   archive repository could change that, and no reader looks there.
5. **The launcher and checklist batch conflicts with other lanes.** It
   touches about 90 GOAL.md files, 30 PLAN.md files and a few other live
   docs that other lanes edit. Land it in one push, re-run the script after
   the last `main` merge, and tell open lanes to merge `main`
   (`AGENTS.md:205-212`). Ten launchers need hand trims
   (`map-template-docs.md:438-469`).
6. **Fixture regression.** `test/support/CompletionIo.ts` must default
   `reviewThreads` to an empty list and fill `state` from `merged`.
   Otherwise every existing observation fixture turns unknown or fails to
   decode.
7. **Online cost.** After the migration about 35 committed closeouts plus 8
   legacy rows with a final (2 of them archived) are observed online. Each
   costs one `pulls/{n}` REST read for the 28-day pre-check; only finals
   merged inside the window (roughly a dozen at any time) take the full
   observation of about 20 REST calls and one GraphQL thread read. The
   memoized listing (DN-25) bounds the rule-suite pages. GraphQL is the
   scarce budget (`internal/github/GithubRest.ts:5-14`). A sweep after PR A
   itself checks every packet PR A touched, but only those with a committed
   closeout cost more than a manifest read.
8. **A view shape change without a version bump** (DN-19). An unknown
   external consumer of `goalCloseouts` would break.
9. **An agent can author an `operatorRuling` block.** It counts only once
   committed (DN-6). The trust model is that of any decision file: the
   operator reviews asynchronously, and doctor and the sweep name the file.
10. **A `head`-only claim can still store a verified receipt** from a PR
    that never merges. Refresh says so in its output, and the online checks
    run from `main` ignore the claim, so the closeout keeps blocking there.
    This follows from reading the ruling's "PR head being verified" as the
    checkout's `HEAD`. If it means the final PR's own head instead, the
    `head` source reads the final's head SHA (`GoalCompletionPull` already
    carries it) rather than `HEAD`. Once the final has merged, that file is
    also on `origin/main`, so the source collapses to `origin-main` and
    this risk goes away. The cost is that #2966 and #2963 store verified
    receipts only after PR A merges, and the §5 history note says so. The
    change is one ref argument in the reader plus DN-6's wording.
11. **PR A runs repo-cli coverage locally only if asked.** It edits repo-cli
    `src`, so local coverage would run the full repo-cli shard; the scoped
    final-check skips it by name and hosted CI proves it.
12. **A non-grandfathered `completed-retained` manifest with no `closeout`
    is not blocked.** Such a hand edit escapes the new blocking finding;
    only the legacy advisories catch it (`DR:1253-1277`). The writer cannot
    produce that state.
13. **A P0 row can wait unseen.** The sweep exits 0, so the row surfaces
    only through the inbox hook in the next session in that clone.
14. **This packet's `researchReports` drift** is a blocking doctor finding
    until `bun run beep goals manifest --write` runs (S12 step 2; also run
    during this design revision).

---

## 10. Critic findings and where they landed

| Finding | Severity | Resolution |
| --- | --- | --- |
| Attributed reds could never verify (`hostedRequiredOutcome`) | blocker | 2.5 blocker fix; S4 regression test |
| Stored re-resolution dropped attributions; three names for one datum | major | 1.3 single field `redAttributions`; 2.5 explicit mapping; S4 receipt-store test |
| Transient failures and running checks blocked | major | DN-13, 2.7 transient/structural split |
| `Effect.cachedFunction` absent; v4 Cache replays failures | major | DN-25, 2.1 `Cache.makeWith` with failure TTL zero; S3 test |
| Migration wrote into archived tombstones | major | DN-23 receipt-only; §5 table |
| Blocking finding never reached automatically | major | DN-14 sweep trigger; 2.8; S10 |
| Nothing caught a stale `proposedCloseout` after S10 | major | DN-17 raw-key read; 2.6 blocking `manifest-invalid`; S10 |
| `static layerLive` would cycle | major | DN-25 `GoalCompletionIoLive` in `CE`; `CESv` type-only |
| Live adapters untested | major | S2, S3, S5, S6 live-layer tests; §8 |
| Exhaustive Record over finding kinds | minor | 2.6; S6 `BSS:768` |
| `observeGoalCompletion` signature broke `DR:1503` at S4 | minor | 2.5 default parameter |
| `ruleSuiteBypassed` decode-only default broke `.make` | minor | 1.4 both defaults |
| Working-tree claims could write a sticky verified receipt | minor | DN-6 ruling: committed claims only |
| Closed, unmerged final had no finding | minor | 1.6 `state`; 2.7 blocking |
| `--final-pr` accepted MERGED in the normal flow | minor | DN-17 `--adopt-merged`; rule (3) refusal |
| Online cost understated | minor | 2.6 legacy pre-check; risk 7 |
| Session open printed every closeout | minor | DN-19 filter |
| DN-20 overrode D-done silently | minor | DN-20 ruling; its decision file states the amendment |
| Refresh before the closeout write changed the digest | minor | §5 rule 1 (refresh last) |
| A never-reported required context could not be attributed | minor | DN-4 `missing` |
| DN-1 rationale cited #3132 | minor | DN-1 rewritten |
| AGENTS.md cited one line short | minor | 4.3 cites `:388-396` |
| §8 contradicted `yeet ready`'s receipt | minor | §8 and S12 step 9 |
| S9 and S11 were one-time rewrites | minor | §5 rule 4, S11 idempotence, S12 step 1 |

### 10.1 Step re-check against the base source

A second pass checked each step's file list against the tests that its
change breaks at base `7a462a27d4f`. Each gap moved into the step that
causes the breakage:

| Gap | Resolution |
| --- | --- |
| DN-2 flips `goals-completion.test.ts:221-263` (recovered red) and `goals-completion-evidence.test.ts:266-280` and `:301-315`, and §8 listed `:301-315` as unchanged | S3 owns all three; §8 names the cases that keep their outcomes |
| DN-8, DN-9 and DN-12 change offline doctor's stored-receipt wording (`goals-doctor.test.ts:296-420`, `:533-700`), and no step owned it | S4 owns those cases and runs `goals-doctor.test.ts` |
| `--adopt-merged` alone and a malformed `--final-pr` are flag-shape errors | S5 tests them in `packet-core-set-status-input.test.ts`, before any read or spawn |
| `goals-command.test.ts:9,18` imports names that S10 removes | S7 drops the imports |
| `touchedPacketsOnBranch` is a new export with no test | S10 tests it in `yeet-scripted-process.test.ts` |
| 30 active PLAN.md files and a few other live docs still prescribe `proposedCloseout`, which S10 makes a blocking `manifest-invalid` | S11 rewrites them (DN-21) |
| Whether a test's outer fixture survives `Effect.provide(GoalCompletionIoLive)` | 2.1: the layer builds in the caller's context, so the fixture is the port the memo wraps |
