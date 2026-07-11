# Legal Ontology Landscape Decisions

## 2026-07-08 - Foundation packet absorbs ontology-survey scope

**Question:** Where should the ontology-survey and semantic-foundation scope
land?

**Answer:** Create `goals/semantic-foundation` as the new foundation-layer goal
packet. It absorbs the ontology-survey scope of `goals/ip-law-knowledge-graph`.
That older SPEC will be annotated in a separate later task, not during this
graduation.

**Rationale:** The shared vocabulary, SKOS registry, FOLIO alignment, and
loader surface are foundation capabilities consumed by multiple law-practice
and document-intake packets. Keeping them in an IP-law graph packet would keep
shared semantics coupled to an older graph-storage direction.

**Rejected options:** Do not implement this inside
`goals/ip-law-knowledge-graph`; do not create trademark docketing entities
before the shared vocabulary layer exists.

## 2026-07-08 - Dependent trademark docketing packet is deferred

**Question:** Should trademark docketing entities be included in the foundation
packet?

**Answer:** No. `goals/trademark-docketing-domain` comes later and blocks on
M3. It will own `TrademarkAsset` plus docketing entities after the docketing,
deadline, and party-role vocabulary modules are stable.

**Rationale:** The foundation packet supplies vocabulary and registry
capabilities. Law-practice domain entities require product-specific lifecycle
modeling and should not be smuggled into the shared semantic layer.

**Rejected options:** No `TrademarkAsset` or docketing entity implementation in
M1/M2.

## 2026-07-08 - V1 capability clusters

**Question:** Which competency-question clusters define V1?

**Answer:** V1 covers four capability clusters:

- Intake/filing taxonomy: CQs 2, 3, 11, 15, 19.
- Classifications-as-SKOS IPC/CPC/Nice: CQs 9, 10.
- Docketing/deadline vocabulary: CQs 1, 7, 8.
- Party/role identity: CQs 5, 18.

**Rationale:** These clusters give the first intake loop useful classification
and filing semantics while preserving a path to patent/trademark
classification, deadlines, and role-aware docketing.

**Rejected options:** Do not attempt a whole legal ontology or a full IP-law
domain model in V1.

## 2026-07-08 - Milestone gates

**Question:** What sequence keeps the work shippable?

**Answer:** Use M1-M4:

- M1 starts now and is intake-serving: repo-owned SKOS taxonomy seed with
  concept IRIs minted under `https://ns.beep.sh/` via `@beep/identity`
  `IdentityComposer`; FOLIO `skos:exactMatch`/`skos:closeMatch` where
  available; document-class vocabulary (`draft`, `redline`, `filed`,
  `received`, `privileged`, `extracted-child`); filing-path semantics for
  local vault + Box mirror; and an `@beep/ontology` taxonomy registry/service
  loading committed seed data plus vetted gitignored vendor slices from the
  exploration asset-pack manifest.
- M2 is gated behind the August 5 first-user metric or a demo-day pull:
  IPC/CPC/Nice as loadable SKOS concept schemes with edition tracking plus
  broader/narrower lookup.
- M3 is gated: docketing/deadline and party-role vocabulary modules separating
  enduring party identity from time-bounded legal roles.
- M4 is gated: SHACL shape authoring for intake/ClaimGate gates against the
  existing bounded validator in `@beep/semantic-web`.

**Rationale:** M1 gives legal-document intake the semantic registry it needs
now. M2-M4 stay behind product or dependency gates so classification,
docketing, and SHACL authoring do not bloat the first slice.

**Rejected options:** No early IPC/CPC/Nice import, no early docketing
entities, and no SHACL work before consumers prove the need.

## 2026-07-08 - Explicit non-goals

**Question:** What must V1 not do?

**Answer:** V1 excludes SPARQL engine wiring, graph-store adoption,
law-practice domain entities, and document-intake implementation work.

**Rationale:** `@beep/semantic-web` already has the unsupported SPARQL service
contract and bounded SHACL. `goals/legal-document-intake` D6 already chooses
Postgres/PGlite projection. The documents slice owns concrete vault paths and
ClaimGate use; this packet only supplies vocabulary and registry capabilities.

**Rejected options:** No graph DB, no `UnsupportedSparqlQueryServiceLive`
replacement, no `TrademarkAsset`, and no duplicated documents-slice work.

## 2026-07-08 - Package extension targets

**Question:** Which package surfaces may the goal extend?

**Answer:** Four targets are allowed:

- `@beep/rdf` `src/Vocab/*` gains constants only for vocabularies that earn
  them through P1/P2 research verdicts.
- `@beep/ontology` gains SKOS concept-scheme/taxonomy registry models plus a
  loader service; today's surface is FOLIO OpenAPI models only.
- `@beep/identity` CoreVocab is extended via the existing `mergeVocab`
  extension point and `IdentityComposer` authority.
- `@beep/semantic-web` bounded SHACL stays unchanged in contract; M4 authors
  shapes against it.

**Rationale:** The target list composes existing repo capabilities instead of
creating a parallel ontology stack.

**Rejected options:** No package-source changes outside those surfaces unless
`SPEC.md` is explicitly updated.

## 2026-07-08 - Asset hygiene

**Question:** Where should third-party and repo-owned ontology assets live?

**Answer:** Third-party TTL/OWL stays gitignored under
`explorations/legal-ontology-landscape/assets/vendor/` with committed
`manifest.jsonl` plus `fetch.sh`. Repo-owned taxonomy seed TTL/JSON-LD is
committed because it is our IP.

**Rationale:** This preserves licensing boundaries, keeps external corpora out
of package source, and gives implementation agents a manifest-driven way to
load only vetted vendor slices.

**Rejected options:** No checked-in third-party TTL/OWL payloads and no
unmanifested local corpus paths in repo files.
