# Configurable Full Document Editor Spec

## Objective

Implement every production-eligible single-user Lexical Playground document
semantic, authoring mechanic, and projection in deliberate semantic batches
behind the ratified capability registry delivered by
`goals/lexical-playground-capability-atlas`.

Completion means every non-diagnostic, production-eligible single-user
capability in the ratified atlas is implemented, generalized into a lawful
product capability, or covered by a user-approved exception. The implementation
must keep `@beep/md` canonical, extend document and Lexical wire semantics only
through ratified batches, and prove the complete D13 parity bar rather than a
common word-processing subset.

Provenance: graduated from
[`explorations/full-document-editor`](../../explorations/full-document-editor/README.md).

## Non-Goals

- No vendored Lexical Playground monolith or pixel-identical clone.
- No production document identity, persistence, autosave, immutable revisions,
  sharing, permissions, or publication. Owning slices and
  `professional-authoring-products` retain those lifecycles;
  revision-anchored annotations route to `document-annotation-substrate`.
- No real-time collaboration, presence, Yjs transport, or offline reconciliation.
  That work routes to `editor-collaboration`.
- No formal tracked insertions/deletions, accept/reject workflow, or redline
  export. That work routes to `document-redlining`.
- No executable Pandoc or DOCX import/export. That work routes to
  `pandoc-docx-driver`.
- No authoritative deterministic PDF renderer. Goal B may prove page setup,
  pagination, and print preview; export routes to `document-pdf-export`.
- No Prose-to-Proof evidence, approval, candidate-review, or matter-wall
  workflow. That work routes to `prose-to-proof-portal`.
- No patent, email, prompt, skill, or other product-specific authoring
  lifecycle. Those lifecycles route to `professional-authoring-products`.
- No executable user-authored editor plugins. Schema-owned artifact authoring
  may route to `professional-authoring-products`, but authored content grants
  no execution authority.

Goal B does include the deliberate `@beep/md` and `@beep/lexical-schema`
extensions and full single-user parity that Goal A explicitly excluded.

## Source Hierarchy

1. User decisions recorded in the source exploration, including D28.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/ARCHITECTURE.md` and governing architecture chapters
   `02-shared-kernel.md`, `03-driver-boundaries.md`,
   `06-configuration-boundaries.md`, and `07-non-slice-families.md`.
4. The completed `goals/lexical-playground-capability-atlas` contract and its
   delivered, ratified atlas/profile artifacts.
5. Existing contracts in `goals/rich-text-foundation`,
   `goals/pandoc-ast-foundation`, `docs/product/workspace-substrate.md`, and
   `docs/product/prose-to-proof.md`.
6. This `SPEC.md`.
7. `PLAN.md`.
8. `GOAL.md`.
9. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `goals/configurable-full-document-editor/` - contract, execution evidence,
  verification records, and closeout reflection.
- `goals/lexical-playground-capability-atlas/` - prerequisite atlas/profile
  contract; read and consume, do not reopen its scope from Goal B.
- `packages/foundation/modeling/md` (`@beep/md`) - canonical schema-owned
  document semantics added in ratified batches.
- `packages/foundation/modeling/lexical` (`@beep/lexical-schema`) - strict wire
  schemas, codecs, normalization, and projections for those semantics.
- `packages/foundation/ui-system/editor` (`@beep/editor`) - capability-backed
  authoring mechanics, commands, registrations, read-only behavior, and tests.
- Product-owned speech-boundary proof for `document.speech-to-text`, including
  permission, transcription, correction/undo, serialization, keyboard,
  real-microphone, and narrow-layout lifecycles.
- `packages/foundation/ui-system/ui` (`@beep/ui`) - existing reusable UI
  primitives; extend only when a batch proves shared ownership.
- `apps/storybook` - isolated profile, interaction, and compatibility proof.
- `apps/professional-desktop` - registry-keyed document-editor proof through
  the existing dock registration and renderer seams, without product storage.
- Applicable package tests and packet-local `bun run beep qa` evidence under
  `history/`.

P0 may narrow these paths from the ratified atlas. Expanding them beyond the
named ownership boundaries requires a user-ratified SPEC change.

## Constraints

### Dependency and batch authority

- Do not begin P0 until Goal A satisfies its completion gate and delivers the
  ratified atlas/profile contract.
- P0 must refresh this packet from that delivered contract, enumerate every
  semantic batch and covered atlas ID, and obtain user ratification before P1.
- A batch may not disappear because it is difficult. Every D13-eligible atlas
  entry must map to an implemented batch or a user-approved Exception Ledger
  entry with an owning successor.

### Inherited P0 waivers

Goal A's [Exception Ledger](../lexical-playground-capability-atlas/SPEC.md#exception-ledger)
records the approved waivers. Goal B must retain each obligation until the
named proof removes it:

- `comments.threads`: record 480 px comments-panel lifecycle proof with a
  reachable close control and Export.
- `node.mark`: record 480 px comments-panel lifecycle proof with a reachable
  close control and Export.
- `document.comments-panel`: record 480 px comments-panel lifecycle proof with
  a reachable close control and Export.
- `extension.floating-toolbar`: record a keyboard route from the editor into
  the floating toolbar.
- `transformer.table`: record a flat table from the typed shortcut, or re-ratify
  the pinned baseline after the upstream fix lands.
- `transformer.tweet`: record a Tweet transformer that keeps selection and does
  not crash, or re-ratify the pinned baseline after the upstream fix lands.
- `document.speech-to-text`: record a real-microphone lifecycle covering
  permission, transcription, correction/undo, serialization, keyboard access,
  and narrow layout behind the product-owned speech boundary.
- `network.remote-embed-resolution`: record an inert-on-open, user-authorized
  provider lifecycle covering consent, rejected or cancelled resolution,
  egress, keyboard access, and narrow layout.
- `interchange.pandoc-docx`: retain the D25 gate until `pandoc-docx-driver`
  records executable DOCX import/export at the driver boundary, including
  declared losses and round-trip fixtures.
- `interchange.pdf`: retain the D26 gate until `document-pdf-export` records
  deterministic export, pagination, accessibility, and loss evidence.

### Capability consistency

- Hiding toolbar UI does not disable a capability. Registrations, authoring
  controls, shortcuts, slash/typeahead entries, importers, paste/drop behavior,
  commands, keybindings, and generated help must project the same resolved
  capability state.
- Disabled authoring must keep supported existing content readable and
  lossless through an explicit read-only fallback.
- Product profiles remain app/slice-owned. The foundation registry may describe
  reusable capabilities, not product modes, identity, approval, or lifecycle.

### Semantic and document authority

- `@beep/md` is the sole canonical document authority. Raw Lexical JSON,
  compressed URL state, HTML, Markdown, and Pandoc values remain projections.
- Extend `@beep/md` or `@beep/lexical-schema` only after the ratified capability
  and format matrix specifies identity, ownership, round-trip behavior, and
  accepted loss for the semantic batch.
- Keep authored text/background style, semantic Highlight, comments/annotation
  anchors, provenance/evidence spans, search matches, and collaboration
  selections distinct in schema and persistence meaning.
- Lossy conversion requires an explicit preview/confirmation contract. Private
  document payloads must never become URL state.

### Network and security

- Documents store typed media/artifact references. Opening a document must not
  fetch remote embeds or media until an authorized product boundary resolves
  them under an explicit network policy.
- User-authored document data never becomes executable editor extension code.
  New auth, egress, secret, CSP, or plugin-execution behavior requires a
  separate user-approved contract.

### Production classification

- Playground demo limits, bundled media assumptions, analytics, debug trees,
  and experimental collaboration are not production defaults. Follow the
  ratified atlas disposition and keep diagnostics development-only.
- Do not treat comments as tracked changes or `@beep/pandoc-ast` as an
  executable DOCX converter. Preserve the named successor boundaries.
- Desktop hover and drag interactions require keyboard access, semantic labels,
  focus behavior, and a narrow/touch alternative. Recorded browser QA is a
  completion gate for every gesture-bearing batch.

### Change discipline

- Preserve existing chat, viewer, and editor behavior through compatibility
  defaults and explicit migrations.
- Keep each semantic batch focused, schema-first, reversible where possible,
  and independently testable. Do not combine unrelated cleanup with parity.
- Add no dependency or lockfile change without evidence that existing repo
  capabilities cannot satisfy the ratified batch and explicit user approval.

## Acceptance Criteria

- [ ] Goal A has satisfied its completion gate and delivered the ratified
      atlas/profile contract used by this packet.
- [ ] P0 refreshes this SPEC and PLAN from that contract, maps every
      production-eligible single-user atlas ID to an enumerated semantic batch,
      and records user ratification before implementation.
- [ ] Every D13-eligible capability is implemented or has a user-approved
      Exception Ledger entry naming exact atlas IDs, rationale, and successor.
- [ ] Ratified `@beep/md` semantics and `@beep/lexical-schema` wire/codec
      extensions are schema-first, typed, and covered by round-trip and loss
      tests for every applicable projection.
- [ ] Registrations, commands, authoring affordances, activation paths,
      keybindings, and generated help derive from the resolved registry.
- [ ] Supported content remains readable and lossless when its authoring
      capability is disabled.
- [ ] The compatibility matrix states behavior and loss for canonical JSON,
      Lexical wire, Markdown, HTML, raw Lexical JSON, and future Pandoc/DOCX/PDF
      projections for each implemented semantic.
- [ ] Remote media/embed behavior is network-inert on open until an authorized
      resolver acts, and private payloads never enter URLs.
- [ ] `document.speech-to-text` passes a real-microphone lifecycle covering
      permission, transcription, correction/undo, serialization, keyboard
      access, and narrow layout behind the product-owned speech boundary.
- [ ] Product identity, persistence, collaboration, redlining, executable
      DOCX, authoritative PDF, Portal workflow, product lifecycles, and plugin
      execution remain outside the implementation.
- [ ] Focused schema, codec, resolver, command, package, app, and Storybook
      proof passes for every batch.
- [ ] Recorded browser QA proves pointer, keyboard, focus, accessibility, and
      narrow/touch behavior with zero required findings.
- [ ] Documentation explains semantic ownership, capability composition,
      read-only fallback, projection loss, migration, and successor routing.
- [ ] Base packet checks and `bun run beep yeet verify` are green; P3/P4 record
      mergeable-PR proof and a valid closeout reflection.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/configurable-full-document-editor/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/configurable-full-document-editor/ops/manifest.json` | Passes |
| Packet references | `rg -n "configurable-full-document-editor|GOAL.md|agentLaunchers|packetAnchorDocument" goals/configurable-full-document-editor` | Required surfaces present |
| Whitespace | `git diff --check -- goals/configurable-full-document-editor explorations/full-document-editor` | Passes |
| Portfolio index | `bun run beep goals index --check` | Generated index current |
| Goal contracts | `bun run beep goals doctor` | Green |
| Reflection | `bun run beep lint reflection-artifacts` | Green at closeout |
| Repo quality | `bun run beep yeet verify` | Green |
| Semantic batches | Focused package/app commands ratified during P0 and recorded in `PLAN.md` | Green for every batch |
| Browser QA | Packet-local `bun run beep qa` evidence inventory | Zero required findings |
| Hosted completion | `bun run beep yeet monitor` after intentional publication | `merge-ready: yes`; zero unresolved threads |

## Stop Conditions

- Goal A has not satisfied its completion gate or has not delivered the
  ratified atlas/profile contract. Keep Goal B paused.
- The delivered atlas is missing, contradictory, or cannot map every
  production-eligible single-user entry to an enumerated batch. Stop in P0 for
  user ratification.
- A batch crosses into persistence, collaboration, redlining, executable
  DOCX, authoritative PDF, Portal, product-lifecycle, or plugin-execution scope.
- A proposed representation would make Lexical or an export format canonical,
  conflate distinct semantics, or silently lose supported content.
- Opening content would add remote egress, executable payloads, or new
  auth/security behavior without a separately approved boundary.
- Existing documents or consumers require an irreversible or lossy migration
  without a versioned compatibility plan, fixtures, rollback, and user
  approval.
- Required focused verification or browser QA cannot run, or an introduced
  failure cannot be separated from inherited/unrelated failures.
- A batch requires a new dependency, lockfile change, generated-file edit, or
  public API expansion not ratified by this SPEC.
- The same blocker repeats after reasonable investigation.

## Decision Log

Binding decisions D1-D27 live in
[`explorations/full-document-editor/DECISIONS.md`](../../explorations/full-document-editor/DECISIONS.md)
and remain in force unless this SPEC explicitly supersedes one. D28 records the
graduation and pause semantics. D13 is Goal B's completion bar. D10-D12 and
D20-D25 set ownership and later-goal boundaries.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
