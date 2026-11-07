# Friction receipts

## 2026-11-06: Biome rewrote a byte-exact golden snapshot

- Doing: capturing the pre-change `fleet --json` fixture snapshot with
  `toMatchFileSnapshot` before changing discovery.
- Evidence: the lefthook pre-commit `biome` step reported `Fixed 1 file` on
  `test/fixtures/fleet-roots/roots-unset.json`; the next run failed with
  `"livenessEvidence": ["worktree-mtime"]` vs the multi-line form, identical data.
- Prevention: keep golden snapshots out of the formatter (an ignore entry or a
  non-JSON extension); the packet now uses `roots-unset.snapshot.txt`.

## 2026-11-06: `yeet publish` stopped on an inherited red after committing

- Doing: publishing #2852, a two-file fleet fix.
- Evidence: cheap-gates `lint:effect-vitest` red on
  `packages/law-practice/domain/test/CitationBluebook.test.ts` (from #2737,
  owned by #2849); "failed after creating the local commit; nothing was pushed".
- Prevention: classify cheap-gate reds outside the diff as inherited and open
  the draft anyway, or check before committing.
