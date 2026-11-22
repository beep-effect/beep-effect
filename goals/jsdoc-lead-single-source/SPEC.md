# JSDoc Lead Single Source Spec

## Objective

Exported JSDoc keeps its Examples, tags and real Details and Gotchas, and stops carrying prose that repeats the code or the schema annotation beside it: 60% of 1,046 sampled blocks did. Graduated from `explorations/comment-law` (decision 2026-11-22, exported JSDoc).

## Non-Goals

- Deleting Examples or doctests.
- Free prose and local JSDoc (`comment-law-gate`, `comment-law-sweep`).

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/tool/docgen` (lead from the annotation description when a block has none).
- `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts` and the JSDoc ratchet.
- `packages/tooling/policy-pack/lint-rules` (`informative-docs` extended: a lead restating its annotation fails).
- `.patterns/jsdoc-documentation.md`, `standards/effect-laws-v1.md` law 15, `AGENTS.md`, the `jsdoc-annotation-specialist` skill.

## Constraints

- The JSDoc Ratchet required check stays green through the change; tracked totals may only fall.
- Generated docs keep a description for every export, sourced from the annotation where the block has none.
- JSDoc tags that tools read (`@internal`, `@public`, `@expected-unused`, `@ignore`, `@deprecated`, `@since`, `@category`) and doctest fences are never deleted.
- Exports are resolved from the file's export declarations, so `export { x }`, `export default x` and module headers count as public.
- No committed per-comment or per-file inventory (S31). Out-of-repo ledgers live under `~/.local/state/beep/comment-law/`.

## Acceptance Criteria

- [ ] Type-level companions, barrels and annotated schemas pass docs lint and docgen without a lead.
- [ ] A lead that restates its annotation is flagged.
- [ ] A measured count of removed restating leads, against the sampled estimate of about 25,000 blocks.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/jsdoc-lead-single-source/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/jsdoc-lead-single-source/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/jsdoc-lead-single-source` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add jsdoc-lead-single-source --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug jsdoc-lead-single-source`; add a `kind: decision` file there, never edit this block._

### Single-source exported JSDoc leads from schema annotations, 2026-11-22

Operator ruling, align round 2: keep Examples, tags, Details and Gotchas; stop requiring a lead on type-level companions, barrels and annotated schemas, derive it from the annotation, and flag a lead that restates its annotation. Rejected: keep and lint tautology, leave as is, drop all prose. Source: explorations/comment-law/DECISIONS.md.

Lane explore/comment-law

Reverse: Restore required leads in docs lint, the inventory and law 15.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
