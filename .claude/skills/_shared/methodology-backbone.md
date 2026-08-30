# Methodology Backbone

How the 9 ontology skills map to established ontology engineering lifecycle
phases. Every skill operates within this shared framework.

## Methodology Foundations

This workspace synthesizes four complementary methodologies:

- **METHONTOLOGY** (Fernandez-Lopez et al., 1997) — structured lifecycle with
  explicit activities: specification, knowledge acquisition, conceptualization,
  formalization, integration, implementation, evaluation, maintenance
- **NeOn Methodology** (Suarez-Figueroa et al., 2012) — scenario-based,
  emphasizes reuse, collaboration, and modular development
- **CQ-Driven Development** (Gruninger & Fox, 1995) — competency questions as
  acceptance criteria, formalized as SPARQL tests (Test-Driven Ontology
  Development, TDOD)
- **Kendall & McGuinness Lifecycle** (Ontology Engineering, section 7.3) —
  emphasizes phased term extraction, use case development, and explicit review

## K&M Phase Mapping

How K&M's 9-phase workflow maps onto this workspace's lifecycle:

| K&M Phase | Workspace Mapping |
|----------|-------------------|
| 1. Preparatory | Phase 1: Specification |
| 2. Initial term excerption | Phase 2: Knowledge Acquisition |
| 3. Business architecture | Phase 3: Conceptualization |
| 4. Subsequent term excerption | Phase 2 (iterative revisit) |
| 5. Use case development | Phase 1 (requirements refinement) |
| 6. Term curation | Phase 3: Conceptualization |
| 7. Ontology development | Phase 4: Formalization & Implementation |
| 8. Review | Phase 6: Evaluation |
| 9. Deployment | Cross-cutting release/maintenance workflow |

## Lifecycle Phases and Skill Mapping

```
Phase 1: SPECIFICATION
  └── ontology-requirements
        Elicit competency questions, define scope, produce ORSD

Phase 2: KNOWLEDGE ACQUISITION & REUSE
  └── ontology-scout
        Search registries, evaluate existing ontologies, extract modules

Phase 2.5: FOUNDATIONAL AUDIT
  └── ontology-foundational-auditor
        Denotation analysis, UFO/OntoClean category tests, term proposals,
        steward ratification — the gate between candidates and commitments

Phase 3: CONCEPTUALIZATION
  └── ontology-conceptualizer
        Build glossary, design taxonomy, align to BFO, select axiom patterns

Phase 4: FORMALIZATION & IMPLEMENTATION
  └── ontology-architect
        Encode OWL 2 axioms via ROBOT templates, KGCL, OWLAPY, LinkML

Phase 5: INTEGRATION & MAPPING
  └── ontology-mapper
        Create SSSOM mappings, lexmatch, LLM verification, bridge ontologies

Phase 6: EVALUATION
  └── ontology-validator
        Reasoner, SHACL, ROBOT report, CQ test suites

Cross-Cutting: QUERYING
  └── sparql-expert
        SPARQL generation, validation, execution across backends

Cross-Cutting: MAINTENANCE & EVOLUTION
  └── ontology-curator
        Deprecation, KGCL changes, versioning, releases
```

## Pipelines

Skills compose into three primary pipelines:

### Pipeline A — New Ontology (full lifecycle)

```
requirements → scout → foundational-auditor → conceptualizer → architect → validator
```

1. **requirements** produces: CQs, ORSD, pre-glossary, scope definition
2. **scout** consumes pre-glossary, produces: reuse report, import term lists,
   ODP recommendations
2.5 **foundational-auditor** consumes CQs + pre-glossary candidates + reuse
   report, produces: denotation hypotheses, identity cards, term proposals —
   and collects the STEWARD'S ratification decisions as records (the human
   steward authors every decision; the skill only scribes each verbatim
   per-proposal answer) — the gate that keeps representations from becoming
   referents (Phase 2.5: Foundational Audit).
3. **conceptualizer** consumes RATIFIED proposals + ratification records +
   the dispositions index (never raw pre-glossary terms; the index carries
   the unresolved/deferred remainder), produces: glossary,
   conceptual model, BFO alignment, axiom plan
4. **architect** consumes approved conceptual model, produces: ontology files
   (.ttl), SHACL shapes
5. **validator** consumes ontology + shapes + CQ tests, produces: validation
   report (pass/fail)

### Pipeline B — Mapping

```
scout → mapper → validator
```

1. **scout** identifies target ontologies for alignment
2. **mapper** generates SSSOM mappings via lexmatch + LLM verification
3. **validator** validates mapping file and checks logical consistency

### Pipeline C — Evolution

```
curator → validator
```

1. **curator** proposes KGCL changes (deprecations, renames, restructuring)
2. **validator** verifies changes maintain consistency

## The CQ Through-Line

Competency questions are the connective tissue across all phases:

| Phase | CQ Role |
|-------|---------|
| Specification | CQs are elicited and prioritized |
| Knowledge Acquisition | CQs guide what to look for in existing ontologies |
| Foundational Audit | source symbols become CANDIDATES; identity/rigidity/dependence analysis + steward ratification decide what may become classes |
| Conceptualization | ratified commitments determine what classes and relations are composed |
| Formalization | CQ SPARQL drafts (from Specification) guide axiom implementation |
| Evaluation | CQ-SPARQL tests serve as acceptance criteria |
| Maintenance | New CQs trigger evolution; deprecated CQs are retired |

## Phase Boundaries

Each phase has explicit entry and exit criteria:

| Phase | Entry Condition | Exit Condition |
|-------|----------------|----------------|
| Specification | User request or domain need | ORSD approved, CQs prioritized |
| Knowledge Acquisition | Pre-glossary available | Reuse report complete |
| Foundational Audit | CQ suite (count >= 1) + pre-glossary candidates + reuse report + pinned corpus | Dispositions index total; every submittable proposal reviewed; steward ratifications scribed |
| Conceptualization | ratified proposals + ratification records + dispositions index | Conceptual model approved by user; unresolved/deferred remainder carried forward, never dropped |
| Formalization | Approved conceptual model | Ontology passes reasoner |
| Integration | Source and target ontologies identified | SSSOM file validated |
| Evaluation | Any ontology artifact exists | All quality checks pass |
| Maintenance | Change request or version trigger | KGCL changes validated |
