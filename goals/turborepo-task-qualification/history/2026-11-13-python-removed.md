# Python removed from this packet (2026-11-13)

The `python-free-repo` goal bans tracked Python
([SPEC](../../../goals/python-free-repo/SPEC.md)). Nothing in a workflow, hook,
package script, skill, systemd unit or `opsScripts` entry still runs the
6 file(s) below, so they were deleted rather than ported. Their outputs and
the conclusions drawn from them stay in this packet, in the files listed under
"Recorded in".

Recover any script with
`git show 05ed8bc6b6cc50f2a284ed02caaab16f216bb9c3:<path>`. A resumed packet that needs to run one again
ports it to TypeScript first; tracked Python is no longer admitted.

| Deleted file | Recorded in (non-Python files that name it) |
| --- | --- |
| `research/refresh-adoption-handoff.py` | `goals/turborepo-task-qualification/research/adoption-handoff.md`, `goals/turborepo-task-qualification/research/adoption/manifest.json` |
| `research/refresh-command-boundaries.py` | `goals/boolean-creep/data/main-0be1f13d62-forward-2026-09-22.json`, `goals/turborepo-task-qualification/research/adoption/manifest.json`, `goals/turborepo-task-qualification/research/command-boundary-review.md` (+3 more) |
| `research/refresh-command-groups.py` | `goals/turborepo-task-qualification/research/command-decomposition.md`, `goals/turborepo-task-qualification/research/dependency-edge-entrypoint-request.json`, `goals/turborepo-task-qualification/research/entrypoint-census-integration.md` (+19 more) |
| `research/refresh-compiler-configs.py` | `goals/boolean-creep/data/main-0be1f13d62-forward-2026-09-22.json`, `goals/turborepo-task-qualification/research/compiler-config-review.md`, `goals/turborepo-task-qualification/research/entrypoint-review-tool-boundaries.json` (+1 more) |
| `research/refresh-nested-commands.py` | `goals/boolean-creep/data/main-0be1f13d62-forward-2026-09-22.json`, `goals/turborepo-task-qualification/research/adoption/manifest.json`, `goals/turborepo-task-qualification/research/entrypoint-review-command-boundaries.json` (+5 more) |
| `research/refresh-workflow-boundaries.py` | `goals/boolean-creep/data/main-0be1f13d62-forward-2026-09-22.json`, `goals/turborepo-task-qualification/research/entrypoint-review-command-boundaries.json`, `goals/turborepo-task-qualification/research/entrypoint-review-git-exclusion-repair.json` (+5 more) |
