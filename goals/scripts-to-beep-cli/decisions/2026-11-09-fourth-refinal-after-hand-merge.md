---
title: "Fourth goals-only re-final after #2961 was hand-merged seven seconds after its ready flip"
date: 2026-11-09
kind: checkpoint
lane: "scripts-to-beep-cli-refinal4"
reversal: "Close this re-final and keep #2961 as the final PR"
---

#2961 merged at 11:35:12Z (main 031fa9d4af), seven seconds after it was flipped ready at 11:35:05Z, by hand from the operator account, with all 45 of its checks green. `goals completion refresh --slug scripts-to-beep-cli` on tbk-worker returned unknown: the review window was open at merge, no until-ready job ran on accepted head e8fa214954, the gating yeet-verdict file lives on the publishing workstation, and this guest's fine-grained token gets 403 on the ruleset-history and rule-suite endpoints the merge-time required-check inventory needs. This fourth re-final re-binds `proposedCloseout` to itself and keeps #2961 as a supporting PR. It stays a draft. The strict route (flip ready, `yeet monitor --until-ready` to merge-ready: yes, merge, `goals completion refresh --readiness-job <id>`) has to run from one workstation whose token reads rulesets, and the PR must not be hand-merged before the merge-ready line, which is what unbound the three previous finals.
