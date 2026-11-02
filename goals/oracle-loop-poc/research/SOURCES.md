# Oracle Loop POC — Sources & Provenance

- **Source exploration:** `explorations/doc-hub-spokes` — primary ledger:
  [`explorations/doc-hub-spokes/research/SOURCES.md`](../../../explorations/doc-hub-spokes/research/SOURCES.md).
  The six research notes, the six panel reviews and the synthesized prior-art report live
  under [`explorations/doc-hub-spokes/research/`](../../../explorations/doc-hub-spokes/research/)
  and are not copied here.

## 1. Mined source corpus

None yet. No upstream code is ported for the POC; parse5 and Pandoc are used as dependencies.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| parse5 (npm) | MIT (verify on install; record the version) | direct dependency in the lab (D-02) | HTML5 parsing with `sourceCodeLocationInfo` and `onParseError` |
| Pandoc (binary, via `@beep/pandoc-ast`) | GPL-2.0-or-later (binary invoked as a tool, not linked) | tool invocation only; no code taken | .docx to Pandoc JSON |
| `~/YeeBois/references/effect/effect` | MIT | dependency | `SchemaRepresentation` (only if the POC reaches rule serialization; otherwise out of scope) |

## 3. External research sources

The load-bearing ones for this goal (full list with verification tags in the exploration's
report and notes):

| Source | Why it matters here |
|--------|---------------------|
| PEDANTIC, arXiv 2505.21342 | labeled corpus for the patent profile's precision score; release and license unconfirmed |
| Google Tricorder, ICSE 2015 | the precision bar every rule clears before entering the loop |
| Olausson et al., ICLR 2024; FeedbackEval, arXiv 2504.06939 | feedback quality limits repair; structured located feedback beats raw messages |
| "Delay, Plateau, or Collapse", arXiv 2605.02909 | systematic verifier error is the dangerous kind; score for bias |
| SWE-agent ablation (edit interface) and Aider diff-format findings | span edit via a deterministic splicer is the best-supported repair pattern |
| in-toto / SLSA | layout as process axioms; the red-team's model of what a gate can and cannot prove |
| FHIR validation (FHIRPath over XPath) | findings addressed by model path, not notation offsets (D-08) |
| MPEP §2173.05(e) | implicit antecedent basis: advisory severity for the flagship patent rule |

## 4. In-repo capability references

| Brick | Path | Disposition |
|-------|------|-------------|
| Markdown codec, source map, losses, `MarkdownEdit` | `packages/foundation/modeling/markdown`, `@beep/md/Md.syntax` | reuse |
| Doc hub model, `SafeDocument`, URL policy | `packages/foundation/modeling/md` (becomes `@beep/doc`) | reuse |
| HTML model, conformance, policy, serializer | `packages/foundation/modeling/html` | reuse; parser via parse5 in the lab |
| .docx intake | `packages/foundation/modeling/pandoc-ast`, `goals/pandoc-ast-foundation` | reuse |
| Span provenance and receipts | `packages/foundation/modeling/provenance` | reuse; path half of `Location` NET-NEW |
| Epistemic gates, evidence spans | `packages/foundation/modeling/epistemics` | reuse as seeds |
| Antecedent-basis finding stream | `goals/claim-element-antecedent-check` (`@beep/law-practice-domain`, `@beep/law-practice-use-cases`) | reuse; never re-implemented |
| JSON Patch block repair | `packages/agents/server/src/AssistantTurn/BlockRepair.ts` | reuse as arm A |
| SHACL / RDF drivers | `packages/drivers/shacl`, `packages/drivers/n3`, `packages/drivers/oxigraph`, `packages/foundation/modeling/rdf` | reuse if obligations are reached |
| Lab scaffold | `bun run beep create-package --lab`, `apps/labs/README.md` | reuse |
| Core shapes (Location, Finding, Coverage, Obligation, Witness, Profile) | lab-local | NET-NEW |

## 5. Cross-links & provenance

- Exploration: `explorations/doc-hub-spokes` (`CAPTURE.md`, `RESEARCH.md`, `DECISIONS.md`
  D-01..D-12, `BRIEF.md`, `MAP.md`).
- Sibling goal: `goals/doc-hub-spokes-inversion` (the rename this POC rewires to).
- Gated successors named in the exploration's `MAP.md`: `html-spoke-parser`,
  `doc-core-promotion`, `rule-dsl-projections`, `process-admissibility-gate`.
- Page that carried the design discussion:
  `explorations/doc-hub-spokes/assets/md-hub-and-spokes-v6.html`.
