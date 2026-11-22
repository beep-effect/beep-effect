# Quality Checklist

Universal pre-commit checklist for ontology artifacts. Run these checks
before committing any ontology change. Used by the validator, architect,
and curator skills.

## Required Checks (must all pass)

### 1. Logical Consistency

Pick the reasoner from the OWL profile the ontology actually uses. ELK
reasons over OWL 2 EL only and ignores every axiom outside it (universal
restrictions, cardinality, complements, disjoint unions, inverse
properties), so it is the consistency gate only for an ontology that stays
inside EL. For anything else use HermiT:

```bash
robot reason --reasoner hermit --input ontology.ttl --output reasoned.ttl
# EL-only ontology:
robot reason --reasoner ELK --input ontology.ttl --output reasoned.ttl
```

ROBOT's reasoners are `ELK` (the default), `hermit`, `jfact`, `whelk`, `emr`
and `structural`; Openllet runs through its own CLI. `robot reason` exits
non-zero when the ontology is inconsistent or has unsatisfiable classes.

- Ontology must be consistent (no logical contradictions)
- No unsatisfiable classes (classes that can have no instances)
- If HermiT times out and ELK is run instead, the result covers only the EL
  part: say which axioms were left unchecked, and do not report the
  ontology as consistent.

**Failure action**: Do NOT commit. Identify conflicting axioms and fix.

### 2. ROBOT Quality Report

```bash
robot report --input ontology.ttl --fail-on ERROR --output report.tsv
```

Must pass with zero ERRORs. In ROBOT's default profile the ERROR-level
checks include:
- Missing `rdfs:label` (`missing_label`)
- More than one label (`multiple_labels`), duplicate labels
- Deprecated class or property references
- Whitespace in labels (`label_whitespace`)
- Missing ontology title, description or license

Missing definitions are only a WARN in the default profile, and ROBOT's
`missing_definition` query reads `obo:IAO_0000115` (or the IAO_0000600
elucidation), never `skos:definition`. `--fail-on ERROR` therefore never
gates definitions. To gate them, pass a custom profile
(`--profile profile.txt`, one `LEVEL<tab>query` line per check). A profile
runs only the queries it names, so start from a copy of ROBOT's default
`report_profile.txt`, which keeps every default ERROR check, and then
change `missing_definition` from WARN to ERROR when the ontology uses
IAO_0000115, or add an `ERROR	file:./missing-skos-definition.rq` line
for the custom query in `ontology-validator` Step 2 when it uses
`skos:definition`. Use one
definition property per project (`naming-conventions.md`).

**Failure action**: Fix all ERRORs. WARNINGs should be reviewed but do not
block commit.

### 3. SHACL Shape Validation

```bash
uvx pyshacl -s shapes/ontology-shapes.ttl -i none ontology.ttl -f human
```

Validate without inference (`-i none`). With `-i rdfs`, pyshacl first adds
the RDFS entailments to the data: `rdfs:domain` and `rdfs:range` then
assign the very types a shape would check, and subclass closure adds
superclasses, so type checks pass by construction and gaps stay hidden.
`rdfs:domain` and `rdfs:range` are inference rules, not constraints: state
what is required as `sh:class` or `sh:datatype` on a property shape.

Must conform to all SHACL shapes. Standard shapes:
- Every class has `rdfs:label` (minCount 1)
- Every class has a definition in the project's definition property
  (minCount 1, severity: Warning). SHACL Warnings do not block a commit,
  but definitions are required (`naming-conventions.md`), so an open
  Warning blocks a release.
- No orphan classes (every class has at least one named parent)
- Property values have the class or datatype the property shapes require
  (`sh:class`, `sh:datatype`)

**Failure action**: Fix all Violations (severity `sh:Violation`). Track
Warnings (severity `sh:Warning`) — they do not block a commit but must be
resolved before release.

### 4. CQ Test Suite

Run the suite as `ontology-validator` Step 4 gives it, from
`tests/cq-test-manifest.yaml` written by `ontology-requirements`: one
`tests/cq-NNN.sparql` per CQ, its fixture in `tests/fixtures/`, its
expected result in `tests/expected/`, its must-fail case and its
reasoning step. In short:

- Merge each CQ's fixture into the ontology (`robot merge`, then `reason`
  when the manifest records a reasoning step) and run the query on that
  merged copy, never on the ontology alone.
- SELECT and ASK CQs run with `robot query`; their rows (header dropped,
  sorted) or their `true`/`false` must equal `tests/expected/`. A result
  that only parses, or is only non-empty, is not a pass.
- Constraint CQs run with `robot verify`, which fails when the query
  returns any row: zero rows, and their companion antecedent query, run
  with `robot query` on the same merged copy, must return rows. A
  constraint whose antecedent returns nothing passes vacuously and counts
  as a FAIL.
- Each test must report FAIL on its must-fail case; a test that still
  passes there certifies nothing.

**Failure action**: A failing CQ test is never edited to pass. If the
change was unintentional, revert it. If it was intentional, report the
failing test, the change that broke it, and the proposed fix to the
requirement owner. Either the ontology is fixed, or the requirement is
changed with the owner's sign-off and the change is recorded with the CQ.

## Recommended Checks (should pass)

### 5. Label Coverage

Target: 100% of classes have `rdfs:label`. Count each class once, even
when it has labels in several languages.

```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>

SELECT (COUNT(DISTINCT ?c) AS ?total)
       (COUNT(DISTINCT ?labeledClass) AS ?labeled)
WHERE {
  ?c a owl:Class .
  FILTER(!isBlank(?c))
  OPTIONAL {
    ?c rdfs:label ?label .
    BIND(?c AS ?labeledClass)
  }
}
```

### 6. Definition Coverage

Release gate: this check sits with the recommended ones because it does
not block a commit, but below 100% it blocks a release.

Target: 100% of classes have a definition, in the project's one definition
property (`skos:definition` or `obo:IAO_0000115`); definitions are required
(`naming-conventions.md`). Count each class once, including when it has
several definitions. The query below uses `skos:definition`; put the
project's property in its place.

```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX obo: <http://purl.obolibrary.org/obo/>

SELECT (COUNT(DISTINCT ?c) AS ?total)
       (COUNT(DISTINCT ?definedClass) AS ?defined)
WHERE {
  ?c a owl:Class .
  FILTER(!isBlank(?c))
  OPTIONAL {
    ?c skos:definition ?def .
    BIND(?c AS ?definedClass)
  }
}
```

### 7. Naming Convention Compliance

Verify against `naming-conventions.md`:
- Class names are CamelCase
- Property names are camelCase
- Labels are lowercase (unless proper nouns)
- Definitions follow genus-differentia pattern

### 8. No Orphan Classes

```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>

SELECT ?orphan WHERE {
  ?orphan a owl:Class .
  FILTER NOT EXISTS {
    ?orphan rdfs:subClassOf ?parent .
    FILTER(?parent != owl:Thing)
    FILTER(!isBlank(?parent))
  }
  FILTER(?orphan != owl:Thing)
  FILTER(?orphan != owl:Nothing)
  FILTER(!isBlank(?orphan))
}
```

Target: zero results (except intentional top-level classes aligned directly
under the project's upper ontology, and the imported upper-ontology terms
themselves).

### 9. Disjointness Coverage

Sibling kinds should be declared disjoint; roles and phases are not. Check
for missing disjointness (see `anti-patterns.md` #4).

### 10. Diff Review (for PRs)

```bash
robot diff --left previous.ttl --right ontology.ttl --format markdown
```

Review the diff for unintended changes before committing.

## Extended Quality Dimensions (recommended before release)

### 11. Accuracy Checks

#### 11.1 Syntactic Accuracy (`sh:datatype`)

Ensure SHACL shapes include datatype constraints for data properties:

```turtle
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://example.org/ontology/> .

ex:AgeShape
  a sh:NodeShape ;
  sh:targetClass ex:Person ;
  sh:property [
    sh:path ex:hasAge ;
    sh:datatype xsd:integer ;
    sh:minCount 1 ;
  ] .
```

Validate (no inference, as in §3):

```bash
uvx pyshacl -s shapes/ontology-shapes.ttl -i none ontology.ttl -f human
```

#### 11.2 Semantic Accuracy

Cross-check a sample of definitions against authoritative domain sources
(standards, curated vocabularies, normative specs). Record source links in the
validation report for any changed definitions.

#### 11.3 Timeliness

Verify ontology metadata freshness (`dcterms:modified`):

```sparql
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT ?ontology ?modified WHERE {
  ?ontology a owl:Ontology .
  OPTIONAL { ?ontology dcterms:modified ?modified }
}
```

Failure conditions:
- `dcterms:modified` missing.
- `dcterms:modified` older than the project's release cycle policy.

### 12. Coverage Checks

#### 12.1 Schema Completeness (missing definitions)

Tests the project's one definition property, shown as `skos:definition`;
use `obo:IAO_0000115` instead when that is the property the project
records.

```sparql
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT ?class WHERE {
  ?class a owl:Class .
  FILTER(!isBlank(?class))
  FILTER NOT EXISTS { ?class skos:definition ?def }
}
```

#### 12.2 Property Completeness (missing domain/range)

A review list, not a defect list: domain and range are inference rules and
are often left out on purpose (`anti-patterns.md` #10). Confirm each
property listed is meant to have none.

```sparql
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>

SELECT ?property WHERE {
  ?property a ?type .
  VALUES ?type { owl:ObjectProperty owl:DatatypeProperty }
  OPTIONAL { ?property rdfs:domain ?domain }
  OPTIONAL { ?property rdfs:range ?range }
  FILTER(!BOUND(?domain) || !BOUND(?range))
}
```

#### 12.3 Population Completeness (when instances exist)

For populated ontologies/graphs, measure representative instance coverage for
high-priority classes (from CQs). Document gaps in the report.

#### 12.4 Representativeness

Run distribution checks for key dimensions (e.g., geography, time period,
subdomain). Flag obvious skew where it would bias CQ outcomes.

### 13. Succinctness Checks

#### 13.1 Intensional Conciseness (redundant subclass assertions)

```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?child ?parent WHERE {
  ?child rdfs:subClassOf ?parent .
  FILTER EXISTS {
    ?child rdfs:subClassOf ?mid .
    ?mid rdfs:subClassOf+ ?parent .
    FILTER(?mid != ?parent)
  }
}
```

Use this as a review query: some matches are intentional for readability.

#### 13.2 Extensional Conciseness (duplicate individuals)

```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?label (COUNT(DISTINCT ?ind) AS ?count) WHERE {
  ?ind rdfs:label ?label .
}
GROUP BY ?label
HAVING (COUNT(DISTINCT ?ind) > 1)
```

#### 13.3 Representational Conciseness (unused vocabulary)

```sparql
PREFIX owl: <http://www.w3.org/2002/07/owl#>

SELECT ?class WHERE {
  ?class a owl:Class .
  FILTER NOT EXISTS { ?x a ?class }
  FILTER(!isBlank(?class))
}
```

A T-Box class with no instances is normal. Review against the intended
design; never delete a released term — deprecate it.

### 14. Evaluation Dimensions (qualitative)

Capture release-readiness notes for:
- **Expressivity**: Is the chosen OWL profile sufficient for CQ demands?
- **Complexity**: Is the model understandable by target users/maintainers?
- **Granularity**: Is detail level appropriate for scope and CQ set?
- **Epistemological adequacy**: Does it reflect domain consensus?

## Check Execution Order

Run checks in this order (fast-fail):

1. **Logical consistency** — if the ontology is inconsistent, nothing else
   matters
2. **ROBOT report** — catches annotation-level issues quickly
3. **SHACL validation** — structural constraint checking
4. **CQ tests** — functional acceptance testing
5. **Coverage metrics** — a gap does not block a commit, and blocks a release
6. **Extended quality dimensions** — accuracy, coverage, succinctness, qualitative review before release

## SSSOM Mapping Checks (when applicable)

```bash
uvx --from sssom sssom validate mappings/source-to-target.sssom.tsv
```

- Valid SSSOM schema conformance
- All CURIEs resolvable via curie_map
- No self-mappings (subject = object)
- No duplicate mappings
- Every mapping has `mapping_justification`
- Confidence scores present for automated mappings

## Automation

Integrate the applicable checks through the host repository's verified quality
workflow. Do not assume a Justfile or a `just check` task exists. In Beep, use
the package-scoped quality and Yeet commands required by `AGENTS.md`.

The following are examples for a Python host that configures these tools; they
are not a claim that this checkout defines or runs all of these gates:

```bash
uv run ruff check .              # Python linting
uv run ruff format --check .     # Python formatting
uv run mypy src/                 # Type checking
uv run pytest                    # Python tests
# Plus ontology-specific checks above for any modified .ttl/.owl files
```
