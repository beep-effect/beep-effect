# S44 rsc-gated-a receipt (2026-10-23)

Base: `6f25dd7c4d44dc6a765cdfd0068cda2dddef22e1`.
Refs #1852. The dormant-route decision resolves #1859 when published.

## Retained tools and desktop release

The [retained-tools receipt](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/repository-simplification-confidence/history/receipts/2026-10-23-retained-tools-witness.md#ci-pinned-spelling-re-witness-s44)
records an exit-0 run with typos-cli 1.50.3 and its binary hash.
The [Decision Log](../../SPEC.md#decision-log) selects the dormant desktop
release route with its reason and reversal, meeting #1859's documented-route
alternative once published. No signed release was attempted.

## E-12 docs-only classifier probe

This lane changes Markdown only. Under the orchestrator's RESUME 1 direction,
hosted classification evidence belongs in a comment on #1858 after publication:
PR number, head SHA, run IDs, and lanes run or skipped with their reasons.
No hosted result is claimed in this committed receipt. The rsc owner folds the
issue comment into its packet ledger; no evidence follow-up push is needed.

## Left open

- #1852: Stately OAuth and the selected visual workflow fixture.
- #1858: E-12 awaits hosted classification and the issue comment; E-31 remains
  outside this slice, and E-02/E-14/E-32 remain held on token retirement and recovery proof.
  The other outstanding hosted probes retain their existing owners and gates.
- #1859: the local dormant-route decision awaits publication. A live signed
  release would still require signing material and the disposable tag fixture.

## Recovery

Revert these documentation edits to reverse this slice. Existing environments,
tag protection, workflow configuration and signing material are unchanged.

## Local gates

- `bun install` passed with Bun 1.4.4.
- typos-cli 1.50.3 passed at the base and again after these Markdown edits.
- `bun run lint:oxlint` passed with no findings.
- `bun run beep quality changeset-graph` passed, 0 missing references.
- `bun run beep knowledge refs --check` passed, 0 live gated observations.
  Its broader observation inventory includes existing broken targets; exit 0
  does not claim the repository has no stale references.
- `git diff --check` passed.

No workspace package, test or exported code changed, so package verification,
`test-tsgo` and docgen do not apply. Publication gates and hosted CI have not
run. Publication and issue comments follow this local receipt; their final evidence
is reported in the PR and issue threads.
