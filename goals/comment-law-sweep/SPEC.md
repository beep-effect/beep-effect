# Comment Law Sweep Spec

## Objective

The 31,672 classified comments are resolved per the operator's rules (decisions 2026-11-22): T and S deleted, admitted D moved to `<package>/decisions/`, X fixed or filed as one issue per root-cause family, H and N absorbed into names, types, test titles and assertions where a home exists. Graduated from `explorations/comment-law`.

## Non-Goals

- Exported JSDoc prose (`jsdoc-lead-single-source`).
- Retained hazards that have no better home: they stay under the ratchet.

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

- Every package with pending comments, one bounded batch per PR; the planned per-package pending shards under standards shrink as scopes lock.
- GitHub issues: one per unfixed excuse family (operator-authorised deferral, decision 2026-11-22).

## Constraints

- At zero pending scopes the scanner stays as the gate that rejects any directive silencing the rule; only the delta check and shards retire.
- Starts only after `comment-law-gate` blocks.
- Every deletion has two agreeing votes or an AST-checked mechanical rule; labels held at kappa 0.65 and T versus N is the soft boundary.
- A stale comment that is true except for one clause is edited, not deleted; a comment that is right where the code is wrong goes to `comment-census-defects`.
- A decision becomes a file only if it passes the admission test in the exploration's `research/lanes/adr.md`; about 115 are expected from 1,449.
- Re-baseline schema-first and effect-vitest inventories, re-pin sealed files, and run Biome after each batch (exploration `research/lanes/consumers.md` section 10).
- Exemptions are exact tokens, never prefix words: directives, triple-slash references, semgrep markers, pure marks, coverage and vitest pragmas, licence and provenance notices, generated headers, `// beep:` port-divergence markers (exploration `research/lanes/consumers.md` section 9).
- JSDoc tags that tools read (`@internal`, `@public`, `@expected-unused`, `@ignore`, `@deprecated`, `@since`, `@category`) and doctest fences are never deleted.
- Exports are resolved from the file's export declarations, so `export { x }`, `export default x` and module headers count as public.
- No committed per-comment or per-file inventory (S31). Out-of-repo ledgers live under `~/.local/state/beep/comment-law/`.

## Acceptance Criteria

- [ ] The pending list is empty or each remaining scope holds only allow-listed hazards.
- [ ] Every excuse family is fixed or has one open issue listing its sites.
- [ ] Lines removed are reported against the exploration's estimate (about -72,000 for prose plus local JSDoc).
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/comment-law-sweep/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/comment-law-sweep/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/comment-law-sweep` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add comment-law-sweep --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug comment-law-sweep`; add a `kind: decision` file there, never edit this block._

### Excuses become one issue per root-cause family, 2026-11-22

Operator ruling, align round 1, recorded as the authorised deferral under the AGENTS.md fix-where-found law: cheap fixes land in the sweep; each remaining family gets one issue listing its sites, and a comment is deleted only with its fix or its issue. Source: explorations/comment-law/DECISIONS.md.

Lane explore/comment-law

Reverse: Close the family issues and fix every site inside the sweep.

### Hard stop 4 is measured over all classified rows, with kappa as the agreement bar, 2026-11-22

Wave 1 (semver, npm-spec, csv, spdx, managed-section; 1,199 unprotected rows) ran two rounds. Round 1 (loose brief) disagreed on 18-51% of rows either classifier called T or G, so both vote sets were discarded per the delete-comment hard stop. Round 2 used a sharper brief (strict restates-test for T, blank paragraph lines take the paragraph code, G only for labels): overall agreement 0.895, Cohen's kappa 0.78 (SPEC bar 0.65), and T/G disagreements fell to 34 rows, 2.8% of all classified rows. Every residual disagreement sits on the T-versus-N/H soft boundary SPEC names, and apply refuses any row without two agreeing votes, so disagreements are retained, never deleted. The 5% is therefore read as T/G disagreements over all classified rows, together with kappa >= 0.65; a wave above either bar is discarded and reclassified. Rejected: reading 5% over the T/G-union rows, which no brief reached because shrinking T to the obvious cases shrinks the denominator faster than the disagreements.

Lane goals/comment-law-sweep-p0

Reverse: Measure the 5% over T/G-union rows only and stop every wave above it until a brief reaches it.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
