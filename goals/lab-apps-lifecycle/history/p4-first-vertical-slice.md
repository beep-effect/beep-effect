# P4 — First Vertical Slice round-trip (2026-08-17)

The SPEC's smallest honest proof of the whole packet, executed live on
`main` at `bd577ed8bc`: scaffold a throwaway vite lab, typecheck it, serve it
through portless, delete it, and prove doctor green with a clean tree.

Every line below is measured output, not a restatement of intent.

## 1. Scaffold

```
bun run beep create-package round-trip-probe --type app --app-kind vite --lab \
  --description "Throwaway P4 First Vertical Slice probe: scaffold, serve, delete."
```

Exit 0. **D5 zero-root-churn holds**: the entire footprint outside the lab tree
was two files.

```
 M bun.lock
 M packages/foundation/modeling/identity/src/packages.ts
?? apps/labs/round-trip-probe/
```

Root `package.json`, `tsconfig.json`, `syncpack.config.ts`, `vitest.config.ts`
and `.changeset/config.json` were untouched — create-package reported the
workspace entry as already covered by the `apps/labs/*` glob, and the only
registration edit was inside the fenced generated labs identity segment.

## 2. Gates

| gate | exit | evidence |
| --- | --- | --- |
| `beep:check` | 0 | tsgo clean |
| `beep:lint` | 0 | `Checked 12 files in 1140ms. No fixes applied.` |
| `beep:test` | 0 | `Tests 1 passed (1)` |
| `beep:build` | 0 | `✓ built in 226ms` (190.41 kB js / 183.87 kB css) |

## 3. Portless serve — the leg P4 exists to prove

`bun run dev` in the lab workspace. Portless assigned the port and the route:

```
Running: PORT=4262 HOST=127.0.0.1 \
  PORTLESS_URL=https://round-trip-probe.labs.beep.localhost:1355
VITE v8.2.1  ready in 78 ms
```

The `.labs.beep` hostname segment is the D1 requirement, derived from the same
`portlessLabel` the `dev` script is built from. Probing the route (not the raw
port — the raw port is an implementation detail portless chose):

| request | status | bytes |
| --- | --- | --- |
| `GET /` | 200 | 564 |
| `GET /src/main.tsx` | 200 | 1939 |
| `GET /src/App.tsx` | 200 | 2485 |

The document served is unmistakably this lab rather than a bare proxy 200 —
`<title>@beep/round-trip-probe</title>`, the vite HMR client, and
`<script type="module" src="/src/main.tsx">`. The module graph resolves through
the route as well: the transformed `App.tsx` carries
`_jsxFileName = ".../apps/labs/round-trip-probe/src/App.tsx"`, proving vite
compiled the lab's own TSX behind the proxy.

The shared portless proxy was left running; only the lab's dev process was
stopped.

## 4. Delete

```
bun run beep delete-package @beep/round-trip-probe --check   # exit 0, plan printed
bun run beep delete-package @beep/round-trip-probe           # full run, no --skip-baselines
```

Dependents cascade was empty (`direct: (none)`, `transitive: (none)`), so the
leaf-only guard admitted the target. The delete removed the tree — including
the 372K `dist/` and 2.5M `node_modules/` the build and install had created,
which are gitignored and therefore invisible to `git status` — pruned the
generated identity segment, and refreshed the lockfile.

**The full delete exceeded 600s and was killed at that ceiling** mid
baseline-regeneration. See the friction receipt; this is the measured cost of
receipt 2's class, not a new failure. The registration work had already
completed by then: `bun.lock` and `packages/foundation/modeling/identity/src/packages.ts`
were both back at their committed state, and the probe directory was gone.
What remained was regenerated-baseline drift under `standards/`, reverted with
`git checkout -- standards/`.

That drift was **not** probe removal. Neither `HEAD` nor the working copy
mentions `round-trip-probe` anywhere under `standards/` — the probe was minted
after `HEAD` and never appeared in a committed baseline — yet the regeneration
rewrote six files by 23,007 insertions / 26,176 deletions, a net loss of ~3,169
lines dominated by `jsdoc-documentation.inventory.jsonc`.

### 4b. Re-measured after PR review — the default path *fails*

Review of PR #756 correctly objected that the section above proved a phase on a
delete that never finished. Re-run with no timeout ceiling, the default command
**exited 1 on its own after 718s**:

| run | outcome | `standards/` drift |
| --- | --- | --- |
| 1 (600s ceiling) | killed mid-regeneration | 6 files, +23,007 / −26,176 |
| 2 (no ceiling) | **exited 1 after 718s** | 7 files, +23,304 / −26,354 |

Two conclusions, both replacing weaker claims made above:

1. **The drift is deterministic**, not interrupt damage — the two runs match to
   within a few dozen lines.
2. **The failure is structural, not duration.** The `coverage-baseline` rebuild
   runs the repo-wide coverage suite; a pre-existing unrelated test fails there
   (`@beep/wink` — `corpus "missing-corpus" does not exist`, reproducible with
   no delete in play) and fails the delete. Deleting one leaf package is
   coupled to every other package's tests passing, and the registration work
   completes first, so the command destroys and then reports failure.

A third finding came from attempting the re-run at all: `delete-package` now
refuses with `REFUSE [packet-claim/soft]` because six lines of *this file* name
the probe. Recording the proof makes the proof unrepeatable (ledger receipt 11).

## 5. Doctor

```
bun run beep delete-package @beep/round-trip-probe --check
```

With the target no longer resolving to a live workspace this runs the
deleted-target residue probe. Exit 0:

```
[delete-package --check] clean: no registration residue remains for the deleted target.
```

`git status` is empty. The only surviving occurrences of the probe name in the
tree are in `SPEC.md`, where the slice itself is specified.

## Verdict

**The slice passes on the SPEC's stated bar, with baseline regeneration
excluded from the proof.** Glob membership, identity add/remove, tsconfig-sync
reconstruction, lockfile refresh, the portless labs route, and residue
detection were each exercised in one loop and each produced evidence; the
deleted-target doctor is green and the tree is clean.

Read that scope precisely, because §4b narrows it:

- **Proven:** the delete's registration work with `--skip-baselines`
  semantics, plus doctor and a clean tree.
- **Not proven, and currently unprovable:** full baseline regeneration. A2's
  regenerated-baselines clause is waived for lab targets — see `SPEC.md`'s
  evidence table, which says so explicitly.

The defect the loop surfaced is **structural, not operational**. An earlier
draft of this file called it "slower than a ten-minute ceiling"; that was
wrong, and PR review caught it. The default `delete-package` cannot complete on
a tree with any failing test anywhere, because its baseline step runs the
repo-wide coverage suite — and it removes the package before discovering that.
Tracked as ledger receipt 9, with receipts 3 (half-deleted state) and 11
(evidence blocks re-proof) adjacent.
