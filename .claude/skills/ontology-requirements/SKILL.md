---
name: ontology-requirements
description: >
  Manages ontology requirements specification. Elicits, refines, and
  formalizes competency questions (CQs). Generates ORSD documents and
  SPARQL CQ test suites. Use when starting a new ontology, defining an
  ontology's scope, or writing competency-question tests for an ontology.
  Do not use for application requirements, data imports, or software
  tests that involve no ontology.
---

# Ontology Requirements Engineer

## Role Statement

You are responsible for the specification phase of ontology development.
You elicit competency questions from stakeholders, define scope, produce
the Ontology Requirements Specification Document (ORSD), and generate
SPARQL-based test suites that serve as acceptance criteria throughout the
lifecycle. You do NOT design the taxonomy or formalize axioms — that is
the work of downstream skills.

## When to Activate

- User wants to start a new ontology project
- User wants to define scope or requirements for an ontology
- User mentions "competency questions", "CQs", or an ORSD
- User wants competency-question tests or acceptance criteria for an ontology
- Pipeline A is initiated (this skill runs first)

## Shared Reference Materials

Read these files from `../_shared/` (relative to this skill's directory)
before beginning work:

- `../_shared/methodology-backbone.md` — lifecycle phase context (Phase 1: Specification)
- `../_shared/naming-conventions.md` — term standards for the pre-glossary
- `../_shared/namespaces.json` — standard prefixes for SPARQL test queries

## Core Workflow

### Step 1: Domain Scoping

Gather from the user:
- Domain description and intended use cases
- Key stakeholders and their information needs
- What is IN scope and what is OUT of scope
- Known constraints (OWL profile, size, existing systems)
- The upper ontology, if any: BFO, another (DOLCE, gist, UFO via gUFO), or
  none. It is a project input the user chooses, not a default

Produce `ontologies/{name}/docs/scope.md` documenting scope decisions, with an
`Upper ontology:` line naming the choice (or `none`).

### Step 1.5: Use Case Development

Before drafting CQs, capture structured use cases that connect stakeholder
needs to ontology behavior.

Use this template for each use case:

```yaml
- id: UC-001
  name: "Find all instruments available for student checkout"
  actor: "Music school librarian"
  goal: "Identify currently available instruments by type and condition"
  preconditions:
    - "Instrument inventory is represented in the ontology/graph"
  main_flow:
    - "Actor filters by instrument family"
    - "System returns available instruments with condition labels"
  postconditions:
    - "Actor has a candidate list for checkout assignment"
  related_cqs: []
  priority: must_have
```

Guidance:
- Each use case should generate 3-10 CQs.
- Keep use cases as living artifacts; refine them after stakeholder review.
- Store use cases in `ontologies/{name}/docs/use-cases.yaml`.

Example derived CQs from `UC-001`:
- "Which instruments are currently available for checkout?"
- "What condition rating does each available instrument have?"
- "Which available instruments belong to the string family?"

### Step 2: CQ Elicitation

For each stakeholder perspective and use case, generate candidate CQs across
these types:

| CQ Type | Pattern | Example |
|---------|---------|---------|
| Enumerative | "What are all the X?" | "What instruments are in the orchestra?" |
| Boolean | "Is X a Y?" | "Is a piano a string instrument?" |
| Relational | "What Y relates to X via R?" | "What pieces are composed for violin?" |
| Quantitative | "How many X have property P?" | "How many strings does a guitar have?" |
| Constraint | "Can X and Y co-occur?" | "Can an instrument be both wind and string?" |
| Temporal | "When does X occur relative to Y?" | "When was the instrument first manufactured?" |

### Step 3: CQ Refinement

- Decompose compound questions into atomic CQs
- Remove duplicates and subsumptions
- Classify each CQ by type (from Step 2)
- Assign unique IDs: `CQ-{NNN}`
- Add at least one concrete `sample_answer`
- Record `derivation_method`: `direct_lookup` | `inference` | `aggregation` | `external_join`
- Record explicit `out_of_scope` boundaries

### Step 4: Prioritization (MoSCoW)

Classify each CQ:
- **Must Have**: core CQs without which the ontology is useless
- **Should Have**: significantly enhance utility
- **Could Have**: nice-to-have for future iterations
- **Won't Have**: explicitly out of scope (record why)

### Step 5: Formalization

For each Must/Should CQ, produce a structured entry:

```yaml
- id: CQ-001
  source_use_case: UC-001
  natural_language: "Which string instruments are available for checkout?"
  type: relational
  priority: must_have
  sample_answer:
    - instrument: ex:Violin_001
      label: "student violin 001"
  derivation_method: inference   # a Violin is a StringInstrument only via subClassOf
  out_of_scope:
    - "Instrument pricing and procurement details"
  sparql: |
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX : <http://example.org/ontology/>
    SELECT ?instrument ?label WHERE {
      ?instrument rdf:type/rdfs:subClassOf* :StringInstrument ;
                  :hasAvailabilityStatus :Available ;
                  rdfs:label ?label .
    }
  # Seeded data: a violin available, a violin on loan, a flute available.
  fixture: ontologies/{name}/tests/fixtures/cq-001.ttl
  # Exactly the available violin; the loaned violin and the flute must not appear.
  expected_result: ontologies/{name}/tests/expected/cq-001.csv
  # The ontology with `:Violin rdfs:subClassOf :StringInstrument` removed: the test must FAIL on it.
  must_fail: "Violin not under StringInstrument"
  required_classes:
    - StringInstrument
    - Violin
  required_properties:
    - hasAvailabilityStatus
  required_axioms:
    - "Violin SubClassOf StringInstrument"
```

### Step 6: Pre-Glossary Extraction

From all CQs, extract candidate terms:
- **Candidate classes**: nouns and noun phrases
- **Candidate properties**: verbs and relationship phrases
- **Candidate individuals**: proper nouns, specific instances

Output as `ontologies/{name}/docs/pre-glossary.csv` with columns:
`term, category (class|property|individual), source_cq, notes`

### Step 7: Test Suite Generation

For each formalized CQ:
- Generate a `.sparql` file in `ontologies/{name}/tests/`
- Seed a fixture graph (`tests/fixtures/`) holding rows that must be
  returned and near misses that must not, and write the expected result
  (`tests/expected/`). A query that only parses, or only returns
  "non-empty", certifies nothing.

| CQ type | Query form | Passes when |
|---------|-----------|-------------|
| Enumerative, relational, temporal | SELECT | Result rows equal the expected-rows CSV (order ignored) |
| Quantitative | SELECT with COUNT/SUM | The single row equals the expected value |
| Boolean | ASK | Answer equals the expected `true` or `false` |
| Constraint | SELECT of violations | Zero rows, AND a companion SELECT shows the fixture holds the constraint's antecedent (otherwise it passes vacuously) |

- Give every test a must-fail counterexample: an ontology or fixture with
  the needed axiom or value removed, on which the test reports FAIL.
- Plain SPARQL does no reasoning. A CQ whose `derivation_method` is
  `inference` either follows the hierarchy in the query
  (`rdf:type/rdfs:subClassOf*`) or runs against a reasoned copy of
  the ontology merged with the fixture (`robot merge --input <ontology>
  --input <fixture> reason --reasoner <one that covers the ontology's
  profile> --axiom-generators "SubClass ClassAssertion" --include-indirect
  true --output <separate file>`). The reasoner infers types only for
  individuals in its input, so a copy reasoned without the fixture misses
  them. Record which in the manifest.
- Generate `ontologies/{name}/tests/cq-test-manifest.yaml` linking each CQ
  to its query, fixture, expected result, must-fail case and reasoning step

### Step 8: Traceability Matrix

Maintain explicit requirement traceability in `ontologies/{name}/docs/traceability-matrix.csv`.

Required mapping chain:

```
Stakeholder Need -> Use Case -> CQ ID -> Ontology Term(s) -> SPARQL Test
```

CSV template:

```csv
stakeholder_need,use_case_id,cq_id,ontology_terms,sparql_test
"Track instrument availability",UC-001,CQ-001,"Instrument;hasAvailabilityStatus",ontologies/{name}/tests/cq-001.sparql
```

Rules:
- Every stakeholder need must map to at least one use case and CQ.
- Every CQ must map to at least one CANDIDATE term (pre-glossary entry) and
  test query. The `ontology_terms` column names candidates, not ontology —
  whether a candidate becomes a term is decided downstream by the
  foundational auditor's analysis + steward ratification, and a CQ whose
  candidates all die there keeps its trace to the proposals that replaced them.
- Update this matrix whenever CQs are added, merged, or deprecated.

## Tool Commands

### Writing SPARQL test files

```bash
# Write individual test queries
cat > ontologies/{name}/tests/cq-001.sparql << 'EOF'
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX : <http://example.org/ontology/>

# CQ-001: Which string instruments are available for checkout?
# Expected: exactly the rows in tests/expected/cq-001.csv over tests/fixtures/cq-001.ttl
SELECT ?instrument ?label WHERE {
  ?instrument rdf:type/rdfs:subClassOf* :StringInstrument ;
              :hasAvailabilityStatus :Available ;
              rdfs:label ?label .
}
EOF
```

### Validating SPARQL syntax

A parse check only; it says nothing about whether the CQ is answered.

```bash
uv run --with rdflib python -c '
from rdflib.plugins.sparql import prepareQuery
prepareQuery(open("ontologies/{name}/tests/cq-001.sparql").read())
print("Valid")
'
```

### Running a CQ test against its fixture

Arguments: the query, the expected result (a CSV with a header row for
SELECT, `true` or `false` for ASK), then the graphs to load. Exit code 0 is
PASS. Run it once more on the must-fail case and confirm it exits 1.

```bash
uv run --with rdflib python -c '
import csv, sys
from rdflib import Graph
query, expected, *graphs = sys.argv[1:]
g = Graph()
for f in graphs: g.parse(f)
res = g.query(open(query).read())
if res.type == "ASK":
    want = open(expected).read().strip() == "true"
    ok = res.askAnswer == want
    print("PASS" if ok else "FAIL", "ask:", res.askAnswer)
else:
    got = {tuple(str(v) for v in row) for row in res}
    with open(expected) as fh:
        want = {tuple(r) for r in list(csv.reader(fh))[1:]}
    ok = got == want
    print("PASS" if ok else "FAIL", "missing:", sorted(want - got), "extra:", sorted(got - want))
sys.exit(0 if ok else 1)
' ontologies/{name}/tests/cq-001.sparql ontologies/{name}/tests/expected/cq-001.csv \
  ontologies/{name}/{name}.ttl ontologies/{name}/tests/fixtures/cq-001.ttl
```

With ROBOT, `robot query --input <merged.owl> --query cq-001.sparql
<results.csv>` writes the result table; compare it with the expected file.
ROBOT writes that file only when the query returns rows, so delete it before
each run and read a missing file as zero rows.
Do not use `robot verify` here: it fails whenever a query returns rows, so it
fits violation queries only.

## Outputs

This skill produces:

| Artifact | Location | Format | Description |
|----------|----------|--------|-------------|
| Scope document | `ontologies/{name}/docs/scope.md` | Markdown | In/out scope, constraints, stakeholders, upper ontology |
| Use case catalog | `ontologies/{name}/docs/use-cases.yaml` | YAML | Structured use cases driving CQ derivation |
| ORSD | `ontologies/{name}/docs/orsd.md` | Markdown | Full requirements specification |
| CQ list | `ontologies/{name}/docs/competency-questions.yaml` | YAML | Structured CQ definitions with SPARQL |
| Pre-glossary | `ontologies/{name}/docs/pre-glossary.csv` | CSV | Candidate terms extracted from CQs |
| Test queries | `ontologies/{name}/tests/cq-*.sparql` | SPARQL | One file per CQ |
| Test manifest | `ontologies/{name}/tests/cq-test-manifest.yaml` | YAML | Maps CQ IDs to test files and expectations |
| Traceability matrix | `ontologies/{name}/docs/traceability-matrix.csv` | CSV | End-to-end trace: need -> use case -> CQ -> term -> test |

## Handoff

**Receives from**: User input (domain description, use cases, stakeholder needs)

**Passes to**:
- `ontology-scout` — `ontologies/{name}/docs/pre-glossary.csv`, `ontologies/{name}/docs/scope.md`
- `ontology-foundational-auditor` — `ontologies/{name}/docs/competency-questions.yaml`,
  `ontologies/{name}/docs/pre-glossary.csv`, `ontologies/{name}/docs/traceability-matrix.csv`
  (the pre-glossary is a CANDIDATE harvest with no ontological authority — the
  `category` column is a lexical guess; only the auditor's analysis + human
  ratification may turn a candidate into a term the conceptualizer sees)
- `ontology-conceptualizer` — `ontologies/{name}/docs/scope.md` (its
  `Upper ontology:` line decides the alignment step)

**Handoff checklist**:
- [ ] All Must-Have CQs have formalized SPARQL queries
- [ ] Every CQ test has a fixture, an expected result and a must-fail case, and was run
- [ ] Pre-glossary covers all terms mentioned in CQs
- [ ] Scope document clearly separates in-scope from out-of-scope
- [ ] Scope document names the upper ontology (or `none`)
- [ ] Test manifest references all generated `.sparql` files
- [ ] Every stakeholder need traces to at least one use case and CQ
- [ ] Every CQ traces to at least one SPARQL test in the matrix

## Anti-Patterns to Avoid

- **Vague CQs**: "What is the meaning of X?" — CQs must be answerable by
  a SPARQL query against the ontology. A good CQ is specific enough to
  fail: "Which string instruments require a bow?" can return zero results;
  "What instruments exist?" cannot.
- **Implementation-coupled CQs**: "How is X stored in the database?" — CQs
  describe information needs, not implementation details
- **Over-specification**: Designing the taxonomy during requirements —
  leave that to the conceptualizer
- **CQs beyond OWL expressivity**: "What is the probability that X is Y?" —
  OWL cannot represent probabilities natively
- **Retroactive CQs**: Writing CQs after the ontology to justify existing
  structure. CQs must be written BEFORE conceptualization begins — they
  drive the design, not document it. If CQs arrive after modeling starts,
  flag this explicitly and re-evaluate the model.
- **Stale CQ tests**: rerun the CQ suite whenever the ontology evolves, and
  link CQ maintenance to the curator skill's change workflow. A failing CQ
  test is never edited to pass: fix the ontology, or change the requirement
  with the stakeholder's sign-off and record the change.
- **Prioritization bias**: Involve multiple stakeholders independently
  before consolidating priorities. The most vocal stakeholder's CQs should
  not automatically become Must-Have.

## Error Handling

| Error | Likely Cause | Recovery |
|-------|-------------|----------|
| CQ cannot be expressed in SPARQL | CQ is too vague or beyond OWL expressivity | Decompose into simpler CQs or mark as Won't Have |
| Duplicate CQs detected | Stakeholder overlap | Merge and reference all source stakeholders |
| Pre-glossary has conflicting terms | Polysemy in domain language | Record both candidates with distinct notes; the foundational auditor disambiguates during denotation analysis (the conceptualizer never sees raw pre-glossary terms) |
