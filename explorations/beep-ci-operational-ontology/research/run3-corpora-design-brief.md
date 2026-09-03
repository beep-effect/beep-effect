<!-- Machine-assisted design brief for the run-3 corpora grill (2026-09-03).
Produced by a four-lane evidence sweep + synthesis; the sixteen resolved rulings
live in DECISIONS.md (run-3 corpora design grill). Host paths are placeholder-
redacted for the public repo: <repo>, <fleet>, <runtime-root>, <user-cache>, etc.
This brief is the design INPUT; where it and a DECISIONS ruling differ, the
ruling wins (e.g. Ruling 12 re-derived the CQ-015 mount set from the CQ text). -->

# Run-3 corpora design brief

**Ground state.** Run 2 is COMPLETE (orun-2026-09-03T02:46:18Z, 21 ratifications rat-032..rat-052, gate PASSED — do not rerun). All paths below are under the worktree `<repo>/` at merged main `a1652c1923`. Abbreviations: `PKT/` = `explorations/beep-ci-operational-ontology/`; `INDEX` = `PKT/ontology/extraction/s4/beep-ci-ops/runs/orun-2026-09-03T02:46:18Z.index.yaml`; `RATS/` = `PKT/ontology/extraction/s4/beep-ci-ops/governance/ratifications/`; `DEC` = `PKT/DECISIONS.md`; `CLI/` = `packages/tooling/tool/cli/src/`.

**Path corrections vs. prior tasking:** ratifications live at `RATS/rat-032.yaml..rat-052.yaml`, NOT packet-root `governance/`. The run-2 fleet ETL lives at `PKT/ontology/extraction/s4/beep-ci-ops/corpus/etl_fleet_corpus.py` with its pin at `.../corpus/run2-fleet/` (1591 committed files), NOT at `PKT/corpus/`. `ops/manifest.json` nests `openQuestions` under the `exploration` key.

**Two run-2/S7 blockers are already FIXED on main** and must not be re-litigated at the grill: the admission transition journal exists and the reaper journals lease/ticket death (`CLI/internal/repo-run/QualityScheduler.ts:874-916`), and the grant handoff no longer self-erases — the lease carries `nonce`+`enqueuedAtMillis` and `admission-admitted` is journaled before ticket deletion (`QualityScheduler.ts:1334-1352`; `QualityScheduler.schemas.ts:214-218`).

---

## 1. Obligations map

Index census (verified by parse): 387 disposition rows — 268 irrelevant, 68 unresolved, 44 mapped, 7 proposed. 149 carried rows: 146 retired, **3 kept unresolved** (`runs/orun-2026-09-03T02:46:18Z.README.md:17-18`). The other **65 unresolved rows** are the sitting-1/-3 re-parks in **31 distinct needed_evidence families** (DEC:807-808) — all are run-3 obligations. Waiver gloss: `PKT/ontology/extraction/s4/beep-ci-ops/runs/orun-2026-09-03T02:46:18Z.manifest.yaml:29-35`.

### checkout-identity corpus
| Obligation | Source |
|---|---|
| C1 carried row `so:sha256:0d096342f5ba…` — "Run-2 path partitioning and checkoutRoot fields do not establish a stable checkout identity or its cache-mount relations" | INDEX:45-51 |
| Corpus spec: "timestamped fleet inventory binding checkout identity to root, origin, branch/worktree, and shared-cache mounts for the CQ-015 evidence-transfer bearer" | DEC:773-779; `work/sittings/carried-clusters.yaml:127-138` |

### grant-contention corpus
| Obligation | Source |
|---|---|
| C2 `so:sha256:b42503da3776…`, C3 `po:sha256:5fa0d40013f2…` — "overlappingPaths fields describe worktree overlap, not a grant-to-resource contention relation" | INDEX:484-490, 731-737 |
| Corpus spec: "joinable admission/lock event corpus carrying grant identity, resource path, acquisition/release instants, and contention outcome in one provenance chain" | DEC:775-777; carried-clusters.yaml:116-126 |
| ⚠ GC-adjacent partial fits (each also needs a contract/policy/CQ the capture alone won't supply): `jv-admission-lifecycle` (INDEX:1004), `pa-admission-lease-lifecycle` (INDEX:1224,1313,1345 — the sitting-1 "lease relator/lifecycle" boundary, DEC:746), `pa-admission-capacity-expression` (INDEX:1242,1301), `pb-admission-capacity-state` (INDEX:1425,1558,1571,1626,1645), `pc-heartbeat-suspicion-policy` (INDEX:1874,1880), `pc-origin-blocked-timestamp` (INDEX:1995,2034), `pb-origin-block-grace-window` (INDEX:1485) | Lane A §6c |

### identity-provenance corpora
| Obligation | Source |
|---|---|
| rat-047 merge-readiness VerificationEvidence — "provenance identity deferred to run 3" | RATS/rat-047.yaml:9-10 |
| rat-048 limitation-report VerificationResultArtifact — "result-provenance identity deferred" | RATS/rat-048.yaml:9-10 |
| rat-049 yeet-workflow VerificationPlanSpecification — "plan-identity contract deferred" | RATS/rat-049.yaml:9-10 |
| rat-050 AdmissionPriorityClass — "registry lineage deferred to run 3" | RATS/rat-050.yaml:9 |
| rat-051 planned-lane-status VerificationResultArtifact — "result-provenance identity deferred" | RATS/rat-051.yaml:9-10 |
| rat-052 evidence-receipt VerificationEvidence — "claim-formation provenance deferred" | RATS/rat-052.yaml:9-10 |
| Binding gloss: "evidence/result issuance-custody lineage, plan-identity contract, priority-class registry lineage" | DEC:802-804; `PKT/README.md:63-64` |
| `pa-workspace-package` (7 rows — package-identity policy: rename/move/version/fork/delete-recreate continuity; sitting-1 "package lineage" boundary) | INDEX:1047,1069,1075,1101,1143,1175,1307; DEC:746 |
| `jv-actual-wall-duration:002` (issuance record + custody lineage for duration carriers; :001 is a ⚠ CQ-revision rider) | INDEX:932,961 |
| `jv-lane-diagnostic-comparison:001` (comparison issuance + ⚠ CQ rider) | INDEX:961 |
| `pa-projection-conformance-evidence:001-:003` (issuance/custody but ⚠ demands new governance artifacts + two new CQs) | INDEX:1022,1032,1128 |
| Sitting-1 identity-card boundaries conceded until provenance exists: ScheduleStep content/token, lease relator/lifecycle, package lineage, evidence claim/carrier | DEC:745-747 |

### ordering cluster (§3 below)
hasStep (INDEX:2112,2118), stepIndex (INDEX:1081,1639), `pa-projection-contract:001` (INDEX:1010), `pb-schedule-projection-specification:001` (INDEX:1443,1545), `pc-projection-contract:001` (INDEX:1924,2023), `ov-schedules-seat-request:001` (INDEX:2124). Ruling: "the full ordering cluster (ScheduleStep and its four relations) ratifies together after the CQ-020 wording amendment" (DEC:790-792). CQ-020 amendment is **APPLIED** (PR #963, commit `a0ec34047d`; `ops/manifest.json:9`). The `ciops-prov:` namespace re-proposal rides this cluster (`ops/manifest.json:10`).

### ⚠ SCOPE SURPRISES — obligations fitting NONE of the three corpora + cluster (13 families, ≈25 rows; Lane A §6d)
Each demands an authoritative contract/policy/definition **plus one observed case**, which no planned capture produces: `jv-base-freshness` (INDEX:905,975,981), `jv-greptile-score` (INDEX:917,926), `jv-verification-step-execution` (INDEX:941 — needs passed-step journal records, an attempts-journal enhancement), `jv-memory-peak-measurement` (INDEX:950), `pa-elapsed-ms-field` (INDEX:1117), `pa-failure-signature` occurrence join (INDEX:1167,1273,1288 — class itself ratified rat-032), `pa-cache-plan-resolution` execution join (INDEX:1186 — CachePosture ratified rat-043), `pa-qa-evidence-workflow` (INDEX:1233), `pb-topological-package-report` (INDEX:1354,1377,1383,1437,1552,1603), `pb-docgen-affected-scope:001+:002` (INDEX:1477), `pb-affected-task-input-mode` (INDEX:1672,1704), `pb-failure-attribution-category` (INDEX:1688), `pb-yeet-proof-tier` (INDEX:1578,1584,1612).

**Second surprise:** at least 9 concession families require a "revised or new Must/Should CQ" — a CQ-suite amendment wave beyond the applied CQ-020 fix, a workstream no corpus discharges.

### Other run-3 obligations
- Engine pins: run 3 pins `prior_index_sha256_12: a207a106de68` and the validator v14 digest at its own pin commit (`ops/manifest.json:9`; IMPL:168; README.md:145-146).
- TS adapter v1.1.0 **conditional** deferral: triggered only "until a run needs new TS observations" (DEC:664-665; IMPL:88-91) — the grill must state whether run 3 triggers it (recommendation in §4: it does not).
- S8 IRI scheme stays deferred after run 3 (`ops/manifest.json:10`).
- IMPL follow-ups: archive shelter, Python pin, CQ-020 amendment all DONE (validator v14, `ops/manifest.json:9`); the sandbox loaded-session smoke test (IMPL:139) is claimed done but not named in the v14 line — verify at grill if pedantic.

---

## 2. Corpus designs

### 2a. identity-provenance (issuance/custody lineage)

**Purpose.** Discharge the six rat-047..052 flags (evidence/result issuance-custody, plan-identity contract, priority-class registry lineage), ground the sitting-1 boundary concessions (lease relator/lifecycle, evidence claim/carrier, package lineage), and feed `jv-actual-wall-duration:002` / `jv-lane-diagnostic-comparison`.

**Evidence sources on disk (today, 2026-09-03 observation):**
- THREE genuine admission journals — the deployed scheduler hard-cut to `<runtime-root>` (`CLI/internal/repo-run/RuntimeRoot.ts:46-54,97-136`): legacy `<legacy-tmp-admission-root>/journal.ndjson` (170 lines, all v1, 87 admitted/83 released, raw pid/procStart), legacy session-tmp `<legacy-session-admission-root>/journal.ndjson` (2 lines), canonical `<runtime-root>/<admission-dir>/journal.ndjson` (16 lines). The run-2 ETL sees only the two legacy roots (`etl_fleet_corpus.py:61-79`) — **the now-primary journal is invisible to it.**
- Fleet-wide `<checkout>/.beep/yeet/runs/<runId>/attempts.ndjson` + `verdict.json` — including linked worktrees (`beep-effect*-worktrees/*`), which the run-2 glob skipped (`etl_fleet_corpus.py:672-680`). `attempt-finished` embeds the full verdict, so verdict history survives despite verdict.json being last-write-only (`CLI/internal/repo-run/AttemptJournal.ts:92-104`).
- `<checkout>/.beep/yeet/proof-ledger.ndjson` — the deployed issuance record (`ProofProvenance {runId, attemptId, originKey, tier, stage, headSha, hostedRunId}`, `CLI/commands/Yeet/internal/ProofFact.ts:258-303`). **Exists in NO checkout yet**; materializes only as post-merge yeets run — an operational, not code, gate.
- Live `leases/`/`queue/`/`quarantine/` files (all empty at observation) — the only records carrying `checkoutRoot`, `command`, `hotPaths`, `runScope.unitName`; capture is opportunistic or fixture-driven via `RuntimeRootTestOverride` (`RuntimeRoot.ts:56-58`).
- Registry/plan-identity referents: `AdmissionPriorityClass` literals and lease/ticket schemas live in `CLI/internal/repo-run/QualityScheduler.schemas.ts`; per S6 precedent lineage is source-pinned extraction at `corpus_commit` (`s6/POLICY.yaml:5`). A runtime "registry" artifact does not exist — UNKNOWN whether the steward accepts source-pinned schema lineage as the registry; a disk source for the rat-049 plan-identity contract beyond code/docs is likewise UNKNOWN.

**Capture mechanics.** New committed generator per run-2/S6 precedent: first run pins a redacted corpus (e.g. `.../corpus/run3-provenance/`), reruns verify pinned bytes, `--refresh` deliberately replaces (`etl_fleet_corpus.py:3-5,1271-1281`); generator sha256 self-pin in the MANIFEST (:1008-1009); atomic staged emission (:1210-1240); `.properties` projections for auditor `config_key_value` facts (:7-12); `corpus_commit` + per-value `source:{file,line}` cites and closed-world `complete_within` receipts per S6 (`s6/POLICY.yaml`, snapshot MANIFEST). **Do not modify `etl_fleet_corpus.py` in place — its digest is pinned into run2-fleet's manifest; edits break run-2 verification.** Required ETL deltas vs run 2: third admission root; v2 event acceptance (`redact_admission` hard-fails on anything but `yeet-admission-journal/v1`, `etl_fleet_corpus.py:471-475`, while the deployed reaper emits v2 `admission-lease-evicted`/`admission-ticket-evicted`, `AdmissionJournal.ts:156-171,224-239`); worktree glob; undecodable-row handling (journals preserve unknown rows byte-for-byte, `AdmissionJournal.ts:525-533` — redact-by-schema must not pass unredacted bytes; the home-prefix + pid byte scans are the backstop).

**Identity keys + joins.** `nonce` threads ticket → lease → admitted → released/evicted → `agent-run-<nonce>.scope` (`RunScope.ts:67-70`). `attemptId` bridges machine↔checkout: admission rows ⋈ attempts.ndjson ⋈ embedded verdict ⋈ ProofProvenance ("shared with the admission row", `AttemptTerminationJournal.ts:340`). `runId = <safe-branch>-<sha12(branch)>` is a pure function both directions (`RepoRunArtifacts.ts:52-53`). `originKey` is repo-grain only. `pid`+`procStart` is the true custody key — and it's redacted (next).

**Redaction.** The run-2 pid/procStart member-drop (`DROP_ADMISSION_FIELDS`, `etl_fleet_corpus.py:87`) deletes the custody key: either keep lineage nonce-scoped or mint an opaque owner surrogate (e.g. `sha12(pid:procStart:captureSalt)`) as a NEW field before the drop (verifier enforces residue-free output, :969-971). `checkoutRoot`/`command` in ticket/lease files are absolute paths — extend the `<fleet>/`/`<home>`/`<tmp>/` string rewrite (run 2 applied it to attempts/verdicts only). Never capture lock files (`pid:uuid` tokens) or the proof-locks dir name (embeds sha12(hostname)). Ring windows (200 admitted; 50 attempts/branch) mandate `complete_within` receipts. Public-repo scans stay: the home-prefix and tmp-prefix byte scans, token regexes, manifest absolute-path lint (:750-767,1010-1013).

**REQUIRED NEW INSTRUMENTATION.** None strictly for capture. Operational prerequisite: proof-ledger rows must exist before capture (run yeet traffic post-merge). Shared with 2b: `checkoutRoot`+`branch` on released/evicted journal events removes the Option-`attemptId` dependency for checkout attribution. Note zero death-shaped events exist in the wild (attempts census: 2998 started / 2679 finished / 0 terminated; journals: admitted/released only) — positive SeatGrant-death evidence needs fixture-induced evictions under the test-override root, a grill decision (§4 R2-3).

### 2b. grant-contention (admission/lock event corpus)

**Purpose.** Discharge C2/C3 per the sitting-2 spec; partially feed the seven §6c families (their contract/CQ riders remain separate work).

**Evidence sources on disk.** The admission journals above (the core fact stream — all four event types now deployed: `AdmissionJournal.ts:55-73,89-102,156-171,224-239`, ring 200); attempts.ndjson `attempt-terminated` rows with reasons `lease-eviction`/`queued-submitter-death` (`AttemptTerminationJournal.ts:48-61,346-364`); lease `hotPaths[]` + `runScope` (resource paths + custody container) — transient; the origin gate `<runtime-root>/beep-yeet-proof-locks-<sha12(host)>-uid-<uid>/<originKey>.lock` (Stream G) has **no event stream at all** — contention there is console-only.

**Capture mechanics.** Same committed-ETL pattern as 2a (likely the same generator, one pin tree with `admission/`, `attempts/`, `verdicts/` families as run2-fleet had). Snapshot cadence before ring wrap: journal every ~200 admissions, attempts every ~50 rows/branch. Optional lossy capacity series by polling `bun run beep quality scheduler status --json`.

**Identity keys + joins.** Grant lifecycle per `nonce` (A⋈A): wait = `admittedAtMillis − enqueuedAtMillis` (both on the admitted row), hold = `releasedAtMillis − admittedAtMillis`, abnormal end = evicted rows. Checkout attribution via `attemptId` → attempts/verdicts. Time normalization: epoch millis (journal/ticket/lease) vs ISO (attempts/verdict/ledger).

**Redaction.** As 2a. `evictedAtMillis` is reap time, not death time (last `heartbeatAtMillis` is dropped at `onReap`, `QualityScheduler.ts:874`); journal appends are best-effort (lock-busy drops with console warn, `AdmissionJournal.ts:604-607`; claim-race loser edge, `QualityScheduler.ts:797`); quarantined malformed state is journal-invisible (:736-747) — the corpus MANIFEST must declare these known-loss classes.

**REQUIRED NEW INSTRUMENTATION (gates the timeline if losers are in scope):**
1. `admission-enqueued` v3 event (nonce, pid, procStart, attemptId, kind, weightTokens, priority, originKey, checkoutRoot, branch, enqueuedAtMillis) — no journal event exists at enqueue today.
2. `admission-withdrawn` v3 event in the ticket finalizer (`QualityScheduler.ts:1625-1628` currently deletes the ticket silently) — **abandoned waits, the contention-loss population, are traceless**; without this the sitting-2 "contention outcome" clause is dischargeable only for winners.
3. `checkoutRoot`+`branch` on released/evicted events.
4. Last `heartbeatAtMillis` on `admission-lease-evicted` — bounds actual death time.
5. Nice-to-have: capacityTokens/memAvailableGib stamps at admit/release (feeds `pb-admission-capacity-state` but that family also needs a CQ).
All additive NDJSON variants under the mixed-fleet-safe journal — low-risk v3 bumps in `AdmissionJournal.ts` + call sites in `QualityScheduler.ts`. After landing, real traffic must accumulate before capture.

### 2c. checkout-identity (timestamped fleet inventory)

**Purpose.** Discharge C1; supply the CQ-015 evidence-transfer bearer: checkout identity ↔ root, origin, branch/worktree, shared-cache mounts.

**Evidence sources on disk.** `bun run beep worktree fleet --json` → one `FleetSnapshot` — the packet-demanded inventory in one deployed command (`CLI/commands/Worktree/Fleet.command.ts:1-25`; `Worktree.schemas.ts:1111-1125`): fleetRoot, originUrl, scannedAt, epoch target, coverage, per-checkout `{path, kind: clone|linked-worktree, branch, head, dirtyCount, mergeBase, branchDiffCount, liveness+evidence, conflict/policy signals}`, contestedPaths. It already discovers the linked worktrees run-2 missed. Supplements per checkout via ETL git probes: `git remote get-url origin`, `git rev-parse --git-common-dir` (links a worktree to its parent clone's object store — the cache-mount-adjacent relation), plus `.beep/yeet/runs/` dir listings. Shared-cache mounts: **no existing ETL captures any** — candidates are the scanner object DB under the user cache dir, `<user-cache>/beep/` install roots, turbo caches (Lane C §5a). Which mount set satisfies CQ-015's bearer semantics is UNKNOWN — a grill design item.

**Capture mechanics.** New generator, S6-style pin: committed redacted FleetSnapshot + MANIFEST with `corpus_commit`, generator sha256, capture instant = `scannedAt`. Single-instant capture; consider N instants if the steward wants change evidence (staged question, §4).

**Identity keys + joins.** **`originKey` is a REPOSITORY key, not a checkout key** — sha12 of canonical `host/owner/repo` = `4cc31eeb4dec` for all ~30 checkouts (`ArtifactPaths.ts:99-110,130`); it discriminates repos only. Checkout-grain keys: the `<fleet>/<name>` path token (which survives run-2 redaction inside verdict strings like `indexPath` — a working cross-corpus join key), `kind`, branch + sha12(branch) (joins FleetCheckout.branch ↔ run-dir suffix ↔ verdict.runId across checkouts), head SHA ↔ future `ProofProvenance.headSha`, git-common-dir linkage. Empty originKey is a real value (review-fix admissions, `Handler.ts:517-530`).

**Redaction.** FleetSnapshot is saturated with absolute paths (fleetRoot, checkouts[].path, contestedPaths[].checkouts[]) — the home-prefix byte scan forbids committing it raw; rewrite every path to `<fleet>/<name>`. Keep sha12(hostname) out. `originUrl` is credential-free, but don't normalize away the SCP form if the identity-derivation chain must stay demonstrable. Prefer derived FleetCheckout rows over raw liveness probe data (`<session-store>/<pid>.json` carries pid/procStart-class data; the rows carry only counts/classifications).

**REQUIRED NEW INSTRUMENTATION.** None — the command exists. Open ETL design (not repo-runtime) items: shared-cache-mount capture and the minted checkout-identity key (§4 R1-5). UNKNOWN: whether the `--json` output shape is versioned/stable for pinning.

---

## 3. Ordering cluster

**Exact ratify-together set** (bigger than the sitting-3 shorthand "ScheduleStep + its four relations" — this is the zero-dangling-ends closure of amended CQ-020, `PKT/ontology/docs/competency-questions.yaml:520-546`):

Classes (3): **ScheduleStep** (re-proposal of withdrawn `otp:ov-schedule-step:001`; content-vs-carrier boundary needs run-3 provenance, docket line 56); **AdmissionProjectionSpecification** (re-proposal consolidating the three withdrawn pa/pb/pc co-denoting chains — the r3 withdrawal ground is REVERSED by the amendment, which now requires `?spec a ciops:AdmissionProjectionSpecification`); **VerificationEpisode** (the CQ's `?ep` anchor — never proposed, never ratified, absent from TAXONOMY.yaml, grounded only in pre-glossary.csv:6 and seed.ttl; **on no one's queue explicitly — the least-evidenced term in the cluster, flag hard**). Reused ratified: ScheduleProposal (TAXONOMY.yaml:98), SeatRequest (TAXONOMY.yaml:119).

Properties (6): **hasStep**, **stepIndex** (both deferred PASS/r2 ratify-candidates; stepIndex carries the recorded none-vs-quality category dispute, docket line 83); **schedulesSeatRequest** (re-proposal — its named needed_evidence is now fully satisfied by the amendment `a0ec34047d` + the deployed emission `apps/labs/ciops/src/projection/Turtle.ts:70`); **hasScopeTag** (NEW, amendment-minted, xsd:string, v1 domain `{"admission"}` per `ScheduleScope` LiteralKit, `apps/labs/ciops/src/projection/Schemas.ts:87`); **hasCurrentProposal** (NEW, H-03/hasCurrentEpoch precedent — needs an episode subject); **hasProjectionSpecification** (NEW — not emitted today). Rider: the `ciops-prov:` namespace re-proposal (`ops/manifest.json:10`).

**Evidence gaps:** (a) no episode identity exists anywhere — `ProjectionInput` (`Schemas.ts:383-395`) has none, and the emission hangs `hasCurrentProposal` off the invented untyped singleton `ciops-prov:scheduler` (`Turtle.ts:75`); (b) no AdmissionProjectionSpecification individual is emitted and `policyDigest`/`journalPrefixDigest` never reach the Turtle — needs `emitAbox` extension or ETL materialization plus identity criteria (authority/version/applicability); (c) ScheduleStep content-vs-carrier provenance; (d) deferred-tail SeatRequests are emitted with no step referencing them — CQ-020 sees admitted steps only; (e) SeatRequest node identity is proposal-relative positional (`${proposalNode}-request-${index}`) while the amendment's rationale is journal/nonce-grain identity (`ic:sched-core:001`) — `scheduledUnitRef` carries the nonce in the schema but never reaches the RDF node id (S8 coupling).

**Vocabulary mismatches to reconcile (Lane D census):**
1. Namespace: CQs/seed/registry use `ciops:`, emission uses `ciops-prov:` for all six ordering terms + ScheduleStep typing (`Turtle.ts:66-75`); the ciops-prov spellings are unregistered in `s6/PREDICATES.yaml` (only `ciops-prov:dependsOnWorkspace` exists).
2. Scope-tag spelling: emission `ciops-prov:hasScope` with a LITERAL (`Turtle.ts:69`) vs CQ `ciops:hasScopeTag` vs CQ-019 arm-2 `ciops:hasScope` with IRI objects — the no-punning split (CQ-020 notes:546; pre-glossary.csv:85); the emission spelling collides with the object property and must be renamed.
3. `schedulesWorkUnit` is stale in `s7-projection-contract.md:43-48` (ruling 2) and live in CQ-019 arm 3 (fixture `cq019-derived-scope-gap.ttl`), vs the impl rename to `schedulesSeatRequest` (s7 impl-report.md:113-120) — decide keep-as-historical vs rewrite arm 3.
4. `hasCurrentProposal` subject: episode (CQ) vs untyped scheduler singleton (emission).
5. Missing spec emission + digest serialization.
6. stepIndex base: engine 0-based (`Engine.ts:150`) vs seed.ttl:112 / CQ sample `idx: 1` — pin an explicit ordinal convention (the withdrawn definition demands one).
7. SeatRequest node identity positional vs nonce-grain (S8).
8. Deferred-tail typing (SeatRequest with charge/originKey, no step).
9. CQ-019 bookkeeping: `required_properties` (competency-questions.yaml:517) and `traceability-matrix.csv:19` omit the four step-arm predicates its query text uses, while PREDICATES.yaml's coverage block counts all 8 — three artifacts disagree; a run-3 docket consistency item.

Also stale: `s7-projection-contract.md` ruling 2 on both spellings (a/b above). The three ordering ProseObservations (po-736ad92a1de7, po-35a69c5bcbf7, po-d1f555913267, all at commit `341cfef8b6`) are the grounding quotes; po-d1f555913267's needed_evidence ("decision CQ + emitted facts") is now satisfied on both halves.

---

## 4. Design tree / grill frontier

### Round 1 — no prerequisites

**R1-1. Instrumentation-first or capture-what-exists for grant-contention?**
Recommended: **instrument first** — land the four additive v3 journal events (§2b items 1-4) in one small PR, then accumulate traffic, then capture. The sitting-2 spec demands "contention outcome in one provenance chain"; today the loss population (abandoned waits) is traceless (`QualityScheduler.ts:1625-1628`), so capture-only would discharge winners and near-certainly re-park C2/C3 for losers. Tradeoff: delays capture by an instrumentation PR + a traffic-accumulation window (ring 200), vs a corpus that answers half the ruling. Mitigation: the staged option in R2-1.

**R1-2. Corpus scope: local fleet or this checkout?**
Recommended: **fleet-wide** — run-2 precedent is already fleet-wide (30 checkouts); checkout-identity is meaningless single-checkout; the three admission roots ARE the split-brain evidence; the worktree-glob and canonical-root gaps are known and fixable. Tradeoff: larger redaction surface and pin size (run2-fleet = 1591 committed files) vs a corpus that cannot ground fleet identity claims.

**R1-3. Where corpora live + generator lineage?**
Recommended: sibling pins under `PKT/ontology/extraction/s4/beep-ci-ops/corpus/` (`run3-fleet/`-style) with run-2 MANIFEST/verify mechanics and S6 `corpus_commit`/source-cite/`complete_within` conventions — via **new generator scripts, leaving `etl_fleet_corpus.py` byte-identical** (its sha256 is pinned into run2-fleet's manifest; in-place edits break run-2 verification). Tradeoff: some duplicated ETL code vs breaking the run-2 pin; repo growth vs the immutable-packet law.

**R1-4. VerificationEpisode: fresh proposal + emission grounding, or re-amend CQ-020's anchor?**
Recommended: **ground it** — extend the S7 emission to type a real episode subject and propose the class fresh, rather than amending CQ-020 a second time (amendment discipline; the must_have CQ was just steward-sanctioned). Tradeoff: the least-evidenced term in the cluster risks another withdrawal and requires an engine/emission change (episode identity does not exist in `ProjectionInput`), vs eroding the just-applied amendment. If the steward balks at engine changes, the fallback is an explicit second amendment — name it now, don't drift into it.

**R1-5. What IS the checkout identity key?**
Recommended: corpus-local key = the `<fleet>/<name>` token, with the identity BINDING recorded as (canonical originUrl, kind, branch+sha12, head, git-common-dir linkage) at `scannedAt` — a timestamped binding, exactly what the ruling asks for ("timestamped fleet inventory binding…"), leaving rigidity-across-move/rename to the auditor rather than claiming a stable identity the evidence can't support. Tradeoff: path-token identity is admittedly unstable across renames — but minting a synthetic stable id would itself be an unratified identity criterion; let run 3 present the binding and let the T-Box fight happen on evidence.

**R1-6. Disposition policy for the 13 scope-surprise families?**
Recommended: default **re-park with named evidence**, with at most a small promoted set that rides existing captures cheaply: `pa-failure-signature` occurrence join and `pa-cache-plan-resolution` execution join (verdict-corpus joins), and optionally `jv-verification-step-execution` if the steward wants the passed-step attempts-journal enhancement in the same instrumentation PR as R1-1. Everything demanding a fresh authoritative contract/policy (base-freshness, greptile-score, topological report, docgen scope, affected-selection, failure-attribution, proof-tier, QA-evidence, measurement families) re-parks. Tradeoff: another run of parks vs unbounded run-3 scope; the CQ-suite riders (≥9 families) get the same treatment — only cluster-required CQ work in run 3 (see R3-4).

**R1-7. Does run 3 trigger TS adapter v1.1.0?**
Recommended: **no** — run-3 corpora are journal/inventory captures, not new TS observations (DEC:664-665); record that determination in the grill decisions so the conditional deferral has an explicit non-trigger ruling. Tradeoff: none material; revisit only if R1-6 promotes a family needing TS extraction.

### Round 2 — depend on round 1

**R2-1. One run or staged capture?** (depends R1-1, R1-4)
Recommended: **staged**. Stage A now: checkout-identity capture + identity-provenance capture of what exists (three journals, fleet attempts/verdicts incl. worktrees) + granted-work grant-contention facts. Stage B after the v3 instrumentation PR + traffic + proof-ledger materialization: the loss-population grant-contention capture and proof-ledger issuance rows. Tradeoff: two pins/two MANIFESTs and more bookkeeping vs a single capture whose timeline is gated on instrumentation, organic yeet traffic, AND ordering-cluster emission work — the slowest of four clocks.

**R2-2. Exact v3 event set?** (depends R1-1)
Recommended: items 1-4 of §2b (enqueued, withdrawn, checkoutRoot/branch on released/evicted, lastHeartbeatAtMillis on lease-evicted); defer capacity stamps (item 5) unless `pb-admission-capacity-state` is promoted — it also needs a CQ, so the stamp alone discharges nothing. Tradeoff: each field widens the public-corpus redaction surface (checkoutRoot is an absolute path — it gets the `<fleet>/` rewrite at capture).

**R2-3. Fixture-induced evictions?** (depends R1-1, R2-1)
Recommended: yes, one fixture-driven eviction/withdrawal scenario under `RuntimeRootTestOverride`, pinned with explicit synthetic-provenance labeling — zero death-shaped events exist in the wild, and open-world absence cannot ground the lease-lifecycle boundary concessions. Tradeoff: the auditor may discount synthetic evidence for identity/rigidity claims; labeling it honestly lets the steward decide its weight rather than discovering it post-hoc.

**R2-4. Custody surrogate before pid/procStart drop?** (depends R1-2)
Recommended: yes — new field `ownerRef = sha12(pid:procStart:captureSalt)`, salt minted per capture (cross-capture unlinkability), applied before the member-drop. Without it the identity-provenance corpus has no custody key and rat-047/048/051/052's issuance-custody lineage collapses to nonce-scoped chains. Tradeoff: any surrogate is quasi-identifying on a single-user machine; per-capture salt caps the exposure.

**R2-5. Shared-cache mount set?** (depends R1-2, R1-5)
Recommended: capture git-common-dir linkage (worktree → parent object store) as the primary mount relation, plus presence/paths (rewritten) of `<user-cache>/beep/` roots and turbo cache per checkout. Which subset CQ-015's bearer semantics actually requires is UNKNOWN — put the CQ-015 text in front of the steward and pin the minimal set it needs. Tradeoff: over-capturing mounts inflates redaction risk for facts no CQ consumes.

**R2-6. S7 emission v2 bundle contents?** (depends R1-4)
Recommended: one bundled emission PR: rename `ciops-prov:hasScope` → the hasScopeTag spelling; emit a typed `AdmissionProjectionSpecification` individual + `hasProjectionSpecification` edge; serialize `policyDigest`/`journalPrefixDigest`; type the episode subject (per R1-4); decide deferred-tail step references. Tradeoff: bigger PR and a contract-doc refresh (`s7-projection-contract.md` is stale on two spellings) vs repeated provisional-graph churn; the contract's own §6 says "no vocabulary ratification (run 2's job)" — the emission change is instrumentation FOR run-3 ratification evidence, not ratification itself, and the grill should say so explicitly.

**R2-7. Per-family triage of the promoted surprises** (depends R1-6) — for each promoted family, name the corpus join it rides and the contract/CQ debt that stays parked.

### Round 3 — cluster mechanics (depend on R1-4/R2-6)

**R3-1. stepIndex ordinal convention.** Recommended: 0-based (matches the deployed engine, `Engine.ts:150`; ORDER BY is unaffected); fix seed.ttl:112 and the CQ-020 sample. Tradeoff: fixture churn now vs an emission change later. Also resolve the recorded none-vs-quality category dispute (docket line 83) in the proposal text.
**R3-2. SeatRequest node identity vs S8.** Recommended: keep S8 IRI-scheme work OUT of run 3 (standing pipeline, `ops/manifest.json:10`; contract §6), but have the corpus/emission carry the nonce (`scheduledUnitRef`) alongside positional node ids so nonce-grain identity EVIDENCE exists; ratify SeatRequest-related identity criteria semantically without fixing IRI syntax. Tradeoff: positional IRIs persist in the provisional graph until S8 vs blocking the cluster on a deferred workstream. The `ciops-prov:` namespace re-proposal rides the cluster either way.
**R3-3. `schedulesWorkUnit` + object-property `hasScope`/`Scope` fate.** Recommended: keep `schedulesWorkUnit` as the historical CQ-019 arm-3 carrier (pre-glossary.csv:95 already marks it), do not ratify it; ratify `hasScope`+`Scope` at evidence/proposal level only if CQ-019 arm 2 is exercised by run-3 fixtures, else park with the no-punning record. Tradeoff: a seed-only predicate survives in a must_have CQ's text — ugly but honest — vs rewriting arm 3 and its fixture mid-run.
**R3-4. CQ-019 bookkeeping fix.** Recommended: align `required_properties` (competency-questions.yaml:517) and `traceability-matrix.csv:19` with the query text's 8 predicates in the run-3 docket (the three artifacts currently disagree). Tradeoff: none — pure consistency; just don't let it ride an unrelated PR (repo law on packet-state flips).

**Timeline note for the steward:** the only repo changes gating capture are (a) the v3 journal events PR (R1-1/R2-2) and (b) the S7 emission v2 PR (R2-6) — plus the operational clocks (yeet traffic to populate v3 events and proof-ledger rows). Checkout-identity has NO instrumentation gate and can pin first under the staged plan.

