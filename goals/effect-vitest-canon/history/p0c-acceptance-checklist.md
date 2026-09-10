# P0c acceptance checklist

This checklist applies the supplied P0c gate. It does not replace package
verification, P0d graph coverage, P0f Grok reviews, or hosted PR checks.

## Scope and syntax

- Reconcile every command census path against research/census/scope.json. The
  starting set is 964 tests and 79 support modules; new detector tests explain
  any additions. File kinds, line/byte counts and containing workspaces agree.
- Nested fixture manifests and the infra SDK are not workspace owners.
- Support modules participate in wrapper-definition findings only.
- Scope globs have one definition in Lint.schemas.ts. No stale-worktree/lab
  imports enter the Project. No type-checker or symbol-resolution API is used.
- The full syntax scan, including CLI startup as recorded separately, meets the
  under-10-second gate. Preserve exact command, elapsed time and file count.

## Detector contract

- Every EV001 through EV015 has a precise AST predicate, positive fixture,
  negative fixture, replacement ID and honest mechanization classification.
- Fixtures cover aliases, shadowing, strings/comments, module fixture runners,
  pure stubs, unresolved imported layers, wrapper roots and definitions, and
  intentional shorter scopes. Judgment candidates never claim semantic proof.
- Multiple findings on one line retain unique stable identities. Sorting and
  repeated scans are deterministic. Baseline membership preserves distinct nodes.
- Newly authored detector tests satisfy the canonical test idioms themselves.

## Artifacts and enforcement

- Actual command output writes the baseline and authoritative census. No
  hand-built output is substituted for a successful scan.
- Default ratchet accepts its current baseline and rejects a new instance.
  Removing an instance is distinguishable from new growth. Existing exception
  reasons survive refresh; empty exception reasons fail schema decoding.
- Rows are schema-validated JSONL, grouped by actual package, with bounded
  evidence/confidence/line fields and documented optional-field encoding.
- Mismatched installed rc.112 version fails clearly. P0d still must supply the
  complete graph and prove every export/README section before final readiness.
- cheap-gates:effect-vitest appears next to schema-first in the existing gate
  composer and is inherited by Yeet. No duplicate registry was introduced.

## Package handoff

- Read the lane's report and changed implementation before running verification.
- Run the required full package-verify for @beep/repo-cli as orchestrator. Record
  the command and exit, then attribute any failure before making repairs.
- Focused tests and direct package checks support this proof but do not replace it.
- New exports meet the JSDoc rubric and examples compile in package docgen.
- Record inherited/environment failures distinctly; no blanket rerun, baseline
  weakening, timeout increase or global configuration changes to mask a failure.

P0c remains open until these checks have authoritative evidence. A lane exit,
placeholder baseline, candidate count or partial focused pass is insufficient.
