# P4 survey — KPI reading and verdict (W8–W9), goals/ciops-ontology-pipeline

Read-only survey for the P4 launch sitting. Checkout HEAD `d64a3ba67f` (P3 close). Every fact
carries a `path:line` cite, repo-relative. Figures marked **survey census** were computed by
this lane over pinned bytes to size decisions; they are not KPI readings, and no W8 output may
quote them as one.

Abbreviations: **KPI law** =
`explorations/beep-ci-operational-ontology/research/kpi-measurement-rules.md`; **CT** =
`explorations/beep-ci-operational-ontology/ontology/docs/s7-projection-contract.md`; **GD** =
`goals/ciops-ontology-pipeline/research/decisions.md`; **XD** =
`explorations/beep-ci-operational-ontology/DECISIONS.md`; **CI-ledger** =
`explorations/beep-ci-operational-ontology/research/control-interventions.yaml`; **FLEET** =
`explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/run4-fleet/`;
**LEDGER** = the sibling `run4-ledger/`; **EC** =
`goals/time-to-certainty/research/economics-close.json`; **TTC-D** =
`goals/time-to-certainty/research/decisions.md`.

---

## 0. Headline findings (read these first)

1. **The S7 contract excludes the KPI ETL from the lab today**: "No KPI ETL (separate incubation
   lane per the incubation-home decision)" (CT:273). PLAN W8 allows the module in
   `apps/labs/ciops` only "once S7 §6 is amended by ruling" (goals/ciops-ontology-pipeline/PLAN.md:128-129;
   explorations/beep-ci-operational-ontology/MAP.md:79). An amendment is therefore the first
   deliverable of W8, the same way the seam amendment opened W6 (GD:376-382).
2. **KPI law v1.1 carries two errors against the M1 it maps to.** (a) It says M1 "keys per branch,
   not per (checkout, branch)" (KPI law:139-140), but the M1 implementation groups by
   `(checkout, branch)` (goals/time-to-certainty/research/scripts/economics.py:1421, :1434), and
   TTC ruling 75 keys by `(checkout, runId)` with `runId = <safe-branch>-<sha12(branch)>`
   (TTC-D:997; FLEET MANIFEST.yaml join_keys.runId, the `repoRunArtifactId` cite). The keying
   is the same in both. (b) "Cut" means two different things. The law's cut is "censored excluded"
   and its uncut is "censored included at their observed lower bounds" (KPI law:58-61). M1's
   `comparable24h` drops closed episodes over 24 h, and M1's `uncut` drops the ceiling but
   **still excludes right-censored streaks**, reporting them only as counts
   (economics.py:1536-1551; TTC-D:1003-1007). The mapping must state both, and the law needs a
   dated erratum.
3. **The tier partition has no derivation rule in law.** The run-4 hand-off says so: "rows carry
   no structured tier member … deriving one for W8 is P4 work" (GD:1377-1379), and the KPI law
   lists the tiers without a rule assigning an attempt to one (KPI law:36-38, :142-148). Deriving
   an AssuranceTier from Yeet's `proofTier` alone is the refuted conflation (GD:1330-1335;
   `ontology/docs/literal-domains.md:32-35`). W8 needs an episode-target-tier assignment rule,
   stated as ETL classification rather than vocabulary, by ruling, before code.
4. **No pinned input covers TierCiMergeGreen.** FLEET pins admission, attempts and live state.
   The verdict family is excluded, and there is no `gh` run data (FLEET MANIFEST.yaml:42105-42114).
   Pinned attempt starts at stage `hosted`: 0 (FLEET MANIFEST.yaml:37190-37215).
5. **The seat-request clock covers about 4.7 days of pinned data.** The only present admission
   root is `canonical` (the system-tmp root is absent, FLEET MANIFEST.yaml:2990-2999). Its
   retained window is 2026-10-01T09:32:09.602Z → 2026-10-06T01:51:50.495Z
   (FLEET MANIFEST.yaml:2976-2979), capped at 200 admissions (:786-788). **Survey census:** 243
   v3 `admission-enqueued` rows; 183 carry an `attemptId`; only **56 join to a pinned attempt**.
   127 name attempts whose checkout has no pinned attempt directory, which fits retired lanes
   whose `.beep/yeet/runs` were removed with the worktree. The other 60 carry no `attemptId`
   (54 `review-fix`, 6 `full-proof`). That loss is survivorship censoring, and it hits M1 the
   same way.
6. **The tier fields arrive with the ttc post-baseline.** `stage` and `proofTier` first appear on
   an attempt start at 2026-09-03T13:10:08.505Z; every one of the 3,200 earlier starts lacks
   both, and the last stage-less start is 2026-09-03T16:45:30.438Z (**survey census**). The
   `stage = <absent>` count is 3,200 (FLEET MANIFEST.yaml:37211-37213). `resolvedHeadSha`, the
   only per-attempt commit (needed for adoption qualification), is present on the same 1,057
   starts; `head` is the literal ref name. M1's post-baseline cut is
   2026-09-03T06:29:33.572Z (EC:7191). A window opening at that cut is the only post-baseline
   window in which tiers and adoption are derivable from pinned bytes.
7. **#1427's post-period on the pin is close to empty.** It landed 2026-10-06T01:36:13Z
   (CI-ledger:1105), 1 h 43 min before the FLEET capture at 2026-10-06T03:19:28.440Z
   (FLEET MANIFEST.yaml:17). **Survey census:** 19 starts after it in 6 checkouts, 16 of them
   `pre-push / cheap-gates / publish`. That is the population shift its row predicts
   (CI-ledger:1119), visible in miniature.
8. **The PR shape conflicts.** PLAN sequencing says "W8 → W9 is the verdict PR, which carries the
   status flip and the closeout reflection" (PLAN.md:142-143; MAP.md:93-94). P5 and P6 are listed
   as separate phases (PLAN.md:21-22; ops/manifest.json:102-110). Reconciliation is in §10.

---

## 1. What W8 must compute under KPI law v1.1

### 1.1 Episode identity and the clock

- **Unit:** one `(checkout, branch)` red streak, from its opening instant to "the attempt that
  establishes the target assurance tier"; cross-checkout collisions are distinct episodes
  (KPI law:16-19).
- **Clock start (seat request):** "the first admission ticket's `enqueuedAtMillis` for the
  streak — queue wait is INSIDE the KPI"; an episode with no ticket opens at its first attempt's
  `startedAt` (KPI law:20-24). From #1025 (2026-09-09) the seat-request clock is computable from v3
  `admission-enqueued`, and for granted work from `admission-admitted.enqueuedAtMillis` from #878
  on. Earlier windows fall back to attempt start, labelled per episode (KPI law:122-131;
  SPEC.md:128-129).
- **Join available on the pin:** v3 `admission-enqueued` rows carry `attemptId`, `branch`,
  `checkoutRoot` (fleet-relative label) and `enqueuedAtMillis`. v1 `admission-admitted` rows carry
  `attemptId`, `enqueuedAtMillis` and `admittedAtMillis`. Attempt starts carry `attemptId`,
  `branch`, `runId`, `stage`, `proofTier`, `mode` and `resolvedHeadSha` (**survey census** of
  member sets over `FLEET/admission/canonical/journal.ndjson` and `FLEET/attempts/**`;
  join key documented at FLEET MANIFEST.yaml `join_keys.attemptId`, ProofFact cite).
- **Clock stop:** the finish instant of the attempt that establishes the target tier. The law
  gives no field. M1's convention is the green attempt's `endedAt`, else its `startedAt`
  (TTC-D:999-1000), and `attempt-finished.recordedAt` is the pinned finish field.
- **Terminated counts as red** (KPI law:121). **Lock bounces** are excluded from episode
  opening, but their wall time inside an open episode still counts (KPI law:72-74). M1's bounce
  test: `failureKind === "handler-error"` and the message contains `Another Yeet full proof`
  (TTC-D:1002-1003).

### 1.2 Episode boundaries under each definition

| Aspect | This KPI (law v1.1) | TTC M1 (`economics-close.json`) |
| --- | --- | --- |
| Key | `(checkout, branch)` (KPI law:16-19) | `(checkout, branch)` in code (economics.py:1421, :1434); TTC-D:997 says `(checkout, runId)`, equivalent |
| Opens | first ticket `enqueuedAtMillis`, else first attempt start (KPI law:20-24) | first red attempt's `startedAt` (TTC-D:1000; KPI law:134-137) |
| Closes | the attempt establishing the **target tier** (KPI law:16-18) | any green comparable attempt (TTC-D:998-1000) |
| Partitions | per tier, required: "a fleet aggregate without tier partitions is a headline" (KPI law:36-38) | none (KPI law:140-141) |
| Modes | no mode filter in law; bounces excluded from opening (KPI law:72-74) | `verify \| repair \| publish` only, bounces excluded (TTC-D:1001-1003) |
| Duration ceiling | none | `comparable24h` drops closed episodes > 24 h (economics.py:96, :1537) |
| Right-censored | in the uncut distribution at observed lower bounds; censored count beside each percentile set (KPI law:58-61) | never inside percentiles in either row; counted as `rightCensoredStreaks` with an observed lower-bound sum (TTC-D:1006-1013) |
| Left-censored | positively recorded via `journal-compacted` (KPI law:115-120) | excluded when start ≤ compaction cutoff (TTC-D:1004-1006) |
| Starvation | beside percentiles; nonzero makes the report fail (KPI law:66-71) | none (KPI law:140-141) |
| Estimator | nearest-rank (KPI law:65-66) | "true nearest-rank: sorted index ceil(p*n)-1" (EC:304) |

### 1.3 Tier partition

- Three ratified tiers: TierRepairGreen, TierLocalFullProof and TierCiMergeGreen (KPI law:36-38;
  `ontology/docs/literal-domains.md:13`). Merged preview reports as a **sub-partition of
  TierLocalFullProof** (KPI law:142-148; XD:1540-1550). Run 4 ratified no fourth member, Queue H
  stays open, and §6 stands (GD:1330-1335, :1365-1368).
- Deployed `ProofStage` is `repair-loop | pre-push | merged-preview | hosted` (KPI law:145-147).
  The admission work kind `merged-preview` is **not** the merged-preview stage: it is also written
  by any full proof carrying the CI-parity step (FLEET MANIFEST.yaml:37169-37189; GD:251-254
  note k). **Survey census:** 152 of 243 v3 enqueues are kind `merged-preview`, yet merged-preview
  stage starts are 3 overall and 0 since the #1321 cut (FLEET MANIFEST.yaml:37190-37216; last at
  2026-09-09T03:41:38.790Z).
- Pinned `(stage, proofTier, mode)` mix over the 1,057 stage-bearing starts (**survey census**):
  pre-push/full/{publish 542, verify 156, closeout 147, monitor 47}; pre-push/cheap-gates/{verify
  79, publish 16}; repair-loop/full/repair 64; repair-loop/review-fix/verify 3;
  merged-preview/full/verify 3; hosted 0.
- Gap: no rule maps these to tiers (finding 3). The open cases are `cheap-gates` at pre-push,
  `review-fix`, `closeout`/`monitor` modes, and the 3,200 stage-less starts before
  2026-09-03T16:45Z.

### 1.4 Cut and uncut, and censoring

- Publish both: **cut** (censored excluded) and **uncut** (censored at observed lower bounds),
  with the censored count beside each percentile set (KPI law:58-61). Every figure is
  retained-window-relative (KPI law:52-57).
- Left-censoring is positively recorded by `journal-compacted` receipts (KPI law:117-120).
  **The FLEET pin carries none**: all 718 per-source `compaction_receipts` values are 0, and every
  attempt-journal `ring_window` says "wrapped: unknown unless a retained compaction receipt
  supplies evidence" (FLEET MANIFEST.yaml, e.g. :7743). Journals at writer cap have no receipt
  to prove their opening is whole.
- Window-level censorship already named by the live replay: 3 pre-v3 chains, 1 skipped terminal
  row, 4 ledger-censored verdicts, 44 withdrawn and 1 ticket-evicted request rows
  (goals/ciops-ontology-pipeline/research/s7-live-replay-evidence.md, "Window censorship";
  GD:1395-1397).
- Survivorship: lane retirement deletes attempt journals (finding 5). Neither the law nor M1
  names this class. W8 must report it as a censoring line (unjoined enqueues by reason).

### 1.5 Starvation beside percentiles

- Each report carries the count of seat requests waiting beyond the declared starvation bound
  without a modelled exception (CQ-023's population) next to P50/P95 (KPI law:66-71).
- The bound is a **declared operational policy fact**: "the operator declares the fleet value".
  The only value in the packet is the seed example 120000 ms
  (explorations/beep-ci-operational-ontology/ontology/docs/competency-questions.yaml:625;
  `ontology/tests/fixtures/seed.ttl:71`). The S6 A-Box declares none. It carries
  `publishAgingSeconds 120` and `hardFloorGib 15`, which do not carry the bound
  (`ontology/extraction/s6/graphs/abox.ttl:11-13`; competency-questions.yaml:625).
- Exceptions: the domain is `{HardFloorException}`, derived from the snapshot-global
  `hardFloorEngaged` flag (competency-questions.yaml:625). No journal row records it, so
  exceptions are **unobservable** over history.
- CQ-023's own scope is requests queued at a snapshot (competency-questions.yaml:625, item 4).
  Over a window, v3 gives every request a resolved wait (admitted, withdrawn or ticket-evicted).
  **Survey census** on the canonical root: 243 requests, all resolved; 107 waited > 120 s,
  60 > 15 min, 7 > 1 h; nearest-rank P50 35.2 s, P95 53.7 min. Any bound near the seed value
  makes the report "failing" under KPI law:70-71.

### 1.6 Change-event partitions

- `landedAt` is the series partition point. Membership is **adoption-qualified**: a checkout is
  post-period only when its HEAD ancestry includes the merge commit (KPI law:39-43). Every
  comparison is labelled OBSERVATIONAL unless a supporting design upgrades it (KPI law:44-48).
- The ledger has 44 rows, sha256 `f520b302424f…` (GD:825-826, :1372-1374). Run 4 ratified
  `OperationalChangeEvent` (rat-071). `ciops:landedAt` stays seed-only and unproposed, so "W8
  partitions on the seed `landedAt` values as before" (GD:1369-1371).
- Rows record a tier only in prose: the first `ADOPTION-QUALIFIED MEMBERSHIP` caveat of each row
  (e.g. CI-ledger:117, :143, :246). **Survey census** of that caveat: local 24 (including
  iv-870, iv-929 and iv-1006, whose caveats predate the tier wording, CI-ledger:43, :67, :85),
  hosted 10, both 10. Hosted fleet-state rows take membership from **runner launch time**, not the
  run's head (CI-ledger:398, :740, :989, :1160).
- Rows inside a window opening at the M1 cut (2026-09-03T06:29:33Z) and closing at the FLEET
  capture: 38 of 44. Six land before it (iv-870, iv-929, iv-874, iv-871, iv-891, iv-894; landedAt
  values at CI-ledger:28, :57 and the rows at :101, :128, :156, :182).
- **#1427:** it partitions the local series only, and its hosted consequences stay in a caveat
  that partitions nothing; W8 states the hosted population shift as a confounder at that instant
  (GD:826-831, :1377-1379). The row's own caveats: squash adoption undercounts the post-period
  (CI-ledger:1118); "compare populations across this point, not percentiles of one population"
  (CI-ledger:1119); local admission demand falls at the same instant (CI-ledger:1120); three
  hosted co-mechanisms, "whether the hosted series is also partitioned at this instant is the
  steward's call" (CI-ledger:1122). iv-1422 lands 46 min later on the hosted tier
  (CI-ledger:1145, :1165).
- Co-mechanisms at one instant are named in a CONFOUNDED caveat, and caveat prose never becomes a
  partition point (GD:58-67).

### 1.7 Provenance obligations

- Every aggregate names its reader version, flags, resolved roots and snapshot instant
  (KPI law:94-96). The v3.2 probe skips §1-§2 and miscounts terminated attempts over post-#964
  journals. A current reading must consume `attempt-terminated` and `journal-compacted`
  (KPI law:107-114).
- Design from the deployed journal and §6, not from the stale §5 "candidate repo improvement"
  prose (SPEC.md:140-142; KPI law:84-93).
- `bun run beep yeet economics --fleet` is a named cross-check proxy, never imported
  (KPI law:112-114; MAP.md:165, :182). The proof ledger is an issuance vein, never a KPI vein
  (KPI law:131-133).

---

## 2. Inputs: present on the pins, and missing

| Input | Status | Cite / note |
| --- | --- | --- |
| Attempt journals (started/finished/terminated) | **present**: 4,257 starts, 2026-08-04T14:40Z → 2026-10-06T03:17Z, 123 checkout dirs (**survey census**) | FLEET `attempts/**`; capture totals FLEET MANIFEST.yaml:58564-58569 |
| `stage`, `proofTier`, `resolvedHeadSha` per start | **present from 2026-09-03T13:10Z only** (1,057 starts) | finding 6 |
| `journal-compacted` receipts | **absent** (0 across 718 sources); left-censoring cannot be proven from the pin | FLEET MANIFEST.yaml `compaction_receipts` values |
| v3 admission journal (enqueued/withdrawn/evicted) | **present** for 2026-10-01T09:32Z → 2026-10-06T01:51Z, canonical root only, 200-admission ring | FLEET MANIFEST.yaml:770-788, :2976-2979 |
| Earlier v3 rows (2026-09-28T11:41Z → 2026-10-01T12:12Z) | **present** as the committed redacted snapshot projection (sha256 `8cceaf17…`); `checkoutRef`, not `checkoutRoot`; 230 enqueues not in FLEET, of which **10** join a pinned attempt (**survey census**) | `research/evidence/journal-snapshot-2026-10-01/SHA256SUMS.txt`; GD:13-16; PLAN.md:57-63 (W3 read it by path and sha256) |
| Admission rows 2026-09-09 → 2026-09-28 | **missing**: no pin covers the gap (run3/run3b captured 2026-09-09T08:19Z/08:20Z) | `run3-fleet/MANIFEST.yaml:14`, `run3b-fleet/MANIFEST.yaml:9` |
| Hosted CI runs (TierCiMergeGreen) | **missing** from every pin | finding 4 |
| Verdict per-lane durations | **excluded** from FLEET (verdict family) | FLEET MANIFEST.yaml:42105-42109 |
| Starvation bound | **missing** (only the seed example value) | §1.5 |
| `hardFloorEngaged` history | **missing** (not journaled) | §1.5 |
| Change-event rows with tier | **prose only**; no structured member | §1.6; GD:702-703 |
| Adoption census (ancestry of `resolvedHeadSha` vs each `mergeCommit`) | **derivable**, not pinned; needs git object access, and a commit never pushed may be absent from the object store | KPI law:39-43 (`CHECKOUT_HEADS.txt` pattern) |
| Proof ledger | present (LEDGER, 3,628 post-cut pre-push facts) but **not a KPI vein** | LEDGER MANIFEST.yaml:45-57; KPI law:131-133 |
| M1 figures to compare against | present as a document: EC sha256 `cc75d260…`, `redToGreen` at EC:7712-7753, `postBaseline.redToGreen` at EC:7589-7625, `baselineComparison` M1 rows from EC:77 | §6 |

---

## 3. Must S7 §6 be amended? The minimum amendment

**Yes.** CT:273 excludes the KPI ETL from the projection lab, citing the incubation-home ruling
(XD:102-116). That ruling puts "vein miners, KPI ETL, projection function" in "a labs app",
and says "the durable ETL is born in the labs app when it is scaffolded" (XD:104-116). The
contract bullet, not the ruling, is the blocker. PLAN W8 and MAP W8 make the amendment the
condition (PLAN.md:128-129; MAP.md:79). GOAL scope admits "the S7 contract §3.2/§6"
(goals/ciops-ontology-pipeline/GOAL.md:25-28).

**Minimum amendment:** a dated CT §9 ("2026-10-xx amendment — the KPI reading module (W8)"),
authority the P4 launch sitting, superseding **only** the last §6 bullet, with a pointer line
there in the §8.2 style (CT:400-409). Content:

1. The KPI ETL lives in this lab as its own module (`src/kpi/**`) and its own `Context.Service`.
   `CiOpsProjection` (CT:93-111) is unchanged; the KPI never feeds `project`, `emitAbox` or
   `planEpisode`.
2. It reads pinned corpora and goal documents by path and sha256 only, with no live fleet read
   and no tailing daemon (the CT §6 daemon bullet stands, CT:271-272).
3. It emits no A-Box: KPI figures are not ontology individuals. CQ-012/CQ-021 materialization
   stays deferred, and no vocabulary is minted (CT §6 "No T-Box changes" stands, CT:269-270).
4. Admission v1 and emission `s7-emission/v2` bytes and both goldens stay byte-equal, and the
   replay engine is unchanged (the CT:330-331 sentence repeated).
5. Evidence is check-by-default like `evidence:s7-live` (CT:541-545).

Nothing else in §6 changes: the `QualityScheduler` sole-writer bullet stands (CT:267-268).

---

## 4. Where the module lives

| Arm | For | Against |
| --- | --- | --- |
| **A. `apps/labs/ciops/src/kpi/` (recommended)** | Incubation-home names "the labs app" for the KPI ETL (XD:104-116); the lab is the goal's runtime and stays `active`, goal-owned (XD:1431-1442); it already decodes the pinned v1–v3 journal with surrogate custody (GD:463-471, :526-528) and pins documents by sha256 (GD:432-444); one `package-verify` gate (manifest verificationCommands) | Needs the §3 amendment; adds surface to a lab whose `Replay.ts` is already over the 60-line unit law (GD:537-538) |
| B. New lab (e.g. `apps/labs/ciops-kpi`) via `beep create-package` lab mode | No CT amendment; clean boundary | Must re-implement or duplicate the journal decoders (labs never import each other: "No lab publishes a public `@beep/*` API", standards/architecture/15-lab-apps.md:55-57); a new workspace means a new identity segment and lab lane; the manifest's verify list names only `@beep/ciops` |
| C. Packet Python script beside the v3.2 probe | Fast | The probe is the S0 instrument only (KPI law:107-114); incubation-home rejected packet-local scripts as the durable home (XD:112-116); schema-first and Effect-first laws (SPEC.md:143-144) |

The module shape follows the repo design order, schema → service → implementation
(SPEC.md:143-144): schemas (`KpiEpisode`, `EpisodeClock` literal kit `seat-request |
attempt-start`, `TierAssignment`, `CensorClass`, `KpiPercentiles`, `KpiTierReading`,
`ChangeEventPartition`, `StarvationCount`, `KpiReading`), a `CiOpsKpi` service, and a pure fold.
A script `scripts/generate-kpi-evidence.ts` with `evidence:kpi` / `evidence:kpi:write` extends
the `EvidenceWriteScript` literal domain (GD:557-561). Gates follow P2 Ruling 10
(GD:490-496): fallow cognitive ≤ 8 and unit ≤ 60, effect-vitest inventory rows, test-tsgo,
`package-verify @beep/ciops`, titled JSDoc, and no changeset.

---

## 5. Episode-definition mapping (this KPI ↔ TTC M1)

The verdict must "state the mapping and never present one as the other" (SPEC.md:86-89;
KPI law:134-141). Content of the mapping section:

1. **Clock.** KPI opens at seat request (queue wait inside), else at attempt start, per episode
   labelled. M1 opens at the first red `startedAt`, so for an admitted streak M1 omits the first
   ticket's queue wait.
2. **Key.** Both are `(checkout, branch)` in effect. The KPI law §6 sentence saying M1 keys per
   branch is an erratum (finding 2a; KPI law:139-140 vs economics.py:1421, :1434).
3. **Closure.** KPI closes on the attempt that establishes the target tier. M1 closes on any
   green comparable attempt, whatever its tier.
4. **Partitions.** KPI is per tier with the merged-preview sub-partition. M1 has no partitions.
5. **Population.** KPI has no mode filter (law). M1 keeps `verify | repair | publish`. The KPI
   reading includes `closeout`/`monitor` attempts (147 + 47 pre-push full starts, **survey
   census**).
6. **"Cut" vocabulary.** KPI cut/uncut = censored excluded/included at lower bounds. M1
   `comparable24h` = closed ≤ 24 h, M1 `uncut` = closed, any length. Neither M1 row includes
   right-censored streaks.
7. **Censoring.** Both count right-censored streaks. M1's observed lower bound stops at the last
   measured time (TTC-D:1006-1010). The KPI's lower bound is not fixed by law (decision D10).
8. **Corpus.** M1 close was computed over TTC's own inputs (795 frozen corpus receipts plus live
   journals at 2026-09-28T12:57:53.988Z; goals/time-to-certainty/research/economics-close.md:208;
   EC:7169). The KPI reads FLEET (captured 2026-10-06). Population differences confound any
   definition-to-definition comparison unless the definitions are run over **one** population.
   Hence the recommended M1-replica row over FLEET (D18).
9. **Starvation.** KPI reports it; M1 has none.

---

## 6. W9 verdict document

**Where.** `goals/ciops-ontology-pipeline/research/kpi-verdict.md` (hand-authored) beside the
generated `research/kpi-reading.md` (and its JSON). "Beside `economics-close.json` M1" is
content placement (a side-by-side table citing EC by path, sha256 and line), not file
placement. TTC tracked artifacts take no edit beyond dated receipts (SPEC.md:39-40;
GOAL.md:30-32), and facts cross only as documents read by path and sha256 (XD:1399-1400;
TTC-D:1147-1170).

**Must say:**

1. The ratified window and who ratified it (D6, D21), the reader identity (module version, pinned
   inputs with sha256, flags, snapshot instants), and the estimator (KPI law:65-66, :94-96).
2. Per tier (TierRepairGreen, TierLocalFullProof with its merged-preview sub-partition,
   TierCiMergeGreen), cut and uncut P50/P95 with n, right- and left-censored counts beside each
   set, and clock labels (seat-request vs attempt-start counts) per set.
3. The starvation count at the declared bound beside every percentile set, the "failing report"
   reading when nonzero (KPI law:70-71), and the exception-unobservable caveat.
4. The fleet aggregate as a labelled headline, never without the partitions (KPI law:37-38).
5. A change-event table: all 38 in-window rows, each with tier(s), landedAt, adoption classes
   (pre / post-adopted / post-unadopted), per-tier pre/post n and percentiles where n allows,
   the OBSERVATIONAL label, and carried CONFOUNDED caveats. Hosted-only rows say "partitions an
   unmeasured series" if D5 lands on arm A.
6. The #1427 paragraph: local partition only, post-period n, squash undercount, population
   shift into the non-full bucket, and the hosted confounder named at 2026-10-06T01:36:13Z with
   iv-1422 46 min later (GD:826-831; CI-ledger:1118-1122, :1165).
7. **Beside M1:** a table of M1 rows from EC (post-baseline `comparable24h` P50 3,671,966 ms /
   P95 36,741,278 ms, n 58, 129 right-censored streaks, EC:7589-7611 and
   `baselineComparison` EC:77-136; close-run P50 2,537,181 / P95 15,591,302, n 440, EC:7712-7734;
   TTC baseline P50 2,597,852 / P95 14,224,890 from the `baselineComparison` rows), the S0 KPI
   proxy baseline (282 episodes, P50 41.3 min, P95 3.1 h;
   explorations/beep-ci-operational-ontology/research/kpi-baseline-2026-08-27.md:154-157),
   and the §5 mapping. Every M1 cell is labelled "M1 (proxy), not this KPI" (KPI law:140-141).
8. **Improvement reported, not required** (XD:1382-1388, :1402-1404; SPEC.md:19-21): state
   moved/not moved per tier against the S0 proxy and against the M1-replica, observationally.
9. The S9 statement (§7).
10. A censorship and survivorship section (§1.4), and the cross-check line from
    `yeet economics --fleet` if run (MAP.md:165).
11. A closing line for the gated MAP candidate `ciops-yeet-projection`: its trigger needs "the
    KPI verdict shows the projected order beating the deployed one" (XD:1437-1440). State
    whether that is met. Recommended reading: not measurable, since no counterfactual episode
    exists.

---

## 7. The S9 statement

S9 is the pipeline's last stage, "S9 dogfood proof & graduation"
(explorations/beep-ci-operational-ontology/README.md:67-71). Graduation Ruling 2 moved it to
goal phase P4 (W9) (XD:1372-1374; README.md:81). BRIEF: "Close with the S9 dogfood statement:
what the projection says the route should be, and whether the deployed route matches"
(explorations/beep-ci-operational-ontology/BRIEF.md:165-167). MAP: "the S9 statement of
projected versus deployed route (graduation Ruling 2)" (MAP.md:80). S7 sitting 1 Ruling 4's
replay "seeds the S9 dogfood" (XD:649-656).

**Content (recommended):**

1. **Admission route.** The projection's first choice against the deployed grant: frozen golden
   41/41; run-4 Stage C 197/200, the 3 disagreements attributed to the #929 same-checkout skip
   that admission v1 does not model (s7-live-replay-evidence.md "First-choice agreement" and
   "Disagreements"; GD:519-525). Unit: one `admission-admitted` row.
2. **CQ-009 under the deployed route.** The same-checkout arm holds (0 pairs over 200 grants); the
   legacy drain is unobservable in the journal (GD:1386-1402; CT:547-557).
3. **Lane route.** `planEpisode` orders the handoff's existing lanes only, and the deployed
   `orderWaveLanes` stays the only writer of real pre-push order (CT:400-404). The 33-step plan
   reproduces the handoff's rank order. Since the handoff is the deployed order's own fixture
   output (TTC-D:1125ff), agreement is **by construction**, a consistency check and not
   independent evidence (GD:419-424 says `Graph.topo` recovering rank order is an agreement
   check). The statement must say so.
4. **What the projection does not say.** No lane-plan term was ratified (GD:1375-1376), and the
   projection proposes no different route. It therefore makes no claim that a projected route
   would shorten time-to-certainty, and the KPI cannot attribute any change to the projection.
5. The `ciops-yeet-projection` trigger reading (§6 item 11).

---

## 8. The post-baseline window

The completion gate says "an operator-ratified post-baseline window"
(ops/manifest.json:27; SPEC.md:148-154). "Post-baseline" names no baseline. Candidates are the
S0 KPI baseline (2026-08-27; kpi-baseline-2026-08-27.md) and TTC's P0 baseline, whose
post-baseline cut is `cutUtc` 2026-09-03T06:29:33.572Z (EC:7191; TTC-D:68-73). Since W9 states
the verdict beside M1, the TTC post-baseline is the reading that matches the comparison.

**Recommended window W = [2026-09-03T06:29:33.572Z, 2026-10-06T03:19:28.440Z)**, membership by
`episodeStartedAt` (KPI law:33):

- **Start at TTC `cutUtc`:** this aligns with M1 `postBaseline`. It is also, within hours, the
  instant from which `stage`, `proofTier` and `resolvedHeadSha` exist (finding 6), so tier and
  adoption are derivable for nearly every in-window start. Starts in the
  06:29Z → 16:45Z gap without stage are reported as an "untiered" count.
- **End at the FLEET capture instant** (FLEET MANIFEST.yaml:17): the reading uses pinned bytes
  only, needs no new capture, and contains all 38 in-window change events.
- **Two named slices reported inside W, not instead of it:** W-a =
  [cutUtc, 2026-09-28T12:57:53.988Z] (M1 `measurementAsOf`, EC:7169) for the like-for-like
  M1-replica comparison; W-b = [2026-10-01T09:32:09.602Z, 2026-10-06T01:51:50.495Z], the FLEET
  canonical retained window, where the seat-request clock is complete for joined episodes and
  CQ-012 decomposition can be checked (D22).

Rejected arms: (i) the exact M1 window, which loses every seat-request-clock episode (no pinned
v3 rows before 2026-09-28T11:41Z); (ii) W-b only, which is too small for tiers (**survey
census**: 81 starts in W-b) and excludes 30 of the 38 events; (iii) waiting for a new capture to
give #1427 a post-period. Improvement is not required (XD:1402-1404), a new pin root costs a
capture PR, and the window must close somewhere. #1427's thin post-period is reported with
its n.

---

## 9. Risks

1. **Survivorship bias.** Retired lanes lose their attempt journals: 127 of 183 attempt-bearing
   v3 enqueues on the canonical root do not join, and 220 of 230 on the snapshot (**survey
   census**). Closed episodes over-represent long-lived checkouts. This hits M1 too and must be
   stated, not corrected.
2. **Small seat-request population.** The seat-request clock applies to tens of episodes. Most
   in-window episodes fall back to attempt start, and the report's headline clock is mostly
   attempt-start. That is lawful but must be visible per set (KPI law:129-131).
3. **Proof-tier conflation.** A tier rule written as `proofTier → AssuranceTier` repeats the
   refuted reading (GD:1330-1335). The rule must classify episodes by what the closing attempt
   establishes (stage and proof scope together), in KPI law, and emit no vocabulary.
4. **TierCiMergeGreen unmeasured.** Ten hosted-only change events and the hosted halves of ten
   "both" rows partition nothing measured, and reviewers may read the tier partition as
   incomplete.
5. **Left-censoring is unprovable** on the pin (0 compaction receipts). At-cap journals may have
   wrapped silently.
6. **Adoption oracle.** `resolvedHeadSha` values of unpushed lane commits may be missing from the
   repository object store, so ancestry is unknown for some episodes. Squash merges mean branch
   lanes carrying a lever pre-merge are filed as pre-period (CI-ledger:1118).
7. **Two "cut"s and the keying erratum.** If the law is not amended first, the verdict either
   repeats a wrong sentence or contradicts its own law.
8. **Starvation bound.** At the seed value the report is "failing" (107/243 requests > 120 s,
   **survey census**). Choosing the bound after seeing the data is tuning.
9. **Cached greens.** The lab's Turbo inputs do not name the pins or the ledger, so a cached
   green can hide input drift (GD:391-397, :528-530). The orchestrator re-runs `evidence:kpi` at
   each phase and the PR body carries its check line.
10. **Code-size laws.** The fold must respect fallow cognitive ≤ 8 and unit ≤ 60 (GD:494-495);
    `Replay.ts` already sits over the unit law (GD:537-538).
11. **Public residue.** The verdict quotes checkout labels only in their `<fleet>/` form, and no
    home path, uid, hostname or session id enters it (stop condition, ops/manifest.json
    stopConditions; GD:243-248).
12. **Ledger digest drift.** Editing CI-ledger rows (e.g. adding a tier member) changes
    `f520b302424f`, which the run-4 archive cites. The archive keeps its pinned digest, but any
    lab constant must move with it.
13. **"Operator-ratified" wording vs the charter.** The gate text names the operator. Under the
    autonomy charter (GD:273-280) the orchestrator rules and names itself honestly (GD:594-606
    precedent).
14. **TTC is paused** on ruling 80's condition (TTC-D:1241-1262;
    goals/time-to-certainty/ops/manifest.json lifecycle `paused`). EC is the latest M1, frozen at
    2026-09-28, and will not refresh during P4.

---

## 10. PR shape: reconciling PLAN sequencing with P5/P6

- PLAN: "W8 → W9 is the verdict PR, which carries the status flip and the closeout reflection"
  (PLAN.md:142-143; MAP.md:93-94). The completion gate wants the final PR merge-ready "with the
  status flip and closeout reflection riding it" (ops/manifest.json:27, item 5).
- P5 ("Drive each slice PR, and the final PR, to Yeet merge-ready") and P6 ("Closeout reflection
  and status flip on the final PR") are separate phase rows (PLAN.md:21-22).
- **Reconciliation:** P5 and P6 are **states of the last PR, not further PRs**. P5 is the
  merge-ready drive of each P4 PR. P6 is the reflection plus flip commit, which lands on the
  final P4 PR before it is called content-final. This matches the P3 precedent, where the status
  flip rode the last P3 PR (GD:731-738, :1415-1417).
- **Recommended shape: two PRs.** PR-A (W8): CT §9 and the KPI law v1.2 amendment as its first
  commit, design before code (as GD:376-382 for W6), then the module, tests, the generated
  `research/kpi-reading.{md,json}`, and the P4 rulings. PR-B (W9, final): `research/kpi-verdict.md`
  with the S9 statement, P4/P5/P6 flips in PLAN, README and manifest (`lifecycle`/`status`
  `completed-retained`, as e.g. goals/canonical-slice-factory/ops/manifest.json:6), and the
  `/reflect` reflection. Why two: under P1 Ruling 4, files edited in a PR cannot be cited by
  path:line until they merge (GD:249-251), so a verdict citing merged W8 bytes is cleaner. The
  code also gets its own review window, and P3 used the same split (GD:731-738). The cost is one
  extra hosted cycle. PLAN.md:142-143 gets a ruling-backed amendment ("W8 and W9 ship as two PRs;
  the second carries the status flip and the closeout reflection").
- Alternative: one PR, per the PLAN text. Fewer cycles, but the verdict then cites unmerged lab
  bytes and code review shares a PR with the verdict prose.

---

## 11. Decisions for the launch sitting

Each decision lists options and the recommended arm (R). Reversal for all of them: a later GD
entry before the PR that carries the decision merges, then a follow-up PR.

**D1 — Module home.** (A) `apps/labs/ciops/src/kpi/` with a `CiOpsKpi` service; (B) a new lab;
(C) a packet Python script. **R: A** (§4; XD:104-116, :1431-1442).

**D2 — CT amendment.** (A) a dated CT §9 superseding only the CT:273 bullet, with the five
clauses in §3; (B) rewrite §6 in place; (C) no amendment, new lab. **R: A** (the §8 pattern,
CT:323-331, :400-409).

**D3 — KPI law v1.2 amendment, first commit of PR-A.** A dated §7 carrying: (a) the M1 keying
erratum (finding 2a); (b) the two-"cut" glossary (finding 2b); (c) the tier-assignment rule (D4);
(d) the clock-join rule (D8); (e) the censoring rules (D10, D11) and the survivorship line; (f)
the declared starvation bound (D13); (g) a pointer saying §5's self-erasing bullet is superseded
(already true by KPI law:122-133, restated). Options: (A) one §7 amendment; (B) put the rules
in the CT §9 or the module JSDoc only. **R: A.** The law is goal-owned (XD:1396-1398), and "a
number that can't state which rule produced it is not a KPI reading" (KPI law:4-5).

**D4 — Tier-assignment rule (episode target tier).**
- (A) By stage, with proof scope as a guard. repair-loop → TierRepairGreen. pre-push with
  `proofTier full` → TierLocalFullProof. merged-preview stage → TierLocalFullProof /
  merged-preview sub-partition. hosted → TierCiMergeGreen. pre-push `cheap-gates` and any
  `review-fix` attempt go to a reported **unassigned** bucket (no ratified tier denotes "cheap
  gates passed"). Stage-less pre-2026-09-03 starts are **untiered** and counted.
- (B) Map cheap-gates to TierRepairGreen.
- (C) Map by `proofTier` alone.

**R: A.** C is the refuted conflation (GD:1330-1335). B asserts an equivalence no ruling
makes. A makes #1427's shift visible as publish attempts moving into the unassigned bucket
(CI-ledger:1119). Streaks are computed within each tier's attempt subsequence per
`(checkout, branch)`. Merged preview is by **stage**, never by admission kind (FLEET
MANIFEST.yaml:37169-37189), and the kind census is printed as a note.

**D5 — TierCiMergeGreen.** (A) Report it as unmeasured, "no pinned hosted input", with EC's
hosted Check-run envelope cited beside it as TTC's workflow-duration figures and not episodes
(goals/time-to-certainty/research/economics-close.md:177-180). (B) A new sibling hosted capture
pin (gh runs per head and branch) under a new root with residue scans, plus an episode rule for
hosted red-to-green. (C) Derive hosted episodes from EC's `hosted` section. **R: A.** B is a
new capture and episode design inside a verdict phase. C mis-states workflow durations as
episodes, which the S0 baseline already flagged ("WORKFLOW-DURATION sample only",
kpi-baseline-2026-08-27.md:179). If the sitting wants a hosted series, B is the lawful route and
becomes its own PR before PR-A.

**D6 — Window.** (A) W = [TTC `cutUtc`, FLEET capture) with slices W-a and W-b; (B) the exact
M1 window; (C) W-b only; (D) wait for a new capture. **R: A** (§8).

**D7 — Admission sources.** (A) FLEET canonical plus the 2026-10-01 redacted snapshot projection,
read by path and sha256 after `redact_journal_snapshot.py --check`, deduplicated by
`(nonce, _tag)`; (B) FLEET only. **R: A.** It extends v3 coverage back to 2026-09-28T11:41Z.
It adds few clocks (10 joins) but 230 requests to the starvation population. A mismatch fails
closed, with no fallback (the W3 rule, PLAN.md:57-63).

**D8 — Clock-join and opening rule.** (A) Join a ticket to an attempt by `attemptId`, checked
against `branch` and checkout label where present. Opening = min(first attempt `startedAt`, the
`enqueuedAtMillis` of any ticket joined to the streak's first attempt). Each episode carries
`clock ∈ {seat-request, attempt-start}`. v1 `admission-admitted.enqueuedAtMillis` counts as a
ticket instant for granted work (KPI law:129-130). (B) Opening = the earliest ticket of any
attempt in the streak. **R: A.** The law says "the first admission ticket … for the streak"
(KPI law:21-23), and a later attempt's ticket cannot predate the streak.

**D9 — Clock stop.** (A) The closing attempt's `attempt-finished.recordedAt`, else its
`startedAt`, mirroring TTC-D:999-1000; a reconciler-stamped termination never ends a duration
(TTC-D:1014-1018). (B) Capture-relative. **R: A.**

**D10 — Right-censored lower bound (uncut).** (A) The last measured instant of the open streak
(the M1 convention, TTC-D:1006-1010); (B) the snapshot instant minus opening. **R: A.** B lets
abandoned retired-lane streaks count until the capture date. A is conservative and comparable
with M1's censored lower bound.

**D11 — Left-censoring.** (A) Flag an episode left-censored when its journal has a
`journal-compacted` receipt whose cutoff is at or after its opening (law), **and** report a
"possibly truncated" count for streaks opening at the first retained terminal attempt of an
at-cap journal with no receipt. (B) Receipts only. **R: A.** The pin has zero receipts, so
B would silently claim completeness.

**D12 — Mode population.** (A) Law population (all modes, bounces excluded from opening) as the
reading, plus an **M1-replica** row over the same pin (M1 modes, no tiers, 24 h cut and uncut)
labelled "M1 definition over FLEET, not M1"; (B) M1 modes only. **R: A.** The law has no mode
filter, and the replica separates the definition effect from the population effect (§5 item 8).

**D13 — Starvation bound and population.** (A) Declare 120000 ms, the packet's only declared
value (seed.ttl:71; competency-questions.yaml:625), before computing. Population: every v3
request in the window, with wait = admitted/withdrawn/evicted instant minus enqueue, or capture
minus enqueue if open. Exceptions reported as unobservable. Two non-normative sensitivity counts
at 15 min and 60 min. (B) Pick a bound from the observed distribution. (C) Leave it undeclared
and report no count. **R: A.** B is tuning to the reading. C breaks KPI law:66-71. A "failing
report" is a lawful verdict, since improvement is not required. Ruled by the orchestrator under
the charter and listed for the operator's asynchronous review (D21).

**D14 — Adoption oracle and classes.** (A) A committed adoption table generated by a
check-by-default script that runs `git merge-base --is-ancestor <mergeCommit> <resolvedHeadSha>`
for each (in-window episode, row) pair. The lab reads the table by path and sha256 and never
shells git. Classes: pre (started before landedAt), post-adopted, post-unadopted (reported,
excluded from post), unknown (head absent from the object store). Hosted fleet-state rows use
runner launch time (CI-ledger:398, :740, :989, :1160) and are moot under D5-A. (B) The lab spawns git.
(C) Wall-clock only. **R: A.** C breaks KPI law:39-43; B puts a process dependency in a pure
fold.

**D15 — Change-event tier derivation.** (A) A lab typed constant table (id, landedAt,
mergeCommit, mechanismChanged, tiers) asserted against the ledger's sha256, with a test covering
all 44 ids. Tiers come from each row's ADOPTION-QUALIFIED caveat; the three pre-wording rows
(iv-870, iv-929, iv-1006) are local. (B) Add a structured `tiers:` member to every ledger row.
(C) Parse the YAML prose in the lab. **R: A.** It keeps the ledger bytes the run-4 archive cites
and adds no unratified relation to A-Box seed rows. The P2 precedent is "typed constants asserted
against the pinned bytes, never … a YAML dependency" (GD:473-476).

**D16 — #1427.** (A) Partition the local series only (both local tiers and the unassigned
bucket). Report post-period n with the squash-undercount caveat, compare populations rather than
one population's percentiles (CI-ledger:1119), and name the hosted confounder in prose at
2026-10-06T01:36:13Z together with iv-1422 at 02:22:00Z. (B) Also partition the hosted series by
a co-row. **R: A.** It is already ruled (GD:826-831, :1377-1379), and the hosted series is
unmeasured under D5-A.

**D17 — Outputs.** (A) Generated `research/kpi-reading.json` (Schema-encoded, schema id
`ciops-kpi-reading/v1`) and `research/kpi-reading.md`, check-by-default, plus the hand-authored
`research/kpi-verdict.md`; no TTC edit. (B) Markdown only. (C) Also add a dated receipt line in
TTC. **R: A.** JSON lets W9 and later runs cite exact numbers, and TTC is paused, with crossing
by document read (XD:1399-1400).

**D18 — M1 comparison rows.** (A) EC `postBaseline.redToGreen` as the primary M1 row, close and
baseline rows as context, plus the D12 M1-replica over FLEET W-a. (B) Close-run M1 only.
**R: A**, because the post-baseline row shares W's start instant.

**D19 — S9 statement content.** (A) The five items in §7, including "lane agreement is by
construction" and the `ciops-yeet-projection` trigger reading; (B) report agreement figures
only. **R: A.**

**D20 — PR shape.** (A) Two PRs: PR-A (W8, amendments first), then PR-B (W9 final, with the
flip and reflection), and a ruling amending PLAN.md:142-143. (B) One PR, as PLAN reads.
**R: A** (§10).

**D21 — Who ratifies the window, bound and tier rule.** (A) The orchestrator under the autonomy
charter, named honestly as in P3 Ruling 2 (GD:594-606), with each call listed in the P4 closing
entry for the operator's asynchronous review. (B) Route to the operator through a structured
prompt. **R: A.** The charter escalates only money (GD:273-280). The gate's "operator-ratified"
wording is read as charter-ratified, and the entry says so.

**D22 — Queue-wait decomposition (CQ-012 shares).** (A) Report shares only on W-b and only
where `decomposedEpisodes = windowEpisodes` holds for the slice, otherwise print "void" with the
pair (KPI law:33-35); (B) omit decomposition. **R: A.**

**D23 — A-Box emission of KPI figures.** (A) None in P4; (B) emit `ciops-prov:` KPI
observations. **R: A.** That keeps CT §6's no-vocabulary clause, and no CQ needs it in P4.

**D24 — Uncut ceiling and the 24 h cut.** (A) The law's cut/uncut only, with 24 h applied only
in the M1-replica row; (B) add a 24 h variant to the reading. **R: A.** The law has no duration
ceiling, and the round-2 critique of `--max-episode-hours 24` stands (kpi-baseline-2026-08-27.md:124).

---

## 12. Sequenced P4 work list (if the recommended arms hold)

1. Launch-sitting entry in GD (D1–D24), with the PLAN.md:142-143 amendment (D20).
2. PR-A, commit 1: CT §9 and KPI law §7 (v1.2), schemas and the `CiOpsKpi` service contract
   with a failing stub (design first).
3. PR-A, later commits: the adoption-table generator plus its committed table (D14), the
   change-event constant table (D15), the pure fold, the evidence script, tests (byte
   determinism, a must-fail fixture per censor class, tier-rule totality, ledger-sha drift
   failing typed), and the generated `kpi-reading.{json,md}`. Gates per GD:490-496.
4. PR-B: `kpi-verdict.md` with the M1 side-by-side, the mapping, the change-event table, the
   #1427 paragraph and the S9 statement; flips (P4/P5/P6, `completed-retained`); `/reflect`;
   `bun run beep lint reflection-artifacts`; the manifest's verificationCommands.
