---
name: ontology-mapper
description: >
  Manages cross-ontology mapping and alignment. Generates, validates, and
  maintains SSSOM mapping sets. Runs lexical matching via oaklib and
  LLM-assisted verification. Use when working with ontology mappings,
  alignment, or cross-references.
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

- User mentions "mapping", "alignment", "cross-reference", or "SSSOM"
- User wants to connect two ontologies
- User wants to validate or update existing mappings
- Pipeline B

## Shared Reference Materials

Read these files from `_shared/` before beginning work:

- `_shared/methodology-backbone.md` — lifecycle phase context (Phase 5: Integration)
- `_shared/namespaces.json` — canonical prefixes including sssom and semapv
- `_shared/naming-conventions.md` — to understand label standards for matching

## Core Workflow

### Step 1: Candidate Generation (Lexical Matching)

```bash
# Using oaklib lexmatch
uv run runoak -i sqlite:obo:{source} lexmatch \
  --add sqlite:obo:{target} \
  -o ontologies/{name}/mappings/{source}-to-{target}.sssom.tsv
```

With custom match rules:

```yaml
# lexmatch-rules.yaml
rules:
  - match_fields: [rdfs:label, oio:hasExactSynonym]
    predicate: skos:exactMatch
    weight: 0.9
  - match_fields: [rdfs:label, oio:hasRelatedSynonym]
    predicate: skos:closeMatch
    weight: 0.7
```

```bash
uv run runoak -i sqlite:obo:{source} lexmatch \
  --add sqlite:obo:{target} \
  --rules-file lexmatch-rules.yaml \
  -o ontologies/{name}/mappings/{source}-to-{target}.sssom.tsv
```

### Step 2: Confidence Triage

**Practitioner warning**: Lexical matching at the 0.7-0.95 confidence level
produces 40-60% false positives in practice. Labels match but meanings differ
(homonyms across domains). The LLM verification step is not optional — it is
essential for this tier.

Sort candidates into three tiers:

| Tier | Confidence | Action |
|------|-----------|--------|
| Propose-accept | ≥ 0.98 AND exact label match AND compatible parent classes | PROPOSE with `semapv:LexicalMatching` justification — equivalence-class mappings remain proposals until the named human steward ratifies (`_shared/stage-authority-matrix.yaml` forbids autonomous equivalence; confidence is never truth) |
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

Update the SSSOM file with LLM-verified results marked as PROPOSED (steward ratification flips them to accepted), using
`semapv:SemanticSimilarityThresholdMatching` as the mapping justification.

### Step 4: Mapping Predicate Selection

Apply the predicate decision guide. The guide SELECTS the predicate to
PROPOSE — every equivalence-class candidate (`owl:equivalentClass`,
`skos:exactMatch`, `owl:sameAs`) stays `mapping_status: PROPOSED` and routes
through `ontology-foundational-auditor` as a REUSE proposal
(`reuse.exact_reuse_found: true` + mappings with compatibility
justification): the auditor's identity/compatibility analysis and the
steward's ratification of that `otp:` id — the shared `rat-` schema binds to
proposal ids, and mappings are proposals like everything else — are what flip
the SSSOM row to accepted. Confidence is never truth and no autonomous path
asserts equivalence:

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

**Critical**: Treat `owl:sameAs` as a last-resort identity assertion only when
true identity is proven. One incorrect `owl:sameAs` can trigger transitive
merges across multiple graphs and collapse distinct entities.

### Step 5: Validate

```bash
# Validate SSSOM schema conformance
uv run sssom validate ontologies/{name}/mappings/{source}-to-{target}.sssom.tsv
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

```sparql
# Inline clique detection: find terms reachable via exactMatch chains > 3
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT ?start ?mid ?end WHERE {
  ?start skos:exactMatch+ ?mid .
  ?mid skos:exactMatch+ ?end .
  FILTER(?start != ?end)
}
```

```bash
# Run against the mapping file (convert SSSOM to RDF first if needed)
robot query --input ontologies/{name}/mappings/{source}-to-{target}.sssom.ttl \
  --query sparql/clique-check.sparql --output clique-report.csv
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
uv run sssom validate ontologies/{name}/mappings/file.sssom.tsv

# Merge mapping sets
uv run sssom merge \
  set1.sssom.tsv set2.sssom.tsv \
  -o merged.sssom.tsv

# Deduplicate
uv run sssom dedupe merged.sssom.tsv -o final.sssom.tsv

# Convert to OWL (bridge ontology)
uv run sssom convert ontologies/{name}/mappings/file.sssom.tsv -o bridge.owl -O owl
```

Before publishing bridge ontologies, review any generated identity axioms:
- Confirm whether conversion introduced `owl:sameAs` assertions.
- Downgrade uncertain links to SKOS predicates before release.

### Updating mappings for new ontology version

```bash
# Find obsoleted terms in target
uv run runoak -i sqlite:obo:{target} query \
  "PREFIX owl: <http://www.w3.org/2002/07/owl#> SELECT ?term WHERE { ?term owl:deprecated true }"

# Generate replacement KGCL
# For each obsoleted target with a replacement:
# delete mapping {subject} {predicate} {obsolete_target}
# create mapping {subject} {predicate} {replacement_target}
```

## Outputs

This skill produces:

| Artifact | Location | Format | Description |
|----------|----------|--------|-------------|
| Mapping file | `ontologies/{name}/mappings/{source}-to-{target}.sssom.tsv` | SSSOM TSV | Complete mapping set with metadata |
| Quality report | `ontologies/{name}/mappings/{source}-to-{target}-qa.md` | Markdown | Quality assessment with statistics |
| Human review queue | `ontologies/{name}/mappings/{source}-to-{target}-review.tsv` | TSV | Low-confidence pairs for expert review |
| KGCL changes | `ontologies/{name}/mappings/{source}-to-{target}-changes.kgcl` | KGCL | Mapping update changes |
| Bridge ontology | `ontologies/{name}/mappings/{source}-to-{target}-bridge.owl` | OWL/XML | OWL axioms from mappings (optional) |

## Handoff

**Receives from**: `ontology-scout` — target ontology identifiers,
reuse recommendations

**Passes to**: `ontology-validator` — `ontologies/{name}/mappings/*.sssom.tsv`
(equivalence-class rows only travel as ACCEPTED once the auditor-routed reuse
proposal they correspond to has its ratification record under
`ontologies/{name}/governance/ratifications/`; unratified equivalences stay
PROPOSED and the validator treats them as non-assertions)

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
- **sameAs overuse**: Never use `owl:sameAs` for "close enough" mappings.
  Reserve it for strict identity only.
- **Ignoring transitivity**: `skos:exactMatch` is transitive. Check that
  chains don't create unintended equivalences.
- **Missing justification**: Every mapping needs a SEMAPV justification.
  `semapv:LexicalMatching`, `semapv:ManualMappingCuration`,
  `semapv:SemanticSimilarityThresholdMatching`.
- **Stale mappings**: When source or target ontology is updated, mappings
  must be rechecked for obsoleted terms.

## Error Handling

| Error | Likely Cause | Recovery |
|-------|-------------|----------|
| `sssom validate` fails | Missing required fields or invalid CURIEs | Fix curie_map, add missing justifications |
| Lexmatch produces no candidates | Vocabularies use different naming conventions | Try synonym matching, broaden match rules |
| Transitive closure creates false equivalences | Over-use of exactMatch | Downgrade to closeMatch for uncertain pairs |
| Target term is obsoleted | Target ontology was updated | Find replacement via `obo:IAO_0100001` property |
