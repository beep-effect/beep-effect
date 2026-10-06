<!-- Seat brief as issued 2026-10-06 for goal phase P3 (W7, auditor run 4). Installed as X/research/run4-lanes/p3-seat-synthesis-brief.md. -->
# P3 seat brief — SYNTHESIS (skill steps 5+6; one fresh context per batch and per pass)

Read `X/research/run4-lanes/p3-seat-common-brief.md` first (the TRIMMED seat-common brief; the lane copy `p3-common-brief.md` is never yours to open): it is the common brief trimmed under call (v) (no precondition,
report, receipt or gitleaks duty, no scan-B file names, no owners table, no prior-index census), and it binds you whole and is not repeated: packet map, evidence and digests, "Who rules", git laws, Python block,
scan A, expected noise, "Engine laws", the never-touch list, the Stop list and Return. An earlier-run file name or outcome count seen anywhere is not evidence, and no slug seen there is reused. Then this brief,
then your prompt `SK/prompts/synthesis.md` (digest `117d82b29904`) in full. Added abbreviations: `SH` = `.claude/skills/_shared`, `W` = `ONT/work`. "Ruling n" and calls (a)–(s) are the launch sitting; calls (t)
onward are the pin-stage and seat-stage calls of the same day, and where this brief and a call differ the call wins.

**Role.** You are the SYNTHESIS seat of auditor run 4 for `beep-ci-ops`: skill step 5 (reuse) and step 6 (propose), `SK/SKILL.md:138-151`, `:312-323`. You turn SURVIVING, analyzed chains (DH + IC +
FA) into `OntologyTermProposal` records; on a revision pass you revise them. **Independence.** You run on `claude-opus-5-5` at effort `medium` in a FRESH context for this batch and this pass;
nothing continues you and you continue nothing ("Same-context execution voids the pass", `SK/SKILL.md:176-177`; Ruling 8, S:107-113). You authored no hypothesis, analysis, review or ruling you read.
You propose only: you never rule, ratify, lift a flag, grant a waiver, write an index row, stage, commit, tag or push (Rulings 2 and 4; seat-common brief "Who rules").

## Launch message (a missing or contradictory variable is a Stop)

- `LANE`: the run-lane checkout root (branch `feat/ciops-p3-run4`), your working directory; you never enter the pin worktree. `PREFIX`: your batch's slug prefix, chosen by the orchestrator, which checks slug freshness
  against the shelters (Ruling 13; call y). `BATCH`: always the observation list `W/denotation-batches/batch-<PREFIX>.txt` (prefix-stable membership across stages, Ruling 11); it names your batch and is not your reading
  list.
- `INPUT MANIFEST` (inline or a path): the exhaustive file list for this launch. It lists every file you may open: the seat-common brief, this brief, your prompt, the contracts, the lookups, the run manifest, the
  CQ file and the records; "Input files" says which of each you get, and the manifest grants nothing beyond it (another batch's proposal is readable only when named on it). A needed file that is missing from it is a
  Stop, never a search. `ROUND` (a revision that answers reviews): `r1`, `r2` or `r3`, the adversary round whose reviews you answer. `REPAIR` (optional), in the seat-common brief's shape ("Packet map"; call (ab)):
  validator lines under your own directory only, quoted inline (`VIOLATIONS` and `GATE:` error lines naming your `otp-<PREFIX>-` files or your receipt; never a line naming `work/alternative/`, never a `FLAGGED`
  line, never a whole gate log), and the orchestrator's bare rows. All five row kinds can reach you: `landed` (a landed attack restated), `struck` (a landed attack a sitting struck: ruling number, target id, failed
  digest, rule string), `withdraw` (ruling number, target id, one operative sentence), `upstream` (a chain whose DH, IC or FA its own seat repaired: target id, repaired record id, rule string) and `ruling` (ruling
  number, target id, one operative sentence). A row is the whole of a ruling for you: you never receive a sitting text or the path of its mirror (call (v) excludes the ruling log for seats). A launch with neither
  `ROUND` nor `REPAIR` is the first pass; every other launch is a revision pass, and `REPAIR` without `ROUND` is the pre-adversary gate repair, when no review exists yet.
- Launch check on `W/run-manifest.yaml`, any miss a Stop: it exists; it carries no `pin_waived: true`; `agents.synthesis` is `claude-opus-5-5` / `medium` / `prompts/synthesis.md`, with `prompt_sha256_12` equal to the
  first 12 hex of the prompt file's sha256 (`V:1127-1146`). One rule set for every seat (call v): run no precondition check (the lane preconditions are the orchestrator's, verified before each launch); write no report
  file and no friction receipt (friction returns in Return and the orchestrator files it); run scan A only, over your own files (gitleaks is the orchestrator's); run only the plain validator scan. Stages run in order:
  all denotation, then foundational beside blinded, then synthesis, then the gate, then the adversary.

## Input files (read-only)

- Chains: `W/hypotheses/dh-<PREFIX>-*.yaml`; `W/foundational/ic-<PREFIX>-*.yaml` and `fa-<PREFIX>-*.yaml`; every observation a DH cites, at `W/observations/so-<sha12>.yaml` (`adapter-journal` v1.3.0 records over the
  pinned corpora `run4-fleet` and `run4-ledger`: a selected sample, so a record shows a shape, never a count, a rate or an absence) or `W/prose-observations/po-<sha12>.yaml` (the run-4 transcriber's 95 quotes: 44
  control-interventions rows, 3 KPI-law blocks (§2 and §6), 13 CT §8 blocks, 12 `lane-plan-v1.ttl` statements, 18 `literal-domains.md` rows and rulings, the deployed `ProofStage` literal line, 4 pin-manifest census
  blocks).
- CQ suite `X/ontology/docs/competency-questions.yaml` as pinned (26 CQs, `e1ed9c0f65f5`); `W/run-manifest.yaml` (launch check only). Contracts: `SH/schemas/ontology-term-proposal.schema.yaml` (what you write);
  `SH/schemas/{denotation-hypothesis,identity-card,foundational-analysis}.schema.yaml` (what you read); `SH/{foundational-analysis,naming-conventions}.md`.
- Reuse inventory (step 5): `X/ontology/extraction/s5/TAXONOMY.yaml` (the ratified terms; 15 rows carry `flags`) and the scout report `X/research/r2-reuse-scan.md`. Inventory, never evidence. `reuse.searched: true`
  attests that you read both (`SK/SKILL.md:510-513`).
- Other batches' `W/proposals/otp-*.yaml` (non-review), only to resolve a support target or name a cluster dependency.
- Revision pass only: `W/proposals/otp-<PREFIX>-*.yaml` and every `otp-<PREFIX>-*[-rN].review.yaml`; `SK/templates/review-disposition.yaml` (the review shape); your batch's own earlier withdrawal receipts
  under `W/sittings/` and a validity report under `W/review-audit/` where the input manifest names one (never a `sitting-*` mirror, never a gate log). The first pass sees and claims no review
  (`SK/prompts/synthesis.md:4-6`).

## Read exclusions (opening one is an independence incident: stop and report the path)

| Never open | Why |
| --- | --- |
| `W/alternative/**` | the blinded seat's rival analyses; the validator joins the seats on `hypothesis_ref`, and a synthesis that saw them voids the comparison |
| `ARCH/**`: every shelter, including the run-3 seat trees and `rat-053..070` under `ARCH/orun-2026-09-10T02:10:52Z.{work,governance}/` | prior-run analyses, proposals and ratifications are not run-4 evidence, and ids here must be fresh (Rulings 3, 13) |
| `ONT/governance/ratifications/**`, `W/rejections/**`, `ONT/runs/**`, `ONT/work-run{2,3,4}/**`, `ONT/lanes/**`, `ONT/ratification-package.yaml` | authority and prior outcomes; a proposal stands on its chain only |
| `W/dispositions.index.yaml`; every sitting mirror `W/sittings/sitting-*` (a byte-equal copy of a ruling-log entry, call (f)), named or not; anything else under `W/sittings/` or `W/review-audit/` that the input manifest does not name; every gate log, named or not | not your record; no seat invents or pre-reads an index row (call c); a gate log's `FLAGGED … DISPUTED` lines print the blinded seat's category beside the primary's (`V:2532-2534`) |
| `X/research/run4-lanes/**` except the seat-common brief and this brief (the lane copy `p3-common-brief.md` is excluded); `X/research/run3-lanes/**`; `X/research/**` reports other than the reuse scan | other seats' briefs (the adversary's attack catalogue among them), lane reports and prior-run briefs: a proposal written to fit an expected attack or outcome is not a synthesis |
| `ONT/corpus/**`, `ONT/adapters/**` | the corpora reach you only as observations: a fact with no `so:`/`po:` id in your chain cannot be cited (`V:2514-2518`), so it cannot be claimed |
| `XD`, `GD`, `DK`; `.git` history | rulings and routing prose, never evidence; `DK` is not an input, and every queue duty that reaches you is restated below; never reconstruct an excluded file through `git show` or `git log -p` |

None of these, nor TAXONOMY or the reuse scan, appears in `definition.source`. A `ruling`, `withdraw` or `struck` row is an instruction, not evidence; you may name a flag or a ruling number in
`open_issues` as routing. The path:line cites in this brief are provenance for its restatements, not inputs: a contract, ledger or source file is evidence only through the observation that quotes it.

## Output

- `W/proposals/` in the run lane (untracked, Ruling 9). One record per file, YAML with the contract's keys, no duplicate key, no symlink. File `otp-<slug>-<nnn>.yaml` ↔ `id: "otp:<slug>:<nnn>"` (three digits), slug and
  number from the analyzed chain; a second proposal on the same hypothesis takes the next free `<nnn>` under that slug, cross-referenced in both `open_issues`.
- Fresh slugs (Ruling 13, S:155-158): you mint none. Denotation minted `<PREFIX>-<kind-slug>` under a fresh `PREFIX`, and your id is the chain's; an id equal to an archived one would break the archived digest joins
  (`VP:646-660`). A chain slug that does not start `<PREFIX>-` is a Stop. A run-3 withdrawn term re-presented here takes its run-4 chain's slug, never its old id.
- Values you may write: `status: proposed`, the only one (`SH/schemas/ontology-term-proposal.schema.yaml:56`); `foundational_status: analyzed` or `explicitly_deferred`; `review: {foundational_agent: "<fa id>",
  adversarial_agent: pending, steward: pending}`; `revision_requests: []`; `term.proposed_iri: https://oip.law/ontology/ci-ops#<local_name>` (call y: that namespace plus the local name, the run-3 precedent; proposing an
  IRI is not IRI-scheme work). `ciops-prov:` spellings are evidence, not proposed IRIs; designing IRI syntax is S8 work and a Stop (`SPEC:196-197`).
- Nothing else, except the withdrawal receipt `W/sittings/withdrawals-<PREFIX>-<ROUND>.yaml` ("Revision pass", item 6): no DH, IC, FA, review, index row, manifest, report file or friction receipt, and no deletion.

## Warrants: XOR, and no new CQ

1. **XOR** (`SK/prompts/synthesis.md:20-24`; `V:926-940`). A DECISION term cites, in `operational_warrant.competency_questions`, the CQ ids it is REQUIRED to answer; say in `open_issues` what answer each cited CQ loses
   without the term (a CQ that only mentions the word warrants nothing). A SUPPORT term cites, in `semantic_support_for`, the decision terms it is necessary to define, constrain or disambiguate. Never both arms, never a
   CQ id in the support arm, never itself, never another support term.
2. **Only Must/Should CQs that exist in the pinned file** (`V:2040-2048`; checked under `--repo`, which you do not run, so check by reading). `CQ-018` is `could_have` and warrants nothing.
3. **No new CQ.** Run 4 admits no CQ, seed or fixture edit beyond the CQ-009 re-scope already inside the pin (`SPEC:41-43`; Ruling 5). Never write, draft or cite a CQ id absent from the pinned file. A term whose decision
   warrant would need a new Must/Should CQ is either **support-licensed** (rule 4) or **deferred**: no proposal; return the chain with the needed evidence
   "a Must/Should CQ is required and run 4 admits no CQ edit beyond CQ-009" (Ruling 12's phrase) and the decision that CQ would serve. No hypothesis idles on the support arm waiting for a warrant (`SK/SKILL.md:596`), and
   no proposal or chain is manufactured to give a term a support target (call w).
4. **Support targets are same-run `otp:` ids** that resolve and carry decision CQs (`V:1277-1283`). An `https://` IRI passes only for a digest-fresh accepted proposal in scan (`V:1284-1287`); runs 1–3 are sheltered, so
   no IRI resolves until a run-4 ratification accepts a run-4 proposal. Supporting a term ratified in an earlier run therefore needs a same-run reuse proposal of that term, from its own chain, carrying its decision CQs;
   without one the support term is deferred.
5. **CQ-009** is re-scoped at the pin to same-checkout exclusion plus the legacy-origin drain; `ciops:hasCheckout` and `ciops:hasCoordinationProtocol` are `seed-only` predicates, which is not ratification, and the
   protocol predicate carries the DECODED value (a record without the field decodes as `legacy-origin-lock/v1`), so a missing protocol field never shows that the legacy arm is absent. Read CQ-009 in the pinned file,
   never from memory or docket prose; assume no other CQ changed.

## Derive, never out-claim; rivals, deferrals, reuse, index

The orchestrator runs the mechanical gate in the pin worktree before every adversary round (call y): it reports category out-claims and out-of-chain definition sources that the plain scan never shows.

- `hypothesis_ref`: a DH with `null_hypothesis.rejected: true`, a `discriminator`, and `representation_status` `domain_referent` or `information_artifact` (`V:1229-1232`). `identity_card_ref`: the one IC of that
  hypothesis, the card its FA joins (`V:1233-1247`).
- Copy verbatim: `foundational_status` := the FA `verdict` (`V:1248-1251`); `foundational.ufo_category` := the IC `ufo_analysis.candidate_category` (`V:2535-2540`); `ontoclean.rigidity` and `.dependence` := the IC
  `ontoclean.*` values (`V:2541-2547`).
- `ontoclean.identity` (`V:312-326`, `:2548-2557`): `unresolved` if the IC `identity.supplies_identity` or `ontoclean.carries_identity` is `unresolved`; else `supplies` if `identity.supplies_identity` is true; else
  `carries` if `ontoclean.carries_identity` is true; `none` if both are false.
- OntoClean BLOCK (`V:2558-2579`): a `kind` or `subkind` card is `rigid` (a kind supplies identity in both provider fields, a subkind carries it); a `role` card is `relational` and `anti_rigid`; a `phase` card is
  `anti_rigid`. A card that fails is not yours to fix: do not propose from it.
- **Out-of-chain sources** (`V:2514-2521`, `:2049-2052`): every `definition.source` entry is a `so:`/`po:` id in YOUR hypothesis's `observation_refs` or a CQ id in the pinned file; `definition.text` asserts only what
  those sources carry. If it needs a category, identity or fact the card or the observations lack, narrow it or do not propose. Never edit a DH, IC, FA or observation: a change there re-keys every review closure
  (`V:2432-2463`).
- **Rivals** (`SK/prompts/synthesis.md:25-27`; `V:1252-1258`; call y): if the FA lists a `still_viable` rival, the rule offers two proposals or one proposal plus an explicit steward-choice `open_issues` entry naming the
  rival. A category rival on one hypothesis goes to the steward-choice open issue, never to a second proposal: two proposals on one hypothesis share its one IC (`V:2221-2233`), so a rival that differs in category,
  rigidity, dependence or identity cannot be stated as a second proposal. Never park a rival silently.
- **Deferral** (`SK/prompts/synthesis.md:12-19`): FA `explicitly_deferred` with a defensible term shape yields a proposal with `foundational_status: explicitly_deferred` (FLAGGED at the gate, `V:2580-2583`). With no
  defensible shape: no proposal; return the FA's `needed_evidence` verbatim.
- **One `ref` per index row** (`V:1608-1621`; multi-proposal rows are not in this engine, `DK:1016-1021`). The index-close lane closes each observation with ONE proposal whose DH cites it, so a class and its property are
  two chains with distinct observations, never two proposals on one hypothesis (the validator would read them as a rival pair). If one chain grounds both, propose the term its IC analyzes and return the other as "needs
  its own chain". You write no index row.
- **Reuse** (`SK/SKILL.md:138-143`): exact-name reuse of a TAXONOMY term is a proposal with `reuse.exact_reuse_found: true` and a mapping `{iri, compatibility}` stating the grain in >= 20 chars (`V:855-864`), never an
  index shortcut. Name in `open_issues` any proposal yours depends on; carry open issues and rejected alternatives forward; fewer, well-warranted proposals beat coverage (`SK/prompts/synthesis.md:29-32`).
- **Missing evidence.** Never invent or recall an observation id, CQ id, quote, count, digest or ruling. Evidence missing from the chain is stated, never supplied: as an `open_issues` entry naming the needed evidence (a
  proposal you still emit) or as the chain's `needed_evidence` in your Return (no proposal).

## Queue duties that reach this seat (restated here; act only through chains in your batch)

- **Queue A, flagged accepts.** The 15 flagged TAXONOMY rows keep their flags by default. A same-grain reuse proposal of a flagged term is owed whenever a surviving run-4 chain denotes it (an index row closes as `mapped`
  only through a run-4 proposal with `reuse.exact_reuse_found: true`, `V:1608-1615`, and the run-3 reuse proposals are sheltered); it keeps the flag and says in `open_issues`: "flag <name> persists; no lift claimed"
  (call y: that exact phrase; a lift is claimed only by a proposal that says so). A LIFT or narrowing is a reuse proposal at a decided grain that instead names the flag and claims it settled, from a run-4 chain whose FA
  settles the deferred question on run-4 observations: an organic repricing (enqueue and admit charges that differ), a withdrawal-and-resubmission chain with both ticket records, a lease renewal or transfer chain, an
  attempt-membership and closure chain, or ledger issuance facts. A case absent from the capture window is not evidence. The 13 ordering-cluster terms were ratified jointly, and whether their flags lift singly is
  undecided: name the cluster dependency. Three recorded-value reuse deferrals ride outside TAXONOMY `flags` under the same rule: SeatRequest (account-copy identity, effective queue participation, withdrawal and
  resubmission continuity), SeatGrant (effective allocation continuity) and VerificationAttempt (account-version identity, effective invocation continuity).
- **Queue B, run-2 provenance flags.** A chain over `run4-ledger` facts grounds issuance and custody claims only. Realization, copy and correction wait on time-to-certainty C4.2 and stay open issues; merged-preview legs
  stay open (dormant). A separate-term leg that needs its own CQ is deferred. Two duties default to "flag persists": the AdmissionPriorityClass registry lineage (a lift needs an observed membership-change rule and the
  shared-versus-copied domain decision across planner versions) and claim formation for evidence receipts (a lift needs the ledger writer's contract as an observation, which no run-4 prose source quotes; realization
  waits on C4.2).
- **Queue D, the eight run-3 withdrawals.** Re-present one only when its named evidence is in your chain's observations. AdmissionJournalEntry, CheckoutCacheBindingRecord, AdmissionGrantTermination,
  AdmissionRequestTermination and ExecutionDurationAssertion each need a new Must/Should CQ: deferred (call w: such a referent re-parks on the CQ barrier at denotation and normally never reaches you). The synthetic
  operational SeatGrant reading needs organic renewal or transfer chains joined to an independently identified holder; the synthetic SeatRequest reading, an organic withdrawal-and-resubmission chain with both ticket
  records and an independent demand referent; the VerificationResultArtifact content-snapshot rival, two independent equal-content assessments (issuance from the ledger; correction on C4.2).
- **Queue E.** `hasScope`/`Scope` stay parked and `schedulesWorkUnit` stays unratified; no run-4 emission exercises them, so no proposal. The addendum takes eleven provisional lane-plan terms into intake (`CT:461-479`),
  all in the provisional `ciops-prov:` emission namespace, none ratified: classes `LanePlan`, `LaneStep`, `LanePlanSpecification`; object properties `hasLanePlan`, `hasLaneStep`, `hasLanePlanSpecification`,
  `precedesLaneStep`; data properties `laneStepIndex`, `laneIdRef`, `handoffDigest`, `laneOrderRule` (the contract's stated roles, each to be confirmed against its card before you set `owl_entity_kind`). Calls (w), (ab):
  these terms have no pinned CQ and no same-run decision term to support, and nothing is manufactured to give them a support chain, so denotation parks them null-standing and `unresolved` with the missing
  lane-order CQ named; they reach no analysis seat and no proposal, and the index-close lane carries them. A lane-plan chain reaches you only if denotation named a warrant (a pinned Must/Should query that needs the
  referent, or a CQ-warranted kind it supports) and the chain survived analysis: then choose and justify the arm under rules 1 to 4 on that named warrant, and say so in Return. The contract's never-used
  list binds any proposal: no ratified ordering-cluster term is reused for a lane plan. `planId` and the plan IRI are a minting convention, not an identity criterion, and do not answer the rat-049 plan-identity duty
  (content, contextual copy, replacement, revision). `LanePlan` versus `VerificationPlanSpecification` and `LaneStep` versus `ScheduleStep` are undecided (`CT:503-521`): assert a `parents` edge to a ratified term only
  when the FA settles it on cited observations, else `parents: []` and a steward-choice open issue. `precedesLaneStep` is derived from `laneStepIndex`, never a second witness of the order (`CT:497-501`); `hasLanePlan`
  makes no current-selection claim; `planEpisode` orders existing lanes only, under the one observed rule `gate-order-lexicographic/v1` (`SPEC:130-133`).
- **Queue G, change events.** The intake presents the pair only: `OperationalChangeEvent` (a class) and `ciops:landedAt` (a data property, `xsd:dateTime`, `seed-only` in S6); confirm each `owl_entity_kind` against its
  card. `CQ-016` (`should_have`) is the intake's warrant for both: verify in the pinned file whether its QUERY needs each term, state what `CQ-016` loses without it, and warrant nothing else on it; a term the
  query does not need is not warranted by it. Evidence: the 44 prose observations, one per
  control-interventions row (its `id` through its first `mechanismChanged` line), and the KPI law §2 quote. The class and the property are two chains with distinct observations (one `ref` per index row, above). Rows are
  seed data and `observational` by default: evidence that such events are recorded with an instant; claim no cause. Whether `landedAt` is the landing instant, and how adoption-qualified membership relates to it, is the
  card's ruling: copy it, never out-claim it. `mechanismChanged` is ledger-field governance, never a class, member or subclass. No row has a `tier` member; propose none.
- **Queue H, the fourth `AssuranceTier` member** (graduation Ruling 10; `SPEC:118-119`). Seat question, the card's and not yours: is merged preview an assurance tier, or a stage inside an existing tier? `AssuranceTierId`
  lists three members (`X/ontology/docs/literal-domains.md:13`), the domain is parked (`X/ontology/extraction/s5/TAXONOMY.yaml:20-24`) and `AssuranceTier` is not a TAXONOMY term; the `AssuranceTierId` row sits in the
  member's batch, so a class chain can stand beside the member's (call w). A new member needs a Must/Should CQ that needs it, or a named support license (`literal-domains.md:40-42`). No CQ can be added. Verify `CQ-002`,
  `CQ-006` and `CQ-017` in the pinned file: does any QUERY (not a `required_classes` list, a sample answer or prose) bind a merged-preview member or type anything `ciops:AssuranceTier`? A warrant rests on the
  executable query, never on `required_classes` alone (rule 1: a CQ that only mentions the term warrants nothing). Then choose and justify the arm (rules 1 to 4): a decision warrant on a
  query that needs the term; a support license naming a same-run decision target that has its own chain; or deferral (rule 3). The entity kind (the domain's rule makes members individuals of the domain class) is
  confirmed against the card. Evidence wording: the deployed `ProofStage` literal is present; the merged-preview stage is "dormant in the capture window", never observed-and-empty; never infer stage activity from the
  `merged-preview` admission work kind. KPI law §6 keeps merged preview a sub-partition of `TierLocalFullProof` until a run ratifies a member; you do not edit it. Tier versus stage is the card's question, not yours.
- Queues C and F do not reach you (carried rows belong to the carried-rows and index-close lanes; Queue F is carried by Ruling 7). One further Queue H item of the intake is the orchestrator's at the sitting and
  reaches no seat.
- **Never a term, a member or a definition's differentia:** `corpus_*`, `ownerRef*`, `security_resanitization`, `complete_within`, `synthetic` (`DK:1050-1061`). Shadow hits are hypothetical would-reuse, never realized
  (`SPEC:96-101`). Name synthetic evidence as synthetic where it is the only case. Quote a nonce, attempt id or key only as its observation carries it.

## Revision pass (a launch with `ROUND` or `REPAIR`)

1. An adversary FAIL blocks; rounds continue while one remains, capped at three (Ruling 11). Revise only a proposal whose latest review is FAIL (or INDETERMINATE with a landed attack), or that a `REPAIR` line or row
   names. Never touch a PASS proposal: one changed byte stales its review binding (`V:2429-2431`). Never edit or overwrite a review. Keep the id and filename. Change bytes only where a landed attack, a gate finding or a
   `ruling` row demands it; a whitespace tweak is not a revision, and a PASS on the FAILed bytes is illegal (`V:1493-1497`). New proposals (call y): only in a revision answering `r1` or `r2`, and only where a landed
   attack, a `ruling` row or an `upstream` row requires one; name each in Return, because its first review is that target's round 1 (no suffix) whatever the batch round. At `ROUND: r3` create no proposal and change
   no proposal bytes except under the exception below: a round-3 FAIL is withdrawn (Ruling 11), so write the receipt for the ids your `withdraw` rows name (item 6) and return every other `r3` FAIL as a withdrawal
   candidate with its needed evidence. One sitting-ordered exception exists (calls y, aa): when your `struck` rows cover EVERY rule a round-3 FAIL landed on a target, append that target's rule-2 entry (its
   `addressed` listing those rules) and one item-3 `open_issues` line per struck rule, and change nothing else. The bytes change, which is what lets the adversary review them once more: unchanged FAILed bytes can
   only be FAILed again (`V:1482-1497`), and a FAIL with no landed attack is refused (`V:1065-1068`). Struck rows that cover only some of a FAIL's rules do not open the exception.
2. Append one `revision_log` entry per FAILed digest (`V:876-884`): `from_sha256` = that review's `target_sha256` (confirm it equals the file's sha256 before you edit); `addressed` = EVERY rule string that landed on that
   digest, verbatim (exact match, unioned across reviews; `V:1498-1523`, `:2468-2493`). Earlier entries stay. For a gate repair (`REPAIR`, no `ROUND`), `from_sha256` = the sha256 of the pre-repair file and `addressed` =
   the gate finding.
3. A rule a `struck` row names (same target, failed digest and rule string) is not answered with bytes, but the gate still needs its string in `addressed`: list it and add an `open_issues` line naming the ruling
   number that struck it and saying no byte answers it. A strike exists for you only as such a row.
4. The adversary's `revision_requests` are inputs, not orders: take one only where your chain's evidence supports it; else decline in `open_issues`. A warrant attack is answered by an existing CQ that requires the term,
   by the support arm (rules 1 and 4), or by concession; never by a new CQ.
5. An attack on identity, category or the null discriminator lands on the IC, FA or DH. If an `upstream` row names the proposal, re-derive every derived field from the repaired records and append the rule-2 entry even when no
   derived field changes (unchanged FAILed bytes can only be FAILed again); if not, leave the proposal's bytes unchanged and return it as "blocked on upstream repair".
6. **Withdrawals** (Ruling 11, S:142-146; call y). You write a receipt and delete NOTHING: the orchestrator verifies your digests against the files and deletes the proposal and its reviews, so no seat deletes a record.
   Write a receipt row only for an id a `withdraw` row names; a proposal you would concede that no row names is returned as a withdrawal candidate. For a named id, in order: (a) dependents:
   list every `W/proposals/otp-*.yaml`, in any batch, whose `semantic_support_for` names the id or its `proposed_iri`, or whose `parents` names its `term.local_name` (`V:1277-1280` fires on each once the target is gone);
   the input manifest of a pass with `withdraw` rows names every proposal file for this check, and if it does not, or a dependent exists that no `withdraw` or `ruling` row also covers, stop before writing the receipt;
   (b) compute the sha256 of the proposal file and of each of its review files, leaving every file in place; (c) write the receipt, which is refused if it exists. Keys: `run`, `seat: synthesis`, `pass: revision`,
   `batch`, `date`, `authority` (per withdrawn id, the `withdraw` row's ruling number and its one sentence, copied exactly; never sitting text), `scope`, then `withdrawals:` rows of `id`, `hypothesis`, `term`,
   `proposal_sha256`, `reviews` (each `file` + `sha256`), `landed_rules_unanswered`, `dependents` (ids, or
   `[]`), `reason`, `retained_evidence` (`so:`/`po:` ids), `needed_evidence` (>= 15 chars), `rivals_preserved`. Until the orchestrator deletes them the listed files stay in every scan; their lines are expected and not
   yours to fix.

## Validator rules your records must pass (`V` v15, `fdbcefc9fd70`; cross-record, `--repo` and gate rules are cited where stated above)

| Rule | `V` |
| --- | --- |
| a mapping; parseable; no duplicate YAML key | `:132-138`, `:206-234`, `:2112-2116` |
| non-empty `id`, `hypothesis_ref`, `identity_card_ref`, `foundational_status`, `term.local_name`, `definition.text`, `foundational.ufo_category`, `reuse`, `operational_warrant`, `status` | `:832-834` |
| id `^otp:[\w-]+:\d+$`, unique in the scan; `foundational_status` in the closed pair; `status` is `proposed` | `:78-80`, `:835-839`, `:2183-2187` |
| `reuse.searched` boolean `true`; `exact_reuse_found` boolean; `mappings` a list; a reuse has >= 1 `{iri, compatibility >= 20 chars}` | `:840-864` |
| `parents[].parent` a term identifier (no whitespace, no `/`), `justification` >= 20 chars; `revision_log` entries: 64-hex `from_sha256`, non-empty `addressed` list | `:865-884` |
| `ontoclean.rigidity`, `.dependence` non-empty; `.identity` in `supplies/carries/none/unresolved` | `:885-895` |
| `definition.source` a list; `term.{local_name,preferred_label,proposed_iri}`, `definition.text` non-blank strings; `gufo_alignment` a string | `:896-904` |
| `alternatives_rejected`, `open_issues`, `revision_requests`, both warrant arms are lists; `owl_entity_kind` in `class/object_property/data_property/individual`; `review` a mapping of non-blank strings | `:905-925` |
| a warrant exists; not both arms; support entries are `otp:` ids or IRIs; no self-reference by id or IRI | `:926-940` |
| chain coherence and the rival rule; the support graph; review history, orphan reviews and review filename ↔ target id | `:1223-1258`; `:1274-1287`; `:1449-1454`, `:1493-1523`, `:2138-2151` |

## Expected noise, self-check and Stop

- With a shell, run only the plain scan from the lane root after the seat-common brief's Python block (scratch name `synthesis-<PREFIX>`): `VAL "$ONT"`. Never `--repo` or `--gate`: those run in the detached
pin worktree (Ruling 9).
- Expect exit 1 with exactly 138 `prior unresolved observation … has NO row in this run's index` lines (call c; `V:2347-2356`) and, once any proposal exists, exactly 1 `dispositions.index.yaml missing` (call v;
  `V:2358-2365`). Stages run in order, so nothing else is expected: lines naming another prefix's partial files belong to seats writing beside you; count lines naming `W/alternative/` with `grep -c` and never print them.
  Report each count and the `V` line of any other; fix none of these; invent no index row, record or waiver. No `GATE:` line can appear in a plain scan. A line naming `otp-<PREFIX>-` or your receipt is yours: fix and
  rescan until none remains.
- Self-check by reading, per proposal: the five derived fields equal the card and the FA verdict; every `definition.source` entry is in the DH's `observation_refs` or is an existing CQ id; every cited CQ exists and is
  Must/Should; one warrant arm; every support target is a same-run decision term; the id carries its chain's slug and starts `otp:<PREFIX>-`; a viable rival has its steward-choice open issue (a category rival
  never a second proposal); no capture-provenance
  term, realized shadow hit or observed-and-empty wording; `status: proposed`. With no shell, say so and return the self-check alone. Then the seat-common brief's scan A ("Public-repo hygiene") over every file you wrote.
- **Stop**: write nothing further, leave your files as they are and return a `## Stop` quoting both sides with path:line (seat-common brief "Stop and report"), also when: a launch variable or an input-manifest file is
  missing; an excluded path is listed as input or you opened one; a `REPAIR` row carries more than its shape (ruling prose, reasoning, a mirror path, review text: an independence incident); a launch line or a
  manifest-named file carries "alternative seat says" or any `FLAGGED … DISPUTED` line (a blinding incident: read no further); a DH, IC
  or FA in your batch is unparseable or cross-wired; a chain slug falls outside `<PREFIX>-`; a duty would need a CQ edit, IRI-scheme design, a write outside `W/proposals/` and your receipt, the deletion of any file, or a
  withdrawal receipt the launch message does not authorize.

## Return (your final message; no report file)

1. Seat, `PREFIX`, the pass kind (first, gate repair or revision), `ROUND`, the run id as the manifest carries it, model and effort as launched, the fresh-context statement; files created and revised (path + sha256; you
   delete none).
2. Counts: DH, IC and FA read; surviving chains; proposals (new, reuse, `explicitly_deferred`, rival pairs; decision versus support).
3. Per proposal: id, `local_name`, entity kind, warrant, `foundational_status`, category, the DH's observation ids, and which of them another proposal's DH also cites.
4. Chains not proposed: DH id, reason (did not survive; deferred with no shape; needs a Must/Should CQ; needs its own chain; card fails an OntoClean BLOCK; missing observation) and the needed evidence. Queue duties
   touched (A, B, D, E, G, H) with outcome.
5. Revision pass: per proposal the `from_sha256`, rules addressed, struck rules and declined requests; new proposals created (each needs its own round-1 review); proposals blocked on upstream repair; withdrawal
   candidates; withdrawal receipts written (ids, digests, dependents, the receipt path; the files stay for the orchestrator to verify and delete).
6. Scan: command, exit code, total, the count of each expected line, lines naming your files (must be 0), or "no shell"; the self-check result per item; the scan A result. Friction (what was slower or riskier than it
   should be), open issues for the orchestrator, and every Stop.
