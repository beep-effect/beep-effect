---
title: "P2 content-final and pushed; its PR holds until PR C merges, then opens against main"
date: 2026-11-22
kind: checkpoint
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Open the P2 PR earlier only on the orchestrator's word, by a superseding checkpoint."
---

P2 is content-final on its branch: yeet final-check passed on 183872d5710 against the PR C head 0c1653b699f, with coverage skipped locally and proved hosted. delete-package @beep/provenance --check prints clean, and the check census is re-measured after the PR C merge. yeet open --stack-on 3449 refuses (parent-off-trunk): PR C targets the PR B branch and a native stack holds two layers. The orchestrator ruled (2026-11-22) that P2 opens no PR until PR C (#3449) merges after P5 step 4b. A base retarget with gh pr edit would route around the tool refusal. A draft against main would spend heavy runs on a diff that double-counts B and C while the heavy pool runs one at a time. Once C merges: merge origin/main into the P2 lane, re-prove cheaply, yeet open against main, and post final on hosted green. P3 design proceeds meanwhile in its own lane with no PR.
