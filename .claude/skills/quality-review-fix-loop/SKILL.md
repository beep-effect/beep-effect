---
name: quality-review-fix-loop
description: >
  Close an initiative with a quality loop: green baseline commit, read-only
  reviewer panel, fixer-agent routing, waivers, zero required blockers. Use
  when asked to run repo quality, fix all warnings/errors, close an
  initiative, or loop reviewers/fixers until no required findings remain.
version: 0.1.0
status: active
---

# Quality Review Fix Loop

Use near the end of a repository initiative. The goal is not endless polishing;
it is a green, committed, review-ready repo state with zero required blockers
in the chosen scope.

## Template Header

Fill or infer before starting:

- `repo_root`: `git rev-parse --show-toplevel`
- `initiative_summary`: one paragraph on the initiative being closed
- `base_ref`: `origin/main` unless the user says otherwise
- `review_scope`: changed files plus directly affected public APIs, package
  boundaries, docs, tests, generated configs, and manifests
- `zero_gate`: zero required blocker findings from the reviewer panel
- `loop_budget`: 3 reviewer/fixer rounds before escalating
- `commit_policy`: green baseline commit before loops; local follow-up commits
  for fixes; no push/PR unless explicitly asked
- `waiver_policy`: a required blocker may remain only with an explicit waiver
  record (see `references/templates.md`)
- `publish_policy`: local commits only unless the user explicitly asks to
  push, open a PR, or touch GitHub review threads

## beep-effect Defaults

For non-beep-effect repos, replace this section with local equivalents.

Source of truth — read what is relevant to the changed surface before
reviewing; never review from generic taste:

- root and package-local `AGENTS.md`
- `standards/ARCHITECTURE.md` plus the numbered doctrine index under
  `standards/architecture/` (01-13; `README.md` covers posture and drift
  buckets)
- `standards/effect-laws-v1.md`, `standards/effect-first-development.md`
- `.patterns/jsdoc-documentation.md`
- inventories/allowlists: `standards/schema-first.inventory.jsonc`,
  `standards/jsdoc-documentation.inventory.md`,
  `standards/effect-laws.allowlist.jsonc`
- package READMEs; `packages/fixture-lab/specimen` as executable proof

Architecture docs are target doctrine. Classify code/doctrine disagreements as
`target-doctrine-violation` | `transitional-compatibility` |
`cleanup-on-touch` | `forbidden-in-new-work` | `pending-automation` |
`missing-doctrine`. Repo-wide inventories are context, not automatic blockers:
blockers only when this initiative touched, worsened, or depended on them.

### Quality Commands

Run from `repo_root`. Baseline:

```bash
bun run lint:fix
bun run audit:github quality
```

Portable fallback when a repo has no all-up quality script: `bun run lint:fix`,
`check`, `build`, `test`, `audit`, `lint`. In beep-effect,
`bun run audit:github quality` covers build, check, lint, docgen
generate/aggregate, test, repo sanity, and changeset status; ensure the local
docgen lane is included for docs/export changes. Warnings and policy
diagnostics are actionable — do not call the baseline green while relevant
warnings remain.

## Operating Rules

- Inspect the worktree first; never revert unrelated user changes.
- Use the current checkout as truth for commands and package surfaces.
- Keep scope tied to this initiative; historical repo-wide debt is not a
  blocker unless the initiative touched it or made it worse.
- Reviewer/critic agents are read-only: inspect, run non-mutating commands,
  report. They must not edit.
- Fixer agents edit only their assigned write surface and are told other
  agents share the codebase.
- Prefer focused fixes; add abstractions only when they remove real
  duplication or match an established local pattern.
- Evidence beats vibes: a blocker needs concrete evidence and a concrete
  unblock action. Optional improvements go to backlog unless they protect
  correctness, doctrine, release safety, or maintainability in changed scope.

## Phases

**Phase 0 — Grounding.** Confirm `repo_root`, branch, dirty worktree,
`base_ref`. Capture the changed surface (`git status --short`,
`git diff --name-status {{base_ref}}...HEAD`, `--stat`). Summarize the
initiative in 3-6 bullets (intent, surfaces touched, public changes, risks,
known unrelated dirty files). Read the relevant source-of-truth docs.

**Phase 1 — Baseline quality and commit.** Run the baseline commands, fix
every relevant failure or warning, rerun until green, then make a local
Conventional Commit. Record SHA, commands run, out-of-scope failures verified,
and remaining pre-existing inventory debt. Do not start reviewer loops before
a green committed baseline (unless the user changes commit policy).

**Phase 2 — Read-only reviewer panel.** Launch the 10 reviewer roles in
`references/reviewer-roles.md` in parallel where possible, each given the
initiative summary, base commit, changed surface, source-of-truth list, and
the inventory item format from `references/templates.md`. Reviewers stay
read-only, cite standards and file/command evidence, classify findings
(`blocking` | `non-blocking` | `question` | `note`), separate changed-scope
blockers from historical debt, and return `0 required findings` when clean.

**Phase 3 — Triage and fixer routing.** Merge reviewer output into one
inventory: dedupe; reject findings without evidence or an actionable fix;
reclassify out-of-scope historical debt as `backlog`; group blocking findings
by write surface (source package, docs/standards, tests, generated
config/metadata, tooling); assign fixers only to non-overlapping groups using
the fixer prompt template in `references/templates.md`.

**Phase 4 — Verification round.** Review each patch, resolve conflicts while
preserving unrelated changes, run item-level acceptance commands, rerun the
baseline, commit (Conventional Commit), then relaunch the reviewer panel on
the new commit. Repeat Phases 2-4 until zero required blockers, every
remaining blocker has a waiver record, or `loop_budget` is exhausted — then
stop and report remaining blockers, why, options, and a recommended action.

## References

- `references/reviewer-roles.md` — the 10 reviewer roles and reviewer contract
- `references/templates.md` — inventory item format, severity calibration,
  fixer prompt, waiver/backlog records, final response format

Do not say the repository is ready if required blockers remain without waiver
or baseline quality is red.
