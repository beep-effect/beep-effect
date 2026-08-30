# Lane R2 — vocabulary reuse scan

You are a research lane for the beep-ci-operational-ontology packet (beep-effect repo).
We are building an operational ontology of monorepo CI/verification: lanes, proofs,
attempts, episodes, certainty tiers, cache epochs, invalidation blast radius, seats/
grants/budgets, contended resources, cost estimates, control interventions. The
pre-glossary lives at
explorations/beep-ci-operational-ontology/ontology/docs/pre-glossary.csv — READ IT FIRST.

TASK: scan existing vocabularies/ontologies for reuse before we mint terms: PROV-O,
P-Plan, OSLC Automation, SEON (software engineering ontology network), SPDX (incl. Build
profile), in-toto attestations, W3C SSN/SOSA only if genuinely relevant, schema.org
actions, DOAP, and any CI/build-specific ontologies you can verify exist. For each: what
it covers, license/status, which of OUR pre-glossary terms it could supply (term-by-term
mapping candidates with SSSOM-style predicate: skos:exactMatch / closeMatch / related),
and what it cannot express (our epoch/hash-surface/backpressure semantics are likely
novel — say so honestly where true).

DELIVERABLE: write (overwrite if present)
explorations/beep-ci-operational-ontology/research/r2-reuse-scan.md
Markdown, dated 2026-08-27: one section per vocabulary + a consolidated mapping table
(our term -> candidate external term -> predicate -> confidence) + a "genuinely novel"
list. CITATION DISCIPLINE: URLs only when confident they exist; [UNVERIFIED] otherwise;
never fabricate. Wrap lines under 100 chars.
