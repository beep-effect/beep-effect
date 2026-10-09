# H2 sweep: structured goal completion evidence

## Provenance

- Checkout: lane `rsc-packet`, branch `docs/repository-simplification-confidence-packet`, head `e62411d63f` (= `main`, PR #1557).
- Date: 2026-10-09. The sweep was read-only: no files were written inside any checkout.
- Commands:
  - `bun run beep goals doctor --help` and `bun run beep goals doctor`. With no flag the doctor is read-only; only `--write-baseline` writes, at `Doctor.ts` `writeDoctorBaseline`.
  - `git log --format=%s -n 4000`, `git rev-list --parents`, `git merge-base --is-ancestor`, `git show -s --format=%b`
  - `gh pr view <n> --json mergedAt,mergeCommit,headRefOid,headRefName,state,files`
  - `gh api repos/{owner}/{repo}/commits/<sha>/check-runs`
  - `gh api repos/{owner}/{repo}/rules/branches/main`
  - `jq` over `goals/*/ops/manifest.json`, the clone `.beep/yeet/*` stores and `~/.local/state/beep/yeet/pr-sessions/*.jsonl`
  - `rg -uu` across the `~/YeeBois/projects/beep-effect*/.beep/yeet` stores (31 clones)

## 1. Doctor output at e62411d63f (verbatim)

```
[goals:doctor] packets=211 blocking_new=0 blocking_inherited=0 baseline_resolved=0 advisories=4
[goals:doctor] advisories (non-fatal):
- repository-simplification-confidence [stale-active] active packet untouched for 21+ days with no blockedBy/statusNote.
- document-ast-pattern-classification [completion-gate-unsatisfied] completed-retained but no merge/squash commit cites the packet (completionGate not grandfathered).
- practice-box-onboarding [completion-gate-unsatisfied] completed-retained but no merge/squash commit cites the packet (completionGate not grandfathered).
- push-first-publish [completion-gate-unsatisfied] completed-retained but no merge/squash commit cites the packet (completionGate not grandfathered).
[goals:doctor] OK: no new blocking findings.
```

The brief reported 210 packets and 3 advisories. The doctor walks the working tree, so the uncommitted `goals/repository-simplification-confidence/` packet that another agent is writing counts as packet 211. That packet also produces the fourth advisory (`stale-active`): it has no git history yet, so `touchedSlugs` cannot see it. It is not one of the three H2 advisories. It will clear once the packet is committed or carries a `statusNote`.

## 2. The current heuristic (`packages/tooling/tool/cli/src/commands/Goals/Doctor.ts`)

- **`gitAdvisories`.**
  - Skips everything on shallow or unavailable history, with a note.
  - Otherwise runs two git walks:
    - `git log --since=21.days --name-only -- goals/`, which feeds `touchedSlugs`;
    - `git log --format=%s -n 4000`. This reads subjects only, never commit bodies, and is capped at 4000 commits. At head that cap reaches back to 2026-03-02, out of 11,448 commits in total.
- **`isMergeSubject`.** A subject counts as a merge if it matches `SQUASH_SUBJECT_PATTERN = /\(#\d+\)$/` or `MERGE_COMMIT_SUBJECT_PATTERN = /^Merge pull request #\d+/`.
- **`recordedPullRequest`.** Reads the raw, undecoded manifest key `mergedPullRequest` and renders it as `` `#${String(value)}` ``. `GoalManifest` does not type this field (unknown keys are stripped on decode).
  - Census: 37 manifests carry a top-level numeric `mergedPullRequest`.
  - One manifest uses a plural `mergedPullRequests: [167, 168]` (`goals/agent-effectiveness-loop`). The doctor ignores that field.
  - One manifest nests `mergedPullRequest: {number, mergeCommit}` under another block (`goals/codex-security-findings-2026-08-04`).
- **`citedBy`.** Exact whole-token match. `citationTokens` splits on `/[^A-Za-z0-9#-]+/`, and only merge subjects (`isMergeSubject`) are searched. Used only by `activeAfterMergeAdvisories`.
- **`citedAnywhere`.** Plain `Str.includes` substring match of the slug or `#N` over all 4000 subjects, not only merge subjects. Used by `completionGateAdvisories`. A code comment says this looser reading is kept on purpose, because the committed baseline was recorded against it.
  - The advisory text says "no merge/squash commit cites the packet", but the check also accepts non-merge subjects.
  - Substring matching admits prefix false positives: a recorded `#142` matches the subject text `#1427`.
- **`activeAfterMergeAdvisories`.** Fires when all of these hold:
  - the packet is `active`;
  - `completionGate.requiresPullRequest` is true;
  - there is no `statusNote` or `blockedBy` (`hasOpenContext`);
  - the packet was not touched in the last 21 days;
  - `citedBy` matches.

  When it fires, it suppresses `stale-active` for the same slug.
- **`completionGateAdvisories`.** Fires when the packet is `completed-retained`, not `completionGate.grandfathered`, and `citedAnywhere` fails. It is advisory only and never consults GitHub.

Census of the 110 `completed-retained` packets with `grandfathered: false` (24 are grandfathered):

| citation path that clears the gate | count |
|---|---|
| slug inside a merge subject | 73 (66 slug only + 7 slug and recorded PR) |
| recorded `mergedPullRequest` only | 29 |
| slug in a non-merge subject only (loose reading) | 5 (4 + 1) |
| nothing (the three advisories) | 3 |

Two latent hazards:

1. The `-n 4000` window slides. Once 4000 newer commits land, a packet whose only citation is older will silently become "unsatisfied".
2. 5 packets pass only because a non-merge subject contains the slug.

**Doctor in CI.** `goals:doctor` is a cheap-gates/repo-sanity lane:
- lane: `packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts` `githubCheckLane("goals:doctor", "cheap-gates", "repo-sanity", "preflight", ...)`;
- turbo task: `turbo.json` `//#goals:doctor`;
- root script: `package.json` `"goals:doctor"`.

**Tests.** `packages/tooling/tool/cli/test/goals-doctor.test.ts` covers `active-after-merge` and `classifyGoalDoctorFindings`. It has no test for `completion-gate-unsatisfied`.

## 3. Schema home (`packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts`)

- **`GoalCompletionGate`** (`S.Class`) has these fields:
  - `operator: S.String`
  - `requiresPullRequest: S.Boolean`
  - `requiresMergeable: S.Boolean`
  - `statement: S.String`
  - `grandfathered: S.Boolean`
  - `grandfatheredNote: S.optionalKey(S.String)`
- **`GoalManifest`** (`S.Class` over `S.Struct(...).check(GoalManifestCapabilitySelfCycleCheck)`):
  - Requires only `initiative` and `completionGate`.
  - Everything else is `S.optionalKey`, including `statusNote` and `blockedBy`.
  - Unknown keys are stripped on decode. That is why the doctor re-parses the raw JSON for `mergedPullRequest`.
- **`decodeGoalManifest`** is `dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(GoalManifest))`.
- **Style** used throughout the file:
  - `$I = $RepoCliId.create("commands/Goals/Goals.schemas")`;
  - `S.Class<X>($I\`X\`)({...}, $I.annote("X", {description}))`;
  - `LiteralKit([...]).pipe($I.annoteSchema(...))`.
- **`initiative.packetId`** looks like `goal-packet/v1:<sha256(slug\ntoday)>` (`Bootstrap.ts` line 157). 24 manifests carry it. It identifies the packet; it is **not** a declaration digest. A declaration digest must be new.

## 4. Existing evidence stores (reuse targets)

| store | file + schema | scope | head binding |
|---|---|---|---|
| Proof ledger | `<clone>/.beep/yeet/proof-ledger.ndjson`; rows `ProofLedgerRow = Union[ProofLedgerFactRow (kind "fact", ProofFact), ProofLedgerShadowRow (kind "shadow")]`; schema `proof-fact/v1` (`Yeet/internal/ProofFact.ts`); service `ProofLedger` (`Context.Service`, `Yeet/internal/ProofLedger.ts`) with `record/recordShadow/lookup/lookupAll/snapshot/expire` | **clone-scoped** (ruling 71: `resolveProofLedgerLocation` in `Yeet/internal/ArtifactPaths.ts` maps a linked worktree to the owning clone; `ProofLedgerLocation{originRoot, ledgerRoot, ledgerPath}`) | `ProofFact.provenance: ProofProvenance{runId, attemptId, originKey, tier, stage, headSha, hostedRunId: NullOr}`; `expiresAt` (facts expire, so they are not durable completion evidence on their own) |
| Lane proofs | `.beep/yeet/lane-proofs.json`; `LaneProofStore{schemaVersion "yeet-lane-proofs/v2", records: LaneProofRecord[]}`; record fields `laneId, commandHash, inputHash, mergedTreeSha, headSha, baseSha, envProfileHash, durationMs, verifiedAt` (`Quality/internal/LaneProofReuse.ts`, classes private) | **checkout-scoped** (`path.join(repoRoot, ".beep","yeet","lane-proofs.json")`, where repoRoot is the lane cwd). It is deleted when a lane is retired | `headSha`, `baseSha`, `mergedTreeSha` |
| Yeet verdict | `.beep/yeet/runs/<runId>/verdict.json`; `YeetVerdict{schemaVersion "yeet-verdict/v2", head, resolvedHeadSha, outcome, mergeReady: Option<YeetMergeReady{ready, failing, criteria: YeetMergeReadyCriteria}>...}` (`Yeet/internal/Verdict.ts`) | checkout-scoped | `resolvedHeadSha` |
| Proof jobs | `.beep/yeet/jobs/<jobId>.json` (`Yeet/internal/ProofJob.ts`, ruling 36) | checkout-scoped | through `verdictPath` |
| Merge gate | `MergeGateRead{prNumber, headSha, requiredContexts, checkRuns, window, unresolvedThreads, readAt}` → `MergeGateMerge{prNumber, headSha, commitTitle, windowAgeSeconds, tolerated}` (`Yeet/internal/MergeGate.ts`). These are in-memory decisions; only free-text logs persist, in `~/.cache/beep/orchestrator/gates/*.log` (51 files, none for 1427/1429/1462) | workstation | pinned `headSha` |
| PR-session registry | `~/.local/state/beep/yeet/pr-sessions/github.com__<owner>__<repo>.jsonl`; `PrSessionRecord` (`Yeet/internal/Provenance.ts`, `headSha: GitSha`, `prNumber`, `clonePath`...) | workstation, private | per-push head |
| Merged-PR probe | `WorktreeMergedPullRequestProbe.mergedAtHead` (`Worktree/Worktree.service.ts`, gh-backed `ghMergedAtHead`) | service | existing gh-backed merged-PR lookup to reuse |

Observed at head: the beep-effect3 clone ledger has 894 rows (447 fact, 447 shadow), and `lane-proofs.json` has 54 records.

## 5. The three advisories against GitHub

All three are squash merges: the merge OID has one parent, the accepted head is **not** an ancestor of `main`, and the trees differ. A receipt that demands original-head ancestry would wrongly fail all three.

| packet | final PR | state / mergedAt | accepted head (`headRefOid`) | merge commit | why the heuristic misses | head-branch | hosted checks at accepted head |
|---|---|---|---|---|---|---|---|
| document-ast-pattern-classification | #1429 | MERGED 2026-10-06T00:55:25Z | `e9eafb4a6f29…` | `2f2426b695ff…` | subject `feat(schema): classify document AST constructors … (#1429)` has no slug; manifest has no `mergedPullRequest`; PR is named only in `statusNote` free text; body carries `Goal: document-ast-pattern-classification` but the doctor reads `%s` only | `goals/document-ast-pattern-classification` | 33 runs: 31 success, 2 failure (`Heavy / Coverage Regression`, `Heavy / Lint Policy`, both **not required**) |
| practice-box-onboarding | #1462 | MERGED 2026-10-06T09:51:53Z | `b106798b3e60…` (not present in any local object store) | `98c3947d4435…` | subject `feat(box-provisioning): … (#1462)`; `#1462` appears only in `statusNote` | `claude/infallible-villani-bb21f1` | 33/33 success |
| push-first-publish | #1427 | MERGED 2026-10-06T01:36:13Z | `4bdc437219e1…` | `01d8c18f3146…` | subject `refactor(yeet): satisfy the fallow audit for the push-first planner (#1427)`; `statusNote` describes the final publish only in free text, with no number | `goals/push-first-publish` | 33 runs: 31 success, 2 failure (same two non-required Heavy lanes) |

Each PR touched its own `goals/<slug>/ops/manifest.json`, so the lifecycle flip rode the final PR. The `main` required-status-check rule lists 16 contexts:
`Lint`, `Heavy / Check`, `Test Unit`, `Heavy / Test Integration`, `Heavy / Docgen`, `Codegen Drift`, `Repo Sanity`, `Knip`, `Commitlint`, `Secret Scanning`, `Security`, `SAST`, `Nix Shell`, `Professional Desktop IPC Stdio`, `Heavy / Doctest`, `JSDoc Ratchet`.

No local acceptance evidence exists at any accepted head. A search of all 31 clone `.beep/yeet` stores (proof ledger, lane proofs, runs, jobs) found zero matches.
- #1429 and #1427 came from clone `beep-effect10`, which has no proof ledger.
- #1462 came from `beep-effect11`.
- The PR-session registry has rows for all three PRs, but only #1427's rows include the final head `4bdc437219`.
- The archived lane residue for #1429 and #1427 is in `~/.cache/beep/worktree-residue/beep-effect10-*/`.

So the evidence that can satisfy a typed receipt is **GitHub observations**:
- merged state, merge OID and `headRefOid`;
- the required-context check-runs at the accepted head (all success);
- the review window and threads at merge time, which the merge gate would re-read.

That evidence must be bound to the packet by a declared `finalPullRequest` number, not by subject text. What each packet needs:

- **document-ast-pattern-classification:** declare final PR #1429 (no supporting PRs). The receipt verifies from GitHub: merged, accepted head `e9eafb4a6f`, required contexts green. The two red non-required lanes are recorded as tolerated, which is the same tolerance model as `MergeGateTolerance`.
- **practice-box-onboarding:** declare final PR #1462. Verifies the same way, and all checks are green. The live-migration receipt lives in packet history (operational evidence). It can be listed as an `acceptanceEvidence` ref of kind `packet-history`, but it does not gate the receipt.
- **push-first-publish:** declare final PR #1427. Its completionGate statement also requires that the PR itself went through draft → `yeet ready` → `merge-ready: yes`. That claim needs either a `yeet-verdict` ref with `mergeReady.ready = true` at `resolvedHeadSha = 4bdc437219…` (no such verdict exists locally) or a GitHub timeline observation (draft→ready event plus merge). Without one of these the extra statement claim is `unknown`, not `unsatisfied`. The PR-merge part verifies.

## 6. Schema extension sketch (Effect v4, matches `Goals.schemas.ts` style)

```ts
// Goals.schemas.ts — declarations live in the manifest (authored in the final PR)
export const GoalPullRequestRole = LiteralKit(["final", "supporting"]).pipe(
  $I.annoteSchema("GoalPullRequestRole", { description: "Role of a PR in delivering a goal packet." })
)

export class GoalPullRequestRef extends S.Class<GoalPullRequestRef>($I`GoalPullRequestRef`)(
  {
    number: S.Int.check(S.isGreaterThan(0)),
    role: GoalPullRequestRole,
    repository: S.optionalKey(S.String), // "owner/name"; default = origin
  },
  $I.annote("GoalPullRequestRef", { description: "Typed PR reference declared by a goal packet." })
) {}

export const GoalAcceptanceEvidenceKind = LiteralKit([
  "hosted-required-checks", // GitHub check-runs at the accepted head
  "yeet-verdict",           // .beep/yeet/runs/<runId>/verdict.json (mergeReady)
  "proof-fact",             // ProofLedger fact key (clone-scoped)
  "packet-history",         // goals/<slug>/history/** receipt file
]).pipe($I.annoteSchema("GoalAcceptanceEvidenceKind", { description: "Kinds of acceptance evidence a goal may cite." }))

export class GoalAcceptanceEvidenceRef extends S.Class<GoalAcceptanceEvidenceRef>($I`GoalAcceptanceEvidenceRef`)(
  {
    kind: GoalAcceptanceEvidenceKind,
    ref: S.NonEmptyString,               // runId | ProofInputDigest.key | repo-relative path | "required"
    gating: S.Boolean.pipe(S.withDecodingDefault(Effect.succeed(true))),
  },
  $I.annote("GoalAcceptanceEvidenceRef", { description: "Pointer to acceptance evidence; bound to the accepted head at verification." })
) {}

// Additive, optional: legacy manifests and grandfathered packets decode unchanged.
export class GoalCompletionGate extends S.Class<GoalCompletionGate>($I`GoalCompletionGate`)(
  {
    operator: S.String,
    requiresPullRequest: S.Boolean,
    requiresMergeable: S.Boolean,
    statement: S.String,
    grandfathered: S.Boolean,
    grandfatheredNote: S.optionalKey(S.String),
    pullRequests: S.optionalKey(S.Array(GoalPullRequestRef)),          // exactly one role "final" (check)
    acceptanceEvidence: S.optionalKey(S.Array(GoalAcceptanceEvidenceRef)),
  },
  $I.annote("GoalCompletionGate", { description: "..." })
).check(/* S.makeFilter: at most one final PR */) {}
// Legacy read path: top-level raw `mergedPullRequest: N` / `mergedPullRequests: N[]` are
// normalised (in the doctor, not on disk) to GoalPullRequestRef{role: "final" | "supporting"}.

// Derived post-merge receipt — never authored in the PR (a PR cannot contain its own merge OID).
export const GoalMergeMethod = LiteralKit(["squash", "merge", "rebase"]).pipe(
  $I.annoteSchema("GoalMergeMethod", { description: "How the final PR landed; decides the ancestry check." })
)

export class GoalMergeResult extends S.Class<GoalMergeResult>($I`GoalMergeResult`)(
  {
    mergeCommit: S.NonEmptyString,     // GitHub mergeCommit.oid
    mergedAt: S.DateTimeUtcFromString,
    method: GoalMergeMethod,           // squash: 1 parent, head NOT ancestor; merge: head is 2nd parent; rebase: tree equality / patch-id
    baseRef: S.NonEmptyString,
  },
  $I.annote("GoalMergeResult", { description: "Merge facts resolved after the merge." })
) {}

export const GoalCompletionOutcome = LiteralKit(["verified", "unsatisfied", "unknown"]).pipe(
  $I.annoteSchema("GoalCompletionOutcome", {
    description: "verified: all gating evidence holds at the accepted head; unsatisfied: a positive contrary fact (unmerged, stale head, red required check); unknown: lookup failed, rate-limited, or evidence absent.",
  })
)

export class GoalEvidenceCheck extends S.Class<GoalEvidenceCheck>($I`GoalEvidenceCheck`)(
  { ref: GoalAcceptanceEvidenceRef, outcome: GoalCompletionOutcome, observedHead: S.optionalKey(S.String), detail: S.String },
  $I.annote("GoalEvidenceCheck", { description: "One evidence ref resolved against the accepted head." })
) {}

export class GoalCompletionReceipt extends S.Class<GoalCompletionReceipt>($I`GoalCompletionReceipt`)(
  {
    schemaVersion: S.Literal("goal-completion-receipt/v1"),
    repository: S.NonEmptyString,              // "owner/name"
    packet: S.NonEmptyString,                  // slug (+ initiative.packetId when present)
    declarationDigest: S.NonEmptyString,       // sha256 of canonical JSON of completionGate at the merge commit
    finalPullRequest: S.Int,
    acceptedHead: S.NonEmptyString,            // PR headRefOid at merge
    merge: GoalMergeResult,
    evidence: S.Array(GoalEvidenceCheck),
    outcome: GoalCompletionOutcome,
    verifiedAt: S.DateTimeUtcFromString,
  },
  $I.annote("GoalCompletionReceipt", { description: "Derived post-merge completion receipt; written only by explicit closeout/refresh." })
) {}
```

Outcome rules:

- `unsatisfied`:
  - the final PR is not merged, or is closed;
  - or a gating evidence ref names a head other than `acceptedHead` (stale-head receipt);
  - or a required context is red at `acceptedHead`.
- `unknown`:
  - a gh/network error or rate limit;
  - or missing local evidence (for example the push-first verdict).

  Unknown is never collapsed into satisfied or unsatisfied.
- `verified`: everything else.

## Proposed plan (implementing lane)

1. **Schema first.** Add the classes above to `Goals.schemas.ts`. Every addition is optional, so all 211 manifests keep decoding.
   - Add a decode test proving that legacy `mergedPullRequest` / `mergedPullRequests` normalise to refs.
   - Add a test proving that `grandfathered: true` still short-circuits.
2. **Service contract.** Define `GoalCompletionVerifier` (`Context.Service`) with:
   - `resolve(packet) → Effect<GoalCompletionReceipt>`, which is pure over a `GoalCompletionObservation`;
   - a gh adapter that reuses or extends `WorktreeMergedPullRequestProbe` and the `MergeGateRead`/`MergeGateCheckRun` read shapes for required contexts.
3. **Receipt storage.** Persist receipts clone-scoped, next to the proof ledger, as `<clone>/.beep/goals/completion-receipts.ndjson` or as a new `ProofLedgerRow` kind. Resolve the location through `resolveProofLedgerLocation`; do not change `ProofFact` or its expiry semantics.
4. **Doctor.** Stays read-only.
   - For packets with a typed `pullRequests` final ref, report from the stored receipt, or from a live read with `--online` (a network failure gives `unknown`).
   - Keep `citedAnywhere` only as the legacy fallback for packets without typed refs, so the baseline semantics are preserved.
   - Fix the advisory wording, and consider reading `%B` (the full commit body) as a further legacy signal.
   - Add a `completion-gate-unknown` finding kind to `GoalDoctorFindingKind`.
5. **Writes.** Add `bun run beep goals completion refresh [--slug]`, or attach it to `yeet sweep --retire`. This is the only writer, and it records receipts after the merge.
6. **Reconcile the three packets in one docs PR:**
   - add the `pullRequests: [{number, role: "final"}]` ref to each manifest (1429, 1462, 1427);
   - change no lifecycle fields;
   - run the refresh after the merge.
7. **Acceptance tests** (brief §4 "Completion receipts"):
   - a merged PR without the packet name gives `verified`;
   - an unmerged final PR gives `unsatisfied`;
   - stale-head evidence gives `unsatisfied`;
   - a gh failure or rate limit gives `unknown`;
   - a grandfathered packet passes;
   - a squash fixture whose head is not an ancestor still verifies.

## Open questions

- Should the receipt treat non-required red checks at the accepted head as `tolerated`, which matches `MergeGateTolerance`? Both #1429 and #1427 have two such checks (`Heavy / Coverage Regression`, `Heavy / Lint Policy`). It is not yet established whether those reds were inherited from `main` at the time.
- What evidence satisfies push-first-publish's extra statement claim (draft → ready → `merge-ready: yes`)? No local verdict exists. I did not check whether the GitHub timeline (ready_for_review events) is an acceptable substitute.
- Receipt file location: a new `.beep/goals/` ledger, or a new row kind in `proof-ledger.ndjson`? The latter touches `PROOF_FACT_SCHEMA_VERSION` consumers and TTC semantics.
- Declaration digest scope: the whole `completionGate` block, or the block plus `initiative.id` and `packetId`? Should it be computed at the merge commit, or at `acceptedHead`? For squash merges the tree differs.
- Should the 5 packets that pass only through a non-merge subject substring, and the 29 that pass only through a recorded `mergedPullRequest`, be migrated to typed refs? Otherwise they stay on the legacy path. The 4000-commit window will eventually drop old citations.
- Should rebase-merge detection use patch-id or tree equality? No rebase-merged goal PR was sampled.
