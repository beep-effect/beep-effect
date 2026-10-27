# Gates, the full proof, and plan mode

Read when a cheap gate is red, when you want to reproduce a hosted red locally with the full proof, or before a long run you want to inspect first. Part of the yeet skill.

## Gates: cheap-gates before the push, hosted CI after

Since 2026-10-05 (push-first-publish D1–D2) `yeet publish` gates the push on
the cheap-gates tier and the head-install preflight only; hosted CI is the
authoritative proof, and `bun run beep yeet verify` (full tier) is an
on-demand tool for iterating on a red hosted lane locally, never an automatic
publish step. The full tier's first step still runs the cheap-gates tier. This tier runs 23 deterministic gates in
collected waves, including config sync, tsgo rule parity, Effect imports,
schema-first, goals checks, Fallow, publish-enabled changeset status, and the JSDoc
ratchets against both the committed inventory and a fresh scan of current source.
It also runs `beep lint schema-catalog` and root `lint:oxlint`, matching the
hosted catalog and inline-schema-compilation policy checks. The fresh scan runs
`beep quality jsdoc-ratchet --regenerate`: JSONC and Markdown go only under
`.beep/ci/`, and generation must succeed before the ratchet compares totals.
The tracked standards inventory and regression baseline are never rewritten.
The schema catalog runs alone in the `heavy` scheduling wave within this
cheap tier, after parallel preflight: a full scan needs roughly 12.6 GiB RSS
and 24 seconds. It has no package-scoped check; use a 16 GiB runner envelope.
The collector reports every failure before the full build, package checks,
tests, or docgen lanes start. `yeet repair` applies its
deterministic fixers, runs the same collected tier, and stops before heavy
feedback if a cheap gate still fails. The fixers end by regenerating the
git-ignored local projections (`goals/INDEX.md`, `explorations/ATLAS.md`, and
the generated README status regions). `goals:index-check` and
`explore:atlas-check` refresh a stale ignored copy left behind by a pull in
place (hosted lanes never carry those files, so that red was always
local-only); drift in the tracked README status regions still fails
`explore:atlas-check`.

The full proof (`yeet verify`, or `publish --prove-first`) then dispatches
the *hosted lane bodies themselves* — `beep ci lane`
`check`, bare `lint`, `lint-policy`, bare `test-unit`, and `test-integration`,
each with the affected shape used to select work in `check.yml`. Hosted Lint
and Test Unit intersect that selected set with their deterministic package
partitions; the bare commands retain the complete local proof contract. The
full proof also runs the root build and bounded docgen (which compiles the
fenced code in every titled `**Example** (Title)` section), the repo-wide tsgo
test/smoke extras, and the secrets/security/SAST/Nix lanes. The command is
literally the one CI runs, so a green `yeet verify` should predict green CI on
the first push. What it does not
yet replay is CI's *environment* (`CI=true`, blank PR secrets, PR cache posture)
or the merged tree — use `verify --merged` for the tree.

The full verify tier and every publish push path also run
`publish:00-head-install-preflight`: a frozen-lockfile install in a detached,
temporary worktree of committed `HEAD`. This catches lockfile/manifest state
that is self-consistent only in the dirty working tree. The temporary worktree
is always removed and pruned; a failure must be repaired by committing or
restaging the required manifest and `bun.lock` state before retrying.

The following cheaper commands are convenient inner-loop tools but are **NOT
authoritative** — do not conclude "it's green" from them:

- `bunx turbo run check --filter=<pkg>` (package-scoped) can pass while the
  proof's `beep ci lane check` fails an effect-LSP rule (e.g.
  `strictEffectProvide`/TS377032). Only the lane matches CI.
- `bun run docgen:local ... --reuse-proof-manifest` skips recompiling
  `**Example**` blocks when a source hash is unchanged, so it can miss a broken
  example or an unresolved import subpath that full `bun run docgen` (and CI)
  catches.
- `bun run beep yeet verify --tier cheap-gates` proves only the first tier. It
  never replaces the full proof.

When in doubt, prove with `yeet verify` before trusting "green". Do not run
it to unblock a publish: push, let hosted CI prove the head, and run the full
tier only to reproduce a hosted red locally.

## Final check: the content-final gate

`bun run beep yeet final-check` runs on the committed head before a lane calls
a PR final, and `yeet ready` refuses to flip a draft without a complete,
passing receipt for that exact head (`.beep/yeet/final-check/<sha>.json`).
It exists because on 2026-10-23/24 lanes called PRs final after local checks
that skip gates only hosted CI runs, and each merge redded `main`. Every gate
below runs the hosted body (`beep ci lane <id>`, through the same
`ciLaneDispatchStep` argv as `beep ci local`) with the PR `--affected --base
<merge-base>` shape, or a repo-wide sweep where the sweep is cheap. Steps run
one at a time and every lane keeps its own Turbo concurrency cap (2-4), so it
fits a 4-core worker. By default every gate runs and every red is collected;
`--fail-fast` stops at the first red and leaves the receipt incomplete.

| Gate | Hosted context | Command | Caught on main |
| --- | --- | --- | --- |
| `expectation-rewrite` | Test Unit | rewritten assertions in the diff's tests and snapshots, old file replayed on the merge base | #2215 |
| `cheap-gates` | Repo Sanity, JSDoc Ratchet, catalogs | `beep quality github-checks cheap-gates` | #2207, #2221 span |
| `lint-policy` | Heavy / Lint Policy | `beep lint policy --base`, root docs `oxlint .`, `beep lint deprecated-apis --full` | #2186, #2189, #2201 |
| `lint` | Lint (package Biome, GritQL), lefthook | `beep ci lane lint --affected`, plus the pre-commit `biome check` over the diff's files | #2187 |
| `repo-sanity` | Repo Sanity | `beep ci lane repo-sanity --changeset-status` | #2207 |
| `check` | Heavy / Check | `beep ci lane check --affected` | #2208 |
| `docgen` | Heavy / Docgen | `beep ci lane docgen --mode auto` | #2208 |
| `fallow` | Fallow Advisory Envelopes | `beep ci lane fallow --validate-envelopes` | #2215 |
| `coverage` | Coverage Regression, Test Unit | `TURBO_SCM_BASE=<merge-base> beep-cli coverage --affected` | #2215, #2221 |

`expectation-rewrite` lists the modified and renamed `*.test.ts`/`*.spec.ts`
and `__snapshots__` files, diffs each one on its own (added and deleted files
cannot hold a rewrite, and one whole-tree diff of a moved test directory
overflows the capture bound, #2241), flags a hunk that removes an assertion
line and adds one (or any edited snapshot entry), then runs the unmodified
merge-base version of that test file (a renamed file under the path the merge
base holds it at) in a detached
merge-base worktree under `~/.cache/beep/final-check/`. If the old test passes
there, the diff's own source change moved the output (`follows-diff`, pass).
If it already fails there, the rewrite turns an inherited red green without a
source fix (`masks-base-red`, fail): that is what #2215 did to #2212's
over-escaped `@`. The check is per file, so a file red on the merge base for
an unrelated test also fails it; fix that red, or skip the gate with the
reason. A verdict of `unverified` also fails the gate: the test file is
missing on the merge base, it has no owning `package.json`, or the merge-base
worktree, its `bun install --frozen-lockfile` or the vitest run could not
start. Repair the environment, or skip with `--skip expectation-rewrite=<reason>`.
Deleted assertions are not flagged.

The changed-files Biome step exists because package `lint` tasks never see
paths outside a workspace package: #2187 put an EF-40 GritQL violation in
`goals/`, no hosted lane flagged it, and lefthook then rejected every later
commit that staged the file.

Skips: `--skip <gate>=<reason>` (repeatable) records the gate as skipped with
the reason, and the receipt still admits the flip; `yeet ready` prints the
skipped gates so the PR body names them as hosted-only. Use it for the
constrained-compute ruling (a gate parked behind admission for 10 minutes),
never to step around a red. `--gates <list>` runs a subset for iteration and
writes an incomplete receipt that never admits the flip. `--dry-run` prints
the plan for the head without running it. A dirty tree (uncommitted edits or
untracked, non-ignored files, which the gates read) is refused, because
the receipt pins the committed head; amend or merge `main` and the receipt
must be produced again. HEAD and the tree are re-read after the gates, and a
checkout that changed during the run gets no receipt.

## Plan mode

Use plan mode before long or risky runs when you need to inspect the shape:

```bash
bun run beep yeet repair --plan --json
```

```bash
bun run beep yeet verify --plan --json
```

```bash
bun run beep yeet verify --tier cheap-gates --plan --json
```

```bash
bun run beep yeet verify --tier review-fix --plan --json
```

```bash
bun run beep yeet publish --message "type(scope): summary" --plan --json
```

```bash
bun run beep yeet status --remote --plan --json
```

```bash
bun run beep yeet monitor --summary --plan --json
```

```bash
bun run beep yeet closeout --plan --json
```

```bash
bun run beep yeet sweep --plan --json
```

`yeet sweep --plan` is the sweep's own dry run, not the generic yeet plan: it
prints the branch-deletion and ref-update steps with the git facts behind each
one.


## Cache baseline after a script-word or root-config change

Run `bun run beep cache audit` after changing a script word or root configuration.
For each configuration-drift BLOCK, establish which input legitimately changed.
Write a reviewed basis naming **every drifted task**, its subject and its input
change (including manifest bytes when a subject's review basis is its own manifest).
Use the complete audit output; a baseline rejection's `Unreviewed:` list extends
up to `. Unknown`, rather than just the first few subjects shown.

Submit `bun run beep cache baseline --request <request.json>` only after review.
Set `previous` to the SHA-256 of the **exact current text** of
`standards/cache-qualification-baseline.json` (including whitespace and trailing
newline, not a parsed/re-encoded object). Copy `scope`, `profile` and `epoch`
unchanged from that baseline. Set `subjects` to only those named in the drift
and the reviewed basis; bind `review.basis.path` and `review.basis.sha256` to
the reviewed basis file's exact bytes. The request also names the reviewer
and reason. See `goals/tsc-rs-gates/research/cache-baseline-request-2026-10-14.json`
for the request shape, not current hashes or a reusable subject list.

S31b permits only drift-named subjects with changed inputs: no widened
qualification, no new exception rows, and no standards debt or exception
inventory growth. List the subjects and their reasons in the PR body. Never
re-record a baseline to hide a red whose input did not change. Re-run the audit
after the reviewed request. A main merge that adds root tasks adds drifted
subjects: update the basis to name those tasks and input changes, recompute its
SHA-256 in the request, and refresh `previous` from the exact current baseline
text before re-running. Keep scope/profile/epoch and qualification unchanged.
