# Running opportunities ledger — "well-oiled machine" watch (2026-08-04)

Standing mandate: capture every speed/efficiency opportunity noticed while
shipping PR-A/PR-B. Status: `unowned` (nobody decided), `queued` (in a locked
decision), `spiked` (needs measurement first). Reviewed at each grill.

## Ranked — highest impact first (2026-08-06)

The numbered items below are a JOURNAL, appended by provenance, and their
numbers are STABLE IDS: ~330 references across this file, GRILL-DECISIONS.md,
AGENTS.md, `ops/manifest.json`, `explorations/fleet-coordination/` (another
clone's packet), and repo source. NEVER renumber to express priority. This
section is the only priority axis — re-rank by editing here.

Scope: the 19 items carrying no locked decision and no assigned wave (65 of 85
are dispositioned). Method: three independent lenses — cycle-time removed,
unblocking/dependency order, cost-to-ship — merged by cross-lens agreement,
not by averaging (the axes are not commensurable). Provenance: run
`wf_b1f680b0-2df`.

1. **#82** publish's machine-parseable last line — one appended line; a piped
   publish destroys `$?`, false-greened twice. Unanimous.
2. **#60** generated-path → regenerate-command map — #74, #77, and #84 all
   consume it. Ship the map standalone first, then its consumers.
3. **#77** `publish --reconcile`; refuse `--amend` on a diverged branch —
   manual reconcile run 4× in one session; `--amend` hard-stuck once.
4. **#74** stale-base guard names class A vs B — fired 4/4; a Class B bypass
   would have REVERTED new `goals/INDEX.md` entries.
5. **#76** `verdict.json` lanes as composite sub-lanes — bimodal artifact
   (3 lanes green vs ~24 failed); one agent nearly false-greened it.
6. **#72** test-kit barrel import tax — 224s of a 278s run is imports, 6:1
   import-to-execution. Biggest single win AND the worst thing to run
   concurrently with a wave: wants a quiet single-owner PR.
7. **#64** wave gate attribution + test advisory lock — supplies #49's
   missing gate half; two concurrent vitest runs starved ~15 min.
8. **#70** append-optional lint: artifact vs input DTO — SCOPE, not
   follow-up, if PR-F goes next: #34's lint breaks every `buildYeetVerdict`
   call site without the discriminator.
9. **#67** adversarial-review harness + `yeet diff` — `git diff
   origin/main...HEAD` is EMPTY on uncommitted work, so review rounds ran
   vacuous.
10. **#73** publish detects an already-MERGED PR before pushing — #569 merged
    mid-proof and publish landed a proven commit in no PR at all.
11. **#83** status reconciles verdict against remote reality.
12. **#63** `A.filterMap` takes Result — 3 hits in one wave; the v3 shape
    silently empties arrays (a suite ran 31/32 green while broken).
13. **#71** mutation proof gate — 2 of 7 "fixed" PR-E findings survived a
    full revert with the suite green (~15s/finding).
14. **#58** decisions-PR adversarial review as a design gate — costs nothing,
    rides any PR as a decision-text amendment.
15. **#66** writer-level artifact coverage + encode lint — reverting the
    writer fix left 1004 tests green; 3 writers still on `renderJson`.
16. **#68** binding-contract block colocated with schemas — ~20 min scavenger
    hunt per implementer; deliverable is one paragraph.
17. **#65** dedupe/budget keys from retry-stable fields.
18. **#69** fixture corpus for hosted CI payloads — blocked on #47.
19. **#80** GitHub native stacked PRs — spike first per decision 49's
    evidence ladder; should not enter a wave yet.

Operator calls this ranking supports:

- **PR-B is unsupported.** Not one of the 19 routes there (decision 18 parked
  #36 in it; decision 13 calls PR-B execution-only on disjoint surfaces).
- **PR-I is the better-supported next wave**, provided it absorbs the
  agent-facing truth items; #64 is explicitly #49's missing half.
- **Cheapest real win on the board is a bundle no wave owns:** #82 + #76 +
  #73 + #83 — one coherent "publish output tells the truth" PR over data yeet
  already fetches.
- **#64 and #71 each have a cheap half shippable today** with zero machinery
  — #64's wave-brief law ("own test files during the loop, one full package
  run at integration") and #71's checklist line ("if the fix is a write, name
  the test that reads it back"). Taking the cheap halves decouples them from
  whichever wave runs next.
- **#57 is NOT in this pool.** Its own text routes it to the
  fleet-coordination docket, "not a speed-loop vehicle". It was mis-pooled as
  undispositioned; all three lenses caught it independently. Do not re-score
  it next cycle — the self-routing IS its disposition.

## Unowned — new candidates spotted tonight

1. **Incremental jsdoc inventory.** The ratchet lane regenerates the ENTIRE
   inventory (~230s) to check 20 totals, on every lint-policy/ratchet run,
   local and hosted. Changed-packages-only regeneration merged into a cached
   inventory would cut ~4 min per run independent of (and compounding with)
   the grit collector spike. Prime candidate for PR-A follow-on.
2. **Turbo cache-key audit.** Fleet data shows 12–30% local cache-hit rates
   on repeated tasks. Audit turbo.json per-task `inputs` for churn-prone
   globals (tstyche.json is gone now — what else invalidates everything?).
   Doubling local hit rates halves warm sweep times for free.
3. **Per-process bun startup tax in the battery.** Every battery step spawns
   `bun run beep …` (fresh process + CLI module eval, ~300–800ms × ~40 spawns
   per pre-push). A single-process battery runner (in-process step dispatch
   instead of subprocess per step) could shave ~15–30s per verify, plus makes
   step timing capture trivial.
4. **test:integration global `--concurrency=1`.** The SQL-serial constraint
   (shared external DB) is real, but it serializes NON-SQL integration suites
   too. Concurrency groups (sql-serial vs parallel-safe) would parallelize
   the rest.
5. **Coverage Regression lane: 692s p50 + ~25% fail rate** — highest
   rerun-multiplier lane; failure-source diagnosis still has no owner (from
   the B report candidates).
6. **The 15M-instantiation class** (agents/ontology/md/html lump): census
   stages 3–5 remain un-actioned — the biggest remaining check-time + RSS
   lever now that MimeType is fixed. professional-desktop still peaks 11.1GB.
7. **Verdict/proof run history.** Artifacts overwrite per branch (no attempt
   history). The instrument PR adds attemptId; an append-only run journal
   would make the fleet-scan analytics permanent instead of archaeological.
8. **Yeet publish UX debt**: the staged-only/amend/push-only flag matrix cost
   four publish attempts tonight even WITH the gotchas memory. After the
   PublishScope fix, consider a `beep yeet ship` porcelain that picks the
   right publish mode from repo state instead of flags.

## Queued (locked in grill decisions — tracked in GRILL-DECISIONS.md)

Gates diet; changed-scope lever; preflight wave; publish fix; instrument
hygiene (PR-A). Non-legal deletions; trusted-base turbo cache; setup-timing
ingestion; gitleaks image bump (PR-B). Grit collector (spike). Lane
consolidation (deferred pending cache measurements). Per-lane proof resume
(evidence-loop packet). Hosted changed-scope docgen; runner bumps
(evidence-gated); repo-utils helper consolidation (earlier follow-ups).

## Spiked / measure-first

- Grit collector: 230s → <20s target, byte-identical output gate.
- Lane consolidation: decide after cache lands + setup-timing data exists.
- Battery single-process runner (#3 above): measure spawn overhead precisely
  from the new instrument timing fields before designing.

## Wave 2 additions (2026-08-04, post-#548 observations)

9. **Re-measure lane parallelization — unblocked by #548.** The grill rejected
   parallelizing the serial 21-lane pre-push pending wall+RSS evidence; the
   MimeType fix just collapsed per-package check RSS (floor 1.39GB → 0.63GB,
   most packages now sub-second). The rejection condition is dissolving —
   re-run the census RSS columns post-merge and revisit with data.
10. **Post-MimeType runner right-sizing.** Hosted Check/Test lanes should get
    dramatically faster after #548 merges; re-baseline hosted p50s after a
    week, then consider moving 8vcpu lanes back DOWN (cost saving), the
    reverse of the earlier bump discussion.
11. **Narrow docgen full-proof escalation triggers.** Today ANY turbo.json or
    bun.lock byte escalates bounded docgen to the ~20-min full proof. Hash
    only the docgen-relevant slices (the docgen task's own turbo config; deps
    of packages whose lockfile entries moved) so global-config PRs stop
    paying the full proof unnecessarily.
12. **Cross-clone shared turbo cache (dankserver).** The fleet runs 28+
    clones, each with a private .turbo cache re-executing identical tasks. A
    LAN turbo remote cache would give cross-clone hits — the fleet TSV shows
    the same task hashes missing per-clone. Potentially the largest fleet-wide
    saving of all; needs a cache-server spike + the o2 key audit first
    (garbage keys make shared caches useless).
13. **Failure excerpts in step summaries.** Hosted job logs are sealed until
    the whole run completes — tonight every hosted red required a local
    reproduction to diagnose. If each lane wrote its failure excerpt to
    GITHUB_STEP_SUMMARY (the fallow lane already does), agents could diagnose
    from the API immediately. Cheap, high-leverage for agent loops.
14. **Schema barrel de-blast (census stage 2).** Check-time is fixed but the
    1.63M-instantiation barrel floor remains (literal tables ~34%,
    EntitySchema ~15%); subpath imports for hot importers is designed in the
    census §4 but owned by no PR. Memory lever now, not speed.
15. **Vitest transform consolidation.** Targeted runs tonight showed 4-21s of
    import/transform per package test invocation before tests execute;
    100+ packages re-transform shared substrate per run. Vitest projects mode
    or a shared transform cache could cut every test lane.
16. **Fleet housekeeping.** 28+ clones, several stale since June, each
    holding node_modules + caches. Archive/prune pass = disk + fewer
    accidental concurrent-writer surprises (tonight's twin-session event).

## Wave 3 (2026-08-04, from the D1/D2 and o5 work)

17. **Leaf-entry-point codegen.** D2 required hand-editing two exports maps,
    a publish map, and a tsconfig-sync pass. The agents/ontology protocol PR
    and stage-2 barrel work will repeat this many times — a
    `beep architecture add-leaf <pkg> <module>` codegen (exports + publish map
    + alias sync + docgen wiring in one command) makes every future boundary
    a one-liner.
18. **Hot-barrel import advisory.** The leaf wins are reactive; a preventive
    advisory (NOT a new blocking gate — noting the irony in a gates-diet
    session) could flag imports of known-hot barrels (@beep/schema root,
    @beep/html root, agents-use-cases public/server) from modules that only
    need leaves, keeping the de-blast from regressing. Candidate home: the
    existing import-policy lint family, advisory severity, changed-scope.
19. **`beep quality probe <file>` command.** The census per-file overlay
    ritual was hand-written ~10 times tonight (temp tsconfig + tsgo +
    extendedDiagnostics + parse). One command that emits the standard row
    (instantiations/check/RSS/version) would make probe-gating PRs trivial
    and keep measurements method-identical.

20. **[QUEUED → PR-A/I4] Zero-unresolved-comments as a yeet closeout gate.**
    Operator directive (2026-08-04): codify "0 unresolved / unaddressed PR
    review comments" in both the /yeet skill and beep-cli yeet so agents stop
    needing reminders. NOT Greptile 5/5 (usage limits make the score an
    unreliable hard gate — it stays a target, not a gate). Implementation:
    yeet status/monitor's remote closeout section already fetches PR state —
    extend with the reviewThreads GraphQL query (unresolved count), surface it
    in `yeet status`/`monitor` output, and make closeout/merge-readiness
    require unresolvedThreads === 0; skill doc gains the law. Note: GraphQL
    here is fine (one query per status check, not polling — the REST-for-
    polling memory concerns check loops).

21. **Input-hash proof-carrying CI jobs.** The gauntlet re-runs on every push
    because GitHub keys proofs by SHA, not by lane inputs. Give each lane an
    input hash (turbo dry-run already computes it; non-turbo lanes hash their
    scan scope) and short-circuit to success when a prior passing run on the
    PR proved the same hash (state via actions/cache or check-run lookup).
    Hosted twin of the per-lane proof/resume design. Care: required-check
    semantics for skipped bodies must still report success honestly.
22. **Evaluate GitHub merge queue.** Full gauntlet once per merge-group
    commit instead of per PR push; PR checks trim to fast lanes. Also
    structurally kills the base-refresh treadmill (tonight's 547→548→546
    re-verify tax). Needs ruleset changes — pairs with the deferred lane
    consolidation decision.
23. **`gh run rerun --failed` in the agent loop/yeet monitor.** For
    same-SHA flaky reds, re-run only the failed jobs instead of pushing or
    waiting; teach the monitor to distinguish "needs code fix" from "flake →
    rerun-failed". Free and immediate.

24. **Self-hosted/owned CI runners on AWS (+ workstation runner).** Blacksmith
    cost >$50/week; ephemeral spot runners with a pre-baked image (bun +
    installed tree + warmed turbo cache) could cut cost 50-80% (estimate,
    verify pricing) AND erase most of the ~60s/job setup floor. Unlocks:
    per-lane instance right-sizing from census data, VPC turbo S3 cache
    (makes #12 trivial), Firecracker warm-fork runners (un-traps the ADHD
    RAM-checkpoint idea), trusted runner identity for the attestation model.
    Risk model (corrected 2026-08-04: operator has zero contributors):
    with "require approval for all outside collaborators" set, no fork PR
    executes anywhere without an explicit approval click — contributor risk
    is effectively nil. Remaining hygiene is about third-party dependency
    code executing in CI (true on managed runners too, blast radius now
    ours): ephemeral single-use VMs, no ambient long-lived secrets,
    OIDC-scoped credentials. Verdict upgraded: pilot can proceed without
    heavy ceremony. The idle 32c/128GB workstation is a $0 candidate under
    the same hygiene.

## ADHD harvest (2026-08-04 divergent run; full pool + deepen JSON in scratchpad/adhd/)

25. **Prove-the-merged-object.** yeet predicts the exact squash tree, proves
    that tree identity once, attestation binds tree+base+toolchain; proofs
    keyed to tree hashes survive pushes/rebases (subsumes and strengthens
    #21). First step: read-only `yeet predict-squash --pr` spike validated
    against already-merged PRs' actual main trees. Risk: merge-time
    atomicity gate. Children: tree-attested proof cache; operator merge-order
    planner pre-proving the queued chain.
26. **`ci-failure-capsule/v1` protocol.** Every `beep ci lane` nonzero exit
    emits a schema-validated capsule (env fingerprint, command, input hashes,
    bounded logs, resubmission label); agent loop consumes capsules instead
    of log archaeology; `beep ci reproduce <capsule>` replays locally.
    Generalizes Fallow envelopes + FlakeQuarantine artifacts; upgrades #13
    and #23 into one protocol. Risk: replay laxity as branch-protection
    bypass — promotion stays operator-gated.
27. **Lane attestation customs model (★ non-obvious pick).** DSSE-style
    signed lane envelopes (input-closure Merkle root, toolchain identity,
    workstation/owned-runner key); hosted CI verifies seals + risk-weighted
    spot-audits instead of re-executing everything. Couples with #24 (owned
    runner = signing identity). First step: shadow-mode unsigned envelopes on
    the typecheck lane, input-closure vs full-rerun comparison — no skip
    decisions until shadow proves sound. Risk: undeclared-input unsoundness.
    Traps recorded from the run: shadow-main outcome racing, RAM-fork on
    unowned infra (un-trapped by #24), rule-mutation fitness (Goodhart),
    monorepo capsule dissolution.

## Shipping harvest (2026-08-04, PR #551 first red wave — why 8 hosted lanes found what local didn't)

28. **Pre-push cheap wave in the ship flow.** The fail-fast ship flow pushed
    first and ran verify in parallel; the preflight wave (~90s: knip, fallow,
    changeset, sanity) then found red locally AND hosted simultaneously —
    burning a full hosted gauntlet on findings a pre-push preflight would
    have caught. Refine ship flow: run the cheap preflight wave BEFORE
    `git push`, then push, then heavy lanes in parallel with hosted. Cost:
    ~90s serial latency per ship; saves a whole hosted round-trip whenever
    preflight is red (this wave: 2 preflight-detectable lanes red).
29. **Changed-package unit tests as a preflight gate.** The `attemptId`
    verdict-schema break red-flagged THREE hosted lanes (Test Unit, Property
    Laws, Coverage Regression) but is caught by repo-cli's own vitest suite
    in ~60s. Add `test:changed` (vitest only for packages whose src changed)
    to the preflight wave. Complements #28; both together would have made
    this wave's red map fully local.
30. **Gates teach the fix at point of failure.** JSDoc Ratchet printed only
    "migrate @example" — no template, no doc pointer — while most repo JSDoc
    is legacy, so agents guess and fail repeatedly (user-observed chronic
    failure). Fixed in this PR: cleanup-on-touch failure output now prints
    the carrier→section transform table + binding-law path. Ritual: every
    gate's failure output must name the exact fix or the doc that does
    (effect-fn and schema-first already do; audit the rest).
31. **Cleanup-on-touch must exempt generated files.** The gate flagged
    `Runpod.generated.ts` and `Html.language-tag-registry.generated.ts` —
    generated carriers whose fix belongs in the generator, not the output.
    Exclude `*.generated.ts`/`_generated/**` from cleanup-on-touch (their
    generators get a one-time titled-grammar upgrade instead).
32. **Repo-wide legacy JSDoc codemod (debt bomb defusal).** Wide PRs incur
    mass cleanup-on-touch migration debt (36 findings on #551's ~116-file
    diff). The python transform used on #548/#551 (remarks→Details,
    @example→titled Example) is ~80% mechanizable; run it repo-wide as its
    own PR, then cleanup-on-touch shrinks to a no-op for future PRs and the
    "agents don't know the pattern" failure class dies structurally.

## Discussion harvest (2026-08-04, while integrating the #551 fix wave)

33. **Gates that fix instead of teach: `jsdoc-ratchet --fix`.** The carrier
    migration is ~80% mechanical and has now been run three times as an ad-hoc
    python transform. Ship it as the gate's own repair arm: `beep quality
    jsdoc-ratchet --fix` emits the @example→titled-Example / @remarks→Details
    migration; agents review a diff instead of hand-editing. Doubles as the
    implementation vehicle for the repo-wide codemod (#32): run once
    repo-wide, keep forever as the gate's `--fix`. Generalize the principle:
    any cleanup-on-touch gate with a deterministic fix carries its codemod.
34. **Append-optional law for persisted artifact schemas + lint.** The
    `attemptId` incident is a class: a new REQUIRED field on a schema whose
    instances outlive the code (verdict.json on disk) red-flagged three
    hosted lanes. Law: on any schema carrying a `schemaVersion` literal, new
    fields must be modeled as `S.OptionFromOptionalKey(...)` piped with
    `SchemaUtils.withNoneDefault` (decoded side Option, absent key → none,
    constructor defaults none) — or the version literal must bump. Enforce in
    schema-first lint: diff field requiredness of version-carrying S.Class
    schemas against origin/main; flag "new required field without version
    bump". Prevention, not acceleration — cheapest item on this list.
35. **Cause fingerprints → lane collapse in monitor/status.** Eight red
    lanes on #551 were three root causes; discovering that took six job-log
    downloads. Lanes should emit a failure fingerprint (failing test id or
    first-error signature — FlakeQuarantine already computes
    `cause_fingerprint`); `yeet monitor`/`status` groups red lanes by
    fingerprint and renders "8 lanes red, 3 causes". Slots into the
    ci-failure-capsule protocol (#26) as a field, not a new system.
36. **Per-lane local-repro command in hosted check output.** Local verdict
    lanes carry `repairCommand`; hosted lanes carry nothing, so every hosted
    failure starts with log archaeology. The lane definitions in
    GithubChecks.ts know their own invocations — embed the exact local repro
    command per lane in the `$GITHUB_STEP_SUMMARY` (and/or check-run output).
    #30's teach-at-point-of-failure philosophy applied to lanes.

## Probe harvest (2026-08-04, effect-fn redundancy workflow, 8 agents adversarially verified)

37. **tsbuildinfo plugin-diagnostic mask (soundness hole across 130 packages).**
    Effect language-service diagnostics are persisted per-file in tsbuildinfo
    `semanticDiagnosticsPerFile`, but the `plugins` block is NOT part of the
    options hash: flipping a rule off→error re-runs nothing on warm state —
    stale diagnostics replay verbatim (bidirectional; `-p` equally affected
    since base config sets `incremental: true`; composite references propagate
    the mask; turbo caches AND restores tsbuildinfo as a `check` output, making
    a stale mask durable across machines and CI). 16/16 claims confirmed by
    adversarial verify. This — not a plugin defect — is why rules mass-enabled
    in May 2026 "didn't fire in some packages". Remedies: content-hash the
    plugins block into a generated sentinel `.d.ts` included by every program,
    or detect plugin-block drift and run `tsgo -b --force` once; compiler-
    version bumps already unmask (bounding the window). Fixing this covers all
    ~70 configured plugin rules, not just effectFnOpportunity.
38. **effect-fn law prune verdict: KEEP — detectors are complementary, not
    redundant.** The probe refuted the prune premise three ways. (a) Test
    coverage is sound today: all 663 `/test/` files are plugin-checked on
    hosted CI — `check:tsgo:tests` runs inside the hosted Check lane two
    script hops below the YAML (`ci lane check` → root `check` script →
    rootCheckSteps; only `--filter`/`--since` suppress repo-wide steps,
    `--affected --summarize` do not). (b) The historical test-file miss was a
    deliberate `**/test/**` severity-off block in tsconfig.base.json at the
    law's creation (since removed). (c) The "some packages" miss is #37's
    mask. Meanwhile the shape matrix shows neither tool subsumes the other:
    the plugin never fires on MethodDeclaration owners or callback-position
    functions (the law catches both; its tests document this as intentional),
    while the law misses directly-returned `Effect.gen(...).pipe(...)` (19
    live sites on its scan surface — plugin catches, with pipeTransformations
    fix) and any Effect binding not literally named `Effect`. Keep the law
    (~5.3s, currently 0 violations); the shrink path is upstreaming the
    method/callback shapes to @effect/tsgo, then re-running this prune
    analysis. Bonus fixes surfaced: dead `"tooling"` entry in testSearchRoots
    (Quality.command.ts:269), and 69 packages still lack per-package test
    typecheck in `check` (already ratcheted:
    standards/test-typecheck.blindspot-baseline.jsonc, 65 findings).

39. **Post-merge workspace reset (`yeet sweep`).** After the merge lands via
    gh CLI, the local clone is left stale and the NEXT yeet run pays for it:
    the feature branch lingers, origin refs are unpruned, local main is
    behind (stale-base → rebase treadmill), and a lockfile-moving main means
    stale node_modules phantom failures. Add a closeout step (or standalone
    `beep yeet sweep`) that leaves the clone ready to go: (a) `git fetch
    --prune`; (b) FF-only main update — worktree-aware: when main is not
    checked out anywhere use `git fetch origin main:main`, when another
    worktree holds main skip-and-report rather than checkout; (c) delete
    local branches fully merged into origin/main (`git branch -d`, never
    `-D`; skip any branch checked out in a worktree, skip branches with
    unpushed commits); (d) diff the lockfile across the main update and run
    `bun install` when it moved; (e) end on main (or report why not).
    Safety rails: never touch a dirty worktree, report every skip with its
    reason, and never force-delete — unmerged local work is sacred. Natural
    wiring: the tail of `yeet monitor`'s merged-PR path and/or closeout.

    *Live evidence (#551 merge, 2026-08-04):* `gh pr merge --squash
    --delete-branch` from the agent worktree API-merged successfully, then
    its LOCAL cleanup failed (`fatal: 'main' is already used by worktree at
    …/beep-effect3`), exited nonzero — mimicking a failed merge — and
    silently ABORTED the remote branch deletion. Sweep must therefore own
    the whole post-merge sequence itself: merge WITHOUT `--delete-branch`,
    verify merged state via API, then do remote deletion + ref updates +
    local cleanup as its own worktree-aware plan steps, classifying
    "merged, cleanup skipped: <reason>" as success. Also confirmed:
    `git fetch origin main:main` correctly refuses when main is checked out
    elsewhere — the skip-and-report branch of (b) is reachable and needed.
    Squash-merge detection note for (c): merged branch tips are NOT
    ancestors of origin/main, so `git branch -d` will refuse there. The
    force-deletion contract (review-hardened on #558): `-d` stays the tool
    for ancestry-merged branches; `-D` is permitted ONLY when ALL of
    (i) the branch's PR is MERGED, (ii) the local tip equals that PR's
    recorded head SHA (post-merge pushes make the MERGED state stale —
    tip mismatch means local-only work exists), and (iii) the branch is
    not checked out in any worktree. Remote deletion requires the same
    tip match against the remote ref. Any precondition failing →
    skip-and-report with the reason; unpushed/unmatched work is sacred.

## Discussion harvest (2026-08-04, while driving #551's fix waves to green)

40. **Changed-scope jsdoc inventory.** The ci lane spends 242s generating the
    repo-wide inventory (`quality jsdoc-inventory`) to feed a 2s ratchet —
    7m26s hosted lane total on #551. The ratchet needs only tracked-package
    baseline counts plus findings on touched files; scope inventory to
    `origin/main...HEAD` + dirty exactly like docgen:local, and reserve the
    repo-wide inventory for main/nightly. Likely the cheapest large
    lane-time cut currently on the board.
41. **Coverage lane affected-scoping + cache forensics.** Longest pole on
    #551's run: 18m28s, and 0 of 231 turbo coverage tasks were cache hits.
    Two independent levers: (a) measure coverage only for affected packages —
    the per-package ratchet comparison for untouched packages is a no-op by
    construction; (b) find out why coverage tasks never cache (outputs not
    declared? TURBO_FORCE? instrumentation nondeterminism?) — either lever
    alone is minutes off every PR.
42. **Merge-readiness as data + a monitor that survives pushes.** The merge
    protocol (checks pass + threads resolved + Greptile 5/5) is enforced by a
    human reading three surfaces, but monitor/status already fetches all
    three: emit a single `mergeReady` verdict naming the failing criterion.
    And `yeet monitor` exits 1 on first red, forcing a manual re-arm after
    every push — add `--until-merged`: follow new SHAs, keep babysitting
    through fix waves, end merged-or-abandoned. Natural pair with #39's
    sweep as the merged-path tail.
43. **Touched-package src+test typecheck in the pre-push wave.** #551's
    Check-lane red (verdict-fixture TS2739) was only catchable on hosted CI
    because local overlays checked `src/` while test files live solely in
    the `check:tsgo:tests` program. A combined src+test overlay per touched
    package (~90s for repo-cli) generated into the #28 cheap wave kills this
    failure class pre-push. Deliverable: an overlay generator, not a doc.
44. **Coverage failures emit their own baseline patch.** Truing up the
    repo-cli baseline meant fishing 58.81/67.69 out of a 10k-line job log.
    The lane computes those exact values — print the corrected
    `coverage.regression-baseline.jsonc` hunk (or write a patch artifact)
    next to the failure. Teach-at-point-of-failure (#33/#36 family),
    near-zero cost.

## Agent-ergonomics harvest (2026-08-04, operator wishlist — each grounded in a real incident from the #551 waves)

45. **Agent completion reports as schema-validated artifacts.** Three times
    this session a subagent went idle with no final report (fallow-fixes ×2,
    jsdoc-migrate, yeet-batch), forcing gate-based re-verification of unknown
    state. Widget: `beep agent report write` — agent writes a completion
    packet (files touched, gates run WITH exit codes and output excerpts,
    out-of-scope files encountered, open questions) to a known path before
    idling; `beep agent report check <agent>` validates it exists and its
    claimed gates actually pass. Makes partition-protocol rule 4 ("reports
    are not proof") machine-checkable instead of tribal.
46. **Lane-parity local proof: `beep ci affected-lanes` + structured battery
    verdicts.** The "why weren't these caught locally" class recurred twice
    today (test-file TS2739, coverage dip) because local proof and hosted
    lanes are different surfaces. Hosted lanes are already locally invokable
    (`beep ci lane jsdoc-ratchet` worked); missing pieces: (a) `beep ci
    affected-lanes` — list exactly which hosted lanes the current diff will
    trigger, with expected durations, so the operator runs them BY NAME
    pre-push; (b) battery runs emit a per-gate JSON verdict (pass/fail,
    duration, first-error, repro command) instead of agents hand-rolling
    zsh scripts and grepping tails. Subsumes the ad-hoc battery.zsh pattern.
47. **`beep ci logs <lane>` — failure-region fetcher.** Fetching one job log
    today took the `gh api .../logs --allow-escape-sequences | sed` incanta-
    tion, failed silently once with wrong flags, and returned 10k lines to
    grep for 3 relevant ones. Widget: resolve lane → job id for the current
    PR/SHA, fetch, strip ANSI, extract the failure region (first error +
    context + the lane's repro command), print attribution hints
    (introduced/inherited per #35's fingerprints).
48. **`beep worktree ready <branch>` — agent workspace provisioner.** Known
    failure classes when provisioning agent worktrees: missing node_modules
    (ENOENT on relative .bin paths), stale node_modules after lock-moving
    updates, shared-turbo-cache contamination. One command: create/refresh
    worktree, bun install iff lockfile differs, verify cache isolation,
    print the env-facts block (tool paths, branch, PR state) agents need.
49. **Wave partition manifests as data + `beep wave lint`.** Fix-wave
    partitions live in prose briefs today; enforcement is the orchestrator
    eyeballing diffs. Widget: orchestrator writes the partition (agent →
    owned file-set → do-not-touch) as a schema-validated manifest;
    `beep wave lint` diffs actual dirty files against claims and reports
    drift ("jsdoc-migrate touched Handler.ts — owned by yeet-batch"). Turns
    partition-protocol rules 1-3 from discipline into a gate.
50. **Gate failure-output contract (generalize #30).** jsdoc-ratchet now
    teaches at point of failure because we hand-built that output; every
    other gate still fails with bare findings. Convention + shared helper:
    a gate failure renders findings, the exact local repro command, and the
    binding law/doc pointer — schema-shaped so agents parse it. New-gate
    scaffold emits the contract by default; a meta-lint checks existing
    gates against it.
51. **`beep yeet reply` — auditable review-thread reply/resolve.** The
    operator cannot post PR thread replies (API write denied), so six
    verified fixes ended as paste-these-drafts handoffs. Widget: a drafts
    file (thread id → reply body) posted via the user's gh auth through a
    repo CLI command — auditable, permission-scoped, and it closes the
    "comments resolved" merge criterion loop that #42's mergeReady verdict
    checks.
52. **`beep agent brief` — canonical subagent context preamble.** Every
    subagent prompt this session hand-carried the same boilerplate: repo
    root, worktree state, tool paths (tsgo, mise/zsh -ic wrapper), branch/PR
    facts, do-not-touch dirs, scratchpad location. Generate that block from
    live repo state on demand; orchestrators paste one command's output
    instead of re-deriving env facts per prompt (and staleness bugs — wrong
    branch, wrong worktree — die with the hand-copying).

    **Definition-of-done rider for #45-52 (and any agent-facing widget):**
    shipping the command is half the item — the other half is the awareness
    surface, decided at grill time per item: an AGENTS.md law/tool-routing
    line, a skill reference update, and/or gate output that names the widget
    at the moment it's needed (#50's contract is the delivery vehicle for
    that last one). A widget agents don't discover in-context is dead code
    with extra steps; every one of these lands with its documentation in the
    same PR.

53. **Permission-envelope-aware handoffs.** Two denials this cycle (PR thread
    replies, `git push origin --delete`) were each discovered by attempting
    the operation mid-flow, failing, and falling back to a chat handoff — the
    user then ran the deletion in seconds under his own auth. The envelope is
    knowable in advance; make it data instead of discovered friction:
    (a) `beep agent brief` (#52) ships a "needs-operator" operation list
    (remote deletions, thread replies/resolves, anything else the session
    denies by policy) so agents PLAN batched handoff blocks — "here are the
    3 commands only you can run" — instead of serial try-fail-handoff;
    (b) design cleanup/closeout commands like `yeet sweep` (#39) and
    `yeet reply` (#51) to be equally runnable BY THE USER as one command:
    the agent's deliverable is the validated plan artifact, and whoever
    holds the permission executes it. Explicitly NOT in scope: widening the
    agent's permissions — the widget is knowing the boundary, not moving it.

54. **Sub-agent reflection harvest (operator directive, 2026-08-04).** Every
    sub-agent prompt in future workflows carries a reflection rider: before
    finishing, report tooling/process friction hit and widgets wished for —
    "additional Opportunities" from the trench view. The orchestrator
    harvests each report into this ledger on completion. Effective
    immediately as a prompt ritual; the durable home is #45's completion
    packet schema, which gains an `opportunities` field so the harvest is
    structured data instead of prose scraping. Rationale: the operator sees
    orchestration friction, sub-agents see execution friction — only they
    know which env facts were missing, which gate output confused them,
    which command they hand-rolled.

## Grill #4 dispositions (2026-08-04 — full docket; GRILL-DECISIONS.md #13–23)

Queue: PR-E "merge loop" → (PR-B ∥) → PR-F "soundness" → PR-I "agent kit" →
PR-C "pipeline 2" → PR-G "preflight parity" → PR-H "teach pack" → jsdoc
codemod PR. Spikes: LAN cache + workstation runner (one session) →
predict-squash → battery → vitest → stage-3.

- **PR-E**: verdict encode fix (Json-codec law for all yeet artifacts), #39
  sweep (merge porcelain + auto-sweep + SweepPlan/SweepReport + --plan), #42
  (--until-merged + mergeReady), #23 (fingerprint-gated rerun, once per
  lane/SHA), #51 reply (ReplyDrafts/ReplyReport, post+resolve), #38a
  testSearchRoots cleanup.
- **PR-B** += #36 hosted repro commands (joins #13's step-summary surface).
- **PR-F**: #37 sentinel ambient .d.ts remedy + #34 append-optional lint +
  #31 generated-file exemption; one-time unmask chore this week.
- **PR-I**: #45 report (+#54 opportunities field), #48 worktree ready, #49
  wave manifests + wave lint, #52 brief (+#53a needs-operator list);
  awareness surfaces ship same-PR per the rider.
- **PR-C** += #40 changed-scope inventory (replaces o1-A shard cache;
  nightly keeps full sweep), #41 affected coverage + cache forensics, #44
  baseline-patch emission.
- **PR-G**: #28 + #29 + #43 (concurrent preflight wave, ~2.5 min) + #46 +
  #47.
- **PR-H**: #33 --fix + #50 failure-output contract + meta-lint; #32 codemod
  PR immediately after.
- **Closed/parked**: #21 subsumed by #25; grit collector parked (#40
  collapsed its payback); #27 parked behind #24/#26.
- **Triggered dockets**: #22 merge-queue eval (on E-wave monitor data); #26
  capsule + #35 lane-collapse (grill #5).
- **#38b**: blindspot burn-down passive + opportunistic riders; upstream
  @effect/tsgo issue drafted by agent, filed by operator this week.
- **#24**: workstation-runner pilot rides the LAN-cache spike session; AWS
  after pilot data.

56. **Docs-only PRs short-circuit the inert lane family (operator idea,
    2026-08-04).** Build/check/test/coverage/docgen lanes are provably inert
    for `goals/**`/`explorations/**` markdown diffs, yet a docs-only PR pays
    the full gauntlet. NOT the naive fix: `paths-ignore` triggers leave
    required checks stuck "Expected" (unmergeable), and dummy-success twin
    workflows drift. Design: lanes always trigger; one shared
    `beep ci lane-scope` step computes diff ∩ lane input scope from a
    conservative curated inert-path allowlist; empty intersection → lane
    reports success immediately with a "no inputs in scope" conclusion in
    its step summary — required-check semantics honest, logic in one
    testable place. Never skips: gitleaks (secrets in prose; public repo),
    goals/reflection governance lints (docs PRs are their use case),
    commitlint. This is #21's input-hash idea in path-set form — the
    degenerate case shippable before #25's tree-hash machinery, and it
    retires into #25 when that lands. Evidence gate: after PR-B's
    trusted-base turbo cache lands, measure a docs-only PR's gauntlet —
    cache replay may already collapse the turbo-backed lanes (replay is
    proof, not skipping); implement the short-circuit only for what
    remains (likely coverage + non-turbo lanes). Vehicle: small hosted-CI
    PR after PR-B, evidence-gated. Coupling (fleet session, decisions
    37-38): #56 sequences BEFORE any #22 merge-queue adoption — scoped PR
    checks + full merge-group gauntlet is the composition that makes the
    queue affordable at fleet scale; OwnershipClaim ships provenance-free
    (fleet wraps, never mutates the record).

57. **Work-item claims for parallel sessions (input to the fleet grill;
    fleet-owned design).** The beep-effect5 ownership negotiation (#22/#16
    transfers, PR-I schema reservations, a "say so before PR-I lands"
    deadline) worked — but ran entirely through operator-relayed chat. The
    fleet session's OwnershipClaim covers FILES; nothing covers WORK ITEMS:
    ledger entries, design reservations, and their deadlines live in prose.
    A small claims manifest (item → owning session/campaign, reservations,
    expiry) would let parallel sessions discover "who has #22" without a
    relay hop. Explicitly an input to the fleet-coordination docket, not a
    speed-loop vehicle — recorded here so the trench evidence isn't lost.
58. **Decisions-PR adversarial review as a design gate (ritual).** The #558
    bot wave caught two P1 soundness holes (scoped-inventory unsound under
    analyzer changes; `-D` authorized by stale MERGED state) plus five
    hardening items — against PROSE, before any implementation existed.
    Cheapest possible catch point. Ritual: decisions PRs are review
    surfaces, not just records; review findings amend the decision text
    with a "review-hardened on #NNN" provenance tag (started organically on
    #558); implementers treat un-hardened decisions as less trustworthy
    than hardened ones.
59. **Thread triage context in status/monitor output (PR-E rider).**
    `yeet status` lists unresolved threads as opaque GraphQL ids
    (PRRT_...) + file paths; triaging #558's seven required a second REST
    pass and hand-mapping thread ids ↔ comment ids by file. Carry author,
    severity badge (parseable from bot bodies), first-line excerpt, and the
    numeric comment id per thread — so the #51 drafts file is writable
    straight from status output. Implementation note for #51: `yeet reply`
    must accept EITHER the REST comment id or the GraphQL thread id and
    resolve the mapping itself.
60. **Generated-file conflicts resolve by regeneration, not merging
    (sweep/rebase rider).** Live evidence: my INDEX.md heal raced the
    operator's #555 heal — benign only because both regenerations were
    deterministic and the rebase happened to converge. Repo-global
    generated artifacts (goals/INDEX.md, law allowlist snapshots, docgen
    aggregate, baselines) are guaranteed collision hotspots for parallel
    sessions, and hand-merging them is always wrong. Widget: a
    generated-path → regenerate-command map (data, not docs); rebase/merge
    tooling and #39's sweep consult it to auto-resolve conflicts under
    those paths by re-running the generator on the merged tree. The
    goals:index gate already teaches its writer command — this generalizes
    that contract into machine-consumable form (#50 family).

Fleet-coordination amendments (same day, beep-effect5 session;
GRILL-DECISIONS.md #34–36): #22 design half + #16 transfer to the fleet
session (speed-loop keeps the E-wave treadmill-tax measurement); PR-I
reserves fleet-ready shapes — named OwnershipClaim schema with waveId on
the manifest only, AgentBrief fleet block + generic TTL cache,
`agent report list` discovery; worktree detection law: never
`[ -d .git ]` (a file in linked worktrees).

Grill #4b per-item pass (same day; GRILL-DECISIONS.md #24–33): #18 → PR-F
rider (advisory hot-barrel lint); #19 → PR-G (shares #43 overlay
internals); #17 → triggered, opens the first stage-2/protocol-boundary PR;
#55 → PR-E rider (advisory phase purges stale envelopes + skips, never
exit 1); full designs locked for #52/#45/#49/#48 (agent kit), #11 (docgen
narrowing levers), PR-G posture (preflight blocks push, --push-anyway
audited), #50 (ratcheted-advisory contract). All 55 items now covered.

55. **Fallow advisory phase: stale envelopes should regenerate, not fail the
    run.** (Live incident, this PR's first publish attempt, 2026-08-04.)
    PR-A's envelope mode-split upgraded the old poisoning failure
    ("non-advisory envelope rejected") into a timestamp guard ("envelope(s)
    older than the Yeet run start") — correct detection, wrong reaction: the
    feedback phase fails the whole publish over gitignored, regenerable
    state, and the operator recovery is still the manual `rm -rf
    .beep/fallow` from the 2026-06 memory. The advisory phase should treat
    stale/mode-mismatched envelopes as absent — delete and regenerate (or
    skip with a note), never exit 1. Candidate vehicle: PR-E rider (it's the
    yeet surface); also a #50 exhibit — the failure output taught neither
    the fix nor the one command to run.

61. **Yeet publish flag-path regression matrix.** (From the #551 monitor
    regression, found by beep-effect5 tripping it publishing PR #562.)
    `publish`'s terminal behavior differs per flag combination (default
    `--message`, `--monitor`, `--fast --monitor`, `--start-pr-early`,
    `--staged-only`), and #551 shipped green on the author's combination
    (`--fast --monitor`) while breaking the default path for every other
    checkout — the exit-1-on-success went unnoticed for a day because this
    session also ships `--fast --monitor`. A stubbed-step test matrix
    asserting exit code + terminal phase behavior for each supported flag
    combination makes "green on my flags" insufficient to ship. Vehicle:
    PR-E rider (the tests colocate with the publish/monitor code being
    rebuilt there); the decision-39 regression test is its first row.
62. **merge_group parity for required security gates.** Under merge_group
    events commitlint depth degrades to one commit (check.yml:599-609) and
    gitleaks runs `-1` with the base-pinned scanner-config hardening
    bypassed (:657-681) — both required gates pass vacuously. Gate
    contracts must hold under every trigger event, independent of whether
    #22 merge queue is ever adopted. Vehicle: small hosted-CI PR; natural
    rider on PR-G parity work.

63. **Effect v4 `A.filterMap` takes `Result`, not `Option` — a wave-scale
    trap.** Three independent hits in one build wave (Sweep ×2, Reply ×1):
    the v3 muscle-memory shape compiles into silently-empty arrays under
    vitest (one suite went 31/32 green while broken — vitest does not
    typecheck) and tsgo rejects it with a TS2375
    `exactOptionalPropertyTypes` wall that names neither `filterMap` nor
    the fix. Correct v4 shape: `A.map(...)` + `A.getSomes`. Actions:
    effect-v4-imports skill note; memory line (done); candidate upstream
    `effect(outdatedApi)`-style one-liner diagnostic (the plugin already
    special-cases `Effect.iterate`). Wave law: run the tsgo overlay BEFORE
    the test pass — a green vitest run is not evidence of v4 API shape.
64. **Wave gate attribution and own-scope gates.** One worktree, four
    agents: concurrent full-package `vitest run` has no lock (two runs
    contended and both starved, ~15 min no output); failures in a full run
    include other agents' mid-edit files (two agents each burned two full
    runs distinguishing "mine" from "someone else's half-written file");
    no streaming totals when redirected, so alive-vs-hung needs `pgrep`.
    Actions: wave-brief law "own test files during the loop, one full
    package run at integration"; a `beep test` lane wrapper with an
    advisory lock that attaches to an in-flight run instead of starting a
    second; per-suite progress lines for background monitorability;
    file-scoped verdicts derived from wave-manifest claim globs (#46/#41
    kin, #49's missing gate-attribution half).
65. **Budget/dedupe keys must be built from fields documented stable
    across retries (.patterns/ law).** The merge-loop rerun budget keyed
    on `${headSha}#${databaseId}` — but job databaseIds are per-attempt
    records, so the budget reset itself on every rerun (unbounded reruns
    at one SHA; caught by adversarial verify, fixed to key on `job.name`).
    The class is mechanically detectable whenever the schema carries a
    stable sibling of the unstable field.
66. **Writer-level artifact coverage + mechanical S.encode-law
    enforcement.** All four PR-E artifact producers were initially tested
    only at the codec layer — reverting the writer fix left 1004 tests
    green (the codec is the layer that was never broken). Fix wave adds
    per-writer round-trips. Remaining: three yeet writers still on
    schema-agnostic `renderJson` (pr-closeout.json — now READ by the
    greptileScore path, proof lock/state ×2, quality issue index); no live
    Option bug today, but the first `OptionFromOptionalKey` field on
    `PrCloseoutReport` reproduces the verdict bug on a hotter path. Widget:
    a lint — "`writeTextFile` whose payload derives from a decoded
    `S.Class` must flow through a `JsonStringCodec`" — plus routing the
    three stragglers. #34 family, fast-follow PR.
67. **Adversarial-review harness (`beep review claims` + `beep yeet
    diff`).** Both reviewers hand-built evidence bundles (grep sweeps for
    `--failed`/`git add -A`/`--force`/`.git` probes, `git show
    origin/main:` for new-vs-preexisting attribution), and both hit `git
    diff origin/main...HEAD` returning EMPTY on uncommitted work — an
    agent trusting the prompt's diff command would have reported HOLDS on
    a 2,500-line change it never read. Widgets: a claims→evidence-bundle
    command with pre-existing-vs-new attribution; a `yeet diff` that
    unions staged + unstaged + untracked against the merge base; a
    prompt-side `status --porcelain -uall` sanity check before any
    review-by-diff (decision 42c's law, same reason).
68. **Binding-contract block colocated with schemas.** The sweep
    implementer spent ~20 minutes cross-referencing GRILL-DECISIONS 14(b)
    (the -D trio), ledger #39 (FF-refusal evidence), decision 36 (worktree
    law), and the step-id set that lives only in `Sweep.schemas.ts` JSDoc.
    A one-paragraph block colocated with the schema naming which decisions
    constrain it removes the scavenger hunt. #50 teach family.
69. **Fixture corpus for hosted CI payloads (`test/fixtures/gh/`).** The
    monitor classifier's `<job>\t<step>\t<timestamp>` shapes and
    `--log-failed` output were hand-authored from memory; one captured
    payload per fingerprint class + one genuine red + one bot review body
    per bot makes every future classifier change provable instead of
    plausible. #47's `beep ci logs` is the harvesting tool.
70. **Append-optional lint (#34) must distinguish artifact schemas from
    input DTOs.** `buildYeetVerdict` takes a positional object literal, so
    adding a field as `S.OptionFromOptionalKey` (the artifact law) BREAKS
    every call site while `S.optional` does not — on input DTOs the law
    would cause exactly the failure it exists to prevent. The lint needs
    the schemaVersion-literal discriminator (artifact) vs constructor-input
    shape (DTO) built in.

PR-E build-wave reflection harvest (2026-08-05, #54 ritual; 7 agents,
run wf_da334d69-0b9): new items #63–70 above. Evidence mapped onto
existing items — #43/#19: the brief's overlay recipe was broken as
written (missing `"rootDir": "."` → TS6059 ×65) and the shared
`tsconfig.overlay.json` filename collided (one agent deleted another's
mid-typecheck; a third created a content-identical sibling to avoid
exactly that) — the generator must emit per-scope overlays into
gitignored `.beep/overlays/` and the fix must reach the wave-brief
template; #49: test-kit barrels and overlays need shared-bucket manifest
entries like changesets/lockfile (every engine agent must append one line
to the same 45-line barrel — the hottest conflict in the wave), and the
drift detector must run DURING the wave to help the integrator, not
after; #52: "both gates green" (vitest+tsgo) let 19 biome + 6
schema-first + 6 tsdoc failures land on the integrator — the brief must
emit the complete per-package gate set (`bunx biome check --write` costs
~10s per agent); #50: the brief contained a nonexistent command (`beep
lint effect-fn`) whose args fell through to the full repo lint battery —
minutes of misleading failures; `beep lint`/`beep laws` should reject
unknown trailing args; #59 shipped: status threads now carry author,
excerpt, path, line, and commentDatabaseId.

71. **Mutation proof as a first-class gate.** Two of seven "fixed"
    findings in the PR-E fix wave (`mergeReady` threading, rerun-teaching
    reshape) survived full reversion with the entire suite green — both
    fixers reported FIXED in good faith; only the re-verifier's
    revert-and-rerun caught it (~15s per finding). Widget: a `beep`
    quality lane that takes a finding's changed expression, neuters it,
    and asserts some named test goes red — converting "I wrote a test"
    into "I wrote a test that binds". Same family as the memory'd
    vacuous-test-pattern; review-checklist line meanwhile: "if the fix is
    a write, name the test that reads it back."
72. **Yeet test-kit import tax: 224s of a 278s full run is imports.** The
    53-line `export *` barrel pulls ~17k lines of source into every test
    file; 69 files × barrel import = 6:1 import-to-execution ratio, the
    single largest wall-clock tax on every fix loop (and the reason
    single-file runs still cost ~5s each). Candidates: per-domain
    test-kit splits (sweep/reply/monitor/status), and a shared
    `stubSpawnerLayer(table)` in `@beep/test-utils` — four packages
    hand-roll the same ~35-line ChildProcessSpawner stub today, and the
    fix wave copy-pasted it twice more because file ownership forbade a
    shared helper.

73. **Yeet's push step should detect an already-MERGED PR.** (Lived,
    2026-08-06: PR #569 was merged while the leased-deletion commit's
    publish was mid-proof; the publish then pushed a proven commit onto a
    branch whose PR was closed — landing it in no PR. GitHub had even
    auto-deleted the branch; the push silently recreated it.) Before
    pushing, publish should read the branch PR's state: MERGED → stop and
    route to a fresh `gh pr create` for the unmerged tail (same branch is
    fine — the second PR carries exactly the unmerged commits). Recovery
    that worked: let the proof finish, `gh pr create` from the same
    branch (#571). Kin to #61 (flag-path semantics) and the merge loop's
    own CAS family.
74. **Stale-base overlap has two classes; the guard should name which.**
    (Both lived 2026-08-06, opposite verdicts.) Class A — self-overlap
    from a continuation branch's own squash merge (#571 second commit):
    the "changed on origin/main" files were changed by THIS branch's own
    #569 merge; bypass-safe, `--allow-stale-base` correct, and a rebase
    rewrites history for zero content change. Widget: patch-id
    comparison (or resolving the overlapping main commits to this
    branch's merged PR) auto-exempts it. Class B — overlap in whole-repo
    generated aggregates (parallel session, same day): goals/INDEX.md
    predated two new packets on main, and bypassing would have REVERTED
    their entries; the correct move is rebase + regenerate on the merged
    tree — ledger #60's doctrine, whose first evidence arrived through
    the stale-base guard rather than a merge conflict. Discriminator:
    is the overlapping path in #60's generated-path → regenerate-command
    map? Generated → regenerate, never bypass; self-squash source overlap
    → bypass.
75. **Fail-fast preflight lane battery, ordered by empirical failure
    frequency.** Three independent datasets in one week show the same
    shape: (a) a parallel checkout burned 4 of 5 ~17-minute proof cycles
    on repo-level gates package checks cannot see (test-file effect
    laws, goals-doctor reflection validation, jsdoc cleanup-on-touch,
    schema-first inventory); (b) this session's #569/#571 gauntlet — five
    serial publish failures (fallow introduced-duplication, schema-first
    exported-interface, eslint jsdoc warnings, jsdoc-ratchet
    cleanup-on-touch, stale base), each discovered at 7–15 minutes;
    (c) the PR-E fix wave's "vitest+tsgo+biome green" leaving 31 lint
    findings for the integrator. Doctrine: package-level
    `check && lint && test` is structurally weak here — the quality
    surface is repo-level. Widget: a `beep preflight` battery running the
    historically-failing cheap lanes fail-fast-first (schema-first, jsdoc
    family, effect laws incl. test files, goals-doctor, fallow audit —
    seconds-to-a-minute each), ordered by these observed frequencies
    (decision 41's measure-first law, now with real measurements).
    Vehicle: PR-G — and it reshapes decision 40: the pre-push hook's fast
    tier should BE this battery, which is what makes fail-closed wiring
    affordable. Ordering (amended on the parallel session's per-cycle
    data): observed failure frequency decides which lanes are IN the
    battery; COST ASCENDING decides the order — their cheapest gates
    (goals-doctor, changeset-status) were discovered in cycles 4 and 1,
    so a cost-ascending battery surfaces them in its first seconds.
    Confirmed additional member: `beep quality test-tsgo` — package
    tsconfigs `include: ["src"]`, so a package's own check never
    typechecks its tests; their TS2551 (`Order.string` vs `Order.String`)
    left sort comparators undefined at runtime while 19 tests passed —
    the silent-vacuity class, structurally invisible at package level
    (fix pattern on record: per-package tsconfig.test.json +
    beep:check:tests). Riders: #52 briefs must name repo-level lanes,
    never package scripts; interim doctrine = run the specific lanes
    before any full verify. Fourth dataset (beep-effect12 operator
    feedback): cleanup-on-touch joins the battery — it is deterministic
    from the diff and belongs in the first seconds, not at minute 17;
    "schema-first caught 3 stale entries in ~5s that would otherwise have
    been cycle #6".

76. **Verdict lanes must be the composite's sub-lanes.** (beep-effect12
    session feedback + this session's misattribution trifecta.) On success
    verdict.json records 3 lanes (the composite is one lane when green);
    on early-stop failure ~24 — a bimodal shape one agent nearly reported
    as a false green, and the artifact is strictly less informative than a
    grep of the run's own `[beep-github-check-run]` stdout line. Fix: the
    verdict writer flattens the composite's sub-lanes into the lanes
    array in both shapes, making verdict.json the truth surface its
    consumers already assume it is. Retires the 3-lane-shape memory
    workaround.
77. **`yeet publish --reconcile` + refuse `--amend` when
    pushed-and-diverged.** (beep-effect12 got hard-stuck exactly once:
    `--amend` on a pushed branch walks into a force-push the setup
    correctly denies.) The documented recovery — merge the moved base,
    regenerate aggregates per #60's map, verify, push fast-forward — was
    performed manually four times in this session alone; it is proven
    doctrine with no porcelain. Ship it as `--reconcile`, and make
    `--amend` detect pushed && diverged and refuse WITH that explanation
    (#50 grammar).
78. **Local-proof parity footer.** (beep-effect12's top pick, seconded.)
    21 local lanes vs 26 hosted required checks, and the gap is silent:
    Coverage Regression, Lint Policy, Property Laws, Codegen Drift, and
    Professional Desktop IPC Stdio run only hosted — while local full
    proof is also STRICTER than hosted elsewhere, so the sets are
    incomparable in both directions. The `[beep-github-check-run]` tag
    names a parity that does not exist, converting "verified" into a
    claim the operator cannot calibrate — and a tool whose green does not
    imply the gate's green retrains its operator to distrust it. Fix now:
    verify prints an explicit "not covered locally: …" footer (nearly
    free). Fix later: PR-G closes the actual gap lane by lane.

beep-effect12 operator-feedback disposition (2026-08-06): new items
#76–78 above. Evidence amendments — #21/#25: `--reuse-verified` fired
zero times across 8 re-proofs with docs-only amends invalidating full
proofs (~1 hour); combined with this session's serial re-proofs, the
comparison decision 41 asked for is effectively done — promote
tree/input-keyed proof reuse from research question to PR-G build item.
#74: widget named — `--regenerate-aggregates` wires #60's map into the
stale-base remedy. #8 (ship porcelain): `--start-pr-early` requires
`--monitor` but says so only after running — infer flag implications or
fail at parse with the remedy. #50 exhibits: changeset-status says "no
changesets were found" when one exists untracked (say "found but
untracked — git add it"); both ratchets demand a separate
`--write-baseline` instead of offering it inline. Kept-column
validation for the reflection: the stale-base guard caught a real revert
hazard pre-ship; the append-optional discipline is WHY the review P1s
were findable; repair's config-sync → lint-fix → laws ordering is right.

PR-I evidence amendment — idle-without-reporting (operator observation,
2026-08-06, recurring across sessions): sub-agents finish or go idle
without a final report, forcing orchestrators to re-derive WHAT was done
(discovery cost, distinct from verification cost). Three observed loss
modes for chat-borne reports: final turn ends on a tool call (gate green
→ idle, no closing text); result-cap truncation (three of five fix-wave
reports arrived cut mid-sentence); death/compaction near the end (the
power outage left a journal saying "started" beside completed work).
Sharpen #45: the report file is written INCREMENTALLY, before the final
gate run — an end-composed file shares the chat message's failure modes;
`beep agent report list` makes discovery independent of the last
message. #52 rider: the brief carries "the report file is the
deliverable; the final message is a pointer." Doctrine available today:
report-bearing fan-outs go through Workflow agent() WITH schema (the
harness forces validated structured output; free-text stages and
teammate flows are where every observed loss occurred). Verify-don't-
trust stays: reports are claims, gates are evidence (#71) — report
durability fixes discovery, not trust.

79. **PR provenance + resume footer, stamped by yeet publish.** (Operator
    pain, 2026-08-06: a four-terminal hunt for which session originated
    #578; the recurring wrong-agent "fix PR #X" backtrack.) Every
    yeet-created PR body — never the title, which is squash/commitlint
    input — gains: clone, branch, session name + id, harness, a
    machine-readable `<!-- yeet-provenance -->` twin, and a
    copy-pasteable RESUME BLOCK (`cd <clone> && <harness> --resume
    <session-id> <operator-flags>`) making any PR a durable bookmark
    into its originating session — terminals die (2026-08-05 power
    loss), PRs persist. Flags live in operator config templates per
    harness, not code. Identity ladder: `BEEP_AGENT_SESSION` env from a
    launch wrapper now, PR-I's #45/#52 identity later. DESIGN
    CORRECTION (operator catch on the first dogfooded footer,
    2026-08-06): the WORK CLONE and the SESSION HOME are distinct — a
    harness session is keyed to the directory it STARTED in, which may
    differ from the clone the work landed in (this session: home
    beep-effect3, work beep-effect3-pra). The footer carries both
    (`clone=` for git context, `session-home=` for the resume block's
    cd), and the resume block MUST cd to the session home or the id
    resolves nowhere. Automation sources the home from the harness
    transcript path env, never from cwd. Dogfooded: #583/#586 bodies
    carry the corrected footer. Vehicle: small yeet rider; graduates
    into PR-I.
    GRADUATED 2026-09-03 into `goals/yeet-pr-resume-footer` after CSF-007
    removed the first footer; the revived design publishes a number-only
    `bun run beep yeet resume <n>` block and resolves sessions from a local
    registry (see that packet's `DECISIONS.md`).
80. **Evaluate GitHub native stacked PRs (public preview).** The docs
    claim the exact fixes for our recorded blockers: required checks run
    for ALL stack layers as if against the default branch (would retire
    the stacked-pr-skips-required-checks hazard), auto-retarget +
    auto-rebase on merge, squash support, merge-queue aware. Maps to
    lived pain: the #569→#571→#583 continuation chain was a hand-rolled
    stack; workflow phases (schemas→engines→wiring) are natural layers
    that would have shrunk #571's five cumulative-diff review rounds.
    Decision-49 gate: one throwaway two-layer stack verifying the child
    runs all 24 required checks under OUR ruleset before any adoption;
    yeet is stack-unaware (stale-base, sweep deletion contract, --pr
    creation all need riders); merge-queue interplay relays to the
    fleet packet (#22, decision 34).
81. **No silent resolutions.** (Operator question, 2026-08-06: fix
    commits land but threads stay unmarked — or worse, get resolved
    with no reply, unauditable.) The gate (#20, shipped) ensures threads
    GET resolved; #81 requires resolutions to carry a receipt: replies
    name the addressing commit sha or the reasoned by-design defense,
    and resolutions go through `yeet reply` (which forces a body).
    Practice is ambient via #583's AGENTS.md law; the mechanical
    assertion is DESIGNED (thread query gains comments(last:1) author;
    closeout gains --require-answered-resolutions) and deferred to the
    next yeet Status/closeout touch — jumps the queue if silent
    resolutions are actually observed.
    OBSERVED, same day (PR #592 closeout): both Greptile threads were
    fixed in 7e065af387 and drafts naming that sha were staged, but
    `yeet reply` reported both `stale — already resolved upstream;
    nothing was posted`. Someone resolved them out-of-band between the
    publish and the reply pass, so NO receipt exists — and the campaign
    law forbids bypassing the porcelain with raw `gh api`, so the
    porcelain now enforces the very silence this item bans: once anyone
    else resolves first, leaving the receipt is IMPOSSIBLE. Widget:
    split `stale` — a thread resolved upstream that carries no reply
    from the publishing identity gets the draft body posted WITHOUT
    re-resolving (the thread is closed; a comment is additive and
    harmless) and reports `posted-late`; only a thread already carrying
    our reply is truly `stale`. Per this item's own trigger clause,
    this jumps the queue.
82. **Canonical terminal status line for publish (or `--summary`).**
    (beep-effect14, 2026-08-06 — their top ask.) publish emits a large
    stream including the lane JSON, so context-constrained agents MUST
    pipe-filter, and piping destroys `$?` — producing "agent confidently
    reports success on a failed run" (observed twice there; only the
    zsh `${pipestatus[1]}` habit has protected this session). Contract:
    the LAST line of publish output is one machine-parseable status
    line (`yeet: publish OK pushed=<sha> pr=<n>` / `yeet: publish
    FAILED lane=<id> remedy=<cmd>`), making filtering safe by
    construction. Kin to #76; cheaper than reading verdict.json.
83. **Status must reconcile the verdict against remote reality.**
    (beep-effect14: after out-of-band remediation, status reported
    `verdict: publish failure` + `next: git push` alongside 0 failing
    checks — contradictory in one snapshot, the merge-ready disease.)
    A verdict older than the branch tip or contradicted by remote state
    renders as "stale (predates last push)" with the re-derivation
    command, never as current truth — operators must not learn to
    ignore the verdict line. CONFIRMED on PR #592's own publish: the
    first attempt failed proof after committing; the second attempt
    passed all 21 lanes, pushed, and created the PR — and `yeet status`
    STILL printed `verdict: publish failure: yeet publish proof failed
    after creating the local commit` directly above `remote: PR #592
    OPEN`. The verdict was the previous run's, rendered as current
    truth beside remote state that contradicts it. Exactly the disease
    this item names, on the branch that was fixing a different one.
    THIRD instance, same day, third subcommand: the #592 closeout run
    printed `verdict: publish failure: Yeet merge readiness requires
    zero unresolved review threads; found 2: PRRT_...WD, PRRT_...WN`
    four lines above `review threads: 0 unresolved`. Monitor (#586),
    publish (#592), closeout (#592) — three subcommands in one day, so
    this is the verdict writer's default behavior, not an edge case.
84. **[SHIPPED — `feat/speed-loop-wrapup-widgets`] Tree parity: local proof
    and hosted CI run on DIFFERENT TREES,
    and the stale-base guard is structurally blind to the gap.**
    (Reported by beep-effect5, 2026-08-06 — a plan/manifest phase-id
    mismatch and a goals INDEX drift, both green locally, both
    surfacing only once merged onto a moved main; mechanism verified
    in source here, and #582 "regenerate the goals index after rebase"
    is the same class landing as its own remediation commit.) Two
    facts compose. (a) `.github/workflows/check.yml` is
    `on: pull_request` using `actions/checkout@v4` with NO `ref:`
    override, so hosted lanes run on `refs/pull/N/merge` — head merged
    into the CURRENT base — while `yeet verify` proves the worktree's
    HEAD. (b) `assessBaseFreshness` derives `overlappingPaths` as a set
    INTERSECTION of the paths in `mergeBase..HEAD` and
    `mergeBase..base`, and `enforceBaseFreshness` returns clean the
    moment that set is empty. (Its `behindCount === 0` short-circuit is
    sound — nothing to merge means the trees agree.) So the guard fires
    only on TEXTUAL path overlap. A semantic conflict — this branch
    edits A, main edits B, and a repo-level invariant couples A to B
    (goals INDEX vs newly landed packets; packet phase ids vs a plan
    manifest) — yields an empty intersection, merges without conflict,
    and passes every local gate. CORRECTION to the reported remedy:
    `git merge origin/main` / `merge-tree` is NOT sufficient, because
    both cited failures were CONFLICT-FREE merges — a clean merge
    proves nothing here. The guard must MATERIALIZE the merged tree and
    RE-RUN the repo-level invariant gates on it. Widget: `yeet verify
    --merged` (or a preflight tier) that merges the base into a
    detached worktree, runs #75's cheap repo-level battery
    (goals-doctor, goals:index, schema-first inventory) there, and on
    failure routes through #60's generated-path → regenerate-command
    map instead of a hand-merge. This is the TREE-parity sibling of
    #46's LANE-parity — #46 asks which gates run, this asks what they
    run ON, and together they close "why wasn't this caught locally" on
    both axes. It is also the third class under #74, whose two classes
    both presuppose the guard fired at all. Vehicle: PR-G with #75.
    CONFIRMED the same day it was written, on this item's own fix PR
    (#592): PR #587 (Effect beta.103 catalog bump) merged mid-branch.
    Measured path overlap between `mergeBase..HEAD` and
    `mergeBase..origin/main` was EMPTY, so `enforceBaseFreshness` would
    have returned clean — while #587 migrated repo-cli source
    (Docgen, Laws, Lint, AgentEffectiveness) to beta.103 without
    touching any of the four files this branch edits. Publishing
    without merging would have proven a beta.102 tree against a
    beta.103 CI. The merge happened because an operator reasoned about
    it, not because any tool signalled it. That gap IS the item.
85. **Coverage has TWO hosted-only classes, and collapsing them into
    one "structurally cannot" verdict misroutes the fix.** (Live on PR
    #587, the Effect 4.0.0-beta.103 catalog bump: `Coverage Regression`
    failed at 14m51s; a sibling agent read it as the known
    structurally-hosted-only gap.) The shared premise is TRUE and
    verified: `YEET_FEEDBACK_TASKS = ["build", "check", "lint",
    "test"]` (`Yeet/internal/Planner.ts:52`) — yeet verify/publish
    never runs a package's `coverage` script. But two different
    failures hide behind that one fact. CLASS R (runtime): defects that
    only manifest under the coverage runtime — `coverage` is
    `bunx vitest run --coverage`, a different runtime from `test`'s
    `bunx --bun vitest run`, where `Bun.spawn` is inert and stdin never
    EOFs (PR #570's 40-minute hang). Local proof genuinely cannot reach
    these. CLASS T (threshold): an ordinary ratchet regression, which
    #587 is — `check.yml` invokes `bun run beep ci lane coverage
    --affected --base "origin/${GITHUB_BASE_REF}" --summarize`, an
    invocation reproducible verbatim on a workstation. Class T is a
    TASK-LIST gap, not a structural one, and diagnosing it as Class R
    routes to "accept the hosted-only cost" when the cheap fix exists.
    Why it cannot simply join #75's battery: measured on this run, the
    lane is 231 tasks / 0 cached / 13m9s — the single most expensive
    lane in the repo, against a battery whose ordering law is
    cost-ascending. Widget: a CHANGED-PACKAGE-SCOPED coverage preflight.
    Evidence it suffices — every package the ratchet flagged
    (@beep/documents-server, @beep/duckdb, @beep/nlp,
    @beep/openai-compat) had exactly ONE changed `src` file in the PR;
    scoping to changed packages turns 231 tasks into 4. Boundary: local
    numbers stay machine-sensitive, so this is a PREDICTOR of the drop's
    direction, never the epsilon oracle — the verdict stays hosted.
    Second finding from the same log: baseline drift is WARN-ONLY. Six
    packages (@beep/epistemic-client, @beep/epistemic-ui,
    @beep/exiftool, @beep/gov-legal-mcp, @beep/obs, @beep/qa-capture)
    are missing from `standards/coverage.regression-baseline.jsonc`, so
    they are exempt from the ratchet silently and indefinitely — a new
    package can never regress what it never registered. That belongs in
    the new-package governance-gate family as a blocking gate.
    Vehicle: PR-G with #75.
    SEQUENCING AMENDMENT (same day, from the parallel session that took
    #587 to root cause with the operator): the preflight is BLOCKED on
    fixing the gate itself, and must not ship first. The ratchet
    compares PERCENTAGES with epsilon 0.001, so deleting covered code
    from any package below 100% trips it arithmetically —
    `(C-1)/(T-1) < C/T` whenever `C < T`. #587's drops are that
    signature exactly: four packages, all migration edits, all tiny
    fractional falls (-0.02 to -0.05). So the gate PENALIZES removing
    code, and a changed-package preflight built now would only
    reproduce a false failure faster — predicting a bogus verdict is
    not a win. Correct order: (1) land the queued two-signal fix in
    `Quality/internal/CoverageRegression.ts` — keep the pct baseline,
    add uncovered (`total - covered`), flag only when pct FELL and
    uncovered ROSE; (2) make filtered `--write-baseline` merge instead
    of rebuilding `packages` wholesale (today it silently drops ~130
    entries, which is a second, larger source of the missing-baseline
    hole above); (3) only then build the preflight, which by then
    predicts a verdict worth predicting. Corrects this item's original
    read of #587 as an ordinary regression — the drops were real
    arithmetic, but the FAILURE was not.
86. **[SUPERSEDED — basic-memory, decision 53] The ledger is not queryable,
    and that now costs more than it saves.**
    (Convergent finding, 2026-08-06 ranking run `wf_b1f680b0-2df`: three
    lenses given DIFFERENT briefs — cycle-time, unblocking, cost-to-ship
    — each reported this blocker unprompted, and each proposed the same
    remedy. Three independent frames landing on one tool is the
    strongest signal any fan-out here has produced.) The failure is
    structural, not cosmetic: 1100+ lines exceed a single read; item
    numbers are NON-MONOTONIC in file order (verified: `... 54 56 57 58
    59 60 55 61 ...` — #55 sits physically between #60 and #61); and
    disposition state lives only in interleaved prose paragraphs, so
    "is item N still open" requires a full-file scan. Consequence
    measured this run: not one of the three lenses could verify the
    handed-in candidate list against the file, so the synthesis
    knowingly inherited an unverifiable premise — and the premise WAS
    wrong (#57 was pooled as undispositioned while its own text routes
    it to the fleet docket). Widget: a machine-readable sidecar keyed
    by the EXISTING stable ids — id, title, status, vehicle, deciding
    grill decision, blocked-on — generated from and validated against
    the prose, never replacing it. Explicitly NOT renumbering: the ids
    are referenced ~330 times across this file, GRILL-DECISIONS.md,
    AGENTS.md, `ops/manifest.json`, another clone's
    `explorations/fleet-coordination/` packet, and repo source. Rider:
    disposition authority is currently three-way with no stated
    precedence — numbered grill decisions, the SYNTHESIS-2 map, and
    self-assigned `Vehicle:` lines in the item text. Everything from
    #56 up leans on the third and weakest form; #84/#85 self-assign to
    PR-G with no ratification. The sidecar must name which authority
    wins. Vehicle: PR-G, and it is a prerequisite for #57's claims
    manifest and any dependency graph.
87. **[SUPERSEDED — basic-memory, decision 53] `#NN` is an overloaded sigil
    across at least five referent kinds.**
    (Same run; flagged independently by the unblocking lens and the
    disposition mapper, who measured roughly a third of low-numbered
    citation hits as false positives.) One bare token means: a ledger
    item, a grill-decision number, a grill-SESSION number ("as grilled
    in #3"), an r-report item ("r1 #1"), and a GitHub PR number — often
    in the same sentence ("#74 ... #571", "#84 ... #587"). Humans
    disambiguate from context; every machine consumer will not. With
    ~330 references, a distinct ledger sigil plus a one-time mechanical
    rewrite is cheap NOW and expensive after #86's sidecar, #57's
    claims manifest, or a dependency graph is built on top of the
    ambiguous form. Sequence it BEFORE #86. Concrete cost already paid:
    ledger items 1–16 are never cited by number in GRILL-DECISIONS.md
    at all — decision 10 ratifies them by DESCRIPTIVE NAME via
    SYNTHESIS-2.md, which uses its own 1–8 numbering for o-report items
    while its 9–16 happen to be ledger ids. That is a numbering
    collision sitting inside the only join path. Vehicle: PR-G, ahead
    of #86.

88. **[SHIPPED — `feat/speed-loop-wrapup-widgets`] A gate run BEFORE the
    change it gates is a vacuous proof, and
    reads identically to one run after.** (Lived on PR #592, 2026-08-06.)
    I ran `bun run beep quality test-tsgo` → exit 0, THEN wrote the new
    tests, then never re-ran it. `bunx vitest run` reported 61/61 green
    because vitest does not typecheck. The publish proof then failed on
    exactly the new lines: `TS2353: 'mainWorktreePath' does not exist
    in type 'Partial<{...}>'` — the schema field was optional so
    `.make()` accepted it, but the test helper's `Partial<typeof
    mergedFacts>` did not. The generalizable law is NOT "remember to
    run test-tsgo": it is that a gate's transcript entry carries no
    evidence of WHICH tree it ran against, so a stale pass is
    indistinguishable from a real one — the same shape as this
    session's absence-proof receipts and #86's unverifiable premise.
    Widget: gate results record the worktree hash they ran against, and
    `yeet status` / the preflight battery render any result from an
    earlier hash as STALE rather than green — #83's verdict-staleness
    contract, applied to gate results instead of verdicts. Cheap
    version available immediately: the battery re-runs a gate whose
    recorded hash != current instead of reporting its cached verdict.
    Vehicle: PR-G with #75. Follow-up retained: proof-hash staleness needs
    `ProofState.laneProofs` exported before it can consume lane proof hashes.
89. **[SHIPPED — `feat/speed-loop-wrapup-widgets`] The flake quarantine
    recognizes exactly one signature, so every
    other environment-only failure is hardened by hand.** (Same run.)
    `@beep/xai#check` failed exit 2 inside the full proof on a branch
    that does not touch `packages/drivers/xai`; a standalone
    `bunx turbo run check --filter=@beep/xai --force` passed 9/9,
    exit 0. The quarantine declined it explicitly — `failure does not
    match the no-location TS2589 flake signature; keeping failure
    hard` — which is correct as written and useless in practice: it
    knows one fingerprint, and this was a different environment-only
    failure in the same family (53 bun/node processes older than ~11h
    were live during the proof, all with real parents, so contention is
    the likely cause and is not reproducible from the diff). Cheap
    discriminator the quarantine can apply itself, before hardening any
    package-scoped failure: if the failing package is OUTSIDE
    `git diff --name-only origin/main...HEAD`, re-run that one package
    filtered — seconds, against a full re-proof. Escalate to hard only
    if the isolated re-run also fails. Ties to #35's attribution
    fingerprints and #47's log fetcher. Vehicle: PR-G.
    SECOND signature, hours later (PR #592): `Test Unit` failed in
    "Set up job" before any repo command ran — `Failed to resolve
    action download info. Error: Service Unavailable` /
    `##[error]Internal Server Error`, three attempts, all GitHub-side
    5xx during a confirmed major Actions incident (githubstatus,
    opened 15:22Z). A plain `gh run rerun --job <id>` is the whole
    remedy, and it is strictly SAFER to auto-rerun than the trusted
    TS2589 fingerprint because zero repo commands executed.
    Fingerprint: setup-step failure log contains `Failed to resolve
    action download info` (or a setup-step `##[error]Internal Server
    Error`) with no lane output — rerun once per job per head SHA.
    Promotes this item from "the list is short" to "the list is a
    list, and it needs entries". Operator-loop rider from the same
    moment: I reported "0 failing, 19 pending" and stopped watching;
    the operator found this failure before I did. A pending snapshot
    is not monitoring — a check set is unobserved until it reaches a
    terminal state (`monitor --until-merged` exists for exactly this).
    THIRD signature (PR #626): an install-step prebuilt-binary download
    timeout fell back to a source build and then failed on a missing system
    header. The jobs API can identify the install-step infra failure; the
    shipped quarantine applies rerun-once semantics.
90. **[SHIPPED — `feat/speed-loop-wrapup-widgets`] `run_started_at` is
    rewritten on re-dispatch, so run-level
    "queue latency" is an artifact unless filtered to attempt 1.**
    (2026-08-06, caught by the owned-runners plan workflow's value
    challenge and verified live the same hour.) During the Actions
    outage, `run_started_at - created_at` read 18-21 minutes on three
    Check runs and 0s on others; every "delayed" run was `run_attempt`
    2-3 and every 0s run was attempt 1 — the metric measured
    time-until-a-human-clicked-rerun, not runner wait. Actual
    Blacksmith pickup, measured at JOB level during the same outage:
    19-67 seconds. Job records were garbled too (a job whose
    `created_at` postdates its own `completed_at`), so during an
    incident NO Actions timestamp is trustworthy unaudited.
    Consequence: "PRs are blocked because no runners are available" is
    falsified — this repo has no runner-capacity problem, and the
    owned-runner project must not be justified by one
    (research/o6-execution-plan.md carries the full correction and the
    plan it feeds). Widget: the lane-timings collector records
    `run_attempt` and derives attempt-1 pickup latency, applying the
    filter in the collector, never the reader. Kin to the
    absence-proof positive-control law: a damning-looking metric needs
    its provenance checked before it justifies a project.
    Follow-up retained: peak-RSS needs a runner-side emitter before the
    collector can populate that column.

Empty-frontmatter changeset receipt (2026-08-06, this PR's own first
publish): 56 no-release changesets on main used bare `---\n---`
frontmatter, and the repo-wide js-yaml override (5.2.2, pinned since PR
#437) makes `yaml.load("")` THROW ("expected a document, but the input
is empty") where v4 returned `undefined` — so `changeset status` dies on
the ENTIRE tree, but only after a FRESH install materializes the pinned
resolution. Worktrees running on older physical node_modules kept
passing the lane (PR #592's proof passed it hours earlier on the same
lock), which is the stale-artifact false-green class operating in the
install layer itself: the lockfile said 5.2.2 for months while the
installed tree said otherwise, and `--frozen-lockfile` after the
post-#595 branch switch is what detonated it. `bunx changeset add
--empty` still emits the bare form, so every new empty changeset
re-plants the mine. Repair shipped in this PR: `{}` frontmatter (the
form the tree already used elsewhere), valid under both js-yaml majors.
Re-planting bound: with 5.2.2 now materialized, the
`quality:changeset-status` preflight and the hosted parity lane fail a
bare empty changeset at its author's OWN publish, before merge — so
the mine survives only the compound case of a stale-install worktree
(js-yaml 4 still physically present, passing locally) paired with a
checks-bypassed merge, which is exactly today's window. Named
follow-up, tracked hard rather than assumed closed: either a wrapper
that emits `{}` for the empty-changeset path or a repo-sanity lint
that parses every `.changeset/*.md` with the pinned resolver; rides
the lint family with #88's gate-staleness work, not this docs PR.
Context receipt for the same hour: #595 merged with Test Unit and Knip
FAILURE and most contexts CANCELLED while the required-checks rule was
temporarily removed from the ruleset during the GitHub Actions outage —
the first fresh-install lane break surfaced immediately downstream of
that window. Kin: stale-artifact false greens, #88's gate-staleness
contract, and the new-package staged-changeset gotchas.

Hint-misattribution receipt (PR #592, 2026-08-06) — third instance in
one day, so it is a pattern and not an accident. The monitor phase
failed on two Vercel deployment checks reporting `Deployment rate
limited — retry in 24 hours` (an account-level build cap, and neither
check is among main's 17 required contexts). Yeet's `next:` line said
`Inspect the OSV finding and rerun bun run beep quality github-checks
security`. There was no OSV finding. Same class as the verdict-packet
`repairCommand` misrouting already recorded against the misattribution
trifecta: the hint selector matches on lane family rather than on the
failing check's own payload. Until it is fixed, read the failing
check's message, never the hint.

Exit-code masking, self-inflicted again (same run): I backgrounded the
publish as `<cmd> > log 2>&1; echo "PUBLISH-EXIT=$?"`. The harness
reported the invocation's exit as 0 — because the trailing `echo`
succeeded — while the real publish exited 1. Same family as the
`cmd | grep | tail` masking already in the ledger, and it defeated the
same instinct twice in one session: the wrapper's status is not the
work's status. Read the marker or the artifact, never the invocation.

PLAN.md drift (2026-08-06, hit independently by two lenses and the
synthesizer): `goals/speed-loop/PLAN.md` is advertised — in agent briefs
and in this packet's own README — as holding the PR-A..PR-I wave
structure. It is a 9-line cycle-log table whose ledger-delta column stops
at "8 → 19" with cycle 3 marked "pending", against a ledger now at 87
items. The wave contents actually live in GRILL-DECISIONS.md #13–20. An
incoming agent reads PLAN.md as authoritative and gets nothing — the
mis-pointer cost this run a read cycle on exactly the load-bearing
question it was launched to answer. Fix is one edit: make PLAN.md either
current or an explicit pointer to the decisions that carry the waves.

Absence-proof receipts (2026-08-06, self-inflicted twice inside ten
minutes while verifying the #85 evidence). A negative result needs a
POSITIVE CONTROL before it counts as proof. (a) `gh pr diff --name-only`
failed with HTTP 406 (>300 files) and wrote an EMPTY file; the follow-up
`rg` over it printed no match, which read exactly like "these packages
were untouched" — the intended conclusion, reached vacuously. (b) The
repair was worse: `gh api --paginate .../pulls/587/files -q '.[].path'`
returned 1603 lines, which passed a `wc -l` non-emptiness check, but the
REST files endpoint's field is `filename` (`path` is the GraphQL name),
so all 1603 lines were EMPTY and the second absence-proof was vacuous
too — the sanity check itself was the wrong invariant. Both conclusions
were false: all four regressed packages DID have changed `src` files.
Law: when a check's payoff is a no-match, first assert the haystack
contains a known-present needle (`rg -c '\S'`, a control grep for a path
you know changed). Kin to [[vacuous-test-pattern]] and the
jq-capture-annihilation class. Separately: `rg -r` is `--replace`, NOT
recursive — `rg -rn "pat" path` silently rewrites every match to the
literal `n` and looks like corrupted source.

Sweep-dogfood receipts (2026-08-06, first executeSweep on its own merged
branch, exit 0, every rail honored): (a) the lockfile needs-operator
handoff names the command but not the WHERE — "re-run the sweep" from a
worktree that cannot refresh main (held elsewhere) loops forever; the
handoff must name the worktree that can act. (b) Two-pass completion
gap — sweep targets the CURRENT branch only, so after end-state moves
off the merged branch the promised second pass cannot reach it; ratified
decision 45(d)'s "a re-run completes the deletion" is FALSE as shipped.
Both route to a fast-follow fix PR (sweep --branch override through
guardLiteralArg + handoff text; decision 45(d) amended same-PR).
CLOSED same day: PR #592 shipped `--branch`, and the first real dogfood
(post-#600, two stale merged branches from the primary clone) deleted
both correctly. New receipt from that run: when the remote branch was
already auto-deleted on merge, the remote-deletion skip renders
"remote branch origin/X exists; remote tip <absent> equals pull request
head <sha>" — stale local ref state and an absent probe result flowing
into an equality sentence. Probe-absent needs its own rendered reason;
same class as the named `*ProbeTruncated` → `!probeSucceeded`
generalization above.

Owned-runners infra receipts (2026-08-06, ci-runners stack
implementation, workflow wf_f00a6749-061; fuller detail in the run's
journal): (a) the generated design packet's own acceptance test
contradicted its security decision — the config-override test enshrined
cross-region AZs that the decided region/AZ S.check must reject; spec
and test drifted within one generated artifact and were reconciled by
hand. (b) fc-arbitrary schema round-trips are structurally incompatible
with cross-field checks (independent region/AZ arbitraries ~never
satisfy starts-with, starving fc's filter) — schemaParity needs a
seeded/custom-arbitrary variant. (c) The docgen-tsc-stricter-than-tsgo
class recurred: a JSDoc example comparing two non-overlapping literal
constants passed turbo check (tsgo) and failed real tsc with TS2367 in
docgen — caught by the adversarial reviewer running docgen:local, which
the implement gate set omitted; docgen:local belongs in any new-module
gate battery. (d) Follow-ups now tracked: promote the AWS primitive
schemas (AwsRegion/Az/Cidr/AmiId/InstanceType/SsmParameterName) to a
shared module before the controller stack re-declares them; launcher
IAM enforcement (delete the retracted runner instance profile, add
RunInstances condition Denies on metadata/profile/tag overrides) is
account-state work nothing in-repo enforces yet — pre-deploy blocker;
an in-repo acceptance-probe script would make the o6 red-team gates
mechanical at first `pulumi up`; the reaper Lambda handler is an
untypechecked inline string and graduates to a real source file if it
grows. (e) `rg -r` bit AGAIN (display-only) despite its ledger entry —
the receipt alone does not prevent recurrence; candidate habit-level
fix is a shell alias/wrapper making rg refuse `-r` outside explicit
`--replace` intent.

beep-effect14 operator-feedback disposition (2026-08-06): new items
#82–83 above. Amendments — #8 (ship porcelain): third verb gap
receipt-confirmed, "commit exists, prove and push" has no name
(--amend/--push-only both misused hunting for it); #77: the empty-index
--amend error names the two-step remedy; #50: the missing-proof-state
error lacks the Remedy: line stale-base has — the convention exists,
applied non-uniformly (one-line fast-follow); #25 (PR-G build item):
key refinement is (tree hash, MERGE-BASE) — changed-file and changeset
lanes are base-relative; their byte-identical cherry-picked tree repaid
a full proof. Kept-column: stale-base guard correct 4/4, --staged-only
stash never misfired, sweep refused deleting an unpushed commit, reply
posted nothing on a bot-auto-resolved thread.

PR-E fix-wave reflection harvest (2026-08-05, #54 ritual; 5 agents, run
wf_7d56b3bb-e06): new items #71–72 above. Also: adversarial-review
findings should anchor on SYMBOL NAMES, not line numbers — three of four
line anchors handed to one fixer were stale/wrong the moment a concurrent
fixer edited above them (#67 rider); the `zsh -ic` wrapper emits ~12
lines of gitstatus/zle noise per gate call across every agent (a
mise-only non-interactive shim would pay for itself in one wave); the
overlay-tsconfig ritual should be one command (`beep quality typecheck
--isolated`, #43 rider) — five agents hand-wrote the same JSON with a
load-bearing `rootDir` and a cleanup obligation; `SchemaUtils.
withConstantDefault` cannot type a boolean default (literal-widening
trap — `withConstantDefault<boolean>(false)` is the workaround, worth a
JSDoc gotcha); test-harness laws (`provideScopedLayer` never
`Effect.provide(Layer)` under strictEffectProvide; `Effect.fn`-wrapped
temp-dir helpers) are discoverable only by reading neighbors — one
paragraph in the effect-first skill closes it; fixture builders for
filename-addressed artifacts must derive filenames from the producer
helper (the fallow fix's discriminating test was unwritable until the
builder was refactored); nonzero-exit probes are the same inference gap
as truncated probes in the sweep's certainty model (named follow-up:
generalize `*ProbeTruncated` to `!probeSucceeded`, ~10 lines); JSDoc
example import paths are not reachability proof — docgen validating that
each example's import specifier resolves would catch stale examples
generally.

Fleet handoff #2 (2026-08-05; beep-effect5
explorations/fleet-coordination/research/HANDOFF-2-pre-push-and-guard.md,
PR #562; GRILL-DECISIONS.md #39–44): #551 monitor regression → PR-E triage
must-fix (decision 39; Mode B specimen → #61); pre-push wiring → PR-G with
the reuse marker riding earlyPushStep, passthrough consumer, caller-aware
failure text, blocking-vs-advisory + emergency-push carve-out queued for
grill #5 (decision 40); Q7 staleness guard sequenced behind the #21/#25
comparison under the fleet's measure-first law (decision 41); decision-36
worktree refinements — `-name .git -prune`, FETCH_HEAD via
`--git-common-dir`, `status --porcelain -uall` — become sweep-engine triage
audit items (decision 42); PR-I awareness surfaces build on
`hookSpecificOutput.additionalContext`, plain hook stdout being a silent
no-op outside UserPromptSubmit/UserPromptExpansion/SessionStart (decision
43); merge_group vacuous gates → #62 and
`strict_required_status_checks_policy` re-opened at its true ~8 runs/day
cost (decision 44).

91. **[GRADUATED — `goals/ci-fleet-endgame`, decision 54] Controller
    build-vs-adopt is a decision gate: no controller code before
    the research verdict.** (Operator-ordered, 2026-08-08, after the burst
    landed the merge wave.) The endgame is verbatim: "our own blacksmith
    minus the UI & ridiculous spend" — zero manual aws/gh commands per PR.
    Candidate references the research audits against:
    philips-labs/terraform-aws-github-runner (webhook→Lambda→spot,
    scale-to-zero, JIT — closest architectural match),
    actions-runner-controller (k8s), machulav/ec2-github-runner, RunsOn
    (commercial controller in our own account). Deliverable: a decision
    record + gap list; the burst's integration discoveries (see the
    runner-burst receipts below) are its evidence base. Grill session on the
    record before implementation.

92. **[GRADUATED — `goals/ci-fleet-endgame`, decision 54] Repo-optimized
    worker images (lockfile-keyed baked AMI).** Promoted by
    operator interest from o6 modifier #2: toolbelt + docker + runner agent +
    bun store + warm dependency/turbo seed baked per bun.lock hash. Deletes
    the ~36s/job install floor AND the cross-runner tool-cache poisoning
    class outright. Docker-image variant applies only if the controller
    research picks the ARC route.

93. **[GRADUATED — `goals/ci-fleet-endgame`, decision 54] CI
    resource-weight: the requirements are NOT size-normal, and the
    excess is attributable.** (Operator question 2026-08-08: "are our
    hardware requirements normal for repo size?") Evidence: a single
    full-scope tsgo compile exceeds 16 GB; ~1.65M type-instantiation floor on
    import; heavy suites spend ~556s in module import before running a test.
    The premium splits into a deliberate schema-first type-density cost and a
    recoverable packaging/execution cost. Levers in leverage order: re-run
    the instantiation census post-beta.104 and make budgets a RATCHET; kill
    remaining census-ranked union/template bombs (box + MimeType precedent);
    explicit types at exported boundaries to stop consumer re-inference;
    break god-barrels (sub-barrels / type-only entries); shard full-scope
    Check into per-slice processes. If sharded Check fits 16 GB again, the
    fleet demotes from necessity to speed. Absorbs/widens the parked
    box-typecheck-cost campaign.

94. **[GRADUATED — `goals/ci-fleet-endgame`, decision 54] Duplicated
    build/install across lanes: fix is cache architecture, not
    orchestration.** (Operator question 2026-08-08.) Fleet logs showed
    `Cached: 0 cached, 97 total` per lane — every job cold-rebuilds the
    graph — because PR jobs are deliberately denied shared-cache WRITE (the
    poisoning boundary #600 closed in storybook.yml). Build-once-as-a-job
    serializes the critical path and ships GB artifacts; a mega-job sums
    lane wall-clocks, breaks the 17-context model, and OOMs co-resident
    heavy lanes. Correct design: asymmetric cache access — trusted push runs
    WRITE the shared turbo cache, PR runs READ ONLY (content hashing lets
    main's seed serve any PR's unchanged packages; no untrusted write path =
    no poisoning). The provisioned-but-unused beep-turbo-cache-832907639880
    bucket plus o6's pre-signed-read design is the implementation; the
    node_modules/toolbelt layer moves into #92's baked AMI. Baseline for the
    research: 0 cache hits, ~36s installs, ~556s type-graph imports,
    18-20min heavy lanes.

Runner-burst receipts (2026-08-08, the interim burst that landed the merge
wave; each is a controller-design input): (a) launches must use the dedicated
launcher identity — the admin user carries a legacy t2.micro-only
RunInstances deny (FreedomFramework-CI); (b) the launch template deliberately
leaves subnet placement to launch time, and a request-level subnet must
restate the FULL network-interface spec because the request block replaces
the template's per device-index; (c) first spot use needs the EC2 Spot
service-linked role minted once by an admin; (d) the minimal Ubuntu AMI
lacks the hosted toolbelt — setup-bun died at exit 127 on missing unzip, and
Test Integration needs docker for its pglite-testcontainers harness; (e)
setup-bun's cross-job cache poisons heterogeneous fleets ("Cache restored
successfully" then bun absent — archives carry the SAVING runner's absolute
paths); fixed with no-cache pending the baked AMI; (f) non-ephemeral agents
on long-lived spot guests zombie silently (three occurrences in one night:
VM running, agent gone, no forensics by design) — the strongest empirical
argument for one-job-one-VM ephemeral; (g) the actions allowlist's first
catch was a TRANSITIVE action (swatinem/rust-cache inside
setup-rust-toolchain) invisible to uses:-grep inventories; (h) the committed
permission deny-list passes vetted scripts/porcelain while denying ad-hoc
`gh api` writes — runner operations therefore belong in repo porcelain
(`beep runners launch|teardown|mint`), a controller-era work item; (i)
merge-treadmill mechanics under an active fleet: goals/INDEX.md must be
REGENERATED on every conflict (three-for-three wrong when auto-merged), and
16GB-survival tunings (hosted-swap, serial caps) amputated in textual
conflict resolution left semantically mixed trees — the branch's own tests
failed on features whose call sites were resolved away, caught only by the
lanes; wholesale file-to-main plus keeping cherry-picked hardware-independent
fixes was the deterministic repair.

## Closeout dispositions (2026-08-08)

- **PARKED — decision 55:** all earlier grilled-but-unshipped widgets remain
  in this retained ledger as citation-ready precedent. This includes the
  ranked cheap bundle (#82 publish status line, #76, #73, #83 verdict
  staleness) and the PR-G family (#75 repo-level battery, #60 regenerate
  map, #77 `publish --reconcile`, and their recorded companions). None block
  closeout; a future packet may revive one only by citing its evidence and
  grill outcome.

## Retrospective closeout friction receipts (2026-08-08)

These incidents were reconstructed as a batch during closeout, not recorded at
the moment each friction event occurred. They therefore preserve historical
evidence but do not satisfy the contemporaneous-receipt rule in `AGENTS.md`.
Future incidents must enter the active ledger when they happen so they can
shape the work in flight.

Generated-file auto-merge is wrong in both directions — third confirmed
instance. `goals/INDEX.md` regenerated to 122 packets / 33 active; HEAD said
31, main said 34, so taking either side would have committed a wrong index.
Prevention: a git merge driver marking `goals/INDEX.md`,
`standards/jsdoc-*.inventory.*`, and
`standards/*.regression-baseline.jsonc` as `merge=regenerate` so conflicts
fail loudly instead of auto-merging plausibly wrong content.

A docs-only codemod branch carried a latent compile break. The P3 branch
pinned `S.TaggedErrorClass`; main's Effect beta.104 bump renamed the export
to `S.TaggedError` (zero occurrences of the old name in the installed
package). No gate on the branch itself could catch it before merge because
the API no longer existed. Prevention: merge main into long-running codemod
branches early and often; #84's merged-tree verify tier is the local gate
that would have caught it.

The jsdoc ratchet compares counts only, so it cannot detect a stale
inventory. A concurrent writer shipped an inventory with line anchors from
a pre-merge tree (`Id.ts` `make` at 2043 versus actual 2065); totals matched
and the gate stayed green. Anchors and `generatedAt` are load-bearing for
docs tooling but unguarded. Prevention: ratchet check-mode verifies a sample
of anchors against the working tree, or hashes the anchored spans.

`jsdoc-inventory` costs about five minutes per run (303s/319s observed), and
merge-resolution loops run it repeatedly — three times across two merges in
this receipt. Prevention: add a `--since`-style bounded mode like
`docgen:local`, scoped to `origin/main...HEAD` plus dirty files.

Prebuilt-binary download timeout converts to a red lane through a latent
environment gap (PR #626, Codegen Drift, 2026-08-08): keytar, transitive via
`@azure/msal-node-extensions`, timed out in `prebuild-install`, fell back to
node-gyp, and died because the free ubuntu-24.04 runner lacked
`libsecret-1-dev`. Immediate disposition: rerun once, now covered by #89's
third jobs-API fingerprint. Durable disposition: the ci-fleet-endgame baked
AMI toolbelt includes `libsecret-1-dev`; the free-lane setup composite may
add it if the class recurs.

The lane janitor's allowlist lived in a session-scoped scratchpad path under
`/tmp`, forcing the successor session to rediscover it with `find(1)`.
Prevention: operations state that outlives a session belongs in a durable
repo-adjacent location; `beep runners` porcelain should own lane-closure
state.
