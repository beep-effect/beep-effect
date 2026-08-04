# Lexical Playground Capability Atlas Spec

## Objective

Deliver one versioned, evidence-backed capability atlas that accounts for every
user-visible and source-registered feature of Lexical Playground `0.49.0` at
commit `a933222c489e7025d87b9217c2489d309fc8a3cf`, then implement and prove the
smallest general capability/profile contract needed for later full-document
parity.

The resulting `@beep/editor` resolver must make registered nodes/extensions,
authoring affordances, commands, keybindings, generated help, read-only
behavior, and dependencies agree. A synthetic registry-keyed Professional
Desktop panel proves two profiles over only existing `@beep/md` semantics.

Provenance: graduated from
[`explorations/full-document-editor`](../../explorations/full-document-editor/README.md).
Its [`DECISIONS.md`](../../explorations/full-document-editor/DECISIONS.md) D1-D27
are binding unless this spec explicitly supersedes them.

## Non-Goals

- No implementation of the missing Playground nodes, marks, embeds, tables,
  pages, media, comments, collaboration, or interchange semantics.
- No new canonical `@beep/md` nodes, marks, presentation metadata, or codecs.
- No expansion of `@beep/lexical-schema` wire unions.
- No production document entity, persistence, autosave, revisions, sharing,
  permissions, publication, template lifecycle, or agent editing authority.
- No real-time collaboration/Yjs, formal redlining, executable Pandoc/DOCX,
  authoritative PDF generation, or Prose-to-Proof workflow.
- No vendored Playground source, pixel-identical clone, or production exposure
  of diagnostics.
- No remote media/embed egress and no private document payload in URLs.
- No redesign of current chat/editor consumers.

## Source Hierarchy

1. User objective and decisions recorded in the source exploration.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/ARCHITECTURE.md` and governing architecture chapters:
   `02-shared-kernel.md`, `03-driver-boundaries.md`,
   `06-configuration-boundaries.md`, and `07-non-slice-families.md`.
4. Existing contracts: `goals/rich-text-foundation`,
   `goals/pandoc-ast-foundation`, `docs/product/workspace-substrate.md`, and
   `docs/product/prose-to-proof.md`.
5. This `SPEC.md`.
6. `PLAN.md`.
7. `GOAL.md`.
8. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `explorations/full-document-editor/` — complete reference evidence and
  screenshot corpus; update only to correct or extend provenance.
- `goals/lexical-playground-capability-atlas/` — normative contract and
  execution evidence.
- [Notion initiative](https://app.notion.com/p/3b269573788d8096b876ed2ad31d151d)
  — stakeholder-facing visual evidence/status hub; synchronize it at P0
  evidence lock and P4 closeout without making it a competing spec.
- `packages/foundation/ui-system/editor` (`@beep/editor`) — schema-backed
  capability descriptors, resolver, profiles, generated command/help surfaces,
  and tests.
- `apps/storybook` — isolated capability/profile proof and visual fixtures.
- `apps/professional-desktop` — registry-keyed, synthetic dock-panel proof with
  no production document persistence.
- `@beep/md`, `@beep/lexical-schema`, and `@beep/ui` — read/reuse only except
  for narrowly necessary exports that do not add semantics.

## Constraints

### Canonical authority and ownership

- `@beep/md` is the sole canonical schema-owned document model. Lexical state
  is a projection; the profile mechanism may not introduce a second authority.
- `@beep/editor` owns reusable capability descriptors and resolution.
  Applications/slices own named product profiles and product artifact meaning.
- Disabled authoring may not make supported existing content unreadable,
  invalid, or lossy. Declare a read-only fallback for every capability.
- The resolved profile is mount-immutable. A later reconfiguration must be an
  explicit remount transaction over canonical content.

### Atlas contract

The normative atlas is the authored JSON artifact
`goals/lexical-playground-capability-atlas/research/capability-atlas.json` with
wire tag `editor-capability-atlas/v1`. Its top-level shape is
`{ schemaVersion, upstream, evidence, capabilities }`. Entries are authored,
not generated; pinned source-registration and screenshot inventories are its
evidence inputs. Goal-local schemas live at
`ops/CapabilityAtlas.schemas.ts`. The exact verifier is
`ops/verify-capability-atlas.ts`, invoked as:

```sh
bun run goals/lexical-playground-capability-atlas/ops/verify-capability-atlas.ts
```

It must decode the artifact, reject duplicate/incomplete IDs, validate
dependencies and evidence files, and reconcile the pinned source/screenshot
inventories.

The atlas must use stable IDs and record, for every feature:

1. upstream version/commit and exact live/source evidence;
2. category and explicit disposition: `implement`, `generalize`, `defer`,
   `development-only`, or `reject`;
3. owner package/slice and target goal;
4. node, mark, extension, transformer, and nested-editor registration;
5. every activation path: toolbar, floating toolbar, slash menu, Markdown
   shortcut, keyboard, context menu, paste/drop, importer, or programmatic;
6. commands, platform keybindings, help text, dependencies, conflicts, and
   profile eligibility;
7. canonical `@beep/md`, Lexical wire, Markdown, HTML, raw Lexical JSON,
   Pandoc/DOCX, and PDF compatibility/loss status;
8. read-only behavior, accessibility expectations, responsive/touch
   alternative, network/security behavior, and remaining proof gaps.

Every production-eligible user-visible capability and activation path must be
exercised through its applicable create/edit/select/undo/redo/copy/paste/
serialize/delete lifecycle and backed by screenshot or recorded interaction
evidence. An unverified state cannot satisfy P0 or P2. A genuinely unavailable
or unsafe behavior requires a user-approved Exception Ledger waiver naming the
exact atlas IDs, rationale, and owning follow-up goal. Source-only/development
diagnostics may use pinned source evidence when no end-user interaction exists,
but their non-production classification remains explicit.

The atlas must reconcile at least the 38 root-registered node classes, the
effective rich-text node set, all top-level extensions/plugins, settings,
Markdown transformers, toolbar inserts, slash commands, document actions,
and observed keyboard shortcuts from the two source audits. Counts are evidence
checks, not substitutes for stable entry identity.

### Capability contract

- Model the public contract schema-first using named schemas and derived types.
  Do not replace it with an untyped boolean bag.
- Keep the minimum descriptor fields needed to satisfy the atlas: stable ID,
  dependencies/conflicts, registrations, activation/command definitions,
  read-only fallback, classification, and evidence link. Avoid speculative
  product policy in foundation UI.
- Resolution is deterministic. Unknown IDs, missing dependencies, dependency
  cycles, incompatible registrations, and keybinding conflicts return typed
  errors before editor mount.
- Commands and default keybindings are registered once. Toolbars, slash/typeahead
  affordances, floating controls, and shortcut help filter or project the same
  resolved command set.
- App-owned overrides may replace default bindings; resolution rejects
  ambiguous active bindings.
- Diagnostics may appear only in an explicit development/reference profile.
- Generic document structure and authoring mechanics may be shared. Poll
  responses/voter identity, system authorship, review workflow, approval state,
  and similar identity-bearing sidecars remain product-slice-owned and route to
  named later goals rather than `@beep/editor`.

### Representative proof

- Define a minimal profile and a broader `document-proof` profile using only
  currently supported document semantics. The same supported canonical fixture
  must remain readable under both.
- Mount the proof through the existing Professional Desktop panel registry and
  dock layout. The panel fills its assigned box and does not introduce global
  state or persistence.
- Preserve existing editor, viewer, and chat behavior by adapting current
  fixed registrations through compatibility defaults rather than changing
  consumer-visible behavior.
- No new dependency or lockfile change unless the user explicitly authorizes it
  after a documented need is proven.

### Quality and evidence

- Follow schema-first and Effect-first repo law. Frontend state uses the repo's
  Atom/reactivity patterns where shared or reactive state is actually needed.
- Add focused runtime, schema encode/decode, resolver, and command tests. Verify
  the editor package with its existing `check` command; do not recreate the
  retired dtslint/tstyche surface. Add a new compile-only regression proof only
  if an actual type-level regression demonstrates the need for one. Add
  Storybook proof for both profiles.
- Gesture-bearing UI proof must use `browser-qa-loop`: record, extract, judge,
  fix, and repeat until zero required findings. Cover pointer, keyboard,
  narrow viewport/touch alternative, focus restoration, and accessible names.
- Preserve MIT attribution for behavior or code ported from Lexical.
- Do not modify unrelated worktree state.

## Acceptance Criteria

- [ ] A versioned capability atlas covers every live/source feature with stable
      IDs and every field required by the Atlas contract; reconciliation has no
      unexplained node, extension, setting, transformer, command, or activation
      path.
- [ ] The 17 seed screenshots remain versioned/captioned, and Goal A adds
      screenshot or recorded interaction evidence for every production-eligible
      user-visible capability and activation path. Every current unverified
      item is exercised or has a user-approved, goal-owned waiver.
- [ ] The compatibility matrix makes unsupported and lossy projections
      explicit and names the later goal that owns each missing semantic.
- [ ] `@beep/editor` exports schema-backed capability/profile descriptors and a
      deterministic resolver with typed validation errors.
- [ ] Node/extension registration, commands, activation paths, keybindings, and
      generated shortcut help derive from one resolved profile.
- [ ] Tests prove unknown capability, dependency, cycle, conflict, and
      keybinding-collision failures, plus deterministic successful resolution.
- [ ] Existing supported content remains readable when authoring capability is
      absent, and existing editor/chat consumers retain current behavior.
- [ ] Storybook proves minimal and `document-proof` profiles over the same
      canonical fixture without adding `@beep/md` semantics.
- [ ] A synthetic registry-keyed Professional Desktop panel mounts the proof,
      fills its dock box, and has no product persistence or network egress.
- [ ] Recorded browser QA passes keyboard, pointer, accessibility, and
      responsive/touch acceptance with zero required findings.
- [ ] Package docs explain ownership, profile composition, read-only fallback,
      mount immutability, and how Goal B consumes the atlas.
- [ ] The Notion initiative is synchronized at evidence lock and closeout with
      the atlas/screenshot index, decisions, current goal status, and repo
      evidence links; it contains no competing normative implementation prose.
- [ ] Required targeted tests and `bun run beep yeet verify` are green; P3/P4
      closeout includes mergeable-PR proof and a valid reflection.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/lexical-playground-capability-atlas/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/lexical-playground-capability-atlas/ops/manifest.json` | Passes |
| Packet references | `rg -n "lexical-playground-capability-atlas|GOAL.md|agentLaunchers|packetAnchorDocument" goals/lexical-playground-capability-atlas` | All required surfaces present |
| Whitespace | `git diff --check -- goals/lexical-playground-capability-atlas explorations/full-document-editor` | Passes |
| Atlas artifact | `bun run goals/lexical-playground-capability-atlas/ops/verify-capability-atlas.ts` | `editor-capability-atlas/v1` decodes; files resolve; zero unexplained or unexercised entries without approved waiver |
| Editor package check | `bun run --cwd packages/foundation/ui-system/editor check` | Green |
| Focused behavior | package/app unit and Storybook tests recorded during P1/P2 | Green |
| Browser QA | `bun run beep qa` evidence inventory under packet history | Zero required findings |
| Reflection | `bun run beep lint reflection-artifacts` | Green at closeout |
| Repo quality | `bun run beep yeet verify` | Green |
| Hosted completion | `bun run beep yeet publish --message "..."` then `bun run beep yeet monitor` | PR exact-head checks/reviews green and mergeable |

## Stop Conditions

- The pinned source checkout, live evidence, or current editor contracts are
  missing or materially contradictory.
- A source feature cannot be classified without a product or security decision;
  record the exact atlas entry and ask rather than silently omit it.
- The implementation requires new canonical document semantics, a data
  migration, production persistence, network egress, collaboration, or a new
  dependency/lockfile change.
- Existing chat/editor consumer behavior cannot be preserved by a compatibility
  default within named scope.
- A production-eligible user-visible behavior remains unexercised and lacks a
  user-approved waiver with an owning follow-up goal.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Decision Log

Binding decisions D1-D27 live in
[`explorations/full-document-editor/DECISIONS.md`](../../explorations/full-document-editor/DECISIONS.md).
Goal A specifically enforces D1-D5, D8-D9, D13, D17-D19, and D27 while carrying
the remaining decisions forward as classification constraints.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
