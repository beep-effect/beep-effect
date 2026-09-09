# Worktree outcome handoff — 2026-09-08

## Baseline and scope

- Exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- Corpus SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- Receipt: `goals/boolean-creep/data/sweeps/refresh-2026-09-08-r25-main-9b7553/r25-cli-r-z-contract-correction1.jsonl`

## Confirmed Worktree metadata

| id | members | cardinality | exposure/tier |
| --- | --- | --- | --- |
| `worktree-fleet-epoch-target` | materialized, sha | 4/3 | wire, Tier 2 |
| `worktree-process-cwd-reading` | unreadable, cwd | 4/3 | internal, Tier 1 |
| `worktree-idle-reading` | failed, hours | 4/2 | internal, Tier 1 |
| `worktree-pr-classification` | failed, reusedBranch, reapClass, prNumber, mergedHead | 64/5 | internal, Tier 1 |
| `worktree-reap-candidate-retirement` | retired, skipReason | 32/17 | wire, Tier 2 |
| `worktree-branch-diff-reading` | probeFailed, count, paths | 8/3 | internal, Tier 1 |
| `worktree-policy-reading` | probeFailed, movement, reason, paths | 60/3 | internal, Tier 1 |
| `worktree-process-scan-completion` | complete, unreadable, scanned | 8/4 | internal, Tier 1 |
| `worktree-status-record-presence` | counted, paths | 4/2 | internal, Tier 1 |

The nine corresponding files under `goals/boolean-creep/designs/` preserve
vanished versus unreadable proc cwd, empty-but-complete scans, open-PR
precedence and reused merged branches, measured empty branch diffs, exact
count/path relations, and rename/copy status path order. The Tier 2 designs
retain the exact FleetSnapshot target projection and all WorktreeReapReport
candidate fields. Retirement continues reporting a checkout as retired when
removal succeeded but follow-up cleanup failed, while retaining the exact
`retirement-cleanup-failed` warning; a still-present checkout remains skipped
with `retirement-failed`.

## Held Tsconfig audit: disqualify D1

Proposed id `tsconfig-workspace-owner-presence` is not qualified. Although the
sole discovery producer at `TsconfigSync.plan.ts:245-257,283-362` cannot emit
`hasProjectTsconfig: true` with `ownerTsconfigPath: undefined`, the exported
`WorkspaceDescriptor` API explicitly documents and constructs that tuple at
`TsconfigSync.schemas.ts:1038-1055`. The exported sorter accepts it and reads
only `relativeDir` at lines 1060-1066. This is positive supported-constructor
and consumer evidence, not arbitrary schema permissiveness.

All four combinations therefore remain legitimate for the exported descriptor:
neither, build-owner without project tsconfig, normal project with owner, and
documented project-presence without an owner path. Exact proposed record:

- id: `tsconfig-workspace-owner-presence`
- file: `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.schemas.ts`
- line: 920
- symbol: `WorkspaceDescriptor`
- members: `[hasProjectTsconfig, ownerTsconfigPath]`
- disposition: disqualified D1
- reason: explicit exported constructor documentation plus sorter consumption
  establishes the allegedly forbidden true/undefined tuple; one discovery
  producer does not define the whole public model contract.

No design file was created for the disqualified Tsconfig proposal.

## Verification

Targeted source/test/barrel searches covered every writer and reader, JSON
render path, probe distinction, and cleanup warning. No real process was killed
and no worktree was retired. No source, test, inventory, status, dependency,
generated file, or git reference was changed. `mise exec bun@1.4.2 -- bun
goals/boolean-creep/ops/validate-designs.ts` reached 147 qualified records and
reported 16 separately owned missing sections/files; none belongs to these nine
Worktree designs. Scoped `git diff --check` passed.
