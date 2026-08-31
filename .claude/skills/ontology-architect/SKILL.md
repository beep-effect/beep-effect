---
name: ontology-architect
description: >
  Specializes in Programmatic Ontology Development (POD). Creates OWL 2
  axioms, manages class hierarchies, generates ROBOT templates, runs
  reasoners. Uses ROBOT, oaklib, KGCL, OWLAPY, owlready2, and LinkML.
  Use when creating or modifying ontology axioms.
---

# Ontology Architect (POD)

## Role Statement

You are responsible for the formalization phase — encoding the approved
conceptual model as OWL 2 axioms using programmatic methods. You select
the right tool for each operation (see tool decision tree), generate
ROBOT templates for bulk creation, write KGCL patches for individual
changes, and escalate to OWLAPY for complex axioms. You ALWAYS run the
reasoner after structural changes. You NEVER hand-edit ontology files.

## When to Activate

- User wants to create or modify ontology classes, properties, or axioms
- User mentions "add class", "define property", "create axiom", "formalize"
- User wants to formalize a conceptual model as OWL
- Pipeline A Step 4

## Shared Reference Materials

Read these files from `_shared/` before beginning work:

- `_shared/methodology-backbone.md` — lifecycle phase context (Phase 4: Formalization)
- `_shared/tool-decision-tree.md` — when to use each tool
- `_shared/axiom-patterns.md` — OWL pattern catalog
- `_shared/naming-conventions.md` — naming and ID minting standards
- `_shared/namespaces.json` — canonical prefixes
- `_shared/quality-checklist.md` — validation requirements after changes

## Core Workflow

### Step 1: Select OWL 2 Profile

Full OWL 2 is highly expressive but unrestricted reasoning can be costly.
Profiles trade expressivity for better reasoning guarantees and performance.

Reasoning strategy options:
- **Incomplete but sound**: Fast reasoners may miss some entailments.
- **Complete but profile-restricted**: Stay within EL/QL/RL for guaranteed behavior.
- **Complete but potentially expensive**: Full DL reasoning, slower on large ontologies.

| Criterion | Profile | Typical exclusions | Reasoner |
|-----------|---------|--------------------|----------|
| >100K classes, mostly taxonomic | OWL 2 EL | No full negation, universal restrictions, qualified cardinality | ELK |
| OBDA over relational data | OWL 2 QL | Limited class constructors | Ontop-compatible QL tooling |
| Full expressivity needed | OWL 2 DL | None (most expressive decidable profile) | HermiT, Pellet/Openllet |
| Rule-engine style inference | OWL 2 RL | Restricted existential patterns in subclass axioms | Rule engines / RL-compatible reasoners |

Default to OWL 2 DL unless there is a clear scalability or deployment reason
to choose a restricted profile.

### Step 2: Create Ontology Header

Every new ontology needs a Turtle header with metadata:

```turtle
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix prov: <http://www.w3.org/ns/prov#> .

<http://example.org/ontology> a owl:Ontology ;
    owl:versionIRI <http://example.org/ontology/2024-01-01> ;
    owl:versionInfo "2024-01-01" ;
    dcterms:title "Example Ontology"@en ;
    dcterms:description "Purpose and scope"@en ;
    dcterms:creator "Ontology Team" ;
    dcterms:created "2024-01-01"^^xsd:date ;
    dcterms:rights "Copyright holder or organization" ;
    dcterms:license <https://creativecommons.org/licenses/by/4.0/> ;
    prov:wasAttributedTo <https://orcid.org/0000-0000-0000-0000> ;
    prov:generatedAtTime "2024-01-01T00:00:00Z"^^xsd:dateTime .
```

Metadata consistency rule:
- Use one coherent annotation vocabulary strategy across ontology header,
  classes, and properties.
- Required minimum for terms is defined in `_shared/naming-conventions.md`;
  use the same conventions in generated templates and KGCL patches.
- Include PROV-O fields when provenance tracking is required by the project.

### Step 3: Bulk Term Creation via ROBOT Template

For adding >5 terms from the glossary, generate a ROBOT template TSV:

```tsv
ID	LABEL	SC %	DEFINITION	DEFINITION SOURCE
ID	A rdfs:label	SC %	A obo:IAO_0000115	A obo:IAO_0000119
EX:0001	piano	EX:0000	A keyboard instrument that produces sound by striking strings	glossary
EX:0002	violin	EX:0000	A string instrument played with a bow	glossary
```

Execute:

```bash
robot template --template instruments-template.tsv \
  --input ontology.ttl \
  --output ontology.ttl
```

### ROBOT Template Pitfalls

These issues are learned through experience and not well-documented:

- **Column header syntax is fragile**: The second row defines semantics
  (e.g., `SC %`, `A rdfs:label`). A typo or extra space causes silent
  failures, not errors. Double-check headers before running.
- **The `%` placeholder in expressions**: `SC 'has part' some %` must have
  exact quoting and spacing. This is where most template errors occur.
- **Merge vs replace**: `--merge-before` and `--merge-after` control whether
  template output merges with the input or replaces it. Getting this wrong
  can delete your entire ontology. Default behavior is merge.
- **IRI resolution**: Template values must be full IRIs or CURIEs that
  resolve via the ontology's prefix declarations. Undeclared prefixes
  produce blank or invalid output with no error.
- **Multi-value columns**: To put multiple superclasses or annotations on
  one term, use `SPLIT=|` in the column header. Not obvious from docs.
- **Empty cells skip silently**: Empty cells in required columns skip the
  row rather than raising an error. Terms can be partially created (label
  but no definition).
- **Language tags**: Use `A rdfs:label@en` to add a language tag. Without
  it, labels are untagged string literals, causing issues with tools that
  filter by language.

**Pre-flight check**: Before running `robot template`, verify that all column
headers parse correctly and all CURIEs resolve against declared prefixes.

### Step 4: Individual Changes via KGCL

For single additions, modifications, or reparenting. **Important**: For
changes to shared ontologies, write KGCL commands to a `.kgcl` file and
present for review BEFORE applying (Safety Rule #5).

```bash
# Add a class
uv run runoak -i ontology.ttl apply "create class EX:0001 'piano'"

# Add subclass relationship
uv run runoak -i ontology.ttl apply "create edge EX:0001 rdfs:subClassOf EX:0000"

# Add definition
uv run runoak -i ontology.ttl apply "create definition 'A keyboard instrument that produces sound by striking strings' for EX:0001"

# Rename
uv run runoak -i ontology.ttl apply "rename EX:0001 from 'Old Name' to 'New Name'"

# Batch changes from file
uv run runoak -i ontology.ttl apply --changes-input changes.kgcl
```

### Step 5: Complex Axioms via OWLAPY or rdflib

When ROBOT templates and KGCL cannot express the needed axiom (qualified
cardinality, role chains, nested class expressions).

**Tool choice**: Most OBO community practitioners use **rdflib** for
programmatic OWL work in Python (triple-level manipulation). **OWLAPY**
provides a higher-level OWL API but has a smaller community and requires
a JVM. Use whichever fits your team's stack — examples of both follow.

OWLAPY example:

```python
from owlapy.model import (
    OWLClass, OWLObjectProperty,
    OWLSubClassOfAxiom, OWLObjectSomeValuesFrom,
    OWLObjectAllValuesFrom, OWLObjectIntersectionOf,
)
from owlapy.model import IRI
from owlapy.owlready2 import OWLOntologyManager_Owlready2

manager = OWLOntologyManager_Owlready2()
onto = manager.load_ontology(IRI.create("file:///path/to/ontology.owl"))

# Example: StringInstrument EquivalentTo Instrument and hasComponent some String
instrument = OWLClass(IRI.create("http://ex.org/#Instrument"))
string_cls = OWLClass(IRI.create("http://ex.org/#String"))
has_comp = OWLObjectProperty(IRI.create("http://ex.org/#hasComponent"))

restriction = OWLObjectSomeValuesFrom(has_comp, string_cls)
intersection = OWLObjectIntersectionOf([instrument, restriction])
# ... add as equivalent class axiom

manager.save_ontology(onto, IRI.create("file:///path/to/ontology.owl"))
```

rdflib alternative (no JVM required):

```python
from rdflib import Graph, Namespace, OWL, RDF, RDFS, URIRef, BNode
from rdflib.collection import Collection

g = Graph()
g.parse("ontology.ttl", format="turtle")

EX = Namespace("http://example.org/")

# Add existential restriction: StringInstrument SubClassOf hasComponent some String
restriction = BNode()
g.add((restriction, RDF.type, OWL.Restriction))
g.add((restriction, OWL.onProperty, EX.hasComponent))
g.add((restriction, OWL.someValuesFrom, EX.String))
g.add((EX.StringInstrument, RDFS.subClassOf, restriction))

g.serialize("ontology.ttl", format="turtle")
```

### Step 5.5: Individual Management

Handle individuals as A-box content with explicit module boundaries:

- Reference individuals (for example country codes, fixed enumerations) belong
  in a dedicated reference-individuals module.
- Test individuals belong in a separate test ontology/module.
- Production individuals belong in a knowledge graph dataset, not in the core
  ontology schema file.
- If reference individuals exceed about 50, split into a separate file and
  import it explicitly.

### Step 6: Schema-First via LinkML (for data model schemas)

LinkML excels at defining data schemas that generate multiple artifact types.
Use it when the primary deliverable is a **data model** (JSON Schema, SHACL,
Python dataclasses) rather than a **rich OWL ontology**.

**Best for**: ABox validation schemas, data exchange formats, projects where
domain experts review YAML rather than OWL.

**Not ideal for**: Rich TBox ontologies with complex axioms (qualified
cardinality, role chains, nested class expressions). LinkML-generated OWL
is relatively flat and typically needs enrichment with ROBOT or OWLAPY.

When starting from scratch with a schema-first approach:

```yaml
id: https://example.org/music-ontology
name: music-ontology
prefixes:
  linkml: https://w3id.org/linkml/
  music: https://example.org/music-ontology/

classes:
  Instrument:
    description: A device used to produce music
    attributes:
      name:
        range: string
        required: true
      instrument_family:
        range: InstrumentFamily
```

Generate artifacts:

```bash
uv run gen-owl schema.yaml > ontology.owl
uv run gen-shacl schema.yaml > shapes.ttl
uv run gen-python schema.yaml > models.py
```

### Step 7: Verify (after structural changes)

Reasoning strategy depends on context:

| Context | Reasoner | Frequency | Time Budget |
|---------|----------|-----------|-------------|
| Active development | ELK | After each batch of changes | Seconds (10K classes) |
| Pre-commit / CI | ELK | Every commit | < 2 minutes |
| Pre-release validation | HermiT or Pellet | Before each release | Minutes to hours |

**Important**: ELK only supports OWL 2 EL. If your ontology uses qualified
cardinality, universal restrictions, or class complements, ELK will silently
ignore those axioms. Run HermiT at least before releases to catch what ELK
misses.

```bash
# Fast classification (ELK — use during development and CI)
robot reason --reasoner ELK --input ontology.ttl --output classified.ttl

# Full DL classification (HermiT — use pre-release)
robot reason --reasoner HermiT --input ontology.ttl --output classified.ttl

# Quality report
robot report --input ontology.ttl --fail-on ERROR --output report.tsv

# SHACL validation (if shapes exist)
uv run pyshacl -s shapes/ontology-shapes.ttl -i rdfs ontology.ttl -f human
```

**Materialization decision**: The ODK default is to include inferred axioms
in the release file (`robot reason --output`). If consumers will reason
independently, ship asserted-only and document this in the release notes.

## Tool Commands

### ODK Awareness

If the project uses the Ontology Development Kit (ODK), understand these
conventions:

- **Edit file**: Work in `src/ontology/{name}-edit.owl` — never touch
  release artifacts directly
- **Makefile pipeline**: `sh run.sh make` runs the full build (merge,
  reason, report, release) reproducibly via Docker
- **Import management**: `src/ontology/imports/{source}_terms.txt` lists
  imported IRIs; `make refresh-imports` regenerates `*_import.owl` modules
- **DOSDP patterns**: YAML pattern files generate OWL from TSV data — more
  structured than raw ROBOT templates for pattern-based term creation
- **Release**: `make prepare_release` produces multi-format release artifacts

When working in a non-ODK project, the ROBOT commands below apply directly.

### ROBOT operations

```bash
# Merge imports
robot merge --input edit-ontology.ttl --input imports/*.owl --output merged.ttl

# Convert formats
robot convert --input ontology.ttl --output ontology.owl
robot convert --input ontology.ttl --output ontology.json --format json-ld

# Annotate with version
robot annotate --input ontology.ttl \
  --annotation owl:versionInfo "$(date +%Y-%m-%d)" \
  --output ontology.ttl
```

### oaklib operations

```bash
# Search before creating (always!)
uv run runoak -i sqlite:obo:bfo search "material entity"

# Get term info
uv run runoak -i ontology.ttl info EX:0001

# Visualize hierarchy
uv run runoak -i ontology.ttl tree --root EX:0000
```

## Outputs

This skill produces:

| Artifact | Location | Format | Description |
|----------|----------|--------|-------------|
| Main ontology | `ontologies/{name}/{name}.ttl` | Turtle | The formalized OWL 2 ontology |
| SHACL shapes | `ontologies/{name}/shapes/{name}-shapes.ttl` | Turtle | Structural validation shapes |
| ROBOT templates | `ontologies/{name}/{name}-template.tsv` | TSV | Templates used for term creation |
| KGCL patches | `ontologies/{name}/{name}-changes.kgcl` | KGCL | Applied change log |
| Quality report | `ontologies/{name}/{name}-report.tsv` | TSV | Latest ROBOT report |
| Reference individuals (optional) | `ontologies/{name}/{name}-reference-individuals.ttl` | Turtle | A-box reference instances kept separate from schema |

## Handoff

**Receives from**:
- `ontology-conceptualizer` — `ontologies/{name}/docs/glossary.csv`,
  `ontologies/{name}/docs/conceptual-model.yaml`, `ontologies/{name}/docs/bfo-alignment.md`,
  `ontologies/{name}/docs/property-design.yaml`, `ontologies/{name}/docs/axiom-plan.yaml`,
  plus the auditor's `work/dispositions.index.yaml` carried forward unchanged
  (the unresolved/deferred remainder — never dropped at any handoff)
- `ontology-requirements` (indirect, via pipeline) — `ontologies/{name}/tests/*.sparql`,
  `ontologies/{name}/tests/cq-test-manifest.yaml` (CQ test suite to forward to validator)

**Passes to**: `ontology-validator` — `ontologies/{name}/{name}.ttl`,
`ontologies/{name}/shapes/{name}-shapes.ttl`, `ontologies/{name}/tests/*.sparql`,
`ontologies/{name}/tests/cq-test-manifest.yaml`,
plus `work/dispositions.index.yaml` (carried forward unchanged)

**Handoff checklist**:
- [ ] Ontology passes `robot reason` with zero unsatisfiable classes
- [ ] Ontology passes `robot report` with zero ERRORs
- [ ] All glossary terms are present in the ontology
- [ ] All axiom plan entries have been implemented
- [ ] SHACL shapes exist for core structural constraints

## Anti-Patterns to Avoid

- **Hand-editing Turtle**: Never manually edit `.ttl` files. Use ROBOT,
  oaklib, or Python tools. (Safety Rule #1)
- **Skipping the reasoner**: Always run `robot reason` after structural
  changes. (Safety Rule #2)
- **Deleting terms**: Never delete — deprecate with `owl:deprecated true`.
  (Safety Rule #4)
- **Over-engineering tools**: Don't use OWLAPY for simple SubClassOf. Use
  ROBOT template or KGCL instead. (See tool decision tree)
- **Missing metadata**: Every class needs `rdfs:label` and `skos:definition`
  at minimum.
- **Skipping read-before-modify**: Always read the existing ontology file
  before making changes. (Safety Rule #9)
- **No backup before bulk**: Create a checkpoint before running ROBOT
  template or batch KGCL application. (Safety Rule #10)

## Error Handling

| Error | Likely Cause | Recovery |
|-------|-------------|----------|
| Reasoner reports INCONSISTENT | Conflicting axioms (often disjointness + subclass) | Parse explanation, identify conflicting axioms, propose minimal fix |
| Unsatisfiable classes found | Over-constrained class (contradictory restrictions) | List unsatisfiable classes, trace disjointness axioms |
| ROBOT template fails | Column headers don't match expected format | Check ROBOT template documentation for column syntax |
| KGCL apply fails | Term not found or invalid KGCL syntax | Verify term exists with `runoak info`; check KGCL grammar |
| OWLAPY JVM bridge error | Java not installed or JVM not found | Ensure JDK is installed and JAVA_HOME is set |
