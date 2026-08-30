# Quality Checklist

Universal pre-commit checklist for ontology artifacts. Run these checks
before committing any ontology change. Used by the validator, architect,
and curator skills.

## Required Checks (must all pass)

### 1. Logical Consistency

```bash
robot reason --reasoner ELK --input ontology.ttl
```

- Ontology must be consistent (no logical contradictions)
- No unsatisfiable classes (classes that can have no instances)
- If ELK is insufficient, escalate to HermiT:
  ```bash
  robot reason --reasoner HermiT --input ontology.ttl
  ```

**Failure action**: Do NOT commit. Identify conflicting axioms and fix.

### 2. ROBOT Quality Report

```bash
robot report --input ontology.ttl --fail-on ERROR --output report.tsv
```

Must pass with zero ERRORs. Checks:
- Missing `rdfs:label` on classes
- Missing definitions
- Multiple labels in same language
- Deprecated term references
- Whitespace issues in annotations

**Failure action**: Fix all ERRORs. WARNINGs should be reviewed but do not
block commit.

### 3. SHACL Shape Validation

```bash
pyshacl -s shapes/ontology-shapes.ttl -i rdfs ontology.ttl -f human
```

Must conform to all SHACL shapes. Standard shapes:
- Every class has `rdfs:label` (minCount 1)
- Every class has `skos:definition` (minCount 1, severity: Warning).
  SHACL Warnings are non-blocking but must be tracked. They indicate
  documentation gaps that should be addressed before release.
- No orphan classes (every class has at least one named parent)
- Domain/range constraints are satisfied

**Failure action**: Fix all Violations (severity `sh:Violation`). Track
Warnings (severity `sh:Warning`) as technical debt — they do not block
commit but should be resolved before release.

### 4. CQ Test Suite

```bash
robot verify --input ontology.ttl --queries tests/
```

All competency question SPARQL tests must pass:
- Enumerative CQs: return expected results
- Constraint CQs: return zero violations

**Failure action**: If a CQ test fails after intentional changes, update
the test. If unintentional, revert the change.

## Recommended Checks (should pass)

### 5. Label Coverage

Target: 100% of classes have `rdfs:label`.

```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>

SELECT (COUNT(?c) AS ?total)
       (COUNT(?label) AS ?labeled)
WHERE {
  ?c a owl:Class .
  FILTER(!isBlank(?c))
  OPTIONAL { ?c rdfs:label ?label }
}
```

### 6. Definition Coverage

Target: ≥80% of classes have `skos:definition` or `obo:IAO_0000115`.

```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX obo: <http://purl.obolibrary.org/obo/>

SELECT (COUNT(?c) AS ?total)
       (COUNT(?def) AS ?defined)
WHERE {
  ?c a owl:Class .
  FILTER(!isBlank(?c))
  OPTIONAL {
    { ?c skos:definition ?def }
    UNION
    { ?c obo:IAO_0000115 ?def }
  }
}
```

### 7. Naming Convention Compliance

Verify against `_shared/naming-conventions.md`:
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

Target: zero results (except intentional top-level domain classes aligned
directly under BFO categories).

### 9. Disjointness Coverage

Sibling classes should be declared disjoint. Check for missing disjointness
(see `_shared/anti-patterns.md` #4).

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

Validate:

```bash
pyshacl -s shapes/ontology-shapes.ttl -i rdfs ontology.ttl -f human
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

```sparql
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX obo: <http://purl.obolibrary.org/obo/>

SELECT ?class WHERE {
  ?class a owl:Class .
  FILTER(!isBlank(?class))
  FILTER NOT EXISTS { ?class skos:definition ?def }
  FILTER NOT EXISTS { ?class obo:IAO_0000115 ?def }
}
```

#### 12.2 Property Completeness (missing domain/range)

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

Review against intended design before deleting terms.

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
5. **Coverage metrics** — informational, non-blocking
6. **Extended quality dimensions** — accuracy, coverage, succinctness, qualitative review before release

## SSSOM Mapping Checks (when applicable)

```bash
sssom validate mappings/source-to-target.sssom.tsv
```

- Valid SSSOM schema conformance
- All CURIEs resolvable via curie_map
- No self-mappings (subject = object)
- No duplicate mappings
- Every mapping has `mapping_justification`
- Confidence scores present for automated mappings

## Automation

These checks should be integrated into pre-commit hooks. The Justfile
provides `just check` for running all quality gates:

```bash
uv run ruff check .              # Python linting
uv run ruff format --check .     # Python formatting
uv run mypy src/                 # Type checking
uv run pytest                    # Python tests
# Plus ontology-specific checks above for any modified .ttl/.owl files
```
