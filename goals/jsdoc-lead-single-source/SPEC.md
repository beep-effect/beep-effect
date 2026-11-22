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

### Lead-source scope: module headers, generated files and namespace members are out, 2026-11-22

Blocks carrying @packageDocumentation, @fileoverview or @file are module headers even when they lead the first re-export, so they are never restating leads. Generated files (_generated/, generated/, .generated.ts, a GENERATED FILE header) are rewritten by their generators and are not counted. Types inside a companion namespace get a derived lead in docgen, but the inventory scores only top-level exports, so the sweep leaves their written leads alone.

Lane goals/jsdoc-lead-single-source-p0

Reverse: Remove the moduleHeader and generated guards from restatingLeadFindings in JSDocDocumentationInventory.ts.

### Restating-lead predicate: at most one new content word, or new words a fifth of the lead, 2026-11-22

A written lead on an annotated schema, its same-name type companion or a barrel restates when, after stop words and documentation boilerplate (schema, type, decoded, runtime, exports, ...) are dropped and plural or past-tense endings folded, at most one of its content words is absent from the annotation description and the export's names, or absent words are at most a fifth of its content words. Calibrated on a scratch census of 13,800 in-scope leads: the strict verbatim-only rule (4,600) left obvious boilerplate such as 'Runtime type for {@link X}.' unflagged, a one-third rule deleted real qualifiers such as 'never interleaved'. Implemented once in @beep/repo-utils/JSDoc/LeadSource and shared by docgen, the inventory and the sweep codemod.

Lane goals/jsdoc-lead-single-source-p0

Reverse: Change leadRestates in packages/tooling/library/repo-utils/src/JSDoc/LeadSource.ts and re-measure the restating-lead baseline.

### Restating leads are flagged by the JSDoc inventory ratchet, not oxlint informative-docs, 2026-11-22

The oxlint docs rules only cover packages/tooling/*/*/src, while restating leads sit in every package; the JSDoc inventory already scans every docgen package and its ratchet is a required check. The inventory gains a counted-only rule restating-lead (it never opens a package, so packagesNeedingRemediation cannot grow) whose baseline starts at the measured count and may only fall. Extending informative-docs would also need a @beep/repo-utils dependency in @beep/lint-rules, which moves bun.lock, a CI binary closure input frozen during the P5 cutover.

Lane goals/jsdoc-lead-single-source-p0

Reverse: Port leadRestates into packages/tooling/policy-pack/lint-rules/src/rules/docs.ts informative-docs and drop the restating-lead inventory rule.

### Single-source exported JSDoc leads from schema annotations, 2026-11-22

Operator ruling, align round 2: keep Examples, tags, Details and Gotchas; stop requiring a lead on type-level companions, barrels and annotated schemas, derive it from the annotation, and flag a lead that restates its annotation. Rejected: keep and lint tautology, leave as is, drop all prose. Source: explorations/comment-law/DECISIONS.md.

Lane explore/comment-law

Reverse: Restore required leads in docs lint, the inventory and law 15.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
