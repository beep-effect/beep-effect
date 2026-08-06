# GOAL — JSDoc Legacy Carrier Migration

Retire the legacy `@example` / `@remarks` carriers repo-wide. `SPEC.md` is binding — read it
first. `research/corpus-census.md` has every count and how to reproduce it.

## The problem

`Check / JSDoc Ratchet` fails on most source-touching PRs. The totals ratchet is fine
(`increased=0`); `enforceTouchedFileCleanup` in `commands/Quality/internal/JSDocRatchet.ts` exits
1. It rejects any changed non-generated `packages/**/src` file containing a legacy carrier
anywhere in the file — not the diff hunk. 1,935 of 2,565 source files (75%) contain one.
The law is agent-facing, so the corpus also teaches agents the forbidden pattern.

## Scope

Carrier retirement only. Prose and example code are preserved **verbatim** — not a quality
rewrite, so do not improve leads or make examples observable. Beyond the swap: the grammar fixes
in SPEC §5.3(b), lead splitting, `@see` purpose phrases, generator templates, the gate swap, the
baseline rewrite.

## Phases

- **P0** docs-only PR: fixed `.patterns/jsdoc-documentation.md`, which called legacy tags
  "grandfathered", mis-stated the gate, and forbade the mass migration P3 requires.
- **P1** own PR: `beep quality jsdoc-migrate` (`extract`/`titles`/`apply`/`verify`) in
  `commands/Quality/internal/`. ts-morph analyses; the **rewrite is text-surgical by byte offset**.
- **P2** own PR: fix the 9 repo-owned generators behind the 18 generated files; regenerate.
- **P3** mega-PR: run the migration, swap the gate to a repo-wide zero-legacy check, rewrite the
  totals baseline, delete the law's transitional section.
- **P4** close: reflection + manifest flip, same PR as P3.

## Non-negotiable invariants

1. **P3 is regenerated, never rebased.** It must remain
   `f(main, codemod, titles.jsonl, overrides.jsonl)`. Zero hand-edits; residue goes in
   `overrides.jsonl`.
2. **Conservation has two clauses (SPEC §5.3).** (a) Content: fence code
   bytes identical, prose tokens preserved, added prose limited to section markers and
   data-sourced strings from `titles.jsonl`. (b) Tags: only SPEC's closed allowlist may be
   rewritten; every other tag is bytes-identical and every rewrite must match its normal form.
   Violations quarantine. Adding a fence is in neither clause, so the 114 unfenced examples
   auto-quarantine — correct behaviour. Do **not** collapse this to "tag bodies identical"; that
   contradicts the in-scope grammar fixes and would quarantine every free win.
3. **Compute conservation on post-format bytes.** Biome first, then verify.
4. **Grok returns data only, never writes files.** Reach it at `http://127.0.0.1:8317` with model
   `grok-4.5` — that bills the Grok plan, not API credits. Not a Workflow: the 1,000-agent cap is
   below the 1,935 files.
5. **Anchors are `path#symbol#ordinal`** — never content hashes, never line numbers.
   `path#symbol` alone collides on overloads, declaration merging, default exports, and same-name
   type companions for runtime schemas (documented law). `ordinal` is the 0-based index among
   blocks sharing an anchor, in source order. `extract` must fail loudly on a duplicate: a title
   applied to the wrong block is well-formed, and conservation cannot catch it.
6. **Generated-output compliance needs its own check scope** — re-running the non-generated one
   passes vacuously.

## Two de-risking facts

`docgen/src/Core.ts:360-376` compiles **both** carriers, so tag→section conversion is
compile-neutral — the legacy examples already sit under the TypeScript gate.

`documentationShapeViolations` (`JSDocDocumentationInventory.ts:439`, module-private) is the exact
function the gate scores with. Use it as the per-block pre/post oracle: accept a rewrite only if
the finding set shrinks or holds.

## Do not

Rebase P3. Hand-edit that branch. Let ts-morph reformat blocks. Let Grok write files. Migrate
generated output without fixing its generator. Use the xAI API directly. Sample instead of
proving conservation.
