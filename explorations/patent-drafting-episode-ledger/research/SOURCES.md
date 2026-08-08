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
  [`nugget-catalog.json`](../../legal-patent-kg-deepening/research/nugget-catalog.json)
  (46 rows); this packet consumes nuggets `T1-F10`, `T3-F4`, `T3-F5`,
  `T3-F10`, `T4-F7`, `ADHD-3` (primary) and `T4-F1`, `T4-F2`, `T4-F3`,
  `T4-F4`, `ADHD-2` (absorbed first rung).

## 1. Mined source corpus

Inherited by reference from the parent campaign — the nuggets' distillates
live in `explorations/legal-patent-kg-deepening/research/mined/` (see each
nugget's distillate list in [`CAPTURE.md`](../CAPTURE.md)). No new corpus is
mined for this wedge; links, not copies. The two deepened plays (`ADHD-2`,
`ADHD-3`) are not verified findings — research Lane B re-grounded their
boundary language against the primary public sources 2026-08-06
([`02-drafting-episode-frame.md`](./02-drafting-episode-frame.md)).
Catalog hygiene found by Lane B (§11): the parent `00-catalog.json` has
`url: null` for all 17 papers behind this wedge's nuggets — every URL was
re-discovered this lane and lives in the lane file's §11; two papers were
retitled at source (D1, D2) and distillates P018/P019 are one work (D3), so
T3-F4's evidence count is one source lower than the seed suggests.
Promotion of these findings into the parent catalog is a parent-packet act
that pends align/PR 2, per the sibling precedent.

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
  ([`02-drafting-episode-frame.md`](./02-drafting-episode-frame.md) §12).

Any future code donor enters here with its license discipline (copyleft ⇒
clean-room only; permissive ⇒ port-with-attribution; missing/unverified ⇒
reference only) before any adoption.

## 3. External research sources

Populated 2026-08-06 by Lane B — the full per-URL ledger with access dates
is [`02-drafting-episode-frame.md`](./02-drafting-episode-frame.md) §11
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

Populated 2026-08-06 by Lane A ([`01-repo-surfaces.md`](./01-repo-surfaces.md))
— grounded file:line map of all composed surfaces, net-new re-confirmation
(§9, all eight symbols at zero source occurrences), nugget reconciliation
(§10), and an explicit corrections ledger (§ Corrections to inherited
anchors). Headline drift, attributed: PR #575 landed the full law-practice
lane including a payload-bearing append-only migration precedent (§4);
`goals/practice-kg-mcp` is live code whose deterministic rows are
structurally guaranteed by a total `ORDER BY` on every catalog query (§5);
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

- Parent packet: [`../../legal-patent-kg-deepening/README.md`](../../legal-patent-kg-deepening/README.md)
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
- This packet's decision log: [`../DECISIONS.md`](../DECISIONS.md); capture:
  [`../CAPTURE.md`](../CAPTURE.md).
