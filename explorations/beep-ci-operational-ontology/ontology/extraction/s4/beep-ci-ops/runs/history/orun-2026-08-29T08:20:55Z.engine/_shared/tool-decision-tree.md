# Tool Decision Tree

When to use each ontology tool. Primary tools should be attempted first;
escalate to secondary tools only when the primary tool cannot handle the task.

## Decision Flowchart

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
├── Build complex Description Logic axioms?
│   │   (qualified cardinality, role chains, nested class expressions)
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
| Run CQ tests | `robot verify` | Checking SPARQL-based acceptance tests |
| Compare versions | `robot diff` | PR descriptions, changelogs |
| Convert formats | `robot convert` | Turtle ↔ OWL/XML ↔ JSON-LD |
| Extract module | `robot extract` | Importing subset of external ontology |
| Annotate | `robot annotate` | Adding version info, metadata |

#### Reasoner Selection

| Reasoner | Strengths | Trade-offs | Use When |
|----------|-----------|------------|----------|
| ELK | Very fast on EL ontologies | Incomplete for full OWL DL features | Large taxonomies, frequent CI checks |
| HermiT | Complete OWL DL reasoning | Slower on large/complex models | Pre-release validation, full DL constructs |
| Pellet/Openllet | Full DL + useful explanations | Slower/heavier runtime | Need explanation support or DL completeness checks |

Practical guidance:
- ELK is the workhorse for OBO ontologies — use it for daily development and CI.
- ELK handles OWL 2 EL only. It silently ignores axioms outside EL (qualified
  cardinality, universal restrictions, complements). This can cause missed
  inferences that are hard to debug.
- Escalate to HermiT or Pellet/Openllet for pre-release validation, when using
  full DL features, or when ELK results seem incomplete.
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

#### Known Limitations

oaklib is powerful but has rough edges that practitioners regularly encounter:

- **Adapter inconsistency**: Operations that work on one backend (SQLite,
  OLS, local OWL) may fail or return different results on another. Test
  commands against your specific adapter.
- **KGCL implementation is incomplete**: `obsolete` and `rename` work
  reliably, but complex operations like `create axiom` with full Manchester
  Syntax may fail. When KGCL fails, fall back to ROBOT or rdflib.
- **SQLite cache staleness**: The `sqlite:obo:` adapter caches downloaded
  ontologies. Clear `~/.data/oaklib/` to force refresh after upstream
  ontology releases.
- **Serialization instability**: Applying KGCL changes to local `.ttl` files
  can produce different prefix ordering or serialization format than the
  input. Run `robot convert --input file.ttl --output file.ttl` afterward
  to normalize serialization before committing.
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
create class EX:0001 'New Term'
obsolete EX:0042
rename EX:0001 from 'Old Name' to 'New Name'
move EX:0010 from EX:0001 to EX:0002
create synonym 'Alt Name' for EX:0001
create edge EX:0001 rdfs:subClassOf EX:0002
create definition 'A thing that...' for EX:0001
```

## Secondary Tools (escalation criteria)

### OWLAPY — When to escalate

Use when ROBOT templates cannot express the axiom AND you need the full OWL
API (e.g., computing entailments, DL learners). Requires a JVM.

- Qualified cardinality restrictions (`ObjectMinCardinality 2 hasWheel`)
- Role chains (`hasParent o hasParent SubPropertyOf hasGrandparent`)
- Nested class expressions (`A and (B or (C and hasP some D))`)
- Complex equivalent class definitions
- Property characteristics requiring OWL API (asymmetric, reflexive)
- Programmatic axiom generation from external data with complex logic

**Note**: Most OBO community practitioners use **rdflib** (triple-level
manipulation, no JVM) rather than OWLAPY for programmatic Python work.
Consider rdflib first unless you specifically need the OWL API abstraction.

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
| Hand-editing .ttl files | Bypasses validation, error-prone | Use ROBOT, oaklib, or Python tools |
| Using OWLAPY for simple SubClassOf | Over-engineering | Use ROBOT template or KGCL |
| Using owlready2 for production builds | Not designed for CI/CD pipelines | Use ROBOT for build workflows |
| Using rdflib to add classes | Too low-level for ontology operations | Use oaklib or ROBOT |
| Skipping reasoner after changes | May introduce inconsistencies | Always run `robot reason` |
