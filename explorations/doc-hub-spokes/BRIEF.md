# Brief

<!-- Stage 3. Shape Up pitch at fat-marker fidelity. -->

## Problem

Agents produce excellent work product in code because the domain ships its own oracle:
compiler, types, tests, linters, each deterministic, located, cheap. Every other domain has
the rulebook but no oracle, so the only backpressure is slow, partial human review whose
intent the agent must infer. beep-effect already owns most of the pieces of such an oracle
(a lossless positioned Markdown parser with a source map and typed losses, a typed HTML model
with conformance and policy, a semantic document model with a trust refinement, span
provenance and epistemic gates, a streamed block-repair loop, Pandoc and Lexical
projections, SHACL/RDF drivers, an active span-anchored antecedent-basis checker) but they
point in inconsistent directions and have never been composed into a loop. Nobody outside
has composed them either (see `research/REPORT-2026-10-28-prior-art.md`).

Two things are wrong today and one is missing. `@beep/md` depends on `@beep/markdown` and
`@beep/html` while lexical and pandoc depend on it, so the hub is heavier than a hub should
be and carries a 1,800-line string writer the markdown spoke already supersedes. There is no
positioned HTML parser. And there is no core vocabulary for findings, obligations, witnesses,
coverage and profiles that every judge, codec and domain can share.

## Appetite

- **POC:** two weeks of lane time in a lab app, kill criteria pre-registered, third-party
  dependencies allowed (D-02). Outcome is a go/no-go on graduating the core, not a product.
- **Hub inversion:** a separate, bounded goal (rename plus two edge flips plus the writer
  projection), gated only on the effected-promotion amendment row, not on the POC.

## Solution sketch

### A. The lab app (`apps/labs/<name>`, `bun run beep create-package --lab`)

1. **Core shapes, lab-local for now** (NET-NEW; candidates for `@beep/doc` if the POC holds):
   `Location` (model path primary; span derived per codec, D-08), `Finding` (location,
   rule id with version, severity, message, evidence, judge identity, confidence,
   repair-applicability, fix edits), `Coverage` (which paths which rules examined; known
   unchecked), `Obligation` (what discharges it, which judge classes may, D-09), `Witness`
   (runtime-minted, receipt-shaped like `TextAnchorVerificationReceipt`), `Profile` (a
   specification plus rules; stacking only adds findings). All Effect Schema; rule bodies
   are data, not closures.
2. **Three codecs into the hub:** `@beep/markdown` fold (reuse); HTML via parse5 with
   `sourceCodeLocationInfo` and `onParseError` (D-05) folded into `@beep/html`'s model and
   then the hub; .docx via Pandoc and `@beep/pandoc-ast` (D-11). Each codec owes the
   path-to-location projection and a loss ledger row per unsupported construct.
3. **Generic profile:** WHATWG author conformance and the deny-by-default policy from
   `@beep/html`, heading order (proven by the html spoke, D-10), URL policy, a small theme
   token vocabulary. No law.
4. **Patent profile, stacked:** consume `goals/claim-element-antecedent-check`'s
   `AntecedentFinding` stream (D-06) over the same documents, including .docx claim sets,
   mapping its kinds into `Finding` and `pattern-not-covered` into `Coverage`. Domain
   structure is a separate graph keyed by path (D-09).
5. **The loop harness (first deliverable, D-03):** agent text in (an Opus 5.5 child or
   Codex lane), admission, findings out, repair by model-proposed edit applied by a
   deterministic splicer (`MarkdownEdit` for Markdown; path-addressed replace for docx),
   incremental re-validation on changed regions, findings mapped through the agent's own
   edits before fingerprint staleness. One frame condition on at least one repair
   (protected commitments survive). Metrics recorded per run.
6. **A thread-style page** that renders findings inline on spans and applies repairs live,
   after the harness converges.

### B. Measurement (pre-registered)

- Precision of generic-profile findings against a hand-labelled sample: Tricorder bar
  (under 10% effective false positives advisory; blocking essentially zero).
- Patent profile against PEDANTIC spans and a mutation corpus from public claim sets.
- Four repair arms (JSON Patch blocks; prose findings plus regenerate; located findings plus
  regenerate; located findings plus span repair): iterations and tokens to zero blocking
  findings, findings introduced by repair, stale-finding rate, vacuity test (oracle-driven
  drafts must not be measurably narrower).
- Red-team: an agent told only a process gate must not clear it with garbage in an afternoon.

### C. The hub inversion (separate goal)

Phase 0 rename `@beep/md` to `@beep/doc` (namespace `Doc`, D-04). Then `Md.syntax`/`Md.parse`
into `@beep/markdown`; `Md.render` replaced by a `Doc.Document -> Root` projection plus
`Markdown.stringify`, validated against the bridge corpus and the 2d-3 differential; `Md.html`
into `@beep/html`; `SafeDocument` trimmed to hub-native rules (D-10). One effected-promotion
Decision Log row amending D-02 and D-50.

## Rabbit holes

- Vendoring and hardening parse5 (D-38 recipe). Not in the POC.
- The declarative rule DSL and its OWL 2 / SHACL projection. The POC uses Effect Schema
  rules as data and the existing SHACL driver if it reaches obligations; the DSL facade and
  `SchemaRepresentation`-based projection are a later goal.
- A novelty judge or any tier 3 content judgment. The POC gates process only, and only to
  red-team it.
- Full bitemporality. The POC carries a rule version id on every finding; valid-time axes
  come later.
- Thread UI polish, streaming validation of partial output, CSS and script spokes.
- Training or fine-tuning on the ledger.

## No-gos

- No merge of `@beep/markdown` into `@beep/md`, no single AST (effected-promotion D-02 holds).
- No POC code in a product app; no changes to professional-desktop for the POC.
- No re-implementation of antecedent-basis rules; `claim-element-antecedent-check` owns them.
- No rule enters the agent loop below the precision bar; no finding without a location.
- No new paid endpoints or overages; the Cursor seat is unavailable until 2026-11-11.
- Nothing from the out-of-repo corpus; public patent material only.
- The core must stay domain-free (D-01): the patent profile may not add node kinds to the hub.
