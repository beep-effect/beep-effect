# Panel brief: a typechecker for agent work product

You are one member of an independent review panel. Read this brief, then answer the questions at the end in Markdown. Be direct and critical. Disagreement is more valuable than agreement. Do not flatter. Cite real prior art by name where you know it, and say when you are unsure whether something exists.

## Context

beep-effect is an Effect-TS (v4) TypeScript monorepo for a law practice (patents), with a schema-first culture: every domain model is an Effect Schema, errors are typed, services are Context services. It already has:

- `@beep/md`: a semantic, persisted document model (an Effect Schema AST: headings, paragraphs, lists, tables, code, math, footnotes, admonitions, embeds, JSON frontmatter), constructors like `Md.h1`, `Md.p`, a trust refinement (`Document` may carry trusted raw HTML/Markdown; `SafeDocument` is the user-content refinement that rejects raw nodes, off-policy URLs, duplicate footnotes), and a URL policy.
- `@beep/markdown`: a CommonMark 0.31.2 + GFM parser (vendored, hardened commonmark.js), every node carries byte offsets, offset-splice edits that leave untouched bytes identical, typed frontmatter codecs, a two-way `Schema<Root, string>` codec (decode = parse, encode = stringify with author-spelling fidelity fields). A fold from its syntax tree into `Md.Document` reports every construct it cannot carry as a typed loss row (20 reasons) and keeps a fingerprinted source map so a stale span returns `Option.none` rather than a wrong position. A 731-example conformance corpus records 598 lossless, 99 lossy, 34 unsafe outcomes.
- `@beep/html`: a typed HTML AST, conformance rules (WHATWG author conformance such as skipped heading levels), a deny-by-default safe-output policy, an opaque runtime-issued `SafeHtml`, and a serializer. No string parser yet.
- `@beep/lexical-schema` and `@beep/pandoc-ast`: projections from `Md.Document` to the Lexical editor state and to Pandoc JSON (with a compatibility report).
- `@beep/rdf`: an RDF projection.
- An agent chat surface where the assistant emits structured blocks, they are validated during streaming, failures are batched and repaired by JSON Patch against the failing block (2 attempts).
- Ontology tooling skills: OWL 2 / ROBOT / SHACL / competency questions / BFO alignment.

## The thesis under review

1. Hub and spokes. `@beep/md` (to be renamed `@beep/doc`) is a notation-free semantic hub. Every notation (markdown, html, lexical, pandoc/docx, later css and a restricted script language) is a spoke that owns: parse to a positioned lossless tree, a source map, a fold into the hub model with typed losses, a projection out of the hub, conformance rules, and a serializer. Spokes depend on the hub, never the reverse.

2. Notation codecs as the front end for agent output. An agent writes in the notation it thinks in (Markdown, HTML), as fast as a raw string. The codec parses it losslessly with positions, admits it into the typed model with accumulated (not fail-fast) issues, and returns a short list of located, typed, actionable findings. The agent repairs by span, not by regenerating. This claims the speed of raw-string generation (fx0 / v0 style) and the certainty of structured output (JSON component schemas) at once, without paying the context cost of a giant schema or the blindness of a free string.

3. The oracle is the product. Coding agents work because the domain shipped its own oracle (compiler, types, tests, linters: deterministic, exhaustive over what they cover, located, cheap). Other knowledge domains have rulebooks but no oracle; the only backpressure is slow, partial human review whose intent the agent must infer. The system above is the front end of the missing oracle.

4. Rules sort into four tiers, each needing a different judge and feedback shape (patent drafting is the worked example):
   - Tier 1 formal: name resolution, graph shape, counts, order. Antecedent basis ("the member" needs a prior "a member"), dependent claims form a DAG, reference numerals match drawings. Deterministic; error with span and mechanical fix.
   - Tier 2 structural: linking through a vocabulary/ontology. Every claim term has support in the specification; a dependent claim narrows its parent. Deterministic over an ontology; error with span, resolution path and rejected candidates.
   - Tier 3 substantive: judgment against the world (novelty, obviousness). Classifier, review panel, human. An obligation with or without a witness, with probability and confidence.
   - Tier 4 behavioral: how a particular gatekeeper tends to act. A learned prior. Advice, never an error.

5. Tiers 3 and 4 are enforced by a process ontology, not by content rules. The content judgment stays probabilistic, but admissibility of the process that produced it is axiomatizable: a novelty obligation is discharged only by a prior-art search whose sources are on an approved list and resolved at search time (deterministic sub-checks: does the link resolve, is the domain approved, is the quote present in the fetched content), whose result was re-derived by a reviewer on a different model provider, whose calibrated classifier confidence (System One style typed questions: Choice / Score / yes-no with probability and a separate confidence) cleared a threshold, and which a human signed. Every clause constrains a provenance record (process, participant, role, input, output, order: BFO occurrents, PROV-O), so tiers 3 and 4 become tier 1 and 2 checks over the provenance graph. Witnesses discharge obligations. Human span-anchored comments are findings whose judge is a person.

6. Every judge, from a regex to an attorney, emits one finding shape: span, rule or question, severity, evidence, judge identity, confidence (deterministic judges report 1). Routing, display, repair and ledgering never branch on the kind of judge. This single shape is what makes the core domain-agnostic.

7. The core is five separable parts: notation, codec (parse + source map), model, profile (a specification plus semantic rules, stackable; a stricter profile only adds findings), judges. Obligations and holes are first-class (as in proof assistants). Ledgers under everything (losses, findings, witnesses, repairs) are the calibration corpus, the eval set for the oracle itself, and the source of new rules (a recurring human finding is a rule waiting to be written).

8. Extensibility via a DDD-shaped declarative DSL. Inspired by Alchemy's `@alchemy.run/domain` (Effect-based: `Domain.Command("Name", { input, events, rejects, reply })`, `Domain.Aggregate`, `Domain.Projection`, `Domain.Policy`, `Story.given/when/rejected` tests), the idea is that rules, axioms, taxonomies, classes, obligations, judges and profiles are declared as schema-bearing classes that form a serializable AST. That AST is projectable: to OWL 2 / SHACL for reasoning and validation, to JSON Schema for agents, to documentation, to test stories. The system ships primitives; a domain is molded on top by declarations, not by code changes to the core. The oracle for a new domain costs a profile and possibly a spoke, not a rewrite.

9. Risks already acknowledged: a wrong oracle is worse than none (agents satisfy it with confidence), so rules are fit to public rejection records (office actions) and scored for precision/recall before agents see them; Goodhart and "process theater"; term resolution in prose is fuzzy; rule authoring is slow and expert-bound; validation must be incremental to be backpressure.

## Questions for you

1. Has anyone built this, or most of it? Name real systems, papers, products, standards or research groups. Distinguish: (a) positioned diagnostics for a notation, (b) typed admission of LLM output with repair, (c) domain rule oracles for documents (legal, regulatory, clinical, financial), (d) process/provenance ontologies used to gate AI output, (e) declarative DSLs whose rule ASTs project to OWL/SHACL/other formalisms, (f) "compiler as reward" or diagnostics-as-training-signal work. Be honest about what is adjacent versus the same.
2. Where is the thesis wrong, naive, or likely to fail in practice? Attack the strongest claims: that tiers 3/4 reduce to provenance checks, that a single finding shape suffices, that profiles compose monotonically, that span repair beats regeneration, that agents prefer this loop.
3. The DSL question: is a DDD-shaped declarative class DSL the right carrier for rules, taxonomies and axioms, versus authoring in OWL/SHACL/Datalog directly, versus a bidirectional projection? What must the AST contain for OWL 2 projection to be faithful (open-world vs closed-world, SHACL for obligations, OWL for vocabulary)? What is lost?
4. If you were the agent inside this loop, what would make you productive and what would make you route around it?
5. What is the smallest experiment that would falsify or validate the thesis within two weeks, using the assets listed above?
6. One idea the authors have not considered.

Answer in Markdown with those six headings. Aim for depth over breadth; 1500 to 3000 words. Begin with one line stating which model you are.
