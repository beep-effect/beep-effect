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
reasoner after structural changes. You NEVER hand-edit ontology files:
every change is made by a tool that writes a new file, you show the
difference, and the curated file is replaced only after the person
approves it. If the project generates its ontology files from another
source (a schema, a vocabulary module, a LinkML file), the generated
files are read-only: change the source and regenerate, and use the tools
below only to read the generated files or to write scratch copies.

## When to Activate

- User wants to create or modify ontology classes, properties, or axioms
- User mentions "add class", "define property", "create axiom", "formalize"
- User wants to formalize a conceptual model as OWL
- Pipeline A Step 4

## Shared Reference Materials

Read these files from `../_shared/` (relative to this skill's directory)
before beginning work:

- `../_shared/methodology-backbone.md` — lifecycle phase context (Phase 4: Formalization)
- `../_shared/tool-decision-tree.md` — when to use each tool
- `../_shared/axiom-patterns.md` — OWL pattern catalog
- `../_shared/naming-conventions.md` — naming and ID minting standards
- `../_shared/namespaces.json` — canonical prefixes
- `../_shared/quality-checklist.md` — validation requirements after changes

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
| Full expressivity needed | OWL 2 DL | None (most expressive decidable profile) | HermiT or JFact in ROBOT; Openllet through its own CLI |
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
- Required minimum for terms is defined in `../_shared/naming-conventions.md`;
  use the same conventions in generated templates and KGCL patches.
- Include PROV-O fields when provenance tracking is required by the project.

### Step 3: Bulk Term Creation via ROBOT Template

For adding >5 terms from the glossary, generate a ROBOT template TSV:

```tsv
ID	LABEL	SC %	DEFINITION	DEFINITION SOURCE
ID	AL rdfs:label@en	SC %	A skos:definition	A dcterms:source
EX:0001	piano	EX:0000	A keyboard instrument that produces sound by striking strings	glossary
EX:0002	violin	EX:0000	A string instrument played with a bow	glossary
```

The definition column uses the project's one definition property
(`skos:definition` or `obo:IAO_0000115`, as the scope records), the source
column its family's (`dcterms:source`, or `obo:IAO_0000119`;
`../_shared/naming-conventions.md`).

Execute, writing to a new file (never to the input path):

```bash
robot --prefix "EX: http://example.org/EX_" --prefix "dcterms: http://purl.org/dc/terms/" \
  template --input ontology.ttl --merge-before \
  --template instruments-template.tsv \
  --output ontology.new.ttl
```

Show the person the triples added and removed, and replace `ontology.ttl`
with `ontology.new.ttl` only after they approve:

```bash
uv run --with rdflib python -c '
import sys
from rdflib import Graph
from rdflib.compare import to_isomorphic, graph_diff
old, new = (to_isomorphic(Graph().parse(p)) for p in sys.argv[1:3])
_, removed, added = graph_diff(old, new)
for t in sorted(removed): print("-", *(x.n3() for x in t))
for t in sorted(added): print("+", *(x.n3() for x in t))
' ontology.ttl ontology.new.ttl
```

### ROBOT Template Pitfalls

These issues are learned through experience and not well-documented:

- **Column header syntax is fragile**: The second row defines semantics
  (e.g., `SC %`, `A rdfs:label`). A typo or extra space causes silent
  failures, not errors. Double-check headers before running.
- **The `%` placeholder in expressions**: `SC 'has part' some %` must have
  exact quoting and spacing. This is where most template errors occur.
- **Merge vs replace**: `--merge-before` and `--merge-after` control whether
  template output merges with the input or replaces it. The default is no
  merge: only the template's terms are output, so writing that over the
  input deletes the rest of the ontology. Pass `--merge-before` and write
  to a new file.
- **IRI resolution**: Template values must be full IRIs or CURIEs that
  resolve via the ontology's prefix declarations. Undeclared prefixes
  produce blank or invalid output with no error.
- **Multi-value columns**: To put multiple superclasses or annotations on
  one term, use `SPLIT=|` in the column header. Not obvious from docs.
- **Empty cells skip silently**: Empty cells in required columns skip the
  row rather than raising an error. Terms can be partially created (label
  but no definition).
- **Language tags**: Use `AL rdfs:label@en` to add a language tag. Without
  it, labels are untagged string literals, causing issues with tools that
  filter by language.
- **Labels in expressions**: A quoted label such as `'has part'` in an `SC`
  expression must resolve to an `rdfs:label` in the `--input` ontology.

**Pre-flight check**: Before running `robot template`, verify that all column
headers parse correctly and all CURIEs resolve against declared prefixes.

### Step 4: Individual Changes via KGCL

For single additions, modifications, or reparenting. Write the KGCL
commands to a `.kgcl` file and present it for review BEFORE applying.

```text
create node EX:0001 'piano'
create edge EX:0001 rdfs:subClassOf EX:0000
add definition 'A keyboard instrument that produces sound by striking strings' to EX:0001
rename EX:0001 from 'piano' to 'grand piano'
delete edge EX:0010 rdfs:subClassOf EX:0000
create edge EX:0010 rdfs:subClassOf EX:0002
```

Reparent with `delete edge` plus `create edge`: with oaklib 0.7.5,
`move EX:0010 rdfs:subClassOf EX:0000 from EX:0000 to EX:0002` fails
`--dry-run` and, applied to an OBO file, exits 0 without changing it.

```bash
# Check that every line parses (writes nothing)
uvx --from oaklib runoak -i simpleobo:ontology-edit.obo apply --dry-run --changes-input changes.kgcl

# After approval, apply to a new file, then read the result
uvx --from oaklib runoak -i simpleobo:ontology-edit.obo apply \
  --changes-input changes.kgcl -o ontology-edit.new.obo
```

`runoak apply --help` warns that "only a subset of KGCL commands are
supported by each backend". Checked with oaklib 0.7.5: on an OBO file
(`simpleobo:`) all six lines above apply, but each `create edge` writes
`is_a: EX:0000  {description="None"}`: remove that qualifier before the
file is approved. On a Turtle file (the rdflib backend) `create edge` and
`delete edge` add or remove the triple, `rename` changes nothing, and every
write also rewrites each language-tagged literal in the whole file
as a plain string (`"piano"@en` becomes `"piano"`); `create node` and
`add definition` fail, and a CURIE resolves only if its prefix is in
kgcl-rdflib's built-in list (`obo`, `ex`, `BFO`, `IAO`, `GO` and a few
others). Do not use KGCL apply on a Turtle ontology: make the change with
a ROBOT template (Step 3) or rdflib (Step 5). Always read the output
file, with the diff in Step 3: an exit code of 0 does not mean the change
was made, or that nothing else changed.

### Step 5: Complex Axioms via OWLAPY or rdflib

For property chains, or axioms generated programmatically; ROBOT templates
already write qualified cardinality and nested class expressions.

**Tool choice**: Most OBO community practitioners use **rdflib** for
programmatic OWL work in Python (triple-level manipulation). **OWLAPY**
provides a higher-level OWL API but has a smaller community. It is pure
Python; adding a complex axiom needs its owlready2 backend (its
rdflib-only `RDFLibOntology` adds only equivalences between named
classes), and only its `Sync*` classes need a JVM. Use whichever fits
your team's stack — examples of both follow. Both write a new file;
review it with the graph diff in Step 3 before replacing the original.

OWLAPY example (owlapy 1.6, RDF/XML input):

```bash
uv run --with owlapy --with owlready2 python -c '
from owlapy.class_expression import OWLClass, OWLObjectSomeValuesFrom, OWLObjectIntersectionOf
from owlapy.owl_property import OWLObjectProperty
from owlapy.owl_axiom import OWLEquivalentClassesAxiom
from owlapy.owl_ontology import Ontology

onto = Ontology("file:///path/to/ontology.owl")

# StringInstrument EquivalentTo Instrument and hasComponent some String
instrument = OWLClass("http://example.org/Instrument")
string_cls = OWLClass("http://example.org/String")
string_instrument = OWLClass("http://example.org/StringInstrument")
has_comp = OWLObjectProperty("http://example.org/hasComponent")

definition = OWLObjectIntersectionOf([instrument, OWLObjectSomeValuesFrom(has_comp, string_cls)])
onto.add_axiom(OWLEquivalentClassesAxiom([string_instrument, definition]))

onto.save(path="ontology.new.owl")
'
```

rdflib alternative:

```bash
uv run --with rdflib python -c '
from rdflib import Graph, Namespace, OWL, RDF, RDFS, BNode

g = Graph()
g.parse("ontology.ttl", format="turtle")

EX = Namespace("http://example.org/")

# Add existential restriction: StringInstrument SubClassOf hasComponent some String
restriction = BNode()
g.add((restriction, RDF.type, OWL.Restriction))
g.add((restriction, OWL.onProperty, EX.hasComponent))
g.add((restriction, OWL.someValuesFrom, EX.String))
g.add((EX.StringInstrument, RDFS.subClassOf, restriction))

g.serialize("ontology.new.ttl", format="turtle")
'
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
default_prefix: music
imports:
  - linkml:types

classes:
  Instrument:
    description: A device used to produce music
    attributes:
      name:
        range: string
        required: true
      instrument_family:
        range: InstrumentFamily
  InstrumentFamily:
    description: A group of instruments that produce sound the same way
```

Generate artifacts:

```bash
uvx --from linkml gen-owl schema.yaml > ontology.ttl
uvx --from linkml gen-shacl schema.yaml > shapes.ttl
uvx --from linkml gen-python schema.yaml > models.py
```

The LinkML file is then the source: regenerate the generated files
rather than editing them, and keep enrichment axioms in a separate file
that imports the generated OWL.

### Step 7: Verify (after structural changes)

Reasoning strategy depends on context:

| Context | Reasoner | Frequency | Time Budget |
|---------|----------|-----------|-------------|
| Active development | ELK for an EL ontology, otherwise `hermit` | After each batch of changes | Seconds (10K classes) |
| Pre-commit / CI | ELK for an EL ontology, otherwise `hermit` or `jfact` | Every commit | < 2 minutes |
| Pre-release validation | `hermit` or `jfact` | Before each release | Minutes to hours |

**Important**: ELK only supports OWL 2 EL. If your ontology uses qualified
cardinality, universal restrictions, or class complements, ELK will silently
ignore those axioms, so it is never the consistency gate for such an
ontology. If a DL reasoner times out, do not fall back to ELK as a pass:
report the result as unchecked for the axioms outside EL.
ROBOT's reasoners are `ELK` (the default), `hermit`, `jfact`, `whelk`, `emr` and `structural`; Openllet runs through its own CLI.

```bash
# Fast classification (ELK — an OWL 2 EL ontology only)
robot reason --reasoner ELK --input ontology.ttl --output classified.ttl

# Full DL classification (HermiT — any OWL 2 DL ontology)
robot reason --reasoner hermit --input ontology.ttl --output classified.ttl

# Quality report
robot report --input ontology.ttl --fail-on ERROR --output report.tsv

# SHACL validation (if shapes exist); no inference, so rdfs:domain and
# rdfs:range cannot supply the types a shape checks
uvx pyshacl -s shapes/ontology-shapes.ttl -i none ontology.ttl -f human
```

`robot report`'s `missing_definition` check reads only
`obo:IAO_0000115` (or an `obo:IAO_0000600` elucidation), and the default
profile reports it as WARN, so `--fail-on ERROR` does not check
definitions. Check the project's definition property (`skos:definition`
or `obo:IAO_0000115`, as the scope records) with a SHACL shape (`sh:path skos:definition ; sh:minCount 1` on
`owl:Class`) or a SPARQL query.

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
robot merge --input edit-ontology.ttl --inputs "imports/*.owl" --output merged.ttl

# Convert formats (ROBOT writes json as OBO Graphs JSON, not JSON-LD)
robot convert --input ontology.ttl --output ontology.owl

# JSON-LD comes from rdflib instead
uv run --with rdflib python -c 'from rdflib import Graph; Graph().parse("ontology.ttl").serialize("ontology.jsonld", format="json-ld")'

# Annotate with version (to a new file; replace after review)
robot annotate --input ontology.ttl \
  --annotation owl:versionInfo "$(date +%Y-%m-%d)" \
  --output ontology.new.ttl
```

### oaklib operations

On a Turtle file, oaklib resolves the project's CURIEs only when the
prefix is passed with `--prefix` (or use full IRIs).

```bash
# Search before creating (always!)
uvx --from oaklib runoak -i ontology.ttl search "piano"

# Get term info
uvx --from oaklib runoak --prefix EX=http://example.org/EX_ -i ontology.ttl info EX:0001

# Visualize the hierarchy below a term
uvx --from oaklib runoak --prefix EX=http://example.org/EX_ -i ontology.ttl tree .desc//p=i EX:0000 -p i
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
  `ontologies/{name}/docs/conceptual-model.yaml`, `ontologies/{name}/docs/upper-alignment.md`,
  `ontologies/{name}/docs/property-design.yaml`, `ontologies/{name}/docs/axiom-plan.yaml`
  (formalize only entries with `status: ratified`; return `proposed` ones), plus the auditor's `work/dispositions.index.yaml` carried forward unchanged
  (the unresolved/deferred remainder — never dropped at any handoff)
- `ontology-requirements` (indirect, via pipeline) — `ontologies/{name}/tests/*.sparql`,
  `ontologies/{name}/tests/cq-test-manifest.yaml` (CQ test suite to forward to validator)

**Passes to**: `ontology-validator` — `ontologies/{name}/{name}.ttl`,
`ontologies/{name}/shapes/{name}-shapes.ttl`, `ontologies/{name}/tests/*.sparql`,
`ontologies/{name}/tests/cq-test-manifest.yaml`,
plus `work/dispositions.index.yaml` (carried forward unchanged)

**Handoff checklist**:
- [ ] Ontology passes `robot reason`, with the reasoner Step 7 names for
  its profile, with zero unsatisfiable classes
- [ ] Ontology passes `robot report` with zero ERRORs
- [ ] Every class has `rdfs:label` and the project's definition property (checked by the
  SHACL shape or query in Step 7; `robot report` does not check it)
- [ ] All glossary terms are present in the ontology
- [ ] Every `ratified` property-design and axiom-plan entry is implemented; no `proposed` one is
- [ ] SHACL shapes exist for core structural constraints

## Anti-Patterns to Avoid

- **Hand-editing Turtle**: Never manually edit `.ttl` files. Use ROBOT,
  oaklib, or Python tools, and never edit a generated file at all.
- **Skipping the reasoner**: Always run `robot reason` after structural
  changes.
- **Deleting terms**: Never delete — deprecate with `owl:deprecated true`.
- **Applying unreviewed changes**: Show the proposed change (the `.kgcl`
  file, the template, the graph diff) and apply it only after approval.
- **Over-engineering tools**: Don't use OWLAPY for simple SubClassOf. Use
  ROBOT template or KGCL instead. (See tool decision tree)
- **Missing metadata**: Every class needs `rdfs:label` and a definition in the
  project's one definition property; a gap blocks a release.
- **Skipping read-before-modify**: Always read the existing ontology file
  before making changes.
- **Writing over the input**: Every tool writes to a new file (never the
  input path); the curated file is replaced only after the diff is
  approved, so the original stays as the checkpoint.

## Error Handling

| Error | Likely Cause | Recovery |
|-------|-------------|----------|
| Reasoner reports INCONSISTENT | Conflicting axioms (often disjointness + subclass) | Parse explanation, identify conflicting axioms, propose minimal fix |
| Unsatisfiable classes found | Over-constrained class (contradictory restrictions) | List unsatisfiable classes, trace disjointness axioms |
| ROBOT template fails | Column headers don't match expected format | Check ROBOT template documentation for column syntax |
| KGCL apply fails | Term not found, invalid KGCL syntax, or a command the backend does not support | Run `apply --dry-run` to check the parse; verify the term with `runoak info`; use the `simpleobo:` backend or another tool (Step 4) |
| OWLAPY `ImportError: owlready2 is required` | owlready2 backend not installed | Add `--with owlready2` to the `uv run` command |
| OWLAPY JVM bridge error (`Sync*` classes only) | Java not installed or JVM not found | Ensure JDK is installed and JAVA_HOME is set |
