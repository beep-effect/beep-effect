# IP-Law Ontology Survey Distillation

Date: 2026-07-14

## Why this note exists

This note absorbs the durable findings from the paused
`ip-law-knowledge-graph` P0 ontology survey into its long-term exploration
home. It is a pointer and condensation, not a second ontology design and not a
reason to revive the paused graph-storage packet.

The full survey remains recoverable from repository history at
`goals/ip-law-knowledge-graph/history/outputs/p0-ontology-research.md` after
that goal packet is deleted.

## Survey shape

The P0 pass compared seven sources:

1. LKIF-Core for legal actors, sources, documents, expressions, norms, rights,
   inverse properties, disjointness, and normative ordering.
2. IPRonto/ALIS for IP rights, agreements, licenses, transfers, parties,
   territory, and time.
3. the Copyright Ontology for work/manifestation/instance structure, rights
   bundles, derivation, parts, performances, and recordings.
4. JudO for judgments, adjudication, judicial interpretation, legal status,
   applied rules, considered material, and limited cardinality constraints.
5. an LCBR research target represented only by a JudO-core proxy because the
   named paper did not yield a directly retrievable authoritative OWL file.
6. ESTRELLA’s archived LKIF norm module, largely corroborating LKIF’s legal
   source and normative backbone.
7. WIPO IPC master XML as a hierarchical patent-classification taxonomy with
   explicit cross-references, not as OWL.

## Findings worth retaining

- Reuse upper legal semantics for actors, public bodies, documents, norms,
  rights, expressions, judgments, and jurisdictions; do not mint local
  versions without a competency-question gap.
- Copyright has the strongest direct work/right grounding: work,
  manifestation, instance, derivation, part, performance, recording, economic
  rights, moral rights, related rights, and exceptions.
- Licensing and transfer deserve explicit relations rather than collapsing
  into generic ownership: licensee/licensor, grantor/grantee, transferred
  right, temporal scope, and territorial scope.
- Judicial reasoning needs first-class “applies rule” and “considers” edges so
  conclusions remain connected to provisions, claims, and material facts.
- Normative permission/prohibition and rule priority are distinct from
  ownership and should remain explicit when a use case needs them.
- IPC is a controlled taxonomy with both tree containment and non-tree cross
  references. Preserve source identifiers and version; transform to SKOS/OWL
  only when a concrete reasoning or interoperability requirement justifies it.
- `Patent`, `Trademark`, `Filing`, `Court`, and patent-specific `Claim` were
  weakly grounded or represented only through broader/proxy classes. They need
  explicit local competency questions and ADR justification rather than false
  claims of direct ontology coverage.
- Useful candidate relations included licensing/transfer roles,
  permission/prohibition, manifestation/derivation/part, judicial application
  and consideration, normative priority, and IPC cross-reference edges.

## Provenance cautions

- The LCBR section used a proxy and must remain provisional until an
  authoritative machine-readable artifact is found.
- The original JudO contract URL was dead; the survey used a mirror/equivalent
  repository artifact. Verify provenance and license before reuse.
- The ESTRELLA material came from an archive and overlaps LKIF by design.
- IPC master data is XML taxonomy input, not evidence that WIPO publishes the
  surveyed content as OWL.
- Ontology terms are reference material until current URLs, versions, and
  licenses are re-verified. This note carries findings, not permission to copy
  upstream artifacts.

## Absorption guidance

Feed these findings into the legal-ontology-landscape competency questions and
semantic registry work. Keep storage, retrieval, extraction, domain entities,
and docketing workflows outside this note; they require their own product pull
and current architecture decisions.
