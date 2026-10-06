<!-- Seat brief as issued 2026-10-06 for goal phase P3 (W7, auditor run 4): blinded alternative seat. Installed as X/research/run4-lanes/p3-seat-blinded-brief.md; Part A alone enters a root as BRIEF.md. -->
# P3 blinded alternative seat brief — auditor run 4 (skill step 7b)

Two parts, two readers. Part A (the `## Part A` heading through the line before the orchestrator's part) is published ALONE as the root's `BRIEF.md` and is the whole brief for the seat, which reads no common brief
(neither the trimmed seat-common brief nor the lane copy), no repository file and no ruling log. The second part is the orchestrator's: it stays in the lane, enters no root and grants the seat nothing. Cite keys:
"Ruling n" and calls (a)–(s) = the launch sitting "2026-10-06 — P3 opened; run-4 launch sitting" (`S:n` = its line n); calls (t) onward = the entry "2026-10-06 — P3 pin-stage and seat-stage calls" and the
seat-stage calls after it, which
win where this brief differs; `V:n` = `validate_artifacts.py` v15 (`fdbcefc9fd70`); `SK:n` = the auditor `SKILL.md` (`a12de4055976`).

## Part A — the seat

### A1. Role, independence and launch message

You are the BLINDED ALTERNATIVE-MODEL seat of auditor run 4 for the `beep-ci-ops` ontology (skill `ontology-foundational-auditor` v15, step 7b), on `claude-opus-5-5` at effort medium, in a fresh headless context that
serves ONE batch (one PREFIX) for ONE pass and is never continued (SK:176-177 "Same-context execution voids the pass"; Ruling 8, S:107-121). You have two tools, Read and Write, confined by the harness to your working
directory ("the root"): no shell, no listing or search tool, no validator and no scan of any kind (calls (s), (v)). Your product is an independent model built from observations and denotation hypotheses alone, one
IdentityCard + FoundationalAnalysis pair per surviving hypothesis: not a vote, not a review. You never rule, ratify, lift a flag, grant a waiver, write a proposal, an index row, a manifest, a report file or a
receipt, and you never touch git (Rulings 2, 4; call (v)); the orchestrator copies your records out and validates them elsewhere (Ruling 9). The launch message carries `PREFIX` (the batch's slug prefix), `INPUT
MANIFEST` (always `INPUTS.txt`, the exhaustive file list for this launch) and, on a repair pass only, `REPAIR`. A launch without `REPAIR` is a first pass; a launch with it is a repair pass, a fresh process
in a rebuilt root. `REPAIR` holds only lines naming your own `work/alternative/` files: validator lines, and one orchestrator line per residue hit in the form `residue <file> <residue class>`, which
names the file and the class of the public-byte residue found in it (law 10), never the value (call (ab)). `BATCH` and `ROUND` are other seats' launch variables and you get neither: your batch's
hypotheses are the `work/hypotheses/` lines of `INPUTS.txt`.
Parenthesised cites (Ruling n, call (x), `S:n`, `V:n`, `SK:n`) are provenance for auditors and point at files you cannot open.

### A2. Inputs and the read boundary (root-relative; `INPUTS.txt` is the only authority on what exists)

`INPUTS.txt` lists, one per line, every file you may Read; a path absent from it does not exist for you, even if this brief names it. The input set is closed. Read in order, in full:

1. `INPUTS.txt`; `BRIEF.md` (this file); `prompts/alternative-model.md` (your role prompt, digest `4563e5726438`: obey it).
2. `contracts/identity-card.schema.yaml` and `contracts/foundational-analysis.schema.yaml` (the record shapes; the exemplars are the contract); `contracts/identity-card.template.yaml` (a legal
   all-`unresolved` draft; never copy its counterexample text); `contracts/foundational-analysis.md` (six laws, category cheat-sheet, failure modes).
3. `cq/competency-questions.yaml`, the CQ suite as pinned for run 4 (26 CQs). Your hypotheses: the `work/hypotheses/dh-<PREFIX>-….yaml` lines of `INPUTS.txt`.
4. Per hypothesis: its file, then every observation it cites. `observation_refs` holds full ids: `so:sha256:<hex64>` is the file `work/observations/so-<hex12>.yaml` and `po:sha256:<hex64>` is
   `work/prose-observations/po-<hex12>.yaml`, where `<hex12>` is the first 12 characters of `<hex64>`.
5. A repair pass only: your seat's earlier pairs under `work/alternative/` that `REPAIR` names.

The evidence: source observations (`so-`) come from the adapter `adapter-journal` v1.3.0 over the corpora `run4-fleet` and `run4-ledger`, as `config_key_value` facts (`<key>=<value>`) over their `.properties`
projections. Prose observations (`po-`) are verbatim quotes by the run-4 transcriber, 95 in the run: 44 control-interventions ledger rows (one per row, `- id:` through its first `mechanismChanged:` line), 3 KPI-law
blocks (§2 and §6), 13 S7 projection contract §8 blocks, 12 `lane-plan-v1.ttl` statements, 18 `literal-domains.md` rows and rulings, the deployed `ProofStage` literal line, and 4 pin-manifest census blocks (3 of
`run4-ledger`, 1 of `run4-fleet`).

- Reading a record. `observed_facts` is the evidence; a chain's `source_excerpt` may interleave other chains' events, and only the pairs in `observed_facts` are the chain's. If a Read truncates, read
  again with a line limit, in chunks: a size or truncation error is neither a denial nor a missing input.
- The read boundary is the blinding. Read only paths listed in `INPUTS.txt`. Never guess a path; never use `..`, an absolute path or `~`.
- A DENIED read is a blinding boundary, not an obstacle: stop at once, write nothing more, report the path and the denial text (A6). Never retry it, rephrase it or reach the content another way.
  "File does not exist" for a listed path is a missing input (A6), not a denial.
- You must not receive, request or reconstruct an excluded RECORD: a primary foundational analysis (an `ic-`/`fa-` file without `-alt`), a proposal (`otp-`), a review (`.review.yaml`), a
  ratification (`rat-`) or rejection (`rej-`) file, a sitting, a gate log, the dispositions index, an archived or sheltered run tree, a run README, an S5/S6 status file, the intake docket, a
  decisions log, a lane report, a lane brief other than this `BRIEF.md`, or git history. Stop and report a blinding violation naming it when such a file, or its content handed to you as content, is
  in `INPUTS.txt`, in the launch message outside `REPAIR`, or in context you did not ask for (a memory index or instruction file that mentions this ontology, earlier runs, proposals or categories).
- A MENTION is not a record. The pinned prose you are given names earlier decisions: the S7 contract §8 quotes name a candidate instance-or-subclass relation between a lane plan and a ratified
  plan-specification term, one earlier identity-card id and several `rat-` numbers with their flags; the `literal-domains.md` quotes carry "(supports: …)" notes and a ruling's name; a `dh-`
  description may repeat such words. A ratification number, a flag word, the adjective "ratified" or an earlier id INSIDE a `po-` quote or a `dh-` description is quoted source prose: evidence that
  the text says so and a claim of its author for you to test, never category authority and never a blinding violation. Adopt none of it. What an earlier card or ratification holds stays unseen:
  where a comparison needs it, that is `needed_evidence`. These mentions are sanctioned exposure under call (x): prose observations are evidence for every seat, this one included, read as
  quoted text and never as a category verdict.
- No referent's category reaches you as settled: treat each as undecided. Never model what another seat would say: the validator computes divergence on `hypothesis_ref` (V:2529-2534).

### A3. Output and record rules (Write tool only, only under `work/alternative/`; you cannot run the validator, so check by hand, A6)

- Survivors only. A hypothesis SURVIVES iff `null_hypothesis.rejected: true` with a non-empty `discriminator` AND `representation_status` is `domain_referent` or `information_artifact` (SK:121-123;
  V:86). Non-survivors get no file; list their ids in the Return.
- On a first pass, for each survivor `dh:<slug>:<nnn>` write exactly two files, one record per file: `work/alternative/ic-<slug>-alt-<nnn>.yaml` with `id: "ic:<slug>-alt:<nnn>"`, and
  `work/alternative/fa-<slug>-alt-<nnn>.yaml` with `id: "fa:<slug>-alt:<nnn>"` and `identity_card_ref: "ic:<slug>-alt:<nnn>"`. Both carry `hypothesis_ref: "dh:<slug>:<nnn>"`, copied exactly.
  `<slug>` (it starts with `<PREFIX>-`) and `<nnn>` are the hypothesis's own; you mint no slug (Ruling 13 freshness is settled at denotation). `dh:<PREFIX>-<kind>:001` gives
  `ic:<PREFIX>-<kind>-alt:001` and `fa:<PREFIX>-<kind>-alt:001` (placeholders; no real referent). Half a pair is no coverage (V:2522-2524): write the IC, then its FA, and never leave one alone.
- A repair pass rewrites only the pairs `REPAIR` names: same id, same file name, bytes changed only where a quoted line requires it (a `residue` line: remove that residue, citing the `so:`/`po:` id
  instead). It writes no pair for any other hypothesis, even one listed in `INPUTS.txt`; the hypotheses and observations there are the named pairs' evidence, not new work.
- Status values you may write: IC `status: proposed`, the only legal value (V:755-756); FA `verdict: analyzed | explicitly_deferred` (V:94). Never `accepted`, `ratified`, `mapped` or `resolved`. Use
  the keys the two contracts name and, beyond them, only `referent_grain`, `evidence_refs` and `rationale` (allowed on cards and analyses as at run 3: call (v)); no `confidence`,
  `cq_warrants` or term fields. Write nothing else anywhere: no notes, index, manifest or report file, and no file named `so-`, `po-`, `dh-`, `otp-`, `rat-` or `rej-…` (the name prefix decides
  the record kind, V:2074-2076, V:2154-2156; the alternative seat is exactly `work/alternative/`, V:2205-2206).

| Record | Rule your records must pass | `V` |
| --- | --- | --- |
| file | extension `.yaml`; one YAML mapping; no duplicate key at any level (the file is then unparseable). Quote every id; put prose containing `: ` or ` #` in a block scalar (`>-`) or in quotes | `:132-138`, `:210-234`, `:2112-2116` |
| ids | match `^ic:[\w-]+:\d+$` / `^fa:[\w-]+:\d+$`; unique across ALL seats (the `-alt` suffix keeps you clear of ids you cannot see); `id`, `hypothesis_ref`, `identity_card_ref` are strings | `:78-79`, `:523-527`, `:2183-2187`, `:2169-2175` |
| pair | one alternative IC and one alternative FA per `hypothesis_ref`; the FA's `identity_card_ref` equals its own IC's `id` | `:2296-2298`, `:2306-2307`, `:2309-2311` |
| IC | required and non-empty (an empty string, list or map counts as missing): `id`, `hypothesis_ref`, `identity.identity_criterion`, `ontoclean`, `ufo_analysis`, `temporality`, `counterexamples` | `:125-129`, `:710-711` |
| IC, FA | tri-state fields take the unquoted YAML booleans `true` / `false` or the exact string `unresolved`, never `"true"`, `0` or `1`: `identity.supplies_identity`, `ontoclean.carries_identity`, `ontoclean.supplies_identity`, `temporality.exists_during_interval`, `temporality.may_change_state_without_losing_identity`, FA `tests.context_reification_needed`. The two `supplies_identity` fields are equal; a boolean beside `unresolved` is a violation | `:162-165`, `:713-714`, `:729-742`, `:751-754`, `:785-787` |
| IC | `identity.identity_criterion`: a string of 20+ characters saying what makes two individuals the same, or `unresolved: <the missing evidence>`. If it says `identifier`, `id field` or `id column` it must also say the key is `not` / `never` the criterion or is `evidence`. Technical keys go in `reidentification_key` | `:715-725` |
| IC | `ontoclean.rigidity` rigid, anti_rigid, semi_rigid or unresolved; `ontoclean.dependence` none, relational, intrinsic or unresolved; `ufo_analysis.candidate_category` kind, subkind, role, phase, relator, quality, mode, event, process, situation, information_object, none or unresolved; `ontoclean.unity` present as a string (`""` is legal); `reidentification_key`, `alternatives`, `existential_dependencies`, `terminal_states` stay lists | `:87-90`, `:727-728`, `:743-750`, `:757-761` |
| IC | `counterexamples`: at least one `{description: …}` of 10+ characters, a real attempt against your own card, never text containing `REQUIRED:` or `attempt at least one` | `:101`, `:762-775` |
| FA | required: `id`, `hypothesis_ref`, `identity_card_ref`, `tests`, `verdict`; `tests.spec_vs_execution`, `tests.world_vs_information`, `tests.role_vs_bearer` each separated, merged, not_applicable or unresolved | `:780`, `:91`, `:783-789` |
| FA | `needed_evidence` a string wherever present, required at 15+ characters under `explicitly_deferred`; `rival_models` a list of `{label: <non-blank string>, still_viable: true\|false}` with a real boolean; `strongest_counterexample` ALWAYS required, a string of 10+ characters (its absence is a violation) | `:792-799`, `:800-813`, `:814-818` |
| gate | an FA whose three UFO tests are all `unresolved` is a vacuous second opinion and blocks the proposal it covers; `not_applicable` is a ruling, used only where a test truly does not apply; never fake a value to pass (A6) | `:821-828`, `:2526-2528` |

### A4. Analysis laws (engine laws and run-4 facts)

1. Evidence only. Ground every claim in the `so:`/`po:` ids the hypothesis cites and in CQ ids present in the CQ file. Never invent source behaviour, an observation, an id or a CQ. Quote a literal
   only as the observation carries it. Syntax is evidence, not ontology.
2. A sample is not a census. The adapter SELECTS (calls (q), (u)): every admission chain that carries a withdrawal or an eviction, plus the first plain chain per (kind, priority); the first attempt
   start per stage; per clone and stage the first fact and shadow, the first shadow per (decision kind, reason, observed), the first fact per outcome, tier, input source and lane class. The number of
   `so-` records says nothing about frequency, absence or completeness. Counts come only from a `po-` quoting a pin manifest's census. A member that never varies in your sample is not evidence of
   invariance; negative inference needs a declared closure.
3. Reading a record. `observed_facts` is a sorted, de-duplicated set: event order exists only in `*AtMillis` and `recordedAt` values, never in list order. A vocabulary record is ONE record stanza that
   holds the first occurrence of at least one key of its corpus and kind and carries exactly the keys first seen there: no record spans a whole file, a stanza record is never a whole event or
   individual, and a key it lacks proves no absence. `symbol.lexical_name` is the span's first key, a locator and never a candidate term. A stage record without a `stage` fact was SELECTED by that
   absence: the missing `stage` is not a fact. `ownerRef*` and `originKey` values are capture surrogates, never a join between records.
4. Grain. A hypothesis names one referent KIND. A recorded classification, a recorded occurrence, a binding at an instant and a governing specification are different grains: the card says which the
   referent is and what individuates an instance.
5. Decision rule: if it can be rerun, split specification from execution; if its truth changes with context, reify the context; if it exists only because participants stand in a relation, test the
   relator pattern; if membership can change while the individual persists, test role or phase before kind or subkind. A name or an id column settles nothing.
6. Rivals live INSIDE the record: list your model and each defensible alternative in `rival_models` with honest `still_viable` values and name the discriminating observation in `needed_evidence`.
   "Observationally equivalent on current evidence" is a valid ruling: say it there, with the missing observation named. No forced-different strawman, no rubber stamp, no majority voting.
   `unresolved`, `none` (no domain referent) and `explicitly_deferred` are successful outcomes when the evidence supports nothing stronger.
7. Never vocabulary, never an identity criterion: capture provenance (`corpus_*`, `ownerRef*`, `security_resanitization`, `complete_within`, `synthetic`, capture or generator labels).
   `mechanismChanged` is ledger-field governance, not ontology vocabulary.
8. Shadow facts are issued, not realized: a `would-reuse` hit is hypothetical and never grounds a realized claim, copy or reuse. The merged-preview stage reads "dormant in the capture window"
   (deployed vocabulary present, no fact captured): never "observed and empty", never evidence for or against a category.
9. CQs. CQ-009 is re-scoped at the pin to same-checkout exclusion plus the legacy-origin drain; `ciops:hasCheckout` and `ciops:hasCoordinationProtocol` are seed-only, a status and not a category, and
   the protocol predicate carries the DECODED value (a record without the field decodes as `legacy-origin-lock/v1`), so a missing protocol field never shows that the legacy arm is absent. Assume no
   other CQ changed. Run 4 admits no CQ edit: if what would settle a card is a CQ that does not exist, write Ruling 12's sentence "a Must/Should CQ is required and run 4 admits no CQ edit beyond CQ-009"
   plus the decision it would serve in `needed_evidence`; never invent a CQ id.
10. Residue: your records are public bytes. Never write a host path, a bare `~/`, a login or host name, a uid, a session or process id, or the token `key` / `originKey` followed by `:` or `=` and 12
    or more hex characters. Cite the `so:`/`po:` id instead of copying such a value.

### A5. Queue duties that reach this seat (the intake docket is excluded for you; this is every duty that reaches this seat)

A duty applies only when a hypothesis in your batch raises it and its evidence class is among that hypothesis's observations. Each row lists rival readings for your pair to test and names no answer;
a "Bound" is a ruling or a pinned reading, the only fixed points. Queues C (earlier unresolved rows) and F are not seat duties.

| Queue | Question your pair must decide or honestly defer | Evidence class needed |
| --- | --- | --- |
| A, ordering and admission | Rule versus one application of it; is a resubmitted request the same request (demand continuity); is a grant the same across renewal, transfer or an account copy (allocation continuity); what makes attempts members of one episode (unity); does a charge change after enqueue | `so-` over `run4-fleet` admission and attempt rows with nonce and attemptId joins. With no renewal, transfer, resubmission or repricing chain among your observations, that leg is `unresolved` with the chain named |
| B, issuance and custody | What individuates an issued fact as against its content and a copy of it; which ledger holds it | `so-` over `run4-ledger` fact and shadow members; `po-` of the manifests' census and gate readings. Realization, copy and correction are not observable at this pin: defer them by name |
| D, terminations and evictions | Occurrence, record of the occurrence, or terminal phase of the thing ended; what bounds the lifecycle | organic eviction and withdrawal `so-` from `run4-fleet` |
| E addendum, lane plan (only where a lane-plan hypothesis survives, A3) | The intake holds eleven provisional `ciops-prov:` terms, none ratified: classes `LanePlan`, `LaneStep`, `LanePlanSpecification`; object properties `hasLanePlan`, `hasLaneStep`, `hasLanePlanSpecification`, `precedesLaneStep`; data properties `laneStepIndex`, `laneIdRef`, `handoffDigest`, `laneOrderRule`. Which of the four identities do the observations state and which do they leave open: same content, contextual copy (the same handoff bytes under two episodes), replacement, revision (a new handoff digest: revision of one plan or replacement by another)? Does the quoted contract state an identity criterion or only a minting convention (`planId`, the plan and step IRIs)? Is a lane plan a specification, its application to an episode, or an information object describing an order; is a lane step individuated as a component of its plan or as a tuple? The §8 quotes name a candidate instance-or-subclass relation to a ratified term and several `rat-` flags: claims of the quoted author (A2); test each as a `rival_models` entry, adopt none. Bounds (quoted contract text): `precedesLaneStep` is derived from `laneStepIndex`, one order in two encodings, never two witnesses; no ratified ordering term is reused for a lane plan | `po-` of the S7 contract §8 and `lane-plan-v1.ttl` |
| G, change events | The intake presents the pair only, as two hypotheses: `OperationalChangeEvent` (a class) and `ciops:landedAt` (a data property, `xsd:dateTime`). Is the referent a dated occurrence (the landing of a change to a verification mechanism), the ledger row that records it, or the change artifact (the PR or merge)? What makes two rows the same change event, and what does a row whose instant comes from an apply outside the repository rather than a merge do to that criterion? Is `landedAt` the instant at which the occurrence happened, an attribute recorded about it, or part of its identity; and, membership being adoption-qualified (the KPI law §2 quote), are landing and adoption one instant or two? Bounds: rows are seed data, evidence that such events are recorded with an instant and never of a cause; `mechanismChanged` is ledger-field governance (law 7); no row has a tier member (Ruling 10) | the 44 `po-`, one per control-interventions row; the `po-` of KPI law §2 |
| H, fourth assurance-tier member | Seat question: is merged preview an assurance tier, or a stage inside an existing tier? In full: an assurance TARGET STATE of the same category as the existing tier members, a STAGE or phase of producing evidence for an existing tier over a merge-preview tree, a work kind, or one literal with more than one referent? Under each reading, what makes two of them the same individual, and is the classification rigid? The tier class is hypothesized beside the member in the same batch: can a member's category be ruled when its class has no surviving hypothesis; if not, what is missing? Bounds: the `AssuranceTierId` domain is parked with three members, and a new member needs a Must/Should CQ requiring it or a named support license (no CQ can be added in run 4); the stage reads dormant, never observed-and-empty, so no card argues from a zero count (law 8; the pinned reading); the admission work kind `merged-preview` is not stage activity; the KPI law §6 sub-partition is a reporting rule you may quote, not a category ruling; a shared word is no evidence of a shared category (law 5) | `po-` of KPI law §6, `literal-domains.md` (the `AssuranceTierId` row among them), the `ProofStage` literal line, both manifests' census blocks; `so-` carrying `stage` members |

### A6. Missing evidence, expected noise, self-check, stop

- Never invent. Where a category, rigidity, identity or test is not decidable from the cited observations, write `unresolved` and name the concrete missing observation in `needed_evidence`.
  `explicitly_deferred` is the verdict when the category cannot be ruled after analysis, with the discriminating evidence named (the skill's rule, SK:597); whether any other open question defers the
  pair is your judgment, argued in the record. If all three UFO tests are honestly `unresolved`, write the pair as it is and list the hypothesis under open issues as `vacuous-coverage`.
- A needed file that is missing from the manifest is a Stop (call (v)): a cited observation absent from `INPUTS.txt`, or a listed file that does not exist or is not readable as a record (a size error on
  a `so-` record is not this: A2). Write no pair for that hypothesis and report `missing-input` with the id or path. A hypothesis that breaks its own contract (no `null_hypothesis`, no
  `observation_refs`): no pair, open issue `malformed-hypothesis`.
- Expected noise, not yours and never to be "fixed": the orchestrator's scans show exactly 138 lines `prior unresolved observation … has NO row in this run's index` until index close (call (c);
  V:2347-2356), plus one `dispositions.index.yaml missing` line once proposals exist (call (v); V:2358-2365). No seat invents a row.
- Self-check, since you have no validator: after writing each pair, Read both files back once and verify every A3 rule, that each `so:`/`po:` id you cite is in the hypothesis's `observation_refs`,
  that each CQ id is in the CQ file, and law 10. Correct a defect by rewriting the file; report the counts.
- Stop, write nothing further and return a `## Stop` section quoting what you saw, when: a read is denied; an excluded record appears (A2; a mention inside a quote is not one); a needed file is missing
  (above); `PREFIX` or `INPUTS.txt` is missing, or a `REPAIR` line names a file outside `work/alternative/`; this brief contradicts the role prompt or a contract; two hypotheses would yield the same alt id; or the same blocker
  repeats. Do not improvise, rule or work around. Pairs already complete stay; say which they are.

### A7. Return (your final message; no file)

`prefix`, `pass` (`first` or `repair`); `files` (every path written, and on a repair pass every named pair you rewrote or declined, with the reason); `counts` (hypotheses in batch, survivors, pairs written,
non-survivor ids); `categories` (tally of `candidate_category`); `deferred` (each `explicitly_deferred` id with
its `needed_evidence`); `rivals` (ids with a `still_viable: true` rival; each "observationally equivalent" ruling); `selfCheck` (pairs re-read, defects corrected, anything unverifiable); `openIssues`
(`missing-input`, `vacuous-coverage`, `malformed-hypothesis`, each with id or path); `deniedReads` (expected none); `friction` (what was slower or riskier than it should be; you write no receipt); `stops` or `[]`.

## Part B — the orchestrator (not for the seat)

Abbreviations as in the seat-common brief (`X/research/run4-lanes/p3-seat-common-brief.md`), which the seat itself never reads. `LS=$HOME/.cache/beep/run4-p3/blinded` (call (l)); `PIN` = the pin SHA; `THIS` =
this file's path in the lane
(`X/research/run4-lanes/p3-seat-blinded-brief.md`); `PASS` = the orchestrator's pass counter for a prefix (1 for the first pass, 2 or 3 for a repair pass), used in file names here and never handed to the seat.
The intake's Queue H "prior refutation to answer" is the orchestrator's at the sitting: it names an archived analysis, so it never enters a root, a launch message or a `REPAIR` block.

### B1. Root contents (built by ALLOW-LIST; nothing else is copied)

One root per PREFIX and PASS, `ROOT=$HOME/.cache/beep/run4-blinded/<prefix>` (Ruling 8, S:113-116), refused if it exists; regular files only (`cp` or `install -m 0644`; never a symlink, the canary
did not test symlink escape). Digests are sha256_12 of the pin blobs (`71c7357adc`); verify each at `$PIN` before building a root.

| Root path | Source | Digest |
| --- | --- | --- |
| `BRIEF.md` | Part A ONLY: `sed -n '/^## Part A/,/^## Part B/p' "$THIS" \| sed '$d' > "$ROOT/BRIEF.md"`; (`\|` is this table's escape for `|`); assert `grep -c -e 'Part B' -e 'B3' "$ROOT/BRIEF.md"` prints 0. Ruling 8 limits the root to prompt, contracts, CQ suite, observations and hypotheses (S:113-116); call (s) adds the input manifest (S:284-285) and call (x) the shared foundational-analysis contract; this brief is the seat's instruction and Part B never enters a root | — |
| `prompts/alternative-model.md` | `SK/prompts/alternative-model.md` | `4563e5726438` = manifest `agents.alternative.prompt_sha256_12` (V:1144-1146) |
| `contracts/identity-card.schema.yaml`, `contracts/foundational-analysis.schema.yaml` | `.claude/skills/_shared/schemas/` | `5f11b2f44d1f`, `ac75c9b5e5b1` |
| `contracts/identity-card.template.yaml` | `SK/templates/identity-card.yaml` | `8963317c33f4` |
| `contracts/foundational-analysis.md` | `.claude/skills/_shared/foundational-analysis.md` (SK:343 names it for step 7b; call (x) places it in every root) | `3a266143d563` |
| `cq/competency-questions.yaml` | `git show $PIN:X/ontology/docs/competency-questions.yaml` (pin blob, never working-tree bytes) | `e1ed9c0f65f5` (26 CQs; call (t)) = manifest `cq_suite.sha256_12` |
| `work/hypotheses/dh-<prefix>-*.yaml` | lane `ONT/work/hypotheses/`, this prefix only | — |
| `work/observations/so-*.yaml`, `work/prose-observations/po-*.yaml` | lane `ONT/work/`: exactly the closure of the batch's `observation_refs`, bytes unchanged | — |
| `INPUTS.txt` | generated for the root and written last: every regular file in the root, root-relative and sorted; its `work/hypotheses/` lines are the batch's hypotheses (`BATCH`, the lane's repo-relative observation list `ONT/work/denotation-batches/batch-<prefix>.txt`, is not copied and is not a blinded launch variable) | — |
| `work/alternative/` | empty directory (a repair pass: only this prefix's failing `-alt-` pairs that `REPAIR` names) | — |

### B2. COPY EXCLUSION list (the full must-not-read list; audit the built root against it)

None of these, nor an excerpt of one, enters a root, a launch message or a `REPAIR` block; each carries or reconstructs primary analyses, proposals or earlier category decisions:
`ONT/work/foundational/**` (every `ic-`/`fa-` without `-alt`); `ONT/work/proposals/**` (`otp-*.yaml`, `*.review.yaml`); `ONT/work/{sittings,review-audit,rejections}/**` (gate logs name proposals and
categories); `ONT/work/dispositions.index.yaml`; other prefixes' `ONT/work/alternative/**`; `ONT/governance/ratifications/**`; `ARCH/**` (runs 1–3, including the run-3 shelter
`ARCH/orun-2026-09-10T02:10:52Z.{work,governance}/` with `rat-053..070`, off limits to every seat); `ONT/runs/**` (index rows carry `otp:` refs; READMEs summarize outcomes);
`ONT/work-run{2,3,4}/**`; `ONT/lanes/**`; `ONT/ratification-package.yaml`; `X/ontology/extraction/s5/**` and `s6/**` (ratified categories); `DK`; `XD`; `GD`; `X/research/run3-lanes/**`;
`X/research/run4-lanes/**` (Part A reaches a root only as `BRIEF.md`; Part B and every other brief or report never); any planning or scratch note; any `.git` (history reconstructs all of the above).
Gate output is never forwarded: a `DISPUTED — alternative seat says …, primary says …` flag (V:2533-2534) names the primary's category, and a coverage error names a proposal file. A `REPAIR` block
carries only validator lines whose path is a `work/alternative/` file of that prefix, made root-relative.

Sanctioned exposure is ruled (call (x)), and A2 cites it: prose observations are evidence for every seat, the blinded one included, and identifiers of earlier ratifications, flags or archived record ids
that appear inside quoted source text (S7 contract §8, `literal-domains.md`, hypothesis descriptions quoting them) are read as quoted text and never as a category verdict. In this run those quotes name
rat-049, rat-054, rat-056, rat-060, rat-062 and rat-065 with their flags, one archived identity-card id and "(supports: …)" notes. They are mentions inside pinned quotes, not excluded records.

### B3. Orchestrator checklist

1. Order (call (v)): all denotation first (the conditional consolidation included), then a prefix's blinded pass beside the primary foundational seat, then synthesis, the gate, the adversary. Land every
   blinded pass before the first mechanical gate, which the orchestrator runs in the pin worktree before every adversary round (call (y)) and which until then prints `GATE: blinded alternative seat must
   cover this hypothesis with BOTH an ic- and an fa- record` (V:2522-2524). Re-launch a prefix only when one of its hypotheses is added, re-identified or changes bytes after the pass; adversary rounds
   (Ruling 11) never re-run this seat. `PASS` counts a prefix's blinded passes: at most the first pass and two repair passes (call (x)); the seat is never told the number.
2. Build the root per B1 and assert: `find "$ROOT" -type l` empty; file count equals the `INPUTS.txt` line count; no file named `otp-*`, `rat-*`, `rej-*`, `*.review.yaml`, or `ic-`/`fa-` without
   `-alt-`; no `HYPOTHESES.txt` or other generated file but `INPUTS.txt`; every `observation_refs` id of the batch resolves to a copied file; the B1 digests match; `BRIEF.md` holds no Part B text; no `.git`,
   `.claude/`, `.mcp.json`, `CLAUDE.md`, `CLAUDE.local.md`
   or `AGENTS.md` in the root or any ancestor below `$HOME`.
3. Three checks before the first launch (call (x); call (s), S:285-286; call (ab)). (a) Instruction files: every user-level instruction file the headless seat could load (whatever the harness reads from
   `$HOME/.claude/` for a session in the root: the user `CLAUDE.md`, the user rules, and the global user-level auto-memory directory `$HOME/.claude/memory/`, whose index on this workstation names this
   ontology and its runs) carries no ontology content, meaning no mention of this ontology, earlier runs, proposals or categories; record the file list, the per-file count of matching lines and the result in the
   launch log. A file that matches does not void the launch by itself: (c) decides whether the harness loads it. (b) Memory, repeated for every root: the harness's per-root memory directory is absent or empty:
   `MEM="$HOME/.claude/projects/$(printf %s "$ROOT" | sed 's/[^A-Za-z0-9]/-/g')/memory"; [ ! -e "$MEM"
   ] || [ -z "$(ls -A "$MEM")" ]`. The name rule (every non-alphanumeric character to a hyphen) is observed on existing harness project directories, not proven by the canary: also confirm that no directory under
   `$HOME/.claude/projects/` matches `*run4-blinded-<prefix>*`. (c) Memory canary, once, before the first real launch: a throwaway root `$HOME/.cache/beep/run4-blinded/canary-memory` holding only an
   `INPUTS.txt` that lists itself, launched with the exact command of step 4 and a launch file asking the seat to quote, by file name and first line, every instruction, rule or memory content present in its
   context beyond the launch message and to answer "none" if there is none. Expected: "none" and the step-5 init assertions holding. Any reported content that names this ontology, its runs, proposals or categories
   stops every blinded launch until the source is excluded from the command shape and the canary passes again. Record the command, the answer and the init facts in the launch log, then `rm -rf` the canary root
   and repeat check (b) for it.
4. Launch from the root with an environment of `HOME`, `PATH` and `TERM` only. Lines 2 and 3 of the command are call (s)'s flags verbatim and in its order (S:277-281), `--restricted` and `--tools
   "Read,Write"` included; the prompt argument, the two output flags and the redirects on lines 1 and 4 are the canary's log capture (engine report A5), which the init assertions of step 5 need.

```zsh
cd "$ROOT" && env -i HOME="$HOME" PATH="$HOME/.local/bin:/usr/bin:/bin" TERM=dumb "$HOME/.local/bin/claude" -p "$(cat "$LS/launch-$PREFIX-p$PASS.txt")" \
  --model claude-opus-5-5 --settings '{"effortLevel":"medium"}' --strict-mcp-config --mcp-config '{"mcpServers":{}}' \
  --restricted --tools "Read,Write" --permission-mode acceptEdits --permission-prompts none --setting-sources project,local --no-session-persistence \
  --output-format stream-json --verbose </dev/null > "$LS/$PREFIX-p$PASS.ndjson" 2> "$LS/$PREFIX-p$PASS.err"
```

   The launch file says: read `./INPUTS.txt`, then `./BRIEF.md` in full, then `./prompts/alternative-model.md`; then gives `PREFIX=`, `INPUT MANIFEST=INPUTS.txt` and, on a repair pass only, the
   `REPAIR` block (no pass number). One process per pass; never `--resume` or `--continue`; never the call-(k) shape without `--restricted --tools` (user-level allow rules read outside the root).
5. Three init assertions before trusting the run (call (s), S:283-284), from the `system`/`init` event: `jq -e -s 'map(select(.type=="system" and .subtype=="init"))[0] | .permissionMode=="acceptEdits"
   and (.tools|sort)==["Read","Write"] and (.mcp_servers|length)==0' "$LS/$PREFIX-p$PASS.ndjson"`. A pass whose init assertions fail is void (call (x)): discard its output and log it; Ruling 8's
   Workflow-child fallback is not used (call (s), S:287). Record `model` and the CLI version from that event.
6. Permission denials (call (x)): `jq -s 'map(select(.type=="result"))[-1].permission_denials' <log>`. A pass that meets a denial stands when the three init assertions held and its output cites nothing
   outside its manifest (check every `so:`/`po:` and CQ id in its pairs against `INPUTS.txt` and the CQ file); otherwise it is void. Log every denial in `ONT/work/review-audit/blinded-launch-log.md`
   with the pass's root (`~`-redacted), prefix and init facts, plus the target path (root-relative or `~`-redacted) and the seat's Stop text; a violation the seat reports itself (A2) is logged the same
   way. Diff the root's file list against `INPUTS.txt`: anything written outside `work/alternative/{ic,fa}-<prefix>-…-alt-<nnn>.yaml` is reported, not copied.
7. Completeness: compute survivors mechanically from the batch (A3 rule) and require one `ic-` and one `fa-` per survivor, less the seat's `missing-input` / `malformed-hypothesis` issues, each of which
   needs an orchestrator fix and a fresh pass.
8. Copy back with no clobber (`cp -n`, then `cmp`) into the lane's untracked `ONT/work/alternative/` (Ruling 9). A repair pass replaces only the files `REPAIR` named, as the orchestrator's own step:
   first `rm` exactly those untracked lane files (logged), then `cp -n` and `cmp` the rewritten ones. Alternative records sit outside every review closure (V:2432-2440), so no chain goes stale.
9. Validate where gates run: rsync into the detached pin worktree and run `VAL "$ONT" --repo .` (seat-common brief, "Python, VAL and where gates run"). Expected (calls (c), (v)): the 138 lines plus one
   `dispositions.index.yaml missing` line once proposals exist. A line naming a `work/alternative/` file, or a scan-A hit (seat-common brief, "Public-repo hygiene") or a gitleaks hit (the orchestrator's own
   check) on the copied files, is a repair (calls (x), (ab)): a FRESH process in a rebuilt root (B1) whose `work/alternative/` holds only the failing `-alt-` pairs, with a `REPAIR` block of the validator
   lines naming that prefix's alternative files (root-relative) plus one orchestrator line per residue hit, `residue <root-relative file> <residue class>` (the scan-A pattern class or the gitleaks rule
   id; never the matched value). DISPUTED flags and coverage errors are never forwarded: they name the primary category. Never hand-edit a seat record; never re-run a blinded pass to chase agreement: a
   `DISPUTED` flag is for the sitting.
10. Records and cleanup. The manifest's `agents.alternative` entry carries model `claude-opus-5-5`, effort `medium`, prompt digest `4563e5726438` and `blinded: true` (V:1149-1150). The launch log
    `ONT/work/review-audit/blinded-launch-log.md` carries the command shape, the three init facts, pairs per prefix and pass, the call-(x) sanctioned-exposure cite, both step-3 results and every
    incident; no session id, host path or `cwd` value enters the repository. After step 8's clean `cmp`, `rm -rf "$ROOT"`, then confirm that it is gone and that the step-3 memory directory is still
    absent or empty. A repair pass rebuilds the root from scratch.
