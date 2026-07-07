---
"@beep/repo-cli": patch
---

Modularize @beep/repo-cli: split monolith command files along natural seams
into canonical role files, extract shared internal substrate (subprocess,
git, JSON/JSONC, ratchet, gh plumbing, schema kits), bring touched command
groups to full role topology, and raise JSDoc on touched files to the
`.patterns/jsdoc-documentation.md` rubric. Behavior-preserving; public export
catalog unchanged. Campaign packet: `goals/repo-cli-modularization/`.
