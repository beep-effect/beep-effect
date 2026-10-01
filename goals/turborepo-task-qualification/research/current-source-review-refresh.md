# Current source-review refresh boundary

Measured census revision: `545de03f4cb4526b80fe308ceaf529845804020b` (Turbo 2.11.6).

This receipt identifies stale historical bindings. It does not renew any review,
close either semantic census obligation, or grant qualification authority.

| Historical request | Source references | Changed | Missing |
| --- | ---: | ---: | ---: |
| `post-merge-entrypoint-request.json` | 274 | 246 | 1 |
| `ignore-repair-entrypoint-request.json` | 275 | 247 | 1 |
| `entrypoint-review-request.json` | 274 | 248 | 1 |
| `pilot-entrypoint-request.json` | 285 | 257 | 1 |
| `dependency-edge-entrypoint-request.json` | 286 | 258 | 1 |
| `lane-merge-entrypoint-request.json` | 286 | 258 | 1 |
| `installed-launcher-entrypoint-request.json` | 294 | 262 | 1 |
| `runtime-key-entrypoint-request.json` | 294 | 262 | 1 |

All compared requests reference a removed schema module. The current manifests,
workflow sources, dependency lockfile and entrypoint implementation have also
changed. Replacing hashes alone would not establish current semantic review.

The preparatory executable census has 144 workspaces, 3,473 graph nodes and
1,970 executable nodes. Its two unresolved obligations remain:

1. Classify nested workspace and root command semantics.
2. Review dynamic Cache/CI/Quality/Yeet branches and their external verdicts.

After the tested source batch is committed, capture current planner scenarios
and source references, review the changed branch behavior, and bind that review
to a new census. Keep absent scripts as graph-only nodes, retain honest legacy
states, and distinguish fresh external verdicts from local task-result reuse.
Native signed qualification and the adoption handoff remain separate proof.
