---
title: "F-CURSOR native activation qualified on the composer-2.5 seat"
date: 2026-11-07
lane: "docs/rsc-1862-native-activation"
reversal: "Stop F-CURSOR native runs; delete the scratch workspace's ~/.cursor/projects/<scratch-slug>/ entry; rerun the three fixed prompts on claude-opus-5-5-medium after the 2026-11-11 quota reset if an Opus witness is wanted."
---

Refs #1862. The 2026-11-02 operator ruling parked F-CURSOR on the Cursor launcher sign-in; `cursor-agent status` reports logged in, so the gate is met. The ruling is read as the expanded owner scope the F-CURSOR row asked for: a native run writes Cursor session state under `~/.cursor` (chats, projects, statsig), and no CLI flag isolates that state.

The F-CURSOR row names no model. The Opus seat (`claude-opus-5-5-medium`) answers `ActionRequiredError` (usage limit, resets 2026-11-11), and setting a spend limit would spend money, so it is not set. The qualification therefore ran on `composer-2.5`, the manifest's `cursor.volume` role. That is a named role, not a same-provider substitution for an Opus pin. Every run passed `--sandbox enabled`, ran in a disposable scratch workspace, and carried no corpus, client material or secrets (D11). The prompts forbade git, sudo and pkexec, and the copied D21 shell guard denied a probe command containing `git` (D21).

Side effect found and reverted: `--model` on argv persists into `~/.cursor/cli-config.json` and replaces the operator's interactive default. The four model fields were restored from the pre-run copy, with a backup under `~/.config-backups/rsc-f-cursor.20261107T0326Z/`. Lanes that pass `--model` must restore or tolerate this. Evidence: `history/receipts/2026-11-07-native-activation.md`.
