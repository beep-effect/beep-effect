# Map: closeout schema, set-status and goals doctor under the 2026-11-12 rulings

This is read-only P0 research. Every claim cites `file:line` in this worktree
(branch `feat/goal-closeout-hosted-verification`, base `7a462a27d4f`). It
complements `map-completion.md`, which covers `Completion.ts` internals, and
`map-migration.md`, which covers the 17-packet batch. Where they overlap, this
map cites them rather than repeating them.

## Legend

Source paths are relative to `packages/tooling/tool/cli/src/commands/`; test
paths to `packages/tooling/tool/cli/test/`.

| Short | Path |
| --- | --- |
| `GS` | `Goals/Goals.schemas.ts` |
| `SS` | `Goals/SetStatus.ts` |
| `DR` | `Goals/Doctor.ts` |
| `C` | `Goals/Completion.ts` |
| `CE` | `Goals/CompletionEvidence.ts` |
| `BS` | `Goals/Bootstrap.ts` |
| `BSS` | `Goals/Bootstrap.schemas.ts` |
| `PI` | `Goals/PortfolioIndex.ts` |
| `AX` | `Goals/ArchiveExecution.service.ts` |
| `RA` | `Lint/ReflectionArtifact.ts` |
| `GR` / `GRS` / `GRP` | `Goals/Graph.ts` / `Goals/Graph.schemas.ts` / `Goals/Graph.projection.ts` |
| `SC` / `SSC` | `Session/Session.command.ts` / `Session/Session.schemas.ts` |
| `GC` | `Quality/internal/GithubChecks.ts` |
| `DS` | `Goals/Decisions.schemas.ts` |

Ruling ids follow `map-completion.md`: **D-onepr** (closeout is one PR; doctor
blocks on an unverified closeout), **D-mig** (batch migration, then
`proposedCloseout` leaves the schema), **D-hosted** (hosted facts only),
**D-red** (attributed reds verify), **D-after** (no pre-merge timing rule),
**D-hand** (operator hand-merges), **D-exit** (operator-ruling exit), **D-done**
(done = closeout adopted on main), **D-cov** (coverage scope; separate lane).

---

## 1. `Goals.schemas.ts` as it stands

### 1.1 Acceptance-evidence kinds

- `GoalAcceptanceEvidenceKind` = `hosted-required-checks | yeet-verdict |
  proof-fact | packet-history` (`GS:236-243`).
- `GoalAcceptanceEvidenceRef` = `{kind, ref, gating}`, with `gating` defaulting
  to `true` on decode (`GS:360-370`, default `GS:364`). `GoalEvidenceCheck` wraps
  a ref with outcome and observed head (`GS:412-423`).
- Where each kind gates today:
  - `yeet-verdict`, gating, is required by the schema for **any** closeout
    (`closeoutGateAdmits`, `GS:1537`) and by lifecycle projection (`C:1055-1071`).
    This is the ref D-hosted demotes to advisory.
  - `hosted-required-checks` makes a stored unknown receipt "definite"
    (`C:976`) and is required by projection (`C:1044-1054`).
  - `packet-history` refs are emitted only as non-gating sub-claims:
    accepted-declaration, draft-to-ready and review-window (`C:834-859`). An
    inferred `yeet-verdict "merge-ready"` sub-claim is always unknown and
    non-gating (`C:860-865`).
  - `proof-fact` has no consumer in these files.
- Live data: all 26 manifests with `closeout` and all 8 with `proposedCloseout`
  declare one gating `yeet-verdict` ref (jq census below). D-hosted should be
  applied in code (`closeoutGateAdmits` and the evaluator), not by editing
  manifests, because editing them changes the declaration digest (`C:300`;
  `map-migration.md` "Notes for the migration PR").

### 1.2 `completionGate` and `grandfathered`

- `GoalCompletionGate` (`GS:1062-1088`) fields: `operator`, `requiresPullRequest`,
  `requiresMergeable`, `statement`, `grandfathered` (`GS:1068`),
  `grandfatheredNote` (`GS:1069`), optional `pullRequests` with a
  one-`final` filter (`GS:1070-1081`), and optional `acceptanceEvidence` (`GS:1082`).
  The doc block defines grandfathered as "shipped before the gate was introduced on
  2026-06-30" (`GS:1040-1042`).
- Readers of `grandfathered`:
  - The schema forbids a closeout on a grandfathered gate (`GS:1536`).
  - Completion treats a grandfathered observation as verified (`C:198`), skips
    all reads for it (`C:650`, `C:656`) and carries the flag into stored receipts
    (`C:992`).
  - `goals completion refresh` skips grandfathered packets (`C:1229-1234`).
  - Doctor never treats them as completed (`DR:1245-1251`).
  - No ruling changes `grandfathered`, so it stays as it is. Census: 24
    `completed-retained` packets and 1 `reference` packet are grandfathered.

### 1.3 `proposedCloseout`, `closeout` and their checks

| Symbol | Lines | Notes |
| --- | --- | --- |
| `GoalProposedCloseout` `{status: "completed-retained", finalPullRequest}` | `GS:1276-1306` | Doc: "never completion evidence; ... set-status adopts it" (`GS:1281-1284`) |
| `GoalCloseoutRecord` (same shape) | `GS:1308-1339` | Doc says it is written only by set-status adopting a proposal (`GS:1313-1317`); description `GS:1336` |
| `GoalManifest.proposedCloseout` / `.closeout` | `GS:1783` / `GS:1784` | both `optionalKey` |
| `closeoutGateAdmits` | `GS:1533-1541` | not grandfathered, **and** a gating `yeet-verdict` exists, **and** any declared `final` PR equals `finalPullRequest` |
| `GoalProposedCloseoutCheck` | `GS:1543-1562` | proposal requires `initiative.status` active or paused (`GS:1552`) plus `closeoutGateAdmits` |
| `GoalCloseoutRecordCheck` | `GS:1564-1586` | record requires `initiative.status === record.status` (`GS:1574`), **no proposal** (`GS:1575`), plus `closeoutGateAdmits` (`GS:1576`) |
| Manifest `.check(...)` | `GS:1807` | self-cycle, proposal and record checks |
| `goalPullRequestRefs` | `GS:1849-1870` | `closing = proposedCloseout ?? closeout` (`GS:1850`) synthesizes a `final` ref when none is declared (`GS:1853-1856`) |

Unknown top-level keys are stripped on decode (`GS:1748-1750`). Once the field
is removed, a manifest that still carries a raw `proposedCloseout` (such as the
accepted head of an old final) decodes silently without it. See the digest trap
in section 4.1.

### 1.4 Verification views and renderers (all proposal-keyed)

| Symbol | Lines | Consumers |
| --- | --- | --- |
| `GoalCloseoutVerification` `verified \| unverified` | `GS:1341-1373` | SetStatus guard, Doctor adoption finding |
| `GoalCloseoutView {packet, operativeStatus, proposedCloseout, verification}` | `GS:1375-1406` | `GRS:583` (`goal-explain/v1`), `SSC:172` (`session-open/v1`) |
| `goalCloseoutVerification(proposal, status)` | `GS:1408-1434` | `C:1141`; tests |
| `renderGoalCloseoutView` ("verified via #N, adoption pending" or "proposed via #N, unverified") | `GS:1436-1472` | `DR:1524`, `GRP:762`, `SC:237` |
| `renderGoalCloseoutRecordView` ("verified via #N" or "committed via #N, unverified") | `GS:1474-1505` | `DR:1517-1522` |
| `renderGoalProposedCloseout` | `GS:1507-1531` | `PI:305`, `AX:761` |
| `renderGoalCloseoutRecord` | `GS:1588-1606` | `PI:306`, `AX:760` |

### 1.5 Receipt vs observation

`GoalCompletionReceipt` (`GS:1008-1033`) has **no `merged` field**. It has only
`merge: Option<GoalMergeResult>` (`GS:1021`) and `outcome` (`GS:1026`).
`GoalCompletionObservation` has `merged: Option<boolean>` (`C:93`). An open
(unmerged) final resolves to `unsatisfied` (`C:199`, early return `C:669-671`).
A failed PR read resolves to `unknown` (`C:657-660`). In a receipt, the only
way to tell "open" from "unreadable" is the outcome combined with `merge = None`.
That signal is fragile, and D-onepr needs it (section 6.2).

### 1.6 Census (`goals/*/ops/manifest.json`, jq, this worktree)

| status | closeout | proposedCloseout | grandfathered | pullRequests | count |
| --- | --- | --- | --- | --- | --- |
| completed-retained | no | no | no | no | 136 |
| active | no | no | no | no | 75 |
| completed-retained | no | no | yes | no | 24 |
| completed-retained | yes | no | no | yes | 16 |
| paused | no | no | no | no | 14 |
| completed-retained | yes | no | no | no | 10 |
| completed-retained | no | no | no | yes | 8 |
| active | no | yes | no | yes | 8 |
| other (superseded 3, reference 4, active+pullRequests 1) | | | | | 8 |

- The 26 closeout finals are #2319, #2320, #2324, #2326, #2334, #2357, #2476,
  #2488 (×2), #2586, #2618, #2655, #2656, #2676, #2696, #2787, #2812, #2858,
  #2882, #2885, #2893, #2940, #2985 (×3) and #3132.
- Most of these will be older than the one-month rule-suite listing within
  weeks. `map-migration.md` "Rule-suite listing window" gives dates for the
  newer ones.

---

## 2. `SetStatus.ts`: `adoptVerifiedCloseout` and its guards

- The writer pipeline runs `loadPacketSurfaces` (`SS:357-376`), then
  `closeoutTransition` (`SS:526`), then one JSONC rewrite plus a decode check
  (`SS:486-511`, decode `SS:502-509`). It then plans and commits the event
  stream (`SS:530`, `SS:539-548`) and writes the manifest, README and INDEX
  (`SS:550-552`).
- `closeoutTransition` (`SS:477-482`) dispatches on what the manifest holds:
  - With a proposal, it calls `adoptVerifiedCloseout` (`SS:421-450`):
    1. Target `active`/`paused` passes through with no closeout edit (`SS:430`).
    2. Any other target must equal `proposal.status`, otherwise it refuses with
       `GoalStatusInputError` (`SS:431-435`).
    3. It requires a **clone-scoped verified view** from `readGoalCloseoutView`
       (`SS:436-442`; reader `C:1159-1170`). Verification is therefore whatever
       receipts this workstation holds, never hosted facts at write time.
    4. The edits delete `proposedCloseout` and write `closeout` with the same
       status and final (`SS:443-449`).
  - With a committed record, it calls `reopenCommittedCloseout` (`SS:452-475`):
    the same status is a no-op (`SS:459`); `active`/`paused` turns the record
    back into a proposal (`SS:465-474`); anything else refuses (`SS:460-464`).
  - With neither, it returns `None` (`SS:482`). `set-status <slug>
    completed-retained` then flips the status and writes **no closeout record and
    makes no check**. #2985 and #3132 both used this bypass (section 5).
- The decode check (`SS:502-509`) is the only enforcement of
  `GoalCloseoutRecordCheck` at write time. The "verified" requirement lives
  only in `adoptVerifiedCloseout`.

---

## 3. `Doctor.ts`

### 3.1 Advisory vs blocking, and the baseline ratchet

- Severity is fixed when a finding is created. `finding()` builds the key as
  `<slug> <kind>[ <suffix>]` (`DR:253-266`). Severity is the literal set
  `blocking | advisory` (`DR:191-195`).
- `runGoalsDoctor` (`DR:1678-1745`) collects every finding (`DR:1707-1716`) and
  splits them by severity (`DR:1717-1718`):
  - Blocking findings are ratcheted against the baseline by
    `classifyGoalDoctorFindings` (`DR:326-342`, via `diffMembership`).
    *Introduced* findings fail with exit 1 (`DR:1736-1741`). *Inherited* findings
    print as non-fatal (`DR:1653-1656`). *Resolved* keys print a
    shrink-the-baseline nudge (`DR:1657-1660`).
  - Advisories only print (`DR:1652`).
- `--write-baseline` writes every current blocking key (`DR:1593-1609`,
  `DR:1720-1722`). The baseline lives at `goals/goals-doctor.baseline.jsonc`
  (`DR:94`) and is currently `findings: []`. The module doc says unsatisfied
  completion gates "never block" (`DR:11-13`).
- Hosted wiring: `package.json:426` runs `bun run beep goals doctor`, offline
  with no `--online`, as the `goals:doctor` lane. That lane is tier
  `cheap-gates`, family `repo-sanity`, wave `preflight` (`GC:975-981`), and its
  turbo task has `cache: false` (`turbo.json:5863-5871`). The Repo Sanity job has
  `permissions: contents: read` only (`.github/workflows/check.yml:207-208`).

### 3.2 Completion findings today (all advisory)

| Kind | Emitted at | Condition |
| --- | --- | --- |
| `completion-gate-unsatisfied` (git heuristic) | `DR:1253-1277` via `gitAdvisories` `DR:1279-1338` | completed (or proposed) packet, not grandfathered, no proposal, no `pullRequests`, and neither slug nor PR cited in 4000 subjects (`DR:1304`). Skipped on shallow or missing git (`DR:1284-1296`). Dropped for packets that also have a structured row (`DR:1711-1714`). |
| `completion-gate-unknown` (typed, no final) | `DR:1561-1573` | `pullRequests` declared without a `final` and `requiresPullRequest` |
| `completion-gate-unknown` / `-unsatisfied` (receipt) | `completionReceiptFindings` `DR:1462-1493`, severity `DR:1488` | receipt missing or not verified. Messages `DR:1468-1480`. |
| `closeout-adoption-pending` | `DR:1527-1543` | proposal view verified (`DR:1530`) |

- Eligibility for the structured path is `completedManifest`: status
  `completed-retained` **or** a proposal, and not grandfathered (`DR:1245-1251`).
- `phases-terminal-but-active` (blocking) exempts proposals (`DR:809-828`,
  exemption `DR:816`).

### 3.3 Online vs offline

- `--online` (`DR:1770-1773`) is threaded into `structuredCompletionAdvisory`
  (`DR:1697-1699`).
- **Online** calls `observeGoalCompletion` live and never writes a receipt
  (`DR:1502-1503`; pinned by `goals-completion-observation.test.ts:971-1010`).
- **Offline** reads stored receipts from the workstation store plus the legacy
  clone file (`DR:1504`; `C:949-996`). It returns no row when there is no
  receipt and no typed declaration (`DR:1505-1512`).
- Hosted CI has no receipt store, so offline CI prints `completion-gate-unknown`
  "No matching clone receipt" for every typed closeout (`DR:1476-1479`).
- Online today: an **open** final yields `unsatisfied` (`C:199`), which emits
  `completion-gate-unsatisfied` (`DR:1487`). D-onepr forbids that finding.

---

## 4. Every other reader or writer of `proposedCloseout`

`rg proposedCloseout packages scripts` finds 8 source files and 10 test files;
`scripts/` has none. Indirect consumers come through `GoalCloseoutView` and the
lifecycle readers.

| Site | Lines | Role | Change |
| --- | --- | --- | --- |
| Digest slot | `C:292-305` (`C:301`) | `proposedCloseout ?? closeout` keyed as `proposedCloseout` | read `closeout` only; **keep the canonical key label** so the 26 closeout digests and their receipts are unchanged (section 4.1) |
| `projectGoalLifecycle` | `C:1017-1073` | proposal plus verified receipt projects to `proposal.status` | delete; status is declared |
| `readGoalLifecycle` | `C:1088-1099` | caller `GR:100-113` feeds `compileCapabilityProjection` | delete; `operativeStatuses` is optional (`GRP:171-183`) |
| `goalCloseoutView` / `readGoalCloseoutView` / `readGoalCloseoutViews` | `C:1126-1144` / `C:1159-1170` / `C:1185-1199` | proposal view | rekey on `closeout` (view = record + outcome) |
| `adoptionHint` | `C:1209-1216`, call `C:1249` | "next: set-status ..., then merge that packet-state PR" | delete, or replace with a remediation hint for unverified outcomes |
| `PortfolioIndex` row | `PI:297-308` | proposal rendered before record | record only (`goals/INDEX.md` is gitignored, `.gitignore:127`) |
| Archive tombstone | `AX:759-763` | record, else proposal | record only |
| Reflection gate | `RA:39`, `RA:269-285` | proposal forces `reflectionRequired` and supplies the status | record only |
| GOAL.md template | `BS:333-338` | "Ship proposedCloseout ... packet-state PR" | rewrite (section 7.4) |
| PLAN.md checklist | `BS:434-437` | "a typed `proposedCloseout` ..." | rewrite |
| Finding-kind requirement map | `BSS:752-793` (`BSS:768`) | exhaustive `Record<GoalDoctorFindingKind, …>` | drop `closeout-adoption-pending`; add the new blocking kind |
| `MODELED_GOAL_MANIFEST_KEYS` | `BSS:750` | `R.keys(GoalManifest.fields)` feeds the `Adopt.ts:427` unmodeled-key report | shrinks automatically. A legacy raw `proposedCloseout` would then be listed as unmodeled, which D-mig makes moot |
| Explain report | `GR:229-236`, `GRS:583`, `GRP:762` | `closeout: GoalCloseoutView` | new view shape; `goal-explain/v1` JSON changes |
| Session open | `SC:215`, `SC:233-239`, `SSC:172` | `goalCloseouts: GoalCloseoutView[]` | new view shape; `session-open/v1` JSON changes (version bump?) |
| SetStatus | `SS:38`, `SS:47`, `SS:421-482` | adoption guard | section 7.1 |
| Doctor | `DR:46`, `DR:55`, `DR:61`, `DR:809-828`, `DR:1245-1277`, `DR:1495-1545` | proposal eligibility and adoption | section 7.2 |
| Generated schema catalog | `standards/schema-catalog/@beep/repo-cli.generated.jsonc:1068-1070`, `:1093`, `:1168` | descriptions name proposals | regenerate (`lint:schema-catalog` lane) |
| Prose | `AGENTS.md:389-396`; `.claude/skills/closeout/SKILL.md:77-79`; `.claude/skills/reflect/SKILL.md:24-28` | two-PR route | rewrite |

`@beep/repo-cli` is changeset-ignored (`.changeset/config.json:13`) and
`private: true`, so removing the schema field needs no major changeset.

### 4.1 Digest and accepted-head trap

`map-completion.md` §3.4 flags the main trap. `readAcceptedManifest` decodes the
final's head manifest with the current `GoalManifest` (`C:553-569`, decode
`C:566`). Once the field is removed, a head that carried `proposedCloseout` (all
8 proposals, and every adopted closeout before #2985) decodes with an empty
closeout slot. Its digest then never equals main's, and `projectGoalLifecycle`
refuses on that inequality (`C:1031`). The identity sub-claim (`C:811-833`)
excludes the closeout, so the overall outcome is unaffected, but anything that
keeps digest equality breaks.

Replace equality with a raw-JSON self-naming check, as in section 6.3.
Separately, keep the digest's canonical key label `proposedCloseout` (`C:301`)
so stored receipts for the 26 records survive. Storage matches on the
current-manifest digest (`C:964`).

---

## 5. How #2985 and #3132 named a PR number they did not know yet

Both used **publish, then bind** by hand:

| PR | First commit (opened the PR) | Bind commit | Gap |
| --- | --- | --- | --- |
| #2985 | `296d9919fc4` 2026-11-08 07:51:08 -0600 | `1c42992415d` "commit the closeout records for the three T3 fleet goals" 07:54:54. It sets status `completed-retained`, adds `closeout {finalPullRequest: 2985}` and adds a gating `yeet-verdict` ref (`git show 1c42992415d -- goals/t3code-fleet-rollout/ops/manifest.json`) | 3 min 46 s |
| #3132 | `c14878b022e` 2026-11-12 17:22:44 -0600. It removes the proposal, sets status, moves the verdict ref and demotes #3101 to `supporting` | `79df1102e11` "bind #3132 as the alchemy-vault-sync-slice final pull request" 17:25:58. It adds `{number: 3132, role: final}` and `closeout {finalPullRequest: 3132}` | 3 min 14 s |

- Both depended on the set-status bypass at `SS:477-482`. The #2985 decision
  says so: "set-status guards only the proposal path"
  (`git show 412e5da6324:goals/t3code-fleet-rollout/decisions/2026-11-08-single-pr-closeout.md`;
  the packet was archived in #2992).
- The #3132 decision states the one-PR route
  (`goals/alchemy-vault-sync-slice/decisions/2026-11-12-operator-ruling-close-in-one-packet-state-pr.md:12`).
- The current manifests show the result: `alchemy-vault-sync-slice` has
  `closeout #3132` with final ref #3132; `t3code-fleet-rollout` has
  `closeout #2985` and no `pullRequests` (jq).
- Hazard: between the two commits, `alchemy-vault-sync-slice` was
  `completed-retained` with no `closeout` and no proposal (`c14878b022e`). That
  shape decodes and reads as a legacy completed packet. A hand-merge (D-hand) in
  that window would have shipped it.

---

## 6. Proposed mechanism for one-PR closeout

### 6.1 Make "publish, then bind" a single guarded writer step

1. Work commits keep `initiative.status` at `active`. `yeet publish` (or
   `yeet open`) opens the draft and so assigns #N. Under the push-first doctrine
   most finals are open long before closeout, so #N is usually already known.
2. `bun run beep goals set-status <slug> completed-retained [--final-pr <N>]`
   resolves #N from `--final-pr` or from the checked-out branch's open PR.
   Branch resolution uses the same `gh pr view --json number,headRefName,state`
   route yeet closeout already relies on (`Yeet/internal/closeout/GhCollect.ts:390-397`,
   "KEEP (D-13)"). Put the resolver behind a small `Context.Service` so tests
   inject it. The command refuses when no PR is open for the branch, when the PR
   is not OPEN, or when `headRefName` differs from the branch, and says
   "publish first, then rerun".
3. In one JSONC write (`SS:486-511`), it sets `initiative.status`, `lifecycle`,
   `initiative.updated`, `closeout {status, finalPullRequest: N}`,
   `completionGate.pullRequests` (adds `{N, final}` and demotes any other `final`
   to `supporting`, as #3132 did by hand), the README Lifecycle line and the
   INDEX. The existing decode check enforces `GoalCloseoutRecordCheck` before
   anything is written.
4. The bind commit rides the content-final push, then `final-check`,
   `yeet ready` and monitoring. The status flip and the record are written
   together, so the `c14878b022e` intermediate state can no longer be produced
   by the writer.
5. Non-grandfathered packets lose the bypass: `completed-retained` without a
   resolvable final is refused. Grandfathered packets keep a status-only flip,
   because the schema forbids their closeout (`GS:1536`).

### 6.2 Post-merge self-consistency

When it is online, doctor observes the named final:

- If the PR is OPEN or closed unmerged, there is no finding (D-onepr). This needs
  an explicit `merged` or final-state field on the receipt (section 1.5), not
  inference from `unsatisfied` with `merge = None`.
- If it merged, require that the **accepted-head manifest** (raw JSON, already
  read by `C:553-569`) carries `closeout.finalPullRequest == N`. This replaces
  digest equality (section 4.1). It also catches a closeout that names some
  other merged PR, and a head that was hand-merged before the bind commit.

### 6.3 Rejected alternatives

- **Predicting the next number.** Issues and PRs share the counter, so this
  races any other issue or PR.
- **A `"self"` sentinel resolved later.** Main would never name the PR, which
  contradicts D-onepr's "names itself". Every read would also need a
  commit-to-PR association lookup.
- **Yeet auto-bind inside `publish`.** This couples yeet to goal manifests and
  adds a commit inside publish. It is possible later as a convenience that calls
  the 6.1 writer.
- **An optional PR-time guard.** In `pull_request` runs, doctor could read the PR
  number from the event and flag a closeout added in the diff that names a
  different PR. Section 6.2 already covers this after the merge.

---

## 7. What changes, file by file

### 7.1 One-PR closeout (D-onepr)

- **`GS`**
  - Delete `GoalProposedCloseout` (`GS:1276-1306`), the field (`GS:1783`) and
    `GoalProposedCloseoutCheck` (`GS:1543-1562`), and drop it from `.check`
    (`GS:1807`).
  - In `GoalCloseoutRecordCheck`, drop `proposedCloseout === undefined`
    (`GS:1575`) and keep the status equality (`GS:1574`).
  - In `closeoutGateAdmits`, drop the `yeet-verdict` requirement (`GS:1537`,
    D-hosted) and keep "not grandfathered" plus final-PR consistency
    (`GS:1536`, `GS:1538-1541`).
  - Rewrite the record and verification docs (`GS:1308-1373`).
  - `GoalCloseoutView` (`GS:1395-1406`) becomes `{packet, closeout:
    GoalCloseoutRecord, outcome}`, with an outcome such as
    `open | verified | unsatisfied | unknown`.
  - Delete `goalCloseoutVerification` (`GS:1427-1434`), `renderGoalCloseoutView`
    (`GS:1469-1472`) and `renderGoalProposedCloseout` (`GS:1530-1531`).
  - `goalPullRequestRefs` reads only `closeout` (`GS:1850`).
- **`SS`**
  - Delete `adoptVerifiedCloseout` (`SS:421-450`). Add the bind branch from 6.1
    to `closeoutTransition` (`SS:477-482`).
  - In `reopenCommittedCloseout` (`SS:465-474`), reopening now deletes `closeout`
    and demotes the `final` ref to `supporting` instead of minting a proposal.
  - Add the `--final-pr` flag beside `SS:574-577`. Drop the imports at `SS:38`
    and `SS:47`. Update the module doc (`SS:1-22`).
- **`C`**
  - Delete `projectGoalLifecycle`, `readGoalLifecycle` and `adoptionHint`
    (`C:1017-1099`, `C:1209-1216`). Rekey the view readers (`C:1126-1199`).
  - The digest reads `closeout` under the old label (`C:301`).
  - Accepted-head self-naming replaces digest equality (section 6.2).
- **Other source**: `PI:304-307`, `AX:760-761`, `RA:269-285`, `GR:100-113`
  (pass manifests only), `GR:229-236`, `GRP:762`, `SC:215-239` and `SSC:172`.

### 7.2 Doctor blocks only after the merge (D-onepr)

Proposed classification:

| Closeout state | Mode | Today | Proposed |
| --- | --- | --- | --- |
| final open or closed unmerged | online | advisory `completion-gate-unsatisfied` (`C:199`, `DR:1487`) | **no finding** |
| final open | offline | advisory unknown "No matching clone receipt" (`DR:1476-1479`) | no finding (a note) |
| merged and verified | online | none, with a note (`DR:1517-1526`) | none |
| merged, `unsatisfied` or `unknown` with merge facts | online | advisory | **blocking** `closeout-unverified`, key `<slug> closeout-unverified #N` (suffix through `DR:253-266`, so a re-final mints a new key) |
| PR or merge read failed (`merge = None`, merged unknown) | online | advisory unknown | advisory (transport), never blocking |
| merged, no receipt | offline | advisory unknown | advisory "verify with `--online`"; offline never blocks |
| merged, outside the one-month rule-suite window, with an operator-ruling decision | online | advisory | note only (D-exit) |
| legacy `completed-retained` without `closeout` | any | heuristic and typed advisories (`DR:1253-1277`, `DR:1561-1573`) | unchanged |

- Code changes:
  - Add `closeout-unverified` to `GoalDoctorFindingKind` (`DR:128-167`) and
    remove `closeout-adoption-pending` (`DR:142`); also `BSS:768`.
  - `completionReceiptFindings` (`DR:1462-1493`) receives
    `{hasCloseout, finalState}` and picks the severity.
  - `completedManifest` drops the proposal disjunct (`DR:1249`). Drop the
    proposal clauses at `DR:816`, `DR:1261` and `DR:1507`, and the adoption
    block `DR:1514-1543`. Rewrite the module doc (`DR:11-13`).
  - Messages must name the remediation: an attributed-red decision (D-red),
    resolving the thread, `set-status <slug> active`, or an operator ruling
    (D-exit).
- **CI consequences** (no ruling covers these; listed as open questions):
  - The hosted lane is offline today (`package.json:426`) and has only
    `contents: read` (`check.yml:207-208`). Blocking has teeth only if some
    hosted job runs `--online` with an identity that can read pulls, check runs,
    rule suites and ruleset history. `CE:98-113` selects `BEEP_GH_TOKEN_REF`,
    then the App, then gh.
  - A blocking finding introduced on main makes every later PR's `goals:doctor`
    lane red. That is an inherited red under AGENTS.md "Autonomy".
  - Re-observing every closeout each run costs roughly 10 rule-suite pages per
    packet (`map-migration.md` "Notes for the migration PR"). Every final also
    turns unknown after one month. Bound the online set: finals whose merge
    commit (offline, from the subjects doctor already reads, `DR:1304`) is
    inside the window, plus closeouts changed against the base. Alternatively,
    persist verified receipts on a notes ref written by a main-push workflow,
    which has precedent in `.github/workflows/history-notes-publish.yml:1-9`.

### 7.3 Removing `proposedCloseout` (D-mig)

- Order: the batch refresh and adoption run first (`map-migration.md`), then the
  field removal lands in the same PR.
- After removal, a leftover raw `proposedCloseout` is silently stripped
  (`GS:1748-1750`). The migration must leave none, and a one-off check
  (`jq 'has("proposedCloseout")'` over the census) should prove that.
- The reversal is the decision's own text: revert the migration commit and
  restore the field.

### 7.4 Template text (D-done, D-exit, D-onepr)

- Replace `BS:333-338` with roughly this: "Close in the final PR: once its draft
  is open, run `bun run beep goals set-status <slug> completed-retained` (it names
  the open PR in `closeout`) and ship the reflection with it. After the merge,
  `goals doctor --online` must show no blocking finding for this packet. Done
  only once `git show origin/main:… | jq -e '.closeout.status ==
  .initiative.status'` passes, or an operator ruling is recorded under
  `decisions/` and that check passes."
- Replace `BS:434-437` to match.
- The GOAL.md budget is 4000 characters, checked by the template's own
  verification line.

---

## 8. Test files that will need changes

| File | Lines | Why |
| --- | --- | --- |
| `goals-doctor.test.ts` | `:207-252` (offline proposals), `:253-293` (offline committed closeout asserts advisory unknown), `:421-532` (adoption pending), `:759-831` (proposal exemption from phases rule); new cases | proposals gone; the new blocking, unmerged, offline and ratchet-key behaviour |
| `goals-set-status-stream.test.ts` | `:88-123` (proposal adoption refusal), `:125-161` (reopen to proposal) | the bind writer, refusal without an open PR, reopen deletes the record |
| `goals-completion.test.ts` | the "prospective goal closeout" block `:483-730`: `:518`, `:537`, `:559`, `:570`, `:585`, `:597`, `:650` (`:654` proposal status), `:694` (digest kept on adoption), `:718` (`:722` "beside a proposal", `:726` gate without `yeet-verdict` now decodes) | lifecycle projection, views and checks removed or relaxed |
| `goals-completion-observation.test.ts` | `:1110` (recovery fixture `proposedCloseout`); `:971-1010` (online doctor writes nothing; extend for blocking) | field gone; online severity |
| `goals-graph.test.ts` | `:11`, `:15`, `:449-490` | `GoalCloseoutView` shape and the "adoption pending" text |
| `goals-command.test.ts` | `:9`, `:18`, `:311-313`, `:343-357` | `renderGoalProposedCloseout` removed; the INDEX row |
| `session-ledger.test.ts` | `:480-507` | session view of a proposal |
| `reflection-lint.test.ts` | `:142-163` | the reflection gate keyed on a proposal |
| `fixtures/goals-plan/bootstrap-{full,minimal,report-first}.json` | `:25` (GOAL.md payload), `:41` (PLAN.md payload); consumed by `goals-bootstrap-plan.test.ts` | template text; regenerate |
| `goals-completion-evidence.test.ts` | per `map-completion.md` §2 | D-hosted and D-red evaluator changes (not proposal-keyed) |

`packet-core-set-status-input.test.ts`, `goals-manifest-capabilities.test.ts`,
the `Archive` tests and `goals-completion-receipt-store.test.ts` carry no
proposal or closeout assertions (rg), so they need no change unless the receipt
gains a `merged` field.

---

## 9. Open questions

1. **Hosted identity for online doctor.** Which job runs `--online`, and with
   which token? Repo Sanity has `contents: read` (`check.yml:207-208`). Whether
   `GITHUB_TOKEN` can read rule suites and ruleset history has not been verified
   here.
2. **Where blocking bites.** Every PR run, the main push only, or a scheduled
   job? Every-PR enforcement turns one bad closeout into a repo-wide inherited
   red.
3. **Bounding re-verification.** After one month every final reads unknown.
   Should the online set be windowed by merge date, persisted on a notes ref, or
   should D-exit be recognised mechanically?
4. **A machine-readable operator ruling (D-exit).** Decision frontmatter is only
   `title/date/reversal/kind/lane` (`DS:189-194`). Should the ruling exit and
   D-red share one new field, so doctor can downgrade without prose matching?
5. **Unknown from transport vs unknown from facts.** Confirm that a PR or merge
   read failure must never block, while `unknown` with merge facts does.
6. **Post-merge review threads.** Should a thread opened after `mergedAt` make a
   verified final unverified? See `map-completion.md` §5.
7. **JSON report versions.** Do `session-open/v1` (`SSC:169`) and
   `goal-explain/v1` (`GRS:573`) bump when `GoalCloseoutView` changes shape?
8. **Reopen semantics.** When a closed packet reopens, should the old final
   stay as `supporting` or be removed? The 6.1 writer must pick one.
9. **"Done" and verification.** D-done keeps the AGENTS.md jq check as the done
   condition. Should the GOAL.md launcher also require "no blocking doctor
   finding", or is the jq check enough, with doctor enforcing the rest?
