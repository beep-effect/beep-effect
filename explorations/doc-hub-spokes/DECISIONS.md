# Decisions

<!--
Stage 2 log. Dated entries: Question / Answer / Rationale, including rejected
options. Deferred questions are logged DEFERRED with the reason. Manifest
`openQuestions` mirrors what is still open here.
-->

## 2026-10-28

### D-01 Where the idea lives: agent output, not domain rules

- **Question:** After a panel that spent most of its force on patent law, what is the
  packet's center of gravity?
- **Answer (operator):** The agent-output loop. An agent writes in the notation it thinks
  in; the output is admitted into a typed model; deterministic, located, actionable findings
  come back; the agent repairs by span. Domain rules (patent or otherwise) are profiles
  stacked on that loop, and the panel's pushbacks are seeds for what the core must be able to
  codify (coverage, bitemporality, discharge lattice, frame conditions, runtime-minted
  witnesses, Goodhart-tested rules), never rules the core ships.
- **Rationale:** The brief used patent drafting as the worked example, and the reviewers
  argued the example instead of the mechanism. Keeping the core domain-free is the whole
  point of the hub-and-spokes design; a patent-shaped core would be a second
  `claim-element-antecedent-check`.
- **Rejected:** making the two-week experiment's first deliverable the three tier-1 patent
  rules (they already have an owner, and they test the rule, not the loop).

### D-02 Validate by building: a lab app POC inside the exploration

- **Question:** How is the thesis validated before any goal graduates?
- **Answer (operator):** Build a proof of concept as a lab app under `apps/labs`
  (`bun run beep create-package --lab`), with third-party dependencies fully allowed in the
  POC packages. The POC shows, in order: the loop on ordinary agent Markdown/HTML output
  under a generic profile; the core shapes exercised by that profile; a second, stricter
  profile stacked on top (patent claims, consuming `claim-element-antecedent-check`'s
  findings rather than re-implementing rules). Kill criteria from the consolidated
  experiment apply.
- **Rationale:** "if this can be built from the pieces you are talking about then that might
  be the best way to validate this idea." Lab apps are the sanctioned home for exactly this
  (schema-validated lab manifest, labs portless namespace, generated identity segment).
- **Rejected:** a paper-only shape stage before any code; a POC inside a product app.

### D-03 POC surface: harness loop first, UI second (align round 1)

- **Question:** Where does the agent's output get admitted, findings shown, repairs run?
- **Answer:** A lab app whose first deliverable is a headless loop (agent text in, typed
  findings with locations out, repair by splice, kill-criteria metrics recorded). A
  thread-style page that renders findings inline follows once the loop converges.
- **Rationale:** measurable in days; the page is a demo, the loop is the proof.
- **Rejected:** thread page from day one (slower to the first number); reusing the
  professional-desktop thread (mixes POC code into a product app, against D-02).

### D-04 Hub name: `@beep/doc`, namespace `Doc` (align round 1)

- **Answer:** `@beep/doc`. Phase 0 of the hub-and-spokes work; the effected-promotion
  D-02/D-50 amendment row is written against this name.
- **Rationale:** matches the code's vocabulary (`SafeDocument`, `Document.toHtml`,
  `documentToPandoc`); short; not taken.
- **Rejected:** `@beep/document` (length); keeping `@beep/md` (a second amendment later).

### D-05 HTML spoke parser for the POC: parse5 as a dependency (align round 1)

- **Answer:** parse5 with `sourceCodeLocationInfo` and `onParseError`, used directly inside
  the lab package (allowed by D-02). Vendoring and hardening per the D-38 recipe is deferred
  to a graduated goal if the POC holds.
- **Rejected:** vendor now (weeks before the first finding); Markdown-only POC (leaves the
  raw-HTML half untested).

### D-06 Profile 2 consumes `claim-element-antecedent-check`'s findings (align round 1)

- **Answer:** The stricter profile maps that goal's `AntecedentFinding` kinds (including
  `pattern-not-covered`) into the POC's finding shape and coverage map. The POC does not
  re-implement antecedent rules.
- **Rejected:** a non-legal second profile only (D-07 requires the patent demonstration);
  no second profile (D-07).

### D-07 Definition of done: domain rules over a primitive document model, .docx included

- **Question (operator):** What must the POC demonstrate?
- **Answer (operator):** That patent-like rules can be enforced given a primitive document
  model (a Word .docx, for example) with domain-specific rules applied on top. So the POC's
  notations are Markdown, HTML and .docx (through the pandoc spoke into the hub), and profile
  2 is required, not optional.
- **Consequence:** a .docx has no byte offsets. For that spoke a finding's location is a
  model path (paragraph, run, table cell) that the codec maps back to a document location,
  the way FHIR moved from XPath to FHIRPath expressions. The finding shape therefore carries
  a model path as its primary address and a notation span as a derived, codec-provided
  projection; `@beep/markdown` and parse5 provide spans, pandoc-ast provides paths. This is
  the first concrete codification the core owes (cf. D-01: seeds, not rules).
- **Rationale:** the thesis is about any notation an author writes in; a loop that only
  works where byte offsets exist would be a Markdown feature, not a core.

### D-08 Finding address: model path primary, span derived per codec (align round 2)

- **Answer:** Every finding addresses a `Doc` model path. Codecs with offsets (`@beep/markdown`,
  parse5) project it to a span through their source map; the pandoc/docx spoke projects to
  block/inline coordinates. A `Location` union is NET-NEW in the core; `@beep/provenance`
  `TextAnchor` remains the span half.
- **Rejected:** span primary with path fallback (two address kinds leak into consumers);
  both required always (blocks docx).

### D-09 Domain layer: a separate graph keyed to Doc by model path (align round 2)

- **Answer:** Claim elements, terms and support links are their own typed model (what
  `claim-element-antecedent-check` already builds), keyed to `Doc` nodes by model path.
  Obligations may live in the RDF/SHACL drivers. The hub stays domain-free; findings map
  back through the path.
- **Rejected:** annotations on Doc nodes (hub learns an extension slot); extension node kinds
  (hub stops being domain-free).

### D-10 SafeDocument keeps hub-native rules only; each spoke proves its projection (round 2)

- **Answer:** `SafeDocument` keeps raw-node rejection, URL policy, footnote uniqueness and
  string safety. Heading order and other HTML conformance are proven by the html spoke at
  projection time (`conform` then `enforceSafeHtml`, as `scratchpad/temp/index.ts` does).
- **Rejected:** restating heading order on the hub tree (duplication).

### D-11 .docx intake through Pandoc and `@beep/pandoc-ast` (align round 2)

- **Answer:** Reuse the existing codec and the completed `pandoc-ast-foundation` goal. Paths
  are block/inline indices; fidelity is what Pandoc keeps. No new parsing code.
- **Rejected:** a JS docx reader in the lab (second docx model to reconcile); both compared
  (doubles intake work before the first finding).

### D-12 Shape accepted; lab app named `oracle-loop` (shape review)

- **Answer:** `BRIEF.md` matches the operator's picture as drafted. The lab app is
  the proposed `oracle-loop` app under `apps/labs` (`bun run beep create-package oracle-loop --type app --lab`).
- **Rationale:** the name says what is under test (the admit-find-repair loop as the oracle
  for agent output) and stays domain-free per D-01.
- **Rejected:** `doc-oracle` (narrower than the thesis), `backpressure` (the why, not the what).
