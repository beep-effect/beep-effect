# PLAN — JSDoc Legacy Carrier Migration

Five phases, four PRs. Ordering is load-bearing: P0 legalises P3, P1 builds what P3 runs, and
P2 keeps P3 from planting a codegen mine.

## P0 — Law + packet (docs-only PR)

Rewrite `.patterns/jsdoc-documentation.md:54-68`:

- delete the stale Phase-P2 / "until then" claim (that check shipped);
- replace "grandfathered" with the actual enforcement semantics — a legacy carrier in a changed
  file is a hard CI failure today;
- **authorize the one-time mass migration**, removing the `:58` prohibition that currently makes
  P3 illegal;
- state the post-migration target so P3's final flip executes written law rather than
  retroactively justifying itself.

Land this packet in the same PR. Docs-only, no source touched, so the cleanup-on-touch gate is
not provoked.

**Exit.** The law no longer contradicts the gate or `AGENTS.md`, and explicitly permits P3.

## P1 — Codemod (own PR, the real review target)

Ship `beep quality jsdoc-migrate` with `extract`, `titles`, `apply`, `verify` in
`packages/tooling/tool/cli/src/commands/Quality/internal/`.

1. Export `documentationShapeViolations` within the package.
2. `extract` — ts-morph walks the corpus, emits one `extract.jsonl` record per affected block
   with `path#symbol#ordinal` anchor, symbol kind, lead, and fence bodies. Fail loudly on any
   duplicate anchor — `path#symbol` alone collides on overloads, merged declarations, default
   exports, and same-name type companions for runtime schemas.
3. Both clauses of the conservation law and the quarantine path (SPEC §5.3) — content conservation
   plus the closed tag-rewrite allowlist — with the schema-versioned proof manifest.
4. `apply` — text-surgical rewrite by byte offset. Never let ts-morph reformat a block.
5. `titles` — `effect/unstable/http` against `http://127.0.0.1:8317`, model `grok-4.5`,
   append-only with per-anchor resume and retry only on schema-invalid returns.
6. Fixture corpus covering every block shape the codemod recognises, including the pathological
   ones: unfenced example, multi-example block, `@remarks` + `@example`, multi-paragraph lead.

**Exit.** A full-corpus dry run reports the real residue count. Until this number exists, the
P3 zero claim is not committable.

## P2 — Generator templates (own PR)

Update the 9 repo-owned emitters behind the 18 generated files so they emit `**Example** (Title)`
sections; mechanical titles are acceptable in generated output. Then regenerate.

Targets: `drivers/{box,acp,runpod,ecfr,gov-legal-mcp}`, `foundation/modeling/{rdf,html}`,
`foundation/primitive/data`, `tooling/library/ai-sync`.

Lands before P3 so P3 touches hand-authored code only, and so no future `bun run generate`
reverts the migration and fails the ratchet for an author who merely regenerated a driver.

**Exit.** Regenerating any of the 18 files produces law-compliant output.

## P3 — Migration mega-PR

1. Run `titles` over all 13,265 blocks. Freeze `titles.jsonl`.
2. Run `apply`. Resolve every quarantined block into `overrides.jsonl`. Re-run until residue is
   zero. **No hand-edits on the branch, ever.**
3. Run `verify`. Land the proof manifest.
4. Atomically in the same PR:
   - swap `cleanup-on-touch` for a repo-wide zero-legacy check (no git-diff work needed once the
     corpus is zero, and it cannot be evaded);
   - rewrite `standards/jsdoc-totals.regression-baseline.jsonc` to the new floor;
   - delete the `.patterns/jsdoc-documentation.md` transitional carrier section — it has no
     remaining subjects.
5. Regenerate the docgen proof manifest.

**Never rebased.** On conflict or main drift: re-run the codemod against fresh `main` with the
frozen data files and replace the branch wholesale.

**Exit.** SPEC §6 definition of done, all seven items.

## P4 — Close

Reflection under `history/reflections/`, manifest flipped to `completed-retained`, in the same
PR as the final work per the repo's same-PR packet-state-flip law.

## Rejected alternatives

Recorded in `research/decisions-locked.md` with rationale. In brief: full quality rewrite
(scope explosion, every example re-enters the compile gate as new code); per-family PR sequence
(~10 merge gauntlets, gate stays hot until the last one); stacked PRs (a non-`main` base runs
~4 checks instead of the required set); Grok agents editing files directly (a hallucinated
rewrite silently destroys documentation); migrating generated output without fixing generators
(reverts on next codegen); direct xAI API (bills credits, not the plan).
