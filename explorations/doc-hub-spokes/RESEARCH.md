# Research

## 2026-10-28 — Pre-seeded from the design session

The external landscape was swept before this packet existed: six research lanes and a
synthesized report, plus six independent model reviews of a written brief. They are copied
under `research/` unchanged (home paths rewritten to packet-relative or `~/` paths). This
file summarizes them and adds the in-repo capability inventory the report did not have.

### External landscape (summary; the report is authoritative)

Read [`research/REPORT-2026-10-28-prior-art.md`](./research/REPORT-2026-10-28-prior-art.md).
Each claim there carries `[V]` verified this session, `[S]` snippet or secondary only, or
`[M]` from memory with the link not reopened. The per-area notes it was built from are in
[`research/notes/`](./research/notes/):

| Note | Area | One-line verdict |
| --- | --- | --- |
| `positioned_codecs.md` | lossless positioned parse, located findings, stale spans, streaming | Finding shape is an industry consensus (LSP, SARIF, ESLint, Biome, rustc, Nu checker, Tricorder). Typed loss ledger + stale-aware source map not found; Pandoc is the nearest hub-and-spokes; lens theory is the formal shape. Check MyST, djot, mammoth.js before claiming novelty. |
| `typed_llm_admission.md` | structured outputs, constrained decoding, validate-and-repair, generative UI, fx0 | Coding agents already run parse → located error → span edit (SWE-agent, RustAssistant, TypeChat). Nobody runs it over documents with domain rules. Constrained decoding is the opposite design. |
| `document_rule_oracles.md` | patent drafting tools, rules-as-code, clinical/financial validators, rejection corpora | Tier 1 is a commodity Word add-in (ClaimMaster, Patent Bots) with no published precision; nobody does tier 2 term resolution; nobody feeds findings to a drafting agent. PEDANTIC is the labeled corpus. FHIR validator-in-the-loop (2026) is the nearest working loop in any document domain. |
| `provenance_gating.md` | PROV-O, BFO, SHACL, in-toto/SLSA, argumentation theory, calibrated confidence | in-toto maps clause-for-clause onto the novelty obligation but per artifact, not per judgment, with no feedback. Carneades/ASPIC+ are the precedent for probabilistic content with deterministic acceptance. Obligations must never be OWL axioms. Four process-theater failure modes named. |
| `rule_dsls.md` | LinkML, Ash/Spark, Alchemy, Effect `SchemaRepresentation`, Catala, LegalRuleML | LinkML's own docs: one closed-world source, OWL for vocabulary, SHACL for obligations, losses at every projection. Nothing maps DDD to an ontology. Rule bodies must be data, not closures. `SchemaRepresentation` is the serializable-AST carrier candidate. |
| `diagnostics_as_signal.md` | RLVR/RLEF, rubric rewards, Tricorder, feedback-quality studies | Systematic verifier error stalls training; random noise does not. Tricorder's admission bar. No published deterministic located document rule as reward or measured repair loop. Span repair not established as the winner. |

The panel reviews ([`research/panel/`](./research/panel/)) answer the six questions in
[`PANEL-BRIEF.md`](./research/panel/PANEL-BRIEF.md); their agreements, splits and new ideas
are digested in `CAPTURE.md` §5 and in section 8 of the page in `assets/`.

### In-repo capability inventory

Live source checked on 2026-10-28 (`rg` over `packages/**` and `goals/**`). Package paths
are under `packages/foundation/modeling/` unless stated.

| Capability | Where | Status for this packet |
| --- | --- | --- |
| Semantic document model, constructors, `SafeDocument`, URL policy | `@beep/md` (`md/src/Md.model.ts`, `Md.safe.ts`, `Md.escape.ts`) | **reuse**; becomes the hub |
| Markdown string writer (`Md.render`), ~1,800 lines | `md/src/Md.render.ts` | **replace** by projection to `@beep/markdown` `Root` + `Markdown.stringify` |
| Syntax-to-semantic fold with 20 loss reasons and fingerprinted source map (`positionAt` → `Option.none` on stale) | `@beep/md/Md.syntax`, `@beep/md/Md.parse` (`md/src/Md.syntax.ts`, `Md.parse.ts`, `internal/syntax/`) | **move** into `@beep/markdown` (effected-promotion D-50 remedy) |
| CommonMark + GFM parser, byte offsets, offset-splice `MarkdownEdit`, `Markdown.fromString` two-way codec, fidelity fields, 731-example conformance corpus + bridge ledger | `@beep/markdown` (`markdown/src/`, `data/conformance/`) | **reuse**; the model spoke |
| Typed HTML AST, author conformance, deny-by-default policy, opaque `SafeHtml`, serializer; **no string parser** | `@beep/html` (`html/src/Html.conformance.ts`, `Html.policy.ts`, `Html.serialize.ts`) | **reuse**; **NET-NEW**: positioned HTML string parser with WHATWG parse-error codes (parse5 `sourceCodeLocationInfo` is the reference) |
| `renderSafeHtml`, `Document.toHtml` | `md/src/Md.html.ts` | **move** into `@beep/html` |
| Lexical and Pandoc projections (already depend on the hub) | `@beep/lexical-schema` (`lexical/src/Lexical.codec.ts`), `@beep/pandoc-ast` (`pandoc-ast/src/Pandoc.mapping.ts`, `Pandoc.codec.ts`) | **reuse**; the pattern every spoke should follow |
| RDF projection | `@beep/rdf` (`rdf/src/`) | **reuse**; candidate carrier for SHACL-shaped obligations over a provenance graph |
| Span provenance: `TextAnchor`, `VerifiedTextAnchor`, `TextAnchorVerificationReceipt` | `@beep/provenance` (`provenance/src/TextAnchor.ts`, `VerifiedTextAnchor.ts`) | **reuse**; the witness and receipt seed (runtime-minted, cf. panel) |
| Epistemic vocabulary: `EvidenceSpan` (anchor + confidence), `ClaimGate`, `ClaimGateViolation`, contradictions, intervals, claim envelopes | `@beep/epistemics` (`epistemics/src/EvidenceSpan/`, `ClaimGate/`) | **reuse**; the finding and obligation seed |
| Streamed block validation with batched JSON Patch repair (2 attempts) | `packages/agents/server/src/AssistantTurn/BlockRepair.ts` | **reuse** as experiment arm A (JSON Patch baseline) |
| Span-anchored claim-element tree, pure decomposer, advisory §112(b) antecedent-basis and dependency checker; typed `AntecedentFinding` with referring-term span and kinds `missing-antecedent`, `ambiguous-antecedent`, `antecedent-outside-chain`, `pattern-not-covered`; measured on public USPTO claims; findings reach the attorney as `claim-finding` review items | `goals/claim-element-antecedent-check` (active; `@beep/law-practice-domain`, `@beep/law-practice-use-cases`), graduated from `explorations/claim-element-graph` | **reuse, and the first constraint**: the two-week experiment's rules 1 and 2 already have an owner; `pattern-not-covered` is a coverage finding in miniature. This packet's experiment must run on that tree, not re-implement it over the Markdown tree |
| Pandoc AST foundation | `goals/pandoc-ast-foundation` (completed-retained), from `explorations/docx-roundtrip-interop` | **reuse**; the docx spoke's base |
| Patent document schema, document AST pattern classification, SPAR annotation wire | `goals/patent-document-schema`, `goals/document-ast-pattern-classification`, `goals/spar-document-annotation-wire` (from `explorations/document-structure-ontologies`) | **inspect in align**: where the domain layer sits relative to the hub (Opus/Grok: "the Md hub sits below the claims model where the rules live") |
| Citation-verified span substrate, citation extraction engine | `goals/citation-verified-span-substrate`, `goals/citation-extraction-engine` (from `explorations/citation-grounding-hallucination-guard`) | **reuse** for the source-validation sub-checks of tier 3 (link resolves, quote present) |
| Evidence source policy calibration | `explorations/evidence-source-policy-calibration` (parked at shape) | **re-read in align**: the approved-source list and calibration questions overlap tier 3 |
| Ontology tooling: OWL 2 / ROBOT / SHACL / competency questions / BFO alignment / foundational auditor | `.claude/skills/ontology-*` | **reuse** for the process-ontology and profile work |
| Serializable schema AST with JSON round-trip and per-target exact/approximate tags | Effect v4 `SchemaRepresentation` (`~/YeeBois/references/effect/effect/packages/effect/src/SchemaRepresentation.ts`, MIT) | **reuse** as the DSL carrier candidate |
| DDD declarative DSL reference (`Domain.Command/Event/Aggregate/Projection/Policy/Saga`, `Story`, `Domain.verify`) | `@alchemy.run/domain` (`~/YeeBois/references/effect/alchemy/packages/domain/src`, Apache-2.0) | **reference**: authoring ergonomics only; `decide` handlers are closures and cannot project |
| HTML string parser with positions | — | **NOT FOUND** in repo |
| Typed CSS model, restricted script language | — | **NOT FOUND** in repo; `@opencode/codemode` (`~/YeeBois/references/effect/opencode/packages/codemode`) is the reference for the script subset |

### Constraints surfaced

1. **Do not re-implement antecedent basis.** `goals/claim-element-antecedent-check` owns it.
   The experiment's novelty is the loop (located findings, span repair, kill criteria), not
   the rule.
2. **Where the domain layer lives is an open architectural question**, not a detail: the
   patent rules operate on a claim-element tree above the document hub. Align must decide
   whether domain profiles add node kinds, annotate, or project into a separate graph (RDF +
   SHACL) and map findings back through the source map.
3. **effected-promotion is a written non-goal boundary**: convergence of `@beep/md` and
   `@beep/markdown` on one tree stays out; the hub-and-spokes inversion is a D-02/D-50
   amendment, and effected-promotion closes on schedule.
4. **Corpus hygiene**: public patent material only (granted claims, published applications,
   PEDANTIC, Office Action datasets); nothing from the out-of-repo corpus enters a lane.
5. **Precision bar before any agent sees a rule**: Tricorder's admission rule, scored at
   span level, split by art unit and examiner; systematic bias is the failure mode to measure.
6. **Obligations are closed-world**: SHACL/Datalog/Rego, never OWL axioms. Reasoner and
   entailment regime pinned and recorded.
7. **Witnesses are runtime-minted**: the agent never writes its own provenance; judge
   attempts are capped.
8. **Cursor seat** is unavailable for lanes until 2026-11-11; open-weight seats go through the
   proxy's Venice provider.

### Gaps still open after research

- MyST, Quarto, djot and mammoth.js were not checked for a typed loss ledger.
- PEDANTIC's release and license are unconfirmed.
- No public §112(a) written-description corpus exists; building one with PEDANTIC's
  extraction pipeline is a candidate sub-goal.
- The Thesys C1 wire format and fx0's edit mechanism (regenerate vs replace) were not resolved.
- Whether the Md fold is lossy on real claim sets (Grok's week-one measurement) is unmeasured.
