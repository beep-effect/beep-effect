---
title: "Repo Sanity owns the skills lock check, gated on the paths it reads"
date: 2026-11-13
lane: "fix/ci-skills-lock-gate"
reversal: "Revert the pull request: the ci:repo-sanity:skills-lock step, the --skip-skills-lock flag, the skills pattern row and the lane gate's skills_lock output go away together."
---

No hosted lane ran `beep skills update --check`, so #3042, #3044, #3099, #3109, #3111 and #3166 merged over a stale `skills-lock.json` (fixed in #3225). Only the Skills Update Train ran it, and only on its own relock path.

Decision: the check is a step of Repo Sanity's lane body, on the documentation path and the full path, because Repo Sanity is required and a `SKILL.md` edit is a documentation diff. Over the v2 lock the check fetches nothing (every entry is local or vendored), reads tracked files only and takes about a second inside a job that is already set up, so it gets no job of its own. The step is on by default, which covers local replays, `yeet final-check` and main pushes. On a pull request check.yml's lane gate reads the new `skills` row of the change-profile pattern data with jq and grep and passes `--skip-skills-lock` when the diff touches none of: the installed skills, their .agents mirror and patch series, the lock, the Codex skill configuration, the skills command, and the gate's own sources. It is a top-level pattern row like `desktop`, not a relevance lane, because it gates a step and has no job to guard; the pinned CI binary reads the extended file unchanged (verified against beep-ci-202927595d64).
