# Decisions

Resolved with the user on 2026-08-04 through the repository-native
`grill-with-docs` process. These decisions govern the initiative unless a later
dated entry explicitly supersedes one.

## D1 — Canonical document authority

**Decision:** `@beep/md` is the sole canonical schema-owned document model.
Lexical serialized state and Pandoc JSON are projections, never co-equal
authorities. Conversion loss must be explicit and must never silently replace
the canonical value.

**Rejected:** making raw Lexical state canonical, or allowing different product
surfaces to choose different document authorities.

## D2 — Meaning of “clone Lexical Playground”

**Decision:** clone means behavioral and capability parity, not a source fork or
pixel-identical copy. Every upstream feature receives a stable atlas entry and
an explicit implement, generalize, defer, development-only, or reject
disposition.

**Rejected:** vendoring the Playground monolith or accepting an undocumented
subset as parity.

## D3 — Disabled authoring versus readable content

**Decision:** disabling a capability removes its authoring affordances and
commands. Existing supported content remains readable and lossless, with a
read-only fallback when editing that semantic is unavailable.

**Rejected:** deleting or degrading content merely because a profile disables
its creation UI.

## D4 — Capability and profile ownership

**Decision:** `@beep/editor` owns the schema-backed capability registry,
descriptors, dependencies, and resolver. Product profiles and product meaning
remain owned by their app or slice.

**Rejected:** a product-mode registry inside foundation UI or app-local forks
of editor capability definitions.

## D5 — Configuration lifecycle

**Decision:** the resolved capability profile is immutable for an editor mount.
Reconfiguration is an explicit transaction that preserves the canonical
`@beep/md` document while rebuilding the projection. Invalid dependencies or
conflicts fail before mount.

**Rejected:** mutating node registration piecemeal in a live Lexical instance.

## D6 — Highlighting taxonomy

**Decision:** model authored text/background style, semantic authored
Highlight, comment/annotation anchors, provenance/evidence projection, and
ephemeral UI highlights as distinct concepts. They may share rendering
primitives but not persistence meaning.

**Rejected:** one generic “highlight” mark for all five concerns.

## D7 — Page metadata versus view state

**Decision:** export-relevant page and presentation metadata belongs in the
canonical document model. Zoom, open panels, selection, and other workspace
chrome are per-user view state.

**Rejected:** storing all layout state in the document or treating page setup
as editor-local CSS.

## D8 — Initiative decomposition

**Decision:** use one exploration and at least two initial goals. Goal A is
`lexical-playground-capability-atlas`; Goal B is
`configurable-full-document-editor`.

**Rejected:** one giant goal spanning research, architecture, full parity,
collaboration, and product workflows.

## D9 — Diagnostics

**Decision:** diagnostics are parity-tracked and available in a development-only
reference profile. They are not part of production authoring profiles.

**Rejected:** omitting diagnostics from the atlas or shipping Playground debug
tools as end-user defaults.

## D10 — Collaboration sequencing

**Decision:** real-time collaboration is a separate goal after single-user
parity and product document authority exist.

**Rejected:** enabling Yjs as a boolean inside the first full-editor goal.

## D11 — Comments

**Decision:** comments are revision-anchored sidecar annotations owned with the
document lifecycle. A Lexical mark/node is only their editor projection.

**Rejected:** making comment threads inline canonical document nodes.

## D12 — Product lifecycle ownership

**Decision:** each product slice owns artifact identity, lifecycle, versions,
permissions, and publication around shared `@beep/md` values. `@beep/editor`
does not become a global persistence service or God document model.

**Rejected:** centralizing all document-like product records in the editor
package.

## D13 — Single-user parity completion bar

**Decision:** Goal B covers every non-diagnostic, production-eligible,
single-user Playground capability. Playground demonstrations may be generalized
into lawful product capabilities rather than copied literally.

**Rejected:** declaring parity after only common word-processing controls land.

This completeness bar applies to shared document semantics, authoring mechanics,
and projections. It does not override D12: identity-bearing sidecars such as
poll responses, system authorship, review workflow, and approval lifecycle stay
with their owning product slice.

## D14 — Media and remote embeds

**Decision:** canonical documents store typed artifact/media references, not
ambient fetch behavior. Remote embeds are network-inert on open until an
authorized product boundary resolves them.

**Rejected:** embedding arbitrary live URLs that cause automatic egress.

## D15 — Interchange and sharing

**Decision:** Markdown, HTML, raw Lexical JSON, Pandoc, and share links are
non-destructive projections. Canonical JSON means `@beep/md`; raw Lexical JSON
is development-only. Lossy conversion requires a preview and explicit
confirmation. Private document payloads do not belong in URLs.

**Rejected:** treating an export format as autosave authority or copying the
Playground's state-in-URL sharing model.

## D16 — History and durability

**Decision:** editor undo/redo, crash-recovery journal, autosave, and immutable
artifact revisions are separate layers with distinct retention and authority.

**Rejected:** calling Lexical history a product revision system.

## D17 — Accessibility and responsive proof

**Decision:** keyboard-only access, semantic labeling, focus behavior,
responsive/touch alternatives, and recorded browser QA are completion gates,
not post-parity polish.

**Rejected:** copying the Playground's observed accessibility and overflow gaps
unchanged.

## D18 — Portable style values

**Decision:** canonical authored styles use a finite typed, portable style
model with explicit format-compatibility behavior. Raw CSS strings and class
names stay projection-local.

**Rejected:** persisting Lexical style strings as the document contract.

## D19 — Commands and keybindings

**Decision:** commands, activation paths, keybindings, and generated help derive
from the resolved capability registry. App/profile overrides are allowed, and
conflicts are rejected before mount.

**Rejected:** separately maintained toolbar, slash-menu, shortcut, and help
registries.

## D20 — User-authored assets

**Decision:** skills, prompts, patent templates, email templates, and similar
artifacts are schema-owned document data. Authoring them does not grant
executable plugin authority.

**Rejected:** treating arbitrary authored content as executable editor
extensions.

## D21 — Template provenance

**Decision:** templates are immutable, versioned provenance sources.
Instantiation records and snapshots the exact template version used.

**Rejected:** mutable template pointers that make old artifacts change meaning.

## D22 — Template variables

**Decision:** template variables are typed canonical references with validation
and resolution semantics. `{{...}}` may be an authoring shorthand but is not
the stored authority.

**Rejected:** untyped magic strings as the only variable model.

## D23 — Human and agent editing surface

**Decision:** agents edit through typed, revision-aware document commands or
proposals over the same semantic surface used by humans. Raw Lexical mutation
is not an agent authority boundary.

**Rejected:** privileged agent access to editor internals.

## D24 — Redlining

**Decision:** formal tracked insertions/deletions, accept/reject, and redline
export are a separate post-parity goal.

**Rejected:** conflating comments or ordinary history with legal redlining.

## D25 — DOCX

**Decision:** executable DOCX import/export follows the rich schema/editor work
as a separate goal using a real Pandoc driver or sidecar. `@beep/pandoc-ast`
remains pure modeling.

**Rejected:** shelling out from the modeling package or claiming DOCX support
from Pandoc JSON schemas alone.

## D26 — PDF

**Decision:** Goal B proves page setup, pagination, and print-preview behavior.
Authoritative deterministic PDF export is a later adapter goal.

**Rejected:** coupling the first parity implementation to a production PDF
renderer.

## D27 — Notion and repository authority

**Decision:** the Notion page is the product/evidence hub for visual browsing
and stakeholder context. Repository exploration and goal packets are the
normative execution contracts.

**Rejected:** maintaining two independent normative specifications.

## 2026-08-24 — D28: Graduation completion and Goal B pause semantics

**Decision:** Goal B, `configurable-full-document-editor`, scaffolds now as
`paused`. Resume requires Goal A to satisfy its completion gate and deliver the
ratified atlas/profile contract. Creating the paused packet satisfies D8's
promised-now set, so the exploration flips to `graduated`.

**Rationale:** the prior README framing, "evaluate graduation after Goal A
establishes the contract," governed execution order, not packet existence.

**Rejected:** reclassifying Goal B as a gated candidate, which contradicts D8;
or holding the exploration open until Goal A executes.
