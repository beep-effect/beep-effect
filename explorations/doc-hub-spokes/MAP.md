# Map

<!-- Stage 4. Candidate goal packets, sequencing, first vertical slice, inherited risks. -->

## Candidate goals

| Slug | Mission | Depends on | When |
| --- | --- | --- | --- |
| `oracle-loop-poc` | Prove the admit-find-repair loop for agent output in `apps/labs/oracle-loop`: three codecs into the Doc hub (Markdown, HTML via parse5, .docx via Pandoc), lab-local core shapes (Location, Finding, Coverage, Obligation, Witness, Profile), a generic profile, a stacked patent profile consuming `claim-element-antecedent-check` findings, a headless harness with four repair arms and pre-registered kill criteria, then a thread-style page. Outcome: go/no-go on graduating the core. | `goals/claim-element-antecedent-check` (active; its `AntecedentFinding` stream), `goals/pandoc-ast-foundation` (completed) | promised now |
| `doc-hub-spokes-inversion` | Rename `@beep/md` to `@beep/doc` (phase 0), move `Md.syntax`/`Md.parse` into `@beep/markdown`, replace `Md.render` with a `Doc.Document -> Root` projection plus `Markdown.stringify` validated against the bridge corpus and the 2d-3 differential, move `Md.html` into `@beep/html`, trim `SafeDocument` to hub-native rules, and write the effected-promotion D-02/D-50 amendment row. | effected-promotion closes on schedule; independent of the POC | promised now |
| `html-spoke-parser` | Vendor and harden parse5 as a `@beep/html` subpath with WHATWG parse-error codes and a source map (the D-38 recipe), replacing the lab's dependency. | `oracle-loop-poc` go | gated: POC go |
| `doc-core-promotion` | Promote the lab-local core shapes into `@beep/doc` (or a sibling foundation package): Location union, Finding with judge identity, confidence and repair-applicability, Coverage, Obligation with discharge lattice, runtime-minted Witness, stackable Profile, rule version ids on every finding. | `oracle-loop-poc` go, `doc-hub-spokes-inversion` | gated: POC go |
| `rule-dsl-projections` | The declarative rule facade over typed IRs (OWL fragment for vocabulary, SHACL/Datalog for obligations, workflow policy for process, evaluator contracts for probabilistic judges) carried by Effect `SchemaRepresentation`, with OWL 2 and SHACL projections and exact-or-approximate tags per target. | `doc-core-promotion` | gated: a second domain profile exists |
| `process-admissibility-gate` | Obligations over PROV-typed records with in-toto-style layouts, runtime-minted witnesses, capped judge attempts, calibrated routing; framed as auditability and the signing attorney's reasonable-inquiry evidence, never as correctness. | `doc-core-promotion`; the POC red-team result | gated: red-team survives |

## Sequencing

1. `doc-hub-spokes-inversion` and `oracle-loop-poc` start in parallel. The POC imports
   `@beep/md` today and rewires imports when the rename lands (one mechanical commit).
2. The POC's first vertical slice (below) reports within a week; the full four-arm
   measurement and the patent profile within two.
3. Gated goals open only on the POC's go verdict (`html-spoke-parser`,
   `doc-core-promotion`), on a second domain profile (`rule-dsl-projections`), or on the
   red-team surviving (`process-admissibility-gate`). A fired gate reopens this packet at
   decompose.

## First vertical slice (`oracle-loop-poc`, days 1 to 5)

Markdown only, generic profile only, headless. An Opus 5.5 child writes a short document;
`@beep/markdown` parses it; the fold admits it into the hub; three rules fire (heading order
via the html spoke's conformance, URL policy, raw-node rejection); findings come back with
model paths and derived spans; the agent proposes edits; `MarkdownEdit` splices them;
findings re-run on the changed region and are mapped through the agent's own edits before
fingerprint staleness; the harness records iterations, tokens, findings introduced by repair
and stale-finding rate. One coverage map and one frame condition. Compare against the
regenerate arm. Everything after this slice adds a codec (parse5, Pandoc) or a profile
(patent) without changing the finding shape; if the shape has to change, that is a finding
about the core and goes in the ledger.

## Capability check

| Component | Cites | Disposition |
| --- | --- | --- |
| Markdown codec, source map, losses, `MarkdownEdit` | `@beep/markdown`, `@beep/md/Md.syntax` | reuse |
| HTML model, conformance, policy, serializer | `@beep/html` | reuse; parser NET-NEW (parse5 in the lab, vendored later) |
| .docx intake | `@beep/pandoc-ast`, `goals/pandoc-ast-foundation` | reuse |
| Span provenance and receipts | `@beep/provenance` `TextAnchor`, `VerifiedTextAnchor`, `TextAnchorVerificationReceipt` | reuse; path half of `Location` NET-NEW |
| Epistemic gates, evidence spans | `@beep/epistemics` `EvidenceSpan`, `ClaimGate`, `ClaimGateViolation` | reuse as Finding/Obligation seeds |
| Patent rules | `goals/claim-element-antecedent-check` (`@beep/law-practice-domain`, `@beep/law-practice-use-cases`) | reuse; never re-implemented |
| JSON Patch repair baseline | `packages/agents/server/src/AssistantTurn/BlockRepair.ts` | reuse as arm A |
| Obligation graph | `@beep/shacl`, `@beep/n3`, `@beep/oxigraph` drivers, `@beep/rdf` | reuse if reached |
| Core shapes (Location, Finding, Coverage, Obligation, Witness, Profile) | none | NET-NEW, lab-local, promoted by `doc-core-promotion` |
| Lab scaffold, portless namespace, identity segment | `bun run beep create-package --lab` | reuse |
| Agent children | Opus 5.5 child; Codex `gpt-6.1-sol` fallback | reuse (routing doctrine) |

## Inherited risks

- Tricorder bar: a rule below the precision bar never enters the loop; systematic bias is
  the dangerous error, scored at span level.
- Goodhart: span deletion clears findings; the vacuity test and frame conditions are the
  defenses, and both are in the first slice.
- Process theater: the red-team is the gate for `process-admissibility-gate`.
- Panel splits still open and carried as ledger questions, not blockers: judge-routing
  lattice shape; whether the Md fold is lossy on real claim sets (measured in the patent
  profile step; if so, the patent profile runs on the claim-element graph and the hub is
  bypassed for that domain, which is itself a result).
- Cursor seat unavailable until 2026-11-11; open-weight seats via the proxy's Venice route.
