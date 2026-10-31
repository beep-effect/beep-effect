# verification-route — friction ledger

Record friction at the moment it happens (what you were doing, evidence, what would have
prevented it). Public repo: redact secrets, replace absolute home paths with `~`, drop
session/machine ids, quote only the minimal identifying error text.

## 2026-10-28 — A planned `bun run beep` command in packet prose reds the laws gate

- **Doing:** publishing the graduated packets (#2332); `yeet final-check` failed only on
  `lint-policy:laws`.
- **Evidence:** `knowledge:semantic-delta` reported 3 introduced blocking
  `unknown-beep-command goals/verification-route/SPEC.md: Unknown beep command path: ci route`;
  the command is the slice-1 deliverable and does not exist yet. `isKnowledgeCommandSpan`
  (`Knowledge.refs.ts`) excludes a span that carries a shell comment or pipe, and the probe reads
  the committed head, not the working tree.
- **Would have prevented it:** a documented marker for a planned command in the knowledge lint's
  docs, and `beep knowledge semantic-delta` noting that it reads the committed head.

## 2026-10-28 — `yeet ready` refuses an inherited required red; the flag is `--inherited`

- **Doing:** flipping #2332 ready after a Security (OSV) red appeared on a head whose only diff was
  six comment lines, while `main` had just merged two advisory pins.
- **Evidence:** `yeet ready refused: blocked on no-required-red: 1 required check(s) are failing`;
  `yeet ready --help` carries `--inherited "<check>=<attribution>"` (S11) which records the
  attribution in the PR body and flips.
- **Would have prevented it:** the refusal message naming the `--inherited` route.

## 2026-10-28 — `yeet publish --push-only` wants `--reuse-verified` or a base-sync merge

- **Doing:** pushing a one-commit fix on top of an already published head.
- **Evidence:** `yeet publish --push-only requires --reuse-verified unless HEAD is a reproducible
  merge of the base into the published branch.`; `publish --amend --no-edit` amended the unpushed
  commit and pushed a fast-forward.
- **Would have prevented it:** the refusal naming `--amend --no-edit` as the route for an unpushed
  fix commit.

## 2026-10-31 — A fresh lane type-checks as a TS6305 flood until upstream dists exist

- **Doing:** `bun run check` in `packages/tooling/tool/cli` right after `beep worktree new`.
- **Evidence:** hundreds of `error TS6305: Output file '…/dist/index.d.ts' has not been built from
  source file`, and every schema class in the new files reported `TS2509: Base constructor return
  type 'never'`; `bunx turbo run build --filter="@beep/repo-cli^..."` (70 tasks, 7 s from cache)
  then a clean check.
- **Would have prevented it:** `beep worktree new` building the lane's dependency dists, or a
  `check` preflight that names the missing dists instead of the cascade.

## 2026-10-31 — Workspace dependency specs are `workspace:^`, not `workspace:*`

- **Doing:** adding `@beep/repo-workspaces` to repo-cli.
- **Evidence:** every `@beep/*` dependency in the manifest reads `workspace:^`; the first edit used
  `workspace:*` and would have tripped syncpack/sherif in repo-sanity.
- **Would have prevented it:** a `beep` command to add a workspace dependency with the repo's spec.

## 2026-10-31 — Test files are type-checked under `test/tsconfig.json`, not the package tsconfig

- **Doing:** a lane brief told the implementer to type-check with `bunx tsgo --noEmit -p tsconfig.json`.
- **Evidence:** that covers `src/` only; ten Effect diagnostics in the new tests
  (`strictEffectProvide`, `effectFnOpportunity`) surfaced only under `test/tsconfig.json`.
- **Would have prevented it:** a single package script that type-checks both roots and is named in
  the brief (`quality test-tsgo` already exists for the fleet; name it).

## 2026-10-31 — A package-wide check gives no per-lane signal while sibling files are mid-edit

- **Doing:** three agents implementing disjoint files in one lane concurrently.
- **Evidence:** `bun run check` and `lint:jsdoc` stayed red on a sibling's in-progress file, so a
  finished lane could not prove itself green package-wide and skipped `package-verify`.
- **Would have prevented it:** a file-scoped check (`tsgo` on the lane's own files plus their test
  tsconfig) as the per-lane gate, with `package-verify` reserved for the integrator.

## 2026-10-31 — `A.filterMap` takes a `Result`-returning function in v4; an `Option` returns `[]` silently

- **Doing:** decoding `gh run list` rows in the corpus capture.
- **Evidence:** a `filterMap` callback returning `Option` compiled under `src/tsconfig` and produced an
  empty array at runtime; the mismatch is a type error only under `test/tsconfig.json`.
- **Would have prevented it:** the per-lane type-check covering the test tsconfig (same receipt as
  above), and the `effect-v4-array-filtermap-takes-result` gotcha surfaced in the brief.

## 2026-10-31 — A fixed number of TestClock advances flakes under Node when real I/O interleaves

- **Doing:** testing the corpus runner's 1 s / 2 s retry schedule.
- **Evidence:** advancing the clock a fixed nine times timed out about one run in ten on Node;
  advancing until the fiber finishes (`pollUnsafe`) is stable.
- **Would have prevented it:** a shared "advance until done" helper in `@beep/test-utils`.

## 2026-10-31 — `provideScopedLayer(<module const>)` is `EV002 unresolved-layer-provide`; `it.layer` needs a hook timeout

- **Doing:** providing stubbed route layers to `it.effect` tests.
- **Evidence:** three `EV002` rows on `provideScopedLayer(planLayer)` where `planLayer` was a
  module-level const built from a function; the detector resolves only inline layer expressions
  or `it.layer(...)`. Switching to `it.layer(planLayer, { timeout: "30 seconds" })` cleared them and
  surfaced `EV014 resource-layer-without-hook-timeout` until the timeout was added.
- **Would have prevented it:** the effect-vitest detector docs naming the accepted provision
  shapes, and the test-file checklist listing `it.layer` with an explicit hook timeout.

## 2026-10-31 — `knowledge:semantic-delta` in a lane brief: `bun run beep ci route …` in TS source is fine, in markdown it is not

- **Doing:** writing the `beep ci route` help strings and the packet docs in the same slice.
- **Evidence:** the knowledge lint probes documented commands in markdown only; TS string
  literals are not probed, while the packet's SPEC/PLAN needed the `# …` comment annotation.
- **Would have prevented it:** the same marker documented once, where both authors look.

## 2026-10-31 — A 60-day hosted capture exhausts the GitHub core API limit, and an end-only write loses it all

- **Doing:** `bun run beep ci route capture --since 2026-09-01` (two workflows, one `gh run view` per
  kept run) for the first census.
- **Evidence:** after 14 min: `gh run view … HTTP 403: API rate limit exceeded for user ID …`; no
  corpus file or receipt existed because the service wrote both only after the whole window, so
  resume-by-run-id had nothing to resume from. The token's 5,000/h core budget is shared by every
  agent session on the workstation.
- **Would have prevented it:** per-day checkpointing in the capture (write after each completed
  UTC day; receipt `until` = last completed day), and a brief that names the API budget so the
  first run is windowed.
