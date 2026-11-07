---
title: "Compare original Storybook resolution against the draft candidate"
date: 2026-11-07
kind: checkpoint
pullRequest: 2827
reversal: "Restore the two proposed schema aliases from candidate 63f21c77; remove the diagnostic-only pretty setting. Keep the PR draft until controlled evidence is reviewed."
---

Temporarily restore the original Storybook schema resolution in draft PR #2827 while retaining accepted source, dependencies, workflows and cache permissions. Set pretty=false only for plain diagnostic formatting and to retain a visible code-path change relative to main. Run through existing hosted CI only; do not add a job, capacity, credential or workflow. Retain the passing candidate Check log and compare actual dependency hashes, cache origins, source/lock/tool identity and runtime context before attributing any outcome to aliases. A non-reproduction is not a fix. Keep candidate/current evidence distinct, preserve failure logs, restore the reviewed candidate after the bounded comparison, and do not self-merge or activate signing. No local compiler, tests, verify, publish or quality suite.
