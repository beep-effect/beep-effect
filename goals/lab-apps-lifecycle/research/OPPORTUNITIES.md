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

5. **Two biome invocations in the same command resolve config differently, and
   only coincidence keeps them agreeing.** — `unowned`

   *Doing:* attributing a Coverage Regression on `TsconfigSync.plan.ts`, a file
   this branch never edited.

   *Evidence:* `renderBiomeJson`
   (`packages/tooling/library/repo-utils/src/schemas/BiomeJson.ts`) pins
   `--config-path=<findRepoRoot(moduleDir)>/biome.jsonc` — always the CLI's own
   repo. `formatGeneratedPackage` (`CreatePackage.command.ts`) instead runs
   `bunx biome check --write` with `cwd: repoRoot` and no `--config-path`,
   so it relies on ambient discovery. In production the two paths coincide and
   agree. In the test fixture, which scaffolds `package.json`, three
   `tsconfig*.json` and a syncpack config but no biome config, discovery finds
   nothing and biome falls back to its default `indentStyle: "tab"`. Generated
   JSON landed tab-indented while the canonical renderer emitted two spaces, so
   every `tsconfig-sync` docgen comparison reported drift: the already-canonical
   skip at `TsconfigSync.plan.ts:1002-1003` went from 9 hits to 0, which is
   exactly +1 uncovered line/statement/branch and reproduces all six reported
   percentages. Proven by A/B — HEAD gave 0 hits, HEAD minus the biome pass gave
   9.

   *Would have prevented it:* one config-resolution helper shared by both call
   sites, so a generated file is formatted by the same config that decides
   whether it is canonical. Fixed here by giving the fixtures a realistic
   `biome.json`, which is the narrower change; the asymmetry itself is still
   live, and any repo whose root differs from the CLI's checkout would hit it
   for real rather than only in tests.

   *Second-order:* the coverage this branch lost was **incidental** — a
   `tsconfig-sync` branch that only create-package tests ever reached. A ratchet
   on incidental coverage means an unrelated command's tests silently own
   another module's floor, so a correct change to one looks like a regression in
   the other. Worth deciding whether `tsconfig-sync` should cover that path
   directly.

6. **A generated artifact's real build was never run by any gate, so a
   non-compiling crate shipped undetected.** — `unowned`

   *Doing:* P3's tauri spike — minting a tauri lab and a non-lab tauri app and
   running every gate against each.

   *Evidence:* `create-package --app-kind tauri` emitted a `src-tauri` crate
   that fails `cargo check` with exit 101: `tauri::generate_context!()` opens
   `src-tauri/icons/icon.png` at macro-expansion time, and the template emitted
   `"icon": []` with no icons directory. Neither an empty icon array nor
   `bundle.active: false` avoids it; only a real PNG does (101 → 101 → 0). The
   defect predates this packet and applies to the non-lab AppKind too. It
   survived because `beep:check`, `beep:lint` and `beep:test` — the three gates
   the SPEC names, and everything the Labs lane runs — are tsgo, biome and
   vitest. Nothing anywhere compiles a generated crate, so all three were green
   against a package whose headline command (`dev:tauri`) panicked on first use.

   *Would have prevented it:* an acceptance lane that runs each AppKind's
   *native* build, not just its TypeScript gates — this is receipt 1's
   per-variant lane extended one step, from "does it typecheck" to "does the
   thing it generates actually build". Generalizes past tauri: any future kind
   whose output has a non-TS toolchain (wasm, native addons, protobuf codegen)
   inherits the same blind spot.

   *Second-order:* the gates a SPEC enumerates become the definition of
   correctness, and anything outside them is invisible regardless of how
   central it is to the artifact. The three-gate formula was written for
   TypeScript packages and silently carried over to a variant that is half
   Rust. Worth asking, when adding any AppKind, which of its failure modes the
   standard gate list cannot see.

7. **Binary generated files had no path through the generator at all.** —
   `queued` (addressed in P3; recorded for the general case)

   *Doing:* fixing receipt 6 by making the icon a generated file.

   *Evidence:* `create-package`'s entire pipeline was string-typed —
   `TemplateSpec` → Handlebars → `PlannedFile.content: S.String` →
   `writeFile(absolutePath, content: string)`. A PNG cannot survive that path;
   a string round-trip corrupts its high bytes. Adding one required a parallel
   verbatim-copy path (`StaticAssetSpec` → `PlannedAsset` → a `copy-asset`
   generation action) rather than a template entry.

   *Would have prevented it:* nothing — this is a legitimate capability gap
   rather than a mistake, recorded so the next binary artifact (favicons, fonts,
   signing certs, seed fixtures) reuses the asset path instead of rediscovering
   that templates are text-only. The new tests assert PNG signature bytes rather
   than file existence, because existence passes even when the bytes are
   mangled.

8. **A configured workstation cannot reproduce the coverage ratchet, because
   production code branches on environment the baseline was generated
   without.** — `unowned`

   *Doing:* running the coverage ratchet locally before publishing, precisely
   because `yeet verify` never runs `coverage` (the #742 lesson).

   *Evidence:* a full-package repo-cli coverage run reports
   `Quality/Tasks.ts` branches 64.48 → 63.63, uncovered 103 → 104, which is a
   genuine ratchet failure by the `fileMetricRegressed` rule. It is not
   introduced: **clean `main` with zero branch changes reproduces the identical
   numbers**, and #743's own Coverage Regression lane passed in CI. The cause is
   `resolveTurboCachePlan` (added by #743), which branches on `TURBO_API`,
   `TURBO_TOKEN`, `TURBO_TEAM` and `TURBO_CACHE`. All four are set on a
   remote-read-configured workstation; `check.yml` supplies them only on push
   events, so PR runs — and the baseline those runs generated — take the other
   branch. #743's own commit message names the hazard from the opposite side:
   those tests' "green was conditional on the machine being unconfigured".

   *Would have prevented it:* generating and comparing the baseline under a
   pinned environment, so the ratchet compares like with like — e.g. the
   coverage task clearing or fixing the turbo quad, the way a fixed
   `BEEP_FC_SEED` already makes the property lane environment-independent. As
   it stands the local ratchet check is only sound for files whose branches do
   not read configuration, and a developer cannot tell which those are without
   reading the source.

   *Second-order:* this is the mirror image of receipt 5. There, a *missing*
   fixture config made local behavior diverge from production; here a *present*
   workstation config makes local behavior diverge from CI. Both are the same
   underlying defect class — a gate whose result depends on ambient
   configuration that nobody declared — and both cost an attribution
   investigation before any code could be written.

9. **An unscoped `delete-package` takes longer than ten minutes and leaves
   `standards/` contaminated if interrupted.** — `unowned` (measured cost of
   receipt 2)

   *Doing:* P4's First Vertical Slice, running the delete *without*
   `--skip-baselines` deliberately, because the slice is supposed to prove the
   real delete including baseline regeneration.

   *Evidence:* the run exceeded a 600s ceiling and was killed mid
   baseline-regeneration, after two turbo waves of 16 and 17 tasks at ~2m59s
   each. The registration work had completed — `bun.lock` and the identity
   segment were already back at committed state and the tree was gone — but six
   `standards/` files were left rewritten by 23,007 insertions / 26,176
   deletions, a net loss of ~3,169 lines dominated by
   `jsdoc-documentation.inventory.jsonc`. None of it was probe removal: neither
   `HEAD` nor the working copy mentions `round-trip-probe` under `standards/`,
   because the probe was minted after `HEAD` and never entered a committed
   baseline. Recovery was `git checkout -- standards/`.

   *Would have prevented it:* receipt 2's fix — scope the delete's baseline
   write to the deleted workspace instead of regenerating repo-wide. Two
   additional properties this run makes concrete: the regeneration is not
   atomic, so an interrupted delete leaves partially-written baselines that look
   like authored edits; and for a lab it is entirely wasted work, since a
   package that never appeared in a committed baseline cannot be removed from
   one.

   *Second-order:* `--skip-baselines` is the flag every previous probe cycle in
   this packet reached for, which is why the cost stayed invisible until a phase
   deliberately declined it. A default that everyone overrides is not a default;
   it is a trap with a well-known workaround, and the workaround is exactly what
   stops the trap from ever being fixed.
