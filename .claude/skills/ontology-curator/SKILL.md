---
name: ontology-curator
description: >
  Manages ontology maintenance, evolution, and versioning. Handles
  deprecation of ontology terms, KGCL change management, ontology diff
  generation, and ontology release workflows. Use when maintaining,
  updating, versioning, or documenting an existing OWL/RDF ontology.
---

# Ontology Curator

## Role Statement

You are responsible for the maintenance and evolution phase — managing
ongoing changes to existing ontologies. You handle deprecation (never
deletion), structural changes via KGCL, version management, diff
generation, and release pipelines. You ensure all changes are auditable,
reviewable, and validated before merging.

## When to Activate

- User wants to deprecate, version, release, or maintain an ontology or
  its terms (KGCL names the deprecation command `obsolete`; this skill
  calls the action "deprecate")
- User wants to rename, reparent, or restructure existing terms
- User wants to generate ontology changelogs or documentation
- Pipeline C

## Shared Reference Materials

Read these files from `../_shared/` (relative to this skill's directory) before beginning work:

- `../_shared/methodology-backbone.md` — lifecycle context (Maintenance phase)
- `../_shared/tool-decision-tree.md` — tool selection for changes
- `../_shared/naming-conventions.md` — naming standards for renames
- `../_shared/quality-checklist.md` — validation requirements after changes
- `../_shared/namespaces.json` — canonical prefixes

## Core Workflow

### Step 1: Analyze Change Request

Classify the requested change:

| Change Type | KGCL Command | Severity |
|-------------|-------------|----------|
| Rename label | `rename` | PATCH |
| Add synonym | `create synonym` | PATCH |
| Fix definition | `change definition` (term has one) / `add definition` (term has none) | PATCH |
| Reparent class | `delete edge` + `create edge` | MINOR |
| Add new class | `create node` + `create edge` | MINOR |
| Deprecate term | `obsolete` / `obsolete ... with replacement` | MINOR (steward required) |
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

Write the change as a KGCL file. Nothing is applied in this step.

```kgcl
# changes.kgcl — Proposed changes for review
# Date: {date}
# Author: {agent}
# Reason: {description of why these changes are needed}

obsolete EX:0042 with replacement EX:0099
obsolete EX:0043

rename EX:0001 from 'Old Name' to 'New Name'
delete edge EX:0010 rdfs:subClassOf EX:0001
create edge EX:0010 rdfs:subClassOf EX:0002
create node EX:0100 'new term'
create edge EX:0100 rdfs:subClassOf EX:0002
add definition 'A thing that ...' to EX:0100
```

Check that every line parses. `--dry-run` parses and prints the changes;
it writes nothing and does not prove the change applies:

```bash
uvx --from oaklib runoak -i simpleobo:ontology.obo apply --dry-run \
  --changes-input changes.kgcl
```

KGCL statements that look right but are not KGCL or do nothing (checked
with oaklib 0.7.5):

- `create class X 'label'` and `create definition ... for X` do not parse.
  Use `create node X 'label'` and `add definition '...' to X`.
- `move X rdfs:subClassOf A from A to B` parses but fails to render in
  `--dry-run` and is a silent no-op on `simpleobo:`. Reparent with
  `delete edge` + `create edge`.
- `change definition` on a term with no definition is a silent no-op; use
  `add definition`.
- `create edge X obo:IAO_0100001 Y` makes a logical edge, not the
  term-replaced-by annotation. Use `obsolete X with replacement Y`.
- KGCL has no statement for mappings; mapping rows are SSSOM edits
  (`ontology-mapper`).

Deprecation metadata:
- `owl:deprecated true` (set by `obsolete`)
- `obo:IAO_0000231` (has obsolescence reason) — no KGCL statement sets it;
  add it in the edit file as part of the same reviewed change
- `obo:IAO_0100001` (term replaced by) when there is one successor (set by
  `obsolete ... with replacement`); with several candidates or none, use
  `oboInOwl:consider` or a note, and do not invent a successor
- The label is prefixed `obsolete ` (done by `obsolete`)
- The term is removed from logical axioms: subClassOf, equivalence, and
  any use as a domain, range or filler. `obsolete` on `simpleobo:` drops
  the term's own `is_a` lines and rewires every child `is_a` and every
  `relationship` that pointed at the term to the term's parent (not to the
  replacement), tagging each with `{description="Rewired from link to ..."}`.
  These rewires are not in the KGCL text, so list each one in the Step 3
  proposal for the reviewer to approve or reject. Where the right target is
  the replacement, or a person must choose, put the change in the patch
  before the `obsolete` line (`delete edge EX:0060 rdfs:subClassOf EX:0042`,
  `create edge EX:0060 rdfs:subClassOf EX:0099`; `part_of` for a
  relationship); then nothing is left for `obsolete` to rewire. Check the
  diff for any other use

### Step 3: Propose Patch for Review

Present `changes.kgcl` to the user BEFORE applying, with the effect it
will have. Show the effect by applying it to a scratch copy (never the
curated file) and diffing the triples. List every line the diff changes
that the KGCL text does not say, such as each `Rewired from link to ...`
line from an `obsolete`, as its own change to approve or reject:

```bash
# OBO-format edit file
uvx --from oaklib runoak -i simpleobo:ontology.obo apply \
  --changes-input changes.kgcl -o scratch/ontology.proposed.obo
diff -u ontology.obo scratch/ontology.proposed.obo

# Turtle edit file: do not apply the KGCL (see the adapter caveat below).
# Write the change with a ROBOT template or rdflib to
# scratch/ontology.proposed.ttl, then diff the triples:
uv run --with rdflib python -c '
import sys
from rdflib import Graph
from rdflib.compare import to_isomorphic, graph_diff
old, new = (to_isomorphic(Graph().parse(p)) for p in sys.argv[1:3])
_, removed, added = graph_diff(old, new)
for s, p, o in sorted(removed): print("-", s.n3(), p.n3(), o.n3())
for s, p, o in sorted(added): print("+", s.n3(), p.n3(), o.n3())
' ontology.ttl scratch/ontology.proposed.ttl
```

**Adapter caveat.** `runoak apply` is reliable on an OBO-format file
through `simpleobo:`. On a Turtle or RDF/XML file it goes through the
rdflib adapter, which in oaklib 0.7.5 knows only a built-in list of
prefixes (`obo`, `ex`, `BFO`, `IAO`, `GO`, ...; any other prefix fails with
`KeyError`), fails on `create node` and `add definition`, makes `rename` a
no-op, drops every language tag, and `obsolete` went wrong in a different way
in each test, once relabelling every class in the file as obsolete
(`../_shared/tool-decision-tree.md`, Known Limitations).
So do not apply KGCL to a Turtle edit file. Keep `changes.kgcl` as the
reviewed record, make the change with a ROBOT template or rdflib writing
a new file (as `ontology-architect` Steps 3 and 5 do), and show the triple
diff above. Never edit the Turtle file by hand.

### Step 4: Apply Approved Changes

Only after the user (and the named steward, where Step 1 requires one)
approves the patch shown in Step 3. Start from a clean git tree
(`git status` shows nothing to commit) so `git restore` undoes the change.

```bash
# Apply to a new file, never over the input
uvx --from oaklib runoak -i simpleobo:ontology.obo apply \
  --changes-input changes.kgcl -o ontology.new.obo

# Read the diff; it must match the approved proposal
diff -u ontology.obo ontology.new.obo

# Then replace the curated file
mv ontology.new.obo ontology.obo
```

For a Turtle edit file, write the approved change with the same ROBOT
template or rdflib script to a new file, and read the triple diff from
Step 3 before replacing.

A single change works the same way:
`uvx --from oaklib runoak -i simpleobo:ontology.obo apply "rename EX:0001 from 'Old' to 'New'" -o ontology.new.obo`.
Without `-o` (or `--overwrite`, or the global `--autosave`) runoak saves
nothing. Do not use `--overwrite`; it writes over the input. Do not pass
`--contributor` with a patch that has `delete edge`, `create edge` or
`obsolete` (`obsolete` deletes edges internally): in 0.7.5 each fails with
`AttributeError: ... has no attribute 'about_node'`. Record attribution in
the `changes.kgcl` header instead. On `simpleobo:`, `create edge` writes an
empty `{description="None"}` qualifier after the `is_a`; remove it before
replacing the file. Keep or remove a `Rewired from link to ...` qualifier
as the reviewer decided in Step 3.

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

### Step 5.5: Release Metadata Check

Before release, check the header and record the outcome in the release
notes:

- [ ] `dcterms:license` names the license
- [ ] `owl:versionIRI` and `owl:versionInfo` name this release
- [ ] The diff from the previous release is published (Step 6)

### Step 6: Generate Diff

Write each release's diff to its own file and link it from
`CHANGELOG.md`; `--output` replaces the file it names, so never point it
at `CHANGELOG.md`.

```bash
robot diff --left previous.ttl --right ontology.ttl \
  --format markdown --output release/diff-{version}.md
```

### Step 7: Validate

Hand off to `ontology-validator` for full validation, or run quick checks.
ELK (ROBOT's default) reasons over OWL 2 EL only and ignores other axioms
(`../_shared/tool-decision-tree.md`, Reasoner Selection). Use it only when the
ontology is within EL; otherwise use HermiT:

```bash
robot validate-profile --profile EL --input ontology.ttl \
  --output scratch/profile.txt
robot reason --reasoner hermit --input ontology.ttl   # or ELK if EL holds
robot report --input ontology.ttl --fail-on ERROR
```

If a reasoner times out, say what was left unchecked; do not fall back to
ELK on a non-EL ontology and call it consistent.

## Tool Commands

### KGCL operations via oaklib

Each writes a new file; read the diff before replacing the original
(Step 4).

```bash
# Rename
uvx --from oaklib runoak -i simpleobo:onto.obo apply \
  "rename EX:0001 from 'Old Name' to 'New Name'" -o onto.new.obo

# Reparent
uvx --from oaklib runoak -i simpleobo:onto.obo apply \
  --changes-input reparent.kgcl -o onto.new.obo
# reparent.kgcl:
#   delete edge EX:0010 rdfs:subClassOf EX:0001
#   create edge EX:0010 rdfs:subClassOf EX:0002

# Add synonym
uvx --from oaklib runoak -i simpleobo:onto.obo apply \
  "create synonym 'Alternative Name' for EX:0001" -o onto.new.obo

# Change an existing definition
uvx --from oaklib runoak -i simpleobo:onto.obo apply \
  "change definition of EX:0001 to 'Updated definition here'" -o onto.new.obo

# Deprecate, with and without a single successor
uvx --from oaklib runoak -i simpleobo:onto.obo apply \
  "obsolete EX:0042 with replacement EX:0099" -o onto.new.obo
uvx --from oaklib runoak -i simpleobo:onto.obo apply \
  "obsolete EX:0043" -o onto.new.obo
```

### Release pipeline

The reasoner follows Step 7: `ELK` only for an EL ontology, else `hermit`.

```bash
# Full release pipeline
robot merge --input edit-ontology.ttl \
  --inputs "imports/*.owl" \
  --output merged.ttl && \
robot reason --reasoner hermit --input merged.ttl --output reasoned.ttl && \
robot report --input reasoned.ttl --fail-on ERROR && \
robot annotate --input reasoned.ttl \
  --version-iri "http://example.org/onto/$(date +%Y-%m-%d)" \
  --annotation owl:versionInfo "$(date +%Y-%m-%d)" \
  --output release/ontology.ttl && \
robot convert --input release/ontology.ttl --output release/ontology.owl && \
robot convert --input release/ontology.ttl --output release/ontology.json \
  --format json   # OBO Graphs JSON; ROBOT does not write JSON-LD
```

For JSON-LD, convert the Turtle release with rdflib:
`uv run --with rdflib python -c 'from rdflib import Graph; Graph().parse("release/ontology.ttl").serialize("release/ontology.jsonld", format="json-ld")'`.

### Import refresh

When upstream ontologies release new versions. Each terms file holds one
full IRI per line, as `ontology-scout` writes it and ROBOT reads it;
`runoak obsoletes` prints CURIEs, so turn each into its OBO PURL IRI
before comparing.

```bash
# Check for obsoleted terms and re-extract each import
for f in imports/*_terms.txt; do
  ontology=$(basename "$f" _terms.txt)

  # Stale terms: the upstream's obsolete terms that the import uses
  uvx --from oaklib runoak -i "sqlite:obo:${ontology}" obsoletes | \
    cut -f1 | sed -E 's|^([A-Za-z][A-Za-z0-9_]*):|http://purl.obolibrary.org/obo/\1_|' | \
    grep -Fxf "$f" | sed "s|^|STALE in $f: |"

  # Re-extract this import module to a new file
  robot extract --method MIREOT \
    --input-iri "http://purl.obolibrary.org/obo/${ontology}.owl" \
    --lower-terms "$f" \
    --output "imports/${ontology}_import.new.owl"

  # Review before replacing
  robot diff --left "imports/${ontology}_import.owl" \
    --right "imports/${ontology}_import.new.owl"
done
```

Replace each `_import.owl` with its `.new.owl` only after reading its diff.
`sqlite:obo:` downloads the upstream's database on first use.

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
| Diff report | `release/diff-{version}.md`, linked from `CHANGELOG.md` | Markdown | Changes between versions |
| Release artifacts | `release/` | TTL, OWL, OBO Graphs JSON (JSON-LD via rdflib) | Multi-format release files |
| Release metadata check | release notes | Markdown | Step 5.5 checklist per release |

## Handoff

**Receives from**: User (change requests, deprecation needs, release triggers)

**Passes to**: `ontology-validator` — modified `ontology.ttl`, KGCL change log

**Handoff checklist**:
- [ ] KGCL patch was reviewed and approved by user before applying
- [ ] Semantics-changing/new-class changes carry an auditor analysis + steward ratification record
- [ ] Deprecations include the required metadata (deprecated flag,
  obsolescence reason, replacement pointer or `consider` where one
  applies) and the term is out of logical axioms
- [ ] Version IRI and version info are updated
- [ ] Diff report is generated
- [ ] Changes are ready for validation

## Anti-Patterns to Avoid

- **Deleting terms**: NEVER delete an ontology term. Always deprecate with
  `owl:deprecated true`, and give a replacement pointer when there is one.
- **Silent changes**: ALWAYS propose KGCL patches for review before applying
  to shared ontologies.
- **Skipping version update**: Every change to a released ontology must
  increment the version.
- **Incomplete deprecation**: A deprecation needs the deprecated flag and
  the obsolescence reason, plus a replacement pointer or `consider` when a
  successor exists, and the term removed from logical axioms. Missing any
  one leaves consumers without migration guidance.
- **Breaking changes without MAJOR version**: Removing axioms or changing
  term semantics requires a MAJOR version bump and explicit communication.
- **Skipping read-before-modify**: Always read the existing ontology file
  before making changes.
- **No checkpoint before bulk**: Apply a batch KGCL patch only from a clean
  git tree, so `git restore` undoes it.

## Error Handling

| Error | Likely Cause | Recovery |
|-------|-------------|----------|
| KGCL apply fails | Term not found, or prefix unknown to the adapter | Check with `uvx --from oaklib runoak -i simpleobo:onto.obo info EX:XXXX`; a label of `None` means the term or its prefix was not found |
| oaklib cannot parse ontology | Malformed Turtle | Load it with ROBOT to a scratch output (`robot convert --input onto.ttl --output scratch/onto.ofn`); the parse error names the line |
| Reasoner fails after changes | Change introduced inconsistency | Review KGCL patch; revert problematic change |
| No replacement term for deprecation | No single successor | Deprecate with a reason and `oboInOwl:consider` or a note. Only if the steward decides a successor is needed, route it through `ontology-foundational-auditor` (denotation + ratification), have the architect encode the RATIFIED term, then deprecate with replacement |
