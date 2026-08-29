# Academia Corpus Mining — Sources & Provenance

<!--
The provenance ledger for this packet. Start it in the `research` stage and keep
it current through graduate; the graduated goal inherits a copy. Purpose: let an
implementing agent trace every decision back to its origin — a mined source
(repo + file:line), an upstream repo + LICENSE, an external citation, or an
in-repo brick.

RULES
- Never fabricate a URL/DOI/repo link. Reproduce only sources that actually
  appear on disk in RESEARCH.md / research/*.md; if a claim has no on-disk URL,
  cite the RESEARCH.md section that carries it instead.
- Licenses are load-bearing: copyleft (AGPL/GPL/MPL) upstream is CLEAN-ROOM
  reimplement only (pattern, not vendored code); permissive (MIT/Apache/BSD) may
  be ported WITH attribution; missing/unverified LICENSE ⇒ treat as reference
  only. State the discipline per repo.
- Register this file in ops/manifest.json `exploration.sources`.
-->

- **Cluster / origin:** an Academia.edu recommendation download of 524
  paper files — 519 PDFs plus five non-PDF papers
  (acquired in the transient machine-local `research-7-24-26` pile, waves
  2026-06-29 and 2026-07-24/25) —
  normalized to **443 canonical papers** and mined through a tiered
  triage → deep-read → synthesis pipeline. (The "444 unique titles" figure
  in early capture notes was the preliminary filename-title estimate.)
- **Provenance:** upstream prior synthesis
  [`prior-synthesis-legal-ontologies.md`](./prior-synthesis-legal-ontologies.md)
  (June-29 multi-agent run, 72 papers deep-read); adversarial snippet audit
  under [`../reviews/`](../reviews/); pipeline state and job ledger in the
  external library (below).

## 1. Mined source corpus

The corpus is **papers, not code** — the file-level inventory is
[`paper-catalog.jsonl`](./paper-catalog.jsonl): one `catalog-meta` header
line followed by one JSON line per paper (443 paper rows, 444 lines total;
filter with `jq 'select(.kind != "catalog-meta")'`). Per-paper fields:
sha256-derived id, normalized title, download wave, lens, T1
relevance/verdict, disposition vs the standing library, T2 tier where
deep-read. Full texts and PDFs
stay OUTSIDE this public repo (copyright):
`~/YeeBois/research/academia-2026-07/` — see
[`INVENTORY.md`](./INVENTORY.md) for its layout.

**How these inform this packet:** four mining lenses map the corpus onto live
repo streams — memory/bitemporal (No-Escape corroboration), legal ontology &
semantic foundation, retrieval/citation grounding/doc structure, and agent
architecture. The seven cluster syntheses live in this directory as
`t3-*.md`, the repo-grounded master synthesis as
[`t3-master-synthesis.md`](./t3-master-synthesis.md) (canonical routing
table + align-stage questions); RESEARCH.md carries the compressed map and
the high-priority routes.

## 2. Upstream repositories & licenses

None vendored or ported by this packet. Papers are treated as idea/pattern
sources only; any future code adoption goes through the normal license
check at that packet's boundary.

## 3. External research sources

- The 443-paper catalog: [`paper-catalog.jsonl`](./paper-catalog.jsonl).
  Academia.edu recommendation downloads carry no stable canonical URLs/DOIs;
  where the T2 shortlist gains verified canonical metadata (DOI/venue) via
  enrichment, it is recorded in the per-paper notes and cluster reports —
  URLs appear there only when actually verified, never reconstructed.
- Prior synthesis (adopted, tracked):
  [`prior-synthesis-legal-ontologies.md`](./prior-synthesis-legal-ontologies.md)
  — its §10 Part 1 enumerates the 72 previously deep-read papers; its Part 2
  describes a ~240-paper catalogued backlog (bucket counts only, no titles).
  **Errata:** treat its code snippets as historical only — the adversarial
  audit ([`../reviews/2026-07-25-codex-prior-synthesis-snippet-audit.md`](../reviews/2026-07-25-codex-prior-synthesis-snippet-audit.md))
  verified defects in 36/56 TypeScript fences (13 findings, 7 foundational)
  against vendored Effect 4.0.0-beta.101 and live `@beep/*` sources.
- Prior-72 reconstruction provenance: the deep-read exclusion list was
  rebuilt from §10 Part 1 (72/72 rows recovered, high confidence) plus 10
  possible-alias entries (medium/low) — details in the external library
  `state/prior-deep-read-notes.md`.

## 4. In-repo capability references

The repo streams this packet mines against (reuse — none modified here):

| Stream | Path | Role in this packet |
|--------|------|---------------------|
| No-Escape doctrine | `standards/memory-architecture/00-no-escape-theorem.md` | corroboration target, lens 1 |
| Bitemporal edge core | `goals/epistemic-bitemporal-edge-core/SPEC.md` | lens 1 |
| Semantic foundation | `goals/semantic-foundation/SPEC.md` | lens 2 |
| Identity as IRI | `goals/identity-iri-fold/README.md` | lens 2 |
| Hybrid retrieval fusion | `goals/hybrid-retrieval-fusion-core/SPEC.md` | lens 3 |
| Citation-verified spans | `goals/citation-verified-span-substrate/SPEC.md` | lens 3 |
| Citation extraction | `goals/citation-extraction-engine/SPEC.md` | lens 3 |
| OA doc structure | `goals/law-doc-structure-oa-slice/SPEC.md` | lens 3 |
| Citation grounding prose | `docs/product/citation-grounding.md` | lens 3 |
| Prose-to-Proof prose | `docs/product/prose-to-proof.md` | lenses 1/4 |
| Ingestion secret scrub | `goals/ingestion-secret-scrub/SPEC.md` | lens 4 |

## 5. Cross-links & provenance

- Sibling prior art: [`explorations/legal-ontology-landscape`](../../legal-ontology-landscape/)
  (lens-2 context), [`explorations/_gold-intake`](../../_gold-intake/)
  (routing-table precedent),
  [`explorations/graph-3d-navigation`](../../graph-3d-navigation/)
  (external-corpus + committed-inventory precedent).
- This packet's own [`DECISIONS.md`](../DECISIONS.md) (7 grill decisions +
  checkpoint decisions) and [`CAPTURE.md`](../CAPTURE.md) (corpus provenance).
- Adversarial reviews: [`../reviews/`](../reviews/) — prior-synthesis snippet
  audit (Effect v4 / `@beep/*` API fidelity) and the S8 research QA gate.
- Pipeline job ledger (external): `~/YeeBois/research/academia-2026-07/ops/jobs.jsonl`.
