# GOAL — JSDoc Legacy Carrier Migration

Retire the legacy `@example` / `@remarks` carriers repo-wide. Read `SPEC.md` before acting; it is
binding. `research/corpus-census.md` has every number and how to reproduce it.

## The problem in one paragraph

`Check / JSDoc Ratchet` fails on most source-touching PRs. The totals ratchet is fine
(`increased=0`); `enforceTouchedFileCleanup` in
`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocRatchet.ts` is what exits 1. It
rejects any changed non-generated `packages/**/src/**/*.{ts,tsx}` file containing `@example` or
`@remarks` anywhere in the file — not the diff hunk. 1,965 of 2,553 source files (77%) contain
one. The JSDoc law is agent-facing, so the same corpus also teaches agents the forbidden pattern.

## Scope

Carrier retirement only. Prose and example code are preserved **verbatim**. This is not a
documentation quality rewrite — do not improve lead descriptions or make examples observable.

Included beyond the carrier swap: deterministic grammar fixes (`@template`→`@typeParam`,
`@module`→`@packageDocumentation`, `@default`→`@defaultValue`, `{type}` blob removal,
`@returns`/`@throws` hyphen, canonical tag order), lead-paragraph splitting, `@see` purpose
phrases, generator templates, the gate swap, the baseline rewrite.

## Phases

- **P0** docs-only PR: fix `.patterns/jsdoc-documentation.md:54-68`. It currently calls legacy
  tags "grandfathered", claims the per-file check is future work (it shipped), and at `:58`
  forbids mass migration outright — which makes P3 illegal until this lands.
- **P1** own PR: `beep quality jsdoc-migrate` (`extract` / `titles` / `apply` / `verify`) in
  `commands/Quality/internal/`. ts-morph for analysis, **text-surgical rewrite by byte offset**.
- **P2** own PR: fix the 9 repo-owned generators behind the 18 generated files, then regenerate.
- **P3** mega-PR: run the migration, swap the gate to a repo-wide zero-legacy check, rewrite
  `standards/jsdoc-totals.regression-baseline.jsonc`, delete the law's transitional section.
- **P4** close: reflection + manifest flip, same PR as P3.

## Non-negotiable invariants

1. **The P3 branch is regenerated, never rebased.** It must remain
   `f(main, codemod, titles.jsonl, overrides.jsonl)`. Zero hand-edits. Residue goes in
   `overrides.jsonl`.
2. **Conservation law per block, exhaustive, no sampling.** Code bytes and tag bodies identical;
   prose tokens a subset of output; the only permitted additions are `**Details**`, `**Gotchas**`,
   and `**Example** (<title>)`. Violations quarantine rather than write. A fence is a third
   addition, so the 114 unfenced examples auto-quarantine — that is correct behaviour.
3. **Compute conservation on post-format bytes.** Biome first, then verify.
4. **Grok returns data only, never writes files.** Reach it at `http://127.0.0.1:8317` with model
   `grok-4.5` — that is what bills the Grok plan rather than API credits. Not a Workflow: the
   1,000-agent cap is below the 1,965 files.
5. **Anchors are `path#symbol`**, never content hashes. Anchor stability is what makes P3
   re-derivable.

## Two facts that de-risk this

`docgen/src/Core.ts:360-376` compiles **both** carriers, so tag→section conversion is
compile-neutral — the legacy examples are already under the TypeScript gate.

`documentationShapeViolations` (`JSDocDocumentationInventory.ts:439`, module-private) is the exact
function the gate scores with. Use it as the per-block pre/post acceptance oracle: accept a
rewrite only when the finding set shrinks or stays equal.

## Do not

Rebase P3. Hand-edit the P3 branch. Let ts-morph reformat blocks. Let Grok write files. Migrate
generated output without fixing its generator. Use the xAI API directly. Sample instead of
proving conservation.
