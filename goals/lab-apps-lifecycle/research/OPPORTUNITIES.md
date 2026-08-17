# Running opportunities ledger — lab-apps-lifecycle

Friction receipts captured while shipping P2. Status: `unowned` (nobody
decided), `queued` (in a locked decision), `spiked` (needs measurement first).
Numbers are STABLE IDS — never renumber to express priority.

## Receipts

1. **`delete-package` has no single-variant acceptance gate, so generator
   defects ship invisibly.** — `unowned`

   *Doing:* discharging SPEC Track B's "mints labs that pass `beep:check`,
   `beep:lint`, `beep:test` out of the box" for all three AppKinds.

   *Evidence:* the criterion was recorded as satisfied after measuring the
   Vite lab alone. Minting `nextjs-probe` and `service-probe` and running the
   three gates against each found **three of six failing** — nextjs `lint` 1,
   service `check` 1, service `lint` 1 — plus a fourth from Fallow's
   unused-export gate during delete. All four were generator defects. The Vite
   lab passed only because its tsconfig has no array long enough to trigger
   biome's formatting difference, i.e. the one variant that was measured was
   the one variant that could not have caught the bug.

   *Would have prevented it:* a `create-package --lab` acceptance lane that
   mints one throwaway lab per AppKind, runs check/lint/test, and deletes it —
   the thing done by hand here, on every PR that touches the templates.

2. **`delete-package` regenerates repo-wide baselines mid-delete and
   contaminates `standards/` with unrelated drift.** — `unowned`

   *Doing:* deleting the two throwaway probe labs to return the tree to clean.

   *Evidence:* both deletes rewrote `standards/jsdoc-documentation.inventory.jsonc`
   (`publicModules` 2510 → 2436, `publicExports` 16154 → 16088 — a *loss* of 74
   modules), `standards/schema-catalog.generated.jsonc` (162+/458−, dropping
   entries unrelated to any lab), and both fallow baselines. None of that drift
   is caused by removing a lab. Recovery was a manual `git checkout --
   standards/` and a re-run of the regeneration from a clean tree.

   *Would have prevented it:* scope the delete's baseline write to the deleted
   workspace, the way the coverage-baseline splice already has to be done by
   hand; or make `--skip-baselines` the default for lab deletes, since labs are
   excluded from the doc/coverage universes anyway.

3. **A baseline-write step fails the whole delete when an *unrelated* sibling
   workspace has a finding.** — `unowned`

   *Doing:* deleting `@beep/nextjs-probe` while `@beep/service-probe` still
   existed.

   *Evidence:* `fallow:dead-code:baseline:write` exited 1 on a finding in
   `apps/labs/service-probe/src/Api.ts:ApiGroup` — a different package — and
   the delete aborted with `Failed to apply registration geometry for
   @beep/nextjs-probe`. The directory was already gone, so the tree was left
   half-deleted: files removed, registration geometry unapplied.

   *Would have prevented it:* apply registration geometry before the baseline
   write, or make the baseline write non-fatal to the delete. A delete that
   removes files and then aborts leaves the repo in a state neither `--check`
   nor a re-run cleanly describes.

4. **Piped commands destroy `$?` and false-green verification scripts.** —
   `queued` (duplicate of `goals/speed-loop` #82, still unowned there)

   *Doing:* verifying the service lab's gates after the `ApiGroup` fix.

   *Evidence:* `bun run --filter @beep/service-probe check 2>&1 | tail -3;
   echo "SVC_CHECK=$?"` reports `tail`'s status, always 0. Three gates read as
   passing before the masking was noticed. The same shape had already produced
   a wrong `DEL_NEXT=0` earlier in the session, hiding a genuinely failed
   delete. speed-loop #82 records this class false-greening a publish twice.

   *Would have prevented it:* the `set -o pipefail` default in generated
   verification scripts, and the machine-parseable last line #82 asks for. This
   is the third independent recurrence across packets; it is cheap and it keeps
   costing real verification integrity.
