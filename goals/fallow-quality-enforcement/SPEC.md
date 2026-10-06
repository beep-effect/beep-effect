# Fallow Quality Enforcement Spec

## Doctrine

Fallow configs, reports, generated standards, and CI summaries are enforcement
projections. They are not an architecture constitution.

Any Fallow rule that represents architecture must cite its owning doctrine in
`standards/ARCHITECTURE.md` or a numbered architecture doc. Any new
architecture meaning must be added to the canonical architecture docs before it
is encoded in Fallow config or promoted to blocking enforcement.

## Branch And Dirty Worktree

The first execution step is:

```sh
git switch -c feat/fallow-quality-enforcement
```

If the branch already exists, switch to it. Preserve dirty changes. The current
known unrelated dirty files are:

- `apps/canvas/src/App.tsx`
- `apps/canvas/src/main.tsx`

Do not revert, stage, or claim those files as Fallow packet work unless the user
explicitly redirects.

## Packet Artifact Contract

Effect Schema models in `ops/validate-packet.ts` are the packet validation
authority. Checked-in `*.schema.json` files are editor/reviewer companions and
must declare that `ops/validate-packet.ts` is authoritative. The validator must
parse JSONC with `jsonc-parser`, decode with `S.decodeUnknownEffect`, and
enforce cross-field invariants.

Every packet JSONC artifact should include a `$schema` key for editor support,
but the Effect Schema validator decides pass or fail.

## Feature Matrix

`research/feature-matrix.jsonc` has rows for:

- `audit`
- `dead-code`
- `health`
- `boundaries`
- `flags`
- `security`
- `fix-preview`
- `runtime-coverage`
- `editor-mcp-hooks`

Each row carries command, config, doctrine, per-boundary provenance,
attribution/cleanup policy, baseline, false-positive, suppression, Yeet, CI,
promotion, owner, rollback, and evidence fields. The validator rejects promoted
rows unless false positives are resolved, baselines are measured, promotion
evidence is present, suppression policy is strict, and pre-push proof is named.

Boundary rows must classify candidate rules as:

- `manifest-derived`
- `architecture-derived-hard-check`
- `review-gate-only`

`review-gate-only` rules cannot block until a doctrine-backed metadata source
exists. Boundary rows must also carry per-rule source records with `ruleId`,
`sourceClass`, `sourceRefs`, `doctrineRefs`, `catalogRefs`, and
`promotionEligible`.

Generated Fallow boundary rules must also be covered by
`standards/fallow.boundaries.provenance.jsonc`. The packet validator must assert
that every `boundaries.rules[*].from` entry in
`standards/fallow.boundaries.generated.jsonc` has a matching sidecar rule with
canonical architecture doctrine refs.

## Knip Parity

`research/knip-parity.jsonc` is the only retirement gate for Knip. It must cover
at least:

- `entry`
- `project`
- `ignore`
- `ignoreDependencies`
- `ignoreBinaries`
- `ignoreWorkspaces`
- `rules.catalog`
- `rules.duplicates`
- `workspaces`
- `plugins`
- `reporter`

Knip cannot be removed unless every row is `ready-to-retire-knip` with
`gapStatus: "parity"`, measured Knip/Fallow evidence, and acceptance commands
covering both tools. Any `keep-knip`, `knip-only`, `fallow-gap`,
`repo-policy-gap`, or `unknown` row keeps the document recommendation at
`keep-knip` or `undecided`.

## Command Contract

The target canonical P1 command group is not assumed to exist at packet
bootstrap. P1 must implement:

```txt
beep quality fallow audit
beep quality fallow dead-code
beep quality fallow health
beep quality fallow boundaries
beep quality fallow flags
beep quality fallow security
beep quality fallow fix-preview
```

Shared semantics:

- Default output is a JSON envelope.
- Default output path is `.beep/fallow/<subcommand>.json`.
- `--base` defaults to `origin/main` where relevant.
- `--advisory` exits `0` while preserving the Fallow tool exit status in the
  envelope.
- Analyzer `--check` exits nonzero only for promoted blocking lanes.
- `--quiet` suppresses Fallow chatter.
- Every command writes an envelope even when Fallow fails, base resolution
  fails, or Fallow emits invalid JSON.

Generated policy drift checks are separate from analyzer enforcement checks.
`beep quality fallow boundaries config-check --check` owns generated boundary
config freshness. `beep quality fallow boundaries --check` is reserved for a
future promoted analyzer lane and must not be used to mean config drift.

### Verification Helper Contract

P1/P2/P3 may add repo-cli helper commands used only by tests, packet proofs, and
CI contract assertions. These helpers are target contracts, not claims about
the current CLI surface:

- `beep quality fallow command-contract-check --assert <csv> --require-envelope --out-dir .beep/fallow`
  verifies that every target Fallow subcommand exists, writes the expected
  envelope path, and decodes against the envelope schema.
- `beep quality fallow boundaries config-check --check` proves generated
  boundary config freshness and is separate from boundary analyzer enforcement.
- `beep quality fallow envelope-check <path> --require <csv>` decodes one
  envelope and fails if required metadata is missing.
- `beep quality fallow ci-contract-check .github/workflows/check.yml --expect-lanes health,boundaries,flags,security,fix-preview --expect-blocking-lanes audit,dead-code --expect-out-dir .beep/fallow --require-upload --if-no-files-found error --advisory`
  proves hosted CI uses the repo-cli envelope wrapper and cannot silently miss
  any advisory artifact for the implemented P1 lane set.
- `beep yeet plan-contract-check --from-stdin --expect-step-id advisory:01-fallow-feedback --expect-step-label fallow-advisory-feedback --expect-command bun --expect-args "run beep yeet fallow-feedback --from .beep/fallow --emit .beep/yeet/fallow-quality-issues.json --advisory"`
  must be connected to `beep yeet verify --plan --json` through a pipe or
  equivalent file input; a standalone stdin check is invalid. The checker must
  match id, label, command, and args separately.
- `beep yeet publish --message "chore(fallow): advisory plan proof" --plan --json |
  beep yeet plan-contract-check --from-stdin --expect-step-id
  advisory:01-fallow-feedback --expect-step-label fallow-advisory-feedback
  --expect-command bun --expect-args "run beep yeet fallow-feedback --from
  .beep/fallow --emit .beep/yeet/fallow-quality-issues.json --advisory"`
  proves the publish planner includes the same advisory Fallow feedback step;
  verify-plan proof alone is insufficient because verify and publish assemble
  different step sets.
- `beep yeet publish --message "chore(fallow): plan proof" --plan --json |
  beep yeet plan-contract-check --from-stdin --expect-step-id full:01-pre-push
  --expect-step-label full:pre-push --expect-command bun --expect-args "run
  beep quality github-checks pre-push"`
  proves the normal Yeet publish path still includes the same full pre-push
  quality plan before any blocking Fallow promotion. The checker must
  distinguish step ids from user-facing labels.
- `beep yeet fallow-fixture-check goals/fallow-quality-enforcement/reports/report-envelope-fixtures.jsonc --emit .beep/yeet/fallow-quality-issues.json --assert QualityIssueIndex,tool=fallow,blocking=false,attribution`
  proves Fallow envelopes normalize into Yeet quality issues without losing
  attribution.
- `beep quality github-checks plan-contract-check --mode pre-push --feature-matrix goals/fallow-quality-enforcement/research/feature-matrix.jsonc --expect-promoted-fallow-lanes`
  proves promoted Fallow lanes are wired into pre-push without adding pretend
  flags to the existing `github-checks` command.

## Report Envelope

Repo-cli implementation must model the report boundary as two layers:

- `FallowReportWireEnvelope` is the exact wire guard used by `envelope-check`,
  Yeet fixture normalization, and packet validation before internal decode.
- `FallowReportEnvelope` is the internal decoded discriminated union on
  `status`; it must never be used alone as the wire boundary because decoded
  class models may ignore unknown keys.

The wire guard rejects mixed payloads and arbitrary surplus keys: `ok` cannot
include `stderrExcerpt`, failure statuses cannot include `report`, and every
wire key must belong to the status-specific allowed set.

Shared metadata lives in a common base:

- `schemaVersion`
- `toolVersion`
- `command`
- `subcommand`
- `baseRef`
- `generatedAt`
- `advisory`
- `dirtyWorktree`
- `reportPath`
- `rawOutputRef`
- `attributionKinds`
- `findingAttributionSummary`

Success variant:

- `status: ok`
- requires decoded `report`
- requires `exitStatus`

Failure variants:

- `status: tool-failed | invalid-json | invalid-report | base-resolution-failed`
- require `exitStatus`
- require `stderrExcerpt`
- require `rawOutputRef`

`goals/fallow-quality-enforcement/reports/report-envelope-fixtures.jsonc` must decode fixtures for `ok`,
`tool-failed`, `invalid-json`, `invalid-report`, and `base-resolution-failed`, and it must include
Yeet issue fixtures proving `introduced`, `inherited-adjacent`, and
`not-applicable` attribution survives parser normalization.

## Yeet Mapping

P3 maps Fallow findings into existing `QualityIssue` categories after the P1
envelope wrapper and P2 CI artifacts exist:

- boundaries, dead-code, health, flags: `repo-law`
- security: `security-audit`
- parser failures: `parser-error`
- tool failures: `command-failure`

All advisory Fallow issues use:

- `tool: "fallow"`
- `parser: "fallow/<feature>/v1"`
- `subCategory: "fallow:<feature>:<rule>"`
- `blocking: false`
- raw report refs
- package, file, symbol, and location fields when available

P3 must add an explicit advisory Yeet feedback step with `blocking: false`
before any blocking promotion. The plan proof must assert the named
`fallow-advisory-feedback` step rather than relying on a parent command help or
generic current Yeet plan. P3 may flip selected rows to blocking only through
`quality github-checks pre-push`. Yeet verify, Yeet publish, and
`audit:github pre-push` must remain equivalent.

Future repo-cli parser code must define internal Fallow report models with
`S.Class` and `LiteralKit`, decode Fallow JSON boundaries with
`S.decodeUnknownEffect`, map errors to typed repo-cli errors, and avoid exported
pure-data interfaces or type literals for Fallow report models.

## CI Policy

P2 replaces raw pilot output with envelope-writing repo-cli commands. Fallow CI
stays advisory until matrix promotion gates say otherwise. Advisory jobs must
not fail the workflow because Fallow found issues or returned a findings exit
code, but missing or malformed envelope artifacts are CI contract failures. The
Fallow execution step may use advisory/continue-on-error behavior; envelope
validation and artifact upload must not silently pass when files are absent.

If base resolution, Fallow execution, JSON decode, or SARIF generation fails,
CI writes a failure envelope with command, exit status, stderr excerpt, base
ref, and Fallow version.

SARIF code scanning is deferred until P0 says it is safe.

## New-Only And Cleanup-On-Touch

New-only is diff attribution only. Cleanup-on-touch is boundary-scope policy.

If package manifests, export maps, boundary-sensitive imports, ownership docs,
config/shared/Layer surfaces, or architecture examples are touched, adjacent
inherited findings must be reviewed even when they are not newly introduced.

Base ref rules:

- CI PR base: `origin/${GITHUB_BASE_REF:-main}`
- CI push base: `${{ github.event.before }}` with `HEAD~1` fallback
- local base default: `origin/main`

Generated config drift is checked by:

```sh
beep quality fallow boundaries config-check --check
```

Generated boundary rules from workspace manifests prove declared dependency
consistency: imports must stay inside the dependency edges packages already
declare. They do not by themselves prove architecture legality. Architecture
hard-check coverage requires `architecture-derived-hard-check` provenance with
`architecture-legal-edge` scope; until that generator exists, role/family
architecture legality remains review-only.

It is not inferred from general audit attribution.

Every envelope and Yeet issue must distinguish `introduced` findings from
`inherited-adjacent` findings surfaced by cleanup-on-touch review.

Task acceptance commands must prove envelope creation and schema checks for
repo-cli Fallow wrappers. Parent `--help` output is not sufficient proof that a
target subcommand exists.

## Suppressions

Every persistent suppression must record:

- rule id
- feature family
- owner
- rationale
- doctrine bucket
- suppression class
- expiry or review date
- preferred fix path
- evidence refs

Inline suppressions without matching rationale or tracked record are forbidden
outside temporary P0 baselining.

## Review Waivers

Required critic findings may be closed only as `fixed` or `waived`. A waived
finding must carry owner, approver, source standard refs, rationale,
expiry/review date, residual risk, and acceptance evidence refs in
`history/review-rounds.jsonc`; otherwise the packet validator fails.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-06 | `beep quality fallow` steers Fallow's reusable audit base snapshot (`fallow-audit-base-cache-<key>-root-<key>` plus sidecars) at the disk-backed `~/.cache/beep/fallow` root via the child's `TMPDIR` (`BEEP_FALLOW_CACHE_ROOT` overrides) and forwards `FALLOW_AUDIT_CACHE_MAX_AGE_DAYS=2`; `yeet sweep --retire` runs `fallow audit-cache remove --root <lane>`; `quality tmpfs-reap` scans that root, reaps a snapshot whose recorded owner root is gone at age zero and an idle live-owner snapshot after one hour (was six). Snapshots stay keyed per project root: Fallow 3.31 hashes the root, so lanes cannot share one snapshot per base commit without an upstream change. | 29 live snapshots (~19 GB) and their retired predecessors sat in zram-backed `/tmp` on 2026-10-06 and accounted for most of 37 GB of swap; the janitor skipped them as `too-young`. The repo law already places tool clones under `~/.cache/beep/`. | Drop the env projection in `FallowQuality.command.ts` and the retire hook in `Yeet/internal/Retire.ts`; restore the six-hour `fallow-cache` threshold and remove `discoverCacheFallowCaches` in `TmpfsReap.ts`. Runbook: `docs/runbooks/fallow-audit-cache.md`. |
