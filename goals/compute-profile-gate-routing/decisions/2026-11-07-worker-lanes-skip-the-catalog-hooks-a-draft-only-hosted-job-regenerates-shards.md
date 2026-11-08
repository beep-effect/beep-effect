---
title: "Worker lanes skip the catalog hooks; a draft-only hosted job regenerates shards"
date: 2026-11-07
reversal: "Remove the lefthook skip conditions and the check.yml regeneration job"
---

lefthook skip: - run: on both catalog commands (LEFTHOOK_EXCLUDE interim in the worker env). A check.yml job, draft PRs declaring compute-profile=worker only, regenerates scoped shards and pushes with the skills-update-train relock pattern (persist-credentials false, contents write, head.repo guard); never after yeet ready. Exploration D2, D3, D9.
