# Doc Hub and Spokes — Sources & Provenance

- **Cluster / origin:** a 2026-10-28 design session; a written panel brief
  ([`panel/PANEL-BRIEF.md`](./panel/PANEL-BRIEF.md)) reviewed by six models in separate
  sessions; a six-lane deep-research sweep synthesized into
  [`REPORT-2026-10-28-prior-art.md`](./REPORT-2026-10-28-prior-art.md).
- **Provenance:** every claim in the report is tagged `[V]` (verified that session), `[S]`
  (search snippet or secondary write-up), or `[M]` (memory, link not reopened). Treat `[S]`
  and `[M]` as unverified until reopened. The panel reviews are opinions, not sources.

## 1. Mined source corpus

Not applicable yet. No upstream code has been mined or ported for this packet. The scratch
program `scratchpad/temp/` is repo-authored.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `~/YeeBois/references/effect/alchemy` (`@alchemy.run/domain`) | Apache-2.0 (read from `LICENSE` and `packages/domain/package.json`) | port-with-attribution if any code is taken; so far reference-only | the declarative-class DSL shape (`Domain.Command/Aggregate/Projection/Policy`, `Story`, `Domain.verify`); the lesson that closure handlers cannot project |
| `~/YeeBois/references/effect/effect` (`effect`, v4) | MIT (`packages/effect/package.json`) | port-with-attribution / direct dependency | `SchemaRepresentation` as the serializable schema-AST carrier candidate |
| `~/YeeBois/references/effect/opencode/packages/codemode` | not verified this session | reference-only until the license is read | the restricted-interpreter stance for inline script (parse to a defined subset, `UnsupportedSyntax` with location) |
| `~/YeeBois/workstation-apps/fx0` (vercel-labs/fx0) | not verified this session | reference-only | the raw-HTML design-agent baseline (speed, screenshot-only feedback) |
| parse5 | not verified this session | reference-only until read | WHATWG parse-error codes with `sourceCodeLocationInfo` as the reference for the NET-NEW HTML spoke parser |

## 3. External research sources

All URLs below appear in [`REPORT-2026-10-28-prior-art.md`](./REPORT-2026-10-28-prior-art.md)
or in [`notes/`](./notes/) (110 distinct URLs in the report alone; the full list is there,
with the verification tag per claim). The load-bearing ones:

| Source | Why it matters | Where cited |
|--------|----------------|-------------|
| PEDANTIC, arXiv 2505.21342 (`https://arxiv.org/html/2505.21342v2`) | 14.5k claims with located §112(b) reasons; the experiment's labeled corpus; LLM baseline ~55-57% | report "Corpora and precision bars"; `notes/document_rule_oracles.md` |
| "Vibe Patenting", arXiv 2609.13422 (`https://arxiv.org/html/2609.13422v2`) | judge-vs-attorney correlation per rubric dimension (0.83 / 0.04 / 0.10): the tier split, measured | report "Patent rule oracles"; `notes/document_rule_oracles.md` |
| Google Tricorder, ICSE 2015 (link in `notes/diagnostics_as_signal.md`) | the admission bar for an oracle: <10% effective false positives advisory, ~0 blocking, hand-labelled sample before admission | report "Deterministic document oracles"; `notes/diagnostics_as_signal.md` |
| Olausson et al., ICLR 2024 (`https://arxiv.org/abs/2306.09896`) | feedback quality, not repair mechanics, limits self-repair | `notes/typed_llm_admission.md`, `notes/diagnostics_as_signal.md` |
| "Delay, Plateau, or Collapse", arXiv 2605.02909 (`https://arxiv.org/pdf/2605.02909`) | systematic verifier error stalls or collapses RL; random noise does not | `notes/diagnostics_as_signal.md` |
| Cai et al. 2025, arXiv 2510.00915 (`https://arxiv.org/html/2510.00915v1`) | LLM verifiers score better but get gamed more | `notes/diagnostics_as_signal.md` |
| PoLL, arXiv 2404.18796 (`https://arxiv.org/abs/2404.18796`) | cross-family judge panels agree better with humans; agreement is not correctness | `notes/provenance_gating.md` |
| Trust-or-Escalate, arXiv 2407.18370 (`https://arxiv.org/pdf/2407.18370`) | only guarantee-bearing calibration justifies a fixed routing threshold | `notes/provenance_gating.md` |
| Ontological Knowledge Blocks, arXiv 2605.23297 (`https://arxiv.org/abs/2605.23297`) | PROV-O + SHACL governance profiles; stacking only ever added violations (monotonic profiles) | `notes/provenance_gating.md` |
| PROV-AGENT, arXiv 2508.02866 (`https://arxiv.org/abs/2508.02866`) | records agent activity in PROV, checks nothing | `notes/provenance_gating.md` |
| Catala-based legal verifier, arXiv 2606.23913 (`https://arxiv.org/abs/2606.23913`) | nearest "deterministic legal verifier as reward"; no numbers | `notes/document_rule_oracles.md`, `notes/diagnostics_as_signal.md` |
| FHIR validator-in-the-loop, arXiv 2607.14167 (`https://arxiv.org/abs/2607.14167`) | located, value-bearing feedback beats raw validator messages | `notes/document_rule_oracles.md` |
| LinkML paper, GigaScience 15 giaf152 (link in `notes/rule_dsls.md`) and generator docs | one closed-world source → OWL (vocabulary) + SHACL (obligations), with documented losses | `notes/rule_dsls.md`; report "LinkML proves one source splits into two semantics" |
| A2UI spec v0.8 (`https://a2ui.org/specification/v0.8-a2ui/`), json-render, Thesys C1 | generative-UI JSON specs: streaming design, no published repair loop | `notes/typed_llm_admission.md` |
| Aider "code in JSON" (`https://aider.chat/2024/08/14/code-in-json.html`); "Let Me Speak Freely?" (EMNLP 2024, link in notes) | free notation vs JSON-constrained output evidence | `notes/typed_llm_admission.md` |
| in-toto / SLSA specs (links in `notes/provenance_gating.md`) | layout steps as process axioms; signed links as witnesses; implicit-allow trap | `notes/provenance_gating.md` |
| TypeSafe docs (`https://docs.typesafe.ai/llms.txt`) | System One typed questions (Choice/Score/Noul) with probability and separate confidence; confidence-gated routing | brief; `notes/provenance_gating.md` |
| MPEP §2173.05(e) (link in `panel/astra.md`) | implicit antecedent basis: the flagship tier-1 rule has a tier-3 tail | `panel/astra.md` |
| Dafny `modifies` (link in `panel/astra.md`) | frame conditions for repairs | `panel/astra.md` |

## 4. In-repo capability references

See the inventory table in [`../RESEARCH.md`](../RESEARCH.md). Summary of dispositions:

- **reuse**: `@beep/md` model/safe/escape; `@beep/markdown`; `@beep/html` conformance, policy,
  serializer; `@beep/lexical-schema`; `@beep/pandoc-ast`; `@beep/rdf`; `@beep/provenance`;
  `@beep/epistemics`; `BlockRepair.ts`; `goals/claim-element-antecedent-check` (active);
  `goals/pandoc-ast-foundation`; citation goals; ontology skills.
- **move**: `Md.syntax`/`Md.parse` → `@beep/markdown`; `Md.html` → `@beep/html`.
- **replace**: `Md.render` string writer → projection + `Markdown.stringify`.
- **NET-NEW**: positioned HTML string parser; typed CSS model; restricted script subset;
  the finding/obligation/witness/profile core; the rule DSL facade and its OWL/SHACL
  projections.

## 5. Cross-links & provenance

- Session artifact (private): `https://claude.ai/artifact/ECAVTFZVk36cEE1ULqsEbR`; local copy
  [`../assets/md-hub-and-spokes-v6.html`](../assets/md-hub-and-spokes-v6.html).
- Parent packets: `goals/effected-promotion` (D-02, D-38, D-43, D-44, D-48–D-52; D-02/D-50
  amendment pending), `explorations/claim-element-graph` →
  `goals/claim-element-antecedent-check`, `explorations/docx-roundtrip-interop` →
  `goals/pandoc-ast-foundation`, `explorations/document-structure-ontologies`,
  `explorations/citation-grounding-hallucination-guard`,
  `explorations/evidence-source-policy-calibration` (parked).
- This packet: [`../CAPTURE.md`](../CAPTURE.md), [`../RESEARCH.md`](../RESEARCH.md),
  [`panel/`](./panel/), [`notes/`](./notes/),
  [`REPORT-2026-10-28-prior-art.md`](./REPORT-2026-10-28-prior-art.md).
- Scratch program: `scratchpad/temp/` (tracked).
