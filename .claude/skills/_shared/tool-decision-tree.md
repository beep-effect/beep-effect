# Tool Decision Tree

When to use each ontology tool. Primary tools should be attempted first;
escalate to secondary tools only when the primary tool cannot handle the task.

## Decision Flowchart

First: is the RDF/OWL file the source, or is it generated from another
source (a LinkML schema, a code module, a spreadsheet)? If it is generated,
change the source and regenerate; treat the generated files as read-only,
and let the tools below only read them or write scratch copies.

```
What do you need to do?
│
├── Create/modify ontology terms in BULK (>5 terms)?
│   └── ROBOT template
│
├── Make a SINGLE change (rename, reparent, add synonym, deprecate)?
│   └── KGCL via oaklib (runoak apply)
│
├── Search for existing terms or navigate hierarchy?
│   └── oaklib (runoak search, runoak ancestors, runoak descendants)
│
├── Run quality checks or generate reports?
│   └── ROBOT (reason, report, verify, diff)
│
├── Validate data against structural constraints?
│   └── pyshacl
│
├── Build axioms ROBOT templates cannot write?
│   │   (property chains, axioms generated programmatically)
│   └── OWLAPY
│
├── Rapid prototype or explore ontology as Python objects?
│   └── owlready2
│
├── Define a schema that generates multiple artifact types?
│   │   (OWL + SHACL + JSON Schema + Python classes)
│   └── LinkML
│
├── Manipulate raw RDF triples or custom serialization?
│   └── rdflib
│
├── Create or validate SSSOM mapping files?
│   └── sssom-py
│
└── Generate SPARQL queries or query a triple store?
    └── See sparql-expert skill
```

## Primary Tools (use first)

### ROBOT CLI

| Operation | Command | When to Use |
|-----------|---------|-------------|
| Bulk term creation | `robot template` | Adding >5 terms from tabular data |
| Merge modules | `robot merge` | Combining imports or components |
| Classify ontology | `robot reason` | After any structural change |
| Quality report | `robot report` | Before every commit |
| Run violation queries | `robot verify` | Queries that must return no rows; any row fails |
| Run CQ queries | `robot query` | Enumerative CQs; compare the rows with the expected result |
| Compare versions | `robot diff` | PR descriptions, changelogs |
| Convert formats | `robot convert` | Writes Turtle, RDF/XML, OWL/XML, OBO, Manchester, functional syntax and OBO Graphs JSON (not JSON-LD); loading a file with any command is also its syntax check (there is no `robot validate`) |
| Extract module | `robot extract` | Importing subset of external ontology |
| Annotate | `robot annotate` | Adding version info, metadata |

#### Reasoner Selection

| Reasoner | Strengths | Trade-offs | Use When |
|----------|-----------|------------|----------|
| ELK | Very fast on EL ontologies | Ignores axioms outside OWL 2 EL | EL-only ontologies, large taxonomies, frequent CI checks |
| HermiT | Complete OWL DL reasoning | Slower on large/complex models | Any ontology that uses constructs outside EL |
| JFact | OWL DL reasoning | Slower; less used | A second DL reasoner to compare with HermiT |
| Whelk | Fast EL reasoning | EL only | An alternative to ELK |
| EMR | ELK plus materialized relations | EL only | Inferring existential relations between named classes |
| structural | No reasoning beyond asserted structure | Finds no entailments | Quick checks of asserted hierarchy only |

ROBOT's reasoners are `ELK` (the default), `hermit`, `jfact`, `whelk`, `emr` and `structural` (the
`--reasoner` values). Openllet (Pellet) is not one of them: it runs through
its own CLI, outside ROBOT.

Practical guidance:
- ELK is the workhorse for OBO ontologies that stay inside OWL 2 EL — use
  it there for daily development and CI.
- ELK handles OWL 2 EL only. It silently ignores axioms outside EL (qualified
  cardinality, universal restrictions, complements, inverse properties).
  It is never the consistency gate for an ontology that uses those, and
  never a silent fallback when HermiT times out: if ELK is run instead,
  say which axioms were left unchecked.
- Use HermiT (or Openllet outside ROBOT) whenever the ontology uses
  constructs outside EL, and for pre-release validation.
- Timing expectations: ELK on 10K classes takes seconds; HermiT on the same
  ontology may take minutes to hours.
- Incremental reasoning is not widely supported — reasoners re-classify the
  entire ontology even for a single axiom change. Reason at commit time or CI,
  not after every edit during active development.

### oaklib (runoak)

| Operation | Command | When to Use |
|-----------|---------|-------------|
| Term search | `runoak search` | Finding existing terms before creating |
| Hierarchy nav | `runoak ancestors` / `runoak descendants` | Exploring taxonomy |
| Apply change | `runoak apply` | Single KGCL changes |
| Batch changes | `runoak apply --changes-input` | Applying KGCL patch files |
| Lexical match | `runoak lexmatch` | Generating mapping candidates |
| Term info | `runoak info` | Retrieving term metadata |
| Validate | `runoak validate` | OBO-specific validation |

The names above assume runoak is installed; without a project, run it as
`uvx --from oaklib runoak ...`.

#### Known Limitations

oaklib is powerful but has rough edges that practitioners regularly encounter:

- **Adapter inconsistency**: Operations that work on one backend (SQLite,
  OLS, local OWL) may fail or return different results on another. Test
  commands against your specific adapter.
- **KGCL implementation is incomplete, and differs by backend**: each
  backend supports only a subset of KGCL. Checked with runoak 0.7.5: on an
  OBO file (`-i simpleobo:file.obo`), `obsolete`, `rename ... from ... to`,
  `create synonym`, `create edge`, `delete edge`, `add definition` and
  `create node` applied, and `move` was refused ("Cannot handle
  NodeMove"). On a local Turtle file (the rdflib backend), writing to a
  new file needs the output format too (`-o changed.ttl -O ttl`; with `-o`
  alone it fails with `No plugin registered for (None, Serializer)` and
  writes nothing), CURIEs resolve only from kgcl-rdflib's built-in prefix
  list (`obo`, `ex`, `BFO`, `IAO`, `GO` and a few others; any other prefix
  fails with `KeyError`), `create node` and `add definition` fail, `rename`
  changes nothing, every write turns each language-tagged literal in the
  file into a plain string (`"piano"@en` becomes `"piano"`), and `obsolete`
  went wrong differently in each test: it stored `owl:deprecated "true"` as
  a plain string, prefixed the label with "obsolete " and replaced the
  superclass with `oboInOwl:ObsoleteClass`; in another file it relabelled
  every class as obsolete; in a third it failed with a `TypeError`. Do not
  apply KGCL to a Turtle ontology; use an OBO edit file, ROBOT or rdflib.
  Never trust an apply you have not read: write to a new file and diff it
  against the input. When KGCL fails, fall back to ROBOT or rdflib.
- **SQLite cache staleness**: The `sqlite:obo:` adapter caches downloaded
  ontologies. Clear oaklib's download cache (the .data/oaklib directory
  under your home) to force refresh after upstream
  ontology releases.
- **Serialization instability**: Applying KGCL changes to local `.ttl` files
  can produce different prefix ordering or serialization format than the
  input. Normalize into a new file (`robot convert --input changed.ttl
  --output normalized.ttl`), review the diff, then replace the curated
  file. Never write output to the same path as the input.
- **Large batch performance**: oaklib's SQLite adapter is fast for search
  but slow for bulk KGCL application. For >20 changes, consider ROBOT
  template or direct rdflib manipulation instead.

### KGCL (Knowledge Graph Change Language)

Not a tool itself — a language processed by oaklib. Use for:

- Human-reviewable change proposals
- Auditable change history
- Batch changes via `.kgcl` files
- Changes that need user approval before applying

Common KGCL commands:
```
create node EX:0001 'new term'
obsolete EX:0042
rename EX:0001 from 'old name' to 'new name'
create synonym 'alt name' for EX:0001
create edge EX:0001 rdfs:subClassOf EX:0002
delete edge EX:0010 rdfs:subClassOf EX:0001
add definition 'A thing that...' to EX:0001
```

To reparent, use `delete edge` then `create edge`. The grammar has `move`
(`move EX:0010 rdfs:subClassOf EX:0001 from EX:0001 to EX:0002`), but
runoak 0.7.5 cannot use it: `apply --dry-run` fails with a rendering
error, and `apply` logs "Cannot handle NodeMove" and changes nothing.

Check the parse first, then apply into a new file and read the diff before
anything replaces the curated file (for a Turtle input, add `-O ttl` to the
apply):
```bash
uvx --from oaklib runoak -i simpleobo:edit.obo apply --dry-run "obsolete EX:0042"
uvx --from oaklib runoak -i simpleobo:edit.obo apply "obsolete EX:0042" -o edit-changed.obo
diff edit.obo edit-changed.obo
```

## Secondary Tools (escalation criteria)

### OWLAPY — When to escalate

Use when ROBOT templates cannot express the axiom AND you need an OWL
object model in Python (e.g., computing entailments, DL learners). ROBOT
templates already write qualified cardinality, nested class expressions and
equivalent-class definitions (any Manchester expression after `SC`, `EC` or
`DC`), and property characteristics (the `CHARACTERISTIC` column). Escalate
for:

- Role chains (`hasParent o hasParent SubPropertyOf hasGrandparent`)
- Programmatic axiom generation from external data with complex logic

OWLAPY (1.x: modules `owlapy.class_expression`, `owlapy.owl_axiom`,
`owlapy.iri`) is a Python library; only its OWL API reasoner bridge starts
a JVM.

**Note**: Most OBO community practitioners use **rdflib** (triple-level
manipulation, no JVM) rather than OWLAPY for programmatic Python work.
rdflib is the one Python fallback here; reach for OWLAPY only when you
need the OWL object model.

### owlready2 — When to escalate

Use for:

- Loading and exploring ontology as Python object graph
- Rapid prototyping where ORM-style access is faster than axiom manipulation
- Working with the built-in SQLite quadstore for large ontologies
- Accessing and modifying individual-level data (ABox operations)

### LinkML — When to escalate

Best for **data model schemas**, not rich OWL ontologies:

- Primary deliverable is a data schema (JSON Schema, SHACL, Python classes)
- Needing multiple artifact types from one source (OWL + SHACL + JSON Schema)
- Data models with strong tabular/JSON structure
- When domain experts need to review YAML rather than OWL

**Not ideal when**: The ontology requires complex axioms (qualified cardinality,
property chains, nested class expressions). LinkML-generated OWL is flat and
needs post-processing with ROBOT or OWLAPY for rich TBox content.

### rdflib — When to escalate

Use for:

- Custom RDF serialization or parsing
- Graph-level operations (merge, diff at triple level)
- SPARQL query execution against local files
- RDF-star triple manipulation
- When you need fine-grained control over individual triples

### sssom-py — When to escalate

Use for:

- SSSOM file validation (`sssom validate`)
- Mapping file merge and deduplication
- Converting between SSSOM formats (TSV ↔ JSON ↔ OWL)
- Programmatic mapping creation and analysis

### pyshacl — When to escalate

Use for:

- Validating RDF data against SHACL shapes
- Checking structural constraints (label coverage, definition coverage)
- Custom validation rules beyond what ROBOT report covers
- Data quality assessment for populated ontologies (ABox validation)

## Anti-Patterns in Tool Selection

| Anti-Pattern | Problem | Correct Approach |
|-------------|---------|-----------------|
| Hand-editing .ttl files | Bypasses validation, error-prone | Use ROBOT, oaklib, or Python tools. When the RDF is generated from another source, edit that source and regenerate instead |
| Using OWLAPY for simple SubClassOf | Over-engineering | Use ROBOT template or KGCL |
| Using owlready2 for production builds | Not designed for CI/CD pipelines | Use ROBOT for build workflows |
| Using rdflib for changes a ROBOT template or KGCL can express | Too low-level for ontology operations | Use ROBOT or oaklib; keep rdflib for what they cannot do |
| Skipping reasoner after changes | May introduce inconsistencies | Always run `robot reason` |
