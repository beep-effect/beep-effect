<!-- Seat brief as issued 2026-10-06 for goal phase P3 (W7, auditor run 4): DENOTATION seat, per-batch pass and consolidation pass. Installed as X/research/run4-lanes/p3-seat-denotation-brief.md. -->
# P3 seat brief — denotation (auditor run 4)
Read `X/research/run4-lanes/p3-seat-common-brief.md` first (the TRIMMED seat-common brief, cited as "common §<heading>"; the lane copy `p3-common-brief.md` is never yours to open), then this brief, then
`SK/prompts/denotation.md` (`PR`, digest `ddec132ee905`). Part A is the per-batch pass, Part B the consolidation pass; the launch message says which you are. `SH` = `.claude/skills/_shared`; `C` =
`SH/schemas/denotation-hypothesis.schema.yaml`; `WORK` = `ONT/work`. "Ruling n" and calls (a)–(s) are the launch sitting; calls (t) onward are the pin-stage and seat-stage calls of the same day, and where
this brief and a call differ the call wins. Cites to files outside "Input" (`S:n`, `DK:n`, `CT:n`, `SPEC:n`) are provenance for the orchestrator: the operative clause is restated and you never open them.
## Role and independence (both passes)
- You are the DENOTATION seat (skill step 3, `SK/SKILL.md:116-125`): observation records in, `DenotationHypothesis` records out. You never rule, ratify, lift a flag, grant a waiver, write an index
  row, stage, commit, tag or push (Rulings 2, 4; common §Who rules, §Read-only and no-git laws).
- `claude-opus-5-5`, effort `medium`, a FRESH context per batch, never continued, no worker spawned (Ruling 8, S:107-113; `SK/SKILL.md:176-177`: "Same-context execution voids the pass"). If your
  context already holds another batch's hypotheses, a later seat's output, a sitting text or the docket, say so and stop.
- One rule set for every seat (call v): run no precondition check (the lane preconditions are the orchestrator's, verified before each launch); write no report file and no friction receipt (friction returns
  in Return and the orchestrator files it); run Scan A only (gitleaks is the orchestrator's); run only the plain validator scan of A8 (`--repo` and `--gate` run in the detached pin worktree after the
  orchestrator rsyncs `WORK/` in: Ruling 9, S:123-128). Stages run in order: all denotation, then foundational beside blinded, then synthesis, then the gate, then the adversary.
- The seat-common brief is the common brief trimmed under call (v): no precondition, report, receipt or gitleaks duty, no scan-B file names, no owners table, no prior-index census. It binds you whole and is
  not repeated here (§Packet map, §Evidence and digests, §Who rules, §Read-only and no-git laws, §Python, VAL and where gates run, §Public-repo hygiene, §Expected validator noise, §Engine laws, §Frozen and
  never-touch, §Stop and report, §Return). An earlier-run file name or outcome count seen anywhere is not evidence, is never cited, and no slug seen there is reused.
- The orchestrator checks coverage and grain after denotation, runs the mechanical gate in the pin worktree before every adversary round and checks slug freshness against the shelters (call y).
# Part A — per-batch pass
## A1. Launch variables
| Variable | Meaning |
| --- | --- |
| `LANE` | Run-lane checkout root (`feat/ciops-p3-run4`), your working directory. You never enter the pin worktree. |
| `PREFIX` | Your slug prefix, chosen by the orchestrator and checked by it against every archived id (Ruling 13, S:155-158; call y). Never change, extend or guess one. |
| `BATCH` | Always the observation list `WORK/denotation-batches/batch-<PREFIX>.txt`: one repo-relative record path per line (`WORK/observations/so-*.yaml`, `WORK/prose-observations/po-*.yaml`). |
| `INPUT MANIFEST` | The exhaustive file list for this launch. It lists every file you may open: the seat-common brief, this brief, your prompt, the contracts, the lookups, the run manifest, the CQ file and the records, each as A2 names it; the manifest grants nothing beyond it. A needed file that is missing from it is a Stop, not a search. |
| `REPAIR` (optional) | The seat-common brief's shape (call (ab)): validator lines naming your own `WORK/hypotheses/dh-<PREFIX>-` files (never a line naming `work/alternative/`, never a `FLAGGED` line), or `landed` rows, the orchestrator's restatement of a landed attack as rule id, target record and one sentence (never review text). No other row kind reaches you. Only then may you read and rewrite the `dh-<PREFIX>-*` records it names. `ROUND` belongs to synthesis revision and the adversary; you get none. |
## A2. Input (exhaustive)
1. The seat-common brief and this brief, `PR`, contracts `C` and `SH/foundational-analysis.md`, and `SH/schemas/{source,prose}-observation.schema.yaml` for record shapes (`SK/SKILL.md:297-303`).
2. `WORK/run-manifest.yaml`, read-only (no manifest: Stop; you never write one), and the CQ suite at its `cq_suite.path` (`X/ontology/docs/competency-questions.yaml`, 26 CQs, digest `e1ed9c0f65f5`
   as committed with the CQ-009 package), whose 12-hex sha256 must equal `cq_suite.sha256_12`, else Stop: print it with `sha256sum "$X/ontology/docs/competency-questions.yaml" | cut -c1-12` after the
   seat-common brief's Python block.
3. `BATCH` and exactly the records it lists; read every one. Nothing else: not the corpus file a record points at, not another batch's records.

Reading records. Source observations come from `adapter-journal` v1.3.0 (call u) over the pins `run4-fleet` and `run4-ledger`, prose observations from the run-4 transcriber (Ruling 6; call j). The adapter
SELECTS (calls q, u): every admission chain that carries a withdrawal or an eviction, plus the first plain chain per (kind, priority); the first `attempt-started` per stage; per clone and stage the first fact
and shadow, the first shadow per (decision kind, reason, observed), the first fact per outcome, tier, input source and lane class. A record therefore shows that a shape exists, never a count, a rate or an
absence; counts live only in the census prose records. A vocabulary record is ONE record stanza that holds the first occurrence of at least one key of its pin and kind and carries exactly the keys first seen
there: no record spans a whole file, and a key a stanza record lacks proves no absence. Source facts are `config_key_value` pairs `<key>=<value>`; `observed_facts` is a sorted, de-duplicated set, so event
order lives only in `*AtMillis` and `recordedAt` values. `symbol.lexical_name` is the span's first key (often `ownerRef`): a locator, never a candidate term. A chain's `source_excerpt` may interleave other
chains' events: only the pairs in `observed_facts` are the chain's. Some pairs of source records share `repository.path`, span and `symbol` name and differ only in their facts, the vocabulary
record of such a pair carrying a strict subset of the other's facts (call (z)): both are observations with ids of their own, batched together; read them as one span seen twice, never as two
individuals, and cite each one wherever it instantiates a kind (A5.2). Copy each `id` from the record (the file name holds 12 of its 64 hex).
## A3. Read exclusions (never open, list, grep or reconstruct)
| Path | Reason |
| --- | --- |
| `WORK/{foundational,alternative,proposals,sittings,review-audit,rejections}/**`, `WORK/dispositions.index.yaml`, `ONT/governance/**` | Later seats' analyses, reviews and rulings: denotation precedes them and must not be shaped by them. |
| `WORK/hypotheses/dh-*` of another prefix; other `WORK/denotation-batches/*` | A batch denotes what its own records show; agreement is earned, not copied (Part B reconciles). |
| `ARCH/**` (`X/ontology/extraction/s4/archives/`), including `ARCH/orun-2026-09-10T02:10:52Z.{work,governance,observations}/` | Shelters (Ruling 3): run 1–3 observations, seat trees, `rat-053..070`. Prior outcomes are not evidence; no ruling names them for this seat. |
| `ONT/runs/**`, `ONT/work-run{2,3,4}/**`, `ONT/lanes/**`, `ONT/ratification-package.yaml`, `X/ontology/extraction/s{5,6}/**` | Prior indexes, READMEs, reports and status files carry outcomes and ratified categories. |
| `X/DECISIONS.md`, `GD` (the goal decision log), `DK` (the docket), `X/research/run3-lanes/**`, other `X/research/run4-lanes/**` (the lane copy `p3-common-brief.md` included), `G/**` | Rulings, routing prose, archived slugs and outcomes. The queue duties that reach you are restated in A7. |
| `ONT/corpus/**`, `ONT/adapters/**`, `X/ontology/{docs,tests}/**` except the CQ file, `apps/**`, `packages/**`, `.git` | Records are the only evidence (`PR:25-27`); reading the source behind them invents facts no record carries. |
## A4. Output
- `WORK/hypotheses/` (flat, untracked), one record per file: `dh-<slug>-<nnn>.yaml` with `id: "dh:<slug>:<nnn>"` (`C:2`, `C:5`; `SK/SKILL.md:432-441`). `<slug>` = `<PREFIX>-<kind-slug>`, lowercase
  kebab; `<nnn>` = `001` (`002` only for a second hypothesis under one kind-slug). Slugs seed the later `ic`/`fa`/`otp` slugs: never reuse one you remember from an earlier run (Ruling 13).
- Exactly the contract's keys (no `evidence`, `status`, `category`, `parents`, `term`, `iri`, `needed_evidence`). Block scalars are fine; double-quote any string that contains a colon or a hash.
```yaml
id: "dh:<PREFIX>-<kind-slug>:001"
observation_refs: ["so:sha256:<64 hex, copied from the record>", "po:sha256:<64 hex>"]
cq_warrants: []                      # ids from the pinned suite only
proposed_referent: {label: "<plain-language kind name, not a term proposal>", description: "<what one instance is; what individuates it; which classes instantiate it>"}
representation_status: unresolved    # domain_referent | information_artifact | implementation_artifact_only | lexical_alias | unresolved
alternatives: [{label: "<rival reading>", representation_status: information_artifact, plausibility: viable}]   # viable | weak
null_hypothesis: {label: "implementation artifact only", rejected: false, rationale: "<why the null stands or falls; if unresolved: Needed evidence …>", discriminator: ""}
epistemic_status: proposed
confidence: {value: 0.4, use_for_acceptance: false}
```
- Statuses you may write: the five `representation_status` values, `epistemic_status: proposed`, `rejected: true|false`, `plausibility: viable|weak`; nothing else carries one. No OWL class,
  property, IRI or subclass axiom (`PR:28`).
- Write nothing else: no other record-named file (`so-`, `po-`, `ic-`, `fa-`, `otp-`, `rat-`, `rej-`, `*.review.yaml`, a stray `dh-*.yaml`), index, manifest or symlink; scratch only under `$LS`.
  Your bytes and the cited records enter every later review chain (`V:2432-2442`): a record is final when you return, and a later change is ordered by the orchestrator through a fresh `REPAIR`
  launch, never made by hand (an adversary FAIL blocks, rounds cap at three: Ruling 11).
## A5. Seat laws
1. **Kind grain** (`PR:10-15`; `DK:1013-1015`). One hypothesis per candidate referent KIND, grouping every record that instantiates it and saying what individuates an instance. A nonce chain, a
   ledger record or a ledger row is an individual, never a hypothesis; a record that instantiates several kinds (a request enqueued, admitted and released) is cited by each. A batch yields a handful
   of kinds: a count near the record count is a grain defect.
2. **Coverage** (`V:2249-2261`). Every id in `BATCH` is in `observation_refs` of at least one of your records: cited by a kind, or explicitly null, meaning cited by a null-standing hypothesis whose
   `proposed_referent` names the observed construct (`PR:12-15`; group by construct, omit none). Cite every batch record that instantiates a kind, not a sample, because later proposals and reviews
   may use only your cited ids (`V:2270-2280`, `:2504-2518`, `:1616-1621`); cite only ids from `BATCH` (`PR:25-26`). An `unrepresentable_construct`-only record goes in a null-standing or
   `unresolved` hypothesis only (`V:1640-1642`).
3. **Null** (`PR:17-22`; `SK/SKILL.md:573-581`). Always evaluated. `rejected: true` needs a discriminator: a fact quoted from a cited record that would be FALSE if the symbol were
   implementation-only. Naming, ids, a doc comment, a self-applied label (`class: OperationalChangeEvent`, an emitter's own typing triple) and "the journal records it" never qualify; an absence is
   never a fact. With no discriminator the null stands: `implementation_artifact_only` (bookkeeping) or `unresolved` (plausible, evidence insufficient). Never `rejected: true` with
   `implementation_artifact_only`.
4. **Survival and rivals** (`SK/SKILL.md:121-125`; `V:86`, `:1229-1232`; `PR:16`, `:29-30`). Only `rejected: true` with a discriminator and status `domain_referent` or `information_artifact` reaches
   analysis; `lexical_alias` (name the hypothesis it aliases) and `unresolved` never do, and null-standing results are successful results. A viable rival referent kind gets its own hypothesis, each
   listing the other in `alternatives` as `viable` with what would discriminate; a weak rival is an `alternatives` entry only. Never merge kinds because they share fields.
5. **Warrant and the no-CQ default** (call w; `SK/SKILL.md:596`). `cq_warrants` holds only ids in the pinned suite whose question NEEDS the referent (a mention does not warrant), `must_have` or `should_have`
   only (CQ-018 is `could_have`). Run 4 admits no CQ edit: never write an id that is not in the file. With no warranting CQ: (a) a referent that defines, constrains or disambiguates a kind that has one is
   judged on evidence, with `cq_warrants: []` and the supported kind named in the description (the synthesis seat decides the support license); (b) a referent with neither a warranting suite CQ nor a
   CQ-warranted kind it supports is written null-standing (`rejected: false`) and `unresolved`, even when you hold a discriminating fact (state it in the rationale), and the rationale names the decision a CQ
   would serve and gives Ruling 12's sentence as the named missing decision: "a Must/Should CQ is required and run 4 admits no CQ edit beyond CQ-009". CQ-009 is re-scoped at the pin (Ruling 5) to
   same-checkout exclusion plus the legacy-origin drain: read it as pinned, assume no other CQ changed. `ciops:hasCheckout` and `ciops:hasCoordinationProtocol` are seed-only, neither ratified nor evidence,
   and the protocol predicate carries the DECODED value (a record without the field decodes as `legacy-origin-lock/v1`), so a missing protocol field never shows that the legacy arm is absent. Reuse of
   ratified terms is the synthesis seat's pass, not yours.
6. **Not vocabulary** (common §Engine laws). Capture provenance (`corpus_*`, `ownerRef*`, `security_resanitization*`, `complete_within`, `synthetic` labels), `<fleet>`-style placeholders, the
   `<clone>` path label and the 11-hex truncation of `key` get no referent; say so in the null rationale where they dominate. `mechanismChanged` is ledger-field governance. A shadow hit is a
   hypothetical would-reuse, never realized. Merged preview is "dormant in the capture window", never observed-and-empty.
7. **Hygiene.** Quote keys and closed-vocabulary values (`_tag=admission-withdrawn`, `stage=pre-push`); never copy an instance identifier (nonce, `attemptId`, `runId`, digest, `key`, `originKey`,
   `ownerRef*`, `checkoutRoot` value): the observation id is the citation.
## A6. Validator rules your records must pass (v15)
| Rule | V:line |
| --- | --- |
| Every `*.yaml` under `ONT` named `dh-…` is checked as a hypothesis (only `.yaml` is scanned); an unparseable file or a duplicate mapping key is a violation; one under `WORK/alternative/` is dropped from every join; nothing record-named under `ONT/runs/` | `2074-2076`, `2088`, `2154-2156`, `2112-2116`, `206-234`, `2205-2209`, `2091-2111` |
| Record is a mapping; `id`, `observation_refs`, `representation_status`, `confidence` present and non-empty | `132-138`, `632`, `125-129` |
| `id` matches `^dh:[\w-]+:\d+$`, is a string, and is unique across the run | `78`, `523-526`, `2169-2175`, `2183-2187` |
| `proposed_referent` is a mapping with a non-blank string `label` (`description`, if present, a string); `null_hypothesis.label` and `.rationale` are non-blank strings; `.rejected` is present and a YAML boolean | `634-644`, `656-658`, `676-678` |
| `observation_refs` is a list of strings, each a full `so:sha256:<64 hex>` or `po:sha256:<64 hex>` matching a scanned observation | `645-648`, `671-673`, `2176-2181`, `1207-1213` |
| `cq_warrants`, if present, is a list of `CQ-…` ids, each in the pinned suite (existence checked under `--repo`) | `649-655`, `2059-2063` |
| `representation_status` is one of the five values; `epistemic_status` is absent or `proposed`; `alternatives` entries are mappings with a string `label`, a status from the five and `plausibility` `viable` or `weak` | `84-85`, `674-675`, `659-670` |
| `rejected: true` needs a string `discriminator` of 30+ characters, different from the rationale, matching none of `named type`, `id field`, `has (an) id`, `doc comment`, `is a class/type/interface` | `679-696`, `99-100` |
| `confidence` is a mapping with boolean `use_for_acceptance: false` and a numeric `value` in [0,1] (a boolean is not a number); no `evidence` key | `697-705` |
## A7. Observation classes and the queue duties that reach you
A record's class is its `repository.path` (for source observations also the `symbol.qualified_name` suffix); paths are under `ONT/corpus/` unless given in full. Exact source-observation counts come
with the pin and are stated nowhere here; the prose set is 95 records (the P rows below). Your `BATCH` governs, and a class absent from it is not your duty.

| Class | Path and shape | Grounds | Limits |
| --- | --- | --- | --- |
| A-chain | `run4-fleet/admission/canonical/journal.properties:nonce=…`, one record per (root, nonce) chain: `_tag=admission-{enqueued,admitted,released,withdrawn,lease-evicted,ticket-evicted}`, `*AtMillis`, `kind`, `priority`, `weightTokens`, `checkoutRoot`, `branch`, `attemptId`, `reason`, `lastHeartbeatAtMillis`, `memoryPeakBytes` | what a chain asks, grants and ends (Queues A, D); same-checkout facts (CQ-009) | order only from `*AtMillis`; `ownerRef*`, `originKey` are capture surrogates, never a join |
| A-vocab | stanza vocabulary records of the same file, of `…/admission/canonical/protocol.properties` and of `run4-fleet/live/canonical/quarantine/state.properties` | which keys, tags and members the deployed journal carries | one stanza, only the keys first seen there: never a whole event or individual, and a key it lacks is not an absence |
| T-stage | `run4-fleet/attempts/<clone>/<attempt>/attempts.properties[:record=N]`: first `attempt-started` per `stage` value, one with no `stage`, stanza vocabulary records | deployed stage values, `proofTier`/`tier` members (Queue H); attempt and episode membership (Queue A) | the missing `stage` selected the row and is never a fact |
| L-fact, L-shadow | `run4-ledger/ledgers/<clone>/proof-ledger.properties:record=N`. Facts: `kind=fact`, `laneId`, `laneClass`, `commandDigest`, `envProfile`, `inputDigest`, `inputSource`, `epochDigest`, `key`, `outcome`, `durationMs`, `tier`, `stage`, `headSha`, `recordedAt`, `expiresAt`. Shadows: `kind=shadow` plus a decision `kind=hit` or `miss`, `reason`, `observed` | issuance and custody (Queue B); `stage`/`tier` values (Queue H) | issued, never realized; `durationMs` is per lane, not a bounded execution interval |
| P-row | `X/research/control-interventions.yaml`: 44 records, one per ledger row, each `- id:` through its first `mechanismChanged:` line | Queue G | the row's public head only; seed data, never a cause |
| P-kpi | `X/research/kpi-measurement-rules.md`: 3 blocks (§2 and §6) | Queue G (partition point, adoption-qualified membership); Queue H (three-tier list, merged-preview sub-partition) | a reading rule, not an occurrence |
| P-dom, P-stage | `X/ontology/docs/literal-domains.md`: 18 rows and rulings (the `AssuranceTierId` row among them); the 1 `ProofStage` literal line of `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts` | Queue H | a literal list shows deployed spelling, not category |
| P-census | `run4-ledger/MANIFEST.yaml`: 3 blocks (gate block, stage census, merged-preview reading); `run4-fleet/MANIFEST.yaml`: 1 block (attempt starts by stage) | Queue H evidence line; Queue B census | a reading describes the capture window; every capture field is non-vocabulary |
| P-plan | `X/ontology/docs/s7-projection-contract.md`: 13 §8 blocks; `apps/labs/ciops/test/fixtures/lane-plan-v1.ttl`: 12 Turtle statements, per term | the eleven provisional lane-plan terms; the plan-identity duty | provisional `ciops-prov:` emission by the party that proposed the names |
- **Batching (call w).** Each queue's evidence sits in one batch: the 44 change-event rows with KPI law §2 (Queue G); KPI §6, the literal-domains rows, the `ProofStage` line, both manifests' census records
  and the stage-bearing attempt and ledger observations (Queue H, with the `AssuranceTierId` row in the same batch so the tier class can be hypothesized beside a member); S7 §8 with the lane-plan Turtle (the
  lane-plan terms). No batch is built to manufacture a support chain.
- **Queue A, the admission and ordering kinds behind the flagged accepts.** Which kinds do your A-chain, A-vocab and T-stage records instantiate beyond what is asked and what is granted: the charge
  a ticket carries (`weightTokens`) as against the ticket; a rule as against one application of it; the attempt (`attemptId`) as against the request it submits; the episode that attempts belong to?
  One hypothesis per kind the records make a candidate, citing every record that instantiates it and saying what would individuate an instance. Absence is needed evidence, never a finding: no chain
  whose enqueue and admit charges differ (repricing), no row after a withdrawal for the same attempt (resubmission), no renewal or transfer chain, no closure event.
- **Queue G, the change event and its landing instant** (Ruling 10, S:131-134; `DK:1128-1168`). The intake presents the pair only: `OperationalChangeEvent` (a class) and `ciops:landedAt` (a data property,
  `xsd:dateTime`, seed-only), both under CQ-016 (`should_have`). Evidence: the 44 P-row records and the P-kpi §2 block. Rows are seed data: evidence that such events are recorded with an instant, never of a
  cause (`causalStatus` is observational by default). Work at kind grain over the whole P-row set, never one hypothesis per row: one hypothesis per candidate referent kind, each description saying which of
  the two terms it answers. The class and the property need distinct observations downstream (an index row references one proposal per observation), so two hypotheses answer them, never one. Candidates to
  test, none prescribed: the dated occurrence (a change to a verification mechanism landing), the row as a curated record about a change, the change artifact (the pull request or merge), ledger bookkeeping
  (null); for the instant, the landing (by merge, or by an apply outside the repository) and the adoption reading (P-kpi §2 speaks of adoption-qualified membership). A viable rival gets its own hypothesis and
  a weak one an `alternatives` entry (A5.4). Cite every P-row record that instantiates a kind, plus the P-kpi blocks you rely on; cite CQ-016 only where its pinned query needs the referent. `mechanismChanged`
  is ledger-field governance and is never proposed as vocabulary; any other row member (`title`, `causalStatus`, `mergeCommit`, `pr`) is denoted only if the rows make it a candidate, and then under A5.5(b).
  Infer no tier: no row has a `tier` member.
- **Queue H, a fourth `AssuranceTier` member** (Ruling 10, S:134-136; `DK:1170-1190`). Seat question: is merged preview an assurance tier, or a stage inside an existing tier? The candidate is a merged-preview
  member of the `AssuranceTierId` domain. That domain is PARKED with three members; a new member is a T-Box change that needs a Must/Should CQ requiring it or a named semantic-support license, and run 4
  admits no CQ edit beyond CQ-009, so the available warrants are CQ-002, CQ-006 or CQ-017 as pinned, or support for a same-run `AssuranceTier` class chain. Under A5.5 a member hypothesis reaches analysis
  through those tier CQs (call w): directly where a pinned query needs it, else as support for the tier CLASS kind (what the listed members are members of), which gets its own hypothesis from the
  `AssuranceTierId` row in this batch. Denote merged preview under each referent kind the records make viable, one hypothesis each, each listing the others in `alternatives` with what would tell them apart:
  (a) an assurance tier, a target state an episode is verified to; (b) a proof stage at which evidence is produced (the deployed `ProofStage` literal; the `stage` member of attempts and ledger records); (c) a
  work kind on an admission ticket (`kind=merged-preview` on A-chain records). Fixed reading: the admission work kind is not stage activity, so such a chain is never counted as a stage occurrence. Evidence
  line: merged preview is dormant in the capture window, never observed-and-empty (the ledger census reads no fact and no shadow on either side of the cut; the fleet census reads starts retained from before
  the cut and none since); dormancy is not disuse and is no evidence for or against (a). The KPI law's sub-partition of `TierLocalFullProof` is a reporting rule to quote, not a category. Write no
  ratification, parking or licensing state into a record unless a cited P-dom quote carries it, and then as what the quote says; propose no member name or spelling. A shared word (`tier`, `proofTier`,
  "merged-preview") is lexical: `lexical_alias` is a legal outcome.
- **The eleven provisional lane-plan terms** (Queue E addendum; Ruling 10, S:136-137; `DK:1192-1218`; `CT:461-521`), all in the provisional `ciops-prov:` emission namespace, none ratified: classes `LanePlan`,
  `LaneStep`, `LanePlanSpecification`; object properties `hasLanePlan`, `hasLaneStep`, `hasLanePlanSpecification`, `precedesLaneStep`; data properties `laneStepIndex`, `laneIdRef`, `handoffDigest`,
  `laneOrderRule` (the kinds are the emitter's, not verdicts). Evidence: the 13 S7 §8 blocks and the 12 Turtle statements. Hypothesize by referent kind, not by term; name each of the eleven in the
  `description` of the hypothesis that answers it and cite its record (no term left unanswered). Calls (w), (ab): these terms have no pinned CQ and no same-run decision term to support, and no batch is built to
  manufacture a support chain, so under A5.5(b) they end here, null-standing and `unresolved` (no analysis pair and no proposal follows; the index-close lane carries them), the rationale naming the missing
  lane-order CQ (a Must/Should CQ that needs a lane plan or its order) before Ruling 12's sentence, unless you find a warrant the orchestrator did not (a pinned Must/Should query that needs the referent, or a CQ-warranted kind it supports): then say which, in the description and under
  `openIssues`. Two reading laws bind you: the emitter's own typing or predicate use is not alone a discriminator, and a term listed as "never used for a lane plan" (`schedulesWorkUnit`, `hasScope`,
  `Scope`, …) is a mention and grounds no referent. The rest are claims the P-plan quotes make, each a claim of the contract's author to test against the records, never a verdict: `precedesLaneStep`
  is derived from `laneStepIndex`, a second encoding of one order rather than an independent witness; `planId`, the plan IRI and the step IRI suffix are minting conventions, not individuation
  evidence; lane plan versus the verification-plan specification kind is a candidate instance or a candidate subclass, undecided (list both readings as `viable`, assert neither); lane step is not
  asserted equal to schedule step; the episode-to-plan edge carries no current-selection reading; because the specification binds a handoff digest, it
  is an input-bound application context rather than the order rule (list both readings, the order rule and an input-bound application of it, as `viable`, assert neither). Plan-identity duty (open since run 2: content, contextual-copy,
  replacement and revision identity across verification plans): say which of the four your records show; do not decide the contract. A kind that cannot be stated without choosing IRI syntax is a Stop (`SPEC:196-197`).
- **Queue B, issuance and custody** (`SPEC:96-101`). Questions for the L-fact and L-shadow records: what does the ledger issue, and what individuates one issued item as against its content and a
  copy of it; is a shadow decision a referent of its own or a member of what it shadows; which of key, epoch and lane class do the records evidence as referents rather than fields; what does
  presence in one clone's ledger show about custody? One hypothesis per kind the records support. Reuse is off: no hypothesis whose referent is a realized reuse, a copy or a correction (state it as
  needed evidence); the merged-preview and hosted stages have no facts.
- **Queue D, organic admission terminations.** Questions for the A-chain records: of the things a chain shows (what is asked, what is granted, how each ends, the journal entry as against what it records),
  which are kinds of their own and which are phases or records of another? One hypothesis per kind your batch instantiates; keep two apart only on a discriminating fact and never merge two because they share
  fields (A5.4). All run-4 records are organic (no synthetic pin). State a cross-record join (a withdrawal, then a later row for the same attempt under another nonce) only when both records are in your batch.
  A missing renewal or transfer chain, or equal enqueue and admit `weightTokens`, is an absence, not evidence. Under A5.5(b) a termination kind that no pinned CQ needs re-parks on the CQ barrier
  (null-standing, `unresolved`, Ruling 12's sentence), whatever its discriminator (call w); whether a reading withdrawn in an earlier run returns is decided downstream.
## A8. Self-check and expected noise
Shell state does not persist: paste the seat-common "Python" block (`LS="$HOME/.cache/beep/run4-p3/denotation-<PREFIX>"`) and these lines in every call.
```sh
P=<PREFIX>; B=<BATCH>
PYL='import sys,json,yaml;L=lambda f:yaml.load(open(f),Loader=getattr(yaml,"CSafeLoader",yaml.SafeLoader))'
COV() { ENG -c "$PYL"'
b={L(l.strip())["id"] for l in open(sys.argv[1]) if l.strip()}; c=set()
for f in sys.argv[2:]: c|=set(L(f)["observation_refs"])
print("batch",len(b),"uncited",len(b-c),"foreign",len(c-b))' "$@"; }
COV "$B" $ONT/work/hypotheses/dh-$P-*.yaml          # expect: batch <n> uncited 0 foreign 0
VAL "$ONT" > "$LS/scan.txt" 2>&1; echo exit=$?       # expect exit=1
grep -c 'has NO row in this run' "$LS/scan.txt"; grep -c "/dh-$P-" "$LS/scan.txt"     # expect 138, then 0
```
- Expected noise (calls c, v): exactly 138 lines `prior unresolved observation … has NO row in this run's index` per scan until index close (`V:2347-2356`), plus one `dispositions.index.yaml missing` line
  once proposals exist (`V:2358-2365`; for you only on a `REPAIR` launch, since all denotation runs before any proposal). Neither is yours: never write an index row, a record or a waiver to quiet them; report
  any other count.
- A line naming a `dh-<PREFIX>-` file is yours: fix and re-scan until none remains. Another prefix's or seat's partial files are theirs: report the count of their lines, change nothing (a sibling's
  half-written file can read `unparseable` once; re-scan first). `records exist but work/run-manifest.yaml does not` is a Stop (`V:2196-2200`). An `observation … was never cited by any DenotationHypothesis`
  line (`V:2249-2261`) that names an id in your `BATCH` is yours (`COV` shows it); naming any other id it is reported, never fixed.
- Then Scan A (common §Public-repo hygiene) over your files, expected empty. With no shell, check every record against A6 by hand and say so in Return.
## A9. Missing evidence, Stop, Return
- Missing evidence: never invent a fact, an id, a CQ or source behaviour (`PR:27`). Write the hypothesis with the null standing, status `unresolved`, and one rationale sentence starting "Needed
  evidence:" naming the observation that would decide it; repeat it under `openIssues`. A kind no batch record shows gets no hypothesis (`observation_refs` may not be empty), only an open issue.
- Stop, write nothing further and return a `## Stop` section quoting both sides with path and line when: an input is missing or unreadable; the CQ digest check fails; a batch line names a missing
  file or a non-observation; an excluded file's content is in your context; this brief contradicts the seat-common brief, `PR` or `C`; a seat-common stop fires (common §Stop
  and report); or a blocker repeats after one reasonable investigation. You never switch model, spawn a worker or prompt the operator.
- Return: `seat: denotation`, `pass: batch`, `prefix`, `batch`; `files` (every `dh-` path written or rewritten); `counts` (hypotheses, batch observations, cited, uncited 0, foreign 0, per-status
  tally, survivors, null-standing); `kinds` (id, label, status, `rejected`, `cq_warrants`, cited-record count); `queues` (per queue A, G, H, lane-plan, B, D: classes present and answering hypothesis
  ids; for lane-plan the eleven-term map, missing terms named); `selfCheck` (`COV` line, scan exit code, the 138 count, lines naming your files, other counts, Scan A); `openIssues` (needed evidence,
  suspected cross-batch duplicates of a kind); `friction` (work, evidence, prevention; redacted); `stops` (or `[]`).
# Part B — consolidation pass
Batches are denoted in separate contexts, so one referent kind can arrive under several prefixes (the admission chains are the likely case) or with conflicting statuses, and later seats analyse a
kind once. The orchestrator launches this pass only when its cross-batch check finds a kind under more than one prefix, a status disagreement, or a prefix at per-individual grain (under v15 the
run-3 109-record correction is a defect to repair, not a planned pass: `DK:1013-1015`; call w makes the pass conditional). "Role and independence", A4 to A6, A8 and A9 apply unless changed here.
## B1. Launch variables, input, exclusions
- `LANE`, `INPUT MANIFEST`: as A1; the manifest lists the source hypothesis files, the records in `BATCH`, and A2 items 1 and 2. `OUT`: your OUTPUT PREFIX, this pass's `PREFIX`, fresh and different from every
  source prefix (Ruling 13). `SOURCES`: the two or more SOURCE PREFIXES you consolidate. `BATCH`: always the observation list `WORK/denotation-batches/batch-<OUT>.txt`, written by the orchestrator: the union
  of the source batches, and the `OUT` batch for every later stage (Ruling 11, S:142). `REPAIR`: as A1, over `dh-<OUT>-` files.
- Read every `WORK/hypotheses/dh-<SOURCE>-*.yaml` of each source prefix. A source hypothesis is another context's interpretation: it tells you which ids and quotes to check and is never evidence.
  Every observation id a source cites is in scope and must be in `BATCH`; a mismatch is a Stop.
- Open the cited records wherever you state a discriminator; never copy a source discriminator without opening its record. A3 applies, except that the source prefixes are input.
## B2. Output and rules
Records `WORK/hypotheses/dh-<OUT>-<kind-slug>-<nnn>.yaml`, `id: "dh:<OUT>-<kind-slug>:<nnn>"`, one per referent kind (or information-artifact kind, or implementation-only construct) across the
sources; expect no more records than the sources hold distinct kinds.
1. **Totality and grain.** The union of your `observation_refs` equals the union of the sources' `observation_refs`, id for id. A5.1 holds: each description says which events or members bound an
   instance; keep apart what a source kept apart for a stated reason; merge records of one kind, never kinds that share fields.
2. **Rivalry carried, not erased.** Where sources disagree on `representation_status` or on the null for one kind, decide from the records, put the other reading in `alternatives` as `viable` and
   say what would discriminate. Where the disagreement is two referent kinds, keep two hypotheses (A5.4).
3. **Warrants and queue duties.** A5.5 and A7 apply to the merged kinds: Queue G stays at kind grain, and the lane-plan map still names eleven terms.
4. **Sources stay.** Create files only under `OUT`; edit and delete nothing. The orchestrator retires the source records after an exact coverage check; until then the scan sees both sets, which is
   not a violation.
## B3. Self-check and Return
- `COV "$B" $ONT/work/hypotheses/dh-<OUT>-*.yaml` must print `uncited 0 foreign 0`, and `COV "$B" $ONT/work/hypotheses/dh-<SOURCE>-*.yaml` must print `foreign 0` for each source prefix. Plain scan
  and Scan A as A8: 138 expected lines, none naming a `dh-<OUT>-` file.
- Return as A9 with `pass: consolidation`, `out`, `sources`, the count of source hypotheses read and observations in the union, and per kind the source hypothesis ids it supersedes; plus
  `disagreements` (each kind where sources differed and how the records decided it) and `superseded` (every source record, or those you could not supersede, with the referent your records lack).
