# S4 extraction lane: s4-turbo-tasks

You are ONE extraction lane of the beep-ci-operational-ontology packet's S4
formal-first T-Box bootstrap (`explorations/beep-ci-operational-ontology/`). You run
the lane contract EXACTLY — improvise nothing. The frozen inputs (admission law,
glossary, literal domains, ORSD, scope) live under
`explorations/beep-ci-operational-ontology/ontology/docs/`; READ THEM FIRST. You may
not change them. Corpus: the working tree at commit 469136d2a872 (HEAD; includes the
deployed #870 scheduler).

## Your unit's sources (exact; no improvisation)

`turbo.json` — tasks, `global.inputs`, futureFlags. Every task definition, input surface, and cache/output declaration is candidate vocabulary for VerificationLane / HashSurface / CachePosture decisions.

## Your output file (the ONLY file you may write)

`explorations/beep-ci-operational-ontology/ontology/extraction/s4/turbo-tasks.yaml`
Create it within your first few actions and append as you go. No git commands.

Telemetry header to fill (copy this shape verbatim, complete every field):

```yaml
telemetry:
  lane: s4-turbo-tasks
  runner: "codex exec"
  model: gpt-5.6-sol
  reasoning_effort: max
  prompt_version: s4-lane-contract-v2
  corpus_commit: 469136d2a872
  started: <ISO8601>
  finished: <ISO8601>
  wall_seconds: <n>
  frozen_inputs:
    - { path: ontology/docs/competency-questions.yaml, sha256_12: e06ec7fe12a6 }
    - { path: ontology/docs/pre-glossary.csv, sha256_12: 9184cddcecc7 }
    - { path: ontology/docs/literal-domains.md, sha256_12: 7f0cf3e79e7e }
    - { path: ontology/docs/orsd.md, sha256_12: 2b0fd670129b }
    - { path: ontology/docs/scope.md, sha256_12: 6c39b69481a3 }
  candidate_count: <n>
  fact_count: <n>
  issue_count: <n>
```

## The full lane map (disjoint ownership — NEVER extract another lane's sources)

- s4-turbo-tasks: `turbo
- s4-affected-typenames: `packages/tooling/tool/cli/src/commands/Yeet/internal/TurboQuery
- s4-package-topology: `explorations/beep-ci-operational-ontology/ontology/extraction/s4/inputs/topo-sort
- s4-literalkits: `LiteralKit(` call sites across `packages/**/src/**` (verification-relevant domains only),
- s4-yeet-internals: `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner
- s4-fallow-laws: `
- s4-admission-scheduler: `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler

## Contract sections 3-4 (verbatim; your output schema and admission boundary)

## 3. Output: one file per lane

Path: `ontology/extraction/s4/<unit-slug>.yaml` (partitions: `<unit-slug>-p<N>.yaml`).
The lane writes EXACTLY this file, creates it within its first few actions, and appends
as it goes. No other file may be touched; no git commands. Structure, in order:

```yaml
telemetry:
  lane: s4-<unit-slug>
  runner: "codex exec"                   # or "grok -p"
  model: gpt-5.6-sol                     # explicit; passed via -m (never left to config default)
  reasoning_effort: max                  # initiative directive 2026-08-27 (grok: xhigh)
  prompt_version: s4-lane-contract-v1
  corpus_commit: <40-hex or 12-hex>      # the pinned tree (>= debbbb51f7); REQUIRED
  started: <ISO8601>
  finished: <ISO8601>
  wall_seconds: <n>
  frozen_inputs:                         # ALL FIVE frozen artifacts, no subset (round-2 seats F+G)
    - { path: ontology/docs/competency-questions.yaml, sha256_12: <hex> }
    - { path: ontology/docs/pre-glossary.csv, sha256_12: <hex> }
    - { path: ontology/docs/literal-domains.md, sha256_12: <hex> }
    - { path: ontology/docs/orsd.md, sha256_12: <hex> }
    - { path: ontology/docs/scope.md, sha256_12: <hex> }
  candidate_count: <n>
  fact_count: <n>
  issue_count: <n>

issues:            # the AgentO Issues/Assumptions ledger — REQUIRED, may be []
  - id: <unit-slug>-I01
    kind: missing-concept | missing-cq | schema-conflict | ambiguity | assumption
    claim: "<one line>"
    evidence: "<repo path>:<lines> — '<minimal verbatim quote>'"
    suggested_disposition: "<one line, advisory>"
    status: open

candidates:        # terms the corpus states that the admission law permits
  - candidate: <TermName | propertyName | IndividualName | domain member>
    kind: class | property | individual | literal-domain-member
    source_domain: <DomainName>            # REQUIRED for literal-domain-member (round-2
                                           # seat F: review-fix exists in BOTH YeetProofTier
                                           # and AdmissionWorkKind; publish in AdmissionWorkKind
                                           # AND AdmissionPriority — an unqualified member
                                           # name is ambiguous)
    definition: "<one line>"
    domain: <class>          # properties only
    range: <class | xsd:*>   # properties only
    admission_kind: decision | semantic-support   # the two-kind law (final grill)
    cq_justification: [CQ-0NN, ...]        # REQUIRED non-empty for decision candidates
    supports: [TermName, ...]              # REQUIRED non-empty for semantic-support
                                           # candidates: the decision term(s) this
                                           # defines/constrains/disambiguates (each must
                                           # be a glossary term or a decision candidate
                                           # in this same output)
    decision_relevance: "<the projection decision this serves, one line>"
    evidence:
      - "<repo path>:<lines> — '<minimal verbatim quote>'"
    already_in_glossary: true | false      # true = corroborating evidence, not a new term
    status: candidate                       # lanes NEVER write accepted/rejected

facts:             # A-Box/configuration VALUE candidates (round-2 seat F: unit 7's
                   # deployed-policy parameters are assertions, not terms — token
                   # weights, capacity defaults, class caps, aging seconds)
  - subject: <IndividualName>              # e.g. YeetWeightedAdmissionV1
    predicate: <propertyName>              # may itself be a candidate above
    value: <literal or IndividualName>
    value_type: <xsd:* | iri>
    cq_justification: [CQ-0NN, ...]        # same admission law as candidates
    evidence:
      - "<repo path>:<lines> — '<minimal verbatim quote>'"
    status: candidate
```

## 4. The admission boundary (no minting)

- The admission law is TWO-KIND (final-grill round 2; ORSD NFR-2): a `decision`
  candidate carries non-empty `cq_justification`; a `semantic-support` candidate
  carries non-empty `supports` naming the decision term(s) it serves through a
  checkable dependency. A candidate with neither is FORBIDDEN — the observation goes
  to the `issues` ledger as `missing-cq` instead. The lane never invents a CQ (or a
  support dependency) to justify a term it likes; S5 audits support justifications
  adversarially, and a support term whose named dependency dies is garbage-collected.
- Members of closed literal domains may only be PROPOSED as `literal-domain-member`
  issues/candidates; the domain itself never changes in lane output.
- `status` transitions (`candidate → accepted | rejected`) happen ONLY in human
  ratification (S5 adversarial loop / S6), recorded in the packet, followed by the
  extend → re-run-all → diff loop (R5). That is the only path by which the frozen
  T-Box changes.



## Discipline (AgentO, R5)

Fixed schema, no minting, fidelity over condensation, ledger for gaps,
report-file-first-append-as-you-go. Every candidate needs `admission_kind`
(decision -> non-empty cq_justification citing MUST/SHOULD CQs only;
semantic-support -> non-empty supports naming glossary terms or your own decision
candidates). Every literal-domain-member needs `source_domain`. Evidence lines are
`<repo path>:<lines> — '<minimal verbatim quote>'` and the path must exist.

SELF-CHECK before finishing (run it; fix what it flags):
`cd explorations/beep-ci-operational-ontology/research/scripts && uv run --with pyyaml,rdflib python validate_packet.py --s4-lane ../../ontology/extraction/s4/turbo-tasks.yaml`

Final message: one line — the output path + candidate/fact/issue counts + the
self-check result.
