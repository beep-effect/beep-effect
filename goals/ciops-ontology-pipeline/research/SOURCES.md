# CI-Ops Ontology Pipeline — Sources & Provenance

- **Source exploration:** `explorations/beep-ci-operational-ontology` — primary ledger:
  `explorations/beep-ci-operational-ontology/research/SOURCES.md`. Its §2 (upstream
  repositories and licenses) and §3 (external research) stay authoritative and are linked,
  not copied. This file adds only what the goal needs on top: the capability table refreshed
  at graduation (§4) and the documents that cross the time-to-certainty boundary (§5).
- **Decisions:** the exploration's `DECISIONS.md` is the prior log, through the 2026-10-01
  graduation sitting (Rulings 1–11); new rulings land in [`decisions.md`](./decisions.md).

## 1. Mined source corpus

The corpus is the exploration's frozen pins under
`explorations/beep-ci-operational-ontology/ontology/extraction/**` (byte-immutable) and the
pins this goal adds under new roots. No source is mined into this packet directly.

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| run-3 corpora | `run3-fleet`, `run3b-fleet` pins | beep-effect | `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/` | admission, attempts, verdicts | frozen; replayed tree-pinned (graduation Ruling 8) |
| run-4 intake docket | Auditor run 4 intake | beep-effect | `explorations/beep-ci-operational-ontology/research/auditor-run4-intake.md` | Queues A–F | input to W7 |
| admission-journal snapshot | 2026-10-01 digest-only snapshot | beep-effect | `explorations/beep-ci-operational-ontology/research/evidence/journal-snapshot-2026-10-01/MANIFEST.md` | Queue D withdrawal and eviction chains | input to W3 (payload gitignored) |

## 2. Upstream repositories & licenses

See the exploration ledger's §2. This goal takes no new upstream; `Graph` from `effect`
(W6) is validated against the Effect reference checkout (`.repos/effect`).

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `.repos/effect` (effect v4 checkout, machine-local symlink) | MIT | reference only | `Graph` (`topo`, `isAcyclic`) for the W6 lane DAG |

## 3. External research sources

None beyond the exploration ledger's §3.

## 4. In-repo capability references

Refreshed at graduation against main `886de7a261`. Repo-cli paths are under
`packages/tooling/tool/cli/src/`; packet paths are under
`explorations/beep-ci-operational-ontology/`. `apps/labs/ciops` code is cited by symbol only
(#1371, merged 2026-10-01 after that anchor, edits its projection files).

| Capability | Cite at HEAD | Use |
| --- | --- | --- |
| S7 projection engine | `apps/labs/ciops` (`@beep/ciops`): `CiOpsProjection` service and `CiOpsProjectionShape` (`project`, `emitAbox`, `planEpisode`) in `src/projection/CiOpsProjection.ts`; `projectSchedule` in `src/projection/Engine.ts`; `emitScheduleAbox` in `src/projection/Turtle.ts` | reuse and extend (W5, W6) |
| Differential replay | `decodeAdmissionJournal`, `replayAdmissionJournal`, `requireReplayMatch` in `apps/labs/ciops/src/projection/Replay.ts`; `apps/labs/ciops/scripts/generate-replay-evidence.ts` | reuse; agreement report NET-NEW (W5) |
| Planner seam | `PlanEpisodeInput` (`{ episodeId }` at HEAD) and `plannerNotImplemented` in `apps/labs/ciops/src/projection/Schemas.ts`; contract `ontology/docs/s7-projection-contract.md` §3.2 and §6 | widened first, then given a body (W6, graduation Ruling 11) |
| Gate-order handoff | `GateOrderHandoff` in `commands/Quality/Quality.schemas.ts:1821`; `DEFAULT_GATE_ORDER_SEED` (:224), `GATE_ORDER_SOURCE` (:414) and `orderWaveLanes` (:641) in `commands/Yeet/internal/WaveOrder.ts`; document `goals/time-to-certainty/research/gate-order-handoff.json` | read as a document by path and sha256, never imported (W6) |
| Admission journal | `internal/repo-run/AdmissionJournal.ts`: v3 `admission-lease-evicted` (:317), `admission-enqueued` (:438), `admission-withdrawn` (:462); 200-admission retention | capture input (W3); seat-request clock (W8) |
| Scheduler invariant | `internal/repo-run/QualityScheduler.ts:1599` (`activeTokenTotal(state) + ticket.weightTokens <= capacityTokens`); `isTicketSkippable` (:1556); `ProofStage` in `internal/repo-run/QualityScheduler.schemas.ts:194` | replay oracle and tier vocabulary (W5, W8) |
| Attempt journals | `commands/Yeet/internal/AttemptJournal.ts` `YeetAttemptFinished` (:86): `attempt-finished` embeds the verdict, so verdict history survives a last-write-only `verdict.json` | capture input (W3) |
| Proof ledger | Owning-clone `.beep/yeet/proof-ledger.ndjson` resolved by `proofLedgerPathForCheckout` (`commands/Yeet/internal/ArtifactPaths.ts:457`, time-to-certainty ruling 71); `ProofProvenance` (`commands/Yeet/internal/ProofFact.ts:233`), `ProofFact` (:298); writer `recordProofShadowForAttempt` (`commands/Yeet/internal/ProofShadow.ts:983`, called at `commands/Yeet/internal/Handler.ts:1627`); append-only `commands/Yeet/internal/ProofLedger.ts` | NET-NEW capture generator reads it (W4) |
| Economics cross-check | `bun run beep yeet economics --fleet` (`commands/Yeet/Yeet.command.ts:1263`, `:1273`); `EconomicsRedToGreen` (`commands/Yeet/internal/Economics.schemas.ts:466`); `goals/time-to-certainty/research/scripts/economics.py` | cross-check only, never imported (W8, W9) |
| Package topology | `bun run beep topo-sort` (`commands/TopoSort/TopoSort.command.ts:28`) | reuse |
| Packet gates | `research/scripts/validate_packet.py` (base, `--s5`, `--s6`), `research/scripts/run_cq_suite.py`, `ontology/extraction/s6/scripts/{apply_s6_dispositions,run_shacl,build_predicates}.py` | certainty test (all phases) |
| Run-3 generator pattern | `ontology/extraction/s4/beep-ci-ops/corpus/etl_run3b_fleet_corpus.py` (frozen; `source_cite` at :666-676; ledger existence only at :1431, "ledger family" excluded at :1434); tree-pinned reference `research/scripts/verify_run3_citations.py` | sibling pattern for W3 and W4 |
| Auditor skill | `.claude/skills/ontology-foundational-auditor/` (v15; seat launches `SKILL.md:299-341`; validator `scripts/validate_artifacts.py:1129-1134`) | reuse by launch-entry deviation (W7); optional v16 (W2) |
| KPI law and probe | `research/kpi-measurement-rules.md` §1–4 with the v1.1 amendment (§6); `research/scripts/kpi_baseline_probe.py` | law for W8; probe is the S0 instrument |

Corrections carried from frozen exploration files, which are never edited:

- `research/run3-corpora-design-brief.md:75` cites `CLI/internal/repo-run/AttemptJournal.ts:92-104`.
  The schema it means is `YeetAttemptFinished` in `commands/Yeet/internal/AttemptJournal.ts`
  (:86 at HEAD).
- `research/run3-corpora-design-brief.md:76` places the ledger at
  `<checkout>/.beep/yeet/proof-ledger.ndjson`. Since time-to-certainty ruling 71 (#1321) it
  lives in the owning clone, resolved by `proofLedgerPathForCheckout`.
- `goals/time-to-certainty/research/d1-ordering-handoff.md:103-108` cites
  `Schemas.ts:885-887` and `:843-848`; read them as `plannerNotImplemented` and
  `PlanEpisodeInput` in `apps/labs/ciops/src/projection/Schemas.ts` (the ttc file stays
  unedited under its ruling 79).

## 5. Cross-links & provenance

- **Exploration:** `explorations/beep-ci-operational-ontology` (graduated 2026-10-01;
  `links.goals` names this packet). Its `BRIEF.md` and `MAP.md` are the shaped pitch and the
  decomposition; its ontology tree and `research/scripts/**` stay in place and this goal owns
  them by back-link (graduation Ruling 7).
- **Time-to-certainty boundary (its ruling 79).** `goals/time-to-certainty` keeps M1–M5,
  `yeet economics`, the proof ledger and its C4.2 enforcement flip, the deployed
  `gate-order-lexicographic/v1` order and the handoff document's single writer. Its
  `PlanEpisodeInput`, `apps/labs/ciops`, S7 contract and ontology-vocabulary clauses kept the
  seam as it was; graduation Ruling 11 now authorizes this goal to widen it, design first.
  Its open item `iv-1006-wave-order` is disposed by graduation Ruling 6 (row written in the
  graduation PR).
- **Gate-order handoff digest.** At HEAD `886de7a261`,
  `goals/time-to-certainty/research/gate-order-handoff.json` is sha256
  `a4d7d22edb457c14b6cfaac8c69cd5bd505bf1bcc18fd3fc8be5ec3aa6417ff8` (#1322, 2026-09-28).
  The `c9619cee…` digest in the exploration's 2026-09-25 receipt and Trail line is correct
  as dated (#1269). Between the two, #1321 and #1322 moved only `source.reference.sha256`
  (the pinned `economics.json` digest, time-to-certainty ruling 77); the seed and the 32-lane
  order are unchanged. W6 pins whatever digest it reads.
- **Close economics.** `goals/time-to-certainty/research/economics-close.json` (round 25,
  sha256 `cc75d260c7076fba4e5fada7ba5dbcdf09302a43402648fe9a2a60932f002924` at HEAD) and
  `economics-close.md` are the M1 reference for the W9 verdict.
