---
title: "Delete the scripts heavy.yml@main still calls in a third PR"
date: 2026-11-07
lane: "scripts-to-beep-cli-p2"
pullRequest: 2906
reversal: "Delete the seven scripts in #2906 and accept red Heavy lanes until it merges"
---

check.yml calls heavy.yml as a reusable workflow pinned to @main, so a PR's own heavy.yml edits take effect only after merge. #2906 deleted the scripts that main's heavy.yml calls and every Heavy lane failed at its first step (`scripts/ci-change-profile.sh: No such file`, then `goals_only: unbound variable`; run 42418724321). #2906 therefore keeps the seven scripts that heavy.yml@main references (`ci-change-profile.sh`, `ci-runner-resources.sh`, `ci-prune-apt-sources.sh`, `ci-cache-native-sandbox.sh`, `ci-cache-pilot-cleanup.sh`, `ci-cache-pilot-inputs.sh`, `ci-cache-local-summary.py`) while it switches every workflow to the pinned binary. The tracked-shell law allowlists those exact files, with the removal condition 'deleted by PR 3'. PR 3, opened after #2906 makes the binary-calling heavy.yml the @main copy, deletes them and their allowlist entries and is the goal's final PR carrying proposedCloseout.
