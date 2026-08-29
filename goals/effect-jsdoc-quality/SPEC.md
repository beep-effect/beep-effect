# Effect-level JSDoc Quality Spec

## Objective

`@beep/*` IDE hovers teach like Effect v4's: the repo's JSDoc law, annotation
skill, and quality tooling adopt Effect's section grammar (**When to use** /
**Details** / **Gotchas** / titled **Example** sections, described `@see`)
as machine-checked convention — while keeping the example compile validation
Effect v4 lost — proven on a three-package pilot with before/after WebStorm
hover screenshots, and ratcheted for new/touched code only.

All research is pre-mined: implement from
`explorations/effect-jsdoc-quality/research/*` (grammar constants cited to
`.repos/effect/packages/tools/jsdocs/src/Jsdocs.ts` path:line) and the twelve
grilled decisions in `explorations/effect-jsdoc-quality/DECISIONS.md`
(2026-07-30, all user-confirmed). Do NOT re-mine Effect.

## Binding decisions (from the grill — normative here)

1. **Approach**: grammar port + ratchet (Option B). No mass migration.
2. **Carrier — B2 transitional**: `**Example** (Title)` sections are the
   canonical carrier for new/touched code. `@beep/docgen` ALREADY harvests
   both carriers — `Core.ts:319-338` extracts description fences alongside
   `@example` tag fences into generated example files feeding the existing
   `tsc --noEmit` gate (correction vs the exploration research, surfaced by
   Codex review on PR #516) — so the docgen task is a REGRESSION FIXTURE
   proving the section path, not new harvesting. The real code change is in
   the inventory: example presence = section OR grandfathered tag (update
   `requiredExportTags`, `JSDocDocumentationInventory.ts:115,605,667`).
   Existing 16,604 tags migrate cleanup-on-touch only.
3. **`@remarks` retired**: forbidden in new work; details/gotchas semantics
   move to body sections; touched files migrate their `@remarks` (491 exist).
4. **Enforcement — shape-checked opt-in**: sections optional; when present
   validated: exact order (**When to use** → **Details** → **Gotchas** →
   **Example** blocks last), non-empty, no duplicates, When-to-use body opens
   with `Use to|Use when|Use as|Use with`, Example titles unique per block
   with exactly one ts fence each, no loose ts fences outside Example
   sections, one-paragraph lead description. New rule codes ride
   `standards/jsdoc-totals.regression-baseline.jsonc` fail-on-growth.
   **Diff-aware gate required**: the existing ratchet compares repo-wide
   totals only (`JSDocRatchet.ts:426-445`), so it cannot enforce the
   cleanup-on-touch promises (no-`@remarks`/grandfathered-tag migration in
   touched files) — an untouched legacy finding passes and cleanup elsewhere
   can offset new findings. P2 must add a changed-files-scoped check (the
   quality tooling already has changed-files scoping) or the law text must
   scope its touched-file promises to what the gate actually enforces.
5. **Example law — kind-split**: value-level exports (functions, constants,
   classes, schemas, services) require an Example; pure type-level exports
   (type aliases, interfaces, namespaces, `.Encoded` companions) require
   prose only. The inventory rule becomes kind-aware; baseline stays zero.
6. **Described-`@see` day-one**: every `@see` carries a purpose phrase.
7. **`@since` stays `0.0.0`** (format check only).
8. **Namespace imports in examples** (`import * as S from "effect/Schema"`);
   Effect's named-import rule is NOT ported.
9. **Hygiene rides this goal**: tsdoc.json drops `@module`/`@template`
   (registered but banned); fix the `.patterns/jsdoc-documentation.md`
   line-848 copy-paste bug; fix the skill's 3 stale Source Reference paths
   (categories live at
   `packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts`).
10. **Pilot trio**: `packages/foundation/modeling/schema` + one tooling
    package + one law-practice values slice, rewritten to full section style
    in the `jsdoc-annotation-specialist` posture; acceptance = before/after
    WebStorm hover screenshots recorded under `history/outputs/`.

## Non-Goals

- Mass rewrite of existing JSDoc (ratchet-on-touch only).
- Depending on `@effect/jsdocs` (private upstream); port semantics only (MIT
  — attribute where semantics are copied).
- `{@link}`/`@see` target resolution (follow-on goal; needs checker program).
- Wiring `deterministic-rubric-v1` to CI; `runExamples`; LLMS-corpus analog;
  category-vocabulary repair (mapped follow-ons in the exploration MAP.md).
- Real-semver `@since`; named-import examples; architecture ADR entries.
- Copying Effect's toothless CI wiring (our diagnostics must actually fail).

## Source Hierarchy

1. User objective (exploration DECISIONS.md, 2026-07-30).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing standards: `.patterns/jsdoc-documentation.md` (this goal rewrites
   it — the rewrite becomes binding on merge), `standards/ARCHITECTURE.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `.patterns/jsdoc-documentation.md` — law rewrite (sections, tag-order
  rework, carrier, kind-split, described-@see, @remarks retirement, hygiene).
- `.agents/skills/jsdoc-annotation-specialist/` (+ mirrors) — skill rewrite.
- `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts`
  — ~6-8 new rules (mapping table:
  `explorations/effect-jsdoc-quality/research/diff-effect-vs-beep.md` §8).
- `packages/tooling/tool/docgen/` — regression fixture for the EXISTING
  description-fence harvest (`Core.ts:319-338`); no new harvesting expected.
- `tsdoc.json` — hygiene.
- Pilot packages' JSDoc.
- `standards/jsdoc-totals.regression-baseline.jsonc` — new tracked totals.

## Constraints

- Fence-aware section parsing (never regex-split inside code fences).
- The kind classification used by the inventory rule and docgen must agree.
- New rules land and fold into the baseline within this goal (no dangling
  "enable later" state).
- Effect-first repo laws apply to all tooling code (schema-first, LiteralKit
  for literal unions, `Effect.fn`/`fnUntraced`, no native Set/Map).
- Preserve unrelated worktree changes; never `git add -A`.

## Acceptance Criteria

- [ ] Rewritten pattern doc + skill teach the section grammar with worked
      exemplars (Option/none-style) and the kind-split example law.
- [ ] New inventory rules enforce Binding decision 4's shape checks and the
      kind-aware presence rule; `bun run beep quality jsdoc-inventory` green;
      new codes present in the regression baseline.
- [ ] A regression fixture proves the existing description-fence harvest
      path compiles section-carried examples (`Core.ts:319-338`).
- [ ] The cleanup-on-touch rules are enforced by a changed-files-scoped
      check, or the law's touched-file promises are scoped to match the
      repo-wide ratchet.
- [ ] Pilot trio converted; before/after hover screenshots recorded under
      `history/outputs/`; inventory + docgen + check battery green.
- [ ] Hygiene fixes landed (tsdoc.json, line-848 bug, skill paths).
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/effect-jsdoc-quality/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/effect-jsdoc-quality/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/effect-jsdoc-quality` | Passes |
| Inventory + ratchet | `bun run beep quality jsdoc-inventory` + ratchet lane | Green; new codes baselined |
| Example compilation | `bun run beep docgen local` (or focused run on pilots) | Green incl. section-harvested fences |
| Hover fidelity | Before/after WebStorm screenshots in `history/outputs/` | Pilot hovers match the Effect reference style |
| Reflection | `bun run beep lint reflection-artifacts` | Passes at close |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope (e.g. forced into mass JSDoc
  edits or link-resolution work).
- Verification requires unnamed credentials, cost, destructive side effects,
  or policy approval.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
