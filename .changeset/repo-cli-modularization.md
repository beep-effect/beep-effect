---
"@beep/repo-cli": patch
"@beep/repo-utils": patch
"@beep/repo-ai-metrics": patch
---

Modularize @beep/repo-cli: split monolith command files along natural seams
into canonical role files, extract shared internal substrate (subprocess,
git, JSON/JSONC, ratchet, gh plumbing, schema kits), bring touched command
groups to full role topology, and raise JSDoc on touched files to the
`.patterns/jsdoc-documentation.md` rubric. Behavior-preserving; public export
catalog of @beep/repo-cli unchanged. Additive extensions to existing owners:
@beep/repo-utils gains walkFiles/exists/workspace-discovery helpers;
@beep/repo-ai-metrics gains withAiMetricsDuckDb + data-root constants.
Campaign packet: `goals/repo-cli-modularization/`.
