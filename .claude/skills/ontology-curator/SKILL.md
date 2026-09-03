---
name: ontology-curator
description: >
  Manages ontology maintenance, evolution, and versioning. Handles term
  deprecation, KGCL change management, diff generation, and release
  workflows. Use when maintaining, updating, versioning, or documenting
  an existing ontology.
---

# Ontology Curator

## Role Statement

You are responsible for the maintenance and evolution phase — managing
ongoing changes to existing ontologies. You handle deprecation (never
deletion), structural changes via KGCL, version management, diff
generation, and release pipelines. You ensure all changes are auditable,
reviewable, and validated before merging.

## When to Activate

- User mentions "deprecate", "version", "release", "maintain"
  (Note: "obsolete" is the KGCL command name, but the canonical term
  for the action is "deprecate" per CONVENTIONS.md)
- User wants to rename, reparent, or restructure existing terms
- User wants to generate changelogs or documentation
- Pipeline C

## Shared Reference Materials

Read these files from `_shared/` before beginning work:

- `_shared/methodology-backbone.md` — lifecycle context (Maintenance phase)
- `_shared/tool-decision-tree.md` — tool selection for changes
- `_shared/naming-conventions.md` — naming standards for renames
- `_shared/quality-checklist.md` — validation requirements after changes
- `_shared/namespaces.json` — canonical prefixes

## Core Workflow

### Step 1: Analyze Change Request

Classify the requested change:

| Change Type | KGCL Command | Severity |
|-------------|-------------|----------|
| Rename label | `rename` | PATCH |
| Add synonym | `create synonym` | PATCH |
| Fix definition | `change definition` | PATCH |
| Reparent class | `move` | MINOR |
| Add new class | `create class` + `create edge` | MINOR |
| Deprecate term | `obsolete` | MINOR (steward required) |
| Remove axiom | `delete edge` | MAJOR (review required) |
| Change semantics | Multiple commands | MAJOR (review required) |

> **Auditor/steward branch**: `Reparent class`, `Add new class`, and any
> `Change semantics` that is derived from typed source or alters a term's
> referent MUST route through `ontology-foundational-auditor` (denotation +
> category analysis) and be ratified by the named steward before the KGCL
> patch is applied — generic "user review" does not satisfy the named-human
> authority law for existential commitments. `Deprecate term` (and any
> replacement designation) likewise requires the NAMED steward's decision —
> retiring a public meaning is an existential commitment in reverse.

### Step 2: Generate KGCL Patch

Compose KGCL commands for the change:

```bash
# Deprecation (NEVER delete — always deprecate)
uv run runoak -i ontology.ttl apply "obsolete EX:0042"
uv run runoak -i ontology.ttl apply \
  "create synonym 'OBSOLETE old term name' for EX:0042"

# Add replacement pointer
uv run runoak -i ontology.ttl apply \
  "create edge EX:0042 obo:IAO_0100001 EX:0099"
```

Required deprecation metadata:
- `owl:deprecated true`
- `obo:IAO_0000231` (has obsolescence reason)
- `obo:IAO_0100001` (term replaced by)

### Step 3: Propose Patch for Review

Write the KGCL patch file and present to user BEFORE applying:

```kgcl
# changes.kgcl — Proposed changes for review
# Date: {date}
# Author: {agent}
# Reason: {description of why these changes are needed}

obsolete EX:0042
create synonym 'OBSOLETE Widget' for EX:0042
create edge EX:0042 obo:IAO_0100001 EX:0099

rename EX:0001 from 'Old Name' to 'New Name'
move EX:0010 from EX:0001 to EX:0002
```

### Step 4: Apply Approved Changes

```bash
# Apply batch changes
uv run runoak -i ontology.ttl apply --changes-input changes.kgcl

# Or apply individual changes
uv run runoak -i ontology.ttl apply "rename EX:0001 from 'Old' to 'New'"
```

### Step 5: Version Update

Update the ontology header:

```turtle
<http://example.org/onto> a owl:Ontology ;
    owl:versionIRI <http://example.org/onto/2024-06-01> ;
    owl:versionInfo "2024-06-01" ;
    owl:priorVersion <http://example.org/onto/2024-03-01> .
```

Versioning rules (choose one scheme per project):

**OBO date-based versioning** (preferred for OBO Foundry ontologies):
- Format: `YYYY-MM-DD` (e.g., `2024-06-01`)
- Stable PURL resolves to latest release
- Versioned IRI: `http://purl.obolibrary.org/obo/{name}/2024-06-01/{name}.owl`

**Semantic versioning** (for project-specific ontologies):
- **MAJOR**: Backward-incompatible changes (removing axioms, changing
  semantics of existing terms)
- **MINOR**: Backward-compatible additions (new classes/properties)
- **PATCH**: Backward-compatible fixes (label corrections, definition
  improvements, synonym additions)

### Step 5.5: FAIR Assessment

Assess release readiness against FAIR sub-principles and record outcomes in
the release notes.

| Principle | Ontology Action | Tool/Vocabulary |
|----------|------------------|-----------------|
| F1 | Assign stable globally unique ontology and term IRIs | IRI policy, `owl:versionIRI` |
| F2 | Ensure rich metadata on ontology header and key terms | `dcterms:*`, `skos:*` |
| F3 | Include metadata that references released artifact identifiers | `dcterms:identifier`, version IRI |
| F4 | Register/index ontology in searchable resources | OBO Foundry, BioPortal, OLS |
| A1 | Publish via open, standardized retrieval protocol | HTTPS, content negotiation |
| A1.1 | Keep protocol open and implementable | HTTP/HTTPS |
| A1.2 | Support auth where needed without breaking protocol | token-based repository APIs |
| A2 | Preserve metadata availability across versions | versioned metadata files |
| I1 | Use formal, shared KR language | RDF/OWL |
| I2 | Use FAIR vocabularies where possible | DCMI, SKOS, PROV-O, OBO/RO |
| I3 | Include qualified links to related resources | `dcterms:references`, mapping predicates |
| R1 | Provide rich provenance and context metadata | `prov:*`, `dcterms:*` |
| R1.1 | Publish explicit usage license | `dcterms:license` |
| R1.2 | Record provenance of terms and releases | `prov:wasDerivedFrom`, changelog |
| R1.3 | Follow community standards | OBO principles, SSSOM for mappings |

#### Release Publishing

- Publish dereferenceable ontology IRIs with content negotiation (Turtle,
  RDF/XML, JSON-LD as needed).
- Register releases in relevant repositories (for example OBO Foundry,
  BioPortal, OLS) when applicable.
- Publish diffs/changelog between releases, not just latest snapshot.

### Step 6: Generate Diff

```bash
robot diff --left previous.ttl --right ontology.ttl \
  --format markdown --output CHANGELOG.md
```

### Step 7: Validate

Hand off to `ontology-validator` for full validation, or run quick checks:

```bash
robot reason --reasoner ELK --input ontology.ttl
robot report --input ontology.ttl --fail-on ERROR
```

## Tool Commands

### KGCL operations via oaklib

```bash
# Rename
uv run runoak -i onto.ttl apply "rename EX:0001 from 'Old Name' to 'New Name'"

# Reparent
uv run runoak -i onto.ttl apply "move EX:0010 from EX:0001 to EX:0002"

# Add synonym
uv run runoak -i onto.ttl apply "create synonym 'Alternative Name' for EX:0001"

# Change definition
uv run runoak -i onto.ttl apply \
  "change definition of EX:0001 to 'Updated definition here'"

# Deprecate
uv run runoak -i onto.ttl apply "obsolete EX:0042"
```

### Release pipeline

```bash
# Full release pipeline
robot merge --input edit-ontology.ttl \
  --input imports/*.owl \
  --output merged.ttl && \
robot reason --reasoner ELK --input merged.ttl --output reasoned.ttl && \
robot report --input reasoned.ttl --fail-on ERROR && \
robot annotate --input reasoned.ttl \
  --annotation owl:versionInfo "$(date +%Y-%m-%d)" \
  --output release/ontology.ttl && \
robot convert --input release/ontology.ttl --output release/ontology.owl && \
robot convert --input release/ontology.ttl --output release/ontology.json \
  --format json-ld
```

### Import refresh

When upstream ontologies release new versions:

```bash
# Check for obsoleted terms and re-extract each import
for f in imports/*_terms.txt; do
  ontology=$(basename "$f" _terms.txt)

  # Check for stale terms
  while IFS= read -r iri; do
    uv run runoak -i "sqlite:obo:${ontology}" info "$iri" 2>/dev/null | \
      grep -q "OBSOLETE" && echo "STALE: $iri in $f"
  done < "$f"

  # Re-extract this import module
  robot extract --method MIREOT \
    --input-iri "http://purl.obolibrary.org/obo/${ontology}.owl" \
    --term-file "imports/${ontology}_terms.txt" \
    --output "imports/${ontology}_import.owl"
done
```

### Diff operations

```bash
# Markdown diff for PR descriptions
robot diff --left old.ttl --right new.ttl --format markdown

# Plain text diff
robot diff --left old.ttl --right new.ttl
```

## Outputs

This skill produces:

| Artifact | Location | Format | Description |
|----------|----------|--------|-------------|
| KGCL patch | `{name}-changes.kgcl` | KGCL | Human-reviewable change proposals |
| Updated ontology | `ontologies/{name}/{name}.ttl` | Turtle | Ontology with applied changes |
| Diff report | `CHANGELOG.md` | Markdown | Changes between versions |
| Release artifacts | `release/` | TTL, OWL, JSON-LD | Multi-format release files |
| FAIR assessment notes | `release/{name}-fair.md` | Markdown | FAIR principle checks per release |

## Handoff

**Receives from**: User (change requests, deprecation needs, release triggers)

**Passes to**: `ontology-validator` — modified `ontology.ttl`, KGCL change log

**Handoff checklist**:
- [ ] KGCL patch was reviewed and approved by user before applying
- [ ] Semantics-changing/new-class changes carry an auditor analysis + steward ratification record
- [ ] Deprecations include all required metadata (deprecated flag,
  obsolescence reason, replacement pointer)
- [ ] Version IRI and version info are updated
- [ ] Diff report is generated
- [ ] Changes are ready for validation

## Anti-Patterns to Avoid

- **Deleting terms**: NEVER delete an ontology term. Always deprecate with
  `owl:deprecated true` and provide a replacement pointer. (Safety Rule #4)
- **Silent changes**: ALWAYS propose KGCL patches for review before applying
  to shared ontologies. (Safety Rule #5)
- **Skipping version update**: Every change to a released ontology must
  increment the version.
- **Incomplete deprecation**: Deprecation requires three pieces: the
  deprecated flag, the obsolescence reason, and the replacement pointer.
  Missing any one leaves consumers without migration guidance.
- **Breaking changes without MAJOR version**: Removing axioms or changing
  term semantics requires a MAJOR version bump and explicit communication.
- **Skipping read-before-modify**: Always read the existing ontology file
  before making changes. (Safety Rule #9)
- **No backup before bulk**: Create a checkpoint before batch KGCL
  application. (Safety Rule #10)

## Error Handling

| Error | Likely Cause | Recovery |
|-------|-------------|----------|
| KGCL apply fails | Term not found | Verify term exists with `runoak info EX:XXXX` |
| oaklib cannot parse ontology | Malformed Turtle | Run `robot validate` to find syntax errors |
| Reasoner fails after changes | Change introduced inconsistency | Review KGCL patch; revert problematic change |
| No replacement term for deprecation | Gap in the ontology | Route the replacement candidate through `ontology-foundational-auditor` (denotation + ratification), have the architect encode the RATIFIED term, then deprecate |
