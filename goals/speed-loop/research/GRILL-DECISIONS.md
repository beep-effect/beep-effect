# Follow-up performance grill — decisions (2026-08-04, second session)

Nine decisions locked with Benjamin over the r1–r5 reports (this directory).
These seed the follow-up packet; this file lands in that packet's history/
when PR-A opens.

1. **Topology: two PRs.** PR-A "pipeline speed" (gates diet + scope lever +
   preflight wave + publish fix + instrument hygiene; all repo-cli surfaces).
   PR-B "dead weight" (four package deletions + gitleaks image bump + CI
   cache/timing). Disjoint surfaces, parallel-safe.
2. **terse-effect → advisory + auto-rewrite.** Never blocks again; the safe
   rewriter keeps applying fixes during repair. (Overrides r4's keep-blocking
   verdict on operator authority — the two tonight catches were style-only at
   ~11 min each.)
3. **dual-arity → deleted entirely.** Law, empty inventory ledger,
   every-repair inventory write, and the 79s lint step all go. Completed-
   campaign rationale; recoverable from history.
4. **lint:markdown and cspell → deleted** (lanes + config surfaces:
   cspell.json, .cspell/, markdownlint config). The free typos pre-commit
   hook stays. NOTE: .gitleaks and _typos retention comments referencing
   cspell dictionaries need re-checking during implementation.
5. **Scope lever: local scoped, hosted full.** Surviving lint/laws gates
   (effect-fn, native-runtime, frozen-grant-set, and the rest of the battery)
   run changed-scope locally; hosted Lint Policy keeps the full sweep. Mirrors
   the docgen pattern.
6. **Fail-fast: preflight wave + publish fix in PR-A.** r1 #1 (ordered waves,
   fail-fast default for verify) plus the PublishScope staged-vs-existing-
   commit contradiction fix. Per-lane proof resume stays owned by
   coding-agent-effectiveness-evidence-loop (nominated as its next unit);
   "ship" mode designed after the wave proves itself.
7. **Deletions: non-legal four only** — @beep/acp, @beep/discord,
   @beep/tailscale, @beep/protobuf (~60s serial sweep saving). The four
   legal-data drivers (pacer, courtlistener, dol, federal-register) stay —
   delivered gov-legal packet outputs awaiting law-practice integration.
   Run r3's false-zero checks before each deletion.
8. **CI: trusted-base read-only turbo cache + setup-timing ingestion +
   gitleaks image bump; lane consolidation deferred** until post-cache
   measurements say whether it still pays for a ruleset edit.
9. **Grit: separate spike branch.** jsdoc-inventory candidate collector only;
   adopt only on measured step-change (230s → <20s target) with
   byte-identical inventory output as the falsification test.

Carried context: instrument hygiene contents per the quality-speedup grill
(timing fields + failedStepId/attemptId, fallow envelope mode-split,
elapsedMs:0 fix) ride PR-A. The gitleaks image bump retires the generated-file
allow-marker workaround once the [[allowlists]] syntax is honored hosted-side.

## Grill #3 — opportunity-wave placements (2026-08-04)

10. **Vehicle map confirmed as synthesized** (SYNTHESIS-2.md): PR-A += attempt
    journal + integration 3/22 split; PR-B += cache global-bust fixes +
    step-summary failure excerpts; PR-C bundles incremental jsdoc inventory,
    yeet ship porcelain, coverage-lane fix, docgen escalation narrowing;
    spikes/rituals/chore as listed.
11. **D1+D2 combined micro-PR immediately after #548 merges**: Md.safe
    subpath import (−3.06M, probe-proved) + BlockRepair leaf boundary
    (−86.8%, probe-proved), one CI gauntlet.
12. **Spike order: cross-clone LAN cache → grit collector → single-process
    battery → vitest projects → stage-3 html** (stage-3 keeps its ≤8M exit
    gate; battery waits for PR-A timing fields).

## Grill #4 — merge loop, soundness, agent kit, parity (2026-08-04)

Eleven decisions over the full ledger docket (#21–#54). Shipped state at
grill time: PR-A merged (#551), #548/#549/#547 merged, PR-B/PR-C queued from
grills #2–#3.

13. **Queue topology: PR-E jumps.** Order: PR-E "merge loop" → (PR-B in
    parallel; execution-only, disjoint surfaces) → PR-F "soundness" → PR-I
    "agent kit" → PR-C "pipeline 2" → PR-G "preflight parity" → PR-H "teach
    pack" → repo-wide jsdoc codemod PR. Rationale: closeout friction taxed
    all four merges this week; the kit serves C/G/H's own implementation
    waves.
14. **PR-E "merge loop".** (a) `beep yeet merge` porcelain: merge WITHOUT
    `--delete-branch` → verify MERGED via API → sweep tail; operator-
    authorized only, never auto-invoked. (b) `yeet sweep` (#39): SweepPlan +
    SweepReport schema pair, `--plan` dry-run, worktree-aware safety rails,
    "merged, cleanup skipped: reason" = success; auto-runs on monitor's
    merged detection and stands alone. Branch deletion contract: `-d` for
    ancestry-merged; `-D` only when the branch's PR is MERGED AND the
    local tip equals the PR's recorded head SHA AND no worktree holds the
    branch (remote deletion needs the same tip match); otherwise
    skip-and-report. (c) `yeet monitor --until-merged` (#42): opt-in flag,
    follows new SHAs, known-flake fingerprints (ts2589-no-location,
    CI-timeout) get ONE job-scoped rerun per job per SHA via
    `gh run rerun --job <databaseId>` (#23) — never `--failed`, which
    reruns every failed job and would re-execute coexisting genuine reds,
    breaking the bounded budget; other reds report "needs code fix";
    surfaces the
    `mergeReady` verdict (criteria per decision-track #20: checks green +
    threads resolved hard, Greptile displayed target). (d) `yeet reply`
    (#51): ReplyDrafts → validate against live threads → post + resolve
    (GraphQL mutation) → ReplyReport; runnable by either party. (e) Verdict
    encode fix: YeetVerdict gains a Json codec (FlakeQuarantineArtifactJson
    pattern) + round-trip test — LAW: every yeet artifact writes through
    `S.encode`. (f) Rider: dead `"tooling"` testSearchRoots entry removed
    (#38 bonus).
15. **PR-F "soundness pair".** #37 durable remedy = sentinel ambient `.d.ts`
    emitted by tsconfig-sync codegen carrying the plugins-block content hash
    (global-scope change → full per-file diagnostic invalidation); fallback
    if flaky: wrapper drift-detect + `tsgo -b --force`. Plus #34
    append-optional lint: version-carrying S.Class schemas may not gain
    required fields vs origin/main without a version bump; failure output
    teaches `S.OptionFromOptionalKey` + `SchemaUtils.withNoneDefault`. Plus
    #31: cleanup-on-touch exempts `*.generated.ts`/`_generated/**`
    (generators get a one-time upgrade). One-time unmask chore (forced
    rebuild + turbo cache bust on main) runs this week, independent of the
    PR.
16. **PR-I "agent kit".** #45 `beep agent report` write/check (completion
    packet gains an `opportunities` field — durable home of the #54
    reflection rider), #48 `beep worktree ready`, #49 wave partition
    manifests + `beep wave lint`, #52 `beep agent brief` including #53a's
    needs-operator operation list. Definition-of-done rider applies: each
    command ships its awareness surface (AGENTS.md tool-routing block, skill
    references, gate output naming the widget) in the same PR.
17. **PR-C amendments.** #40 changed-scope jsdoc inventory REPLACES o1-A's
    shard-cache design (origin/main...HEAD + dirty, docgen:local pattern;
    sound because findings are per-file and untouched packages inherit
    baseline by construction — sound ONLY while analyzer inputs are
    unchanged: edits to the inventory scanner, its policy/config, or other
    global inputs escalate the PR lane to the full repo-wide sweep, same
    conservative posture as #11's docgen levers, review-hardened on #558);
    full sweep moves to main/nightly — refines decision 5, hosted PR lane
    goes scoped. #41 folds into the coverage
    item: affected-only measurement + forensics on the 0/231 cache-hit
    mystery. #44 rider: coverage failures print the corrected baseline hunk.
18. **PR-B amendment.** #36 rides PR-B: hosted lanes embed their exact local
    repro command in `$GITHUB_STEP_SUMMARY` — same check.yml surface as
    #13's failure excerpts.
19. **PR-G "preflight parity".** #28 preflight-before-push reorder + #29
    changed-package vitest + #43 touched-package src+test overlay generator,
    run concurrently (~2.5 min wall) + #46 `beep ci affected-lanes` and
    per-gate JSON battery verdicts (retires ad-hoc battery.zsh) + #47
    `beep ci logs <lane>` failure-region fetcher.
20. **PR-H "teach pack" + codemod.** #33 `jsdoc-ratchet --fix` (the gate
    carries its codemod) + #50 gate failure-output contract (findings +
    repro command + doc pointer, schema-shaped; scaffold emits by default;
    meta-lint audits existing gates). #32 lands as its own mass-diff PR
    immediately after H by running the `--fix` repo-wide once.
21. **Structural CI disposition.** #21 CLOSED (subsumed by #25). #24
    workstation-runner pilot folds into the LAN-cache spike session ($0
    hardware, hygiene rails per ledger; AWS variant waits for pilot data).
    #25 `yeet predict-squash` read-only spike enters the queue. #22
    merge-queue evaluation triggers on E-wave monitor data (treadmill tax
    quantified), pairs with deferred lane consolidation. #26 capsule
    protocol + #35 fingerprint lane-collapse → grill #5 design docket, after
    B/G/E teach us the fields. #27 attestation parked behind #24 + #26.
    Grit collector PARKED — #40's changed-scope collapsed its payback;
    revivable only if nightly full-sweep cost matters. Updated spike order:
    LAN cache + workstation runner → predict-squash → single-process battery
    → vitest projects → stage-3 html.
22. **Test-typecheck blindspot burn-down: passive + opportunistic.** The
    ratchet (standards/test-typecheck.blindspot-baseline.jsonc) blocks new
    blindspots; queued PRs wire test typecheck for packages they already
    touch; no new gate (gates-diet doctrine), no dedicated burn-down series.
    Upstream @effect/tsgo issue (MethodDeclaration owners +
    callback-position functions) drafted by the agent, filed by the operator
    this week; effect-fn law re-pruned after upstream ships.
23. **Sub-agent reflection harvest (#54).** Standing prompt ritual effective
    immediately: every sub-agent reports friction/opportunities before
    finishing; orchestrator harvests into the ledger. Structured home is
    #45's `opportunities` field once PR-I lands.

## Grill #4b — per-item design pass (2026-08-04, same session)

Operator asked for per-item coverage before implementation begins; the audit
found #17–#19 unplaced and design trees open on PR-I/C/G/H. Ten more
decisions close them:

24. **#17–#19 placement.** #18 hot-barrel advisory → PR-F rider (advisory
    severity, changed-scope, curated hot-barrel list — schema root, html
    root, agents-use-cases public/server). #19 `beep quality probe <file>` →
    PR-G, sharing #43's overlay-generator internals so measurements stay
    method-identical. #17 `beep architecture add-leaf` → triggered: opening
    commits of the first stage-2/protocol-boundary PR, proving the codegen
    against a live boundary in the same diff.
25. **#55 fallow advisory self-heal.** Stale or mode-mismatched envelopes
    are purged and the phase skips with a verdict note — an advisory phase
    never exits 1 (precedent: decision 2). PR-E rider.
26. **#52 `beep agent brief`.** AgentBrief S.Class → fenced-markdown render
    (+`--json`); contents: env facts (tool paths, zsh -ic wrapper), git
    facts, PR facts, boundaries, scratchpad path, canonical gate commands,
    and the #53a needs-operator list as a curated in-code LiteralKit domain.
    PR enrichment default-on behind a short-TTL per-branch cache;
    `--no-remote` opt-out.
27. **#45 `beep agent report`.** Packet at `.beep/agents/<name>/report.json`:
    agentName, waveId?, status (complete|partial|blocked), filesTouched,
    gatesRun {command, exitCode, excerpt, durationMs}, outOfScope
    encountered, open questions, opportunities {kind: friction|wish, text}
    (#54's structured home). `check` validates schema + file-claim drift by
    default; `check --prove` re-runs claimed gates. Rule 4 becomes
    machine-checkable without a 2× gate tax per wave.
28. **#49 wave manifests + lint.** WaveManifest at
    `.beep/waves/<id>/manifest.json`: glob ownership (most-specific claim
    wins) + shared bucket (changesets, lockfile); drift has TWO detectors —
    (a) dirty files outside every claim, and (b) any agent report's
    filesTouched escaping that agent's own resolved claims, which catches
    the cross-owner case where A edits a file validly claimed by B
    (review-hardened on #558); attribution joins the manifest with #45
    reports to name the straying agent; report-only posture with a
    signaling exit code — no blocking hook.
29. **#48 `beep worktree ready`.** Idempotent create-or-refresh (new
    branches cut from origin/main after fetch); `bun install` iff bun.lock
    hash ≠ per-worktree stamp OR the install-health probe fails
    (node_modules missing, or a sentinel binary such as
    `node_modules/.bin/tsgo` absent) — a matching stamp must never mask a
    deleted or gutted node_modules (review-hardened on #558); turbo-cache
    verify-and-report with `--isolate-cache` opt-in; finishes by emitting
    the #52 brief. Never mutates a dirty worktree.
30. **#11 docgen escalation narrowing.** turbo.json docgen-slice hash +
    bun.lock moved-entry dependent-closure attribution; escalates to the
    full proof whenever narrowness is unprovable (parse failure, closure
    escaping the changed set). o3-B ship porcelain and o4-B coverage
    designs stand as grilled in #3, with #41 forensics and #44 rider folded
    in.
31. **PR-G posture + consistency locks.** Preflight red blocks the push;
    `--push-anyway` proceeds and records the overridden findings in the
    verdict. Battery verdicts reuse #45's GateRun shape (one schema, two
    consumers); `ci affected-lanes` derives from the hosted lane
    definitions (single source of truth); #43 overlays generate into
    gitignored `.beep/overlays/`.
32. **#50 contract enforcement: ratcheted advisory.** GateFailure schema
    (findings + exact repro + binding-doc pointer; text render for humans,
    S.encode JSON for agents); baseline file freezes existing non-compliant
    gates; the new-gate scaffold emits the contract so new gates are born
    compliant and the ratchet blocks new baseline entries; existing gates
    migrate cleanup-on-touch. `--fix` default-off, in-place, diff-reviewed;
    #32's repo-wide run stays its own mass-diff PR.
33. **Coverage audit result.** With 24–32 locked, every ledger item #1–#55
    holds a shipped state, a design + vehicle, a trigger, or an explicit
    parking. Per-item grill coverage is complete; implementation may start
    at PR-E.

## Fleet-coordination amendments (2026-08-04, beep-effect5 session)

34. **#22 split, #16 transferred.** The fleet-coordination session
    (beep-effect5, 13-clone/one-machine scope; cross-machine out of scope
    per operator) owns the merge-queue design half — mechanism, cost, batch
    bisection under a 13-agent fleet. Speed-loop keeps only the E-wave
    treadmill-tax measurement feeding that design, and opens no grill #5
    item re-deriving merge-queue mechanics. #16 fleet housekeeping
    transfers: the fleet session's scan produces the staleness inventory.
35. **PR-I schema reservations for fleet reuse (implement now, no hold).**
    (a) #49: the ownership-claim record splits out as its own named schema
    — OwnershipClaim (owner, ownedPaths, doNotTouch) — with waveId living
    on WaveManifest, never on the claim, so a fleet-scoped registry reuses
    the record instead of forking it. (b) #52: AgentBrief carries an
    optional fleet extension block from day one; the PR-enrichment TTL
    cache is keyed generically rather than branch-hardcoded. (c) #45:
    report paths stay deterministic (.beep/agents/<name>/report.json) and
    `beep agent report list` enumerates them, so out-of-session readers
    discover reports without the writer's context. PR-I ships in its queue
    slot with these shapes — one extra named schema, no wait on the fleet
    grill.
36. **Worktree detection law (fleet finding).** `[ -d "$d/.git" ]`
    silently skips linked worktrees — `.git` is a FILE there. #39 sweep,
    #48 worktree ready, and any future worktree-aware step detect via
    `git rev-parse --git-dir` / `git worktree list`, never a .git-directory
    existence check.
37. **OwnershipClaim stays provenance-free; fleet wraps.** Decided against
    a `provenance: declared | derived` discriminant on OwnershipClaim: the
    record describes WHAT is claimed; how a claim came to be known
    (scannedAt, signal, liveness, expiry) is knowledge about the claim and
    lives on the fleet layer's wrapper (FleetClaim { claim, ... }). Wave-
    side the discriminant would be a constant `declared`; derived claims'
    differing expiry semantics is the signature of decoration, not
    discrimination. If a mixed-collection consumer ever needs provenance on
    the record, #34's append-optional lint makes that a safe versioned
    addition — reserving the field now buys nothing. PR-I implementers: do
    not add provenance "helpfully."
38. **#56 ↔ #22 sequencing coupling (fleet cost-model finding).** Scoped PR
    checks (#56) + full gauntlet at merge-group time dissolves most of the
    "24 required checks serialize a 13-agent fleet" objection to a merge
    queue. #56 therefore sequences BEFORE any #22 adoption and the two are
    evaluated as a composition, not independently; the fleet session names
    the specific flip condition so the E-wave treadmill data settles
    adoption without reopening design.

## Fleet handoff #2 amendments (2026-08-05, HANDOFF-2-pre-push-and-guard.md + PR #562)

39. **#551 monitor regression → PR-E triage MUST-FIX.** Verified on
    feat/merge-loop: `runMonitorPhase` decodes the first context result
    unconditionally (Handler.ts:696) while all three planner variants emit
    monitor steps only under `--monitor`; empty steps → `""` → decode
    failure → every no-`--monitor` publish (including the CLAUDE.md default
    `publish --message`) exits 1 after full success. The `:719` guard on
    the status summary proves the empty case was known one call below. Fix:
    early-return from `runMonitorPhase` when `monitorSteps` is empty
    (restores pre-aee2664b91 no-op semantics) + a regression test asserting
    the default plan performs no monitor decode and exits 0. Lands in PR-E
    triage — this branch owns the file; a main-side hotfix would conflict
    with the in-flight rebuild. Also a live Mode B specimen: a shared-file
    change green on the author's flag path broke a different clone's
    default path a day later → motivates ledger #61.
40. **Pre-push wiring lands in PR-G; the marker rides earlyPushStep too.**
    The marker's semantic is "this push is yeet-orchestrated," not "a full
    proof exists at push time" — both pushStep and earlyPushStep are
    orchestrated; ad-hoc `git push` is the target the hook exists to catch.
    The earlyPushStep comment's secret-blocking rationale is satisfied
    earlier: `gitleaks protect --staged` runs at pre-commit, so no commit
    can exist with staged secrets. Work items: lefthook.yml pre-push stage
    → `beep yeet pre-push-hook`; `runPrePushHookMode` honors
    `BEEP_YEET_REUSE_PRE_PUSH_PROOF=1` as passthrough (without it,
    `--fast --monitor` self-blocks — Planner.ts:610 omits the proof step
    under that combination); `assertReusableVerifiedState` failure text
    becomes caller-aware (#50 rider). The env-var marker is an
    accidental-bypass control, not a security boundary (same class as
    `LEFTHOOK=0`) — accepted. OPEN for grill #5: blocking-from-day-one vs
    advisory-first, and an emergency-push carve-out — the 2026-08-05
    drive-recovery "push everything before fs recovery" is the live case a
    fail-closed hook must not block mid-incident.
41. **Q7 staleness guard sequenced behind the #21/#25 comparison;
    measure-first law accepted as binding.** No path enters a policy
    surface unmeasured. Measured against 253 first-parent main commits,
    only `biome.json*` (4.0%) and `turbo.json` (5.1%) clear the bar; the
    proposed 14-path surface would hard-fail 53% of publishes one commit
    behind, 98% at five — it reproduces the treadmill it targets. If
    tree-keyed proof reuse (#25, proofs keyed to tree hashes surviving
    pushes/rebases) is viable, the guard is redundant, not complementary.
    The comparison happens in PR-G's research lane before any guard code.
42. **Decision 36 refinements (fleet audit; sweep-engine triage items).**
    (a) find-based liveness uses `-name .git -prune` — `-not -path
    '*/.git/*'` does NOT exclude `.git` itself and gave a 100%
    false-positive liveness signal fleet-wide. (b) `FETCH_HEAD` lives in
    `--git-common-dir`, not `--git-dir` — linked-worktree reads silently
    return nothing; #39 sweep and #48 must resolve via git-common-dir.
    (c) Change-surface computation uses `status --porcelain -uall` — plain
    `--porcelain` collapses a new package's N files into one path. All
    three are PR-E triage audit items against the just-built sweep engine.
43. **K1 correction: PR-I awareness surfaces use
    `hookSpecificOutput.additionalContext`, never plain stdout.** Hook
    stdout reaches model context ONLY on UserPromptSubmit,
    UserPromptExpansion, and SessionStart; PostToolUse stdout goes to the
    debug log. law-pulse.sh was a silent no-op 2026-07-05 → 2026-08-04
    (fixed in fleet PR #562, confirmed firing). Every PR-I delivery path
    (#52 AgentBrief, any pushed awareness) builds on additionalContext.
44. **merge_group vacuous gates + T4 cost correction.** (a) Under
    merge_group events, commitlint degrades to one commit
    (check.yml:599-609) and gitleaks runs `-1` with the base-pinned
    scanner-config hardening bypassed (:657-681) — both pass vacuously.
    Fix independent of whether #22 merge queue is ever adopted → ledger
    #62. (b) `strict_required_status_checks_policy: true` does not rebase
    anything; true cost ≈ one extra run per merged PR (~8/day), not the
    67–208/day herd T4 rejected by conflating it with an auto-rebase bot.
    Re-opened as a #22-adjacent option, still gated behind a green
    gauntlet.

## PR-E build-wave ratifications (2026-08-05, run wf_da334d69-0b9)

45. **Sweep engine design calls — RATIFIED (all five).**
    (a) `requiresOperator` is derived, never asserted: true only for
    `delete-remote-branch` with all preconditions met, so `--plan` batches
    the known-denied handoff (#53a) up front; safety blockers (tip
    mismatch, dirty tree, branch held) never become handoffs. (b) `ff-main`
    has three cases: main free → `fetch origin main:main`; another
    worktree holds main → skip; THIS worktree on main → `merge --ff-only
    refs/remotes/origin/main` gated on clean (without it the single-clone
    case never fast-forwards). (c) The dirty-worktree rail applies only to
    worktree-mutating steps (`lockfile-install`, `end-state`); ref-only
    steps stay unblocked. (d) Sweeping from the merged branch's own
    worktree is two-pass by design — `delete-local-branch` skips ("held by
    this worktree"), `end-state` moves to main, a re-run completes;
    moving HEAD ahead of the plan's safety facts would violate the rails,
    and no 7th step id is added for single-pass. (e) Failed commands
    report as `skipped` with the failure text — `SweepStepOutcome` has no
    failure member by design; only permission-denial remote deletions
    become `needs-operator`.
46. **Reply engine design calls — RATIFIED (all seven).** `isOutdated` is
    NOT stale — an outdated thread is still open and still blocks merge;
    only `isResolved` settles as stale (schema JSDoc narrowed to match in
    the fix wave). Duplicate-target drafts: second settles `failed` (the
    single live snapshot cannot see the first write). Live-action
    `threadId` stays `S.NonEmptyString` — the PRRT_ prefix check lives
    where paste errors are real (drafts), not on GitHub's own values. PR
    number comes from the drafts artifact, not the checked-out branch
    (either-party execution, 14(d)/#53(b)). Partial-failure honesty:
    post-ok/resolve-denied settles `failed` with a resolve-only retry that
    must NOT re-run `yeet reply` (would repost); post-denied carries the
    whole-command retry. Artifacts at packet root (`.beep/yeet/`) so both
    parties address the same paths — the cross-branch shared drafts path
    is flagged to the fleet scope. >100-comment threads warn by PRRT_ id.
47. **Monitor + integration calls — RATIFIED.** sweep/merge/reply are
    porcelain flag-bag runners, NOT `YeetRunMode` members — modes would
    drag attempt-journal/verdict/turbo-plan machinery through unreachable
    `$match` arms and hijack `--plan`. `readOnlyRunContext` extraction:
    porcelain never pays `collectTurboPlanSnapshot`. `MergeOutcome` stays
    stdout-only (its embedded sweep report IS persisted); a
    machine-readable merge trace waits for a consumer. The fallow "never
    reads a half-truth" posture is ratified as NARROWED by the C4 fix:
    defects among FRESH envelopes suppress that run's advisory read;
    stale/mode-mismatched envelopes self-heal silently (ledger #55).
    The `tooling-schema-first` lane failure (11 findings, lane absent from
    the composite battery) is attributed INHERITED — pre-existing on
    main, not PR-E's to fix. Rerun-teaching parity: `yeet status`'s
    `--failed` suggestion is made job-scoped in the fix wave so no yeet
    surface teaches what another bans.
48. **Fix-wave re-verify rulings (2026-08-05, run wf_7d56b3bb-e06;
    7/7 findings mutation-proven fixed, full battery green 69/1036).**
    (a) `yeet reply` preflight failure (nothing attempted) writes the
    all-failed report AND exits nonzero — the report is the accounting,
    the exit code is the verdict, so `beep yeet reply && ...` never
    proceeds past a run that posted zero replies. Per-draft failures keep
    exit 0: the batch ran and the report is authoritative. Sweep's exit-0
    needs-operator posture is unchanged — its denials are per-step,
    planned-for outcomes (#53a), a different class from a run-level
    precondition failure. (b) Rerun-budget key collision direction
    ratified: name-keying can only UNDER-spend (a shard family shares one
    allowance; the unrerun shard surfaces to the operator with its id) —
    a bound; id-keying over-spends without limit because each rerun mints
    fresh job ids. Under-spend is the safe failure direction. (c) The
    merge loop (`--until-merged`) writes no verdict artifact — accepted:
    it terminates in MERGED→sweep or CLOSED, and merge-readiness lands on
    `status.json` + stdout; the verdict record rides plain `monitor` and
    `publish --monitor`. (d) Known-unpinned, fast-follow: the
    `mergeReady` Ref-update wiring in `runMonitorMode` /
    `runPublishMonitorAndResult` survives deletion with the suite green —
    pinning needs a stubbed-snapshot integration test (ledger #66 family);
    the reshaped rerun teaching got its producer pin in-session
    (`yeetRerunJobListingCommand` / `yeetRerunDecisionText` + fixture
    cleanup, banned form now absent from the test corpus). (e)
    `YeetMergeReady` coherence filter enforces consistency, NOT reporting
    precedence (`failing` stays independently meaningful) — disclosed in
    the class Gotchas.
