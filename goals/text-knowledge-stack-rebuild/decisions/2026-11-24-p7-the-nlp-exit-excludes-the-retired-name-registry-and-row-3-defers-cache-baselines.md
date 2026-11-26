---
title: "P7: the lexical nlp exit excludes the retired-name registry, and row 3 also excludes the cache baselines that row 7 re-stamps"
date: 2026-11-24
lane: "p7"
reversal: "Drop the nlp row from standards/changesets.retired-packages.json and run the unscoped PLAN exit, accepting an unguarded name"
---

The PLAN P7 exit `rg -l '@beep/nlp["/]' packages apps standards tsconfig.json` (`PLAN.md:31`) searches `standards/`, unlike the P2 and schema-org exits, which search only `packages apps`. Row 3 adds the name-reuse guard row for the nlp package to `standards/changesets.retired-packages.json`, in the shape of the `@beep/provenance` row (`:39-42`), and its `"name": "@beep/nlp",` line matches the `@beep/nlp"` alternative. As written, row 3's gate and the P7 exit could never both pass.

The exit is scoped to live files: `rg -l '@beep/nlp["/]' packages apps standards tsconfig.json --glob '!standards/changesets.retired-packages.json'`. The registry is a historical record that the delete-package doctor already reads as history (`packages/tooling/tool/cli/src/commands/DeletePackage/internal/RegistrationGeometry/RegistrationGeometry.plan.ts:59-61`); `rg` cannot know that. Row 6 rewords the PLAN P7 exit (authored text) and writes the scoped command into the census P7 outcome. `standards/architecture/DECISIONS.md` is not excluded: the row-5 landing entry spells the name only as `` `@beep/nlp` ``, never as `"@beep/nlp"` or `@beep/nlp/...`, so the exit stays empty without a second exclusion.

Row 3 also excludes `standards/cache-baseline/**`. `standards/cache-baseline/@beep/nlp.json:3` matches the exit today, `delete-package` has no cache-baseline step (`rg -n cache-baseline packages/tooling/tool/cli/src/commands/DeletePackage` is empty), and the file is dropped only by row 7's `bun run beep cache baseline` (decision `2026-11-22-p2-cache-request-names-the-retired-package-in-previous-only`). Row 7 runs the full scoped exit. The apply gate of rows 1 and 3 copies P2's shape (`research/2026-11-20-p2-design.md:379-382`): exit 0, or "post-apply doctor found residue" with a residue list that is a subset of `standards/cache-baseline/` and `standards/policy-tools.fingerprint.json`; the fingerprint is rewritten after the apply in the same row.

Dropping the nlp registry row instead was rejected: name reuse would then be unguarded.
