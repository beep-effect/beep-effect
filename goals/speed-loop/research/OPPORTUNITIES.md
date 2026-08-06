# Running opportunities ledger — "well-oiled machine" watch (2026-08-04)

Standing mandate: capture every speed/efficiency opportunity noticed while
shipping PR-A/PR-B. Status: `unowned` (nobody decided), `queued` (in a locked
decision), `spiked` (needs measurement first). Reviewed at each grill.

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
