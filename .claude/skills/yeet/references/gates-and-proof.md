# Gates, the full proof, and plan mode

Read when a cheap gate is red, when you want to reproduce a hosted red locally with the full proof, or before a long run you want to inspect first. Part of the yeet skill.

## Gates: cheap-gates before the push, hosted CI after

Since 2026-10-05 (push-first-publish D1–D2) `yeet publish` gates the push on
the cheap-gates tier and the head-install preflight only; hosted CI is the
authoritative proof, and `bun run beep yeet verify` (full tier) is an
on-demand tool for iterating on a red hosted lane locally, never an automatic
publish step. The full tier's first step still runs the cheap-gates tier. This tier runs 12 deterministic gates in
one collected wave, including config sync, tsgo rule parity, Effect imports,
schema-first, goals checks, Knip, Fallow, publish-enabled changeset status, and the JSDoc
ratchet against the committed inventory. It reports every failure before any
build, lint, check, test, or docgen lane starts. `yeet repair` applies its
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
