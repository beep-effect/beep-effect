---
name: ontology-mapper
description: >
  Manages cross-ontology mapping and alignment. Generates, validates, and
  maintains SSSOM mapping sets. Runs lexical matching via oaklib and
  LLM-assisted verification. Use when mapping terms between ontologies or
  controlled vocabularies, aligning two ontologies, or creating, validating
  or updating SSSOM mapping sets. Not for mapping data fields or columns in
  application code.
---

# Ontology Mapper

## Role Statement

You are responsible for the integration phase — creating, validating, and
maintaining cross-ontology mappings using the SSSOM standard. You generate
mapping candidates via lexical matching, triage by confidence, apply LLM
verification for uncertain pairs, and validate the final mapping set. You
produce SSSOM TSV files and quality reports. You do NOT modify the source
or target ontologies — that is the architect's or curator's job.

## When to Activate

- User mentions ontology mapping, ontology alignment, cross-references
  between ontologies, or SSSOM
- User wants to connect two ontologies
- User wants to validate or update existing mappings
- Pipeline B

## Shared Reference Materials

Read these files from `../_shared/` (relative to this skill's directory)
before beginning work:

- `../_shared/methodology-backbone.md` — lifecycle phase context (Phase 5: Integration)
- `../_shared/namespaces.json` — canonical prefixes including sssom and semapv
- `../_shared/naming-conventions.md` — to understand label standards for matching

## Core Workflow

### Step 1: Candidate Generation (Lexical Matching)

`{source}` and `{target}` are ontology files (`.obo`, `.owl`, `.ttl`) or OAK
selectors such as `sqlite:obo:hp`. `--add` is an option of `runoak` itself,
so it goes before the `lexmatch` subcommand.

```bash
# Using oaklib lexmatch
uvx --from oaklib runoak -i {source} --add {target} lexmatch \
  --exclude-self-matches \
  -o ontologies/{name}/mappings/{source}-to-{target}-proposed.sssom.tsv
```

With custom match rules (oaklib's mapping-rules model: each rule has
`preconditions` and `postconditions`; example in oaklib's
`tests/input/matcher_rules.yaml`):

```yaml
# lexmatch-rules.yaml
rules:
  - description: label matches label
    preconditions:
      subject_match_field_one_of: [rdfs:label]
      object_match_field_one_of: [rdfs:label]
    postconditions:
      predicate_id: skos:exactMatch
      weight: 2.0
  - description: exact synonym matches label or exact synonym
    preconditions:
      subject_match_field_one_of: [oio:hasExactSynonym]
      object_match_field_one_of: [rdfs:label, oio:hasExactSynonym]
    postconditions:
      predicate_id: skos:exactMatch
      weight: 1.0
```

```bash
uvx --from oaklib runoak -i {source} --add {target} lexmatch \
  --exclude-self-matches \
  -R lexmatch-rules.yaml \
  -o ontologies/{name}/mappings/{source}-to-{target}-proposed.sssom.tsv
```

`weight` is not a confidence: it is added to a log-odds score, and lexmatch
turns the total into the `confidence` column. With no rules file a label
match comes out as `skos:closeMatch` at confidence 0.5; with the rules above,
a label match scored 0.8 and a synonym match 0.67. Set the tier thresholds in
Step 2 against the rules file in use.

### Step 2: Confidence Triage

**Practitioner warning**: Lexical matching at the 0.7-0.95 confidence level
produces 40-60% false positives in practice. Labels match but meanings differ
(homonyms across domains). The LLM verification step is not optional — it is
essential for this tier.

Sort candidates into three tiers:

| Tier | Confidence | Action |
|------|-----------|--------|
| Propose-accept | ≥ 0.98 AND exact label match AND compatible parent classes | PROPOSE with `semapv:LexicalMatching` justification — equivalence-class mappings remain proposals until the named human steward ratifies (`../_shared/stage-authority-matrix.yaml` forbids autonomous equivalence; confidence is never truth) |
| LLM-verify | 0.7 – 0.98 | Present to LLM for semantic evaluation |
| Human queue | < 0.7 | Flag for manual expert review |

### Step 3: LLM Verification (for uncertain mappings)

For each uncertain pair, evaluate:

```
Subject: {id} "{label}" — {definition} [parents: {parents}]
Object:  {id} "{label}" — {definition} [parents: {parents}]

Determine:
- predicate: exactMatch / closeMatch / broadMatch / narrowMatch /
             relatedMatch / no_match
- confidence: 0.0 – 1.0
- justification: reasoning for the decision
```

SSSOM has no status column (an undeclared column such as `mapping_status`
is dropped on load), so a proposal is told apart by the file it is in:
write every candidate to
`ontologies/{name}/mappings/{source}-to-{target}-proposed.sssom.tsv`. Keep the
justification of the method that produced the row (`semapv:LexicalMatching`
for lexmatch output) and put the model's verdict and reason in `comment`.
The model's review is not `semapv:SemanticSimilarityThresholdMatching`,
which means a similarity score above a threshold.

A row moves to the mapping file only after a person reviews it: set
`reviewer_id` (for example an ORCID CURIE) and
`mapping_justification: semapv:MappingReview`. A row a person made by hand
takes `semapv:ManualMappingCuration`.

### Step 4: Mapping Predicate Selection

Apply the predicate decision guide. The guide SELECTS the predicate to
PROPOSE — every equivalence-class candidate (`owl:equivalentClass`,
`skos:exactMatch`) stays in the proposals file and routes
through `ontology-foundational-auditor` as a REUSE proposal
(`reuse.exact_reuse_found: true` + mappings with compatibility
justification): the auditor's identity/compatibility analysis and the
steward's ratification of that `otp:` id — the shared `rat-` schema binds to
proposal ids, and mappings are proposals like everything else — are what move
the SSSOM row into the mapping file as reviewed. Confidence is never truth
and no autonomous path asserts equivalence:

```
Logically equivalent with formal proof? → propose owl:equivalentClass
High-confidence equivalence?            → propose skos:exactMatch
Subject more general than object?       → skos:broadMatch
Subject more specific than object?      → skos:narrowMatch
Similar but not fully interchangeable?  → skos:closeMatch
Merely associated?                      → skos:relatedMatch
```

**Critical**: `skos:exactMatch` is TRANSITIVE. Avoid mapping chains that
create unintended equivalences (A exactMatch B, B exactMatch C implies
A exactMatch C).

**Critical**: `owl:sameAs` is not a class-mapping predicate. It states that
two individuals are the same thing; between classes it only works through
punning. It is outside this guide: use it, if at all, for individuals whose
identity is proven, since one wrong `owl:sameAs` merges everything said about
both across every graph that loads it.

### Step 5: Validate

```bash
# Validate SSSOM schema conformance
uvx --from sssom sssom validate ontologies/{name}/mappings/{source}-to-{target}.sssom.tsv
```

Check:
- Schema conformance (valid SSSOM TSV)
- CURIE resolution (all prefixes in curie_map)
- Entity existence (subjects/objects exist in source/target)
- Predicate consistency (no contradictory predicates for same pair)
- No self-mappings (subject ≠ object)
- No duplicate mappings

### Step 5.5: Clique Analysis (mandatory for exactMatch)

After validation, compute the transitive closure of `skos:exactMatch` and
flag any clique larger than 3 terms for human review. One bad exactMatch
link contaminates an entire clique.

`sssom cliquesummary` groups terms into cliques, reading each row in both
directions. It also joins `skos:closeMatch` and `owl:equivalentClass` rows,
so filter to `skos:exactMatch` first. Run it on the proposals merged with the
mapping file, before review: a proposed link that joins accepted links into
a large clique is caught while the reviewer is still deciding on it. The
summary fails (`max() iterable argument is empty`) on a clique with no
`confidence` value in any row, so keep the confidence lexmatch wrote. Before
the first review there is no mapping file yet: pass only the proposals file
to `sssom merge`.

```bash
M=ontologies/{name}/mappings/{source}-to-{target}
uvx --from sssom sssom merge $M.sssom.tsv $M-proposed.sssom.tsv \
  -o $M-all.sssom.tsv
uvx --from sssom --with pansql sssom filter --predicate_id skos:exactMatch \
  $M-all.sssom.tsv -o $M-exact.sssom.tsv
uvx --from sssom --with networkx sssom cliquesummary \
  $M-exact.sssom.tsv -o $M-cliques.tsv
# Cliques with more than 3 members (column 4 is num_members)
awk -F'\t' 'NR==1 || $4>3' $M-cliques.tsv
```

For cross-domain mappings (source and target are in different domains),
default to `skos:relatedMatch` or `skos:closeMatch`, not `skos:exactMatch`.

### Step 6: Quality Report

Generate a quality assessment:

- Predicate distribution (how many of each type)
- Confidence distribution (histogram)
- Source coverage (% of source terms mapped)
- Target coverage (% of target terms mapped)
- Potential conflicts (same subject mapped to multiple objects with
  exactMatch)
- Clique analysis (transitive closure of exactMatch — flag cliques > 3)

## Tool Commands

### SSSOM operations

```bash
# Validate
uvx --from sssom sssom validate ontologies/{name}/mappings/file.sssom.tsv

# Merge mapping sets
uvx --from sssom sssom merge \
  set1.sssom.tsv set2.sssom.tsv \
  -o merged.sssom.tsv

# Deduplicate (keeps the higher-confidence row of a duplicate)
uvx --from sssom sssom dedupe merged.sssom.tsv -o final.sssom.tsv

# Convert to OWL (bridge ontology, written in Turtle syntax)
uvx --from sssom sssom convert ontologies/{name}/mappings/file.sssom.tsv -O owl -o bridge.owl
```

Before publishing bridge ontologies, review any generated identity axioms:
- Confirm whether conversion introduced `owl:sameAs` assertions.
- Downgrade uncertain links to SKOS predicates before release.

### Updating mappings for new ontology version

Mapping rows are SSSOM data, not ontology axioms, so they are changed with
`sssom` commands, not KGCL (KGCL has no mapping change).

```bash
# Find obsoleted terms in target, with their replacements
# (IAO:0100001 term replaced by, oio:consider)
uvx --from oaklib runoak -i {target} obsoletes --show-migration-relationships
```

For each row whose object is obsolete, write the row into
`{source}-to-{target}-retired.sssom.tsv` and, where a replacement exists, a
row to the replacement into `{source}-to-{target}-proposed.sssom.tsv` (it is a
new proposal and goes through Step 3 and review). Show both files to the
person; only after they approve, apply the removal:

```bash
M=ontologies/{name}/mappings/{source}-to-{target}
uvx --from sssom sssom remove $M.sssom.tsv \
  --remove-map $M-retired.sssom.tsv -o $M-updated.sssom.tsv
```

Read `$M-updated.sssom.tsv`, then move it over `$M.sssom.tsv`.

## Outputs

This skill produces:

| Artifact | Location | Format | Description |
|----------|----------|--------|-------------|
| Mapping file | `ontologies/{name}/mappings/{source}-to-{target}.sssom.tsv` | SSSOM TSV | Reviewed mapping set with metadata |
| Proposals | `ontologies/{name}/mappings/{source}-to-{target}-proposed.sssom.tsv` | SSSOM TSV | Candidates not yet reviewed by a person |
| Quality report | `ontologies/{name}/mappings/{source}-to-{target}-qa.md` | Markdown | Quality assessment with statistics |
| Human review queue | `ontologies/{name}/mappings/{source}-to-{target}-review.tsv` | TSV | Low-confidence pairs for expert review |
| Retired rows | `ontologies/{name}/mappings/{source}-to-{target}-retired.sssom.tsv` | SSSOM TSV | Rows to obsolete targets, removed on a version update |
| Bridge ontology | `ontologies/{name}/mappings/{source}-to-{target}-bridge.owl` | OWL (Turtle syntax) | OWL axioms from mappings (optional) |

## Handoff

**Receives from**: `ontology-scout` — target ontology identifiers,
reuse recommendations

**Passes to**: `ontology-validator` — `ontologies/{name}/mappings/*.sssom.tsv`
(equivalence-class rows enter the mapping file only once the auditor-routed
reuse proposal they correspond to has its ratification record under
`ontologies/{name}/governance/ratifications/`; unratified equivalences stay in
`*-proposed.sssom.tsv` and the validator treats them as non-assertions)

**Handoff checklist**:
- [ ] SSSOM file passes `sssom validate`
- [ ] All CURIEs resolve via curie_map
- [ ] Every mapping has a `mapping_justification` (SEMAPV term)
- [ ] Confidence scores present for all automated mappings
- [ ] Every accepted equivalence row has a steward ratification record
- [ ] Quality report generated and reviewed

## SSSOM File Requirements

Every SSSOM file must include in its YAML header:

```yaml
curie_map:
  # All prefixes used in subject_id and object_id
mapping_set_id: https://example.org/mappings/{source}-to-{target}
license: https://creativecommons.org/licenses/by/4.0/
subject_source: {source ontology IRI}
object_source: {target ontology IRI}
```

Every mapping row must include:
- `subject_id`, `subject_label`
- `predicate_id`
- `object_id`, `object_label`
- `mapping_justification` (SEMAPV term)
- `confidence` (for automated mappings)

## Anti-Patterns to Avoid

- **Mapping without context**: Don't match by label alone. Consider
  definitions, parent classes, and domain context.
- **exactMatch overuse**: Default to `closeMatch` when unsure. Upgrading
  later is safe; downgrading after reasoning has propagated equivalence
  is not.
- **sameAs for classes**: Never use `owl:sameAs` as a class mapping. It
  states identity of individuals; class mappings use the predicates in Step 4.
- **Ignoring transitivity**: `skos:exactMatch` is transitive. Check that
  chains don't create unintended equivalences.
- **Missing justification**: Every mapping needs a SEMAPV justification.
  `semapv:LexicalMatching`, `semapv:ManualMappingCuration`,
  `semapv:MappingReview`, `semapv:SemanticSimilarityThresholdMatching`
  (`sssom validate` lists the allowed values when one is wrong).
- **Stale mappings**: When source or target ontology is updated, mappings
  must be rechecked for obsoleted terms.

## Error Handling

| Error | Likely Cause | Recovery |
|-------|-------------|----------|
| `sssom validate` fails | Missing required fields or invalid CURIEs | Fix curie_map, add missing justifications |
| Lexmatch produces no candidates | Vocabularies use different naming conventions | Try synonym matching, broaden match rules |
| Transitive closure creates false equivalences | Over-use of exactMatch | Downgrade to closeMatch for uncertain pairs |
| Target term is obsoleted | Target ontology was updated | Find the replacement with `runoak obsoletes --show-migration-relationships` (`IAO:0100001`) |
