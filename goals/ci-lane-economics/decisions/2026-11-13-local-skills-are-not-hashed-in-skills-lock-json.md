---
title: "Local skills are not hashed in skills-lock.json"
date: 2026-11-13
lane: "fix/skills-lock-local-unhashed"
reversal: "restore installedTreeHash for local entries and the hash comparison"
---

Of the 39 entries in `skills-lock.json`, 34 are `local`, and each carried `installedTreeHash`. For 33 of them that hash is a function of tracked files only, so it told git nothing new, yet every pull request that edited the skill had to rewrite its line. Skills several lanes edit at once (yeet, closeout) made #3226, #3241, #3248, #3250, #3251 and #3254 conflict on one line on 2026-11-13, and `main` drifted red twice (#3217, #3245).

Decision: a repo-authored skill entry is `_tag` and `installedTargets` only. `skills update --check` and `--check --offline` read both installed targets, hash them on the fly and require them to agree, and still validate frontmatter, the Codex configuration and the set of skills and targets against the lock. The five vendored entries keep their upstream pin, patch series and effective-tree hashes. `adhd`, the one local skill refetched from a floating upstream, keeps `installedTreeHash`: it records the tree `skills update` last fetched, which is the only thing an offline check can compare a hand edit of that skill with, so removing it would have weakened the Repo Sanity step.

The schema keeps `installedTreeHash` as an optional key so a lock written before this change still decodes. On a repo-authored entry it counts as lock drift and `skills update` drops it; the same pull request migrates the committed lock. After this the lock changes only when a skill is added, removed, retargeted, vendored or refetched.

No goal packet owns the skills tooling; this packet holds the decision that put the lock check in Repo Sanity, and the cost removed here is pull-request conflicts and the reruns they cause.
