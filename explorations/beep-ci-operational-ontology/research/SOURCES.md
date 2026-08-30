# Beep CI Operational Ontology — Sources & Provenance

- **Cluster / origin:** live operator session 2026-08-27 (yeet-cheapening question →
  operational-ontology pivot), grilled at packet launch; raw capture under
  `../prose/pre-packet-transcript/` (gitignored), distilled narrative committed beside it.
- **Provenance:** [`../CAPTURE.md`](../CAPTURE.md), [`../DECISIONS.md`](../DECISIONS.md).

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `.repos/effect` (effect v4 checkout, machine-local symlink) | MIT | port-with-attribution | `TxSemaphore`, `TxPriorityQueue`, `TxReentrantLock`, `TxQueue`, `TxRef`, `TxHashSet`, `TxHashMap`, `TxDeferred`, `TxChunk`, `TxPubSub`, `Graph` as projection-runtime substrate (S7; Fable personal inspection committed) |
| `~/YeeBois/dev/t3code` (`packages/shared/src/DrainableWorker.{ts,test.ts}`) | UNVERIFIED (operator's own workspace) | reference only until license/ownership confirmed | drainable-worker pattern for seat/grant lifecycle |
| `~/YeeBois/workstation-apps/semantica` | UNVERIFIED | reference only — operator explicitly ruled implementations "should not be considered correct or valid"; own critique/review loop required | reasoner-engine shapes (forward chaining, Rete, Datalog, SPARQL) |
| `~/YeeBois/dev/effect-ontology` | MIT (mkessy, 2024-present) | port-with-attribution; correctness critique required at S8 before adoption | Effect-TS OWL substrate: topological catamorphism over the subClassOf DAG, KnowledgeIndex monoid, `@core-v2` InferenceRouter + QuadDelta — candidate reasoner/projection substrate (operator flagged 2026-08-27) |

## 3. External research sources

- Lane reports (on-disk, each carrying its own citations; produced 2026-08-27 by codex
  Sol-medium with web search, per the grok/codex-only directive):
  [`r1-agentic-ontology-learning.md`](./r1-agentic-ontology-learning.md) (LLM-era ontology
  engineering practice; SPIRES/OntoGPT, DRAGON-AI-style curation, CQ-based acceptance),
  [`r2-reuse-scan.md`](./r2-reuse-scan.md) (verified vocabulary URLs in its link table:
  PROV-O, P-Plan, OSLC Automation 2.1, SEON, SPDX 3.0.1 + Build profile, in-toto
  attestations, SSN/SOSA, schema.org Action, DOAP, SBSON, DevOps-infra),
  [`r3-scheduling-formalisms.md`](./r3-scheduling-formalisms.md) (DRR/fair queueing,
  admission control, test-case prioritization/APFD, Build Systems à la Carte,
  self-adjusting computation).
- R4 live-practice sweeps (grok 4.6, three variants, landed 2026-08-27):
  [`r4-live-practice.md`](./r4-live-practice.md) (X-primary retrieval),
  [`r4-deep-research.md`](./r4-deep-research.md) (iterative yolo deep research),
  [`r4-firecrawl-deep-research.md`](./r4-firecrawl-deep-research.md) (fetched-document,
  version-pinned claims); each carries its own citation discipline.
- AgentO chapter (R5, Fable personal read 2026-08-27): Ekelhart, A., Kurniawan, K.,
  Ekaputra, F.J., Kiesling, E.: *AgentO: An Ontology for Modeling Agentic AI Systems.*
  In: Acosta, M. et al. (eds.) The Semantic Web (ESWC 2026), LNCS 16550, pp. 298–320,
  https://doi.org/10.1007/978-3-032-25159-6_16 — read from the on-disk proceedings PDF
  (`~/YeeBois/research/The Semantic Web.pdf`, pp. 321–343 of the PDF). The *paper* is
  Springer-copyrighted (reference only); the *ontology + KG resource* is **CC BY 4.0**
  (https://w3id.org/agentic-ai/onto, DOI 10.5281/zenodo.18342624; pipeline
  https://agentic-patterns.github.io/). What we take: the derivation process (frozen-schema
  LLM extraction contract, Issues-ledger mechanism, friction-driven refinement, sampled
  ratification) — distilled with judgment in
  [`r5-agento-process.md`](./r5-agento-process.md); the ontology itself is out-of-domain
  for us beyond its PROV-O/P-Plan alignment precedent.

## 4. In-repo capability references

- `packages/ontology/*` (domain/server/client/ui/use-cases/config) — REUSE: the bespoke
  ontology system; this packet's T-Box/A-Box is its first serious operational payload.
- `packages/epistemic` — REUSE: evidence/provenance semantics.
- `apps/labs/semantica` — REUSE/EXTEND: in-repo reasoner lab; incubation neighbor for the
  pipeline labs app (per DECISIONS incubation-home).
- `packages/tooling/tool/cli` Yeet internals — REUSE: `internal/TurboQuery.ts`
  (`turbo query affected` + decoded schemas, `YEET_FEEDBACK_TASKS`),
  `internal/Planner.ts` (`YeetProofTier`: full | cheap-gates | review-fix),
  `internal/Verdict.ts` + `.beep/yeet/runs/*/verdict.json` (per-lane `durationMs`,
  `outcome`, `createdAt`, `branch`, `head` — the KPI's T1 vein).
- `packages/tooling/tool/cli` Quality internals — REUSE: `commands/Quality/Tasks.ts`
  (lane assembly, concurrency bounds, coverage CI-identity pinning, `--force` in CI),
  `internal/cli/TurboCache.ts` (cache-posture state machine).
- `turbo.json` — REUSE: task/`global.inputs` definitions (the hash-surface facts, incl.
  root `package.json` in global inputs).
- `bun run beep topo sort` — REUSE: package topology for reverse-topo scheduling facts.
- `standards/ARCHITECTURE.md` + `standards/architecture/*` — REUSE: slice/role/family
  semantics for formal-first class extraction.
- KPI ETL / vein miners / projection function — NET-NEW (labs-incubated per DECISIONS).

## 5. Cross-links & provenance

- This packet: [`../CAPTURE.md`](../CAPTURE.md), [`../DECISIONS.md`](../DECISIONS.md),
  [`../prose/2026-08-27-pre-packet-session.md`](../prose/2026-08-27-pre-packet-session.md).
- Sibling context: `A_LETTER_FROM_THE_OTHER_SIDE_OF_THE_LOOP.md` (repo root; the "bush"),
  `explorations/knowledge-endgame/` (parked; ontologies-as-backpressure framing this packet
  operationalizes).
- Related shipped machinery this packet measures/schedules around: yeet cheap-gates tier +
  machine-wide proof coordinator (PRs #837/#840), asymmetric turbo remote cache
  (PRs #673/#674), the in-flight yeet-proof-scheduler worktree.
