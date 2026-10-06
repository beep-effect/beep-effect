<!-- Seat brief as issued 2026-10-06 for goal phase P3 (W7, auditor run 4): FOUNDATIONAL (UFO/OntoClean) seat, skill step 4. Installed as X/research/run4-lanes/p3-seat-foundational-brief.md. -->
# P3 seat brief — foundational analysis (one fresh context per batch)

Read `X/research/run4-lanes/p3-seat-common-brief.md` first (the TRIMMED seat-common brief; the lane copy `p3-common-brief.md` is never yours to open), then this brief, then
`SK/prompts/ufo-analysis.md` in full. This brief cites the seat-common brief's sections by name and repeats none. Added abbreviation: `SH` = `.claude/skills/_shared`. "Ruling n" and calls (a)–(s)
are the launch sitting; calls (t) onward are the pin-stage and seat-stage calls of the same day, and where this brief and a call differ the call wins. Cites to files outside "Inputs" (`S:n`,
`SPEC:n`) are provenance for the orchestrator: the operative clause is restated here and you never open them.

- One rule set for every seat (call v): run no precondition check (the lane preconditions are the orchestrator's, verified before each launch); write no report file and no friction receipt
  (friction returns in your Return and the orchestrator files it); run scan A only (gitleaks is the orchestrator's); run only the plain validator scan (`--repo` and `--gate` are the
  orchestrator's). Stages run in order: all denotation, then foundational beside blinded, then synthesis, then the gate, then the adversary. A contradiction between the two briefs, the prompt and
  a contract is a Stop.
- The seat-common brief is the common brief trimmed under call (v): no precondition, report, receipt or gitleaks duty, no scan-B file names, no owners table, no prior-index census. It binds you
  whole and is not repeated here ("Packet map", "Evidence and digests", "Who rules", "Read-only and no-git laws", "Python, VAL and where gates run", "Public-repo hygiene", "Expected validator
  noise", "Engine laws", "Frozen and never-touch", "Stop and report", "Return"). An earlier-run file name or outcome count seen anywhere is not evidence, is never cited, and no slug seen there is
  reused.

## Role and independence

- You are the FOUNDATIONAL ANALYSIS seat of auditor run 4 for `beep-ci-ops`, skill step 4 (`SK/SKILL.md:126-137`). For each SURVIVING hypothesis of one batch you test the proposed REFERENT,
  never its source name, and write one IdentityCard + FoundationalAnalysis pair, at proposal authority only (`SK/SKILL.md:20-24`).
- You run on `claude-opus-5-5` at effort `medium` in a FRESH context for this batch only, never continued from or into another seat, batch or round (Ruling 8, S:107-112;
  `SK/SKILL.md:176-177` "Same-context execution voids the pass"); if your context already holds other seat or batch work, stop. You spawn no worker, switch no model, and never rule, ratify,
  lift a flag, grant a waiver, write a hypothesis, proposal, review or index row, or stage, commit, tag or push (Rulings 2, 4; seat-common brief "Who rules", "Read-only and no-git laws").
- A blinded seat analyses the same hypotheses from an isolated root; `V` joins the two seats on `hypothesis_ref`, and a category difference becomes a DISPUTED flag for a sitting
  (`V:2522-2534`). You never see its output and you write toward agreement with no one.

## Launch message

| Variable | Meaning |
| --- | --- |
| `LANE` | the run lane checkout root (branch `feat/ciops-p3-run4`), your working directory; every path here is relative to it. You never enter the pin worktree, and the lane HEAD may be past the pin (Ruling 9, S:123-128): never compare them |
| `PREFIX` | your batch's slug prefix, picked by the orchestrator, which also checks slug freshness against the shelters (call y); batches keep prefix-stable membership across stages (Ruling 11, S:142) |
| `BATCH` | always the observation list `ONT/work/denotation-batches/batch-<PREFIX>.txt`; it names your batch and is not your reading list |
| `INPUT MANIFEST` | the exhaustive file list for this launch (inline or a path). It lists every file you may open: the seat-common brief, this brief, your prompt, the contracts, the lookups, the run manifest, the CQ file and the records, each as "Inputs" below names it; the manifest grants nothing beyond it. A needed file that is missing from it is a Stop, never searched for |
| `REPAIR` (optional) | the seat-common brief's shape (call (ab)): validator lines under your own directory only, quoted inline by the orchestrator: lines whose path is under `ONT/work/foundational/` and names an `ic-<PREFIX>-`/`fa-<PREFIX>-` file (never a line naming `ONT/work/alternative/`, whose `…-alt-…` names share your prefix, and never a `FLAGGED` line); or `landed` rows, the orchestrator's restatement of a landed attack as rule id, target record and one sentence, never review text. No other row kind reaches you. Only then may you rewrite exactly the named pairs: same id, same file name, bytes changed only where the finding demands; a finding you judge wrong is declined with a reason, never half-answered. That block is your only sanctioned view of gate or review output. A rewrite stales every review bound to those bytes (`chain_sha256`, `V:2432-2463`); re-synthesis and re-review are the orchestrator's to order (an adversary FAIL blocks and rounds cap at three, Ruling 11, S:142-146). `ROUND` belongs to synthesis revision and the adversary: you get none |

A missing or contradictory variable is a Stop. Launch checks on `ONT/work/run-manifest.yaml`, any miss a Stop: it exists; it carries no `pin_waived: true` (the engine step's provisional file, call
h, S:207-210); `agents.foundational` is `claude-opus-5-5` / `medium` / `prompts/ufo-analysis.md` with `prompt_sha256_12` equal to the first 12 hex of the prompt file's sha256 (`3d94feb0629c` at
the pin; `V:1127-1146`), printed by `sha256sum "$SK/prompts/ufo-analysis.md" | cut -c1-12` after the seat-common brief's Python block. You report the run id and `repository.commit` as the
manifest carries them and compare them with nothing.

## Inputs (a closed set)

- Contracts: `SH/schemas/identity-card.schema.yaml`, `SH/schemas/foundational-analysis.schema.yaml`, `SH/foundational-analysis.md`, `SH/ontoclean-rules.yaml`; template
  `SK/templates/identity-card.yaml` (start every card from it); `SH/schemas/denotation-hypothesis.schema.yaml` for the input shape. Also `ONT/work/run-manifest.yaml`, and the CQ suite
  `X/ontology/docs/competency-questions.yaml` as reference: cite a CQ id only as that file spells it.
- Hypotheses: the `ONT/work/hypotheses/dh-<PREFIX>-*.yaml` files the input manifest names. Observations: only the records those hypotheses list in `observation_refs`; `so:sha256:<64hex>` is
  `ONT/work/observations/so-<first 12 hex>.yaml` and `po:sha256:<64hex>` is `ONT/work/prose-observations/po-<first 12 hex>.yaml` (`SK/SKILL.md:439-440`); the file's `id` must equal the cited
  id.
- What they carry (Ruling 6, S:88-98; calls j, u): source observations from `adapter-journal` v1.3.0 over the `.properties` projections of the pinned corpora `run4-fleet` and `run4-ledger` (exact
  counts come with the pin); 95 prose observations from the run-4 transcriber: 44 `control-interventions.yaml` rows (one per row, its `- id:` line through its first `mechanismChanged:` line), 3
  KPI-law blocks (§2 and §6), 13 S7 contract §8 blocks, 12 `lane-plan-v1.ttl` statements, 18 `literal-domains.md` rows and rulings, the 1 deployed `ProofStage` literal line, 3 `run4-ledger`
  manifest blocks (stage census, gate block, the merged-preview reading) and 1 `run4-fleet` manifest block. The quoted span is your evidence; the documents behind the quotes are not inputs.
- Reading records. Source facts are `config_key_value` pairs `<key>=<value>`. The adapter SELECTS (calls q, u): every admission chain that carries a withdrawal or an eviction, plus the first plain
  chain per (kind, priority); the first `attempt-started` per stage; per clone and stage the first fact and shadow, the first shadow per (decision kind, reason, observed), the first fact per
  outcome, tier, input source and lane class. A record shows that a shape exists, never a count, a rate, an absence or a census; counts exist only in the census prose observations.
  `observed_facts` is a sorted, de-duplicated set, so event order lives only in `*AtMillis` and `recordedAt` values. A vocabulary record is ONE record stanza that holds the first occurrence of at
  least one key of its pin and kind and carries exactly the keys first seen there: no record spans a whole file, a stanza record is never a whole event or individual, and a key it lacks proves no
  absence. A chain's `source_excerpt` may interleave other chains' events; only the chain's own pairs are in `observed_facts`. `symbol.lexical_name` is the span's first key, a locator, never a
  term. A stage record with no `stage` fact was SELECTED by that absence, which is not a fact. `ownerRef*` and `originKey` values are capture surrogates, never a join. A ledger fact is issued,
  never realized, and its `durationMs` is per lane, not a bounded execution interval. A `rat-` number, a flag word, "ratified" or an earlier id inside a prose quote or a `dh-` description is
  sanctioned exposure (call x): quoted text and a claim of its author to test, never a category verdict.

## Read exclusions (never open, list, grep, or reconstruct through `git show` / `git log -p`)

| Path | Reason |
| --- | --- |
| `GD`, `XD`, `G/**`; `DK` (the intake docket) | rulings, prior verdicts, flags and routing prose are not evidence; the two briefs restate every clause that binds you, and the docket's duties reach you through "Queue duties" below |
| `ONT/governance/ratifications/**`, `ARCH/*.governance/**` | ratified categories and stewards' words would anchor the analysis; a card stands on observations |
| `ARCH/**` (every shelter: the run-1..3 `.work`, `.governance` and `.observations` trees, including the run-3 seat trees and `rat-053..070`), `ONT/runs/**`, `ONT/work-run{2,3,4}/**`, `ONT/lanes/**`, `ONT/ratification-package.yaml` | prior analyses, proposals, reviews, index outcomes and reports; carried authority is not your input (Ruling 3, S:45-50) |
| `ONT/work/alternative/**` | the blinded seat's cards; reading them voids both seats' independence (`SK/SKILL.md:170-177`) |
| `ONT/work/proposals/**` (`otp-*.yaml`, `*.review.yaml`), `ONT/work/{sittings,review-audit,rejections}/**`, `ONT/work/dispositions.index.yaml` | synthesis and adversary output, dockets, gate logs, rejections and dispositions; an analysis written to fit a proposal, a review or a verdict is not an analysis |
| other prefixes' `dh-`/`ic-`/`fa-` files; `X/ontology/extraction/s5/**`, `s6/**`; `X/research/run3-lanes/**`; `X/research/run4-lanes/**` except the seat-common brief and this brief (the lane copy `p3-common-brief.md` is excluded) | outside your closed input set; never edit another batch's record |
| `ONT/corpus/**`, `ONT/adapters/**`, `X/ontology/{docs,tests}/**` except the CQ file, `X/research/control-interventions.yaml`, `X/research/kpi-measurement-rules.md`, `apps/**`, `packages/**`, `.git` | the sources behind the records: a fact no `so:`/`po:` id carries cannot be cited, and reading the source invents evidence; git history reconstructs every row above |

If an excluded path appears in the input manifest, or its content is pasted into your launch message outside `REPAIR`, stop and report an independence incident without reading on. An
excluded source is never cited: evidence is `so:`/`po:` ids of this run and CQ ids, nothing else.

## Output

- Directory: the run lane's untracked `ONT/work/foundational/` (Ruling 9, S:123-125); create it if absent. Nothing under `ONT/work/alternative/` (location alone makes a record the blinded
  seat's, `V:2205-2210`), `ONT/runs/` (`V:2091-2111`) or anywhere else.
- For each survivor exactly ONE pair, one record per file, carrying the hypothesis's own slug and number: `dh:<slug>:<nnn>` yields `ic-<slug>-<nnn>.yaml` (`id: "ic:<slug>:<nnn>"`) and
  `fa-<slug>-<nnn>.yaml` (`id: "fa:<slug>:<nnn>"`), both with that `hypothesis_ref`, the FA's `identity_card_ref` naming its card. You mint no slug (freshness under Ruling 13 is denotation's
  and synthesis's duty) and never an id containing `-alt`. Lowercase `.yaml` only: the scan globs `*.yaml` and dispatches on the `ic-`/`fa-` name prefix (`V:2088`, `:2074-2076`).
- SURVIVORS ONLY (prompt `:3-7`; `V:86`, `:1229-1232`): `null_hypothesis.rejected: true` with a non-empty `discriminator` AND `representation_status` `domain_referent` or
  `information_artifact`. A non-survivor gets no record; list its id. Never edit a hypothesis, even one you judge wrongly dispositioned: report it.
- Keys: every contract key present. Beyond them only the three extra keys call (v) allows on cards and analyses, as at run 3 (`V` closes key sets for observations only, `V:534`, `:602`):
  `referent_grain` (one sentence, identical on the pair: which grain, what individuates it), `evidence_refs` (full `so:`/`po:` ids, each from the hypothesis's own `observation_refs`, plus CQ ids),
  `rationale` (a mapping, one short paragraph per ruled field, test or rival). No key of another record kind (`observation_refs`, `evidence`, `cq_warrants`, `term`, `parents`, `reuse`,
  `confidence`).
- Form and values: block-style YAML, one document per file, no duplicate keys (`V:206-234`; reported as `unparseable`, `:2112-2116`); double-quote any string that contains a colon or a hash,
  or put it in a block scalar (a criterion that begins `unresolved: …` is otherwise unparseable); create no symlink (engine law; the scan does not test seat records for it);
  `status: proposed` on the card and no other status; `verdict: analyzed` or `explicitly_deferred` on the FA; tri-state fields `true`, `false` or `unresolved` (bare YAML booleans, never
  quoted); no authority word, no confidence. An `ic-`/`fa-` file of your prefix that exists before you start and that `REPAIR` does not name is a Stop: never overwrite.

## Validator rules your records must pass

| Record | Rule | `V` |
| --- | --- | --- |
| both | the file is a mapping; `id` matches `^ic:[\w-]+:\d+$` or `^fa:[\w-]+:\d+$`; no duplicate id in the scan; `id`, `hypothesis_ref`, `identity_card_ref` are strings | `:132-138`, `:78-79`, `:523-526`, `:2183-2187`, `:2169-2175` |
| both | ONE primary card and ONE primary FA per hypothesis | `:2218-2233` |
| IC | non-empty `id`, `hypothesis_ref`, `identity.identity_criterion`, `ontoclean`, `ufo_analysis`, `temporality`, `counterexamples` | `:710-711` |
| IC | `identity.supplies_identity`, `ontoclean.carries_identity`, `ontoclean.supplies_identity` tri-state; the two `supplies_identity` fields equal (a boolean beside `unresolved` is disagreement) | `:713-714`, `:729-742` |
| IC | `identity_criterion` a string of 20+ characters; one that says "identifier", "id field" or "id column" without `not`, `never`, `evidence` or `rather than` is refused as identifier-is-identity | `:715-725` |
| IC | `rigidity` and `dependence` in their enums; `unity` present as a string (empty is legal, absent is not); `candidate_category` in the closed thirteen | `:727-728`, `:743-750`, `:87-90` |
| IC | both `temporality` booleans tri-state; `status: proposed`; `reidentification_key`, `alternatives`, `existential_dependencies`, `terminal_states` are lists | `:751-761` |
| IC | at least one counterexample, each `description` a string of 10+ characters and not template text (`REQUIRED:`, `attempt at least one`) | `:762-775`, `:101` |
| FA | non-empty `id`, `hypothesis_ref`, `identity_card_ref`, `tests`, `verdict`; each of the three tests one of `separated`, `merged`, `not_applicable`, `unresolved`; `context_reification_needed` tri-state | `:780-789`, `:91-93` |
| FA | `verdict` in its enum; `needed_evidence` a string, and 15+ characters when `explicitly_deferred` | `:790-799` |
| FA | `rival_models` a list, each entry a non-blank `label` and a bare-boolean `still_viable`; `strongest_counterexample` a string of 10+ characters | `:800-818` |
| FA | `identity_card_ref` resolves to a card of the SAME hypothesis | `:1214-1222` |

The gate reads your card later, so make it coherent now or leave the field `unresolved`; never bend a meta-property to fit a category (`V:2558-2579`): `kind` needs `rigidity: rigid` and both
`supplies_identity` fields `true`; `subkind` needs `rigid` and `carries_identity: true`; `role` needs `anti_rigid` and `dependence: relational`; `phase` needs `anti_rigid`. A proposal may
not out-claim the card's category, rigidity, dependence or identity reading (`V:2535-2557`; either provider `unresolved` makes the reading `unresolved`, `V:312-326`) and must copy the FA
verdict (`V:1248-1251`); a rival left `still_viable: true` forces two proposals or a steward-choice issue (`V:1252-1258`). An FA whose three tests are all `unresolved` ran no test
(`V:821-827`). The template's modeled lease counterexample passes `V` and is not yours.

## Analysis rules

1. Each pair states identity criterion, rigidity, dependence, temporality, category, the spec-vs-execution, world-vs-information and role-vs-bearer tests, the strongest counterexample and
   the remaining rivals (prompt `:9-20`). `unresolved` is legal everywhere and is success when the discriminating evidence is named (prompt `:22-23`).
2. `explicitly_deferred` is a lawful, first-class verdict (`SK/SKILL.md:130-137`, `:597`; `SH/schemas/foundational-analysis.schema.yaml:13-19`). It is the verdict when the category cannot be
   ruled after analysis, with the discriminating evidence named (the skill's rule); whether any other open question defers the pair is your judgment, argued in the record. `needed_evidence`
   names a concrete missing observation: which record, from which source, showing what. A deferral flows on as a FLAGGED proposal (`V:2580-2583`) or an `unresolved` index row; others choose
   which.
3. Grain: a recorded classification, a recorded occurrence, a binding at an instant and a governing specification are different grains. Say which one the referent is and what individuates
   it. Denotation wrote one hypothesis per referent KIND; analyze the kind, not one chain.
4. A technical key (nonce, `attemptId`, `planId`, digest, IRI, `key`) is re-identification evidence, never the criterion (`SH/schemas/identity-card.schema.yaml:10`). Capture provenance
   (`corpus_*`, `ownerRef*`, `security_resanitization`, `complete_within`, `synthetic`) is never vocabulary and never an identity criterion (seat-common brief "Engine laws", Not vocabulary).
5. Run 4 admits no CQ edit. CQ-009 alone was re-scoped at the pin, to same-checkout exclusion plus the legacy-origin drain (suite digest `e1ed9c0f65f5`, 26 CQs); its predicates `ciops:hasCheckout`
   and `ciops:hasCoordinationProtocol` are seed-only, not ratified vocabulary (Ruling 5, S:67-83; call t), and the protocol predicate carries the DECODED value (a record without the field decodes
   as `legacy-origin-lock/v1`), so a missing protocol field never shows that the legacy arm is absent. Assume no other CQ changed. Where only a decision that a new Must/Should CQ would force can
   settle a question, that is the `needed_evidence` (`SPEC:41-43`). Warrants are not yours.
6. Missing evidence: never invent an observation, a fact, a CQ, an id or a file. Absence in the capture window is not evidence: a chain you did not observe (repricing, renewal, transfer,
   correction, a merged-preview fact) leaves the question open, and the chain is the `needed_evidence`. Inside a record, missing evidence is a value (`unresolved`; a criterion that begins
   `unresolved: <missing evidence>`; `explicitly_deferred`). At batch level: a cited observation that is off the input manifest or has no file is a Stop (call v; never search); one that sits in a
   file whose `id` differs gets no pair and an open issue; an observation the criterion needs that the hypothesis does not cite (you never edit the hypothesis) and a survival you doubt are open
   issues in your Return.

## Queue duties that reach this seat (the docket is excluded; this is every duty a seat discharges, and one further Queue H item is the orchestrator's at the sitting)

You discharge no duty and lift no flag: a duty reaches you as a hypothesis, and your pair says what the run-4 observations support. The items are QUESTIONS to analyze; none states an answer.

- **Queue G, change events** (Ruling 10, S:131-134). The intake presents the pair only: `OperationalChangeEvent` (a class) and `ciops:landedAt` (a data property, `xsd:dateTime`, seed-only), both
  under CQ-016. Evidence class: the 44 prose observations, one per ledger row, batched with the KPI law §2 block (call w). Rows are seed data: evidence that such events are recorded with an
  instant, never of a cause (`causalStatus` is observational by default); no row has a `tier` member. The class and the property reach you as two hypotheses, because they need distinct
  observations downstream. Is the referent a dated occurrence (the landing of a change to an admission, ordering, gate, cache, lane-assembly, sharding or hosted-capacity mechanism), the ledger row
  that records it, or the change artifact (the PR or merge)? What makes two rows the same change event, and what does a row whose instant comes from an apply outside the repository rather than a
  merge do to that criterion? Is `landedAt` the instant at which the occurrence happened, an attribute recorded about it, or part of its identity; and, membership being adoption-qualified (the
  KPI law §2 quote), are landing and adoption one instant or two? `mechanismChanged` is ledger-field governance and is never vocabulary: quote it as what a row says, never as a category or a criterion.
- **Queue H, the fourth `AssuranceTier` member** (Ruling 10, S:135-136; `SPEC:118-119`). Seat question: is merged preview an assurance tier, or a stage inside an existing tier? The candidate is a
  merged-preview member of the `AssuranceTierId` domain, which is PARKED with three members; a new member is a T-Box change that needs a Must/Should CQ requiring it or a named semantic-support
  license, and run 4 admits no CQ edit beyond CQ-009 (warrants are not yours). Evidence class, in one batch (call w): quotes of `literal-domains.md` (the `AssuranceTierId` row among them), KPI law
  §6, the `ProofStage` literal line and the pin manifests' census readings; source observations carrying `stage` members. Is merged preview an assurance TARGET STATE of the same category as the
  existing tier members, a STAGE or phase of producing evidence for an existing tier over a merge-preview tree, a work kind, or one literal with more than one referent? Under each reading, what
  makes two of them the same individual, and is the classification rigid? The tier class is hypothesized beside the member in your batch (call w): analyze each as its own pair. Can a member's
  category be ruled when its class has no surviving analysis; if not, what is missing? Bounds: the stage reads "dormant in the capture window", never observed-and-empty, so no card argues from a
  zero count; the admission work kind `merged-preview` is not stage activity; the KPI law's sub-partition of `TierLocalFullProof` is a reporting rule you may quote, not a category ruling; a shared
  word is no evidence of a shared category.
- **Queue E addendum, lane plans and the plan-identity contract (rat-049; `SPEC:130-133`).** Eleven provisional `ciops-prov:` terms, none ratified: classes `LanePlan`, `LaneStep`,
  `LanePlanSpecification`; object properties `hasLanePlan`, `hasLaneStep`, `hasLanePlanSpecification`, `precedesLaneStep`; data properties `laneStepIndex`, `laneIdRef`, `handoffDigest`,
  `laneOrderRule`. Calls (w), (ab): they have no pinned CQ and no same-run decision term to support, and no batch is built to manufacture a support chain, so denotation parks their
  hypotheses null-standing and `unresolved` with the missing lane-order CQ named, and they get no pair; one survives only where denotation named a warrant, and then you analyze it. The flagged duty, restated:
  an authoritative identity contract across heterogeneous verification plans must define content,
  contextual-copy, replacement and revision identity; the lane plan is listed beside `VerificationPlanSpecification` as an observed plan that contract must decide. Evidence class: S7 contract §8
  and `lane-plan-v1.ttl` quotes. For each surviving lane-plan hypothesis: which of the four identities do the observations state and which do they leave open (the same handoff bytes under two
  episodes; a new handoff digest as revision of one plan or replacement by another)? Does the observed contract state an identity criterion or only a minting convention (`planId`, IRIs)? Is a lane
  plan a specification, its application to an episode, or an information object describing an order; is a lane-plan specification the order rule or an input-bound application of it; is a lane step
  individuated as a component of its plan or as a tuple; is a lane-plan episode the same kind of occurrence as an admission episode (distinct emitted ids decide nothing)? Hard bounds: no field of
  any record asserts `subClassOf`, `rdf:type` or equivalence between a lane-plan term and a ratified term; "candidate instance" and "candidate subclass" are `rival_models` entries, `still_viable`
  as your tests find. `precedesLaneStep` is derived from `laneStepIndex`: one order, two encodings, never two witnesses. `schedulesWorkUnit` stays unratified and lane steps stay provisional: no
  card leans on either, and no ratified ordering-cluster term is reused for a lane plan. The ratified term's own card is in a shelter; if the comparison needs it, that is `needed_evidence`. The
  Yeet-specialization leg (one plan or coordinated subplans, governed authority, version lineage) needs a Must/Should CQ (rule 5).
- **Flagged accepts and provenance legs re-observed over `run4-fleet` and `run4-ledger`.** Evidence class: source observations over the admission and attempt journals and the proof-ledger facts
  and shadows. Identity questions a hypothesis may raise: token-charge repricing (does one burden persist through a new value); rule versus application; demand continuity (is a resubmission after
  a withdrawal the same demand); episode unity (attempt membership and closure); allocation continuity (does a grant survive renewal, transfer or eviction); issuance versus realization, copy and
  correction of a proof fact; the fact versus the verification it records. Bounds (`SPEC:96-101`): shadow hits are hypothetical would-reuse, never realized, so no card reads a hit as a realized
  reuse; realization, copy and correction legs name a realized-reuse record as `needed_evidence`, merged-preview legs the first merged-preview fact recorded after the cut. A reading withdrawn in
  an earlier run arrives, if at all, as a fresh hypothesis: analyze it from run-4 observations only (call w: a termination kind that no pinned CQ needs re-parks at denotation and never reaches
  you).
- **Not yours:** the 138 carried index rows (Ruling 12, S:148-153), every waiver (Ruling 16), every warrant, every reuse mapping.

## Self-check and expected noise

Seats run only the plain scan; every `--repo` and `--gate` run is the orchestrator's, in the detached pin worktree after it rsyncs your output in (Ruling 9; call h, S:202-205), and you never
create, rsync into or enter that worktree. With no shell, run nothing and say so. With a shell, from `LANE`, after the seat-common brief's Python block (scratch name `seat-foundational-$PREFIX`).
Never print `scan.txt` whole: a line naming `ONT/work/alternative/` can quote the blinded seat's values.

```sh
PREFIX=<PREFIX>                                                        # as launched; shell state does not persist
VAL "$ONT" > "$LS/scan.txt" 2>&1; echo "exit=$?"                       # exit 1 is expected
grep -c 'has NO row in this run' "$LS/scan.txt"                        # exactly 138
grep -E "/work/foundational/(ic|fa)-$PREFIX-" "$LS/scan.txt"           # yours: fix, re-run until empty
grep -c '/work/alternative/' "$LS/scan.txt"                            # the blinded seat's: report the count only; never print, open or fix
grep -v -e 'has NO row in this run' -e '^VIOLATIONS' -e '/work/alternative/' "$LS/scan.txt" | grep -vcE "/work/foundational/(ic|fa)-$PREFIX-"   # other owners': report the count
ls "$ONT"/work/foundational/ic-$PREFIX-*.yaml | wc -l; ls "$ONT"/work/foundational/fa-$PREFIX-*.yaml | wc -l   # equal, and = survivors
```

Expected noise (calls c, v): exactly 138 lines `prior unresolved observation … has NO row in this run's index` (`V:2347-2356`), standing until index close, plus one `dispositions.index.yaml
missing` line once proposals exist (`V:2358-2365`; for you only on a `REPAIR` launch, since synthesis runs after you). You never invent an index row. Another prefix's partial files may show lines
of their own: report their count and `V` line, fix nothing. Lines naming `ONT/work/alternative/` are the blinded seat's even when the file name starts `ic-<PREFIX>-`: count them, nothing more. `V`
does not check that every survivor has a pair; the last line and your own count do. Then run scan A of the seat-common brief ("Public-repo hygiene") over your files, expected empty: records are
public bytes, so cite observation ids instead of raw values and quote no `key` or `originKey` value, no path outside the repository, no host, user or session token.

## Stop and report

The seat-common brief's "Stop and report" binds you. Seat-specific Stops: a launch check misses; a needed file is missing from the input manifest, or it names a missing file, another
prefix's record or an excluded path; an `ic-`/`fa-` file of your prefix exists before you start and `REPAIR` does not name it; the launch message names a round or asks for an edit outside
`REPAIR`; a step would edit a byte you do not own (a hypothesis, an observation, the CQ file); identity cannot be stated without IRI-scheme syntax (the S8 Stop, `SPEC:196-197`). On a Stop
write no further record, leave what you wrote, and return both sides quoted by path and line. Friction is not a Stop; you own no file outside `ONT/work/foundational/`, so each friction note (work,
evidence, prevention; redacted) goes in your Return.

## Return (your final message; you write no report file)

- `seat: foundational`, `PREFIX`, `BATCH`, the run id and `repository.commit` as the manifest carries them, and the launch-check results.
- `files`: every path written. `counts`: hypotheses read, survivors analyzed, non-survivors skipped (ids), `ic` and `fa` files, category and verdict tallies. `deferred`: every
  `explicitly_deferred` id with its `needed_evidence`. `rivals`: every `still_viable: true` rival label, by hypothesis. `repaired` (a `REPAIR` pass): per file, the finding and what changed,
  or `declined` with the reason.
- `selfCheck`: the commands run, the exit code and each count above, or "no shell"; the scan A result.
- `openIssues`: missing or mismatched observations, doubted survivals, questions for the orchestrator. `friction`. `stops` (or `[]`).
