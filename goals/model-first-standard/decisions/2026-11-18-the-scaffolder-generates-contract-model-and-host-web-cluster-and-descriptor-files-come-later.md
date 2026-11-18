---
title: "The scaffolder generates contract, model and host; web, cluster and descriptor files come later"
date: 2026-11-18
lane: "claude/model-first-standard-scaffolder"
reversal: "Add the web, cluster and descriptor templates to the model-first plan"
---

bun run beep architecture create context <context> <Module> writes the contract, model and host packages with one aggregate, one command and one view. It generates no web package (the bindings generator is net-new in product-slice-model-first), no cluster or descriptor file (the descriptor schema is kernel work and the cluster wiring is goals/effect-cluster-host), and no Invocation or provenance (goals/authority-context). The seven-role commands stay and are labelled legacy. Design: research/01-scaffolder-design.md.
