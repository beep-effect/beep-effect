# patent-drafting-episode-ledger — inherited source corpus

Primary ledger: `explorations/patent-drafting-episode-ledger/research/SOURCES.md`.
This file reproduces the graduation-time corpus for implementation convenience;
the exploration ledger remains the primary copy.

# Patent Drafting Episode Ledger — Sources & Provenance

<!--
The provenance ledger for this packet. Start it in the `research` stage and keep
it current through graduate; the graduated goal inherits a copy.

RULES
- Never fabricate a URL/DOI/repo link. Reproduce only sources that actually
  appear on disk in RESEARCH.md / research/*.md; if a claim has no on-disk URL,
  cite the RESEARCH.md section that carries it instead.
- Licenses are load-bearing; state the discipline per repo.
- Register this file in ops/manifest.json `exploration.sources`.
-->

- **Clusters / origin:** the merged "Drafting episodes, deterministic
  retrieval, and rebuildable projections" cluster, which absorbed
  "Claim-limitation support and governed patent drafting" as its first rung
  in the 2026-08-01 reconciliation grill, of the parent campaign's
  signed-off routing matrix
  (`explorations/legal-patent-kg-deepening/routing-seed.json`, wave P1, one
  merged row).
- **Provenance:** parent ledger
  [`nugget-catalog.json`](../../../explorations/patent-drafting-episode-ledger/../legal-patent-kg-deepening/research/nugget-catalog.json)
  (46 rows); this packet consumes nuggets `T1-F10`, `T3-F4`, `T3-F5`,
  `T3-F10`, `T4-F7`, `ADHD-3` (primary) and `T4-F1`, `T4-F2`, `T4-F3`,
  `T4-F4`, `ADHD-2` (absorbed first rung).

## 1. Mined source corpus

Inherited by reference from the parent campaign — the nuggets' distillates
live in `explorations/legal-patent-kg-deepening/research/mined/` (see each
nugget's distillate list in [`CAPTURE.md`](../../../explorations/patent-drafting-episode-ledger/CAPTURE.md)). No new corpus is
mined for this wedge; links, not copies. The two deepened plays (`ADHD-2`,
`ADHD-3`) are not verified findings — research Lane B re-grounded their
boundary language against the primary public sources 2026-08-06
([`02-drafting-episode-frame.md`](../../../explorations/patent-drafting-episode-ledger/research/02-drafting-episode-frame.md)).
Catalog hygiene found by Lane B (§11): the wedge draws on 18 parent-catalog
paper rows representing 16 distinct works because P002/P003 are one HSNKB
work and P018/P019 are one SAT-Graph work. This
research-stage PR promoted verified public URLs for 15 rows into the parent
`00-catalog.json`; P005 and P025 had no discoverable public URL, and P030 had
no matching entry in the lane ledger, so those three remain `url: null`.
The lane's §11 carries the per-URL evidence. Two papers were retitled at
source (D1, D2); the duplicate-pair correction (D3) means T1-F10's and
T3-F4's independent-evidence counts are each one source lower than their
distillate lists suggest.

## 2. Upstream repositories & licenses

No external repository was a code donor at capture stage: the eleven
nuggets' distillates are papers and benchmarks, not portable code. Lane B
(complete 2026-08-06) confirmed it — no code was ported and no repository
opened — and surfaced two license-relevant artifacts this section now
records:

- The Pap2Pat code/data repository URL was recorded from its paper but
  **not opened** — license unverified ⇒ **reference only** under this
  file's own rule.
- HSNKB is **CC BY-NC 4.0** — the one non-permissive license in the
  ledger. Its 377-row/metric figures are currently distillate-carried
  (the publisher endpoint served a consent page); a license check and a
  full-text retry come before any SPEC quotes those tables
  ([`02-drafting-episode-frame.md`](../../../explorations/patent-drafting-episode-ledger/research/02-drafting-episode-frame.md) §12).

Any future code donor enters here with its license discipline (copyleft ⇒
clean-room only; permissive ⇒ port-with-attribution; missing/unverified ⇒
reference only) before any adoption.

## 3. External research sources

Populated 2026-08-06 by Lane B — the full per-URL ledger with access dates
is [`02-drafting-episode-frame.md`](../../../explorations/patent-drafting-episode-ledger/research/02-drafting-episode-frame.md) §11
(Sources), with failed/unverifiable fetches recorded in §12 (NOT FOUND /
NOT VERIFIED) rather than papered over. Source families: the primary legal
texts (35 U.S.C. § 112 and § 132; MPEP § 2163 and subsections; MPEP
§ 608.04 — official uscode.house.gov / uspto.gov pages), and the re-opened
public papers behind the eleven nuggets (agent-memory benchmark,
legal-GraphRAG retrieval/answer-policy sources, the inference-event study,
the normative-row/anti-hub benchmark, and the patent-drafting
traceability/evaluation/routing studies). Known limits recorded honestly:
one publisher endpoint served a consent page (full text distillate-only,
retryable), two distillates have no public URL, and one paper's "typed
failures" phrasing is a mining inference that must not be attributed to the
paper (§12).

## 4. In-repo capability references

Populated 2026-08-06 by Lane A ([`01-repo-surfaces.md`](../../../explorations/patent-drafting-episode-ledger/research/01-repo-surfaces.md))
— grounded file:line map of all composed surfaces, net-new re-confirmation
(§9, all eight symbols at zero source occurrences), nugget reconciliation
(§10), and an explicit corrections ledger (§ Corrections to inherited
anchors). Headline drift, attributed: PR #575 landed the full law-practice
lane including a payload-bearing append-only migration precedent (§4);
`goals/practice-kg-mcp` is live code with reusable row/decoder shapes, but
several catalog queries lack a unique tie-breaker and therefore do not yet
structurally guarantee the deterministic rows remo2 requires (§5);
the verified-span substrate is live and already consumed by #575 (§4, §7).
Known at capture (from the routing seed's grounded rows, now superseded by
the lane file where they differ):

- `@beep/agents-use-cases` — `ProfessionalRuntime` contracts
  (`RuntimeCandidateDraft`, `RuntimeApprovalGate`, `RuntimeEvidenceRef`,
  activities, usage) and the law-patent-intake runtime fixture — compose.
  Anchor correction (2026-08-06): the seed's `:428-490` span covers
  `RuntimeCandidateDraft` (`:428-446`) and `RuntimeApprovalGate`
  (`:473-491`) only; `RuntimeEvidenceRef` sits at `:209-222`,
  `RuntimeActivity` at `:608-623`, `RuntimeUsageRecord` at `:645-655` —
  Lane A re-grounds every anchor.
- `@beep/epistemic-use-cases` — `ExecutionLedger` append-only/hash-chain
  service precedent — precedent, never rebuilt.
- `@beep/law-practice-domain` — `Claim` model (number, independent flag,
  patent-asset reference, full text; no limitation support) plus the live
  law-practice tables/migration lane opened by the candor implementation
  (PR #575) — compose and extend beside.
- `goals/agentic-professional-runtime` SPEC — candidate drafts, evidence,
  strict human approval, deterministic fixtures — binding contract.
- `goals/hybrid-retrieval-fusion-core` SPEC — deterministic weighted RRF,
  exact-literal priority, stable ties, span preservation — composed
  substrate, never rebuilt.
- `goals/practice-kg-mcp` SPEC — read-only IP-law KG surface, deterministic
  docket rows, span-grounded candidates — composed substrate.
- `goals/citation-verified-span-substrate` SPEC — exact source-versioned
  support anchors — reused, never recreated.
- remo2 lane: `PracticeKgQuery` rows-first contract, bounded
  `SparqlQueryService`, disposable in-memory `@beep/rdf` dataset sessions —
  resolved boundary, binding.
- remo3 lane: `standards/memory-architecture/04-decision-log.md`
  (2026-08-01 clarification) and
  `explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md`
  boundaries — resolved boundary, binding.
- `DraftingEpisode`, `MemoryProjection`, `AnswerProvenanceAnnex`,
  `LegalInferenceEvent`, `NormativeRow`, `ClaimLimitationSupportSet`,
  `DraftingOutline`, `DraftingRouteState` — NET-NEW (zero symbols in source
  as of the 2026-08-01 rg sweep).

## 5. Cross-links & provenance

- Parent packet: [`../../legal-patent-kg-deepening/README.md`](../../../explorations/patent-drafting-episode-ledger/../legal-patent-kg-deepening/README.md)
  (routing seed, nugget ledger, campaign DECISIONS).
- Sibling wedges (graduated, stable boundaries — never reopened from here):
  `goals/patent-citation-candor-gate` (SPEC + live implementation PR #575,
  including the law-practice migration precedent) and
  `goals/legal-position-relator-runtime` (SPEC).
- Composed goal SPECs: `goals/agentic-professional-runtime`,
  `goals/hybrid-retrieval-fusion-core`, `goals/practice-kg-mcp`,
  `goals/citation-verified-span-substrate`.
- Memory-architecture boundary:
  `standards/memory-architecture/04-decision-log.md` (2026-08-01 entry;
  its 2026-08-06 role-retirement entry passes operator dev-memory from
  Cognee to basic-memory + codegraph with the operator/product boundary
  explicitly unchanged).
- This packet's decision log: [`../DECISIONS.md`](../../../explorations/patent-drafting-episode-ledger/DECISIONS.md); capture:
  [`../CAPTURE.md`](../../../explorations/patent-drafting-episode-ledger/CAPTURE.md).
