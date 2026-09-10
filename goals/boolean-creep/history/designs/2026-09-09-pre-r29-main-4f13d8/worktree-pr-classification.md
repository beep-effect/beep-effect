# Instance
- id: `worktree-pr-classification`
- exact source SHA: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source SHA: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/tooling/tool/cli/src/commands/Worktree/Reap.service.ts:83`
- symbol/members: `PrClassification` / `failed`, `reusedBranch`, `reapClass`, `prNumber`, `mergedHead`
- evidence: E1/E3 `Reap.service.ts:152-195,332-385`.

# Current shape
Five fields encode probe-failed, open PR, no PR, merged exact head, and merged reused branch. Open lookup deliberately precedes merged lookup.

# Cardinality gap
The boolean/literal/presence axes represent 64 tuples and five are legal.

# Target schema
Define five tagged cases: `probe-failed`, `open-pr({prNumber})`, `no-pr`, `merged-pr({prNumber,mergedHead})`, and `merged-reused-branch({prNumber,mergedHead})`.

# Migration inventory
- `Reap.service.ts:80-86,152-195` — create the union and preserve gh decode, open-first ordering, live HEAD comparison, and exact GitObjectId.
- `Reap.service.ts:332-389` — match probe failure to exact warning and reused branch to skip reason.
- `Reap.service.ts:391-584` — project reapClass/prNumber and preserve authorized merged HEAD through recheck/removal CAS.
- Reap tests retain revived/reused branches, open/merged/no PR, gh failure, and head-race safety.

# Guard-deletion accounting
Delete all five correlated fields and their coherence branches; case payloads own PR/head values. Keep Git/GitHub failure and exact-head safety guards.

# Encoded-side impact
Internal union only. Candidate JSON retains existing `reapClass` and optional `prNumber`; mergedHead remains authorization-only.

# Test impact
Cover all five cases and exact projection/warnings, especially a branch with historical merged plus current open PR.

# Risk and sequencing
Preserve open-PR precedence and branch-reuse refusal; either regression could retire active work.
