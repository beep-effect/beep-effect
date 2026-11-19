---
title: "P5 port review: model and library findings fixed"
date: 2026-11-19
kind: checkpoint
lane: "feat/gate-report-services"
reversal: "Revert the port-review commit on the libraries lane."
---

A read-only review compared every ported module with its upstream file. Attribution, outcome precedence, footer dominance, failure-signature inputs and stray-output counting came back clean. Fixed for the model and the libraries: diagnostics with no location are told apart by their message; terminal escape sequences are stripped before the budget is counted; the console is unconditional; the cap line counts only dropped items; a load failure reads the same beside other modules or alone; a failed prune of old root runs no longer reports the record unwritten. Service shapes stay interfaces, as elsewhere in the repo. The adapter findings are fixed on the wiring lane.
