# P1 Track A live round-trip proof (2026-08-16)

The SPEC Track A acceptance box "Deleting a freshly minted zero-consumer
package leaves..." executed live on branch
`docs/lab-apps-lifecycle-p1-status-flip` (base `4b8bd76c2b`, main with
PR #723 merged), after review correctly flagged that deferring it to P4's
Track B lab slice did not satisfy the Track A criterion.

## Round trip

```sh
bun run beep create-package delete-probe --type library --family drivers \
  --description "Throwaway zero-consumer package proving the Track A delete round-trip"
bun run beep delete-package delete-probe --skip-baselines
# -> [delete-package] complete: @beep/delete-probe removed with zero declared residue.
# -> exit 0
```

Create registered every surface (workspace row, `$DeleteProbeId` composer +
export, lockfile, syncpack source, two root aliases, root project
reference); delete inverted all of them through the geometry plan and the
post-apply doctor confirmed zero declared residue.

## Bug found and fixed by this proof

The first delete run failed its own post-apply doctor: the
pending-changeset probe matched the command's own `{}` deletion note
(`.changeset/delete-delete-probe.md`) as residue, because the note's body
names the package. The acceptance box requires that note to exist, so the
doctor was contradicting the design. Fixed in
`RegistrationGeometry.probes.ts`: the canonical `delete-<slug>.md` note is
exempt from the pending-changeset residue scan; every OTHER pending
changeset naming the package still reports (regression assertions added to
the synthetic #680 fixture test — the orphan changeset stays residue, the
deletion note does not).

## Verify battery (all green post-delete)

| Check | Result |
| --- | --- |
| `test ! -d packages/drivers/delete-probe` | absent |
| `beep tsconfig-sync --check` | no drift detected |
| `beep lint identity-registry` | OK: 130 workspace packages registered; no orphan or local root composers |
| `beep quality changeset-graph` | workspace_packages=130 changeset_files=417 references=1005 missing_references=0 |
| `beep fallow boundaries --check` | doctrine-pinned layer-legality checks passed |
| exact-name `rg "delete-probe"` over package.json, bun.lock, tsconfig.json, tsconfig.packages.json, syncpack.config.ts, knip.jsonc, turbo.json, lefthook.yml, identity `packages.ts`, `standards/*.jsonc` | zero hits |
| `git status` | only the intentional artifacts (probe fix, regression test, `{}` deletion changeset) |

## Baseline regeneration (phase 9 writers, run live post-delete)

Review correctly noted `--skip-baselines` left the regeneration outcome
unproven. Every writer `runBaselineWriters` invokes was then executed
against the post-delete tree (identical state to an in-command phase 9):

| Writer | Exit |
| --- | --- |
| `beep fallow boundaries --write` | 0 |
| `bun run fallow:health:baseline:write` | 1 — baseline WRITTEN (tightened, 75 rows pruned from main-drift), but the health run exits non-zero while pre-existing findings remain |
| `bun run fallow:dead-code:baseline:write` | 0 |
| `beep quality jsdoc-inventory` | 0 |
| `beep lint schema-first --write` | 0 |
| `beep lint package-test-typecheck --write-baseline` | 0 |
| `beep lint schema-catalog --write` | 0 |
| `beep quality knip --write-baseline` | 0 |
| `beep coverage -- --affected --write-baseline` (scoped; full run blocked by the machine-local shard flake, CI runs the full lane) | 0 |

Post-regeneration `rg "delete-probe" standards/` is empty: no baseline ever
admitted the probe, and regeneration leaves them probe-free. The refreshed
baselines (main-drift catch-up the writers produced) ship with this PR.

**Known follow-up:** the `fallow:health:baseline:write` finding-based exit 1
means an un-skipped `delete-package` would fail its phase 9 at that step on
any tree with pre-existing health findings, even though the baseline write
succeeds. `runBaselineWriters` should tolerate that writer's finding exit
(or invoke it in a write-only mode) — small fix for the next repo-cli PR.

## Notes

- `--skip-baselines` was used because the full local
  `coverage:baseline:write` is blocked by a machine-local repo-utils
  coverage-shard flake (documented in `p1-implementation-notes.md`). The
  probe never entered any committed baseline (created and deleted within
  one uncommitted session), so there was nothing to prune — proven by the
  zero-hit sweep over `standards/*.jsonc`.
- The emitted `{}` deletion changeset read exactly:
  `---` / `{}` / `---` / blank /
  ``No release: remove `@beep/delete-probe` from the workspace.``
  It was removed rather than committed: the probe never existed on any
  branch history, so a permanent no-op release note would be noise. For
  real deletions the note ships with the PR per `research/05` §5.2.
