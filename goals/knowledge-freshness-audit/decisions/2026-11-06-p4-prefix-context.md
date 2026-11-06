---
title: "Make existing query example prefix context explicit"
date: 2026-11-06
kind: checkpoint
lane: "codex/knowledge-audit-p4-enforcement-context"
reversal: "Remove only the added prefix mappings and prologue explanation; preserve query bodies and the private parent review."
---

Original T14 t14-6805ebba1de26ec6 and T21 t21-f48d16497c14c00c frozen file and line hashes matched. Parent review qualifies the omitted-prefix finding: host injection can supply context, so no universal runtime failure is proven. Existing copyable examples still omit mappings under their own include-prefix rule. Add explicit rdf, default and federation mappings without changing query bodies; explain dataset placeholder and shared prologue reuse. W3C SPARQL1.1 section4.1.1.1 is the primary syntax reference. Static source review only: no engine, endpoint, ontology operation or vendor behavior certification. Fresh16-PR target census found no overlap. PM, ADHD, private records and broader P4 remain separate; no spending.
