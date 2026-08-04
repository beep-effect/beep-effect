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
