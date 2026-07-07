# CI lane parity table (P0 / orl-001 first deliverable)

Authoritative lane-by-lane classification of every `.github/workflows/check.yml`
lane per D2's three-class taxonomy (cli-runnable / workflow-gated / ci-native).
Authored 2026-07-07 from a full read of check.yml (885 lines, 12 jobs, 9-lane
verify matrix) plus the CLI surfaces in
`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts` and
`Tasks.ts`. This document seeds `beep ci lane --list`; once the CLI lands, the
machine-readable `--list` output is normative and this file is history.

## Legend

- **Class** (D2): `cli-runnable` — the whole command body moves into
  `beep ci lane <id>`; YAML dispatches it. `workflow-gated` — the body moves to
  the CLI but GitHub-context orchestration stays in YAML and arrives as flags.
  `ci-native` — Docker-image/actions-only; never simulated locally.
- **Required** = context name frozen by ruleset 10240248 (17 contexts).
- **Local today** = what `bun run beep quality github-checks pre-push` (the
  yeet verify battery) already runs before this packet.

## Master table

| # | check.yml job/lane | Context name | Req. | Class | Lane id | CI body (PR shape) | Local today |
|---|---|---|---|---|---|---|---|
| 1 | `pr-size` | PR Size Label | no | ci-native | — | inline `github-script` labeling via API | none (cosmetic; no local replay) |
| 2 | `verify`/`lint` | Lint | yes | cli-runnable | `lint` | `bun run lint -- --affected --summarize` (env `TURBO_SCM_BASE`) | `quality:lint` = unscoped `bun run lint` (full + policy steps) |
| 3 | `verify`/`lint-policy` | Lint Policy | yes | cli-runnable | `lint-policy` | `bun run beep lint policy` | folded into unscoped `bun run lint` (same steps, different invocation) |
| 4 | `verify`/`repo-sanity` | Repo Sanity | yes | cli-runnable | `repo-sanity` | `bun run audit:github repo-sanity` (→ `beep quality github-checks repo-sanity`) + on PR `bun run changeset:status:since-main` | repo-sanity lanes + `quality:changeset-status` ✔ |
| 5 | `verify`/`check` | Check | yes | cli-runnable | `check` | `bun run check -- --affected --summarize` | `quality:check` = full `bun run check` |
| 6 | `verify`/`test-unit` | Test Unit | yes | cli-runnable | `test-unit` | `bun run test -- --unit --types --affected --summarize` | `quality:test` = full `bun run test` (all kinds, one lane) |
| 7 | `verify`/`test-integration` | Test Integration | yes | cli-runnable | `test-integration` | `bun run test -- --integration --affected --summarize` | folded into `quality:test` |
| 8 | `verify`/`coverage` | Coverage Regression | yes | cli-runnable | `coverage` | `bun run coverage -- --affected --summarize` | **MISSING** (delta lane) |
| 9 | `verify`/`docgen` | Docgen | yes | workflow-gated | `docgen` | lane-gate mode: `affected` → `bun run docgen:local -- --base origin/<base> --head HEAD --parallel=3`; `full`/push → `bun run docgen`; `none` → skip | `quality:docgen` = full `bun run docgen` |
| 10 | `verify`/`codegen` | Codegen Drift | yes | cli-runnable | `codegen` | `bun run --cwd packages/drivers/ecfr generate` + `git diff --exit-code -- packages/drivers/ecfr/src/_generated packages/drivers/ecfr/openapi.json` | **MISSING** (delta lane) |
| 11 | `professional-desktop-ipc-stdio` | Professional Desktop IPC Stdio | yes | workflow-gated | `desktop-ipc` | path-filter gate + Rust toolchain in YAML; body `bun run --cwd apps/professional-desktop beep:test:integration:ipc` | **MISSING** (delta lane) |
| 12 | `fallow-advisory` | Fallow Advisory Envelopes | no | workflow-gated | `fallow` | base computation in YAML; blocking `beep quality fallow {audit,dead-code} --check --base <ref> --out .beep/fallow/<lane>.json`; advisory `{health,boundaries,flags,security,fix-preview} --advisory`; envelope-check validation; artifact upload | `fallow:dead-code --check` only + yeet's fallowAdvisoryFeedbackStep |
| 13 | `knip` | Knip | yes | cli-runnable | `knip` | `bun run beep quality knip` | `quality:knip` ✔ |
| 14 | `jsdoc-ratchet` | JSDoc Ratchet | yes | cli-runnable | `jsdoc-ratchet` | `beep quality jsdoc-inventory` **then** `beep quality jsdoc-ratchet` | `quality:jsdoc-ratchet` only — **inventory step missing** (shape delta) |
| 15 | `build` (push-only) | Build | no | cli-runnable | `build` | `bun run build -- --summarize` | `quality:build` ✔ |
| 16 | `commitlint` | Commitlint | yes | workflow-gated | `commitlint` | range from event context in YAML; body `bunx commitlint --from <base> --to <head> --verbose` (or `--last`) | **MISSING** (delta lane) |
| 17 | `secrets` | Secret Scanning | yes | ci-native | `secrets`* | docker `zricethezav/gitleaks@sha256:…` `detect --log-opts <base>..HEAD` with **base-pinned** `.gitleaks.toml` + `.gitleaksignore` | `pre-push:secrets` = native `gitleaks git --log-opts merge-base..HEAD` with worktree config (approximation) |
| 18 | `security` (OSV sub-gate) | Security | yes | ci-native | `security`* | `google/osv-scanner-action@v2.3.3` action (`--lockfile=bun.lock --config=osv-scanner.toml`) | `pre-push:security` = docker `ghcr.io/google/osv-scanner-action:v2.3.3`, same lockfile+config (high-fidelity approximation) |
| 19 | `security` (dependency-review sub-gate) | Security | yes | ci-native | — | dep-graph availability probe (`gh api`) + `actions/dependency-review-action@v4` | **PERMANENT CI-only** (GitHub dependency-graph API); documented unreplayable |
| 20 | `nix` | Nix Shell | yes | cli-runnable | `nix` | PR: `nix flake check --all-systems` + `nix develop --command echo` (raw YAML); push: `bun run audit:github nix` (→ CLI, same commands) | `pre-push:nix` ✔ (identical commands) |
| 21 | `sast` | SAST | yes | cli-runnable | `sast` | `bun run beep quality github-checks sast` (semgrep docker over changed JS/TS vs origin/main) | `pre-push:sast` ✔ (same body) |

\* `secrets`/`security` are ci-native for parity purposes (the CI gate runs a
pinned image/action with CI-side security controls), but `beep ci local` keeps
running their existing local approximations as *local gates*, explicitly marked
approximate in `--list` — they can catch what CI would catch without claiming
verdict identity.

Required-context count check: rows 2–11, 13–14, 16–21 cover exactly the 17
frozen contexts (Security counted once across its two sub-gates). PR Size
Label, Fallow Advisory Envelopes, and Build are the three non-required jobs.

## Shape deltas (why "5 missing lanes" was a floor)

The naive delta (Coverage Regression, Codegen Drift, Commitlint, Desktop IPC,
dependency-review) captures *missing whole lanes* only. Full list of
divergences a faithful `beep ci local` must reconcile:

1. **Missing lanes** — coverage, codegen, commitlint, desktop-ipc have no
   local counterpart today; dependency-review permanently cannot have one.
2. **Affected vs full** — CI PR shape runs `--affected --summarize` with
   `TURBO_SCM_BASE=origin/<base>` for lint/check/test-unit/test-integration/
   coverage; local quality lanes run unscoped full builds. Full ⊇ affected for
   coverage-of-failures, but verdicts can differ in both directions (e.g. an
   affected-graph miss hides a break CI would also miss; a full-run failure in
   an untouched package fails locally but not CI). `beep ci lane` accepts
   `--affected`/`--base` so both shapes are replayable.
3. **Test lane split** — CI splits `--unit --types` and `--integration`
   into separate required contexts; local `quality:test` is one aggregate. The
   CLI lanes preserve the CI split; `beep ci local` runs both.
4. **JSDoc Ratchet sequence** — CI regenerates the inventory
   (`jsdoc-inventory`) before ratcheting; local pre-push runs only
   `jsdoc-ratchet`. A stale committed inventory can pass locally and fail in
   CI (or vice versa). The lane body adopts CI's two-step sequence.
5. **Lint policy split** — CI runs `beep lint policy` as its own context
   while the Lint context runs affected turbo lint (which suppresses
   repo-wide policy steps); local unscoped `bun run lint` runs both in one
   lane. Same steps either way (not a semantic delta), but lane granularity
   and failure attribution differ; the CLI keeps them as two lanes matching
   CI contexts.
6. **Docgen modes** — CI PRs run none/affected/full per lane-gate; local
   always runs full `bun run docgen`. The lane accepts `--mode` (+
   `--base`/`--head`), with the gate computation staying in YAML (D2);
   `beep ci local` defaults to the affected shape with a `--full` escalation.
7. **Secrets config pinning** — CI scans with the BASE branch's
   `.gitleaks.toml`/`.gitleaksignore` (anti-self-allowlisting control) over
   `origin/<base>..HEAD`; local scans with the worktree config over
   `merge-base(origin/main, HEAD)..HEAD`. Structurally approximate-only:
   the pinning control is meaningless locally (the attacker is the machine
   owner). Classified ci-native; local approximation retained.
8. **Security sub-gates** — the Security context = OSV action AND (when the
   dep-graph is enabled) dependency-review. Local replay covers OSV only.
9. **Nix event split** — PR body is raw nix commands in YAML; push body goes
   through the CLI. Identical commands; the lane unifies them (one body,
   CI-side Cachix setup stays in YAML).
10. **Fallow orchestration** — the CI job's bash loops (per-lane status
    accounting, `GITHUB_OUTPUT` plumbing, envelope validation loop, artifact
    upload) live in YAML around CLI lane bodies. Envelope validation
    (`fallow envelope-check`) is itself CLI-runnable and joins the lane body;
    artifact upload and step-summary rendering stay in YAML.
11. **CI-only environment concerns** (stay in YAML per D2): turbo remote-cache
    env (CSF-001 read-only PR grant), typos-cli installation, disk-space
    cleanup, Rust toolchain setup, checkout/fetch depth, Cachix setup,
    secrets env plumbing.

## Lane-id → flag surface (target design for `beep ci lane`)

| Lane id | Flags accepted | YAML passes |
|---|---|---|
| `lint`, `check`, `test-unit`, `test-integration`, `coverage` | `--affected`, `--base <ref>`, `--summarize` | `--affected --base origin/${GITHUB_BASE_REF} --summarize` on PR; `--summarize` on push |
| `lint-policy` | — | — |
| `repo-sanity` | `--changeset-status` | flag present on PR events |
| `docgen` | `--mode <none\|affected\|full>`, `--base <ref>`, `--head <ref>` | lane-gate output |
| `codegen` | — | — |
| `desktop-ipc` | — | (path filter decides whether to dispatch at all) |
| `fallow` | `--base <ref>` | computed audit base |
| `knip`, `jsdoc-ratchet`, `build`, `nix`, `sast` | — | — |
| `commitlint` | `--from <ref>`, `--to <ref>`, `--last` | computed range |
| `secrets`, `security` | — (local approximations; marked approximate in `--list`) | n/a (CI keeps native bodies) |

`beep ci lane --list` emits every row above machine-readably (JSON): id,
class, CI context name, required flag, flag surface, and for ci-native lanes
the reason they are unreplayable plus the local-approximation lane id if one
exists.

## `beep ci local` battery (target)

All cli-runnable + workflow-gated lanes in their CI shapes, defaulting to the
PR shape against `origin/main`:
`lint`, `lint-policy`, `repo-sanity` (with changeset-status off main),
`check`, `test-unit`, `test-integration`, `coverage`, `docgen` (affected),
`codegen`, `desktop-ipc`, `fallow`, `knip`, `jsdoc-ratchet`, `build`,
`commitlint`, `nix`, `sast`, plus the `secrets`/`security` local
approximations. `--lanes <ids>` selects; `--fast` skips
`coverage`, `test-integration`, `nix`; `--affected` forwards the affected
shape. Documented CI-only residue: `pr-size`, dependency-review.
