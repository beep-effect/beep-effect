# Brief

## Problem

The operator asked whether this repo's comments are useless, stale, or cover for bad decisions, and whether
the JSDoc system holds up. The census answers it: in non-exported code 18% are tautologies, about 1% stale
and under 1% excuses, while 71% carry hazards or narration. The useless mass is in exported JSDoc, where the
law requires a lead and 60% of sampled leads repeat the code or the schema annotation beside them. Main also
adds about 375 prose comments a day, so nothing improves without an inflow check, and the census surfaced
real defects hidden under comments.

## Appetite

Four goals. The growth check and the defect fixes are small (a week each). The sweep is a burn-down that runs
in batches at three open PRs. The JSDoc lead change is one law change plus its tooling.

## Solution Sketch

- **Growth check.** One oxc-based scanner with an exact-token exemption grammar. A path-free fingerprint
  multiset compared against the merge base fails any PR that adds banned comments. A tree-only lock keeps clean
  packages clean, and a shrink-only pending list holds the rest (one small shard per package, no inventory of
  comments). An oxlint rule gives editor feedback. The scanner rejects any disable directive. Advisory first,
  blocking once the AGENTS line and templates change.
- **`/delete-comment` skill.** A ledger-driven loop: census, classify, two-vote verify, apply with an AST proof,
  ratchet. It reuses the rubric in `research/rubric.md`, refuses directives, tags and doctest fences, and writes
  the decision file or family issue before it deletes.
- **Decisions home.** `<package>/decisions/<date>-<slug>.md` with `governs` anchors, `beep decisions check`
  and `beep decisions for <path>`, and amended `ADR-FORMAT.md` and `grill-with-docs` text.
- **Sweep.** Per batch: delete T and S (edit the stale clause when the rest is true), move admitted D to
  decisions, fix cheap X families and open one issue for each remaining family, absorb H and N into names,
  types, test titles and assertions where the classifier named a home.
- **JSDoc leads.** Docgen and the JSDoc inventory read the `$I.annote*` description as the lead where a block has
  none. Type-level companions and barrels stop needing a lead. A lint flags a lead that restates its annotation.
- **Defects.** The census defects fixed as small PRs.

## Rabbit Holes

- Classification is not deletion-grade alone: kappa 0.65, and T versus N is the soft boundary. Every deletion
  needs two votes or an AST-checked mechanical rule.
- `@internal`, `@public` and `@expected-unused` are live suppressions; deleting one adds fallow findings and
  docgen `@since` demands.
- Exports through `export { x }` and module headers look local; the scanner must resolve exports from the
  source file's export declarations.
- AST identity misses JSX text whitespace, tests that read source text, line-keyed inventories (schema-first,
  effect-vitest) and sha-sealed files.
- Templates, generators and law text re-create comments unless they change first.
- An S11 merge launders a violation into the next merge base; the tree lock covers that for clean scopes.
- The `KEEP (D-nn)` waivers need a single suppression form before they are counted.

## No-Gos

- No deletion before the growth check is live.
- No deletion of directives, licences, tags tools read, doctest fences or Examples.
- No committed per-comment or per-file inventory (S31).
- No Biome GritQL host for the ban; it cannot see comments.
- No ban on non-TypeScript files in this round.
- No auto-fix that deletes comments unread.
