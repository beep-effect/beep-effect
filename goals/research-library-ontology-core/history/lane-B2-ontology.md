# Lane B2: ontology, catalog projection and SHACL

Implemented on `feat/research-library-ontology-core`, starting at
`a25f1ad756`. Nothing was staged, committed, pushed or published.

## Files

- `packages/tooling/tool/cli/package.json`: five requested workspace dependencies.
- `packages/tooling/tool/cli/tsconfig.json` and `tsconfig.check.json`: matching
  references for ontology, semantic-web, shacl, oxigraph and n3.
- `bun.lock`: exactly five dependency entries in the repo-cli workspace; no
  external dependency version changes.
- `src/commands/Research/Library/Library.ontology.ts`: admitted model list,
  alignment triples, fold assembly, decoded-AST shape derivation, SHACL RDF
  lists, deterministic Turtle serialization and atomic rendering.
- `src/commands/Research/Library/Library.projection.ts`: catalog A-Box, source
  alias resolution, intake anchors, software agents, source/version evidence,
  catalog ordering and manifest-backed packet concepts.
- `src/commands/Research/Library/Library.service.ts`: renderOntology contract
  and captured implementation; live N3 and SHACL drivers.
- `src/commands/Research/Library/Library.command.ts`: nested
  `ontology render` leaf.
- `src/commands/Research/Library/Library.verify.ts`: in-memory SHACL after the
  existing integrity gate, preserving its output and failure behavior.
- `test/research-library-ontology.test.ts`: three tests with rich and v1
  catalogs, positive and negative SHACL witnesses, emitted alignment checks,
  byte-identical rendering and packet discovery.
- `test/research-library-views.test.ts`: supplies the real SHACL driver to
  existing direct verifyLibrary consumers.
- This report.

The paths beginning with src/ or test/ above are relative to
`packages/tooling/tool/cli`. Concurrent edits to FOUNDATIONAL-AUDIT.md and the
new FOUNDATIONAL-AUDIT-REVIEW.md are another lane's work and were preserved.

## Implementation choices

The fold uses the Library.schemas identity composer. Its 16 admitted classes
exclude both command option classes; LiteralKit members never enter the class
list. All schema-field predicates in the catalog projection come from the
assembled ontology. Nested records recurse through assembled object ranges.
Artifact handles use sha256; version handles use sourceId@revision. Other
nested records without IDs use stable parent/field/index handles.

Shapes read the decoded field AST with SchemaAST.toType. Defaults therefore
remain required scalar fields after decoding. Scalar shapes have maxCount 1.
Empty arrays are valid in the source schema and produce no RDF edges, so array
shapes allow zero values and have no maxCount. Requiring one edge for an empty
required array would reject valid legacy and empty catalogs.

String foreign keys project as named nodes. Known source aliases resolve to
their canonical Source node. Empty optional handles retain their string value.
Derivation.intakeId becomes an IRI only when it matches an actual catalog
intake ID; matching some other entity's ID is insufficient. Unknown anchors
remain literals, as requested. Derivation.derivedId resolves across known
catalog entity IDs and otherwise remains a literal.

The foundation typed SHACL property contract has no sh:in member. The generated
shapesDataset supplies the complete constraints, including RDF-list enum
membership, to ShaclValidationRequest. Typed shapes remain usable for the
bounded fields; production validation uses the full dataset. The driver's
internal typedNodeShapeQuads helper is private, so this lane owns its small
mapping. Shapes and A-Box quads are sorted through Rdf.sortDatasetQuads.
Effect HashSet removes duplicate quads without a quadratic pairwise scan.

libraryTopics reads only initiative.id and initiative.title, retains the
canonical goals/slug or explorations/slug path, and reports the count of
unreadable manifests. Findings can resolve either canonical packet paths or
initiative IDs to those concept IRIs. A bare initiative ID shared by several
packets produces edges to each matching packet. Effective-category evidence
uses HashMap keys sourceId and sourceId@revision. B3 owns supplying that map.

ResearchLibraryLive captures N3TurtleCodecLive and
ShaclValidationServiceLive. The ontology command uses scoped temporary files
and atomic rename, checks the destination ancestor stays within the library,
then reparses the bytes read from both published files. verify builds its
ontology and shapes in memory; it does not depend on ontology files.

## Alignments and abstentions

Included: audited information records to prov:Entity, ModelRun to prov:Activity,
Derivation to prov:Derivation, Occurrence to cito:Citation, Report to
fabio:Report, and Catalog to dcat:Dataset. Artifact is not a dcat:Distribution;
the catalog JSON has its own distribution node. SourceVersion is not a
subclass of Source and has an A-Box prov:specializationOf edge. Model pins
are separate prov:SoftwareAgent nodes, with prov:wasAssociatedWith from runs.

Dropped: Derivation.sourceId subPropertyOf prov:entity. The fold assigns the
same owned sourceId predicate IRI across all these classes. Aligning it
globally would also affect Occurrence, Capture and Finding source references.
There is no class-scoped SourceVersion-to-Source schema field to align as a
subproperty; its direct prov:specializationOf projection is exact. No equivalent
class or speculative derived-from alignment was added. The fold accepted all
included constructs without adaptation.

A concurrent audit r2 text appeared during implementation. It proposes removing
the Report/fabio superclass and changing Artifact identity to (capture, sha256).
Those proposals conflict with the explicit B2 instructions. This lane retains
the requested fabio:Report alignment and sha256 artifact identity. An asynchronous
clarification was offered; no response had arrived when the report was written.

That identity choice has a concrete limit: repeated references to identical
Artifact metadata deduplicate and validate, but records sharing a sha256 with
conflicting scalar path/role/access metadata can violate maxCount 1 when merged
onto one artifact node. This lane does not silently discard metadata to make
that case green. Adopting contextual artifact-use identity needs the instruction
conflict resolved. The positive fixture covers identical repeated artifact
records; it does not prove all context-conflicting artifact records conform.

## Verification

| Command / evidence | Result |
| --- | --- |
| bun install | Dependency resolution and lockfile succeeded; root postinstall failed when Lefthook attempted to replace the read-only shared Git hook |
| bun install --ignore-scripts | PASS; 3040 installs checked, no further changes |
| bun run beep quality package-verify @beep/repo-cli --quick | PASS; final lint 1.6 s, check 8.7 s |
| (cd packages/tooling/tool/cli && bunx vitest run test/research-library test/research-command.test.ts) | PASS; 7 files, 160 tests |
| bun run beep lint effect-vitest | PASS; 3359 files, 496 baseline findings, introduced=0 resolved=0 |
| bun run beep lint package-scripts | PASS; 193 manifests, 0 drifting, 0 written |
| git diff --check | PASS |
| Disposable real CLI ontology render, twice | PASS; both report tbox=569 shapes=758 triples; both output files hash-identical |
| Yeet inbox --unacked | Empty |

The T-Box and shape parsing tests use the N3 service. The positive SHACL checks
use the actual shacl-engine driver and report zero violations for the rich v2
catalog and decoded v1 JSON. Removing a required summary triple fails; replacing
status values with a value outside sh:in also fails. Tests cover canonical source
alias references and literal retention when an intakeId matches a Source but no
Intake. Render/topic tests use MemoryFileSystem; the separate CLI smoke above
uses disposable disk state and the full command/live-layer route.

Disposable CLI output hashes:

- research-library.ttl:
  `a417f487126ba8008636e65fd75f677508544b76d2ec0397132810fc7f3dc52d`
- research-library.shacl.ttl:
  `8422216dcd921fe9d36a202ac675082d5e2cd5e7ae53c3bfaacc092f88ae342e`

Real-library verification: **SKIPPED — BEEP_RESEARCH_LIBRARY is unset.**
There is no real-library shacl line to report. No retained library was rendered
or modified.

## Friction and remaining boundaries

The install postinstall failure is environment-only: this session cannot write
the shared Git directory's hooks. Existing hooks were left alone; the
script-free dependency verification passed. No sandbox or hook configuration
was changed.

Edit-loop compiler/format findings were fixed. The old local check-failure inbox
receipt was acknowledged as superseded, with the passing uncommitted check
evidence and the explicit no-commit constraint; it is not a fix-SHA receipt.
A platform-filesystem test-policy finding was resolved by using MemoryFileSystem,
then exercising the actual CLI separately. No baseline was refreshed.

The architecture plan command was read/run, but its plan is for slice scaffolding,
not an earned CLI role-file lint; it was not applied. This lane adds only the two
earned roles specified in the B2 assignment. No broad scaffold operation ran.

B3 still owns query views and wiring effective-category assessments into the
projection. Real-library conformance is unverified because its environment
override is absent. Concurrent r2 semantic revisions and the contextual-artifact
case above remain explicit integration decisions, not passing acceptance proof.
