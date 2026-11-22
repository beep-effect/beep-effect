# Comment Law Gate Spec

## Objective

Agents can no longer add free prose comments or comments on non-exported declarations, and the repo has the machinery to remove the existing ones safely. Graduated from `explorations/comment-law` (decisions 2026-11-22, ban scope and ADR home).

## Non-Goals

- Deleting existing comments (`comment-law-sweep`).
- Changing the JSDoc law for exported symbols (`jsdoc-lead-single-source`).
- Comments in non-TypeScript files.
- A Biome GritQL host: it cannot match comments (exploration `research/lanes/lint.md`).

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

- `packages/tooling/policy-pack/lint-rules` (comment grammar module, `beep/no-comments` oxlint rule).
- `packages/tooling/tool/cli` (`beep laws comments` scanner, growth check, strip with AST proof; `beep decisions check` and `for`; `internal/ratchet` multiset diff).
- a new repo skill named delete-comment, from the draft in the exploration's `research/drafts/delete-comment/`, `skills-lock.json`, `.codex/config.toml`.
- `<package>/decisions/` convention: `.claude/skills/grill-with-docs/ADR-FORMAT.md` and `SKILL.md`.
- `AGENTS.md` Code Laws and Touch table; `standards/effect-laws-v1.md`; `CreatePackage` templates that emit prose (the vitest `Package-specific overrides` placeholder in 142 configs).

## Constraints

- The growth check compares a path-free fingerprint multiset of individual comments in changed files against the merge base resolved by `beep ci lane --event-base`; moves and renames pass, new or reworded comments fail. It never skips on an unresolved base.
- A tree-only lock keeps every scope off the shrink-only pending list at zero; a sweep PR that empties a scope removes its line.
- The scanner rejects any disable directive that would silence the rule, bare `oxlint-disable` and `eslint-disable` included.
- Ships advisory; turns blocking in the PR that lands the AGENTS line and the template changes.
- A hazard with no better home keeps one allow-listed form whose id resolves to a decision file.
- Exemptions are exact tokens, never prefix words: directives, triple-slash references, semgrep markers, pure marks, coverage and vitest pragmas, licence and provenance notices, generated headers, `// beep:` port-divergence markers (exploration `research/lanes/consumers.md` section 9).
- JSDoc tags that tools read (`@internal`, `@public`, `@expected-unused`, `@ignore`, `@deprecated`, `@since`, `@category`) and doctest fences are never deleted.
- Exports are resolved from the file's export declarations, so `export { x }`, `export default x` and module headers count as public.
- No committed per-comment or per-file inventory (S31). Out-of-repo ledgers live under `~/.local/state/beep/comment-law/`.

## Acceptance Criteria

- [ ] A PR that adds a `//` comment or a JSDoc block on a non-exported declaration fails the hosted check with a message naming it; a PR that only moves a commented function passes.
- [ ] Replaying the last 100 main commits gives the expected verdicts with no false positive on a directive, licence or exported JSDoc.
- [ ] `/delete-comment` runs on one package end to end: census, two-vote classification, apply with an AST-identity proof, decision files written before deletion.
- [ ] `beep decisions check` resolves every `governs` anchor and rejects a source comment citing an id with no file.
- [ ] Agent guidance, law text and templates no longer instruct agents to write the banned classes.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/comment-law-gate/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/comment-law-gate/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/comment-law-gate` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add comment-law-gate --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug comment-law-gate`; add a `kind: decision` file there, never edit this block._

### Allow one decision-pointer comment for a hazard with no better home, 2026-11-22

The single allow-listed form is a line comment that is exactly 'decision: <slug>'. The slug names a file under the owning package decisions/ directory, and beep decisions check rejects a pointer with no file. It replaces free-text KEEP notes; anything else on the line makes it prose.

Lane goals/comment-law-gate

Reverse: Drop the decision-pointer kind from the grammar; such comments count as prose again.

### Ban free prose and local JSDoc through a merge-base growth check, 2026-11-22

Operator ruling, align round 2: agents may no longer add free prose or JSDoc on non-exported declarations in src, tests or tooling. Existing comments stay under a shrink-only pending list. Rejected: review-only enforcement, a repo-cli pilot first. Source: explorations/comment-law/DECISIONS.md.

Lane explore/comment-law

Reverse: Set the check advisory again and drop the AGENTS line.

### Count a leading JSDoc block above an import as the module header, 2026-11-22

The SPEC counts module headers as public. A file-header block before the first import, re-export or directive is a module header whether or not it carries @packageDocumentation; a leading block directly above a declaration still documents that declaration. Found by spot-checking local-JSDoc findings in the 100-commit replay: every miss was a header above an import.

Lane goals/comment-law-gate

Reverse: Require @packageDocumentation for jsdoc-module again in comment-grammar.ts.

### Exempt member JSDoc and live-tag blocks; ban local blocks that carry only since or category, 2026-11-22

Member JSDoc stays exempt until the exported-JSDoc law is ruled in jsdoc-lead-single-source. A local block carrying @internal, @public, @expected-unused, @ignore or @deprecated, or an import.meta.vitest fence, is a live suppression and exempt. A truly local block carrying only @since or @category feeds no tool once exports resolve through specifiers, so a new one is banned; the strip still never deletes a block carrying any tag tools read.

Lane goals/comment-law-gate

Reverse: Classify tag-only local blocks as jsdoc-tagged in comment-grammar.ts.

### Hazards and narration stay under the ratchet until absorbed, 2026-11-22

Operator ruling, align round 1: the 71% of comments outside the four categories are retained and shrink as names, types, test titles and assertions absorb them. A hazard with no better home keeps one allow-listed form. Source: explorations/comment-law/DECISIONS.md.

Lane explore/comment-law

Reverse: Treat retained hazards as banned and sweep them.

### Package decisions live one file each under <package>/decisions/, 2026-11-22

Operator ruling, align round 1: decision records that pass the admission test become <package>/decisions/<date>-<slug>.md with governs anchors checked by beep decisions check. Rejected: README tables, standards/decisions/, enforce-only. Source: explorations/comment-law/DECISIONS.md.

Lane explore/comment-law

Reverse: Move the files to the package README and restore the ADR-FORMAT text.

### Parse with oxc-parser so the scanner and the oxlint rule share one AST, 2026-11-22

oxc-parser 0.148.0 was already in the lockfile through @shadcn/lint; it is now a catalog entry and a @beep/repo-cli dependency. It gives the scanner the same ESTree shape the oxlint plugin sees, so one grammar and one attachment index serve both hosts. Measured on the whole tree: the oxlint rule and the scanner agree on all 57,854 findings in 4,511 files, zero differences. Rejected: ts-morph (2.5 to 3 times the CPU and a second attachment visitor), running oxlint on base blobs (honours disable comments, no AST-checked strip).

Lane goals/comment-law-gate

Reverse: Drop oxc-parser from the catalog and rebuild the scanner on ts-morph, keeping the grammar module.

### Seed 218 pending shards and lock every other scope, 2026-11-22

beep laws comments --write seeded one shard per package root holding a banned comment (218, one of them _root.jsonc for loose root files), each listing the whole root. Every other scope is locked at zero. The list may only shrink: a head scope outside every merge-base scope of the same root fails, and a scope emptied by a change must leave the list in that change. The seed carries no counts and no per-comment inventory (S31). The bootstrap PR is the one run whose merge base has no policy file, so it is the only one that skips the shrink-only guard.

Lane goals/comment-law-gate

Reverse: Delete standards/comment-law/pending and the lock half of beep laws comments; the growth check stands alone.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
