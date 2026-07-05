# Templates

Work-order and record formats for the quality-review-fix loop.

## Contents

- [Inventory Item Format](#inventory-item-format)
- [Severity Calibration](#severity-calibration)
- [Fixer Agent Prompt Template](#fixer-agent-prompt-template)
- [Waiver Record](#waiver-record)
- [Backlog Item](#backlog-item)
- [Final Response Format](#final-response-format)

## Inventory Item Format

Reviewer findings must use this exact work-order shape. Omit only fields that
are explicitly marked optional.

```md
### {{id}}: {{title}}

- `round`: {{review_round}}
- `reviewer`: {{reviewer_role}}
- `label`: issue | suggestion | question | todo | note
- `blockingStatus`: blocking | non-blocking | question | note
- `severity`: P0-critical | P1-high | P2-medium | P3-low
- `doctrineBucket`: target-doctrine-violation | transitional-compatibility | cleanup-on-touch | forbidden-in-new-work | pending-automation | missing-doctrine | not-doctrine
- `sourceRefs`: {{standard/doc/law path plus section or command output}}
- `affectedFiles`: {{repo-relative paths with line numbers where possible}}
- `evidence`: {{specific diff, code path, failing command, log excerpt, missing doc, or violated rule}}
- `impact`: {{why this matters for correctness, architecture, docs, maintenance, or release readiness}}
- `suggestedFix`: {{smallest actionable fix}}
- `recommendedSkillOrAgent`: {{skill name or specialist role}}
- `fixerGroup`: {{write surface/package/docs area}}
- `acceptanceCommands`: {{focused commands proving the fix}}
- `testsNeeded`: {{runtime/type/doc/coverage/contract tests, or "none"}}
- `dependencies`: {{other findings that must be fixed first, or "none"}}
- `waiverRecord`: {{required only if not fixing a blocker}}
- `status`: open | fixed | waived | backlog | rejected
- `fixedCommit`: {{commit SHA after fix, or "pending"}}
```

## Severity Calibration

- `P0-critical`: confirmed data loss, security issue, broken release, or
  impossible-to-ship regression.
- `P1-high`: confirmed doctrine/law/API/test failure in changed scope.
- `P2-medium`: likely maintainability, documentation, boundary, or coverage
  gap that should be fixed before closure.
- `P3-low`: non-blocking polish or future improvement.

Use `blockingStatus`, not severity alone, to decide the loop gate.

## Fixer Agent Prompt Template

```text
You are a fixer agent for the quality-review-fix loop.

Repo root: {{repo_root}}
Owned write surface: {{owned_surface}}
Inventory items: {{item_ids_and_summaries}}

You are not alone in the codebase. Other agents may be working on different
surfaces. Do not revert unrelated changes. Edit only the owned surface unless a
fix is impossible without crossing ownership; if that happens, stop and report
the dependency.

For each assigned item:
- inspect the cited source standard and evidence
- make the smallest correct fix
- add or update tests/docs when required by the acceptance condition
- run the focused acceptance commands
- report changed files, commands run, pass/fail status, and any residual risk
```

Give each fixer: owned files/packages, blocked inventory item IDs, exact
acceptance commands, a warning not to revert unrelated work, and an
instruction to list changed files and verification results.

## Waiver Record

Blocking findings should usually be fixed. If a blocker is intentionally not
fixed, create a waiver record:

```md
### Waiver: {{item_id}}

- `sourceStandard`: {{doc/law/standard}}
- `reason`: {{why fixing now is not the right move}}
- `owner`: {{person/team/package owner}}
- `expiryOrFollowUp`: {{date, issue, or explicit trigger}}
- `residualRisk`: {{what can go wrong}}
- `acceptanceEvidence`: {{why closure is still acceptable}}
```

## Backlog Item

Non-blocking improvements become backlog work items:

```md
### Backlog: {{title}}

- `source`: {{reviewer/item/source}}
- `evidence`: {{file/command/doc evidence}}
- `suggestedFix`: {{short fix direction}}
- `acceptanceCriteria`: {{how future work knows it is done}}
- `priority`: P2-medium | P3-low
```

## Final Response Format

When the loop closes, report:

- baseline commit SHA and final commit SHA(s)
- reviewer rounds run
- quality commands run and final status
- required blockers fixed
- waived blockers, if any
- backlog items, if any
- files changed by the closure loop
- remaining risk
- publish status: local only unless explicitly pushed/PR'd

Do not say the repository is ready if required blockers remain without waiver,
or if baseline quality is red.
